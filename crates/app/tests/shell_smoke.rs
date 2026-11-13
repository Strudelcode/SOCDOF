//! Headless proof that the shell starts, holds the instance lock and forwards commands to the core.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::shell::{Paths, Shell};
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::error::CoreError;
use socdof_core::money::Money;
use socdof_core::now_millis;
use socdof_core::store::{Store, SCHEMA_VERSION};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-shell-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn seed(database: &Path) -> String {
    let store = Store::open(database).expect("store");

    let mut contact = Contact::new(ContactKind::Company, now_millis());
    contact.company_name = Some("Shell Beweis GmbH".to_string());
    contact.street = Some("Hauptstrasse 5".to_string());
    contact.zip = Some("10115".to_string());
    contact.city = Some("Berlin".to_string());
    store.insert_contact(&contact).expect("contact inserted");

    let invoice = Invoice {
        id: uuid::Uuid::new_v4(),
        number: "2026-0500".to_string(),
        contact_id: contact.id,
        status: InvoiceStatus::Sent,
        issued_at: 1_760_000_000_000,
        due_at: 1_762_000_000_000,
        currency_symbol: "€".to_string(),
        note: None,
        tax_total_override_cents: None,
        lines: vec![InvoiceLine {
            description: "Beratung".to_string(),
            quantity_milli: 1_000,
            unit_price: Money::from_cents(10_000),
            tax_rate_bp: 1900,
        }],
    };
    store.insert_invoice(&invoice).expect("invoice inserted");

    store
        .save_company_profile(&CompanyProfile {
            name: "Shell Beweis GmbH".to_string(),
            ..CompanyProfile::default()
        })
        .expect("company profile saved");

    invoice.number
}

#[test]
fn starts_headlessly_and_forwards_commands_to_the_core() {
    let dir = temp_dir("commands");
    let database = dir.join("socdof.db");
    let number = seed(&database);
    let paths = Paths::new(database.clone());

    let mut shell = Shell::start(paths.clone()).expect("shell starts");
    let status = shell.status().expect("status");
    assert_eq!(status.schema_version, SCHEMA_VERSION);
    assert_eq!(status.contacts, 1);
    assert_eq!(status.invoices, 1);
    assert_eq!(status.lock_owner_pid, Some(std::process::id()));

    let second = Shell::start(paths.clone());
    assert!(matches!(second, Err(CoreError::Validation(code)) if code == "lock_busy"));

    let pdf = dir.join("rechnung.pdf");
    shell.export_invoice_pdf(&number, &pdf).expect("pdf export");
    let bytes = std::fs::read(&pdf).expect("pdf readable");
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(String::from_utf8_lossy(&bytes).contains("2026-0500"));

    let archive = dir.join("backup.socdofbak");
    let info = shell.backup(&archive).expect("backup");
    assert!(info.archive_bytes > 0);
    assert_eq!(info.metadata.schema_version, SCHEMA_VERSION);

    // Change the live database, then prove the restore command replaces it.
    {
        let store = Store::open(&database).expect("second connection");
        let mut extra = Contact::new(ContactKind::Person, now_millis());
        extra.first_name = Some("Extra".to_string());
        extra.last_name = Some("Kontakt".to_string());
        store.insert_contact(&extra).expect("extra contact");
    }
    assert_eq!(shell.status().expect("status").contacts, 2);

    let metadata = shell.restore(&archive).expect("restore");
    assert_eq!(metadata.schema_version, SCHEMA_VERSION);
    assert_eq!(
        shell.status().expect("status").contacts,
        1,
        "restore replaced the live database"
    );

    // The instance lock survived the restore.
    assert!(matches!(
        Shell::start(paths.clone()),
        Err(CoreError::Validation(code)) if code == "lock_busy"
    ));

    shell.shutdown();
    assert!(!paths.lock.exists(), "lock released on shutdown");

    let restarted = Shell::start(paths.clone()).expect("restart after shutdown");
    drop(restarted);
    let _ = std::fs::remove_dir_all(dir);
}
