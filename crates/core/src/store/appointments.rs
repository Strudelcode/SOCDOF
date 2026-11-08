//! Appointment persistence and calendar range queries.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::appointment::{Appointment, AppointmentStatus};
use crate::error::{CoreError, CoreResult};

const COLUMNS: &str = "id, contact_id, title, location, notes, status, starts_at, ends_at, \
                       created_at, updated_at";

/// Inserts an appointment.
pub fn insert(conn: &Connection, appointment: &Appointment) -> CoreResult<()> {
    appointment.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO appointments (id, contact_id, title, location, notes, status, starts_at,
            ends_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            appointment.id.to_string(),
            appointment.contact_id.map(|id| id.to_string()),
            appointment.title,
            appointment.location,
            appointment.notes,
            appointment.status.as_str(),
            appointment.starts_at,
            appointment.ends_at,
            appointment.created_at,
            appointment.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing appointment.
pub fn update(conn: &Connection, appointment: &Appointment) -> CoreResult<()> {
    appointment.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE appointments SET contact_id = ?2, title = ?3, location = ?4, notes = ?5,
            status = ?6, starts_at = ?7, ends_at = ?8, updated_at = ?9
         WHERE id = ?1",
        params![
            appointment.id.to_string(),
            appointment.contact_id.map(|id| id.to_string()),
            appointment.title,
            appointment.location,
            appointment.notes,
            appointment.status.as_str(),
            appointment.starts_at,
            appointment.ends_at,
            appointment.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(appointment.id.to_string()));
    }

    Ok(())
}

/// Loads one appointment.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Appointment>> {
    let sql = format!("SELECT {COLUMNS} FROM appointments WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Loads all appointments ordered by start.
pub fn list(conn: &Connection) -> CoreResult<Vec<Appointment>> {
    let sql = format!("SELECT {COLUMNS} FROM appointments ORDER BY starts_at");
    let mut statement = conn.prepare(&sql)?;
    let appointments = collect(statement.query_map([], map_row)?);
    appointments
}

/// Loads every appointment that overlaps the half-open range `[from, to)`.
pub fn list_between(conn: &Connection, from: i64, to: i64) -> CoreResult<Vec<Appointment>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM appointments WHERE starts_at < ?2 AND ends_at > ?1 \
         ORDER BY starts_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let appointments = collect(statement.query_map(params![from, to], map_row)?);
    appointments
}

/// Searches title, location and notes inside the half-open range `[from, to)`.
pub fn search_between(
    conn: &Connection,
    term: &str,
    from: i64,
    to: i64,
) -> CoreResult<Vec<Appointment>> {
    let pattern = format!("%{}%", term.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM appointments
         WHERE starts_at < ?2 AND ends_at > ?1
           AND lower(coalesce(title, '') || ' ' || coalesce(location, '') || ' ' ||
                     coalesce(notes, '')) LIKE ?3
         ORDER BY starts_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let appointments = collect(statement.query_map(params![from, to, pattern], map_row)?);
    appointments
}

/// Loads open appointments that overlap the given appointment, excluding itself.
pub fn conflicts(conn: &Connection, appointment: &Appointment) -> CoreResult<Vec<Appointment>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM appointments
         WHERE id <> ?1 AND starts_at < ?3 AND ends_at > ?2
           AND status IN ('scheduled', 'confirmed')
         ORDER BY starts_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let appointments = collect(statement.query_map(
        params![
            appointment.id.to_string(),
            appointment.starts_at,
            appointment.ends_at
        ],
        map_row,
    )?);
    appointments
}

/// Removes an appointment.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM appointments WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn collect(
    rows: rusqlite::MappedRows<'_, impl FnMut(&Row<'_>) -> rusqlite::Result<Appointment>>,
) -> CoreResult<Vec<Appointment>> {
    let mut appointments = Vec::new();
    for row in rows {
        appointments.push(row?);
    }
    Ok(appointments)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Appointment> {
    let id_text: String = row.get("id")?;
    let contact_text: Option<String> = row.get("contact_id")?;
    let status_text: String = row.get("status")?;

    Ok(Appointment {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        contact_id: contact_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        title: row.get("title")?,
        location: row.get("location")?,
        notes: row.get("notes")?,
        status: AppointmentStatus::from_storage(&status_text)
            .unwrap_or(AppointmentStatus::Scheduled),
        starts_at: row.get("starts_at")?,
        ends_at: row.get("ends_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
