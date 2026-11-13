//! Dashboard aggregates for the overview screen.
//!
//! Everything here is derived from stored rows: counts, period totals and the two short lists the
//! screen shows. The UI never aggregates on its own, so the CLI, the window commands and the Rust
//! screens report the same numbers for the same period.
//!
//! The period is a half-open range of issue timestamps (`from <= issued_at < to`); the caller
//! decides whether that is a month, a quarter or the whole history.

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::domain::invoice::InvoiceStatus;
use crate::error::CoreResult;
use crate::money::Money;
use crate::store::{contacts, invoices};

/// How far ahead the dashboard counts appointments.
pub const UPCOMING_WINDOW_MS: i64 = 7 * 24 * 60 * 60 * 1_000;

/// Stock independent figures of the dashboard.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DashboardCounts {
    /// Rows in `contacts`.
    pub contacts: i64,
    /// Rows in `products`.
    pub products: i64,
    /// Products at or below their reorder level, excluding the ones opted out.
    pub low_stock: i64,
    /// Stock valued at the cost price.
    pub inventory_cost: Money,
    /// Stock valued at the sales price.
    pub inventory_retail: Money,
    /// Appointments in the next seven days that are neither done nor cancelled.
    pub upcoming_appointments: i64,
}

impl Default for DashboardCounts {
    fn default() -> Self {
        Self {
            contacts: 0,
            products: 0,
            low_stock: 0,
            inventory_cost: Money::ZERO,
            inventory_retail: Money::ZERO,
            upcoming_appointments: 0,
        }
    }
}

/// One invoice as the overview lists it: no positions, but with the contact name and the gross
/// total.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceOverview {
    /// Human readable invoice number.
    pub number: String,
    /// Display name of the billed contact.
    pub contact: String,
    /// Lifecycle state.
    pub status: InvoiceStatus,
    /// Issue date in milliseconds since the Unix epoch.
    pub issued_at: i64,
    /// Gross total including tax.
    pub gross: Money,
    /// Currency symbol used for printing.
    pub currency_symbol: String,
}

/// One product that is at or below its reorder level.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LowStockRow {
    /// Display name.
    pub name: String,
    /// Article number.
    pub sku: String,
    /// Current stock in whole units.
    pub stock: i64,
    /// Reorder level; always greater than zero.
    pub reorder_level: i64,
    /// Unit of measure.
    pub unit: String,
}

/// Key figures of the dashboard for one period.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DashboardSummary {
    /// Rows in `contacts`.
    pub contacts: i64,
    /// Rows in `products`.
    pub products: i64,
    /// Products at or below their reorder level.
    pub low_stock: i64,
    /// Non-cancelled invoices issued in the period.
    pub invoices: i64,
    /// Draft invoices in the period.
    pub draft_invoices: i64,
    /// Sent and overdue invoices in the period.
    pub open_invoices: i64,
    /// Overdue invoices in the period.
    pub overdue_invoices: i64,
    /// Paid invoices in the period.
    pub paid_invoices: i64,
    /// Gross of all non-cancelled invoices in the period.
    pub gross: Money,
    /// Gross of the paid invoices in the period.
    pub paid: Money,
    /// Gross of the sent and overdue invoices in the period.
    pub open: Money,
    /// Gross of the overdue invoices in the period.
    pub overdue: Money,
    /// Gross of the draft invoices in the period.
    pub draft: Money,
    /// Stock valued at the cost price.
    pub inventory_cost: Money,
    /// Stock valued at the sales price.
    pub inventory_retail: Money,
    /// Appointments in the next seven days.
    pub upcoming_appointments: i64,
}

impl Default for DashboardSummary {
    fn default() -> Self {
        Self {
            contacts: 0,
            products: 0,
            low_stock: 0,
            invoices: 0,
            draft_invoices: 0,
            open_invoices: 0,
            overdue_invoices: 0,
            paid_invoices: 0,
            gross: Money::ZERO,
            paid: Money::ZERO,
            open: Money::ZERO,
            overdue: Money::ZERO,
            draft: Money::ZERO,
            inventory_cost: Money::ZERO,
            inventory_retail: Money::ZERO,
            upcoming_appointments: 0,
        }
    }
}

impl DashboardSummary {
    /// Whether the database has no contacts, products or invoices at all.
    ///
    /// The screen shows its empty state while this is true; the period totals alone would report
    /// zero for a period without documents even though the database is far from empty.
    pub fn is_empty(&self) -> bool {
        self.contacts == 0 && self.products == 0 && self.invoices == 0
    }
}

/// Counts that do not depend on the selected period.
pub fn counts(conn: &Connection, now: i64) -> CoreResult<DashboardCounts> {
    let contacts: i64 = conn.query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))?;
    let products: i64 = conn.query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))?;
    let low_stock: i64 = conn.query_row(
        "SELECT COUNT(*) FROM products
         WHERE reorder_level > 0 AND stock <= reorder_level AND exclude_from_reorder = 0",
        [],
        |row| row.get(0),
    )?;
    let (inventory_cost, inventory_retail): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(MAX(stock, 0) * cost_price_cents), 0),
                COALESCE(SUM(MAX(stock, 0) * price_cents), 0)
         FROM products",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let upcoming_appointments: i64 = conn.query_row(
        "SELECT COUNT(*) FROM appointments
         WHERE starts_at >= ?1 AND starts_at < ?2
           AND status NOT IN ('cancelled', 'completed', 'no_show')",
        params![now, now.saturating_add(UPCOMING_WINDOW_MS)],
        |row| row.get(0),
    )?;

    Ok(DashboardCounts {
        contacts,
        products,
        low_stock,
        inventory_cost: Money::from_cents(inventory_cost),
        inventory_retail: Money::from_cents(inventory_retail),
        upcoming_appointments,
    })
}

/// All invoices in list order (newest first), with contact names and gross totals.
pub fn overview(conn: &Connection) -> CoreResult<Vec<InvoiceOverview>> {
    let names: std::collections::HashMap<Uuid, String> = contacts::list(conn)?
        .into_iter()
        .map(|contact| (contact.id, contact.display_name()))
        .collect();

    Ok(invoices::list(conn)?
        .into_iter()
        .map(|invoice| InvoiceOverview {
            number: invoice.number.clone(),
            contact: names.get(&invoice.contact_id).cloned().unwrap_or_default(),
            status: invoice.status,
            issued_at: invoice.issued_at,
            gross: invoice.total_gross(),
            currency_symbol: invoice.currency_symbol,
        })
        .collect())
}

/// The newest invoices, at most `limit`.
pub fn recent(conn: &Connection, limit: usize) -> CoreResult<Vec<InvoiceOverview>> {
    Ok(overview(conn)?.into_iter().take(limit).collect())
}

/// Products at or below their reorder level, largest shortfall first.
pub fn low_stock(conn: &Connection, limit: usize) -> CoreResult<Vec<LowStockRow>> {
    let mut statement = conn.prepare(
        "SELECT name, sku, stock, reorder_level, unit FROM products
         WHERE reorder_level > 0 AND stock <= reorder_level AND exclude_from_reorder = 0
         ORDER BY (reorder_level - stock) DESC, name
         LIMIT ?1",
    )?;
    let rows = statement.query_map(params![limit as i64], |row| {
        Ok(LowStockRow {
            name: row.get(0)?,
            sku: row.get(1)?,
            stock: row.get(2)?,
            reorder_level: row.get(3)?,
            unit: row.get(4)?,
        })
    })?;

    let mut products = Vec::new();
    for row in rows {
        products.push(row?);
    }
    Ok(products)
}

/// Builds the key figures of a period from the overview rows and the period independent counts.
pub fn summarize(
    overview: &[InvoiceOverview],
    counts: &DashboardCounts,
    from: i64,
    to: i64,
) -> DashboardSummary {
    let mut summary = DashboardSummary {
        contacts: counts.contacts,
        products: counts.products,
        low_stock: counts.low_stock,
        inventory_cost: counts.inventory_cost,
        inventory_retail: counts.inventory_retail,
        upcoming_appointments: counts.upcoming_appointments,
        ..DashboardSummary::default()
    };

    for invoice in overview
        .iter()
        .filter(|invoice| invoice.issued_at >= from && invoice.issued_at < to)
    {
        if invoice.status == InvoiceStatus::Cancelled {
            continue;
        }

        summary.invoices += 1;
        summary.gross = summary.gross + invoice.gross;

        match invoice.status {
            InvoiceStatus::Draft => {
                summary.draft_invoices += 1;
                summary.draft = summary.draft + invoice.gross;
            }
            InvoiceStatus::Paid => {
                summary.paid_invoices += 1;
                summary.paid = summary.paid + invoice.gross;
            }
            InvoiceStatus::Sent => {
                summary.open_invoices += 1;
                summary.open = summary.open + invoice.gross;
            }
            InvoiceStatus::Overdue => {
                summary.open_invoices += 1;
                summary.open = summary.open + invoice.gross;
                summary.overdue_invoices += 1;
                summary.overdue = summary.overdue + invoice.gross;
            }
            InvoiceStatus::Cancelled => {}
        }
    }

    summary
}

/// Key figures for a period, loaded from the store.
pub fn summary(conn: &Connection, from: i64, to: i64, now: i64) -> CoreResult<DashboardSummary> {
    let counts = counts(conn, now)?;
    Ok(summarize(&overview(conn)?, &counts, from, to))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{Invoice, InvoiceLine};
    use crate::domain::product::Product;
    use crate::store::Store;

    const DAY: i64 = 24 * 60 * 60 * 1_000;
    const NOW: i64 = 1_794_052_800_000; // 2026-11-07 12:00 UTC

    fn store_with_data() -> Store {
        let store = Store::open_in_memory().expect("store");

        let mut buyer = crate::domain::contact::Contact::new(ContactKind::Company, NOW);
        buyer.company_name = Some("AlpenTech".to_string());
        store.insert_contact(&buyer).expect("contact");

        let mut coffee = Product::new("Kaffee", NOW);
        coffee.sku = "A-100".to_string();
        coffee.stock = 2;
        coffee.reorder_level = 10;
        coffee.cost_price = Money::from_cents(500);
        coffee.price = Money::from_cents(900);
        store.insert_product(&coffee).expect("product");

        let mut cup = Product::new("Tasse", NOW);
        cup.stock = 50;
        cup.reorder_level = 5;
        cup.cost_price = Money::from_cents(200);
        cup.price = Money::from_cents(450);
        store.insert_product(&cup).expect("product");

        let invoice = |number: &str, status, issued_at: i64, cents: i64| Invoice {
            id: Uuid::new_v4(),
            number: number.to_string(),
            contact_id: buyer.id,
            status,
            issued_at,
            due_at: issued_at + 14 * DAY,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(cents),
                tax_rate_bp: 0,
            }],
        };

        store
            .insert_invoice(&invoice(
                "2026-0001",
                InvoiceStatus::Sent,
                NOW - 2 * DAY,
                10_000,
            ))
            .expect("invoice");
        store
            .insert_invoice(&invoice(
                "2026-0002",
                InvoiceStatus::Paid,
                NOW - 5 * DAY,
                20_000,
            ))
            .expect("invoice");
        store
            .insert_invoice(&invoice(
                "2026-0003",
                InvoiceStatus::Overdue,
                NOW - 12 * DAY,
                30_000,
            ))
            .expect("invoice");
        store
            .insert_invoice(&invoice(
                "2026-0004",
                InvoiceStatus::Cancelled,
                NOW - 20 * DAY,
                40_000,
            ))
            .expect("invoice");
        store
            .insert_invoice(&invoice(
                "2026-0005",
                InvoiceStatus::Draft,
                NOW - 40 * DAY,
                50_000,
            ))
            .expect("invoice");

        store
    }

    #[test]
    fn counts_low_stock_and_inventory_value() {
        let store = store_with_data();
        let counts = counts(&store.conn, NOW).expect("counts");

        assert_eq!(counts.contacts, 1);
        assert_eq!(counts.products, 2);
        assert_eq!(counts.low_stock, 1);
        // 2 × 5,00 € + 50 × 2,00 €
        assert_eq!(counts.inventory_cost, Money::from_cents(11_000));
        // 2 × 9,00 € + 50 × 4,50 €
        assert_eq!(counts.inventory_retail, Money::from_cents(24_300));
        assert_eq!(counts.upcoming_appointments, 0);
    }

    #[test]
    fn summarizes_a_period_and_skips_cancelled_invoices() {
        let store = store_with_data();
        let counts = counts(&store.conn, NOW).expect("counts");
        let overview = overview(&store.conn).expect("overview");

        // Everything since the epoch: four live invoices, one cancelled.
        let all = summarize(&overview, &counts, i64::MIN, i64::MAX);
        assert_eq!(all.invoices, 4);
        assert_eq!(all.gross, Money::from_cents(110_000));
        assert_eq!(all.open_invoices, 2);
        assert_eq!(all.open, Money::from_cents(40_000));
        assert_eq!(all.overdue_invoices, 1);
        assert_eq!(all.overdue, Money::from_cents(30_000));
        assert_eq!(all.paid_invoices, 1);
        assert_eq!(all.paid, Money::from_cents(20_000));
        assert_eq!(all.draft_invoices, 1);
        assert_eq!(all.draft, Money::from_cents(50_000));

        // Last 30 days: without the draft from 40 days ago.
        let month = summarize(&overview, &counts, NOW - 30 * DAY, NOW);
        assert_eq!(month.invoices, 3);
        assert_eq!(month.gross, Money::from_cents(60_000));
        assert_eq!(month.draft_invoices, 0);
    }

    #[test]
    fn lists_recent_invoices_with_contact_names() {
        let store = store_with_data();
        let recent = recent(&store.conn, 3).expect("recent");

        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].number, "2026-0001");
        assert_eq!(recent[0].contact, "AlpenTech");
        assert_eq!(recent[1].status, InvoiceStatus::Paid);
        assert_eq!(recent[2].gross, Money::from_cents(30_000));
    }

    #[test]
    fn lists_products_below_their_reorder_level() {
        let store = store_with_data();
        let rows = low_stock(&store.conn, 5).expect("low stock");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Kaffee");
        assert_eq!(rows[0].sku, "A-100");
        assert_eq!(rows[0].stock, 2);
        assert_eq!(rows[0].reorder_level, 10);
    }

    #[test]
    fn reports_the_empty_database() {
        let store = Store::open_in_memory().expect("store");
        let summary = summary(&store.conn, i64::MIN, i64::MAX, NOW).expect("summary");
        assert!(summary.is_empty());

        let counts = counts(&store.conn, NOW).expect("counts");
        assert_eq!(counts, DashboardCounts::default());
    }
}
