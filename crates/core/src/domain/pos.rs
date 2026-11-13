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

    /// Tax amount of this position.
    pub fn tax(&self) -> Money {
        self.net().tax(self.tax_rate_bp)
    }

    /// Gross amount of this position.
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
    /// Sold positions.
    pub lines: Vec<PosOrderLine>,
    /// Numeric legacy identifier, when the order came from a legacy backup.
    pub legacy_id: Option<i64>,
}

impl PosOrder {
    /// Sum of all net position amounts.
    pub fn total_net(&self) -> Money {
        self.lines.iter().map(PosOrderLine::net).sum()
    }

    /// Sum of the tax amounts of all positions.
    pub fn total_tax(&self) -> Money {
        self.tax_total_override_cents
            .map(Money::from_cents)
            .unwrap_or_else(|| self.lines.iter().map(PosOrderLine::tax).sum())
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

        let summary = summarize(&[cash, card]);
        assert_eq!(summary.receipts, 2);
        assert_eq!(summary.net, Money::from_cents(1_050));
        assert_eq!(summary.tax, Money::from_cents(80));
        assert_eq!(summary.gross, Money::from_cents(1_130));
        assert_eq!(summary.cash, Money::from_cents(565));
        assert_eq!(summary.card, Money::from_cents(565));
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
    fn roundtrips_payment_methods() {
        for method in [
            PaymentMethod::Cash,
            PaymentMethod::Card,
            PaymentMethod::BankTransfer,
            PaymentMethod::Invoice,
            PaymentMethod::Other,
        ] {
            assert_eq!(PaymentMethod::from_storage(method.as_str()), Some(method));
        }
        assert_eq!(PaymentMethod::from_storage("cheque"), None);
    }
}
