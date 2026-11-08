//! Billable items.
//!
//! A billing item is a service, material or therapy session that can be collected on an invoice.
//! Items exist before the invoice does; `invoice_id` is set once the item has been billed.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// Kind of a billable item.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BillingKind {
    /// A service that was performed.
    Service,
    /// Material that was used.
    Material,
    /// A therapy session.
    TherapySession,
    /// A mileage allowance.
    Mileage,
    /// Anything else.
    Other,
}

impl BillingKind {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            BillingKind::Service => "service",
            BillingKind::Material => "material",
            BillingKind::TherapySession => "therapy_session",
            BillingKind::Mileage => "mileage",
            BillingKind::Other => "other",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "service" => Some(BillingKind::Service),
            "material" => Some(BillingKind::Material),
            "therapy_session" => Some(BillingKind::TherapySession),
            "mileage" => Some(BillingKind::Mileage),
            "other" => Some(BillingKind::Other),
            _ => None,
        }
    }
}

/// A service or material position that can be billed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillingItem {
    /// Stable identifier.
    pub id: Uuid,
    /// Customer the item belongs to.
    pub contact_id: Uuid,
    /// Invoice that collects the item, empty while it is still open.
    pub invoice_id: Option<Uuid>,
    /// Kind of the item.
    pub kind: BillingKind,
    /// Catalogue code, for example a therapy position number.
    pub code: String,
    /// Description shown on the invoice.
    pub description: String,
    /// Date the service was performed, in milliseconds since the Unix epoch.
    pub service_date: i64,
    /// Quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net unit price.
    pub unit_price: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl BillingItem {
    /// Net amount of the item.
    pub fn net(&self) -> Money {
        Money::from_cents(self.unit_price.cents() * self.quantity_milli / 1_000)
    }

    /// Tax amount of the item.
    pub fn tax(&self) -> Money {
        self.net().tax(self.tax_rate_bp)
    }

    /// Gross amount of the item.
    pub fn gross(&self) -> Money {
        self.net() + self.tax()
    }

    /// Whether the item is still waiting for an invoice.
    pub fn is_open(&self) -> bool {
        self.invoice_id.is_none()
    }

    /// Validates the item before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("description_required".to_string());
        }
        if self.quantity_milli <= 0 {
            return Err("quantity_invalid".to_string());
        }
        if self.unit_price.cents() < 0 {
            return Err("price_negative".to_string());
        }
        if !(0..=10_000).contains(&self.tax_rate_bp) {
            return Err("tax_rate_out_of_range".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> BillingItem {
        BillingItem {
            id: Uuid::new_v4(),
            contact_id: Uuid::new_v4(),
            invoice_id: None,
            kind: BillingKind::TherapySession,
            code: "GOP 870".to_string(),
            description: "Psychotherapeutisches Gespräch".to_string(),
            service_date: 0,
            quantity_milli: 2_000,
            unit_price: Money::from_cents(9_000),
            tax_rate_bp: 0,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn computes_item_amounts() {
        let item = sample();
        assert_eq!(item.net(), Money::from_cents(18_000));
        assert_eq!(item.tax(), Money::from_cents(0));
        assert_eq!(item.gross(), Money::from_cents(18_000));
        assert!(item.is_open());
    }

    #[test]
    fn validates_item_fields() {
        let mut item = sample();
        assert_eq!(item.validate(), Ok(()));

        item.description = "  ".to_string();
        assert_eq!(item.validate(), Err("description_required".to_string()));

        let mut item = sample();
        item.quantity_milli = 0;
        assert_eq!(item.validate(), Err("quantity_invalid".to_string()));

        let mut item = sample();
        item.tax_rate_bp = 10_001;
        assert_eq!(item.validate(), Err("tax_rate_out_of_range".to_string()));
    }

    #[test]
    fn roundtrips_billing_kinds() {
        for kind in [
            BillingKind::Service,
            BillingKind::Material,
            BillingKind::TherapySession,
            BillingKind::Mileage,
            BillingKind::Other,
        ] {
            assert_eq!(BillingKind::from_storage(kind.as_str()), Some(kind));
        }
        assert_eq!(BillingKind::from_storage("rent"), None);
    }
}
