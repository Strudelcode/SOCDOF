//! Invoice mail drafts, ported from `InvoiceEmailModal.tsx` and `lib/emlGenerator.ts`.

use crate::date::format_date;
use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;
use crate::money::Money;

/// Encodes a header value as an RFC 2047 MIME word when it is not pure ASCII.
pub fn encode_mime_header(text: &str) -> String {
    if text.chars().all(|ch| (' '..='~').contains(&ch)) {
        return text.to_string();
    }
    format!("=?UTF-8?B?{}?=", base64(text.as_bytes()))
}

/// Standard Base64 with padding.
pub fn base64(input: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);
        out.push(ALPHABET[(first >> 2) as usize] as char);
        out.push(ALPHABET[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(((second & 0b0000_1111) << 2) | (third >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(third & 0b0011_1111) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Subject of the invoice mail.
pub fn invoice_subject(invoice: &Invoice, company: &CompanyProfile) -> String {
    let company_name = if company.name.trim().is_empty() {
        "SOCDOF"
    } else {
        company.name.trim()
    };
    format!("Rechnung {} – {}", invoice.number, company_name)
}

/// Display name of a contact, matching `buildContactEmlPayload`.
pub fn contact_display_name(contact: &Contact) -> String {
    contact
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            contact
                .company_name
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("Sehr geehrte Damen und Herren")
        .to_string()
}

fn company_or<'a>(company: &'a CompanyProfile, fallback: &'a str) -> &'a str {
    if company.name.trim().is_empty() {
        fallback
    } else {
        company.name.trim()
    }
}

/// Subject of the contact mail.
pub fn contact_subject(contact: &Contact, company: &CompanyProfile) -> String {
    format!(
        "Mitteilung von {} an {}",
        company_or(company, "Ihrem Partner"),
        contact_display_name(contact)
    )
}

/// Draft body of the contact mail, ported from `buildContactEmlPayload`.
pub fn contact_body(contact: &Contact, company: &CompanyProfile) -> String {
    let recipient_name = contact_display_name(contact);
    let sender_name = company_or(company, "SOCDOF ERP");
    let mut lines = vec![
        format!("Sehr geehrte(r) Frau/Herr {recipient_name},"),
        String::new(),
        "wir freuen uns über den geschäftlichen Austausch mit Ihnen.".to_string(),
        String::new(),
    ];
    if let Some(name) = contact
        .company_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        lines.push(format!("Unternehmen: {name}"));
    }
    if let Some(phone) = contact
        .phone
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        lines.push(format!("Telefon: {phone}"));
    }
    lines.extend([
        String::new(),
        "Mit freundlichen Grüßen,".to_string(),
        sender_name.to_string(),
    ]);
    if !company.street.trim().is_empty() {
        lines.push(format!(
            "{}, {}",
            company.street.trim(),
            company.zip_city.trim()
        ));
    }
    if !company.phone.trim().is_empty() {
        lines.push(format!("Tel.: {}", company.phone.trim()));
    }
    if !company.email.trim().is_empty() {
        lines.push(format!("E-Mail: {}", company.email.trim()));
    }
    lines.join("\r\n")
}

/// File name of the contact `.eml` draft.
pub fn contact_eml_file_name(contact: &Contact) -> String {
    let safe: String = contact_display_name(contact)
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    format!("EML_Entwurf_{safe}.eml")
}

/// Complete RFC 822 draft of a contact mail with editable fields.
#[allow(clippy::too_many_arguments)]
pub fn contact_eml_with(
    contact: &Contact,
    company: &CompanyProfile,
    recipient_name: &str,
    recipient_email: &str,
    subject: &str,
    body: &str,
    now: i64,
) -> String {
    let sender_name = company_or(company, "SOCDOF ERP");
    let sender_email = if company.email.trim().is_empty() {
        "buchhaltung@firma.local"
    } else {
        company.email.trim()
    };
    let name = if recipient_name.trim().is_empty() {
        "Kunde"
    } else {
        recipient_name.trim()
    };
    let email = if recipient_email.trim().is_empty() {
        "kunde@kontakt.local"
    } else {
        recipient_email.trim()
    };
    let subject = if subject.trim().is_empty() {
        "Mitteilung"
    } else {
        subject.trim()
    };
    let _ = contact;
    format!(
        "From: \"{}\" <{}>\r\nTo: \"{}\" <{}>\r\nSubject: {}\r\nDate: {}\r\n\
         MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8; format=flowed\r\n\
         Content-Transfer-Encoding: 8bit\r\nX-Unsent: 1\r\n\
         X-Mailer: SOCDOF ERP Offline Suite\r\n\r\n{}",
        encode_mime_header(sender_name),
        sender_email,
        encode_mime_header(name),
        email,
        encode_mime_header(subject),
        crate::date::rfc2822(now),
        body
    )
}

/// Complete RFC 822 draft with the payload defaults of the modal.
pub fn contact_eml(contact: &Contact, company: &CompanyProfile, now: i64) -> String {
    let recipient = contact.email.clone().unwrap_or_default();
    let subject = contact_subject(contact, company);
    let body = contact_body(contact, company);
    contact_eml_with(
        contact,
        company,
        &contact_display_name(contact),
        &recipient,
        &subject,
        &body,
        now,
    )
}

/// Draft body shown in the modal before it is handed to a mail client.
pub fn invoice_body(invoice: &Invoice, customer: &str, company: &CompanyProfile) -> String {
    let currency = &invoice.currency_symbol;
    let mut lines = vec![
        "Sehr geehrte Damen und Herren,".to_string(),
        format!("sehr geehrte(r) {customer},"),
        String::new(),
        format!(
            "anbei erhalten Sie die Rechnung Nr. {} vom {}.",
            invoice.number,
            format_date(invoice.issued_at)
        ),
        String::new(),
        format!(
            "Rechnungsbetrag: {} {currency}",
            invoice.total_gross().to_decimal_string()
        ),
    ];
    if invoice.due_at > 0 {
        lines.push(format!("Zahlungsziel: {}", format_date(invoice.due_at)));
    }
    lines.push(String::new());
    if !company.iban.trim().is_empty() {
        lines.push(
            "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf folgendes \
             Bankkonto:"
                .to_string(),
        );
    }
    if !company.bank_name.trim().is_empty() {
        lines.push(format!("Bank: {}", company.bank_name.trim()));
    }
    if !company.bank_account_holder.trim().is_empty() {
        lines.push(format!(
            "Kontoinhaber: {}",
            company.bank_account_holder.trim()
        ));
    }
    if !company.iban.trim().is_empty() {
        lines.push(format!("IBAN: {}", company.iban.trim()));
    }
    if !company.bic.trim().is_empty() {
        lines.push(format!("BIC: {}", company.bic.trim()));
    }
    if !company.iban.trim().is_empty() {
        lines.push(format!("Verwendungszweck: Rechnung {}", invoice.number));
    }
    lines.push(String::new());
    lines.push("Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.".to_string());
    lines.push(String::new());
    lines.push("Mit freundlichen Grüßen,".to_string());
    lines.push(if company.name.trim().is_empty() {
        "Ihr Unternehmen".to_string()
    } else {
        company.name.trim().to_string()
    });
    if !company.phone.trim().is_empty() {
        lines.push(format!("Tel.: {}", company.phone.trim()));
    }
    if !company.email.trim().is_empty() {
        lines.push(format!("E-Mail: {}", company.email.trim()));
    }
    lines.join("\n")
}

/// `mailto:` URL with recipient, subject and body.
pub fn mailto_url(recipient: &str, subject: &str, body: &str) -> String {
    format!(
        "mailto:{}?subject={}&body={}",
        recipient.trim(),
        percent_encode(subject),
        percent_encode(body)
    )
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(*byte as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// File name of the `.eml` draft.
pub fn eml_file_name(number: &str) -> String {
    let safe: String = number
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    format!("Rechnung_{safe}_Entwurf.eml")
}

/// Complete RFC 822 draft of the invoice mail.
pub fn invoice_eml(
    invoice: &Invoice,
    customer: &str,
    recipient_email: &str,
    company: &CompanyProfile,
) -> String {
    let sender_email = if company.email.trim().is_empty() {
        "rechnung@firma.local"
    } else {
        company.email.trim()
    };
    let sender_name = if company.name.trim().is_empty() {
        "Rechnungsabteilung"
    } else {
        company.name.trim()
    };
    let currency = &invoice.currency_symbol;
    let total = invoice.total_gross();
    let due = if invoice.due_at > 0 {
        format_date(invoice.due_at)
    } else {
        "sofort".to_string()
    };

    let mut body = vec![
        "Sehr geehrte Damen und Herren,".to_string(),
        format!("sehr geehrte(r) {customer},"),
        String::new(),
        "anbei erhalten Sie die Abrechnung zu Ihrem Auftrag / Ihrer Bestellung.".to_string(),
        String::new(),
        "==================================================".to_string(),
        "RECHNUNGSDETAILS".to_string(),
        "==================================================".to_string(),
        format!("Rechnungsnummer : {}", invoice.number),
        format!("Rechnungsdatum  : {}", format_date(invoice.issued_at)),
        format!("Fälligkeitsdatum: {due}"),
        format!(
            "Gesamtbetrag    : {} {currency} (inkl. MwSt.)",
            total.to_decimal_string()
        ),
        String::new(),
        "Positionen:".to_string(),
    ];
    for line in &invoice.lines {
        let quantity = format_quantity(line.quantity_milli);
        body.push(format!(
            "  • {} ({}x) : {} {currency}",
            if line.description.trim().is_empty() {
                "Artikel"
            } else {
                line.description.trim()
            },
            quantity,
            line.net().to_decimal_string()
        ));
    }
    body.extend([
        String::new(),
        "==================================================".to_string(),
        "ZAHLUNGSINFORMATIONEN".to_string(),
        "==================================================".to_string(),
    ]);
    if !company.bank_name.trim().is_empty() {
        body.push(format!("Bankinstitut    : {}", company.bank_name.trim()));
    }
    if !company.iban.trim().is_empty() {
        body.push(format!("IBAN            : {}", company.iban.trim()));
    }
    if !company.bic.trim().is_empty() {
        body.push(format!("BIC / SWIFT     : {}", company.bic.trim()));
    }
    body.push(format!("Verwendungszweck: {}", invoice.number));
    body.push(String::new());
    body.push(format!(
        "Bitte überweisen Sie den fälligen Betrag bis zum {due} unter Angabe der Rechnungsnummer."
    ));
    body.push(String::new());
    body.push(
        "Bei Fragen zu dieser Rechnung stehen wir Ihnen jederzeit gerne zur Verfügung.".to_string(),
    );
    body.push(String::new());
    body.push("Mit freundlichen Grüßen,".to_string());
    body.push(sender_name.to_string());
    if !company.street.trim().is_empty() {
        body.push(format!(
            "{}, {}",
            company.street.trim(),
            company.zip_city.trim()
        ));
    }
    if !company.tax_id.trim().is_empty() {
        body.push(format!("USt-IdNr.: {}", company.tax_id.trim()));
    }
    if !company.phone.trim().is_empty() {
        body.push(format!("Tel.: {}", company.phone.trim()));
    }

    format!(
        "From: \"{}\" <{}>\r\nTo: \"{}\" <{}>\r\nSubject: {}\r\nMIME-Version: 1.0\r\n\
         Content-Type: text/plain; charset=UTF-8; format=flowed\r\n\
         Content-Transfer-Encoding: 8bit\r\nX-Unsent: 1\r\nX-Mailer: SOCDOF ERP Offline Suite\r\n\r\n{}",
        encode_mime_header(sender_name),
        sender_email,
        encode_mime_header(customer),
        if recipient_email.trim().is_empty() {
            "kunde@kontakt.local"
        } else {
            recipient_email.trim()
        },
        encode_mime_header(&invoice_subject(invoice, company)),
        body.join("\r\n")
    )
}

fn format_quantity(milli: i64) -> String {
    let value = milli as f64 / 1000.0;
    if (value - value.round()).abs() < f64::EPSILON {
        format!("{}", value.round() as i64)
    } else {
        format!("{value:.2}")
    }
}

/// Money of the gross total, kept for callers that only need the figure.
pub fn total(invoice: &Invoice) -> Money {
    invoice.total_gross()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::invoice::InvoiceStatus;
    use uuid::Uuid;

    fn company() -> CompanyProfile {
        CompanyProfile {
            name: "Beispiel GmbH".to_string(),
            street: "Hauptstraße 1".to_string(),
            zip_city: "10115 Berlin".to_string(),
            email: "rechnung@beispiel.de".to_string(),
            phone: "+49 30 1234".to_string(),
            tax_id: "DE123456789".to_string(),
            iban: "DE12 3456 7890".to_string(),
            bic: "BEISDEFFXXX".to_string(),
            bank_name: "Beispielbank".to_string(),
            bank_account_holder: "Beispiel GmbH".to_string(),
            ..CompanyProfile::default()
        }
    }

    fn invoice() -> Invoice {
        use crate::domain::invoice::InvoiceLine;
        Invoice {
            id: Uuid::nil(),
            number: "2026-0001".to_string(),
            contact_id: Uuid::nil(),
            status: InvoiceStatus::Sent,
            issued_at: 1_760_000_000_000,
            due_at: 1_762_592_000_000,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 2_500,
                unit_price: crate::money::Money::from_cents(8_000),
                tax_rate_bp: 1900,
            }],
        }
    }

    #[test]
    fn encodes_headers_and_base64() {
        assert_eq!(encode_mime_header("Rechnung 1"), "Rechnung 1");
        assert!(encode_mime_header("Rechnung – 1").starts_with("=?UTF-8?B?"));
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64("ü".as_bytes()), "w7w=");
    }

    #[test]
    fn draft_and_subject_use_the_legacy_wording() {
        let invoice = invoice();
        let company = company();
        assert_eq!(
            invoice_subject(&invoice, &company),
            "Rechnung 2026-0001 – Beispiel GmbH"
        );
        let body = invoice_body(&invoice, "Kunde", &company);
        assert!(body.contains("sehr geehrte(r) Kunde,"));
        assert!(body.contains("Rechnungsbetrag: 238.00 €"));
        assert!(body.contains("Zahlungsziel: "));
        assert!(body.contains("IBAN: DE12 3456 7890"));
        assert!(body.contains("Verwendungszweck: Rechnung 2026-0001"));
        assert!(body.ends_with("E-Mail: rechnung@beispiel.de"));
        assert_eq!(eml_file_name("2026/0001"), "Rechnung_2026_0001_Entwurf.eml");
    }

    #[test]
    fn eml_contains_details_and_positions() {
        let eml = invoice_eml(&invoice(), "Kunde", "kunde@example.de", &company());
        assert!(eml.starts_with("From: \"Beispiel GmbH\" <rechnung@beispiel.de>"));
        assert!(eml.contains("Subject: =?UTF-8?B?"));
        assert!(eml.contains("RECHNUNGSDETAILS"));
        assert!(eml.contains("  • Beratung (2.50x) : 200.00 €"));
        assert!(eml.contains("Gesamtbetrag    : 238.00 € (inkl. MwSt.)"));
        assert!(eml.ends_with("Tel.: +49 30 1234"));
        assert_eq!(total(&invoice()), Money::from_cents(23_800));
    }

    #[test]
    fn mailto_encodes_the_payload() {
        assert_eq!(
            mailto_url("kunde@example.de", "Rechnung 1", "Sehr geehrte"),
            "mailto:kunde@example.de?subject=Rechnung%201&body=Sehr%20geehrte"
        );
    }
}
