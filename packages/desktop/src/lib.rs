use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;

fn schedule_items_columns(conn: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = conn.prepare("PRAGMA table_info(schedule_items)")?;
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
    pub priority: Option<String>,
    pub is_flexible: Option<bool>,
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

#[tauri::command]
fn get_schedules() -> Result<Vec<ScheduleItem>, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, priority, is_flexible, created_at, updated_at FROM schedule_items ORDER BY start_at")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
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
                priority: row.get(11)?,
                is_flexible: row.get::<_, i32>(12)? != 0,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
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
            "INSERT INTO schedule_items (id, source, title, icon, start_at, end_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, priority, is_flexible, created_at, updated_at) VALUES (?1, 'manual', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
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
                input.priority,
                input.is_flexible as i32,
                now,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO schedule_items (id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, priority, is_flexible, created_at, updated_at) VALUES (?1, 'manual', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
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
    if let Some(is_flexible) = input.is_flexible {
        conn.execute(
            "UPDATE schedule_items SET is_flexible = ?1, updated_at = ?2 WHERE id = ?3",
            params![is_flexible as i32, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT id, source, title, icon, start_at, timezone, duration_minutes, repeat_mode, repeat_group_id, location, notes, priority, is_flexible, created_at, updated_at FROM schedule_items WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let item = stmt
        .query_row(params![id], |row| {
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
                priority: row.get(11)?,
                is_flexible: row.get::<_, i32>(12)? != 0,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![
            get_schedules,
            create_schedule,
            update_schedule,
            delete_schedule,
            delete_all_schedules,
            get_setting,
            set_setting,
            get_all_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
