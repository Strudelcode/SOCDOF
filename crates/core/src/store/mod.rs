//! SQLite persistence.
//!
//! The store owns a single connection. Schema changes are applied through `PRAGMA user_version`, so
//! existing databases are upgraded in order instead of being recreated.

use rusqlite::Connection;

use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::error::CoreResult;

pub mod contacts;
pub mod invoices;

/// Schema version written to `PRAGMA user_version`.
pub const SCHEMA_VERSION: i64 = 1;

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS contacts (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    company_name  TEXT,
    first_name    TEXT,
    last_name     TEXT,
    street        TEXT,
    zip           TEXT,
    city          TEXT,
    country       TEXT,
    email         TEXT,
    phone         TEXT,
    tax_id        TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id             TEXT PRIMARY KEY,
    sku            TEXT NOT NULL DEFAULT '',
    name           TEXT NOT NULL,
    unit           TEXT NOT NULL DEFAULT 'Stk',
    price_cents    INTEGER NOT NULL DEFAULT 0,
    tax_rate_bp    INTEGER NOT NULL DEFAULT 1900,
    stock          INTEGER NOT NULL DEFAULT 0,
    reorder_level  INTEGER NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    id               TEXT PRIMARY KEY,
    number           TEXT NOT NULL UNIQUE,
    contact_id       TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    status           TEXT NOT NULL,
    issued_at        INTEGER NOT NULL,
    due_at           INTEGER NOT NULL,
    currency_symbol  TEXT NOT NULL DEFAULT '€',
    note             TEXT
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id       TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position         INTEGER NOT NULL,
    description      TEXT NOT NULL,
    quantity_milli   INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    tax_rate_bp      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);

CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
"#;

/// A connection to the SOCDOF database.
pub struct Store {
    conn: Connection,
}

impl Store {
    /// Opens (and creates) a database file and applies pending migrations.
    pub fn open(path: impl AsRef<std::path::Path>) -> CoreResult<Self> {
        let store = Store {
            conn: Connection::open(path)?,
        };
        store.migrate()?;
        Ok(store)
    }

    /// Opens a throw-away in-memory database, used by tests and the parity playground.
    pub fn open_in_memory() -> CoreResult<Self> {
        let store = Store {
            conn: Connection::open_in_memory()?,
        };
        store.migrate()?;
        Ok(store)
    }

    /// Applies all migrations that are newer than the stored `user_version`.
    fn migrate(&self) -> CoreResult<()> {
        self.conn.pragma_update(None, "foreign_keys", "ON")?;
        let mut version: i64 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;

        if version < 1 {
            self.conn.execute_batch(SCHEMA_V1)?;
            version = 1;
        }

        self.conn.pragma_update(None, "user_version", version)?;
        Ok(())
    }

    /// Schema version currently stored in the database.
    pub fn schema_version(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?)
    }

    /// Number of rows in `contacts`.
    pub fn contact_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))?)
    }

    /// Number of rows in `invoices`.
    pub fn invoice_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))?)
    }

    /// Inserts a contact.
    pub fn insert_contact(&self, contact: &Contact) -> CoreResult<()> {
        contacts::insert(&self.conn, contact)
    }

    /// Lists all contacts ordered by display name.
    pub fn list_contacts(&self) -> CoreResult<Vec<Contact>> {
        contacts::list(&self.conn)
    }

    /// Looks up a single contact.
    pub fn find_contact(&self, id: uuid::Uuid) -> CoreResult<Option<Contact>> {
        contacts::find(&self.conn, id)
    }

    /// Inserts an invoice together with its positions inside one transaction.
    pub fn insert_invoice(&self, invoice: &Invoice) -> CoreResult<()> {
        invoices::insert(&self.conn, invoice)
    }

    /// Lists all invoices including their positions.
    pub fn list_invoices(&self) -> CoreResult<Vec<Invoice>> {
        invoices::list(&self.conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use crate::now_millis;
    use uuid::Uuid;

    fn contact(store: &Store) -> Contact {
        let mut contact = Contact::new(ContactKind::Company, now_millis());
        contact.company_name = Some("Strudelcode".to_string());
        contact.city = Some("Bozen".to_string());
        store.insert_contact(&contact).expect("contact inserted");
        contact
    }

    #[test]
    fn migrates_to_current_schema_version() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(store.schema_version().expect("version"), SCHEMA_VERSION);
        assert_eq!(store.contact_count().expect("count"), 0);
    }

    #[test]
    fn roundtrips_contacts() {
        let store = Store::open_in_memory().expect("store");
        let created = contact(&store);

        let loaded = store
            .find_contact(created.id)
            .expect("query")
            .expect("contact present");
        assert_eq!(loaded, created);
        assert_eq!(store.list_contacts().expect("list"), vec![created]);
    }

    #[test]
    fn roundtrips_invoices_with_positions() {
        let store = Store::open_in_memory().expect("store");
        let buyer = contact(&store);

        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-0001".to_string(),
            contact_id: buyer.id,
            status: InvoiceStatus::Sent,
            issued_at: now_millis(),
            due_at: now_millis(),
            currency_symbol: "€".to_string(),
            note: Some("Danke für den Auftrag".to_string()),
            lines: vec![
                InvoiceLine {
                    description: "Beratung".to_string(),
                    quantity_milli: 1_500,
                    unit_price: Money::from_cents(8_000),
                    tax_rate_bp: 1900,
                },
                InvoiceLine {
                    description: "Material".to_string(),
                    quantity_milli: 1_000,
                    unit_price: Money::from_cents(1_250),
                    tax_rate_bp: 700,
                },
            ],
        };

        store.insert_invoice(&invoice).expect("invoice inserted");

        let loaded = store.list_invoices().expect("list");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0], invoice);
        assert_eq!(loaded[0].total_net(), Money::from_cents(13_250));
        assert_eq!(loaded[0].total_gross(), Money::from_cents(15_618));
        assert_eq!(store.invoice_count().expect("count"), 1);
    }

    #[test]
    fn rejects_invalid_records() {
        let store = Store::open_in_memory().expect("store");
        let mut invalid = Contact::new(ContactKind::Person, now_millis());
        invalid.email = Some("not-an-email".to_string());

        let error = store.insert_contact(&invalid).expect_err("must fail");
        assert!(matches!(error, crate::error::CoreError::Validation(_)));
    }

    #[test]
    fn rolls_back_invoice_without_positions() {
        let store = Store::open_in_memory().expect("store");
        let buyer = contact(&store);

        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-0002".to_string(),
            contact_id: buyer.id,
            status: InvoiceStatus::Draft,
            issued_at: 0,
            due_at: 0,
            currency_symbol: "€".to_string(),
            note: None,
            lines: Vec::new(),
        };

        assert!(store.insert_invoice(&invoice).is_err());
        assert_eq!(store.invoice_count().expect("count"), 0);
    }
}
