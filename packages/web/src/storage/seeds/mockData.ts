import type { Workspace } from "../../domain/workspace/types";
import type { ScheduleItem } from "../../domain/schedule/types";
import type { TaskItem } from "../../domain/task/types";
import type { InboxItem } from "../../domain/inbox/types";
import type { WeatherSnapshot } from "../../domain/weather/types";

export const mockWeather: WeatherSnapshot = {
  condition: "sunny",
  temperature: 22,
  feelsLike: 21,
  humidity: 40,
  windSpeed: 2.8,
  city: "Shanghai",
  description: "晴天",
  sunrise: "06:15",
  sunset: "18:30",
  hourlyForecast: [
    { time: "09:00", temperature: 22, condition: "sunny", description: "晴天" },
    { time: "10:00", temperature: 24, condition: "sunny", description: "晴天" },
    { time: "11:00", temperature: 26, condition: "cloudy", description: "多云" },
    { time: "12:00", temperature: 27, condition: "overcast", description: "阴天" },
    { time: "13:00", temperature: 28, condition: "haze", description: "雾霾" },
    { time: "14:00", temperature: 27, condition: "sunny", description: "晴天" },
  ],
  updatedAt: new Date().toISOString()
};

export const mockWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "前端重构项目",
    type: "code",
    description: "主站前端架构升级与性能优化",
    color: "#3b82f6",
    status: "active",
    focusLevel: 5,
    linkedMailAccountIds: [],
    linkedCalendarIds: [],
    linkedFolderPaths: [],
    goals: ["完成核心模块迁移", "性能提升 30%"],
    smartSummary: "本周完成了用户模块重构，正在进行订单流程改造",
    createdAt: "2024-01-15T08:00:00Z",
    updatedAt: "2024-03-25T10:30:00Z"
  },
  {
    id: "ws-2",
    name: "品牌视觉升级",
    type: "image",
    description: "Q1 品牌视觉系统设计与落地",
    color: "#ec4899",
    status: "active",
    focusLevel: 4,
    linkedMailAccountIds: [],
    linkedCalendarIds: [],
    linkedFolderPaths: [],
    goals: ["完成主视觉设计", "输出设计规范"],
    smartSummary: "主视觉已确认，正在进行延展设计",
    createdAt: "2024-02-01T08:00:00Z",
    updatedAt: "2024-03-24T16:00:00Z"
  },
  {
    id: "ws-3",
    name: "产品月报",
    type: "writing",
    description: "3 月产品数据总结与规划",
    color: "#10b981",
    status: "active",
    focusLevel: 3,
    linkedMailAccountIds: [],
    linkedCalendarIds: [],
    linkedFolderPaths: [],
    goals: ["完成数据整理", "撰写分析报告"],
    createdAt: "2024-03-20T08:00:00Z",
    updatedAt: "2024-03-25T09:00:00Z"
  },
  {
    id: "ws-4",
    name: "团队周会",
    type: "general",
    description: "每周团队同步与问题对齐",
    color: "#8b5cf6",
    status: "active",
    focusLevel: 2,
    linkedMailAccountIds: [],
    linkedCalendarIds: [],
    linkedFolderPaths: [],
    goals: ["同步进度", "识别阻塞"],
    createdAt: "2024-01-01T08:00:00Z",
    updatedAt: "2024-03-25T08:00:00Z"
  }
];

const today = new Date();
const todayStr = today.toISOString().split('T')[0];

export const mockSchedules: ScheduleItem[] = [
  {
    id: "sch-0",
    source: "manual",
    title: "阅读邮件",
    icon: "clock",
    startAt: `${todayStr}T08:00:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 30,
    repeatMode: "none",
    location: "",
    priority: "low",
    isFlexible: false,
    workspaceId: "ws-1",
    createdAt: "2024-03-24T08:00:00Z",
    updatedAt: "2024-03-24T08:00:00Z"
  },
  {
    id: "sch-1",
    source: "manual",
    title: "站会",
    icon: "meeting",
    startAt: `${todayStr}T09:00:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 30,
    repeatMode: "daily",
    repeatGroupId: "group-1",
    location: "会议室 A",
    priority: "medium",
    isFlexible: false,
    workspaceId: "ws-4",
    createdAt: "2024-03-24T08:00:00Z",
    updatedAt: "2024-03-24T08:00:00Z"
  },
  {
    id: "sch-2",
    source: "manual",
    title: "代码评审",
    icon: "focus",
    startAt: `${todayStr}T09:30:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 60,
    repeatMode: "none",
    location: "线上",
    priority: "high",
    isFlexible: false,
    workspaceId: "ws-1",
    createdAt: "2024-03-20T08:00:00Z",
    updatedAt: "2024-03-20T08:00:00Z"
  },
  {
    id: "sch-2b",
    source: "manual",
    title: "前端评审",
    icon: "focus",
    startAt: `${todayStr}T10:30:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 90,
    repeatMode: "none",
    location: "线上",
    priority: "high",
    isFlexible: false,
    workspaceId: "ws-1",
    createdAt: "2024-03-20T08:00:00Z",
    updatedAt: "2024-03-20T08:00:00Z"
  },
  {
    id: "sch-3",
    source: "manual",
    title: "设计评审",
    icon: "meeting",
    startAt: `${todayStr}T14:00:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 60,
    repeatMode: "weekly",
    repeatGroupId: "group-2",
    location: "设计室",
    priority: "high",
    isFlexible: false,
    workspaceId: "ws-2",
    createdAt: "2024-03-22T08:00:00Z",
    updatedAt: "2024-03-22T08:00:00Z"
  },
  {
    id: "sch-3b",
    source: "manual",
    title: "产品评审",
    icon: "meeting",
    startAt: `${todayStr}T14:30:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 90,
    repeatMode: "none",
    location: "会议室 B",
    priority: "medium",
    isFlexible: false,
    workspaceId: "ws-3",
    createdAt: "2024-03-22T08:00:00Z",
    updatedAt: "2024-03-22T08:00:00Z"
  },
  {
    id: "sch-4",
    source: "manual",
    title: "客户电话",
    icon: "call",
    startAt: `${todayStr}T16:00:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 30,
    repeatMode: "none",
    location: "",
    priority: "high",
    isFlexible: false,
    workspaceId: "ws-1",
    createdAt: "2024-03-22T08:00:00Z",
    updatedAt: "2024-03-22T08:00:00Z"
  },
  {
    id: "sch-5",
    source: "manual",
    title: "整理文档",
    icon: "clock",
    startAt: `${todayStr}T17:00:00Z`,
    timezone: "Asia/Shanghai",
    durationMinutes: 60,
    repeatMode: "none",
    location: "",
    priority: "low",
    isFlexible: false,
    workspaceId: "ws-2",
    createdAt: "2024-03-22T08:00:00Z",
    updatedAt: "2024-03-22T08:00:00Z"
  }
];

export const mockTasks: TaskItem[] = [
  {
    id: "task-1",
    title: "完成 API 接口联调",
    description: "与后端确认用户模块接口",
    status: "doing",
    priority: "high",
    dueAt: "2024-03-25T18:00:00Z",
    workspaceId: "ws-1",
    source: "manual",
    createdAt: "2024-03-24T08:00:00Z",
    updatedAt: "2024-03-25T08:00:00Z"
  },
  {
    id: "task-2",
    title: "整理设计素材",
    status: "todo",
    priority: "medium",
    dueAt: "2024-03-26T18:00:00Z",
    workspaceId: "ws-2",
    source: "manual",
    createdAt: "2024-03-24T08:00:00Z",
    updatedAt: "2024-03-24T08:00:00Z"
  },
  {
    id: "task-3",
    title: "撰写周报",
    status: "todo",
    priority: "medium",
    dueAt: "2024-03-25T20:00:00Z",
    workspaceId: "ws-3",
    source: "manual",
    createdAt: "2024-03-25T08:00:00Z",
    updatedAt: "2024-03-25T08:00:00Z"
  },
  {
    id: "task-4",
    title: "回复客户邮件",
    status: "todo",
    priority: "high",
    dueAt: "2024-03-25T12:00:00Z",
    source: "mail",
    createdAt: "2024-03-25T08:00:00Z",
    updatedAt: "2024-03-25T08:00:00Z"
  }
];

export const mockInboxItems: InboxItem[] = [
  {
    id: "mail-1",
    source: "gmail",
    from: "产品经理",
    fromEmail: "pm@company.com",
    subject: "Q2 需求评审邀请",
    summary: "邀请参加本周五的需求评审会议",
    receivedAt: "2024-03-25T08:30:00Z",
    workspaceTypeHint: "general",
    actionType: "schedule",
    isRead: false,
    isImportant: true,
    confidence: 0.85
  },
  {
    id: "mail-2",
    source: "gmail",
    from: "设计团队",
    fromEmail: "design@company.com",
    subject: "品牌视觉规范 v2.0",
    summary: "新版品牌规范已更新，请查收",
    receivedAt: "2024-03-24T16:00:00Z",
    workspaceId: "ws-2",
    workspaceTypeHint: "image",
    actionType: "review",
    isRead: true,
    isImportant: false,
    confidence: 0.92
  },
  {
    id: "mail-3",
    source: "gmail",
    from: "技术负责人",
    fromEmail: "tech@company.com",
    subject: "代码评审反馈",
    summary: "关于 PR #234 的评审意见",
    receivedAt: "2024-03-25T07:00:00Z",
    workspaceId: "ws-1",
    workspaceTypeHint: "code",
    actionType: "review",
    isRead: false,
    isImportant: true,
    confidence: 0.95
  }
];
