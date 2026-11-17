//! Restaurant menu, table orders, kitchen flow and hospitality receipts.
//!
//! The shape follows the TypeScript `RestaurantModule.tsx` and its `MenuItem`, `TableOrderItem`
//! and `TableOrder` types. Money is kept in integer cents and tax rates in basis points; the
//! TypeScript percentages are provided by the bridge as floating point values.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// Menu categories of the TypeScript module.
pub const CATEGORIES: [&str; 6] = [
    "starters", "pizza", "mains", "burgers", "desserts", "drinks",
];

/// Order lifecycle values of the TypeScript type.
pub const ORDER_STATUSES: [&str; 5] = ["ordered", "preparing", "ready", "served", "paid"];

/// Payment methods accepted by the table checkout.
pub const PAYMENT_METHODS: [&str; 3] = ["cash", "card", "nfc"];

/// Whether a category is one of the six menu groups.
pub fn valid_category(category: &str) -> bool {
    CATEGORIES.contains(&category)
}

/// Whether an order status is part of the TypeScript union.
pub fn valid_status(status: &str) -> bool {
    ORDER_STATUSES.contains(&status)
}

/// Whether a payment method is accepted by the checkout.
pub fn valid_payment_method(method: &str) -> bool {
    PAYMENT_METHODS.contains(&method)
}

/// One dish or drink on the menu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MenuItem {
    /// Stable identifier.
    pub id: Uuid,
    /// Printed name.
    pub name: String,
    /// `starters`, `pizza`, `mains`, `burgers`, `desserts` or `drinks`.
    pub category: String,
    /// Net selling price in cents.
    pub price_cents: i64,
    /// Tax rate in basis points (`700` or `1900`).
    pub tax_rate_bp: i64,
    /// Ingredients and description.
    pub ingredients: String,
    /// Declared allergens, in the legacy notation.
    pub allergens: Vec<String>,
    /// Emoji shown on the menu card.
    pub emoji: String,
    /// Preparation time in minutes.
    pub prep_time_minutes: i64,
    /// Whether the dish can currently be ordered.
    pub is_available: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl MenuItem {
    /// Trims the text fields and drops empty allergens.
    pub fn normalize(&mut self) {
        self.name = self.name.trim().to_string();
        self.ingredients = self.ingredients.trim().to_string();
        self.emoji = self.emoji.trim().to_string();
        let mut allergens = Vec::new();
        for allergen in &self.allergens {
            let allergen = allergen.trim();
            if !allergen.is_empty() && !allergens.iter().any(|known| known == allergen) {
                allergens.push(allergen.to_string());
            }
        }
        self.allergens = allergens;
    }

    /// Validates the values the TypeScript add-dish form requires.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("restaurant_dish_name_required".to_string());
        }
        if !valid_category(&self.category) {
            return Err("restaurant_dish_category_invalid".to_string());
        }
        if self.price_cents < 0 {
            return Err("restaurant_dish_price_invalid".to_string());
        }
        if !(0..=10_000).contains(&self.tax_rate_bp) {
            return Err("restaurant_dish_tax_invalid".to_string());
        }
        if self.prep_time_minutes < 0 {
            return Err("restaurant_dish_prep_invalid".to_string());
        }
        Ok(())
    }

    /// Net amount of one unit.
    pub fn net(&self) -> Money {
        Money::from_cents(self.price_cents)
    }

    /// Tax amount of one unit.
    pub fn tax(&self) -> Money {
        self.net().tax(self.tax_rate_bp)
    }

    /// Gross amount of one unit.
    pub fn gross(&self) -> Money {
        self.net() + self.tax()
    }
}

/// One position of a table order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TableOrderItem {
    /// Stable identifier.
    pub id: Uuid,
    /// Menu item this line was created from, when it still exists.
    pub menu_item_id: Option<Uuid>,
    /// Name copied at order time, so deleting a dish keeps the receipt intact.
    pub name: String,
    /// Net unit price in cents.
    pub price_cents: i64,
    /// Tax rate in basis points.
    pub tax_rate_bp: i64,
    /// Ordered quantity.
    pub qty: i64,
    /// Menu category copied at order time.
    pub category: String,
    /// Emoji copied at order time.
    pub emoji: String,
    /// Kitchen note, for example "ohne Zwiebeln".
    pub notes: String,
}

impl TableOrderItem {
    /// Net amount of the line.
    pub fn net(&self) -> Money {
        Money::from_cents(self.price_cents).times(self.qty)
    }

    /// Tax amount of the line.
    pub fn tax(&self) -> Money {
        self.net().tax(self.tax_rate_bp)
    }

    /// Gross amount of the line.
    pub fn gross(&self) -> Money {
        self.net() + self.tax()
    }
}

/// A table order / hospitality receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TableOrder {
    /// Stable identifier.
    pub id: Uuid,
    /// Table name from the floor plan, e.g. `Tisch 1 (Fenster)`.
    pub table_number: String,
    /// Optional server name.
    pub server_name: String,
    /// `ordered`, `preparing`, `ready`, `served` or `paid`.
    pub status: String,
    /// Ordered positions.
    pub items: Vec<TableOrderItem>,
    /// Net total in cents.
    pub subtotal_cents: i64,
    /// Tax total in cents.
    pub tax_total_cents: i64,
    /// Gross total in cents, without tip.
    pub total_cents: i64,
    /// Tip in cents, kept for the printed receipt.
    pub tip_cents: i64,
    /// `cash`, `card` or `nfc` after payment.
    pub payment_method: Option<String>,
    /// Time the order was opened.
    pub opened_at: i64,
    /// Time the table was settled.
    pub paid_at: Option<i64>,
    /// Cash handed over, when paid in cash.
    pub cash_tendered_cents: Option<i64>,
    /// Change returned, when paid in cash.
    pub cash_change_cents: Option<i64>,
    /// Whether a GoBD hospitality receipt was requested.
    pub is_hospitality_receipt: bool,
    /// Host / company of the hospitality receipt.
    pub hospitality_host: String,
    /// Occasion of the hospitality receipt.
    pub hospitality_occasion: String,
    /// Guests of the hospitality receipt.
    pub hospitality_guests: String,
    /// Receipt number after checkout (`GASTRO/YYYY/NNNN`).
    pub receipt_number: Option<String>,
    /// Linked ERP invoice.
    pub invoice_id: Option<Uuid>,
    /// Creation time.
    pub created_at: i64,
    /// Last change time.
    pub updated_at: i64,
}

impl TableOrder {
    /// Opens an empty order for a table.
    pub fn new(table_number: &str, now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            table_number: table_number.trim().to_string(),
            server_name: String::new(),
            status: "ordered".to_string(),
            items: Vec::new(),
            subtotal_cents: 0,
            tax_total_cents: 0,
            total_cents: 0,
            tip_cents: 0,
            payment_method: None,
            opened_at: now,
            paid_at: None,
            cash_tendered_cents: None,
            cash_change_cents: None,
            is_hospitality_receipt: false,
            hospitality_host: String::new(),
            hospitality_occasion: String::new(),
            hospitality_guests: String::new(),
            receipt_number: None,
            invoice_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Adds one unit of a dish, merging with an uncommented line of the same name.
    ///
    /// Returns `true` when this opened a new order line.
    pub fn add_menu_item(&mut self, dish: &MenuItem, now: i64) -> bool {
        let created = match self
            .items
            .iter_mut()
            .find(|item| item.name == dish.name && item.notes.trim().is_empty())
        {
            Some(item) => {
                item.qty += 1;
                false
            }
            None => {
                self.items.push(TableOrderItem {
                    id: Uuid::new_v4(),
                    menu_item_id: Some(dish.id),
                    name: dish.name.clone(),
                    price_cents: dish.price_cents,
                    tax_rate_bp: dish.tax_rate_bp,
                    qty: 1,
                    category: dish.category.clone(),
                    emoji: dish.emoji.clone(),
                    notes: String::new(),
                });
                true
            }
        };
        if self.status == "preparing" {
            // Adding during preparation keeps the kitchen ticket open.
        } else if self.status != "paid" {
            self.status = "ordered".to_string();
        }
        self.updated_at = now;
        self.recalculate();
        created
    }

    /// Sets the quantity of one line; zero or less removes it.
    ///
    /// Returns `false` when the order has no positions left and must be deleted.
    pub fn set_item_qty(&mut self, item_id: Uuid, qty: i64, now: i64) -> bool {
        if qty <= 0 {
            self.items.retain(|item| item.id != item_id);
        } else if let Some(item) = self.items.iter_mut().find(|item| item.id == item_id) {
            item.qty = qty;
        }
        self.updated_at = now;
        self.recalculate();
        !self.items.is_empty()
    }

    /// Updates the kitchen note of one line.
    pub fn set_item_notes(&mut self, item_id: Uuid, notes: &str, now: i64) -> bool {
        if let Some(item) = self.items.iter_mut().find(|item| item.id == item_id) {
            item.notes = notes.trim().to_string();
            self.updated_at = now;
            true
        } else {
            false
        }
    }

    /// Recomputes net, tax and gross totals from the positions.
    ///
    /// The legacy TypeScript screen groups all positions by tax rate before calculating VAT.
    /// Keep that order of operations: rounding each line separately can differ by a cent.
    pub fn recalculate(&mut self) {
        let mut tax_bases: Vec<(i64, i64)> = Vec::new();
        self.subtotal_cents = 0;

        for item in &self.items {
            let net_cents = item.net().cents();
            self.subtotal_cents += net_cents;
            if let Some((_, subtotal)) = tax_bases
                .iter_mut()
                .find(|(rate, _)| *rate == item.tax_rate_bp)
            {
                *subtotal += net_cents;
            } else {
                tax_bases.push((item.tax_rate_bp, net_cents));
            }
        }

        self.tax_total_cents = tax_bases
            .into_iter()
            .map(|(rate, subtotal)| Money::from_cents(subtotal).tax(rate).cents())
            .sum();
        self.total_cents = self.subtotal_cents + self.tax_total_cents;
    }

    /// Total guests / positions, as the TS counters show them.
    pub fn item_quantity(&self) -> i64 {
        self.items.iter().map(|item| item.qty).sum()
    }

    /// Validates the stored order.
    pub fn validate(&self) -> Result<(), String> {
        if self.table_number.trim().is_empty() {
            return Err("restaurant_table_required".to_string());
        }
        if !valid_status(&self.status) {
            return Err("restaurant_order_status_invalid".to_string());
        }
        if let Some(method) = &self.payment_method {
            if !valid_payment_method(method) {
                return Err("restaurant_payment_method_invalid".to_string());
            }
        }
        if self.items.is_empty() && self.status != "paid" {
            return Err("restaurant_order_items_required".to_string());
        }
        for item in &self.items {
            if item.name.trim().is_empty() {
                return Err("restaurant_item_name_required".to_string());
            }
            if item.qty <= 0 {
                return Err("restaurant_item_qty_invalid".to_string());
            }
            if item.price_cents < 0 {
                return Err("restaurant_item_price_invalid".to_string());
            }
            if !(0..=10_000).contains(&item.tax_rate_bp) {
                return Err("restaurant_item_tax_invalid".to_string());
            }
        }
        Ok(())
    }

    /// Number of positions (distinct lines), as the history archive counts them.
    pub fn line_count(&self) -> usize {
        self.items.len()
    }
}

/// One fixed table of the floor plan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RestaurantTable {
    /// Stable floor-plan id (`T-1`, `TOGO`, ...).
    pub id: String,
    /// Display name used as the order's table number.
    pub name: String,
    /// `indoor`, `terrace`, `bar` or `togo`.
    pub area: String,
    /// Number of seats; zero for takeaway.
    pub seats: i64,
}

/// The 13 fixed tables of `RestaurantModule.tsx`.
pub fn tables() -> Vec<RestaurantTable> {
    [
        ("T-1", "Tisch 1 (Fenster)", "indoor", 4),
        ("T-2", "Tisch 2", "indoor", 4),
        ("T-3", "Tisch 3 (Ecke)", "indoor", 6),
        ("T-4", "Tisch 4", "indoor", 2),
        ("T-5", "Tisch 5 (Lounge)", "indoor", 8),
        ("T-6", "Tisch 6", "indoor", 4),
        ("T-7", "Tisch 7 (Terrasse)", "terrace", 4),
        ("T-8", "Tisch 8 (Terrasse)", "terrace", 4),
        ("T-9", "Tisch 9 (Terrasse)", "terrace", 6),
        ("B-1", "Bar Platz 1", "bar", 1),
        ("B-2", "Bar Platz 2", "bar", 1),
        ("B-3", "Bar Platz 3", "bar", 1),
        ("TOGO", "To-Go / Abholung", "togo", 0),
    ]
    .into_iter()
    .map(|(id, name, area, seats)| RestaurantTable {
        id: id.to_string(),
        name: name.to_string(),
        area: area.to_string(),
        seats,
    })
    .collect()
}

/// The eleven default dishes of the TypeScript module.
pub fn default_menu() -> Vec<MenuItem> {
    fn dish(
        (
            number,
            name,
            category,
            price_cents,
            tax_rate_bp,
            ingredients,
            allergens,
            emoji,
            prep_time_minutes,
        ): (u32, &str, &str, i64, i64, &str, &[&str], &str, i64),
    ) -> MenuItem {
        MenuItem {
            id: Uuid::parse_str(&format!("00000000-0000-4000-8000-{number:012}")).unwrap(),
            name: name.to_string(),
            category: category.to_string(),
            price_cents,
            tax_rate_bp,
            ingredients: ingredients.to_string(),
            allergens: allergens.iter().map(|value| value.to_string()).collect(),
            emoji: emoji.to_string(),
            prep_time_minutes,
            is_available: true,
            created_at: 0,
        }
    }

    vec![
        dish((
            101,
            "Bruschetta Classico",
            "starters",
            750,
            700,
            "Geröstetes Ciabatta, Strauchtomaten, Basilikum, Knoblauch, natives Olivenöl",
            &["A (Gluten)"],
            "🥖",
            8,
        )),
        dish((
            102,
            "Carpaccio di Manzo",
            "starters",
            1420,
            700,
            "Hauchdünnes Rinderfilet, Rucola, gehobelter Parmesan, Trüffel-Vinaigrette",
            &["G (Milch)"],
            "🥩",
            10,
        )),
        dish((
            103,
            "Pizza Margherita DOC",
            "pizza",
            1050,
            700,
            "San Marzano Tomatensugo, Fior di Latte Mozzarella, frisches Basilikum",
            &["A (Gluten)", "G (Milch)"],
            "🍕",
            12,
        )),
        dish((
            104,
            "Pizza Diavola Piccante",
            "pizza",
            1380,
            700,
            "Scharfe kalabrische Salami, Peperoni, rote Zwiebeln, Mozzarella",
            &["A (Gluten)", "G (Milch)"],
            "🍕",
            12,
        )),
        dish((
            105,
            "Pizza Quattro Formaggi & Tartufo",
            "pizza",
            1550,
            700,
            "Mozzarella, Gorgonzola, Taleggio, Ricotta, schwarze Trüffelcreme",
            &["A (Gluten)", "G (Milch)"],
            "🧀",
            14,
        )),
        dish((
            106,
            "Dry-Aged Angus Burger Deluxe",
            "burgers",
            1690,
            700,
            "200g Black Angus Patty, Brioche Bun, Cheddar, Bacon-Jam, Pommes frites",
            &["A (Gluten)", "C (Ei)", "G (Milch)"],
            "🍔",
            15,
        )),
        dish((
            107,
            "Tagliolini al Tartufo Fresco",
            "mains",
            1850,
            700,
            "Frische Eierpasta im Parmesanlaib geschwenkt mit frischem Sommertrüffel",
            &["A (Gluten)", "C (Ei)", "G (Milch)"],
            "🍝",
            12,
        )),
        dish((
            108,
            "Tiramisù Tradizionale",
            "desserts",
            680,
            700,
            "Löffelbiskuits, Espresso, Mascarponecreme, feinstes Kakaopulver",
            &["A (Gluten)", "C (Ei)", "G (Milch)"],
            "🍰",
            5,
        )),
        dish((
            109,
            "San Pellegrino Mineralwasser (0.75l)",
            "drinks",
            620,
            1900,
            "Natürliches Mineralwasser aus den italienischen Alpen",
            &[],
            "💧",
            2,
        )),
        dish((
            110,
            "Aperol Spritz Veneziano (0.25l)",
            "drinks",
            790,
            1900,
            "Aperol, Valdobbiadene Prosecco DOCG, Soda, frische Orangenscheibe",
            &["O (Sulfite)"],
            "🍹",
            3,
        )),
        dish((
            111,
            "Espresso Barista Arabica",
            "drinks",
            280,
            1900,
            "100% Arabica Siebträger-Espresso",
            &[],
            "☕",
            2,
        )),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_the_dish_and_order_fields() {
        let mut dish = default_menu().remove(0);
        dish.validate().expect("default dish");
        dish.normalize();
        assert_eq!(dish.name, "Bruschetta Classico");

        dish.name = "   ".to_string();
        assert_eq!(
            dish.validate(),
            Err("restaurant_dish_name_required".to_string())
        );
        dish.name = "Test".to_string();
        dish.category = "invalid".to_string();
        assert_eq!(
            dish.validate(),
            Err("restaurant_dish_category_invalid".to_string())
        );
        dish.category = "mains".to_string();
        dish.tax_rate_bp = 12_000;
        assert_eq!(
            dish.validate(),
            Err("restaurant_dish_tax_invalid".to_string())
        );

        let tables = tables();
        assert_eq!(tables.len(), 13);
        assert_eq!(tables[0].name, "Tisch 1 (Fenster)");
        assert_eq!(tables[12].area, "togo");
    }

    #[test]
    fn aggregates_tax_by_rate_before_rounding_like_typescript() {
        let mut order = TableOrder::new("Tisch 1", 1_000);
        order.items = vec![
            TableOrderItem {
                id: Uuid::new_v4(),
                menu_item_id: None,
                name: "Kleiner Artikel A".to_string(),
                price_cents: 7,
                tax_rate_bp: 700,
                qty: 1,
                category: "drinks".to_string(),
                emoji: String::new(),
                notes: String::new(),
            },
            TableOrderItem {
                id: Uuid::new_v4(),
                menu_item_id: None,
                name: "Kleiner Artikel B".to_string(),
                price_cents: 7,
                tax_rate_bp: 700,
                qty: 1,
                category: "drinks".to_string(),
                emoji: String::new(),
                notes: String::new(),
            },
        ];

        order.recalculate();

        assert_eq!(order.subtotal_cents, 14);
        assert_eq!(order.tax_total_cents, 1);
        assert_eq!(order.total_cents, 15);
    }

    #[test]
    fn adds_merges_and_recalculates_table_orders() {
        let menu = default_menu();
        let pizza = &menu[2];
        let water = &menu[8];
        let mut order = TableOrder::new("Tisch 1 (Fenster)", 1_000);
        assert!(order.add_menu_item(pizza, 1_000));
        assert!(!order.add_menu_item(pizza, 1_100));
        assert!(order.add_menu_item(water, 1_200));
        assert_eq!(order.items.len(), 2);
        assert_eq!(order.items[0].qty, 2);
        assert_eq!(order.subtotal_cents, 2_720);
        assert_eq!(order.tax_total_cents, 265);
        assert_eq!(order.total_cents, 2_985);

        let item_id = order.items[0].id;
        assert!(order.set_item_qty(item_id, 1, 1_300));
        assert_eq!(order.subtotal_cents, 1_670);
        assert_eq!(order.tax_total_cents, 192);
        assert_eq!(order.total_cents, 1_862);
        assert!(order.set_item_notes(order.items[0].id, " ohne Zwiebeln ", 1_400));
        assert_eq!(order.items[0].notes, "ohne Zwiebeln");
        assert!(order.set_item_qty(order.items[0].id, 0, 1_500));
        assert!(!order.set_item_qty(order.items[0].id, 0, 1_600));
        assert!(order.items.is_empty());
        assert!(!order.set_item_qty(item_id, 0, 1_700));
    }
}
