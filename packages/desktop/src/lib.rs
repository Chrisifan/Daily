use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::process::Command;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

fn schedule_items_columns(conn: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = conn.prepare("PRAGMA table_info(schedule_items)")?;
    let existing_columns = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .collect();

    Ok(existing_columns)
}

fn mail_accounts_columns(conn: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = conn.prepare("PRAGMA table_info(mail_accounts)")?;
    let existing_columns = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .collect();

    Ok(existing_columns)
}

fn ensure_schedule_items_schema(conn: &Connection) -> rusqlite::Result<()> {
    let existing_columns = schedule_items_columns(conn)?;

    let migrations = [
        (
            "source",
            "ALTER TABLE schedule_items ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
        ),
        (
            "source_event_id",
            "ALTER TABLE schedule_items ADD COLUMN source_event_id TEXT",
        ),
        (
            "icon",
            "ALTER TABLE schedule_items ADD COLUMN icon TEXT NOT NULL DEFAULT 'clock'",
        ),
        (
            "timezone",
            "ALTER TABLE schedule_items ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'",
        ),
        (
            "duration_minutes",
            "ALTER TABLE schedule_items ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30",
        ),
        (
            "repeat_mode",
            "ALTER TABLE schedule_items ADD COLUMN repeat_mode TEXT NOT NULL DEFAULT 'none'",
        ),
        (
            "repeat_group_id",
            "ALTER TABLE schedule_items ADD COLUMN repeat_group_id TEXT",
        ),
        (
            "location",
            "ALTER TABLE schedule_items ADD COLUMN location TEXT",
        ),
        (
            "notes",
            "ALTER TABLE schedule_items ADD COLUMN notes TEXT",
        ),
        (
            "workspace_id",
            "ALTER TABLE schedule_items ADD COLUMN workspace_id TEXT",
        ),
        (
            "priority",
            "ALTER TABLE schedule_items ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'",
        ),
        (
            "preparation_minutes",
            "ALTER TABLE schedule_items ADD COLUMN preparation_minutes INTEGER",
        ),
        (
            "travel_minutes",
            "ALTER TABLE schedule_items ADD COLUMN travel_minutes INTEGER",
        ),
        (
            "is_flexible",
            "ALTER TABLE schedule_items ADD COLUMN is_flexible INTEGER DEFAULT 0",
        ),
        (
            "created_at",
            "ALTER TABLE schedule_items ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
        ),
        (
            "updated_at",
            "ALTER TABLE schedule_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
        ),
    ];

    for (column, sql) in migrations {
        if !existing_columns.contains(column) {
            conn.execute(sql, [])?;
        }
    }

    let refreshed_columns = schedule_items_columns(conn)?;
    if refreshed_columns.contains("end_at") && refreshed_columns.contains("duration_minutes") {
        conn.execute(
            "UPDATE schedule_items
             SET duration_minutes = CASE
               WHEN end_at IS NOT NULL AND start_at IS NOT NULL
                 THEN MAX(CAST((strftime('%s', end_at) - strftime('%s', start_at)) / 60 AS INTEGER), 0)
               ELSE duration_minutes
             END",
            [],
        )?;
    }

    Ok(())
}

fn ensure_mail_accounts_schema(conn: &Connection) -> rusqlite::Result<()> {
    let existing_columns = mail_accounts_columns(conn)?;

    let migrations = [
        (
            "imap_host",
            "ALTER TABLE mail_accounts ADD COLUMN imap_host TEXT NOT NULL DEFAULT ''",
        ),
        (
            "imap_port",
            "ALTER TABLE mail_accounts ADD COLUMN imap_port INTEGER NOT NULL DEFAULT 993",
        ),
        (
            "username",
            "ALTER TABLE mail_accounts ADD COLUMN username TEXT NOT NULL DEFAULT ''",
        ),
        (
            "secure",
            "ALTER TABLE mail_accounts ADD COLUMN secure INTEGER NOT NULL DEFAULT 1",
        ),
        (
            "display_name",
            "ALTER TABLE mail_accounts ADD COLUMN display_name TEXT",
        ),
        (
            "created_at",
            "ALTER TABLE mail_accounts ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
        ),
        (
            "updated_at",
            "ALTER TABLE mail_accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
        ),
    ];

    for (column, sql) in migrations {
        if !existing_columns.contains(column) {
            conn.execute(sql, [])?;
        }
    }

    Ok(())
}

fn ensure_external_schedule_candidates_schema(conn: &Connection) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(external_schedule_candidates)")?;
    let existing_columns = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .collect::<HashSet<_>>();

    if !existing_columns.contains("notified_at") {
        conn.execute(
            "ALTER TABLE external_schedule_candidates ADD COLUMN notified_at TEXT",
            [],
        )?;
    }

    Ok(())
}

fn ensure_schedule_reminder_deliveries_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schedule_reminder_deliveries (
            id TEXT PRIMARY KEY,
            schedule_id TEXT NOT NULL,
            remind_at TEXT NOT NULL,
            delivered_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_reminder_deliveries_schedule_time
         ON schedule_reminder_deliveries(schedule_id, remind_at)",
        [],
    )?;

    Ok(())
}

fn schedule_reminder_delivery_id(schedule_id: &str, remind_at: &str) -> String {
    format!("schedule-reminder::{schedule_id}::{remind_at}")
}

fn was_schedule_reminder_delivered(
    conn: &Connection,
    schedule_id: &str,
    remind_at: &str,
) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(
        "SELECT EXISTS(
            SELECT 1 FROM schedule_reminder_deliveries
            WHERE schedule_id = ?1 AND remind_at = ?2
        )",
    )?;

    let exists: i64 = stmt.query_row(params![schedule_id, remind_at], |row| row.get(0))?;
    Ok(exists != 0)
}

fn mark_schedule_reminder_delivery(
    conn: &Connection,
    schedule_id: &str,
    remind_at: &str,
    delivered_at: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO schedule_reminder_deliveries (id, schedule_id, remind_at, delivered_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            schedule_reminder_delivery_id(schedule_id, remind_at),
            schedule_id,
            remind_at,
            delivered_at,
        ],
    )?;

    Ok(())
}

fn compute_end_at(start_at: &str, duration_minutes: i32) -> Result<String, String> {
    let start = chrono::DateTime::parse_from_rfc3339(start_at)
        .map_err(|e| format!("invalid start_at: {e}"))?;
    Ok((start + chrono::Duration::minutes(duration_minutes as i64)).to_rfc3339())
}

static DB: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("smart-workbench");

    std::fs::create_dir_all(&app_dir).ok();
    let db_path = app_dir.join("daily.db");

    let conn = Connection::open(&db_path).expect("Failed to open database");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS schedule_items (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL DEFAULT 'manual',
            source_event_id TEXT,
            title TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT 'clock',
            start_at TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            repeat_mode TEXT NOT NULL DEFAULT 'none',
            repeat_group_id TEXT,
            location TEXT,
            notes TEXT,
            workspace_id TEXT,
            priority TEXT NOT NULL DEFAULT 'medium',
            preparation_minutes INTEGER,
            travel_minutes INTEGER,
            is_flexible INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )
    .ok();

    ensure_schedule_items_schema(&conn).ok();

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_schedule_items_start_at ON schedule_items(start_at)",
        [],
    )
    .ok();

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_schedule_items_repeat_group_id ON schedule_items(repeat_group_id)",
        [],
    )
    .ok();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )
    .ok();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS mail_accounts (
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
        )",
        [],
    )
    .ok();

    ensure_mail_accounts_schema(&conn).ok();

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_mail_accounts_email_address ON mail_accounts(email_address)",
        [],
    )
    .ok();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS external_schedule_candidates (
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
        )",
        [],
    )
    .ok();

    ensure_external_schedule_candidates_schema(&conn).ok();
    ensure_schedule_reminder_deliveries_schema(&conn).ok();

    Mutex::new(conn)
});

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduleItem {
    pub id: String,
    pub source: String,
    pub title: String,
    pub icon: String,
    pub start_at: String,
    pub timezone: String,
    pub duration_minutes: i32,
    pub repeat_mode: String,
    pub repeat_group_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub workspace_id: Option<String>,
    pub priority: String,
    pub is_flexible: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateScheduleInput {
    pub title: String,
    pub icon: String,
    pub start_at: String,
    pub timezone: String,
    pub duration_minutes: i32,
    pub repeat_mode: String,
    pub repeat_group_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub workspace_id: Option<String>,
    pub priority: String,
    pub is_flexible: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateScheduleInput {
    pub title: Option<String>,
    pub icon: Option<String>,
    pub start_at: Option<String>,
    pub timezone: Option<String>,
    pub duration_minutes: Option<i32>,
    pub repeat_mode: Option<String>,
    pub repeat_group_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub workspace_id: Option<Option<String>>,
    pub priority: Option<String>,
    pub is_flexible: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExternalScheduleCandidate {
    pub id: String,
    pub source: String,
    pub source_account_id: Option<String>,
    pub source_event_id: Option<String>,
    pub source_message_id: Option<String>,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub timezone: String,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub attendees_json: String,
    pub confidence: f64,
    pub raw_payload_json: String,
    pub status: String,
    pub notified_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateExternalScheduleCandidateInput {
    pub id: String,
    pub source: String,
    pub source_account_id: Option<String>,
    pub source_event_id: Option<String>,
    pub source_message_id: Option<String>,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub timezone: String,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub attendees_json: String,
    pub confidence: f64,
    pub raw_payload_json: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateImportedScheduleInput {
    pub source: String,
    pub source_event_id: Option<String>,
    pub title: String,
    pub icon: String,
    pub start_at: String,
    pub timezone: String,
    pub duration_minutes: i32,
    pub repeat_mode: String,
    pub repeat_group_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub workspace_id: Option<String>,
    pub priority: String,
    pub is_flexible: bool,
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn gen_id() -> String {
    format!(
        "schedule-{}-{}",
        chrono::Utc::now().timestamp_millis(),
        rand_str(8)
    )
}

fn rand_str(len: usize) -> String {
    use std::iter;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    iter::repeat_with(|| {
        rng = rng.wrapping_mul(1103515245).wrapping_add(12345);
        let idx = (rng as usize) % CHARSET.len();
        CHARSET[idx] as char
    })
    .take(len)
    .collect()
}

fn map_schedule_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScheduleItem> {
    Ok(ScheduleItem {
        id: row.get(0)?,
        source: row.get(1)?,
        title: row.get(2)?,
        icon: row.get(3)?,
        start_at: row.get(4)?,
        timezone: row.get(5)?,
        duration_minutes: row.get(6)?,
        repeat_mode: row.get(7)?,
        repeat_group_id: row.get(8)?,
        location: row.get(9)?,
        notes: row.get(10)?,
        workspace_id: row.get(11)?,
        priority: row.get(12)?,
        is_flexible: row.get::<_, i32>(13)? != 0,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

fn map_external_schedule_candidate(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ExternalScheduleCandidate> {
    Ok(ExternalScheduleCandidate {
        id: row.get(0)?,
        source: row.get(1)?,
        source_account_id: row.get(2)?,
        source_event_id: row.get(3)?,
        source_message_id: row.get(4)?,
        title: row.get(5)?,
        start_at: row.get(6)?,
        end_at: row.get(7)?,
        timezone: row.get(8)?,
        location: row.get(9)?,
        notes: row.get(10)?,
        attendees_json: row.get(11)?,
        confidence: row.get(12)?,
        raw_payload_json: row.get(13)?,
        status: row.get(14)?,
        notified_at: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

#[tauri::command]
fn get_schedules() -> Result<Vec<ScheduleItem>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at FROM schedule_items ORDER BY start_at")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], map_schedule_item)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
fn create_schedule(input: CreateScheduleInput) -> Result<ScheduleItem, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let now = now_rfc3339();
    let id = gen_id();
    let columns = schedule_items_columns(&conn).map_err(|e| e.to_string())?;
    let end_at = if columns.contains("end_at") {
        Some(compute_end_at(&input.start_at, input.duration_minutes)?)
    } else {
        None
    };

    if let Some(ref end_at) = end_at {
        conn.execute(
            "INSERT INTO schedule_items (id, source, title, icon, start_at, end_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at) VALUES (?1, 'manual', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                id,
                input.title,
                input.icon,
                input.start_at,
                end_at,
                input.timezone,
                input.duration_minutes,
                input.repeat_mode,
                input.repeat_group_id,
                input.location,
                input.notes,
                input.workspace_id,
                input.priority,
                input.is_flexible as i32,
                now,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO schedule_items (id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at) VALUES (?1, 'manual', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                input.title,
                input.icon,
                input.start_at,
                input.timezone,
                input.duration_minutes,
                input.repeat_mode,
                input.repeat_group_id,
                input.location,
                input.notes,
                input.workspace_id,
                input.priority,
                input.is_flexible as i32,
                now,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(ScheduleItem {
        id,
        source: "manual".to_string(),
        title: input.title,
        icon: input.icon,
        start_at: input.start_at,
        timezone: input.timezone,
        duration_minutes: input.duration_minutes,
        repeat_mode: input.repeat_mode,
        repeat_group_id: input.repeat_group_id,
        location: input.location,
        notes: input.notes,
        workspace_id: input.workspace_id,
        priority: input.priority,
        is_flexible: input.is_flexible,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
fn create_imported_schedule(input: CreateImportedScheduleInput) -> Result<ScheduleItem, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let now = now_rfc3339();
    let id = gen_id();
    let columns = schedule_items_columns(&conn).map_err(|e| e.to_string())?;
    let end_at = if columns.contains("end_at") {
        Some(compute_end_at(&input.start_at, input.duration_minutes)?)
    } else {
        None
    };

    if let Some(ref end_at) = end_at {
        conn.execute(
            "INSERT INTO schedule_items (id, source, source_event_id, title, icon, start_at, end_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                id,
                input.source,
                input.source_event_id,
                input.title,
                input.icon,
                input.start_at,
                end_at,
                input.timezone,
                input.duration_minutes,
                input.repeat_mode,
                input.repeat_group_id,
                input.location,
                input.notes,
                input.workspace_id,
                input.priority,
                input.is_flexible as i32,
                now,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO schedule_items (id, source, source_event_id, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                id,
                input.source,
                input.source_event_id,
                input.title,
                input.icon,
                input.start_at,
                input.timezone,
                input.duration_minutes,
                input.repeat_mode,
                input.repeat_group_id,
                input.location,
                input.notes,
                input.workspace_id,
                input.priority,
                input.is_flexible as i32,
                now,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(ScheduleItem {
        id,
        source: input.source,
        title: input.title,
        icon: input.icon,
        start_at: input.start_at,
        timezone: input.timezone,
        duration_minutes: input.duration_minutes,
        repeat_mode: input.repeat_mode,
        repeat_group_id: input.repeat_group_id,
        location: input.location,
        notes: input.notes,
        workspace_id: input.workspace_id,
        priority: input.priority,
        is_flexible: input.is_flexible,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
fn update_schedule(id: String, input: UpdateScheduleInput) -> Result<ScheduleItem, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let now = now_rfc3339();
    let columns = schedule_items_columns(&conn).map_err(|e| e.to_string())?;
    let has_end_at = columns.contains("end_at");

    if let Some(ref title) = input.title {
        conn.execute(
            "UPDATE schedule_items SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref icon) = input.icon {
        conn.execute(
            "UPDATE schedule_items SET icon = ?1, updated_at = ?2 WHERE id = ?3",
            params![icon, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref start_at) = input.start_at {
        conn.execute(
            "UPDATE schedule_items SET start_at = ?1, updated_at = ?2 WHERE id = ?3",
            params![start_at, now, id],
        )
        .map_err(|e| e.to_string())?;

        if has_end_at {
            let mut stmt = conn
                .prepare("SELECT duration_minutes FROM schedule_items WHERE id = ?1")
                .map_err(|e| e.to_string())?;
            let current_duration: i32 = stmt
                .query_row(params![id.clone()], |row| row.get(0))
                .map_err(|e| e.to_string())?;
            let end_at = compute_end_at(start_at, current_duration)?;
            conn.execute(
                "UPDATE schedule_items SET end_at = ?1, updated_at = ?2 WHERE id = ?3",
                params![end_at, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if let Some(ref timezone) = input.timezone {
        conn.execute(
            "UPDATE schedule_items SET timezone = ?1, updated_at = ?2 WHERE id = ?3",
            params![timezone, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(duration_minutes) = input.duration_minutes {
        conn.execute(
            "UPDATE schedule_items SET duration_minutes = ?1, updated_at = ?2 WHERE id = ?3",
            params![duration_minutes, now, id],
        )
        .map_err(|e| e.to_string())?;

        if has_end_at {
            let mut stmt = conn
                .prepare("SELECT start_at FROM schedule_items WHERE id = ?1")
                .map_err(|e| e.to_string())?;
            let current_start_at: String = stmt
                .query_row(params![id.clone()], |row| row.get(0))
                .map_err(|e| e.to_string())?;
            let end_at = compute_end_at(&current_start_at, duration_minutes)?;
            conn.execute(
                "UPDATE schedule_items SET end_at = ?1, updated_at = ?2 WHERE id = ?3",
                params![end_at, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if let Some(ref repeat_mode) = input.repeat_mode {
        conn.execute(
            "UPDATE schedule_items SET repeat_mode = ?1, updated_at = ?2 WHERE id = ?3",
            params![repeat_mode, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref repeat_group_id) = input.repeat_group_id {
        conn.execute(
            "UPDATE schedule_items SET repeat_group_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![repeat_group_id, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref priority) = input.priority {
        conn.execute(
            "UPDATE schedule_items SET priority = ?1, updated_at = ?2 WHERE id = ?3",
            params![priority, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref location) = input.location {
        conn.execute(
            "UPDATE schedule_items SET location = ?1, updated_at = ?2 WHERE id = ?3",
            params![location, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref notes) = input.notes {
        conn.execute(
            "UPDATE schedule_items SET notes = ?1, updated_at = ?2 WHERE id = ?3",
            params![notes, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(workspace_id) = input.workspace_id {
        conn.execute(
            "UPDATE schedule_items SET workspace_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![workspace_id, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(is_flexible) = input.is_flexible {
        conn.execute(
            "UPDATE schedule_items SET is_flexible = ?1, updated_at = ?2 WHERE id = ?3",
            params![is_flexible as i32, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, workspace_id, priority, is_flexible, created_at, updated_at FROM schedule_items WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let item = stmt
        .query_row(params![id], map_schedule_item)
        .map_err(|e| e.to_string())?;

    Ok(item)
}

#[tauri::command]
fn delete_schedule(id: String) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM schedule_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_all_schedules() -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM schedule_items", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_setting(key: String) -> Result<Option<String>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row(params![key], |row| row.get(0))
        .map_err(|e| e.to_string())
        .ok();

    Ok(result)
}

#[tauri::command]
fn set_setting(key: String, value: String) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let now = now_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        params![key, value, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_all_settings() -> Result<Vec<(String, String)>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
fn upsert_external_schedule_candidate(input: CreateExternalScheduleCandidateInput) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    let now = now_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO external_schedule_candidates (
            id, source, source_account_id, source_event_id, source_message_id,
            title, start_at, end_at, timezone, location, notes, attendees_json,
            confidence, raw_payload_json, status, notified_at, created_at, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9, ?10, ?11, ?12,
            ?13, ?14,
            COALESCE((SELECT status FROM external_schedule_candidates WHERE id = ?1), 'pending'),
            COALESCE((SELECT notified_at FROM external_schedule_candidates WHERE id = ?1), NULL),
            COALESCE((SELECT created_at FROM external_schedule_candidates WHERE id = ?1), ?15),
            ?15
        )",
        params![
            input.id,
            input.source,
            input.source_account_id,
            input.source_event_id,
            input.source_message_id,
            input.title,
            input.start_at,
            input.end_at,
            input.timezone,
            input.location,
            input.notes,
            input.attendees_json,
            input.confidence,
            input.raw_payload_json,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_external_schedule_candidate(id: String) -> Result<Option<ExternalScheduleCandidate>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, source, source_account_id, source_event_id, source_message_id, title, start_at, end_at, timezone, location, notes, attendees_json, confidence, raw_payload_json, status, notified_at, created_at, updated_at
             FROM external_schedule_candidates WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let item = stmt.query_row(params![id], map_external_schedule_candidate).ok();
    Ok(item)
}

#[tauri::command]
fn list_pending_external_schedule_candidates() -> Result<Vec<ExternalScheduleCandidate>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, source, source_account_id, source_event_id, source_message_id, title, start_at, end_at, timezone, location, notes, attendees_json, confidence, raw_payload_json, status, notified_at, created_at, updated_at
             FROM external_schedule_candidates
             WHERE status = 'pending'
             ORDER BY start_at ASC, created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], map_external_schedule_candidate)
        .map_err(|e| e.to_string())?
        .filter_map(|row| row.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
fn update_external_schedule_candidate_status(id: String, status: String) -> Result<(), String> {
    let next_status = match status.as_str() {
        "pending" | "accepted" | "dismissed" | "auto_created" => status,
        _ => return Err(format!("invalid candidate status: {status}")),
    };

    let conn = DB.lock().map_err(|e| e.to_string())?;
    let now = now_rfc3339();

    conn.execute(
        "UPDATE external_schedule_candidates SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![next_status, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn update_external_schedule_candidate_notified_at(
    id: String,
    notified_at: Option<String>,
) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    let now = now_rfc3339();

    conn.execute(
        "UPDATE external_schedule_candidates SET notified_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![notified_at, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn was_schedule_reminder_delivered_command(
    schedule_id: String,
    remind_at: String,
) -> Result<bool, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    was_schedule_reminder_delivered(&conn, &schedule_id, &remind_at).map_err(|e| e.to_string())
}

#[tauri::command]
fn mark_schedule_reminder_delivered_command(
    schedule_id: String,
    remind_at: String,
    delivered_at: String,
) -> Result<(), String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    mark_schedule_reminder_delivery(&conn, &schedule_id, &remind_at, &delivered_at)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn show_system_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if tauri::is_dev() {
        if let Err(error) = show_macos_dev_notification(&title, &body) {
            eprintln!("[notification] macOS dev fallback failed: {error}");
        } else {
            return Ok(());
        }
    }

    println!("[notification] title={title} body={body}");
    app.notification()
        .builder()
        .title(title.clone())
        .body(body.clone())
        .show()
        .map_err(|e| {
            let message = e.to_string();
            eprintln!("[notification] plugin show failed: {message}");
            message
        })
}

#[cfg(target_os = "macos")]
fn show_macos_dev_notification(title: &str, body: &str) -> Result<(), String> {
    let script = build_applescript_notification_script(title, body);
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        println!("[notification] macOS dev fallback delivered");
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("osascript exited with status {}", output.status)
    } else {
        stderr
    })
}

#[cfg(target_os = "macos")]
fn build_applescript_notification_script(title: &str, body: &str) -> String {
    format!(
        "display notification \"{}\" with title \"{}\"",
        escape_applescript_string(body),
        escape_applescript_string(title)
    )
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_schedules,
            create_schedule,
            create_imported_schedule,
            update_schedule,
            delete_schedule,
            delete_all_schedules,
            get_setting,
            set_setting,
            get_all_settings,
            upsert_external_schedule_candidate,
            get_external_schedule_candidate,
            list_pending_external_schedule_candidates,
            update_external_schedule_candidate_status,
            update_external_schedule_candidate_notified_at,
            was_schedule_reminder_delivered_command,
            mark_schedule_reminder_delivered_command,
            show_system_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use rusqlite::params;

    #[test]
    fn schedule_reminder_delivery_marking_is_idempotent() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        super::ensure_schedule_reminder_deliveries_schema(&conn).expect("schema");

        super::mark_schedule_reminder_delivery(
            &conn,
            "schedule-1",
            "2026-04-16T09:50:00Z",
            "2026-04-16T09:50:02Z",
        )
        .expect("first insert");
        super::mark_schedule_reminder_delivery(
            &conn,
            "schedule-1",
            "2026-04-16T09:50:00Z",
            "2026-04-16T09:50:05Z",
        )
        .expect("second insert");

        assert!(
            super::was_schedule_reminder_delivered(
                &conn,
                "schedule-1",
                "2026-04-16T09:50:00Z",
            )
            .expect("delivery lookup")
        );

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schedule_reminder_deliveries WHERE schedule_id = ?1 AND remind_at = ?2",
                params!["schedule-1", "2026-04-16T09:50:00Z"],
                |row| row.get(0),
            )
            .expect("row count");

        assert_eq!(count, 1);
    }

    #[test]
    fn applescript_notification_script_escapes_special_characters() {
        let script = super::build_applescript_notification_script(
            "Daily \"Focus\"",
            "Line 1\nLine 2 \\ test",
        );

        assert_eq!(
            script,
            "display notification \"Line 1\\nLine 2 \\\\ test\" with title \"Daily \\\"Focus\\\"\""
        );
    }
}
