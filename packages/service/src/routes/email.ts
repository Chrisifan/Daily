/**
 * 邮箱账号管理 API 路由
 * 账户元数据存储在 app SQLite，IMAP 密码存储在系统安全存储中。
 */

import { Router } from "express";
import path from "node:path";
import { ImapConnector } from "../services/email/imap-connector.js";
import type { ImapConnectorConfig } from "../services/email/models/email.js";
import { detectEmailScheduleCandidate } from "../services/intake/email-schedule-candidate-detector.js";
import type { ExternalScheduleCandidate } from "../services/intake/external-schedule-candidate.js";
import {
  MailAccountStore,
  type MailAccountRecord,
} from "../services/email/mail-account-store.js";
import { MailSecretStore } from "../services/email/mail-secret-store.js";
import { migrateLegacyMailAccounts } from "../services/email/mail-account-migration.js";

const router: Router = Router();

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

const LEGACY_CONFIG_PATH = path.join(process.cwd(), "config", "mail-accounts.json");
const mailAccountStore = new MailAccountStore();
const mailSecretStore = new MailSecretStore();
let mailAccountInitPromise: Promise<void> | null = null;

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
    lastSyncedAt: acc.lastSyncedAt ?? undefined,
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
  if (!mailAccountInitPromise) {
    mailAccountInitPromise = migrateLegacyMailAccounts({
      configPath: LEGACY_CONFIG_PATH,
      store: mailAccountStore,
      secretStore: mailSecretStore,
    }).then(() => undefined);
  }

  try {
    await mailAccountInitPromise;
  } catch (error) {
    mailAccountInitPromise = null;
    throw error;
  }
}

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

    const connectorConfig: ImapConnectorConfig = {
      host: account.imapHost,
      port: account.imapPort,
      user: account.username,
      password: await mailSecretStore.getPassword(account.id),
      secure: account.secure,
      connectionTimeout: 30000,
      heartbeatInterval: 300000,
      maxReconnectAttempts: 3,
      reconnectDelay: 5000,
    };

    mailAccountStore.updateAccountState(account.id, {
      syncStatus: "syncing",
      updatedAt: new Date().toISOString(),
    });

    const connector = new ImapConnector(connectorConfig);

    try {
      await connector.connect();
      await connector.authenticate();

      const searchResults = await connector.searchEmails({
        folder: "INBOX",
        limit: 20,
      });

      const uids = searchResults.map((result) => result.uid);
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

      const syncedAt = new Date().toISOString();
      mailAccountStore.updateAccountState(account.id, {
        authStatus: "connected",
        syncStatus: "idle",
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      });

      const candidates = emails
        .map((email) =>
          detectEmailScheduleCandidate({
            accountId: account.id,
            messageId: email.messageId,
            subject: email.subject,
            bodyText: email.body.text,
            bodyHtml: email.body.html,
            sentAt: email.date.toISOString(),
            icsEvents: email.icsEvents?.map((event) => ({
              uid: event.uid,
              summary: event.summary,
              start: event.start,
              end: event.end,
              timezone: event.timezone,
              location: event.location,
              description: event.description,
              attendees: event.attendees?.map((attendee) => ({
                name: attendee.name,
                address: attendee.address,
              })),
            })),
          })
        )
        .filter((candidate): candidate is ExternalScheduleCandidate => candidate !== null);

      const response: SyncAccountResponse = {
        accountId,
        totalEmails: searchResults.length,
        messages: summaries,
        candidates,
        lastSyncedAt: syncedAt,
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (syncErr) {
      await connector.disconnect().catch(() => {});
      const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
      mailAccountStore.updateAccountState(account.id, {
        authStatus: isAuthErrorMessage(message) ? "error" : account.authStatus,
        syncStatus: "error",
        updatedAt: new Date().toISOString(),
      });
      throw syncErr;
    }
  } catch (err) {
    console.error("[email/accounts/sync] Sync error:", err);
    res.status(500).json({ error: "Sync failed", message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
