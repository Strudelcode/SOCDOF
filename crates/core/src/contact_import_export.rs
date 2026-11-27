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
        "given yomi",
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
        "surname yomi",
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
        "contact",
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
        "e-mail address",
        "email address",
        "e-mail 1 address",
        "e-mail 2 address",
        "e-mail 3 address",
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
        "cell",
        "cellular",
        "mobile",
        "primary phone",
        "main phone",
        "company main phone",
        "haupttelefon",
        "business phone 2",
        "business phone",
        "work phone",
        "telefon geschäftlich",
        "geschäftlich",
        "home phone 2",
        "home phone",
        "telefon privat",
        "privattelefon",
        "privat",
        "phone",
        "telefon",
        "tel",
        "telefono",
        "téléphone",
    ]);
    let street = find_all(&[
        "business street",
        "home street",
        "other street",
        "street",
        "strasse",
        "straße",
        "adresse",
        "address",
        "calle",
        "via",
    ]);
    let zip = find_all(&[
        "business postal code",
        "home postal code",
        "other postal code",
        "postal code",
        "zip",
        "plz",
        "postleitzahl",
        "code postal",
        "código postal",
        "cap",
    ]);
    let city = find_all(&[
        "business city",
        "home city",
        "other city",
        "city",
        "stadt",
        "ort",
        "ville",
        "ciudad",
        "comune",
        "località",
    ]);
    let country = find_all(&[
        "business country/region",
        "home country/region",
        "other country/region",
        "country/region",
        "country",
        "land",
        "pays",
        "país",
        "stato",
        "nazione",
    ]);
    let tax = find_all(&[
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
    let notes = find_all(&[
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
                    .map(|s| clean_csv_cell(s))
                    .unwrap_or_default()
            };
            let value_all = |indices: &[usize]| {
                indices
                    .iter()
                    .filter_map(|index| row.get(*index))
                    .map(|item| clean_csv_cell(item))
                    .find(|item| !item.is_empty())
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
                .map(|value| clean_csv_cell(value))
                .find(|value| valid_email(value) && value.contains('@'))
                .unwrap_or_default();
            contact.email = non_empty(&email_value);
            let phone_value = phones
                .iter()
                .filter_map(|index| row.get(*index))
                .map(|value| clean_csv_cell(value))
                .find(|value| {
                    value
                        .chars()
                        .filter(|ch| ch.is_ascii_digit() || *ch == '+')
                        .count()
                        >= 3
                })
                .unwrap_or_default();
            contact.phone = non_empty(&phone_value);
            contact.street = non_empty(&value_all(&street));
            contact.zip = non_empty(&value_all(&zip));
            contact.city = non_empty(&value_all(&city));
            contact.country = non_empty(&value_all(&country));
            contact.tax_id = non_empty(&value_all(&tax));
            contact.notes = non_empty(&value_all(&notes));
            contact.contact_type = kind
                .map(|i| {
                    parse_contact_type(
                        &row.get(i)
                            .map(|value| clean_csv_cell(value))
                            .unwrap_or_default(),
                        default_type,
                    )
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
    let mut in_card = false;
    for raw in input.lines() {
        let line = raw.trim_end_matches('\r');
        if line.eq_ignore_ascii_case("BEGIN:VCARD") {
            if in_card && !current.is_empty() {
                cards.push(std::mem::take(&mut current));
            }
            current.clear();
            in_card = true;
            continue;
        }
        if line.eq_ignore_ascii_case("END:VCARD") {
            if in_card && !current.is_empty() {
                cards.push(std::mem::take(&mut current));
            }
            current.clear();
            in_card = false;
            continue;
        }
        if !in_card {
            continue;
        }
        if let Some(last) = current.last_mut() {
            if is_quoted_printable_property(last) && last.ends_with('=') {
                last.pop();
                last.push_str(line.trim_start());
                continue;
            }
        }
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(last) = current.last_mut() {
                last.push_str(line.trim_start());
            }
        } else if !line.is_empty() {
            current.push(line.to_string());
        }
    }
    // A truncated final card is still useful when its properties are complete.
    if in_card && !current.is_empty() {
        cards.push(current);
    }
    let mut contacts = Vec::new();
    for (index, lines) in cards.iter().enumerate() {
        let property = |wanted: &str| -> Option<String> {
            vcard_property_values(lines, wanted).into_iter().next()
        };
        let fn_name = property("FN").unwrap_or_default().trim().to_string();
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
        let company = property("ORG")
            .unwrap_or_default()
            .replace(';', " ")
            .trim()
            .to_string();
        let name = if name.is_empty() {
            company.clone()
        } else {
            name
        };
        let clean_email = vcard_property_values(lines, "EMAIL")
            .into_iter()
            .map(|email| email.trim().to_string())
            .find(|email| !email.is_empty() && email.contains('@') && valid_email(email));
        let phone = vcard_property_values(lines, "TEL")
            .into_iter()
            .map(|phone| {
                let phone = phone.trim();
                phone
                    .strip_prefix("tel:")
                    .or_else(|| phone.strip_prefix("TEL:"))
                    .unwrap_or(phone)
                    .trim()
                    .to_string()
            })
            .find(|phone| {
                phone
                    .chars()
                    .filter(|character| character.is_ascii_digit() || *character == '+')
                    .count()
                    >= 3
            })
            .unwrap_or_default();
        if name.is_empty() && clean_email.is_none() && phone.is_empty() {
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
        contact.email = clean_email;
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
        let (first, last) = legacy_name_parts(name);
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
            let person_name = non_empty_export_value(contact.name.as_deref());
            let company_name = non_empty_export_value(contact.company_name.as_deref());
            let name = person_name.or(company_name).unwrap_or("Kontakt");
            let (first, last) = legacy_name_parts(person_name.unwrap_or(""));
            let mut lines = vec![
                "BEGIN:VCARD".to_string(),
                "VERSION:3.0".to_string(),
                format!("FN:{}", escape_vcard(name)),
                format!("N:{};{};;;", escape_vcard(&last), escape_vcard(&first)),
            ];
            if let Some(v) = company_name {
                lines.push(format!("ORG:{}", escape_vcard(v)));
            }
            if let Some(v) = non_empty_export_value(contact.email.as_deref()) {
                lines.push(format!("EMAIL;TYPE=INTERNET:{}", escape_vcard(v)));
            }
            if let Some(v) = non_empty_export_value(contact.phone.as_deref()) {
                lines.push(format!("TEL;TYPE=CELL,VOICE:{}", escape_vcard(v)));
            }
            let street = non_empty_export_value(contact.street.as_deref());
            let city = non_empty_export_value(contact.city.as_deref());
            let zip = non_empty_export_value(contact.zip.as_deref());
            let country = non_empty_export_value(contact.country.as_deref());
            if street.is_some() || city.is_some() || zip.is_some() || country.is_some() {
                lines.push(format!(
                    "ADR;TYPE=HOME,WORK:;;{};{};;{};{}",
                    field(street),
                    field(city),
                    field(zip),
                    field(country)
                ));
            }
            if let Some(v) = non_empty_export_value(contact.notes.as_deref()) {
                lines.push(format!("NOTE:{}", escape_vcard(v)));
            }
            lines.push("END:VCARD".to_string());
            lines
                .iter()
                .map(|line| fold_vcard_line(line))
                .collect::<Vec<_>>()
                .join("\r\n")
        })
        .collect::<Vec<_>>()
        .join("\r\n\r\n")
}

fn legacy_name_parts(name: &str) -> (String, String) {
    let parts: Vec<&str> = name.trim().split(' ').collect();
    if parts.len() > 1 {
        (
            parts[..parts.len() - 1].join(" "),
            parts[parts.len() - 1].to_string(),
        )
    } else {
        let first = parts.join(" ");
        (
            if first.is_empty() {
                name.to_string()
            } else {
                first
            },
            String::new(),
        )
    }
}

fn fold_vcard_line(line: &str) -> String {
    let mut output = String::new();
    let mut column = 0;
    for character in line.chars() {
        let width = character.len_utf8();
        if column + width > 75 {
            output.push_str("\r\n ");
            column = 1;
        }
        output.push(character);
        column += width;
    }
    output
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
                row.push(clean_csv_cell(&value));
                value.clear();
            }
            '\r' | '\n' if !quoted => {
                if ch == '\r' && chars.peek() == Some(&'\n') {
                    chars.next();
                }
                row.push(clean_csv_cell(&value));
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
    // An unmatched quote makes the trailing record ambiguous. Keep complete rows and
    // discard only the malformed tail instead of merging the rest of the file into one contact.
    if quoted {
        return rows;
    }
    if !value.is_empty() || !row.is_empty() {
        row.push(clean_csv_cell(&value));
        if row.iter().any(|v| !v.is_empty()) {
            rows.push(row);
        }
    }
    rows
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch| ch == '"' || ch == '\'')
        .to_lowercase()
        .replace(['_', '-'], " ")
}
fn clean_csv_cell(value: &str) -> String {
    let value = value.trim();
    let value = if value.starts_with('"') || value.starts_with('\'') {
        &value[1..]
    } else {
        value
    };
    let value = if value.ends_with('"') || value.ends_with('\'') {
        &value[..value.len() - 1]
    } else {
        value
    };
    value.trim().to_string()
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
fn non_empty_export_value(value: Option<&str>) -> Option<&str> {
    value.filter(|value| !value.is_empty())
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
fn is_quoted_printable_property(line: &str) -> bool {
    let Some((name, _)) = line.split_once(':') else {
        return false;
    };
    name.split(';').skip(1).any(|parameter| {
        parameter
            .trim()
            .eq_ignore_ascii_case("ENCODING=QUOTED-PRINTABLE")
            || parameter.trim().eq_ignore_ascii_case("ENCODING=QP")
    })
}

fn decode_vcard_value(value: &str, parameters: &[&str]) -> String {
    let quoted_printable = parameters.iter().any(|parameter| {
        parameter
            .trim()
            .eq_ignore_ascii_case("ENCODING=QUOTED-PRINTABLE")
            || parameter.trim().eq_ignore_ascii_case("ENCODING=QP")
    });
    if !quoted_printable {
        return value.to_string();
    }
    let charset = parameters.iter().find_map(|parameter| {
        let (key, value) = parameter.trim().split_once('=')?;
        key.eq_ignore_ascii_case("CHARSET")
            .then(|| value.trim_matches('"').to_ascii_lowercase())
    });
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'=' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_digit(bytes[index + 1]), hex_digit(bytes[index + 2]))
            {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    match charset.as_deref() {
        Some("iso-8859-1") | Some("latin1") | Some("latin-1") => {
            decoded.into_iter().map(char::from).collect()
        }
        Some("windows-1252") | Some("cp1252") => decode_windows_1252(&decoded),
        _ => String::from_utf8_lossy(&decoded).into_owned(),
    }
}

fn hex_digit(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn decode_windows_1252(bytes: &[u8]) -> String {
    const EXTENDED: [char; 32] = [
        '\u{20ac}', '\u{0081}', '\u{201a}', '\u{0192}', '\u{201e}', '\u{2026}', '\u{2020}',
        '\u{2021}', '\u{02c6}', '\u{2030}', '\u{0160}', '\u{2039}', '\u{0152}', '\u{008d}',
        '\u{017d}', '\u{008f}', '\u{0090}', '\u{2018}', '\u{2019}', '\u{201c}', '\u{201d}',
        '\u{2022}', '\u{2013}', '\u{2014}', '\u{02dc}', '\u{2122}', '\u{0161}', '\u{203a}',
        '\u{0153}', '\u{009d}', '\u{017e}', '\u{0178}',
    ];
    bytes
        .iter()
        .map(|byte| match *byte {
            0x80..=0x9f => EXTENDED[usize::from(*byte - 0x80)],
            value => char::from(value),
        })
        .collect()
}

fn vcard_property_values(lines: &[String], wanted: &str) -> Vec<String> {
    lines
        .iter()
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            let mut parts = name.split(';');
            let key = parts.next()?.split('.').next_back()?;
            if !key.eq_ignore_ascii_case(wanted) {
                return None;
            }
            let parameters = parts.collect::<Vec<_>>();
            Some(unescape_vcard(&decode_vcard_value(value, &parameters)))
        })
        .collect()
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
    fn parses_single_quoted_header_and_value_cells_like_the_typescript_importer() {
        let csv = "'First Name';'Last Name';'E-mail Address'\n'Ada';'Lovelace';'ada@example.org'";
        let parsed = parse_contacts_csv(csv, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some("Ada Lovelace"));
        assert_eq!(parsed[0].email.as_deref(), Some("ada@example.org"));
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
    fn exports_csv_and_vcard_bytes_like_the_typescript_reference() {
        let mut contact = Contact::new(ContactKind::Person, 1);
        contact.name = Some(" Ada Lovelace ".to_string());
        contact.company_name = Some("Analytical Engines".to_string());
        contact.email = Some("ada@example.org".to_string());
        contact.phone = Some("+44 20 0000".to_string());
        contact.street = Some("1 Analytical Lane".to_string());
        contact.zip = Some("N1 1AA".to_string());
        contact.city = Some("London".to_string());
        contact.country = Some("UK".to_string());
        contact.tax_id = Some("GB123".to_string());
        contact.notes = Some("line one\nline two".to_string());

        assert_eq!(
            export_contacts_csv(&[contact.clone()], ';'),
            concat!(
                "\u{feff}Vorname;Nachname;Vollständiger Name;Firma;E-Mail-Adresse;",
                "Telefon / Mobiltelefon;Kontakt-Kategorie / Typ;Strasse;Postleitzahl;",
                "Stadt;Land;USt-IdNr;Notizen\r\n",
                "\"Ada\";\"Lovelace\";\" Ada Lovelace \";\"Analytical Engines\";",
                "\"ada@example.org\";\"+44 20 0000\";\"Kunde\";\"1 Analytical Lane\";",
                "\"N1 1AA\";\"London\";\"UK\";\"GB123\";\"line one\nline two\""
            )
        );
        assert_eq!(
            export_contacts_vcard(&[contact]),
            concat!(
                "BEGIN:VCARD\r\nVERSION:3.0\r\nFN: Ada Lovelace \r\n",
                "N:Lovelace;Ada;;;\r\nORG:Analytical Engines\r\n",
                "EMAIL;TYPE=INTERNET:ada@example.org\r\n",
                "TEL;TYPE=CELL,VOICE:+44 20 0000\r\n",
                "ADR;TYPE=HOME,WORK:;;1 Analytical Lane;London;;N1 1AA;UK\r\n",
                "NOTE:line one\\nline two\r\nEND:VCARD"
            )
        );
    }

    #[test]
    fn company_only_vcard_uses_company_for_fn_but_keeps_person_name_empty() {
        let mut contact = Contact::new(ContactKind::Company, 1);
        contact.company_name = Some("Acme Ltd".to_string());
        contact.email = Some(String::new());
        contact.phone = Some(String::new());
        contact.street = Some(String::new());
        contact.notes = Some(String::new());

        assert_eq!(
            export_contacts_vcard(&[contact]),
            concat!(
                "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Acme Ltd\r\n",
                "N:;;;;\r\nORG:Acme Ltd\r\nEND:VCARD"
            )
        );
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

    #[test]
    fn falls_back_to_non_empty_home_address_columns_and_maps_legacy_guest_type() {
        let csv = concat!(
            "Type;Business Street;Home Street;Business City;Home City;",
            "Business Postal Code;Home Postal Code;Business Country/Region;Home Country/Region\r\n",
            "Buch;;Home Lane;;London;;N1 1AA;;United Kingdom"
        );
        let parsed = parse_contacts_csv(csv, ContactType::Customer, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].contact_type, ContactType::Guest);
        assert_eq!(parsed[0].street.as_deref(), Some("Home Lane"));
        assert_eq!(parsed[0].city.as_deref(), Some("London"));
        assert_eq!(parsed[0].zip.as_deref(), Some("N1 1AA"));
        assert_eq!(parsed[0].country.as_deref(), Some("United Kingdom"));
    }

    #[test]
    fn supports_vcard_21_40_grouped_properties_and_uri_phones() {
        let vcf = concat!(
            "BEGIN:VCARD\r\nVERSION:2.1\r\n",
            "item1.EMAIL;TYPE=INTERNET:old@example.org\r\n",
            "FN:First Card\r\nTEL;HOME;VOICE:12345\r\nEND:VCARD\r\n",
            "BEGIN:VCARD\nVERSION:4.0\nFN:Second Card\n",
            "EMAIL;TYPE=work:not-an-email\nTEL;VALUE=uri:tel:+49-123\n"
        );
        let parsed = parse_contacts_vcard(vcf, ContactType::Guest, 10);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].email.as_deref(), Some("old@example.org"));
        assert_eq!(parsed[1].email, None);
        assert_eq!(parsed[1].phone.as_deref(), Some("+49-123"));
    }

    #[test]
    fn decodes_vcard_21_quoted_printable_and_soft_line_breaks() {
        let vcf = concat!(
            "BEGIN:VCARD\r\nVERSION:2.1\r\n",
            "FN;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:J=F6rg M=FCller\r\n",
            "NOTE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Gr=C3=BC=C3=9Fe =\r\n",
            "an die Welt\r\nEND:VCARD"
        );
        let parsed = parse_contacts_vcard(vcf, ContactType::Customer, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some("Jörg Müller"));
        assert_eq!(parsed[0].notes.as_deref(), Some("Grüße an die Welt"));
    }

    #[test]
    fn selects_first_valid_email_and_phone_from_multiple_vcard_properties() {
        let vcf = concat!(
            "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Multiple Channels\r\n",
            "EMAIL;TYPE=WORK:not-an-email\r\n",
            "item2.EMAIL;TYPE=HOME:person@example.org\r\n",
            "TEL;TYPE=HOME:--\r\n",
            "item3.TEL;TYPE=CELL:tel:+49-12345\r\n",
            "END:VCARD"
        );
        let parsed = parse_contacts_vcard(vcf, ContactType::Customer, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].email.as_deref(), Some("person@example.org"));
        assert_eq!(parsed[0].phone.as_deref(), Some("+49-12345"));
    }

    #[test]
    fn vcard_export_folds_long_utf8_lines_without_splitting_characters() {
        let mut contact = Contact::new(ContactKind::Person, 1);
        contact.name = Some("Ä".repeat(100));
        let exported = export_contacts_vcard(&[contact]);
        assert!(exported.contains("\r\n "));
        for line in exported.split("\r\n") {
            assert!(line.len() <= 75 || line.starts_with(' '));
        }
        let parsed = parse_contacts_vcard(&exported, ContactType::Guest, 2);
        let expected = "Ä".repeat(100);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some(expected.as_str()));
    }

    #[test]
    fn skips_malformed_unclosed_csv_tail_without_losing_complete_rows() {
        let csv = concat!(
            "First Name;E-mail Address\r\n",
            "Ada;ada@example.org\r\n",
            "Grace;\"unterminated value"
        );
        let parsed = parse_contacts_csv(csv, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name.as_deref(), Some("Ada"));
    }

    #[test]
    fn ignores_blank_csv_rows_but_preserves_duplicate_contacts() {
        let csv = concat!(
            "Name;E-mail Address\r\n",
            "Ada;ada@example.org\r\n",
            "\r\n",
            "Ada;ada@example.org\r\n"
        );
        let parsed = parse_contacts_csv(csv, ContactType::Guest, 1);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].email, parsed[1].email);
    }

    #[test]
    fn parses_large_contact_csv_without_dropping_rows() {
        use std::fmt::Write as _;

        let mut csv = String::from("First Name;E-mail Address\r\n");
        for index in 0..5_000 {
            writeln!(&mut csv, "Contact {index};contact{index}@example.org")
                .expect("write CSV row");
        }
        let parsed = parse_contacts_csv(&csv, ContactType::Customer, 1);
        assert_eq!(parsed.len(), 5_000);
        assert_eq!(parsed[4_999].name.as_deref(), Some("Contact 4999"));
    }

    #[test]
    fn skips_vcard_with_only_a_legacy_dummy_email() {
        let vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nEMAIL:legacy@import.local\r\nEND:VCARD";
        let parsed = parse_contacts_vcard(vcf, ContactType::Guest, 1);
        assert!(parsed.is_empty());
    }
}
