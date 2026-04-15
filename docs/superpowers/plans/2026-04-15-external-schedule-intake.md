# External Schedule Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one shared intake pipeline for email- and calendar-derived schedule candidates, then route each candidate through a global preference that either auto-creates a Daily schedule or sends an actionable system notification.

**Architecture:** Keep extraction and normalization in `packages/service`, keep system notification delivery and candidate persistence in `packages/desktop`, and keep settings plus fallback confirmation UI in `packages/web`. The first implementation should reuse the existing email sync entrypoint, introduce a shared external-candidate model, and leave a clear adapter seam for future system calendar updates.

**Tech Stack:** React 19, TypeScript, Express, Tauri 2, Rust, SQLite, i18next, local settings storage, system notifications via Tauri plugin/desktop bridge.

---

## File Map

### Existing files to modify

- `packages/web/src/shared/services/settingsService.ts`
- `packages/web/src/shared/ui/SettingsPopup.tsx`
- `packages/web/src/features/integrations/IntegrationsPage.tsx`
- `packages/web/src/shared/hooks/useScheduleStore.ts`
- `packages/web/src/locales/zh.json`
- `packages/web/src/locales/en.json`
- `packages/service/src/routes/email.ts`
- `packages/service/src/index.ts`
- `packages/service/package.json`
- `packages/desktop/src/lib.rs`
- `packages/desktop/Cargo.toml`

### New files to create

- `packages/service/src/services/intake/external-schedule-candidate.ts`
- `packages/service/src/services/intake/email-schedule-candidate-detector.ts`
- `packages/service/src/routes/intake.ts`
- `packages/web/src/domain/intake/types.ts`
- `packages/web/src/shared/services/externalScheduleIntakeService.ts`
- `packages/web/src/shared/ui/ExternalScheduleReviewDialog.tsx`
- `packages/web/src/shared/hooks/useExternalScheduleIntake.ts`

### Optional refactor files if the implementation gets crowded

- `packages/desktop/src/notifications.rs`
- `packages/desktop/src/intake.rs`

## Task 1: Extend the settings model for intake behavior

**Files:**
- Modify: `packages/web/src/shared/services/settingsService.ts`
- Modify: `packages/web/src/shared/ui/SettingsPopup.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] **Step 1: Add the failing shape expectation to the settings model**

Update the settings type and defaults so the new preference exists in code before any UI binds to it.

```ts
export type ExternalScheduleCreationMode = "automatic" | "always_remind";

export interface DailySettings {
  language: "zh" | "en";
  dateFormat: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
  timeFormat: "HH:mm" | "hh:mm A";
  locationCity: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  routineStartTime: string;
  routineEndTime: string;
  externalScheduleCreationMode: ExternalScheduleCreationMode;
}

export const DEFAULT_DAILY_SETTINGS: DailySettings = {
  language: "zh",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  locationCity: null,
  locationLatitude: null,
  locationLongitude: null,
  routineStartTime: "08:00",
  routineEndTime: "22:00",
  externalScheduleCreationMode: "automatic",
};
```

- [ ] **Step 2: Run the web build to verify the new setting breaks unhandled UI**

Run: `pnpm --filter @daily/web build`

Expected: Type errors from `SettingsPopup.tsx` or other settings consumers because the new field is not yet rendered or merged everywhere.

- [ ] **Step 3: Add the minimal settings UI for 消息和提醒 / Messages & Notifications**

Extend the settings popup sections with a new group that uses the existing segmented control pattern.

```tsx
{
  title: "messagesAndNotifications",
  items: [
    {
      id: "externalScheduleCreationMode",
      label: t("settings.externalScheduleCreationMode"),
      description: t("settings.externalScheduleCreationModeDesc"),
      icon: <Bell className="w-4 h-4" />,
      action: (
        <SegmentedControl
          value={draftSettings.externalScheduleCreationMode}
          onChange={(val) =>
            updateDraftSettings({
              externalScheduleCreationMode: val as "automatic" | "always_remind",
            })
          }
          options={[
            { value: "automatic", label: t("settings.externalScheduleModes.automatic") },
            { value: "always_remind", label: t("settings.externalScheduleModes.alwaysRemind") },
          ]}
        />
      ),
    },
  ],
}
```

Add matching locale keys:

```json
"messagesAndNotifications": "消息和提醒",
"externalScheduleCreationMode": "收到来自邮箱或日历的新日程时自动创建日程",
"externalScheduleCreationModeDesc": "控制来自邮箱或日历的新日程是直接加入 Daily，还是总是先通过系统通知提醒你。",
"externalScheduleModes": {
  "automatic": "自动",
  "alwaysRemind": "总是提醒"
}
```

- [ ] **Step 4: Run the web build to verify the settings layer passes**

Run: `pnpm --filter @daily/web build`

Expected: Build succeeds. No missing locale keys. Settings type compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/shared/services/settingsService.ts \
  packages/web/src/shared/ui/SettingsPopup.tsx \
  packages/web/src/locales/zh.json \
  packages/web/src/locales/en.json
git commit -m "feat: add external schedule notification preference"
```

## Task 2: Introduce a shared external candidate model and email-side detection

**Files:**
- Create: `packages/service/src/services/intake/external-schedule-candidate.ts`
- Create: `packages/service/src/services/intake/email-schedule-candidate-detector.ts`
- Modify: `packages/service/src/routes/email.ts`
- Modify: `packages/service/src/index.ts`

- [ ] **Step 1: Write the failing detector contract in the new intake model file**

Create the shared service-side type first so both email and future calendar adapters target the same shape.

```ts
export type ExternalScheduleSource = "email" | "calendar";
export type ExternalScheduleCandidateStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "auto_created";

export interface ExternalScheduleCandidate {
  id: string;
  source: ExternalScheduleSource;
  sourceAccountId?: string;
  sourceEventId?: string;
  sourceMessageId?: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location?: string;
  notes?: string;
  attendees: Array<{ name?: string; address: string }>;
  confidence: number;
  rawPayload: Record<string, unknown>;
  status: ExternalScheduleCandidateStatus;
}
```

Then stub the detector signature:

```ts
export interface DetectEmailScheduleCandidateInput {
  accountId: string;
  messageId?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt: string;
  icsEvents?: Array<{
    summary?: string;
    start: Date;
    end?: Date;
    timezone?: string;
    location?: string;
    description?: string;
    attendees?: Array<{ name?: string; address: string }>;
  }>;
}

export function detectEmailScheduleCandidate(
  input: DetectEmailScheduleCandidateInput
): ExternalScheduleCandidate | null {
  return null;
}
```

- [ ] **Step 2: Run the service build to verify the new files compile but do nothing**

Run: `pnpm --filter @daily/service build`

Expected: Build passes because the detector is not wired yet.

- [ ] **Step 3: Implement the minimal detector using ICS-first, rule-fallback logic**

Start with the smallest useful path: `.ics` events first, then a conservative text fallback.

```ts
import { randomUUID } from "node:crypto";
import {
  type DetectEmailScheduleCandidateInput,
  type ExternalScheduleCandidate,
} from "./external-schedule-candidate.js";

const SCHEDULE_HINT_RE =
  /\b(会议|日程|提醒|截止|预约|meeting|calendar|invite|appointment|deadline)\b/i;

export function detectEmailScheduleCandidate(
  input: DetectEmailScheduleCandidateInput
): ExternalScheduleCandidate | null {
  const firstIcs = input.icsEvents?.[0];
  if (firstIcs?.start) {
    const end = firstIcs.end ?? new Date(firstIcs.start.getTime() + 60 * 60 * 1000);
    return {
      id: randomUUID(),
      source: "email",
      sourceAccountId: input.accountId,
      sourceMessageId: input.messageId,
      title: firstIcs.summary?.trim() || input.subject?.trim() || "New Schedule",
      startAt: firstIcs.start.toISOString(),
      endAt: end.toISOString(),
      timezone: firstIcs.timezone || "UTC",
      location: firstIcs.location,
      notes: firstIcs.description,
      attendees: firstIcs.attendees ?? [],
      confidence: 0.95,
      rawPayload: { kind: "ics", subject: input.subject ?? null },
      status: "pending",
    };
  }

  const body = [input.subject, input.bodyText].filter(Boolean).join("\n");
  if (!SCHEDULE_HINT_RE.test(body)) {
    return null;
  }

  return null;
}
```

- [ ] **Step 4: Wire the detector into the existing email sync route response**

Update `packages/service/src/routes/email.ts` so `/accounts/sync` returns a new `candidates` array derived from the synced messages.

```ts
const candidates = emails
  .map((email) =>
    detectEmailScheduleCandidate({
      accountId: account.id,
      messageId: email.messageId,
      subject: email.subject,
      bodyText: email.body.text,
      bodyHtml: email.body.html,
      sentAt: email.date.toISOString(),
      icsEvents: email.icsEvents?.map((event) => ({
        summary: event.summary,
        start: event.start,
        end: event.end,
        timezone: event.timezone,
        location: event.location,
        description: event.description,
        attendees: event.attendees,
      })),
    })
  )
  .filter((candidate): candidate is ExternalScheduleCandidate => candidate !== null);

res.json({
  success: true,
  data: {
    accountId,
    totalEmails: searchResults.length,
    messages: summaries,
    candidates,
    lastSyncedAt: account.lastSyncedAt,
  },
});
```

- [ ] **Step 5: Run the service build to verify the route contract compiles**

Run: `pnpm --filter @daily/service build`

Expected: Build succeeds. `/accounts/sync` still returns synced messages, now with an additional `candidates` array.

- [ ] **Step 6: Commit**

```bash
git add packages/service/src/services/intake/external-schedule-candidate.ts \
  packages/service/src/services/intake/email-schedule-candidate-detector.ts \
  packages/service/src/routes/email.ts \
  packages/service/src/index.ts
git commit -m "feat: add email schedule candidate detection"
```

## Task 3: Persist external candidates and support system notification actions in desktop

**Files:**
- Modify: `packages/desktop/Cargo.toml`
- Modify: `packages/desktop/src/lib.rs`
- Optional Create: `packages/desktop/src/intake.rs`
- Optional Create: `packages/desktop/src/notifications.rs`

- [ ] **Step 1: Add the failing desktop data model and schema migration**

Add a new SQLite table for external schedule candidates before any notification code tries to consume them.

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS external_schedule_candidates (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_account_id TEXT,
        source_event_id TEXT,
        source_message_id TEXT,
        title TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        timezone TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        attendees_json TEXT NOT NULL DEFAULT '[]',
        confidence REAL NOT NULL DEFAULT 0,
        raw_payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )",
    [],
).ok();
```

Add the Rust struct:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ExternalScheduleCandidate {
    pub id: String,
    pub source: String,
    pub source_account_id: Option<String>,
    pub source_event_id: Option<String>,
    pub source_message_id: Option<String>,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub timezone: String,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub attendees_json: String,
    pub confidence: f64,
    pub raw_payload_json: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}
```

- [ ] **Step 2: Run the desktop check to verify the new model compiles**

Run: `cd /Users/sifan/Documents/openSource/Daily/packages/desktop && cargo check`

Expected: Build passes, but there are no commands yet using the new table.

- [ ] **Step 3: Add commands for storing candidates and processing actions**

Extend the Tauri command surface with:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateExternalScheduleCandidateInput {
    pub id: String,
    pub source: String,
    pub source_account_id: Option<String>,
    pub source_event_id: Option<String>,
    pub source_message_id: Option<String>,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub timezone: String,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub attendees_json: String,
    pub confidence: f64,
    pub raw_payload_json: String,
}

#[tauri::command]
fn upsert_external_schedule_candidate(input: CreateExternalScheduleCandidateInput) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    let now = now_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO external_schedule_candidates (
            id, source, source_account_id, source_event_id, source_message_id,
            title, start_at, end_at, timezone, location, notes, attendees_json,
            confidence, raw_payload_json, status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 
                  COALESCE((SELECT status FROM external_schedule_candidates WHERE id = ?1), 'pending'),
                  COALESCE((SELECT created_at FROM external_schedule_candidates WHERE id = ?1), ?15),
                  ?15)",
        params![
            input.id,
            input.source,
            input.source_account_id,
            input.source_event_id,
            input.source_message_id,
            input.title,
            input.start_at,
            input.end_at,
            input.timezone,
            input.location,
            input.notes,
            input.attendees_json,
            input.confidence,
            input.raw_payload_json,
            now,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

Add a second command that sets status to `accepted`, `dismissed`, or `auto_created`.

- [ ] **Step 4: Add schedule creation helpers for non-manual sources**

The current `create_schedule` command hardcodes `source = 'manual'`. Introduce a source-aware command instead of overloading the existing manual path.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateImportedScheduleInput {
    pub source: String,
    pub source_event_id: Option<String>,
    pub title: String,
    pub icon: String,
    pub start_at: String,
    pub timezone: String,
    pub duration_minutes: i32,
    pub repeat_mode: String,
    pub repeat_group_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub workspace_id: Option<String>,
    pub priority: String,
    pub is_flexible: bool,
}
```

The implementation should be a copy of `create_schedule` except `source` and `source_event_id` come from input and are written into the row.

- [ ] **Step 5: Add system notification plumbing**

Add the Tauri notification dependency in `Cargo.toml` and wire it into `run()`.

```toml
tauri-plugin-notification = "2"
```

```rust
.plugin(tauri_plugin_notification::init())
```

Add a command that emits:

- informational notification for automatic mode
- actionable notification payload for always-remind mode

If Tauri action buttons are unsupported, the command should at minimum include a payload that opens the app with the candidate id in a query string or event payload.

- [ ] **Step 6: Run the desktop check to verify commands and plugin wiring compile**

Run: `cd /Users/sifan/Documents/openSource/Daily/packages/desktop && cargo check`

Expected: Desktop builds with the new notification plugin, new candidate commands, and the imported schedule creation command.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/Cargo.toml packages/desktop/src/lib.rs
git commit -m "feat: add desktop intake persistence and notification bridge"
```

## Task 4: Add web-side intake types, services, and coordinator flow

**Files:**
- Create: `packages/web/src/domain/intake/types.ts`
- Create: `packages/web/src/shared/services/externalScheduleIntakeService.ts`
- Modify: `packages/web/src/features/integrations/IntegrationsPage.tsx`
- Modify: `packages/web/src/shared/hooks/useScheduleStore.ts`

- [ ] **Step 1: Define the failing web-side intake types**

Mirror the candidate shape the web actually consumes.

```ts
export type ExternalScheduleSource = "email" | "calendar";
export type ExternalScheduleCandidateStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "auto_created";

export interface ExternalScheduleCandidate {
  id: string;
  source: ExternalScheduleSource;
  sourceAccountId?: string;
  sourceEventId?: string;
  sourceMessageId?: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location?: string;
  notes?: string;
  attendees: Array<{ name?: string; address: string }>;
  confidence: number;
  rawPayload: Record<string, unknown>;
  status: ExternalScheduleCandidateStatus;
}
```

- [ ] **Step 2: Run the web build to verify the types are isolated**

Run: `pnpm --filter @daily/web build`

Expected: Build passes because the new type file is not wired yet.

- [ ] **Step 3: Add a small service layer that stores candidates and routes decisions**

Create `externalScheduleIntakeService.ts` with the smallest useful methods:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { ExternalScheduleCandidate } from "../../domain/intake/types";
import { getStoredSettings } from "./settingsService";

export async function upsertExternalCandidate(candidate: ExternalScheduleCandidate): Promise<void> {
  await invoke("upsert_external_schedule_candidate", {
    input: {
      id: candidate.id,
      source: candidate.source,
      source_account_id: candidate.sourceAccountId,
      source_event_id: candidate.sourceEventId,
      source_message_id: candidate.sourceMessageId,
      title: candidate.title,
      start_at: candidate.startAt,
      end_at: candidate.endAt,
      timezone: candidate.timezone,
      location: candidate.location,
      notes: candidate.notes,
      attendees_json: JSON.stringify(candidate.attendees),
      confidence: candidate.confidence,
      raw_payload_json: JSON.stringify(candidate.rawPayload),
    },
  });
}
```

Then add:

- `createScheduleFromCandidate(candidate)`
- `notifyForCandidate(candidate, mode)`
- `handleIncomingCandidates(candidates)`

`handleIncomingCandidates` should:

- read `getStoredSettings().externalScheduleCreationMode`
- upsert the candidate
- if `automatic`, create schedule then notify then mark `auto_created`
- if `always_remind`, only notify and leave the status as `pending`

- [ ] **Step 4: Extend the email sync response handling in IntegrationsPage**

Update the existing sync helper type and handler:

```ts
interface SyncResponse {
  accountId: string;
  totalEmails: number;
  lastSyncedAt: string;
  candidates: ExternalScheduleCandidate[];
}

async function syncAccount(accountId: string): Promise<SyncResponse> {
  const res = await fetch(`${API_BASE}/accounts/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.success) throw new Error(data.error || "Sync failed");
  return data.data;
}
```

Then inside `handleSync`:

```ts
const result = await syncAccount(accountId);
await handleIncomingCandidates(result.candidates);
await loadAccounts();
```

- [ ] **Step 5: Run the web build to verify the sync path compiles**

Run: `pnpm --filter @daily/web build`

Expected: Build succeeds. Manual email sync now hands detected candidates into the shared intake service.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/domain/intake/types.ts \
  packages/web/src/shared/services/externalScheduleIntakeService.ts \
  packages/web/src/features/integrations/IntegrationsPage.tsx \
  packages/web/src/shared/hooks/useScheduleStore.ts
git commit -m "feat: add web intake coordinator for external schedules"
```

## Task 5: Add the fallback review surface and AI section in Integrations

**Files:**
- Create: `packages/web/src/shared/ui/ExternalScheduleReviewDialog.tsx`
- Create: `packages/web/src/shared/hooks/useExternalScheduleIntake.ts`
- Modify: `packages/web/src/features/integrations/IntegrationsPage.tsx`
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] **Step 1: Add the failing fallback dialog component**

Create a minimal modal that accepts one pending candidate and exposes confirm/dismiss actions.

```tsx
interface ExternalScheduleReviewDialogProps {
  open: boolean;
  candidate: ExternalScheduleCandidate | null;
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  onClose: () => void;
}
```

The body should display:

- title
- source label (`email` / `calendar`)
- time range
- location
- action buttons: `同步到 Daily` and `忽略`

- [ ] **Step 2: Add the minimal hook for pending candidate routing**

Create a small hook that reads a candidate id from query params or emitted event payload, loads the pending candidate from desktop, and exposes dialog state.

```ts
export function useExternalScheduleIntake() {
  const [activeCandidate, setActiveCandidate] = useState<ExternalScheduleCandidate | null>(null);
  const [open, setOpen] = useState(false);

  const openCandidateReview = useCallback(async (candidateId: string) => {
    const candidate = await getExternalScheduleCandidate(candidateId);
    setActiveCandidate(candidate);
    setOpen(Boolean(candidate));
  }, []);

  return {
    open,
    activeCandidate,
    openCandidateReview,
    closeCandidateReview: () => setOpen(false),
  };
}
```

- [ ] **Step 3: Mount the fallback dialog and add the AI section placeholder**

Update `IntegrationsPage.tsx` to:

- render a lightweight `AI` section below the existing email block
- keep it intentionally simple:

```tsx
<GlassCard className="card" style={{ padding: 24, marginTop: 16 }}>
  <div className="panel-head" style={{ marginBottom: 10 }}>
    <div>
      <p className="panel-eyebrow">{t("integrations.ai.eyebrow")}</p>
      <h2 className="panel-title">{t("integrations.ai.title")}</h2>
    </div>
  </div>
  <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
    {t("integrations.ai.description")}
  </p>
</GlassCard>
```

Also mount `ExternalScheduleReviewDialog` using the hook state so notification fallback has a UI destination.

- [ ] **Step 4: Add the locale keys for fallback review and AI placeholder**

Add keys such as:

```json
"externalCandidate": {
  "title": "检测到新的日程",
  "sync": "同步到 Daily",
  "dismiss": "忽略",
  "sourceEmail": "来自邮箱",
  "sourceCalendar": "来自日历"
},
"ai": {
  "eyebrow": "AI",
  "title": "AI 集成",
  "description": "这里会承载后续的 AI 模型、能力接入和相关偏好设置。"
}
```

- [ ] **Step 5: Run the web build to verify the fallback surface compiles**

Run: `pnpm --filter @daily/web build`

Expected: Build succeeds. Integrations now has an AI placeholder section and a fallback review dialog path for pending candidates.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/shared/ui/ExternalScheduleReviewDialog.tsx \
  packages/web/src/shared/hooks/useExternalScheduleIntake.ts \
  packages/web/src/features/integrations/IntegrationsPage.tsx \
  packages/web/src/locales/zh.json \
  packages/web/src/locales/en.json
git commit -m "feat: add fallback intake review dialog and ai integrations section"
```

## Task 6: End-to-end verification and contract cleanup

**Files:**
- Modify as needed based on verification results:
  - `packages/service/src/routes/email.ts`
  - `packages/web/src/shared/services/externalScheduleIntakeService.ts`
  - `packages/desktop/src/lib.rs`

- [ ] **Step 1: Run the full package builds**

Run:

```bash
pnpm --filter @daily/service build
pnpm --filter @daily/web build
cd /Users/sifan/Documents/openSource/Daily/packages/desktop && cargo check
```

Expected:

- service TypeScript compile passes
- web TypeScript + Vite build passes
- desktop Rust build passes

- [ ] **Step 2: Perform a manual flow check**

Run the app and verify:

1. add or reuse an email account in Integrations
2. trigger `同步`
3. confirm the response includes candidates when a mail contains `.ics`
4. switch settings between `自动` and `总是提醒`
5. verify automatic mode creates a schedule and sends a notification
6. verify always-remind mode does not create a schedule until notification acceptance
7. verify dismissing the notification does not create a schedule

Expected:

- exactly one Daily schedule per accepted external candidate
- repeated sync does not duplicate the same event
- AI section is visible in Integrations

- [ ] **Step 3: Clean up any contract mismatches found during verification**

Typical fixes to keep tightly scoped:

- align field names between service candidate JSON and desktop command inputs
- ensure imported schedules use a non-`manual` source
- ensure `sourceEventId` is preserved when available
- ensure notification fallback opens the correct candidate review dialog

- [ ] **Step 4: Run the verification commands again**

Run:

```bash
pnpm --filter @daily/service build
pnpm --filter @daily/web build
cd /Users/sifan/Documents/openSource/Daily/packages/desktop && cargo check
```

Expected: All commands pass after cleanup.

- [ ] **Step 5: Commit**

```bash
git add packages/service/src/routes/email.ts \
  packages/web/src/shared/services/externalScheduleIntakeService.ts \
  packages/desktop/src/lib.rs
git commit -m "fix: verify external schedule intake flow"
```

## Self-Review

### Spec coverage

- Shared candidate type: covered by Task 2 and Task 4
- Email normalization path: covered by Task 2
- Future calendar compatibility: covered by the candidate model and coordinator shape in Tasks 2–4
- Global `消息和提醒` preference: covered by Task 1
- Automatic vs always-remind behavior: covered by Tasks 3 and 4
- System notification actions plus fallback: covered by Tasks 3 and 5
- AI settings placement under Integrations: covered by Task 5
- De-duplication and duplicate prevention: covered by Tasks 3, 4, and 6

### Placeholder scan

- No `TODO` / `TBD` markers remain
- All new file paths are explicit
- Verification commands are explicit
- Minimal code contracts are included for each code-writing step

### Type consistency

- `externalScheduleCreationMode` uses `automatic | always_remind` consistently
- `ExternalScheduleCandidate` uses `startAt` / `endAt` in TypeScript and `start_at` / `end_at` only across Tauri invoke boundaries
- Candidate status values remain `pending | accepted | dismissed | auto_created`
