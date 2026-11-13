//! SQLite persistence.
//!
//! The store owns a single connection. Schema changes are applied through `PRAGMA user_version`, so
//! existing databases are upgraded in order instead of being recreated.

use rusqlite::{params, Connection};

use crate::domain::accounting::JournalEntry;
use crate::domain::appointment::Appointment;
use crate::domain::billing::BillingItem;
use crate::domain::contact::Contact;
use crate::domain::document::Document;
use crate::domain::fleet::{FleetFuel, FleetTrip, FleetVehicle};
use crate::domain::invoice::Invoice;
use crate::domain::payment::InvoicePayment;
use crate::domain::permission::{AppModule, PermissionLevel, Role};
use crate::domain::pos::PosOrder;
use crate::domain::product::Product;
use crate::domain::project::{Project, ProjectTask};
use crate::domain::purchase::PurchaseOrder;
use crate::domain::restaurant::{MenuItem, TableOrder};
use crate::domain::session::{LoginOutcome, Session};
use crate::domain::settings::CompanyProfile;
use crate::domain::stock::StockMove;
use crate::domain::support::{SupportTicket, TicketStatus, TimeEntry};
use crate::domain::therapy::{TherapyClient, TherapySession};
use crate::domain::user::User;
use crate::domain::workspace::{Report, Widget};
use crate::error::CoreResult;

pub mod appointments;
pub mod billing_items;
pub mod contacts;
pub mod dashboard;
pub mod documents;
pub mod fleet;
pub mod invoices;
pub mod journal;
pub mod maintenance;
pub mod permissions;
pub mod pos_orders;
pub mod products;
pub mod projects;
pub mod purchase_orders;
pub mod reports;
pub mod restaurant;
pub mod search;
pub mod sessions;
pub mod settings;
pub mod support;
pub mod therapy;
pub mod users;
pub mod workspace;

/// Schema version written to `PRAGMA user_version`.
pub const SCHEMA_VERSION: i64 = 15;

const SCHEMA_V10: &str = r#"
-- Contact persons of a company ("sub-contacts" in the legacy application). They belong to exactly
-- one contact, keep their order and carry the primary flag the legacy editor manages.
CREATE TABLE IF NOT EXISTS contact_persons (
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name  TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, id)
);

CREATE INDEX IF NOT EXISTS idx_contact_persons_contact
    ON contact_persons(contact_id, position);
"#;

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

const SCHEMA_V4: &str = r#"
-- Remaining aggregates, roles and sessions.
CREATE TABLE IF NOT EXISTS purchase_orders (
    id               TEXT PRIMARY KEY,
    number           TEXT NOT NULL UNIQUE,
    vendor_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    status           TEXT NOT NULL,
    order_date       INTEGER NOT NULL,
    expected_at      INTEGER,
    currency_symbol  TEXT NOT NULL DEFAULT '€',
    note             TEXT,
    legacy_id        INTEGER,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_legacy_id ON purchase_orders(legacy_id)
    WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    position          INTEGER NOT NULL,
    product_id        TEXT REFERENCES products(id) ON DELETE SET NULL,
    description       TEXT NOT NULL,
    quantity_milli    INTEGER NOT NULL,
    unit_cost_cents   INTEGER NOT NULL,
    tax_rate_bp       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order
    ON purchase_order_lines(purchase_order_id, position);

CREATE TABLE IF NOT EXISTS pos_orders (
    id               TEXT PRIMARY KEY,
    receipt_number   TEXT NOT NULL UNIQUE,
    contact_id       TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    payment_method   TEXT NOT NULL,
    paid_at          INTEGER NOT NULL,
    currency_symbol  TEXT NOT NULL DEFAULT '€',
    note             TEXT,
    legacy_id        INTEGER,
    created_at       INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_orders_legacy_id ON pos_orders(legacy_id)
    WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_orders_paid_at ON pos_orders(paid_at);

CREATE TABLE IF NOT EXISTS pos_order_lines (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    pos_order_id      TEXT NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
    position          INTEGER NOT NULL,
    product_id        TEXT REFERENCES products(id) ON DELETE SET NULL,
    description       TEXT NOT NULL,
    quantity_milli    INTEGER NOT NULL,
    unit_price_cents  INTEGER NOT NULL,
    tax_rate_bp       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_order_lines_order ON pos_order_lines(pos_order_id, position);

CREATE TABLE IF NOT EXISTS billing_items (
    id               TEXT PRIMARY KEY,
    contact_id       TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    invoice_id       TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    kind             TEXT NOT NULL,
    code             TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL,
    service_date     INTEGER NOT NULL,
    quantity_milli   INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    tax_rate_bp      INTEGER NOT NULL,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_items_contact ON billing_items(contact_id, service_date);
CREATE INDEX IF NOT EXISTS idx_billing_items_invoice ON billing_items(invoice_id);

CREATE TABLE IF NOT EXISTS appointments (
    id          TEXT PRIMARY KEY,
    contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    location    TEXT,
    notes       TEXT,
    status      TEXT NOT NULL,
    starts_at   INTEGER NOT NULL,
    ends_at     INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_range ON appointments(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);

CREATE TABLE IF NOT EXISTS support_tickets (
    id          TEXT PRIMARY KEY,
    contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    subject     TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL,
    priority    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    closed_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, priority);

CREATE TABLE IF NOT EXISTS time_entries (
    id          TEXT PRIMARY KEY,
    ticket_id   TEXT REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    minutes     INTEGER NOT NULL,
    started_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id, started_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_range ON time_entries(started_at);

CREATE TABLE IF NOT EXISTS widgets (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    config     TEXT NOT NULL DEFAULT '{}',
    position   INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,
    title        TEXT NOT NULL,
    parameters   TEXT NOT NULL DEFAULT '{}',
    generated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_generated ON reports(generated_at DESC);

CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_builtin  INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
    username     TEXT PRIMARY KEY COLLATE NOCASE,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    updated_at   INTEGER NOT NULL
);

-- Full-text search indices, kept in sync by triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS contacts_fts
    USING fts5(contact_id UNINDEXED, body, tokenize = 'unicode61 remove_diacritics 2');

CREATE VIRTUAL TABLE IF NOT EXISTS products_fts
    USING fts5(product_id UNINDEXED, body, tokenize = 'unicode61 remove_diacritics 2');

CREATE VIRTUAL TABLE IF NOT EXISTS invoices_fts
    USING fts5(invoice_id UNINDEXED, body, tokenize = 'unicode61 remove_diacritics 2');

CREATE TRIGGER IF NOT EXISTS contacts_fts_ai AFTER INSERT ON contacts BEGIN
    INSERT INTO contacts_fts(contact_id, body) VALUES (new.id,
        coalesce(new.name, '') || ' ' || coalesce(new.company_name, '') || ' ' ||
        coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '') || ' ' ||
        coalesce(new.email, '') || ' ' || coalesce(new.phone, '') || ' ' ||
        coalesce(new.city, '') || ' ' || coalesce(new.zip, '') || ' ' ||
        coalesce(new.country, '') || ' ' || coalesce(new.tax_id, '') || ' ' ||
        coalesce(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS contacts_fts_au AFTER UPDATE ON contacts BEGIN
    DELETE FROM contacts_fts WHERE contact_id = old.id;
    INSERT INTO contacts_fts(contact_id, body) VALUES (new.id,
        coalesce(new.name, '') || ' ' || coalesce(new.company_name, '') || ' ' ||
        coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '') || ' ' ||
        coalesce(new.email, '') || ' ' || coalesce(new.phone, '') || ' ' ||
        coalesce(new.city, '') || ' ' || coalesce(new.zip, '') || ' ' ||
        coalesce(new.country, '') || ' ' || coalesce(new.tax_id, '') || ' ' ||
        coalesce(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS contacts_fts_ad AFTER DELETE ON contacts BEGIN
    DELETE FROM contacts_fts WHERE contact_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
    INSERT INTO products_fts(product_id, body) VALUES (new.id,
        coalesce(new.name, '') || ' ' || coalesce(new.sku, '') || ' ' ||
        coalesce(new.barcode, '') || ' ' || coalesce(new.category, '') || ' ' ||
        coalesce(new.description, '') || ' ' || coalesce(new.unit, ''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE ON products BEGIN
    DELETE FROM products_fts WHERE product_id = old.id;
    INSERT INTO products_fts(product_id, body) VALUES (new.id,
        coalesce(new.name, '') || ' ' || coalesce(new.sku, '') || ' ' ||
        coalesce(new.barcode, '') || ' ' || coalesce(new.category, '') || ' ' ||
        coalesce(new.description, '') || ' ' || coalesce(new.unit, ''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
    DELETE FROM products_fts WHERE product_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_ai AFTER INSERT ON invoices BEGIN
    INSERT INTO invoices_fts(invoice_id, body)
    VALUES (new.id, coalesce(new.number, '') || ' ' || coalesce(new.note, ''));
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_au AFTER UPDATE ON invoices BEGIN
    DELETE FROM invoices_fts WHERE invoice_id = old.id;
    INSERT INTO invoices_fts(invoice_id, body)
    VALUES (new.id, coalesce(new.number, '') || ' ' || coalesce(new.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = new.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_ad AFTER DELETE ON invoices BEGIN
    DELETE FROM invoices_fts WHERE invoice_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_lines_ai AFTER INSERT ON invoice_lines BEGIN
    DELETE FROM invoices_fts WHERE invoice_id = new.invoice_id;
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = new.invoice_id;
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_lines_au AFTER UPDATE ON invoice_lines BEGIN
    DELETE FROM invoices_fts WHERE invoice_id = old.invoice_id;
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = old.invoice_id;
END;

CREATE TRIGGER IF NOT EXISTS invoices_fts_lines_ad AFTER DELETE ON invoice_lines BEGIN
    DELETE FROM invoices_fts WHERE invoice_id = old.invoice_id;
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = old.invoice_id;
END;

-- Backfill the indices for databases that already contain rows.
INSERT INTO contacts_fts(contact_id, body)
    SELECT id, coalesce(name, '') || ' ' || coalesce(company_name, '') || ' ' ||
        coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
        coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(city, '') || ' ' ||
        coalesce(zip, '') || ' ' || coalesce(country, '') || ' ' || coalesce(tax_id, '') || ' ' ||
        coalesce(notes, '')
    FROM contacts;

INSERT INTO products_fts(product_id, body)
    SELECT id, coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' ||
        coalesce(barcode, '') || ' ' || coalesce(category, '') || ' ' ||
        coalesce(description, '') || ' ' || coalesce(unit, '')
    FROM products;

INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i;
"#;

const SCHEMA_V5: &str = r#"
-- Accounting journal, including the cash channel used by the cash book.
CREATE TABLE IF NOT EXISTS journal_entries (
    id              TEXT PRIMARY KEY,
    booked_at       INTEGER NOT NULL,
    description     TEXT NOT NULL,
    account         TEXT NOT NULL,
    counter_account TEXT NOT NULL,
    amount_cents    INTEGER NOT NULL,
    tax_rate_bp     INTEGER NOT NULL,
    kind            TEXT NOT NULL,
    channel         TEXT NOT NULL,
    reference       TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_booked ON journal_entries(booked_at);
CREATE INDEX IF NOT EXISTS idx_journal_channel ON journal_entries(channel, booked_at);
"#;

const SCHEMA_V6: &str = r#"
-- Cash handed over at the counter, so a receipt can show the change.
ALTER TABLE pos_orders ADD COLUMN cash_given_cents INTEGER;
"#;

const SCHEMA_V7: &str = r#"
CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
"#;

const SCHEMA_V12: &str = r#"
-- Payment capture of the invoice modal. The TypeScript app keeps `paid_at`, `payment_method`,
-- `payment_reference` and `tse_signature` on the invoice row; the port keeps one payment per invoice
-- in its own table so the invoice literal stays small.
CREATE TABLE IF NOT EXISTS invoice_payments (
    invoice_id    TEXT PRIMARY KEY REFERENCES invoices(id) ON DELETE CASCADE,
    paid_at       INTEGER NOT NULL,
    method        TEXT NOT NULL,
    reference     TEXT NOT NULL,
    tse_signature TEXT
);
"#;

const SCHEMA_V11: &str = r#"
-- Product fields the legacy catalogue has always carried: the ASIN of the article, the supplier
-- link and the shop it points to. The reorder assistant and the QR label read them.
ALTER TABLE products ADD COLUMN asin TEXT;
ALTER TABLE products ADD COLUMN web_link TEXT;
ALTER TABLE products ADD COLUMN source_domain TEXT;
"#;

const SCHEMA_V9: &str = r#"
-- The invoice triggers looked up their row through `invoice_id`, an UNINDEXED FTS column, so every
-- insert scanned the whole index: a bulk import of 100k invoices cost minutes and grew quadratically.
-- The map turns each lookup into a primary key hit against the FTS rowid.
CREATE TABLE IF NOT EXISTS invoices_fts_rows (
    invoice_id TEXT PRIMARY KEY,
    fts_rowid  INTEGER NOT NULL
);

DROP TRIGGER IF EXISTS invoices_fts_ai;
DROP TRIGGER IF EXISTS invoices_fts_au;
DROP TRIGGER IF EXISTS invoices_fts_ad;
DROP TRIGGER IF EXISTS invoices_fts_lines_ai;
DROP TRIGGER IF EXISTS invoices_fts_lines_au;
DROP TRIGGER IF EXISTS invoices_fts_lines_ad;

CREATE TRIGGER invoices_fts_ai AFTER INSERT ON invoices BEGIN
    INSERT INTO invoices_fts(invoice_id, body)
    VALUES (new.id, coalesce(new.number, '') || ' ' || coalesce(new.note, ''));
    INSERT OR REPLACE INTO invoices_fts_rows(invoice_id, fts_rowid)
    VALUES (new.id, last_insert_rowid());
END;

CREATE TRIGGER invoices_fts_au AFTER UPDATE ON invoices BEGIN
    DELETE FROM invoices_fts
     WHERE rowid = (SELECT fts_rowid FROM invoices_fts_rows WHERE invoice_id = old.id);
    INSERT INTO invoices_fts(invoice_id, body)
    VALUES (new.id, coalesce(new.number, '') || ' ' || coalesce(new.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = new.id), ''));
    INSERT OR REPLACE INTO invoices_fts_rows(invoice_id, fts_rowid)
    VALUES (new.id, last_insert_rowid());
    DELETE FROM invoices_fts_rows WHERE invoice_id = old.id;
END;

CREATE TRIGGER invoices_fts_ad AFTER DELETE ON invoices BEGIN
    DELETE FROM invoices_fts
     WHERE rowid = (SELECT fts_rowid FROM invoices_fts_rows WHERE invoice_id = old.id);
    DELETE FROM invoices_fts_rows WHERE invoice_id = old.id;
END;

CREATE TRIGGER invoices_fts_lines_ai AFTER INSERT ON invoice_lines BEGIN
    DELETE FROM invoices_fts
     WHERE rowid = (SELECT fts_rowid FROM invoices_fts_rows WHERE invoice_id = new.invoice_id);
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = new.invoice_id;
    INSERT OR REPLACE INTO invoices_fts_rows(invoice_id, fts_rowid)
    VALUES (new.invoice_id, last_insert_rowid());
END;

CREATE TRIGGER invoices_fts_lines_au AFTER UPDATE ON invoice_lines BEGIN
    DELETE FROM invoices_fts
     WHERE rowid = (SELECT fts_rowid FROM invoices_fts_rows WHERE invoice_id = old.invoice_id);
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = old.invoice_id;
    INSERT OR REPLACE INTO invoices_fts_rows(invoice_id, fts_rowid)
    VALUES (old.invoice_id, last_insert_rowid());
END;

CREATE TRIGGER invoices_fts_lines_ad AFTER DELETE ON invoice_lines BEGIN
    DELETE FROM invoices_fts
     WHERE rowid = (SELECT fts_rowid FROM invoices_fts_rows WHERE invoice_id = old.invoice_id);
    INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i WHERE i.id = old.invoice_id;
    INSERT OR REPLACE INTO invoices_fts_rows(invoice_id, fts_rowid)
    VALUES (old.invoice_id, last_insert_rowid());
END;

-- Rebuild once so the map and the index start out consistent, including rows written before v9.
DELETE FROM invoices_fts;
DELETE FROM invoices_fts_rows;
INSERT INTO invoices_fts(invoice_id, body)
    SELECT i.id, coalesce(i.number, '') || ' ' || coalesce(i.note, '') || ' ' ||
        coalesce((SELECT group_concat(l.description, ' ') FROM invoice_lines l
                  WHERE l.invoice_id = i.id), '')
    FROM invoices i;
INSERT INTO invoices_fts_rows(invoice_id, fts_rowid)
    SELECT invoice_id, rowid FROM invoices_fts WHERE invoice_id IS NOT NULL;
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

        if version < 4 {
            self.conn.execute_batch(SCHEMA_V4)?;
            version = 4;
        }

        if version < 5 {
            self.conn.execute_batch(SCHEMA_V5)?;
            version = 5;
        }

        if version < 6 {
            self.conn.execute_batch(SCHEMA_V6)?;
            version = 6;
        }

        if version < 7 {
            self.conn.execute_batch(SCHEMA_V7)?;
            version = 7;
        }

        if version < 8 {
            self.conn.execute_batch(SCHEMA_V8)?;
            version = 8;
        }

        if version < 9 {
            self.conn.execute_batch(SCHEMA_V9)?;
            version = 9;
        }

        if version < 10 {
            self.conn.execute_batch(SCHEMA_V10)?;
            version = 10;
        }

        if version < 11 {
            self.conn.execute_batch(SCHEMA_V11)?;
            version = 11;
        }

        if version < 12 {
            self.conn.execute_batch(SCHEMA_V12)?;
            version = 12;
        }

        if version < 13 {
            self.conn.execute_batch(SCHEMA_V13)?;
            version = 13;
        }

        if version < 14 {
            self.conn.execute_batch(SCHEMA_V14)?;
            version = 14;
        }

        if version < 15 {
            self.conn.execute_batch(SCHEMA_V15)?;
            version = 15;
        }

        self.conn.pragma_update(None, "user_version", version)?;

        // The built-in roles exist in every database, including fresh ones, so permission checks
        // never have to fall back to "no role".
        permissions::seed_builtin(&self.conn, crate::now_millis())?;
        Ok(())
    }

    /// Schema version currently stored in the database.
    pub fn schema_version(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?)
    }

    /// All fleet vehicles, oldest first.
    pub fn fleet_vehicles(&self) -> CoreResult<Vec<FleetVehicle>> {
        fleet::list_vehicles(&self.conn)
    }

    /// One fleet vehicle by id.
    pub fn fleet_vehicle(&self, id: uuid::Uuid) -> CoreResult<Option<FleetVehicle>> {
        fleet::find_vehicle(&self.conn, id)
    }

    /// Inserts a fleet vehicle.
    pub fn insert_fleet_vehicle(&self, vehicle: &FleetVehicle) -> CoreResult<()> {
        fleet::insert_vehicle(&self.conn, vehicle)
    }

    /// Replaces a fleet vehicle.
    pub fn update_fleet_vehicle(&self, vehicle: &FleetVehicle) -> CoreResult<()> {
        fleet::update_vehicle(&self.conn, vehicle)
    }

    /// Deletes a fleet vehicle; trips and receipts stay like in the TypeScript module.
    pub fn delete_fleet_vehicle(&self, id: uuid::Uuid) -> CoreResult<()> {
        fleet::delete_vehicle(&self.conn, id)
    }

    /// All logbook trips, newest first.
    pub fn fleet_trips(&self) -> CoreResult<Vec<FleetTrip>> {
        fleet::list_trips(&self.conn)
    }

    /// Inserts a trip and lifts the odometer of its vehicle.
    pub fn insert_fleet_trip(&self, trip: &FleetTrip) -> CoreResult<()> {
        fleet::insert_trip(&self.conn, trip)
    }

    /// Replaces a trip without touching the odometer.
    pub fn update_fleet_trip(&self, trip: &FleetTrip) -> CoreResult<()> {
        fleet::update_trip(&self.conn, trip)
    }

    /// Deletes a trip.
    pub fn delete_fleet_trip(&self, id: uuid::Uuid) -> CoreResult<()> {
        fleet::delete_trip(&self.conn, id)
    }

    /// All fuel and charging receipts, newest first.
    pub fn fleet_fuel(&self) -> CoreResult<Vec<FleetFuel>> {
        fleet::list_fuel(&self.conn)
    }

    /// Inserts a receipt.
    pub fn insert_fleet_fuel(&self, entry: &FleetFuel) -> CoreResult<()> {
        fleet::insert_fuel(&self.conn, entry)
    }

    /// Replaces a receipt.
    pub fn update_fleet_fuel(&self, entry: &FleetFuel) -> CoreResult<()> {
        fleet::update_fuel(&self.conn, entry)
    }

    /// Deletes a receipt.
    pub fn delete_fleet_fuel(&self, id: uuid::Uuid) -> CoreResult<()> {
        fleet::delete_fuel(&self.conn, id)
    }

    /// All projects of the portfolio, newest first.
    pub fn projects(&self) -> CoreResult<Vec<Project>> {
        projects::list_projects(&self.conn)
    }

    /// One project by id.
    pub fn project(&self, id: uuid::Uuid) -> CoreResult<Option<Project>> {
        projects::find_project(&self.conn, id)
    }

    /// Inserts a project.
    pub fn insert_project(&self, project: &Project) -> CoreResult<()> {
        projects::insert_project(&self.conn, project)
    }

    /// Replaces a project.
    pub fn update_project(&self, project: &Project) -> CoreResult<()> {
        projects::update_project(&self.conn, project)
    }

    /// Deletes a project and its tasks.
    pub fn delete_project(&self, id: uuid::Uuid) -> CoreResult<()> {
        projects::delete_project(&self.conn, id)
    }

    /// Tasks of one project in creation order.
    pub fn project_tasks(&self, project_id: uuid::Uuid) -> CoreResult<Vec<ProjectTask>> {
        projects::list_tasks(&self.conn, project_id)
    }

    /// Every task of every project, oldest first.
    pub fn project_tasks_all(&self) -> CoreResult<Vec<ProjectTask>> {
        projects::list_all_tasks(&self.conn)
    }

    /// One task by id.
    pub fn project_task(&self, id: uuid::Uuid) -> CoreResult<Option<ProjectTask>> {
        projects::find_task(&self.conn, id)
    }

    /// Inserts a task.
    pub fn insert_project_task(&self, task: &ProjectTask) -> CoreResult<()> {
        projects::insert_task(&self.conn, task)
    }

    /// Replaces a task.
    pub fn update_project_task(&self, task: &ProjectTask) -> CoreResult<()> {
        projects::update_task(&self.conn, task)
    }

    /// Changes the Kanban status of one task.
    pub fn set_project_task_status(
        &self,
        project_id: uuid::Uuid,
        task_id: uuid::Uuid,
        status: &str,
    ) -> CoreResult<()> {
        projects::set_task_status(&self.conn, project_id, task_id, status)
    }

    /// Deletes one task of a project.
    pub fn delete_project_task(
        &self,
        project_id: uuid::Uuid,
        task_id: uuid::Uuid,
    ) -> CoreResult<()> {
        projects::delete_task(&self.conn, project_id, task_id)
    }

    // --- Restaurant -----------------------------------------------------------------------

    /// All dishes and drinks, newest first.
    pub fn restaurant_menu(&self) -> CoreResult<Vec<MenuItem>> {
        restaurant::list_menu(&self.conn)
    }

    /// One dish by id.
    pub fn restaurant_menu_item(&self, id: uuid::Uuid) -> CoreResult<Option<MenuItem>> {
        restaurant::find_menu_item(&self.conn, id)
    }

    /// Inserts a dish.
    pub fn insert_restaurant_menu_item(&self, item: &MenuItem) -> CoreResult<()> {
        restaurant::insert_menu_item(&self.conn, item)
    }

    /// Replaces a dish.
    pub fn update_restaurant_menu_item(&self, item: &MenuItem) -> CoreResult<()> {
        restaurant::update_menu_item(&self.conn, item)
    }

    /// Deletes a dish.
    pub fn delete_restaurant_menu_item(&self, id: uuid::Uuid) -> CoreResult<()> {
        restaurant::delete_menu_item(&self.conn, id)
    }

    /// All table orders, oldest first.
    pub fn restaurant_orders(&self) -> CoreResult<Vec<TableOrder>> {
        restaurant::list_orders(&self.conn)
    }

    /// One table order by id.
    pub fn restaurant_order(&self, id: uuid::Uuid) -> CoreResult<Option<TableOrder>> {
        restaurant::find_order(&self.conn, id)
    }

    /// The open order of a table.
    pub fn restaurant_open_order(&self, table_number: &str) -> CoreResult<Option<TableOrder>> {
        restaurant::find_open_order(&self.conn, table_number)
    }

    /// Inserts a table order.
    pub fn insert_restaurant_order(&self, order: &TableOrder) -> CoreResult<()> {
        restaurant::insert_order(&self.conn, order)
    }

    /// Replaces a table order.
    pub fn update_restaurant_order(&self, order: &TableOrder) -> CoreResult<()> {
        restaurant::update_order(&self.conn, order)
    }

    /// Inserts or updates a table order.
    pub fn save_restaurant_order(&self, order: &TableOrder) -> CoreResult<()> {
        restaurant::save_order(&self.conn, order)
    }

    /// Deletes a table order.
    pub fn delete_restaurant_order(&self, id: uuid::Uuid) -> CoreResult<()> {
        restaurant::delete_order(&self.conn, id)
    }

    /// Books the paid order, POS receipt and invoice in one transaction.
    pub fn restaurant_checkout(
        &self,
        order: &TableOrder,
        invoice: &Invoice,
        receipt: &PosOrder,
    ) -> CoreResult<()> {
        restaurant::checkout(&self.conn, order, invoice, receipt)
    }

    /// Next hospitality receipt number for a year.
    pub fn restaurant_receipt_number(&self, year: i64) -> CoreResult<String> {
        restaurant::next_receipt_number(&self.conn, year)
    }

    /// Shared walk-in contact of restaurant invoices.
    pub fn restaurant_walk_in_contact(
        &self,
        now: i64,
    ) -> CoreResult<crate::domain::contact::Contact> {
        restaurant::walk_in_contact(&self.conn, now)
    }

    /// Number of rows in `contacts`.
    pub fn contact_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))?)
    }

    /// Counts, stock value and upcoming appointments for the dashboard.
    pub fn dashboard_counts(&self, now: i64) -> CoreResult<dashboard::DashboardCounts> {
        dashboard::counts(&self.conn, now)
    }

    /// Key figures of the dashboard for a half-open issue-date range.
    pub fn dashboard_summary(
        &self,
        from: i64,
        to: i64,
        now: i64,
    ) -> CoreResult<dashboard::DashboardSummary> {
        dashboard::summary(&self.conn, from, to, now)
    }

    /// Invoices as the overview lists them, newest first.
    pub fn invoice_overview(&self) -> CoreResult<Vec<dashboard::InvoiceOverview>> {
        dashboard::overview(&self.conn)
    }

    /// The newest invoices for the overview, at most `limit`.
    pub fn recent_invoices(&self, limit: usize) -> CoreResult<Vec<dashboard::InvoiceOverview>> {
        dashboard::recent(&self.conn, limit)
    }

    /// Products at or below their reorder level, largest shortfall first.
    pub fn low_stock_products(&self, limit: usize) -> CoreResult<Vec<dashboard::LowStockRow>> {
        dashboard::low_stock(&self.conn, limit)
    }

    /// Number of rows in `invoices`.
    pub fn invoice_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))?)
    }

    /// Inserts a contact and its contact persons in one transaction.
    pub fn insert_contact(&self, contact: &Contact) -> CoreResult<()> {
        let transaction = self.conn.unchecked_transaction()?;
        contacts::insert(&transaction, contact)?;
        transaction.commit()?;
        Ok(())
    }

    /// Inserts many contacts in one transaction.
    pub fn insert_contacts(&self, contacts_to_insert: &[Contact]) -> CoreResult<()> {
        let transaction = self.conn.unchecked_transaction()?;
        for contact in contacts_to_insert {
            contacts::insert(&transaction, contact)?;
        }
        transaction.commit()?;
        Ok(())
    }

    /// Lists all contacts ordered by display name.
    pub fn list_contacts(&self) -> CoreResult<Vec<Contact>> {
        contacts::list(&self.conn)
    }

    /// Looks up a single contact.
    pub fn find_contact(&self, id: uuid::Uuid) -> CoreResult<Option<Contact>> {
        contacts::find(&self.conn, id)
    }

    /// Replaces an existing contact and its contact persons in one transaction.
    pub fn update_contact(&self, contact: &Contact) -> CoreResult<()> {
        let transaction = self.conn.unchecked_transaction()?;
        contacts::update(&transaction, contact)?;
        transaction.commit()?;
        Ok(())
    }

    /// Deletes a contact.
    pub fn delete_contact(&self, id: uuid::Uuid) -> CoreResult<()> {
        contacts::delete(&self.conn, id)
    }

    /// Searches contacts through the FTS5 index, falling back to substring matching.
    pub fn search_contacts(&self, query: &str) -> CoreResult<Vec<Contact>> {
        search::contacts(&self.conn, query)
    }

    // --- Text editor documents -------------------------------------------------------------

    /// Inserts a document.
    pub fn insert_document(&self, document: &Document) -> CoreResult<()> {
        documents::insert(&self.conn, document)
    }

    /// Replaces an existing document.
    pub fn update_document(&self, document: &Document) -> CoreResult<()> {
        documents::update(&self.conn, document)
    }

    /// Loads one document; `None` when it was deleted.
    pub fn find_document(&self, id: uuid::Uuid) -> CoreResult<Option<Document>> {
        documents::find(&self.conn, id)
    }

    /// Loads one document and rejects a missing row.
    pub fn get_document(&self, id: uuid::Uuid) -> CoreResult<Document> {
        self.find_document(id)?
            .ok_or_else(|| crate::error::CoreError::NotFound(id.to_string()))
    }

    /// Lists all documents, most recently changed first.
    pub fn list_documents(&self) -> CoreResult<Vec<Document>> {
        documents::list(&self.conn)
    }

    /// Searches document names and contents.
    pub fn search_documents(&self, query: &str) -> CoreResult<Vec<Document>> {
        documents::search(&self.conn, query)
    }

    /// Deletes a document.
    pub fn delete_document(&self, id: uuid::Uuid) -> CoreResult<()> {
        documents::delete(&self.conn, id)
    }

    /// Number of stored documents.
    pub fn document_count(&self) -> CoreResult<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))?)
    }

    /// Inserts an invoice together with its positions inside one transaction.
    pub fn insert_invoice(&self, invoice: &Invoice) -> CoreResult<()> {
        invoices::insert(&self.conn, invoice)
    }

    /// Inserts many invoices in one transaction.
    pub fn insert_invoices(&self, invoices_to_insert: &[Invoice]) -> CoreResult<()> {
        let transaction = self.conn.unchecked_transaction()?;
        for invoice in invoices_to_insert {
            invoices::insert_rows(&transaction, invoice)?;
        }
        transaction.commit()?;
        Ok(())
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

    /// Searches products through the FTS5 index, falling back to substring matching.
    pub fn search_products(&self, query: &str) -> CoreResult<Vec<Product>> {
        search::products(&self.conn, query)
    }

    /// Searches invoices by number, note and position descriptions.
    pub fn search_invoices(&self, query: &str) -> CoreResult<Vec<Invoice>> {
        search::invoices(&self.conn, query)
    }

    /// Inserts an invoice together with the stock movements it causes, atomically.
    pub fn insert_invoice_with_stock(
        &self,
        invoice: &Invoice,
        movements: &[StockMove],
    ) -> CoreResult<()> {
        invoices::insert_with_stock(&self.conn, invoice, movements)
    }

    /// Loads one invoice with its positions.
    pub fn find_invoice(&self, id: uuid::Uuid) -> CoreResult<Option<Invoice>> {
        invoices::find(&self.conn, id)
    }

    /// Replaces an existing invoice and all of its positions atomically.
    pub fn update_invoice(&self, invoice: &Invoice) -> CoreResult<()> {
        invoices::update(&self.conn, invoice)
    }

    /// Removes an invoice and its positions.
    pub fn delete_invoice(&self, id: uuid::Uuid) -> CoreResult<()> {
        invoices::delete(&self.conn, id)
    }

    /// Writes only the lifecycle state of an invoice.
    pub fn set_invoice_status(
        &self,
        id: uuid::Uuid,
        status: crate::domain::invoice::InvoiceStatus,
    ) -> CoreResult<()> {
        invoices::set_status(&self.conn, id, status)
    }

    /// Inserts one accounting journal entry.
    pub fn insert_journal_entry(&self, entry: &JournalEntry) -> CoreResult<()> {
        journal::insert(&self.conn, entry)
    }

    /// Loads one journal entry.
    pub fn find_journal_entry(&self, id: uuid::Uuid) -> CoreResult<Option<JournalEntry>> {
        journal::find(&self.conn, id)
    }

    /// Lists every journal entry, newest first.
    pub fn list_journal_entries(&self) -> CoreResult<Vec<JournalEntry>> {
        journal::list(&self.conn)
    }

    /// Lists journal entries inside a half-open booking range, newest first.
    pub fn journal_entries_between(&self, from: i64, to: i64) -> CoreResult<Vec<JournalEntry>> {
        journal::between(&self.conn, from, to)
    }

    /// Searches journal entries by description, accounts and reference.
    pub fn search_journal_entries(&self, term: &str) -> CoreResult<Vec<JournalEntry>> {
        journal::search(&self.conn, term)
    }

    /// Replaces an existing journal entry.
    pub fn update_journal_entry(&self, entry: &JournalEntry) -> CoreResult<()> {
        journal::update(&self.conn, entry)
    }

    /// Removes a journal entry.
    pub fn delete_journal_entry(&self, id: uuid::Uuid) -> CoreResult<()> {
        journal::delete(&self.conn, id)
    }

    /// Number of journal entries.
    pub fn journal_entry_count(&self) -> CoreResult<i64> {
        journal::count(&self.conn)
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

    /// Replaces the editable fields of a user; protects the last administrator.
    pub fn update_user(&self, user: &User) -> CoreResult<()> {
        users::update(&self.conn, user)
    }

    /// Deletes a user account; protects the last administrator.
    pub fn delete_user(&self, user_id: uuid::Uuid) -> CoreResult<()> {
        users::delete(&self.conn, user_id)
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

    /// Removes a setting.
    pub fn remove_setting(&self, key: &str) -> CoreResult<()> {
        settings::remove(&self.conn, key)
    }

    /// Loads the company profile, returning defaults when nothing was stored yet.
    pub fn company_profile(&self) -> CoreResult<CompanyProfile> {
        settings::load_company_profile(&self.conn)
    }

    /// Stores the company profile.
    pub fn save_company_profile(&self, profile: &CompanyProfile) -> CoreResult<()> {
        settings::save_company_profile(&self.conn, profile)
    }

    /// Deletes every business record in one transaction and returns the removed row count.
    ///
    /// Configuration stays: accounts, roles, sessions and settings survive, so this is the clean
    /// mode of the Studio drawer rather than a factory reset of the database file.
    pub fn reset_business_data(&self) -> CoreResult<u64> {
        maintenance::reset_business_data(&self.conn)
    }

    // --- Purchase orders -------------------------------------------------------------------

    /// Inserts a purchase order with its positions.
    pub fn insert_purchase_order(&self, order: &PurchaseOrder) -> CoreResult<()> {
        purchase_orders::insert(&self.conn, order)
    }

    /// Records the payment of an invoice and marks it paid in one transaction.
    pub fn record_invoice_payment(&self, payment: &InvoicePayment) -> CoreResult<()> {
        invoices::record_payment(&self.conn, payment)
    }

    /// Payment recorded for an invoice, if any.
    pub fn invoice_payment(&self, id: uuid::Uuid) -> CoreResult<Option<InvoicePayment>> {
        invoices::payment(&self.conn, id)
    }

    /// Loads one purchase order with its positions.
    pub fn find_purchase_order(&self, id: uuid::Uuid) -> CoreResult<Option<PurchaseOrder>> {
        purchase_orders::find(&self.conn, id)
    }

    /// Lists purchase orders, newest first.
    pub fn list_purchase_orders(&self) -> CoreResult<Vec<PurchaseOrder>> {
        purchase_orders::list(&self.conn)
    }

    /// Changes the status of a purchase order.
    pub fn set_purchase_order_status(
        &self,
        id: uuid::Uuid,
        status: crate::domain::purchase::PurchaseOrderStatus,
        now: i64,
    ) -> CoreResult<()> {
        purchase_orders::set_status(&self.conn, id, status, now)
    }

    /// Books received goods and marks the order as received in one transaction.
    pub fn receive_purchase_order(
        &self,
        id: uuid::Uuid,
        movements: &[StockMove],
        now: i64,
    ) -> CoreResult<()> {
        purchase_orders::receive(&self.conn, id, movements, now)
    }

    /// Deletes a purchase order and its positions.
    pub fn delete_purchase_order(&self, id: uuid::Uuid) -> CoreResult<()> {
        purchase_orders::delete(&self.conn, id)
    }

    /// Replaces an existing purchase order and all of its positions atomically.
    pub fn update_purchase_order(&self, order: &PurchaseOrder) -> CoreResult<()> {
        purchase_orders::update(&self.conn, order)
    }

    /// Searches purchase orders by number, note and position descriptions.
    pub fn search_purchase_orders(&self, term: &str) -> CoreResult<Vec<PurchaseOrder>> {
        purchase_orders::search(&self.conn, term)
    }

    /// Number of purchase orders.
    pub fn purchase_order_count(&self) -> CoreResult<i64> {
        purchase_orders::count(&self.conn)
    }

    // --- POS receipts ----------------------------------------------------------------------

    /// Inserts a receipt with its positions and stock movements atomically.
    pub fn insert_pos_order(&self, order: &PosOrder, movements: &[StockMove]) -> CoreResult<()> {
        pos_orders::insert(&self.conn, order, movements)
    }

    /// Loads one receipt with its positions.
    pub fn find_pos_order(&self, id: uuid::Uuid) -> CoreResult<Option<PosOrder>> {
        pos_orders::find(&self.conn, id)
    }

    /// Lists receipts, newest first.
    pub fn list_pos_orders(&self) -> CoreResult<Vec<PosOrder>> {
        pos_orders::list(&self.conn)
    }

    /// Deletes a receipt and its positions without touching stock.
    pub fn delete_pos_order(&self, id: uuid::Uuid) -> CoreResult<()> {
        pos_orders::delete(&self.conn, id)
    }

    /// Searches receipts by number, note and position descriptions.
    pub fn search_pos_orders(&self, term: &str) -> CoreResult<Vec<PosOrder>> {
        pos_orders::search(&self.conn, term)
    }

    /// Loads the receipts paid in `[from, to)`.
    pub fn pos_orders_between(&self, from: i64, to: i64) -> CoreResult<Vec<PosOrder>> {
        pos_orders::between(&self.conn, from, to)
    }

    /// Number of receipts.
    pub fn pos_order_count(&self) -> CoreResult<i64> {
        pos_orders::count(&self.conn)
    }

    /// Cancels a receipt, returning its product positions to stock and deleting it atomically.
    pub fn cancel_pos_order(&self, id: uuid::Uuid, now: i64) -> CoreResult<()> {
        pos_orders::cancel(&self.conn, id, now)
    }

    // --- Billing items ---------------------------------------------------------------------

    /// Inserts a billable item.
    pub fn insert_billing_item(&self, item: &BillingItem) -> CoreResult<()> {
        billing_items::insert(&self.conn, item)
    }

    /// Replaces an existing billable item.
    pub fn update_billing_item(&self, item: &BillingItem) -> CoreResult<()> {
        billing_items::update(&self.conn, item)
    }

    /// Loads one billable item.
    pub fn find_billing_item(&self, id: uuid::Uuid) -> CoreResult<Option<BillingItem>> {
        billing_items::find(&self.conn, id)
    }

    /// Lists all billable items.
    pub fn list_billing_items(&self) -> CoreResult<Vec<BillingItem>> {
        billing_items::list(&self.conn)
    }

    /// Lists the billable items of one contact.
    pub fn billing_items_for_contact(
        &self,
        contact_id: uuid::Uuid,
    ) -> CoreResult<Vec<BillingItem>> {
        billing_items::list_for_contact(&self.conn, contact_id)
    }

    /// Lists the billable items of one contact that still wait for an invoice.
    pub fn open_billing_items_for_contact(
        &self,
        contact_id: uuid::Uuid,
    ) -> CoreResult<Vec<BillingItem>> {
        billing_items::list_open_for_contact(&self.conn, contact_id)
    }

    /// Lists the billable items collected on one invoice.
    pub fn billing_items_for_invoice(
        &self,
        invoice_id: uuid::Uuid,
    ) -> CoreResult<Vec<BillingItem>> {
        billing_items::list_for_invoice(&self.conn, invoice_id)
    }

    /// Collects several billable items on an invoice in one transaction.
    pub fn assign_billing_items_to_invoice(
        &self,
        ids: &[uuid::Uuid],
        invoice_id: uuid::Uuid,
        now: i64,
    ) -> CoreResult<usize> {
        billing_items::assign_to_invoice(&self.conn, ids, invoice_id, now)
    }

    /// Deletes a billable item.
    pub fn delete_billing_item(&self, id: uuid::Uuid) -> CoreResult<()> {
        billing_items::delete(&self.conn, id)
    }

    // --- Appointments ----------------------------------------------------------------------

    /// Inserts an appointment.
    pub fn insert_appointment(&self, appointment: &Appointment) -> CoreResult<()> {
        appointments::insert(&self.conn, appointment)
    }

    /// Replaces an existing appointment.
    pub fn update_appointment(&self, appointment: &Appointment) -> CoreResult<()> {
        appointments::update(&self.conn, appointment)
    }

    /// Loads one appointment.
    pub fn find_appointment(&self, id: uuid::Uuid) -> CoreResult<Option<Appointment>> {
        appointments::find(&self.conn, id)
    }

    /// Lists all appointments.
    pub fn list_appointments(&self) -> CoreResult<Vec<Appointment>> {
        appointments::list(&self.conn)
    }

    /// Lists every appointment overlapping `[from, to)`.
    pub fn appointments_between(&self, from: i64, to: i64) -> CoreResult<Vec<Appointment>> {
        appointments::list_between(&self.conn, from, to)
    }

    /// Deletes an appointment.
    pub fn delete_appointment(&self, id: uuid::Uuid) -> CoreResult<()> {
        appointments::delete(&self.conn, id)
    }

    /// Searches appointments by title, location and notes inside `[from, to)`.
    pub fn search_appointments_between(
        &self,
        term: &str,
        from: i64,
        to: i64,
    ) -> CoreResult<Vec<Appointment>> {
        appointments::search_between(&self.conn, term, from, to)
    }

    /// Open appointments that collide with the given appointment.
    pub fn appointment_conflicts(&self, appointment: &Appointment) -> CoreResult<Vec<Appointment>> {
        appointments::conflicts(&self.conn, appointment)
    }

    // --- Support and time tracking ---------------------------------------------------------

    /// Inserts a support ticket.
    pub fn insert_support_ticket(&self, ticket: &SupportTicket) -> CoreResult<()> {
        support::insert_ticket(&self.conn, ticket)
    }

    /// Replaces an existing support ticket.
    pub fn update_support_ticket(&self, ticket: &SupportTicket) -> CoreResult<()> {
        support::update_ticket(&self.conn, ticket)
    }

    /// Changes the status of a ticket and maintains its closing time.
    pub fn set_support_ticket_status(
        &self,
        id: uuid::Uuid,
        status: TicketStatus,
        now: i64,
    ) -> CoreResult<()> {
        support::set_ticket_status(&self.conn, id, status, now)
    }

    /// Loads one support ticket.
    pub fn find_support_ticket(&self, id: uuid::Uuid) -> CoreResult<Option<SupportTicket>> {
        support::find_ticket(&self.conn, id)
    }

    /// Lists all support tickets, newest first.
    pub fn list_support_tickets(&self) -> CoreResult<Vec<SupportTicket>> {
        support::list_tickets(&self.conn)
    }

    /// Lists the tickets that still need attention, urgent first.
    pub fn open_support_tickets(&self) -> CoreResult<Vec<SupportTicket>> {
        support::list_open_tickets(&self.conn)
    }

    /// Deletes a support ticket and its time entries.
    pub fn delete_support_ticket(&self, id: uuid::Uuid) -> CoreResult<()> {
        support::delete_ticket(&self.conn, id)
    }

    /// Tracks a block of working time.
    pub fn insert_time_entry(&self, entry: &TimeEntry) -> CoreResult<()> {
        support::insert_time_entry(&self.conn, entry)
    }

    /// Lists the time entries of a ticket.
    pub fn time_entries_for_ticket(&self, ticket_id: uuid::Uuid) -> CoreResult<Vec<TimeEntry>> {
        support::list_time_entries(&self.conn, ticket_id)
    }

    /// Lists all time entries that started in `[from, to)`.
    pub fn time_entries_between(&self, from: i64, to: i64) -> CoreResult<Vec<TimeEntry>> {
        support::list_time_entries_between(&self.conn, from, to)
    }

    /// Sum of all tracked minutes of a ticket.
    pub fn tracked_minutes(&self, ticket_id: uuid::Uuid) -> CoreResult<i64> {
        support::total_minutes(&self.conn, ticket_id)
    }

    /// Deletes a time entry.
    pub fn delete_time_entry(&self, id: uuid::Uuid) -> CoreResult<()> {
        support::delete_time_entry(&self.conn, id)
    }

    // --- Therapy practice -----------------------------------------------------------------

    /// Inserts a therapy client.
    pub fn insert_therapy_client(&self, client: &TherapyClient) -> CoreResult<()> {
        therapy::insert_client(&self.conn, client)
    }

    /// Replaces an existing therapy client.
    pub fn update_therapy_client(&self, client: &TherapyClient) -> CoreResult<()> {
        therapy::update_client(&self.conn, client)
    }

    /// Deletes a therapy client together with its sessions.
    pub fn delete_therapy_client(&self, id: uuid::Uuid) -> CoreResult<()> {
        therapy::delete_client(&self.conn, id)
    }

    /// Loads one therapy client.
    pub fn find_therapy_client(&self, id: uuid::Uuid) -> CoreResult<Option<TherapyClient>> {
        therapy::find_client(&self.conn, id)
    }

    /// Lists all therapy clients, active first.
    pub fn list_therapy_clients(&self) -> CoreResult<Vec<TherapyClient>> {
        therapy::list_clients(&self.conn)
    }

    /// Inserts a therapy session.
    pub fn insert_therapy_session(&self, session: &TherapySession) -> CoreResult<()> {
        therapy::insert_session(&self.conn, session)
    }

    /// Replaces an existing therapy session.
    pub fn update_therapy_session(&self, session: &TherapySession) -> CoreResult<()> {
        therapy::update_session(&self.conn, session)
    }

    /// Deletes a therapy session.
    pub fn delete_therapy_session(&self, id: uuid::Uuid) -> CoreResult<()> {
        therapy::delete_session(&self.conn, id)
    }

    /// Lists the sessions of a client, newest first.
    pub fn therapy_sessions_for_client(
        &self,
        client_id: uuid::Uuid,
    ) -> CoreResult<Vec<TherapySession>> {
        therapy::sessions_for_client(&self.conn, client_id)
    }

    /// Lists all therapy sessions that started in `[from, to)`.
    pub fn therapy_sessions_between(&self, from: i64, to: i64) -> CoreResult<Vec<TherapySession>> {
        therapy::sessions_between(&self.conn, from, to)
    }

    /// Number of sessions of a client.
    pub fn therapy_session_count(&self, client_id: uuid::Uuid) -> CoreResult<i64> {
        therapy::session_count(&self.conn, client_id)
    }

    /// Puts every still open session of a client on one invoice.
    pub fn link_therapy_sessions(
        &self,
        client_id: uuid::Uuid,
        invoice_id: uuid::Uuid,
        now: i64,
    ) -> CoreResult<usize> {
        therapy::link_invoice(&self.conn, client_id, invoice_id, now)
    }

    // --- Reporting ---------------------------------------------------------------------

    /// Builds the report of the half-open period `[from, to)`.
    pub fn report(&self, from: i64, to: i64) -> CoreResult<reports::Report> {
        reports::load(&self.conn, from, to)
    }

    // --- Workspace: widgets and reports ----------------------------------------------------

    /// Inserts a desktop widget.
    pub fn insert_widget(&self, widget: &Widget) -> CoreResult<()> {
        workspace::insert_widget(&self.conn, widget)
    }

    /// Replaces an existing widget.
    pub fn update_widget(&self, widget: &Widget) -> CoreResult<()> {
        workspace::update_widget(&self.conn, widget)
    }

    /// Loads one widget.
    pub fn find_widget(&self, id: uuid::Uuid) -> CoreResult<Option<Widget>> {
        workspace::find_widget(&self.conn, id)
    }

    /// Lists all widgets in desktop order.
    pub fn list_widgets(&self) -> CoreResult<Vec<Widget>> {
        workspace::list_widgets(&self.conn)
    }

    /// Deletes a widget.
    pub fn delete_widget(&self, id: uuid::Uuid) -> CoreResult<()> {
        workspace::delete_widget(&self.conn, id)
    }

    /// Stores a generated report.
    pub fn insert_report(&self, report: &Report) -> CoreResult<()> {
        workspace::insert_report(&self.conn, report)
    }

    /// Loads one report.
    pub fn find_report(&self, id: uuid::Uuid) -> CoreResult<Option<Report>> {
        workspace::find_report(&self.conn, id)
    }

    /// Lists all reports, newest first.
    pub fn list_reports(&self) -> CoreResult<Vec<Report>> {
        workspace::list_reports(&self.conn)
    }

    // --- Roles and permissions -------------------------------------------------------------

    /// Inserts a custom role.
    pub fn insert_role(&self, role: &Role) -> CoreResult<()> {
        permissions::insert(&self.conn, role)
    }

    /// Replaces an existing role.
    pub fn update_role(&self, role: &Role) -> CoreResult<()> {
        permissions::update(&self.conn, role)
    }

    /// Loads one role.
    pub fn find_role(&self, id: uuid::Uuid) -> CoreResult<Option<Role>> {
        permissions::find(&self.conn, id)
    }

    /// Lists all roles.
    pub fn list_roles(&self) -> CoreResult<Vec<Role>> {
        permissions::list(&self.conn)
    }

    /// Deletes a custom role. Built-in roles are protected.
    pub fn delete_role(&self, id: uuid::Uuid) -> CoreResult<()> {
        permissions::delete(&self.conn, id)
    }

    /// The role that applies to a user.
    pub fn role_for_user(&self, user: &User) -> CoreResult<Role> {
        permissions::role_for_user(&self.conn, user)
    }

    /// Whether a user may perform `required` on `module`.
    pub fn user_allows(
        &self,
        user: &User,
        module: AppModule,
        required: PermissionLevel,
    ) -> CoreResult<bool> {
        permissions::user_allows(&self.conn, user, module, required)
    }

    // --- Sessions --------------------------------------------------------------------------

    /// Signs a user in, counting failed attempts and honouring the lockout.
    pub fn login(&self, username: &str, password: &str, now: i64) -> CoreResult<LoginOutcome> {
        sessions::login(&self.conn, username, password, now)
    }

    /// Looks up the active session for a plain token.
    pub fn session_for_token(&self, token: &str, now: i64) -> CoreResult<Option<Session>> {
        sessions::find_active(&self.conn, token, now)
    }

    /// Number of active sessions of a user.
    pub fn active_session_count(&self, user_id: uuid::Uuid, now: i64) -> CoreResult<i64> {
        sessions::active_count(&self.conn, user_id, now)
    }

    /// Records that a session was used.
    pub fn touch_session(&self, id: uuid::Uuid, now: i64) -> CoreResult<()> {
        sessions::touch(&self.conn, id, now)
    }

    /// Revokes one session (sign out).
    pub fn sign_out(&self, session_id: uuid::Uuid, now: i64) -> CoreResult<()> {
        sessions::revoke(&self.conn, session_id, now)
    }

    /// Revokes every session of a user and returns how many were active.
    pub fn sign_out_all(&self, user_id: uuid::Uuid, now: i64) -> CoreResult<usize> {
        sessions::revoke_all_for_user(&self.conn, user_id, now)
    }

    /// Removes expired and revoked sessions.
    pub fn purge_expired_sessions(&self, now: i64) -> CoreResult<usize> {
        sessions::purge_expired(&self.conn, now)
    }

    /// The underlying connection, used by the legacy backup reader/writer.
    /// Snapshot for the dashboard screen: company name, key figures, the invoice overview rows and
    /// the reorder list, all read in one place.
    pub fn dashboard_snapshot(
        &self,
        now: i64,
    ) -> CoreResult<(
        String,
        dashboard::DashboardCounts,
        Vec<dashboard::InvoiceOverview>,
        Vec<dashboard::LowStockRow>,
    )> {
        let profile = self.company_profile()?;
        Ok((
            profile.name,
            dashboard::counts(&self.conn, now)?,
            dashboard::overview(&self.conn)?,
            dashboard::low_stock(&self.conn, 8)?,
        ))
    }

    /// Serialized image of the whole database.
    ///
    /// The browser build keeps this image in IndexedDB so accounts and sessions survive a reload;
    /// on the desktop it is a cheap way to copy a database without touching the file system.
    pub fn snapshot_bytes(&self) -> CoreResult<Vec<u8>> {
        let data = self.conn.serialize("main")?;
        Ok(data.to_vec())
    }

    /// Replaces the content of this connection with a serialized database image.
    ///
    /// Every row that was loaded before the call is stale afterwards, and the schema is migrated
    /// again so snapshots of older versions keep working.
    pub fn restore_snapshot(&mut self, bytes: &[u8]) -> CoreResult<()> {
        self.conn.deserialize_read_exact(
            "main",
            std::io::Cursor::new(bytes),
            bytes.len(),
            false,
        )?;
        self.migrate()?;
        Ok(())
    }

    pub(crate) fn connection(&self) -> &rusqlite::Connection {
        &self.conn
    }
}

/// Schema v13: fleet vehicles, logbook trips and fuel receipts.
const SCHEMA_V13: &str = r#"
-- Fleet vehicles, logbook trips and fuel receipts of the TypeScript FleetModule.
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id                   TEXT PRIMARY KEY,
    license_plate        TEXT NOT NULL,
    make                 TEXT NOT NULL,
    model                TEXT NOT NULL DEFAULT '',
    vehicle_type         TEXT NOT NULL DEFAULT 'car',
    fuel_type            TEXT NOT NULL DEFAULT 'diesel',
    vin                  TEXT NOT NULL DEFAULT '',
    current_odometer     INTEGER NOT NULL DEFAULT 0,
    assigned_driver      TEXT NOT NULL DEFAULT '',
    year                 INTEGER,
    next_inspection_due  TEXT NOT NULL DEFAULT '',
    notes                TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active',
    created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fleet_trips (
    id                    TEXT PRIMARY KEY,
    vehicle_id            TEXT NOT NULL,
    vehicle_plate         TEXT NOT NULL,
    driver                TEXT NOT NULL,
    date                  TEXT NOT NULL,
    start_time            TEXT NOT NULL DEFAULT '',
    end_time              TEXT NOT NULL DEFAULT '',
    start_location        TEXT NOT NULL,
    end_location          TEXT NOT NULL,
    purpose               TEXT NOT NULL,
    reason                TEXT NOT NULL DEFAULT '',
    customer_name         TEXT NOT NULL DEFAULT '',
    start_km              INTEGER NOT NULL,
    end_km                INTEGER NOT NULL,
    distance_km           INTEGER NOT NULL,
    notes                 TEXT NOT NULL DEFAULT '',
    created_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fleet_fuel (
    id                    TEXT PRIMARY KEY,
    vehicle_id            TEXT NOT NULL,
    vehicle_plate         TEXT NOT NULL,
    date                  TEXT NOT NULL,
    odometer              INTEGER NOT NULL,
    units_milli           INTEGER NOT NULL,
    total_cost_cents      INTEGER NOT NULL,
    price_per_unit_milli  INTEGER NOT NULL,
    fuel_station          TEXT NOT NULL DEFAULT '',
    notes                 TEXT NOT NULL DEFAULT '',
    created_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fleet_trips_vehicle ON fleet_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_vehicle ON fleet_fuel(vehicle_id);
"#;

/// Schema v15: restaurant menu, table orders and kitchen positions of the TypeScript `RestaurantModule`.
const SCHEMA_V15: &str = r#"
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    category           TEXT NOT NULL,
    price_cents        INTEGER NOT NULL,
    tax_rate_bp        INTEGER NOT NULL,
    ingredients        TEXT NOT NULL DEFAULT '',
    allergens          TEXT NOT NULL DEFAULT '[]',
    emoji              TEXT NOT NULL DEFAULT '',
    prep_time_minutes  INTEGER NOT NULL DEFAULT 0,
    is_available       INTEGER NOT NULL DEFAULT 1,
    created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant_orders (
    id                      TEXT PRIMARY KEY,
    table_number            TEXT NOT NULL,
    server_name             TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL,
    subtotal_cents          INTEGER NOT NULL DEFAULT 0,
    tax_total_cents         INTEGER NOT NULL DEFAULT 0,
    total_cents             INTEGER NOT NULL DEFAULT 0,
    tip_cents               INTEGER NOT NULL DEFAULT 0,
    payment_method          TEXT,
    opened_at               INTEGER NOT NULL,
    paid_at                 INTEGER,
    cash_tendered_cents     INTEGER,
    cash_change_cents       INTEGER,
    is_hospitality_receipt  INTEGER NOT NULL DEFAULT 0,
    hospitality_host        TEXT NOT NULL DEFAULT '',
    hospitality_occasion    TEXT NOT NULL DEFAULT '',
    hospitality_guests      TEXT NOT NULL DEFAULT '',
    receipt_number          TEXT,
    invoice_id              TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
    order_id       TEXT NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    id             TEXT NOT NULL,
    position       INTEGER NOT NULL,
    menu_item_id   TEXT,
    name           TEXT NOT NULL,
    price_cents    INTEGER NOT NULL,
    tax_rate_bp    INTEGER NOT NULL,
    qty            INTEGER NOT NULL,
    category       TEXT NOT NULL DEFAULT '',
    emoji          TEXT NOT NULL DEFAULT '',
    notes          TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (order_id, id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_table
    ON restaurant_orders(table_number, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_paid
    ON restaurant_orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order
    ON restaurant_order_items(order_id, position);

INSERT OR IGNORE INTO restaurant_menu_items
    (id, name, category, price_cents, tax_rate_bp, ingredients, allergens, emoji, prep_time_minutes, is_available, created_at)
VALUES
    ('00000000-0000-4000-8000-000000000101', 'Bruschetta Classico', 'starters', 750, 700, 'Geröstetes Ciabatta, Strauchtomaten, Basilikum, Knoblauch, natives Olivenöl', '["A (Gluten)"]', '🥖', 8, 1, 0),
    ('00000000-0000-4000-8000-000000000102', 'Carpaccio di Manzo', 'starters', 1420, 700, 'Hauchdünnes Rinderfilet, Rucola, gehobelter Parmesan, Trüffel-Vinaigrette', '["G (Milch)"]', '🥩', 10, 1, 0),
    ('00000000-0000-4000-8000-000000000103', 'Pizza Margherita DOC', 'pizza', 1050, 700, 'San Marzano Tomatensugo, Fior di Latte Mozzarella, frisches Basilikum', '["A (Gluten)", "G (Milch)"]', '🍕', 12, 1, 0),
    ('00000000-0000-4000-8000-000000000104', 'Pizza Diavola Piccante', 'pizza', 1380, 700, 'Scharfe kalabrische Salami, Peperoni, rote Zwiebeln, Mozzarella', '["A (Gluten)", "G (Milch)"]', '🍕', 12, 1, 0),
    ('00000000-0000-4000-8000-000000000105', 'Pizza Quattro Formaggi & Tartufo', 'pizza', 1550, 700, 'Mozzarella, Gorgonzola, Taleggio, Ricotta, schwarze Trüffelcreme', '["A (Gluten)", "G (Milch)"]', '🧀', 14, 1, 0),
    ('00000000-0000-4000-8000-000000000106', 'Dry-Aged Angus Burger Deluxe', 'burgers', 1690, 700, '200g Black Angus Patty, Brioche Bun, Cheddar, Bacon-Jam, Pommes frites', '["A (Gluten)", "C (Ei)", "G (Milch)"]', '🍔', 15, 1, 0),
    ('00000000-0000-4000-8000-000000000107', 'Tagliolini al Tartufo Fresco', 'mains', 1850, 700, 'Frische Eierpasta im Parmesanlaib geschwenkt mit frischem Sommertrüffel', '["A (Gluten)", "C (Ei)", "G (Milch)"]', '🍝', 12, 1, 0),
    ('00000000-0000-4000-8000-000000000108', 'Tiramisù Tradizionale', 'desserts', 680, 700, 'Löffelbiskuits, Espresso, Mascarponecreme, feinstes Kakaopulver', '["A (Gluten)", "C (Ei)", "G (Milch)"]', '🍰', 5, 1, 0),
    ('00000000-0000-4000-8000-000000000109', 'San Pellegrino Mineralwasser (0.75l)', 'drinks', 620, 1900, 'Natürliches Mineralwasser aus den italienischen Alpen', '[]', '💧', 2, 1, 0),
    ('00000000-0000-4000-8000-000000000110', 'Aperol Spritz Veneziano (0.25l)', 'drinks', 790, 1900, 'Aperol, Valdobbiadene Prosecco DOCG, Soda, frische Orangenscheibe', '["O (Sulfite)"]', '🍹', 3, 1, 0),
    ('00000000-0000-4000-8000-000000000111', 'Espresso Barista Arabica', 'drinks', 280, 1900, '100% Arabica Siebträger-Espresso', '[]', '☕', 2, 1, 0);
"#;

/// Schema v14: project portfolio and Kanban tasks of the TypeScript `ProjectsModule`.
const SCHEMA_V14: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    code                TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    contact_id          TEXT,
    client_name         TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL,
    status              TEXT NOT NULL,
    priority            TEXT NOT NULL,
    budget_cents        INTEGER NOT NULL DEFAULT 0,
    hourly_rate_cents   INTEGER NOT NULL DEFAULT 0,
    start_date          TEXT NOT NULL DEFAULT '',
    deadline            TEXT NOT NULL DEFAULT '',
    color               TEXT NOT NULL DEFAULT '',
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_tasks (
    id                     TEXT PRIMARY KEY,
    project_id             TEXT NOT NULL,
    title                  TEXT NOT NULL,
    description            TEXT NOT NULL DEFAULT '',
    status                 TEXT NOT NULL,
    priority               TEXT NOT NULL,
    assignee               TEXT NOT NULL DEFAULT '',
    estimated_hours_milli  INTEGER NOT NULL DEFAULT 0,
    logged_hours_milli     INTEGER NOT NULL DEFAULT 0,
    due_date               TEXT NOT NULL DEFAULT '',
    billable               INTEGER NOT NULL DEFAULT 1,
    created_at             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
"#;

const SCHEMA_V8: &str = r#"
CREATE TABLE IF NOT EXISTS therapy_clients (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    email               TEXT NOT NULL DEFAULT '',
    phone               TEXT NOT NULL DEFAULT '',
    hourly_rate_cents   INTEGER NOT NULL DEFAULT 0,
    kilometer_rate_cents INTEGER NOT NULL DEFAULT 0,
    notes               TEXT NOT NULL DEFAULT '',
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS therapy_sessions (
    id                TEXT PRIMARY KEY,
    client_id         TEXT NOT NULL,
    started_at        INTEGER NOT NULL,
    minutes           INTEGER NOT NULL,
    kilometers_milli  INTEGER NOT NULL DEFAULT 0,
    notes             TEXT NOT NULL DEFAULT '',
    invoice_id        TEXT,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    FOREIGN KEY (client_id) REFERENCES therapy_clients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS therapy_sessions_client
    ON therapy_sessions (client_id, started_at);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::accounting::{BookingChannel, JournalEntry, JournalKind};
    use crate::domain::permission::{AppModule, PermissionLevel, ADMIN_ROLE_ID, USER_ROLE_ID};
    use crate::domain::appointment::{Appointment, AppointmentStatus};
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::domain::pos::{PaymentMethod, PosOrder, PosOrderLine};
    use crate::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
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
    fn records_the_invoice_payment() {
        use crate::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
        use crate::domain::payment::{InvoicePayment, PaymentMethod};

        let store = Store::open_in_memory().expect("store");
        let mut contact =
            crate::domain::contact::Contact::new(crate::domain::contact::ContactKind::Company, 0);
        contact.company_name = Some("Kunde".to_string());
        store.insert_contact(&contact).expect("contact");
        let invoice = Invoice {
            id: uuid::Uuid::new_v4(),
            number: "2026-0001".to_string(),
            contact_id: contact.id,
            status: InvoiceStatus::Sent,
            issued_at: 0,
            due_at: 86_400_000,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: crate::money::Money::from_cents(10_000),
                tax_rate_bp: 1900,
            }],
        };
        store.insert_invoice(&invoice).expect("invoice");
        assert_eq!(store.invoice_payment(invoice.id).expect("read"), None);

        let mut payment = InvoicePayment::new(
            invoice.id,
            PaymentMethod::Cash,
            1_760_000_000_000,
            "Barzahlung Kasse".to_string(),
        );
        payment.tse_signature = Some("CASH-TSE-1".to_string());
        store.record_invoice_payment(&payment).expect("payment");

        let stored = store
            .invoice_payment(invoice.id)
            .expect("read")
            .expect("payment");
        assert_eq!(stored, payment);
        let reloaded = store
            .find_invoice(invoice.id)
            .expect("find")
            .expect("invoice");
        assert_eq!(reloaded.status, InvoiceStatus::Paid);
        assert_eq!(store.schema_version().expect("version"), SCHEMA_VERSION);
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

    #[test]
    fn roundtrips_purchase_orders_and_receipts() {
        let store = Store::open_in_memory().expect("store");
        let vendor = contact(&store);
        let mut product = Product::new("Kaffee", 0);
        product.price = Money::from_cents(900);
        store.insert_product(&product).expect("product");

        let mut order = PurchaseOrder {
            id: Uuid::new_v4(),
            number: "BE-2026-0001".to_string(),
            vendor_id: vendor.id,
            status: PurchaseOrderStatus::Draft,
            order_date: 0,
            expected_at: None,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![PurchaseOrderLine {
                product_id: Some(product.id),
                description: "Kaffee".to_string(),
                quantity_milli: 2_000,
                unit_cost: Money::from_cents(500),
                tax_rate_bp: 700,
            }],
            legacy_id: None,
            created_at: 0,
            updated_at: 0,
        };
        store.insert_purchase_order(&order).expect("insert");
        assert_eq!(store.purchase_order_count().expect("count"), 1);
        assert_eq!(
            store
                .search_purchase_orders("kaffee")
                .expect("search")
                .len(),
            1
        );

        order.number = "BE-2026-0002".to_string();
        order.note = Some("Eilt".to_string());
        store.update_purchase_order(&order).expect("update");
        assert_eq!(
            store
                .find_purchase_order(order.id)
                .expect("find")
                .unwrap()
                .note
                .as_deref(),
            Some("Eilt")
        );

        store
            .set_purchase_order_status(order.id, PurchaseOrderStatus::Ordered, 1)
            .expect("status");
        let movements = order.stock_moves(2);
        store
            .receive_purchase_order(order.id, &movements, 2)
            .expect("receive");
        assert_eq!(
            store
                .find_purchase_order(order.id)
                .expect("find")
                .unwrap()
                .status,
            PurchaseOrderStatus::Received
        );
        assert_eq!(store.find_product(product.id).unwrap().unwrap().stock, 2);

        store.delete_purchase_order(order.id).expect("delete");
        assert_eq!(store.purchase_order_count().expect("count"), 0);
    }

    #[test]
    fn roundtrips_pos_receipts_and_restores_stock_on_cancel() {
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Espresso", 0);
        product.price = Money::from_cents(250);
        store.insert_product(&product).expect("product");
        store
            .adjust_stock(&StockMove {
                id: Uuid::new_v4(),
                product_id: product.id,
                kind: StockMoveKind::In,
                quantity: 5,
                reason: None,
                created_at: 0,
            })
            .expect("stock");

        let order = PosOrder {
            id: Uuid::new_v4(),
            receipt_number: "BON-2026-0001".to_string(),
            contact_id: None,
            payment_method: PaymentMethod::Cash,
            paid_at: 10,
            currency_symbol: "€".to_string(),
            note: None,
            cash_given: Some(Money::from_cents(1_000)),
            lines: vec![PosOrderLine {
                product_id: Some(product.id),
                description: "Espresso".to_string(),
                quantity_milli: 2_000,
                unit_price: Money::from_cents(250),
                tax_rate_bp: 700,
            }],
            legacy_id: None,
        };
        store
            .insert_pos_order(&order, &order.stock_moves(10))
            .expect("insert");
        assert_eq!(store.pos_order_count().expect("count"), 1);
        assert_eq!(store.find_product(product.id).unwrap().unwrap().stock, 3);
        assert_eq!(
            store.search_pos_orders("espresso").expect("search")[0]
                .change()
                .expect("change"),
            Money::from_cents(465)
        );
        assert_eq!(store.pos_orders_between(0, 11).expect("range").len(), 1);
        assert!(store.pos_orders_between(11, 20).expect("range").is_empty());

        store.cancel_pos_order(order.id, 20).expect("cancel");
        assert_eq!(store.pos_order_count().expect("count"), 0);
        assert_eq!(store.find_product(product.id).unwrap().unwrap().stock, 5);
    }

    #[test]
    fn roundtrips_appointments_and_detects_conflicts() {
        let store = Store::open_in_memory().expect("store");
        let mut first = Appointment {
            id: Uuid::new_v4(),
            contact_id: None,
            title: "Kickoff".to_string(),
            location: Some("Raum 1".to_string()),
            notes: None,
            status: AppointmentStatus::Confirmed,
            starts_at: 1_000,
            ends_at: 2_000,
            created_at: 0,
            updated_at: 0,
        };
        store.insert_appointment(&first).expect("insert");
        assert_eq!(store.list_appointments().expect("list").len(), 1);
        assert_eq!(
            store
                .search_appointments_between("kick", 0, 3_000)
                .expect("search")
                .len(),
            1
        );

        let mut second = Appointment {
            id: Uuid::new_v4(),
            title: "Workshop".to_string(),
            starts_at: 1_500,
            ends_at: 2_500,
            ..first.clone()
        };
        assert!(first.has_conflict(&[second.clone()]));
        store.insert_appointment(&second).expect("insert");
        assert_eq!(
            store
                .appointment_conflicts(&first)
                .expect("conflicts")
                .len(),
            1
        );

        second.status = AppointmentStatus::Cancelled;
        store.update_appointment(&second).expect("update");
        assert!(store
            .appointment_conflicts(&first)
            .expect("conflicts")
            .is_empty());

        first.title = "Kickoff intern".to_string();
        first.ends_at = 1_800;
        store.update_appointment(&first).expect("update");
        store.delete_appointment(second.id).expect("delete");
        assert_eq!(
            store.list_appointments().expect("list")[0].title,
            "Kickoff intern"
        );
    }

    #[test]
    fn roundtrips_journal_entries() {
        let store = Store::open_in_memory().expect("store");
        let mut entry = JournalEntry::new(1_000);
        entry.description = "Rechnung".to_string();
        entry.account = "Erlöse".to_string();
        entry.counter_account = "Bank".to_string();
        entry.amount = Money::from_cents(10_000);
        store.insert_journal_entry(&entry).expect("insert");

        assert_eq!(store.journal_entry_count().expect("count"), 1);
        assert_eq!(
            store.find_journal_entry(entry.id).expect("find"),
            Some(entry.clone())
        );
        assert_eq!(
            store
                .journal_entries_between(0, 2_000)
                .expect("between")
                .len(),
            1
        );
        assert_eq!(
            store
                .search_journal_entries("erlöse")
                .expect("search")
                .len(),
            1
        );

        entry.description = "Rechnung 2026".to_string();
        entry.amount = Money::from_cents(12_000);
        entry.kind = JournalKind::Expense;
        entry.channel = BookingChannel::Cash;
        store.update_journal_entry(&entry).expect("update");
        let loaded = store
            .find_journal_entry(entry.id)
            .expect("find")
            .expect("present");
        assert_eq!(loaded, entry);

        store.delete_journal_entry(entry.id).expect("delete");
        assert_eq!(store.journal_entry_count().expect("count"), 0);
    }

    #[test]
    fn updates_status_and_deletes_invoices() {
        let store = Store::open_in_memory().expect("store");
        let buyer = contact(&store);
        let mut invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-0003".to_string(),
            contact_id: buyer.id,
            status: InvoiceStatus::Draft,
            issued_at: 0,
            due_at: 0,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1900,
            }],
        };
        store.insert_invoice(&invoice).expect("insert");

        invoice.number = "2026-0004".to_string();
        invoice.lines[0].quantity_milli = 2_000;
        store.update_invoice(&invoice).expect("update");
        let loaded = store
            .find_invoice(invoice.id)
            .expect("find")
            .expect("present");
        assert_eq!(loaded, invoice);

        store
            .set_invoice_status(invoice.id, InvoiceStatus::Paid)
            .expect("status");
        assert_eq!(
            store
                .find_invoice(invoice.id)
                .expect("find")
                .unwrap()
                .status,
            InvoiceStatus::Paid
        );

        store.delete_invoice(invoice.id).expect("delete");
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
    fn updates_and_deletes_users_but_protects_the_last_admin() {
        let store = Store::open_in_memory().expect("store");
        let admin = user(&store, "admin-passwort");

        let mut renamed = admin.clone();
        renamed.display_name = "Chefin".to_string();
        store.update_user(&renamed).expect("update");
        assert_eq!(
            store.find_user_by_username("admin").expect("find"),
            Some(renamed.clone())
        );

        let mut demoted = renamed.clone();
        demoted.role = UserRole::User;
        assert!(store.update_user(&demoted).is_err());

        let mut colleague = admin.clone();
        colleague.id = Uuid::new_v4();
        colleague.username = "kollegin".to_string();
        colleague.display_name = "Kollegin".to_string();
        store.insert_user(&colleague).expect("second admin");

        demoted.active = true;
        store
            .update_user(&demoted)
            .expect("demote with a second admin");
        store.delete_user(demoted.id).expect("delete non-admin");
        assert!(
            store.delete_user(colleague.id).is_err(),
            "last admin protected"
        );

        let mut assistant = admin.clone();
        assistant.id = Uuid::new_v4();
        assistant.username = "assistenz".to_string();
        assistant.display_name = "Assistenz".to_string();
        assistant.role = UserRole::User;
        store.insert_user(&assistant).expect("user");
        store.delete_user(assistant.id).expect("delete user");
        assert_eq!(store.list_users().expect("list").len(), 1);
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
    fn built_in_roles_gain_new_modules_without_losing_existing_grants() {
        let store = Store::open_in_memory().expect("store");
        let mut administrator = store
            .find_role(ADMIN_ROLE_ID)
            .expect("administrator")
            .expect("administrator exists");
        let original_contacts = administrator
            .level(AppModule::Contacts);
        administrator
            .permissions
            .retain(|grant| !matches!(grant.module, AppModule::Projects | AppModule::Fleet | AppModule::Restaurant));
        store.conn.execute(
            "UPDATE roles SET permissions = ?1 WHERE id = ?2",
            rusqlite::params![
                serde_json::to_string(&administrator.permissions).expect("serialize old grants"),
                administrator.id.to_string(),
            ],
        ).expect("simulate old admin role");

        let mut standard = store
            .find_role(USER_ROLE_ID)
            .expect("standard role")
            .expect("standard role exists");
        standard
            .permissions
            .retain(|grant| !matches!(grant.module, AppModule::Projects | AppModule::Fleet));
        store.conn.execute(
            "UPDATE roles SET permissions = ?1 WHERE id = ?2",
            rusqlite::params![
                serde_json::to_string(&standard.permissions).expect("serialize old grants"),
                standard.id.to_string(),
            ],
        ).expect("simulate old standard role");

        permissions::seed_builtin(&store.conn, now_millis()).expect("upgrade built-ins");

        let upgraded_admin = store.find_role(ADMIN_ROLE_ID).expect("find").expect("admin");
        let upgraded_standard = store.find_role(USER_ROLE_ID).expect("find").expect("standard");
        assert_eq!(upgraded_admin.level(AppModule::Contacts), original_contacts);
        assert_eq!(upgraded_admin.level(AppModule::Projects), PermissionLevel::Manage);
        assert_eq!(upgraded_standard.level(AppModule::Projects), PermissionLevel::Edit);
        assert_eq!(upgraded_admin.level(AppModule::Fleet), PermissionLevel::Manage);
        assert_eq!(upgraded_standard.level(AppModule::Fleet), PermissionLevel::Edit);
        assert_eq!(upgraded_admin.level(AppModule::Restaurant), PermissionLevel::Manage);
        assert_eq!(upgraded_standard.level(AppModule::Restaurant), PermissionLevel::Edit);
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
