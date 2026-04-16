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
  notified_at?: string | null;
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
    notifiedAt: candidate.notified_at ?? undefined,
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

export async function updateExternalScheduleCandidateNotifiedAt(
  id: string,
  notifiedAt: string | null
): Promise<void> {
  await invoke("update_external_schedule_candidate_notified_at", { id, notifiedAt });
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
  for (const candidate of candidates) {
    await upsertExternalCandidate(candidate);
  }

  await processPersistedExternalScheduleCandidates({ candidateIds: candidates.map((candidate) => candidate.id) });
}

export async function processPersistedExternalScheduleCandidates(options?: {
  candidateIds?: string[];
}): Promise<void> {
  const { externalScheduleCreationMode } = getStoredSettings();
  const pendingCandidateIds: string[] = [];
  const candidates = options?.candidateIds?.length
    ? (
        await Promise.all(
          options.candidateIds.map(async (candidateId) => getExternalScheduleCandidate(candidateId))
        )
      ).filter((candidate): candidate is ExternalScheduleCandidate => candidate !== null)
    : await listPendingExternalScheduleCandidates();

  for (const candidate of candidates) {
    if (candidate.status !== "pending") {
      continue;
    }

    if (externalScheduleCreationMode === "automatic") {
      await createScheduleFromCandidate(candidate);
      await updateExternalScheduleCandidateStatus(candidate.id, "auto_created");

      if (!candidate.notifiedAt) {
        await notifyCandidate(candidate, true);
        await updateExternalScheduleCandidateNotifiedAt(candidate.id, new Date().toISOString());
      }
      continue;
    }

    pendingCandidateIds.push(candidate.id);

    if (!candidate.notifiedAt) {
      await notifyCandidate(candidate, false);
      await updateExternalScheduleCandidateNotifiedAt(candidate.id, new Date().toISOString());
    }
  }

  if (pendingCandidateIds.length > 0) {
    window.dispatchEvent(
      new CustomEvent("external-schedule-pending", {
        detail: { candidateIds: pendingCandidateIds },
      })
    );
  }
}
