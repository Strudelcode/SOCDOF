//! Document persistence for the built-in text editor.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::document::Document;
use crate::error::{CoreError, CoreResult};

const COLUMNS: &str = "id, name, body, created_at, updated_at";

/// Inserts a new document.
pub fn insert(conn: &Connection, document: &Document) -> CoreResult<()> {
    document.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO documents (id, name, body, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            document.id.to_string(),
            document.name.trim(),
            document.body,
            document.created_at,
            document.updated_at,
        ],
    )?;
    Ok(())
}

/// Replaces the name, content and update time of an existing document.
pub fn update(conn: &Connection, document: &Document) -> CoreResult<()> {
    document.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE documents SET name = ?2, body = ?3, updated_at = ?4 WHERE id = ?1",
        params![
            document.id.to_string(),
            document.name.trim(),
            document.body,
            document.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(document.id.to_string()));
    }
    Ok(())
}

/// Removes a document.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM documents WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads one document.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Document>> {
    let sql = format!("SELECT {COLUMNS} FROM documents WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Lists documents, most recently changed first.
pub fn list(conn: &Connection) -> CoreResult<Vec<Document>> {
    let sql = format!("SELECT {COLUMNS} FROM documents ORDER BY updated_at DESC, lower(name), id");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;
    let mut documents = Vec::new();
    for row in rows {
        documents.push(row?);
    }
    Ok(documents)
}

/// Searches names and contents, most recently changed first.
pub fn search(conn: &Connection, query: &str) -> CoreResult<Vec<Document>> {
    let term = format!("%{}%", query.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM documents
         WHERE lower(name || ' ' || body) LIKE ?1
         ORDER BY updated_at DESC, lower(name), id"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![term], map_row)?;
    let mut documents = Vec::new();
    for row in rows {
        documents.push(row?);
    }
    Ok(documents)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Document> {
    let id_text: String = row.get("id")?;
    let id = Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(Document {
        id,
        name: row.get("name")?,
        body: row.get("body")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
