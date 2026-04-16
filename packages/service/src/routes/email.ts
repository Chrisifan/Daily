/**
 * 邮箱账号管理 API 路由
 * 账户元数据存储在 app SQLite，IMAP 密码存储在系统安全存储中。
 */

import { Router } from "express";
import path from "node:path";
import { ImapConnector } from "../services/email/imap-connector.js";
import type { ImapConnectorConfig } from "../services/email/models/email.js";
import type { ExternalScheduleCandidate } from "../services/intake/external-schedule-candidate.js";
import {
  MailAccountStore,
  type MailAccountRecord,
} from "../services/email/mail-account-store.js";
import type { MailSecretStoreLike } from "../services/email/mail-secret-store.js";
import { migrateLegacyMailAccounts } from "../services/email/mail-account-migration.js";
import { MailWatchService } from "../services/email/mail-watch-service.js";
import type { MailWatchEvents } from "../services/email/mail-watch-events.js";

const LEGACY_CONFIG_PATH = path.join(process.cwd(), "config", "mail-accounts.json");

export interface AccountResponse {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  secure: boolean;
  displayName?: string;
  authStatus: MailAccountRecord["authStatus"];
  syncStatus: MailAccountRecord["syncStatus"];
  lastSyncedAt?: string;
  lastSyncError?: string;
  createdAt: string;
  connected: boolean;
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

export interface SyncAccountResponse {
  accountId: string;
  totalEmails: number;
  messages: EmailSummary[];
  candidates: ExternalScheduleCandidate[];
  lastSyncedAt: string;
}

export interface EmailRouteDependencies {
  mailAccountStore: MailAccountStore;
  mailSecretStore: Pick<MailSecretStoreLike, "getPassword" | "setPassword" | "deletePassword">;
  mailWatchService: MailWatchService;
  mailWatchEvents: MailWatchEvents;
  ensureMailAccountsReady: () => Promise<void>;
}

function normalizeDisplayName(displayName: string | undefined, email: string): string | undefined {
  const alias = displayName?.trim();
  if (!alias) {
    return undefined;
  }

  return alias.toLowerCase() === email.trim().toLowerCase() ? undefined : alias;
}

function generateAccountId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toAccountResponse(acc: MailAccountRecord): AccountResponse {
  return {
    id: acc.id,
    email: acc.emailAddress,
    imapHost: acc.imapHost,
    imapPort: acc.imapPort,
    username: acc.username,
    secure: acc.secure,
    displayName: normalizeDisplayName(acc.displayName, acc.emailAddress),
    authStatus: acc.authStatus,
    syncStatus: acc.syncStatus,
    lastSyncedAt: acc.lastSyncedAt ?? undefined,
    lastSyncError: acc.lastSyncError ?? undefined,
    createdAt: acc.createdAt,
    connected: acc.authStatus === "connected",
  };
}

function isAuthErrorMessage(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("auth") ||
    lowered.includes("login") ||
    lowered.includes("password") ||
    lowered.includes("credential") ||
    lowered.includes("unsafe login")
  );
}

async function ensureMailAccountsReady(): Promise<void> {
  throw new Error("ensureMailAccountsReady is injected at runtime");
}

export function createEnsureMailAccountsReady(deps: {
  configPath?: string;
  store: MailAccountStore;
  secretStore: Pick<MailSecretStoreLike, "setPassword" | "getPassword" | "deletePassword">;
}): () => Promise<void> {
  let mailAccountInitPromise: Promise<void> | null = null;

  return async function injectedEnsureMailAccountsReady(): Promise<void> {
    if (!mailAccountInitPromise) {
      mailAccountInitPromise = migrateLegacyMailAccounts({
        configPath: deps.configPath ?? LEGACY_CONFIG_PATH,
        store: deps.store,
        secretStore: deps.secretStore,
      }).then(() => undefined);
    }

    try {
      await mailAccountInitPromise;
    } catch (error) {
      mailAccountInitPromise = null;
      throw error;
    }
  };
}

export function createEmailRouter({
  mailAccountStore,
  mailSecretStore,
  mailWatchService,
  mailWatchEvents,
  ensureMailAccountsReady,
}: EmailRouteDependencies): Router {
  const router: Router = Router();

  router.get("/accounts", async (_req, res) => {
  try {
    await ensureMailAccountsReady();
    const accounts = mailAccountStore.listAccounts().map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] GET error:", err);
    res.status(500).json({ error: "Failed to read accounts", message: err instanceof Error ? err.message : String(err) });
  }
});

  router.get("/watch/status", async (_req, res) => {
    try {
      await ensureMailAccountsReady();
      res.json({ success: true, data: mailWatchService.getStatusSnapshot() });
    } catch (err) {
      console.error("[email/watch/status] GET error:", err);
      res.status(500).json({ error: "Failed to read watch status", message: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/watch/events", async (req, res) => {
    try {
      await ensureMailAccountsReady();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write(": connected\n\n");

      const unsubscribe = mailWatchEvents.subscribe((payload) => {
        res.write(payload);
      });

      req.on("close", unsubscribe);
    } catch (err) {
      console.error("[email/watch/events] GET error:", err);
      res.status(500).json({ error: "Failed to open watch events", message: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/accounts", async (req, res) => {
  try {
    await ensureMailAccountsReady();
    const { email, imapHost, imapPort, username, password, secure, displayName } = req.body;

    if (!email || !imapHost || !imapPort || !password) {
      return res.status(400).json({ error: "Missing required fields: email, imapHost, imapPort, password" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (mailAccountStore.getAccountByEmail(normalizedEmail)) {
      return res.status(409).json({ error: "Account with this email already exists" });
    }

    const now = new Date().toISOString();
    const id = generateAccountId();
    const accountRecord: MailAccountRecord = {
      id,
      provider: "imap",
      emailAddress: normalizedEmail,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort) || 993,
      username: (username || normalizedEmail).trim(),
      secure: secure !== false,
      displayName: normalizeDisplayName(displayName, normalizedEmail),
      authStatus: "disconnected",
      syncStatus: "idle",
      lastSyncedAt: null,
      lastSyncError: null,
      scopes: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await mailSecretStore.setPassword(id, password);
      mailAccountStore.upsertAccount(accountRecord);
    } catch (error) {
      await mailSecretStore.deletePassword(id).catch(() => undefined);
      throw error;
    }

    await mailWatchService.registerAccount(id);

    console.log(`[email/accounts] Added account: ${accountRecord.emailAddress} (${accountRecord.id})`);
    const accounts = mailAccountStore.listAccounts().map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] POST error:", err);
    res.status(500).json({ error: "Failed to add account", message: err instanceof Error ? err.message : String(err) });
  }
});

  router.delete("/accounts/:id", async (req, res) => {
  try {
    await ensureMailAccountsReady();
    const { id } = req.params;
    const account = mailAccountStore.getAccount(id);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    await mailSecretStore.deletePassword(id);
    mailAccountStore.deleteAccount(id);
    await mailWatchService.removeAccount(id);

    console.log(`[email/accounts] Deleted account: ${account.emailAddress} (${account.id})`);
    const accounts = mailAccountStore.listAccounts().map(toAccountResponse);
    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error("[email/accounts] DELETE error:", err);
    res.status(500).json({ error: "Failed to delete account", message: err instanceof Error ? err.message : String(err) });
  }
});

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

      const boxes = await connector.listFolders();

      await connector.disconnect();

      res.json({
        success: true,
        data: {
          connected: true,
          folders: boxes.slice(0, 20),
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

  router.post("/accounts/sync", async (req, res) => {
  try {
    await ensureMailAccountsReady();
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: "Missing required field: accountId" });
    }

    const account = mailAccountStore.getAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    const candidates = await mailWatchService.syncAccountNow(account.id);
    const refreshedAccount = mailAccountStore.getAccount(account.id);
    const syncedAt = refreshedAccount?.lastSyncedAt ?? new Date().toISOString();

    const response: SyncAccountResponse = {
      accountId,
      totalEmails: candidates.length,
      messages: [],
      candidates,
      lastSyncedAt: syncedAt,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("[email/accounts/sync] Sync error:", err);
    res.status(500).json({ error: "Sync failed", message: err instanceof Error ? err.message : String(err) });
  }
});

  return router;
}

export default createEmailRouter;
