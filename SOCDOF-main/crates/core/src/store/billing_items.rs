//! Billable item persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::billing::{BillingItem, BillingKind};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const COLUMNS: &str = "id, contact_id, invoice_id, kind, code, description, service_date, \
                       quantity_milli, unit_price_cents, tax_rate_bp, created_at, updated_at";

/// Inserts a billable item.
pub fn insert(conn: &Connection, item: &BillingItem) -> CoreResult<()> {
    item.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO billing_items (id, contact_id, invoice_id, kind, code, description,
            service_date, quantity_milli, unit_price_cents, tax_rate_bp, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            item.id.to_string(),
            item.contact_id.to_string(),
            item.invoice_id.map(|id| id.to_string()),
            item.kind.as_str(),
            item.code,
            item.description,
            item.service_date,
            item.quantity_milli,
            item.unit_price.cents(),
            item.tax_rate_bp,
            item.created_at,
            item.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing item.
pub fn update(conn: &Connection, item: &BillingItem) -> CoreResult<()> {
    item.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE billing_items SET contact_id = ?2, invoice_id = ?3, kind = ?4, code = ?5,
            description = ?6, service_date = ?7, quantity_milli = ?8, unit_price_cents = ?9,
            tax_rate_bp = ?10, updated_at = ?11
         WHERE id = ?1",
        params![
            item.id.to_string(),
            item.contact_id.to_string(),
            item.invoice_id.map(|id| id.to_string()),
            item.kind.as_str(),
            item.code,
            item.description,
            item.service_date,
            item.quantity_milli,
            item.unit_price.cents(),
            item.tax_rate_bp,
            item.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(item.id.to_string()));
    }

    Ok(())
}

/// Loads one item.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<BillingItem>> {
    let sql = format!("SELECT {COLUMNS} FROM billing_items WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Loads all items, newest service date first.
pub fn list(conn: &Connection) -> CoreResult<Vec<BillingItem>> {
    let sql =
        format!("SELECT {COLUMNS} FROM billing_items ORDER BY service_date DESC, created_at DESC");
    query_list(conn, &sql, [])
}

/// Loads all items of one contact.
pub fn list_for_contact(conn: &Connection, contact_id: Uuid) -> CoreResult<Vec<BillingItem>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM billing_items WHERE contact_id = ?1 \
         ORDER BY service_date DESC, created_at DESC"
    );
    query_list(conn, &sql, params![contact_id.to_string()])
}

/// Loads the items that are still waiting for an invoice.
pub fn list_open_for_contact(conn: &Connection, contact_id: Uuid) -> CoreResult<Vec<BillingItem>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM billing_items WHERE contact_id = ?1 AND invoice_id IS NULL \
         ORDER BY service_date, created_at"
    );
    query_list(conn, &sql, params![contact_id.to_string()])
}

/// Loads all items collected on one invoice.
pub fn list_for_invoice(conn: &Connection, invoice_id: Uuid) -> CoreResult<Vec<BillingItem>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM billing_items WHERE invoice_id = ?1 ORDER BY service_date, created_at"
    );
    query_list(conn, &sql, params![invoice_id.to_string()])
}

/// Assigns several items to an invoice in one transaction.
///
/// This is the write that turns tracked sessions into a billed invoice; either every item is
/// collected or none is.
pub fn assign_to_invoice(
    conn: &Connection,
    ids: &[Uuid],
    invoice_id: Uuid,
    now: i64,
) -> CoreResult<usize> {
    let transaction = conn.unchecked_transaction()?;

    let exists: bool = transaction
        .query_row(
            "SELECT 1 FROM invoices WHERE id = ?1",
            params![invoice_id.to_string()],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(CoreError::NotFound(invoice_id.to_string()));
    }

    let mut assigned = 0usize;
    for id in ids {
        let changed = transaction.execute(
            "UPDATE billing_items SET invoice_id = ?2, updated_at = ?3 WHERE id = ?1",
            params![id.to_string(), invoice_id.to_string(), now],
        )?;
        if changed == 0 {
            return Err(CoreError::NotFound(id.to_string()));
        }
        assigned += 1;
    }

    transaction.commit()?;
    Ok(assigned)
}

/// Removes an item.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM billing_items WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn query_list<P: rusqlite::Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> CoreResult<Vec<BillingItem>> {
    let mut statement = conn.prepare(sql)?;
    let rows = statement.query_map(params, map_row)?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<BillingItem> {
    let id_text: String = row.get("id")?;
    let contact_text: String = row.get("contact_id")?;
    let invoice_text: Option<String> = row.get("invoice_id")?;
    let kind_text: String = row.get("kind")?;

    Ok(BillingItem {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        contact_id: Uuid::parse_str(&contact_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        invoice_id: invoice_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        kind: BillingKind::from_storage(&kind_text).unwrap_or(BillingKind::Service),
        code: row.get("code")?,
        description: row.get("description")?,
        service_date: row.get("service_date")?,
        quantity_milli: row.get("quantity_milli")?,
        unit_price: Money::from_cents(row.get("unit_price_cents")?),
        tax_rate_bp: row.get("tax_rate_bp")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
