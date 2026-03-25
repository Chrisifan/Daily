import type { WeatherSnapshot } from "../weather/types";
import type { ScheduleItem } from "../schedule/types";
import type { InboxItem } from "../inbox/types";
import type { TaskItem } from "../task/types";
import type { Workspace } from "../workspace/types";

export interface HomeOverviewSnapshot {
  weather: WeatherSnapshot;
  currentTime: string;
  greeting: string;
  primarySchedule?: ScheduleItem;
  scheduleSummary: ScheduleItem[];
  inboxSummary: InboxItem[];
  activeWorkspaces: Workspace[];
  taskSummary: TaskItem[];
  warnings: string[];
}

export interface TimeSlot {
  hour: number;
  display: string;
  items: Array<{
    type: "schedule" | "task" | "reminder";
    title: string;
    priority?: string;
    workspaceId?: string;
  }>;
}

export interface DailyTimeline {
  slots: TimeSlot[];
}
