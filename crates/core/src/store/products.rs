//! Product and stock persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::product::Product;
use crate::domain::stock::StockMove;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

const COLUMNS: &str = "id, sku, name, category, unit, price_cents, cost_price_cents, tax_rate_bp, \
                       stock, reorder_level, target_stock, barcode, asin, web_link, source_domain, \
                       description, image_emoji, active, exclude_from_reorder, legacy_id, \
                       legacy_json, created_at, updated_at";

/// Inserts a product.
pub fn insert(conn: &Connection, product: &Product) -> CoreResult<()> {
    product.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO products (id, sku, name, category, unit, price_cents, cost_price_cents,
            tax_rate_bp, stock, reorder_level, target_stock, barcode, asin, web_link, source_domain,
            description, image_emoji, active, exclude_from_reorder, legacy_id, legacy_json,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
            ?18, ?19, ?20, ?21, ?22, ?23)",
        params![
            product.id.to_string(),
            product.sku,
            product.name,
            product.category,
            product.unit,
            product.price.cents(),
            product.cost_price.cents(),
            product.tax_rate_bp,
            product.stock,
            product.reorder_level,
            product.target_stock,
            product.barcode,
            product.asin,
            product.web_link,
            product.source_domain,
            product.description,
            product.image_emoji,
            product.active,
            product.exclude_from_reorder,
            product.legacy_id,
            product.legacy_json,
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
        "UPDATE products SET sku = ?2, name = ?3, category = ?4, unit = ?5, price_cents = ?6,
            cost_price_cents = ?7, tax_rate_bp = ?8, stock = ?9, reorder_level = ?10,
            target_stock = ?11, barcode = ?12, asin = ?13, web_link = ?14, source_domain = ?15,
            description = ?16, image_emoji = ?17, active = ?18, exclude_from_reorder = ?19,
            legacy_id = ?20, legacy_json = ?21, updated_at = ?22
         WHERE id = ?1",
        params![
            product.id.to_string(),
            product.sku,
            product.name,
            product.category,
            product.unit,
            product.price.cents(),
            product.cost_price.cents(),
            product.tax_rate_bp,
            product.stock,
            product.reorder_level,
            product.target_stock,
            product.barcode,
            product.asin,
            product.web_link,
            product.source_domain,
            product.description,
            product.image_emoji,
            product.active,
            product.exclude_from_reorder,
            product.legacy_id,
            product.legacy_json,
            product.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(product.id.to_string()));
    }

    Ok(())
}

/// Removes a product.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM products WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
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

/// Searches products by name, SKU, barcode, category and description.
pub fn search(conn: &Connection, query: &str) -> CoreResult<Vec<Product>> {
    let term = format!("%{}%", query.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM products
         WHERE lower(coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' ||
             coalesce(barcode, '') || ' ' || coalesce(category, '') || ' ' ||
             coalesce(description, '')) LIKE ?1
         ORDER BY lower(name)"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![term], map_row)?;

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
    let transaction = conn.unchecked_transaction()?;
    let level = apply_stock(&transaction, movement)?;
    transaction.commit()?;
    Ok(level)
}

/// Applies a stock movement without opening a transaction of its own.
///
/// Multi-record writes (invoice, POS receipt, goods receipt) call this inside their own
/// transaction, so a failed position rolls the whole document back.
pub fn apply_stock(conn: &Connection, movement: &StockMove) -> CoreResult<i64> {
    movement.validate().map_err(CoreError::Validation)?;

    let current: Option<i64> = conn
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

    conn.execute(
        "UPDATE products SET stock = ?2, updated_at = ?3 WHERE id = ?1",
        params![movement.product_id.to_string(), next, movement.created_at],
    )?;

    conn.execute(
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

    Ok(next)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Product> {
    let id_text: String = row.get("id")?;

    Ok(Product {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        sku: row.get("sku")?,
        name: row.get("name")?,
        category: row.get("category")?,
        unit: row.get("unit")?,
        price: Money::from_cents(row.get("price_cents")?),
        cost_price: Money::from_cents(row.get("cost_price_cents")?),
        tax_rate_bp: row.get("tax_rate_bp")?,
        stock: row.get("stock")?,
        reorder_level: row.get("reorder_level")?,
        target_stock: row.get("target_stock")?,
        barcode: row.get("barcode")?,
        asin: row.get("asin")?,
        web_link: row.get("web_link")?,
        source_domain: row.get("source_domain")?,
        description: row.get("description")?,
        image_emoji: row.get("image_emoji")?,
        active: row.get("active")?,
        exclude_from_reorder: row.get("exclude_from_reorder")?,
        legacy_id: row.get("legacy_id")?,
        legacy_json: row.get("legacy_json")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
