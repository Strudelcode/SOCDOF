//! CSV and vCard import/export for the native Contacts module.
//!
//! CSV parsing follows RFC 4180 quoting rules, sniffs comma/semicolon/tab separators and recognises
//! common Outlook, Google Contacts, Apple Contacts and German column names. Export is Excel-safe
//! (UTF-8 BOM, semicolon separator). vCard input/output uses version 3.0.

use crate::domain::contact::{Contact, ContactKind, ContactType};

/// Parses CSV text into contacts. Rows without any usable identity are ignored.
pub fn parse_contacts_csv(input: &str, default_type: ContactType, now: i64) -> Vec<Contact> {
    let input = input.trim_start_matches('\u{feff}');
    let rows = parse_csv_rows(input);
    if rows.len() < 2 {
        return Vec::new();
    }
    let headers: Vec<String> = rows[0].iter().map(|s| normalize_header(s)).collect();
    let find = |names: &[&str]| -> Option<usize> {
        names
            .iter()
            .find_map(|name| headers.iter().position(|h| h == name || h.contains(name)))
    };
    let find_all = |names: &[&str]| -> Vec<usize> {
        let mut matches = Vec::new();
        for name in names {
            for (index, header) in headers.iter().enumerate() {
                if (header == name || header.contains(name)) && !matches.contains(&index) {
                    matches.push(index);
                }
            }
        }
        matches
    };
    let first = find(&[
        "first name",
        "vorname",
        "given name",
        "prénom",
        "nombre",
        "nome",
    ]);
    let middle = find(&["middle name", "zweiter vorname", "segundo nombre"]);
    let last = find(&[
        "last name",
        "nachname",
        "family name",
        "surname",
        "nom",
        "apellido",
        "cognome",
    ]);
    let full = find(&[
        "display name",
        "full name",
        "vollständiger name",
        "kontaktname",
        "anzeigename",
        "contact name",
        "name",
        "kontakt",
    ]);
    let company = find(&[
        "company",
        "firma",
        "organization",
        "organisation",
        "unternehmen",
        "unternehm",
        "org",
        "société",
        "empresa",
        "azienda",
    ]);
    let emails = find_all(&[
        "e-mail 1 address",
        "e-mail 2 address",
        "e-mail 3 address",
        "e-mail address",
        "email address",
        "e-mail",
        "email",
        "e mail",
        "mail",
        "courriel",
        "correo",
        "posta elettronica",
    ]);
    let phones = find_all(&[
        "mobile phone",
        "cell phone",
        "mobiltelefon",
        "mobil",
        "handy",
        "cellular",
        "cell",
        "primary phone",
        "main phone",
        "haupttelefon",
        "business phone",
        "work phone",
        "geschäftlich",
        "home phone",
        "privattelefon",
        "phone",
        "telefon",
        "tel",
    ]);
    let street = find(&[
        "street", "straße", "strasse", "address", "adresse", "via", "calle",
    ]);
    let zip = find(&[
        "postal code",
        "zip",
        "plz",
        "postleitzahl",
        "code postal",
        "cap",
    ]);
    let city = find(&["city", "stadt", "ort", "ville", "ciudad", "comune"]);
    let country = find(&["country", "land", "pays", "país", "stato", "nazione"]);
    let tax = find(&[
        "tax id",
        "vat",
        "ustid",
        "ust-idnr",
        "partita iva",
        "steuernummer",
        "fiscal code",
        "cif",
        "nif",
    ]);
    let notes = find(&[
        "notes",
        "notizen",
        "bemerkungen",
        "anmerkungen",
        "kommentar",
        "remarques",
        "notas",
        "note",
    ]);
    let kind = find(&["contact type", "kontakt-typ", "type", "typ"]);

    rows.iter()
        .skip(1)
        .enumerate()
        .filter_map(|(row_index, row)| {
            let value = |index: Option<usize>| {
                index
                    .and_then(|i| row.get(i))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default()
            };
            let first_name = value(first);
            let middle_name = value(middle);
            let last_name = value(last);
            let company_name = value(company);
            let mut name = if !first_name.is_empty() && !last_name.is_empty() {
                [first_name, middle_name, last_name]
                    .into_iter()
                    .filter(|part| !part.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ")
            } else if !first_name.is_empty() {
                first_name
            } else if !last_name.is_empty() {
                last_name
            } else {
                value(full)
            };
            if name.is_empty() {
                name = company_name.clone();
            }
            if name.is_empty() {
                if row.iter().all(|cell| cell.trim().is_empty()) {
                    return None;
                }
                name = format!("Kontakt {}", row_index + 1);
            }
            let mut contact = Contact::new(
                if company_name.is_empty() {
                    ContactKind::Person
                } else {
                    ContactKind::Company
                },
                now + row_index as i64,
            );
            contact.name = Some(name);
            contact.company_name = non_empty(&company_name);
            let email_value = emails
                .iter()
                .filter_map(|index| row.get(*index))
                .map(|value| value.trim())
                .find(|value| valid_email(value) && value.contains('@'))
                .unwrap_or("")
                .to_string();
            contact.email = non_empty(&email_value);
            let phone_value = phones
                .iter()
                .filter_map(|index| row.get(*index))
                .map(|value| value.trim())
                .find(|value| {
                    value
                        .chars()
                        .filter(|ch| ch.is_ascii_digit() || *ch == '+')
                        .count()
                        >= 3
                })
                .unwrap_or("");
            contact.phone = non_empty(phone_value);
            contact.street = non_empty(&value(street));
            contact.zip = non_empty(&value(zip));
            contact.city = non_empty(&value(city));
            contact.country = non_empty(&value(country));
            contact.tax_id = non_empty(&value(tax));
            contact.notes = non_empty(&value(notes));
            contact.contact_type = kind
                .map(|i| {
                    parse_contact_type(row.get(i).map(String::as_str).unwrap_or(""), default_type)
                })
                .unwrap_or(default_type);
            Some(contact)
        })
        .collect()
}

/// Parses one or more vCard 2.1/3.0/4.0 cards, including folded lines and escaped values.
pub fn parse_contacts_vcard(input: &str, default_type: ContactType, now: i64) -> Vec<Contact> {
    let mut cards: Vec<Vec<String>> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    for raw in input.lines() {
        let line = raw.trim_end_matches('\r');
        if line.eq_ignore_ascii_case("BEGIN:VCARD") {
            current.clear();
            continue;
        }
        if line.eq_ignore_ascii_case("END:VCARD") {
            if !current.is_empty() {
                cards.push(std::mem::take(&mut current));
            }
            continue;
        }
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(last) = current.last_mut() {
                last.push_str(line.trim_start());
            }
        } else if !line.is_empty() {
            current.push(line.to_string());
        }
    }
    let mut contacts = Vec::new();
    for (index, lines) in cards.iter().enumerate() {
        let property = |wanted: &str| -> Option<String> {
            lines.iter().find_map(|line| {
                let (name, value) = line.split_once(':')?;
                let key = name.split(';').next()?.split('.').next_back()?;
                key.eq_ignore_ascii_case(wanted)
                    .then(|| unescape_vcard(value))
            })
        };
        let fn_name = property("FN").unwrap_or_default();
        let n = property("N").unwrap_or_default();
        let n_parts: Vec<&str> = n.split(';').collect();
        let first = n_parts.get(1).copied().unwrap_or("").trim();
        let last = n_parts.first().copied().unwrap_or("").trim();
        let name = if !fn_name.is_empty() {
            fn_name
        } else {
            [first, last]
                .into_iter()
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        };
        let company = property("ORG").unwrap_or_default().replace(';', " ");
        let name = if name.is_empty() {
            company.clone()
        } else {
            name
        };
        let email = property("EMAIL").unwrap_or_default();
        let phone = property("TEL").unwrap_or_default();
        if name.is_empty() && email.is_empty() && phone.is_empty() {
            continue;
        }
        let mut contact = Contact::new(
            if company.is_empty() {
                ContactKind::Person
            } else {
                ContactKind::Company
            },
            now + index as i64,
        );
        contact.name = Some(if name.is_empty() {
            "Unbenannter Kontakt".to_string()
        } else {
            name
        });
        contact.company_name = non_empty(&company);
        contact.email = (!email.is_empty() && valid_email(&email)).then_some(email);
        contact.phone = non_empty(&phone);
        if let Some(address) = property("ADR") {
            let parts: Vec<&str> = address.split(';').collect();
            contact.street = parts.get(2).and_then(|v| non_empty(v));
            contact.city = parts.get(3).and_then(|v| non_empty(v));
            contact.zip = parts.get(5).and_then(|v| non_empty(v));
            contact.country = parts.get(6).and_then(|v| non_empty(v));
        }
        contact.notes = property("NOTE").and_then(|v| non_empty(&v));
        contact.contact_type = default_type;
        contacts.push(contact);
    }
    contacts
}

/// Exports contacts to Excel-compatible CSV with UTF-8 BOM and CRLF rows.
pub fn export_contacts_csv(contacts: &[Contact], delimiter: char) -> String {
    let headers = [
        "Vorname",
        "Nachname",
        "Vollständiger Name",
        "Firma",
        "E-Mail-Adresse",
        "Telefon / Mobiltelefon",
        "Kontakt-Kategorie / Typ",
        "Strasse",
        "Postleitzahl",
        "Stadt",
        "Land",
        "USt-IdNr",
        "Notizen",
    ];
    let mut out = String::from("\u{feff}");
    out.push_str(&headers.join(&delimiter.to_string()));
    for contact in contacts {
        let name = contact.name.as_deref().unwrap_or("");
        let parts: Vec<&str> = name.split_whitespace().collect();
        let (first, last) = if parts.len() > 1 {
            (
                parts[..parts.len() - 1].join(" "),
                parts[parts.len() - 1].to_string(),
            )
        } else {
            (name.to_string(), String::new())
        };
        let kind = match contact.contact_type {
            ContactType::Guest => "Gästebuch / Privat",
            ContactType::Customer => "Kunde",
            ContactType::Vendor => "Lieferant",
            ContactType::Both => "Partner (Beides)",
        };
        let values = [
            first,
            last,
            name.to_string(),
            opt(contact.company_name.as_deref()),
            opt(contact.email.as_deref()),
            opt(contact.phone.as_deref()),
            kind.to_string(),
            opt(contact.street.as_deref()),
            opt(contact.zip.as_deref()),
            opt(contact.city.as_deref()),
            opt(contact.country.as_deref()),
            opt(contact.tax_id.as_deref()),
            opt(contact.notes.as_deref()),
        ];
        out.push_str("\r\n");
        out.push_str(
            &values
                .iter()
                .map(|v| csv_escape(v, delimiter))
                .collect::<Vec<_>>()
                .join(&delimiter.to_string()),
        );
    }
    out
}

/// Exports contacts as vCard 3.0, suitable for phones and address-book applications.
pub fn export_contacts_vcard(contacts: &[Contact]) -> String {
    contacts
        .iter()
        .map(|contact| {
            let name = contact
                .name
                .as_deref()
                .or(contact.company_name.as_deref())
                .unwrap_or("Kontakt");
            let parts: Vec<&str> = name.split_whitespace().collect();
            let (first, last) = if parts.len() > 1 {
                (parts[..parts.len() - 1].join(" "), parts[parts.len() - 1])
            } else {
                (name.to_string(), "")
            };
            let mut lines = vec![
                "BEGIN:VCARD".to_string(),
                "VERSION:3.0".to_string(),
                format!("FN:{}", escape_vcard(name)),
                format!("N:{};{};;;", escape_vcard(last), escape_vcard(&first)),
            ];
            if let Some(v) = contact.company_name.as_deref() {
                lines.push(format!("ORG:{}", escape_vcard(v)));
            }
            if let Some(v) = contact.email.as_deref() {
                lines.push(format!("EMAIL;TYPE=INTERNET:{}", escape_vcard(v)));
            }
            if let Some(v) = contact.phone.as_deref() {
                lines.push(format!("TEL;TYPE=CELL,VOICE:{}", escape_vcard(v)));
            }
            if contact.street.is_some()
                || contact.city.is_some()
                || contact.zip.is_some()
                || contact.country.is_some()
            {
                lines.push(format!(
                    "ADR;TYPE=HOME,WORK:;;{};{};;{};{}",
                    field(contact.street.as_deref()),
                    field(contact.city.as_deref()),
                    field(contact.zip.as_deref()),
                    field(contact.country.as_deref())
                ));
            }
            if let Some(v) = contact.notes.as_deref() {
                lines.push(format!("NOTE:{}", escape_vcard(v)));
            }
            lines.push("END:VCARD".to_string());
            lines.join("\r\n")
        })
        .collect::<Vec<_>>()
        .join("\r\n\r\n")
}

fn parse_csv_rows(input: &str) -> Vec<Vec<String>> {
    let sample = input.lines().next().unwrap_or("");
    let delimiter = [
        (',', sample.matches(',').count()),
        (';', sample.matches(';').count()),
        ('\t', sample.matches('\t').count()),
    ]
    .into_iter()
    .max_by_key(|(_, count)| *count)
    .map(|(c, _)| c)
    .unwrap_or(',');
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut value = String::new();
    let mut quoted = false;
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '"' if quoted && chars.peek() == Some(&'"') => {
                value.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            c if c == delimiter && !quoted => {
                row.push(value.trim().to_string());
                value.clear();
            }
            '\r' | '\n' if !quoted => {
                if ch == '\r' && chars.peek() == Some(&'\n') {
                    chars.next();
                }
                row.push(value.trim().to_string());
                value.clear();
                if row.iter().any(|v| !v.is_empty()) {
                    rows.push(std::mem::take(&mut row));
                } else {
                    row.clear();
                }
            }
            _ => value.push(ch),
        }
    }
    if !value.is_empty() || !row.is_empty() {
        row.push(value.trim().to_string());
        if row.iter().any(|v| !v.is_empty()) {
            rows.push(row);
        }
    }
    rows
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .to_lowercase()
        .replace(['_', '-'], " ")
}
fn parse_contact_type(value: &str, fallback: ContactType) -> ContactType {
    let v = value.to_lowercase();
    if v.contains("vendor") || v.contains("lieferant") {
        ContactType::Vendor
    } else if v.contains("guest")
        || v.contains("gast")
        || v.contains("buch")
        || v.contains("privat")
    {
        ContactType::Guest
    } else if v.contains("both") || v.contains("beide") || v.contains("partner") {
        ContactType::Both
    } else if v.contains("customer") || v.contains("kunde") {
        ContactType::Customer
    } else {
        fallback
    }
}
fn valid_email(value: &str) -> bool {
    value.is_empty()
        || (value.contains('@')
            && !value.contains("@import.local")
            && !value.contains("@kontakt.local"))
}
fn non_empty(value: &str) -> Option<String> {
    let v = value.trim();
    (!v.is_empty()).then(|| v.to_string())
}
fn opt(value: Option<&str>) -> String {
    value.unwrap_or("").to_string()
}
fn field(value: Option<&str>) -> String {
    escape_vcard(value.unwrap_or(""))
}
fn csv_escape(value: &str, _delimiter: char) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}
fn escape_vcard(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\r', "")
        .replace('\n', "\\n")
}
fn unescape_vcard(value: &str) -> String {
    let mut out = String::new();
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                out.push(match next {
                    'n' | 'N' => '\n',
                    other => other,
                });
            }
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_outlook_csv_with_quoted_multiline_fields_and_semicolon_delimiter() {
        let csv = "First Name;Last Name;Company;E-mail Address;Mobile Phone;Notes\r\n\"Ada\";Lovelace;Analytical Engines;ada@example.org;+44123;\"Line one\r\nLine two\"";
        let parsed = parse_contacts_csv(csv, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some("Ada Lovelace"));
        assert_eq!(
            parsed[0].company_name.as_deref(),
            Some("Analytical Engines")
        );
        assert_eq!(parsed[0].notes.as_deref(), Some("Line one\r\nLine two"));
    }
    #[test]
    fn prioritizes_first_and_last_name_and_mobile_phone_columns() {
        let csv = "First Name;Last Name;E-mail 1 Address;E-mail 2 Address;Mobile Phone;Business Phone;Home Phone\r\nAda;Lovelace;;ada@example.org;+44 123;020 111;020 222";
        let parsed = parse_contacts_csv(csv, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some("Ada Lovelace"));
        assert_eq!(parsed[0].email.as_deref(), Some("ada@example.org"));
        assert_eq!(parsed[0].phone.as_deref(), Some("+44 123"));
    }

    #[test]
    fn parses_vcard_and_round_trips_address_and_notes() {
        let vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Grace Hopper\r\nN:Hopper;Grace;;;\r\nEMAIL;TYPE=INTERNET:grace@example.org\r\nADR;TYPE=HOME:;;Navy Street 1;Arlington;;22201;USA\r\nNOTE:First line\\nSecond line\r\nEND:VCARD";
        let parsed = parse_contacts_vcard(vcf, ContactType::Customer, 5);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].city.as_deref(), Some("Arlington"));
        assert_eq!(parsed[0].notes.as_deref(), Some("First line\nSecond line"));
        let exported = export_contacts_vcard(&parsed);
        assert!(exported.contains("VERSION:3.0"));
        assert!(exported.contains("grace@example.org"));
    }
    #[test]
    fn csv_export_has_bom_escaped_quotes_and_round_trips() {
        let mut contact = Contact::new(ContactKind::Person, 1);
        contact.name = Some("Ada \"Countess\" Lovelace".to_string());
        contact.email = Some("ada@example.org".to_string());
        let csv = export_contacts_csv(&[contact], ';');
        assert!(csv.starts_with('\u{feff}'));
        assert!(csv.contains("\"\"Countess\"\""));
        let parsed = parse_contacts_csv(&csv, ContactType::Guest, 2);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].email.as_deref(), Some("ada@example.org"));
    }

    #[test]
    fn vcard_without_email_keeps_email_absent() {
        let vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:No Email\r\nTEL;TYPE=CELL:123456\r\nEND:VCARD";
        let parsed = parse_contacts_vcard(vcf, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].email, None);
    }

    #[test]
    fn csv_export_preserves_quoted_embedded_newlines() {
        let mut contact = Contact::new(ContactKind::Person, 1);
        contact.name = Some("Ada Lovelace".to_string());
        contact.notes = Some("first line\nsecond line".to_string());
        let csv = export_contacts_csv(&[contact], ';');
        let parsed = parse_contacts_csv(&csv, ContactType::Guest, 2);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].notes.as_deref(), Some("first line\nsecond line"));
    }

}
