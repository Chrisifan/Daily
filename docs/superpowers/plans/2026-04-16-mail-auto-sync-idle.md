# Mail Auto Sync (IMAP IDLE + Catch-up Polling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual mailbox sync with service-owned IMAP IDLE watchers that persist incremental state, emit renderer updates, and automatically feed Daily's existing external schedule intake flow, while retaining a periodic catch-up sync fallback for providers with unreliable push.

**Architecture:** Extend the shared SQLite-backed mail account layer with durable watch state and cursors, add a service-side watch coordinator plus SSE broadcast channel, use IMAP push as the fast path, and add a serialized periodic catch-up sync as the reliability path. Move the renderer from request-driven sync to app-level event reconciliation against persisted external schedule candidates. Keep schedule creation and notifications in the existing Tauri-backed web layer.

**Tech Stack:** Node.js, Express, TypeScript, node:test, React 19, Vite, Tauri commands, Server-Sent Events, SQLite

---

### Task 1: Extend shared email persistence for watcher state and candidate delivery

**Files:**
- Modify: `packages/service/src/services/email/mail-account-store.ts`
- Modify: `packages/service/src/services/intake/external-schedule-candidate.ts`
- Create: `packages/service/src/services/email/mail-sync-cursor-store.ts`
- Create: `packages/service/src/services/intake/external-schedule-candidate-store.ts`
- Test: `packages/service/src/services/email/mail-account-store.test.ts`
- Test: `packages/service/src/services/email/mail-sync-cursor-store.test.ts`
- Test: `packages/service/src/services/intake/external-schedule-candidate-store.test.ts`

- [x] Add failing persistence tests for `lastSyncError`, cursor state, and candidate notification state.
- [x] Run the targeted service tests and confirm they fail before implementation.
- [x] Implement the minimal SQLite-backed stores and schema migrations.
- [x] Re-run the targeted service tests and confirm they pass.

### Task 2: Build the service-side watch coordinator and event stream

**Files:**
- Create: `packages/service/src/services/email/mail-watch-events.ts`
- Create: `packages/service/src/services/email/mail-watch-service.ts`
- Modify: `packages/service/src/routes/email.ts`
- Modify: `packages/service/src/index.ts`
- Test: `packages/service/src/services/email/mail-watch-service.test.ts`

- [x] Add failing tests for watch service state updates and SSE event broadcasting.
- [x] Run the new watch-service tests and confirm red state.
- [x] Implement the coordinator, per-account watchers, and `/watch/status` plus `/watch/events`.
- [x] Re-run the watch-service tests and confirm green state.

### Task 3: Move the web app to app-level watcher reconciliation

**Files:**
- Modify: `packages/web/src/domain/intake/types.ts`
- Modify: `packages/web/src/shared/services/externalScheduleIntakeService.ts`
- Create: `packages/web/src/shared/services/emailWatchService.ts`
- Create: `packages/web/src/shared/hooks/useMailWatchSync.ts`
- Modify: `packages/web/src/app/layout/AppLayout.tsx`
- Modify: `packages/web/src/features/integrations/IntegrationsPage.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [x] Use the web build as the red/green loop for the new watcher APIs and status UI.
- [x] Implement a root-level watch hook, candidate reconciliation from persisted rows, and watcher status display.
- [x] Re-run the web build and confirm it passes.

### Task 4: Verify the end-to-end build and update planning docs

**Files:**
- Modify: `docs/superpowers/plans/2026-04-16-mail-auto-sync-idle.md`

- [x] Mark completed tasks in this plan.
- [x] Run `pnpm --filter @daily/service build`.
- [x] Run the targeted service `node --test` suite.
- [x] Run `pnpm --filter @daily/web build`.
- [x] Run `cargo test` if the dependency compile fits in this turn; otherwise record the exact verification gap.
