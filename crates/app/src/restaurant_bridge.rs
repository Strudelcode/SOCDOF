//! Wire layer of the restaurant POS: TypeScript field names, inputs, views and CSV.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use socdof_core::date;
use socdof_core::domain::restaurant::{self, MenuItem, RestaurantTable, TableOrder};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::money::Money;

/// One menu dish as the webview expects it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemView {
    /// Identifier.
    pub id: Uuid,
    /// Name.
    pub name: String,
    /// Category.
    pub category: String,
    /// Net price in euro.
    pub price: f64,
    /// Tax rate in percent (`7` or `19`).
    pub tax_rate: i64,
    /// Ingredients.
    pub ingredients: String,
    /// Allergens.
    pub allergens: Vec<String>,
    /// Emoji.
    pub emoji: String,
    /// Preparation minutes.
    pub prep_time_minutes: i64,
    /// Whether it can be ordered.
    pub is_available: bool,
}

/// One ordered position.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableOrderItemView {
    /// Identifier.
    pub id: Uuid,
    /// Source menu item, when known.
    pub menu_item_id: Option<Uuid>,
    /// Name copied at order time.
    pub name: String,
    /// Net unit price in euro.
    pub price: f64,
    /// Tax rate in percent.
    pub tax_rate: i64,
    /// Quantity.
    pub qty: i64,
    /// Category.
    pub category: String,
    /// Emoji.
    pub emoji: String,
    /// Kitchen note.
    pub notes: String,
    /// Net line total in euro.
    pub line_total: f64,
}

/// A table order / receipt.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableOrderView {
    /// Identifier.
    pub id: Uuid,
    /// Table name.
    pub table_number: String,
    /// Server.
    pub server_name: String,
    /// Status.
    pub status: String,
    /// Positions.
    pub items: Vec<TableOrderItemView>,
    /// Net total in euro.
    pub subtotal: f64,
    /// Tax total in euro.
    pub tax_total: f64,
    /// Gross total without tip in euro.
    pub total: f64,
    /// Tip in euro.
    pub tip: f64,
    /// Gross total including tip.
    pub total_with_tip: f64,
    /// Payment method after checkout.
    pub payment_method: Option<String>,
    /// ISO opening time.
    pub opened_at: String,
    /// ISO payment time.
    pub paid_at: Option<String>,
    /// Cash handed over in euro.
    pub cash_tendered: Option<f64>,
    /// Change in euro.
    pub cash_change: Option<f64>,
    /// GoBD receipt flag.
    pub is_hospitality_receipt: bool,
    /// Hospitality host.
    pub hospitality_host: String,
    /// Hospitality occasion.
    pub hospitality_occasion: String,
    /// Hospitality guests.
    pub hospitality_guests: String,
    /// Receipt number.
    pub receipt_number: Option<String>,
    /// Linked invoice.
    pub invoice_id: Option<Uuid>,
}

impl TableOrderView {
    /// Number of positions, as the receipt and history show it.
    pub fn line_count(&self) -> usize {
        self.items.len()
    }

    /// Sum of quantities.
    pub fn quantity(&self) -> i64 {
        self.items.iter().map(|item| item.qty).sum()
    }
}

/// One table of the floor plan with its live state.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantTableView {
    /// Floor-plan id.
    pub id: String,
    /// Display name.
    pub name: String,
    /// Area.
    pub area: String,
    /// Seats.
    pub seats: i64,
    /// `free` or the order status.
    pub status: String,
    /// Open order, if any.
    pub order_id: Option<Uuid>,
    /// Number of ordered units.
    pub item_count: i64,
    /// Gross total of the open order in euro.
    pub total: f64,
}

/// Live KPI and Z-report values.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantMetricsView {
    /// Open table orders.
    pub open_tables: i64,
    /// Orders in the kitchen (ordered or preparing).
    pub in_kitchen: i64,
    /// Menu size.
    pub menu_count: i64,
    /// Paid receipts today.
    pub today_orders: i64,
    /// Gross revenue today, without tips.
    pub today_revenue: f64,
    /// Cash revenue today.
    pub cash_sales: f64,
    /// Card and NFC revenue today.
    pub card_sales: f64,
    /// Tax contained in today's revenue.
    pub tax_total: f64,
}

/// Company data printed on the restaurant receipt.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantCompanyView {
    /// Legal company name.
    pub name: String,
    /// Street and house number.
    pub street: String,
    /// Postal code and city.
    pub zip_city: String,
    /// Tax number / VAT id.
    pub tax_id: String,
    /// Currency symbol.
    pub currency: String,
}

/// Everything the restaurant screen needs in one call.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantOverviewView {
    /// Company data for the receipt header.
    pub company: RestaurantCompanyView,
    /// Menu, newest first.
    pub menu: Vec<MenuItemView>,
    /// Fixed floor plan with live states.
    pub tables: Vec<RestaurantTableView>,
    /// Orders in creation order.
    pub orders: Vec<TableOrderView>,
    /// KPI and Z-report values.
    pub metrics: RestaurantMetricsView,
    /// Suggested CSV file name.
    pub csv_file_name: String,
}

/// One dish editor input.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MenuItemInput {
    /// Existing id, empty for a new dish.
    pub id: Option<Uuid>,
    /// Name.
    pub name: String,
    /// Category.
    pub category: String,
    /// Net price in euro.
    pub price: f64,
    /// Tax rate in percent.
    pub tax_rate: i64,
    /// Ingredients.
    pub ingredients: String,
    /// Allergens.
    pub allergens: Vec<String>,
    /// Emoji.
    pub emoji: String,
    /// Preparation minutes.
    pub prep_time_minutes: i64,
    /// Whether available.
    pub is_available: bool,
}

/// Result of adding a dish or changing an order.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantOrderMutationView {
    /// Stored order, or `None` when the last position was removed.
    pub order: Option<TableOrderView>,
    /// Whether a new table order row was created.
    pub created: bool,
}

/// Checkout values of the billing dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RestaurantCheckoutInput {
    /// Open table order.
    pub order_id: Option<Uuid>,
    /// `cash`, `card` or `nfc`.
    pub payment_method: String,
    /// Tip in euro.
    pub tip: f64,
    /// Cash handed over in euro.
    pub cash_given: Option<f64>,
    /// Split count shown by the dialog.
    pub split_count: i64,
    /// GoBD hospitality receipt.
    pub is_hospitality_receipt: bool,
    /// Host / company.
    pub hospitality_host: String,
    /// Occasion.
    pub hospitality_occasion: String,
    /// Guests.
    pub hospitality_guests: String,
}

/// Result of settling a table.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantCheckoutView {
    /// Paid order and receipt.
    pub order: TableOrderView,
    /// Created ERP invoice.
    pub invoice_id: Uuid,
    /// Invoice / receipt number.
    pub invoice_number: String,
    /// Gross total including tip in euro.
    pub total_with_tip: f64,
    /// Change returned in euro.
    pub change: f64,
    /// Split count of the dialog.
    pub split_count: i64,
    /// Per-person amount including tip in euro.
    pub total_per_person: f64,
}

/// Result of the restaurant persistence check.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantPersistenceView {
    /// Whether the order exists.
    pub present: bool,
    /// Number of stored positions.
    pub items: i64,
    /// Number of dishes in the menu.
    pub menu: i64,
    /// Stored status.
    pub status: String,
    /// Stored receipt number.
    pub receipt_number: Option<String>,
}

/// Result of the restaurant sales CSV export.
#[derive(Debug, Clone, Serialize)]
pub struct RestaurantCsvReport {
    /// Written path.
    pub path: String,
    /// File size in bytes.
    pub bytes: u64,
    /// Number of paid receipts.
    pub rows: u64,
}

fn euro(cents: i64) -> f64 {
    cents as f64 / 100.0
}

fn cents(value: f64) -> i64 {
    if value.is_finite() {
        (value * 100.0).round() as i64
    } else {
        0
    }
}

/// Builds the wire view of one dish.
pub fn menu_view(item: &MenuItem) -> MenuItemView {
    MenuItemView {
        id: item.id,
        name: item.name.clone(),
        category: item.category.clone(),
        price: euro(item.price_cents),
        tax_rate: item.tax_rate_bp / 100,
        ingredients: item.ingredients.clone(),
        allergens: item.allergens.clone(),
        emoji: item.emoji.clone(),
        prep_time_minutes: item.prep_time_minutes,
        is_available: item.is_available,
    }
}

/// Converts the editor input into a stored dish.
pub fn menu_item(input: &MenuItemInput, existing: Option<&MenuItem>, now: i64) -> MenuItem {
    let mut item = MenuItem {
        id: input.id.unwrap_or_else(Uuid::new_v4),
        name: input.name.clone(),
        category: input.category.clone(),
        price_cents: cents(input.price),
        tax_rate_bp: input.tax_rate * 100,
        ingredients: input.ingredients.clone(),
        allergens: input.allergens.clone(),
        emoji: if input.emoji.trim().is_empty() {
            "🍽️".to_string()
        } else {
            input.emoji.clone()
        },
        prep_time_minutes: input.prep_time_minutes,
        is_available: input.is_available,
        created_at: existing.map(|item| item.created_at).unwrap_or(now),
    };
    if existing.is_none() && input.tax_rate == 0 {
        item.tax_rate_bp = 700;
    }
    item.normalize();
    item
}

/// Builds the wire view of one position.
pub fn order_item_view(item: &restaurant::TableOrderItem) -> TableOrderItemView {
    TableOrderItemView {
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.name.clone(),
        price: euro(item.price_cents),
        tax_rate: item.tax_rate_bp / 100,
        qty: item.qty,
        category: item.category.clone(),
        emoji: item.emoji.clone(),
        notes: item.notes.clone(),
        line_total: euro(item.net().cents()),
    }
}

/// Builds the wire view of one table order.
pub fn order_view(order: &TableOrder) -> TableOrderView {
    TableOrderView {
        id: order.id,
        table_number: order.table_number.clone(),
        server_name: order.server_name.clone(),
        status: order.status.clone(),
        items: order.items.iter().map(order_item_view).collect(),
        subtotal: euro(order.subtotal_cents),
        tax_total: euro(order.tax_total_cents),
        total: euro(order.total_cents),
        tip: euro(order.tip_cents),
        total_with_tip: euro(order.total_cents + order.tip_cents),
        payment_method: order.payment_method.clone(),
        opened_at: date::format_iso8601(order.opened_at),
        paid_at: order.paid_at.map(date::format_iso8601),
        cash_tendered: order.cash_tendered_cents.map(euro),
        cash_change: order.cash_change_cents.map(euro),
        is_hospitality_receipt: order.is_hospitality_receipt,
        hospitality_host: order.hospitality_host.clone(),
        hospitality_occasion: order.hospitality_occasion.clone(),
        hospitality_guests: order.hospitality_guests.clone(),
        receipt_number: order.receipt_number.clone(),
        invoice_id: order.invoice_id,
    }
}

fn paid_today(order: &TableOrder, now: i64) -> bool {
    let (year, month, day) = date::civil_from_millis(now);
    let start = date::days_from_civil(year, month, day) * 86_400_000;
    order
        .paid_at
        .is_some_and(|paid_at| paid_at >= start && paid_at < start + 86_400_000)
}

fn table_view(table: &RestaurantTable, order: Option<&TableOrder>) -> RestaurantTableView {
    RestaurantTableView {
        id: table.id.clone(),
        name: table.name.clone(),
        area: table.area.clone(),
        seats: table.seats,
        status: order
            .map(|order| order.status.clone())
            .unwrap_or_else(|| "free".to_string()),
        order_id: order.map(|order| order.id),
        item_count: order.map(TableOrder::item_quantity).unwrap_or(0),
        total: order.map(|order| euro(order.total_cents)).unwrap_or(0.0),
    }
}

fn company_view(company: &CompanyProfile) -> RestaurantCompanyView {
    let default = company.name.trim().is_empty();
    RestaurantCompanyView {
        name: if default {
            "SOCDOF Gastronomie".to_string()
        } else {
            company.name.clone()
        },
        street: if default {
            "Gastrostraße 1".to_string()
        } else {
            company.street.clone()
        },
        zip_city: if default {
            "10115 Berlin".to_string()
        } else {
            company.zip_city.clone()
        },
        tax_id: if default {
            "DE123456789".to_string()
        } else {
            company.tax_id.clone()
        },
        currency: if company.currency.trim().is_empty() {
            "€".to_string()
        } else {
            company.currency.clone()
        },
    }
}

/// Builds the complete restaurant screen.
pub fn overview(
    menu: &[MenuItem],
    orders: &[TableOrder],
    company: &CompanyProfile,
    now: i64,
) -> RestaurantOverviewView {
    let tables = restaurant::tables();
    let table_views = tables
        .iter()
        .map(|table| {
            let order = orders
                .iter()
                .find(|order| order.table_number == table.name && order.status != "paid");
            table_view(table, order)
        })
        .collect();
    let paid: Vec<&TableOrder> = orders
        .iter()
        .filter(|order| order.status == "paid")
        .collect();
    let today: Vec<&&TableOrder> = paid.iter().filter(|order| paid_today(order, now)).collect();
    let today_revenue: i64 = today.iter().map(|order| order.total_cents).sum();
    let cash_sales: i64 = today
        .iter()
        .filter(|order| order.payment_method.as_deref() == Some("cash"))
        .map(|order| order.total_cents)
        .sum();
    let card_sales = today_revenue - cash_sales;
    let tax_total: i64 = today.iter().map(|order| order.tax_total_cents).sum();
    let (year, month, day) = date::civil_from_millis(now);

    RestaurantOverviewView {
        company: company_view(company),
        menu: menu.iter().map(menu_view).collect(),
        tables: table_views,
        orders: orders.iter().map(order_view).collect(),
        metrics: RestaurantMetricsView {
            open_tables: orders.iter().filter(|order| order.status != "paid").count() as i64,
            in_kitchen: orders
                .iter()
                .filter(|order| order.status == "ordered" || order.status == "preparing")
                .count() as i64,
            menu_count: menu.len() as i64,
            today_orders: today.len() as i64,
            today_revenue: euro(today_revenue),
            cash_sales: euro(cash_sales),
            card_sales: euro(card_sales),
            tax_total: euro(tax_total),
        },
        csv_file_name: format!("restaurant-belege-{year:04}-{month:02}-{day:02}.csv"),
    }
}

fn csv_field(value: &str) -> String {
    if value.contains(';') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// GoBD sales export of all paid receipts, with BOM and semicolon separation.
pub fn csv_bytes(orders: &[TableOrder]) -> (String, u64) {
    let mut output = String::from("\u{feff}");
    output.push_str(
        "Belegnummer;Tisch;Datum;Zahlart;Artikel;Positionen;Netto;MwSt;Trinkgeld;Gesamt;Gesamt inkl. Trinkgeld\n",
    );
    let mut rows = 0;
    for order in orders.iter().filter(|order| order.status == "paid") {
        rows += 1;
        let articles = order
            .items
            .iter()
            .map(|item| format!("{}× {}", item.qty, item.name))
            .collect::<Vec<_>>()
            .join(", ");
        output.push_str(&format!(
            "{};{};{};{};{};{};{};{};{};{};{}\n",
            csv_field(order.receipt_number.as_deref().unwrap_or("")),
            csv_field(&order.table_number),
            order
                .paid_at
                .map(date::format_iso8601)
                .unwrap_or_else(|| date::format_iso8601(order.opened_at)),
            csv_field(order.payment_method.as_deref().unwrap_or("")),
            csv_field(&articles),
            order.line_count(),
            Money::from_cents(order.subtotal_cents).to_decimal_string(),
            Money::from_cents(order.tax_total_cents).to_decimal_string(),
            Money::from_cents(order.tip_cents).to_decimal_string(),
            Money::from_cents(order.total_cents).to_decimal_string(),
            Money::from_cents(order.total_cents + order.tip_cents).to_decimal_string(),
        ));
    }
    (output, rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn company_view_uses_configured_profile_and_defaults() {
        let empty = CompanyProfile::default();
        let fallback = company_view(&empty);
        assert_eq!(fallback.name, "SOCDOF Gastronomie");
        assert_eq!(fallback.street, "Gastrostraße 1");
        assert_eq!(fallback.zip_city, "10115 Berlin");
        assert_eq!(fallback.tax_id, "DE123456789");
        assert_eq!(fallback.currency, "€");

        let profile = CompanyProfile {
            name: "Trattoria Test".to_string(),
            street: "Testweg 7".to_string(),
            zip_city: "10117 Berlin".to_string(),
            tax_id: "DE-TEST-42".to_string(),
            currency: "EUR".to_string(),
            ..CompanyProfile::default()
        };
        let configured = company_view(&profile);
        assert_eq!(configured.name, "Trattoria Test");
        assert_eq!(configured.street, "Testweg 7");
        assert_eq!(configured.zip_city, "10117 Berlin");
        assert_eq!(configured.tax_id, "DE-TEST-42");
        assert_eq!(configured.currency, "EUR");
    }
}
