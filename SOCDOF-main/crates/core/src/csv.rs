//! CSV import and export for contacts and products.
//!
//! The parser follows RFC 4180 (quoted fields, `""` escapes, embedded newlines) and auto-detects
//! comma, semicolon and tab, which covers the exports of Outlook, Google Contacts, Excel and the
//! legacy SOCDOF address book. Exports are always comma separated with a header row.
//!
//! Imports never guess silently: a row that cannot be turned into a valid record is skipped and
//! reported, and product rows with an existing SKU are skipped instead of creating duplicates.

use std::collections::HashSet;
use std::path::Path;

use serde::Serialize;

use crate::domain::contact::{Contact, ContactKind, ContactType};
use crate::domain::product::Product;
use crate::error::CoreResult;
use crate::money::Money;
use crate::now_millis;
use crate::store::Store;

/// A parsed CSV table.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CsvTable {
    /// Header row, trimmed.
    pub headers: Vec<String>,
    /// Data rows.
    pub rows: Vec<Vec<String>>,
}

/// Outcome of a CSV import.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ImportReport {
    /// Rows that were stored.
    pub imported: usize,
    /// Rows that were skipped (empty, duplicate or invalid), with one message each.
    pub skipped: usize,
    /// Reasons, in row order.
    pub errors: Vec<String>,
}

impl ImportReport {
    fn skip(&mut self, line: usize, reason: impl Into<String>) {
        self.skipped += 1;
        self.errors.push(format!("line {line}: {}", reason.into()));
    }
}

/// Contact columns written by [`export_contacts_csv`].
pub const CONTACT_HEADERS: [&str; 13] = [
    "name",
    "company",
    "first_name",
    "last_name",
    "street",
    "zip",
    "city",
    "country",
    "email",
    "phone",
    "tax_id",
    "type",
    "notes",
];

/// Product columns written by [`export_products_csv`].
pub const PRODUCT_HEADERS: [&str; 15] = [
    "name",
    "sku",
    "category",
    "unit",
    "price",
    "cost_price",
    "tax_rate",
    "stock",
    "reorder_level",
    "target_stock",
    "barcode",
    "description",
    "image_emoji",
    "active",
    "exclude_from_reorder",
];

/// Parses CSV text with delimiter detection.
pub fn parse_csv(text: &str) -> CsvTable {
    let delimiter = detect_delimiter(text);
    let rows = parse_rows(text, delimiter);
    let mut rows = rows.into_iter();

    let headers = rows.next().unwrap_or_default();
    CsvTable {
        headers,
        rows: rows.collect(),
    }
}

/// Serialises a table as comma separated CSV, quoting fields that need it.
pub fn write_csv(headers: &[&str], rows: &[Vec<String>]) -> String {
    let mut output = String::new();
    push_row(&mut output, headers.iter().map(|value| value.to_string()));
    for row in rows {
        push_row(&mut output, row.iter().cloned());
    }
    output
}

/// Writes all contacts to a CSV file and returns the row count.
pub fn export_contacts_csv(store: &Store, path: &Path) -> CoreResult<usize> {
    let contacts = store.list_contacts()?;
    let rows: Vec<Vec<String>> = contacts
        .iter()
        .map(|contact| {
            vec![
                contact.name.clone().unwrap_or_default(),
                contact.company_name.clone().unwrap_or_default(),
                contact.first_name.clone().unwrap_or_default(),
                contact.last_name.clone().unwrap_or_default(),
                contact.street.clone().unwrap_or_default(),
                contact.zip.clone().unwrap_or_default(),
                contact.city.clone().unwrap_or_default(),
                contact.country.clone().unwrap_or_default(),
                contact.email.clone().unwrap_or_default(),
                contact.phone.clone().unwrap_or_default(),
                contact.tax_id.clone().unwrap_or_default(),
                contact.contact_type.as_str().to_string(),
                contact.notes.clone().unwrap_or_default(),
            ]
        })
        .collect();

    let content = write_csv(&CONTACT_HEADERS, &rows);
    std::fs::write(path, content)?;
    Ok(rows.len())
}

/// Imports contacts from a CSV file. Header names may be English, German, French or Spanish.
pub fn import_contacts_csv(store: &Store, path: &Path) -> CoreResult<ImportReport> {
    let content = std::fs::read_to_string(path)?;
    let table = parse_csv(&content);
    let columns = ContactColumns::from_headers(&table.headers);
    let now = now_millis();

    let mut report = ImportReport::default();
    for (index, row) in table.rows.iter().enumerate() {
        let line = index + 2;

        let name = field(row, columns.name);
        let company = field(row, columns.company);
        let first_name = field(row, columns.first_name);
        let last_name = field(row, columns.last_name);
        let email = field(row, columns.email);

        if name.is_empty()
            && company.is_empty()
            && first_name.is_empty()
            && last_name.is_empty()
            && email.is_empty()
        {
            report.skip(line, "empty row");
            continue;
        }

        let mut contact = Contact::new(
            if company.is_empty() {
                ContactKind::Person
            } else {
                ContactKind::Company
            },
            now,
        );
        contact.name = optional(name);
        contact.company_name = optional(company);
        contact.first_name = optional(first_name);
        contact.last_name = optional(last_name);
        contact.street = optional(field(row, columns.street));
        contact.zip = optional(field(row, columns.zip));
        contact.city = optional(field(row, columns.city));
        contact.country = optional(field(row, columns.country));
        contact.email = optional(email);
        contact.phone = optional(field(row, columns.phone));
        contact.tax_id = optional(field(row, columns.tax_id));
        contact.notes = optional(field(row, columns.notes));

        let kind = field(row, columns.contact_type);
        if !kind.is_empty() {
            contact.contact_type = ContactType::from_legacy(Some(kind));
        }

        match contact.validate() {
            Ok(()) => match store.insert_contact(&contact) {
                Ok(()) => report.imported += 1,
                Err(error) => report.skip(line, error.to_string()),
            },
            Err(code) => report.skip(line, code),
        }
    }

    Ok(report)
}

/// Writes all products to a CSV file and returns the row count.
pub fn export_products_csv(store: &Store, path: &Path) -> CoreResult<usize> {
    let products = store.list_products()?;
    let rows: Vec<Vec<String>> = products
        .iter()
        .map(|product| {
            vec![
                product.name.clone(),
                product.sku.clone(),
                product.category.clone(),
                product.unit.clone(),
                product.price.to_decimal_string(),
                product.cost_price.to_decimal_string(),
                Money::from_cents(product.tax_rate_bp).to_decimal_string(),
                product.stock.to_string(),
                product.reorder_level.to_string(),
                product.target_stock.to_string(),
                product.barcode.clone().unwrap_or_default(),
                product.description.clone().unwrap_or_default(),
                product.image_emoji.clone().unwrap_or_default(),
                bool_text(product.active).to_string(),
                bool_text(product.exclude_from_reorder).to_string(),
            ]
        })
        .collect();

    let content = write_csv(&PRODUCT_HEADERS, &rows);
    std::fs::write(path, content)?;
    Ok(rows.len())
}

/// Imports products from a CSV file. Rows without a name or with an existing SKU are skipped.
pub fn import_products_csv(store: &Store, path: &Path) -> CoreResult<ImportReport> {
    let content = std::fs::read_to_string(path)?;
    let table = parse_csv(&content);
    let columns = ProductColumns::from_headers(&table.headers);
    let now = now_millis();

    let mut existing_skus: HashSet<String> = store
        .list_products()?
        .into_iter()
        .map(|product| product.sku.trim().to_lowercase())
        .filter(|sku| !sku.is_empty())
        .collect();

    let mut report = ImportReport::default();
    for (index, row) in table.rows.iter().enumerate() {
        let line = index + 2;
        let name = field(row, columns.name);
        if name.is_empty() {
            report.skip(line, "name_required");
            continue;
        }

        let sku = field(row, columns.sku).to_string();
        let sku_key = sku.trim().to_lowercase();
        if !sku_key.is_empty() && !existing_skus.insert(sku_key) {
            report.skip(line, "duplicate_sku");
            continue;
        }

        let mut product = Product::new(name, now);
        product.sku = sku;
        product.category = field(row, columns.category).to_string();
        let unit = field(row, columns.unit);
        if !unit.is_empty() {
            product.unit = unit.to_string();
        }
        product.price = Money::parse(field(row, columns.price)).unwrap_or_default();
        product.cost_price = Money::parse(field(row, columns.cost_price)).unwrap_or_default();
        product.tax_rate_bp = parse_tax_rate(field(row, columns.tax_rate)).unwrap_or(1900);
        product.stock = parse_integer(field(row, columns.stock));
        product.reorder_level = parse_integer(field(row, columns.reorder_level));
        product.target_stock = parse_integer(field(row, columns.target_stock));
        product.barcode = optional(field(row, columns.barcode));
        product.description = optional(field(row, columns.description));
        product.image_emoji = optional(field(row, columns.image_emoji));
        product.active = parse_bool(field(row, columns.active), true);
        product.exclude_from_reorder = parse_bool(field(row, columns.exclude_from_reorder), false);

        match product.validate() {
            Ok(()) => match store.insert_product(&product) {
                Ok(()) => report.imported += 1,
                Err(error) => report.skip(line, error.to_string()),
            },
            Err(code) => report.skip(line, code),
        }
    }

    Ok(report)
}

struct ContactColumns {
    name: Option<usize>,
    company: Option<usize>,
    first_name: Option<usize>,
    last_name: Option<usize>,
    street: Option<usize>,
    zip: Option<usize>,
    city: Option<usize>,
    country: Option<usize>,
    email: Option<usize>,
    phone: Option<usize>,
    tax_id: Option<usize>,
    contact_type: Option<usize>,
    notes: Option<usize>,
}

impl ContactColumns {
    fn from_headers(headers: &[String]) -> Self {
        ContactColumns {
            name: header_index(
                headers,
                &["name", "display name", "anzeigename", "nom affiché"],
            ),
            company: header_index(
                headers,
                &[
                    "company",
                    "firma",
                    "organisation",
                    "organization",
                    "entreprise",
                    "empresa",
                ],
            ),
            first_name: header_index(
                headers,
                &["first name", "vorname", "given name", "prénom", "nombre"],
            ),
            last_name: header_index(
                headers,
                &[
                    "last name",
                    "nachname",
                    "surname",
                    "family name",
                    "nom",
                    "apellido",
                ],
            ),
            street: header_index(
                headers,
                &[
                    "street",
                    "straße",
                    "strasse",
                    "address",
                    "adresse",
                    "dirección",
                ],
            ),
            zip: header_index(
                headers,
                &[
                    "zip",
                    "plz",
                    "postal code",
                    "postcode",
                    "code postal",
                    "código postal",
                ],
            ),
            city: header_index(headers, &["city", "ort", "stadt", "ville", "ciudad"]),
            country: header_index(headers, &["country", "land", "pays", "país"]),
            email: header_index(
                headers,
                &[
                    "email",
                    "e mail",
                    "e mail address",
                    "email address",
                    "mail",
                    "courriel",
                    "correo",
                ],
            ),
            phone: header_index(
                headers,
                &[
                    "phone",
                    "phone number",
                    "mobile phone",
                    "mobile",
                    "telefon",
                    "telefonnummer",
                    "tel",
                    "téléphone",
                    "teléfono",
                ],
            ),
            tax_id: header_index(
                headers,
                &["tax id", "ust idnr", "vat", "steuernummer", "tva", "nif"],
            ),
            contact_type: header_index(headers, &["type", "typ", "contact type", "kontaktart"]),
            notes: header_index(headers, &["notes", "notizen", "notes", "notas"]),
        }
    }
}

struct ProductColumns {
    name: Option<usize>,
    sku: Option<usize>,
    category: Option<usize>,
    unit: Option<usize>,
    price: Option<usize>,
    cost_price: Option<usize>,
    tax_rate: Option<usize>,
    stock: Option<usize>,
    reorder_level: Option<usize>,
    target_stock: Option<usize>,
    barcode: Option<usize>,
    description: Option<usize>,
    image_emoji: Option<usize>,
    active: Option<usize>,
    exclude_from_reorder: Option<usize>,
}

impl ProductColumns {
    fn from_headers(headers: &[String]) -> Self {
        ProductColumns {
            name: header_index(headers, &["name", "produktname", "produkt", "product"]),
            sku: header_index(
                headers,
                &["sku", "artikelnummer", "article number", "reference"],
            ),
            category: header_index(
                headers,
                &["category", "kategorie", "catégorie", "categoría"],
            ),
            unit: header_index(headers, &["unit", "einheit", "unité", "unidad"]),
            price: header_index(
                headers,
                &["price", "sale price", "verkaufspreis", "prix", "precio"],
            ),
            cost_price: header_index(
                headers,
                &[
                    "cost price",
                    "einkaufspreis",
                    "prix d'achat",
                    "precio de compra",
                ],
            ),
            tax_rate: header_index(headers, &["tax rate", "steuersatz", "taxe", "tva", "iva"]),
            stock: header_index(
                headers,
                &["stock", "bestand", "qty available", "menge", "existencias"],
            ),
            reorder_level: header_index(headers, &["reorder level", "meldebestand", "min qty"]),
            target_stock: header_index(headers, &["target stock", "zielbestand"]),
            barcode: header_index(headers, &["barcode", "ean", "gtin"]),
            description: header_index(headers, &["description", "beschreibung", "descripción"]),
            image_emoji: header_index(headers, &["image emoji", "emoji"]),
            active: header_index(headers, &["active", "aktiv", "actif", "activo"]),
            exclude_from_reorder: header_index(
                headers,
                &["exclude from reorder", "von nachbestellung ausnehmen"],
            ),
        }
    }
}

fn detect_delimiter(text: &str) -> char {
    let first_line = text.lines().next().unwrap_or("");
    let mut best = (',', 0usize);
    for candidate in [',', ';', '\t'] {
        let count = first_line.matches(candidate).count();
        if count > best.1 {
            best = (candidate, count);
        }
    }
    best.0
}

fn parse_rows(text: &str, delimiter: char) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut value = String::new();
    let mut in_quotes = false;
    let mut characters = text.chars().peekable();

    while let Some(character) = characters.next() {
        match character {
            '"' if in_quotes && characters.peek() == Some(&'"') => {
                value.push('"');
                characters.next();
            }
            '"' => in_quotes = !in_quotes,
            character if character == delimiter && !in_quotes => {
                row.push(value.trim().to_string());
                value.clear();
            }
            '\r' | '\n' if !in_quotes => {
                if character == '\r' && characters.peek() == Some(&'\n') {
                    characters.next();
                }
                row.push(value.trim().to_string());
                value.clear();
                if row.iter().any(|cell| !cell.is_empty()) {
                    rows.push(std::mem::take(&mut row));
                } else {
                    row.clear();
                }
            }
            other => value.push(other),
        }
    }

    if !value.trim().is_empty() || !row.is_empty() {
        row.push(value.trim().to_string());
        if row.iter().any(|cell| !cell.is_empty()) {
            rows.push(row);
        }
    }

    rows
}

fn push_row(output: &mut String, cells: impl Iterator<Item = String>) {
    let mut first = true;
    for cell in cells {
        if !first {
            output.push(',');
        }
        first = false;
        if cell.contains([',', '"', '\n', '\r']) {
            output.push('"');
            output.push_str(&cell.replace('"', "\"\""));
            output.push('"');
        } else {
            output.push_str(&cell);
        }
    }
    output.push_str("\r\n");
}

fn normalize_header(header: &str) -> String {
    header
        .trim()
        .to_lowercase()
        .replace(['-', '_'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn header_index(headers: &[String], aliases: &[&str]) -> Option<usize> {
    let normalized: Vec<String> = headers
        .iter()
        .map(|header| normalize_header(header))
        .collect();
    aliases.iter().find_map(|alias| {
        let alias = normalize_header(alias);
        normalized.iter().position(|header| header == &alias)
    })
}

fn field(row: &[String], index: Option<usize>) -> &str {
    index
        .and_then(|index| row.get(index))
        .map(String::as_str)
        .map(str::trim)
        .unwrap_or("")
}

fn optional(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn bool_text(value: bool) -> &'static str {
    if value {
        "true"
    } else {
        "false"
    }
}

fn parse_bool(value: &str, default: bool) -> bool {
    match value.trim().to_lowercase().as_str() {
        "" => default,
        "1" | "true" | "yes" | "ja" | "oui" | "sí" | "si" | "wahr" => true,
        "0" | "false" | "no" | "nein" | "non" | "falsch" => false,
        _ => default,
    }
}

fn parse_integer(value: &str) -> i64 {
    let value = value.trim();
    if value.is_empty() {
        return 0;
    }
    if let Ok(parsed) = value.parse::<i64>() {
        return parsed;
    }
    Money::parse(value)
        .map(|amount| amount.cents() / 100)
        .unwrap_or(0)
}

fn parse_tax_rate(value: &str) -> Option<i64> {
    let value = value.trim().trim_end_matches('%').trim();
    if value.is_empty() {
        return None;
    }
    // `19` or `19,5` is a percentage; the stored rate is basis points.
    Money::parse(value).map(|percent| percent.cents())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_quoted_fields_and_autodetects_semicolons() {
        let table = parse_csv("name;notes\r\n\"Muster, AG\";\"Zeile 1\nZeile 2\"\r\n");
        assert_eq!(table.headers, vec!["name", "notes"]);
        assert_eq!(table.rows.len(), 1);
        assert_eq!(table.rows[0][0], "Muster, AG");
        assert_eq!(table.rows[0][1], "Zeile 1\nZeile 2");
    }

    #[test]
    fn writes_and_reparses_quoted_values() {
        let content = write_csv(
            &["name", "notes"],
            &[vec![
                "Muster, AG".to_string(),
                "Er sagte \"Hallo\"".to_string(),
            ]],
        );
        assert!(content.contains("\"Muster, AG\""));
        assert!(content.contains("\"Er sagte \"\"Hallo\"\"\""));

        let table = parse_csv(&content);
        assert_eq!(table.rows[0][0], "Muster, AG");
        assert_eq!(table.rows[0][1], "Er sagte \"Hallo\"");
    }

    #[test]
    fn parses_numbers_and_booleans() {
        assert_eq!(parse_tax_rate("19"), Some(1900));
        assert_eq!(parse_tax_rate("19,5 %"), Some(1950));
        assert_eq!(parse_tax_rate(""), None);
        assert_eq!(parse_integer("1.250"), 1_250);
        assert_eq!(parse_integer(""), 0);
        assert!(parse_bool("ja", false));
        assert!(!parse_bool("nein", true));
        assert!(parse_bool("", true));
    }

    #[test]
    fn exports_and_imports_contacts_and_products() {
        use crate::domain::contact::{Contact, ContactKind, ContactType};
        use crate::domain::product::Product;
        use uuid::Uuid;

        let source = Store::open_in_memory().expect("store");
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.company_name = Some("Muster, AG".to_string());
        contact.email = Some("info@muster.ch".to_string());
        contact.notes = Some("Zeile 1\nZeile 2".to_string());
        contact.contact_type = ContactType::Vendor;
        source.insert_contact(&contact).expect("contact");

        let mut product = Product::new("Kaffee \"Bohnen\"", 0);
        product.sku = "PRD-1".to_string();
        product.price = Money::from_cents(499);
        product.cost_price = Money::from_cents(240);
        product.tax_rate_bp = 700;
        product.stock = 12;
        source.insert_product(&product).expect("product");

        let directory = std::env::temp_dir().join(format!("socdof-csv-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("dir");
        let contacts_path = directory.join("contacts.csv");
        let products_path = directory.join("products.csv");

        assert_eq!(
            export_contacts_csv(&source, &contacts_path).expect("export"),
            1
        );
        assert_eq!(
            export_products_csv(&source, &products_path).expect("export"),
            1
        );

        let target = Store::open_in_memory().expect("store");
        let contact_report = import_contacts_csv(&target, &contacts_path).expect("import");
        assert_eq!(contact_report.imported, 1);
        assert_eq!(contact_report.skipped, 0);

        let product_report = import_products_csv(&target, &products_path).expect("import");
        assert_eq!(product_report.imported, 1);
        assert_eq!(product_report.skipped, 0);

        let imported_contact = &target.list_contacts().expect("contacts")[0];
        assert_eq!(imported_contact.company_name.as_deref(), Some("Muster, AG"));
        assert_eq!(imported_contact.notes.as_deref(), Some("Zeile 1\nZeile 2"));
        assert_eq!(imported_contact.contact_type, ContactType::Vendor);

        let imported_product = &target.list_products().expect("products")[0];
        assert_eq!(imported_product.name, "Kaffee \"Bohnen\"");
        assert_eq!(imported_product.price, Money::from_cents(499));
        assert_eq!(imported_product.cost_price, Money::from_cents(240));
        assert_eq!(imported_product.tax_rate_bp, 700);
        assert_eq!(imported_product.stock, 12);

        // Importing the same product again must not create a duplicate.
        let again = import_products_csv(&target, &products_path).expect("import");
        assert_eq!(again.imported, 0);
        assert_eq!(again.skipped, 1);
        assert!(again.errors[0].contains("duplicate_sku"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn imports_outlook_style_headers_and_skips_invalid_rows() {
        use uuid::Uuid;
        let directory = std::env::temp_dir().join(format!("socdof-csv-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("dir");
        let path = directory.join("outlook.csv");
        std::fs::write(
            &path,
            "First Name,Last Name,E-mail Address,Mobile Phone,Company\n\
             Anna,Weber,anna@example.com,+49 170 1234567,AlpenTech\n\
             ,,not-an-email,,\n",
        )
        .expect("file");

        let store = Store::open_in_memory().expect("store");
        let report = import_contacts_csv(&store, &path).expect("import");
        assert_eq!(report.imported, 1);
        assert_eq!(report.skipped, 1);

        let contact = &store.list_contacts().expect("contacts")[0];
        assert_eq!(contact.first_name.as_deref(), Some("Anna"));
        assert_eq!(contact.last_name.as_deref(), Some("Weber"));
        assert_eq!(contact.phone.as_deref(), Some("+49 170 1234567"));
        assert_eq!(contact.kind, ContactKind::Company);

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn missing_file_is_an_error() {
        use crate::error::CoreError;

        let store = Store::open_in_memory().expect("store");
        let error = import_contacts_csv(&store, Path::new("/nonexistent/socdof.csv"));
        assert!(matches!(error, Err(CoreError::Io(_))));
    }
}
