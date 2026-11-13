//! Invoices with positions, totals and status.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// Lifecycle state of an invoice.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvoiceStatus {
    /// Still being edited.
    Draft,
    /// Sent to the customer.
    Sent,
    /// Paid in full.
    Paid,
    /// Past the due date without payment.
    Overdue,
    /// Cancelled, kept for the records.
    Cancelled,
}

impl InvoiceStatus {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            InvoiceStatus::Draft => "draft",
            InvoiceStatus::Sent => "sent",
            InvoiceStatus::Paid => "paid",
            InvoiceStatus::Overdue => "overdue",
            InvoiceStatus::Cancelled => "cancelled",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "draft" => Some(InvoiceStatus::Draft),
            "sent" => Some(InvoiceStatus::Sent),
            "paid" => Some(InvoiceStatus::Paid),
            "overdue" => Some(InvoiceStatus::Overdue),
            "cancelled" => Some(InvoiceStatus::Cancelled),
            _ => None,
        }
    }
}

/// One position of an invoice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceLine {
    /// Description shown on the printed invoice.
    pub description: String,
    /// Quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net unit price.
    pub unit_price: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
}

impl InvoiceLine {
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

/// A customer invoice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Invoice {
    /// Stable identifier.
    pub id: Uuid,
    /// Human readable invoice number, unique per company.
    pub number: String,
    /// Billed contact.
    pub contact_id: Uuid,
    /// Current lifecycle state.
    pub status: InvoiceStatus,
    /// Issue date in milliseconds since the Unix epoch.
    pub issued_at: i64,
    /// Due date in milliseconds since the Unix epoch.
    pub due_at: i64,
    /// Currency symbol used for printing (`€`, `$`, ...).
    pub currency_symbol: String,
    /// Free text note printed above the totals.
    pub note: Option<String>,
    /// Optional stored VAT override for legacy POS/restaurant checkouts.
    #[serde(default)]
    pub tax_total_override_cents: Option<i64>,
    /// Positions of the invoice.
    pub lines: Vec<InvoiceLine>,
}

impl Invoice {
    /// Sum of all net position amounts.
    pub fn total_net(&self) -> Money {
        self.lines.iter().map(InvoiceLine::net).sum()
    }

    /// Sum of the tax amounts of all positions.
    pub fn total_tax(&self) -> Money {
        self.tax_total_override_cents
            .map(Money::from_cents)
            .unwrap_or_else(|| self.lines.iter().map(InvoiceLine::tax).sum())
    }

    /// Net plus tax.
    pub fn total_gross(&self) -> Money {
        self.total_net() + self.total_tax()
    }

    /// Validates the invoice before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.number.trim().is_empty() {
            return Err("number_required".to_string());
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_invoice() -> Invoice {
        Invoice {
            id: Uuid::new_v4(),
            number: "2026-0001".to_string(),
            contact_id: Uuid::new_v4(),
            status: InvoiceStatus::Draft,
            issued_at: 0,
            due_at: 0,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![
                InvoiceLine {
                    description: "Beratung".to_string(),
                    quantity_milli: 2_500,
                    unit_price: Money::from_cents(8_000),
                    tax_rate_bp: 1900,
                },
                InvoiceLine {
                    description: "Material".to_string(),
                    quantity_milli: 1_000,
                    unit_price: Money::from_cents(1_250),
                    tax_rate_bp: 700,
                },
            ],
        }
    }

    #[test]
    fn stored_tax_override_preserves_legacy_pos_totals() {
        let mut invoice = sample_invoice();
        invoice.tax_total_override_cents = Some(3_889);
        assert_eq!(invoice.total_tax(), Money::from_cents(3_889));
        assert_eq!(invoice.total_gross(), Money::from_cents(25_139));
    }

    #[test]
    fn computes_line_and_invoice_totals() {
        let invoice = sample_invoice();
        assert_eq!(invoice.lines[0].net(), Money::from_cents(20_000));
        assert_eq!(invoice.lines[0].tax(), Money::from_cents(3_800));
        assert_eq!(invoice.lines[1].net(), Money::from_cents(1_250));
        assert_eq!(invoice.lines[1].tax(), Money::from_cents(88));
        assert_eq!(invoice.total_net(), Money::from_cents(21_250));
        assert_eq!(invoice.total_tax(), Money::from_cents(3_888));
        assert_eq!(invoice.total_gross(), Money::from_cents(25_138));
    }

    #[test]
    fn rejects_invalid_invoices() {
        let mut invoice = sample_invoice();
        invoice.number = " ".to_string();
        assert_eq!(invoice.validate(), Err("number_required".to_string()));

        invoice.number = "2026-0002".to_string();
        invoice.lines.clear();
        assert_eq!(invoice.validate(), Err("lines_required".to_string()));

        let mut invoice = sample_invoice();
        invoice.lines[0].quantity_milli = 0;
        assert_eq!(invoice.validate(), Err("line_quantity_invalid".to_string()));
    }

    #[test]
    fn roundtrips_status_and_kind_strings() {
        for status in [
            InvoiceStatus::Draft,
            InvoiceStatus::Sent,
            InvoiceStatus::Paid,
            InvoiceStatus::Overdue,
            InvoiceStatus::Cancelled,
        ] {
            assert_eq!(InvoiceStatus::from_storage(status.as_str()), Some(status));
        }
    }
}
