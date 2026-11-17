//! End-to-end proof for a free HTML invoice template.
//!
//! The test writes the two real artifacts to `target/invoice-template-artifacts/` so they can be
//! opened outside the test run. The PDF embeds a PNG logo and uses an earlier PDF as stationery;
//! the DOCX is read back through the normal package reader.

use std::path::PathBuf;

use socdof_core::docx;
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::invoice_template::{
    default_template, file_to_data_url, layout_stationery_token, template_asset_from_bytes,
    StationeryToken, TemplateAssetKind,
};
use socdof_core::money::Money;
use socdof_core::pdf::din5008;
use socdof_core::pdf::writer::{mm, text_width};
use socdof_core::rich_html::{layout_container, RichBlock, DIN5008_TEXT_WIDTH_PT};
use uuid::Uuid;

fn sample_png(directory: &std::path::Path) -> PathBuf {
    std::fs::create_dir_all(directory).expect("temp dir");
    let path = directory.join("logo.png");
    let file = std::fs::File::create(&path).expect("png file");
    let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), 8, 6);
    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().expect("png header");
    writer
        .write_image_data(&[220u8; 8 * 6 * 3])
        .expect("png data");
    path
}

/// A stationery PDF containing only vector paths, with no image XObject.
fn vector_stationery_pdf() -> Vec<u8> {
    let content = "1 0 0 rg\n50 20 20 20 re f\n0 0 1 RG\n2 w\n50 20 m 70 40 l S\n";
    format!(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n\
         2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n\
         3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] \
         /Contents 4 0 R /Resources << >> >>\nendobj\n\
         4 0 obj\n<< /Length {} >>\nstream\n{content}\nendstream\nendobj\n%%EOF\n",
        content.len()
    )
    .into_bytes()
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
        lines: vec![
            InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 2_000,
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
    let company = CompanyProfile {
        name: "Müller & Söhne GmbH".to_string(),
        street: "Hauptstraße 5".to_string(),
        zip_city: "39100 Bozen".to_string(),
        phone: "+39 0471 123456".to_string(),
        email: "rechnung@example.com".to_string(),
        tax_id: "IT01234567890".to_string(),
        currency: "€".to_string(),
        ..CompanyProfile::default()
    };
    (invoice, contact, company)
}

fn stationery_token(
    token_key: &str,
    position: (f64, f64),
    width: Option<f64>,
    style: (f64, &str, &str, &str),
) -> StationeryToken {
    let (x, y) = position;
    let (font_size, weight, color, align) = style;
    StationeryToken {
        id: token_key.to_string(),
        token_key: token_key.to_string(),
        x_pct: x,
        y_pct: y,
        width_pct: width,
        font_size: Some(font_size),
        font_weight: weight.to_string(),
        color: color.to_string(),
        align: align.to_string(),
    }
}

/// The PDF text line that shows `needle`.
fn pdf_text_line<'a>(pdf: &'a str, needle: &str) -> &'a str {
    pdf.lines()
        .find(|line| line.contains(needle) && line.contains("Tj"))
        .unwrap_or_else(|| panic!("missing PDF text {needle}"))
}

/// The `x` and `y` arguments of the text matrix on a PDF text line.
fn text_matrix(line: &str) -> (f64, f64) {
    let marker = " Tm (";
    let before = &line[..line.find(marker).expect("text matrix")];
    let mut parts = before.rsplit(' ').take(3);
    let y: f64 = parts.next().expect("y").parse().expect("y number");
    let x: f64 = parts.next().expect("x").parse().expect("x number");
    (x, y)
}

#[test]
fn custom_html_produces_pdf_and_docx_with_logo_stationery_table_and_footer() {
    let (invoice, contact, company) = sample();
    let directory = std::env::temp_dir().join(format!("socdof-artifact-{}", Uuid::new_v4()));
    let logo = sample_png(&directory);
    let logo_url = file_to_data_url(&logo).expect("logo data url");

    let mut template = default_template();
    template.name = "HTML-Beweis".to_string();
    template.logo = logo_url;
    template.company.name = "Vorlagen GmbH".to_string();
    template.company.vat_id = "DE123456789".to_string();

    // The first PDF contains the logo as a raster image and becomes the stationery source.
    let stationery =
        din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let stationery_path = directory.join("briefpapier.pdf");
    std::fs::write(&stationery_path, &stationery).expect("stationery pdf");
    template.stationery_mode = true;
    template.stationery_source = file_to_data_url(&stationery_path).expect("stationery data url");
    template.company.website = "www.token-proof.example".to_string();
    template.stationery_tokens = vec![
        stationery_token(
            "{Firma_Website}",
            (12.0, 24.0),
            None,
            (13.0, "normal", "#1d4ed8", "left"),
        ),
        stationery_token(
            "{Status}",
            (65.0, 22.0),
            Some(30.0),
            (14.0, "bold", "#b91c1c", "right"),
        ),
        // Out-of-range percentages, an unknown colour and an unknown alignment.
        stationery_token(
            "{Ust_Betrag}",
            (120.0, -10.0),
            None,
            (9.0, "normal", "nope", "middle"),
        ),
        // Missing values fall back to the token key and the TypeScript defaults.
        StationeryToken {
            token_key: "{Nicht_Vorhanden}".to_string(),
            ..StationeryToken::default()
        },
    ];
    template.use_custom_layout = true;
    template.custom_body_template = "<h1 style=\"color:#2563eb\">Honorar</h1>\
        <p>Für <strong>{Kunde_Name}</strong> · Rechnung {Rechnungsnummer}</p>\
        {Positionen_Tabelle}\
        <p style=\"text-align:center;color:#64748b\">{Fusszeile}</p>"
        .to_string();

    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let docx_bytes =
        docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
            .expect("docx package");

    let output =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/invoice-template-artifacts");
    std::fs::create_dir_all(&output).expect("artifact dir");
    std::fs::write(output.join("rechnung.pdf"), &pdf).expect("write pdf");
    std::fs::write(output.join("rechnung.docx"), &docx_bytes).expect("write docx");

    let pdf_text = String::from_utf8_lossy(&pdf);
    assert!(pdf_text.contains("/Subtype /Image"));
    assert!(pdf_text.contains("/Bg Do"));
    assert!(pdf_text.contains("Honorar"));
    assert!(pdf_text.contains("Beratung"));

    // Stationery tokens are percentage-positioned text overlays with their own style.
    let website_line = pdf_text_line(&pdf_text, "(www.token-proof.example)");
    assert!(
        website_line.contains("0.114 0.306 0.847 rg"),
        "{website_line}"
    );
    assert!(website_line.contains("/F1 9.75 Tf"), "{website_line}");
    let (x, y) = text_matrix(website_line);
    assert!((x - mm(0.12 * 210.0)).abs() < 0.02, "{x}");
    assert!(
        (y - mm(297.0 - (0.24 * 297.0 + 13.0 * 0.264_583))).abs() < 0.02,
        "{y}"
    );

    let status_line = pdf_text_line(&pdf_text, "(Offen)");
    assert!(
        status_line.contains("0.725 0.110 0.110 rg"),
        "{status_line}"
    );
    assert!(status_line.contains("/F2 10.50 Tf"), "{status_line}");
    let (x, _) = text_matrix(status_line);
    let expected_right = mm(0.65 * 210.0) + mm(0.30 * 210.0) - text_width("Offen", 10.5);
    assert!((x - expected_right).abs() < 0.02, "{x} vs {expected_right}");

    // Values outside 0–100 are clamped to the page edge; unknown style values fall back.
    let tax_text = invoice.total_tax().format_localized("€");
    let tax_number = tax_text.split_whitespace().next().unwrap_or_default();
    let clamped_line = pdf_text_line(&pdf_text, tax_number);
    assert!(clamped_line.contains("/F1 6.75 Tf"), "{clamped_line}");
    assert!(
        clamped_line.contains("0.059 0.090 0.165 rg"),
        "{clamped_line}"
    );
    let (x, y) = text_matrix(clamped_line);
    assert!((x - mm(210.0)).abs() < 0.02, "{x}");
    assert!((y - mm(297.0 - 9.0 * 0.264_583)).abs() < 0.02, "{y}");

    let missing_line = pdf_text_line(&pdf_text, "({Nicht_Vorhanden})");
    assert!(
        missing_line.contains("0.059 0.090 0.165 rg"),
        "{missing_line}"
    );
    let (x, y) = text_matrix(missing_line);
    assert!(x.abs() < 0.02, "{x}");
    assert!((y - mm(297.0 - 13.0 * 0.264_583)).abs() < 0.02, "{y}");

    let document = docx::read_docx(&docx_bytes).expect("read docx");
    assert_eq!(document.headings()[0].1, "Honorar");
    let table = document.first_table().expect("positions table");
    assert_eq!(table.rows.len(), 3);
    assert_eq!(table.cell(1, 1), "Beratung");
    assert_eq!(table.cell(2, 1), "Material");
    assert!(document.plain_text().contains("Bitte überweisen"));

    for part in ["word/media/logo.png", "word/media/stationery.png"] {
        let bytes = docx::read_part(&docx_bytes, part)
            .expect("read part")
            .unwrap_or_else(|| panic!("missing {part}"));
        assert!(bytes.starts_with(b"\x89PNG"), "{part} is not a PNG");
        assert!(bytes.len() > 8, "{part} is an empty image part");
    }

    // The first-page header carries the logo and the stationery; both are anchored to the page and
    // painted behind the body text.
    let first_header = part_text(&docx_bytes, "word/header1.xml");
    assert!(
        first_header.contains("name=\"Briefpapier\""),
        "{first_header}"
    );
    assert!(first_header.contains("r:embed=\"rId1\""), "{first_header}");
    // The tokens are page-anchored text tables in the first-page header.
    assert!(first_header.contains("<w:tblpPr"), "{first_header}");
    assert!(first_header.contains("w:tblpX=\"7739\""), "{first_header}");
    assert!(first_header.contains("w:tblpY=\"3704\""), "{first_header}");
    assert!(first_header.contains("<w:jc w:val=\"right\"/>"));
    assert!(first_header.contains("<w:b/>"));
    assert!(first_header.contains("<w:color w:val=\"B91C1C\"/>"));
    assert!(first_header.contains("<w:sz w:val=\"21\"/>"));
    assert!(first_header.contains("www.token-proof.example"));
    assert!(first_header.contains("Offen"));
    assert!(first_header.contains("{Nicht_Vorhanden}"));
    // 120 % is clamped to the right page edge, -10 % to the top edge.
    assert!(first_header.contains("w:tblpX=\"11906\""), "{first_header}");
    assert!(first_header.contains("w:tblpY=\"0\""), "{first_header}");
    assert!(first_header.contains("name=\"Logo\""), "{first_header}");
    assert!(first_header.contains("r:embed=\"rId2\""), "{first_header}");
    assert_eq!(
        first_header.matches("behindDoc=\"1\"").count(),
        2,
        "both drawings belong behind the content: {first_header}"
    );
    assert_eq!(
        first_header.matches("relativeFrom=\"page\"").count(),
        4,
        "horizontal and vertical offsets of both drawings are page-relative: {first_header}"
    );
    assert!(
        first_header.contains("<wp:extent cx=\"7560000\" cy=\"10692000\"/>"),
        "the stationery covers an A4 page: {first_header}"
    );
    assert!(
        first_header.contains("<a:srcRect l="),
        "the stationery is cover-cropped to A4: {first_header}"
    );

    // Later pages repeat the stationery only; the logo must not appear on every page.
    let later_header = part_text(&docx_bytes, "word/header2.xml");
    assert!(
        later_header.contains("name=\"Briefpapier\""),
        "{later_header}"
    );
    assert!(later_header.contains("r:embed=\"rId1\""), "{later_header}");
    assert!(!later_header.contains("name=\"Logo\""), "{later_header}");
    assert!(!later_header.contains("rId2"), "{later_header}");
    assert_eq!(later_header.matches("behindDoc=\"1\"").count(), 1);
    // The token overlays stay on the letterhead page.
    assert!(!later_header.contains("w:tblpPr"), "{later_header}");
    assert!(!later_header.contains("Offen"), "{later_header}");
    assert!(
        !later_header.contains("www.token-proof.example"),
        "{later_header}"
    );

    let first_rels = part_text(&docx_bytes, "word/_rels/header1.xml.rels");
    assert!(
        first_rels.contains(
            "Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/stationery.png\""
        ),
        "{first_rels}"
    );
    assert!(
        first_rels.contains(
            "Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/logo.png\""
        ),
        "{first_rels}"
    );
    let later_rels = part_text(&docx_bytes, "word/_rels/header2.xml.rels");
    assert!(later_rels.contains("media/stationery.png"), "{later_rels}");
    assert!(!later_rels.contains("logo.png"), "{later_rels}");

    let document_rels = part_text(&docx_bytes, "word/_rels/document.xml.rels");
    assert!(
        document_rels.contains(
            "Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header\" Target=\"header1.xml\""
        ),
        "{document_rels}"
    );
    assert!(
        document_rels.contains(
            "Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header\" Target=\"header2.xml\""
        ),
        "{document_rels}"
    );

    // `w:titlePg` switches the first page to the first header; the default header follows it.
    let document_part = part_text(&docx_bytes, "word/document.xml");
    assert!(document_part.contains("<w:titlePg/>"), "{document_part}");
    assert!(document_part.contains("<w:headerReference w:type=\"first\" r:id=\"rId2\"/>"));
    assert!(document_part.contains("<w:headerReference w:type=\"default\" r:id=\"rId3\"/>"));
    let section = &document_part[document_part
        .find("<w:sectPr>")
        .expect("section properties")..];
    assert!(
        section
            .find("<w:headerReference")
            .expect("header reference")
            < section.find("<w:pgSz").expect("page size"),
        "header references come first in w:sectPr: {section}"
    );
    assert!(
        section.find("<w:titlePg/>").expect("titlePg")
            > section.find("<w:pgMar").expect("page margins"),
        "w:titlePg follows the page geometry: {section}"
    );

    let content_types = part_text(&docx_bytes, "[Content_Types].xml");
    assert!(
        content_types.contains("Extension=\"png\""),
        "{content_types}"
    );
    assert!(
        content_types.contains("/word/header1.xml"),
        "{content_types}"
    );
    assert!(
        content_types.contains("/word/header2.xml"),
        "{content_types}"
    );

    let _ = std::fs::remove_dir_all(directory);
}

/// Unreadable image sources must not leave empty media parts or dangling header references.
#[test]
fn unreadable_images_keep_the_package_valid_without_media_parts() {
    let (invoice, contact, company) = sample();
    let mut template = default_template();
    template.logo = "data:image/png;base64,bm90LWEtcG5n".to_string();
    template.show_logo = true;
    template.stationery_mode = true;
    template.stationery_source = "data:application/pdf;base64,bm90LWEtcGRm".to_string();
    template.company.website = "www.token-proof.example".to_string();
    template.stationery_tokens = vec![stationery_token(
        "{Firma_Website}",
        (12.0, 24.0),
        None,
        (13.0, "normal", "#1d4ed8", "left"),
    )];
    template.use_custom_layout = true;
    template.custom_body_template =
        "<h1>Honorar</h1>{Positionen_Tabelle}<p>{Fusszeile}</p>".to_string();

    let bytes = docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
        .expect("valid package");
    let document = docx::read_docx(&bytes).expect("reads back");
    assert_eq!(document.headings()[0].1, "Honorar");
    assert_eq!(
        document.first_table().expect("positions table").rows.len(),
        3
    );

    // Without a readable stationery image there is nothing to place the tokens on.
    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let pdf_text = String::from_utf8_lossy(&pdf);
    assert!(!pdf_text.contains("www.token-proof.example"));
    assert!(!pdf_text.contains("(Offen)"));

    for part in [
        "word/media/logo.png",
        "word/media/stationery.png",
        "word/header1.xml",
        "word/header2.xml",
        "word/_rels/header1.xml.rels",
        "word/_rels/header2.xml.rels",
    ] {
        assert!(
            docx::read_part(&bytes, part).expect("read part").is_none(),
            "unexpected {part}"
        );
    }
    let content_types = part_text(&bytes, "[Content_Types].xml");
    assert!(
        !content_types.contains("Extension=\"png\""),
        "{content_types}"
    );
    assert!(!content_types.contains("header1.xml"), "{content_types}");
    let document_part = part_text(&bytes, "word/document.xml");
    assert!(
        !document_part.contains("w:headerReference"),
        "{document_part}"
    );
    assert!(!document_part.contains("w:titlePg"), "{document_part}");
}

/// Flex rows and grids must become fixed-width tables with the planned cell geometry.
#[test]
fn flex_rows_and_grids_become_fixed_width_tables_in_docx() {
    let (invoice, contact, company) = sample();
    let mut template = default_template();
    template.use_custom_layout = true;
    template.custom_body_template =
        "<div style=\"display:flex;justify-content:space-between;gap:20px\">\
        <div style=\"flex:1\">Links</div>\
        <div style=\"width:100px\">Rechts</div></div>\
      <div style=\"display:grid;grid-template-columns:repeat(4, 1fr);gap:16px\">\
        <div>Anschrift</div><div>Kontakt</div><div>Bank</div><div>Recht</div></div>"
            .to_string();

    let bytes = docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
        .expect("docx package");
    let read_back = docx::read_docx(&bytes).expect("reads back");
    let text = read_back.plain_text();
    for label in ["Links", "Rechts", "Anschrift", "Kontakt", "Bank", "Recht"] {
        assert!(text.contains(label), "missing {label} in {text}");
    }

    let part = part_text(&bytes, "word/document.xml");
    assert!(part.contains("<w:tblLayout w:type=\"fixed\"/>"), "{part}");
    assert!(part.contains("<w:vAlign w:val=\"top\"/>"), "{part}");

    let rendered = template.rendered_document(&invoice, &contact, &company, "€");
    let RichBlock::Container(row) = &rendered.blocks[0] else {
        panic!("flex row expected");
    };
    let plan = layout_container(row, DIN5008_TEXT_WIDTH_PT);
    let twips = |points: f32| (f64::from(points) * 20.0).round() as i64;
    for slot in &plan.rows[0].slots {
        assert!(
            part.contains(&format!(
                "<w:tcW w:w=\"{}\" w:type=\"dxa\"/>",
                twips(slot.width)
            )),
            "missing cell width for {slot:?}"
        );
    }

    let RichBlock::Container(grid) = &rendered.blocks[1] else {
        panic!("grid expected");
    };
    let grid_plan = layout_container(grid, DIN5008_TEXT_WIDTH_PT);
    let grid_width = twips(grid_plan.rows[0].slots[0].width);
    assert!(
        part.contains(&format!("<w:gridCol w:w=\"{grid_width}\"/>")),
        "{part}"
    );
    // Two container rows. The flex line has two items plus a justify spacer; the grid row has four
    // tracks and a spacer column per gap, so the planned x offsets survive in Word as well.
    assert_eq!(part.matches("<w:tr>").count(), 2, "{part}");
    assert_eq!(part.matches("<w:tc>").count(), 10, "{part}");
    // 20px gap of the flex row and 16px gaps of the grid, in twips.
    assert!(
        part.contains("<w:tcW w:w=\"300\" w:type=\"dxa\"/>"),
        "{part}"
    );
    assert!(
        part.contains("<w:tcW w:w=\"240\" w:type=\"dxa\"/>"),
        "{part}"
    );
}

#[test]
fn explicit_grid_rows_and_block_margins_survive_docx_export() {
    let (invoice, contact, company) = sample();
    let mut template = default_template();
    template.use_custom_layout = true;
    template.custom_body_template = r#"<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:40px 20px;gap:10px;margin-bottom:20px"><div>A</div><div>B</div><div>C</div><div>D</div></div><p style="margin-top:10px">Nach</p>"#.to_string();

    let bytes = docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
        .expect("docx package");
    let text = docx::read_docx(&bytes).expect("reads back").plain_text();
    for label in ["A", "B", "C", "D", "Nach"] {
        assert!(text.contains(label), "missing {label} in {text}");
    }

    let part = part_text(&bytes, "word/document.xml");
    // 40px = 30pt and 20px = 15pt become explicit Word row heights in twips.
    assert!(
        part.contains(r#"<w:trHeight w:val="600" w:hRule="atLeast"/>"#),
        "{part}"
    );
    assert!(
        part.contains(r#"<w:trHeight w:val="300" w:hRule="atLeast"/>"#),
        "{part}"
    );
    // The 20px bottom margin and 10px top margin collapse to 15pt (300 twips).
    assert!(
        part.contains(r#"w:line="300""#) && part.contains(r#"w:lineRule="exact""#),
        "{part}"
    );
}

/// Reads one package part as text, failing with its name when it is missing.
fn part_text(bytes: &[u8], name: &str) -> String {
    String::from_utf8(
        docx::read_part(bytes, name)
            .unwrap_or_else(|error| panic!("{name}: {error}"))
            .unwrap_or_else(|| panic!("missing {name}")),
    )
    .expect("utf-8 part")
}

/// Long values must break and advance exactly like the shared preview layout.
#[test]
fn long_stationery_tokens_wrap_identically_to_the_preview_layout() {
    let (invoice, contact, company) = sample();
    let directory = std::env::temp_dir().join(format!("socdof-wrap-{}", Uuid::new_v4()));
    let png = sample_png(&directory);

    let mut template = default_template();
    template.stationery_mode = true;
    template.stationery_source = file_to_data_url(&png).expect("stationery data url");
    let long = "This is a very long stationery text that must wrap across several lines while keeping exactly the same line offsets in the preview and the exported document";
    template.company.website = long.to_string();
    template.company.subtitle = "Zeile eins\nZeile zwei\nZeile drei".to_string();
    template.stationery_tokens = vec![
        stationery_token(
            "{Firma_Website}",
            (10.0, 40.0),
            Some(30.0),
            (11.0, "normal", "#1d4ed8", "right"),
        ),
        stationery_token(
            "{Firma_Zusatz}",
            (55.0, 60.0),
            None,
            (12.0, "bold", "#0f172a", "left"),
        ),
    ];

    let resolved = template.stationery_token_texts(&invoice, &contact, &company, "€");
    assert_eq!(resolved.len(), 2);
    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let pdf_text = String::from_utf8_lossy(&pdf);

    let docx = docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
        .expect("docx package");
    let header = part_text(&docx, "word/header1.xml");
    let expected_breaks: usize = resolved
        .iter()
        .map(|(token, text)| {
            layout_stationery_token(token, text)
                .lines
                .len()
                .saturating_sub(1)
        })
        .sum();
    assert_eq!(header.matches("<w:br/>").count(), expected_breaks);
    assert!(header.contains("w:line=\"231\""), "{header}");
    assert!(header.contains("w:line=\"252\""), "{header}");

    for (token, text) in &resolved {
        let layout = layout_stationery_token(token, text);
        if token.width_pct.is_some() {
            assert!(layout.lines.len() >= 4, "{layout:?}");
        } else {
            assert_eq!(layout.lines.len(), 3, "{layout:?}");
        }
        for line in layout.lines.iter().filter(|line| !line.text.is_empty()) {
            let needle = format!("({})", line.text);
            let expected_y = mm(297.0 - line.baseline_mm);
            let found = pdf_text
                .lines()
                .filter(|candidate| candidate.contains(&needle) && candidate.contains("Tj"))
                .any(|candidate| {
                    let (x, y) = text_matrix(candidate);
                    (x - line.x_pt).abs() < 0.02 && (y - expected_y).abs() < 0.02
                });
            assert!(
                found,
                "missing PDF line {:?} at x={} y={}",
                line.text, line.x_pt, expected_y
            );
            assert!(
                header.contains(&line.text),
                "missing DOCX line {:?}",
                line.text
            );
        }
    }

    let _ = std::fs::remove_dir_all(directory);
}

#[test]
fn assets_loaded_by_the_picker_reach_pdf_and_docx() {
    let (invoice, contact, company) = sample();
    let directory = std::env::temp_dir().join(format!("socdof-asset-export-{}", Uuid::new_v4()));
    let path = sample_png(&directory);
    let bytes = std::fs::read(&path).expect("png bytes");
    let logo =
        template_asset_from_bytes(TemplateAssetKind::Logo, "logo.png", &bytes).expect("logo asset");
    let stationery =
        template_asset_from_bytes(TemplateAssetKind::Stationery, "briefpapier.png", &bytes)
            .expect("stationery asset");

    let mut template = default_template();
    template.logo = logo.data_url;
    template.show_logo = true;
    template.stationery_mode = true;
    template.stationery_source = stationery.data_url;

    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let pdf_text = String::from_utf8_lossy(&pdf);
    assert!(pdf_text.contains("/Subtype /Image"));
    assert!(pdf_text.contains("/Bg Do"));

    let docx_bytes =
        docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
            .expect("docx package");
    for part in ["word/media/logo.png", "word/media/stationery.png"] {
        let bytes = docx::read_part(&docx_bytes, part)
            .expect("read part")
            .unwrap_or_else(|| panic!("missing {part}"));
        assert!(bytes.starts_with(b"\x89PNG"), "{part} is not a PNG");
    }

    let _ = std::fs::remove_dir_all(directory);
}

#[test]
fn vector_only_stationery_reaches_pdf_with_cover_geometry() {
    let (invoice, contact, company) = sample();
    let directory = std::env::temp_dir().join(format!("socdof-vector-{}", Uuid::new_v4()));
    let stationery = directory.join("briefpapier.pdf");
    std::fs::create_dir_all(&directory).expect("temp dir");
    std::fs::write(&stationery, vector_stationery_pdf()).expect("stationery pdf");

    let mut template = default_template();
    template.stationery_mode = true;
    template.stationery_source = file_to_data_url(&stationery).expect("stationery data url");

    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let text = String::from_utf8_lossy(&pdf);
    assert!(text.starts_with("%PDF"));
    assert!(
        text.contains("q 8.418898 0.000000 0.000000 8.418898 -123.307087 0.000000 cm"),
        "vector stationery placement missing: {text}"
    );
    assert!(
        text.contains("50 20 20 20 re f"),
        "vector rectangle missing: {text}"
    );
    assert!(
        text.contains("50 20 m 70 40 l S"),
        "vector stroke missing: {text}"
    );
    assert!(
        !text.contains("/Subtype /Image"),
        "vector stationery was rasterised: {text}"
    );
    assert!(text.contains("2026-0001"), "invoice text missing: {text}");
    assert!(text.ends_with("%%EOF\n"));

    let _ = std::fs::remove_dir_all(directory);
}

#[test]
fn svg_logos_reach_pdf_and_docx_and_broken_svgs_do_not_break_exports() {
    let (invoice, contact, company) = sample();
    let svg = br#"<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><rect width='40' height='20' fill='#ff0000'/></svg>"#;
    let logo = template_asset_from_bytes(TemplateAssetKind::Logo, "logo.svg", svg)
        .expect("svg logo asset");
    let mut template = default_template();
    template.logo = logo.data_url;
    template.show_logo = true;
    assert!(template.logo_image().is_some());

    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    let pdf_text = String::from_utf8_lossy(&pdf);
    assert!(pdf_text.contains("/Subtype /Image"));
    let docx_bytes =
        docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
            .expect("docx package");
    let media = docx::read_part(&docx_bytes, "word/media/logo.png")
        .expect("read logo part")
        .expect("svg logo must become a PNG media part");
    assert!(media.starts_with(b"\x89PNG"));

    let broken = template_asset_from_bytes(TemplateAssetKind::Logo, "broken.svg", b"<svg><rect")
        .expect("broken svg is accepted like the TypeScript file input");
    template.logo = broken.data_url;
    assert!(template.logo_image().is_none());

    let pdf = din5008::render_invoice_pdf_with_template(&invoice, &contact, &company, &template);
    assert!(pdf.starts_with(b"%PDF"));
    assert!(!String::from_utf8_lossy(&pdf).contains("/Subtype /Image"));
    let docx_bytes =
        docx::invoice_docx_bytes_with_template(&invoice, &contact, &company, &template)
            .expect("broken svg must not break the docx package");
    assert!(docx::read_part(&docx_bytes, "word/media/logo.png")
        .expect("read logo part")
        .is_none());
}
