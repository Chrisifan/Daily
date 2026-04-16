import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { getDailyDbPath } from "./mail-account-store.js";

export interface MailSyncCursorRecord {
  accountId: string;
  folder: string;
  uidValidity: string | null;
  lastSeenUid: number;
  lastSeenMessageId: string | null;
  lastEventAt: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
}

interface MailSyncCursorStoreOptions {
  dbPath?: string;
}

function mapRowToCursor(row: Record<string, unknown>): MailSyncCursorRecord {
  return {
    accountId: String(row.account_id),
    folder: String(row.folder ?? "INBOX"),
    uidValidity: row.uid_validity ? String(row.uid_validity) : null,
    lastSeenUid: Number(row.last_seen_uid ?? 0),
    lastSeenMessageId: row.last_seen_message_id ? String(row.last_seen_message_id) : null,
    lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export class MailSyncCursorStore {
  private readonly db: DatabaseSync;

  constructor(options: MailSyncCursorStoreOptions = {}) {
    const dbPath = options.dbPath ?? getDailyDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mail_sync_cursors (
        account_id TEXT PRIMARY KEY,
        folder TEXT NOT NULL DEFAULT 'INBOX',
        uid_validity TEXT,
        last_seen_uid INTEGER NOT NULL DEFAULT 0,
        last_seen_message_id TEXT,
        last_event_at TEXT,
        last_synced_at TEXT,
        updated_at TEXT NOT NULL
      )
    `);
  }

  getCursor(accountId: string): MailSyncCursorRecord | null {
    const row = this.db
      .prepare(
        `SELECT account_id, folder, uid_validity, last_seen_uid, last_seen_message_id,
                last_event_at, last_synced_at, updated_at
           FROM mail_sync_cursors
          WHERE account_id = ?`
      )
      .get(accountId) as Record<string, unknown> | undefined;

    return row ? mapRowToCursor(row) : null;
  }

  upsertCursor(cursor: MailSyncCursorRecord): void {
    this.db
      .prepare(
        `INSERT INTO mail_sync_cursors (
            account_id, folder, uid_validity, last_seen_uid, last_seen_message_id,
            last_event_at, last_synced_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id) DO UPDATE SET
            folder = excluded.folder,
            uid_validity = excluded.uid_validity,
            last_seen_uid = excluded.last_seen_uid,
            last_seen_message_id = excluded.last_seen_message_id,
            last_event_at = excluded.last_event_at,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at`
      )
      .run(
        cursor.accountId,
        cursor.folder,
        cursor.uidValidity,
        cursor.lastSeenUid,
        cursor.lastSeenMessageId,
        cursor.lastEventAt,
        cursor.lastSyncedAt,
        cursor.updatedAt
      );
  }

  deleteCursor(accountId: string): void {
    this.db.prepare("DELETE FROM mail_sync_cursors WHERE account_id = ?").run(accountId);
  }

  close(): void {
    this.db.close();
  }
}
