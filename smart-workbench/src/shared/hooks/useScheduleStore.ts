import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScheduleItem } from "../../domain/schedule/types";

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
      const result = await invoke<ScheduleItem[]>("get_schedules");
      setSchedules(result);
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

      const result = await invoke<ScheduleItem>("create_schedule", { input });
      setSchedules((prev) => [...prev, result]);
      return result;
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

      const result = await invoke<ScheduleItem>("update_schedule", { id, input });
      setSchedules((prev) => prev.map((s) => (s.id === id ? result : s)));
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
