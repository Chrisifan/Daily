import type {
  MailAccountAuthStatus,
  MailAccountSyncStatus,
} from "./mail-account-store.js";

export interface MailWatchAccountStateEvent {
  type: "account-state";
  emittedAt: string;
  accountId: string;
  authStatus: MailAccountAuthStatus;
  syncStatus: MailAccountSyncStatus;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

export interface MailWatchCandidatesDetectedEvent {
  type: "candidates-detected";
  emittedAt: string;
  accountId: string;
  candidateIds: string[];
}

export interface MailWatchAccountSyncedEvent {
  type: "account-synced";
  emittedAt: string;
  accountId: string;
  lastSyncedAt: string;
}

export type MailWatchEvent =
  | MailWatchAccountStateEvent
  | MailWatchCandidatesDetectedEvent
  | MailWatchAccountSyncedEvent;

type Subscriber = (payload: string) => void;

function formatEvent(event: MailWatchEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createMailWatchEvents() {
  const subscribers = new Set<Subscriber>();

  return {
    publish(event: MailWatchEvent): void {
      const payload = formatEvent(event);
      for (const subscriber of subscribers) {
        subscriber(payload);
      }
    },
    subscribe(subscriber: Subscriber): () => void {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}

export type MailWatchEvents = ReturnType<typeof createMailWatchEvents>;
