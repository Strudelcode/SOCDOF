//! Legacy backup compatibility.
//!
//! The shipping TypeScript application exports one JSON document per backup:
//! `app`, `version`, export metadata, `contacts`, `products`, `stock_moves`,
//! `invoices`, `purchase_orders`, `pos_orders`, `chatter_messages` and `settings`.
//! This module reads that document into SQLite and writes it back in the same shape.
//!
//! Unknown tables and unknown fields inside contacts/products are retained in the original
//! document (stored under [`RAW_BACKUP_KEY`]) and in each row's `legacy_json` column. A round trip
//! therefore only changes the tables this Rust application actually owns.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::domain::contact::ContactPerson;

use crate::date::format_iso8601;
use crate::domain::contact::{Contact, ContactKind, ContactType};
use crate::domain::product::Product;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::now_millis;
use crate::store::{contacts, products, settings, Store};

/// Settings key that keeps the original document for unsupported tables and fields.
pub const RAW_BACKUP_KEY: &str = "legacy_backup_raw";

/// The application marker written by the legacy exporter.
pub const LEGACY_APP: &str = "SOCDOF_Enterprise_Local_ERP";

/// Summary returned after importing a legacy backup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LegacyImportReport {
    /// Number of contacts imported.
    pub contacts: usize,
    /// Number of products imported.
    pub products: usize,
    /// Number of invoices preserved in the raw document.
    pub invoices: usize,
}

/// Summary returned after exporting a legacy backup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LegacyExportReport {
    /// Path of the written document.
    pub path: PathBuf,
    /// Size in bytes.
    pub bytes: u64,
    /// Number of contacts in the document.
    pub contacts: usize,
    /// Number of products in the document.
    pub products: usize,
    /// Number of invoices in the document.
    pub invoices: usize,
}

/// Imports a legacy backup file into `store`.
///
/// The legacy document is a complete snapshot. Contacts, products, invoices and stock movements
/// already in the SQLite database are replaced; user accounts and application settings are not
/// touched. Unknown tables survive through [`RAW_BACKUP_KEY`] and are written back by [`export`].
pub fn import(store: &Store, path: &Path) -> CoreResult<LegacyImportReport> {
    let bytes = std::fs::read(path)?;
    import_json(store, &bytes)
}

/// Imports a legacy backup from bytes.
pub fn import_json(store: &Store, bytes: &[u8]) -> CoreResult<LegacyImportReport> {
    let root: Value = serde_json::from_slice(bytes)
        .map_err(|_| CoreError::Validation("legacy_invalid_json".into()))?;
    let object = root
        .as_object()
        .ok_or_else(|| CoreError::Validation("legacy_invalid_document".into()))?;

    for required in ["contacts", "products", "invoices"] {
        if !object.get(required).is_some_and(Value::is_array) {
            return Err(CoreError::Validation(format!("legacy_missing_{required}")));
        }
    }

    let now = now_millis();
    let contacts = parse_contacts(
        object
            .get("contacts")
            .and_then(Value::as_array)
            .expect("validated contacts"),
        now,
    )?;
    let products = parse_products(
        object
            .get("products")
            .and_then(Value::as_array)
            .expect("validated products"),
        now,
    )?;
    let invoices = object
        .get("invoices")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);

    let transaction = store.connection().unchecked_transaction()?;
    transaction.execute("DELETE FROM invoice_lines", [])?;
    transaction.execute("DELETE FROM invoices", [])?;
    transaction.execute("DELETE FROM stock_moves", [])?;
    transaction.execute("DELETE FROM contacts", [])?;
    transaction.execute("DELETE FROM products", [])?;

    for contact in &contacts {
        contacts::insert(&transaction, contact)?;
    }
    for product in &products {
        products::insert(&transaction, product)?;
    }
    settings::put(&transaction, RAW_BACKUP_KEY, &root)?;
    transaction.commit()?;

    Ok(LegacyImportReport {
        contacts: contacts.len(),
        products: products.len(),
        invoices,
    })
}

/// Exports the current SQLite data as a legacy JSON backup.
pub fn export(store: &Store, path: &Path) -> CoreResult<LegacyExportReport> {
    let document = build_export(store)?;
    let bytes = serde_json::to_vec_pretty(&document)?;
    std::fs::write(path, &bytes)?;

    Ok(LegacyExportReport {
        path: path.to_path_buf(),
        bytes: bytes.len() as u64,
        contacts: document
            .get("contacts")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
        products: document
            .get("products")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
        invoices: document
            .get("invoices")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
    })
}

/// Builds the legacy JSON document without writing it to disk.
pub fn build_export(store: &Store) -> CoreResult<Value> {
    let raw = store.get_setting(RAW_BACKUP_KEY)?;
    let mut root = raw.unwrap_or_else(empty_document);
    let object = root
        .as_object_mut()
        .ok_or_else(|| CoreError::Validation("legacy_stored_document_invalid".into()))?;

    let contacts = store.list_contacts()?;
    let products = store.list_products()?;

    object.insert(
        "contacts".to_string(),
        Value::Array(export_contacts(&contacts)),
    );
    object.insert(
        "products".to_string(),
        Value::Array(export_products(&products)),
    );
    object.insert(
        "exported_at".to_string(),
        Value::String(format_iso8601(now_millis())),
    );

    let counts = json!({
        "contacts_count": contacts.len(),
        "products_count": products.len(),
        "invoices_count": array_len(object.get("invoices")),
        "purchases_count": array_len(object.get("purchase_orders")),
    });
    object.insert("data_summary".to_string(), counts);

    Ok(root)
}

fn parse_contacts(values: &[Value], now: i64) -> CoreResult<Vec<Contact>> {
    let mut ids = BTreeSet::new();
    let mut next_id = 1;
    let mut contacts = Vec::with_capacity(values.len());

    for value in values {
        let object = value
            .as_object()
            .ok_or_else(|| CoreError::Validation("legacy_contact_invalid".into()))?;
        let id = object.get("id").and_then(value_as_i64);
        let id = match id {
            Some(id) => {
                if !ids.insert(id) {
                    return Err(CoreError::Validation("legacy_contact_duplicate_id".into()));
                }
                id
            }
            None => {
                while ids.contains(&next_id) {
                    next_id += 1;
                }
                ids.insert(next_id);
                next_id
            }
        };

        let name = text(object.get("name"));
        let company = text(object.get("company"));
        let first_name = text(object.get("first_name")).or_else(|| text(object.get("firstName")));
        let last_name = text(object.get("last_name")).or_else(|| text(object.get("lastName")));
        let is_company = object
            .get("is_company")
            .and_then(Value::as_bool)
            .unwrap_or_else(|| !company.as_deref().unwrap_or("").trim().is_empty());
        let contact_type = ContactType::from_legacy(object.get("type").and_then(Value::as_str));

        let mut contact = Contact::new(
            if is_company {
                ContactKind::Company
            } else {
                ContactKind::Person
            },
            now,
        );
        contact.contact_type = contact_type;
        contact.name = name;
        contact.company_name = company;
        contact.first_name = first_name;
        contact.last_name = last_name;
        contact.street = text(object.get("street"));
        contact.zip = text(object.get("zip"));
        contact.city = text(object.get("city"));
        contact.country = text(object.get("country"));
        contact.email = text(object.get("email"));
        contact.phone = text(object.get("phone"));
        contact.tax_id = text(object.get("taxId")).or_else(|| text(object.get("tax_id")));
        contact.notes = text(object.get("notes"));
        contact.contact_persons = parse_contact_persons(object.get("contact_persons"));
        contact.ensure_single_primary_contact_person();
        contact.legacy_id = Some(id);
        contact.legacy_json = Some(serde_json::to_string(value)?);
        contact.validate().map_err(CoreError::Validation)?;
        contacts.push(contact);
    }

    Ok(contacts)
}

/// Reads the `contact_persons` array of one legacy contact in its stored order.
///
/// A person without an id keeps a deterministic one derived from its position, and the field names
/// stay those of `SOCDOF - TS/src/types.ts`.
fn parse_contact_persons(value: Option<&Value>) -> Vec<ContactPerson> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut persons = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let Some(object) = item.as_object() else {
            continue;
        };
        let id = text(object.get("id"))
            .unwrap_or_else(|| ContactPerson::draft_id(0, &format!("legacy{index}")));
        let mut person = ContactPerson::draft(
            id,
            object
                .get("is_primary")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        );
        person.first_name = text(object.get("first_name")).unwrap_or_default();
        person.last_name = text(object.get("last_name")).unwrap_or_default();
        person.email = text(object.get("email")).unwrap_or_default();
        person.phone = text(object.get("phone")).unwrap_or_default();
        person.role = text(object.get("role")).unwrap_or_default();
        persons.push(person);
    }
    persons
}

fn parse_products(values: &[Value], now: i64) -> CoreResult<Vec<Product>> {
    let mut ids = BTreeSet::new();
    let mut next_id = 1;
    let mut products = Vec::with_capacity(values.len());

    for value in values {
        let object = value
            .as_object()
            .ok_or_else(|| CoreError::Validation("legacy_product_invalid".into()))?;
        let id = object.get("id").and_then(value_as_i64);
        let id = match id {
            Some(id) => {
                if !ids.insert(id) {
                    return Err(CoreError::Validation("legacy_product_duplicate_id".into()));
                }
                id
            }
            None => {
                while ids.contains(&next_id) {
                    next_id += 1;
                }
                ids.insert(next_id);
                next_id
            }
        };

        let name = text(object.get("name"))
            .ok_or_else(|| CoreError::Validation("legacy_product_name_missing".into()))?;
        let mut product = Product::new(name, now);
        product.sku = text(object.get("sku")).unwrap_or_default();
        product.category = text(object.get("category")).unwrap_or_default();
        product.unit = text(object.get("unit")).unwrap_or_else(|| "Stk".to_string());
        product.price = money_from_number(object.get("sale_price"))?;
        product.cost_price = money_from_number(object.get("cost_price"))?;
        product.stock = integer(object.get("qty_available")).unwrap_or(0);
        product.reorder_level = integer(object.get("min_qty")).unwrap_or(0);
        product.target_stock = integer(object.get("target_stock")).unwrap_or(0);
        product.barcode = text(object.get("barcode"));
        product.asin = text(object.get("asin"));
        product.web_link = text(object.get("web_link"));
        product.source_domain = text(object.get("source_domain"));
        product.description = text(object.get("description"));
        product.image_emoji = text(object.get("image_emoji"));
        product.active = object
            .get("active")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        product.exclude_from_reorder = object
            .get("exclude_from_reorder")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        product.legacy_id = Some(id);
        product.legacy_json = Some(serde_json::to_string(value)?);
        product.validate().map_err(CoreError::Validation)?;
        products.push(product);
    }

    Ok(products)
}

fn export_contacts(contacts: &[Contact]) -> Vec<Value> {
    let mut used = contacts
        .iter()
        .filter_map(|contact| contact.legacy_id)
        .collect::<BTreeSet<_>>();
    let mut next_id = used.iter().next_back().copied().unwrap_or(0) + 1;
    let mut values = Vec::with_capacity(contacts.len());

    for contact in contacts {
        let id = match contact.legacy_id {
            Some(id) => id,
            None => {
                while used.contains(&next_id) {
                    next_id += 1;
                }
                used.insert(next_id);
                next_id
            }
        };
        let mut object = raw_object(contact.legacy_json.as_deref());
        object.insert("id".to_string(), json!(id));
        object.insert(
            "name".to_string(),
            Value::String(if contact.display_name().trim().is_empty() {
                contact.name.clone().unwrap_or_default()
            } else {
                contact.display_name()
            }),
        );
        set_optional(&mut object, "first_name", contact.first_name.as_deref());
        set_optional(&mut object, "last_name", contact.last_name.as_deref());
        // Some older rows also carry camelCase names. Keep those aliases in sync so editing a
        // contact does not leave a stale duplicate behind.
        if object.contains_key("firstName") {
            object.insert(
                "firstName".to_string(),
                Value::String(contact.first_name.clone().unwrap_or_default()),
            );
        }
        if object.contains_key("lastName") {
            object.insert(
                "lastName".to_string(),
                Value::String(contact.last_name.clone().unwrap_or_default()),
            );
        }
        set_optional(&mut object, "company", contact.company_name.as_deref());
        set_optional(&mut object, "email", contact.email.as_deref());
        set_optional(&mut object, "phone", contact.phone.as_deref());
        set_optional(&mut object, "street", contact.street.as_deref());
        set_optional(&mut object, "zip", contact.zip.as_deref());
        set_optional(&mut object, "city", contact.city.as_deref());
        set_optional(&mut object, "country", contact.country.as_deref());
        set_optional(&mut object, "taxId", contact.tax_id.as_deref());
        set_optional(&mut object, "notes", contact.notes.as_deref());
        // The legacy document stores the contact persons as a plain array on the contact. Write the
        // current rows so an edit in this application cannot leave a stale copy behind.
        if !contact.contact_persons.is_empty() || object.contains_key("contact_persons") {
            object.insert(
                "contact_persons".to_string(),
                Value::Array(
                    contact
                        .contact_persons
                        .iter()
                        .map(|person| {
                            json!({
                                "id": person.id,
                                "first_name": person.first_name,
                                "last_name": person.last_name,
                                "email": person.email,
                                "phone": person.phone,
                                "role": person.role,
                                "is_primary": person.is_primary,
                            })
                        })
                        .collect(),
                ),
            );
        }
        if object.contains_key("is_company") || contact.legacy_json.is_none() {
            object.insert(
                "is_company".to_string(),
                Value::Bool(matches!(contact.kind, ContactKind::Company)),
            );
        }
        object.insert(
            "type".to_string(),
            Value::String(contact.contact_type.as_str().to_string()),
        );
        if contact.legacy_json.is_none() {
            for key in ["company", "email", "phone"] {
                object
                    .entry(key.to_string())
                    .or_insert_with(|| Value::String(String::new()));
            }
        }
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(format_iso8601(contact.created_at)));
        values.push(Value::Object(object));
    }

    values
}

fn export_products(products: &[Product]) -> Vec<Value> {
    let mut ordered = products.iter().collect::<Vec<_>>();
    ordered.sort_by_key(|product| {
        (
            product.legacy_id.is_none(),
            product.legacy_id.unwrap_or(i64::MAX),
        )
    });
    let mut used = products
        .iter()
        .filter_map(|product| product.legacy_id)
        .collect::<BTreeSet<_>>();
    let mut next_id = used.iter().next_back().copied().unwrap_or(0) + 1;
    let mut values = Vec::with_capacity(products.len());

    for product in ordered {
        let id = match product.legacy_id {
            Some(id) => id,
            None => {
                while used.contains(&next_id) {
                    next_id += 1;
                }
                used.insert(next_id);
                next_id
            }
        };
        let mut object = raw_object(product.legacy_json.as_deref());
        object.insert("id".to_string(), json!(id));
        object.insert("name".to_string(), Value::String(product.name.clone()));
        object.insert("sku".to_string(), Value::String(product.sku.clone()));
        object.insert(
            "category".to_string(),
            Value::String(product.category.clone()),
        );
        object.insert("unit".to_string(), Value::String(product.unit.clone()));
        object.insert("sale_price".to_string(), cents_value(product.price));
        object.insert("cost_price".to_string(), cents_value(product.cost_price));
        object.insert("qty_available".to_string(), json!(product.stock));
        object.insert("min_qty".to_string(), json!(product.reorder_level));
        if object.contains_key("target_stock")
            || product.legacy_json.is_none()
            || product.target_stock != 0
        {
            object.insert("target_stock".to_string(), json!(product.target_stock));
        }
        set_optional(&mut object, "barcode", product.barcode.as_deref());
        set_optional(&mut object, "asin", product.asin.as_deref());
        set_optional(&mut object, "web_link", product.web_link.as_deref());
        set_optional(
            &mut object,
            "source_domain",
            product.source_domain.as_deref(),
        );
        set_optional(&mut object, "description", product.description.as_deref());
        set_optional(&mut object, "image_emoji", product.image_emoji.as_deref());
        if object.contains_key("exclude_from_reorder")
            || product.legacy_json.is_none()
            || product.exclude_from_reorder
        {
            object.insert(
                "exclude_from_reorder".to_string(),
                Value::Bool(product.exclude_from_reorder),
            );
        }
        object
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(format_iso8601(product.created_at)));
        values.push(Value::Object(object));
    }

    values
}

fn empty_document() -> Value {
    json!({
        "app": LEGACY_APP,
        "version": 2,
        "exported_at": format_iso8601(now_millis()),
        "backup_owner": "System Admin",
        "backup_target_folder": "C:\\ERP-Daten\\SOCDOF_Backups",
        "data_summary": {
            "contacts_count": 0,
            "products_count": 0,
            "invoices_count": 0,
            "purchases_count": 0
        },
        "contacts": [],
        "products": [],
        "stock_moves": [],
        "invoices": [],
        "purchase_orders": [],
        "pos_orders": [],
        "chatter_messages": [],
        "settings": []
    })
}

fn raw_object(raw: Option<&str>) -> Map<String, Value> {
    raw.and_then(|text| serde_json::from_str::<Value>(text).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

fn set_optional(object: &mut Map<String, Value>, key: &str, value: Option<&str>) {
    match value.filter(|value| !value.trim().is_empty()) {
        Some(value) => {
            object.insert(key.to_string(), Value::String(value.to_string()));
        }
        None => {
            // Clearing a field must also clear the preserved legacy value, otherwise the next
            // import would silently restore the old text. Keep the key as an empty string when
            // the original document had it, so an untouched round trip stays byte-compatible in
            // shape (the legacy exporter also writes empty strings for some fields).
            if object.contains_key(key) {
                object.insert(key.to_string(), Value::String(String::new()));
            }
        }
    }
}

fn text(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn integer(value: Option<&Value>) -> Option<i64> {
    value.and_then(value_as_i64)
}

fn value_as_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
        .or_else(|| value.as_str().and_then(|value| value.parse().ok()))
}

fn money_from_number(value: Option<&Value>) -> CoreResult<Money> {
    let Some(value) = value else {
        return Ok(Money::ZERO);
    };
    let amount = value
        .as_f64()
        .ok_or_else(|| CoreError::Validation("legacy_price_invalid".into()))?;
    if !amount.is_finite() {
        return Err(CoreError::Validation("legacy_price_invalid".into()));
    }
    Ok(Money::from_cents((amount * 100.0).round() as i64))
}

fn cents_value(money: Money) -> Value {
    let cents = money.cents();
    if cents % 100 == 0 {
        json!(cents / 100)
    } else {
        json!(cents as f64 / 100.0)
    }
}

fn array_len(value: Option<&Value>) -> usize {
    value.and_then(Value::as_array).map_or(0, Vec::len)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;

    const FIXTURE: &str =
        include_str!("../tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json");

    #[test]
    fn imports_contacts_products_and_preserves_unknown_tables() {
        let store = Store::open_in_memory().expect("store");
        let report = import_json(&store, FIXTURE.as_bytes()).expect("legacy import");

        assert_eq!(report.contacts, 3);
        assert_eq!(report.products, 2);
        assert_eq!(report.invoices, 1);
        assert_eq!(store.contact_count().expect("contacts"), 3);
        assert_eq!(store.product_count().expect("products"), 2);
        assert_eq!(store.invoice_count().expect("native invoices"), 0);

        let contact = store
            .list_contacts()
            .expect("contacts")
            .into_iter()
            .find(|contact| contact.legacy_id == Some(1))
            .expect("legacy contact");
        assert_eq!(contact.name.as_deref(), Some("Dr. Florian Weber"));
        assert_eq!(contact.contact_type, ContactType::Customer);
        assert_eq!(contact.city.as_deref(), Some("Zürich"));

        let product = store
            .list_products()
            .expect("products")
            .into_iter()
            .find(|product| product.legacy_id == Some(1))
            .expect("legacy product");
        assert_eq!(product.name, "Strudel IoT Gateway Pro");
        assert_eq!(product.category, "Hardware");
        assert_eq!(product.price, Money::from_cents(49_900));
    }

    #[test]
    fn exported_document_roundtrips_without_losing_legacy_tables_or_fields() {
        let store = Store::open_in_memory().expect("store");
        import_json(&store, FIXTURE.as_bytes()).expect("legacy import");

        let exported = build_export(&store).expect("export");
        let original: Value = serde_json::from_str(FIXTURE).expect("fixture json");
        let exported_object = exported.as_object().expect("object");
        let original_object = original.as_object().expect("object");

        assert_eq!(exported_object["contacts"], original_object["contacts"]);
        assert_eq!(exported_object["products"], original_object["products"]);
        for key in [
            "stock_moves",
            "invoices",
            "purchase_orders",
            "pos_orders",
            "chatter_messages",
            "settings",
        ] {
            assert_eq!(exported_object[key], original_object[key], "changed {key}");
        }
        assert_eq!(
            exported_object["data_summary"],
            original_object["data_summary"]
        );
        assert_ne!(
            exported_object["exported_at"],
            original_object["exported_at"]
        );
    }

    #[test]
    fn clearing_an_edited_field_removes_the_preserved_legacy_value() {
        let store = Store::open_in_memory().expect("store");
        import_json(&store, FIXTURE.as_bytes()).expect("legacy import");

        let contact = store
            .list_contacts()
            .expect("contacts")
            .into_iter()
            .find(|contact| contact.legacy_id == Some(1))
            .expect("legacy contact");
        let mut edited = contact.clone();
        edited.city = None;
        edited.notes = None;
        store.update_contact(&edited).expect("contact update");

        let document = build_export(&store).expect("export");
        let exported = document["contacts"].as_array().expect("contacts array");
        let first = exported
            .iter()
            .find(|value| value["id"] == 1)
            .expect("contact 1");
        assert_eq!(first["city"], "", "stale city survived: {first}");
        assert_eq!(first["notes"], "", "stale notes survived: {first}");
    }

    #[test]
    fn new_records_carry_the_legacy_required_fields() {
        let store = Store::open_in_memory().expect("store");
        let now = now_millis();

        let mut contact = Contact::new(ContactKind::Company, now);
        contact.name = Some("Rust Kunde".to_string());
        contact.company_name = Some("Rust Kunde GmbH".to_string());
        contact.contact_type = ContactType::Both;
        contact.email = Some("kunde@example.invalid".to_string());
        contact.phone = Some("+49 30 999".to_string());
        store.insert_contact(&contact).expect("contact insert");

        let mut product = Product::new("Rust Produkt", now);
        product.sku = "RUST-1".to_string();
        product.price = Money::from_cents(2_499);
        store.insert_product(&product).expect("product insert");

        let document = build_export(&store).expect("export");
        let exported_contact = &document["contacts"][0];
        assert_eq!(exported_contact["name"], "Rust Kunde");
        assert_eq!(exported_contact["company"], "Rust Kunde GmbH");
        assert_eq!(exported_contact["email"], "kunde@example.invalid");
        assert_eq!(exported_contact["phone"], "+49 30 999");
        assert_eq!(exported_contact["type"], "both");
        assert_eq!(exported_contact["is_company"], true);

        let exported_product = &document["products"][0];
        assert_eq!(exported_product["name"], "Rust Produkt");
        assert_eq!(exported_product["sku"], "RUST-1");
        assert_eq!(exported_product["sale_price"], 24.99);
        assert_eq!(exported_product["qty_available"], 0);
    }

    #[test]
    fn writes_a_document_that_the_legacy_importer_accepts() {
        let store = Store::open_in_memory().expect("store");
        import_json(&store, FIXTURE.as_bytes()).expect("legacy import");

        let document = build_export(&store).expect("export");
        assert_eq!(document["app"], LEGACY_APP);
        assert_eq!(document["version"], 2);
        for key in ["contacts", "products", "invoices"] {
            assert!(document[key].is_array(), "missing legacy array: {key}");
        }
    }

    #[test]
    fn rejects_documents_without_legacy_tables() {
        let store = Store::open_in_memory().expect("store");
        let error = import_json(&store, br#"{"contacts":[]}"#).expect_err("must fail");
        assert!(matches!(error, CoreError::Validation(code) if code == "legacy_missing_products"));
    }
}
