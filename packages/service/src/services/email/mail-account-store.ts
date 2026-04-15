import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type MailAccountProvider = "gmail" | "outlook" | "imap";
export type MailAccountAuthStatus = "connected" | "disconnected" | "error";
export type MailAccountSyncStatus = "syncing" | "idle" | "error";

export interface MailAccountRecord {
  id: string;
  provider: MailAccountProvider;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  username: string;
  secure: boolean;
  displayName?: string;
  authStatus: MailAccountAuthStatus;
  syncStatus: MailAccountSyncStatus;
  lastSyncedAt: string | null;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

interface MailAccountStoreOptions {
  dbPath?: string;
}

const MAIL_ACCOUNT_COLUMNS: Array<[string, string]> = [
  ["imap_host", "ALTER TABLE mail_accounts ADD COLUMN imap_host TEXT NOT NULL DEFAULT ''"],
  ["imap_port", "ALTER TABLE mail_accounts ADD COLUMN imap_port INTEGER NOT NULL DEFAULT 993"],
  ["username", "ALTER TABLE mail_accounts ADD COLUMN username TEXT NOT NULL DEFAULT ''"],
  ["secure", "ALTER TABLE mail_accounts ADD COLUMN secure INTEGER NOT NULL DEFAULT 1"],
  ["display_name", "ALTER TABLE mail_accounts ADD COLUMN display_name TEXT"],
  ["created_at", "ALTER TABLE mail_accounts ADD COLUMN created_at TEXT NOT NULL DEFAULT ''"],
  ["updated_at", "ALTER TABLE mail_accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"],
];

function defaultDataDirectory(): string {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support");
  }

  if (process.platform === "win32") {
    return path.join(home, "AppData", "Local");
  }

  return process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
}

export function getDailyDbPath(): string {
  return (
    process.env.DAILY_DB_PATH ||
    path.join(defaultDataDirectory(), "smart-workbench", "daily.db")
  );
}

function mapRowToMailAccount(row: Record<string, unknown>): MailAccountRecord {
  return {
    id: String(row.id),
    provider: (row.provider as MailAccountProvider) ?? "imap",
    emailAddress: String(row.email_address),
    imapHost: String(row.imap_host ?? ""),
    imapPort: Number(row.imap_port ?? 993),
    username: String(row.username ?? row.email_address),
    secure: Number(row.secure ?? 1) !== 0,
    displayName: row.display_name ? String(row.display_name) : undefined,
    authStatus: (row.auth_status as MailAccountAuthStatus) ?? "disconnected",
    syncStatus: (row.sync_status as MailAccountSyncStatus) ?? "idle",
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    scopes: row.scopes ? JSON.parse(String(row.scopes)) as string[] : [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export class MailAccountStore {
  private readonly db: DatabaseSync;

  constructor(options: MailAccountStoreOptions = {}) {
    const dbPath = options.dbPath ?? getDailyDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mail_accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'imap',
        email_address TEXT NOT NULL UNIQUE,
        imap_host TEXT NOT NULL DEFAULT '',
        imap_port INTEGER NOT NULL DEFAULT 993,
        username TEXT NOT NULL DEFAULT '',
        secure INTEGER NOT NULL DEFAULT 1,
        display_name TEXT,
        auth_status TEXT NOT NULL DEFAULT 'disconnected',
        sync_status TEXT NOT NULL DEFAULT 'idle',
        last_synced_at TEXT,
        scopes TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const existingColumns = new Set(
      (this.db.prepare("PRAGMA table_info(mail_accounts)").all() as Array<Record<string, unknown>>).map((row) =>
        String(row.name)
      )
    );

    for (const [column, sql] of MAIL_ACCOUNT_COLUMNS) {
      if (!existingColumns.has(column)) {
        this.db.exec(sql);
      }
    }

    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_mail_accounts_email_address ON mail_accounts(email_address)"
    );
  }

  listAccounts(): MailAccountRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, provider, email_address, imap_host, imap_port, username, secure, display_name,
                auth_status, sync_status, last_synced_at, scopes, created_at, updated_at
           FROM mail_accounts
          ORDER BY created_at DESC, email_address ASC`
      )
      .all() as Array<Record<string, unknown>>;

    return rows.map(mapRowToMailAccount);
  }

  getAccount(id: string): MailAccountRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, provider, email_address, imap_host, imap_port, username, secure, display_name,
                auth_status, sync_status, last_synced_at, scopes, created_at, updated_at
           FROM mail_accounts
          WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;

    return row ? mapRowToMailAccount(row) : null;
  }

  getAccountByEmail(emailAddress: string): MailAccountRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, provider, email_address, imap_host, imap_port, username, secure, display_name,
                auth_status, sync_status, last_synced_at, scopes, created_at, updated_at
           FROM mail_accounts
          WHERE lower(email_address) = lower(?)`
      )
      .get(emailAddress) as Record<string, unknown> | undefined;

    return row ? mapRowToMailAccount(row) : null;
  }

  upsertAccount(account: MailAccountRecord): void {
    this.db
      .prepare(
        `INSERT INTO mail_accounts (
            id, provider, email_address, imap_host, imap_port, username, secure, display_name,
            auth_status, sync_status, last_synced_at, scopes, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
          ON CONFLICT(id) DO UPDATE SET
            provider = excluded.provider,
            email_address = excluded.email_address,
            imap_host = excluded.imap_host,
            imap_port = excluded.imap_port,
            username = excluded.username,
            secure = excluded.secure,
            display_name = excluded.display_name,
            auth_status = excluded.auth_status,
            sync_status = excluded.sync_status,
            last_synced_at = excluded.last_synced_at,
            scopes = excluded.scopes,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at`
      )
      .run(
        account.id,
        account.provider,
        account.emailAddress,
        account.imapHost,
        account.imapPort,
        account.username,
        account.secure ? 1 : 0,
        account.displayName ?? null,
        account.authStatus,
        account.syncStatus,
        account.lastSyncedAt,
        JSON.stringify(account.scopes),
        account.createdAt,
        account.updatedAt
      );
  }

  updateAccountState(
    id: string,
    updates: Partial<Pick<MailAccountRecord, "authStatus" | "syncStatus" | "lastSyncedAt" | "updatedAt">>
  ): void {
    const existing = this.getAccount(id);
    if (!existing) {
      return;
    }

    this.upsertAccount({
      ...existing,
      authStatus: updates.authStatus ?? existing.authStatus,
      syncStatus: updates.syncStatus ?? existing.syncStatus,
      lastSyncedAt: updates.lastSyncedAt ?? existing.lastSyncedAt,
      updatedAt: updates.updatedAt ?? new Date().toISOString(),
    });
  }

  deleteAccount(id: string): void {
    this.db.prepare("DELETE FROM mail_accounts WHERE id = ?").run(id);
  }

  close(): void {
    this.db.close();
  }
}
