export type ScheduleSource = 
  | "google_calendar" 
  | "outlook_calendar" 
  | "system_calendar" 
  | "manual" 
  | "mail_extracted";

export type Priority = "low" | "medium" | "high";

export type RepeatMode = 
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semi_annually"
  | "annually";

export type ScheduleIcon = 
  | "clock"
  | "meeting"
  | "call"
  | "focus"
  | "break"
  | "travel"
  | "meal"
  | "exercise"
  | "sleep"
  | "study"
  | "work"
  | "shopping"
  | "home"
  | "music"
  | "health";

export interface ScheduleItem {
  id: string;
  source: ScheduleSource;
  sourceEventId?: string;
  title: string;
  icon: ScheduleIcon;
  startAt: string;
  timezone: string;
  durationMinutes: number;
  repeatMode: RepeatMode;
  repeatGroupId?: string;
  location?: string;
  attendees?: string[];
  notes?: string;
  workspaceId?: string;
  priority: Priority;
  preparationMinutes?: number;
  travelMinutes?: number;
  isFlexible: boolean;
  completedAt?: string;
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

export const REPEAT_MODE_LABELS: Record<RepeatMode, string> = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  biweekly: "每两周",
  monthly: "每月",
  quarterly: "每季度",
  semi_annually: "每半年",
  annually: "每年",
};

export const SCHEDULE_ICON_LABELS: Record<ScheduleIcon, string> = {
  clock: "时钟",
  meeting: "会议",
  call: "通话",
  focus: "专注",
  break: "休息",
  travel: "出行",
  meal: "用餐",
  exercise: "运动",
  sleep: "睡眠",
  study: "学习",
  work: "工作",
  shopping: "购物",
  home: "居家",
  music: "音乐",
  health: "健康",
};
