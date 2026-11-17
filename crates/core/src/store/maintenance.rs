//! Business-data maintenance for the Studio clean mode.
//!
//! Clean mode empties every table that holds business records while the schema, the accounts, the
//! roles, the sessions and the settings stay in place. The Studio drawer calls
//! [`reset_business_data`] only after the user confirmed the destructive action, and the whole reset
//! runs in one transaction, so a failure leaves the database exactly as it was.

use rusqlite::Connection;

use crate::error::CoreResult;

/// Tables cleared by [`reset_business_data`], children before their parents.
///
/// Configuration lives outside this list on purpose: `settings`, `users`, `roles`, `auth_sessions`,
/// `auth_attempts` and `app_meta` survive a reset, so the application stays signed in and keeps its
/// configuration.
pub const BUSINESS_TABLES: [&str; 20] = [
    "therapy_trips",
    "invoice_lines",
    "stock_moves",
    "pos_order_lines",
    "purchase_order_lines",
    "therapy_sessions",
    "time_entries",
    "billing_items",
    "invoices",
    "pos_orders",
    "purchase_orders",
    "therapy_clients",
    "appointments",
    "support_tickets",
    "journal_entries",
    "documents",
    "widgets",
    "reports",
    "products",
    "contacts",
];

/// Deletes every business record in one transaction and returns the number of removed rows.
pub fn reset_business_data(conn: &Connection) -> CoreResult<u64> {
    let transaction = conn.unchecked_transaction()?;
    let mut removed = 0_u64;
    for table in BUSINESS_TABLES {
        removed += transaction.execute(&format!("DELETE FROM {table}"), [])? as u64;
    }
    transaction.commit()?;
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use crate::domain::contact::{Contact, ContactKind};
    use crate::domain::product::Product;
    use crate::domain::settings::CompanyProfile;
    use crate::store::Store;

    #[test]
    fn clears_business_records_and_keeps_configuration() {
        let store = Store::open_in_memory().expect("store");
        let mut contact = Contact::new(ContactKind::Company, 1_000);
        contact.name = Some("AlpenTech".to_string());
        store.insert_contact(&contact).expect("contact");
        let mut product = Product::new("Kaffee", 1_000);
        product.sku = "K-1".to_string();
        store.insert_product(&product).expect("product");
        let profile = CompanyProfile {
            name: "Studio Lindner".to_string(),
            ..Default::default()
        };
        store.save_company_profile(&profile).expect("profile");

        let removed = store.reset_business_data().expect("reset");

        assert!(removed >= 2, "reset removed {removed} rows");
        assert_eq!(store.contact_count().expect("contacts"), 0);
        assert_eq!(store.product_count().expect("products"), 0);
        assert_eq!(
            store.company_profile().expect("profile").name,
            "Studio Lindner"
        );
        assert_eq!(
            store.schema_version().expect("schema"),
            crate::store::SCHEMA_VERSION
        );
    }

    #[test]
    fn a_second_reset_removes_nothing() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(store.reset_business_data().expect("first"), 0);
        assert_eq!(store.reset_business_data().expect("second"), 0);
    }
}
