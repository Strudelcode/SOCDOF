//! Smart reorder assistant: low-stock candidates, quantities, Amazon cart links and draft orders.
//!
//! Ported from `SOCDOF - TS/src/components/SmartReorderModal.tsx` and
//! `src/lib/productLinkExtractor.ts`: the same candidate rule (`stock <= min_qty`, or a fixed
//! threshold), the same default quantity (`max(1, target - stock)` with `target_stock ||
//! min_qty * 2 || 10`), the same inclusion default (`!exclude_from_reorder`), the same search over
//! name/SKU/ASIN/source domain, the same statistics, the same Amazon remote-cart URL and the same
//! replenishment text. Nothing here touches GTK, Tauri or the database.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::product::Product;
use crate::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
use crate::money::Money;

/// Threshold of the fixed mode; the legacy modal starts with 5.
pub const FIXED_THRESHOLD: i64 = 5;

/// Threshold used when a product has no reorder level, like `p.min_qty ?? 5`.
///
/// The Rust product keeps `0` as "no reorder level set" (see [`Product::needs_reorder`]), which is
/// the case the legacy `undefined` fallback covers.
pub const INDIVIDUAL_FALLBACK: i64 = 5;

/// Target stock used when neither `target_stock` nor `min_qty` is set (`... || 10`).
pub const TARGET_FALLBACK: i64 = 10;

/// Default Amazon marketplace of the cart links.
pub const DEFAULT_DOMAIN: &str = "amazon.de";

/// Tax rate the legacy modal writes on every generated purchase order line (19 %).
pub const DRAFT_ORDER_TAX_BP: i64 = 1900;

/// Delivery lead time of a generated draft order (three days in the legacy modal).
pub const DRAFT_ORDER_LEAD_MS: i64 = 3 * 86_400_000;

/// Which stock level counts as "knapp".
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Threshold {
    /// Per product, from its reorder level.
    #[default]
    Individual,
    /// One fixed level for every product.
    Fixed(i64),
}

impl Threshold {
    /// Level a product has to stay at or below to be a candidate.
    pub fn limit(self, product: &Product) -> i64 {
        match self {
            Threshold::Individual if product.reorder_level > 0 => product.reorder_level,
            Threshold::Individual => INDIVIDUAL_FALLBACK,
            Threshold::Fixed(value) => value.max(1),
        }
    }

    /// Whether the product is at or below the level.
    pub fn matches(self, product: &Product) -> bool {
        product.stock <= self.limit(product)
    }
}

/// Target stock a candidate is filled up to.
pub fn target_stock(product: &Product) -> i64 {
    if product.target_stock > 0 {
        product.target_stock
    } else if product.reorder_level > 0 {
        product.reorder_level * 2
    } else {
        TARGET_FALLBACK
    }
}

/// Quantity the modal proposes for a candidate: `max(1, target - stock)`.
pub fn default_quantity(product: &Product) -> i64 {
    (target_stock(product) - product.stock).max(1)
}

/// Validates an Amazon ASIN: ten ASCII letters or digits, upper case.
pub fn valid_asin(candidate: &str) -> Option<String> {
    let trimmed = candidate.trim();
    if trimmed.len() == 10 && trimmed.chars().all(|c| c.is_ascii_alphanumeric()) {
        Some(trimmed.to_ascii_uppercase())
    } else {
        None
    }
}

/// Extracts an ASIN from a bare ASIN or an Amazon link, like `extractAmazonAsin()`.
pub fn extract_amazon_asin(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if let Some(asin) = valid_asin(trimmed) {
        return Some(asin);
    }

    const MARKERS: [&str; 7] = [
        "/dp/",
        "/gp/product/",
        "/gp/aw/d/",
        "/d/",
        "/exec/obidos/asin/",
        "?asin=",
        "&asin=",
    ];
    let lowered = trimmed.to_lowercase();
    for marker in MARKERS {
        let mut search = 0;
        while let Some(found) = lowered[search..].find(marker) {
            let start = search + found + marker.len();
            let rest = &trimmed[start..];
            let candidate: String = rest.chars().take(10).collect();
            if candidate.chars().count() == 10 {
                if let Some(asin) = valid_asin(&candidate) {
                    return Some(asin);
                }
            }
            search = start;
        }
    }
    None
}

/// ASIN of a product: its own field, else the one hidden in its web link.
pub fn product_asin(product: &Product) -> Option<String> {
    let own = product.asin.as_deref().unwrap_or("").trim();
    if !own.is_empty() {
        return valid_asin(own);
    }
    product.web_link.as_deref().and_then(extract_amazon_asin)
}

/// Marketplace host of a cart link; anything that is not an Amazon host falls back to `amazon.de`.
pub fn clean_domain(raw: &str) -> String {
    let mut domain = raw.trim().to_lowercase();
    if let Some(rest) = domain
        .strip_prefix("http://")
        .or_else(|| domain.strip_prefix("https://"))
    {
        let host = rest.split(['/', '?', '#']).next().unwrap_or("");
        domain = host.to_string();
    }
    if let Some(stripped) = domain.strip_prefix("www.") {
        domain = stripped.to_string();
    }
    if !domain.contains("amazon.") || domain.is_empty() {
        return DEFAULT_DOMAIN.to_string();
    }
    domain
}

/// Percent-encodes one query value the way `encodeURIComponent` does.
pub fn encode_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        let keep = byte.is_ascii_alphanumeric()
            || matches!(
                byte,
                b'-' | b'_'
                    | b'.'
                    | b'!'
                    | b'~'
                    | b'*'
                    | b'\''
                    | b'('
                    | b')'
                    | b'&'
                    | b'='
                    | b'/'
                    | b'?'
                    | b':'
                    | b'@'
                    | b'$'
                    | b','
                    | b';'
                    | b'+'
            );
        if keep {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// Amazon remote cart URL for the given ASINs and quantities.
///
/// Returns an empty string when no position is usable, exactly like the legacy helper.
pub fn amazon_cart_url(items: &[(String, i64)], domain: &str) -> String {
    let valid: Vec<(String, i64)> = items
        .iter()
        .filter_map(|(asin, quantity)| {
            valid_asin(asin)
                .filter(|_| *quantity > 0)
                .map(|asin| (asin, *quantity))
        })
        .collect();
    if valid.is_empty() {
        return String::new();
    }

    let domain = clean_domain(domain);
    let query: Vec<String> = valid
        .iter()
        .enumerate()
        .map(|(index, (asin, quantity))| {
            let position = index + 1;
            format!(
                "ASIN.{position}={}&Quantity.{position}={}",
                encode_component(asin),
                (*quantity).max(1)
            )
        })
        .collect();
    format!(
        "https://www.{domain}/gp/aws/cart/add.html?{}",
        query.join("&")
    )
}

/// Amazon search URL for a query.
pub fn amazon_search_url(query: &str, domain: &str) -> String {
    let domain = clean_domain(domain);
    format!(
        "https://www.{domain}/s?k={}",
        encode_component(query.trim())
    )
}

/// One candidate of the plan.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReorderLine {
    /// Product as it was when the plan was built.
    pub product: Product,
    /// Quantity to order, at least one.
    pub quantity: i64,
    /// Whether the position is part of the order.
    pub included: bool,
}

impl ReorderLine {
    /// ASIN that makes the position usable for the Amazon cart.
    pub fn asin(&self) -> Option<String> {
        product_asin(&self.product)
    }

    /// Unit cost used for the estimate: cost price, falling back to the sale price.
    pub fn unit_cost(&self) -> Money {
        if self.product.cost_price.cents() > 0 {
            self.product.cost_price
        } else {
            self.product.price
        }
    }

    /// Whether the position counts as excluded (permanent flag or unchecked in the modal).
    pub fn is_excluded(&self) -> bool {
        self.product.exclude_from_reorder || !self.included
    }
}

/// Aggregated numbers of the KPI row.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ReorderStats {
    /// Number of low-stock candidates.
    pub low_stock_count: usize,
    /// Units of all included positions.
    pub total_units: i64,
    /// Estimated purchase sum of the included positions.
    pub estimated_cost: Money,
    /// Candidates not included.
    pub excluded_count: usize,
    /// Included candidates with a usable ASIN.
    pub asin_ready_count: usize,
    /// Included candidates without a usable ASIN.
    pub missing_asin_count: usize,
}

/// Candidate list plus the modal's local state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReorderPlan {
    /// Active threshold mode.
    pub threshold: Threshold,
    /// Amazon marketplace of the generated links.
    pub domain: String,
    /// Search text of the modal's filter.
    pub query: String,
    /// Whether only excluded candidates are shown.
    pub excluded_only: bool,
    /// Candidates, in product order.
    pub lines: Vec<ReorderLine>,
    quantities: HashMap<Uuid, i64>,
    inclusions: HashMap<Uuid, bool>,
}

impl Default for ReorderPlan {
    fn default() -> Self {
        Self {
            threshold: Threshold::default(),
            domain: DEFAULT_DOMAIN.to_string(),
            query: String::new(),
            excluded_only: false,
            lines: Vec::new(),
            quantities: HashMap::new(),
            inclusions: HashMap::new(),
        }
    }
}

impl ReorderPlan {
    /// Builds a plan for the given products and adds every low-stock candidate.
    pub fn new(products: &[Product], threshold: Threshold) -> Self {
        let mut plan = Self {
            threshold,
            ..Self::default()
        };
        plan.adopt(products);
        plan
    }

    /// Rebuilds the candidate list, keeping quantities and inclusions already chosen.
    pub fn adopt(&mut self, products: &[Product]) {
        self.lines = products
            .iter()
            .filter(|product| self.threshold.matches(product))
            .map(|product| {
                let quantity = *self
                    .quantities
                    .entry(product.id)
                    .or_insert_with(|| default_quantity(product));
                let included = *self
                    .inclusions
                    .entry(product.id)
                    .or_insert(!product.exclude_from_reorder);
                ReorderLine {
                    product: product.clone(),
                    quantity,
                    included,
                }
            })
            .collect();
    }

    /// Switches the threshold and rebuilds the list.
    pub fn set_threshold(&mut self, threshold: Threshold, products: &[Product]) {
        self.threshold = threshold;
        self.adopt(products);
    }

    /// Increases or decreases one quantity; the result never drops below one.
    pub fn adjust(&mut self, index: usize, delta: i64) {
        if let Some(line) = self.lines.get_mut(index) {
            line.quantity = (line.quantity + delta).max(1);
            self.quantities.insert(line.product.id, line.quantity);
        }
    }

    /// Sets one quantity exactly; values below one are clamped.
    pub fn set_quantity(&mut self, index: usize, quantity: i64) {
        if let Some(line) = self.lines.get_mut(index) {
            line.quantity = quantity.max(1);
            self.quantities.insert(line.product.id, line.quantity);
        }
    }

    /// Includes or excludes one position for this run.
    pub fn toggle(&mut self, index: usize) {
        if let Some(line) = self.lines.get_mut(index) {
            line.included = !line.included;
            self.inclusions.insert(line.product.id, line.included);
        }
    }

    /// Sets the permanent exclusion flag of one candidate and mirrors it into the inclusion.
    ///
    /// The caller stores the returned product; the modal writes `exclude_from_reorder` the same way.
    pub fn set_permanent_exclusion(&mut self, index: usize, excluded: bool) -> Option<Product> {
        let line = self.lines.get_mut(index)?;
        line.product.exclude_from_reorder = excluded;
        line.included = !excluded;
        self.inclusions.insert(line.product.id, line.included);
        Some(line.product.clone())
    }

    /// Indices shown after applying the search text and the excluded-only switch.
    pub fn visible(&self) -> Vec<usize> {
        let query = self.query.trim().to_lowercase();
        self.lines
            .iter()
            .enumerate()
            .filter(|(_, line)| {
                if self.excluded_only && !line.is_excluded() {
                    return false;
                }
                if query.is_empty() {
                    return true;
                }
                let product = &line.product;
                product.name.to_lowercase().contains(&query)
                    || product.sku.to_lowercase().contains(&query)
                    || product
                        .asin
                        .as_deref()
                        .is_some_and(|asin| asin.to_lowercase().contains(&query))
                    || product
                        .source_domain
                        .as_deref()
                        .is_some_and(|domain| domain.to_lowercase().contains(&query))
            })
            .map(|(index, _)| index)
            .collect()
    }

    /// Included positions with a usable ASIN.
    pub fn asin_items(&self) -> Vec<(String, i64)> {
        self.lines
            .iter()
            .filter(|line| line.included)
            .filter_map(|line| line.asin().map(|asin| (asin, line.quantity)))
            .collect()
    }

    /// Amazon multi-item cart URL of the included positions.
    pub fn cart_url(&self) -> String {
        amazon_cart_url(&self.asin_items(), &self.domain)
    }

    /// Amazon search URL for the current search text.
    pub fn search_url(&self) -> String {
        amazon_search_url(&self.query, &self.domain)
    }

    /// KPI numbers of the modal.
    pub fn stats(&self) -> ReorderStats {
        let mut stats = ReorderStats {
            low_stock_count: self.lines.len(),
            ..ReorderStats::default()
        };
        for line in &self.lines {
            if !line.included {
                stats.excluded_count += 1;
                continue;
            }
            stats.total_units += line.quantity;
            stats.estimated_cost = stats.estimated_cost + line.unit_cost().times(line.quantity);
            if line.asin().is_some() {
                stats.asin_ready_count += 1;
            } else {
                stats.missing_asin_count += 1;
            }
        }
        stats
    }

    /// Text list the legacy modal copies to the clipboard.
    ///
    /// `date` is passed in because the legacy code formats the current date with the browser
    /// locale; the caller formats it once and the text stays deterministic in tests.
    pub fn replenishment_text(&self, currency: &str, date: &str) -> String {
        let included: Vec<&ReorderLine> = self.lines.iter().filter(|line| line.included).collect();
        if included.is_empty() {
            return String::new();
        }

        let mut text = format!(
            "📦 SOCDOF REORDER / REPLENISHMENT LIST ({date})\n=========================================================\n"
        );
        for (index, line) in included.iter().enumerate() {
            let product = &line.product;
            let asin = line.asin().unwrap_or_else(|| "N/A".to_string());
            let unit_cost = if product.cost_price.cents() > 0 {
                format!(
                    "{} {currency}",
                    Money::from_cents(product.cost_price.cents()).to_decimal_string()
                )
            } else {
                "-".to_string()
            };
            text.push_str(&format!(
                "{}. {} | SKU: {} | ASIN: {}\n",
                index + 1,
                product.name,
                product.sku,
                asin
            ));
            text.push_str(&format!(
                "   Menge / Qty: {} {} | EK: {} | Link: {}\n\n",
                line.quantity,
                if product.unit.is_empty() {
                    "Stk."
                } else {
                    product.unit.as_str()
                },
                unit_cost,
                product.web_link.as_deref().unwrap_or("N/A")
            ));
        }
        text.push_str("=========================================================\n");
        text.push_str(&format!(
            "Gesamtpositionen: {} | Geschätzte Kosten: {} {currency}\n",
            included.len(),
            Money::from_cents(self.stats().estimated_cost.cents()).to_decimal_string()
        ));
        text
    }

    /// Draft purchase order over the included positions; `None` when nothing is included.
    pub fn draft_order(
        &self,
        vendor: Uuid,
        number: impl Into<String>,
        now: i64,
        currency: &str,
    ) -> Option<PurchaseOrder> {
        let included: Vec<&ReorderLine> = self.lines.iter().filter(|line| line.included).collect();
        if included.is_empty() {
            return None;
        }

        let lines: Vec<PurchaseOrderLine> = included
            .iter()
            .map(|line| PurchaseOrderLine {
                product_id: Some(line.product.id),
                description: line.product.name.clone(),
                quantity_milli: line.quantity * 1_000,
                unit_cost: line.unit_cost(),
                tax_rate_bp: DRAFT_ORDER_TAX_BP,
            })
            .collect();

        Some(PurchaseOrder {
            id: Uuid::new_v4(),
            number: number.into(),
            vendor_id: vendor,
            status: PurchaseOrderStatus::Draft,
            order_date: now,
            expected_at: Some(now + DRAFT_ORDER_LEAD_MS),
            currency_symbol: currency.to_string(),
            note: Some(format!(
                "Automatisch generiert über den SOCDOF Smart Reorder Hub für {} knappe Artikel.",
                included.len()
            )),
            lines,
            legacy_id: None,
            created_at: now,
            updated_at: now,
        })
    }
}

/// Order number of a generated draft (`PO/<year>/<1000..9999>` in the legacy modal).
pub fn order_number(year: i32, value: u16) -> String {
    format!("PO/{year}/{:04}", value.clamp(1000, 9999))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn product(name: &str, stock: i64, reorder_level: i64, target_stock: i64) -> Product {
        let mut product = Product::new(name, 0);
        product.sku = format!("SKU-{name}");
        product.stock = stock;
        product.reorder_level = reorder_level;
        product.target_stock = target_stock;
        product.price = Money::from_cents(1_000);
        product.cost_price = Money::from_cents(600);
        product
    }

    #[test]
    fn individual_threshold_uses_the_reorder_level_and_falls_back_to_five() {
        let low = product("Kaffee", 3, 3, 12);
        let empty_level = product("Tee", 5, 0, 0);
        let enough = product("Zucker", 9, 3, 12);
        assert!(Threshold::Individual.matches(&low));
        assert!(Threshold::Individual.matches(&empty_level));
        assert!(!Threshold::Individual.matches(&enough));
        assert_eq!(
            Threshold::Individual.limit(&empty_level),
            INDIVIDUAL_FALLBACK
        );
    }

    #[test]
    fn fixed_threshold_applies_to_every_product() {
        let threshold = Threshold::Fixed(6);
        assert!(threshold.matches(&product("Kaffee", 6, 0, 0)));
        assert!(!threshold.matches(&product("Kaffee", 7, 0, 0)));
        assert_eq!(Threshold::Fixed(0).limit(&product("Kaffee", 1, 0, 0)), 1);
    }

    #[test]
    fn default_quantity_fills_up_to_the_target() {
        assert_eq!(default_quantity(&product("A", 4, 5, 20)), 16);
        assert_eq!(
            default_quantity(&product("B", 4, 5, 0)),
            6,
            "min_qty * 2 when no target is set"
        );
        assert_eq!(
            default_quantity(&product("C", 9, 0, 0)),
            1,
            "ten units target, never below one"
        );
        assert_eq!(default_quantity(&product("D", 12, 0, 0)), 1);
    }

    #[test]
    fn plan_keeps_quantities_and_inclusions_when_the_threshold_changes() {
        let mut excluded = product("Kaffee", 2, 5, 20);
        excluded.exclude_from_reorder = true;
        let products = vec![excluded, product("Tee", 4, 5, 12)];

        let mut plan = ReorderPlan::new(&products, Threshold::Individual);
        assert_eq!(plan.lines.len(), 2);
        assert!(!plan.lines[0].included, "excluded products start unchecked");
        assert!(plan.lines[1].included);
        assert_eq!(plan.lines[0].quantity, 18);

        plan.adjust(0, 2);
        assert_eq!(plan.lines[0].quantity, 20);
        plan.set_quantity(1, 0);
        assert_eq!(plan.lines[1].quantity, 1, "quantities never drop below one");
        plan.toggle(1);
        assert!(!plan.lines[1].included);

        plan.set_threshold(Threshold::Fixed(2), &products);
        assert_eq!(
            plan.lines.len(),
            1,
            "only the product at or below two remains"
        );
        assert_eq!(plan.lines[0].quantity, 20, "the chosen quantity survives");

        plan.set_threshold(Threshold::Individual, &products);
        assert_eq!(plan.lines.len(), 2);
        assert!(!plan.lines[1].included, "the inclusion survives");
    }

    #[test]
    fn stats_use_the_cost_price_and_count_exclusions() {
        let mut products = vec![
            product("Kaffee", 2, 5, 20),
            product("Tee", 1, 5, 5),
            product("Zucker", 9, 5, 20),
        ];
        products[1].cost_price = Money::ZERO;
        products[1].price = Money::from_cents(1_500);

        let mut plan = ReorderPlan::new(&products, Threshold::Individual);
        assert_eq!(plan.lines.len(), 2);

        let stats = plan.stats();
        assert_eq!(stats.low_stock_count, 2);
        assert_eq!(stats.total_units, 18 + 4);
        assert_eq!(stats.estimated_cost.cents(), 18 * 600 + 4 * 1_500);
        assert_eq!(stats.excluded_count, 0);

        plan.toggle(1);
        let stats = plan.stats();
        assert_eq!(stats.excluded_count, 1);
        assert_eq!(stats.total_units, 18);
    }

    #[test]
    fn search_and_the_excluded_only_switch_filter_the_list() {
        let mut coffee = product("Kaffee", 2, 5, 20);
        coffee.asin = Some("B08N5WRWNW".to_string());
        coffee.source_domain = Some("Amazon (DE)".to_string());
        let tea = product("Tee", 1, 5, 5);
        let mut plan = ReorderPlan::new(&[coffee, tea], Threshold::Individual);

        assert_eq!(plan.visible(), vec![0, 1]);
        plan.query = "kaffee".to_string();
        assert_eq!(plan.visible(), vec![0]);
        plan.query = "b08n5".to_string();
        assert_eq!(plan.visible(), vec![0], "the ASIN is searchable");
        plan.query = "amazon".to_string();
        assert_eq!(plan.visible(), vec![0], "the source domain is searchable");
        plan.query = "sku-tee".to_string();
        assert_eq!(plan.visible(), vec![1]);

        plan.query.clear();
        plan.toggle(0);
        plan.excluded_only = true;
        assert_eq!(
            plan.visible(),
            vec![0],
            "only the unchecked candidate matches"
        );
    }

    #[test]
    fn asins_come_from_the_field_or_the_web_link() {
        assert_eq!(
            extract_amazon_asin("b08n5wrwnw").as_deref(),
            Some("B08N5WRWNW")
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/Some-Product/dp/B08N5WRWNW/ref=sr_1")
                .as_deref(),
            Some("B08N5WRWNW")
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/gp/product/B08N5WRWNW").as_deref(),
            Some("B08N5WRWNW")
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/s?k=kaffee&asin=B08N5WRWNW").as_deref(),
            Some("B08N5WRWNW")
        );
        assert_eq!(extract_amazon_asin("https://example.com/B08N5WR"), None);
        assert_eq!(valid_asin("B08N5WRWN"), None);

        let mut product = product("Kaffee", 2, 5, 20);
        product.web_link = Some("https://www.amazon.de/dp/B08N5WRWNW".to_string());
        assert_eq!(product_asin(&product).as_deref(), Some("B08N5WRWNW"));

        product.asin = Some("  b08n5wrwnw ".to_string());
        assert_eq!(product_asin(&product).as_deref(), Some("B08N5WRWNW"));

        product.asin = Some("kaputt".to_string());
        assert_eq!(
            product_asin(&product),
            None,
            "a broken field does not fall back"
        );
    }

    #[test]
    fn cart_links_follow_the_legacy_remote_cart_format() {
        assert_eq!(
            amazon_cart_url(
                &[
                    ("b08n5wrwnw".to_string(), 2),
                    ("B07XJ8C8F5".to_string(), 1),
                ],
                "amazon.de"
            ),
            "https://www.amazon.de/gp/aws/cart/add.html?ASIN.1=B08N5WRWNW&Quantity.1=2&ASIN.2=B07XJ8C8F5&Quantity.2=1"
        );
        assert_eq!(
            amazon_cart_url(
                &[("B08N5WRWNW".to_string(), 3)],
                "https://www.amazon.co.uk/x"
            ),
            "https://www.amazon.co.uk/gp/aws/cart/add.html?ASIN.1=B08N5WRWNW&Quantity.1=3"
        );
        assert_eq!(
            amazon_cart_url(&[("B08N5WRWNW".to_string(), 1)], "shop.example"),
            "https://www.amazon.de/gp/aws/cart/add.html?ASIN.1=B08N5WRWNW&Quantity.1=1",
            "unknown hosts fall back to amazon.de"
        );
        assert_eq!(
            amazon_cart_url(&[("B08N5WRWNW".to_string(), 0)], "amazon.de"),
            ""
        );
        assert_eq!(amazon_cart_url(&[], "amazon.de"), "");
        assert_eq!(
            amazon_search_url(" Kaffee Bohnen ", "amazon.fr"),
            "https://www.amazon.fr/s?k=Kaffee%20Bohnen"
        );
    }

    #[test]
    fn replenishment_text_lists_included_positions() {
        let mut coffee = product("Kaffee", 2, 5, 20);
        coffee.unit = "kg".to_string();
        coffee.cost_price = Money::from_cents(1_299);
        coffee.web_link = Some("https://www.amazon.de/dp/B08N5WRWNW".to_string());
        let mut plan = ReorderPlan::new(&[coffee], Threshold::Individual);

        let text = plan.replenishment_text("€", "10.11.2026");
        assert_eq!(
            text,
            concat!(
                "📦 SOCDOF REORDER / REPLENISHMENT LIST (10.11.2026)\n",
                "=========================================================\n",
                "1. Kaffee | SKU: SKU-Kaffee | ASIN: B08N5WRWNW\n",
                "   Menge / Qty: 18 kg | EK: 12.99 € | Link: https://www.amazon.de/dp/B08N5WRWNW\n",
                "\n",
                "=========================================================\n",
                "Gesamtpositionen: 1 | Geschätzte Kosten: 233.82 €\n",
            )
        );

        plan.toggle(0);
        assert_eq!(plan.replenishment_text("€", "10.11.2026"), "");
    }

    #[test]
    fn draft_orders_carry_status_dates_and_nineteen_percent() {
        let mut coffee = product("Kaffee", 2, 5, 20);
        coffee.cost_price = Money::from_cents(1_000);
        let plan = ReorderPlan::new(&[coffee], Threshold::Individual);
        let now = 1_700_000_000_000;

        let order = plan
            .draft_order(Uuid::nil(), order_number(2026, 4711), now, "€")
            .expect("draft");
        assert_eq!(order.number, "PO/2026/4711");
        assert_eq!(order.status, PurchaseOrderStatus::Draft);
        assert_eq!(order.order_date, now);
        assert_eq!(order.expected_at, Some(now + DRAFT_ORDER_LEAD_MS));
        assert_eq!(order.lines.len(), 1);
        assert_eq!(order.lines[0].quantity_milli, 18_000);
        assert_eq!(order.lines[0].tax_rate_bp, 1_900);
        assert_eq!(order.total_net().cents(), 18_000);
        assert_eq!(order.total_tax().cents(), 3_420);
        assert_eq!(
            order.note.as_deref(),
            Some("Automatisch generiert über den SOCDOF Smart Reorder Hub für 1 knappe Artikel.")
        );

        let mut empty = ReorderPlan::new(&[], Threshold::Individual);
        assert_eq!(
            empty.draft_order(Uuid::nil(), "PO/2026/1000", now, "€"),
            None
        );
        assert_eq!(order_number(2026, 12), "PO/2026/1000");
        assert_eq!(empty.lines.len(), 0);
        empty.excluded_only = true;
    }
}
