const API_BASE = "http://localhost:3001/api/email";

export interface MailWatchAccountStatus {
  accountId: string;
  email: string;
  authStatus: "connected" | "disconnected" | "error";
  syncStatus: "syncing" | "idle" | "error";
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

export type MailWatchEvent =
  | {
      type: "account-state";
      emittedAt: string;
      accountId: string;
      authStatus: MailWatchAccountStatus["authStatus"];
      syncStatus: MailWatchAccountStatus["syncStatus"];
      lastSyncedAt?: string | null;
      lastSyncError?: string | null;
    }
  | {
      type: "account-synced";
      emittedAt: string;
      accountId: string;
      lastSyncedAt: string;
    }
  | {
      type: "candidates-detected";
      emittedAt: string;
      accountId: string;
      candidateIds: string[];
    };

export async function fetchMailWatchStatus(): Promise<MailWatchAccountStatus[]> {
  const res = await fetch(`${API_BASE}/watch/status`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch watch status");
  }
  return data.data as MailWatchAccountStatus[];
}

export function subscribeMailWatchEvents(onEvent: (event: MailWatchEvent) => void): () => void {
  const eventSource = new EventSource(`${API_BASE}/watch/events`);

  const handleAccountState = (rawEvent: MessageEvent<string>) => {
    onEvent(JSON.parse(rawEvent.data) as MailWatchEvent);
  };
  const handleAccountSynced = (rawEvent: MessageEvent<string>) => {
    onEvent(JSON.parse(rawEvent.data) as MailWatchEvent);
  };
  const handleCandidatesDetected = (rawEvent: MessageEvent<string>) => {
    onEvent(JSON.parse(rawEvent.data) as MailWatchEvent);
  };

  eventSource.addEventListener("account-state", handleAccountState as EventListener);
  eventSource.addEventListener("account-synced", handleAccountSynced as EventListener);
  eventSource.addEventListener("candidates-detected", handleCandidatesDetected as EventListener);

  return () => {
    eventSource.removeEventListener("account-state", handleAccountState as EventListener);
    eventSource.removeEventListener("account-synced", handleAccountSynced as EventListener);
    eventSource.removeEventListener("candidates-detected", handleCandidatesDetected as EventListener);
    eventSource.close();
  };
}
