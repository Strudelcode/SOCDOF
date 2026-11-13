//! End-to-end proof for the restaurant POS commands of the desktop window.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::DesktopState;
use socdof_app::restaurant_bridge::{MenuItemInput, RestaurantCheckoutInput};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-restaurant-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn dish_input() -> MenuItemInput {
    MenuItemInput {
        id: None,
        name: "  SMOKE Trüffel-Pasta  ".to_string(),
        category: "mains".to_string(),
        price: 12.50,
        tax_rate: 7,
        ingredients: "Hausgemachte Pasta, Trüffel".to_string(),
        allergens: vec!["A (Gluten)".to_string(), " G (Milch) ".to_string()],
        emoji: "🍝".to_string(),
        prep_time_minutes: 12,
        is_available: true,
    }
}

#[test]
fn restaurant_roundtrip_persists_calculates_and_checks_out() {
    let dir = temp_dir("roundtrip");
    let database = dir.join("socdof.sqlite");
    let state = DesktopState::open(&database).expect("state");

    let initial = state.restaurant_overview().expect("initial overview");
    assert_eq!(initial.menu.len(), 11);
    assert_eq!(initial.tables.len(), 13);
    assert_eq!(initial.tables[0].name, "Tisch 1 (Fenster)");
    assert_eq!(initial.metrics.menu_count, 11);
    assert_eq!(initial.company.name, "SOCDOF Gastronomie");
    assert_eq!(initial.company.street, "Gastrostraße 1");
    assert_eq!(initial.company.tax_id, "DE123456789");

    let created = state
        .save_restaurant_menu_item(&dish_input())
        .expect("create dish");
    assert_eq!(created.name, "SMOKE Trüffel-Pasta");
    assert_eq!(created.price, 12.5);
    assert_eq!(created.allergens, vec!["A (Gluten)", "G (Milch)"]);
    assert!(created.is_available);

    let mut edit = dish_input();
    edit.id = Some(created.id);
    edit.price = 13.0;
    edit.prep_time_minutes = 10;
    edit.allergens = vec!["G (Milch)".to_string()];
    let edited = state.save_restaurant_menu_item(&edit).expect("edit dish");
    assert_eq!(edited.price, 13.0);
    assert_eq!(edited.prep_time_minutes, 10);

    let table = initial
        .tables
        .iter()
        .find(|table| table.status == "free")
        .expect("free table")
        .name
        .clone();
    let added = state
        .add_restaurant_item(&table, created.id)
        .expect("add position");
    assert!(added.created);
    let order = added.order.expect("created order");
    assert_eq!(order.items.len(), 1);
    assert_eq!(order.table_number, table);
    let item_id = order.items[0].id;
    assert_eq!(order.total, 13.91);

    let doubled = state
        .set_restaurant_order_item_qty(order.id, item_id, 2)
        .expect("quantity");
    let doubled = doubled.order.expect("doubled order");
    assert_eq!(doubled.items[0].qty, 2);
    assert_eq!(doubled.total, 27.82);

    let noted = state
        .set_restaurant_order_item_notes(order.id, item_id, " ohne Käse ")
        .expect("notes");
    assert_eq!(noted.items[0].notes, "ohne Käse");
    let served = state
        .set_restaurant_order_server(order.id, " GUI Smoke ")
        .expect("server");
    assert_eq!(served.server_name, "GUI Smoke");
    let preparing = state
        .set_restaurant_order_status(order.id, "preparing")
        .expect("kitchen status");
    assert_eq!(preparing.status, "preparing");

    let listed = state.restaurant_overview().expect("list");
    assert_eq!(listed.menu.len(), 12);
    assert_eq!(listed.metrics.open_tables, 1);
    assert_eq!(listed.metrics.in_kitchen, 1);
    assert_eq!(
        listed
            .tables
            .iter()
            .find(|entry| entry.name == table)
            .expect("table")
            .item_count,
        2
    );

    let checkout = state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(order.id),
            payment_method: "cash".to_string(),
            tip: 2.25,
            cash_given: Some(50.0),
            split_count: 2,
            is_hospitality_receipt: true,
            hospitality_host: "SOCDOF GmbH".to_string(),
            hospitality_occasion: "Projektmeeting".to_string(),
            hospitality_guests: "Gäste".to_string(),
        })
        .expect("checkout");
    assert_eq!(checkout.total_with_tip, 30.07);
    assert_eq!(checkout.change, 19.93);
    assert_eq!(checkout.split_count, 2);
    assert_eq!(checkout.total_per_person, 15.035);
    assert_eq!(checkout.order.status, "paid");
    assert_eq!(checkout.order.payment_method.as_deref(), Some("cash"));
    assert!(checkout.invoice_number.starts_with("GASTRO/"));
    assert_eq!(checkout.order.tip, 2.25);
    assert_eq!(checkout.order.cash_tendered, Some(50.0));
    assert_eq!(checkout.order.cash_change, Some(19.93));
    assert!(checkout.order.is_hospitality_receipt);
    assert_eq!(checkout.order.hospitality_host, "SOCDOF GmbH");

    let invoice = state.invoice(checkout.invoice_id).expect("invoice detail");
    assert_eq!(invoice.total_cents, 2_782);
    assert_eq!(invoice.status, "paid");
    assert_eq!(invoice.items.len(), 1);

    let persisted = state.restaurant_persistence(order.id).expect("persistence");
    assert!(persisted.present);
    assert_eq!(persisted.items, 1);
    assert_eq!(persisted.status, "paid");
    assert_eq!(persisted.menu, 12);
    assert_eq!(
        persisted.receipt_number.as_deref(),
        Some(checkout.invoice_number.as_str())
    );

    let after = state.restaurant_overview().expect("after checkout");
    assert_eq!(after.metrics.today_orders, 1);
    assert_eq!(after.metrics.cash_sales, 27.82);
    assert_eq!(after.metrics.today_revenue, 27.82);

    let csv_path = dir.join("restaurant.csv");
    let report = state.export_restaurant_csv(&csv_path).expect("csv");
    assert_eq!(report.rows, 1);
    let csv = std::fs::read_to_string(&csv_path).expect("csv file");
    assert!(csv.starts_with('\u{feff}'));
    assert!(csv.contains("SMOKE Trüffel-Pasta"));
    assert!(csv.contains(checkout.invoice_number.as_str()));
    assert!(csv.contains("27.82"));
    assert!(csv.contains("30.07"));

    state
        .delete_invoice(checkout.invoice_id)
        .expect("delete invoice");
    state.release_lock();
    drop(state);

    let reopened = DesktopState::open(&database).expect("reopen");
    let persisted = reopened.restaurant_overview().expect("reopened overview");
    assert_eq!(persisted.menu.len(), 12);
    let paid = persisted
        .orders
        .iter()
        .find(|entry| entry.id == order.id)
        .expect("persisted order");
    assert_eq!(paid.status, "paid");
    assert_eq!(paid.items[0].notes, "ohne Käse");
    assert_eq!(
        paid.receipt_number.as_deref(),
        Some(checkout.invoice_number.as_str())
    );

    reopened
        .delete_restaurant_order(order.id)
        .expect("delete order");
    reopened
        .delete_restaurant_menu_item(created.id)
        .expect("delete dish");
    let empty = reopened.restaurant_overview().expect("empty overview");
    assert!(empty.orders.is_empty());
    assert_eq!(empty.menu.len(), 11);
    reopened.release_lock();
}

#[test]
fn restaurant_checkout_keeps_grouped_vat_on_the_paid_invoice() {
    let dir = temp_dir("grouped-vat");
    let database = dir.join("socdof.sqlite");
    let state = DesktopState::open(&database).expect("state");

    let mut first = dish_input();
    first.name = "Kleiner Artikel A".to_string();
    first.price = 0.07;
    first.tax_rate = 7;
    let first = state.save_restaurant_menu_item(&first).expect("first dish");

    let mut second = dish_input();
    second.name = "Kleiner Artikel B".to_string();
    second.price = 0.07;
    second.tax_rate = 7;
    let second = state
        .save_restaurant_menu_item(&second)
        .expect("second dish");

    let table = "Tisch 1 (Fenster)";
    let opened = state
        .add_restaurant_item(table, first.id)
        .expect("open first line");
    let order_id = opened.order.expect("opened order").id;
    state
        .add_restaurant_item(table, second.id)
        .expect("add second line");

    let checkout = state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(order_id),
            payment_method: "card".to_string(),
            split_count: 1,
            ..Default::default()
        })
        .expect("checkout");
    assert_eq!(checkout.order.tax_total, 0.01);
    assert_eq!(checkout.order.total, 0.15);

    let invoice = state.invoice(checkout.invoice_id).expect("invoice");
    assert_eq!(invoice.subtotal_cents, 14);
    assert_eq!(invoice.tax_total_cents, 1);
    assert_eq!(invoice.total_cents, 15);
    let pos = state.pos_overview(0, i64::MAX, None).expect("POS overview");
    assert_eq!(pos.summary.tax_cents, 1);
    assert_eq!(pos.summary.gross_cents, 15);

    state.release_lock();
    drop(state);

    let reopened = DesktopState::open(&database).expect("reopen");
    let persisted = reopened
        .invoice(checkout.invoice_id)
        .expect("persisted invoice");
    assert_eq!(persisted.tax_total_cents, 1);
    assert_eq!(persisted.total_cents, 15);
    let persisted_pos = reopened
        .pos_overview(0, i64::MAX, None)
        .expect("persisted POS overview");
    assert_eq!(persisted_pos.summary.tax_cents, 1);
    assert_eq!(persisted_pos.summary.gross_cents, 15);
    reopened.release_lock();
}

#[test]
fn restaurant_rejects_invalid_dish_order_and_checkout_values() {
    let dir = temp_dir("validation");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");

    let mut invalid = dish_input();
    invalid.name = "   ".to_string();
    assert!(state.save_restaurant_menu_item(&invalid).is_err());
    invalid.name = "Test".to_string();
    invalid.category = "invalid".to_string();
    assert!(state.save_restaurant_menu_item(&invalid).is_err());
    invalid.category = "mains".to_string();
    invalid.price = -1.0;
    assert!(state.save_restaurant_menu_item(&invalid).is_err());

    let dish = state
        .save_restaurant_menu_item(&dish_input())
        .expect("dish");
    assert!(state
        .add_restaurant_item("Tisch 1 (Fenster)", uuid::Uuid::new_v4())
        .is_err());

    let order = state
        .add_restaurant_item("Tisch 1 (Fenster)", dish.id)
        .expect("order")
        .order
        .expect("order view");
    assert!(state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: None,
            payment_method: "cash".to_string(),
            ..Default::default()
        })
        .is_err());
    assert!(state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(order.id),
            payment_method: "bitcoin".to_string(),
            ..Default::default()
        })
        .is_err());

    let paid = state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(order.id),
            payment_method: "card".to_string(),
            split_count: 1,
            ..Default::default()
        })
        .expect("paid");
    assert!(state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(order.id),
            payment_method: "cash".to_string(),
            ..Default::default()
        })
        .is_err());
    state.delete_invoice(paid.invoice_id).expect("invoice");
    state.release_lock();
}

#[test]
fn restaurant_receipt_number_considers_kept_pos_receipts() {
    let dir = temp_dir("receipt-number");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let overview = state.restaurant_overview().expect("overview");
    let dish = overview.menu[0].id;
    let first_table = overview
        .tables
        .iter()
        .find(|table| table.status == "free")
        .expect("first free table")
        .name
        .clone();
    let first_order = state
        .add_restaurant_item(&first_table, dish)
        .expect("first order")
        .order
        .expect("first order view");
    let first = state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(first_order.id),
            payment_method: "cash".to_string(),
            cash_given: Some(100.0),
            split_count: 1,
            ..Default::default()
        })
        .expect("first checkout");
    let first_number: u32 = first
        .invoice_number
        .rsplit('/')
        .next()
        .expect("number suffix")
        .parse()
        .expect("numeric suffix");

    // Deleting the ERP invoice must not make its printed POS receipt number reusable.
    state
        .delete_invoice(first.invoice_id)
        .expect("delete first invoice");
    let second_table = state
        .restaurant_overview()
        .expect("second overview")
        .tables
        .into_iter()
        .find(|table| table.status == "free")
        .expect("second free table")
        .name;
    let second_order = state
        .add_restaurant_item(&second_table, dish)
        .expect("second order")
        .order
        .expect("second order view");
    let second = state
        .restaurant_checkout(&RestaurantCheckoutInput {
            order_id: Some(second_order.id),
            payment_method: "card".to_string(),
            split_count: 1,
            ..Default::default()
        })
        .expect("second checkout");
    let second_number: u32 = second
        .invoice_number
        .rsplit('/')
        .next()
        .expect("number suffix")
        .parse()
        .expect("numeric suffix");
    assert_eq!(second_number, first_number + 1);
    assert_eq!(second.order.status, "paid");

    state
        .delete_invoice(second.invoice_id)
        .expect("delete second invoice");
    state
        .delete_restaurant_order(first_order.id)
        .expect("delete first order");
    state
        .delete_restaurant_order(second_order.id)
        .expect("delete second order");
    state.release_lock();
}
