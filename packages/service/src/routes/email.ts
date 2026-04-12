/**
 * 邮箱账号管理 API 路由
 * 管理邮箱账号配置（存储在 config/mail-accounts.json）
 * 密码使用 Base64 简单混淆存储（不可逆，但不等于明文）
 */

import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { ImapConnector } from "../services/email/imap-connector.js";
import type { EmailAccount, ImapConnectorConfig, ImapFolder } from "../services/email/models/email.js";

const router: Router = Router();

// ==================== 类型定义 ====================

/** 存储格式（密码用 Base64 混淆） */
export interface StoredAccount {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  passwordObfuscated: string; // Base64 混淆后的密码
  secure: boolean;
  displayName?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface MailAccountsFile {
  version: string;
  accounts: StoredAccount[];
}

/** API 返回格式（不含密码） */
export interface AccountResponse {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  secure: boolean;
  displayName?: string;
  lastSyncedAt?: string;
  createdAt: string;
  connected: boolean; // 基于上次同步状态判断
}

export interface EmailSummary {
  uid: number;
  subject?: string;
  from?: { name?: string; address: string };
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  snippet: string;
}

// ==================== 工具函数 ====================

const CONFIG_PATH = path.join(process.cwd(), "config", "mail-accounts.json");

/** Base64 混淆密码（简单 obfuscation，非真正加密） */
function obfuscatePassword(password: string): string {
  return Buffer.from(password).toString("base64");
}

/** 反向 Base64 解码密码 */
function deobfuscatePassword(obfuscated: string): string {
  try {
    return Buffer.from(obfuscated, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** 生成 UUID 风格的 ID */
function generateAccountId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 确保配置文件存在 */
async function ensureConfigFile(): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify({ version: "1.0", accounts: [] }, null, 2), "utf-8");
  }
}

/** 读取配置文件 */
async function readConfig(): Promise<MailAccountsFile> {
  await ensureConfigFile();
  const content = await fs.promises.readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(content) as MailAccountsFile;
}

/** 写入配置文件 */
async function writeConfig(config: MailAccountsFile): Promise<void> {
  await ensureConfigFile();
  await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** 转换为 API 响应格式 */
function toAccountResponse(acc: StoredAccount): AccountResponse {
  return {
    id: acc.id,
    email: acc.email,
    imapHost: acc.imapHost,
    imapPort: acc.imapPort,
    username: acc.username,
    secure: acc.secure,
    displayName: acc.displayName,
    lastSyncedAt: acc.lastSyncedAt,
    createdAt: acc.createdAt,
    connected: !!acc.lastSyncedAt, // 简单判断：有过同步记录即为"已连接"
  };
}

// ==================== API 路由 ====================

/**
 * GET /api/email/accounts
 * 获取所有已配置账号（密码不返回）
 */
router.get("/accounts", async (_req, res) => {
  try {
    const config = await readConfig();
    const accounts = config.accounts.map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] GET error:", err);
    res.status(500).json({ error: "Failed to read accounts", message: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/email/accounts
 * 新增邮箱账号
 */
router.post("/accounts", async (req, res) => {
  try {
    const { email, imapHost, imapPort, username, password, secure, displayName } = req.body;

    if (!email || !imapHost || !imapPort || !password) {
      return res.status(400).json({ error: "Missing required fields: email, imapHost, imapPort, password" });
    }

    const config = await readConfig();

    // 检查重复邮箱
    if (config.accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: "Account with this email already exists" });
    }

    const newAccount: StoredAccount = {
      id: generateAccountId(),
      email: email.trim().toLowerCase(),
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort) || 993,
      username: (username || email).trim(),
      passwordObfuscated: obfuscatePassword(password),
      secure: secure !== false,
      displayName: displayName?.trim() || email,
      createdAt: new Date().toISOString(),
    };

    config.accounts.push(newAccount);
    await writeConfig(config);

    console.log(`[email/accounts] Added account: ${newAccount.email} (${newAccount.id})`);
    const accounts = config.accounts.map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] POST error:", err);
    res.status(500).json({ error: "Failed to add account", message: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * DELETE /api/email/accounts/:id
 * 删除账号
 */
router.delete("/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const config = await readConfig();
    const idx = config.accounts.findIndex((a) => a.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: "Account not found" });
    }

    const removed = config.accounts.splice(idx, 1)[0];
    await writeConfig(config);

    console.log(`[email/accounts] Deleted account: ${removed.email} (${removed.id})`);
    const accounts = config.accounts.map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] DELETE error:", err);
    res.status(500).json({ error: "Failed to delete account", message: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/email/accounts/test
 * 测试 IMAP 连接
 */
router.post("/accounts/test", async (req, res) => {
  try {
    const { email, imapHost, imapPort, username, password, secure } = req.body;

    if (!email || !imapHost || !imapPort || !password) {
      return res.status(400).json({ error: "Missing required fields: email, imapHost, imapPort, password" });
    }

    const config: ImapConnectorConfig = {
      host: imapHost.trim(),
      port: Number(imapPort) || 993,
      user: (username || email).trim(),
      password,
      secure: secure !== false,
      connectionTimeout: 15000,
    };

    const connector = new ImapConnector(config);

    try {
      await connector.connect();
      await connector.authenticate();

      // 尝试列出文件夹
      const boxes = await connector.listFolders();

      await connector.disconnect();

      res.json({
        success: true,
        data: {
          connected: true,
          folders: boxes.slice(0, 20), // 最多返回 20 个文件夹
        },
      });
    } catch (imapErr) {
      await connector.disconnect().catch(() => {});
      const errorMsg = imapErr instanceof Error ? imapErr.message : String(imapErr);
      console.error(`[email/accounts/test] Connection failed for ${email}:`, errorMsg);
      res.json({
        success: false,
        data: {
          connected: false,
          error: errorMsg,
        },
      });
    }
  } catch (err) {
    console.error("[email/accounts/test] Unexpected error:", err);
    res.status(500).json({ error: "Test connection failed", message: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/email/accounts/sync
 * 手动触发同步，返回邮件摘要列表
 */
router.post("/accounts/sync", async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: "Missing required field: accountId" });
    }

    const config = await readConfig();
    const account = config.accounts.find((a) => a.id === accountId);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // 构建连接配置
    const connectorConfig: ImapConnectorConfig = {
      host: account.imapHost,
      port: account.imapPort,
      user: account.username,
      password: deobfuscatePassword(account.passwordObfuscated),
      secure: account.secure,
      connectionTimeout: 30000,
      heartbeatInterval: 300000,
      maxReconnectAttempts: 3,
      reconnectDelay: 5000,
    };

    // 创建临时 MailAccountManager（只用于创建 EmailSyncService）
    // 我们需要创建一个符合 EmailAccount 格式的对象
    const emailAccount: EmailAccount = {
      id: account.id,
      email: account.email,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      username: account.username,
      passwordEnvKey: "", // 不使用 env key
      secure: account.secure,
      displayName: account.displayName,
      lastSyncedAt: account.lastSyncedAt,
      createdAt: account.createdAt,
    };

    // 由于 EmailSyncService 依赖 MailAccountManager.getConnectorConfig 来获取密码
    // 我们需要用另一种方式：直接创建 connector 并做同步
    // 这里直接使用 ImapConnector 进行简单同步

    const connector = new ImapConnector(connectorConfig);

    try {
      await connector.connect();
      await connector.authenticate();

      // 搜索最新 20 封邮件
      const searchResults = await connector.searchEmails({
        folder: "INBOX",
        limit: 20,
      });

      // 获取这些邮件的摘要
      const uids = searchResults.map((r) => r.uid);
      const emails = await connector.fetchEmails(uids, "INBOX");

      const summaries: EmailSummary[] = emails.map((email) => ({
        uid: email.uid,
        subject: email.subject,
        from: email.from,
        date: email.date.toISOString(),
        seen: email.seen,
        hasAttachments: email.hasAttachments,
        snippet: (email.body.text || "").slice(0, 100).replace(/\n/g, " ").trim(),
      }));

      await connector.disconnect();

      // 更新最后同步时间
      account.lastSyncedAt = new Date().toISOString();
      await writeConfig(config);

      res.json({
        success: true,
        data: {
          accountId,
          totalEmails: searchResults.length,
          messages: summaries,
          lastSyncedAt: account.lastSyncedAt,
        },
      });
    } catch (syncErr) {
      await connector.disconnect().catch(() => {});
      throw syncErr;
    }
  } catch (err) {
    console.error("[email/accounts/sync] Sync error:", err);
    res.status(500).json({ error: "Sync failed", message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
