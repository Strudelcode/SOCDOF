//! Product and stock persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::product::Product;
use crate::domain::stock::StockMove;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const COLUMNS: &str =
    "id, sku, name, unit, price_cents, tax_rate_bp, stock, reorder_level, active, \
                       created_at, updated_at";

/// Inserts a product.
pub fn insert(conn: &Connection, product: &Product) -> CoreResult<()> {
    product.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO products (id, sku, name, unit, price_cents, tax_rate_bp, stock, reorder_level,
            active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            product.id.to_string(),
            product.sku,
            product.name,
            product.unit,
            product.price.cents(),
            product.tax_rate_bp,
            product.stock,
            product.reorder_level,
            product.active,
            product.created_at,
            product.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing product.
pub fn update(conn: &Connection, product: &Product) -> CoreResult<()> {
    product.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE products SET sku = ?2, name = ?3, unit = ?4, price_cents = ?5, tax_rate_bp = ?6,
            stock = ?7, reorder_level = ?8, active = ?9, updated_at = ?10
         WHERE id = ?1",
        params![
            product.id.to_string(),
            product.sku,
            product.name,
            product.unit,
            product.price.cents(),
            product.tax_rate_bp,
            product.stock,
            product.reorder_level,
            product.active,
            product.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(product.id.to_string()));
    }

    Ok(())
}

/// Loads one product.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Product>> {
    let sql = format!("SELECT {COLUMNS} FROM products WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Loads all products ordered by name.
pub fn list(conn: &Connection) -> CoreResult<Vec<Product>> {
    let sql = format!("SELECT {COLUMNS} FROM products ORDER BY lower(name)");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut products = Vec::new();
    for row in rows {
        products.push(row?);
    }
    Ok(products)
}

/// Records a stock movement and updates the product stock in one transaction.
///
/// Returns the new stock level. Removing more than available is rejected and leaves the stock and
/// the movement history untouched.
pub fn adjust_stock(conn: &Connection, movement: &StockMove) -> CoreResult<i64> {
    movement.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;

    let current: Option<i64> = transaction
        .query_row(
            "SELECT stock FROM products WHERE id = ?1",
            params![movement.product_id.to_string()],
            |row| row.get(0),
        )
        .optional()?;

    let Some(current) = current else {
        return Err(CoreError::NotFound(movement.product_id.to_string()));
    };

    let next = current + movement.kind.delta(movement.quantity);
    if next < 0 {
        return Err(CoreError::Validation("stock_insufficient".to_string()));
    }

    transaction.execute(
        "UPDATE products SET stock = ?2, updated_at = ?3 WHERE id = ?1",
        params![movement.product_id.to_string(), next, movement.created_at],
    )?;

    transaction.execute(
        "INSERT INTO stock_moves (id, product_id, kind, quantity, reason, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            movement.id.to_string(),
            movement.product_id.to_string(),
            movement.kind.as_str(),
            movement.quantity,
            movement.reason,
            movement.created_at,
        ],
    )?;

    transaction.commit()?;
    Ok(next)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Product> {
    let id_text: String = row.get("id")?;

    Ok(Product {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        sku: row.get("sku")?,
        name: row.get("name")?,
        unit: row.get("unit")?,
        price: Money::from_cents(row.get("price_cents")?),
        tax_rate_bp: row.get("tax_rate_bp")?,
        stock: row.get("stock")?,
        reorder_level: row.get("reorder_level")?,
        active: row.get("active")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
