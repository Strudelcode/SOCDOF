//! The Word package of an invoice, checked against a foreign writer.
//!
//! `writes_the_package_other_tools_open` leaves the generated file in
//! `target/docx-proof/rechnung.docx`, so `python-docx` can open it after the run.
//! `fixtures/foreign.docx` was produced by python-docx and exercises the reader with a package this
//! writer never produced.

use std::path::PathBuf;

use socdof_core::docx::{self, Block, DocxError};
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::money::Money;
use uuid::Uuid;

const FOREIGN: &[u8] = include_bytes!("fixtures/foreign.docx");

fn output_path() -> PathBuf {
    let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/docx-proof");
    std::fs::create_dir_all(&directory).expect("output directory");
    directory.join("rechnung.docx")
}

fn sample_company() -> CompanyProfile {
    CompanyProfile {
        name: "Müller & Söhne GmbH".to_string(),
        street: "Hauptstraße 5".to_string(),
        zip_city: "39100 Bozen".to_string(),
        phone: "+39 0471 123456".to_string(),
        email: "rechnung@example.com".to_string(),
        tax_id: "IT01234567890".to_string(),
        currency: "€".to_string(),
        ..CompanyProfile::default()
    }
}

fn sample_recipient() -> Contact {
    let mut contact = Contact::new(ContactKind::Company, 0);
    contact.company_name = Some("Beispiel GmbH".to_string());
    contact.street = Some("Hauptstrasse 5".to_string());
    contact.zip = Some("10115".to_string());
    contact.city = Some("Berlin".to_string());
    contact.country = Some("Deutschland".to_string());
    contact
}

fn sample() -> (Invoice, Contact, CompanyProfile) {
    let recipient = sample_recipient();
    let invoice = Invoice {
        id: Uuid::new_v4(),
        number: "2026-0001".to_string(),
        contact_id: recipient.id,
        status: InvoiceStatus::Sent,
        issued_at: 1_780_000_000_000,
        due_at: 1_782_000_000_000,
        currency_symbol: "€".to_string(),
        note: Some("Lieferung frei Haus.".to_string()),
        lines: vec![
            InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 2_500,
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
    (invoice, recipient, sample_company())
}

fn tables(document: &docx::Document) -> Vec<&docx::Table> {
    document
        .blocks
        .iter()
        .filter_map(|block| match block {
            Block::Table(table) => Some(table),
            _ => None,
        })
        .collect()
}

#[test]
fn the_document_carries_the_values_of_the_printed_invoice() {
    let (invoice, recipient, company) = sample();
    let document = docx::invoice_document(&invoice, &recipient, &company);

    assert_eq!(document.metadata.title, "Rechnung 2026-0001");
    assert_eq!(document.metadata.creator, "Müller & Söhne GmbH");
    assert!(
        document.metadata.created.starts_with("2026-05-"),
        "created: {}",
        document.metadata.created
    );

    let headings = document.headings();
    assert_eq!(headings.len(), 2);
    assert_eq!(headings[0], (1, "Rechnung Nr. 2026-0001".to_string()));
    assert_eq!(headings[1], (2, "Positionen".to_string()));

    let text = document.plain_text();
    for expected in [
        "Beispiel GmbH",
        "Hauptstrasse 5",
        "10115 Berlin",
        "Deutschland",
        "Rechnungsnummer: 2026-0001",
        "Rechnungsdatum: 28.05.2026",
        "Fällig am: 21.06.2026",
        "Lieferung frei Haus.",
        "Bitte überweisen Sie den Gesamtbetrag bis zum 21.06.2026.",
        "Müller & Söhne GmbH · Hauptstraße 5 · 39100 Bozen",
        "Steuernummer: IT01234567890",
    ] {
        assert!(text.contains(expected), "missing {expected} in:\n{text}");
    }

    let tables = tables(&document);
    assert_eq!(tables.len(), 2, "positions and totals");
    let positions = tables[0];
    assert_eq!(positions.rows.len(), 3);
    assert_eq!(positions.cell(0, 0), "Pos.");
    assert_eq!(positions.cell(0, 4), "Betrag");
    assert_eq!(positions.cell(1, 0), "1");
    assert_eq!(positions.cell(1, 1), "Beratung");
    assert_eq!(positions.cell(1, 2), "2,5");
    assert_eq!(positions.cell(1, 3), "80,00 €");
    assert_eq!(positions.cell(1, 4), "200,00 €");
    assert_eq!(positions.cell(2, 2), "1");
    assert_eq!(positions.cell(2, 4), "12,50 €");

    let totals = tables[1];
    assert_eq!(totals.cell(0, 0), "Netto");
    assert_eq!(totals.cell(0, 1), "212,50 €");
    assert_eq!(totals.cell(1, 0), "Umsatzsteuer");
    assert_eq!(totals.cell(1, 1), "38,88 €");
    assert_eq!(totals.cell(2, 0), "Gesamtbetrag");
    assert_eq!(totals.cell(2, 1), "251,38 €");
    assert!(
        totals.rows[2].cells[1][0][0].bold,
        "the gross total is emphasised"
    );
}

#[test]
fn writes_the_package_other_tools_open() {
    let (invoice, recipient, company) = sample();
    let bytes = docx::invoice_docx_bytes(&invoice, &recipient, &company).expect("package");
    std::fs::write(output_path(), &bytes).expect("write proof");

    // The package is a ZIP with the parts Word asks for and a body that starts with XML.
    assert_eq!(&bytes[..2], b"PK");
    let document = docx::read_docx(&bytes).expect("reads its own package");
    assert!(!document.blocks.is_empty());
}

#[test]
fn the_round_trip_keeps_the_document() {
    let (invoice, recipient, company) = sample();
    let written = docx::invoice_document(&invoice, &recipient, &company);
    let bytes = docx::invoice_docx_bytes(&invoice, &recipient, &company).expect("package");
    let read = docx::read_docx(&bytes).expect("reads back");
    assert_eq!(read.metadata, written.metadata);
    assert_eq!(read.blocks, written.blocks);
}

#[test]
fn reads_a_package_written_by_python_docx() {
    let document = docx::read_docx(FOREIGN).expect("reads the foreign package");
    assert_eq!(document.metadata.title, "Vorlage 2026-0042");
    assert_eq!(document.metadata.creator, "Beispiel GmbH");
    assert_eq!(
        document.headings(),
        vec![
            (1, "Rechnung 2026-0042".to_string()),
            (2, "Positionen".to_string())
        ]
    );

    let runs: Vec<&docx::Run> = document
        .blocks
        .iter()
        .filter_map(|block| match block {
            Block::Paragraph { runs } => Some(runs),
            _ => None,
        })
        .flatten()
        .collect();
    let bold: Vec<&str> = runs
        .iter()
        .filter(|run| run.bold)
        .map(|run| run.text.as_str())
        .collect();
    assert_eq!(bold, vec!["Kunde: "]);

    let table = document.first_table().expect("the foreign table");
    assert_eq!(table.rows.len(), 3);
    assert_eq!(table.columns(), 3);
    assert_eq!(table.cell(0, 0), "Pos.");
    assert_eq!(table.cell(1, 1), "Beratung");
    assert_eq!(table.cell(2, 2), "12,50 €");

    assert!(
        document.blocks.contains(&Block::PageBreak),
        "the page break of the foreign file is kept"
    );
    assert!(
        document.plain_text().contains("Fußzeile · Beispiel GmbH"),
        "{}",
        document.plain_text()
    );
}

#[test]
fn a_long_invoice_keeps_every_position() {
    let (mut invoice, recipient, company) = sample();
    invoice.lines = (1..=60)
        .map(|index| InvoiceLine {
            description: format!("Posten {index}"),
            quantity_milli: 1_000,
            unit_price: Money::from_cents(100),
            tax_rate_bp: 1900,
        })
        .collect();
    let bytes = docx::invoice_docx_bytes(&invoice, &recipient, &company).expect("package");
    let document = docx::read_docx(&bytes).expect("reads");
    let positions = tables(&document)[0];
    assert_eq!(positions.rows.len(), 61, "one header plus sixty positions");
    assert_eq!(positions.cell(60, 1), "Posten 60");
}

#[test]
fn broken_input_is_a_typed_error() {
    assert_eq!(docx::read_docx(b""), Err(DocxError::NotAPackage));
    assert_eq!(
        docx::read_docx(b"das ist keine Word-Datei"),
        Err(DocxError::NotAPackage)
    );

    let without_document = {
        let mut bytes =
            docx::invoice_docx_bytes(&sample().0, &sample().1, &sample().2).expect("package");
        bytes.truncate(bytes.len() / 2);
        bytes
    };
    assert!(docx::read_docx(&without_document).is_err());
    assert!(!DocxError::NotAPackage.to_string().is_empty());
}
