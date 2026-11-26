//! Restaurant menu, table order and checkout persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::contact::{Contact, ContactKind};
use crate::domain::invoice::Invoice;
use crate::domain::pos::PosOrder;
use crate::domain::restaurant::{MenuItem, TableOrder, TableOrderItem};
use crate::error::{CoreError, CoreResult};
use crate::store::{contacts, invoices, pos_orders};

const MENU_COLUMNS: &str = "id, name, category, price_cents, tax_rate_bp, ingredients, allergens, \
                            emoji, prep_time_minutes, is_available, created_at";
const ORDER_COLUMNS: &str = "id, table_number, server_name, status, subtotal_cents, \
    tax_total_cents, total_cents, tip_cents, payment_method, opened_at, paid_at, \
    cash_tendered_cents, cash_change_cents, is_hospitality_receipt, hospitality_host, \
    hospitality_occasion, hospitality_guests, receipt_number, invoice_id, created_at, updated_at";

fn menu_from_row(row: &Row<'_>) -> rusqlite::Result<MenuItem> {
    let allergens: String = row.get(6)?;
    Ok(MenuItem {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        name: row.get(1)?,
        category: row.get(2)?,
        price_cents: row.get(3)?,
        tax_rate_bp: row.get(4)?,
        ingredients: row.get(5)?,
        allergens: serde_json::from_str(&allergens).unwrap_or_default(),
        emoji: row.get(7)?,
        prep_time_minutes: row.get(8)?,
        is_available: row.get::<_, i64>(9)? != 0,
        created_at: row.get(10)?,
    })
}

fn order_from_row(row: &Row<'_>) -> rusqlite::Result<TableOrder> {
    Ok(TableOrder {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        table_number: row.get(1)?,
        server_name: row.get(2)?,
        status: row.get(3)?,
        items: Vec::new(),
        subtotal_cents: row.get(4)?,
        tax_total_cents: row.get(5)?,
        total_cents: row.get(6)?,
        tip_cents: row.get(7)?,
        payment_method: row.get(8)?,
        opened_at: row.get(9)?,
        paid_at: row.get(10)?,
        cash_tendered_cents: row.get(11)?,
        cash_change_cents: row.get(12)?,
        is_hospitality_receipt: row.get::<_, i64>(13)? != 0,
        hospitality_host: row.get(14)?,
        hospitality_occasion: row.get(15)?,
        hospitality_guests: row.get(16)?,
        receipt_number: row.get(17)?,
        invoice_id: row
            .get::<_, Option<String>>(18)?
            .and_then(|value| Uuid::parse_str(&value).ok()),
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
    })
}

/// All dishes and drinks, newest first.
pub fn list_menu(conn: &Connection) -> CoreResult<Vec<MenuItem>> {
    let sql = format!(
        "SELECT {MENU_COLUMNS} FROM restaurant_menu_items ORDER BY created_at DESC, rowid DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], menu_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one dish.
pub fn find_menu_item(conn: &Connection, id: Uuid) -> CoreResult<Option<MenuItem>> {
    let sql = format!("SELECT {MENU_COLUMNS} FROM restaurant_menu_items WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], menu_from_row)
        .optional()?)
}

/// Inserts a dish after validating it.
pub fn insert_menu_item(conn: &Connection, item: &MenuItem) -> CoreResult<()> {
    item.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO restaurant_menu_items (id, name, category, price_cents, tax_rate_bp,
            ingredients, allergens, emoji, prep_time_minutes, is_available, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            item.id.to_string(),
            item.name,
            item.category,
            item.price_cents,
            item.tax_rate_bp,
            item.ingredients,
            serde_json::to_string(&item.allergens).unwrap_or_else(|_| "[]".to_string()),
            item.emoji,
            item.prep_time_minutes,
            i64::from(item.is_available),
            item.created_at,
        ],
    )?;
    Ok(())
}

/// Replaces a dish. Existing order lines keep their copied values.
pub fn update_menu_item(conn: &Connection, item: &MenuItem) -> CoreResult<()> {
    item.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE restaurant_menu_items SET name = ?2, category = ?3, price_cents = ?4,
            tax_rate_bp = ?5, ingredients = ?6, allergens = ?7, emoji = ?8,
            prep_time_minutes = ?9, is_available = ?10 WHERE id = ?1",
        params![
            item.id.to_string(),
            item.name,
            item.category,
            item.price_cents,
            item.tax_rate_bp,
            item.ingredients,
            serde_json::to_string(&item.allergens).unwrap_or_else(|_| "[]".to_string()),
            item.emoji,
            item.prep_time_minutes,
            i64::from(item.is_available),
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(item.id.to_string()));
    }
    Ok(())
}

/// Deletes a dish. Already ordered lines stay on their receipts.
pub fn delete_menu_item(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM restaurant_menu_items WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads every table order, oldest first like the TypeScript array.
pub fn list_orders(conn: &Connection) -> CoreResult<Vec<TableOrder>> {
    let sql =
        format!("SELECT {ORDER_COLUMNS} FROM restaurant_orders ORDER BY opened_at ASC, rowid ASC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], order_from_row)?;
    let mut orders = Vec::new();
    for row in rows {
        let mut order = row?;
        order.items = items_for(conn, order.id)?;
        orders.push(order);
    }
    Ok(orders)
}

/// Loads one table order with its positions.
pub fn find_order(conn: &Connection, id: Uuid) -> CoreResult<Option<TableOrder>> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM restaurant_orders WHERE id = ?1");
    let Some(mut order) = conn
        .query_row(&sql, params![id.to_string()], order_from_row)
        .optional()?
    else {
        return Ok(None);
    };
    order.items = items_for(conn, order.id)?;
    Ok(Some(order))
}

/// The open order of one table, if any.
pub fn find_open_order(conn: &Connection, table_number: &str) -> CoreResult<Option<TableOrder>> {
    let sql = format!(
        "SELECT {ORDER_COLUMNS} FROM restaurant_orders
         WHERE table_number = ?1 AND status != 'paid' ORDER BY opened_at ASC, rowid ASC LIMIT 1"
    );
    let Some(mut order) = conn
        .query_row(&sql, params![table_number], order_from_row)
        .optional()?
    else {
        return Ok(None);
    };
    order.items = items_for(conn, order.id)?;
    Ok(Some(order))
}

fn items_for(conn: &Connection, order_id: Uuid) -> CoreResult<Vec<TableOrderItem>> {
    let mut statement = conn.prepare(
        "SELECT id, menu_item_id, name, price_cents, tax_rate_bp, qty, category, emoji, notes
         FROM restaurant_order_items WHERE order_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![order_id.to_string()], |row| {
        Ok(TableOrderItem {
            id: Uuid::parse_str(&row.get::<_, String>("id")?).unwrap_or(Uuid::nil()),
            menu_item_id: row
                .get::<_, Option<String>>("menu_item_id")?
                .and_then(|value| Uuid::parse_str(&value).ok()),
            name: row.get("name")?,
            price_cents: row.get("price_cents")?,
            tax_rate_bp: row.get("tax_rate_bp")?,
            qty: row.get("qty")?,
            category: row.get("category")?,
            emoji: row.get("emoji")?,
            notes: row.get("notes")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Inserts a table order and its positions atomically.
pub fn insert_order(conn: &Connection, order: &TableOrder) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;
    let transaction = conn.unchecked_transaction()?;
    insert_order_rows(&transaction, order)?;
    transaction.commit()?;
    Ok(())
}

/// Replaces a table order and its positions atomically.
pub fn update_order(conn: &Connection, order: &TableOrder) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;
    let transaction = conn.unchecked_transaction()?;
    let changed = update_order_rows(&transaction, order)?;
    transaction.commit()?;
    if changed == 0 {
        return Err(CoreError::NotFound(order.id.to_string()));
    }
    Ok(())
}

/// Inserts or updates a table order, depending on whether it exists.
pub fn save_order(conn: &Connection, order: &TableOrder) -> CoreResult<()> {
    if find_order(conn, order.id)?.is_some() {
        update_order(conn, order)
    } else {
        insert_order(conn, order)
    }
}

/// Deletes one table order and its positions.
pub fn delete_order(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "DELETE FROM restaurant_order_items WHERE order_id = ?1",
        params![id.to_string()],
    )?;
    let changed = transaction.execute(
        "DELETE FROM restaurant_orders WHERE id = ?1",
        params![id.to_string()],
    )?;
    transaction.commit()?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

fn insert_order_rows(conn: &Connection, order: &TableOrder) -> CoreResult<()> {
    conn.execute(
        "INSERT INTO restaurant_orders (id, table_number, server_name, status, subtotal_cents,
            tax_total_cents, total_cents, tip_cents, payment_method, opened_at, paid_at,
            cash_tendered_cents, cash_change_cents, is_hospitality_receipt, hospitality_host,
            hospitality_occasion, hospitality_guests, receipt_number, invoice_id, created_at,
            updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
            ?18, ?19, ?20, ?21)",
        params![
            order.id.to_string(),
            order.table_number,
            order.server_name,
            order.status,
            order.subtotal_cents,
            order.tax_total_cents,
            order.total_cents,
            order.tip_cents,
            order.payment_method,
            order.opened_at,
            order.paid_at,
            order.cash_tendered_cents,
            order.cash_change_cents,
            i64::from(order.is_hospitality_receipt),
            order.hospitality_host,
            order.hospitality_occasion,
            order.hospitality_guests,
            order.receipt_number,
            order.invoice_id.map(|id| id.to_string()),
            order.created_at,
            order.updated_at,
        ],
    )?;
    insert_order_items(conn, order)?;
    Ok(())
}

fn update_order_rows(conn: &Connection, order: &TableOrder) -> CoreResult<usize> {
    let changed = conn.execute(
        "UPDATE restaurant_orders SET table_number = ?2, server_name = ?3, status = ?4,
            subtotal_cents = ?5, tax_total_cents = ?6, total_cents = ?7, tip_cents = ?8,
            payment_method = ?9, opened_at = ?10, paid_at = ?11, cash_tendered_cents = ?12,
            cash_change_cents = ?13, is_hospitality_receipt = ?14, hospitality_host = ?15,
            hospitality_occasion = ?16, hospitality_guests = ?17, receipt_number = ?18,
            invoice_id = ?19, updated_at = ?20 WHERE id = ?1",
        params![
            order.id.to_string(),
            order.table_number,
            order.server_name,
            order.status,
            order.subtotal_cents,
            order.tax_total_cents,
            order.total_cents,
            order.tip_cents,
            order.payment_method,
            order.opened_at,
            order.paid_at,
            order.cash_tendered_cents,
            order.cash_change_cents,
            i64::from(order.is_hospitality_receipt),
            order.hospitality_host,
            order.hospitality_occasion,
            order.hospitality_guests,
            order.receipt_number,
            order.invoice_id.map(|id| id.to_string()),
            order.updated_at,
        ],
    )?;
    if changed > 0 {
        conn.execute(
            "DELETE FROM restaurant_order_items WHERE order_id = ?1",
            params![order.id.to_string()],
        )?;
        insert_order_items(conn, order)?;
    }
    Ok(changed)
}

fn insert_order_items(conn: &Connection, order: &TableOrder) -> CoreResult<()> {
    for (position, item) in order.items.iter().enumerate() {
        conn.execute(
            "INSERT INTO restaurant_order_items (order_id, id, position, menu_item_id, name,
                price_cents, tax_rate_bp, qty, category, emoji, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                order.id.to_string(),
                item.id.to_string(),
                position as i64,
                item.menu_item_id.map(|id| id.to_string()),
                item.name,
                item.price_cents,
                item.tax_rate_bp,
                item.qty,
                item.category,
                item.emoji,
                item.notes,
            ],
        )?;
    }
    Ok(())
}

/// The next unique hospitality receipt number for a year (`GASTRO/YYYY/NNNN`).
pub fn next_receipt_number(conn: &Connection, year: i64) -> CoreResult<String> {
    let prefix = format!("GASTRO/{year}/");
    let pattern = format!("{prefix}%");
    // Restaurant invoices and POS receipts share the same printed number space. The POS list keeps
    // its receipt after an invoice is deleted, so both tables must be consulted for uniqueness.
    let mut statement = conn.prepare(
        "SELECT number FROM invoices WHERE number LIKE ?1
         UNION ALL
         SELECT receipt_number FROM pos_orders WHERE receipt_number LIKE ?1",
    )?;
    let rows = statement.query_map(params![pattern], |row| row.get::<_, String>(0))?;
    let mut highest = 999;
    for row in rows {
        let number = row?;
        if let Some(suffix) = number.strip_prefix(&prefix) {
            if let Ok(value) = suffix.parse::<i64>() {
                highest = highest.max(value);
            }
        }
    }
    Ok(format!("{prefix}{:04}", highest + 1))
}

/// Finds or creates the walk-in contact used by restaurant invoices.
///
/// The TypeScript application stores `contact_id: 0` because IndexedDB has no foreign key. The
/// relational Rust store needs a real contact row, so the hospitality checkout uses one shared
/// "Laufkundschaft (Restaurant)" account.
pub fn walk_in_contact(conn: &Connection, now: i64) -> CoreResult<Contact> {
    const NAME: &str = "Laufkundschaft (Restaurant)";
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM contacts WHERE company_name = ?1 OR name = ?1 LIMIT 1",
            params![NAME],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(id) = existing {
        if let Some(contact) = contacts::find(conn, Uuid::parse_str(&id).unwrap_or(Uuid::nil()))? {
            return Ok(contact);
        }
    }

    let mut contact = Contact::new(ContactKind::Company, now);
    contact.company_name = Some(NAME.to_string());
    contact.notes = Some("Systemkonto für Restaurant-Laufkundschaft".to_string());
    contact.city = Some(String::new());
    contacts::insert(conn, &contact)?;
    Ok(contact)
}

/// Books a paid table order, its POS receipt and its official invoice in one transaction.
pub fn checkout(
    conn: &Connection,
    order: &TableOrder,
    invoice: &Invoice,
    receipt: &PosOrder,
) -> CoreResult<()> {
    order.validate().map_err(CoreError::Validation)?;
    invoice.validate().map_err(CoreError::Validation)?;
    receipt.validate().map_err(CoreError::Validation)?;
    if order.status != "paid" {
        return Err(CoreError::Validation(
            "restaurant_order_not_paid".to_string(),
        ));
    }

    let transaction = conn.unchecked_transaction()?;
    let changed = update_order_rows(&transaction, order)?;
    if changed == 0 {
        return Err(CoreError::NotFound(order.id.to_string()));
    }
    pos_orders::insert_rows(&transaction, receipt)?;
    invoices::insert_rows(&transaction, invoice)?;
    transaction.commit()?;
    Ok(())
}
