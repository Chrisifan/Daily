export type ScheduleSource = 
  | "google_calendar" 
  | "outlook_calendar" 
  | "system_calendar" 
  | "manual" 
  | "mail_extracted";

export type Priority = "low" | "medium" | "high";

export interface ScheduleItem {
  id: string;
  source: ScheduleSource;
  sourceEventId?: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location?: string;
  attendees?: string[];
  notes?: string;
  workspaceId?: string;
  priority: Priority;
  preparationMinutes?: number;
  travelMinutes?: number;
  isFlexible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConflict {
  id: string;
  type: "overlap" | "preparation" | "travel";
  scheduleItemId: string;
  conflictingItemId?: string;
  description: string;
  severity: "warning" | "critical";
}

export type ViewMode = "day" | "week" | "month";
