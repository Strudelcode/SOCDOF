//! Desktop-state proof for the backoffice commands.
//!
//! The Tauri layer only forwards these methods, so the tests exercise the same validation, SQLite,
//! backup and AppStore code paths without GTK/WebKit.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{
    ContactInput, DesktopState, JournalInput, ProductInput, PurchaseInput, PurchaseLineInput,
};
use socdof_core::domain::accounting::CashBookRow;
use socdof_core::store::SCHEMA_VERSION;
use uuid::Uuid;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-backoffice-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn contact_input(name: &str, contact_type: &str) -> ContactInput {
    ContactInput {
        name: name.to_string(),
        company: name.to_string(),
        is_company: true,
        contact_type: contact_type.to_string(),
        first_name: String::new(),
        last_name: String::new(),
        street: "Hauptstraße 1".to_string(),
        zip: "10115".to_string(),
        city: "Berlin".to_string(),
        country: "Deutschland".to_string(),
        email: "vendor@example.invalid".to_string(),
        phone: "+49 30 123456".to_string(),
        tax_id: "DE-VENDOR".to_string(),
        notes: String::new(),
        contact_persons: None,
    }
}

fn product_input(name: &str, sku: &str) -> ProductInput {
    ProductInput {
        name: name.to_string(),
        sku: sku.to_string(),
        category: "Einkauf".to_string(),
        unit: "Stk".to_string(),
        price_cents: 1_200,
        cost_price_cents: 500,
        tax_rate_bp: 1_900,
        stock: 0,
        reorder_level: 0,
        target_stock: 0,
        barcode: String::new(),
        asin: String::new(),
        web_link: String::new(),
        source_domain: String::new(),
        description: String::new(),
        image_emoji: String::new(),
        exclude_from_reorder: false,
    }
}

fn journal_input(amount_cents: i64, channel: &str) -> JournalInput {
    JournalInput {
        id: None,
        booked_at: 1_700_000_000_000,
        description: "Testbuchung".to_string(),
        account: "1200 Bank".to_string(),
        counter_account: "8400 Erlöse".to_string(),
        amount_cents,
        tax_rate_bp: 1_900,
        kind: "income".to_string(),
        channel: channel.to_string(),
        reference: "RE-1".to_string(),
    }
}

#[test]
fn journal_entries_summarise_cash_book_and_reject_invalid_values() {
    let dir = temp_dir("journal");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let income = state
        .save_journal_entry(&journal_input(100_000, "bank"))
        .expect("income is stored");
    assert_eq!(income.amount.cents(), 100_000);
    let summary = state.journal_summary().expect("summary");
    assert_eq!(summary.revenue_net.cents(), 100_000);
    assert_eq!(summary.tax_collected.cents(), 19_000);

    let mut expense = journal_input(40_000, "cash");
    expense.kind = "expense".to_string();
    expense.account = "4930 Bürobedarf".to_string();
    expense.counter_account = "1000 Kasse".to_string();
    state
        .save_journal_entry(&expense)
        .expect("expense is stored");

    let cash: Vec<CashBookRow> = state.journal_cash_book().expect("cash book");
    assert_eq!(cash.len(), 1);
    assert_eq!(cash[0].balance.cents(), -47_600);

    let mut invalid = journal_input(0, "bank");
    invalid.id = None;
    assert!(state.save_journal_entry(&invalid).is_err());
    invalid.amount_cents = 1_000;
    invalid.kind = "transfer".to_string();
    assert!(state.save_journal_entry(&invalid).is_err());

    state.delete_journal_entry(income.id).expect("delete");
    assert_eq!(state.journal_entries(None).expect("entries").len(), 1);
}

#[test]
fn purchase_orders_validate_references_and_receive_stock() {
    let dir = temp_dir("purchases");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let vendor = state
        .create_contact(&contact_input("Lieferant GmbH", "vendor"))
        .expect("vendor");
    let customer = state
        .create_contact(&contact_input("Kunde GmbH", "customer"))
        .expect("customer");
    let product = state
        .create_product(&product_input("Kaffeebohnen", "SKU-1"))
        .expect("product");

    let input = PurchaseInput {
        id: None,
        number: "BE-2026-1".to_string(),
        vendor_id: Some(vendor.id),
        note: "Test".to_string(),
        expected_at: None,
        lines: vec![PurchaseLineInput {
            product_id: Some(product.id),
            description: "Kaffeebohnen".to_string(),
            quantity_milli: 1_000,
            unit_cost_cents: 500,
            tax_rate_bp: 1_900,
        }],
    };
    let order = state.save_purchase_order(&input).expect("order is stored");
    assert_eq!(order.total_gross().cents(), 595);
    assert_eq!(state.purchase_orders(None).expect("orders").len(), 1);

    let mut unknown_vendor = input.clone();
    unknown_vendor.vendor_id = Some(Uuid::new_v4());
    assert!(state.save_purchase_order(&unknown_vendor).is_err());
    let mut not_a_vendor = input.clone();
    not_a_vendor.vendor_id = Some(customer.id);
    assert!(state.save_purchase_order(&not_a_vendor).is_err());
    let mut unknown_product = input.clone();
    unknown_product.lines[0].product_id = Some(Uuid::new_v4());
    assert!(state.save_purchase_order(&unknown_product).is_err());
    let mut negative = input.clone();
    negative.lines[0].unit_cost_cents = -1;
    assert!(state.save_purchase_order(&negative).is_err());

    state
        .set_purchase_order_status(order.id, "ordered")
        .expect("status");
    state
        .receive_purchase_order(order.id)
        .expect("stock receipt");
    let received = state.purchase_orders(None).expect("orders");
    assert_eq!(received[0].status.as_str(), "received");
    assert_eq!(state.product(product.id).expect("product").stock, 1);
}

#[test]
fn app_store_lists_and_persists_activation() {
    let dir = temp_dir("app-store");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let modules = state.app_store_modules().expect("catalogue");
    assert_eq!(modules.len(), 15);
    let contacts = modules
        .iter()
        .find(|module| module.id == "contacts")
        .expect("contacts module");
    assert!(contacts.active);

    state
        .set_app_store_module("contacts", false)
        .expect("deactivate");
    assert!(
        !state
            .app_store_modules()
            .expect("catalogue")
            .iter()
            .find(|module| module.id == "contacts")
            .expect("contacts module")
            .active
    );
    state
        .set_app_store_module("contacts", true)
        .expect("reactivate");
    assert!(state.set_app_store_module("unknown", false).is_err());
}

#[test]
fn verify_and_restore_replace_the_database_atomically() {
    let dir = temp_dir("restore");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let contact = state
        .create_contact(&contact_input("Restore GmbH", "customer"))
        .expect("contact");
    let archive = dir.join("restore.socdofbak");
    state.save_backup_to(&archive).expect("backup");
    let metadata = state.verify_backup(&archive).expect("verify");
    assert_eq!(metadata.schema_version, SCHEMA_VERSION);
    let default_backup = state.backup(None).expect("default backup");
    assert!(
        state
            .backup_files()
            .expect("default backup list")
            .iter()
            .any(|file| file.path == default_backup.path.to_string_lossy()),
        "the backup list must include archives written to the default folder"
    );

    state.delete_contact(contact.id).expect("delete");
    assert!(state.contacts(None).expect("contacts").is_empty());
    let report = state.restore_backup(&archive).expect("restore");
    assert_eq!(report.kind, "container");
    assert_eq!(report.schema_version, SCHEMA_VERSION);
    assert_eq!(state.contacts(None).expect("contacts").len(), 1);
}
