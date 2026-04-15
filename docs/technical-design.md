# Daily 技术设计文档

## 1. 文档目标

本文档用于把 Daily 当前的产品设计落到实际代码结构与技术实现层，重点描述：

- 当前 monorepo 结构
- `web / desktop / service` 三段式职责划分
- 前端模块与页面边界
- 核心数据模型
- 当前状态管理、存储与同步方式
- 下一阶段的技术推进方向

对应产品文档：

- [design-doc.md](/Users/sifan/Documents/openSource/Daily/docs/design-doc.md)

## 2. 当前技术栈

### 2.1 前端

- React 19
- TypeScript
- Vite 7
- Tailwind CSS v4
- framer-motion
- date-fns
- i18next
- Zustand
- TanStack Query

### 2.2 桌面容器

- Tauri 2
- Rust

### 2.3 服务层

- Express
- TypeScript
- LangChain
- OpenAI
- IMAP / mailparser / ical

### 2.4 存储与配置

- SQLite schema（前端 storage 层保留 schema 与 mock 数据）
- 本地设置服务
- 环境变量驱动的 service 配置

## 3. 当前仓库结构

```text
Daily/
├── package.json
├── packages/
│   ├── web/
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/
│   │       ├── application/
│   │       ├── domain/
│   │       ├── features/
│   │       ├── i18n/
│   │       ├── locales/
│   │       ├── shared/
│   │       └── storage/
│   ├── desktop/
│   │   ├── package.json
│   │   └── src/
│   └── service/
│       ├── package.json
│       └── src/
└── docs/
```

## 4. Package 级职责

### 4.1 `packages/web`

当前前端主应用。负责：

- 路由与应用布局
- 页面与交互逻辑
- 主题、样式 token、共享 UI
- 本地 mock 数据驱动
- 调用 weather / settings / schedule 等前端服务

### 4.2 `packages/desktop`

当前桌面运行时壳。负责：

- Tauri 窗口能力
- 桌面端原生桥接
- 打包与运行

当前 Rust 入口：

- `packages/desktop/src/main.rs`
- `packages/desktop/src/lib.rs`

### 4.3 `packages/service`

当前独立服务进程。负责：

- 邮件接入与同步
- 分类与建议接口
- 位置相关接口
- LangChain / OpenAI 集成

当前主要入口：

- `packages/service/src/index.ts`
- `packages/service/src/routes/classify.ts`
- `packages/service/src/routes/suggestions.ts`
- `packages/service/src/routes/email.ts`
- `packages/service/src/routes/location.ts`

## 5. Web 当前模块结构

### 5.1 `packages/web/src/app`

负责应用壳与路由：

- `app/layout/`：应用布局、导航、设置弹层上下文
- `app/routes/`：页面级路由

### 5.2 `packages/web/src/features`

当前已落地的页面模块：

- `home/`
- `inbox/`（当前仅保留目录，未形成稳定功能页）
- `schedule/`
- `workspace/`
- `integrations/`
- `settings/`
- `onboarding/`

说明：

- 当前真正可进入主路由的页面仍以 `home / schedule / workspace / integrations / settings` 为主

### 5.3 `packages/web/src/domain`

当前核心实体：

- `home`
- `inbox`
- `schedule`
- `task`
- `weather`
- `workspace`

### 5.4 `packages/web/src/shared`

当前通用层：

- `constants/`
- `hooks/`
- `services/`
- `ui/`
- `utils/`

### 5.5 `packages/web/src/application`

当前存在以下预留目录：

- `overview/`
- `routing/`
- `suggestions/`
- `sync/`

这些目录目前主要用于占位未来编排层边界，尚未形成稳定实现文件。

### 5.6 `packages/web/src/storage`

当前负责：

- `db/schema.sql`
- `seeds/mockData.ts`
- `repositories/`（当前仅保留目录）

这一层当前仍偏向原型与前端本地结构定义，而不是完整 repository 实现。

## 6. 当前应用运行模型

Daily 当前采用“三段式运行模型”：

1. `web` 负责页面与交互
2. `desktop` 负责桌面容器与原生桥接
3. `service` 负责外部能力与智能处理

运行方式：

- `pnpm dev:web`：前端开发
- `pnpm dev:desktop`：桌面壳开发
- `pnpm dev:service`：AI / 邮件服务开发
- `pnpm dev:app`：并行启动 web + service

## 7. 当前路由结构

前端当前主要路由包括：

- `/`：首页
- `/schedule`
- `/workspaces`
- `/workspace/:id`
- `/integrations`
- `/settings`

这些路由集中定义于：

- `packages/web/src/app/routes/index.tsx`

## 8. 当前状态管理与共享服务

### 8.1 Zustand

当前用于本地 UI 状态与配置状态：

- `useSettingsStore`
- 其他页面级或偏好类状态

### 8.2 TanStack Query

当前作为同步状态层已在技术栈中明确，但项目仍处于前端原型与本地数据驱动阶段，尚未全面接管页面数据流。

### 8.3 Shared services

当前已有：

- `weatherService`
- `settingsService`

以及对应 hooks：

- `useWeather`
- `useScheduleStore`
- `useAppContext`

## 9. 核心数据模型

以下模型以当前 `domain` 中的真实定义为准。

### 9.1 Workspace

```ts
type WorkspaceType = "code" | "image" | "writing" | "general";
type WorkspaceStatus = "active" | "pending" | "archived";

interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description: string;
  color: string;
  status: WorkspaceStatus;
  focusLevel: number;
  linkedMailAccountIds: string[];
  linkedCalendarIds: string[];
  linkedFolderPaths: string[];
  goals: string[];
  smartSummary?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 9.2 ScheduleItem

```ts
type ScheduleSource =
  | "google_calendar"
  | "outlook_calendar"
  | "system_calendar"
  | "manual"
  | "mail_extracted";

type Priority = "low" | "medium" | "high";

interface ScheduleItem {
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
  createdAt: string;
  updatedAt: string;
}
```

### 9.3 InboxItem

```ts
type InboxSource = "gmail" | "outlook" | "imap";
type ActionType = "schedule" | "task" | "review" | "note";

interface InboxItem {
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
```

### 9.4 TaskItem

```ts
type TaskStatus = "todo" | "doing" | "done";
type TaskSource = "manual" | "mail" | "schedule" | "system";

interface TaskItem {
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
```

### 9.5 WeatherSnapshot

```ts
type WeatherCondition =
  | "sunny"
  | "cloudy"
  | "overcast"
  | "rainy"
  | "thunderstorm"
  | "haze"
  | "snow"
  | "night";

interface WeatherSnapshot {
  condition: WeatherCondition;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  city: string;
  description: string;
  sunrise: string;
  sunset: string;
  hourlyForecast: HourlyForecast[];
  updatedAt: string;
}
```

## 10. 当前 UI 架构原则

### 10.1 Feature-first

页面 UI 以 `features/*` 为主要组织单元，避免把页面逻辑分散到过多横向层级。

### 10.2 Domain-driven typing

所有页面共享的核心实体统一从 `domain/*` 引用，避免页面局部重复定义。

### 10.3 Shared token first

颜色、圆角、间距、优先级色板等统一从 `packages/web/src/App.css` 和共享常量中复用。

### 10.4 信息与操作分离

tips、badge、状态摘要和按钮在视觉上必须语义分离。只有可点击动作使用按钮视觉。

### 10.5 Form Modal First

创建、编辑、连接、配置类表单默认必须放在弹窗或模态层中，不在页面主内容流里以内联表单直接展开。

### 10.6 Delete Confirmation Required

所有删除类危险操作必须通过显式确认弹窗二次确认后再执行，不能在第一次点击时直接触发实际删除。

### 10.7 Async Action Feedback Required

所有异步操作按钮必须提供统一操作反馈：按钮本地进入 loading 并禁用重复点击，成功通过全局 success toast 明确反馈，失败通过全局 error toast 明确反馈；表单内联错误可作为补充，但不能替代全局失败反馈。

## 11. 当前 service 架构

### 11.1 路由层

当前 service 暴露的核心路由：

- `/api/classify`
- `/api/suggestions`
- `/api/email`
- `/api/location`

### 11.2 邮件服务层

当前邮件能力位于：

- `packages/service/src/services/email/imap-connector.ts`
- `packages/service/src/services/email/email-parser.ts`
- `packages/service/src/services/email/email-sync-service.ts`
- `packages/service/src/services/email/mail-account.ts`

当前定位：

- IMAP 连接与基础同步
- 邮件解析
- ICS / 邮件结构处理
- 为前端摘要与建议层提供输入

### 11.3 LangChain 层

当前 AI 能力统一位于：

- `packages/service/src/services/langchain.ts`

它用于分类与建议相关的模型调用封装。

## 12. 当前存储设计

### 12.1 前端侧

前端当前主要通过：

- `storage/db/schema.sql`
- `storage/seeds/mockData.ts`

来维持结构定义和原型数据。

### 12.2 时间策略

当前时间策略保持不变：

- 存储统一 UTC
- UI 本地时区展示
- 外部来源时区信息保留在模型中

## 13. 当前成熟度判断

### 已较稳定

- 首页布局与主要卡片
- 日程页时间轴和编辑弹窗
- 工作区列表与详情的基本页面流
- 设置与主题基础能力

### 仍在演进

- service 与前端的真实数据闭环
- 收件箱独立页面
- 多来源账号连接体验
- schedule / inbox / workspace 的深度联动
- application 层编排逻辑（当前目录已预留，文件尚未形成）

## 14. 下一阶段技术重点

建议下一阶段优先推进：

1. 完成 `service` 到 `web` 的真实数据接线
2. 把 `application/*` 从预留目录推进为真实编排层
3. 明确 SQLite 的前端/桌面/service 边界
4. 把 Inbox 页面从 domain/mock 阶段推进到功能页
5. 为集成页补齐账号连接、状态和错误处理流程

## 15. 文档维护规则

后续更新本文档时应遵循：

- 目录结构必须以 `packages/*` 为准
- 文件路径必须引用真实存在的目录
- 数据模型以 `domain/*` 中的现状为准，不使用过期字段
- 当设计与实现发生偏离时，应优先更新技术设计文档说明“当前真实状态”
