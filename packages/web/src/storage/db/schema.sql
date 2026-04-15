-- 工作区表
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('code', 'image', 'writing', 'general')),
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'archived')),
  focus_level INTEGER DEFAULT 0,
  linked_mail_account_ids TEXT DEFAULT '[]',
  linked_calendar_ids TEXT DEFAULT '[]',
  linked_folder_paths TEXT DEFAULT '[]',
  goals TEXT DEFAULT '[]',
  smart_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 日程表
CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('google_calendar', 'outlook_calendar', 'system_calendar', 'manual', 'mail_extracted')),
  source_event_id TEXT,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  repeat_mode TEXT NOT NULL DEFAULT 'none' CHECK (repeat_mode IN ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annually', 'annually')),
  repeat_group_id TEXT,
  location TEXT,
  attendees TEXT DEFAULT '[]',
  notes TEXT,
  workspace_id TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  preparation_minutes INTEGER,
  travel_minutes INTEGER,
  is_flexible BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- 收件箱表
CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('gmail', 'outlook', 'imap')),
  thread_id TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT,
  received_at TEXT NOT NULL,
  workspace_id TEXT,
  workspace_type_hint TEXT CHECK (workspace_type_hint IN ('code', 'image', 'writing', 'general')),
  action_type TEXT CHECK (action_type IN ('schedule', 'task', 'review', 'note')),
  related_schedule_id TEXT,
  attachments TEXT DEFAULT '[]',
  parsed_entities TEXT DEFAULT '[]',
  confidence REAL,
  is_read BOOLEAN DEFAULT 0,
  is_important BOOLEAN DEFAULT 0,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (related_schedule_id) REFERENCES schedule_items(id)
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_at TEXT,
  workspace_id TEXT,
  source TEXT CHECK (source IN ('manual', 'mail', 'schedule', 'system')),
  related_inbox_item_id TEXT,
  related_schedule_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (related_inbox_item_id) REFERENCES inbox_items(id),
  FOREIGN KEY (related_schedule_id) REFERENCES schedule_items(id)
);

-- 邮箱账户表
CREATE TABLE IF NOT EXISTS mail_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  username TEXT NOT NULL,
  secure BOOLEAN NOT NULL DEFAULT 1,
  display_name TEXT,
  email_address TEXT NOT NULL UNIQUE,
  auth_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (auth_status IN ('connected', 'disconnected', 'error')),
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('syncing', 'idle', 'error')),
  last_synced_at TEXT,
  scopes TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 日历账户表
CREATE TABLE IF NOT EXISTS calendar_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'outlook_calendar', 'system_calendar')),
  calendar_name TEXT NOT NULL,
  auth_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (auth_status IN ('connected', 'disconnected', 'error')),
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('syncing', 'idle', 'error')),
  last_synced_at TEXT,
  is_writable BOOLEAN DEFAULT 0
);

-- 同步游标表
CREATE TABLE IF NOT EXISTS sync_cursors (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  cursor TEXT,
  last_synced_at TEXT NOT NULL
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 工作区活动表
CREATE TABLE IF NOT EXISTS workspace_activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'email', 'schedule', 'file')),
  title TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_schedule_items_start_at ON schedule_items(start_at);
CREATE INDEX IF NOT EXISTS idx_schedule_items_workspace_id ON schedule_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_repeat_group_id ON schedule_items(repeat_group_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_received_at ON inbox_items(received_at);
CREATE INDEX IF NOT EXISTS idx_inbox_items_workspace_id ON inbox_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activities_workspace_id ON workspace_activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activities_timestamp ON workspace_activities(timestamp);
