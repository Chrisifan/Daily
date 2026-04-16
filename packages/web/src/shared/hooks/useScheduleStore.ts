import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScheduleItem, RepeatMode, ScheduleIcon } from "../../domain/schedule/types";
import { emitScheduleReminderRefresh } from "../services/scheduleReminderService";

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

interface CreateScheduleInput {
  title: string;
  icon: ScheduleIcon;
  start_at: string;
  timezone: string;
  duration_minutes: number;
  repeat_mode: RepeatMode;
  repeat_group_id?: string;
  location?: string;
  notes?: string;
  workspace_id?: string;
  priority: string;
  is_flexible: boolean;
}

interface UpdateScheduleInput {
  title?: string;
  icon?: ScheduleIcon;
  start_at?: string;
  timezone?: string;
  duration_minutes?: number;
  repeat_mode?: RepeatMode;
  repeat_group_id?: string;
  location?: string;
  notes?: string;
  workspace_id?: string | null;
  priority?: string;
  is_flexible?: boolean;
  completed_at?: string | null;
}

type CreateScheduleData = Omit<
  ScheduleItem,
  "id" | "source" | "createdAt" | "updatedAt" | "completedAt"
>;

type UpdateScheduleData = Partial<
  Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">
>;

export interface UseScheduleStore {
  schedules: ScheduleItem[];
  loading: boolean;
  error: string | null;
  addSchedule: (data: CreateScheduleData) => Promise<ScheduleItem>;
  updateSchedule: (id: string, data: UpdateScheduleData) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  deleteAllSchedules: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
}

export function useScheduleStore(initialSchedules: ScheduleItem[] = []): UseScheduleStore {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RustScheduleItem[]>("get_schedules");
      setSchedules(result.map(rustToScheduleItem));
      emitScheduleReminderRefresh();
    } catch (e) {
      console.error("Failed to fetch schedules:", e);
      setError(e as string);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSchedules();
  }, [refreshSchedules]);

  const addSchedule = useCallback(
    async (data: CreateScheduleData): Promise<ScheduleItem> => {
      const input: CreateScheduleInput = {
        title: data.title,
        icon: data.icon,
        start_at: data.startAt,
        timezone: data.timezone,
        duration_minutes: data.durationMinutes,
        repeat_mode: data.repeatMode,
        repeat_group_id: data.repeatGroupId,
        location: data.location,
        notes: data.notes,
        workspace_id: data.workspaceId,
        priority: data.priority,
        is_flexible: data.isFlexible,
      };

      const result = await invoke<RustScheduleItem>("create_schedule", { input });
      const schedule = rustToScheduleItem(result);
      setSchedules((prev) => [...prev, schedule]);
      emitScheduleReminderRefresh();
      return schedule;
    },
    []
  );

  const updateSchedule = useCallback(
    async (id: string, data: UpdateScheduleData): Promise<void> => {
      const input: UpdateScheduleInput = {};
      if (data.title !== undefined) input.title = data.title;
      if (data.icon !== undefined) input.icon = data.icon;
      if (data.startAt !== undefined) input.start_at = data.startAt;
      if (data.timezone !== undefined) input.timezone = data.timezone;
      if (data.durationMinutes !== undefined) input.duration_minutes = data.durationMinutes;
      if (data.repeatMode !== undefined) input.repeat_mode = data.repeatMode;
      if (data.repeatGroupId !== undefined) input.repeat_group_id = data.repeatGroupId;
      if (data.location !== undefined) input.location = data.location;
      if (data.notes !== undefined) input.notes = data.notes;
      if (Object.prototype.hasOwnProperty.call(data, "workspaceId")) {
        input.workspace_id = data.workspaceId ?? null;
      }
      if (data.priority !== undefined) input.priority = data.priority;
      if (data.isFlexible !== undefined) input.is_flexible = data.isFlexible;
      if (Object.prototype.hasOwnProperty.call(data, "completedAt")) {
        input.completed_at = data.completedAt ?? null;
      }

      const result = await invoke<RustScheduleItem>("update_schedule", { id, input });
      const schedule = rustToScheduleItem(result);
      setSchedules((prev) => prev.map((s) => (s.id === id ? schedule : s)));
      emitScheduleReminderRefresh();
    },
    []
  );

  const deleteSchedule = useCallback(async (id: string): Promise<void> => {
    await invoke("delete_schedule", { id });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    emitScheduleReminderRefresh();
  }, []);

  const deleteAllSchedules = useCallback(async (): Promise<void> => {
    await invoke("delete_all_schedules");
    setSchedules([]);
    emitScheduleReminderRefresh();
  }, []);

  return {
    schedules,
    loading,
    error,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    deleteAllSchedules,
    refreshSchedules,
  };
}
