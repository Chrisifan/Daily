# Schedule Advance Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `日程提前提醒` preference and use it to drive de-duplicated desktop reminders before schedules start.

**Architecture:** Extend the shared settings shape with a reminder lead-time field, add a desktop-backed reminder-delivery table plus Tauri commands for de-duplication, and mount a renderer reminder coordinator that computes upcoming reminder moments and triggers `show_system_notification` at the correct time. Keep scheduling decisions in the web app and reminder-delivery truth in the desktop database.

**Tech Stack:** React 19, TypeScript, node:test, Tauri 2, Rust, rusqlite, desktop notifications

---

### Task 1: Extend settings storage and UI for reminder preference

**Files:**
- Modify: `packages/web/src/shared/services/settingsService.ts`
- Modify: `packages/web/src/shared/ui/SettingsPopup.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`
- Test: `packages/web/src/shared/services/settingsService.test.ts`

- [ ] Add a failing settings test for the new default field and merge behavior.
- [ ] Run: `./node_modules/.bin/tsx --test src/shared/services/settingsService.test.ts`
- [ ] Implement `scheduleReminderLeadMinutes` in `DailySettings` and `DEFAULT_DAILY_SETTINGS`.
- [ ] Render a new segmented selector under `messagesAndNotifications` with `none / 5 / 10 / 30`.
- [ ] Add localized labels and tooltip copy for the new preference.
- [ ] Re-run: `./node_modules/.bin/tsx --test src/shared/services/settingsService.test.ts`

### Task 2: Add desktop reminder-delivery persistence and commands

**Files:**
- Modify: `packages/desktop/src/lib.rs`
- Test: `packages/desktop/src/lib.rs`

- [ ] Add a failing Rust test for reminder-delivery insert and lookup behavior.
- [ ] Run: `cargo test schedule_reminder`
- [ ] Add schema bootstrap for `schedule_reminder_deliveries` with unique `(schedule_id, remind_at)`.
- [ ] Add Tauri commands to check delivery state and mark a reminder as delivered using insert-or-ignore semantics.
- [ ] Register the new commands in the Tauri invoke handler list.
- [ ] Re-run: `cargo test schedule_reminder`

### Task 3: Build reminder notification helpers and scheduling logic

**Files:**
- Create: `packages/web/src/shared/services/scheduleReminderService.ts`
- Create: `packages/web/src/shared/hooks/useScheduleAdvanceReminder.ts`
- Modify: `packages/web/src/app/layout/AppLayout.tsx`
- Test: `packages/web/src/shared/services/scheduleReminderService.test.ts`

- [ ] Add a failing web test for reminder candidate selection and immediate-vs-future scheduling behavior.
- [ ] Run: `./node_modules/.bin/tsx --test src/shared/services/scheduleReminderService.test.ts`
- [ ] Implement helper functions that:
  - parse schedules into reminder candidates
  - compute `remindAt` from `startAt - leadMinutes`
  - skip started schedules
  - flag past-due but still-relevant reminders for immediate delivery
- [ ] Implement desktop bridge helpers that:
  - call `show_system_notification`
  - call `was_schedule_reminder_delivered`
  - call `mark_schedule_reminder_delivered`
- [ ] Add the root reminder hook and mount it once in `AppLayout`.
- [ ] Re-run: `./node_modules/.bin/tsx --test src/shared/services/scheduleReminderService.test.ts`

### Task 4: Integrate with live schedules and refresh triggers

**Files:**
- Modify: `packages/web/src/shared/hooks/useScheduleStore.ts`
- Modify: `packages/web/src/shared/hooks/useScheduleAdvanceReminder.ts`
- Test: `packages/web/src/shared/services/scheduleReminderService.test.ts`

- [ ] Write a failing test covering rescheduling when schedules or reminder settings change.
- [ ] Run: `./node_modules/.bin/tsx --test src/shared/services/scheduleReminderService.test.ts`
- [ ] Ensure the reminder hook reacts to:
  - schedule store updates
  - focus regain
  - visibility regain
  - settings changes after reload
- [ ] Ensure only one nearest timer is active at a time.
- [ ] Ensure delivered reminders are not sent twice after a refresh.
- [ ] Re-run: `./node_modules/.bin/tsx --test src/shared/services/scheduleReminderService.test.ts`

### Task 5: Verify builds and reminder persistence behavior

**Files:**
- Modify: `docs/superpowers/specs/2026-04-16-schedule-advance-reminder-design.md`
- Modify: `docs/superpowers/plans/2026-04-16-schedule-advance-reminder.md`

- [ ] Mark completed tasks in this plan if implementation changed any scope details.
- [ ] Run: `./node_modules/.bin/tsx --test src/shared/services/settingsService.test.ts src/shared/services/scheduleReminderService.test.ts src/shared/ui/SettingsItemHeader.test.tsx src/shared/ui/SettingsFields.test.ts`
- [ ] Run: `cargo test`
- [ ] Run: `pnpm --filter @daily/web build`
- [ ] If desktop-side manual verification fits in this turn, create a schedule a few minutes in the future and confirm one system notification is emitted at the configured lead time; otherwise record the exact manual verification gap.
