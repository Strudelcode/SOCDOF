//! SQLite persistence of the spreadsheet module.
//!
//! The reference keeps sheet contents in React state only, so nothing survives a reload. The port
//! stores every document as a real row instead: the grid and the style map are JSON columns, the
//! view flags and timestamps are regular columns. Saving an existing id updates the row in place and
//! keeps the original creation time, so a document keeps its identity across edits.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::spreadsheet::{Sheet, SpreadsheetDocument, StyleMap};
use crate::error::CoreResult;

const COLUMNS: &str =
    "id, name, sheet, styles, show_gridlines, show_formula_bar, created_at, updated_at";

fn document_from_row(row: &Row<'_>) -> rusqlite::Result<SpreadsheetDocument> {
    let sheet_json: String = row.get(2)?;
    let styles_json: String = row.get(3)?;
    let rows: Vec<Vec<String>> = serde_json::from_str(&sheet_json).unwrap_or_default();
    let styles: StyleMap = serde_json::from_str(&styles_json).unwrap_or_default();
    Ok(SpreadsheetDocument {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        name: row.get(1)?,
        sheet: if rows.is_empty() {
            Sheet::empty()
        } else {
            Sheet::from_rows(rows)
        },
        styles,
        show_gridlines: row.get::<_, i64>(4)? != 0,
        show_formula_bar: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

/// All documents, most recently changed first.
pub fn list_documents(conn: &Connection) -> CoreResult<Vec<SpreadsheetDocument>> {
    let sql = format!("SELECT {COLUMNS} FROM table_documents ORDER BY updated_at DESC, name ASC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], document_from_row)?;
    let mut documents = Vec::new();
    for row in rows {
        documents.push(row?);
    }
    Ok(documents)
}

/// Loads one document.
pub fn find_document(conn: &Connection, id: Uuid) -> CoreResult<Option<SpreadsheetDocument>> {
    let sql = format!("SELECT {COLUMNS} FROM table_documents WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], document_from_row)
        .optional()?)
}

/// Inserts a new document or updates the existing row with the same id.
pub fn save_document(conn: &Connection, document: &SpreadsheetDocument) -> CoreResult<()> {
    document
        .validate()
        .map_err(crate::error::CoreError::Validation)?;
    let sheet = serde_json::to_string(document.sheet.rows()).unwrap_or_else(|_| "[]".to_string());
    let styles = serde_json::to_string(&document.styles).unwrap_or_else(|_| "{}".to_string());
    conn.execute(
        "INSERT INTO table_documents
             (id, name, sheet, styles, show_gridlines, show_formula_bar, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             sheet = excluded.sheet,
             styles = excluded.styles,
             show_gridlines = excluded.show_gridlines,
             show_formula_bar = excluded.show_formula_bar,
             updated_at = excluded.updated_at",
        params![
            document.id.to_string(),
            document.name.trim(),
            sheet,
            styles,
            i64::from(document.show_gridlines),
            i64::from(document.show_formula_bar),
            document.created_at,
            document.updated_at,
        ],
    )?;
    Ok(())
}

/// Renames a document without touching its contents.
pub fn rename_document(conn: &Connection, id: Uuid, name: &str, now: i64) -> CoreResult<()> {
    if name.trim().is_empty() {
        return Err(crate::error::CoreError::Validation(
            "name_required".to_string(),
        ));
    }
    conn.execute(
        "UPDATE table_documents SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name.trim(), now, id.to_string()],
    )?;
    Ok(())
}

/// Deletes a document and its styles.
pub fn delete_document(conn: &Connection, id: Uuid) -> CoreResult<()> {
    conn.execute(
        "DELETE FROM table_documents WHERE id = ?1",
        params![id.to_string()],
    )?;
    Ok(())
}

/// Number of stored documents.
pub fn document_count(conn: &Connection) -> CoreResult<usize> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM table_documents", [], |row| row.get(0))?;
    Ok(count.max(0) as usize)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spreadsheet::{CellStyle, CellValue};
    use crate::store::Store;

    fn store() -> Store {
        Store::open_in_memory().expect("store")
    }

    #[test]
    fn lifecycle_persists_cells_formulas_styles_and_view_flags() {
        let store = store();
        let mut document = SpreadsheetDocument::new("Inventur", 1_000);
        document.sheet.set(0, 0, "Artikel");
        document.sheet.set(1, 0, "Menge");
        document.sheet.set(2, 0, "Preis");
        document.sheet.set(0, 1, "Schraube");
        document.sheet.set(1, 1, "10");
        document.sheet.set(2, 1, "12,50");
        document.sheet.set(1, 2, "=SUMME(B2:B2)");
        document.styles.insert(
            "A1".to_string(),
            CellStyle {
                bold: true,
                fill: Some("#ffc000".to_string()),
                ..CellStyle::default()
            },
        );
        document.show_gridlines = false;
        store.save_spreadsheet(&document).expect("save");

        let loaded = store
            .find_spreadsheet(document.id)
            .expect("find")
            .expect("present");
        assert_eq!(loaded.name, "Inventur");
        assert_eq!(loaded.sheet.raw(0, 1), "Schraube");
        assert_eq!(loaded.sheet.value(1, 2), CellValue::Number(10.0));
        assert_eq!(loaded.sheet.value(2, 1), CellValue::Number(12.5));
        assert!(loaded.styles.get("A1").expect("style").bold);
        assert_eq!(
            loaded.styles.get("A1").expect("fill").fill.as_deref(),
            Some("#ffc000")
        );
        assert!(!loaded.show_gridlines);
        assert!(loaded.show_formula_bar);
        assert_eq!(loaded.created_at, 1_000);

        // The CSV round trip of the stored document keeps the values.
        let csv = loaded.sheet.to_csv();
        let reread = Sheet::from_csv(&csv);
        assert_eq!(reread.value(2, 1), CellValue::Number(12.5));
        assert_eq!(reread.raw(1, 2), "=SUMME(B2:B2)");

        store.delete_spreadsheet(document.id).expect("delete");
        assert!(store.find_spreadsheet(document.id).expect("find").is_none());
        assert_eq!(store.spreadsheet_count().expect("count"), 0);
    }

    #[test]
    fn editing_a_document_keeps_its_identity_and_creation_time() {
        let store = store();
        let mut document = SpreadsheetDocument::new("Plan", 1_000);
        store.save_spreadsheet(&document).expect("save");
        document.sheet.set(0, 0, "42");
        document.updated_at = 2_000;
        document.show_formula_bar = false;
        store.save_spreadsheet(&document).expect("update");

        assert_eq!(store.spreadsheet_count().expect("count"), 1);
        let loaded = store
            .find_spreadsheet(document.id)
            .expect("find")
            .expect("present");
        assert_eq!(loaded.sheet.raw(0, 0), "42");
        assert_eq!(loaded.created_at, 1_000);
        assert_eq!(loaded.updated_at, 2_000);
        assert!(!loaded.show_formula_bar);
    }

    #[test]
    fn documents_are_listed_by_last_change_and_can_be_renamed() {
        let store = store();
        let mut first = SpreadsheetDocument::new("Erste", 1_000);
        first.updated_at = 1_000;
        let mut second = SpreadsheetDocument::new("Zweite", 2_000);
        second.updated_at = 2_000;
        store.save_spreadsheet(&first).expect("save");
        store.save_spreadsheet(&second).expect("save");
        let names = store
            .list_spreadsheets()
            .expect("list")
            .into_iter()
            .map(|document| document.name)
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["Zweite".to_string(), "Erste".to_string()]);

        store
            .rename_spreadsheet(first.id, "Umbenannt", 3_000)
            .expect("rename");
        let loaded = store
            .find_spreadsheet(first.id)
            .expect("find")
            .expect("present");
        assert_eq!(loaded.name, "Umbenannt");
        assert_eq!(
            store
                .list_spreadsheets()
                .expect("list")
                .first()
                .map(|document| document.name.clone()),
            Some("Umbenannt".to_string())
        );
        assert!(store.rename_spreadsheet(first.id, "   ", 4_000).is_err());
    }

    #[test]
    fn invalid_documents_are_rejected_before_they_reach_the_database() {
        let store = store();
        let mut document = SpreadsheetDocument::new("   ", 1_000);
        assert!(store.save_spreadsheet(&document).is_err());
        document.name = "Ok".to_string();
        store.save_spreadsheet(&document).expect("save");
        assert_eq!(store.spreadsheet_count().expect("count"), 1);
    }
}
