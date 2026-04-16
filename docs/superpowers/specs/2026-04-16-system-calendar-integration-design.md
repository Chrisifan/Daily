# System Calendar Integration Design

**Date:** 2026-04-16

## Goal

Add a system calendar integration to Daily that supports macOS-only, read-only synchronization from the user's local system calendar into the existing schedule model.

After this change:

- the Integrations page includes a `系统日历` integration card
- on macOS, users can grant calendar access and trigger synchronization
- synced calendar events are imported into `schedule_items` with `source = "system_calendar"`
- repeated syncs update existing imported events instead of creating duplicates
- non-macOS environments clearly show that the feature is unavailable

## Current Problem

Daily already has:

- a schedule storage model with `source`, `source_event_id`, and imported schedule creation support
- an integrations page for email-based sync
- an external schedule intake flow that can import non-manual events into the schedule table

But it does not yet have:

- a real system calendar connector
- permission handling for native calendar access
- an integrations UI for calendar sync status
- environment-aware availability for platform-specific calendar features

This creates two immediate gaps:

1. users cannot bring native macOS calendar events into Daily
2. the app has no explicit way to communicate that system calendar sync is platform-dependent

## Chosen Direction

Use a macOS-native, read-only calendar connector exposed through Tauri commands, with provider-aware UI states in the Integrations page.

The desktop layer will:

- detect whether system calendar integration is supported on the current platform
- request and inspect macOS calendar permission state
- read calendar events from the local system calendar
- upsert imported events into the existing `schedule_items` table by `source_event_id`

The web layer will:

- show a `系统日历` integration entry with environment-aware availability
- request access and trigger sync through Tauri commands
- display last sync time, sync status, and any sync error

This keeps platform-specific logic in the desktop layer while reusing the existing schedule and integration patterns in the web layer.

## Scope Boundary

This iteration is intentionally limited to:

- macOS only
- read-only sync from system calendar into Daily
- manual sync trigger plus initial connect flow
- syncing a bounded time window of events

This iteration explicitly does not include:

- writing Daily schedule edits back to the system calendar
- background push subscriptions or automatic live watching
- Windows calendar integration
- Google Calendar or Outlook account-based calendar providers

## Platform Availability Rules

### macOS

On macOS:

- the integration is available
- the user can connect, authorize, and sync
- the app reads events from the local system calendar store

### non-macOS

On non-macOS:

- the integration card remains visible for discoverability
- connect and sync controls are disabled
- the UI explains that this feature is currently only supported on macOS

This keeps the product surface predictable across environments while making capability differences explicit.

## User Experience

### Integrations Page

Add a second integration card alongside email:

- title: `系统日历`
- subtitle or helper copy:
  - macOS available state: local calendar events can be imported into Daily
  - non-macOS unavailable state: currently only supported on macOS

Suggested states:

- `未连接`: permission not yet granted
- `已连接`: permission granted and usable
- `同步中`: sync in progress
- `同步失败`: last sync failed
- `当前环境不可用`: non-macOS platform

Suggested actions:

- `连接系统日历`
- `立即同步`

### Schedule Surface

Imported calendar events should appear in the existing schedule views with:

- `source = "system_calendar"`
- normal time, title, and location rendering
- no special edit affordance beyond what already exists for imported schedules

Because this is read-only sync, the product should treat system calendar events as imported records, not as user-owned manual schedules.

## Data Model Changes

### Existing Schedule Table

Reuse the current `schedule_items` table and imported schedule path.

Required fields already exist:

- `source`
- `source_event_id`
- `title`
- `start_at`
- `timezone`
- `duration_minutes`
- `location`
- `notes`

No new schedule table is required.

### New Integration State

Add a small desktop-side state record for the system calendar integration.

Recommended new table: `system_calendar_sync_state`

Columns:

- `id TEXT PRIMARY KEY`
- `platform TEXT NOT NULL`
- `auth_status TEXT NOT NULL`
- `sync_status TEXT NOT NULL`
- `last_synced_at TEXT`
- `last_sync_error TEXT`
- `updated_at TEXT NOT NULL`

This mirrors the email integration status shape closely enough that the Integrations page can render both in a consistent way.

The single row can use a stable id such as `system-calendar`.

## Desktop Architecture

### 1. Capability Detection

Expose a Tauri command that reports:

- current platform
- whether system calendar integration is supported
- whether native calendar permission is available to request on this platform

The web layer should not infer support from user agent strings or browser APIs.

### 2. Permission and Status Commands

Add desktop commands to:

- get current system calendar integration status
- request calendar access on macOS
- trigger a sync

Suggested command surface:

- `get_system_calendar_status`
- `request_system_calendar_access`
- `sync_system_calendar`

Responses should include:

- `available`
- `authStatus`
- `syncStatus`
- `lastSyncedAt`
- `lastSyncError`

### 3. macOS Calendar Reader

Implement a macOS-only native adapter that:

- requests calendar permission
- lists calendars available in the local calendar store
- fetches events inside the sync window
- maps each event into Daily's imported schedule format


The adapter should normalize:

- native event id -> `source_event_id`
- event title -> `title`
- event start/end -> `start_at` + `duration_minutes`
- event notes -> `notes`
- event location -> `location`
- all-day and edge-case durations into safe schedule values

### 4. Sync Upsert Flow

For each fetched native event:

- look for an existing `schedule_items` row where:
  - `source = "system_calendar"`
  - `source_event_id` matches
- update the row if it exists
- insert a new imported row if it does not

This should reuse or parallel the existing `create_imported_schedule` path so imported events remain consistent across sources.

### 5. Removed or Missing Events

In this iteration, missing native events should be handled conservatively.

Recommended behavior:

- if an event disappears from the current sync window and was previously imported from `system_calendar`, delete the corresponding imported row

This keeps Daily aligned with the system calendar for the active sync window and avoids stale imported events lingering indefinitely.

If deletion logic adds too much complexity during implementation, a temporary fallback is acceptable:

- only upsert currently visible events
- defer stale imported event cleanup to a follow-up task

The preferred implementation is deletion within the bounded sync window.

## Sync Window

Use a bounded sync range to avoid importing the entire calendar store.

Recommended default window:

- from 30 days in the past
- to 180 days in the future

Why:

- includes recent context for already-started or recently-ended events
- covers normal forward planning needs
- keeps native fetch and upsert costs predictable

## Error Handling

### Permission Denied

If the user denies calendar access:

- set auth status to `error` or `disconnected` with a clear message
- do not attempt sync
- keep the connect action available for future retries

### Unsupported Platform

If the app is not running on macOS:

- return `available = false`
- do not attempt any permission or sync work
- never show a misleading loading or error state

### Native Read Failure

If reading the system calendar fails:

- set sync status to `error`
- capture a concise error message in `lastSyncError`
- preserve the previous successful imported data until the next successful sync

## UI State Model

The system calendar card should be driven by a view model parallel to the email account card, but singular rather than list-based.

Fields needed in the web layer:

- `available: boolean`
- `authStatus: "connected" | "disconnected" | "error"`
- `syncStatus: "idle" | "syncing" | "error"`
- `lastSyncedAt: string | null`
- `lastSyncError: string | null`

This shape intentionally matches the existing integration mental model and reduces UI branching.

## Testing Strategy

### Desktop

Add unit tests for:

- capability reporting on unsupported platforms
- sync state schema creation
- imported event upsert matching by `source_event_id`
- system calendar status transitions during success and failure

For macOS-native event fetching, isolate the mapping layer so test coverage can focus on:

- start/end conversion
- duration calculation
- title/location/notes extraction
- all-day event normalization

### Web

Add tests for:

- integrations view state when system calendar is unavailable
- integrations card actions and labels across status states
- disabled actions on unsupported platforms

## Rollout Notes

This design deliberately establishes a provider boundary without overbuilding a generic calendar framework.

The provider abstraction should be light:

- one desktop command group for system calendar capability, auth, and sync
- one web integration card component section

This is enough to support future providers later, while keeping this iteration focused on the macOS-native path.

## Follow-Up Opportunities

After this macOS-only read-only integration lands, likely next steps are:

- background refresh or watch-based automatic sync
- clearer read-only affordances for imported calendar events
- Windows or Outlook-backed provider support
- Google Calendar provider support
- optional calendar selection filters
