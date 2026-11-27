//! SQLite persistence of the quick billing register.
//!
//! Dishes keep their option list as JSON in the row, receipts keep their positions the same way:
//! a receipt is an immutable document once written, so no later menu edit can change what a guest
//! paid. The only write after the fact is a cancellation, which stores the original as `cancelled`
//! and adds a linked storno receipt with negated amounts — nothing is deleted.
//!
//! A completed sale decrements the tracked stock of its dishes inside the same transaction; the
//! storno adds it back. Dishes with `stock = 0` are not counted, like the reference.

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::quick_billing::{
    next_number, next_storno_number, DishOption, PaymentMethod, QuickDish, QuickReceipt,
    ReceiptLine, ReceiptStatus,
};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

/// Settings key of the register name and the receipt footer.
pub const SETTINGS_KEY: &str = "quick_billing_settings";

const DISH_COLUMNS: &str =
    "id, name, category, price_cents, tax_rate_bp, description, emoji, sku, \
                            stock, enabled, options, created_at, updated_at";
const RECEIPT_COLUMNS: &str = "id, number, status, created_at, cancelled_at, storno_of, payment, \
                               tendered_cents, change_cents, tse_signature, lines";

/// Register name and receipt footer, persisted next to the receipts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuickBillingSettings {
    /// Name printed at the top of a receipt.
    pub store_name: String,
    /// Footer line printed under the totals.
    pub receipt_footer: String,
}

impl Default for QuickBillingSettings {
    fn default() -> Self {
        Self {
            store_name: "Schnellkasse".to_string(),
            receipt_footer: "Vielen Dank für Ihren Besuch! · TSE / GoBD konform".to_string(),
        }
    }
}

fn dish_from_row(row: &Row<'_>) -> rusqlite::Result<QuickDish> {
    let options: String = row.get(10)?;
    Ok(QuickDish {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        name: row.get(1)?,
        category: row.get(2)?,
        price: Money::from_cents(row.get(3)?),
        tax_rate_bp: row.get(4)?,
        description: row.get(5)?,
        emoji: row.get(6)?,
        sku: row.get(7)?,
        stock: row.get(8)?,
        enabled: row.get::<_, i64>(9)? != 0,
        options: serde_json::from_str(&options).unwrap_or_default(),
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn receipt_from_row(row: &Row<'_>) -> rusqlite::Result<QuickReceipt> {
    let lines: String = row.get(10)?;
    Ok(QuickReceipt {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        number: row.get(1)?,
        status: ReceiptStatus::from_storage(&row.get::<_, String>(2)?)
            .unwrap_or(ReceiptStatus::Completed),
        created_at: row.get(3)?,
        cancelled_at: row.get(4)?,
        storno_of: row
            .get::<_, Option<String>>(5)?
            .and_then(|value| Uuid::parse_str(&value).ok()),
        payment: PaymentMethod::from_storage(&row.get::<_, String>(6)?)
            .unwrap_or(PaymentMethod::Cash),
        tendered: Money::from_cents(row.get(7)?),
        change: Money::from_cents(row.get(8)?),
        tse_signature: row.get(9)?,
        lines: serde_json::from_str(&lines).unwrap_or_default(),
    })
}

fn options_json(options: &[DishOption]) -> String {
    serde_json::to_string(options).unwrap_or_else(|_| "[]".to_string())
}

fn lines_json(lines: &[ReceiptLine]) -> String {
    serde_json::to_string(lines).unwrap_or_else(|_| "[]".to_string())
}

/// All dishes, grouped by category and then name.
pub fn list_dishes(conn: &Connection) -> CoreResult<Vec<QuickDish>> {
    let sql = format!(
        "SELECT {DISH_COLUMNS} FROM quick_dishes ORDER BY category COLLATE NOCASE, \
         name COLLATE NOCASE, rowid"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], dish_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one dish.
pub fn find_dish(conn: &Connection, id: Uuid) -> CoreResult<Option<QuickDish>> {
    let sql = format!("SELECT {DISH_COLUMNS} FROM quick_dishes WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], dish_from_row)
        .optional()?)
}

/// Number of stored dishes.
pub fn dish_count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM quick_dishes", [], |row| row.get(0))?)
}

/// Inserts a dish after validating it.
pub fn insert_dish(conn: &Connection, dish: &QuickDish) -> CoreResult<()> {
    dish.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO quick_dishes (id, name, category, price_cents, tax_rate_bp, description,
            emoji, sku, stock, enabled, options, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            dish.id.to_string(),
            dish.name.trim(),
            dish.category.trim(),
            dish.price.cents(),
            dish.tax_rate_bp,
            dish.description.trim(),
            dish.emoji,
            dish.sku.trim(),
            dish.stock,
            i64::from(dish.enabled),
            options_json(&dish.options),
            dish.created_at,
            dish.updated_at,
        ],
    )?;
    Ok(())
}

/// Replaces a dish; existing receipts keep their copied names and prices.
pub fn update_dish(conn: &Connection, dish: &QuickDish) -> CoreResult<()> {
    dish.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE quick_dishes SET name = ?2, category = ?3, price_cents = ?4, tax_rate_bp = ?5,
            description = ?6, emoji = ?7, sku = ?8, stock = ?9, enabled = ?10, options = ?11,
            updated_at = ?12
         WHERE id = ?1",
        params![
            dish.id.to_string(),
            dish.name.trim(),
            dish.category.trim(),
            dish.price.cents(),
            dish.tax_rate_bp,
            dish.description.trim(),
            dish.emoji,
            dish.sku.trim(),
            dish.stock,
            i64::from(dish.enabled),
            options_json(&dish.options),
            dish.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(dish.id.to_string()));
    }
    Ok(())
}

/// Deletes a dish. Receipts keep their lines, so the history stays readable.
pub fn delete_dish(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM quick_dishes WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// All receipts, newest first.
pub fn list_receipts(conn: &Connection) -> CoreResult<Vec<QuickReceipt>> {
    let sql = format!(
        "SELECT {RECEIPT_COLUMNS} FROM quick_receipts ORDER BY created_at DESC, rowid DESC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], receipt_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one receipt.
pub fn find_receipt(conn: &Connection, id: Uuid) -> CoreResult<Option<QuickReceipt>> {
    let sql = format!("SELECT {RECEIPT_COLUMNS} FROM quick_receipts WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], receipt_from_row)
        .optional()?)
}

/// Number of stored receipts.
pub fn receipt_count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM quick_receipts", [], |row| row.get(0))?)
}

/// Next free receipt number of the current year.
pub fn next_receipt_number(conn: &Connection, now: i64) -> CoreResult<String> {
    Ok(next_number(&list_receipts(conn)?, now))
}

/// Applies the stock effect of a receipt inside the caller's transaction.
///
/// A completed sale takes the sold quantity off the tracked stock (never below zero, like the
/// reference), a storno adds it back. Dishes with `stock = 0` are not counted.
fn apply_stock(conn: &Connection, receipt: &QuickReceipt) -> CoreResult<()> {
    if receipt.status == ReceiptStatus::Cancelled {
        return Ok(());
    }
    let direction: i64 = if receipt.status == ReceiptStatus::Storno {
        1
    } else {
        -1
    };
    for line in &receipt.lines {
        let Some(dish_id) = line.dish_id else {
            continue;
        };
        conn.execute(
            "UPDATE quick_dishes
                SET stock = MAX(0, stock + ?2)
              WHERE id = ?1 AND stock > 0",
            params![dish_id.to_string(), direction * line.quantity],
        )?;
    }
    Ok(())
}

/// Stores a receipt together with its stock effect in one transaction.
pub fn insert_receipt(conn: &Connection, receipt: &QuickReceipt) -> CoreResult<()> {
    receipt.validate().map_err(CoreError::Validation)?;
    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "INSERT INTO quick_receipts (id, number, status, created_at, cancelled_at, storno_of,
            payment, tendered_cents, change_cents, tse_signature, lines)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            receipt.id.to_string(),
            receipt.number,
            receipt.status.as_str(),
            receipt.created_at,
            receipt.cancelled_at,
            receipt.storno_of.map(|id| id.to_string()),
            receipt.payment.as_str(),
            receipt.tendered.cents(),
            receipt.change.cents(),
            receipt.tse_signature,
            lines_json(&receipt.lines),
        ],
    )?;
    apply_stock(&transaction, receipt)?;
    transaction.commit()?;
    Ok(())
}

/// Cancels a completed receipt and writes its linked storno booking.
///
/// Returns the storno receipt. A receipt that is already cancelled, a storno booking itself or an
/// unknown id is rejected, so a second click cannot double the reversal.
pub fn cancel_receipt(conn: &Connection, id: Uuid, now: i64) -> CoreResult<QuickReceipt> {
    let transaction = conn.unchecked_transaction()?;
    let original = match find_receipt(&transaction, id)? {
        Some(receipt) => receipt,
        None => return Err(CoreError::NotFound(id.to_string())),
    };
    if original.status != ReceiptStatus::Completed {
        return Err(CoreError::Validation("receipt_not_cancellable".to_string()));
    }

    let changed = transaction.execute(
        "UPDATE quick_receipts SET status = ?2, cancelled_at = ?3 WHERE id = ?1 AND status = ?4",
        params![
            id.to_string(),
            ReceiptStatus::Cancelled.as_str(),
            now,
            ReceiptStatus::Completed.as_str(),
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::Validation("receipt_not_cancellable".to_string()));
    }

    let storno = original.storno(next_storno_number(&list_receipts(&transaction)?, now), now);
    transaction.execute(
        "INSERT INTO quick_receipts (id, number, status, created_at, cancelled_at, storno_of,
            payment, tendered_cents, change_cents, tse_signature, lines)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            storno.id.to_string(),
            storno.number,
            storno.status.as_str(),
            storno.created_at,
            storno.cancelled_at,
            storno.storno_of.map(|value| value.to_string()),
            storno.payment.as_str(),
            storno.tendered.cents(),
            storno.change.cents(),
            storno.tse_signature,
            lines_json(&storno.lines),
        ],
    )?;
    apply_stock(&transaction, &storno)?;
    transaction.commit()?;
    Ok(storno)
}

/// Loads the register settings, returning the defaults when nothing was stored yet.
pub fn load_settings(conn: &Connection) -> CoreResult<QuickBillingSettings> {
    let value = crate::store::settings::get(conn, SETTINGS_KEY)?;
    Ok(value
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default())
}

/// Stores the register settings.
pub fn save_settings(conn: &Connection, settings: &QuickBillingSettings) -> CoreResult<()> {
    let value = serde_json::to_value(settings)
        .map_err(|error| CoreError::Validation(format!("quick_billing_settings: {error}")))?;
    crate::store::settings::put(conn, SETTINGS_KEY, &value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::quick_billing::{summarize, DaySummary};
    use crate::store::Store;

    const NOW: i64 = 1_795_780_800_000;

    fn dish(store: &Store, name: &str, cents: i64, rate_bp: i64, stock: i64) -> QuickDish {
        let mut dish = QuickDish::new(name, NOW);
        dish.price = Money::from_cents(cents);
        dish.tax_rate_bp = rate_bp;
        dish.category = "Hauptgerichte".to_string();
        dish.stock = stock;
        dish.options
            .push(DishOption::new("Beilage", "Kartoffelsalat"));
        store.insert_quick_dish(&dish).expect("insert dish");
        dish
    }

    fn receipt(
        number: &str,
        dish: &QuickDish,
        quantity: i64,
        payment: PaymentMethod,
    ) -> QuickReceipt {
        QuickReceipt {
            id: Uuid::new_v4(),
            number: number.to_string(),
            status: ReceiptStatus::Completed,
            created_at: NOW,
            cancelled_at: None,
            storno_of: None,
            payment,
            tendered: dish.price.times(quantity),
            change: Money::ZERO,
            tse_signature: "TSE-DE-TEST1234".to_string(),
            lines: vec![ReceiptLine {
                dish_id: Some(dish.id),
                name: dish.name.clone(),
                category: dish.category.clone(),
                emoji: dish.emoji.clone(),
                quantity,
                unit_price: dish.price,
                tax_rate_bp: dish.tax_rate_bp,
                options: vec!["Beilage: Kartoffelsalat".to_string()],
                note: None,
            }],
        }
    }

    #[test]
    fn dishes_round_trip_with_options_and_can_be_deleted() {
        let store = Store::open_in_memory().expect("store");
        let schnitzel = dish(&store, "Schnitzel", 1_850, 700, 10);

        let loaded = store
            .find_quick_dish(schnitzel.id)
            .expect("find")
            .expect("dish");
        assert_eq!(loaded.name, "Schnitzel");
        assert_eq!(loaded.price, Money::from_cents(1_850));
        assert_eq!(loaded.options.len(), 1);
        assert_eq!(loaded.options[0].label(), "Beilage: Kartoffelsalat");
        assert_eq!(store.quick_dish_count().expect("count"), 1);

        let mut renamed = loaded.clone();
        renamed.name = "Wiener Schnitzel".to_string();
        renamed.stock = 4;
        store.update_quick_dish(&renamed).expect("update");
        let reloaded = store.find_quick_dish(schnitzel.id).expect("find").unwrap();
        assert_eq!(reloaded.name, "Wiener Schnitzel");
        assert_eq!(reloaded.stock, 4);

        store.delete_quick_dish(schnitzel.id).expect("delete");
        assert_eq!(store.quick_dish_count().expect("count"), 0);
        assert!(store
            .delete_quick_dish(schnitzel.id)
            .expect_err("second delete")
            .to_string()
            .contains("not found"));
    }

    #[test]
    fn a_sale_persists_decrements_stock_and_appears_in_the_journal() {
        let store = Store::open_in_memory().expect("store");
        let schnitzel = dish(&store, "Schnitzel", 1_850, 700, 10);
        let cola = dish(&store, "Cola", 320, 1900, 5);

        let mut order = receipt("BON-2026-0001", &schnitzel, 2, PaymentMethod::Cash);
        order.tendered = Money::from_cents(4_000);
        order.change = Money::from_cents(300);
        let mut drink = receipt("BON-2026-0002", &cola, 1, PaymentMethod::Card);
        drink.lines[0].options.clear();
        drink.tendered = Money::from_cents(320);

        store.insert_quick_receipt(&order).expect("sale");
        store.insert_quick_receipt(&drink).expect("sale");

        assert_eq!(
            store.find_quick_dish(schnitzel.id).unwrap().unwrap().stock,
            8
        );
        assert_eq!(store.find_quick_dish(cola.id).unwrap().unwrap().stock, 4);
        assert_eq!(store.quick_receipt_count().expect("count"), 2);

        let journal = store.list_quick_receipts().expect("journal");
        assert_eq!(journal.len(), 2);
        assert_eq!(journal[0].number, "BON-2026-0002");
        assert_eq!(journal[0].payment, PaymentMethod::Card);
        assert_eq!(journal[1].gross(), Money::from_cents(3_700));

        let summary = summarize(&journal);
        assert_eq!(summary.receipts, 2);
        assert_eq!(summary.gross, Money::from_cents(4_020));
        assert_eq!(summary.cash, Money::from_cents(3_700));
        assert_eq!(summary.card, Money::from_cents(320));
    }

    #[test]
    fn cancelling_writes_a_storno_restores_stock_and_adjusts_the_statistics() {
        let store = Store::open_in_memory().expect("store");
        let schnitzel = dish(&store, "Schnitzel", 1_850, 700, 10);
        let cola = dish(&store, "Cola", 320, 1900, 5);

        let order = receipt("BON-2026-0001", &schnitzel, 2, PaymentMethod::Cash);
        let drink = receipt("BON-2026-0002", &cola, 1, PaymentMethod::Nfc);
        store.insert_quick_receipt(&order).expect("sale");
        store.insert_quick_receipt(&drink).expect("sale");

        let storno = store
            .cancel_quick_receipt(order.id, NOW + 60_000)
            .expect("cancel");
        assert_eq!(storno.status, ReceiptStatus::Storno);
        assert_eq!(storno.number, "STO-2026-0001");
        assert_eq!(storno.storno_of, Some(order.id));
        assert_eq!(storno.gross(), Money::from_cents(-3_700));

        let original = store.find_quick_receipt(order.id).unwrap().unwrap();
        assert_eq!(original.status, ReceiptStatus::Cancelled);
        assert_eq!(original.cancelled_at, Some(NOW + 60_000));

        assert_eq!(
            store.find_quick_dish(schnitzel.id).unwrap().unwrap().stock,
            10,
            "the storno must add the sold quantity back"
        );

        let summary = summarize(&store.list_quick_receipts().expect("journal"));
        assert_eq!(summary.receipts, 1);
        assert_eq!(summary.gross, Money::from_cents(320));
        assert_eq!(summary.cash, Money::ZERO);
        assert_eq!(summary.nfc, Money::from_cents(320));

        assert!(
            store.cancel_quick_receipt(order.id, NOW + 120_000).is_err(),
            "a cancelled receipt must not be cancelled twice"
        );
        assert!(
            store
                .cancel_quick_receipt(storno.id, NOW + 120_000)
                .is_err(),
            "a storno booking must not be cancelled"
        );
        let empty = summarize(&[]);
        assert_eq!(empty, DaySummary::default());
    }

    #[test]
    fn settings_round_trip_with_defaults() {
        let store = Store::open_in_memory().expect("store");
        let defaults = store.quick_billing_settings().expect("defaults");
        assert_eq!(defaults, QuickBillingSettings::default());

        let settings = QuickBillingSettings {
            store_name: "Bar 7".to_string(),
            receipt_footer: "Danke!".to_string(),
        };
        store.save_quick_billing_settings(&settings).expect("save");
        assert_eq!(store.quick_billing_settings().expect("load"), settings);
    }

    #[test]
    fn next_numbers_are_sequential_per_year() {
        let store = Store::open_in_memory().expect("store");
        let schnitzel = dish(&store, "Schnitzel", 1_850, 700, 0);
        assert_eq!(
            store.next_quick_receipt_number(NOW).expect("number"),
            "BON-2026-0001"
        );
        store
            .insert_quick_receipt(&receipt(
                "BON-2026-0001",
                &schnitzel,
                1,
                PaymentMethod::Cash,
            ))
            .expect("sale");
        assert_eq!(
            store.next_quick_receipt_number(NOW).expect("number"),
            "BON-2026-0002"
        );
    }
}
