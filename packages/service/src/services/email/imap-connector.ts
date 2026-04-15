/**
 * IMAP 邮箱连接器
 * 封装 imap 库的连接、认证、搜索、获取邮件等核心操作
 * 支持心跳保活和自动重连
 */

import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import {
  ImapConnectorConfig,
  EmailServiceError,
  EmailServiceErrorCode,
  ImapFolder,
  EmailSearchCriteria,
  EmailMessage,
  EmailAddress,
  EmailBody,
  EmailAttachment,
  IcsEvent,
} from "./models/email.js";
import { parseIcsContent, detectIcsContent } from "./utils/ics-parser.js";
import { EventEmitter } from "events";
import { Readable } from "stream";

// IMAP 类型别名（来自 @types/imap）
type ImapSearchCriteria = any[];
type ImapFetchOptions = Imap.FetchOptions;
type ImapConnectionWithId = Imap & {
  id(
    identification: Record<string, string> | null,
    callback: (err?: Error | null) => void
  ): void;
};

// ==================== 类型声明 ====================

/**
 * IMAP 连接状态
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  AUTHENTICATED = "authenticated",
  DISCONNECTING = "disconnecting",
  ERROR = "error",
}

// ==================== IMAP 连接器 ====================

/**
 * IMAP 连接器类
 * 提供连接、断开、搜索、获取邮件等核心功能
 */
export class ImapConnector extends EventEmitter {
  private imap: Imap;
  private config: ImapConnectorConfig;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = false;

  constructor(config: ImapConnectorConfig) {
    super();
    this.config = {
      connectionTimeout: 30000,
      heartbeatInterval: 300000, // 5 分钟心跳
      maxReconnectAttempts: 5,
      reconnectDelay: 5000,
      ...config,
    };

    this.imap = this.createImapInstance();
    this.setupEventHandlers();
  }

  // ==================== 连接管理 ====================

  /**
   * 连接到 IMAP 服务器
   */
  async connect(): Promise<void> {
    if (
      this.state === ConnectionState.CONNECTED ||
      this.state === ConnectionState.AUTHENTICATED
    ) {
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 清理可能残留的连接
        try {
          this.imap.end();
        } catch {
          // ignore
        }
        reject(
          new EmailServiceError(
            EmailServiceErrorCode.CONNECTION_TIMEOUT,
            `IMAP 连接超时（${this.config.connectionTimeout}ms），服务器: ${this.config.host}:${this.config.port}`
          )
        );
      }, this.config.connectionTimeout);

      this.imap.once("ready", () => {
        clearTimeout(timeout);
        this.setState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        console.log(`[imap-connector] 已连接到 ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.imap.once("error", (err: Error) => {
        clearTimeout(timeout);
        reject(this.mapError(err));
      });

      try {
        this.imap.connect();
      } catch (err) {
        clearTimeout(timeout);
        reject(this.mapError(err as Error));
      }
    });
  }

  /**
   * 认证登录
   */
  async authenticate(): Promise<void> {
    if (this.state === ConnectionState.AUTHENTICATED) {
      return;
    }

    if (this.state === ConnectionState.CONNECTED) {
      await this.sendClientIdentification();

      // 打开 INBOX 以完成认证
      return new Promise((resolve, reject) => {
        this.imap.openBox("INBOX", true, (err) => {
          if (err) {
            reject(this.mapError(err));
            return;
          }
          this.setState(ConnectionState.AUTHENTICATED);
          this.startHeartbeat();
          console.log(`[imap-connector] 已认证用户: ${this.config.user}`);
          resolve();
        });
      });
    }

    // 如果未连接，先连接
    await this.connect();
    return this.authenticate();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.setState(ConnectionState.DISCONNECTING);

    return new Promise((resolve) => {
      this.imap.once("close", () => {
        this.setState(ConnectionState.DISCONNECTED);
        console.log("[imap-connector] 已断开连接");
        resolve();
      });

      try {
        this.imap.end();
      } catch {
        // ignore
      }

      // 超时保护
      setTimeout(() => {
        this.setState(ConnectionState.DISCONNECTED);
        resolve();
      }, 3000);
    });
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.state === ConnectionState.AUTHENTICATED;
  }

  /**
   * 获取当前状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  // ==================== 邮箱操作 ====================

  /**
   * 获取邮箱文件夹列表
   */
  async listFolders(): Promise<ImapFolder[]> {
    await this.ensureAuthenticated();

    return new Promise((resolve, reject) => {
      this.imap.getBoxes("", (err, boxes) => {
        if (err) {
          reject(this.mapError(err));
          return;
        }

        const folders: ImapFolder[] = [];
        this.flattenBoxes(boxes, "", folders);
        resolve(folders);
      });
    });
  }

  /**
   * 搜索邮件
   * @param criteria - 搜索条件
   * @returns 匹配的邮件 UID 列表
   */
  async searchEmails(criteria: EmailSearchCriteria): Promise<Array<{ uid: number; id: string }>> {
    await this.ensureAuthenticated();

    const folder = criteria.folder ?? "INBOX";

    return new Promise((resolve, reject) => {
      this.imap.openBox(folder, false, async (openErr) => {
        if (openErr) {
          reject(this.mapError(openErr));
          return;
        }

        try {
          const searchCriteria = this.buildSearchCriteria(criteria);
          const results = await this.imapSearch(searchCriteria);
          resolve(results);
        } catch (searchErr) {
          reject(this.mapError(searchErr as Error));
        }
      });
    });
  }

  /**
   * 获取单封邮件的完整信息
   * @param uid - 邮件 UID
   * @param folder - 文件夹名称
   */
  async fetchEmail(uid: number, folder = "INBOX"): Promise<EmailMessage> {
    await this.ensureAuthenticated();

    const emails = await this.fetchEmails([uid], folder);
    if (emails.length === 0) {
      throw new EmailServiceError(
        EmailServiceErrorCode.FETCH_FAILED,
        `邮件 ${uid} 未找到`
      );
    }
    return emails[0];
  }

  /**
   * 批量获取邮件
   * @param uids - 邮件 UID 列表
   * @param folder - 文件夹名称
   * @param onEmail - 每解析完一封邮件的回调
   */
  async fetchEmails(
    uids: number[],
    folder = "INBOX",
    onEmail?: (email: EmailMessage) => void
  ): Promise<EmailMessage[]> {
    if (uids.length === 0) {
      return [];
    }

    await this.ensureAuthenticated();

    return new Promise((resolve, reject) => {
      this.imap.openBox(folder, false, (openErr) => {
        if (openErr) {
          reject(this.mapError(openErr));
          return;
        }

        const fetchOptions: ImapFetchOptions = {
          bodies: ["HEADER", "TEXT", ""],
          struct: true,
        };

        const fetch = this.imap.fetch(uids, fetchOptions);
        const emails: EmailMessage[] = [];
        let pending = uids.length;
        let fetchError: Error | null = null;

        fetch.on("message", (msg, seqno) => {
          let parsed: Partial<EmailMessage> = {
            sequenceNo: seqno,
            folder,
            to: [],
            attachments: [],
          };

          // 收集邮件头
          const headerChunks: Buffer[] = [];
          // 收集邮件体
          const bodyChunks: Buffer[] = [];
          let struct: any | null = null;
          let attributes: Imap.ImapMessageAttributes | null = null;

          // 获取邮件结构
          msg.once("attributes", (attrs: Imap.ImapMessageAttributes) => {
            attributes = attrs;
          });

          // 处理邮件正文
          msg.on("body", (stream: NodeJS.ReadableStream, info: Imap.ImapMessageBodyInfo) => {
            const chunks: Buffer[] = [];

            stream.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });

            stream.once("end", async () => {
              const fullBuffer = Buffer.concat(chunks);

              if (info.which === "" || info.which === "TEXT") {
                // BODY[] - 完整邮件体
                bodyChunks.push(fullBuffer);
              } else {
                // HEADER
                headerChunks.push(fullBuffer);
              }
            });
          });

          // 邮件解析完成
          msg.once("end", async () => {
            try {
              if (bodyChunks.length === 0) {
                pending--;
                return;
              }

              const bodyBuffer = Buffer.concat(bodyChunks);
              const headerBuffer =
                headerChunks.length > 0 ? Buffer.concat(headerChunks) : undefined;

              // 使用 mailparser 解析邮件
              const parsedMail = await this.parseWithMailparser(
                bodyBuffer,
                headerBuffer
              );

              parsed = {
                ...parsed,
                ...this.convertParsedMail(
                  parsedMail,
                  attributes,
                  folder
                ),
              };

              // 处理 ICS 附件
              const icsEvents = this.extractIcsFromParsed(parsedMail, parsed.uid);
              if (icsEvents.length > 0) {
                parsed.icsEvents = icsEvents;
              }

              const email = parsed as EmailMessage;
              emails.push(email);
              onEmail?.(email);
            } catch (parseErr) {
              console.error(`[imap-connector] 解析邮件 seq=${seqno} uid=${attributes?.uid} 失败:`, parseErr);
              // 创建一个错误占位邮件
              const errorEmail: EmailMessage = {
                uid: attributes?.uid ?? 0,
                sequenceNo: seqno,
                subject: "[解析失败]",
                to: [],
                date: new Date(),
                body: { text: `邮件解析失败: ${(parseErr as Error).message}` },
                attachments: [],
                seen: false,
                draft: false,
                answered: false,
                forwarded: false,
                hasAttachments: false,
                size: attributes?.size ?? 0,
                accountId: "",
                folder,
                parsedAt: new Date().toISOString(),
              };
              emails.push(errorEmail);
            }

            pending--;
            if (pending <= 0) {
              if (fetchError) {
                reject(fetchError);
              } else {
                resolve(emails);
              }
            }
          });
        });

        fetch.once("error", (err: Error) => {
          fetchError = this.mapError(err);
          reject(fetchError);
        });

        fetch.once("end", () => {
          if (pending > 0) {
            // 等待剩余的 end 事件
            const checkDone = setInterval(() => {
              if (pending <= 0) {
                clearInterval(checkDone);
                resolve(emails);
              }
            }, 100);

            // 超时保护
            setTimeout(() => {
              clearInterval(checkDone);
              resolve(emails);
            }, 30000);
          }
        });
      });
    });
  }

  // ==================== 内部方法 ====================

  private createImapInstance(): Imap {
    return new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.secure,
      tlsOptions: this.config.tlsOptions,
      connTimeout: this.config.connectionTimeout,
      authTimeout: 15000,
      debug: process.env.IMAP_DEBUG === "true" ? console.log : undefined,
    });
  }

  private async sendClientIdentification(): Promise<void> {
    if (!this.imap.serverSupports("ID")) {
      return;
    }

    const imapWithId = this.imap as ImapConnectionWithId;

    return new Promise((resolve, reject) => {
      imapWithId.id(
        {
          name: "Daily",
          version: "0.1.0",
          vendor: "Daily",
          "support-url": "https://github.com/openai",
        },
        (err?: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  private setupEventHandlers(): void {
    this.imap.on("mail", (count: number) => {
      console.log(`[imap-connector] 收件箱收到 ${count} 封新邮件`);
      this.emit("mail", count);
    });

    this.imap.on("update", (seqno: number, info: unknown) => {
      this.emit("update", seqno, info);
    });

    this.imap.on("close", (hadError: boolean) => {
      this.stopHeartbeat();
      if (hadError && this.shouldReconnect) {
        this.handleReconnect();
      } else {
        this.setState(ConnectionState.DISCONNECTED);
      }
    });

    this.imap.on("error", (err: Error) => {
      console.error("[imap-connector] IMAP 错误:", err.message);
      this.setState(ConnectionState.ERROR);
      this.emit("error", this.mapError(err));
    });
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit("stateChanged", state);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.state === ConnectionState.AUTHENTICATED) {
      return;
    }

    try {
      await this.authenticate();
    } catch (err) {
      const error = this.mapError(err as Error);
      throw error;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (!this.config.heartbeatInterval) {
      return;
    }

    this.heartbeatTimer = setInterval(async () => {
      if (!this.shouldReconnect || !this.isConnected()) {
        return;
      }

      try {
        // NOOP 命令保持连接活跃
        await new Promise<void>((resolve, reject) => {
          this.imap.status("INBOX", (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        console.debug("[imap-connector] 心跳保活成功");
      } catch (err) {
        console.warn("[imap-connector] 心跳保活失败，尝试重连:", err);
        this.handleReconnect();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (!this.shouldReconnect) {
      return;
    }

    const maxAttempts = this.config.maxReconnectAttempts ?? 5;
    if (this.reconnectAttempts >= maxAttempts) {
      console.error(
        `[imap-connector] 重连次数已达上限 (${maxAttempts})，停止重连`
      );
      this.emit(
        "reconnectFailed",
        new EmailServiceError(
          EmailServiceErrorCode.SERVICE_UNAVAILABLE,
          `IMAP 重连失败，已达最大重试次数 ${maxAttempts}`
        )
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay ?? 5000;

    console.log(
      `[imap-connector] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      this.imap = this.createImapInstance();
      this.setupEventHandlers();
      await this.connect();
      await this.authenticate();
      console.log("[imap-connector] 重连成功");
      this.emit("reconnected");
    } catch (err) {
      console.error("[imap-connector] 重连失败:", err);
      this.emit("reconnectError", this.mapError(err as Error));
      if (this.reconnectAttempts < maxAttempts) {
        await this.handleReconnect();
      }
    }
  }

  private buildSearchCriteria(
    criteria: EmailSearchCriteria
  ): ImapSearchCriteria {
    const criteria_list: ImapSearchCriteria[] = [];

    if (criteria.since) {
      criteria_list.push(["SINCE", criteria.since]);
    }
    if (criteria.before) {
      criteria_list.push(["BEFORE", criteria.before]);
    }
    if (criteria.from) {
      criteria_list.push(["FROM", criteria.from]);
    }
    if (criteria.to) {
      criteria_list.push(["TO", criteria.to]);
    }
    if (criteria.subject) {
      criteria_list.push(["SUBJECT", criteria.subject]);
    }
    if (criteria.unread) {
      criteria_list.push(["UNSEEN"]);
    }
    if (criteria.withAttachments) {
      criteria_list.push(["HAS_ATTACHMENT"]);
    }

    return criteria_list.length > 0
      ? (criteria_list as ImapSearchCriteria)
      : ["ALL"];
  }

  private imapSearch(
    criteria: ImapSearchCriteria
  ): Promise<Array<{ uid: number; id: string }>> {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        if (!results || results.length === 0) {
          resolve([]);
          return;
        }

        resolve(results.map((id) => ({ uid: id, id: String(id) })));
      });
    });
  }

  private async parseWithMailparser(
    bodyBuffer: Buffer,
    headerBuffer?: Buffer
  ): Promise<ParsedMail> {
    // 合并 header 和 body
    let fullBuffer: Buffer;
    if (headerBuffer) {
      fullBuffer = Buffer.concat([headerBuffer, Buffer.from("\r\n\r\n"), bodyBuffer]);
    } else {
      fullBuffer = bodyBuffer;
    }

    // simpleParser 接受 Buffer 或 ReadableStream
    return simpleParser(fullBuffer as Buffer);
  }

  private convertParsedMail(
    parsed: ParsedMail,
    attributes: Imap.ImapMessageAttributes | null,
    folder: string
  ): Partial<EmailMessage> {
    // 提取正文
    const body: EmailBody = {};
    if (parsed.text) {
      body.text = parsed.text;
      body.textFromHtml = false;
    }
    if (parsed.html) {
      body.html = parsed.html;
    }

    // 提取附件
    const attachments: EmailAttachment[] = (parsed.attachments ?? []).map(
      (att: ParsedMail["attachments"][number], index: number) => {
        const contentType = att.contentType ?? "application/octet-stream";
        const dispHeader = att.headers.get("content-disposition");
        const dispositionStr = typeof dispHeader === "string" ? dispHeader : "";
        const isCalendarInvite =
          contentType === "text/calendar" ||
          (att.filename?.toLowerCase().endsWith(".ics") ?? false) ||
          detectIcsContent(
            att.content instanceof Buffer
              ? att.content.toString("utf-8")
              : ""
          );

        return {
          id: `att-${index}-${Date.now()}`,
          filename: att.filename ?? "unknown",
          contentType,
          size: att.size ?? 0,
          inline: dispositionStr.includes("inline"),
          cid: undefined,
          disposition: dispositionStr || undefined,
          isCalendarInvite,
        };
      }
    );

    // 从 IMAP attributes 提取 flags
    const flags = attributes?.flags ?? [];
    const seen = flags.includes("\\Seen");
    const draft = flags.includes("\\Draft");
    const answered = flags.includes("\\Answered");
    const forwarded = flags.includes("$Forwarded");

    // 提取 message-id
    const messageId = parsed.messageId?.replace(/^<|>$/g, "");

    // 提取地址（统一使用 helper 方法）
    const from = this.extractEmailAddress(parsed.from);
    const to = this.extractEmailAddressList(parsed.to);
    const cc = this.extractEmailAddressList(parsed.cc);
    const bcc = this.extractEmailAddressList(parsed.bcc);

    return {
      uid: attributes?.uid ?? 0,
      messageId,
      threadId: parsed.inReplyTo?.replace(/^<|>$/g, "") ?? undefined,
      subject: parsed.subject ?? undefined,
      from,
      to,
      cc,
      bcc,
      date: parsed.date ?? new Date(),
      body,
      attachments,
      seen,
      draft,
      answered,
      forwarded,
      hasAttachments: attachments.length > 0,
      size: attributes?.size ?? 0,
      folder,
      parsedAt: new Date().toISOString(),
    };
  }

  /**
   * 从 AddressObject 中提取 EmailAddress
   */
  private extractEmailAddress(
    addr: ParsedMail["from"]
  ): EmailAddress | undefined {
    if (!addr) return undefined;
    if (Array.isArray(addr)) {
      const first = addr[0];
      return first ? { name: first.name || undefined, address: first.address || "" } : undefined;
    }
    const first = addr.value?.[0];
    return first ? { name: first.name || undefined, address: first.address || "" } : undefined;
  }

  /**
   * 从 AddressObject 中提取 EmailAddress 列表
   */
  private extractEmailAddressList(
    addr: ParsedMail["to"]
  ): EmailAddress[] {
    if (!addr) return [];
    if (Array.isArray(addr)) {
      return addr
        .map((a) => a.value?.[0])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({ name: a.name || undefined, address: a.address || "" }))
        .filter((a) => !!a.address);
    }
    return (addr.value ?? [])
      .map((a) => ({ name: a.name || undefined, address: a.address || "" }))
      .filter((a) => !!a.address);
  }

  private extractIcsFromParsed(
    parsed: ParsedMail,
    uid?: number
  ): IcsEvent[] {
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return [];
    }

    const events: IcsEvent[] = [];

    for (const attachment of parsed.attachments) {
      const contentType = attachment.contentType ?? "";
      const filename = attachment.filename ?? "";

      if (
        contentType === "text/calendar" ||
        filename.toLowerCase().endsWith(".ics")
      ) {
        try {
          const icsContent = attachment.content?.toString("utf-8") ?? "";
          const parsedEvents = parseIcsContent(icsContent, uid, parsed.messageId);
          events.push(...parsedEvents);
        } catch (err) {
          console.warn("[imap-connector] 解析 ICS 附件失败:", err);
        }
      }
    }

    return events;
  }

  private flattenBoxes(
    boxes: Record<string, Imap.Folder>,
    prefix: string,
    result: ImapFolder[]
  ): void {
    for (const [name, box] of Object.entries(boxes)) {
      const path = prefix ? `${prefix}${box.delimiter || "/"}${name}` : name;
      result.push({
        name,
        path,
        delimiter: box.delimiter || "/",
      });

      if (box.children) {
        this.flattenBoxes(box.children, path, result);
      }
    }
  }

  private mapError(err: Error): EmailServiceError {
    const message = err.message ?? String(err);

    if (message.includes("Unsafe Login")) {
      return new EmailServiceError(
        EmailServiceErrorCode.AUTH_INVALID_CREDENTIALS,
        "邮箱服务拒绝当前客户端登录：请确认已开启 IMAP、使用客户端授权码；若为 188.com 邮箱，还需要服务器允许带 ID 标识的第三方客户端访问",
        err
      );
    }

    if (
      message.includes("Authentication failed") ||
      message.includes("AUTHENTICATIONFAILED") ||
      message.includes("Invalid credentials")
    ) {
      return new EmailServiceError(
        EmailServiceErrorCode.AUTH_INVALID_CREDENTIALS,
        "邮箱认证失败：用户名或密码错误，请检查应用专用密码是否正确",
        err
      );
    }

    if (message.includes("ETIMEDOUT") || message.includes("timed out")) {
      return new EmailServiceError(
        EmailServiceErrorCode.CONNECTION_TIMEOUT,
        `IMAP 连接超时，服务器: ${this.config.host}:${this.config.port}，请检查网络或服务器地址`,
        err
      );
    }

    if (message.includes("ECONNREFUSED")) {
      return new EmailServiceError(
        EmailServiceErrorCode.CONNECTION_REFUSED,
        `IMAP 连接被拒绝，服务器: ${this.config.host}:${this.config.port}，请检查端口和服务器地址是否正确`,
        err
      );
    }

    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return new EmailServiceError(
        EmailServiceErrorCode.CONNECTION_FAILED,
        `IMAP 服务器地址无效: ${this.config.host}，请检查服务器地址是否正确`,
        err
      );
    }

    if (message.includes("Too many simultaneous connections")) {
      return new EmailServiceError(
        EmailServiceErrorCode.SERVICE_UNAVAILABLE,
        "IMAP 同时连接数过多，请减少连接数或稍后再试",
        err
      );
    }

    if (message.includes("EOF")) {
      return new EmailServiceError(
        EmailServiceErrorCode.SERVICE_UNAVAILABLE,
        "IMAP 服务器连接意外断开，请检查网络或服务器状态",
        err
      );
    }

    return new EmailServiceError(
      EmailServiceErrorCode.UNKNOWN,
      `IMAP 错误: ${message}`,
      err
    );
  }
}

// ==================== 辅助函数 ====================

/**
 * 创建 IMAP 连接器实例
 */
export function createImapConnector(config: ImapConnectorConfig): ImapConnector {
  return new ImapConnector(config);
}

/**
 * 测试 IMAP 连接
 */
export async function testImapConnection(
  config: ImapConnectorConfig
): Promise<{ success: boolean; error?: string; folders?: ImapFolder[] }> {
  const connector = new ImapConnector(config);

  try {
    await connector.connect();
    await connector.authenticate();
    const folders = await connector.listFolders();
    await connector.disconnect();
    return { success: true, folders };
  } catch (err) {
    const errorMsg =
      err instanceof EmailServiceError
        ? err.message
        : err instanceof Error
        ? err.message
        : String(err);
    return { success: false, error: errorMsg };
  }
}
