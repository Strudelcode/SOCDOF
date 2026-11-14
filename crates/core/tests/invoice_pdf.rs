//! End-to-end check of the public invoice PDF API.
//!
//! The generated file stays in `target/pdf-proof/rechnung.pdf` so it can be opened and inspected
//! after a test run.

use std::path::PathBuf;

use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::money::Money;
use socdof_core::pdf::din5008::write_invoice_pdf;
use uuid::Uuid;

fn output_path() -> PathBuf {
    let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/pdf-proof");
    std::fs::create_dir_all(&directory).expect("output directory");
    directory.join("rechnung.pdf")
}

fn sample_company() -> CompanyProfile {
    CompanyProfile {
        name: "Müller & Söhne GmbH".to_string(),
        street: "Hauptstraße 5".to_string(),
        zip_city: "39100 Bozen".to_string(),
        phone: "+39 0471 123456".to_string(),
        email: "rechnung@example.com".to_string(),
        tax_id: "IT01234567890".to_string(),
        ..CompanyProfile::default()
    }
}

fn sample_recipient() -> Contact {
    let mut contact = Contact::new(ContactKind::Company, 0);
    contact.company_name = Some("Beispiel GmbH".to_string());
    contact.street = Some("Hauptstrasse 5".to_string());
    contact.zip = Some("10115".to_string());
    contact.city = Some("Berlin".to_string());
    contact
}

fn sample_invoice() -> Invoice {
    Invoice {
        id: Uuid::new_v4(),
        number: "2026-0001".to_string(),
        contact_id: Uuid::new_v4(),
        status: InvoiceStatus::Sent,
        issued_at: 1_760_000_000_000,
        due_at: 1_762_000_000_000,
        currency_symbol: "€".to_string(),
        note: None,
        tax_total_override_cents: None,
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
                tax_rate_bp: 1900,
            },
        ],
    }
}

#[test]
fn writes_a_din5008_invoice_pdf_file() {
    let path = output_path();
    write_invoice_pdf(
        &path,
        &sample_invoice(),
        &sample_recipient(),
        &sample_company(),
    )
    .expect("pdf written");

    let bytes = std::fs::read(&path).expect("pdf readable");
    assert!(bytes.len() > 1_000, "pdf should not be empty");
    assert_eq!(&bytes[..8], b"%PDF-1.4");
    assert!(bytes.windows(5).any(|window| window == b"%%EOF"));

    let text = String::from_utf8(bytes.clone()).expect("pdf is ascii");
    assert!(text.contains("Rechnung Nr. 2026-0001"));
    assert!(text.contains("Beispiel GmbH"));
    assert!(text.contains("10115 Berlin"));
    assert!(text.contains("132,50"));
    assert!(text.contains("157,68"));

    let start = text.rfind("startxref").expect("startxref present");
    let offset: usize = text[start + "startxref".len()..]
        .split_whitespace()
        .next()
        .expect("offset")
        .parse()
        .expect("number");
    assert_eq!(&text[offset..offset + 4], "xref");

    println!("invoice pdf written to {}", path.display());
}
