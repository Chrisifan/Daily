/**
 * 邮箱账户配置管理
 * 管理多个邮箱账户的配置加载、保存和账户数据访问
 */

import * as fs from "fs";
import * as path from "path";
import {
  EmailAccount,
  MailAccountConfigOptions,
  ImapConnectorConfig,
  EmailServiceError,
  EmailServiceErrorCode,
} from "./models/email.js";

// ==================== 类型定义 ====================

/**
 * 配置文件格式（不含真实密码）
 */
export interface MailAccountsConfigFile {
  version: string;
  accounts: Array<Omit<EmailAccount, "passwordEnvKey"> & { passwordEnvKey: string }>;
}

/**
 * 账户管理器选项
 */
export interface MailAccountManagerOptions {
  /** 配置文件路径 */
  configPath: string;
  /** 密码环境变量前缀 */
  passwordEnvPrefix?: string;
  /** 是否自动加载 */
  autoLoad?: boolean;
}

// ==================== 账户管理器 ====================

/**
 * 邮箱账户管理器
 * 负责从配置文件加载账户，并从环境变量中获取密码
 */
export class MailAccountManager {
  private configPath: string;
  private passwordEnvPrefix: string;
  private accounts: Map<string, EmailAccount> = new Map();
  private loaded = false;

  constructor(options: MailAccountManagerOptions) {
    this.configPath = options.configPath;
    this.passwordEnvPrefix = options.passwordEnvPrefix ?? "MAIL_";
    if (options.autoLoad !== false) {
      this.loadFromFile().catch((err) => {
        console.warn("[mail-account] 自动加载账户配置失败:", err);
      });
    }
  }

  // ==================== 配置加载 ====================

  /**
   * 从配置文件加载账户列表
   */
  async loadFromFile(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      console.warn(`[mail-account] 配置文件不存在: ${this.configPath}`);
      return;
    }

    try {
      const content = await fs.promises.readFile(this.configPath, "utf-8");
      const config: MailAccountsConfigFile = JSON.parse(content);

      if (!config.accounts || !Array.isArray(config.accounts)) {
        throw new Error("配置文件格式错误：缺少 accounts 字段");
      }

      this.accounts.clear();
      for (const account of config.accounts) {
        if (!account.id || !account.email || !account.imapHost) {
          console.warn("[mail-account] 跳过无效账户配置:", account.email);
          continue;
        }

        // 设置默认值
        const normalized: EmailAccount = {
          id: account.id,
          email: account.email,
          imapHost: account.imapHost,
          imapPort: account.imapPort ?? 993,
          username: account.username ?? account.email,
          passwordEnvKey: account.passwordEnvKey,
          secure: account.secure ?? true,
          displayName: account.displayName,
          lastSyncedAt: account.lastSyncedAt,
          createdAt: account.createdAt ?? new Date().toISOString(),
        };

        this.accounts.set(normalized.id, normalized);
      }

      this.loaded = true;
      console.log(`[mail-account] 已加载 ${this.accounts.size} 个账户配置`);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(String(err));
      throw new EmailServiceError(
        EmailServiceErrorCode.UNKNOWN,
        `加载账户配置失败: ${error.message}`,
        error
      );
    }
  }

  /**
   * 重新加载配置文件
   */
  async reload(): Promise<void> {
    await this.loadFromFile();
  }

  /**
   * 保存账户列表到配置文件（仅保存非敏感信息）
   */
  async saveToFile(): Promise<void> {
    const config: MailAccountsConfigFile = {
      version: "1.0",
      accounts: Array.from(this.accounts.values()).map((acc) => ({
        ...acc,
        // passwordEnvKey 会被保存，但实际密码值不保存
      })),
    };

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(
      this.configPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );

    console.log(`[mail-account] 已保存 ${this.accounts.size} 个账户配置到 ${this.configPath}`);
  }

  // ==================== 账户管理 ====================

  /**
   * 添加账户（配置，不含密码）
   */
  addAccount(account: Omit<EmailAccount, "createdAt">): void {
    if (this.accounts.has(account.id)) {
      throw new EmailServiceError(
        EmailServiceErrorCode.UNKNOWN,
        `账户 ${account.id} 已存在，请使用 updateAccount 更新`
      );
    }

    const normalized: EmailAccount = {
      ...account,
      createdAt: new Date().toISOString(),
    };

    this.accounts.set(account.id, normalized);
    console.log(`[mail-account] 已添加账户: ${account.email} (${account.id})`);
  }

  /**
   * 更新账户配置
   */
  updateAccount(id: string, updates: Partial<Omit<EmailAccount, "id" | "createdAt">>): void {
    const existing = this.accounts.get(id);
    if (!existing) {
      throw new EmailServiceError(
        EmailServiceErrorCode.UNKNOWN,
        `账户 ${id} 不存在`
      );
    }

    const updated: EmailAccount = {
      ...existing,
      ...updates,
      id: existing.id, // 不允许修改 ID
      createdAt: existing.createdAt, // 不允许修改创建时间
    };

    this.accounts.set(id, updated);
    console.log(`[mail-account] 已更新账户: ${updated.email} (${id})`);
  }

  /**
   * 删除账户
   */
  removeAccount(id: string): void {
    const account = this.accounts.get(id);
    if (!account) {
      return; // 不存在的账户直接忽略
    }

    this.accounts.delete(id);
    console.log(`[mail-account] 已删除账户: ${account.email} (${id})`);
  }

  /**
   * 获取所有账户列表
   */
  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * 根据 ID 获取账户
   */
  getAccount(id: string): EmailAccount | undefined {
    return this.accounts.get(id);
  }

  /**
   * 根据邮箱地址获取账户
   */
  getAccountByEmail(email: string): EmailAccount | undefined {
    return Array.from(this.accounts.values()).find(
      (acc) => acc.email.toLowerCase() === email.toLowerCase()
    );
  }

  /**
   * 更新账户的最后同步时间
   */
  updateLastSyncedAt(id: string, timestamp?: string): void {
    const account = this.accounts.get(id);
    if (account) {
      account.lastSyncedAt = timestamp ?? new Date().toISOString();
      this.accounts.set(id, account);
    }
  }

  // ==================== 密码获取 ====================

  /**
   * 获取账户的 IMAP 连接配置（包含从环境变量读取的密码）
   */
  getConnectorConfig(id: string): ImapConnectorConfig {
    const account = this.accounts.get(id);
    if (!account) {
      throw new EmailServiceError(
        EmailServiceErrorCode.UNKNOWN,
        `账户 ${id} 不存在`
      );
    }

    const password = this.resolvePassword(account.passwordEnvKey);
    if (!password) {
      throw new EmailServiceError(
        EmailServiceErrorCode.AUTH_FAILED,
        `未找到账户 ${account.email} 的密码，环境变量 ${account.passwordEnvKey} 未设置`
      );
    }

    return {
      host: account.imapHost,
      port: account.imapPort,
      user: account.username,
      password,
      secure: account.secure,
      connectionTimeout: 30000,
      heartbeatInterval: 300000,
      maxReconnectAttempts: 5,
      reconnectDelay: 5000,
    };
  }

  /**
   * 根据环境变量键解析密码
   */
  private resolvePassword(envKey: string): string | undefined {
    // 优先查找完整键名
    const password = process.env[envKey];
    if (password) {
      return password;
    }

    // 尝试加上前缀
    const prefixedKey = `${this.passwordEnvPrefix}${envKey}`;
    return process.env[prefixedKey];
  }

  // ==================== 状态 ====================

  /**
   * 检查是否已加载配置
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * 获取账户数量
   */
  getAccountCount(): number {
    return this.accounts.size;
  }
}

// ==================== 辅助函数 ====================

/**
 * 从环境变量创建账户管理器
 * 自动根据环境变量 MAIL_ACCOUNTS_CONFIG_PATH 确定配置路径
 */
export function createMailAccountManager(
  configPath?: string,
  options?: Partial<MailAccountManagerOptions>
): MailAccountManager {
  const finalConfigPath =
    configPath ??
    process.env.MAIL_ACCOUNTS_CONFIG_PATH ??
    path.join(process.cwd(), "config", "mail-accounts.json");

  return new MailAccountManager({
    configPath: finalConfigPath,
    passwordEnvPrefix: options?.passwordEnvPrefix ?? "MAIL_",
    autoLoad: options?.autoLoad ?? true,
  });
}

/**
 * 生成示例配置文件
 */
export function generateExampleConfig(): string {
  const example: MailAccountsConfigFile = {
    version: "1.0",
    accounts: [
      {
        id: "example-gmail",
        email: "your-email@gmail.com",
        imapHost: "imap.gmail.com",
        imapPort: 993,
        username: "your-email@gmail.com",
        // passwordEnvKey 为环境变量键名，密码本身不在此文件中存储
        passwordEnvKey: "MAIL_GMAIL_APP_PASSWORD",
        secure: true,
        displayName: "我的 Gmail",
        createdAt: new Date().toISOString(),
      },
      {
        id: "example-outlook",
        email: "your-email@outlook.com",
        imapHost: "outlook.office365.com",
        imapPort: 993,
        username: "your-email@outlook.com",
        passwordEnvKey: "MAIL_OUTLOOK_APP_PASSWORD",
        secure: true,
        displayName: "我的 Outlook",
        createdAt: new Date().toISOString(),
      },
      {
        id: "example-qq",
        email: "123456789@qq.com",
        imapHost: "imap.qq.com",
        imapPort: 993,
        username: "123456789@qq.com",
        passwordEnvKey: "MAIL_QQ_APP_PASSWORD",
        secure: true,
        displayName: "我的 QQ 邮箱",
        createdAt: new Date().toISOString(),
      },
    ],
  };

  return JSON.stringify(example, null, 2);
}
