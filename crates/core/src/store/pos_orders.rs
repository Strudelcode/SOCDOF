//! POS receipt persistence: the receipt, its positions and the stock movements in one transaction.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::pos::{PaymentMethod, PosOrder, PosOrderLine};
use crate::domain::stock::StockMove;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::store::products;

const COLUMNS: &str = "id, receipt_number, contact_id, payment_method, paid_at, currency_symbol, \
                       note, cash_given_cents, legacy_id";

/// Inserts a receipt with its positions and stock movements atomically.
///
/// Selling more than is in stock rejects the whole receipt, so a half-booked sale never reaches the
/// database.
pub fn insert(conn: &Connection, order: &PosOrder, movements: &[StockMove]) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;

    transaction.execute(
        "INSERT INTO pos_orders (id, receipt_number, contact_id, payment_method, paid_at,
            currency_symbol, note, cash_given_cents, legacy_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            order.id.to_string(),
            order.receipt_number,
            order.contact_id.map(|id| id.to_string()),
            order.payment_method.as_str(),
            order.paid_at,
            order.currency_symbol,
            order.note,
            order.cash_given.map(|given| given.cents()),
            order.legacy_id,
            order.paid_at,
        ],
    )?;

    for (position, line) in order.lines.iter().enumerate() {
        transaction.execute(
            "INSERT INTO pos_order_lines (pos_order_id, position, product_id, description,
                quantity_milli, unit_price_cents, tax_rate_bp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                order.id.to_string(),
                position as i64,
                line.product_id.map(|id| id.to_string()),
                line.description,
                line.quantity_milli,
                line.unit_price.cents(),
                line.tax_rate_bp,
            ],
        )?;
    }

    for movement in movements {
        products::apply_stock(&transaction, movement)?;
    }

    transaction.commit()?;
    Ok(())
}

/// Loads one receipt with its positions.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<PosOrder>> {
    let sql = format!("SELECT {COLUMNS} FROM pos_orders WHERE id = ?1");
    let Some(mut order) = conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?
    else {
        return Ok(None);
    };
    order.lines = lines_for(conn, order.id)?;
    Ok(Some(order))
}

/// Loads all receipts, newest first.
pub fn list(conn: &Connection) -> CoreResult<Vec<PosOrder>> {
    let sql =
        format!("SELECT {COLUMNS} FROM pos_orders ORDER BY paid_at DESC, receipt_number DESC");
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

/// Substring search over receipt number, note and position descriptions.
pub fn search(conn: &Connection, term: &str) -> CoreResult<Vec<PosOrder>> {
    let pattern = format!("%{}%", term.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM pos_orders
         WHERE lower(coalesce(receipt_number, '') || ' ' || coalesce(note, '')) LIKE ?1
            OR EXISTS (SELECT 1 FROM pos_order_lines l
                       WHERE l.pos_order_id = pos_orders.id
                         AND lower(l.description) LIKE ?1)
         ORDER BY paid_at DESC, receipt_number DESC"
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

/// Loads the receipts paid in `[from, to)`.
pub fn between(conn: &Connection, from: i64, to: i64) -> CoreResult<Vec<PosOrder>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM pos_orders WHERE paid_at >= ?1 AND paid_at < ?2
         ORDER BY paid_at DESC, receipt_number DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![from, to], map_row)?;

    let mut orders = Vec::new();
    for row in rows {
        let mut order = row?;
        order.lines = lines_for(conn, order.id)?;
        orders.push(order);
    }
    Ok(orders)
}

/// Number of receipts.
pub fn count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM pos_orders", [], |row| row.get(0))?)
}

/// Cancels a receipt: returns its product positions to stock and removes the receipt atomically.
pub fn cancel(conn: &Connection, id: Uuid, now: i64) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;
    let order = find(&transaction, id)?.ok_or_else(|| CoreError::NotFound(id.to_string()))?;

    for movement in order.return_moves(now) {
        products::apply_stock(&transaction, &movement)?;
    }

    transaction.execute(
        "DELETE FROM pos_orders WHERE id = ?1",
        params![id.to_string()],
    )?;
    transaction.commit()?;
    Ok(())
}

/// Removes a receipt and its positions without touching stock.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM pos_orders WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn lines_for(conn: &Connection, order_id: Uuid) -> CoreResult<Vec<PosOrderLine>> {
    let mut statement = conn.prepare(
        "SELECT product_id, description, quantity_milli, unit_price_cents, tax_rate_bp
         FROM pos_order_lines WHERE pos_order_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![order_id.to_string()], |row| {
        let product_id: Option<String> = row.get("product_id")?;
        Ok(PosOrderLine {
            product_id: product_id
                .as_deref()
                .and_then(|value| Uuid::parse_str(value).ok()),
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

fn map_row(row: &Row<'_>) -> rusqlite::Result<PosOrder> {
    let id_text: String = row.get("id")?;
    let contact_text: Option<String> = row.get("contact_id")?;
    let method_text: String = row.get("payment_method")?;

    Ok(PosOrder {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        receipt_number: row.get("receipt_number")?,
        contact_id: contact_text
            .as_deref()
            .and_then(|value| Uuid::parse_str(value).ok()),
        payment_method: PaymentMethod::from_storage(&method_text).unwrap_or(PaymentMethod::Cash),
        paid_at: row.get("paid_at")?,
        currency_symbol: row.get("currency_symbol")?,
        note: row.get("note")?,
        cash_given: row
            .get::<_, Option<i64>>("cash_given_cents")?
            .map(Money::from_cents),
        lines: Vec::new(),
        legacy_id: row.get("legacy_id")?,
    })
}
