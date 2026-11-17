//! Stock movements.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Direction of a stock movement.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StockMoveKind {
    /// Goods received or returned by a customer.
    In,
    /// Goods sold, used or returned to a supplier.
    Out,
}

impl StockMoveKind {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            StockMoveKind::In => "in",
            StockMoveKind::Out => "out",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "in" => Some(StockMoveKind::In),
            "out" => Some(StockMoveKind::Out),
            _ => None,
        }
    }

    /// Signed change applied to the product stock.
    pub fn delta(self, quantity: i64) -> i64 {
        match self {
            StockMoveKind::In => quantity,
            StockMoveKind::Out => -quantity,
        }
    }
}

/// Physical and virtual locations used by the double-entry stock journal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockLocation {
    /// Supplier/vendor side.
    Vendors,
    /// Physical warehouse counted in product stock.
    Warehouse,
    /// Customer side.
    Customers,
    /// Inventory write-off.
    InventoryLoss,
    /// Scrap or damaged goods.
    Scrap,
}

impl StockLocation {
    /// Stable TypeScript-compatible location identifier.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Vendors => "Virtual/Vendors",
            Self::Warehouse => "Physical/Warehouse",
            Self::Customers => "Virtual/Customers",
            Self::InventoryLoss => "Virtual/Inventory-Loss",
            Self::Scrap => "Virtual/Scrap",
        }
    }

    /// Parses a persisted location identifier.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "Virtual/Vendors" => Some(Self::Vendors),
            "Physical/Warehouse" => Some(Self::Warehouse),
            "Virtual/Customers" => Some(Self::Customers),
            "Virtual/Inventory-Loss" => Some(Self::InventoryLoss),
            "Virtual/Scrap" => Some(Self::Scrap),
            _ => None,
        }
    }
}

/// One immutable double-entry stock journal row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StockJournalEntry {
    /// Stable identifier.
    pub id: Uuid,
    /// Affected product.
    pub product_id: Uuid,
    /// Product name joined for display.
    pub product_name: Option<String>,
    /// Product SKU joined for display.
    pub product_sku: Option<String>,
    /// Positive whole-unit quantity.
    pub quantity: i64,
    /// Origin location.
    pub source_location: StockLocation,
    /// Destination location.
    pub dest_location: StockLocation,
    /// Document or booking reference.
    pub reference: String,
    /// Optional reason or operator note.
    pub notes: Option<String>,
    /// Booking time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl StockJournalEntry {
    /// Signed change to the physical warehouse balance.
    pub fn stock_delta(&self) -> i64 {
        match (self.source_location, self.dest_location) {
            (source, StockLocation::Warehouse) if source != StockLocation::Warehouse => {
                self.quantity
            }
            (StockLocation::Warehouse, destination) if destination != StockLocation::Warehouse => {
                -self.quantity
            }
            _ => 0,
        }
    }

    /// Validates a journal row before it can affect inventory.
    pub fn validate(&self) -> Result<(), String> {
        if self.quantity <= 0 {
            return Err("quantity_must_be_positive".to_string());
        }
        if self.source_location == self.dest_location {
            return Err("stock_locations_must_differ".to_string());
        }
        if self.reference.trim().is_empty() {
            return Err("stock_reference_required".to_string());
        }
        Ok(())
    }
}

/// One recorded stock change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StockMove {
    /// Stable identifier.
    pub id: Uuid,
    /// Affected product.
    pub product_id: Uuid,
    /// Direction of the movement.
    pub kind: StockMoveKind,
    /// Positive quantity in whole units.
    pub quantity: i64,
    /// Optional note, for example the invoice number.
    pub reason: Option<String>,
    /// Movement time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl StockMove {
    /// Validates the movement before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.quantity <= 0 {
            return Err("quantity_must_be_positive".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_signed_delta() {
        assert_eq!(StockMoveKind::In.delta(5), 5);
        assert_eq!(StockMoveKind::Out.delta(5), -5);
    }

    #[test]
    fn validates_positive_quantities() {
        let movement = StockMove {
            id: Uuid::new_v4(),
            product_id: Uuid::new_v4(),
            kind: StockMoveKind::In,
            quantity: 0,
            reason: None,
            created_at: 0,
        };
        assert_eq!(
            movement.validate(),
            Err("quantity_must_be_positive".to_string())
        );
    }

    #[test]
    fn roundtrips_kind_strings() {
        for kind in [StockMoveKind::In, StockMoveKind::Out] {
            assert_eq!(StockMoveKind::from_storage(kind.as_str()), Some(kind));
        }
    }
}
