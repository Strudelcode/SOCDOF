//! Barcode and QR article label of a product.
//!
//! Ported from `SOCDOF - TS/src/components/ProductLabelModal.tsx`: the same QR payload (a JSON
//! object with `name`, `sku`, `price`, `asin` and `currency` in that order), the same three label
//! formats, the same fallbacks (`SOCDOF ERP` for an empty category, `Stück` for an empty unit) and
//! the same German price formatting. The QR matrix comes from [`crate::barcode::qr`], the same
//! encoder the mobile companion pairing uses.

use serde::{Deserialize, Serialize};

use crate::barcode::qr::{qr, EcLevel, QrCode};
use crate::domain::product::Product;
use crate::error::{CoreError, CoreResult};
use crate::money::Money;

/// Category placeholder of the label header.
pub const CATEGORY_FALLBACK: &str = "SOCDOF ERP";
/// Unit placeholder of the label footer.
pub const UNIT_FALLBACK: &str = "Stück";
/// Printed hint under the price.
pub const SCAN_HINT: &str = "SOCDOF-SCAN";

/// Label formats of the modal with their preview sizes in points.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum LabelFormat {
    /// Standard article label, 100 × 60 mm in the legacy preview.
    #[default]
    Standard,
    /// Shelf tag.
    Shelf,
    /// Compact mini label.
    Compact,
}

impl LabelFormat {
    /// All formats in the order of the size selector.
    pub fn all() -> [LabelFormat; 3] {
        [
            LabelFormat::Standard,
            LabelFormat::Shelf,
            LabelFormat::Compact,
        ]
    }

    /// Stable storage and catalogue representation.
    pub fn as_str(self) -> &'static str {
        match self {
            LabelFormat::Standard => "standard",
            LabelFormat::Shelf => "shelf",
            LabelFormat::Compact => "compact",
        }
    }

    /// Catalogue key of the format button.
    pub fn label_key(self) -> &'static str {
        match self {
            LabelFormat::Standard => "products_label_standard",
            LabelFormat::Shelf => "products_label_shelf",
            LabelFormat::Compact => "products_label_compact",
        }
    }

    /// Width of the preview box in points (`w-[320px]` in the legacy markup).
    pub fn width(self) -> f32 {
        match self {
            LabelFormat::Standard => 320.0,
            LabelFormat::Shelf => 340.0,
            LabelFormat::Compact => 260.0,
        }
    }

    /// Minimum height of the preview box in points (`min-h-[190px]`).
    pub fn min_height(self) -> f32 {
        match self {
            LabelFormat::Standard => 190.0,
            LabelFormat::Shelf => 150.0,
            LabelFormat::Compact => 140.0,
        }
    }
}

/// Everything one printed label shows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProductLabel {
    /// Product name.
    pub name: String,
    /// Article number.
    pub sku: String,
    /// Header line; the category, or [`CATEGORY_FALLBACK`].
    pub category: String,
    /// ASIN, when the product has a valid one.
    pub asin: Option<String>,
    /// Sale price in cents.
    pub price: Money,
    /// Unit, or [`UNIT_FALLBACK`].
    pub unit: String,
    /// Currency symbol used for the price line.
    pub currency: String,
    /// QR payload exactly as the legacy modal builds it.
    pub payload: String,
}

impl ProductLabel {
    /// Builds the label of a product.
    pub fn from_product(product: &Product, currency: &str) -> Self {
        let asin = crate::domain::reorder::product_asin(product);
        Self {
            name: product.name.clone(),
            sku: product.sku.clone(),
            category: if product.category.trim().is_empty() {
                CATEGORY_FALLBACK.to_string()
            } else {
                product.category.clone()
            },
            asin: asin.clone(),
            price: product.price,
            unit: if product.unit.trim().is_empty() {
                UNIT_FALLBACK.to_string()
            } else {
                product.unit.clone()
            },
            currency: currency.to_string(),
            payload: payload_json(
                &product.name,
                &product.sku,
                product.price,
                asin.as_deref().unwrap_or(""),
                currency,
            ),
        }
    }

    /// Price line, formatted like the legacy `toLocaleString('de-DE')` plus the currency symbol.
    pub fn price_text(&self) -> String {
        format!("{} {}", format_price(self.price), self.currency)
    }

    /// QR matrix of the payload.
    pub fn qr(&self) -> CoreResult<QrCode> {
        qr(&self.payload, EcLevel::Medium).map_err(|error| CoreError::Validation(error.to_string()))
    }
}

/// Price with thousands separator and two decimals (`1299,00`).
///
/// The legacy modal calls `toLocaleString('de-DE', { minimumFractionDigits: 2 })`; the symbol is
/// appended by [`ProductLabel::price_text`].
pub fn format_price(money: Money) -> String {
    let cents = money.cents();
    let negative = cents < 0;
    let absolute = cents.unsigned_abs();
    let euros = absolute / 100;
    let rest = absolute % 100;

    let digits = euros.to_string();
    let mut grouped = String::new();
    for (index, character) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(character);
    }

    format!("{}{grouped},{rest:02}", if negative { "-" } else { "" })
}

/// QR payload of the label: the JSON object of the legacy modal, key order included.
pub fn payload_json(name: &str, sku: &str, price: Money, asin: &str, currency: &str) -> String {
    let price = price.to_decimal_string();
    let price = trim_number(&price);
    format!(
        "{{\"name\":{},\"sku\":{},\"price\":{},\"asin\":{},\"currency\":{}}}",
        string(name),
        string(sku),
        price,
        string(asin),
        string(currency)
    )
}

fn string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn trim_number(value: &str) -> String {
    let trimmed = value.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "-" {
        "0".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn product() -> Product {
        let mut product = Product::new("Kaffee Bohnen", 0);
        product.sku = "KAF-001".to_string();
        product.category = "Getränke".to_string();
        product.unit = "kg".to_string();
        product.price = Money::from_cents(1_299);
        product
    }

    #[test]
    fn payload_matches_the_legacy_json() {
        assert_eq!(
            payload_json("Kaffee Bohnen", "KAF-001", Money::from_cents(1_299), "", "€"),
            "{\"name\":\"Kaffee Bohnen\",\"sku\":\"KAF-001\",\"price\":12.99,\"asin\":\"\",\"currency\":\"€\"}"
        );
        assert_eq!(
            payload_json("Tee \"Earl Grey\"", "T-1", Money::from_cents(1_200), "B08N5WRWNW", "CHF"),
            "{\"name\":\"Tee \\\"Earl Grey\\\"\",\"sku\":\"T-1\",\"price\":12,\"asin\":\"B08N5WRWNW\",\"currency\":\"CHF\"}"
        );
        assert_eq!(
            payload_json("Gratis", "G-0", Money::ZERO, "", "€"),
            "{\"name\":\"Gratis\",\"sku\":\"G-0\",\"price\":0,\"asin\":\"\",\"currency\":\"€\"}"
        );
    }

    #[test]
    fn prices_are_formatted_german() {
        assert_eq!(format_price(Money::from_cents(1_299)), "12,99");
        assert_eq!(format_price(Money::from_cents(123_456_789)), "1.234.567,89");
        assert_eq!(format_price(Money::from_cents(0)), "0,00");
        assert_eq!(format_price(Money::from_cents(-2_450)), "-24,50");
    }

    #[test]
    fn label_uses_the_product_values_and_the_fallbacks() {
        let mut coffee = product();
        coffee.asin = Some("b08n5wrwnw".to_string());
        let label = ProductLabel::from_product(&coffee, "€");
        assert_eq!(label.category, "Getränke");
        assert_eq!(label.unit, "kg");
        assert_eq!(label.asin.as_deref(), Some("B08N5WRWNW"));
        assert_eq!(label.price_text(), "12,99 €");
        assert_eq!(
            label.payload,
            "{\"name\":\"Kaffee Bohnen\",\"sku\":\"KAF-001\",\"price\":12.99,\"asin\":\"B08N5WRWNW\",\"currency\":\"€\"}"
        );

        let mut bare = Product::new("Zucker", 0);
        bare.sku = "Z-1".to_string();
        bare.category = "  ".to_string();
        bare.unit = String::new();
        let label = ProductLabel::from_product(&bare, "CHF");
        assert_eq!(label.category, CATEGORY_FALLBACK);
        assert_eq!(label.unit, UNIT_FALLBACK);
        assert_eq!(label.asin, None);
        assert_eq!(label.price_text(), "0,00 CHF");
    }

    #[test]
    fn label_takes_the_asin_from_the_web_link() {
        let mut coffee = product();
        coffee.web_link = Some("https://www.amazon.de/dp/B08N5WRWNW".to_string());
        let label = ProductLabel::from_product(&coffee, "€");
        assert_eq!(label.asin.as_deref(), Some("B08N5WRWNW"));
        assert!(label.payload.contains("\"asin\":\"B08N5WRWNW\""));
    }

    #[test]
    fn formats_keep_the_legacy_sizes() {
        assert_eq!(LabelFormat::all().len(), 3);
        assert_eq!(LabelFormat::default(), LabelFormat::Standard);
        assert_eq!(LabelFormat::Standard.width(), 320.0);
        assert_eq!(LabelFormat::Shelf.min_height(), 150.0);
        assert_eq!(LabelFormat::Compact.as_str(), "compact");
        assert_eq!(LabelFormat::Compact.label_key(), "products_label_compact");
    }

    #[test]
    fn qr_matrix_encodes_the_payload() {
        let label = ProductLabel::from_product(&product(), "€");
        let code = label.qr().expect("qr");
        assert!(code.size() >= 21);
        assert_eq!(code.modules().len(), code.size() * code.size());
        assert!(code.modules().iter().any(|dark| *dark));

        let again = label.qr().expect("qr");
        assert_eq!(
            code.modules(),
            again.modules(),
            "the encoder is deterministic"
        );
    }
}
