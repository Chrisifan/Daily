import fs from "node:fs/promises";
import path from "node:path";
import { MailAccountStore, type MailAccountRecord } from "./mail-account-store.js";
import type { MailSecretStoreLike } from "./mail-secret-store.js";

interface LegacyStoredAccount {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  passwordObfuscated: string;
  secure: boolean;
  displayName?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

interface LegacyMailAccountsFile {
  version: string;
  accounts: LegacyStoredAccount[];
}

interface MigrateLegacyMailAccountsOptions {
  configPath: string;
  store: MailAccountStore;
  secretStore: Pick<MailSecretStoreLike, "setPassword">;
}

interface MigrateLegacyMailAccountsResult {
  migratedCount: number;
  backupPath: string | null;
}

function mapLegacyAccount(account: LegacyStoredAccount): MailAccountRecord {
  const now = new Date().toISOString();

  return {
    id: account.id,
    provider: "imap",
    emailAddress: account.email.trim().toLowerCase(),
    imapHost: account.imapHost.trim(),
    imapPort: Number(account.imapPort) || 993,
    username: (account.username || account.email).trim(),
    secure: account.secure !== false,
    displayName: account.displayName?.trim() || undefined,
    authStatus: account.lastSyncedAt ? "connected" : "disconnected",
    syncStatus: "idle",
    lastSyncedAt: account.lastSyncedAt ?? null,
    lastSyncError: null,
    scopes: [],
    createdAt: account.createdAt || now,
    updatedAt: now,
  };
}

function decodeLegacyPassword(obfuscated: string): string {
  return Buffer.from(obfuscated, "base64").toString("utf8");
}

export async function migrateLegacyMailAccounts({
  configPath,
  store,
  secretStore,
}: MigrateLegacyMailAccountsOptions): Promise<MigrateLegacyMailAccountsResult> {
  try {
    await fs.access(configPath);
  } catch {
    return { migratedCount: 0, backupPath: null };
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as LegacyMailAccountsFile;
  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];

  for (const account of accounts) {
    const mapped = mapLegacyAccount(account);
    store.upsertAccount(mapped);
    await secretStore.setPassword(account.id, decodeLegacyPassword(account.passwordObfuscated));
  }

  const backupPath = path.join(
    path.dirname(configPath),
    `${path.basename(configPath, path.extname(configPath))}.migrated-${Date.now()}.bak`
  );
  await fs.rename(configPath, backupPath);

  return {
    migratedCount: accounts.length,
    backupPath,
  };
}
