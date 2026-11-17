#![recursion_limit = "256"]

//! End-to-end proof for the TypeScript template bridge of the desktop window.
//!
//! The webview talks to [`DesktopState`] through `socdof_app::template_bridge`, which is the only
//! place that knows the TypeScript field names. These tests use the real stored book, the real
//! validators, the real PDF writer and the real DOCX package, so a field that the bridge drops or
//! ignores fails here instead of disappearing from the printed invoice.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::DesktopState;
use socdof_app::template_bridge::{InvoiceTemplateBookView, InvoiceTemplateView};
use socdof_core::docx;
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::error::CoreError;
use socdof_core::invoice_template::{
    default_template, template_asset_from_bytes, TemplateAssetKind, TemplateBook, TemplateCompany,
};
use socdof_core::money::Money;
use socdof_core::pdf::din5008;
use uuid::Uuid;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-bridge-{tag}-{}-{}",
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

fn sample() -> (Invoice, Contact, CompanyProfile) {
    let mut contact = Contact::new(ContactKind::Company, 0);
    contact.company_name = Some("Beispiel GmbH".to_string());
    contact.street = Some("Hauptstrasse 5".to_string());
    contact.zip = Some("10115".to_string());
    contact.city = Some("Berlin".to_string());
    let invoice = Invoice {
        id: Uuid::new_v4(),
        number: "2026-0001".to_string(),
        contact_id: contact.id,
        status: InvoiceStatus::Sent,
        issued_at: 1_780_000_000_000,
        due_at: 1_782_000_000_000,
        currency_symbol: "€".to_string(),
        note: None,
        tax_total_override_cents: None,
        lines: vec![InvoiceLine {
            description: "Beratung".to_string(),
            quantity_milli: 2_000,
            unit_price: Money::from_cents(8_000),
            tax_rate_bp: 1900,
        }],
    };
    let company = CompanyProfile {
        name: "Profil GmbH".to_string(),
        street: "Profilweg 1".to_string(),
        zip_city: "39100 Bozen".to_string(),
        phone: "+39 0471 123456".to_string(),
        email: "profil@example.invalid".to_string(),
        tax_id: "IT01234567890".to_string(),
        currency: "€".to_string(),
        ..CompanyProfile::default()
    };
    (invoice, contact, company)
}

/// A complete template in the exact shape `invoiceTemplateManager.ts` stores it.
fn typescript_template() -> serde_json::Value {
    serde_json::json!({
        "id": "ts_template",
        "name": "TS Vorlage",
        "description": "Aus TypeScript exportiert",
        "presetType": "corporate",
        "isDefault": true,
        "logoUrl": "data:image/png;base64,iVBORw0KGgo=",
        "showLogo": false,
        "logoPosition": "center",
        "companyName": "Vorlagen GmbH",
        "companySubtitle": "Handel & Dienstleistung",
        "companyOwner": "Erika Muster",
        "companyAddress": "Musterstrasse 7",
        "companyZipCity": "10115 Berlin",
        "companyPhone": "+49 30 1234567",
        "companyEmail": "team@example.invalid",
        "companyWebsite": "www.vorlagen.example",
        "companyTaxId": "12/345/678",
        "companyVatId": "DE123456789",
        "companyBankName": "Musterbank",
        "companyIban": "DE02120300000000202051",
        "companyBic": "BYLADEM1001",
        "companyCommercialRegister": "Amtsgericht Berlin HRB 123",
        "primaryColor": "#0f172a",
        "fontFamily": "serif",
        "headerTitle": "Honorar",
        "headerText": "Einleitung aus der Vorlage",
        "footerText": "Zahlbar bis {Faelligkeitsdatum}.",
        "taxNote": "Steuerhinweis der Vorlage",
        "dueDays": 21,
        "useCustomLayout": true,
        "customBodyTemplate": "<p>Fuer {Kunde_Name}</p>",
        "showFoldMarks": false,
        "stationeryMode": true,
        "stationeryPdfUrl": "data:application/pdf;base64,JVBERi0=",
        "stationeryImageUrl": "data:image/png;base64,iVBORw0KGgo=",
        "stationeryTokens": [{
            "id": "tok_name",
            "tokenKey": "{Kunde_Name}",
            "xPct": 12.5,
            "yPct": 20.0,
            "widthPct": 40.0,
            "fontSize": 14.0,
            "fontWeight": "bold",
            "color": "#ff0000",
            "align": "right"
        }],
        "createdAt": "2026-11-10T10:00:00.000Z"
    })
}

#[test]
fn typescript_payload_reaches_every_core_field() {
    let payload = serde_json::json!({
        "templates": [typescript_template()],
        "activeId": "ts_template"
    });
    let view: InvoiceTemplateBookView = serde_json::from_value(payload).expect("TS payload parses");
    let book = view.to_book();
    book.validate().expect("TS payload is valid");

    let template = &book.templates[0];
    assert_eq!(template.id, "ts_template");
    assert_eq!(template.name, "TS Vorlage");
    assert_eq!(template.description, "Aus TypeScript exportiert");
    assert_eq!(template.preset_type, "corporate");
    assert!(template.is_default);
    assert_eq!(template.logo, "data:image/png;base64,iVBORw0KGgo=");
    assert!(!template.show_logo);
    assert_eq!(template.logo_position, "center");
    assert_eq!(template.company.name, "Vorlagen GmbH");
    assert_eq!(template.company.subtitle, "Handel & Dienstleistung");
    assert_eq!(template.company.owner, "Erika Muster");
    assert_eq!(template.company.street, "Musterstrasse 7");
    assert_eq!(template.company.zip_city, "10115 Berlin");
    assert_eq!(template.company.phone, "+49 30 1234567");
    assert_eq!(template.company.email, "team@example.invalid");
    assert_eq!(template.company.website, "www.vorlagen.example");
    assert_eq!(template.company.tax_id, "12/345/678");
    assert_eq!(template.company.vat_id, "DE123456789");
    assert_eq!(template.company.bank_name, "Musterbank");
    assert_eq!(template.company.iban, "DE02120300000000202051");
    assert_eq!(template.company.bic, "BYLADEM1001");
    assert_eq!(
        template.company.commercial_register,
        "Amtsgericht Berlin HRB 123"
    );
    assert_eq!(template.primary_color, "#0f172a");
    assert_eq!(template.font_family, "serif");
    assert_eq!(template.header_title, "Honorar");
    assert_eq!(template.header_text, "Einleitung aus der Vorlage");
    assert_eq!(template.footer_text, "Zahlbar bis {Faelligkeitsdatum}.");
    assert_eq!(template.tax_note, "Steuerhinweis der Vorlage");
    assert_eq!(template.due_days, 21);
    assert!(template.use_custom_layout);
    assert_eq!(template.custom_body_template, "<p>Fuer {Kunde_Name}</p>");
    assert!(!template.show_fold_marks);
    assert!(template.stationery_mode);
    // The TypeScript renderer paints `stationeryImageUrl || stationeryPdfUrl`.
    assert_eq!(
        template.stationery_source,
        "data:image/png;base64,iVBORw0KGgo="
    );
    assert_eq!(template.stationery_tokens.len(), 1);
    let token = &template.stationery_tokens[0];
    assert_eq!(token.token_key, "{Kunde_Name}");
    assert_eq!(token.x_pct, 12.5);
    assert_eq!(token.y_pct, 20.0);
    assert_eq!(token.width_pct, Some(40.0));
    assert_eq!(token.font_size, Some(14.0));
    assert_eq!(token.font_weight, "bold");
    assert_eq!(token.color, "#ff0000");
    assert_eq!(token.align, "right");
    assert_eq!(template.created_at, "2026-11-10T10:00:00.000Z");
}

#[test]
fn serialized_book_uses_typescript_names_and_token_names() {
    let mut book = TemplateBook::default();
    book.templates[0].stationery_mode = true;
    book.templates[0].stationery_source = "/tmp/briefpapier.pdf".to_string();
    book.templates[0].stationery_tokens =
        vec![socdof_core::invoice_template::new_stationery_token(
            "tok",
            "{Kunde_Name}",
        )];

    let view = InvoiceTemplateBookView::from_book(&book);
    let value = serde_json::to_value(&view).expect("view serializes");
    let template = &value["templates"][0];
    assert!(
        value.get("activeId").is_some(),
        "missing book field activeId"
    );
    for key in [
        "presetType",
        "isDefault",
        "logoUrl",
        "showLogo",
        "logoPosition",
        "companyName",
        "companySubtitle",
        "companyOwner",
        "companyAddress",
        "companyZipCity",
        "companyPhone",
        "companyEmail",
        "companyWebsite",
        "companyTaxId",
        "companyVatId",
        "companyBankName",
        "companyIban",
        "companyBic",
        "companyCommercialRegister",
        "primaryColor",
        "fontFamily",
        "headerTitle",
        "headerText",
        "footerText",
        "taxNote",
        "dueDays",
        "useCustomLayout",
        "customBodyTemplate",
        "showFoldMarks",
        "stationeryMode",
        "stationeryPdfUrl",
        "stationeryImageUrl",
        "stationeryTokens",
        "createdAt",
    ] {
        assert!(
            template.get(key).is_some(),
            "missing TypeScript field {key}"
        );
    }
    for key in [
        "header_title",
        "company_address",
        "logo",
        "stationery_source",
        "stationerySource",
        "fontFamily",
        "company",
    ] {
        if key == "fontFamily" {
            continue;
        }
        assert!(
            template.get(key).is_none(),
            "core-only field leaked to the webview: {key}"
        );
    }
    assert_eq!(
        value["templates"][0]["stationeryPdfUrl"],
        "/tmp/briefpapier.pdf"
    );
    assert_eq!(value["templates"][0]["stationeryImageUrl"], "");
    assert!(value["templates"][0]["stationeryTokens"][0]
        .get("tokenKey")
        .is_some());
}

#[test]
fn bridge_roundtrip_preserves_every_field() {
    let mut book = TemplateBook::default();
    book.active_id = book.templates[2].id.clone();
    book.templates[0].preset_type = "custom".to_string();
    book.templates[0].font_family = "mono".to_string();
    book.templates[0].created_at = "2026-01-01T00:00:00.000Z".to_string();
    book.templates[0].is_default = false;
    book.templates[1].is_default = true;
    book.templates[1].logo = "data:image/png;base64,AAAA".to_string();
    book.templates[1].show_logo = false;
    book.templates[1].logo_position = "left".to_string();
    book.templates[1].company = TemplateCompany {
        name: "Firma".to_string(),
        subtitle: "Zusatz".to_string(),
        owner: "Inhaber".to_string(),
        street: "Strasse 1".to_string(),
        zip_city: "12345 Stadt".to_string(),
        phone: "0123".to_string(),
        email: "mail@example.invalid".to_string(),
        website: "www.example.invalid".to_string(),
        tax_id: "ST-1".to_string(),
        vat_id: "DE1".to_string(),
        bank_name: "Bank".to_string(),
        iban: "DE00".to_string(),
        bic: "BIC".to_string(),
        commercial_register: "HRB 1".to_string(),
    };
    book.templates[1].stationery_mode = true;
    book.templates[1].stationery_source = "data:application/pdf;base64,JVBERi0=".to_string();
    book.templates[2].stationery_mode = true;
    book.templates[2].stationery_source = "data:image/png;base64,BBBB".to_string();
    book.templates[2].stationery_tokens =
        vec![socdof_core::invoice_template::new_stationery_token(
            "tok",
            "{Firma_Name}",
        )];

    let view = InvoiceTemplateBookView::from_book(&book);
    let json = serde_json::to_string(&view).expect("view serializes");
    let parsed: InvoiceTemplateBookView = serde_json::from_str(&json).expect("view parses");
    assert_eq!(parsed.to_book(), book);
    // The PDF source survives under `stationeryPdfUrl`, the image source under
    // `stationeryImageUrl`, and both come back as the one core source.
    assert_eq!(
        parsed.templates[1].stationery_pdf_url,
        book.templates[1].stationery_source
    );
    assert_eq!(parsed.templates[1].stationery_image_url, "");
    assert_eq!(
        parsed.templates[2].stationery_image_url,
        book.templates[2].stationery_source
    );
    assert_eq!(parsed.templates[2].stationery_pdf_url, "");

    // A template assembled only from the wire fields is byte-identical to the core one.
    let rebuilt = InvoiceTemplateView::from_template(&book.templates[1]).to_template();
    assert_eq!(rebuilt, book.templates[1]);
}

#[test]
fn missing_fields_use_typescript_defaults_and_gaps_fail_loudly() {
    let minimal: InvoiceTemplateBookView = serde_json::from_value(serde_json::json!({
        "templates": [{ "id": "minimal", "name": "Minimal" }],
        "activeId": "minimal"
    }))
    .expect("partial payload parses");
    let template = &minimal.templates[0];
    assert_eq!(template.header_title, "Rechnung");
    assert_eq!(template.primary_color, "#2563eb");
    assert_eq!(template.font_family, "sans");
    assert_eq!(template.due_days, 14);
    assert_eq!(template.logo_position, "right");
    assert!(template.show_logo);
    assert!(template.show_fold_marks);
    assert_eq!(template.preset_type, "custom");
    assert_eq!(template.company_name, "");
    assert!(template.stationery_tokens.is_empty());
    let book = minimal.to_book();
    book.validate().expect("defaults produce a valid template");
    assert_eq!(book.templates[0].company, TemplateCompany::default());

    // A book without templates is not silently replaced by the factory templates.
    let empty: InvoiceTemplateBookView =
        serde_json::from_value(serde_json::json!({})).expect("empty payload parses");
    assert_eq!(
        empty.to_book().validate(),
        Err("template_required".to_string())
    );

    // Unknown and core-only field names are rejected, never ignored.
    for extra in ["unexpectedField", "header_title", "company_address"] {
        let mut payload = serde_json::json!({
            "templates": [{ "id": "x", "name": "X", "headerTitle": "Rechnung" }],
            "activeId": "x"
        });
        payload["templates"][0][extra] = serde_json::json!("wert");
        let error = serde_json::from_value::<InvoiceTemplateBookView>(payload)
            .expect_err("unknown field is rejected");
        assert!(
            error.to_string().contains("unknown field"),
            "{extra}: {error}"
        );
    }

    // A missing active template is reported by the core validator, not guessed.
    let missing_active: InvoiceTemplateBookView = serde_json::from_value(serde_json::json!({
        "templates": [{ "id": "x", "name": "X" }]
    }))
    .expect("payload parses");
    assert_eq!(
        missing_active.to_book().validate(),
        Err("template_active_missing".to_string())
    );
}

#[test]
fn desktop_state_stores_the_webview_book_and_rejects_invalid_ones() {
    let dir = temp_dir("store");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let mut book = state
        .invoice_template_book()
        .expect("book loads in the bridge format");
    assert_eq!(book.templates.len(), 5);
    assert_eq!(book.active_id, book.templates[0].id);

    let png = template_asset_from_bytes(
        TemplateAssetKind::Stationery,
        "briefpapier.png",
        &sample_png(),
    )
    .expect("stationery asset");
    book.templates[0].header_title = "Webview Honorar".to_string();
    book.templates[0].company_name = "Webview GmbH".to_string();
    book.templates[0].company_address = "Webweg 9".to_string();
    book.templates[0].font_family = "serif".to_string();
    book.templates[0].show_fold_marks = false;
    book.templates[0].stationery_mode = true;
    book.templates[0].stationery_image_url = png.data_url.clone();
    book.active_id = book.templates[1].id.clone();
    state
        .save_invoice_template_book(&book)
        .expect("webview book is stored");

    let reloaded = state.invoice_template_book().expect("book reloads");
    assert_eq!(reloaded, book);
    assert_eq!(reloaded.active_id, "modern_minimal");
    let core = state.invoice_templates().expect("core book reloads");
    assert_eq!(core.templates[0].header_title, "Webview Honorar");
    assert_eq!(core.templates[0].stationery_source, png.data_url);

    let mut invalid = book.clone();
    invalid.templates[0].primary_color = "not-a-color".to_string();
    assert!(matches!(
        state.save_invoice_template_book(&invalid),
        Err(CoreError::Validation(code)) if code == "template_color_invalid"
    ));
    // The rejected save leaves the stored book untouched.
    assert_eq!(state.invoice_template_book().expect("book reloads"), book);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn webview_fields_reach_html_pdf_and_docx() {
    let (invoice, contact, company) = sample();
    let stationery = template_asset_from_bytes(
        TemplateAssetKind::Stationery,
        "briefpapier.png",
        &sample_png(),
    )
    .expect("stationery asset");
    let stationery_url = stationery.data_url;

    // Exactly the values the webview form produces, in the wire format.
    let mut wire = InvoiceTemplateView::from_template(&default_template());
    wire.header_title = "Honorar".to_string();
    wire.header_text = "Einleitung aus dem Formular".to_string();
    wire.footer_text = "Zahlbar bis {Faelligkeitsdatum} unter {Rechnungsnummer}.".to_string();
    wire.tax_note = "Steuerhinweis aus dem Formular".to_string();
    wire.primary_color = "#0f172a".to_string();
    wire.font_family = "serif".to_string();
    wire.company_name = "Vorlagen GmbH".to_string();
    wire.company_address = "Musterstrasse 7".to_string();
    wire.company_zip_city = "10115 Berlin".to_string();
    wire.company_website = "www.token-proof.example".to_string();
    wire.stationery_mode = true;
    wire.stationery_image_url = stationery_url.clone();
    wire.stationery_tokens = vec![socdof_core::invoice_template::new_stationery_token(
        "tok_site",
        "{Firma_Website}",
    )];

    let template = wire.to_template();
    template.validate().expect("webview template is valid");
    assert_eq!(template.stationery_source, stationery_url);

    // The HTML renderer is the shared source of the preview and the custom-layout export.
    let html = template.render_html(&invoice, &contact, &company, "€");
    assert!(html.contains("font-family: Georgia, Cambria"), "{html}");
    for needle in [
        "Honorar",
        "Einleitung aus dem Formular",
        "Vorlagen GmbH",
        "Musterstrasse 7",
        "10115 Berlin",
        "Steuerhinweis aus dem Formular",
    ] {
        assert!(html.contains(needle), "missing {needle} in HTML");
    }
    assert!(!html.contains("{Faelligkeitsdatum}"), "{html}");
    assert!(!html.contains("{Rechnungsnummer}"), "{html}");

    // The DIN 5008 PDF prints title, introduction, footer and the company override.
    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let pdf_text = String::from_utf8_lossy(&pdf);
    for needle in [
        "Honorar",
        "Einleitung aus dem Formular",
        "Vorlagen GmbH",
        "Musterstrasse 7",
        "www.token-proof.example",
    ] {
        assert!(pdf_text.contains(needle), "missing {needle} in PDF");
    }
    assert!(
        pdf_text.contains("/Subtype /Image"),
        "the stationery image is missing from the PDF"
    );
    assert!(
        !pdf_text.contains("{Rechnungsnummer}"),
        "footer placeholder survived in the PDF"
    );

    // The DOCX package carries the same values, plus the stationery token in the header.
    let docx_bytes =
        docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
            .expect("docx package");
    let document = docx::read_docx(&docx_bytes).expect("docx reads back");
    let text = document.plain_text();
    for needle in [
        "Honorar",
        "Einleitung aus dem Formular",
        "Vorlagen GmbH",
        "Musterstrasse 7",
    ] {
        assert!(text.contains(needle), "missing {needle} in DOCX: {text}");
    }
    assert!(
        !text.contains("{Rechnungsnummer}"),
        "footer placeholder survived in the DOCX: {text}"
    );
    let header = docx::read_part(&docx_bytes, "word/header1.xml")
        .expect("read header")
        .expect("first-page header with the stationery token");
    let header = String::from_utf8(header).expect("utf-8 header");
    assert!(
        header.contains("www.token-proof.example"),
        "the stationery token is missing from the DOCX header"
    );
}
