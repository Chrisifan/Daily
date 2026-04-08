import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScheduleItem } from "../../domain/schedule/types";

interface RustScheduleItem {
  id: string;
  source: string;
  source_event_id?: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string;
  notes?: string;
  workspace_id?: string;
  priority: string;
  preparation_minutes?: number;
  travel_minutes?: number;
  is_flexible: boolean;
  created_at: string;
  updated_at: string;
}

function rustToScheduleItem(rust: RustScheduleItem): ScheduleItem {
  return {
    id: rust.id,
    source: rust.source as ScheduleItem["source"],
    sourceEventId: rust.source_event_id,
    title: rust.title,
    startAt: rust.start_at,
    endAt: rust.end_at,
    timezone: rust.timezone,
    location: rust.location,
    notes: rust.notes,
    workspaceId: rust.workspace_id,
    priority: rust.priority as ScheduleItem["priority"],
    preparationMinutes: rust.preparation_minutes,
    travelMinutes: rust.travel_minutes,
    isFlexible: rust.is_flexible,
    createdAt: rust.created_at,
    updatedAt: rust.updated_at,
  };
}

interface CreateScheduleInput {
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string;
  notes?: string;
  priority: string;
  is_flexible: boolean;
}

interface UpdateScheduleInput {
  title?: string;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  location?: string;
  notes?: string;
  priority?: string;
  is_flexible?: boolean;
}

export interface UseScheduleStore {
  schedules: ScheduleItem[];
  loading: boolean;
  error: string | null;
  addSchedule: (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">) => Promise<ScheduleItem>;
  updateSchedule: (id: string, data: Partial<Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
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
    async (data: Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">): Promise<ScheduleItem> => {
      const input: CreateScheduleInput = {
        title: data.title,
        start_at: data.startAt,
        end_at: data.endAt,
        timezone: data.timezone,
        location: data.location,
        notes: data.notes,
        priority: data.priority,
        is_flexible: data.isFlexible,
      };

      const result = await invoke<RustScheduleItem>("create_schedule", { input });
      const schedule = rustToScheduleItem(result);
      setSchedules((prev) => [...prev, schedule]);
      return schedule;
    },
    []
  );

  const updateSchedule = useCallback(
    async (id: string, data: Partial<Omit<ScheduleItem, "id" | "source" | "createdAt" | "updatedAt">>): Promise<void> => {
      const input: UpdateScheduleInput = {};
      if (data.title !== undefined) input.title = data.title;
      if (data.startAt !== undefined) input.start_at = data.startAt;
      if (data.endAt !== undefined) input.end_at = data.endAt;
      if (data.timezone !== undefined) input.timezone = data.timezone;
      if (data.location !== undefined) input.location = data.location;
      if (data.notes !== undefined) input.notes = data.notes;
      if (data.priority !== undefined) input.priority = data.priority;
      if (data.isFlexible !== undefined) input.is_flexible = data.isFlexible;

      const result = await invoke<RustScheduleItem>("update_schedule", { id, input });
      const schedule = rustToScheduleItem(result);
      setSchedules((prev) => prev.map((s) => (s.id === id ? schedule : s)));
    },
    []
  );

  const deleteSchedule = useCallback(async (id: string): Promise<void> => {
    await invoke("delete_schedule", { id });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    schedules,
    loading,
    error,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    refreshSchedules,
  };
}
