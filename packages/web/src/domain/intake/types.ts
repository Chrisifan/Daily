export type ExternalScheduleSource = "email" | "calendar";

export type ExternalScheduleCandidateStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "auto_created";

export interface ExternalScheduleCandidateAttendee {
  name?: string;
  address: string;
}

export interface ExternalScheduleCandidate {
  id: string;
  source: ExternalScheduleSource;
  sourceAccountId?: string;
  sourceEventId?: string;
  sourceMessageId?: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location?: string;
  notes?: string;
  attendees: ExternalScheduleCandidateAttendee[];
  confidence: number;
  rawPayload: Record<string, unknown>;
  status: ExternalScheduleCandidateStatus;
  notifiedAt?: string;
}
