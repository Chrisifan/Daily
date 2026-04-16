# System Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS-only, read-only system calendar integration that can request permission, sync local calendar events into Daily schedules, and clearly disable the feature on unsupported platforms.

**Architecture:** Extend the desktop layer with a system-calendar capability/status store plus Tauri commands for permission and sync, implement a macOS-native calendar reader and imported-event upsert flow keyed by `source_event_id`, and add a provider-aware system calendar card to the Integrations page. Reuse the existing `schedule_items` import model with `source = "system_calendar"` and keep the UI environment-aware so unsupported platforms remain explicit and non-interactive.

**Tech Stack:** React 19, TypeScript, node:test, Tauri 2, Rust, rusqlite, macOS EventKit bridge, SQLite

---

### Task 1: Add desktop persistence and command shape for system calendar status

**Files:**
- Modify: `packages/desktop/src/lib.rs`
- Test: `packages/desktop/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests for the new integration state schema**

Add tests that verify:
- `system_calendar_sync_state` is created during schema bootstrap
- unsupported platforms return `available = false`
- default status for a fresh install is disconnected + idle + no sync timestamps

- [ ] **Step 2: Run the new desktop tests to verify they fail**

Run: `cargo test system_calendar`
Expected: FAIL because the new schema helpers and commands do not exist yet.

- [ ] **Step 3: Add a small system calendar sync-state table and helpers**

Implement in `packages/desktop/src/lib.rs`:
- schema bootstrap for `system_calendar_sync_state`
- a stable row id such as `system-calendar`
- helpers to read and update:
  - `available`
  - `auth_status`
  - `sync_status`
  - `last_synced_at`
  - `last_sync_error`
  - `updated_at`

- [ ] **Step 4: Add Tauri commands for capability and status**

Implement command surface in `packages/desktop/src/lib.rs`:
- `get_system_calendar_status`
- `request_system_calendar_access`
- `sync_system_calendar`

Define one shared response shape so the web layer can consume it consistently:
- `available`
- `authStatus`
- `syncStatus`
- `lastSyncedAt`
- `lastSyncError`

- [ ] **Step 5: Register commands and rerun tests**

Run: `cargo test system_calendar`
Expected: PASS for the new schema/status coverage.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/lib.rs
git commit -m "feat: add system calendar sync state commands"
```

### Task 2: Implement the macOS-native calendar reader and event mapping

**Files:**
- Modify: `packages/desktop/src/lib.rs`
- Create: `packages/desktop/src/system_calendar.rs` or equivalent focused module if the file split is needed
- Test: `packages/desktop/src/lib.rs`

- [ ] **Step 1: Write failing tests for imported-event mapping and upsert matching**

Add tests that verify:
- native event id maps to `source_event_id`
- start/end convert into `start_at` + `duration_minutes`
- all-day or edge-case events normalize to safe schedule values
- existing imported rows with matching `source = "system_calendar"` and `source_event_id` are updated instead of duplicated

- [ ] **Step 2: Run the targeted desktop tests to verify red state**

Run: `cargo test system_calendar_event`
Expected: FAIL because the mapping/upsert code is not implemented.

- [ ] **Step 3: Implement a macOS-only calendar adapter**

Add a focused calendar adapter that:
- is compiled and used only on macOS
- requests/reads native calendar permission
- fetches local calendar events in the sync window
- maps native events into Daily's imported schedule input shape

Keep the adapter boundary narrow:
- one method for requesting access
- one method for listing events in a date range

- [ ] **Step 4: Reuse imported schedule storage for sync upserts**

Implement sync flow that:
- fetches events from 30 days in the past through 180 days in the future
- inserts new imported schedules with `source = "system_calendar"`
- updates existing rows matched by `source_event_id`
- optionally deletes stale imported rows from the same sync window when they no longer exist in the source

- [ ] **Step 5: Handle unsupported platforms safely**

Ensure:
- non-macOS builds never attempt native calendar reads
- permission and sync commands return `available = false` without misleading error churn

- [ ] **Step 6: Run desktop tests again**

Run: `cargo test system_calendar`
Expected: PASS for status, mapping, and imported upsert coverage.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/lib.rs packages/desktop/src/system_calendar.rs
git commit -m "feat: add macos system calendar sync adapter"
```

### Task 3: Add web-side integration services and platform-aware view model

**Files:**
- Create: `packages/web/src/shared/services/systemCalendarService.ts`
- Create: `packages/web/src/features/integrations/system-calendar-view-state.ts`
- Test: `packages/web/src/features/integrations/system-calendar-view-state.test.ts`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] **Step 1: Write failing tests for system calendar view-state behavior**

Add tests that cover:
- unsupported platform -> disabled state and unavailable copy
- disconnected macOS state -> connect action enabled
- syncing/error states -> correct badge and helper text

- [ ] **Step 2: Run the new web tests to verify they fail**

Run: `./node_modules/.bin/tsx --test src/features/integrations/system-calendar-view-state.test.ts`
Expected: FAIL because the service/view-state module does not exist yet.

- [ ] **Step 3: Implement a focused desktop bridge service**

Create `packages/web/src/shared/services/systemCalendarService.ts` with helpers for:
- `getSystemCalendarStatus`
- `requestSystemCalendarAccess`
- `syncSystemCalendar`

Keep the response type aligned with the desktop command payload.

- [ ] **Step 4: Implement a system calendar view-state helper**

Create `packages/web/src/features/integrations/system-calendar-view-state.ts` that turns raw status into:
- label text
- badge appearance
- disabled/enabled action flags
- error/helper text

This keeps Integrations UI logic flat and testable.

- [ ] **Step 5: Add localization for the new integration**

Update `packages/web/src/locales/zh.json` and `packages/web/src/locales/en.json` with:
- title
- unavailable copy
- connect/sync labels
- status labels
- success and failure feedback strings

- [ ] **Step 6: Rerun the targeted web tests**

Run: `./node_modules/.bin/tsx --test src/features/integrations/system-calendar-view-state.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/shared/services/systemCalendarService.ts packages/web/src/features/integrations/system-calendar-view-state.ts packages/web/src/features/integrations/system-calendar-view-state.test.ts packages/web/src/locales/zh.json packages/web/src/locales/en.json
git commit -m "feat: add system calendar integration web state"
```

### Task 4: Integrate the system calendar card into the Integrations page

**Files:**
- Modify: `packages/web/src/features/integrations/IntegrationsPage.tsx`
- Modify: `packages/web/src/features/integrations/integrations-view-state.test.ts`
- Test: `packages/web/src/features/integrations/system-calendar-view-state.test.ts`

- [ ] **Step 1: Add a failing UI test or state test for the new integrations section**

Cover:
- card visible when available
- card visible but disabled when unavailable
- status refresh after connect and sync

- [ ] **Step 2: Run the relevant integrations tests**

Run: `./node_modules/.bin/tsx --test src/features/integrations/integrations-view-state.test.ts src/features/integrations/system-calendar-view-state.test.ts`
Expected: FAIL because the Integrations page does not render or update the new card yet.

- [ ] **Step 3: Extend IntegrationsPage with system calendar state**

Update the page to:
- load system calendar status on mount
- request access on connect
- trigger sync on demand
- show last sync time and last error
- keep unsupported platforms visible but disabled

Follow the same async feedback conventions already used for email:
- loading button state
- success toast
- error toast
- repeated clicks disabled during execution

- [ ] **Step 4: Keep platform checks explicit**

Ensure the page never:
- shows a connect button as active on unsupported platforms
- surfaces unsupported platform as a sync error
- hides the feature entirely

- [ ] **Step 5: Re-run integrations tests**

Run: `./node_modules/.bin/tsx --test src/features/integrations/integrations-view-state.test.ts src/features/integrations/system-calendar-view-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/features/integrations/IntegrationsPage.tsx packages/web/src/features/integrations/integrations-view-state.test.ts packages/web/src/features/integrations/system-calendar-view-state.test.ts
git commit -m "feat: add system calendar integration card"
```

### Task 5: Verify imported schedule behavior and end-to-end build health

**Files:**
- Modify: `docs/superpowers/plans/2026-04-16-system-calendar-integration.md`

- [ ] **Step 1: Mark completed tasks in this plan if implementation details shift**

Update this plan file if any file paths, command names, or deletion behavior changed during implementation.

- [ ] **Step 2: Run the focused web and desktop tests**

Run: `./node_modules/.bin/tsx --test src/features/integrations/system-calendar-view-state.test.ts`
Expected: PASS

Run: `cargo test system_calendar`
Expected: PASS

- [ ] **Step 3: Run full build verification**

Run: `pnpm --filter @daily/web build`
Expected: PASS

Run: `cargo test`
Expected: PASS

- [ ] **Step 4: Manual verification on macOS**

Verify on a macOS machine:
- deny calendar permission and confirm the UI shows a recoverable disconnected/error state
- grant calendar permission and confirm the status changes to connected
- trigger sync and confirm native calendar events appear in the schedule list with `source = "system_calendar"`
- re-run sync after editing a native event and confirm the imported Daily event updates instead of duplicating

- [ ] **Step 5: Manual verification on unsupported platform**

Verify on a non-macOS environment if available:
- the system calendar card is visible
- actions are disabled
- the helper copy clearly states macOS-only availability

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-04-16-system-calendar-integration.md
git commit -m "docs: finalize system calendar integration plan"
```
