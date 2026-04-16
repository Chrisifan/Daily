import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { getDailyDbPath } from "../email/mail-account-store.js";
import type {
  ExternalScheduleCandidate,
  ExternalScheduleCandidateStatus,
} from "./external-schedule-candidate.js";

export interface PersistedExternalScheduleCandidate extends ExternalScheduleCandidate {
  createdAt: string;
  updatedAt: string;
  notifiedAt: string | null;
}

interface ExternalScheduleCandidateStoreOptions {
  dbPath?: string;
}

function mapRowToCandidate(row: Record<string, unknown>): PersistedExternalScheduleCandidate {
  return {
    id: String(row.id),
    source: row.source as ExternalScheduleCandidate["source"],
    sourceAccountId: row.source_account_id ? String(row.source_account_id) : undefined,
    sourceEventId: row.source_event_id ? String(row.source_event_id) : undefined,
    sourceMessageId: row.source_message_id ? String(row.source_message_id) : undefined,
    title: String(row.title),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    timezone: String(row.timezone),
    location: row.location ? String(row.location) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    attendees: JSON.parse(String(row.attendees_json ?? "[]")) as ExternalScheduleCandidate["attendees"],
    confidence: Number(row.confidence ?? 0),
    rawPayload: JSON.parse(String(row.raw_payload_json ?? "{}")) as Record<string, unknown>,
    status: row.status as ExternalScheduleCandidateStatus,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    notifiedAt: row.notified_at ? String(row.notified_at) : null,
  };
}

export class ExternalScheduleCandidateStore {
  private readonly db: DatabaseSync;

  constructor(options: ExternalScheduleCandidateStoreOptions = {}) {
    const dbPath = options.dbPath ?? getDailyDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS external_schedule_candidates (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_account_id TEXT,
        source_event_id TEXT,
        source_message_id TEXT,
        title TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        timezone TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        attendees_json TEXT NOT NULL DEFAULT '[]',
        confidence REAL NOT NULL DEFAULT 0,
        raw_payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        notified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const columns = new Set(
      (this.db.prepare("PRAGMA table_info(external_schedule_candidates)").all() as Array<Record<string, unknown>>).map(
        (row) => String(row.name)
      )
    );

    if (!columns.has("notified_at")) {
      this.db.exec("ALTER TABLE external_schedule_candidates ADD COLUMN notified_at TEXT");
    }
  }

  getCandidate(id: string): PersistedExternalScheduleCandidate | null {
    const row = this.db
      .prepare(
        `SELECT id, source, source_account_id, source_event_id, source_message_id, title,
                start_at, end_at, timezone, location, notes, attendees_json, confidence,
                raw_payload_json, status, notified_at, created_at, updated_at
           FROM external_schedule_candidates
          WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;

    return row ? mapRowToCandidate(row) : null;
  }

  listCandidatesBySourceAccount(sourceAccountId: string): PersistedExternalScheduleCandidate[] {
    const rows = this.db
      .prepare(
        `SELECT id, source, source_account_id, source_event_id, source_message_id, title,
                start_at, end_at, timezone, location, notes, attendees_json, confidence,
                raw_payload_json, status, notified_at, created_at, updated_at
           FROM external_schedule_candidates
          WHERE source_account_id = ?
          ORDER BY created_at ASC`
      )
      .all(sourceAccountId) as Array<Record<string, unknown>>;

    return rows.map(mapRowToCandidate);
  }

  upsertCandidate(candidate: ExternalScheduleCandidate): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO external_schedule_candidates (
            id, source, source_account_id, source_event_id, source_message_id, title,
            start_at, end_at, timezone, location, notes, attendees_json, confidence,
            raw_payload_json, status, notified_at, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            COALESCE((SELECT notified_at FROM external_schedule_candidates WHERE id = ?), NULL),
            COALESCE((SELECT created_at FROM external_schedule_candidates WHERE id = ?), ?),
            ?
          )
          ON CONFLICT(id) DO UPDATE SET
            source = excluded.source,
            source_account_id = excluded.source_account_id,
            source_event_id = excluded.source_event_id,
            source_message_id = excluded.source_message_id,
            title = excluded.title,
            start_at = excluded.start_at,
            end_at = excluded.end_at,
            timezone = excluded.timezone,
            location = excluded.location,
            notes = excluded.notes,
            attendees_json = excluded.attendees_json,
            confidence = excluded.confidence,
            raw_payload_json = excluded.raw_payload_json,
            status = COALESCE((SELECT status FROM external_schedule_candidates WHERE id = excluded.id), excluded.status),
            notified_at = COALESCE((SELECT notified_at FROM external_schedule_candidates WHERE id = excluded.id), excluded.notified_at),
            created_at = COALESCE((SELECT created_at FROM external_schedule_candidates WHERE id = excluded.id), excluded.created_at),
            updated_at = excluded.updated_at`
      )
      .run(
        candidate.id,
        candidate.source,
        candidate.sourceAccountId ?? null,
        candidate.sourceEventId ?? null,
        candidate.sourceMessageId ?? null,
        candidate.title,
        candidate.startAt,
        candidate.endAt,
        candidate.timezone,
        candidate.location ?? null,
        candidate.notes ?? null,
        JSON.stringify(candidate.attendees),
        candidate.confidence,
        JSON.stringify(candidate.rawPayload),
        candidate.status,
        candidate.id,
        candidate.id,
        now,
        now
      );
  }

  markNotified(id: string, notifiedAt: string): void {
    this.db
      .prepare("UPDATE external_schedule_candidates SET notified_at = ?, updated_at = ? WHERE id = ?")
      .run(notifiedAt, new Date().toISOString(), id);
  }

  updateStatus(id: string, status: ExternalScheduleCandidateStatus): void {
    this.db
      .prepare("UPDATE external_schedule_candidates SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
  }

  close(): void {
    this.db.close();
  }
}
