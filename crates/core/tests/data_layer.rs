//! Integration tests for the complete data layer: every aggregate, the transactional writes,
//! the permission matrix, the session path and the FTS5 search.

use socdof_core::domain::appointment::{Appointment, AppointmentStatus};
use socdof_core::domain::billing::{BillingItem, BillingKind};
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::permission::{AppModule, PermissionLevel, Role};
use socdof_core::domain::pos::{PaymentMethod, PosOrder, PosOrderLine};
use socdof_core::domain::product::Product;
use socdof_core::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
use socdof_core::domain::session::{LoginOutcome, LOCKOUT_MS};
use socdof_core::domain::stock::{StockMove, StockMoveKind};
use socdof_core::domain::support::{SupportTicket, TicketPriority, TicketStatus, TimeEntry};
use socdof_core::domain::user::{User, UserRole};
use socdof_core::domain::workspace::{Report, Widget, WidgetKind};
use socdof_core::money::Money;
use socdof_core::security;
use socdof_core::store::Store;
use uuid::Uuid;

const NOW: i64 = 1_700_000_000_000;

fn store() -> Store {
    Store::open_in_memory().expect("store")
}

fn create_contact(store: &Store, name: &str) -> Contact {
    let mut contact = Contact::new(ContactKind::Company, NOW);
    contact.company_name = Some(name.to_string());
    contact.city = Some("Bozen".to_string());
    store.insert_contact(&contact).expect("contact inserted");
    contact
}

fn create_product(store: &Store, name: &str, stock: i64) -> Product {
    let mut product = Product::new(name, NOW);
    product.price = Money::from_cents(500);
    product.stock = stock;
    store.insert_product(&product).expect("product inserted");
    product
}

fn create_user(store: &Store, username: &str, role_id: Option<Uuid>) -> User {
    let account = User {
        id: Uuid::new_v4(),
        username: username.to_string(),
        display_name: "Administrator".to_string(),
        role: UserRole::User,
        role_id: role_id.map(|id| id.to_string()),
        active: true,
        password_hash: security::hash_password("admin-passwort").expect("hash"),
        must_change_password: false,
        created_at: NOW,
        updated_at: NOW,
    };
    store.insert_user(&account).expect("user inserted");
    account
}

fn invoice(number: &str, buyer: &Contact) -> Invoice {
    Invoice {
        id: Uuid::new_v4(),
        number: number.to_string(),
        contact_id: buyer.id,
        status: InvoiceStatus::Sent,
        issued_at: NOW,
        due_at: NOW,
        currency_symbol: "€".to_string(),
        note: Some("Danke".to_string()),
        tax_total_override_cents: None,
        lines: vec![InvoiceLine {
            description: "Beratung".to_string(),
            quantity_milli: 1_000,
            unit_price: Money::from_cents(8_000),
            tax_rate_bp: 1900,
        }],
    }
}

#[test]
fn purchase_receipt_books_stock_and_marks_the_order_received() {
    let store = store();
    let vendor = create_contact(&store, "Global Hardware");
    let product = create_product(&store, "Sensor", 0);

    let order = PurchaseOrder {
        id: Uuid::new_v4(),
        number: "BE-0001".to_string(),
        vendor_id: vendor.id,
        status: PurchaseOrderStatus::Ordered,
        order_date: NOW,
        expected_at: None,
        currency_symbol: "€".to_string(),
        note: None,
        lines: vec![PurchaseOrderLine {
            product_id: Some(product.id),
            description: "Sensor".to_string(),
            quantity_milli: 5_000,
            unit_cost: Money::from_cents(2_000),
            tax_rate_bp: 1900,
        }],
        legacy_id: None,
        created_at: NOW,
        updated_at: NOW,
    };
    store.insert_purchase_order(&order).expect("order inserted");

    let movement = StockMove {
        id: Uuid::new_v4(),
        product_id: product.id,
        kind: StockMoveKind::In,
        quantity: 5,
        reason: Some("BE-0001".to_string()),
        created_at: NOW,
    };
    store
        .receive_purchase_order(order.id, &[movement], NOW)
        .expect("goods received");

    let loaded = store
        .find_purchase_order(order.id)
        .expect("query")
        .expect("order present");
    assert_eq!(loaded.status, PurchaseOrderStatus::Received);
    assert_eq!(loaded.total_gross(), Money::from_cents(11_900));
    assert_eq!(store.list_products().expect("products")[0].stock, 5);

    let error = store
        .receive_purchase_order(order.id, &[], NOW)
        .expect_err("receiving twice must fail");
    assert!(matches!(
        error,
        socdof_core::CoreError::Validation(code) if code == "order_not_receivable"
    ));
}

#[test]
fn pos_receipt_rolls_back_when_the_stock_is_missing() {
    let store = store();
    let product = create_product(&store, "Espresso", 1);

    let order = PosOrder {
        id: Uuid::new_v4(),
        receipt_number: "BON-0001".to_string(),
        contact_id: None,
        payment_method: PaymentMethod::Cash,
        paid_at: NOW,
        currency_symbol: "€".to_string(),
        note: None,
        tax_total_override_cents: None,
        cash_given: None,
        lines: vec![PosOrderLine {
            product_id: Some(product.id),
            description: "Espresso".to_string(),
            quantity_milli: 2_000,
            unit_price: Money::from_cents(250),
            tax_rate_bp: 700,
        }],
        legacy_id: None,
    };

    let movement = StockMove {
        id: Uuid::new_v4(),
        product_id: product.id,
        kind: StockMoveKind::Out,
        quantity: 2,
        reason: Some("BON-0001".to_string()),
        created_at: NOW,
    };

    assert!(store.insert_pos_order(&order, &[movement]).is_err());
    assert!(store.list_pos_orders().expect("receipts").is_empty());
    assert_eq!(store.list_products().expect("products")[0].stock, 1);

    let sellable = PosOrder {
        lines: vec![PosOrderLine {
            quantity_milli: 1_000,
            ..order.lines[0].clone()
        }],
        ..order
    };
    let movement = StockMove {
        id: Uuid::new_v4(),
        product_id: product.id,
        kind: StockMoveKind::Out,
        quantity: 1,
        reason: Some("BON-0001".to_string()),
        created_at: NOW,
    };
    store
        .insert_pos_order(&sellable, &[movement])
        .expect("receipt inserted");
    assert_eq!(store.list_pos_orders().expect("receipts").len(), 1);
    assert_eq!(
        store.list_pos_orders().expect("receipts")[0].total_gross(),
        Money::from_cents(268)
    );
    assert_eq!(store.list_products().expect("products")[0].stock, 0);
}

#[test]
fn invoice_books_stock_in_the_same_transaction() {
    let store = store();
    let buyer = create_contact(&store, "AlpenTech Solutions AG");
    let product = create_product(&store, "Gateway", 3);
    let document = invoice("2026-0001", &buyer);
    store.insert_invoice(&document).expect("invoice inserted");

    let sold = invoice("2026-0002", &buyer);
    let movement = StockMove {
        id: Uuid::new_v4(),
        product_id: product.id,
        kind: StockMoveKind::Out,
        quantity: 2,
        reason: Some("2026-0002".to_string()),
        created_at: NOW,
    };
    store
        .insert_invoice_with_stock(&sold, &[movement])
        .expect("sold");

    assert_eq!(store.list_products().expect("products")[0].stock, 1);
    assert_eq!(store.list_invoices().expect("invoices").len(), 2);

    let too_many = invoice("2026-0003", &buyer);
    let movement = StockMove {
        id: Uuid::new_v4(),
        product_id: product.id,
        kind: StockMoveKind::Out,
        quantity: 99,
        reason: Some("2026-0003".to_string()),
        created_at: NOW,
    };
    assert!(store
        .insert_invoice_with_stock(&too_many, &[movement])
        .is_err());
    assert_eq!(store.list_invoices().expect("invoices").len(), 2);
    assert_eq!(store.list_products().expect("products")[0].stock, 1);
}

#[test]
fn billing_items_are_collected_on_one_invoice() {
    let store = store();
    let client = create_contact(&store, "Praxis Kundin");
    let document = invoice("2026-0100", &client);
    store.insert_invoice(&document).expect("invoice inserted");

    let mut first = BillingItem {
        id: Uuid::new_v4(),
        contact_id: client.id,
        invoice_id: None,
        kind: BillingKind::TherapySession,
        code: "GOP 870".to_string(),
        description: "Sitzung".to_string(),
        service_date: NOW,
        quantity_milli: 1_000,
        unit_price: Money::from_cents(9_000),
        tax_rate_bp: 0,
        created_at: NOW,
        updated_at: NOW,
    };
    store.insert_billing_item(&first).expect("item inserted");
    let second = BillingItem {
        id: Uuid::new_v4(),
        description: "Material".to_string(),
        kind: BillingKind::Material,
        ..first.clone()
    };
    store.insert_billing_item(&second).expect("item inserted");

    assert_eq!(
        store
            .open_billing_items_for_contact(client.id)
            .expect("open")
            .len(),
        2
    );

    let assigned = store
        .assign_billing_items_to_invoice(&[first.id, second.id], document.id, NOW)
        .expect("assigned");
    assert_eq!(assigned, 2);
    assert_eq!(
        store
            .billing_items_for_invoice(document.id)
            .expect("billed")
            .len(),
        2
    );
    assert!(store
        .open_billing_items_for_contact(client.id)
        .expect("open")
        .is_empty());

    first.invoice_id = Some(document.id);
    first.description = "Sitzung 2".to_string();
    store.update_billing_item(&first).expect("updated");
    assert_eq!(
        store
            .find_billing_item(first.id)
            .expect("query")
            .expect("item")
            .description,
        "Sitzung 2"
    );

    assert!(store
        .assign_billing_items_to_invoice(&[second.id], Uuid::new_v4(), NOW)
        .is_err());
    store.delete_billing_item(second.id).expect("deleted");
    assert_eq!(store.list_billing_items().expect("items").len(), 1);
}

#[test]
fn appointments_are_listed_by_range() {
    let store = store();
    let client = create_contact(&store, "Kalender Kunde");

    let early = Appointment {
        id: Uuid::new_v4(),
        contact_id: Some(client.id),
        title: "Früh".to_string(),
        location: None,
        notes: None,
        status: AppointmentStatus::Scheduled,
        starts_at: NOW,
        ends_at: NOW + 30 * 60_000,
        created_at: NOW,
        updated_at: NOW,
    };
    let late = Appointment {
        id: Uuid::new_v4(),
        title: "Spät".to_string(),
        starts_at: NOW + 4 * 60 * 60_000,
        ends_at: NOW + 5 * 60 * 60_000,
        ..early.clone()
    };
    store.insert_appointment(&early).expect("inserted");
    store.insert_appointment(&late).expect("inserted");

    let today = store
        .appointments_between(NOW - 60_000, NOW + 2 * 60 * 60_000)
        .expect("range");
    assert_eq!(today.len(), 1);
    assert_eq!(today[0].title, "Früh");
    assert_eq!(today[0].duration_minutes(), 30);

    let mut confirmed = early.clone();
    confirmed.status = AppointmentStatus::Confirmed;
    confirmed.title = "Bestätigt".to_string();
    store.update_appointment(&confirmed).expect("updated");
    assert_eq!(
        store
            .find_appointment(early.id)
            .expect("query")
            .expect("appointment")
            .status,
        AppointmentStatus::Confirmed
    );

    store.delete_appointment(late.id).expect("deleted");
    assert_eq!(store.list_appointments().expect("list").len(), 1);
}

#[test]
fn support_tickets_track_time_and_close() {
    let store = store();
    let client = create_contact(&store, "Support Kunde");

    let ticket = SupportTicket {
        id: Uuid::new_v4(),
        contact_id: Some(client.id),
        subject: "Drucker defekt".to_string(),
        description: "Papierstau".to_string(),
        status: TicketStatus::Open,
        priority: TicketPriority::High,
        created_at: NOW,
        updated_at: NOW,
        closed_at: None,
    };
    store.insert_support_ticket(&ticket).expect("ticket");

    let first = TimeEntry {
        id: Uuid::new_v4(),
        ticket_id: Some(ticket.id),
        user_id: None,
        description: "Telefon".to_string(),
        minutes: 30,
        started_at: NOW,
        created_at: NOW,
        updated_at: NOW,
    };
    let second = TimeEntry {
        id: Uuid::new_v4(),
        minutes: 60,
        started_at: NOW + 60_000,
        ..first.clone()
    };
    store.insert_time_entry(&first).expect("entry");
    store.insert_time_entry(&second).expect("entry");

    assert_eq!(store.tracked_minutes(ticket.id).expect("minutes"), 90);
    assert_eq!(
        store
            .time_entries_for_ticket(ticket.id)
            .expect("entries")
            .len(),
        2
    );
    assert_eq!(
        store
            .time_entries_between(NOW, NOW + 1_000)
            .expect("range")
            .len(),
        1
    );

    store
        .set_support_ticket_status(ticket.id, TicketStatus::Closed, NOW + 7_200_000)
        .expect("closed");
    let closed = store
        .find_support_ticket(ticket.id)
        .expect("query")
        .expect("ticket");
    assert_eq!(closed.status, TicketStatus::Closed);
    assert_eq!(closed.closed_at, Some(NOW + 7_200_000));
    assert!(store.open_support_tickets().expect("open").is_empty());

    store.delete_time_entry(first.id).expect("deleted");
    assert_eq!(store.tracked_minutes(ticket.id).expect("minutes"), 60);
}

#[test]
fn widgets_and_reports_roundtrip() {
    let store = store();

    let clock = Widget {
        id: Uuid::new_v4(),
        kind: WidgetKind::Clock,
        title: "Uhr".to_string(),
        config: serde_json::json!({ "analog": true }),
        position: 2,
        enabled: true,
        created_at: NOW,
        updated_at: NOW,
    };
    let notes = Widget {
        id: Uuid::new_v4(),
        kind: WidgetKind::Notes,
        title: "Notizen".to_string(),
        config: serde_json::json!({ "text": "Hallo" }),
        position: 1,
        enabled: true,
        created_at: NOW,
        updated_at: NOW,
    };
    store.insert_widget(&clock).expect("widget");
    store.insert_widget(&notes).expect("widget");

    let widgets = store.list_widgets().expect("widgets");
    assert_eq!(widgets.len(), 2);
    assert_eq!(widgets[0].title, "Notizen");

    let mut hidden = clock.clone();
    hidden.enabled = false;
    store.update_widget(&hidden).expect("updated");
    assert!(
        !store
            .find_widget(clock.id)
            .expect("query")
            .expect("widget")
            .enabled
    );

    let report = Report {
        id: Uuid::new_v4(),
        kind: "revenue_by_month".to_string(),
        title: "Umsatz 2026".to_string(),
        parameters: serde_json::json!({ "year": 2026 }),
        generated_at: NOW,
    };
    store.insert_report(&report).expect("report");
    let reports = store.list_reports().expect("reports");
    assert_eq!(reports.len(), 1);
    assert_eq!(reports[0].parameters["year"], 2026);

    store.delete_widget(notes.id).expect("deleted");
    assert_eq!(store.list_widgets().expect("widgets").len(), 1);
}

#[test]
fn roles_gate_module_access() {
    let store = store();

    let roles = store.list_roles().expect("roles");
    assert_eq!(roles.len(), 2);
    assert!(roles.iter().all(|role| role.is_builtin));

    let mut custom = Role::new("Buchhaltung", NOW);
    custom.set(AppModule::Invoices, PermissionLevel::Edit);
    custom.set(AppModule::Contacts, PermissionLevel::View);
    store.insert_role(&custom).expect("role inserted");

    let account = create_user(&store, "buchhalter", Some(custom.id));
    assert!(store
        .user_allows(&account, AppModule::Invoices, PermissionLevel::Edit)
        .expect("allowed"));
    assert!(!store
        .user_allows(&account, AppModule::Invoices, PermissionLevel::Manage)
        .expect("allowed"));
    assert!(!store
        .user_allows(&account, AppModule::Pos, PermissionLevel::View)
        .expect("allowed"));

    let admin = User {
        role: UserRole::Admin,
        role_id: None,
        ..account.clone()
    };
    assert!(store
        .user_allows(&admin, AppModule::Users, PermissionLevel::Manage)
        .expect("allowed"));

    // Unknown role references fall back to the built-in standard role.
    let fallback = create_user(&store, "fallback", Some(Uuid::new_v4()));
    assert_eq!(
        store.role_for_user(&fallback).expect("role").id,
        socdof_core::domain::permission::USER_ROLE_ID
    );

    custom.description = "Buchhaltung und Rechnungen".to_string();
    store.update_role(&custom).expect("updated");
    assert_eq!(
        store
            .find_role(custom.id)
            .expect("query")
            .expect("role")
            .description,
        "Buchhaltung und Rechnungen"
    );

    store.delete_role(custom.id).expect("deleted");
    let builtin = socdof_core::domain::permission::ADMIN_ROLE_ID;
    let error = store.delete_role(builtin).expect_err("protected");
    assert!(matches!(
        error,
        socdof_core::CoreError::Validation(code) if code == "role_builtin"
    ));
}

#[test]
fn login_counts_failures_and_locks_the_account() {
    let store = store();
    let account = create_user(&store, "admin", None);

    assert!(matches!(
        store.login("admin", "admin-passwort", NOW).expect("login"),
        LoginOutcome::Success { .. }
    ));

    for attempt in 0..4 {
        let outcome = store
            .login("admin", "falsch", NOW + attempt * 1_000)
            .expect("login");
        assert!(
            matches!(outcome, LoginOutcome::Invalid),
            "attempt {attempt}"
        );
    }

    let locked = store.login("admin", "falsch", NOW + 5_000).expect("login");
    let until = match locked {
        LoginOutcome::Locked { until } => until,
        other => panic!("expected a lockout, got {other:?}"),
    };
    assert_eq!(until, NOW + 5_000 + LOCKOUT_MS);

    // Even the correct password is rejected while the account is locked.
    assert!(matches!(
        store
            .login("admin", "admin-passwort", NOW + 6_000)
            .expect("login"),
        LoginOutcome::Locked { .. }
    ));

    let outcome = store
        .login("admin", "admin-passwort", until)
        .expect("login");
    let (session, token) = match outcome {
        LoginOutcome::Success {
            user,
            session,
            token,
        } => {
            assert_eq!(user.id, account.id);
            (session, token)
        }
        other => panic!("expected success, got {other:?}"),
    };

    assert_eq!(
        store
            .session_for_token(&token, until)
            .expect("session")
            .expect("active session")
            .id,
        session.id
    );
    assert!(store
        .session_for_token(&token, session.expires_at)
        .expect("session")
        .is_none());
}

#[test]
fn sessions_are_revoked_on_sign_out() {
    let store = store();
    let account = create_user(&store, "admin", None);

    let (token, session_id) = match store.login("admin", "admin-passwort", NOW).expect("login") {
        LoginOutcome::Success { session, token, .. } => (token, session.id),
        other => panic!("expected success, got {other:?}"),
    };

    store.touch_session(session_id, NOW + 1_000).expect("touch");
    store.sign_out(session_id, NOW + 2_000).expect("sign out");
    assert!(store
        .session_for_token(&token, NOW + 3_000)
        .expect("session")
        .is_none());

    assert!(matches!(
        store
            .login("admin", "admin-passwort", NOW + 4_000)
            .expect("login"),
        LoginOutcome::Success { .. }
    ));
    assert_eq!(store.sign_out_all(account.id, NOW + 5_000).expect("all"), 1);
    assert_eq!(store.purge_expired_sessions(NOW + 5_000).expect("purge"), 2);
}

#[test]
fn full_text_search_finds_contacts_products_and_invoices() {
    let store = store();
    let buyer = create_contact(&store, "AlpenTech Solutions AG");
    create_product(&store, "Kaffee Bohnen", 10);
    store
        .insert_invoice(&invoice("2026-0001", &buyer))
        .expect("invoice");

    assert_eq!(store.search_contacts("Alpen").expect("contacts").len(), 1);
    // A term inside a longer token is found by the substring fallback.
    assert_eq!(store.search_contacts("Tech").expect("contacts").len(), 1);
    assert_eq!(store.search_products("Kaffee").expect("products").len(), 1);
    assert_eq!(store.search_products("Bohnen").expect("products").len(), 1);
    assert_eq!(store.search_invoices("2026").expect("invoices").len(), 1);
    assert_eq!(
        store.search_invoices("Beratung").expect("invoices").len(),
        1
    );
    assert!(store
        .search_contacts("Unbekannt")
        .expect("contacts")
        .is_empty());

    // The indices follow updates and deletes.
    let mut renamed = buyer.clone();
    renamed.company_name = Some("Neue Firma".to_string());
    store.update_contact(&renamed).expect("updated");
    assert!(store.search_contacts("Alpen").expect("contacts").is_empty());
    assert_eq!(store.search_contacts("Neue").expect("contacts").len(), 1);
}
