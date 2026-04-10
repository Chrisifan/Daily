# 智能工作台桌面应用技术设计文档

## 1. 文档目标

本技术设计文档用于把产品设计文档落到可执行实现层，明确：

- 桌面端技术栈
- 前端模块边界
- 数据模型与本地存储
- 邮件 / 日历 / 天气接入方式
- 同步流程
- 权限与安全策略
- MVP 实现顺序

本文默认基于当前产品设计文档：

- [design-doc.md](/Users/sifan/Documents/openSource/Daily/design-doc.md)

## 2. 技术路线建议

### 2.1 桌面容器

建议优先方案：

- `Tauri`

原因：

- 包体更轻
- 系统能力扩展足够
- 性能和资源占用更适合长期驻留型工作台

备选方案：

- `Electron`

适用情况：

- 团队更熟悉 Node/Electron 生态
- 需要更成熟的原生桥接能力
- 需要大量现成桌面插件

### 2.2 前端框架

建议：

- `React`
- `TypeScript`
- `Vite`

原因：

- 组件化适合首页卡片、工作区、日程总览等复杂界面
- TypeScript 适合统一数据模型
- Vite 适合原型快速迭代

### 2.3 状态管理

建议：

- 服务端同步状态：`TanStack Query`
- 本地 UI 状态：`Zustand`

拆分原则：

- Query 管同步数据、缓存、轮询
- Zustand 管筛选器、当前工作区、展开状态、界面偏好

### 2.4 本地存储

建议：

- `SQLite`

用途：

- 缓存邮件摘要
- 缓存日历事件
- 工作区和任务数据
- 同步游标
- 用户偏好设置

### 2.5 时间与日期

建议：

- `date-fns` 或 `dayjs`

要求：

- 所有时间统一存 UTC
- UI 层按用户本地时区展示
- 外部系统原始时区信息保留

## 3. 应用架构

### 3.1 模块划分

建议拆成 5 层：

1. UI 层
2. Domain 层
3. Application 层
4. Connector 层
5. Storage 层

### 3.2 各层职责

#### UI 层

负责：

- 首页
- 日程总览
- 工作区列表与详情
- 收件箱
- 设置与集成

不负责：

- 直接调用第三方 API
- 直接拼装复杂同步逻辑

#### Domain 层

负责定义核心实体：

- Workspace
- ScheduleItem
- InboxItem
- TaskItem
- MailAccount
- CalendarAccount

这一层只放业务模型和纯逻辑，不依赖具体 API。

#### Application 层

负责：

- 同步流程编排
- 自动归类
- 冲突检测
- 智能建议生成
- 首页聚合结果组装

例如：

- `syncTodaySnapshot()`
- `routeInboxItemToWorkspace()`
- `buildHomeOverview()`
- `detectScheduleConflicts()`

#### Connector 层

负责外部系统接入：

- Gmail Connector
- Graph Mail Connector
- Google Calendar Connector
- Outlook Calendar Connector
- Weather Connector
- Local Calendar Bridge

这一层只关注“拉什么、怎么拉、怎么鉴权”。

#### Storage 层

负责：

- SQLite schema
- Repository
- 同步游标
- 本地缓存
- 离线读取

## 4. 推荐目录结构

```text
src/
  app/
    routes/
    layout/
  features/
    home/
    schedule/
    workspace/
    inbox/
    settings/
  domain/
    workspace/
    schedule/
    inbox/
    account/
  application/
    sync/
    routing/
    suggestions/
    overview/
  connectors/
    gmail/
    graph-mail/
    google-calendar/
    outlook-calendar/
    weather/
    local-calendar/
  storage/
    db/
    repositories/
    migrations/
  shared/
    ui/
    utils/
    constants/
```

## 5. 页面与模块映射

### 5.1 首页

输入：

- 今日天气
- 今日事件
- 重要邮件摘要
- 活跃工作区
- 今日待办

输出模块：

- 主卡
- 小型摘要卡
- 今日待办卡
- 工作区总览卡

聚合函数建议：

- `buildHomeOverview()`

### 5.2 日程总览

输入：

- 系统日历事件
- 手动任务转日程
- 邮件提取出的会议建议

支持：

- 来源过滤
- 工作区过滤
- 重要性过滤
- 冲突标记

### 5.3 工作区详情

输入：

- 当前工作区
- 关联任务
- 关联邮件
- 关联日历
- 相关文件

输出模块：

- 工作区状态
- 时间线
- 任务队列
- 智能摘要

## 6. 数据模型设计

### 6.1 Workspace

```ts
type WorkspaceType = "code" | "image" | "writing" | "general";

interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description: string;
  color: string;
  status: "active" | "pending" | "archived";
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

### 6.2 ScheduleItem

```ts
interface ScheduleItem {
  id: string;
  source: "google_calendar" | "outlook_calendar" | "system_calendar" | "manual" | "mail_extracted";
  sourceEventId?: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location?: string;
  attendees?: string[];
  notes?: string;
  workspaceId?: string;
  priority: "low" | "medium" | "high";
  preparationMinutes?: number;
  travelMinutes?: number;
  isFlexible: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 6.3 InboxItem

```ts
interface InboxItem {
  id: string;
  source: "gmail" | "outlook" | "imap";
  threadId?: string;
  from: string;
  subject: string;
  summary: string;
  receivedAt: string;
  workspaceId?: string;
  workspaceTypeHint?: WorkspaceType;
  actionType?: "schedule" | "task" | "review" | "note";
  relatedScheduleId?: string;
  attachments?: string[];
  parsedEntities?: string[];
  confidence?: number;
}
```

### 6.4 TaskItem

```ts
interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  dueAt?: string;
  workspaceId?: string;
  source?: "manual" | "mail" | "schedule" | "system";
  relatedInboxItemId?: string;
  relatedScheduleId?: string;
}
```

## 7. SQLite 设计建议

建议表：

- `workspaces`
- `workspace_type_configs`
- `schedule_items`
- `inbox_items`
- `tasks`
- `mail_accounts`
- `calendar_accounts`
- `sync_cursors`
- `settings`

### 7.1 sync_cursors

用于记录增量同步位置：

- `provider`
- `account_id`
- `cursor`
- `last_synced_at`

## 8. 外部系统接入设计

### 8.1 天气系统

建议接入：

- OpenWeather
- QWeather

第一版需要的数据：

- 当前天气
- 温度
- 天气类型
- 日出日落时间
- 未来 6 小时天气

用途：

- 首页背景主题
- 首页文案
- 通勤提醒

接口输出统一格式：

```ts
interface WeatherSnapshot {
  condition: "sunny" | "cloudy" | "rainy" | "snow" | "storm" | "night";
  temperature: number;
  feelsLike: number;
  city: string;
  updatedAt: string;
}
```

### 8.2 Gmail 接入

鉴权：

- OAuth 2.0

建议 scope：

- 只读邮件 scope 优先

第一版只需要：

- 邮件列表
- 邮件摘要
- 线程 ID
- 时间
- 附件元信息

不建议第一版做：

- 发信
- 删除
- 修改标签

### 8.3 Outlook / Microsoft Graph 接入

鉴权：

- Microsoft OAuth

读取对象：

- 邮件
- 日历

优先级：

- 邮件和日历都可以后续统一走 Graph

### 8.4 IMAP 接入

定位：

- 通用邮箱兜底

风险：

- 各家服务行为不完全一致
- 邮件解析复杂度更高

建议：

- 作为 V3 或 V4 再接

### 8.5 Google Calendar 接入

鉴权：

- Google OAuth

第一版读取：

- 未来 14 天
- 最近 7 天
- 今日所有事件

用途：

- 首页摘要
- 日程总览
- 冲突检测

### 8.6 系统日历接入

建议延后做本地桥接：

- macOS 下通过原生桥接能力读本地日历

原因：

- 本地权限更复杂
- 不同桌面框架下实现方式不同
- 早期云日历接入更稳定

## 9. 智能归类与建议引擎

### 9.1 归类输入

- 邮件主题
- 邮件正文摘要
- 日历标题
- 附件名称
- 用户最近使用的工作区

### 9.2 归类输出

- 推荐工作区类型
- 推荐具体工作区
- 推荐动作

### 9.3 规则优先级

建议先规则，后模型：

1. 关键词规则
2. 最近上下文命中
3. 工作区历史行为
4. 模型推断

### 9.4 推荐动作示例

- 加入日程
- 转成待办
- 加入代码工作区
- 加入图片处理工作区
- 加入写作工作区
- 稍后提醒

## 10. 首页聚合逻辑

建议建立首页快照对象：

```ts
interface HomeOverviewSnapshot {
  weather: WeatherSnapshot;
  currentTime: string;
  primarySchedule?: ScheduleItem;
  scheduleSummary: ScheduleItem[];
  inboxSummary: InboxItem[];
  activeWorkspaces: Workspace[];
  taskSummary: TaskItem[];
  warnings: string[];
}
```

生成流程：

1. 拉天气
2. 拉今日事件
3. 拉今日重要邮件
4. 拉活跃工作区
5. 拉今日任务
6. 组装首页视图模型

## 11. 同步流程

### 11.1 启动时

1. 读取本地缓存
2. 先渲染首页
3. 后台执行同步
4. 局部刷新模块

### 11.2 前台轮询

建议：

- 天气：30 分钟
- 日历：5 分钟
- 邮件摘要：3-5 分钟

### 11.3 手动刷新

行为：

- 用户点击刷新时，立即重拉首页所需摘要
- 不强制拉全量正文

## 12. 权限与安全

### 12.1 权限原则

- 默认最小权限
- 默认只读
- 用户可随时断开

### 12.2 本地存储原则

- Access Token 不直接明文存 SQLite
- 凭证优先放系统安全存储
- SQLite 只存业务缓存和同步状态

### 12.3 隐私设计

- 邮件正文默认只用于摘要和归类
- 用户可关闭智能解析
- 用户可清除本地缓存

## 13. MVP 技术实现顺序

### 第一阶段

- React + TypeScript + Vite 原型
- 首页
- 工作区模板
- SQLite 本地模型
- 模拟数据

### 第二阶段

- 天气接入
- Google Calendar 接入
- 首页与日程联动

### 第三阶段

- Gmail 接入
- 邮件摘要
- 自动归类

### 第四阶段

- Outlook / Graph
- 冲突检测
- 智能建议

## 14. 推荐下一步

当前最适合继续做的是：

1. 初始化真实项目脚手架
2. 先定义 TypeScript 类型与 SQLite schema
3. 再实现首页视图模型和模拟同步层

这样可以先把应用骨架搭稳，再逐步接入真实邮件和日历系统。
