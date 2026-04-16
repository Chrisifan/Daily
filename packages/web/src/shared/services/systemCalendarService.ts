import { invoke } from "@tauri-apps/api/core";

export interface SystemCalendarStatus {
  available: boolean;
  authStatus: "connected" | "disconnected" | "error";
  syncStatus: "syncing" | "idle" | "error";
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

interface RustSystemCalendarStatus {
  available: boolean;
  authStatus: SystemCalendarStatus["authStatus"];
  syncStatus: SystemCalendarStatus["syncStatus"];
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

function fromRustStatus(status: RustSystemCalendarStatus): SystemCalendarStatus {
  return {
    available: status.available,
    authStatus: status.authStatus,
    syncStatus: status.syncStatus,
    lastSyncedAt: status.lastSyncedAt ?? null,
    lastSyncError: status.lastSyncError ?? null,
  };
}

export async function getSystemCalendarStatus(): Promise<SystemCalendarStatus> {
  const result = await invoke<RustSystemCalendarStatus>("get_system_calendar_status");
  return fromRustStatus(result);
}

export async function requestSystemCalendarAccess(): Promise<SystemCalendarStatus> {
  const result = await invoke<RustSystemCalendarStatus>("request_system_calendar_access");
  return fromRustStatus(result);
}

export async function syncSystemCalendar(): Promise<SystemCalendarStatus> {
  const result = await invoke<RustSystemCalendarStatus>("sync_system_calendar");
  return fromRustStatus(result);
}
