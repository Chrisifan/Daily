# Schedule Advance Reminder Design

**Date:** 2026-04-16

## Goal

Add a user preference for schedule advance reminders and connect it to desktop system notifications so Daily can remind the user before a schedule starts.

After this change:

- the "Messages & Notifications" settings section includes a `日程提前提醒` preference
- users can choose `不提醒`、`5 分钟前`、`10 分钟前`、`30 分钟前`
- Daily emits a desktop system notification at the configured lead time before a schedule starts
- reminders are de-duplicated and updated when schedules or reminder preferences change

## Current Problem

Daily can already send immediate system notifications for imported external schedule candidates, but it does not support timed reminders for normal schedules.

Today:

- settings only contain the external schedule creation preference
- `packages/web/src/shared/hooks/useScheduleStore.ts` loads schedules from Tauri but does not coordinate reminders
- `packages/desktop/src/lib.rs` can show a system notification immediately through `show_system_notification`, but it does not track whether a schedule reminder has already fired

This creates two gaps:

1. users cannot control whether schedule reminders should happen before an event starts
2. even if the UI exposed such a preference, there is no scheduling or deduplication layer to honor it

## Chosen Direction

Use a renderer-owned reminder coordinator with desktop-backed de-duplication.

The renderer will:

- store the advance reminder preference in `DailySettings`
- observe the current schedule list and the reminder preference
- compute the next due reminder moments
- maintain a single active timer for the nearest upcoming reminder
- invoke the existing desktop notification command when a reminder becomes due

The desktop layer will:

- persist reminder delivery records keyed by schedule and reminder time
- expose commands to query and mark reminder delivery
- remain the source of truth for "was this reminder already shown?"

This keeps scheduling logic close to the existing schedule state in the web layer while using the desktop database to survive reloads and prevent duplicate notifications.

## Why This Split

`packages/web` already owns:

- reading current settings
- loading and refreshing schedules
- app-level hooks mounted in the root layout

`packages/desktop` already owns:

- the shared SQLite database
- system notification delivery
- Tauri commands for persistence

Putting the timer loop in the renderer avoids introducing a new Rust background worker or service process for a feature that only needs to run while the desktop app is open. Persisting reminder delivery in the desktop DB keeps reminder state durable across reloads.

## User Experience

### Settings

In the `消息和提醒` section, add a second preference item:

- title: `日程提前提醒`
- options:
  - `none`: `不提醒`
  - `5`: `5 分钟前`
  - `10`: `10 分钟前`
  - `30`: `30 分钟前`

This selector should use the same segmented-control presentation already used for the existing `自动创建日程` preference.

The existing title-plus-tooltip pattern should be reused:

- label text remains concise
- explanatory copy moves into the tooltip icon next to the title

### Notification Content

Reminder notifications should use the existing system notification channel and use schedule-focused copy.

Suggested structure:

- title: `即将开始：{schedule.title}`
- body:
  - if lead time is not `none`: `将在 {N} 分钟后开始`
  - if location exists: append ` · {location}`

No action buttons are needed in this iteration.

## Data Model Changes

### Settings

Extend `DailySettings` with:

- `scheduleReminderLeadMinutes: "none" | "5" | "10" | "30"`

Default:

- `"none"`

This keeps the stored shape string-based and easy to serialize into the existing JSON settings record.

### New Table: `schedule_reminder_deliveries`

Add a desktop-side table in the shared SQLite database:

- `id TEXT PRIMARY KEY`
- `schedule_id TEXT NOT NULL`
- `remind_at TEXT NOT NULL`
- `delivered_at TEXT NOT NULL`
- unique index on `(schedule_id, remind_at)`

Purpose:

- persist reminder deliveries across renderer reloads
- guarantee one notification per schedule per reminder moment
- let the renderer re-check whether a reminder has already fired before sending a notification

The table is append-only for now. Cleanup can be deferred because reminder volume is low.

## Runtime Components

### 1. Reminder Settings Integration

Update settings storage and UI:

- add the new settings field to `DailySettings`
- expose localized labels in `zh.json` and `en.json`
- render the new selector in `SettingsPopup`
- ensure onboarding and any settings defaults continue to merge correctly

### 2. Schedule Reminder Store Commands

Add desktop commands to:

- list or query reminder deliveries for a schedule reminder moment
- mark a reminder as delivered

The web layer only needs a minimal API:

- `was_schedule_reminder_delivered(scheduleId, remindAt)`
- `mark_schedule_reminder_delivered(scheduleId, remindAt, deliveredAt)`

The desktop layer should use `INSERT OR IGNORE` semantics so concurrent checks do not produce duplicates.

### 3. Renderer Reminder Coordinator

Add one root-level hook in `packages/web` that:

- reads schedules from the existing schedule store
- reads the current reminder lead-time preference
- ignores schedules whose reminder preference is `none`
- computes `remindAt = schedule.startAt - leadMinutes`
- filters out reminders that are already delivered or are no longer relevant
- schedules exactly one timer for the nearest upcoming reminder
- re-runs when schedules change, settings change, app regains focus, or visibility returns

This hook should live near the existing app-level watcher hooks and should mount once in the root layout.

### 4. Reminder Notification Service

Add a small web-side service helper for:

- formatting reminder title/body text
- checking desktop reminder delivery state
- sending the system notification through `show_system_notification`
- marking the reminder as delivered after a successful notification

This keeps the coordinator focused on scheduling rather than notification formatting.

## Reminder Rules

### Eligible Schedules

A schedule is eligible for reminder scheduling only when:

- it has a valid `startAt`
- the user preference is not `none`
- the computed reminder moment is still within a useful window
- the reminder has not already been recorded as delivered

### Past-Due Handling

When the app starts or regains focus:

- if `remindAt` is already in the past but `startAt` is still in the future, deliver the reminder immediately
- if the schedule has already started, do not deliver the reminder

This prevents missed reminders after short sleep/wake or reload gaps.

### Schedule Updates

When a schedule is edited:

- the coordinator recomputes the new reminder moment from the latest `startAt`
- previously delivered reminders for old reminder times remain in the table
- only the current computed reminder moment matters for future checks

If a schedule moves from 10:00 to 11:00, a delivered record for 09:50 should not block the new 10:50 reminder because the unique key includes `remind_at`.

### Schedule Deletion

If a schedule is deleted:

- the coordinator naturally stops considering it on the next schedule refresh
- delivery records can remain in the DB

### Preference Changes

If the user changes reminder preference:

- the coordinator cancels the existing timer
- recomputes reminder moments for all loaded schedules
- schedules the next nearest eligible reminder under the new lead time

This means changing from `10 分钟前` to `30 分钟前` immediately affects future notifications.

## Failure Handling

If desktop notification delivery fails:

- log the error
- do not mark the reminder as delivered
- allow the next coordinator pass to try again while the schedule is still eligible

If the reminder delivery lookup fails:

- log the error
- skip the send for that cycle rather than risking duplicate notifications

This biases toward avoiding duplicate reminder spam.

## Testing Strategy

### Web

Add focused tests for:

- settings defaults and storage merge for `scheduleReminderLeadMinutes`
- reminder candidate computation from schedules and settings
- due-reminder selection logic
- notification service behavior for delivered vs. undelivered reminders

### Desktop

Add Rust tests for:

- schema migration creating `schedule_reminder_deliveries`
- insert-or-ignore delivery marking
- delivered-state lookup for `(schedule_id, remind_at)`

### Verification

Manual verification should cover:

1. set reminder preference to `5 分钟前`
2. create a schedule starting about 5 minutes from now
3. keep the app open and confirm one system notification appears at the reminder moment
4. reload the app and confirm the same reminder is not sent again
5. edit the schedule to a later time and confirm a new reminder appears for the new reminder moment
