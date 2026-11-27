//! Point-of-sale orders (receipts) taken at the counter.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::stock::{StockMove, StockMoveKind};
use crate::money::Money;

/// How a POS order was paid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    /// Cash payment.
    Cash,
    /// Card payment at the terminal.
    Card,
    /// Contactless NFC or mobile wallet payment.
    Nfc,
    /// Bank transfer after the sale (B2B).
    BankTransfer,
    /// Put on the customer's account as an invoice.
    Invoice,
    /// Anything else, explained in the note.
    Other,
}

impl PaymentMethod {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            PaymentMethod::Cash => "cash",
            PaymentMethod::Card => "card",
            PaymentMethod::Nfc => "nfc",
            PaymentMethod::BankTransfer => "bank_transfer",
            PaymentMethod::Invoice => "invoice",
            PaymentMethod::Other => "other",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "cash" => Some(PaymentMethod::Cash),
            "card" => Some(PaymentMethod::Card),
            "nfc" => Some(PaymentMethod::Nfc),
            "bank_transfer" => Some(PaymentMethod::BankTransfer),
            "invoice" => Some(PaymentMethod::Invoice),
            "other" => Some(PaymentMethod::Other),
            _ => None,
        }
    }
}

/// One sold position.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PosOrderLine {
    /// Linked product, empty for free-text positions.
    pub product_id: Option<Uuid>,
    /// Description printed on the receipt.
    pub description: String,
    /// Quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net unit price.
    pub unit_price: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
}

impl PosOrderLine {
    /// Net amount of this position.
    pub fn net(&self) -> Money {
        Money::from_cents(self.unit_price.cents() * self.quantity_milli / 1_000)
    }

    /// Net amount after a receipt-wide discount in basis points.
    pub fn net_for(&self, discount_bp: i64) -> Money {
        Money::from_cents(self.net().cents() * (10_000 - discount_bp.clamp(0, 10_000)) / 10_000)
    }

    /// Tax amount of this position after the receipt-wide discount.
    pub fn tax_for(&self, discount_bp: i64) -> Money {
        self.net_for(discount_bp).tax(self.tax_rate_bp)
    }

    /// Tax amount of this position without a discount.
    pub fn tax(&self) -> Money {
        self.net().tax(self.tax_rate_bp)
    }

    /// Gross amount of this position without a discount.
    pub fn gross(&self) -> Money {
        self.net() + self.tax()
    }
}

/// A completed sale at the counter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PosOrder {
    /// Stable identifier.
    pub id: Uuid,
    /// Receipt number, unique per company.
    pub receipt_number: String,
    /// Customer, when the order was assigned to one.
    pub contact_id: Option<Uuid>,
    /// How the order was paid.
    pub payment_method: PaymentMethod,
    /// Payment time in milliseconds since the Unix epoch.
    pub paid_at: i64,
    /// Currency symbol used for printing.
    pub currency_symbol: String,
    /// Free text note.
    pub note: Option<String>,
    /// Optional stored VAT override for grouped-tax legacy checkouts.
    #[serde(default)]
    pub tax_total_override_cents: Option<i64>,
    /// Cash handed over by the customer, when the order was paid in cash.
    #[serde(default)]
    pub cash_given: Option<Money>,
    /// Receipt-wide discount in basis points (`500` = 5 %), applied to every net amount.
    #[serde(default)]
    pub discount_bp: i64,
    /// Sold positions.
    pub lines: Vec<PosOrderLine>,
    /// Numeric legacy identifier, when the order came from a legacy backup.
    pub legacy_id: Option<i64>,
}

impl PosOrder {
    /// Sum of all net position amounts after the receipt discount.
    pub fn total_net(&self) -> Money {
        self.lines
            .iter()
            .map(|line| line.net_for(self.discount_bp))
            .sum()
    }

    /// Sum of the tax amounts of all positions after the receipt discount.
    pub fn total_tax(&self) -> Money {
        self.tax_total_override_cents
            .map(Money::from_cents)
            .unwrap_or_else(|| {
                self.lines
                    .iter()
                    .map(|line| line.tax_for(self.discount_bp))
                    .sum()
            })
    }

    /// Amount the receipt discount took off the net sum.
    pub fn discount_amount(&self) -> Money {
        let gross_net: Money = self.lines.iter().map(PosOrderLine::net).sum();
        Money::from_cents(gross_net.cents() - self.total_net().cents())
    }

    /// Net plus tax, the amount the customer paid.
    pub fn total_gross(&self) -> Money {
        self.total_net() + self.total_tax()
    }

    /// Cash returned to the customer, when more than the total was handed over.
    pub fn change(&self) -> Option<Money> {
        self.cash_given
            .map(|given| given - self.total_gross())
            .filter(|change| change.cents() >= 0)
    }

    /// Stock movements that take the sold positions out of stock.
    ///
    /// Only positions linked to a product produce a movement. Stock is kept in whole units, so a
    /// fractional quantity is rounded up; the receipt number becomes the movement reason.
    pub fn stock_moves(&self, created_at: i64) -> Vec<StockMove> {
        self.moves(created_at, StockMoveKind::Out, self.receipt_number.clone())
    }

    /// Stock movements that put a cancelled receipt back into stock.
    pub fn return_moves(&self, created_at: i64) -> Vec<StockMove> {
        self.moves(
            created_at,
            StockMoveKind::In,
            format!("Storno {}", self.receipt_number),
        )
    }

    fn moves(&self, created_at: i64, kind: StockMoveKind, reason: String) -> Vec<StockMove> {
        self.lines
            .iter()
            .filter_map(|line| {
                let product_id = line.product_id?;
                Some(StockMove {
                    id: Uuid::new_v4(),
                    product_id,
                    kind,
                    quantity: (line.quantity_milli + 999) / 1_000,
                    reason: Some(reason.clone()),
                    created_at,
                })
            })
            .filter(|movement| movement.quantity > 0)
            .collect()
    }

    /// Validates the order before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.receipt_number.trim().is_empty() {
            return Err("receipt_number_required".to_string());
        }
        if self.currency_symbol.trim().is_empty() {
            return Err("currency_required".to_string());
        }
        if self.lines.is_empty() {
            return Err("lines_required".to_string());
        }
        if self
            .tax_total_override_cents
            .is_some_and(|amount| amount < 0)
        {
            return Err("tax_total_override_negative".to_string());
        }
        if !(0..=10_000).contains(&self.discount_bp) {
            return Err("discount_out_of_range".to_string());
        }
        if let Some(cash_given) = self.cash_given {
            if cash_given.cents() < 0 {
                return Err("cash_given_negative".to_string());
            }
            if self.payment_method == PaymentMethod::Cash && cash_given < self.total_gross() {
                return Err("cash_given_too_low".to_string());
            }
        }
        for line in &self.lines {
            if line.description.trim().is_empty() {
                return Err("line_description_required".to_string());
            }
            if line.quantity_milli <= 0 {
                return Err("line_quantity_invalid".to_string());
            }
            if line.unit_price.cents() < 0 {
                return Err("line_price_negative".to_string());
            }
            if !(0..=10_000).contains(&line.tax_rate_bp) {
                return Err("line_tax_rate_out_of_range".to_string());
            }
        }
        Ok(())
    }
}

/// Header figures of the POS list and the daily close.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PosSummary {
    /// Number of receipts.
    pub receipts: usize,
    /// Sum of the net amounts.
    pub net: Money,
    /// Sum of the tax amounts.
    pub tax: Money,
    /// Sum of the gross amounts.
    pub gross: Money,
    /// Gross amount paid in cash.
    pub cash: Money,
    /// Gross amount paid by card.
    pub card: Money,
    /// Gross amount paid by NFC or mobile wallet.
    pub nfc: Money,
    /// Gross amount paid by bank transfer.
    pub bank_transfer: Money,
    /// Gross amount put on an invoice.
    pub invoice: Money,
    /// Gross amount with another payment method.
    pub other: Money,
    /// Cash handed over across all cash receipts.
    pub cash_given: Money,
    /// Change returned across all cash receipts.
    pub change: Money,
}

impl Default for PosSummary {
    fn default() -> Self {
        Self {
            receipts: 0,
            net: Money::ZERO,
            tax: Money::ZERO,
            gross: Money::ZERO,
            cash: Money::ZERO,
            card: Money::ZERO,
            nfc: Money::ZERO,
            bank_transfer: Money::ZERO,
            invoice: Money::ZERO,
            other: Money::ZERO,
            cash_given: Money::ZERO,
            change: Money::ZERO,
        }
    }
}

/// Summarises receipts for the list header and the daily close.
pub fn summarize(orders: &[PosOrder]) -> PosSummary {
    let mut summary = PosSummary::default();
    for order in orders {
        summary.receipts += 1;
        summary.net = summary.net + order.total_net();
        summary.tax = summary.tax + order.total_tax();
        summary.gross = summary.gross + order.total_gross();
        match order.payment_method {
            PaymentMethod::Cash => summary.cash = summary.cash + order.total_gross(),
            PaymentMethod::Card => summary.card = summary.card + order.total_gross(),
            PaymentMethod::Nfc => summary.nfc = summary.nfc + order.total_gross(),
            PaymentMethod::BankTransfer => {
                summary.bank_transfer = summary.bank_transfer + order.total_gross()
            }
            PaymentMethod::Invoice => summary.invoice = summary.invoice + order.total_gross(),
            PaymentMethod::Other => summary.other = summary.other + order.total_gross(),
        }
        if let Some(given) = order.cash_given {
            summary.cash_given = summary.cash_given + given;
            if let Some(change) = order.change() {
                summary.change = summary.change + change;
            }
        }
    }
    summary
}

/// One VAT group of a day's receipts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PosTaxGroup {
    /// Tax rate in basis points.
    pub rate_bp: i64,
    /// Net sum of the group after discounts.
    pub net: Money,
    /// Tax sum of the group after discounts.
    pub tax: Money,
}

/// Daily close (Z report) of one business day.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PosZReport {
    /// Number of receipts.
    pub receipts: usize,
    /// Totals across all payment methods.
    pub summary: PosSummary,
    /// Net and tax per VAT rate, sorted by rate.
    pub tax_groups: Vec<PosTaxGroup>,
    /// First and last payment time of the day.
    pub first_at: Option<i64>,
    /// Last payment time of the day.
    pub last_at: Option<i64>,
    /// Receipt numbers in payment order.
    pub numbers: Vec<String>,
}

/// Builds the Z report of a day's receipts.
pub fn z_report(orders: &[PosOrder]) -> PosZReport {
    let mut ordered = orders.iter().collect::<Vec<_>>();
    ordered.sort_by_key(|order| (order.paid_at, order.receipt_number.clone()));

    let mut groups: Vec<PosTaxGroup> = Vec::new();
    for order in &ordered {
        for line in &order.lines {
            let net = line.net_for(order.discount_bp);
            let tax = line.tax_for(order.discount_bp);
            match groups
                .iter_mut()
                .find(|group| group.rate_bp == line.tax_rate_bp)
            {
                Some(group) => {
                    group.net = group.net + net;
                    group.tax = group.tax + tax;
                }
                None => groups.push(PosTaxGroup {
                    rate_bp: line.tax_rate_bp,
                    net,
                    tax,
                }),
            }
        }
    }
    groups.sort_by_key(|group| group.rate_bp);

    PosZReport {
        receipts: ordered.len(),
        summary: summarize(orders),
        tax_groups: groups,
        first_at: ordered.first().map(|order| order.paid_at),
        last_at: ordered.last().map(|order| order.paid_at),
        numbers: ordered
            .iter()
            .map(|order| order.receipt_number.clone())
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PosOrder {
        PosOrder {
            id: Uuid::new_v4(),
            receipt_number: "BON-2026-0001".to_string(),
            contact_id: None,
            payment_method: PaymentMethod::Card,
            paid_at: 0,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            cash_given: None,
            discount_bp: 0,
            legacy_id: None,
            lines: vec![
                PosOrderLine {
                    product_id: Some(Uuid::new_v4()),
                    description: "Espresso".to_string(),
                    quantity_milli: 2_000,
                    unit_price: Money::from_cents(250),
                    tax_rate_bp: 700,
                },
                PosOrderLine {
                    product_id: None,
                    description: "Pfand".to_string(),
                    quantity_milli: 1_000,
                    unit_price: Money::from_cents(25),
                    tax_rate_bp: 1900,
                },
            ],
        }
    }

    #[test]
    fn computes_receipt_totals() {
        let order = sample();
        assert_eq!(order.total_net(), Money::from_cents(525));
        assert_eq!(order.total_tax(), Money::from_cents(40));
        assert_eq!(order.total_gross(), Money::from_cents(565));
    }

    #[test]
    fn computes_change_and_stock_moves() {
        let mut order = sample();
        order.payment_method = PaymentMethod::Cash;
        order.cash_given = Some(Money::from_cents(1_000));
        assert_eq!(order.change(), Some(Money::from_cents(435)));
        assert_eq!(order.validate(), Ok(()));

        order.cash_given = Some(Money::from_cents(500));
        assert_eq!(order.validate(), Err("cash_given_too_low".to_string()));

        let moves = order.stock_moves(7);
        assert_eq!(moves.len(), 1);
        assert_eq!(moves[0].quantity, 2);
        let returns = order.return_moves(8);
        assert_eq!(returns.len(), 1);
        assert_eq!(returns[0].quantity, 2);
        assert!(returns[0].reason.as_deref().unwrap().contains("Storno"));
    }

    #[test]
    fn summarises_receipts_and_payment_methods() {
        let mut cash = sample();
        cash.payment_method = PaymentMethod::Cash;
        cash.cash_given = Some(Money::from_cents(1_000));
        let mut card = sample();
        card.payment_method = PaymentMethod::Card;
        let mut nfc = sample();
        nfc.payment_method = PaymentMethod::Nfc;

        let summary = summarize(&[cash, card, nfc]);
        assert_eq!(summary.receipts, 3);
        assert_eq!(summary.net, Money::from_cents(1_575));
        assert_eq!(summary.tax, Money::from_cents(120));
        assert_eq!(summary.gross, Money::from_cents(1_695));
        assert_eq!(summary.cash, Money::from_cents(565));
        assert_eq!(summary.card, Money::from_cents(565));
        assert_eq!(summary.nfc, Money::from_cents(565));
        assert_eq!(summary.change, Money::from_cents(435));
    }

    #[test]
    fn validates_receipt_number_and_lines() {
        let mut order = sample();
        assert_eq!(order.validate(), Ok(()));

        order.receipt_number = " ".to_string();
        assert_eq!(order.validate(), Err("receipt_number_required".to_string()));

        let mut order = sample();
        order.lines[0].unit_price = Money::from_cents(-1);
        assert_eq!(order.validate(), Err("line_price_negative".to_string()));
    }

    #[test]
    fn applies_receipt_discount_to_net_tax_and_change() {
        let mut order = sample();
        order.payment_method = PaymentMethod::Cash;
        order.discount_bp = 1_000;
        order.cash_given = Some(Money::from_cents(600));
        assert_eq!(order.discount_amount(), Money::from_cents(53));
        assert_eq!(order.total_net(), Money::from_cents(472));
        assert_eq!(order.total_tax(), Money::from_cents(36));
        assert_eq!(order.total_gross(), Money::from_cents(508));
        assert_eq!(order.change(), Some(Money::from_cents(92)));
        assert_eq!(order.validate(), Ok(()));

        order.discount_bp = 10_001;
        assert_eq!(order.validate(), Err("discount_out_of_range".to_string()));
    }

    #[test]
    fn builds_z_report_with_tax_groups_and_payment_totals() {
        let cash = sample();
        let mut card = sample();
        card.receipt_number = "BON-2026-0002".to_string();
        card.payment_method = PaymentMethod::Card;
        card.paid_at = 10;
        let report = z_report(&[card.clone(), cash.clone()]);
        assert_eq!(report.receipts, 2);
        assert_eq!(report.numbers, vec!["BON-2026-0001", "BON-2026-0002"]);
        assert_eq!(report.first_at, Some(0));
        assert_eq!(report.last_at, Some(10));
        assert_eq!(report.summary.gross, Money::from_cents(1_130));
        assert_eq!(report.tax_groups.len(), 2);
        assert_eq!(report.tax_groups[0].rate_bp, 700);
        assert_eq!(report.tax_groups[1].rate_bp, 1900);
        assert_eq!(report.tax_groups[1].net, Money::from_cents(50));
    }

    #[test]
    fn roundtrips_payment_methods() {
        for method in [
            PaymentMethod::Cash,
            PaymentMethod::Card,
            PaymentMethod::Nfc,
            PaymentMethod::BankTransfer,
            PaymentMethod::Invoice,
            PaymentMethod::Other,
        ] {
            assert_eq!(PaymentMethod::from_storage(method.as_str()), Some(method));
        }
        assert_eq!(PaymentMethod::from_storage("cheque"), None);
    }
}
