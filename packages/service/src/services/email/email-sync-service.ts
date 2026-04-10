/**
 * 邮件同步服务
 * 实现全量同步和增量同步逻辑
 * 记录 lastSyncedAt 时间戳，支持按需拉取邮件正文
 */

import {
  EmailAccount,
  EmailMessage,
  EmailSearchCriteria,
  SyncStats,
  EmailServiceError,
  EmailServiceErrorCode,
  ImapFolder,
} from "./models/email.js";
import { ImapConnector, testImapConnection, ConnectionState } from "./imap-connector.js";
import { EmailParser, EmailParserOptions } from "./email-parser.js";
import { MailAccountManager } from "./mail-account.js";
import * as fs from "fs";
import * as path from "path";

// ==================== 同步选项 ====================

export interface EmailSyncOptions {
  /**
   * 同步类型
   * - full: 全量同步，拉取所有邮件
   * - incremental: 增量同步，只拉取新邮件
   */
  type: "full" | "incremental";
  /**
   * 增量同步时，只拉取多少天内的邮件
   * @default 7
   */
  incrementalDays?: number;
  /**
   * 增量同步时，是否只拉取未读邮件
   * @default false
   */
  incrementalUnreadOnly?: boolean;
  /**
   * 每次同步最多拉取的邮件数量（避免单次同步过多）
   * @default 100
   */
  maxMessagesPerSync?: number;
  /**
   * 是否在同步后保存状态
   * @default true
   */
  persistState?: boolean;
  /**
   * 邮件解析器选项
   */
  parserOptions?: EmailParserOptions;
}

export interface EmailSyncResult {
  accountId: string;
  stats: SyncStats;
  messages: EmailMessage[];
  /** 增量同步时的新邮件 UID 列表 */
  newUids?: number[];
  /** 增量同步时的已存在 UID 列表（跳过） */
  existingUids?: number[];
}

// ==================== 同步服务 ====================

/**
 * 邮件同步服务
 * 负责管理单个或多个邮箱账户的邮件同步
 */
export class EmailSyncService {
  private accountManager: MailAccountManager;
  private connectors: Map<string, ImapConnector> = new Map();
  private emailParser: EmailParser;
  private stateDir: string;

  constructor(accountManager: MailAccountManager, parserOptions?: EmailParserOptions) {
    this.accountManager = accountManager;
    this.emailParser = new EmailParser(parserOptions ?? {});
    this.stateDir = path.join(process.cwd(), ".email-sync-state");

    // 确保状态目录存在
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  // ==================== 同步操作 ====================

  /**
   * 同步指定账户
   */
  async syncAccount(
    accountId: string,
    options: EmailSyncOptions
  ): Promise<EmailSyncResult> {
    const account = this.accountManager.getAccount(accountId);
    if (!account) {
      throw new EmailServiceError(
        EmailServiceErrorCode.UNKNOWN,
        `账户 ${accountId} 不存在`
      );
    }

    const stats: SyncStats = {
      accountId,
      type: options.type,
      startedAt: new Date().toISOString(),
      totalFetched: 0,
      newMessages: 0,
      updatedMessages: 0,
      parseErrors: 0,
      icsEventsFound: 0,
    };

    let connector: ImapConnector | null = null;

    try {
      // 获取或创建连接器
      connector = this.getOrCreateConnector(accountId);
      await connector.connect();
      await connector.authenticate();

      // 构建搜索条件
      const searchCriteria = this.buildSearchCriteria(account, options);

      // 搜索邮件
      const searchResults = await connector.searchEmails(searchCriteria);
      let uids = searchResults.map((r) => r.uid);

      // 限制数量
      const maxMessages = options.maxMessagesPerSync ?? 100;
      if (uids.length > maxMessages) {
        // 按时间排序，取最新的
        uids = uids.slice(-maxMessages);
      }

      // 增量同步时，过滤掉已同步的邮件
      let newUids: number[] = [];
      let existingUids: number[] = [];

      if (options.type === "incremental") {
        const syncedUids = await this.loadSyncedUids(accountId);
        newUids = uids.filter((uid) => !syncedUids.has(uid));
        existingUids = uids.filter((uid) => syncedUids.has(uid));

        console.log(
          `[email-sync] ${account.email}: 找到 ${uids.length} 封邮件，` +
            `其中 ${newUids.length} 封新邮件，${existingUids.length} 封已存在`
        );

        stats.totalFetched = uids.length;
        stats.newMessages = newUids.length;

        // 只拉取新邮件的正文
        uids = newUids;
      } else {
        stats.totalFetched = uids.length;
        stats.newMessages = uids.length;
      }

      // 批量获取邮件内容
      const messages: EmailMessage[] = [];
      for (const uid of uids) {
        try {
          const email = await connector.fetchEmail(uid, searchCriteria.folder ?? "INBOX");
          messages.push(email);
        } catch (fetchErr) {
          console.error(`[email-sync] 获取邮件 ${uid} 失败:`, fetchErr);
          stats.parseErrors++;
        }
      }

      // 统计 ICS 事件
      for (const msg of messages) {
        if (msg.icsEvents && msg.icsEvents.length > 0) {
          stats.icsEventsFound += msg.icsEvents.length;
        }
      }

      stats.completedAt = new Date().toISOString();

      // 保存同步状态
      if (options.persistState !== false && options.type === "incremental") {
        await this.saveSyncedUids(accountId, new Set([...existingUids, ...newUids]));
        this.accountManager.updateLastSyncedAt(accountId);
        await this.accountManager.saveToFile();
      }

      return {
        accountId,
        stats,
        messages,
        newUids: options.type === "incremental" ? newUids : undefined,
        existingUids: options.type === "incremental" ? existingUids : undefined,
      };
    } catch (err) {
      stats.error =
        err instanceof Error ? err.message : String(err);
      stats.completedAt = new Date().toISOString();

      throw err;
    } finally {
      // 不关闭连接，保持连接池复用
    }
  }

  /**
   * 同步所有已配置的账户
   */
  async syncAllAccounts(options: EmailSyncOptions): Promise<EmailSyncResult[]> {
    const accounts = this.accountManager.getAccounts();
    const results: EmailSyncResult[] = [];

    for (const account of accounts) {
      try {
        console.log(`[email-sync] 开始同步账户: ${account.email}`);
        const result = await this.syncAccount(account.id, options);
        results.push(result);
        console.log(
          `[email-sync] 账户 ${account.email} 同步完成: ` +
            `${result.stats.newMessages} 封新邮件，${result.stats.parseErrors} 封解析失败`
        );
      } catch (err) {
        console.error(`[email-sync] 账户 ${account.email} 同步失败:`, err);
        // 继续同步其他账户
        results.push({
          accountId: account.id,
          stats: {
            accountId: account.id,
            type: options.type,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            totalFetched: 0,
            newMessages: 0,
            updatedMessages: 0,
            parseErrors: 0,
            icsEventsFound: 0,
            error: err instanceof Error ? err.message : String(err),
          },
          messages: [],
        });
      }
    }

    return results;
  }

  /**
   * 按需同步单封邮件（获取正文）
   * 用于用户在邮件列表中点击某封邮件时，按需加载完整内容
   */
  async syncEmail(
    accountId: string,
    uid: number,
    folder = "INBOX"
  ): Promise<EmailMessage> {
    const connector = this.getOrCreateConnector(accountId);
    await connector.connect();
    await connector.authenticate();

    const email = await connector.fetchEmail(uid, folder);
    return email;
  }

  /**
   * 获取邮件同步状态
   */
  getAccountStatus(accountId: string): {
    accountId: string;
    connected: boolean;
    lastSyncedAt?: string;
    state: ConnectionState | null;
  } {
    const connector = this.connectors.get(accountId);
    const account = this.accountManager.getAccount(accountId);

    return {
      accountId,
      connected: connector?.isConnected() ?? false,
      lastSyncedAt: account?.lastSyncedAt,
      state: connector?.getState() ?? null,
    };
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connectors.entries()).map(
      async ([id, connector]) => {
        try {
          await connector.disconnect();
        } catch (err) {
          console.warn(`[email-sync] 断开连接 ${id} 失败:`, err);
        }
      }
    );

    await Promise.all(disconnectPromises);
    this.connectors.clear();
  }

  // ==================== 内部方法 ====================

  private getOrCreateConnector(accountId: string): ImapConnector {
    let connector = this.connectors.get(accountId);

    if (!connector) {
      const config = this.accountManager.getConnectorConfig(accountId);
      connector = new ImapConnector(config);
      this.connectors.set(accountId, connector);
    }

    return connector;
  }

  private buildSearchCriteria(
    account: EmailAccount,
    options: EmailSyncOptions
  ): EmailSearchCriteria {
    const criteria: EmailSearchCriteria = {
      folder: "INBOX",
      limit: options.maxMessagesPerSync,
    };

    if (options.type === "incremental") {
      const days = options.incrementalDays ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      criteria.since = since;

      if (options.incrementalUnreadOnly) {
        criteria.unread = true;
      }
    }

    // 如果有上次同步时间，增量同步从上次时间点开始
    if (options.type === "incremental" && account.lastSyncedAt) {
      criteria.since = new Date(account.lastSyncedAt);
    }

    return criteria;
  }

  private getStateFilePath(accountId: string): string {
    // 简单 hash 处理，避免文件名问题
    const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.stateDir, `synced-uids-${safeId}.json`);
  }

  private async loadSyncedUids(accountId: string): Promise<Set<number>> {
    const filePath = this.getStateFilePath(accountId);

    if (!fs.existsSync(filePath)) {
      return new Set();
    }

    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      return new Set(data.uids as number[]);
    } catch (err) {
      console.warn(`[email-sync] 加载同步状态失败 ${accountId}:`, err);
      return new Set();
    }
  }

  private async saveSyncedUids(
    accountId: string,
    uids: Set<number>
  ): Promise<void> {
    const filePath = this.getStateFilePath(accountId);

    try {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({
          accountId,
          updatedAt: new Date().toISOString(),
          uids: Array.from(uids),
        }),
        "utf-8"
      );
    } catch (err) {
      console.error(`[email-sync] 保存同步状态失败 ${accountId}:`, err);
    }
  }
}

// ==================== 辅助函数 ====================

/**
 * 创建邮件同步服务
 */
export function createEmailSyncService(
  accountManager: MailAccountManager,
  parserOptions?: EmailParserOptions
): EmailSyncService {
  return new EmailSyncService(accountManager, parserOptions);
}

/**
 * 测试账户连接
 */
export async function testAccountConnection(
  accountManager: MailAccountManager,
  accountId: string
): Promise<{ success: boolean; error?: string; folders?: ImapFolder[] }> {
  try {
    const config = accountManager.getConnectorConfig(accountId);
    const result = await testImapConnection(config);
    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
