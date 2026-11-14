//! Therapy clients and sessions with their invoice link.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::therapy::{TherapyClient, TherapySession, TherapyTrip};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const CLIENT_COLUMNS: &str =
    "id, name, email, phone, hourly_rate_cents, kilometer_rate_cents, notes, active, created_at, \
     updated_at";
const SESSION_COLUMNS: &str =
    "id, client_id, started_at, minutes, kilometers_milli, notes, invoice_id, created_at, \
     updated_at";

/// Inserts a therapy client.
pub fn insert_client(conn: &Connection, client: &TherapyClient) -> CoreResult<()> {
    client.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO therapy_clients (id, name, email, phone, hourly_rate_cents,
            kilometer_rate_cents, notes, active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            client.id.to_string(),
            client.name.trim(),
            client.email,
            client.phone,
            client.hourly_rate.cents(),
            client.kilometer_rate.cents(),
            client.notes,
            client.active as i64,
            client.created_at,
            client.updated_at,
        ],
    )?;
    Ok(())
}

/// Replaces an existing therapy client.
pub fn update_client(conn: &Connection, client: &TherapyClient) -> CoreResult<()> {
    client.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE therapy_clients SET name = ?2, email = ?3, phone = ?4, hourly_rate_cents = ?5,
            kilometer_rate_cents = ?6, notes = ?7, active = ?8, updated_at = ?9
         WHERE id = ?1",
        params![
            client.id.to_string(),
            client.name.trim(),
            client.email,
            client.phone,
            client.hourly_rate.cents(),
            client.kilometer_rate.cents(),
            client.notes,
            client.active as i64,
            client.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(client.id.to_string()));
    }
    Ok(())
}

/// Removes a client together with its sessions.
pub fn delete_client(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM therapy_clients WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads one client.
pub fn find_client(conn: &Connection, id: Uuid) -> CoreResult<Option<TherapyClient>> {
    let sql = format!("SELECT {CLIENT_COLUMNS} FROM therapy_clients WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_client)
        .optional()?)
}

/// Loads all clients, active first and then by name.
pub fn list_clients(conn: &Connection) -> CoreResult<Vec<TherapyClient>> {
    let sql = format!(
        "SELECT {CLIENT_COLUMNS} FROM therapy_clients ORDER BY active DESC, name COLLATE NOCASE"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_client)?;
    let mut clients = Vec::new();
    for row in rows {
        clients.push(row?);
    }
    Ok(clients)
}

/// Inserts a session.
pub fn insert_session(conn: &Connection, session: &TherapySession) -> CoreResult<()> {
    session.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO therapy_sessions (id, client_id, started_at, minutes, kilometers_milli,
            notes, invoice_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            session.id.to_string(),
            session.client_id.to_string(),
            session.started_at,
            session.minutes,
            session.kilometers_milli,
            session.notes,
            session.invoice_id.map(|id| id.to_string()),
            session.created_at,
            session.updated_at,
        ],
    )?;
    Ok(())
}

/// Replaces an existing session.
pub fn update_session(conn: &Connection, session: &TherapySession) -> CoreResult<()> {
    session.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE therapy_sessions SET started_at = ?2, minutes = ?3, kilometers_milli = ?4,
            notes = ?5, invoice_id = ?6, updated_at = ?7
         WHERE id = ?1",
        params![
            session.id.to_string(),
            session.started_at,
            session.minutes,
            session.kilometers_milli,
            session.notes,
            session.invoice_id.map(|id| id.to_string()),
            session.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(session.id.to_string()));
    }
    Ok(())
}

/// Removes a session.
pub fn delete_session(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM therapy_sessions WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads the sessions of one client, newest first.
pub fn sessions_for_client(conn: &Connection, client_id: Uuid) -> CoreResult<Vec<TherapySession>> {
    let sql = format!(
        "SELECT {SESSION_COLUMNS} FROM therapy_sessions WHERE client_id = ?1 \
         ORDER BY started_at DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![client_id.to_string()], map_session)?;
    collect_sessions(rows)
}

/// Loads all sessions that started in the half-open range `[from, to)`.
pub fn sessions_between(conn: &Connection, from: i64, to: i64) -> CoreResult<Vec<TherapySession>> {
    let sql = format!(
        "SELECT {SESSION_COLUMNS} FROM therapy_sessions WHERE started_at >= ?1 AND started_at < ?2 \
         ORDER BY started_at"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![from, to], map_session)?;
    collect_sessions(rows)
}

/// Number of sessions of a client.
pub fn session_count(conn: &Connection, client_id: Uuid) -> CoreResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM therapy_sessions WHERE client_id = ?1",
        params![client_id.to_string()],
        |row| row.get(0),
    )?)
}

/// Puts every still open session of a client on one invoice.
pub fn link_invoice(
    conn: &Connection,
    client_id: Uuid,
    invoice_id: Uuid,
    now: i64,
) -> CoreResult<usize> {
    let changed = conn.execute(
        "UPDATE therapy_sessions SET invoice_id = ?2, updated_at = ?3
         WHERE client_id = ?1 AND invoice_id IS NULL",
        params![client_id.to_string(), invoice_id.to_string(), now],
    )?;
    Ok(changed)
}

/// Inserts one practice trip.
pub fn insert_trip(conn: &Connection, trip: &TherapyTrip) -> CoreResult<()> {
    trip.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO therapy_trips
            (id, client_id, date, departure, destination, purpose, start_km_milli,
             end_km_milli, rate_cents_per_km)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            trip.id.to_string(),
            trip.client_id.map(|id| id.to_string()),
            trip.date,
            trip.departure.trim(),
            trip.destination.trim(),
            trip.purpose.trim(),
            trip.start_km_milli,
            trip.end_km_milli,
            trip.rate_cents_per_km,
        ],
    )?;
    Ok(())
}

/// Replaces an existing practice trip.
pub fn update_trip(conn: &Connection, trip: &TherapyTrip) -> CoreResult<()> {
    trip.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE therapy_trips SET client_id = ?2, date = ?3, departure = ?4,
            destination = ?5, purpose = ?6, start_km_milli = ?7, end_km_milli = ?8,
            rate_cents_per_km = ?9 WHERE id = ?1",
        params![
            trip.id.to_string(),
            trip.client_id.map(|id| id.to_string()),
            trip.date,
            trip.departure.trim(),
            trip.destination.trim(),
            trip.purpose.trim(),
            trip.start_km_milli,
            trip.end_km_milli,
            trip.rate_cents_per_km,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(trip.id.to_string()));
    }
    Ok(())
}

/// Deletes one practice trip.
pub fn delete_trip(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM therapy_trips WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads all practice trips, newest first.
pub fn list_trips(conn: &Connection) -> CoreResult<Vec<TherapyTrip>> {
    let mut statement = conn.prepare(
        "SELECT id, client_id, date, departure, destination, purpose, start_km_milli,
                end_km_milli, rate_cents_per_km
         FROM therapy_trips ORDER BY date DESC, rowid DESC",
    )?;
    let rows = statement.query_map([], |row| {
        let id: String = row.get("id")?;
        let client_id: Option<String> = row.get("client_id")?;
        Ok(TherapyTrip {
            id: Uuid::parse_str(&id).map_err(|_| rusqlite::Error::InvalidQuery)?,
            client_id: client_id
                .as_deref()
                .and_then(|value| Uuid::parse_str(value).ok()),
            date: row.get("date")?,
            departure: row.get("departure")?,
            destination: row.get("destination")?,
            purpose: row.get("purpose")?,
            start_km_milli: row.get("start_km_milli")?,
            end_km_milli: row.get("end_km_milli")?,
            rate_cents_per_km: row.get("rate_cents_per_km")?,
        })
    })?;
    let mut trips = Vec::new();
    for row in rows {
        trips.push(row?);
    }
    Ok(trips)
}

fn collect_sessions(
    rows: rusqlite::MappedRows<'_, impl FnMut(&Row<'_>) -> rusqlite::Result<TherapySession>>,
) -> CoreResult<Vec<TherapySession>> {
    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row?);
    }
    Ok(sessions)
}

fn map_client(row: &Row<'_>) -> rusqlite::Result<TherapyClient> {
    let id_text: String = row.get("id")?;
    Ok(TherapyClient {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        name: row.get("name")?,
        email: row.get("email")?,
        phone: row.get("phone")?,
        hourly_rate: Money::from_cents(row.get("hourly_rate_cents")?),
        kilometer_rate: Money::from_cents(row.get("kilometer_rate_cents")?),
        notes: row.get("notes")?,
        active: row.get::<_, i64>("active")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_session(row: &Row<'_>) -> rusqlite::Result<TherapySession> {
    let id_text: String = row.get("id")?;
    let client_text: String = row.get("client_id")?;
    let invoice_text: Option<String> = row.get("invoice_id")?;
    Ok(TherapySession {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        client_id: Uuid::parse_str(&client_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        started_at: row.get("started_at")?,
        minutes: row.get("minutes")?,
        kilometers_milli: row.get("kilometers_milli")?,
        notes: row.get("notes")?,
        invoice_id: invoice_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[cfg(test)]
mod trip_tests {
    use super::*;
    use crate::domain::therapy::TherapyTrip;
    use crate::money::Money;
    use crate::store::Store;

    fn trip(client_id: Option<Uuid>) -> TherapyTrip {
        TherapyTrip {
            id: Uuid::new_v4(),
            client_id,
            date: "2026-11-14".to_string(),
            departure: "Praxis".to_string(),
            destination: "Bozen".to_string(),
            purpose: "Hausbesuch".to_string(),
            start_km_milli: 12_500_000,
            end_km_milli: 12_542_000,
            rate_cents_per_km: 38,
        }
    }

    #[test]
    fn practice_trip_roundtrips_and_keeps_its_individual_rate() {
        let store = Store::open_in_memory().expect("store");
        let mut client = TherapyClient::new(1);
        client.name = "Klient".to_string();
        client.hourly_rate = Money::from_cents(9_000);
        store.insert_therapy_client(&client).expect("client");

        let mut trip = trip(Some(client.id));
        assert_eq!(trip.distance_km_milli(), 42_000);
        assert_eq!(trip.reimbursement(), Money::from_cents(1_596));
        store.insert_therapy_trip(&trip).expect("insert");
        assert_eq!(store.therapy_trips().expect("list"), vec![trip.clone()]);

        trip.rate_cents_per_km = 42;
        trip.purpose = "Folgetermin".to_string();
        store.update_therapy_trip(&trip).expect("update");
        assert_eq!(store.therapy_trips().expect("reload"), vec![trip.clone()]);
        assert_eq!(trip.reimbursement(), Money::from_cents(1_764));

        store.delete_therapy_trip(trip.id).expect("delete");
        assert!(store.therapy_trips().expect("empty").is_empty());
    }

    #[test]
    fn deleting_a_client_preserves_trip_history_and_clears_its_link() {
        let store = Store::open_in_memory().expect("store");
        let mut client = TherapyClient::new(1);
        client.name = "Klient".to_string();
        store.insert_therapy_client(&client).expect("client");
        let trip = trip(Some(client.id));
        store.insert_therapy_trip(&trip).expect("trip");

        store.delete_therapy_client(client.id).expect("delete client");
        let stored = store.therapy_trips().expect("trips");
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].id, trip.id);
        assert_eq!(stored[0].client_id, None);
    }

    #[test]
    fn rejects_invalid_practice_trip_values() {
        let store = Store::open_in_memory().expect("store");
        let mut trip = trip(None);
        trip.date = "2026-13-40".to_string();
        assert!(store.insert_therapy_trip(&trip).is_err());
        trip.date = "2026-11-14".to_string();
        trip.rate_cents_per_km = -1;
        assert!(store.insert_therapy_trip(&trip).is_err());
    }
}
