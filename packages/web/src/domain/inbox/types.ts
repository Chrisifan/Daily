import type { WorkspaceType } from "../workspace/types";

export type InboxSource = "gmail" | "outlook" | "imap";

export type ActionType = "schedule" | "task" | "review" | "note";

export interface InboxItem {
  id: string;
  source: InboxSource;
  threadId?: string;
  from: string;
  fromEmail: string;
  subject: string;
  summary: string;
  receivedAt: string;
  workspaceId?: string;
  workspaceTypeHint?: WorkspaceType;
  actionType?: ActionType;
  relatedScheduleId?: string;
  attachments?: Attachment[];
  parsedEntities?: string[];
  confidence?: number;
  isRead: boolean;
  isImportant: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MailAccount {
  id: string;
  provider: InboxSource;
  emailAddress: string;
  authStatus: "connected" | "disconnected" | "error";
  syncStatus: "syncing" | "idle" | "error";
  lastSyncedAt?: string;
  scopes: string[];
}
