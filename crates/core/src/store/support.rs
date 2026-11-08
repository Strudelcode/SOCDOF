//! Support ticket persistence and tracked working time.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::support::{SupportTicket, TicketPriority, TicketStatus, TimeEntry};
use crate::error::{CoreError, CoreResult};

const TICKET_COLUMNS: &str = "id, contact_id, subject, description, status, priority, created_at, \
                              updated_at, closed_at";
const TIME_COLUMNS: &str = "id, ticket_id, user_id, description, minutes, started_at, created_at, \
                            updated_at";

/// Inserts a support ticket.
pub fn insert_ticket(conn: &Connection, ticket: &SupportTicket) -> CoreResult<()> {
    ticket.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO support_tickets (id, contact_id, subject, description, status, priority,
            created_at, updated_at, closed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            ticket.id.to_string(),
            ticket.contact_id.map(|id| id.to_string()),
            ticket.subject,
            ticket.description,
            ticket.status.as_str(),
            ticket.priority.as_str(),
            ticket.created_at,
            ticket.updated_at,
            ticket.closed_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing ticket.
pub fn update_ticket(conn: &Connection, ticket: &SupportTicket) -> CoreResult<()> {
    ticket.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE support_tickets SET contact_id = ?2, subject = ?3, description = ?4, status = ?5,
            priority = ?6, updated_at = ?7, closed_at = ?8
         WHERE id = ?1",
        params![
            ticket.id.to_string(),
            ticket.contact_id.map(|id| id.to_string()),
            ticket.subject,
            ticket.description,
            ticket.status.as_str(),
            ticket.priority.as_str(),
            ticket.updated_at,
            ticket.closed_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(ticket.id.to_string()));
    }

    Ok(())
}

/// Changes the status of a ticket and maintains its closing time.
pub fn set_ticket_status(
    conn: &Connection,
    id: Uuid,
    status: TicketStatus,
    now: i64,
) -> CoreResult<()> {
    let closed_at = if status == TicketStatus::Closed {
        Some(now)
    } else {
        None
    };

    let changed = conn.execute(
        "UPDATE support_tickets SET status = ?2, closed_at = ?3, updated_at = ?4 WHERE id = ?1",
        params![id.to_string(), status.as_str(), closed_at, now],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }

    Ok(())
}

/// Loads one ticket.
pub fn find_ticket(conn: &Connection, id: Uuid) -> CoreResult<Option<SupportTicket>> {
    let sql = format!("SELECT {TICKET_COLUMNS} FROM support_tickets WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_ticket)
        .optional()?)
}

/// Loads all tickets, newest first.
pub fn list_tickets(conn: &Connection) -> CoreResult<Vec<SupportTicket>> {
    let sql = format!("SELECT {TICKET_COLUMNS} FROM support_tickets ORDER BY created_at DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_ticket)?;

    let mut tickets = Vec::new();
    for row in rows {
        tickets.push(row?);
    }
    Ok(tickets)
}

/// Loads all tickets that still need attention.
pub fn list_open_tickets(conn: &Connection) -> CoreResult<Vec<SupportTicket>> {
    let sql = format!(
        "SELECT {TICKET_COLUMNS} FROM support_tickets WHERE status != 'closed' \
         ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 \
         ELSE 3 END, created_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_ticket)?;

    let mut tickets = Vec::new();
    for row in rows {
        tickets.push(row?);
    }
    Ok(tickets)
}

/// Removes a ticket together with its time entries.
pub fn delete_ticket(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM support_tickets WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Inserts a block of tracked time.
pub fn insert_time_entry(conn: &Connection, entry: &TimeEntry) -> CoreResult<()> {
    entry.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO time_entries (id, ticket_id, user_id, description, minutes, started_at,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            entry.id.to_string(),
            entry.ticket_id.map(|id| id.to_string()),
            entry.user_id.map(|id| id.to_string()),
            entry.description,
            entry.minutes,
            entry.started_at,
            entry.created_at,
            entry.updated_at,
        ],
    )?;

    Ok(())
}

/// Loads the time entries of one ticket, oldest first.
pub fn list_time_entries(conn: &Connection, ticket_id: Uuid) -> CoreResult<Vec<TimeEntry>> {
    let sql =
        format!("SELECT {TIME_COLUMNS} FROM time_entries WHERE ticket_id = ?1 ORDER BY started_at");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![ticket_id.to_string()], map_time_entry)?;
    collect_time_entries(rows)
}

/// Loads all time entries that started in the half-open range `[from, to)`.
pub fn list_time_entries_between(
    conn: &Connection,
    from: i64,
    to: i64,
) -> CoreResult<Vec<TimeEntry>> {
    let sql = format!(
        "SELECT {TIME_COLUMNS} FROM time_entries WHERE started_at >= ?1 AND started_at < ?2 \
         ORDER BY started_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![from, to], map_time_entry)?;
    collect_time_entries(rows)
}

/// Sum of all tracked minutes of a ticket.
pub fn total_minutes(conn: &Connection, ticket_id: Uuid) -> CoreResult<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(minutes), 0) FROM time_entries WHERE ticket_id = ?1",
        params![ticket_id.to_string()],
        |row| row.get(0),
    )?;
    Ok(total)
}

/// Removes a time entry.
pub fn delete_time_entry(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM time_entries WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn collect_time_entries(
    rows: rusqlite::MappedRows<'_, impl FnMut(&Row<'_>) -> rusqlite::Result<TimeEntry>>,
) -> CoreResult<Vec<TimeEntry>> {
    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }
    Ok(entries)
}

fn map_ticket(row: &Row<'_>) -> rusqlite::Result<SupportTicket> {
    let id_text: String = row.get("id")?;
    let contact_text: Option<String> = row.get("contact_id")?;
    let status_text: String = row.get("status")?;
    let priority_text: String = row.get("priority")?;

    Ok(SupportTicket {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        contact_id: contact_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        subject: row.get("subject")?,
        description: row.get("description")?,
        status: TicketStatus::from_storage(&status_text).unwrap_or(TicketStatus::Open),
        priority: TicketPriority::from_storage(&priority_text).unwrap_or(TicketPriority::Normal),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        closed_at: row.get("closed_at")?,
    })
}

fn map_time_entry(row: &Row<'_>) -> rusqlite::Result<TimeEntry> {
    let id_text: String = row.get("id")?;
    let ticket_text: Option<String> = row.get("ticket_id")?;
    let user_text: Option<String> = row.get("user_id")?;

    Ok(TimeEntry {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        ticket_id: ticket_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        user_id: user_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        description: row.get("description")?,
        minutes: row.get("minutes")?,
        started_at: row.get("started_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
