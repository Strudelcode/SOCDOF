//! Contact persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::contact::{Contact, ContactKind};
use crate::error::{CoreError, CoreResult};

const COLUMNS: &str = "id, kind, company_name, first_name, last_name, street, zip, city, country, \
                       email, phone, tax_id, created_at, updated_at";

/// Inserts a new contact.
pub fn insert(conn: &Connection, contact: &Contact) -> CoreResult<()> {
    contact.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO contacts (id, kind, company_name, first_name, last_name, street, zip, city,
            country, email, phone, tax_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            contact.id.to_string(),
            contact.kind.as_str(),
            contact.company_name,
            contact.first_name,
            contact.last_name,
            contact.street,
            contact.zip,
            contact.city,
            contact.country,
            contact.email,
            contact.phone,
            contact.tax_id,
            contact.created_at,
            contact.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing contact.
pub fn update(conn: &Connection, contact: &Contact) -> CoreResult<()> {
    contact.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE contacts SET kind = ?2, company_name = ?3, first_name = ?4, last_name = ?5,
            street = ?6, zip = ?7, city = ?8, country = ?9, email = ?10, phone = ?11,
            tax_id = ?12, updated_at = ?13
         WHERE id = ?1",
        params![
            contact.id.to_string(),
            contact.kind.as_str(),
            contact.company_name,
            contact.first_name,
            contact.last_name,
            contact.street,
            contact.zip,
            contact.city,
            contact.country,
            contact.email,
            contact.phone,
            contact.tax_id,
            contact.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(contact.id.to_string()));
    }

    Ok(())
}

/// Removes a contact.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM contacts WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Loads one contact.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Contact>> {
    let sql = format!("SELECT {COLUMNS} FROM contacts WHERE id = ?1");
    let contact = conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?;
    Ok(contact)
}

/// Loads all contacts ordered by display name.
pub fn list(conn: &Connection) -> CoreResult<Vec<Contact>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM contacts
         ORDER BY lower(coalesce(nullif(trim(company_name), ''), nullif(trim(last_name), ''), ''))"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut contacts = Vec::new();
    for row in rows {
        contacts.push(row?);
    }
    Ok(contacts)
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Contact> {
    let id_text: String = row.get("id")?;
    let id = Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?;
    let kind_text: String = row.get("kind")?;

    Ok(Contact {
        id,
        kind: ContactKind::from_storage(&kind_text).unwrap_or(ContactKind::Person),
        company_name: row.get("company_name")?,
        first_name: row.get("first_name")?,
        last_name: row.get("last_name")?,
        street: row.get("street")?,
        zip: row.get("zip")?,
        city: row.get("city")?,
        country: row.get("country")?,
        email: row.get("email")?,
        phone: row.get("phone")?,
        tax_id: row.get("tax_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
