//! Products and stock.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// An article that can be sold, purchased and kept in stock.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Product {
    /// Stable identifier.
    pub id: Uuid,
    /// Article number / SKU.
    pub sku: String,
    /// Display name.
    pub name: String,
    /// Unit of measure (`Stk`, `kg`, `h`, ...).
    pub unit: String,
    /// Net sales price.
    pub price: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
    /// Current stock in whole units.
    pub stock: i64,
    /// Reorder level; zero disables the warning.
    pub reorder_level: i64,
    /// Whether the article can be sold.
    pub active: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Product {
    /// Creates an empty active product with a fresh identifier.
    pub fn new(name: impl Into<String>, now: i64) -> Self {
        Product {
            id: Uuid::new_v4(),
            sku: String::new(),
            name: name.into(),
            unit: "Stk".to_string(),
            price: Money::ZERO,
            tax_rate_bp: 1900,
            stock: 0,
            reorder_level: 0,
            active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Whether the current stock is at or below the reorder level.
    pub fn needs_reorder(&self) -> bool {
        self.reorder_level > 0 && self.stock <= self.reorder_level
    }

    /// Validates the fields required by the UI.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("name_required".to_string());
        }
        if self.price.cents() < 0 {
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

    #[test]
    fn validates_name_price_and_tax_rate() {
        let mut product = Product::new("", 0);
        assert_eq!(product.validate(), Err("name_required".to_string()));

        product.name = "Kaffee".to_string();
        assert_eq!(product.validate(), Ok(()));

        product.price = Money::from_cents(-1);
        assert_eq!(product.validate(), Err("price_negative".to_string()));

        product.price = Money::from_cents(499);
        product.tax_rate_bp = 12_000;
        assert_eq!(product.validate(), Err("tax_rate_out_of_range".to_string()));
    }

    #[test]
    fn flags_reorder_only_when_a_level_is_set() {
        let mut product = Product::new("Kaffee", 0);
        product.stock = 2;
        assert!(!product.needs_reorder());

        product.reorder_level = 5;
        assert!(product.needs_reorder());
    }
}
