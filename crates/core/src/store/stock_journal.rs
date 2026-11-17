//! Double-entry stock journal persistence.
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;
use crate::domain::stock::{StockJournalEntry, StockLocation, StockMove, StockMoveKind};
use crate::error::{CoreError, CoreResult};

/// Books one journal row and its physical stock effect atomically.
pub fn insert(conn: &Connection, entry: &StockJournalEntry) -> CoreResult<i64> {
    entry.validate().map_err(CoreError::Validation)?;
    let tx = conn.unchecked_transaction()?;
    let current: Option<i64> = tx.query_row(
        "SELECT stock FROM products WHERE id = ?1",
        params![entry.product_id.to_string()],
        |row| row.get(0),
    ).optional()?;
    let Some(current) = current else {
        return Err(CoreError::NotFound(entry.product_id.to_string()));
    };
    let delta = entry.stock_delta();
    let next = current.checked_add(delta)
        .ok_or_else(|| CoreError::Validation("stock_overflow".to_string()))?;
    if next < 0 {
        return Err(CoreError::Validation("stock_insufficient".to_string()));
    }
    if delta != 0 {
        let movement = StockMove {
            id: Uuid::new_v4(),
            product_id: entry.product_id,
            kind: if delta > 0 { StockMoveKind::In } else { StockMoveKind::Out },
            quantity: entry.quantity,
            reason: Some(match entry.notes.as_deref().filter(|n| !n.trim().is_empty()) {
                Some(note) => format!("{} — {}", entry.reference.trim(), note.trim()),
                None => entry.reference.trim().to_string(),
            }),
            created_at: entry.created_at,
        };
        super::products::apply_stock(&tx, &movement)?;
    }
    tx.execute(
        "INSERT INTO stock_journal_entries
            (id, product_id, source_location, dest_location, quantity, reference, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            entry.id.to_string(), entry.product_id.to_string(),
            entry.source_location.as_str(), entry.dest_location.as_str(),
            entry.quantity, entry.reference.trim(),
            entry.notes.as_deref().map(str::trim).filter(|n| !n.is_empty()),
            entry.created_at,
        ],
    )?;
    tx.commit()?;
    Ok(next)
}

/// Lists all journal rows with product identity, newest first.
pub fn list(conn: &Connection) -> CoreResult<Vec<StockJournalEntry>> {
    query(conn, "", false)
}

/// Searches product, SKU, reference, location and notes.
pub fn search(conn: &Connection, term: &str) -> CoreResult<Vec<StockJournalEntry>> {
    let term = term.trim();
    if term.is_empty() { return list(conn); }
    query(conn, &format!("%{term}%"), true)
}

fn query(conn: &Connection, term: &str, filtered: bool) -> CoreResult<Vec<StockJournalEntry>> {
    let mut statement = conn.prepare(
        "SELECT j.id, j.product_id, p.name AS product_name, p.sku AS product_sku,
                j.quantity, j.source_location, j.dest_location, j.reference, j.notes, j.created_at
         FROM stock_journal_entries j JOIN products p ON p.id = j.product_id
         WHERE (?1 = 0 OR p.name LIKE ?2 OR p.sku LIKE ?2 OR j.reference LIKE ?2
                OR j.source_location LIKE ?2 OR j.dest_location LIKE ?2
                OR coalesce(j.notes, '') LIKE ?2)
         ORDER BY j.created_at DESC, j.id DESC",
    )?;
    let rows = statement.query_map(params![if filtered { 1_i64 } else { 0_i64 }, term], map_row)?;
    let mut entries = Vec::new();
    for row in rows { entries.push(row?); }
    Ok(entries)
}

/// Number of journal rows.
pub fn count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM stock_journal_entries", [], |row| row.get(0))?)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<StockJournalEntry> {
    let id: String = row.get("id")?;
    let product_id: String = row.get("product_id")?;
    let source: String = row.get("source_location")?;
    let destination: String = row.get("dest_location")?;
    Ok(StockJournalEntry {
        id: Uuid::parse_str(&id).map_err(|_| rusqlite::Error::InvalidQuery)?,
        product_id: Uuid::parse_str(&product_id).map_err(|_| rusqlite::Error::InvalidQuery)?,
        product_name: row.get("product_name")?,
        product_sku: row.get("product_sku")?,
        quantity: row.get("quantity")?,
        source_location: StockLocation::from_storage(&source).ok_or(rusqlite::Error::InvalidQuery)?,
        dest_location: StockLocation::from_storage(&destination).ok_or(rusqlite::Error::InvalidQuery)?,
        reference: row.get("reference")?,
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::product::Product;
    use crate::store::Store;

    fn entry(product_id: Uuid, quantity: i64, source_location: StockLocation, dest_location: StockLocation, reference: &str, created_at: i64) -> StockJournalEntry {
        StockJournalEntry {
            id: Uuid::new_v4(), product_id, product_name: None, product_sku: None,
            quantity, source_location, dest_location, reference: reference.to_string(),
            notes: None, created_at,
        }
    }

    #[test]
    fn books_inbound_and_outbound_rows_atomically_and_searches_history() {
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Coffee", 1);
        product.stock = 10;
        store.insert_product(&product).expect("product");
        let incoming = entry(product.id, 8, StockLocation::Vendors, StockLocation::Warehouse, "WH/IN/001", 2);
        assert_eq!(store.insert_stock_journal_entry(&incoming).expect("receipt"), 18);
        let outgoing = entry(product.id, 5, StockLocation::Warehouse, StockLocation::Customers, "WH/OUT/001", 3);
        assert_eq!(store.insert_stock_journal_entry(&outgoing).expect("issue"), 13);
        assert_eq!(store.find_product(product.id).expect("find").unwrap().stock, 13);
        let rows = store.list_stock_journal_entries().expect("journal");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].reference, "WH/OUT/001");
        assert_eq!(rows[1].product_name.as_deref(), Some("Coffee"));
        assert_eq!(store.search_stock_journal_entries("Coffee").expect("search").len(), 2);
    }

    #[test]
    fn virtual_transfer_is_logged_without_changing_physical_stock() {
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Coffee", 1);
        product.stock = 4;
        store.insert_product(&product).expect("product");
        let transfer = entry(product.id, 2, StockLocation::Vendors, StockLocation::Scrap, "VIRTUAL/001", 2);
        assert_eq!(store.insert_stock_journal_entry(&transfer).expect("transfer"), 4);
        assert_eq!(store.find_product(product.id).expect("find").unwrap().stock, 4);
        assert_eq!(store.stock_journal_count().expect("count"), 1);
    }

    #[test]
    fn insufficient_stock_does_not_create_a_journal_row() {
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Coffee", 1);
        product.stock = 2;
        store.insert_product(&product).expect("product");
        let outgoing = entry(product.id, 3, StockLocation::Warehouse, StockLocation::Customers, "WH/OUT/002", 2);
        assert!(matches!(
            store.insert_stock_journal_entry(&outgoing),
            Err(CoreError::Validation(code)) if code == "stock_insufficient"
        ));
        assert_eq!(store.stock_journal_count().expect("count"), 0);
        assert_eq!(store.find_product(product.id).expect("find").unwrap().stock, 2);
    }
}
