//! DIN 5008 Form B invoice layout.
//!
//! Geometry (millimetres, measured from the top edge):
//!
//! | Element | Position |
//! |---|---|
//! | Sender line | 43 |
//! | Address field | 45, left 25, width 85, height 40 |
//! | Info block | 45, right aligned at 190 |
//! | Subject line | 98.5 |
//! | Body text | 111.5 |
//! | Footer | 285 |
//!
//! The left margin is 25 mm and the right margin 20 mm, as required for Form B.

use std::path::Path;

use crate::date::format_date;
use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;
use crate::error::CoreResult;

use super::writer::{mm, Document, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};

const LEFT_MARGIN_MM: f64 = 25.0;
const RIGHT_MARGIN_MM: f64 = 20.0;
const BOTTOM_MARGIN_MM: f64 = 12.0;
const ADDRESS_TOP_MM: f64 = 45.0;
const SUBJECT_TOP_MM: f64 = 98.5;
const BODY_TOP_MM: f64 = 111.5;
const TABLE_TOP_MM: f64 = 132.0;

/// Vertical position in points for a distance measured from the top edge.
fn from_top(millimetres: f64) -> f64 {
    mm(PAGE_HEIGHT_MM - millimetres)
}

/// Renders one invoice as a DIN 5008 PDF.
pub fn render_invoice_pdf(
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
) -> Vec<u8> {
    let mut document = Document::new(&format!("Rechnung {}", invoice.number));
    let page = document.page_mut();

    let left = mm(LEFT_MARGIN_MM);
    let right = mm(PAGE_WIDTH_MM - RIGHT_MARGIN_MM);
    let currency = if company.currency.trim().is_empty() {
        "€"
    } else {
        company.currency.as_str()
    };

    // Sender line above the address field.
    let sender_parts: Vec<String> = [
        company.name.as_str(),
        company.street.as_str(),
        company.zip_city.as_str(),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .map(str::to_string)
    .collect();

    if !sender_parts.is_empty() {
        page.text(left, from_top(43.0), 7.5, &sender_parts.join(" · "));
        page.line(left, from_top(44.0), right, 0.4);
    }

    // Address field.
    let mut address_lines: Vec<String> = vec![recipient.display_name()];
    if let Some(street) = recipient
        .street
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        address_lines.push(street.to_string());
    }
    let city_line = [recipient.zip.as_deref(), recipient.city.as_deref()]
        .into_iter()
        .flatten()
        .filter(|value| !value.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if !city_line.is_empty() {
        address_lines.push(city_line);
    }
    if let Some(country) = recipient
        .country
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        address_lines.push(country.to_string());
    }

    let mut address_y = ADDRESS_TOP_MM + 3.5;
    for line in address_lines.iter().take(6) {
        page.text(left, from_top(address_y), 11.0, line);
        address_y += 4.6;
    }

    // Info block on the right.
    let info_lines = [
        format!("Rechnungsnummer: {}", invoice.number),
        format!("Rechnungsdatum: {}", format_date(invoice.issued_at)),
        format!("Fällig am: {}", format_date(invoice.due_at)),
    ];
    let mut info_y = 45.0;
    for line in info_lines {
        page.text_right(right, from_top(info_y), 9.0, &line);
        info_y += 4.4;
    }

    // Subject and intro text.
    page.text_bold(
        left,
        from_top(SUBJECT_TOP_MM),
        12.0,
        &format!("Rechnung Nr. {}", invoice.number),
    );

    let intro = invoice
        .note
        .clone()
        .filter(|note| !note.trim().is_empty())
        .unwrap_or_else(|| {
            "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag.".to_string()
        });
    page.text(left, from_top(BODY_TOP_MM), 10.0, &intro);

    // Positions.
    page.text_bold(left, from_top(TABLE_TOP_MM), 8.0, "Pos.");
    page.text_bold(left + mm(10.0), from_top(TABLE_TOP_MM), 8.0, "Bezeichnung");
    page.text_right_bold(right - mm(38.0), from_top(TABLE_TOP_MM), 8.0, "Menge");
    page.text_right_bold(right - mm(22.0), from_top(TABLE_TOP_MM), 8.0, "Einzelpreis");
    page.text_right_bold(right, from_top(TABLE_TOP_MM), 8.0, "Betrag");
    page.line(left, from_top(TABLE_TOP_MM + 2.0), right, 0.6);

    let mut row_y = TABLE_TOP_MM + 8.0;
    for (index, line) in invoice.lines.iter().enumerate() {
        let position = (index + 1).to_string();
        page.text(left, from_top(row_y), 9.0, &position);
        page.text(
            left + mm(10.0),
            from_top(row_y),
            9.0,
            &truncate(&line.description, 48),
        );
        page.text_right(
            right - mm(38.0),
            from_top(row_y),
            9.0,
            &format_quantity(line.quantity_milli),
        );
        page.text_right(
            right - mm(22.0),
            from_top(row_y),
            9.0,
            &line.unit_price.format_localized(currency),
        );
        page.text_right(
            right,
            from_top(row_y),
            9.0,
            &line.net().format_localized(currency),
        );
        row_y += 6.0;
    }

    page.line(left, from_top(row_y + 1.0), right, 0.6);

    // Totals.
    let mut totals_y = row_y + 9.0;
    page.text_right(right - mm(24.0), from_top(totals_y), 9.0, "Netto");
    page.text_right(
        right,
        from_top(totals_y),
        9.0,
        &invoice.total_net().format_localized(currency),
    );
    totals_y += 5.5;
    page.text_right(right - mm(24.0), from_top(totals_y), 9.0, "Umsatzsteuer");
    page.text_right(
        right,
        from_top(totals_y),
        9.0,
        &invoice.total_tax().format_localized(currency),
    );
    totals_y += 5.5;
    page.text_right_bold(right - mm(24.0), from_top(totals_y), 10.0, "Gesamtbetrag");
    page.text_right_bold(
        right,
        from_top(totals_y),
        10.0,
        &invoice.total_gross().format_localized(currency),
    );

    page.text(
        left,
        from_top(totals_y + 12.0),
        8.5,
        &format!(
            "Bitte überweisen Sie den Gesamtbetrag bis zum {}.",
            format_date(invoice.due_at)
        ),
    );

    // Footer.
    let footer_top = PAGE_HEIGHT_MM - BOTTOM_MARGIN_MM;
    let footer = [
        company.name.clone(),
        company.street.clone(),
        company.zip_city.clone(),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .collect::<Vec<_>>()
    .join(" · ");
    if !footer.is_empty() {
        page.text(left, from_top(footer_top), 7.5, &footer);
    }

    let contact_line = [company.phone.as_str(), company.email.as_str()]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" · ");
    if !contact_line.is_empty() {
        page.text(left, from_top(footer_top + 3.5), 7.5, &contact_line);
    }

    if !company.tax_id.trim().is_empty() {
        page.text(
            left,
            from_top(footer_top + 7.0),
            7.5,
            &format!("Steuernummer: {}", company.tax_id),
        );
    }
    page.text_right(right, from_top(footer_top + 7.0), 7.5, "Seite 1 von 1");

    document.to_bytes()
}

/// Renders an invoice and writes it to `path`.
pub fn write_invoice_pdf(
    path: &Path,
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
) -> CoreResult<()> {
    let bytes = render_invoice_pdf(invoice, recipient, company);
    std::fs::write(path, bytes)?;
    Ok(())
}

fn format_quantity(quantity_milli: i64) -> String {
    let whole = quantity_milli / 1_000;
    let rest = quantity_milli % 1_000;
    if rest == 0 {
        return whole.to_string();
    }
    let fraction = format!("{rest:03}");
    format!("{whole},{}", fraction.trim_end_matches('0'))
}

fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut truncated: String = text.chars().take(max_chars.saturating_sub(1)).collect();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use uuid::Uuid;

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
    fn renders_invoice_content_in_din5008_layout() {
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let text = String::from_utf8(bytes).expect("pdf is ascii");

        assert!(text.starts_with("%PDF-1.4"));
        assert!(text.contains("/MediaBox [0 0 595.28 841.89]"));
        assert!(text.contains("Rechnung Nr. 2026-0001"));
        assert!(text.contains("Beispiel GmbH"));
        assert!(text.contains("Hauptstrasse 5"));
        assert!(text.contains("10115 Berlin"));
        assert!(text.contains("157,68"));
        assert!(text.contains("132,50"));
        assert!(text.contains("25,18"));
        assert!(text.contains("M\\374ller & S\\366hne GmbH"));
        assert!(text.ends_with("%%EOF\n"));
    }

    #[test]
    fn references_a_valid_xref_table() {
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let text = String::from_utf8(bytes).expect("pdf is ascii");

        let start = text.rfind("startxref").expect("startxref");
        let offset: usize = text[start + "startxref".len()..]
            .split_whitespace()
            .next()
            .expect("offset")
            .parse()
            .expect("number");

        assert_eq!(&text[offset..offset + 4], "xref");
        assert!(text[offset..].contains("0000000000 65535 f"));
    }

    #[test]
    fn writes_a_readable_file() {
        let directory = std::env::temp_dir().join(format!("socdof-pdf-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("temp dir");
        let path = directory.join("rechnung.pdf");

        write_invoice_pdf(
            &path,
            &sample_invoice(),
            &sample_recipient(),
            &sample_company(),
        )
        .expect("written");

        let metadata = std::fs::metadata(&path).expect("file exists");
        assert!(metadata.len() > 1_000);

        let bytes = std::fs::read(&path).expect("read");
        assert_eq!(&bytes[..8], b"%PDF-1.4");
        assert!(bytes.windows(5).any(|window| window == b"%%EOF"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn formats_quantities_and_truncates_long_descriptions() {
        assert_eq!(format_quantity(1_000), "1");
        assert_eq!(format_quantity(1_500), "1,5");
        assert_eq!(format_quantity(2_250), "2,25");
        assert_eq!(truncate("kurz", 10), "kurz");
        assert_eq!(truncate("abcdefghij", 5), "abcd…");
    }
}
