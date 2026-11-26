//! Desktop-state proof for the dashboard command.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{ContactInput, DesktopState, ProductInput};
use socdof_app::invoice_bridge::{InvoiceInput, InvoiceItemInput};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-dashboard-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn contact_input(name: &str) -> ContactInput {
    ContactInput {
        name: name.to_string(),
        company: name.to_string(),
        is_company: true,
        contact_type: "customer".to_string(),
        first_name: String::new(),
        last_name: String::new(),
        street: "Hauptstraße 1".to_string(),
        zip: "10115".to_string(),
        city: "Berlin".to_string(),
        country: "Deutschland".to_string(),
        email: String::new(),
        phone: String::new(),
        tax_id: String::new(),
        notes: String::new(),
        contact_persons: None,
    }
}

fn product_input(name: &str, sku: &str) -> ProductInput {
    ProductInput {
        name: name.to_string(),
        sku: sku.to_string(),
        category: String::new(),
        unit: "Stk".to_string(),
        price_cents: 900,
        cost_price_cents: 500,
        tax_rate_bp: 0,
        stock: 2,
        reorder_level: 10,
        target_stock: 10,
        barcode: String::new(),
        asin: String::new(),
        web_link: String::new(),
        source_domain: String::new(),
        description: String::new(),
        image_emoji: String::new(),
        exclude_from_reorder: false,
    }
}

fn invoice_input(contact_id: uuid::Uuid) -> InvoiceInput {
    InvoiceInput {
        id: None,
        number: "2026-0001".to_string(),
        contact_id,
        status: "sent".to_string(),
        date: "2026-11-01".to_string(),
        due_date: "2026-11-15".to_string(),
        currency_symbol: "€".to_string(),
        notes: String::new(),
        items: vec![InvoiceItemInput {
            description: "Beratung".to_string(),
            quantity_milli: 1_000,
            unit_price_cents: 10_000,
            tax_rate_bp: 0,
        }],
    }
}

#[test]
fn dashboard_reports_counts_low_stock_and_open_invoices() {
    let dir = temp_dir("state");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let contact = state
        .create_contact(&contact_input("AlpenTech"))
        .expect("contact");
    state
        .create_product(&product_input("Kaffee", "A-100"))
        .expect("product");
    state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice");

    let now = 1_794_052_800_000; // 2026-11-07 12:00 UTC
    let view = state.dashboard(0, i64::MAX, now).expect("dashboard");

    assert_eq!(view.summary.contacts, 1);
    assert_eq!(view.summary.products, 1);
    assert_eq!(view.summary.low_stock, 1);
    assert_eq!(view.summary.invoices, 1);
    assert_eq!(view.summary.open_invoices, 1);
    assert_eq!(view.summary.gross, 10_000);
    assert_eq!(view.summary.open, 10_000);
    assert_eq!(view.recent.len(), 1);
    assert_eq!(view.recent[0].number, "2026-0001");
    assert_eq!(view.recent[0].contact, "AlpenTech");
    assert_eq!(view.recent[0].status, "sent");
    assert_eq!(view.recent[0].gross, 10_000);
    assert_eq!(view.low_stock.len(), 1);
    assert_eq!(view.low_stock[0].sku, "A-100");

    state.release_lock();
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn dashboard_period_excludes_invoices_before_the_start() {
    let dir = temp_dir("period");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    let contact = state
        .create_contact(&contact_input("AlpenTech"))
        .expect("contact");
    state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice");

    let now = 1_794_052_800_000;
    let view = state.dashboard(now, i64::MAX, now).expect("dashboard");

    assert_eq!(view.summary.invoices, 0);
    assert_eq!(view.summary.gross, 0);
    assert_eq!(
        view.recent.len(),
        1,
        "the recent list is period independent"
    );

    state.release_lock();
    let _ = std::fs::remove_dir_all(dir);
}
