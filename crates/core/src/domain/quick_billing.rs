//! Quick billing (Schnellkasse): dishes with side options, the cart, receipts and the daily
//! summary.
//!
//! Ported from `SOCDOF - TS/src/components/sales/IOSBillingModule.tsx`. The TypeScript module kept
//! its dishes, receipts and settings in `localStorage`; here they are plain values that the store
//! persists in SQLite, so the same receipt list survives a restart and can be reasoned about in tests.
//!
//! Prices are **gross** (as on a menu card), which is why the tax of a line is contained in the
//! price instead of added to it. Every amount is integer cents; the tax is derived with half-up
//! rounding from the gross amount, so a receipt always adds up to the cent.
//!
//! Cancelling a sale never deletes anything: the original receipt becomes [`ReceiptStatus::Cancelled`]
//! and a linked storno receipt with negated amounts is written, which is what a cash register audit
//! expects.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// One selectable side or extra of a dish, for example `Beilage: Kartoffelsalat`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DishOption {
    /// Group the option belongs to; a cart line takes at most one option per group.
    pub group: String,
    /// Name shown on the option sheet and copied onto the receipt.
    pub name: String,
    /// Surcharge on top of the dish price.
    pub extra_price: Money,
    /// Whether the option is preselected when the option sheet opens.
    #[serde(default)]
    pub default: bool,
}

impl DishOption {
    /// Creates an option without a surcharge.
    pub fn new(group: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            group: group.into(),
            name: name.into(),
            extra_price: Money::ZERO,
            default: false,
        }
    }

    /// Label used in the cart and on the receipt (`Beilage: Kartoffelsalat`).
    pub fn label(&self) -> String {
        format!("{}: {}", self.group, self.name)
    }
}

/// A dish or drink of the quick billing menu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuickDish {
    /// Stable identifier.
    pub id: Uuid,
    /// Name on the tile and the receipt.
    pub name: String,
    /// Menu category, free text like `Hauptgerichte` or `Getränke`.
    pub category: String,
    /// Gross sales price.
    pub price: Money,
    /// Tax rate in basis points (`700` = 7 %, `1900` = 19 %).
    pub tax_rate_bp: i64,
    /// Optional description for the tile.
    pub description: String,
    /// Emoji shown on the tile and in the cart.
    pub emoji: String,
    /// Article number, optional.
    pub sku: String,
    /// Tracked stock; `0` means the dish is not counted.
    pub stock: i64,
    /// Whether the tile can be sold.
    pub enabled: bool,
    /// Sides and extras offered when the tile is tapped.
    pub options: Vec<DishOption>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl QuickDish {
    /// Creates an enabled dish without options.
    pub fn new(name: impl Into<String>, now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            category: String::new(),
            price: Money::ZERO,
            tax_rate_bp: 700,
            description: String::new(),
            emoji: "🍽️".to_string(),
            sku: String::new(),
            stock: 0,
            enabled: true,
            options: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Validates the dish before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("name_required".to_string());
        }
        if self.name.chars().count() > 120 {
            return Err("name_too_long".to_string());
        }
        if self.price.cents() < 0 {
            return Err("price_negative".to_string());
        }
        if !(0..=10_000).contains(&self.tax_rate_bp) {
            return Err("tax_rate_out_of_range".to_string());
        }
        if self.stock < 0 {
            return Err("stock_negative".to_string());
        }
        Ok(())
    }

    /// Gross price with the surcharges of the given options.
    pub fn price_with(&self, options: &[DishOption]) -> Money {
        options
            .iter()
            .fold(self.price, |total, option| total + option.extra_price)
    }

    /// Options preselected on the option sheet.
    pub fn default_options(&self) -> Vec<DishOption> {
        self.options
            .iter()
            .filter(|option| option.default)
            .cloned()
            .collect()
    }
}

/// Payment method of a receipt, in the order of the TypeScript payment sheet.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    /// Cash with tendered amount and change.
    Cash,
    /// Card terminal.
    Card,
    /// NFC / Apple Pay.
    Nfc,
}

impl PaymentMethod {
    /// Every method in payment sheet order.
    pub const ALL: [PaymentMethod; 3] =
        [PaymentMethod::Cash, PaymentMethod::Card, PaymentMethod::Nfc];

    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            PaymentMethod::Cash => "cash",
            PaymentMethod::Card => "card",
            PaymentMethod::Nfc => "apple_pay",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "cash" => Some(PaymentMethod::Cash),
            "card" => Some(PaymentMethod::Card),
            "apple_pay" => Some(PaymentMethod::Nfc),
            _ => None,
        }
    }
}

/// Lifecycle of a receipt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReceiptStatus {
    /// Paid sale.
    Completed,
    /// Sale that was cancelled; the linked storno receipt carries the negated amounts.
    Cancelled,
    /// Reversal booking written when a sale is cancelled.
    Storno,
}

impl ReceiptStatus {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            ReceiptStatus::Completed => "completed",
            ReceiptStatus::Cancelled => "cancelled",
            ReceiptStatus::Storno => "storno",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "completed" => Some(ReceiptStatus::Completed),
            "cancelled" => Some(ReceiptStatus::Cancelled),
            "storno" => Some(ReceiptStatus::Storno),
            _ => None,
        }
    }

    /// Whether the receipt counts towards the daily figures.
    pub fn counts_towards_sales(self) -> bool {
        self == ReceiptStatus::Completed
    }
}

/// One position of a receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReceiptLine {
    /// Dish the line was created from, `None` if the dish was deleted later.
    pub dish_id: Option<Uuid>,
    /// Name copied from the dish, so later menu changes never rewrite a receipt.
    pub name: String,
    /// Category copied from the dish, used by the statistics.
    pub category: String,
    /// Emoji copied from the dish.
    pub emoji: String,
    /// Quantity in whole pieces (`2` = two portions).
    pub quantity: i64,
    /// Gross unit price including the selected options.
    pub unit_price: Money,
    /// Tax rate in basis points.
    pub tax_rate_bp: i64,
    /// Selected option labels, in menu order (`Beilage: Pommes`).
    pub options: Vec<String>,
    /// Free-text note for the kitchen.
    pub note: Option<String>,
}

impl ReceiptLine {
    /// Gross amount of the position.
    pub fn gross(&self) -> Money {
        self.unit_price.times(self.quantity)
    }

    /// Net amount contained in the gross price, rounded half up.
    pub fn net(&self) -> Money {
        let gross = self.gross().cents() as i128;
        let divisor = 10_000_i128 + self.tax_rate_bp as i128;
        let raw = gross * 10_000;
        let net = if raw >= 0 {
            (raw + divisor / 2) / divisor
        } else {
            (raw - divisor / 2) / divisor
        };
        Money::from_cents(net as i64)
    }

    /// Tax contained in the gross price.
    pub fn tax(&self) -> Money {
        self.gross() - self.net()
    }

    /// Validates the position.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("line_name_required".to_string());
        }
        if self.quantity <= 0 {
            return Err("line_quantity_invalid".to_string());
        }
        if self.unit_price.cents() < 0 {
            return Err("line_price_negative".to_string());
        }
        if !(0..=10_000).contains(&self.tax_rate_bp) {
            return Err("line_tax_rate_out_of_range".to_string());
        }
        Ok(())
    }
}

/// A cash register receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuickReceipt {
    /// Stable identifier.
    pub id: Uuid,
    /// Human readable number (`BON-2026-0001`, or `STO-2026-0001` for a reversal).
    pub number: String,
    /// Lifecycle state.
    pub status: ReceiptStatus,
    /// Sale time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Cancellation time, set on the original receipt and on its storno booking.
    pub cancelled_at: Option<i64>,
    /// Original receipt a storno booking belongs to.
    pub storno_of: Option<Uuid>,
    /// Payment method.
    pub payment: PaymentMethod,
    /// Cash handed over by the guest; equals the total for card and NFC.
    pub tendered: Money,
    /// Change paid back; zero for card and NFC.
    pub change: Money,
    /// TSE signature printed on the receipt.
    pub tse_signature: String,
    /// Positions of the receipt, in cart order.
    pub lines: Vec<ReceiptLine>,
}

impl QuickReceipt {
    /// Gross total of the receipt.
    pub fn gross(&self) -> Money {
        self.lines
            .iter()
            .fold(Money::ZERO, |total, line| total + line.gross())
    }

    /// Net total of the receipt.
    pub fn net(&self) -> Money {
        self.lines
            .iter()
            .fold(Money::ZERO, |total, line| total + line.net())
    }

    /// Tax total of the receipt.
    pub fn tax(&self) -> Money {
        self.gross() - self.net()
    }

    /// Tax split by rate: `(7 %, 19 %)`.
    pub fn tax_split(&self) -> (Money, Money) {
        let mut reduced = Money::ZERO;
        let mut standard = Money::ZERO;
        for line in &self.lines {
            if line.tax_rate_bp <= 700 {
                reduced = reduced + line.tax();
            } else {
                standard = standard + line.tax();
            }
        }
        (reduced, standard)
    }

    /// Item count over all positions.
    pub fn item_count(&self) -> i64 {
        self.lines.iter().map(|line| line.quantity).sum()
    }

    /// Validates the receipt before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.number.trim().is_empty() {
            return Err("number_required".to_string());
        }
        if self.lines.is_empty() && self.status != ReceiptStatus::Storno {
            return Err("lines_required".to_string());
        }
        for line in &self.lines {
            line.validate()?;
        }
        if self.status != ReceiptStatus::Storno
            && self.payment == PaymentMethod::Cash
            && self.change.cents() < 0
        {
            return Err("change_negative".to_string());
        }
        Ok(())
    }

    /// Reversal booking for this receipt, written when the sale is cancelled.
    pub fn storno(&self, number: String, now: i64) -> QuickReceipt {
        let mut lines = self.lines.clone();
        for line in &mut lines {
            line.unit_price = Money::from_cents(-line.unit_price.cents());
        }
        QuickReceipt {
            id: Uuid::new_v4(),
            number,
            status: ReceiptStatus::Storno,
            created_at: now,
            cancelled_at: Some(now),
            storno_of: Some(self.id),
            payment: self.payment,
            tendered: Money::from_cents(-self.tendered.cents()),
            change: Money::ZERO,
            tse_signature: tse_signature(now),
            lines,
        }
    }
}

/// Daily figures of the quick billing register.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct DaySummary {
    /// Number of counted receipts.
    pub receipts: i64,
    /// Gross revenue.
    pub gross: Money,
    /// Net revenue.
    pub net: Money,
    /// Tax at the reduced rate (7 %).
    pub tax_reduced: Money,
    /// Tax at the standard rate (19 %).
    pub tax_standard: Money,
    /// Cash revenue.
    pub cash: Money,
    /// Card revenue.
    pub card: Money,
    /// NFC revenue.
    pub nfc: Money,
    /// Sold items.
    pub items: i64,
}

impl DaySummary {
    /// Average receipt value; zero without receipts.
    pub fn average(&self) -> Money {
        if self.receipts == 0 {
            Money::ZERO
        } else {
            Money::from_cents(self.gross.cents() / self.receipts)
        }
    }

    /// Revenue of one payment method.
    pub fn payment_total(&self, method: PaymentMethod) -> Money {
        match method {
            PaymentMethod::Cash => self.cash,
            PaymentMethod::Card => self.card,
            PaymentMethod::Nfc => self.nfc,
        }
    }
}

/// One dish of the sales statistics.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DishSales {
    /// Dish the figures belong to; `None` for deleted dishes.
    pub dish_id: Option<Uuid>,
    /// Name copied from the receipt.
    pub name: String,
    /// Emoji copied from the receipt.
    pub emoji: String,
    /// Sold pieces.
    pub quantity: i64,
    /// Gross revenue.
    pub revenue: Money,
}

/// Adds up the completed receipts of the day or the whole list.
///
/// Cancelled sales and their storno bookings are skipped, so cancelling adjusts every figure.
pub fn summarize(receipts: &[QuickReceipt]) -> DaySummary {
    let mut summary = DaySummary::default();
    for receipt in receipts {
        if !receipt.status.counts_towards_sales() {
            continue;
        }
        summary.receipts += 1;
        summary.gross = summary.gross + receipt.gross();
        summary.net = summary.net + receipt.net();
        let (reduced, standard) = receipt.tax_split();
        summary.tax_reduced = summary.tax_reduced + reduced;
        summary.tax_standard = summary.tax_standard + standard;
        summary.items += receipt.item_count();
        match receipt.payment {
            PaymentMethod::Cash => summary.cash = summary.cash + receipt.gross(),
            PaymentMethod::Card => summary.card = summary.card + receipt.gross(),
            PaymentMethod::Nfc => summary.nfc = summary.nfc + receipt.gross(),
        }
    }
    summary
}

/// Sold dishes of the completed receipts, best seller first.
pub fn dish_sales(receipts: &[QuickReceipt]) -> Vec<DishSales> {
    let mut sales: Vec<DishSales> = Vec::new();
    for receipt in receipts {
        if !receipt.status.counts_towards_sales() {
            continue;
        }
        for line in &receipt.lines {
            let entry = match sales.iter_mut().find(|entry| entry.dish_id == line.dish_id) {
                Some(entry) => entry,
                None => {
                    sales.push(DishSales {
                        dish_id: line.dish_id,
                        name: line.name.clone(),
                        emoji: line.emoji.clone(),
                        quantity: 0,
                        revenue: Money::ZERO,
                    });
                    sales.last_mut().expect("just pushed")
                }
            };
            entry.quantity += line.quantity;
            entry.revenue = entry.revenue + line.gross();
        }
    }
    sales.sort_by(|left, right| {
        right
            .quantity
            .cmp(&left.quantity)
            .then_with(|| left.name.cmp(&right.name))
    });
    sales
}

/// Sold options (`Beilage: Pommes`) of the completed receipts, most ordered first.
pub fn option_sales(receipts: &[QuickReceipt]) -> Vec<(String, i64)> {
    let mut counts: Vec<(String, i64)> = Vec::new();
    for receipt in receipts {
        if !receipt.status.counts_towards_sales() {
            continue;
        }
        for line in &receipt.lines {
            for option in &line.options {
                match counts.iter_mut().find(|(label, _)| label == option) {
                    Some((_, count)) => *count += line.quantity,
                    None => counts.push((option.clone(), line.quantity)),
                }
            }
        }
    }
    counts.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    counts
}

/// Next receipt number of the year, skipping numbers that already belong to a reversal.
pub fn next_number(receipts: &[QuickReceipt], now: i64) -> String {
    let (year, _, _) = crate::date::civil_from_millis(now);
    let prefix = format!("BON-{year}-");
    let highest = receipts
        .iter()
        .filter_map(|receipt| receipt.number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

/// Next storno number of the year.
pub fn next_storno_number(receipts: &[QuickReceipt], now: i64) -> String {
    let (year, _, _) = crate::date::civil_from_millis(now);
    let prefix = format!("STO-{year}-");
    let highest = receipts
        .iter()
        .filter_map(|receipt| receipt.number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

/// Deterministic TSE-like signature of a receipt time, in the shape of the reference.
pub fn tse_signature(now: i64) -> String {
    let mut value = now.unsigned_abs();
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut signature = String::new();
    for _ in 0..8 {
        signature.push(alphabet[(value % alphabet.len() as u64) as usize] as char);
        value /= alphabet.len() as u64;
    }
    format!("TSE-DE-{signature}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_795_780_800_000;

    fn line(name: &str, cents: i64, quantity: i64, rate_bp: i64) -> ReceiptLine {
        ReceiptLine {
            dish_id: Some(Uuid::new_v4()),
            name: name.to_string(),
            category: "Hauptgerichte".to_string(),
            emoji: "🍽️".to_string(),
            quantity,
            unit_price: Money::from_cents(cents),
            tax_rate_bp: rate_bp,
            options: Vec::new(),
            note: None,
        }
    }

    fn receipt(number: &str, lines: Vec<ReceiptLine>) -> QuickReceipt {
        QuickReceipt {
            id: Uuid::new_v4(),
            number: number.to_string(),
            status: ReceiptStatus::Completed,
            created_at: NOW,
            cancelled_at: None,
            storno_of: None,
            payment: PaymentMethod::Cash,
            tendered: Money::ZERO,
            change: Money::ZERO,
            tse_signature: tse_signature(NOW),
            lines,
        }
    }

    #[test]
    fn contained_tax_uses_the_gross_price_and_adds_up() {
        let seven = line("Schnitzel", 1_850, 1, 700);
        assert_eq!(seven.gross(), Money::from_cents(1_850));
        // 1850 / 1.07 = 1728.97 -> 1729 net (half up), 121 tax.
        assert_eq!(seven.net(), Money::from_cents(1_729));
        assert_eq!(seven.tax(), Money::from_cents(121));

        let nineteen = line("Limonade", 450, 2, 1900);
        assert_eq!(nineteen.gross(), Money::from_cents(900));
        // 900 / 1.19 = 756.30 -> 756 net, 144 tax.
        assert_eq!(nineteen.net(), Money::from_cents(756));
        assert_eq!(nineteen.tax(), Money::from_cents(144));
    }

    #[test]
    fn receipt_totals_split_tax_by_rate() {
        let order = receipt(
            "BON-2026-0001",
            vec![
                line("Schnitzel", 1_850, 1, 700),
                line("Limonade", 450, 1, 1900),
            ],
        );
        assert_eq!(order.gross(), Money::from_cents(2_300));
        assert_eq!(order.net(), Money::from_cents(2_107));
        assert_eq!(
            order.tax_split(),
            (Money::from_cents(121), Money::from_cents(72))
        );
        assert_eq!(order.item_count(), 2);
    }

    #[test]
    fn cancelling_writes_a_negative_storno_and_leaves_the_sales() {
        let mut original = receipt("BON-2026-0001", vec![line("Schnitzel", 1_850, 2, 700)]);
        original.payment = PaymentMethod::Card;
        original.tendered = Money::from_cents(3_700);
        let storno = original.storno("STO-2026-0001".to_string(), NOW + 60_000);

        assert_eq!(storno.status, ReceiptStatus::Storno);
        assert_eq!(storno.storno_of, Some(original.id));
        assert_eq!(storno.gross(), Money::from_cents(-3_700));
        assert_eq!(storno.lines[0].unit_price, Money::from_cents(-1_850));

        let mut cancelled = original.clone();
        cancelled.status = ReceiptStatus::Cancelled;
        cancelled.cancelled_at = Some(NOW + 60_000);

        let summary = summarize(&[cancelled, storno]);
        assert_eq!(summary.receipts, 0);
        assert_eq!(summary.gross, Money::ZERO);
        assert_eq!(summary.card, Money::ZERO);
    }

    #[test]
    fn summary_counts_completed_receipts_by_payment_and_rate() {
        let mut cash = receipt("BON-2026-0001", vec![line("Schnitzel", 1_850, 1, 700)]);
        cash.tendered = Money::from_cents(2_000);
        cash.change = Money::from_cents(150);
        let mut card = receipt("BON-2026-0002", vec![line("Limonade", 450, 2, 1900)]);
        card.payment = PaymentMethod::Card;
        card.tendered = Money::from_cents(900);
        let mut nfc = receipt("BON-2026-0003", vec![line("Espresso", 270, 1, 1900)]);
        nfc.payment = PaymentMethod::Nfc;
        nfc.tendered = Money::from_cents(270);

        let summary = summarize(&[cash, card, nfc]);
        assert_eq!(summary.receipts, 3);
        assert_eq!(summary.gross, Money::from_cents(3_020));
        assert_eq!(summary.cash, Money::from_cents(1_850));
        assert_eq!(summary.card, Money::from_cents(900));
        assert_eq!(summary.nfc, Money::from_cents(270));
        assert_eq!(summary.items, 4);
        assert_eq!(summary.average(), Money::from_cents(1_006));
        assert_eq!(
            summary.payment_total(PaymentMethod::Nfc),
            Money::from_cents(270)
        );
    }

    #[test]
    fn dish_and_option_sales_rank_by_quantity() {
        let mut pommes = line("Schnitzel", 1_850, 2, 700);
        pommes.options = vec!["Beilage: Pommes".to_string()];
        let mut salad = line("Schnitzel", 1_850, 1, 700);
        salad.dish_id = pommes.dish_id;
        salad.options = vec!["Beilage: Kartoffelsalat".to_string()];
        let order = receipt("BON-2026-0001", vec![pommes, salad]);

        let sales = dish_sales(std::slice::from_ref(&order));
        assert_eq!(sales[0].quantity, 3);
        assert_eq!(sales[0].revenue, Money::from_cents(5_550));

        let options = option_sales(&[order]);
        assert_eq!(options[0], ("Beilage: Pommes".to_string(), 2));
        assert_eq!(options[1], ("Beilage: Kartoffelsalat".to_string(), 1));
    }

    #[test]
    fn numbers_increment_per_year_and_kind() {
        let receipts = vec![
            receipt("BON-2026-0007", vec![line("A", 100, 1, 700)]),
            receipt("STO-2026-0003", vec![line("A", -100, 1, 700)]),
        ];
        assert_eq!(next_number(&receipts, NOW), "BON-2026-0008");
        assert_eq!(next_storno_number(&receipts, NOW), "STO-2026-0004");
    }

    #[test]
    fn dish_validation_rejects_invalid_values() {
        let mut dish = QuickDish::new("", NOW);
        assert_eq!(dish.validate(), Err("name_required".to_string()));
        dish.name = "Schnitzel".to_string();
        assert!(dish.validate().is_ok());
        dish.tax_rate_bp = 12_000;
        assert_eq!(dish.validate(), Err("tax_rate_out_of_range".to_string()));
    }
}
