//! Demo catalogue for the screenshot harness.
//!
//! The parity captures compare the Rust edition against a TypeScript reference that runs with its
//! demo workspace (`odoo_clean_mode = false`). The Rust edition opens an empty database in that
//! environment, so every list is an empty state. When `SOCDOF_DEMO_SEED=1` is set — only the capture
//! and review harnesses set it — this module fills that database with the same catalogue, suppliers,
//! appointments, journal entries and purchase orders the reference shows. It is idempotent and never
//! runs for a normal start, so default user-facing behaviour is unchanged.

use std::path::Path;

use socdof_core::domain::accounting::{BookingChannel, JournalEntry, JournalKind};
use socdof_core::domain::appointment::{Appointment, AppointmentStatus};
use socdof_core::domain::contact::{Contact, ContactKind, ContactType};
use socdof_core::domain::product::Product;
use socdof_core::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
use socdof_core::money::Money;
use socdof_core::store::Store;
use socdof_core::CoreResult;

/// Environment variable that enables the demo catalogue.
pub const DEMO_SEED_ENV: &str = "SOCDOF_DEMO_SEED";

/// Timestamp of the fixed demo day (2026-11-20T12:00:00Z).
const NOW: i64 = 1_795_176_000_000;

/// Seeds the demo catalogue when the harness asks for it.
pub fn seed_if_requested(database: &Path) -> CoreResult<()> {
    if std::env::var(DEMO_SEED_ENV).as_deref() != Ok("1") {
        return Ok(());
    }
    let store = Store::open(database)?;
    seed(&store)
}

/// Seeds all demo rows; each block is a no-op when its table already holds data.
pub fn seed(store: &Store) -> CoreResult<()> {
    seed_products(store)?;
    let vendors = seed_contacts(store)?;
    seed_appointments(store)?;
    seed_journal(store)?;
    seed_purchase_orders(store, vendors)?;
    Ok(())
}

/// The five products of the reference catalogue, with the stock levels the reference shows.
fn seed_products(store: &Store) -> CoreResult<()> {
    if store.product_count()? > 0 {
        return Ok(());
    }
    let rows = [
        (
            "Strudel IoT Gateway Pro",
            "PRD-IOT-001",
            "Hardware",
            "Stück",
            49_900,
            24_000,
            18,
            5,
            "📡",
            "Industrielles Edge-Computing Gateway mit 5G & Zigbee Anbindung.",
        ),
        (
            "OptiSense Umwelt-Sensor Node",
            "PRD-SNS-042",
            "Sensoren",
            "Stück",
            14_900,
            6_500,
            4,
            10,
            "🌡️",
            "Präziser Sensor für Temperatur, CO2, Luftfeuchtigkeit und VOC.",
        ),
        (
            "Aluminium Server-Rack Enclosure 1U",
            "PRD-ENC-100",
            "Zubehör",
            "Stück",
            28_900,
            13_500,
            2,
            6,
            "🎛️",
            "Eloxiertes 19-Zoll Gehäuse mit integrierter Lüftersteuerung.",
        ),
        (
            "CloudSync Enterprise Jahreslizenz",
            "LIC-CLS-01",
            "Software & Lizenzen",
            "Lizenz",
            120_000,
            15_000,
            999,
            0,
            "⚡",
            "Zentrale Gerätesteuerung und Firmware-OTA Management.",
        ),
        (
            "Wartung & Vor-Ort Integrationstag",
            "SRV-INT-DAY",
            "Dienstleistung",
            "Tag(e)",
            145_000,
            60_000,
            45,
            5,
            "🛠️",
            "Senior Systemingenieur für Installation, Verkabelung und Inbetriebnahme.",
        ),
    ];
    // The reference workspace seeds the same catalogue twice, so its POS grid shows ten cards.
    for _ in 0..2 {
        for (name, sku, category, unit, price, cost, stock, reorder, emoji, description) in rows {
            let mut product = Product::new(name, NOW);
            product.sku = sku.to_string();
            product.category = category.to_string();
            product.unit = unit.to_string();
            product.price = Money::from_cents(price);
            product.cost_price = Money::from_cents(cost);
            product.stock = stock;
            product.reorder_level = reorder;
            product.target_stock = stock.max(reorder * 2);
            product.image_emoji = Some(emoji.to_string());
            product.description = Some(description.to_string());
            store.insert_product(&product)?;
        }
    }
    Ok(())
}

/// The suppliers of the reference purchase orders, returning the main vendor id.
fn seed_contacts(store: &Store) -> CoreResult<Vec<uuid::Uuid>> {
    if store.contact_count()? > 0 {
        return Ok(store.list_contacts()?.into_iter().map(|c| c.id).collect());
    }
    let vendors = [
        ("Global Hardware Supply B.V.", "Amsterdam", "Niederlande"),
        ("Milano Electronics S.r.l.", "Milano", "Italien"),
        ("Maier Logistik & IT", "Wien", "Österreich"),
        ("Nordic Components AB", "Stockholm", "Schweden"),
        ("Rheinland Sensorik GmbH", "Köln", "Deutschland"),
        ("AlpenTech Solutions AG", "Zürich", "Schweiz"),
    ];
    let mut ids = Vec::new();
    for (index, (company, city, country)) in vendors.iter().enumerate() {
        let mut contact = Contact::new(ContactKind::Company, NOW);
        contact.company_name = Some((*company).to_string());
        contact.name = Some((*company).to_string());
        contact.contact_type = if index == 5 {
            ContactType::Customer
        } else {
            ContactType::Vendor
        };
        contact.city = Some((*city).to_string());
        contact.country = Some((*country).to_string());
        contact.email = Some(format!("einkauf{}@example.com", index + 1));
        contact.street = Some("Industriestraße 5".to_string());
        contact.zip = Some("10115".to_string());
        store.insert_contact(&contact)?;
        ids.push(contact.id);
    }
    Ok(ids)
}

/// Six appointments in the demo month, matching the reference calendar footer (6 Termine).
fn seed_appointments(store: &Store) -> CoreResult<()> {
    if !store.list_appointments()?.is_empty() {
        return Ok(());
    }
    let day = 86_400_000_i64;
    let first = 1_793_491_200_000_i64; // 2026-11-01T00:00:00Z
    let rows = [
        ("Wartung AlpenTech", 2, 9),
        ("Fällige Rechnung prüfen", 5, 11),
        ("Meeting mit Global Hardware", 12, 14),
        ("Sensorik-Abnahme", 18, 10),
        ("Monatsabschluss", 20, 16),
        ("Liefertermin Gehäuse", 24, 8),
    ];
    for (title, offset, hour) in rows {
        let start = first + offset * day + hour * 3_600_000;
        let mut appointment = Appointment {
            id: uuid::Uuid::new_v4(),
            contact_id: None,
            title: title.to_string(),
            location: None,
            notes: None,
            status: AppointmentStatus::Confirmed,
            starts_at: start,
            ends_at: start + 3_600_000,
            created_at: NOW,
            updated_at: NOW,
        };
        appointment.location = Some("Strudelcode Studio".to_string());
        store.insert_appointment(&appointment)?;
    }
    Ok(())
}

/// Revenue and purchase entries that produce the reference BWA figures.
fn seed_journal(store: &Store) -> CoreResult<()> {
    if store.journal_entry_count()? > 0 {
        return Ok(());
    }
    let month = 1_793_491_200_000_i64;
    let rows = [
        (
            "Rechnung INV/2026/0001",
            "8400 Erlöse",
            "1200 Bank",
            JournalKind::Income,
            1_468_280,
            Some("INV/2026/0001"),
        ),
        (
            "Rechnung INV/2026/0002",
            "8400 Erlöse",
            "1200 Bank",
            JournalKind::Income,
            1_294_100,
            Some("INV/2026/0002"),
        ),
        (
            "Einkauf Global Hardware",
            "3400 Wareneingang",
            "1200 Bank",
            JournalKind::Expense,
            260_000,
            Some("PO/2026/0001"),
        ),
    ];
    for (index, (description, account, counter, kind, cents, reference)) in rows.iter().enumerate()
    {
        let mut entry = JournalEntry::new(month + index as i64 * 86_400_000);
        entry.description = (*description).to_string();
        entry.account = (*account).to_string();
        entry.counter_account = (*counter).to_string();
        entry.amount = Money::from_cents(*cents);
        entry.kind = *kind;
        entry.channel = BookingChannel::Bank;
        entry.reference = reference.map(str::to_string);
        store.insert_journal_entry(&entry)?;
    }
    Ok(())
}

/// Two ordered purchase orders from the main supplier, matching the reference table.
fn seed_purchase_orders(store: &Store, vendors: Vec<uuid::Uuid>) -> CoreResult<()> {
    if store.purchase_order_count()? > 0 {
        return Ok(());
    }
    let Some(vendor) = vendors.first().copied() else {
        return Ok(());
    };
    let order_day = 1_786_838_400_000_i64; // 2026-08-16T00:00:00Z
    for number in ["PO/2026/0001", "PO/2026/0002"] {
        let line = PurchaseOrderLine {
            product_id: None,
            description: "Global Hardware Sammelbestellung".to_string(),
            quantity_milli: 1_000,
            unit_cost: Money::from_cents(130_000),
            tax_rate_bp: 1900,
        };
        let order = PurchaseOrder {
            id: uuid::Uuid::new_v4(),
            number: number.to_string(),
            vendor_id: vendor,
            status: PurchaseOrderStatus::Ordered,
            order_date: order_day,
            expected_at: Some(order_day + 9 * 86_400_000),
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![line],
            legacy_id: None,
            created_at: NOW,
            updated_at: NOW,
        };
        store.insert_purchase_order(&order)?;
    }
    Ok(())
}
