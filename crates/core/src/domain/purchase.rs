//! Purchase orders to suppliers, including the goods-receipt step.
//!
//! Amounts mirror invoices: quantities are thousandths (`1000` = one unit), prices are integer
//! cents and tax rates are basis points.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::stock::{StockMove, StockMoveKind};
use crate::money::Money;

/// Lifecycle state of a purchase order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PurchaseOrderStatus {
    /// Still being edited, nothing was ordered yet.
    Draft,
    /// Sent to the supplier.
    Ordered,
    /// Some positions arrived.
    PartiallyReceived,
    /// Everything arrived.
    Received,
    /// Cancelled before or after ordering.
    Cancelled,
}

impl PurchaseOrderStatus {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            PurchaseOrderStatus::Draft => "draft",
            PurchaseOrderStatus::Ordered => "ordered",
            PurchaseOrderStatus::PartiallyReceived => "partially_received",
            PurchaseOrderStatus::Received => "received",
            PurchaseOrderStatus::Cancelled => "cancelled",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "draft" => Some(PurchaseOrderStatus::Draft),
            "ordered" => Some(PurchaseOrderStatus::Ordered),
            "partially_received" => Some(PurchaseOrderStatus::PartiallyReceived),
            "received" => Some(PurchaseOrderStatus::Received),
            "cancelled" => Some(PurchaseOrderStatus::Cancelled),
            _ => None,
        }
    }

    /// Whether goods can still be booked in for this order.
    pub fn accepts_goods(self) -> bool {
        matches!(
            self,
            PurchaseOrderStatus::Ordered | PurchaseOrderStatus::PartiallyReceived
        )
    }
}

/// One ordered position.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PurchaseOrderLine {
    /// Linked product, empty for free-text positions.
    pub product_id: Option<Uuid>,
    /// Description shown on the order and the goods receipt.
    pub description: String,
    /// Ordered quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net purchase price per unit.
    pub unit_cost: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
}

impl PurchaseOrderLine {
    /// Net amount of this position.
    pub fn net(&self) -> Money {
        Money::from_cents(self.unit_cost.cents() * self.quantity_milli / 1_000)
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

/// A purchase order to a supplier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PurchaseOrder {
    /// Stable identifier.
    pub id: Uuid,
    /// Human readable order number, unique per company.
    pub number: String,
    /// Supplier the goods are ordered from.
    pub vendor_id: Uuid,
    /// Current lifecycle state.
    pub status: PurchaseOrderStatus,
    /// Order date in milliseconds since the Unix epoch.
    pub order_date: i64,
    /// Expected delivery date, if the supplier named one.
    pub expected_at: Option<i64>,
    /// Currency symbol used for printing.
    pub currency_symbol: String,
    /// Free text note.
    pub note: Option<String>,
    /// Ordered positions.
    pub lines: Vec<PurchaseOrderLine>,
    /// Numeric legacy identifier, when the order came from a legacy backup.
    pub legacy_id: Option<i64>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl PurchaseOrder {
    /// Sum of all net position amounts.
    pub fn total_net(&self) -> Money {
        self.lines.iter().map(PurchaseOrderLine::net).sum()
    }

    /// Sum of the tax amounts of all positions.
    pub fn total_tax(&self) -> Money {
        self.lines.iter().map(PurchaseOrderLine::tax).sum()
    }

    /// Net plus tax.
    pub fn total_gross(&self) -> Money {
        self.total_net() + self.total_tax()
    }

    /// Stock movements that book the whole order in.
    ///
    /// Only positions linked to a product produce a movement. Stock is kept in whole units, so a
    /// fractional quantity is rounded up; the order number becomes the movement reason.
    pub fn stock_moves(&self, created_at: i64) -> Vec<StockMove> {
        self.lines
            .iter()
            .filter_map(|line| {
                let product_id = line.product_id?;
                Some(StockMove {
                    id: Uuid::new_v4(),
                    product_id,
                    kind: StockMoveKind::In,
                    quantity: (line.quantity_milli + 999) / 1_000,
                    reason: Some(self.number.clone()),
                    created_at,
                })
            })
            .filter(|movement| movement.quantity > 0)
            .collect()
    }

    /// Validates the order before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.number.trim().is_empty() {
            return Err("number_required".to_string());
        }
        if self.currency_symbol.trim().is_empty() {
            return Err("currency_required".to_string());
        }
        if self.lines.is_empty() {
            return Err("lines_required".to_string());
        }
        for line in &self.lines {
            if line.description.trim().is_empty() {
                return Err("line_description_required".to_string());
            }
            if line.quantity_milli <= 0 {
                return Err("line_quantity_invalid".to_string());
            }
            if line.unit_cost.cents() < 0 {
                return Err("line_price_negative".to_string());
            }
            if !(0..=10_000).contains(&line.tax_rate_bp) {
                return Err("line_tax_rate_out_of_range".to_string());
            }
        }
        Ok(())
    }
}

/// Header figures of the purchase list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PurchaseSummary {
    /// Orders that are ordered but not completely received.
    pub open_orders: usize,
    /// Net value of the open orders.
    pub open_net: Money,
    /// Gross value of the open orders.
    pub open_gross: Money,
    /// Orders still in draft.
    pub draft: usize,
    /// Orders waiting for delivery.
    pub ordered: usize,
    /// Orders with a partial delivery.
    pub partially_received: usize,
    /// Fully received orders.
    pub received: usize,
    /// Cancelled orders.
    pub cancelled: usize,
}

impl Default for PurchaseSummary {
    fn default() -> Self {
        Self {
            open_orders: 0,
            open_net: Money::ZERO,
            open_gross: Money::ZERO,
            draft: 0,
            ordered: 0,
            partially_received: 0,
            received: 0,
            cancelled: 0,
        }
    }
}

/// Summarises orders for the list header and the status counts.
pub fn summarize(orders: &[PurchaseOrder]) -> PurchaseSummary {
    let mut summary = PurchaseSummary::default();
    for order in orders {
        match order.status {
            PurchaseOrderStatus::Draft => summary.draft += 1,
            PurchaseOrderStatus::Ordered => {
                summary.ordered += 1;
                summary.open_orders += 1;
                summary.open_net = summary.open_net + order.total_net();
                summary.open_gross = summary.open_gross + order.total_gross();
            }
            PurchaseOrderStatus::PartiallyReceived => {
                summary.partially_received += 1;
                summary.open_orders += 1;
                summary.open_net = summary.open_net + order.total_net();
                summary.open_gross = summary.open_gross + order.total_gross();
            }
            PurchaseOrderStatus::Received => summary.received += 1,
            PurchaseOrderStatus::Cancelled => summary.cancelled += 1,
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PurchaseOrder {
        PurchaseOrder {
            id: Uuid::new_v4(),
            number: "BE-2026-0001".to_string(),
            vendor_id: Uuid::new_v4(),
            status: PurchaseOrderStatus::Ordered,
            order_date: 0,
            expected_at: None,
            currency_symbol: "€".to_string(),
            note: None,
            legacy_id: None,
            created_at: 0,
            updated_at: 0,
            lines: vec![
                PurchaseOrderLine {
                    product_id: Some(Uuid::new_v4()),
                    description: "Kaffeebohnen".to_string(),
                    quantity_milli: 10_000,
                    unit_cost: Money::from_cents(650),
                    tax_rate_bp: 700,
                },
                PurchaseOrderLine {
                    product_id: None,
                    description: "Versand".to_string(),
                    quantity_milli: 1_000,
                    unit_cost: Money::from_cents(490),
                    tax_rate_bp: 1900,
                },
            ],
        }
    }

    #[test]
    fn computes_order_totals() {
        let order = sample();
        assert_eq!(order.total_net(), Money::from_cents(6_990));
        assert_eq!(order.total_tax(), Money::from_cents(548));
        assert_eq!(order.total_gross(), Money::from_cents(7_538));
    }

    #[test]
    fn builds_stock_moves_for_linked_positions() {
        let order = sample();
        let moves = order.stock_moves(42);
        assert_eq!(moves.len(), 1);
        assert_eq!(moves[0].quantity, 10);
        assert_eq!(moves[0].reason.as_deref(), Some("BE-2026-0001"));
        assert_eq!(moves[0].created_at, 42);
        assert!(order.lines[1].product_id.is_none());
    }

    #[test]
    fn summarises_open_values_and_status_counts() {
        let mut orders = Vec::new();
        orders.push(sample());
        let mut received = sample();
        received.status = PurchaseOrderStatus::Received;
        orders.push(received);
        let mut draft = sample();
        draft.status = PurchaseOrderStatus::Draft;
        orders.push(draft);

        let summary = summarize(&orders);
        assert_eq!(summary.open_orders, 1);
        assert_eq!(summary.open_net, Money::from_cents(6_990));
        assert_eq!(summary.open_gross, Money::from_cents(7_538));
        assert_eq!(summary.received, 1);
        assert_eq!(summary.draft, 1);
    }

    #[test]
    fn validates_positions() {
        let mut order = sample();
        assert_eq!(order.validate(), Ok(()));

        order.lines.clear();
        assert_eq!(order.validate(), Err("lines_required".to_string()));

        let mut order = sample();
        order.lines[0].quantity_milli = 0;
        assert_eq!(order.validate(), Err("line_quantity_invalid".to_string()));

        let mut order = sample();
        order.number = "  ".to_string();
        assert_eq!(order.validate(), Err("number_required".to_string()));
    }

    #[test]
    fn roundtrips_status_strings_and_receipt_rules() {
        for status in [
            PurchaseOrderStatus::Draft,
            PurchaseOrderStatus::Ordered,
            PurchaseOrderStatus::PartiallyReceived,
            PurchaseOrderStatus::Received,
            PurchaseOrderStatus::Cancelled,
        ] {
            assert_eq!(
                PurchaseOrderStatus::from_storage(status.as_str()),
                Some(status)
            );
        }
        assert!(PurchaseOrderStatus::Ordered.accepts_goods());
        assert!(PurchaseOrderStatus::PartiallyReceived.accepts_goods());
        assert!(!PurchaseOrderStatus::Draft.accepts_goods());
        assert!(!PurchaseOrderStatus::Received.accepts_goods());
        assert!(!PurchaseOrderStatus::Cancelled.accepts_goods());
    }
}
