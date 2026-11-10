//! Invoice persistence, including positions written in the same transaction.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use crate::domain::payment::{InvoicePayment, PaymentMethod};
use crate::domain::stock::StockMove;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::store::products;

const COLUMNS: &str = "id, number, contact_id, status, issued_at, due_at, currency_symbol, note";

/// Inserts an invoice and all of its positions atomically.
pub fn insert(conn: &Connection, invoice: &Invoice) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;
    insert_rows(&transaction, invoice)?;
    transaction.commit()?;
    Ok(())
}

/// Inserts an invoice, its positions and the stock movements it causes in one transaction.
///
/// Selling more than is in stock rejects the whole invoice, so the document and the stock history
/// can never disagree.
pub fn insert_with_stock(
    conn: &Connection,
    invoice: &Invoice,
    movements: &[StockMove],
) -> CoreResult<()> {
    invoice.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;
    insert_rows(&transaction, invoice)?;
    for movement in movements {
        products::apply_stock(&transaction, movement)?;
    }
    transaction.commit()?;
    Ok(())
}

/// Writes the invoice and its positions without opening a transaction of its own.
pub(crate) fn insert_rows(conn: &Connection, invoice: &Invoice) -> CoreResult<()> {
    invoice.validate().map_err(CoreError::Validation)?;

    conn.execute(
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

    insert_lines(conn, invoice)?;
    Ok(())
}

fn insert_lines(conn: &Connection, invoice: &Invoice) -> CoreResult<()> {
    for (position, line) in invoice.lines.iter().enumerate() {
        conn.execute(
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

    Ok(())
}

/// Replaces an invoice header and all of its positions in one transaction.
pub fn update(conn: &Connection, invoice: &Invoice) -> CoreResult<()> {
    invoice.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;
    let changed = transaction.execute(
        "UPDATE invoices SET number = ?2, contact_id = ?3, status = ?4, issued_at = ?5,
            due_at = ?6, currency_symbol = ?7, note = ?8 WHERE id = ?1",
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
    if changed == 0 {
        return Err(CoreError::NotFound(invoice.id.to_string()));
    }

    transaction.execute(
        "DELETE FROM invoice_lines WHERE invoice_id = ?1",
        params![invoice.id.to_string()],
    )?;
    insert_lines(&transaction, invoice)?;
    transaction.commit()?;
    Ok(())
}

/// Writes only the lifecycle state of an invoice.
pub fn set_status(conn: &Connection, id: Uuid, status: InvoiceStatus) -> CoreResult<()> {
    let changed = conn.execute(
        "UPDATE invoices SET status = ?2 WHERE id = ?1",
        params![id.to_string(), status.as_str()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Records the payment of an invoice and marks it paid in the same transaction.
pub fn record_payment(conn: &Connection, payment: &InvoicePayment) -> CoreResult<()> {
    let changed = conn.execute(
        "UPDATE invoices SET status = ?2 WHERE id = ?1",
        params![payment.invoice_id.to_string(), InvoiceStatus::Paid.as_str()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(payment.invoice_id.to_string()));
    }

    conn.execute(
        "INSERT INTO invoice_payments (invoice_id, paid_at, method, reference, tse_signature)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(invoice_id) DO UPDATE SET paid_at = excluded.paid_at,
            method = excluded.method, reference = excluded.reference,
            tse_signature = excluded.tse_signature",
        params![
            payment.invoice_id.to_string(),
            payment.paid_at,
            payment.method.as_str(),
            payment.reference,
            payment.tse_signature,
        ],
    )?;
    Ok(())
}

/// Payment recorded for an invoice, if any.
pub fn payment(conn: &Connection, id: Uuid) -> CoreResult<Option<InvoicePayment>> {
    let row = conn
        .query_row(
            "SELECT invoice_id, paid_at, method, reference, tse_signature
             FROM invoice_payments WHERE invoice_id = ?1",
            params![id.to_string()],
            |row| {
                let invoice_text: String = row.get("invoice_id")?;
                let method: String = row.get("method")?;
                Ok((
                    invoice_text,
                    row.get::<_, i64>("paid_at")?,
                    method,
                    row.get::<_, String>("reference")?,
                    row.get::<_, Option<String>>("tse_signature")?,
                ))
            },
        )
        .optional()?;

    let Some((invoice_text, paid_at, method, reference, tse_signature)) = row else {
        return Ok(None);
    };
    let invoice_id =
        Uuid::parse_str(&invoice_text).map_err(|_| CoreError::NotFound(invoice_text))?;
    Ok(Some(InvoicePayment {
        invoice_id,
        paid_at,
        method: PaymentMethod::from_storage(&method).unwrap_or(PaymentMethod::Transfer),
        reference,
        tse_signature,
    }))
}

/// Loads one invoice with its positions.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Invoice>> {
    let sql = format!("SELECT {COLUMNS} FROM invoices WHERE id = ?1");
    let Some(mut invoice) = conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?
    else {
        return Ok(None);
    };
    invoice.lines = lines_for(conn, invoice.id)?;
    Ok(Some(invoice))
}

/// Substring search over invoice numbers, notes and position descriptions.
///
/// This is the fallback of the FTS5 search: a term inside a longer token (for example `0001` in
/// `2026-0001`) is only found here.
pub fn search(conn: &Connection, query: &str) -> CoreResult<Vec<Invoice>> {
    let term = format!("%{}%", query.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM invoices
         WHERE lower(coalesce(number, '') || ' ' || coalesce(note, '')) LIKE ?1
            OR EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = invoices.id
                       AND lower(l.description) LIKE ?1)
         ORDER BY issued_at DESC, number DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![term], map_row)?;

    let mut invoices = Vec::new();
    for row in rows {
        let mut invoice = row?;
        invoice.lines = lines_for(conn, invoice.id)?;
        invoices.push(invoice);
    }
    Ok(invoices)
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
