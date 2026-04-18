use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde::Deserialize;
use std::collections::HashSet;
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration as StdDuration, Instant};

const SYSTEM_CALENDAR_SOURCE: &str = "system_calendar";
const SYSTEM_CALENDAR_ICON: &str = "meeting";

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct SystemCalendarNativeEvent {
    pub id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub timezone: String,
    pub location: String,
    pub notes: String,
    pub is_all_day: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct ImportedSystemCalendarEvent {
    pub source_event_id: String,
    pub title: String,
    pub start_at: String,
    pub timezone: String,
    pub duration_minutes: i32,
    pub location: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct SystemCalendarSyncWindow {
    pub start_at: String,
    pub end_at: String,
}

pub(crate) fn default_sync_window(now: DateTime<Utc>) -> SystemCalendarSyncWindow {
    SystemCalendarSyncWindow {
        start_at: (now - Duration::days(30)).to_rfc3339_opts(SecondsFormat::Secs, true),
        end_at: (now + Duration::days(180)).to_rfc3339_opts(SecondsFormat::Secs, true),
    }
}

pub(crate) fn map_native_event(
    event: &SystemCalendarNativeEvent,
) -> Result<ImportedSystemCalendarEvent, String> {
    let start = DateTime::parse_from_rfc3339(&event.start_at)
        .map_err(|error| format!("invalid system calendar start_at: {error}"))?;
    let end = DateTime::parse_from_rfc3339(&event.end_at)
        .map_err(|error| format!("invalid system calendar end_at: {error}"))?;
    let safe_end = if end <= start {
        start + Duration::minutes(30)
    } else {
        end
    };

    let mut duration_minutes = (safe_end - start).num_minutes().max(30);
    if event.is_all_day {
        duration_minutes = duration_minutes.max(60);
    }

    let title = normalize_optional_text(&event.title)
        .unwrap_or_else(|| "系统日历".to_string());
    let timezone = normalize_optional_text(&event.timezone).unwrap_or_else(|| "UTC".to_string());

    Ok(ImportedSystemCalendarEvent {
        source_event_id: event.id.clone(),
        title,
        start_at: start.to_rfc3339(),
        timezone,
        duration_minutes: duration_minutes.min(i32::MAX as i64) as i32,
        location: normalize_optional_text(&event.location),
        notes: normalize_optional_text(&event.notes),
    })
}

pub(crate) fn sync_events(
    conn: &Connection,
    events: &[ImportedSystemCalendarEvent],
    window: &SystemCalendarSyncWindow,
) -> rusqlite::Result<()> {
    let incoming_ids = events
        .iter()
        .map(|event| event.source_event_id.clone())
        .collect::<HashSet<_>>();

    for event in events {
        upsert_event(conn, event)?;
    }

    let mut stmt = conn.prepare(
        "SELECT id, source_event_id FROM schedule_items
         WHERE source = ?1 AND start_at >= ?2 AND start_at <= ?3",
    )?;
    let existing_rows = stmt
        .query_map(
            params![SYSTEM_CALENDAR_SOURCE, window.start_at, window.end_at],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )?
        .collect::<Result<Vec<_>, _>>()?;

    for (schedule_id, source_event_id) in existing_rows {
        let Some(source_event_id) = source_event_id else {
            continue;
        };

        if !incoming_ids.contains(&source_event_id) {
            conn.execute("DELETE FROM schedule_items WHERE id = ?1", params![schedule_id])?;
        }
    }

    Ok(())
}

pub(crate) fn request_access() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        run_osascript(
            r#"
tell application "Calendar"
    count calendars
end tell
"#,
            &[],
        )?;

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("system calendar is unavailable on this platform".to_string())
    }
}

pub(crate) fn fetch_events(window: &SystemCalendarSyncWindow) -> Result<Vec<SystemCalendarNativeEvent>, String> {
    #[cfg(target_os = "macos")]
    {
        let calendar_count = system_calendar_count()?;
        let mut all_events = Vec::new();
        let mut success_count = 0usize;
        let mut failures = Vec::new();

        for index in 1..=calendar_count {
            let calendar_index = index.to_string();
            match run_osascript_with_timeout(
                FETCH_EVENTS_SCRIPT,
                &[&window.start_at, &window.end_at, &calendar_index],
                StdDuration::from_secs(8),
            ) {
                Ok(output) => {
                    let events = serde_json::from_str::<Vec<SystemCalendarNativeEvent>>(&output)
                        .map_err(|error| format!("failed to parse system calendar events: {error}"))?;
                    all_events.extend(events);
                    success_count += 1;
                }
                Err(error) => {
                    failures.push(format!("calendar #{index}: {error}"));
                }
            }
        }

        if success_count == 0 && !failures.is_empty() {
            return Err(failures.join("; "));
        }

        for failure in failures {
            eprintln!("[system-calendar] skipped {}", failure);
        }

        Ok(all_events)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
        Err("system calendar is unavailable on this platform".to_string())
    }
}

fn upsert_event(conn: &Connection, event: &ImportedSystemCalendarEvent) -> rusqlite::Result<()> {
    let now = crate::now_rfc3339();
    let columns = crate::schedule_items_columns(conn)?;
    let has_end_at = columns.contains("end_at");
    let end_at = if has_end_at {
        Some(crate::compute_end_at(&event.start_at, event.duration_minutes).map_err(to_sql_error)?)
    } else {
        None
    };

    let existing_id = conn
        .query_row(
            "SELECT id FROM schedule_items WHERE source = ?1 AND source_event_id = ?2 LIMIT 1",
            params![SYSTEM_CALENDAR_SOURCE, event.source_event_id],
            |row| row.get::<_, String>(0),
        )
        .ok();

    if let Some(existing_id) = existing_id {
        conn.execute(
            "UPDATE schedule_items
             SET title = ?1,
                 icon = ?2,
                 start_at = ?3,
                 timezone = ?4,
                 duration_minutes = ?5,
                 repeat_mode = 'none',
                 repeat_group_id = NULL,
                 location = ?6,
                 notes = ?7,
                 workspace_id = NULL,
                 priority = 'medium',
                 is_flexible = 0,
                 updated_at = ?8
             WHERE id = ?9",
            params![
                event.title,
                SYSTEM_CALENDAR_ICON,
                event.start_at,
                event.timezone,
                event.duration_minutes,
                event.location,
                event.notes,
                now,
                existing_id,
            ],
        )?;

        if let Some(end_at) = end_at {
            conn.execute(
                "UPDATE schedule_items SET end_at = ?1, updated_at = ?2 WHERE id = ?3",
                params![end_at, now, existing_id],
            )?;
        }

        return Ok(());
    }

    let schedule_id = crate::gen_id();
    if let Some(end_at) = end_at {
        conn.execute(
            "INSERT INTO schedule_items (
                id, source, source_event_id, title, icon, start_at, end_at, timezone,
                duration_minutes, repeat_mode, repeat_group_id, location, notes,
                workspace_id, priority, is_flexible, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
                ?9, 'none', NULL, ?10, ?11,
                NULL, 'medium', 0, ?12, ?12
            )",
            params![
                schedule_id,
                SYSTEM_CALENDAR_SOURCE,
                event.source_event_id,
                event.title,
                SYSTEM_CALENDAR_ICON,
                event.start_at,
                end_at,
                event.timezone,
                event.duration_minutes,
                event.location,
                event.notes,
                now,
            ],
        )?;
    } else {
        conn.execute(
            "INSERT INTO schedule_items (
                id, source, source_event_id, title, icon, start_at, timezone,
                duration_minutes, repeat_mode, repeat_group_id, location, notes,
                workspace_id, priority, is_flexible, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, 'none', NULL, ?9, ?10,
                NULL, 'medium', 0, ?11, ?11
            )",
            params![
                schedule_id,
                SYSTEM_CALENDAR_SOURCE,
                event.source_event_id,
                event.title,
                SYSTEM_CALENDAR_ICON,
                event.start_at,
                event.timezone,
                event.duration_minutes,
                event.location,
                event.notes,
                now,
            ],
        )?;
    }

    Ok(())
}

fn normalize_optional_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn to_sql_error(message: String) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
        std::io::ErrorKind::InvalidData,
        message,
    )))
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str, args: &[&str]) -> Result<String, String> {
    run_osascript_with_timeout(script, args, StdDuration::from_secs(15))
}

#[cfg(target_os = "macos")]
fn run_osascript_with_timeout(
    script: &str,
    args: &[&str],
    timeout: StdDuration,
) -> Result<String, String> {
    let mut command = Command::new("osascript");
    for line in script.lines() {
        command.arg("-e").arg(line);
    }
    for arg in args {
        command.arg(arg);
    }

    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    let deadline = Instant::now() + timeout;

    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(_) => break,
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("osascript timed out after {}s", timeout.as_secs()));
            }
            None => sleep(StdDuration::from_millis(50)),
        }
    }

    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("osascript exited with status {}", output.status)
    } else {
        stderr
    })
}

#[cfg(target_os = "macos")]
fn system_calendar_count() -> Result<usize, String> {
    let output = run_osascript(
        r#"
tell application "Calendar"
    count calendars
end tell
"#,
        &[],
    )?;

    output
        .trim()
        .parse::<usize>()
        .map_err(|error| format!("failed to parse system calendar count: {error}"))
}

#[cfg(target_os = "macos")]
const FETCH_EVENTS_SCRIPT: &str = r#"
use framework "Foundation"
use scripting additions

on makeFormatter()
    set formatter to current application's NSDateFormatter's alloc()'s init()
    formatter's setLocale:(current application's NSLocale's localeWithLocaleIdentifier:"en_US_POSIX")
    formatter's setTimeZone:(current application's NSTimeZone's timeZoneWithAbbreviation:"UTC")
    formatter's setDateFormat:"yyyy-MM-dd'T'HH:mm:ssXXX"
    return formatter
end makeFormatter

on safeText(rawValue)
    if rawValue is missing value then
        return ""
    end if
    return rawValue as string
end safeText

on run argv
    set startIso to item 1 of argv
    set endIso to item 2 of argv
    set targetCalendars to missing value
    set formatter to my makeFormatter()
    set startDateObj to formatter's dateFromString:startIso
    set endDateObj to formatter's dateFromString:endIso
    if startDateObj is missing value or endDateObj is missing value then
        error "Invalid sync window"
    end if
    set startDate to startDateObj as date
    set endDate to endDateObj as date
    if (count of argv) > 2 then
        set calendarIndex to (item 3 of argv) as integer
        using terms from application "Calendar"
            tell application "Calendar"
                set targetCalendars to {item calendarIndex of calendars}
            end tell
        end using terms from
    end if

    set payload to current application's NSMutableArray's alloc()'s init()

    using terms from application "Calendar"
        tell application "Calendar"
            if targetCalendars is missing value then
                set targetCalendars to calendars
            end if
            repeat with cal in targetCalendars
                repeat with evt in (every event of cal whose start date < endDate and end date > startDate)
                    set eventRef to contents of evt
                    set eventProps to properties of eventRef
                    set eventStartDate to start date of eventProps
                    set eventEndDate to end date of eventProps
                    set eventId to my safeText(uid of eventProps)
                    set eventTitle to my safeText(summary of eventProps)

                    set eventLocation to ""
                    try
                        set eventLocation to my safeText(location of eventProps)
                    end try

                    set eventNotes to ""
                    try
                        set eventNotes to my safeText(description of eventProps)
                    end try

                    set allDayValue to false
                    try
                        set allDayValue to allday event of eventProps
                    end try

                    if eventStartDate < endDate and eventEndDate > startDate then
                        set eventPayload to current application's NSMutableDictionary's alloc()'s init()
                        eventPayload's setObject:eventId forKey:"id"
                        eventPayload's setObject:eventTitle forKey:"title"
                        eventPayload's setObject:(formatter's stringFromDate:eventStartDate) forKey:"start_at"
                        eventPayload's setObject:(formatter's stringFromDate:eventEndDate) forKey:"end_at"

                        eventPayload's setObject:"UTC" forKey:"timezone"
                        eventPayload's setObject:eventLocation forKey:"location"
                        eventPayload's setObject:eventNotes forKey:"notes"
                        eventPayload's setObject:(current application's NSNumber's numberWithBool:allDayValue) forKey:"is_all_day"
                        payload's addObject:eventPayload
                    end if
                end repeat
            end repeat
        end tell
    end using terms from

    set jsonData to current application's NSJSONSerialization's dataWithJSONObject:payload options:0 |error|:(missing value)
    set jsonText to current application's NSString's alloc()'s initWithData:jsonData encoding:(current application's NSUTF8StringEncoding)
    return jsonText as string
end run
"#;

#[cfg(test)]
mod tests {
    #[test]
    fn fetch_script_resolves_event_references_before_reading_properties() {
        assert!(super::FETCH_EVENTS_SCRIPT.contains("contents of evt"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("using terms from application \"Calendar\""));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("every event of cal whose start date < endDate and end date > startDate"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set startDate to startDateObj as date"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set endDate to endDateObj as date"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("if (count of argv) > 2 then"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set eventProps to properties of eventRef"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set eventStartDate to start date of eventProps"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set eventEndDate to end date of eventProps"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("set allDayValue to allday event of eventProps"));
        assert!(super::FETCH_EVENTS_SCRIPT.contains("setObject:\"UTC\" forKey:\"timezone\""));
        assert!(!super::FETCH_EVENTS_SCRIPT.contains("repeat with evt in (every event of cal)"));
        assert!(!super::FETCH_EVENTS_SCRIPT.contains("localTimeZone()"));
        assert!(!super::FETCH_EVENTS_SCRIPT.contains("|start date|"));
    }
}
