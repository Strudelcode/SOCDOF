//! Contact persistence, including the contact persons of a company.

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::contact::{Contact, ContactKind, ContactPerson, ContactType};
use crate::error::{CoreError, CoreResult};

const COLUMNS: &str = "id, kind, contact_type, name, company_name, first_name, last_name, street, \
                       zip, city, country, email, phone, tax_id, notes, legacy_id, legacy_json, \
                       created_at, updated_at";

const PERSON_COLUMNS: &str = "contact_id, id, first_name, last_name, email, phone, role, \
                              is_primary";

/// Inserts a new contact together with its contact persons.
pub fn insert(conn: &Connection, contact: &Contact) -> CoreResult<()> {
    contact.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO contacts (id, kind, contact_type, name, company_name, first_name, last_name,
            street, zip, city, country, email, phone, tax_id, notes, legacy_id, legacy_json,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
            ?18, ?19)",
        params![
            contact.id.to_string(),
            contact.kind.as_str(),
            contact.contact_type.as_str(),
            contact.name,
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
            contact.notes,
            contact.legacy_id,
            contact.legacy_json,
            contact.created_at,
            contact.updated_at,
        ],
    )?;

    replace_persons(conn, contact)?;
    Ok(())
}

/// Replaces the stored values of an existing contact and its contact persons.
pub fn update(conn: &Connection, contact: &Contact) -> CoreResult<()> {
    contact.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE contacts SET kind = ?2, contact_type = ?3, name = ?4, company_name = ?5,
            first_name = ?6, last_name = ?7, street = ?8, zip = ?9, city = ?10, country = ?11,
            email = ?12, phone = ?13, tax_id = ?14, notes = ?15, legacy_id = ?16,
            legacy_json = ?17, updated_at = ?18
         WHERE id = ?1",
        params![
            contact.id.to_string(),
            contact.kind.as_str(),
            contact.contact_type.as_str(),
            contact.name,
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
            contact.notes,
            contact.legacy_id,
            contact.legacy_json,
            contact.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(contact.id.to_string()));
    }

    replace_persons(conn, contact)?;
    Ok(())
}

/// Removes a contact; its contact persons go with it through the foreign key.
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

/// Loads one contact with its contact persons.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Contact>> {
    let sql = format!("SELECT {COLUMNS} FROM contacts WHERE id = ?1");
    let contact = conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?;
    Ok(match contact {
        Some(mut contact) => {
            contact.contact_persons = persons(conn, contact.id)?;
            Some(contact)
        }
        None => None,
    })
}

/// Loads all contacts ordered by display name, with their contact persons.
pub fn list(conn: &Connection) -> CoreResult<Vec<Contact>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM contacts
         ORDER BY lower(coalesce(nullif(trim(name), ''), nullif(trim(company_name), ''),
            nullif(trim(last_name), ''), ''))"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut contacts = Vec::new();
    for row in rows {
        contacts.push(row?);
    }
    attach_persons(conn, &mut contacts)?;
    Ok(contacts)
}

/// Searches contacts by name, company, email, phone, city, tax id and their contact persons.
pub fn search(conn: &Connection, query: &str) -> CoreResult<Vec<Contact>> {
    let term = format!("%{}%", query.trim().to_lowercase());
    let sql = format!(
        "SELECT {COLUMNS} FROM contacts
         WHERE lower(coalesce(name, '') || ' ' || coalesce(company_name, '') || ' ' ||
             coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
             coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' ||
             coalesce(city, '') || ' ' || coalesce(tax_id, '')) LIKE ?1
            OR EXISTS (
                SELECT 1 FROM contact_persons p WHERE p.contact_id = contacts.id AND
                lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' ||
                    coalesce(p.email, '') || ' ' || coalesce(p.phone, '')) LIKE ?1)
         ORDER BY lower(coalesce(nullif(trim(name), ''), nullif(trim(company_name), ''),
            nullif(trim(last_name), ''), ''))"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![term], map_row)?;

    let mut contacts = Vec::new();
    for row in rows {
        contacts.push(row?);
    }
    attach_persons(conn, &mut contacts)?;
    Ok(contacts)
}

/// Contact ids whose contact persons match `query`, in the legacy substring form.
///
/// The FTS index only carries the contact row itself, so the hybrid search unions this list with
/// the index hits to keep person names findable, as the legacy application did.
pub fn ids_matching_persons(conn: &Connection, query: &str) -> CoreResult<Vec<Uuid>> {
    let term = format!("%{}%", query.trim().to_lowercase());
    let mut statement = conn.prepare(
        "SELECT DISTINCT contact_id FROM contact_persons
         WHERE lower(coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
             coalesce(email, '') || ' ' || coalesce(role, '') || ' ' ||
             coalesce(phone, '')) LIKE ?1
         LIMIT 200",
    )?;
    let rows = statement.query_map(params![term], |row| row.get::<_, String>(0))?;

    let mut ids = Vec::new();
    for row in rows {
        if let Ok(id) = Uuid::parse_str(&row?) {
            ids.push(id);
        }
    }
    Ok(ids)
}

/// Contact persons of one contact in their stored order.
pub fn persons(conn: &Connection, contact_id: Uuid) -> CoreResult<Vec<ContactPerson>> {
    let sql = format!(
        "SELECT {PERSON_COLUMNS} FROM contact_persons WHERE contact_id = ?1 ORDER BY position, id"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![contact_id.to_string()], map_person)?;

    let mut persons = Vec::new();
    for row in rows {
        persons.push(row?);
    }
    Ok(persons)
}

fn replace_persons(conn: &Connection, contact: &Contact) -> CoreResult<()> {
    conn.execute(
        "DELETE FROM contact_persons WHERE contact_id = ?1",
        params![contact.id.to_string()],
    )?;

    for (position, person) in contact.contact_persons.iter().enumerate() {
        conn.execute(
            "INSERT INTO contact_persons (contact_id, id, position, first_name, last_name, email,
                phone, role, is_primary)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                contact.id.to_string(),
                person.id,
                position as i64,
                person.first_name,
                person.last_name,
                person.email,
                person.phone,
                person.role,
                person.is_primary,
            ],
        )?;
    }
    Ok(())
}

/// Attaches the persons of every contact through one query instead of one per row.
fn attach_persons(conn: &Connection, contacts: &mut [Contact]) -> CoreResult<()> {
    if contacts.is_empty() {
        return Ok(());
    }

    let sql =
        format!("SELECT {PERSON_COLUMNS} FROM contact_persons ORDER BY contact_id, position, id");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], |row| {
        let contact_id: String = row.get("contact_id")?;
        let person = map_person(row)?;
        Ok((contact_id, person))
    })?;

    let mut grouped: HashMap<String, Vec<ContactPerson>> = HashMap::new();
    for row in rows {
        let (contact_id, person) = row?;
        grouped.entry(contact_id).or_default().push(person);
    }

    for contact in contacts.iter_mut() {
        if let Some(persons) = grouped.remove(&contact.id.to_string()) {
            contact.contact_persons = persons;
        }
    }
    Ok(())
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Contact> {
    let id_text: String = row.get("id")?;
    let id = Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?;
    let kind_text: String = row.get("kind")?;
    let type_text: String = row.get("contact_type")?;

    Ok(Contact {
        id,
        kind: ContactKind::from_storage(&kind_text).unwrap_or(ContactKind::Person),
        contact_type: ContactType::from_storage(&type_text).unwrap_or(ContactType::Customer),
        name: row.get("name")?,
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
        notes: row.get("notes")?,
        contact_persons: Vec::new(),
        legacy_id: row.get("legacy_id")?,
        legacy_json: row.get("legacy_json")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_person(row: &Row<'_>) -> rusqlite::Result<ContactPerson> {
    Ok(ContactPerson {
        id: row.get("id")?,
        first_name: row.get("first_name")?,
        last_name: row.get("last_name")?,
        email: row.get("email")?,
        phone: row.get("phone")?,
        role: row.get("role")?,
        is_primary: row.get("is_primary")?,
    })
}
