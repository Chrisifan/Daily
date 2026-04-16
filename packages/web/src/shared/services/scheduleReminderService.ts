import { invoke } from "@tauri-apps/api/core";
import type { ScheduleItem, ScheduleIcon, RepeatMode } from "../../domain/schedule/types";
import { getStoredSettings } from "./settingsService";
import type { ScheduleReminderCandidate } from "./schedule-reminder-core";

export const SCHEDULE_REMINDER_REFRESH_EVENT = "schedule-reminder-refresh";

interface RustScheduleItem {
  id: string;
  source: string;
  source_event_id?: string;
  title: string;
  icon: string;
  start_at: string;
  timezone: string;
  duration_minutes: number;
  repeat_mode: string;
  repeat_group_id?: string;
  location?: string;
  notes?: string;
  workspace_id?: string | null;
  priority: string;
  preparation_minutes?: number;
  travel_minutes?: number;
  is_flexible: boolean;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

function rustToScheduleItem(rust: RustScheduleItem): ScheduleItem {
  return {
    id: rust.id,
    source: rust.source as ScheduleItem["source"],
    sourceEventId: rust.source_event_id,
    title: rust.title,
    icon: rust.icon as ScheduleIcon,
    startAt: rust.start_at,
    timezone: rust.timezone,
    durationMinutes: rust.duration_minutes,
    repeatMode: rust.repeat_mode as RepeatMode,
    repeatGroupId: rust.repeat_group_id,
    location: rust.location,
    notes: rust.notes,
    workspaceId: rust.workspace_id ?? undefined,
    priority: rust.priority as ScheduleItem["priority"],
    preparationMinutes: rust.preparation_minutes,
    travelMinutes: rust.travel_minutes,
    isFlexible: rust.is_flexible,
    completedAt: rust.completed_at ?? undefined,
    createdAt: rust.created_at,
    updatedAt: rust.updated_at,
  };
}

export function emitScheduleReminderRefresh(): void {
  window.dispatchEvent(new CustomEvent(SCHEDULE_REMINDER_REFRESH_EVENT));
}

export async function listSchedulesForReminder(): Promise<ScheduleItem[]> {
  const result = await invoke<RustScheduleItem[]>("get_schedules");
  return result.map(rustToScheduleItem);
}

export async function wasScheduleReminderDelivered(
  scheduleId: string,
  remindAt: string,
): Promise<boolean> {
  return invoke<boolean>("was_schedule_reminder_delivered_command", {
    scheduleId,
    remindAt,
  });
}

export async function markScheduleReminderDelivered(
  scheduleId: string,
  remindAt: string,
  deliveredAt: string,
): Promise<void> {
  await invoke("mark_schedule_reminder_delivered_command", {
    scheduleId,
    remindAt,
    deliveredAt,
  });
}

function buildScheduleReminderNotification(candidate: ScheduleReminderCandidate): {
  title: string;
  body: string;
} {
  const language = getStoredSettings().language;
  const title = language === "en"
    ? `Starting soon: ${candidate.title}`
    : `即将开始：${candidate.title}`;
  const lead = language === "en"
    ? `Starts in ${candidate.leadMinutes} minutes`
    : `${candidate.leadMinutes} 分钟后开始`;
  const body = candidate.location
    ? `${lead} · ${candidate.location}`
    : lead;

  return { title, body };
}

export async function deliverScheduleReminder(
  candidate: ScheduleReminderCandidate,
): Promise<void> {
  const delivered = await wasScheduleReminderDelivered(candidate.scheduleId, candidate.remindAt);
  if (delivered) {
    return;
  }

  const notification = buildScheduleReminderNotification(candidate);
  await invoke("show_system_notification", notification);
  await markScheduleReminderDelivered(
    candidate.scheduleId,
    candidate.remindAt,
    new Date().toISOString(),
  );
}
