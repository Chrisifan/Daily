import { invoke } from "@tauri-apps/api/core";
import { differenceInMinutes, parseISO } from "date-fns";
import type {
  ExternalScheduleCandidate,
  ExternalScheduleCandidateStatus,
  ExternalScheduleSource,
} from "../../domain/intake/types";
import { getStoredSettings } from "./settingsService";

interface DesktopExternalScheduleCandidate {
  id: string;
  source: ExternalScheduleSource;
  source_account_id?: string | null;
  source_event_id?: string | null;
  source_message_id?: string | null;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string | null;
  notes?: string | null;
  attendees_json: string;
  confidence: number;
  raw_payload_json: string;
  status: ExternalScheduleCandidateStatus;
  created_at: string;
  updated_at: string;
}

function desktopCandidateToWeb(candidate: DesktopExternalScheduleCandidate): ExternalScheduleCandidate {
  return {
    id: candidate.id,
    source: candidate.source,
    sourceAccountId: candidate.source_account_id ?? undefined,
    sourceEventId: candidate.source_event_id ?? undefined,
    sourceMessageId: candidate.source_message_id ?? undefined,
    title: candidate.title,
    startAt: candidate.start_at,
    endAt: candidate.end_at,
    timezone: candidate.timezone,
    location: candidate.location ?? undefined,
    notes: candidate.notes ?? undefined,
    attendees: JSON.parse(candidate.attendees_json) as ExternalScheduleCandidate["attendees"],
    confidence: candidate.confidence,
    rawPayload: JSON.parse(candidate.raw_payload_json) as Record<string, unknown>,
    status: candidate.status,
  };
}

function getScheduleSource(source: ExternalScheduleSource): "mail_extracted" | "system_calendar" {
  return source === "email" ? "mail_extracted" : "system_calendar";
}

function getNotificationTitle(source: ExternalScheduleSource, automatic: boolean): string {
  if (automatic) {
    return source === "email" ? "已从邮箱同步新日程到 Daily" : "已从日历同步新日程到 Daily";
  }

  return source === "email" ? "检测到来自邮箱的新日程" : "检测到来自日历的新日程";
}

function getNotificationBody(candidate: ExternalScheduleCandidate, automatic: boolean): string {
  if (automatic) {
    return `${candidate.title} 已加入 Daily 日程。`;
  }

  return `${candidate.title} 已加入待确认列表，打开 Daily 即可同步或忽略。`;
}

function getDurationMinutes(candidate: ExternalScheduleCandidate): number {
  const delta = differenceInMinutes(parseISO(candidate.endAt), parseISO(candidate.startAt));
  return Math.max(delta, 30);
}

async function notifyCandidate(candidate: ExternalScheduleCandidate, automatic: boolean): Promise<void> {
  await invoke("show_system_notification", {
    title: getNotificationTitle(candidate.source, automatic),
    body: getNotificationBody(candidate, automatic),
  });
}

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

export async function getExternalScheduleCandidate(id: string): Promise<ExternalScheduleCandidate | null> {
  const result = await invoke<DesktopExternalScheduleCandidate | null>("get_external_schedule_candidate", { id });
  return result ? desktopCandidateToWeb(result) : null;
}

export async function listPendingExternalScheduleCandidates(): Promise<ExternalScheduleCandidate[]> {
  const result = await invoke<DesktopExternalScheduleCandidate[]>("list_pending_external_schedule_candidates");
  return result.map(desktopCandidateToWeb);
}

export async function updateExternalScheduleCandidateStatus(
  id: string,
  status: ExternalScheduleCandidateStatus
): Promise<void> {
  await invoke("update_external_schedule_candidate_status", { id, status });
}

export async function createScheduleFromCandidate(candidate: ExternalScheduleCandidate): Promise<void> {
  await invoke("create_imported_schedule", {
    input: {
      source: getScheduleSource(candidate.source),
      source_event_id: candidate.sourceEventId ?? candidate.id,
      title: candidate.title,
      icon: "meeting",
      start_at: candidate.startAt,
      timezone: candidate.timezone,
      duration_minutes: getDurationMinutes(candidate),
      repeat_mode: "none",
      repeat_group_id: null,
      location: candidate.location,
      notes: candidate.notes,
      workspace_id: null,
      priority: "medium",
      is_flexible: false,
    },
  });
}

export async function handleIncomingCandidates(candidates: ExternalScheduleCandidate[]): Promise<void> {
  const { externalScheduleCreationMode } = getStoredSettings();
  const pendingCandidateIds: string[] = [];

  for (const candidate of candidates) {
    await upsertExternalCandidate(candidate);
    const persistedCandidate = await getExternalScheduleCandidate(candidate.id);

    if (!persistedCandidate || persistedCandidate.status !== "pending") {
      continue;
    }

    if (externalScheduleCreationMode === "automatic") {
      await createScheduleFromCandidate(persistedCandidate);
      await updateExternalScheduleCandidateStatus(persistedCandidate.id, "auto_created");
      await notifyCandidate(persistedCandidate, true);
      continue;
    }

    pendingCandidateIds.push(persistedCandidate.id);
    await notifyCandidate(persistedCandidate, false);
  }

  if (pendingCandidateIds.length > 0) {
    window.dispatchEvent(
      new CustomEvent("external-schedule-pending", {
        detail: { candidateIds: pendingCandidateIds },
      })
    );
  }
}
