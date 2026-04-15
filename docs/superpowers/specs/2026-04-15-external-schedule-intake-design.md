# External Schedule Intake Design

**Goal:** Introduce one shared intake flow for schedule information coming from email and external calendars, then route each new candidate through the same preference-driven decision path: auto-create in Daily or notify the user with system-level actions.

## Context

The current app can already parse email content and sync schedules into Daily, but the logic is still source-specific and does not yet support a unified decision layer for future calendar integrations. The product direction now requires:

- email and system calendar updates to reuse the same new-schedule handling logic
- a user preference that controls whether new schedules are created automatically or always require a reminder
- system-level notifications, not only in-app UI, when new schedules are detected
- a stable place for future AI-related integration settings

## Preferred Direction

Use a shared `ExternalScheduleCandidate` model plus a single coordinator layer that sits between source parsing and Daily schedule creation.

This coordinator should:

- accept normalized candidates from email or calendar sources
- de-duplicate candidates before any user-facing action
- read the user's notification preference
- either auto-create the schedule or send an actionable system notification
- keep a record of whether the candidate was auto-created, accepted from notification, or dismissed

This avoids building separate email-only and calendar-only decision flows.

## Shared Model

Introduce a common candidate type for all external schedule inputs.

Suggested fields:

- `id`
- `source`: `email | calendar`
- `sourceAccountId`
- `sourceEventId`
- `sourceMessageId`
- `title`
- `startAt`
- `endAt`
- `timezone`
- `location`
- `notes`
- `attendees`
- `confidence`
- `rawPayload`
- `status`: `pending | accepted | dismissed | auto_created`

The source adapter is responsible for extracting and normalizing these fields, but only the coordinator decides what happens next.

## Source Adapters

### Email

Email intake should support two paths:

- structured extraction first:
  - `.ics` attachments
  - explicit meeting metadata already available from parsing
- AI or rule-based extraction second:
  - natural-language email content that may describe a future meeting, deadline, or appointment

Only messages that produce a valid `ExternalScheduleCandidate` should enter the shared coordinator.

### Calendar

System calendar and future external calendars should normalize new or updated events directly into the same candidate shape, then hand them to the coordinator.

The calendar source should not own notification logic or schedule-creation logic beyond normalization.

## Decision Rules

### Preference

Add a new settings category: `消息和提醒` / `Messages & Notifications`.

Add one preference:

- `收到来自邮箱或日历的新日程时自动创建日程`
  - `自动` / `Automatic`
  - `总是提醒` / `Always remind`

This preference is global and applies to both email-derived and calendar-derived schedule candidates.

### Automatic Mode

When the preference is `自动`:

- Daily creates the internal schedule immediately
- the app still sends a system notification
- the notification is informational only and does not require confirmation

Recommended notification copy direction:

- title: `已同步新日程到 Daily`
- body: include the schedule title and time range

### Always Remind Mode

When the preference is `总是提醒`:

- Daily does not create the schedule immediately
- the app sends a system notification with actions
- required actions:
  - `同步到 Daily`
  - `忽略`

If the user chooses `同步到 Daily`, Daily creates the internal schedule and marks the candidate as accepted.

If the user chooses `忽略`, Daily marks the candidate as dismissed and does not create the schedule.

## Notification Strategy

The intended primary interaction is action buttons inside the operating-system notification itself.

Because notification action support can vary by runtime and platform behavior, the design should define:

- primary path:
  - system notification actions handle `sync` and `dismiss` directly
- fallback path:
  - if action buttons are unavailable or unsupported, clicking the notification opens Daily and routes to the pending candidate confirmation surface

The product behavior should remain the same even if the fallback path is used on some platforms.

## Coordinator Responsibilities

The shared intake coordinator should own:

- candidate de-duplication
- schedule creation handoff
- notification dispatch selection
- candidate status updates
- source-agnostic event logging

It should not own:

- raw email parsing
- raw calendar fetch/watch logic
- settings UI rendering

## De-duplication Rules

The first version should de-duplicate conservatively to prevent duplicate imports from repeated syncs or repeated notifications.

Recommended matching priority:

1. exact source identity:
   - `source + sourceEventId`
   - `source + sourceMessageId`
2. fallback normalized event identity:
   - `title + startAt + endAt + sourceAccountId`

Once a candidate has been accepted, dismissed, or auto-created, re-processing the same identity should not create another Daily schedule unless the source identity materially changes.

## Settings Placement

### Messages & Notifications

Place the new preference inside the existing global settings flow, not under email integration only.

Reason:

- the behavior is source-agnostic
- calendar sources must reuse the same preference
- users will expect this to behave like a general notification preference, not a mailbox-specific one

### AI Settings

Create an AI-related section under `集成` / `Integrations`, not under the general settings popup.

For now, this section can remain lightweight and future-facing, because AI behavior is still closer to an external capability integration than a core display preference.

Recommended near-term structure:

- `Integrations`
  - Email
  - Calendar
  - AI

The AI section does not need to define all future fields yet, but the information architecture should reserve a clear place for API/model-related controls.

## Implementation Boundaries

Recommended package ownership:

- `packages/service`
  - email parsing
  - AI/rule extraction for schedule candidates
  - future calendar source normalization helpers if sourced through service
- `packages/web`
  - settings model updates
  - user preference UI
  - candidate confirmation fallback UI if needed
- `packages/desktop`
  - system notification delivery
  - notification action bridge to the app
  - routing notification actions back into candidate acceptance or dismissal

## Success Criteria

- Email and calendar updates reuse one schedule-intake decision path
- The new `消息和提醒` preference controls behavior for both sources
- `自动` creates schedules immediately and still notifies the user
- `总是提醒` does not create schedules until the user confirms through the system notification
- Duplicate syncs do not create duplicate Daily schedules
- AI settings have a clear future location under `集成`
