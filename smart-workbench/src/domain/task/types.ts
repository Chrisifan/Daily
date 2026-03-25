import type { Priority } from "../schedule/types";

export type TaskStatus = "todo" | "doing" | "done";

export type TaskSource = "manual" | "mail" | "schedule" | "system";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueAt?: string;
  workspaceId?: string;
  source?: TaskSource;
  relatedInboxItemId?: string;
  relatedScheduleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  name: string;
  workspaceId?: string;
  tasks: TaskItem[];
}
