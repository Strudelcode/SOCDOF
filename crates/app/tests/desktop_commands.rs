//! Command-layer proof for the Tauri screen: schema version and backup through [`DesktopState`].
//!
//! The Tauri crate only adapts these methods to `invoke` handlers, so this test runs without
//! GTK/WebKit and still exercises the exact code path the window uses.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{ContactInput, DesktopState, ProductInput};
use socdof_app::shell::Paths;
use socdof_core::domain::contact::{ContactKind, ContactType};
use socdof_core::error::CoreError;
use socdof_core::money::Money;
use socdof_core::store::SCHEMA_VERSION;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-desktop-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn contact_input(name: &str, city: &str) -> ContactInput {
    ContactInput {
        name: name.to_string(),
        company: "Acme GmbH".to_string(),
        is_company: false,
        contact_type: "both".to_string(),
        first_name: "Ada".to_string(),
        last_name: "Lovelace".to_string(),
        street: "Hauptstraße 1".to_string(),
        zip: "10115".to_string(),
        city: city.to_string(),
        country: "Deutschland".to_string(),
        email: "ada@example.invalid".to_string(),
        phone: "+49 30 123456".to_string(),
        tax_id: "DE-ACME".to_string(),
        notes: "Stammkunde".to_string(),
        contact_persons: None,
    }
}

fn product_input(name: &str, sku: &str) -> ProductInput {
    ProductInput {
        name: name.to_string(),
        sku: sku.to_string(),
        category: "Kaffee".to_string(),
        unit: "kg".to_string(),
        price_cents: 1_299,
        cost_price_cents: 750,
        tax_rate_bp: 700,
        stock: 12,
        reorder_level: 3,
        target_stock: 20,
        barcode: "1234567890123".to_string(),
        asin: String::new(),
        web_link: String::new(),
        source_domain: String::new(),
        description: "Ganze Bohne".to_string(),
        image_emoji: "☕".to_string(),
        exclude_from_reorder: false,
    }
}

#[test]
fn desktop_commands_create_search_update_and_delete_contacts() {
    let dir = temp_dir("contacts");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let created = state
        .create_contact(&contact_input("Ada Lovelace", "Berlin"))
        .expect("contact is created");
    assert_eq!(created.kind, ContactKind::Person);
    assert_eq!(created.contact_type, ContactType::Both);
    assert_eq!(created.display_name(), "Ada Lovelace");
    assert_eq!(created.city.as_deref(), Some("Berlin"));

    let by_name = state.contacts(Some("Lovelace")).expect("contact search");
    assert_eq!(by_name.len(), 1);
    assert_eq!(by_name[0].id, created.id);
    let by_company = state.contacts(Some("Acme")).expect("company search");
    assert_eq!(by_company.len(), 1);
    let by_email = state.contacts(Some("ada@")).expect("email search");
    assert_eq!(by_email.len(), 1);

    let updated = state
        .update_contact(created.id, &contact_input("Ada Byron", "Potsdam"))
        .expect("contact is updated");
    assert_eq!(updated.display_name(), "Ada Byron");
    assert_eq!(updated.city.as_deref(), Some("Potsdam"));
    assert_eq!(updated.created_at, created.created_at);
    assert_eq!(
        state
            .contacts(Some("Potsdam"))
            .expect("updated search")
            .len(),
        1
    );

    state
        .delete_contact(created.id)
        .expect("contact is deleted");
    assert!(state.contacts(None).expect("list after delete").is_empty());
    assert!(matches!(
        state.delete_contact(created.id),
        Err(CoreError::NotFound(_))
    ));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn desktop_commands_create_search_update_and_delete_products() {
    let dir = temp_dir("products");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let created = state
        .create_product(&product_input("Espresso Blend", "COF-001"))
        .expect("product is created");
    assert_eq!(created.price, Money::from_cents(1_299));
    assert_eq!(created.cost_price, Money::from_cents(750));
    assert_eq!(created.stock, 12);
    assert_eq!(created.target_stock, 20);

    assert_eq!(
        state.products(Some("espresso")).expect("name search").len(),
        1
    );
    assert_eq!(
        state.products(Some("COF-001")).expect("sku search").len(),
        1
    );
    assert_eq!(
        state
            .products(Some("kaffee"))
            .expect("category search")
            .len(),
        1
    );

    let mut update = product_input("Espresso Blend Bio", "COF-001");
    update.stock = 4;
    update.price_cents = 1_499;
    let updated = state
        .update_product(created.id, &update)
        .expect("product is updated");
    assert_eq!(updated.name, "Espresso Blend Bio");
    assert_eq!(updated.price, Money::from_cents(1_499));
    assert_eq!(updated.stock, 4);
    assert_eq!(updated.created_at, created.created_at);

    let mut invalid = product_input("Negativ", "COF-002");
    invalid.price_cents = -1;
    assert!(state.create_product(&invalid).is_err());

    state
        .delete_product(created.id)
        .expect("product is deleted");
    assert!(state.products(None).expect("list after delete").is_empty());
    assert!(matches!(
        state.delete_product(created.id),
        Err(CoreError::NotFound(_))
    ));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn desktop_commands_import_and_export_a_real_legacy_backup() {
    let dir = temp_dir("legacy-backup");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../core/tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json");

    let imported = state
        .import_legacy_backup(&fixture)
        .expect("real legacy backup is imported");
    assert_eq!(imported.contacts, 3);
    assert_eq!(imported.products, 2);
    assert_eq!(imported.invoices, 1);
    assert_eq!(
        state
            .contacts(Some("AlpenTech"))
            .expect("imported contact")
            .len(),
        1
    );
    assert_eq!(
        state
            .products(Some("PRD-IOT-001"))
            .expect("imported product")
            .len(),
        1
    );

    let exported = dir.join("rust-roundtrip.socdof.json");
    let exported_report = state
        .export_legacy_backup(&exported)
        .expect("legacy-compatible export");
    assert_eq!(exported_report.contacts, 3);
    assert_eq!(exported_report.products, 2);
    assert_eq!(exported_report.invoices, 1);
    assert!(exported_report.bytes > 0);
    assert!(exported.exists());

    let document: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&exported).expect("exported document is readable"))
            .expect("exported document is JSON");
    assert_eq!(document["app"], "SOCDOF_Enterprise_Local_ERP");
    assert_eq!(document["version"], 2);
    assert_eq!(document["contacts"].as_array().map(Vec::len), Some(3));
    assert_eq!(document["products"].as_array().map(Vec::len), Some(2));
    assert_eq!(document["invoices"].as_array().map(Vec::len), Some(1));
    assert_eq!(document["stock_moves"].as_array().map(Vec::len), Some(1));

    // The document is a complete snapshot: importing it again is lossless for the tables this app owns.
    let reimported = state
        .import_legacy_backup(&exported)
        .expect("exported document can be imported again");
    assert_eq!(reimported.contacts, 3);
    assert_eq!(reimported.products, 2);
    assert_eq!(reimported.invoices, 1);
    assert_eq!(state.status().expect("status").contacts, 3);
    assert_eq!(state.status().expect("status").products, 2);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn desktop_commands_report_schema_and_write_backup() {
    let dir = temp_dir("commands");
    let database = dir.join("socdof.db");
    let state = DesktopState::open(database.clone()).expect("desktop state opens");

    let status = state.status().expect("status command");
    assert_eq!(status.database, database);
    assert_eq!(status.schema_version, SCHEMA_VERSION);
    assert_eq!(status.contacts, 0);
    assert_eq!(status.products, 0);
    assert_eq!(status.invoices, 0);
    assert_eq!(status.users, 0);
    assert_eq!(status.lock_owner_pid, Some(std::process::id()));

    // A second session cannot take the lock the state holds.
    assert!(matches!(
        DesktopState::open(database.clone()),
        Err(CoreError::Validation(code)) if code == "lock_busy"
    ));

    let report = state.backup(None).expect("backup command");
    assert!(report.path.starts_with(dir.join("backups")));
    assert!(report.path.exists(), "backup file exists");
    assert!(report.bytes > report.database_bytes);
    assert_eq!(report.schema_version, SCHEMA_VERSION);

    let archive = std::fs::read(&report.path).expect("backup readable");
    assert!(
        archive.starts_with(b"SOCDOFBK"),
        "archive uses the core container format"
    );

    let explicit = dir.join("explicit.socdofbak");
    let explicit_report = state
        .backup(Some(Path::new(&explicit)))
        .expect("backup to explicit path");
    assert_eq!(explicit_report.path, explicit);
    assert!(explicit.exists());

    let lock = Paths::new(database.clone()).lock;
    assert!(lock.exists(), "state keeps the instance lock");
    drop(state);
    assert!(!lock.exists(), "dropping the state releases the lock");

    let _ = std::fs::remove_dir_all(dir);
}
