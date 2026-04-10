/**
 * 邮件模块数据模型
 * 定义 EmailAccount、EmailMessage、EmailAttachment、IcsEvent 等核心数据结构
 */

// ==================== 账户配置 ====================

/**
 * 邮箱账户配置
 * 注意：密码字段不存储明文，实际运行时从环境变量或安全存储中读取
 */
export interface EmailAccount {
  /** 账户唯一标识 */
  id: string;
  /** 邮箱地址 */
  email: string;
  /** IMAP 服务器地址，如 imap.gmail.com */
  imapHost: string;
  /** IMAP 端口，通常为 993 */
  imapPort: number;
  /** 用户名，通常同邮箱地址 */
  username: string;
  /** 应用专用密码（不在此文件中存储，从环境变量读取） */
  passwordEnvKey: string;
  /** 是否启用 SSL/TLS */
  secure: boolean;
  /** 账户显示名称（可选） */
  displayName?: string;
  /** 上次同步时间 */
  lastSyncedAt?: string;
  /** 账户创建时间 */
  createdAt: string;
}

/**
 * 邮件账户配置加载选项
 */
export interface MailAccountConfigOptions {
  /** 配置文件路径 */
  configPath: string;
  /** 密码环境变量前缀，如 "MAIL_" */
  passwordEnvPrefix?: string;
}

// ==================== 邮件正文 ====================

/**
 * 邮件地址（发件人/收件人）
 */
export interface EmailAddress {
  name?: string;    // 显示名称，如 "张三"
  address: string;  // 邮箱地址，如 "zhangsan@example.com"
}

/**
 * 邮件正文内容
 */
export interface EmailBody {
  /** 纯文本正文 */
  text?: string;
  /** HTML 正文（可能含标签） */
  html?: string;
  /** 是否是从 HTML 转换来的纯文本 */
  textFromHtml?: boolean;
}

// ==================== 附件 ====================

/**
 * 邮件附件元信息（不上传附件，只记录元信息）
 */
export interface EmailAttachment {
  /** 附件唯一标识 */
  id: string;
  /** 附件文件名 */
  filename: string;
  /** MIME 类型，如 application/pdf */
  contentType: string;
  /** 附件大小（字节） */
  size: number;
  /** 附件是否为内联资源（如图片） */
  inline: boolean;
  /** 附件 CID（用于内联图片引用） */
  cid?: string;
  /** 附件的 content-disposition 头 */
  disposition?: string;
  /** 是否为 .ics 日历邀请 */
  isCalendarInvite?: boolean;
}

// ==================== 邮件消息 ====================

/**
 * IMAP 文件夹信息
 */
export interface ImapFolder {
  name: string;        // 文件夹名称，如 "INBOX"
  path: string;       // 文件夹路径
  delimiter: string;  // 路径分隔符
}

/**
 * 邮件搜索条件
 */
export interface EmailSearchCriteria {
  /** 搜索起始日期 */
  since?: Date;
  /** 搜索结束日期 */
  before?: Date;
  /** 发件人（支持模糊匹配） */
  from?: string;
  /** 收件人（支持模糊匹配） */
  to?: string;
  /** 邮件主题（支持模糊匹配） */
  subject?: string;
  /** 是否只搜索未读邮件 */
  unread?: boolean;
  /** 是否只搜索带附件的邮件 */
  withAttachments?: boolean;
  /** 搜索的文件夹，默认为 INBOX */
  folder?: string;
  /** 搜索数量上限 */
  limit?: number;
}

/**
 * 解析后的邮件数据结构
 */
export interface EmailMessage {
  /** 邮件唯一标识（IMAP UID） */
  uid: number;
  /** 邮件在 IMAP 服务器上的序号 */
  sequenceNo: number;
  /** Message-ID 头字段 */
  messageId?: string;
  /** Thread-ID（如果支持） */
  threadId?: string;
  /** 邮件主题 */
  subject?: string;
  /** 发件人 */
  from?: EmailAddress;
  /** 收件人列表 */
  to: EmailAddress[];
  /** 抄送收件人列表 */
  cc?: EmailAddress[];
  /** 密送收件人列表 */
  bcc?: EmailAddress[];
  /** 邮件发送时间 */
  date: Date;
  /** 邮件正文 */
  body: EmailBody;
  /** 附件列表（只含元信息） */
  attachments: EmailAttachment[];
  /** 是否已读 */
  seen: boolean;
  /** 是否为草稿 */
  draft: boolean;
  /** 是否已回复 */
  answered: boolean;
  /** 是否已转发 */
  forwarded: boolean;
  /** 是否带附件 */
  hasAttachments: boolean;
  /** 邮件大小（字节） */
  size: number;
  /** 来源账户 ID */
  accountId: string;
  /** 来源文件夹 */
  folder: string;
  /** 关联的 ICS 日历事件（如果有） */
  icsEvents?: IcsEvent[];
  /** 邮件原始头部信息（调试用） */
  rawHeaders?: Record<string, string>;
  /** 解析时间 */
  parsedAt: string;
}

// ==================== 日历事件 ====================

/**
 * 从 .ics 附件中解析出的日历事件
 */
export interface IcsEvent {
  /** 事件 ID（UID） */
  uid: string;
  /** 事件标题 */
  summary?: string;
  /** 事件描述 */
  description?: string;
  /** 开始时间 */
  start: Date;
  /** 结束时间 */
  end?: Date;
  /** 时区 */
  timezone?: string;
  /** 地点 */
  location?: string;
  /**  organizer（组织者） */
  organizer?: EmailAddress;
  /** attendee（参与者）列表 */
  attendees?: EmailAddress[];
  /** 是否为全天事件 */
  allDay?: boolean;
  /** 事件分类：REQUEST（邀请）/ CANCEL（取消）/ REPLY（回复） */
  method?: "REQUEST" | "CANCEL" | "REPLY" | "PUBLISH";
  /** 重复规则 */
  recurrence?: string;
  /** 事件状态 */
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  /** 事件序列号 */
  sequence?: number;
  /** 来源邮件 UID */
  sourceEmailUid?: number;
  /** 来源邮件 Message-ID */
  sourceEmailMessageId?: string;
  /** 原始 ICS 文本（便于调试） */
  rawIcs?: string;
}

// ==================== 同步状态 ====================

/**
 * 同步统计信息
 */
export interface SyncStats {
  /** 同步账户 ID */
  accountId: string;
  /** 同步类型 */
  type: "full" | "incremental";
  /** 同步开始时间 */
  startedAt: string;
  /** 同步结束时间 */
  completedAt?: string;
  /** 拉取邮件总数 */
  totalFetched: number;
  /** 新邮件数 */
  newMessages: number;
  /** 更新邮件数 */
  updatedMessages: number;
  /** 解析失败数 */
  parseErrors: number;
  /** ICS 事件数 */
  icsEventsFound: number;
  /** 错误信息（如果有） */
  error?: string;
}

// ==================== 连接器配置 ====================

/**
 * IMAP 连接器配置（完整配置，包含从环境变量读取的密码）
 */
export interface ImapConnectorConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 重连延迟（毫秒） */
  reconnectDelay?: number;
  /** TLS 选项 */
  tlsOptions?: {
    rejectUnauthorized?: boolean;
  };
}

// ==================== 错误类型 ====================

/**
 * 邮件服务错误类型
 */
export enum EmailServiceErrorCode {
  // 连接错误
  CONNECTION_FAILED = "CONNECTION_FAILED",
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",
  CONNECTION_REFUSED = "CONNECTION_REFUSED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // 认证错误
  AUTH_FAILED = "AUTH_FAILED",
  AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",

  // 操作错误
  MAILBOX_NOT_FOUND = "MAILBOX_NOT_FOUND",
  SEARCH_FAILED = "SEARCH_FAILED",
  FETCH_FAILED = "FETCH_FAILED",
  PARSE_FAILED = "PARSE_FAILED",

  // 同步错误
  SYNC_IN_PROGRESS = "SYNC_IN_PROGRESS",
  SYNC_FAILED = "SYNC_FAILED",

  // 未知错误
  UNKNOWN = "UNKNOWN",
}

/**
 * 邮件服务错误
 */
export class EmailServiceError extends Error {
  constructor(
    public readonly code: EmailServiceErrorCode,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "EmailServiceError";
  }
}
