//! End-to-end proof for the invoice webview commands of the desktop window.
//!
//! The webview creates, lists, edits and exports invoices only through [`DesktopState`], exactly
//! like the Tauri commands do. These tests use the real store, the real validators, the real
//! templates and the real PDF/DOCX writers, so a field that the bridge drops or ignores fails here.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{ContactInput, DesktopState};
use socdof_app::invoice_bridge::{FatturaInput, InvoiceInput, InvoiceItemInput};
use socdof_app::template_bridge::{InvoiceTemplateBookView, InvoiceTemplateView};
use socdof_core::date;
use socdof_core::docx;
use socdof_core::error::CoreError;
use socdof_core::invoice_template::{
    default_template, new_stationery_token, template_asset_from_bytes, TemplateAssetKind,
};
use socdof_core::now_millis;
use uuid::Uuid;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-invoices-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn sample_png() -> Vec<u8> {
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, 8, 6);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().expect("png header");
        writer
            .write_image_data(&[220u8; 8 * 6 * 3])
            .expect("png data");
    }
    bytes
}

fn contact_input(name: &str, city: &str) -> ContactInput {
    ContactInput {
        name: name.to_string(),
        company: name.to_string(),
        is_company: true,
        contact_type: "customer".to_string(),
        street: "Hauptstrasse 5".to_string(),
        zip: "10115".to_string(),
        city: city.to_string(),
        country: "Deutschland".to_string(),
        email: "kunde@example.invalid".to_string(),
        ..ContactInput::default()
    }
}

fn invoice_input(contact_id: Uuid) -> InvoiceInput {
    InvoiceInput {
        id: None,
        number: "2026-0001".to_string(),
        contact_id,
        status: "draft".to_string(),
        date: "2026-11-01".to_string(),
        due_date: "2026-11-15".to_string(),
        currency_symbol: String::new(),
        notes: "Vielen Dank fuer den Auftrag.".to_string(),
        items: vec![
            InvoiceItemInput {
                description: "Beratung".to_string(),
                quantity_milli: 2_500,
                unit_price_cents: 8_000,
                tax_rate_bp: 1_900,
            },
            InvoiceItemInput {
                description: "Material".to_string(),
                quantity_milli: 1_000,
                unit_price_cents: 1_250,
                tax_rate_bp: 700,
            },
        ],
    }
}

/// The template book in the webview format: an active and a second template with distinct titles.
fn template_book() -> InvoiceTemplateBookView {
    let stationery = template_asset_from_bytes(
        TemplateAssetKind::Stationery,
        "briefpapier.png",
        &sample_png(),
    )
    .expect("stationery asset");

    let mut active = InvoiceTemplateView::from_template(&default_template());
    active.id = "active_template".to_string();
    active.name = "Aktive Vorlage".to_string();
    active.header_title = "Honorar".to_string();
    active.primary_color = "#123456".to_string();
    active.company_website = "www.bridge-proof.example".to_string();
    active.stationery_mode = true;
    active.stationery_image_url = stationery.data_url;
    active.stationery_tokens = vec![new_stationery_token("tok_site", "{Firma_Website}")];

    let mut second = active.clone();
    second.id = "second_template".to_string();
    second.name = "Zweite Vorlage".to_string();
    second.header_title = "Zweite Rechnung".to_string();
    second.primary_color = "#654321".to_string();

    InvoiceTemplateBookView {
        templates: vec![active, second],
        active_id: "active_template".to_string(),
    }
}

#[test]
fn creates_lists_searches_and_filters_invoices() {
    let dir = temp_dir("list");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");

    // Defaults of a new invoice: number of the current year, currency and template term.
    let defaults = state.invoice_defaults().expect("defaults");
    let (year, _, _) = date::civil_from_millis(now_millis());
    assert_eq!(defaults.number, format!("{year}-0001"));
    assert!(!defaults.currency_symbol.trim().is_empty());
    assert!(defaults.due_days >= 0);

    let saved = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    assert_eq!(saved.number, "2026-0001");
    assert_eq!(saved.contact_name, "Beispiel GmbH");
    assert_eq!(saved.contact_company, "Beispiel GmbH");
    assert_eq!(saved.status, "draft");
    assert_eq!(saved.date, "2026-11-01");
    assert_eq!(saved.due_date, "2026-11-15");
    assert_eq!(saved.payment_terms, 14);
    assert_eq!(saved.notes, "Vielen Dank fuer den Auftrag.");
    assert_eq!(saved.items.len(), 2);
    assert_eq!(saved.items[0].net_cents, 20_000);
    assert_eq!(saved.items[0].tax_cents, 3_800);
    assert_eq!(saved.items[1].net_cents, 1_250);
    assert_eq!(saved.subtotal_cents, 21_250);
    assert_eq!(saved.tax_total_cents, 3_888);
    assert_eq!(saved.total_cents, 25_138);

    // The list carries the same values and the search uses the real FTS index.
    let all = state.invoice_views(None, None).expect("list");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].total_cents, 25_138);
    assert_eq!(
        state
            .invoice_views(Some("Beratung"), None)
            .expect("search")
            .len(),
        1
    );
    assert_eq!(
        state
            .invoice_views(Some("Beispiel GmbH"), None)
            .expect("contact search")
            .len(),
        1
    );
    assert_eq!(
        state
            .invoice_views(None, Some("draft"))
            .expect("draft filter")
            .len(),
        1
    );
    assert!(state
        .invoice_views(None, Some("paid"))
        .expect("paid filter")
        .is_empty());
    // `posted` is the TypeScript name of the stored `sent` state.
    assert!(state
        .invoice_views(None, Some("posted"))
        .expect("posted filter")
        .is_empty());
    assert!(matches!(
        state.invoice_views(None, Some("unknown")),
        Err(CoreError::Validation(code)) if code == "invoice_status_invalid"
    ));

    let detail = state.invoice(saved.id).expect("detail");
    assert_eq!(detail, saved);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn updates_positions_status_and_dates() {
    let dir = temp_dir("update");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");
    let saved = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    let mut changed = invoice_input(contact.id);
    changed.id = Some(saved.id);
    changed.number = "2026-0002".to_string();
    changed.status = "posted".to_string();
    changed.due_date = "2026-11-22".to_string();
    changed.notes = "Geaenderte Notiz".to_string();
    changed.items = vec![InvoiceItemInput {
        description: "Montage".to_string(),
        quantity_milli: 3_000,
        unit_price_cents: 4_500,
        tax_rate_bp: 1_900,
    }];
    let updated = state.save_invoice(&changed).expect("invoice updates");

    assert_eq!(updated.id, saved.id);
    assert_eq!(updated.number, "2026-0002");
    assert_eq!(updated.status, "sent");
    assert_eq!(updated.notes, "Geaenderte Notiz");
    assert_eq!(updated.payment_terms, 21);
    assert_eq!(updated.items.len(), 1);
    assert_eq!(updated.subtotal_cents, 13_500);
    assert_eq!(updated.total_cents, 16_065);
    assert_eq!(state.invoice(saved.id).expect("reload"), updated);

    let paid = state.set_invoice_status(saved.id, "paid").expect("paid");
    assert_eq!(paid.status, "paid");
    assert!(matches!(
        state.set_invoice_status(saved.id, "nope"),
        Err(CoreError::Validation(code)) if code == "invoice_status_invalid"
    ));

    state.delete_invoice(saved.id).expect("delete");
    assert!(matches!(
        state.invoice(saved.id),
        Err(CoreError::NotFound(_))
    ));
    assert!(state.invoice_views(None, None).expect("list").is_empty());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn rejects_invalid_input_and_keeps_the_stored_invoice() {
    let dir = temp_dir("validation");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");
    let saved = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    let mut invalid = invoice_input(contact.id);
    invalid.id = Some(saved.id);
    invalid.items.clear();
    assert!(matches!(
        state.save_invoice(&invalid),
        Err(CoreError::Validation(code)) if code == "lines_required"
    ));

    let mut invalid = invoice_input(contact.id);
    invalid.id = Some(saved.id);
    invalid.date = "01.11.2026".to_string();
    assert!(matches!(
        state.save_invoice(&invalid),
        Err(CoreError::Validation(code)) if code == "invoice_date_invalid"
    ));

    let mut invalid = invoice_input(contact.id);
    invalid.id = Some(saved.id);
    invalid.due_date = "2026-10-01".to_string();
    assert!(matches!(
        state.save_invoice(&invalid),
        Err(CoreError::Validation(code)) if code == "invoice_due_before_issued"
    ));

    let invalid = invoice_input(Uuid::new_v4());
    assert!(matches!(
        state.save_invoice(&invalid),
        Err(CoreError::Validation(code)) if code == "invoice_contact_required"
    ));

    // Missing fields fall back to the editor defaults and fail the domain rules, not the parser.
    let partial: InvoiceInput = serde_json::from_value(serde_json::json!({
        "number": "2026-0009",
        "contact_id": contact.id,
        "date": "2026-11-01",
        "due_date": "2026-11-15"
    }))
    .expect("partial payload parses");
    assert_eq!(partial.status, "draft");
    assert!(matches!(
        state.save_invoice(&partial),
        Err(CoreError::Validation(code)) if code == "lines_required"
    ));

    // Unknown fields are rejected instead of being ignored silently.
    let unknown = serde_json::from_value::<InvoiceInput>(serde_json::json!({
        "number": "2026-0001",
        "contact_id": contact.id,
        "status": "draft",
        "date": "2026-11-01",
        "due_date": "2026-11-15",
        "items": [],
        "discount": 10
    }));
    assert!(unknown.is_err());

    // Nothing above touched the stored invoice.
    let stored = state.invoice(saved.id).expect("stored invoice");
    assert_eq!(stored, saved);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn preview_and_exports_carry_every_field_with_the_selected_template() {
    let dir = temp_dir("export");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");
    state
        .save_invoice_template_book(&template_book())
        .expect("template book");
    let saved = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    // The active template is the default of the preview and has the resolved token.
    let preview = state.invoice_preview(saved.id, None).expect("preview");
    assert_eq!(preview.template_id, "active_template");
    assert_eq!(preview.template_name, "Aktive Vorlage");
    assert_eq!(preview.invoice, saved);
    assert!(preview.stationery_mode);
    assert!(preview
        .stationery_source
        .starts_with("data:image/png;base64,"));
    assert_eq!(preview.tokens.len(), 1);
    assert_eq!(preview.tokens[0].text, "www.bridge-proof.example");
    for needle in [
        "2026-0001",
        "Beispiel GmbH",
        "Beratung",
        "Material",
        "Vielen Dank fuer den Auftrag.",
        "#123456",
    ] {
        assert!(
            preview.html.contains(needle),
            "missing {needle} in preview HTML: {}",
            preview.html
        );
    }

    // A different template changes the preview without touching the invoice.
    let second = state
        .invoice_preview(saved.id, Some("second_template"))
        .expect("second preview");
    assert_eq!(second.template_name, "Zweite Vorlage");
    assert!(second.html.contains("Zweite Rechnung"));
    assert!(second.html.contains("#654321"));
    assert!(!second.html.contains("#123456"));
    assert_eq!(state.invoice(saved.id).expect("invoice unchanged"), saved);

    // PDF with the selected template: all values, the accent, the stationery image and the token.
    let pdf_path = dir.join("rechnung.pdf");
    let pdf = state
        .export_invoice(
            saved.id,
            Some("second_template"),
            "pdf",
            Some(pdf_path.as_path()),
        )
        .expect("pdf export");
    assert_eq!(pdf.format, "pdf");
    assert_eq!(pdf.path, pdf_path);
    assert!(pdf.bytes > 0);
    let pdf_bytes = std::fs::read(&pdf_path).expect("pdf file");
    let pdf_text = String::from_utf8_lossy(&pdf_bytes);
    for needle in [
        "2026-0001",
        "Beispiel GmbH",
        "Beratung",
        "Zweite Rechnung",
        "www.bridge-proof.example",
    ] {
        assert!(pdf_text.contains(needle), "missing {needle} in PDF");
    }
    assert!(
        pdf_text.contains("/Subtype /Image"),
        "the stationery image is missing from the PDF"
    );

    // DOCX with the same template: body values and the stationery token in the header.
    let docx_path = dir.join("rechnung.docx");
    let docx_report = state
        .export_invoice(
            saved.id,
            Some("second_template"),
            "docx",
            Some(docx_path.as_path()),
        )
        .expect("docx export");
    assert_eq!(docx_report.format, "docx");
    assert!(docx_report.bytes > 0);
    let docx_bytes = std::fs::read(&docx_path).expect("docx file");
    let document = docx::read_docx(&docx_bytes).expect("docx reads back");
    let text = document.plain_text();
    for needle in ["2026-0001", "Beispiel GmbH", "Beratung", "Zweite Rechnung"] {
        assert!(text.contains(needle), "missing {needle} in DOCX: {text}");
    }
    let header = docx::read_part(&docx_bytes, "word/header1.xml")
        .expect("read header")
        .expect("first-page header with the stationery token");
    let header = String::from_utf8(header).expect("utf-8 header");
    assert!(
        header.contains("www.bridge-proof.example"),
        "the stationery token is missing from the DOCX header"
    );

    // Without a path the export lands next to the database, like the backup command does.
    let default_report = state
        .export_invoice(saved.id, None, "pdf", None)
        .expect("default export");
    assert!(default_report.path.exists());
    assert!(default_report.path.starts_with(dir.join("exports")));

    // Unknown formats and templates fall back to the active template only for lookup errors.
    assert!(matches!(
        state.export_invoice(saved.id, None, "xlsx", None),
        Err(CoreError::Validation(code)) if code == "invoice_export_format_invalid"
    ));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn dunning_mail_and_payment_close_the_webview_gap() {
    let dir = temp_dir("actions");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");
    let invoice = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    let reminder = state
        .invoice_dunning(invoice.id, "reminder", None, None)
        .expect("reminder");
    assert_eq!(reminder.level, "reminder");
    assert_eq!(reminder.level_number, 1);
    assert_eq!(reminder.total_cents, invoice.total_cents);
    assert!(reminder.eml.contains(&invoice.number));
    assert!(reminder.file_name.ends_with(".eml"));

    let last = state
        .invoice_dunning(invoice.id, "last", Some(900), Some(10))
        .expect("last notice");
    assert_eq!(last.level_number, 3);
    assert_eq!(last.fee_cents, 900);
    assert_eq!(last.days, 10);
    assert_eq!(
        last.claim_cents,
        last.total_cents + last.fee_cents + last.interest_cents
    );
    assert!(state
        .invoice_dunning(invoice.id, "bogus", None, None)
        .is_err());

    let mail = state.invoice_mail(invoice.id).expect("mail draft");
    assert!(mail.eml.contains(&invoice.number));
    assert!(mail.eml.starts_with("From:"));
    assert!(mail.file_name.ends_with(".eml"));
    assert!(mail.mailto.starts_with("mailto:"));

    let payment = state
        .record_invoice_payment(invoice.id, "transfer", Some("R-42"), None)
        .expect("payment");
    assert_eq!(payment.method, "transfer");
    assert!(payment.reference.contains("R-42"));
    assert_eq!(state.invoice(invoice.id).expect("detail").status, "paid");
    assert_eq!(
        state
            .invoice_payment(invoice.id)
            .expect("stored payment")
            .expect("payment exists")
            .reference,
        payment.reference
    );
    assert!(state
        .record_invoice_payment(invoice.id, "bogus", None, None)
        .is_err());
}

#[test]
fn contact_mail_and_fattura_are_generated() {
    let dir = temp_dir("mail-fattura");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");
    let contact = state
        .create_contact(&contact_input("Beispiel GmbH", "Berlin"))
        .expect("contact");
    let invoice = state
        .save_invoice(&invoice_input(contact.id))
        .expect("invoice saves");

    let mail = state.contact_mail(contact.id).expect("contact mail");
    assert!(mail.eml.starts_with("From:"));
    assert!(mail.eml.contains("X-Unsent: 1"));
    assert!(mail.eml.contains("Date: "));
    assert!(mail.file_name.starts_with("EML_Entwurf_"));
    assert!(mail.subject.contains("Beispiel GmbH"));
    assert!(mail.mailto.starts_with("mailto:"));

    let edited = state
        .contact_eml(
            contact.id,
            "Frau Müller",
            "muster@example.de",
            "Betreff mit Ümlaut",
            "Zeile 1\nZeile 2",
        )
        .expect("contact eml");
    assert!(edited.starts_with("From: "));
    assert!(edited.contains("To: \"=?UTF-8?B?"));
    assert!(edited.contains("Subject: =?UTF-8?B?"));
    assert!(edited.contains("Zeile 1\nZeile 2"));

    let fattura = state
        .invoice_fattura(invoice.id, &FatturaInput::default())
        .expect("fattura");
    assert!(fattura.valid, "errors: {:?}", fattura.errors);
    assert!(fattura.xml.contains("<p:FatturaElettronica"));
    assert!(fattura.xml.contains("<CedentePrestatore>"));
    assert!(fattura.xml.contains("<CessionarioCommittente>"));
    assert!(fattura.xml.contains("<DettaglioLinee>"));
    assert_eq!(fattura.total_cents, invoice.total_cents);
    assert!(fattura.file_name.starts_with("IT"));
    assert!(fattura.file_name.ends_with(".xml"));

    let credit = state
        .invoice_fattura(
            invoice.id,
            &FatturaInput {
                document_type: "TD04".to_string(),
                recipient_code: "ABCDEF".to_string(),
                pec: "pa@example.it".to_string(),
                bollo: true,
                ..FatturaInput::default()
            },
        )
        .expect("credit note");
    assert!(credit.valid);
    assert!(credit.xml.contains("<TipoDocumento>TD04</TipoDocumento>"));
    assert!(credit
        .xml
        .contains("<FormatoTrasmissione>FPA12</FormatoTrasmissione>"));
    assert!(credit.xml.contains("<BolloVirtuale>SI</BolloVirtuale>"));
}
