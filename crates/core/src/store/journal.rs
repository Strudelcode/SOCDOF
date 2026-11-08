//! Journal persistence for the accounting module.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::accounting::{BookingChannel, JournalEntry, JournalKind};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const COLUMNS: &str = "id, booked_at, description, account, counter_account, amount_cents, \
    tax_rate_bp, kind, channel, reference, created_at, updated_at";

/// Inserts one journal entry.
pub fn insert(conn: &Connection, entry: &JournalEntry) -> CoreResult<()> {
    entry.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO journal_entries (id, booked_at, description, account, counter_account,
            amount_cents, tax_rate_bp, kind, channel, reference, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            entry.id.to_string(),
            entry.booked_at,
            entry.description,
            entry.account,
            entry.counter_account,
            entry.amount.cents(),
            entry.tax_rate_bp,
            entry.kind.as_str(),
            entry.channel.as_str(),
            entry.reference,
            entry.created_at,
            entry.updated_at,
        ],
    )?;
    Ok(())
}

/// Loads one entry.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<JournalEntry>> {
    let sql = format!("SELECT {COLUMNS} FROM journal_entries WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Lists every entry, newest first.
pub fn list(conn: &Connection) -> CoreResult<Vec<JournalEntry>> {
    query(conn, &format!("SELECT {COLUMNS} FROM journal_entries"), [])
}

/// Lists entries inside a half-open booking range, newest first.
pub fn between(conn: &Connection, from: i64, to: i64) -> CoreResult<Vec<JournalEntry>> {
    query(
        conn,
        &format!("SELECT {COLUMNS} FROM journal_entries WHERE booked_at >= ?1 AND booked_at < ?2"),
        params![from, to],
    )
}

/// Substring search over description, both accounts and the reference.
pub fn search(conn: &Connection, term: &str) -> CoreResult<Vec<JournalEntry>> {
    let pattern = format!("%{}%", term.trim().to_lowercase());
    query(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM journal_entries
             WHERE lower(coalesce(description, '') || ' ' || coalesce(account, '') || ' ' ||
                 coalesce(counter_account, '') || ' ' || coalesce(reference, '')) LIKE ?1"
        ),
        params![pattern],
    )
}

fn query<P: rusqlite::Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> CoreResult<Vec<JournalEntry>> {
    let mut statement = conn.prepare(&format!(
        "{sql} ORDER BY booked_at DESC, created_at DESC, id"
    ))?;
    let rows = statement.query_map(params, map_row)?;
    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }
    Ok(entries)
}

/// Replaces an existing entry.
pub fn update(conn: &Connection, entry: &JournalEntry) -> CoreResult<()> {
    entry.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE journal_entries SET booked_at = ?2, description = ?3, account = ?4,
            counter_account = ?5, amount_cents = ?6, tax_rate_bp = ?7, kind = ?8,
            channel = ?9, reference = ?10, updated_at = ?11 WHERE id = ?1",
        params![
            entry.id.to_string(),
            entry.booked_at,
            entry.description,
            entry.account,
            entry.counter_account,
            entry.amount.cents(),
            entry.tax_rate_bp,
            entry.kind.as_str(),
            entry.channel.as_str(),
            entry.reference,
            entry.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(entry.id.to_string()));
    }
    Ok(())
}

/// Removes an entry.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM journal_entries WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Number of journal entries.
pub fn count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM journal_entries", [], |row| row.get(0))?)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<JournalEntry> {
    let id_text: String = row.get("id")?;
    let kind_text: String = row.get("kind")?;
    let channel_text: String = row.get("channel")?;

    Ok(JournalEntry {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        booked_at: row.get("booked_at")?,
        description: row.get("description")?,
        account: row.get("account")?,
        counter_account: row.get("counter_account")?,
        amount: Money::from_cents(row.get("amount_cents")?),
        tax_rate_bp: row.get("tax_rate_bp")?,
        kind: JournalKind::from_storage(&kind_text).unwrap_or(JournalKind::Income),
        channel: BookingChannel::from_storage(&channel_text).unwrap_or(BookingChannel::Bank),
        reference: row.get("reference")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
