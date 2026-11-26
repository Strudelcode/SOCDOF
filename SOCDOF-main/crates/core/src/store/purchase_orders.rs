//! Purchase order persistence, including the atomic goods receipt.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
use crate::domain::stock::StockMove;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::store::products;

const COLUMNS: &str =
    "id, number, vendor_id, status, order_date, expected_at, currency_symbol, note, \
                       legacy_id, created_at, updated_at";

/// Inserts a purchase order and all of its positions atomically.
pub fn insert(conn: &Connection, order: &PurchaseOrder) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;

    transaction.execute(
        "INSERT INTO purchase_orders (id, number, vendor_id, status, order_date, expected_at,
            currency_symbol, note, legacy_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            order.id.to_string(),
            order.number,
            order.vendor_id.to_string(),
            order.status.as_str(),
            order.order_date,
            order.expected_at,
            order.currency_symbol,
            order.note,
            order.legacy_id,
            order.created_at,
            order.updated_at,
        ],
    )?;

    insert_lines(&transaction, order)?;

    transaction.commit()?;
    Ok(())
}

fn insert_lines(conn: &Connection, order: &PurchaseOrder) -> CoreResult<()> {
    for (position, line) in order.lines.iter().enumerate() {
        conn.execute(
            "INSERT INTO purchase_order_lines (purchase_order_id, position, product_id, description,
                quantity_milli, unit_cost_cents, tax_rate_bp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                order.id.to_string(),
                position as i64,
                line.product_id.map(|id| id.to_string()),
                line.description,
                line.quantity_milli,
                line.unit_cost.cents(),
                line.tax_rate_bp,
            ],
        )?;
    }
    Ok(())
}

/// Loads one purchase order with its positions.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<PurchaseOrder>> {
    let sql = format!("SELECT {COLUMNS} FROM purchase_orders WHERE id = ?1");
    let Some(mut order) = conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?
    else {
        return Ok(None);
    };
    order.lines = lines_for(conn, order.id)?;
    Ok(Some(order))
}

/// Loads all purchase orders, newest first.
pub fn list(conn: &Connection) -> CoreResult<Vec<PurchaseOrder>> {
    let sql =
        format!("SELECT {COLUMNS} FROM purchase_orders ORDER BY order_date DESC, number DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut orders = Vec::new();
    for row in rows {
        let mut order = row?;
        order.lines = lines_for(conn, order.id)?;
        orders.push(order);
    }
    Ok(orders)
}

/// Replaces an order header and all of its positions in one transaction.
pub fn update(conn: &Connection, order: &PurchaseOrder) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;
    let changed = transaction.execute(
        "UPDATE purchase_orders SET number = ?2, vendor_id = ?3, status = ?4, order_date = ?5,
            expected_at = ?6, currency_symbol = ?7, note = ?8, updated_at = ?9 WHERE id = ?1",
        params![
            order.id.to_string(),
            order.number,
            order.vendor_id.to_string(),
            order.status.as_str(),
            order.order_date,
            order.expected_at,
            order.currency_symbol,
            order.note,
            order.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(order.id.to_string()));
    }

    transaction.execute(
        "DELETE FROM purchase_order_lines WHERE purchase_order_id = ?1",
        params![order.id.to_string()],
    )?;
    insert_lines(&transaction, order)?;
    transaction.commit()?;
    Ok(())
}

/// Substring search over number, note and position descriptions.
pub fn search(conn: &Connection, term: &str) -> CoreResult<Vec<PurchaseOrder>> {
    let pattern = format!("%{}%", term.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM purchase_orders
         WHERE lower(coalesce(number, '') || ' ' || coalesce(note, '')) LIKE ?1
            OR EXISTS (SELECT 1 FROM purchase_order_lines l
                       WHERE l.purchase_order_id = purchase_orders.id
                         AND lower(l.description) LIKE ?1)
         ORDER BY order_date DESC, number DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![pattern], map_row)?;

    let mut orders = Vec::new();
    for row in rows {
        let mut order = row?;
        order.lines = lines_for(conn, order.id)?;
        orders.push(order);
    }
    Ok(orders)
}

/// Number of purchase orders.
pub fn count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM purchase_orders", [], |row| row.get(0))?)
}

/// Changes the status of an order without booking goods.
pub fn set_status(
    conn: &Connection,
    id: Uuid,
    status: PurchaseOrderStatus,
    now: i64,
) -> CoreResult<()> {
    let changed = conn.execute(
        "UPDATE purchase_orders SET status = ?2, updated_at = ?3 WHERE id = ?1",
        params![id.to_string(), status.as_str(), now],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Books goods in: applies every movement and marks the order as received, atomically.
///
/// An order that is already received or cancelled is rejected, and an insufficient stock update
/// (a movement out of a product) rolls the whole receipt back.
pub fn receive(conn: &Connection, id: Uuid, movements: &[StockMove], now: i64) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;

    let status: Option<String> = transaction
        .query_row(
            "SELECT status FROM purchase_orders WHERE id = ?1",
            params![id.to_string()],
            |row| row.get(0),
        )
        .optional()?;

    let Some(status) = status else {
        return Err(CoreError::NotFound(id.to_string()));
    };

    let status = PurchaseOrderStatus::from_storage(&status).unwrap_or(PurchaseOrderStatus::Draft);
    if !status.accepts_goods() {
        return Err(CoreError::Validation("order_not_receivable".to_string()));
    }

    for movement in movements {
        products::apply_stock(&transaction, movement)?;
    }

    transaction.execute(
        "UPDATE purchase_orders SET status = ?2, updated_at = ?3 WHERE id = ?1",
        params![id.to_string(), PurchaseOrderStatus::Received.as_str(), now],
    )?;

    transaction.commit()?;
    Ok(())
}

/// Removes an order and its positions.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM purchase_orders WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn lines_for(conn: &Connection, order_id: Uuid) -> CoreResult<Vec<PurchaseOrderLine>> {
    let mut statement = conn.prepare(
        "SELECT product_id, description, quantity_milli, unit_cost_cents, tax_rate_bp
         FROM purchase_order_lines WHERE purchase_order_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![order_id.to_string()], |row| {
        let product_id: Option<String> = row.get("product_id")?;
        Ok(PurchaseOrderLine {
            product_id: product_id
                .as_deref()
                .and_then(|value| Uuid::parse_str(value).ok()),
            description: row.get("description")?,
            quantity_milli: row.get("quantity_milli")?,
            unit_cost: Money::from_cents(row.get("unit_cost_cents")?),
            tax_rate_bp: row.get("tax_rate_bp")?,
        })
    })?;

    let mut lines = Vec::new();
    for row in rows {
        lines.push(row?);
    }
    Ok(lines)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<PurchaseOrder> {
    let id_text: String = row.get("id")?;
    let vendor_text: String = row.get("vendor_id")?;
    let status_text: String = row.get("status")?;

    Ok(PurchaseOrder {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        number: row.get("number")?,
        vendor_id: Uuid::parse_str(&vendor_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        status: PurchaseOrderStatus::from_storage(&status_text)
            .unwrap_or(PurchaseOrderStatus::Draft),
        order_date: row.get("order_date")?,
        expected_at: row.get("expected_at")?,
        currency_symbol: row.get("currency_symbol")?,
        note: row.get("note")?,
        lines: Vec::new(),
        legacy_id: row.get("legacy_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
