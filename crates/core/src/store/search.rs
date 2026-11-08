//! Full-text search over the FTS5 indices.
//!
//! The indices are maintained by triggers in schema v4, so every writer (UI, CLI, legacy import)
//! keeps them in sync. Queries are turned into quoted prefix terms, which means user input cannot
//! inject FTS operators, and a query without usable terms simply returns no rows.
//!
//! Callers that also want the legacy substring behaviour use the hybrid helpers: they try the index
//! first and fall back to the `LIKE` search of the aggregate module when the index finds nothing.

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::product::Product;
use crate::error::CoreResult;
use crate::store::{contacts, invoices, products};

/// Default number of rows returned by a search.
pub const DEFAULT_LIMIT: i64 = 200;

/// Converts free user input into an FTS5 prefix query.
///
/// Returns `None` when the input has no usable term.
pub fn match_query(query: &str) -> Option<String> {
    // FTS operators are stripped before quoting, so a query can never change the shape of the
    // expression. Collapsing the separators keeps one term per word.
    let cleaned: String = query
        .chars()
        .map(|character| {
            if "\"*():^-".contains(character) {
                ' '
            } else {
                character
            }
        })
        .collect();

    let terms: Vec<String> = cleaned
        .split_whitespace()
        .map(|term| format!("\"{term}\"*"))
        .collect();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

/// Searches contacts through the index, falling back to substring matching.
pub fn contacts(conn: &Connection, query: &str) -> CoreResult<Vec<Contact>> {
    let ids = matching_ids(conn, "contacts_fts", "contact_id", query)?;
    if ids.is_empty() {
        return contacts::search(conn, query);
    }
    load(ids, |id| contacts::find(conn, id))
}

/// Searches products through the index, falling back to substring matching.
pub fn products(conn: &Connection, query: &str) -> CoreResult<Vec<Product>> {
    let ids = matching_ids(conn, "products_fts", "product_id", query)?;
    if ids.is_empty() {
        return products::search(conn, query);
    }
    load(ids, |id| products::find(conn, id))
}

/// Searches invoices by number, note and position descriptions.
///
/// The invoice index has no substring fallback because invoices are already loaded with their
/// positions; a short query therefore uses the same `LIKE` scan the legacy app used.
pub fn invoices(conn: &Connection, query: &str) -> CoreResult<Vec<Invoice>> {
    let ids = matching_ids(conn, "invoices_fts", "invoice_id", query)?;
    if ids.is_empty() {
        return invoices::search(conn, query);
    }

    let mut found = Vec::new();
    for id in ids {
        if let Some(invoice) = invoices::find(conn, id)? {
            found.push(invoice);
        }
    }
    Ok(found)
}

fn matching_ids(
    conn: &Connection,
    table: &str,
    id_column: &str,
    query: &str,
) -> CoreResult<Vec<Uuid>> {
    let Some(expression) = match_query(query) else {
        return Ok(Vec::new());
    };

    let sql =
        format!("SELECT {id_column} FROM {table} WHERE {table} MATCH ?1 ORDER BY rank LIMIT ?2");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![expression, DEFAULT_LIMIT], |row| {
        let id: String = row.get(0)?;
        Ok(id)
    })?;

    let mut ids = Vec::new();
    for row in rows {
        let text = row?;
        if let Ok(id) = Uuid::parse_str(&text) {
            ids.push(id);
        }
    }
    Ok(ids)
}

fn load<T>(
    ids: Vec<Uuid>,
    mut find: impl FnMut(Uuid) -> CoreResult<Option<T>>,
) -> CoreResult<Vec<T>> {
    let mut found = Vec::new();
    for id in ids {
        if let Some(record) = find(id)? {
            found.push(record);
        }
    }
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_terms_and_marks_prefixes() {
        assert_eq!(
            match_query("Alpen Tech"),
            Some("\"Alpen\"* \"Tech\"*".to_string())
        );
        assert_eq!(match_query("  "), None);
        assert_eq!(
            match_query("weird\"*-:()term"),
            Some("\"weird\"* \"term\"*".to_string())
        );
    }
}
