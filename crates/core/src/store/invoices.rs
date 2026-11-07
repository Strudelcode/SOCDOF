//! Invoice persistence, including positions written in the same transaction.

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const COLUMNS: &str = "id, number, contact_id, status, issued_at, due_at, currency_symbol, note";

/// Inserts an invoice and all of its positions atomically.
pub fn insert(conn: &Connection, invoice: &Invoice) -> CoreResult<()> {
    invoice.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;

    transaction.execute(
        "INSERT INTO invoices (id, number, contact_id, status, issued_at, due_at, currency_symbol, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            invoice.id.to_string(),
            invoice.number,
            invoice.contact_id.to_string(),
            invoice.status.as_str(),
            invoice.issued_at,
            invoice.due_at,
            invoice.currency_symbol,
            invoice.note,
        ],
    )?;

    for (position, line) in invoice.lines.iter().enumerate() {
        transaction.execute(
            "INSERT INTO invoice_lines (invoice_id, position, description, quantity_milli,
                unit_price_cents, tax_rate_bp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                invoice.id.to_string(),
                position as i64,
                line.description,
                line.quantity_milli,
                line.unit_price.cents(),
                line.tax_rate_bp,
            ],
        )?;
    }

    transaction.commit()?;
    Ok(())
}

/// Loads all invoices with their positions.
pub fn list(conn: &Connection) -> CoreResult<Vec<Invoice>> {
    let sql = format!("SELECT {COLUMNS} FROM invoices ORDER BY issued_at DESC, number DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut invoices = Vec::new();
    for row in rows {
        let mut invoice = row?;
        invoice.lines = lines_for(conn, invoice.id)?;
        invoices.push(invoice);
    }
    Ok(invoices)
}

/// Removes an invoice and its positions.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM invoices WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn lines_for(conn: &Connection, invoice_id: Uuid) -> CoreResult<Vec<InvoiceLine>> {
    let mut statement = conn.prepare(
        "SELECT description, quantity_milli, unit_price_cents, tax_rate_bp
         FROM invoice_lines WHERE invoice_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![invoice_id.to_string()], |row| {
        Ok(InvoiceLine {
            description: row.get("description")?,
            quantity_milli: row.get("quantity_milli")?,
            unit_price: Money::from_cents(row.get("unit_price_cents")?),
            tax_rate_bp: row.get("tax_rate_bp")?,
        })
    })?;

    let mut lines = Vec::new();
    for row in rows {
        lines.push(row?);
    }
    Ok(lines)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Invoice> {
    let id_text: String = row.get("id")?;
    let contact_text: String = row.get("contact_id")?;
    let status_text: String = row.get("status")?;

    Ok(Invoice {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        number: row.get("number")?,
        contact_id: Uuid::parse_str(&contact_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        status: InvoiceStatus::from_storage(&status_text).unwrap_or(InvoiceStatus::Draft),
        issued_at: row.get("issued_at")?,
        due_at: row.get("due_at")?,
        currency_symbol: row.get("currency_symbol")?,
        note: row.get("note")?,
        lines: Vec::new(),
    })
}
