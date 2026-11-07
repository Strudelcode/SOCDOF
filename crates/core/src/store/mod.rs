//! SQLite persistence.
//!
//! The store owns a single connection. Schema changes are applied through `PRAGMA user_version`, so
//! existing databases are upgraded in order instead of being recreated.

use rusqlite::{params, Connection};

use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::product::Product;
use crate::domain::settings::CompanyProfile;
use crate::domain::stock::StockMove;
use crate::domain::user::User;
use crate::error::CoreResult;

pub mod contacts;
pub mod invoices;
pub mod products;
pub mod settings;
pub mod users;

/// Schema version written to `PRAGMA user_version`.
pub const SCHEMA_VERSION: i64 = 3;

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

const SCHEMA_V3: &str = r#"
ALTER TABLE contacts ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE contacts ADD COLUMN name TEXT;
ALTER TABLE contacts ADD COLUMN notes TEXT;
ALTER TABLE contacts ADD COLUMN legacy_id INTEGER;
ALTER TABLE contacts ADD COLUMN legacy_json TEXT;

ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN cost_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN target_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN image_emoji TEXT;
ALTER TABLE products ADD COLUMN exclude_from_reorder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN legacy_id INTEGER;
ALTER TABLE products ADD COLUMN legacy_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_legacy_id ON contacts(legacy_id)
    WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_legacy_id ON products(legacy_id)
    WHERE legacy_id IS NOT NULL;
"#;

const SCHEMA_V2: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id                    TEXT PRIMARY KEY,
    username              TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name          TEXT NOT NULL,
    role                  TEXT NOT NULL,
    role_id               TEXT,
    active                INTEGER NOT NULL DEFAULT 1,
    password_hash         TEXT NOT NULL,
    must_change_password  INTEGER NOT NULL DEFAULT 1,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_moves (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    quantity    INTEGER NOT NULL,
    reason      TEXT,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_moves_product ON stock_moves(product_id, created_at);
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

        if version < 2 {
            self.conn.execute_batch(SCHEMA_V2)?;
            version = 2;
        }

        if version < 3 {
            self.conn.execute_batch(SCHEMA_V3)?;
            version = 3;
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

    /// Replaces an existing contact.
    pub fn update_contact(&self, contact: &Contact) -> CoreResult<()> {
        contacts::update(&self.conn, contact)
    }

    /// Deletes a contact.
    pub fn delete_contact(&self, id: uuid::Uuid) -> CoreResult<()> {
        contacts::delete(&self.conn, id)
    }

    /// Searches contacts by name, company, email, phone, city or tax id.
    pub fn search_contacts(&self, query: &str) -> CoreResult<Vec<Contact>> {
        contacts::search(&self.conn, query)
    }

    /// Inserts an invoice together with its positions inside one transaction.
    pub fn insert_invoice(&self, invoice: &Invoice) -> CoreResult<()> {
        invoices::insert(&self.conn, invoice)
    }

    /// Lists all invoices including their positions.
    pub fn list_invoices(&self) -> CoreResult<Vec<Invoice>> {
        invoices::list(&self.conn)
    }

    /// Inserts a product.
    pub fn insert_product(&self, product: &Product) -> CoreResult<()> {
        products::insert(&self.conn, product)
    }

    /// Lists all products ordered by name.
    pub fn list_products(&self) -> CoreResult<Vec<Product>> {
        products::list(&self.conn)
    }

    /// Looks up a single product.
    pub fn find_product(&self, id: uuid::Uuid) -> CoreResult<Option<Product>> {
        products::find(&self.conn, id)
    }

    /// Replaces an existing product.
    pub fn update_product(&self, product: &Product) -> CoreResult<()> {
        products::update(&self.conn, product)
    }

    /// Deletes a product.
    pub fn delete_product(&self, id: uuid::Uuid) -> CoreResult<()> {
        products::delete(&self.conn, id)
    }

    /// Searches products by name, SKU, barcode, category or description.
    pub fn search_products(&self, query: &str) -> CoreResult<Vec<Product>> {
        products::search(&self.conn, query)
    }

    /// Records a stock movement and returns the resulting stock level.
    pub fn adjust_stock(&self, movement: &StockMove) -> CoreResult<i64> {
        products::adjust_stock(&self.conn, movement)
    }

    /// Number of products.
    pub fn product_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))?)
    }

    /// Writes a consistent copy of the database to `target` using SQLite's `VACUUM INTO`.
    pub fn snapshot_to(&self, target: &std::path::Path) -> CoreResult<()> {
        if target.exists() {
            std::fs::remove_file(target)?;
        }

        self.conn.execute(
            "VACUUM INTO ?1",
            params![target.to_string_lossy().to_string()],
        )?;
        Ok(())
    }

    /// Number of user accounts.
    pub fn user_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?)
    }

    /// Inserts a user. Hash the password with [`crate::security::hash_password`] first.
    pub fn insert_user(&self, user: &User) -> CoreResult<()> {
        users::insert(&self.conn, user)
    }

    /// Finds a user by login name, ignoring case.
    pub fn find_user_by_username(&self, username: &str) -> CoreResult<Option<User>> {
        users::find_by_username(&self.conn, username)
    }

    /// Lists all users ordered by display name.
    pub fn list_users(&self) -> CoreResult<Vec<User>> {
        users::list(&self.conn)
    }

    /// Verifies credentials and returns the account on success.
    pub fn authenticate(&self, username: &str, password: &str) -> CoreResult<Option<User>> {
        users::authenticate(&self.conn, username, password)
    }

    /// Stores a new password hash and clears the "must change password" flag.
    pub fn set_password(&self, user_id: uuid::Uuid, password_hash: &str) -> CoreResult<()> {
        users::set_password(&self.conn, user_id, password_hash)
    }

    /// Reads a JSON setting.
    pub fn get_setting(&self, key: &str) -> CoreResult<Option<serde_json::Value>> {
        settings::get(&self.conn, key)
    }

    /// Writes a JSON setting.
    pub fn put_setting(&self, key: &str, value: &serde_json::Value) -> CoreResult<()> {
        settings::put(&self.conn, key, value)
    }

    /// Loads the company profile, returning defaults when nothing was stored yet.
    pub fn company_profile(&self) -> CoreResult<CompanyProfile> {
        settings::load_company_profile(&self.conn)
    }

    /// Stores the company profile.
    pub fn save_company_profile(&self, profile: &CompanyProfile) -> CoreResult<()> {
        settings::save_company_profile(&self.conn, profile)
    }

    /// The underlying connection, used by the legacy backup reader/writer.
    pub(crate) fn connection(&self) -> &rusqlite::Connection {
        &self.conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::domain::settings::ThemeMode;
    use crate::domain::stock::StockMoveKind;
    use crate::domain::user::UserRole;
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

    fn user(store: &Store, password: &str) -> User {
        let now = now_millis();
        let account = User {
            id: Uuid::new_v4(),
            username: "admin".to_string(),
            display_name: "Administrator".to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: crate::security::hash_password(password).expect("hash"),
            must_change_password: true,
            created_at: now,
            updated_at: now,
        };
        store.insert_user(&account).expect("user inserted");
        account
    }

    #[test]
    fn roundtrips_users_and_authenticates() {
        let store = Store::open_in_memory().expect("store");
        let account = user(&store, "admin-passwort");

        let found = store
            .find_user_by_username("ADMIN")
            .expect("query")
            .expect("user present");
        assert_eq!(found, account);

        assert_eq!(
            store.authenticate("admin", "admin-passwort").expect("auth"),
            Some(account.clone())
        );
        assert_eq!(store.authenticate("admin", "falsch").expect("auth"), None);
        assert_eq!(store.authenticate("unbekannt", "egal").expect("auth"), None);
        assert_eq!(store.list_users().expect("list"), vec![account]);
    }

    #[test]
    fn changes_passwords_and_clears_the_change_flag() {
        let store = Store::open_in_memory().expect("store");
        let account = user(&store, "admin-passwort");
        assert!(account.must_change_password);

        let hash = crate::security::hash_password("neues-passwort").expect("hash");
        store.set_password(account.id, &hash).expect("password set");

        let updated = store
            .find_user_by_username("admin")
            .expect("query")
            .expect("user present");
        assert!(!updated.must_change_password);
        assert!(store
            .authenticate("admin", "neues-passwort")
            .expect("auth")
            .is_some());
        assert!(store
            .authenticate("admin", "admin-passwort")
            .expect("auth")
            .is_none());
    }

    #[test]
    fn roundtrips_products_and_stock_movements() {
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Kaffee", now_millis());
        product.price = Money::from_cents(499);
        product.stock = 10;
        store.insert_product(&product).expect("product inserted");

        let movement = StockMove {
            id: Uuid::new_v4(),
            product_id: product.id,
            kind: StockMoveKind::Out,
            quantity: 4,
            reason: Some("Rechnung 2026-0001".to_string()),
            created_at: now_millis(),
        };

        assert_eq!(store.adjust_stock(&movement).expect("adjusted"), 6);
        assert_eq!(store.list_products().expect("list")[0].stock, 6);

        let too_much = StockMove {
            quantity: 99,
            ..movement
        };
        assert!(store.adjust_stock(&too_much).is_err());
        assert_eq!(store.list_products().expect("list")[0].stock, 6);
    }

    #[test]
    fn stores_the_company_profile() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(
            store.company_profile().expect("profile"),
            CompanyProfile::default()
        );

        let profile = CompanyProfile {
            name: "Strudelcode".to_string(),
            theme_mode: ThemeMode::Dark,
            ..CompanyProfile::default()
        };
        store.save_company_profile(&profile).expect("saved");

        assert_eq!(store.company_profile().expect("profile"), profile);
    }
}
