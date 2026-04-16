# Mail Auto Sync (IMAP IDLE + Catch-up Polling) Design

**Date:** 2026-04-16

## Goal

Replace the current user-triggered email sync flow with an automatic background sync flow based on persistent IMAP watchers plus a bounded catch-up polling fallback.

After this change:

- configured mail accounts start watching automatically when the service boots
- new mail detection no longer depends on the user clicking a sync button
- detected email-derived schedule candidates still flow into the existing Daily intake model
- the renderer becomes a status and delivery surface, not the primary sync trigger

## Current Problem

The current implementation is still request-driven:

- the user clicks `同步`
- `packages/web/src/features/integrations/IntegrationsPage.tsx` calls `POST /api/email/accounts/sync`
- `packages/service/src/routes/email.ts` creates a one-off IMAP connection, fetches recent messages, detects schedule candidates, returns them to the frontend, and disconnects
- the frontend then persists candidates and decides whether to auto-create schedules or notify the user

This has four problems:

1. the primary sync path is manual
2. repeated full-ish fetches waste network and login overhead
3. email-derived candidates only enter Daily when the renderer happens to make the sync request
4. background resilience is weak because there is no long-lived watcher lifecycle, no durable cursor, and no recovery path after reconnect

## Chosen Direction

Use IMAP long-lived connections in `packages/service` as the source of truth for mailbox watching, with periodic catch-up sync as a reliability fallback.

The service will:

- start one watcher per stored mail account that still has a readable secret in secure storage
- keep the IMAP connection alive with heartbeat and reconnect behavior
- treat IMAP `mail` events as a trigger, not as the final source of truth
- run a debounced incremental catch-up sync after each trigger
- run a low-frequency fallback incremental sync even if no `mail` event arrives
- persist watcher cursors and detected schedule candidates in the shared Daily SQLite database
- emit lightweight runtime events to the renderer for status refresh, notifications, and immediate UI updates

The renderer will:

- subscribe once at app level to mail watcher events
- reuse the existing external schedule intake flow to create schedules or open pending review
- show sync/watch state to the user
- stop presenting the manual sync button as the main interaction

## Architecture

### Service Ownership

`packages/service` becomes responsible for:

- IMAP watcher lifecycle
- incremental mail fetch and de-duplication
- durable watcher cursor persistence
- candidate persistence into shared SQLite
- runtime event broadcasting to renderer clients

`packages/web` remains responsible for:

- integration settings UI
- account list and watch status display
- turning newly persisted candidates into user-facing actions
- schedule auto-creation or pending review according to the existing external schedule preference
- triggering Tauri system notifications

`packages/desktop` remains responsible for:

- the actual Daily SQLite schema for schedules, settings, and external candidates
- schedule creation commands
- system notifications

### Why This Split

This keeps the IMAP complexity inside the service where the existing connector already lives, while avoiding duplication of schedule-creation logic that is currently implemented in the Tauri layer.

The service should not write `schedule_items` directly in this iteration. It should write normalized external schedule candidates and let the existing Daily intake layer decide how those candidates become schedules.

## Data Model Changes

### Mail Account State

Extend `mail_accounts` with one new optional field:

- `last_sync_error TEXT NULL`

This gives the UI a durable way to explain background watch failures after reloads or reconnect loops.

`sync_status` keeps its existing meaning but is interpreted as background watcher state:

- `syncing`: initial catch-up or event-driven incremental sync in progress
- `idle`: watcher connected or ready
- `error`: watcher failed and currently has no healthy session

### New Table: `mail_sync_cursors`

Add a dedicated cursor table in the shared Daily SQLite database.

Suggested fields:

- `account_id TEXT PRIMARY KEY`
- `folder TEXT NOT NULL DEFAULT 'INBOX'`
- `uid_validity TEXT`
- `last_seen_uid INTEGER NOT NULL DEFAULT 0`
- `last_seen_message_id TEXT`
- `last_event_at TEXT`
- `last_synced_at TEXT`
- `updated_at TEXT NOT NULL`

Purpose:

- persist incremental progress independently from transient watcher memory
- recover safely after service restart, app restart, network drop, or sleep/wake
- detect when IMAP UID validity changes and force a bounded rescan

### Extend `external_schedule_candidates`

Add one delivery field:

- `notified_at TEXT NULL`

Purpose:

- prevent duplicate system notifications after renderer reload, reconnect, or app restart
- allow the renderer to reconcile pending candidates safely without repeatedly notifying for the same source event

The existing `status` field remains the business-state field:

- `pending`
- `accepted`
- `dismissed`
- `auto_created`

## Runtime Components

### 1. Mail Watch Coordinator

Create a new coordinator in `packages/service` that starts when the Express app boots.

Responsibilities:

- load all accounts from `MailAccountStore`
- create, start, stop, and restart account watchers
- react to account add/delete operations immediately
- serialize sync work per account
- publish runtime events

This coordinator should be owned at process scope from `packages/service/src/index.ts`, not inside a single request handler.

### 2. Account Watcher

Create one watcher object per account.

Responsibilities:

- build connector config from `MailAccountStore` and `MailSecretStore`
- connect and authenticate once
- subscribe to connector events such as `mail`, `close`, `error`, and `reconnected`
- run initial catch-up sync on startup
- debounce rapid `mail` events into one incremental sync job
- maintain a low-frequency periodic catch-up timer so providers with unreliable IDLE push still converge
- update `mail_accounts` runtime state and `mail_sync_cursors`

The watcher must guarantee only one sync job per account at a time. If multiple `mail` events arrive during a sync, it should mark the account as needing one follow-up sync when the current job completes.

### 3. Candidate Store

Add a thin SQLite store in `packages/service` for `external_schedule_candidates`.

Responsibilities:

- ensure the table and `notified_at` migration exist
- upsert candidates using the same identity semantics already used in the app
- preserve existing `status` if the candidate already exists
- expose a way to list newly inserted or still-pending candidates for the renderer reconciliation flow

This store writes into the same Daily database file already used by `MailAccountStore`.

Candidate de-duplication priority should be explicit:

1. `source + source_event_id`
2. `source + source_message_id`
3. `title + start_at + end_at + source_account_id`

### 4. Renderer Subscription Hook

Add one app-level hook in `packages/web`, mounted near the root, that subscribes to service events through Server-Sent Events.

Responsibilities:

- receive watcher state changes
- receive candidate-detected events
- trigger account list refresh
- reconcile newly persisted candidates
- deliver notifications only for candidates whose `notified_at` is still null
- in automatic mode, create schedules immediately and mark them `auto_created`
- in reminder mode, keep them `pending` and open the existing review flow

This hook is the bridge between automatic service-side detection and the existing Tauri-based notification and schedule creation commands.

## Sync Flow

### Service Boot

When the service starts:

1. ensure mail account migration has completed
2. ensure `mail_sync_cursors` and the candidate-store migration exist
3. start the mail watch coordinator
4. create watchers for every configured account
5. each watcher performs one bounded catch-up incremental sync before entering watch mode

The initial catch-up is required even when IMAP `mail` events are available, because the service may have been offline while new mail arrived.
If an account secret cannot be loaded, the coordinator should mark that account as `error`, persist `last_sync_error`, and continue starting other watchers.

### Account Added

When `POST /api/email/accounts` succeeds:

1. metadata is written to SQLite
2. the secret is written to secure storage
3. the coordinator registers the new account immediately
4. the new watcher performs its initial catch-up sync without waiting for user action

### Account Deleted

When `DELETE /api/email/accounts/:id` succeeds:

1. the coordinator stops and disposes the watcher
2. the account metadata and secret are deleted as they are today
3. the cursor row for that account is deleted

Existing candidates sourced from that account should remain in `external_schedule_candidates` because they represent already-detected product state.

### New Mail Arrives

When IMAP emits `mail` for an account:

1. the watcher records `last_event_at`
2. it schedules a debounced incremental sync
3. the sync loads the durable cursor
4. it searches for messages newer than the cursor, not simply “latest N messages”
5. it fetches those messages, detects schedule candidates, and upserts them
6. it updates `last_seen_uid`, `last_synced_at`, `mail_accounts.last_synced_at`, and clears `last_sync_error`
7. it emits a runtime event with account id and candidate ids

The watcher must not rely only on the event payload count, because IMAP `mail` indicates new mail exists but does not replace durable incremental reconciliation.

### No Event Fallback

Some IMAP providers or mailbox states do not reliably surface `mail` events even while IDLE is active.

To keep automatic sync effective in those cases, each watcher also runs a low-frequency catch-up sync timer.

Rules:

- the fallback timer does not replace IMAP `mail`; it only closes reliability gaps
- the timer reuses the same serialized incremental sync path as event-driven sync
- if a sync is already running, the watcher should coalesce the fallback trigger into a single follow-up pass
- the production interval should stay conservative enough to avoid unnecessary load while still recovering within a user-noticeable window

## Incremental Sync Rules

### Primary Cursor

Use `last_seen_uid` as the main high-water mark for INBOX.

On each incremental sync:

- search for messages in INBOX with `UID > last_seen_uid`
- sort ascending by UID
- fetch in bounded batches
- advance the cursor only after processing each batch successfully

### UID Validity Reset

If the server reports a different `UIDVALIDITY` than the persisted one:

- reset `last_seen_uid` to `0`
- keep a bounded fallback window, such as the last 7 days or last 200 messages, to avoid full-history replay
- rely on candidate de-duplication by source identity to prevent duplicate product records

### Reconnect Catch-Up

After reconnect or wake-from-sleep:

- do not assume the watcher stayed current
- always run one incremental catch-up sync before returning to idle watch mode

## API Changes

### Keep Existing Routes

Keep:

- `GET /api/email/accounts`
- `POST /api/email/accounts`
- `DELETE /api/email/accounts/:id`
- `POST /api/email/accounts/test`

### Rework Manual Sync Route

`POST /api/email/accounts/sync` should become a manual rescue action, not the main sync mechanism.

Recommended behavior:

- trigger an immediate catch-up sync on the target watcher
- return current account state plus any newly detected candidate ids
- remain available for debugging and user recovery

### Add Watch Event Stream

Add:

- `GET /api/email/watch/events`

Use Server-Sent Events with events such as:

- `account-state`
- `account-synced`
- `candidates-detected`

The payload should stay compact and contain identifiers plus timestamps, not full email bodies.

### Status Summary Route

Add:

- `GET /api/email/watch/status`

This route is required. It returns a snapshot of all watcher states so the renderer can hydrate quickly before the SSE stream starts delivering updates.

## UI Changes

### Integrations Page

The email account card in `packages/web/src/features/integrations/IntegrationsPage.tsx` should change from a manual-sync action surface into a watcher status surface.

Required changes:

- remove the current “click sync to pull mail” mental model
- replace the main action with passive status text such as “监听中 / 正在重连 / 同步失败”
- keep a smaller secondary action for manual retry or reconnect
- show `lastSyncedAt`
- show the latest background error when `last_sync_error` is present

### App-Level Background Hook

Add a root-level hook, mounted from `App.tsx` or the router shell, so automatic mail sync is active no matter which page is open.

This hook should:

- open the SSE connection once
- refresh account state on connection and reconnect
- reconcile pending candidates on startup, reconnect, and visibility return

### External Schedule Intake Reuse

Do not create a second schedule-intake implementation.

Instead:

- keep `useExternalScheduleIntake` and related commands as the canonical UI-layer intake flow
- add one helper that can process already-persisted candidates whose `status = 'pending'`
- in automatic mode, convert eligible pending candidates to schedules and mark them `auto_created`
- in reminder mode, keep the current review flow

## Notification Delivery

Notifications remain renderer-owned because the current implementation depends on Tauri commands.

Rules:

- notify only when `notified_at IS NULL`
- after successful notification delivery, set `notified_at`
- do not notify again on renderer reconnect, focus, or app restart if `notified_at` already exists

For automatic mode:

- auto-create the schedule first
- then send an informational notification

For reminder mode:

- keep the candidate pending
- send a notification that nudges the user back into Daily review

## Failure Handling

### Authentication Failure

If authentication fails:

- mark `mail_accounts.auth_status = 'error'`
- mark `sync_status = 'error'`
- store `last_sync_error`
- stop automatic retries after the configured retry ceiling
- require either account update or manual retry

### Transient Network Failure

If the network drops or heartbeat fails:

- keep `auth_status` as the last known non-auth state
- mark `sync_status = 'error'` during outage
- let the watcher attempt bounded reconnects with backoff
- after reconnect, run catch-up sync before returning to idle

### Renderer Offline

If the renderer is disconnected while the service continues watching:

- candidate persistence must still succeed in SQLite
- watcher state must still update in SQLite
- on next renderer connection, the app reconciles pending candidates from SQLite and only notifies for rows not yet marked with `notified_at`

This ensures automatic sync does not depend on the SSE client being continuously connected.

## Testing

Add focused tests for:

- coordinator startup creating watchers for stored accounts
- account add/delete wiring into coordinator lifecycle
- per-account sync serialization when multiple `mail` events arrive
- cursor persistence and resume after simulated restart
- reconnect catch-up behavior
- candidate de-duplication across repeated incremental syncs
- notification de-duplication via `notified_at`

UI-level tests should cover:

- integrations page rendering watch status instead of a primary manual sync flow
- renderer reconciliation processing persisted candidates after startup or reconnect
- automatic mode and reminder mode both working from persisted candidates, not only from immediate route responses

## Success Criteria

- users no longer need to click sync for normal email ingestion
- service startup automatically begins mailbox watching for configured accounts
- new mail detection survives reconnects and process restarts through durable cursors
- repeated watcher events do not create duplicate candidates or duplicate notifications
- renderer restarts do not lose detected candidates
- integrations UI reflects background watch state clearly and still offers manual recovery when needed
