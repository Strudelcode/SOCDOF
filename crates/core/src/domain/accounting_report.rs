//! Cross-module accounting dashboard aggregates matching the legacy AccountingModule.
//!
//! This report combines posted/paid invoices, completed POS receipts and non-draft purchases.
//! It is deliberately a read-only projection: source documents remain authoritative in their
//! respective stores and are never rewritten by reporting.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::domain::invoice::{Invoice, InvoiceStatus};
use crate::domain::pos::{PaymentMethod, PosOrder};
use crate::domain::purchase::{PurchaseOrder, PurchaseOrderStatus};
use crate::money::Money;

/// Optional inclusive timestamp range for a report.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ReportRange {
    /// First included timestamp in milliseconds since the Unix epoch.
    pub from: Option<i64>,
    /// First excluded timestamp in milliseconds since the Unix epoch.
    pub to: Option<i64>,
}

impl ReportRange {
    fn contains(self, timestamp: i64) -> bool {
        self.from.map_or(true, |from| timestamp >= from)
            && self.to.map_or(true, |to| timestamp < to)
    }
}

/// One invoice that is still awaiting payment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OpenReceivable {
    /// Invoice identifier.
    pub id: uuid::Uuid,
    /// Human-readable invoice number.
    pub number: String,
    /// Issue timestamp.
    pub issued_at: i64,
    /// Due timestamp.
    pub due_at: i64,
    /// Remaining gross amount (the current invoice model has no partial-payment balance).
    pub amount: Money,
    /// Whether the due date has passed at report time.
    pub overdue: bool,
}

/// POS close totals grouped by tender type.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PosZReport {
    /// Number of completed receipts in the selected range.
    pub receipts: usize,
    /// Gross cash turnover.
    pub cash: Money,
    /// Gross card turnover.
    pub card: Money,
    /// Gross NFC/mobile wallet turnover.
    pub nfc: Money,
    /// Gross turnover for all other tender types.
    pub other: Money,
    /// Total gross turnover across all tender types.
    pub gross: Money,
}

/// VAT basis and tax for one rate.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct VatBucket {
    /// Taxable net amount.
    pub net: Money,
    /// VAT amount calculated on the aggregated taxable basis.
    pub tax: Money,
}

/// Cross-module financial summary for the Accounting dashboard.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BusinessAccountingReport {
    /// Net amount of posted/sent and paid invoices.
    pub invoice_net: Money,
    /// VAT amount of posted/sent and paid invoices.
    pub invoice_tax: Money,
    /// Gross amount of posted/sent and paid invoices.
    pub invoice_gross: Money,
    /// Net amount of POS receipts.
    pub pos_net: Money,
    /// VAT amount of POS receipts.
    pub pos_tax: Money,
    /// Gross amount of POS receipts.
    pub pos_gross: Money,
    /// Net amount of non-draft purchase orders.
    pub purchase_net: Money,
    /// Input VAT of non-draft purchase orders.
    pub purchase_tax: Money,
    /// Gross amount of non-draft purchase orders.
    pub purchase_gross: Money,
    /// Invoice plus POS net revenue.
    pub revenue_net: Money,
    /// Invoice plus POS VAT.
    pub output_vat: Money,
    /// Invoice plus POS gross revenue.
    pub revenue_gross: Money,
    /// Net revenue minus purchase net costs.
    pub operating_profit_net: Money,
    /// Output VAT minus deductible input VAT.
    pub vat_liability: Money,
    /// Taxable basis and VAT at 19 percent.
    pub vat_19: VatBucket,
    /// Taxable basis and VAT at 7 percent.
    pub vat_7: VatBucket,
    /// Unpaid sent/overdue invoices.
    pub open_receivables: Vec<OpenReceivable>,
    /// Gross sum of unpaid invoices.
    pub open_receivables_total: Money,
    /// Daily/period POS close.
    pub z_report: PosZReport,
}

/// Builds the legacy-style BWA, VAT advance summary, open items and POS Z-report.
///
/// Date ranges are applied independently to invoice issue dates, purchase order dates and POS
/// payment timestamps, matching the source module's per-document date fields.
pub fn build_business_accounting_report(
    invoices: &[Invoice],
    purchases: &[PurchaseOrder],
    pos_orders: &[PosOrder],
    range: ReportRange,
    now: i64,
) -> BusinessAccountingReport {
    let mut report = BusinessAccountingReport::default();
    let mut vat_bases = BTreeMap::<i64, i64>::new();

    for invoice in invoices.iter().filter(|invoice| {
        range.contains(invoice.issued_at)
            && matches!(
                invoice.status,
                InvoiceStatus::Sent | InvoiceStatus::Paid | InvoiceStatus::Overdue
            )
    }) {
        let net = invoice.total_net();
        let tax = invoice.total_tax();
        report.invoice_net = add(report.invoice_net, net);
        report.invoice_tax = add(report.invoice_tax, tax);
        report.invoice_gross = add(report.invoice_gross, invoice.total_gross());
        for line in &invoice.lines {
            *vat_bases.entry(line.tax_rate_bp).or_default() += line.net().cents();
        }
        if matches!(invoice.status, InvoiceStatus::Sent | InvoiceStatus::Overdue) {
            report.open_receivables.push(OpenReceivable {
                id: invoice.id,
                number: invoice.number.clone(),
                issued_at: invoice.issued_at,
                due_at: invoice.due_at,
                amount: invoice.total_gross(),
                overdue: invoice.due_at < now,
            });
            report.open_receivables_total =
                add(report.open_receivables_total, invoice.total_gross());
        }
    }

    for purchase in purchases.iter().filter(|purchase| {
        range.contains(purchase.order_date) && purchase.status != PurchaseOrderStatus::Draft
    }) {
        report.purchase_net = add(report.purchase_net, purchase.total_net());
        report.purchase_tax = add(report.purchase_tax, purchase.total_tax());
        report.purchase_gross = add(report.purchase_gross, purchase.total_gross());
    }

    for order in pos_orders
        .iter()
        .filter(|order| range.contains(order.paid_at))
    {
        report.pos_net = add(report.pos_net, order.total_net());
        report.pos_tax = add(report.pos_tax, order.total_tax());
        report.pos_gross = add(report.pos_gross, order.total_gross());
        report.z_report.receipts += 1;
        match order.payment_method {
            PaymentMethod::Cash => {
                report.z_report.cash = add(report.z_report.cash, order.total_gross())
            }
            PaymentMethod::Card => {
                report.z_report.card = add(report.z_report.card, order.total_gross())
            }
            PaymentMethod::Nfc => {
                report.z_report.nfc = add(report.z_report.nfc, order.total_gross())
            }
            PaymentMethod::BankTransfer | PaymentMethod::Invoice | PaymentMethod::Other => {
                report.z_report.other = add(report.z_report.other, order.total_gross())
            }
        }
        report.z_report.gross = add(report.z_report.gross, order.total_gross());
        for line in &order.lines {
            *vat_bases.entry(line.tax_rate_bp).or_default() += line.net().cents();
        }
    }

    report.revenue_net = add(report.invoice_net, report.pos_net);
    report.output_vat = add(report.invoice_tax, report.pos_tax);
    report.revenue_gross = add(report.invoice_gross, report.pos_gross);
    report.operating_profit_net = Money::from_cents(
        report.revenue_net.cents() - report.purchase_net.cents(),
    );
    report.vat_liability =
        Money::from_cents(report.output_vat.cents() - report.purchase_tax.cents());

    for (rate in [700_i64, 1900_i64]) {
        let net = Money::from_cents(*vat_bases.get(&rate).unwrap_or(&0));
        let bucket = VatBucket {
            net,
            tax: net.tax(rate),
        };
        if rate == 700 {
            report.vat_7 = bucket;
        } else {
            report.vat_19 = bucket;
        }
    }
    report
        .open_receivables
        .sort_by_key(|receivable| (receivable.due_at, receivable.issued_at));
    report
}

/// Exports the cross-module dashboard using the legacy semicolon-separated report layout.
pub fn export_business_accounting_csv(
    report: &BusinessAccountingReport,
    company_name: &str,
    period: &str,
    date_label: &str,
    currency: &str,
) -> String {
    let rows = vec![
        vec!["Accounting, Financials & P&L".to_string(), company_name.to_string()],
        vec!["Period".to_string(), period.to_string()],
        vec!["Date".to_string(), date_label.to_string()],
        Vec::new(),
        vec![
            "Item".to_string(),
            format!("Net ({currency})"),
            format!("VAT ({currency})"),
            format!("Gross ({currency})"),
        ],
        vec![
            "Invoice Revenues".to_string(),
            report.invoice_net.to_decimal_string(),
            report.invoice_tax.to_decimal_string(),
            report.invoice_gross.to_decimal_string(),
        ],
        vec![
            "POS Cash Register Revenues".to_string(),
            report.pos_net.to_decimal_string(),
            report.pos_tax.to_decimal_string(),
            report.pos_gross.to_decimal_string(),
        ],
        vec![
            "Total Revenue".to_string(),
            report.revenue_net.to_decimal_string(),
            report.output_vat.to_decimal_string(),
            report.revenue_gross.to_decimal_string(),
        ],
        vec![
            "Cost of Goods & Purchases".to_string(),
            report.purchase_net.to_decimal_string(),
            report.purchase_tax.to_decimal_string(),
            report.purchase_gross.to_decimal_string(),
        ],
        vec![
            "Operating Gross Profit".to_string(),
            report.operating_profit_net.to_decimal_string(),
            "-".to_string(),
            "-".to_string(),
        ],
        vec![
            "VAT Liability (VAT - Input Tax)".to_string(),
            "-".to_string(),
            "-".to_string(),
            report.vat_liability.to_decimal_string(),
        ],
    ];
    rows.into_iter()
        .map(|row| row.iter().map(|field| csv_field(field)).collect::<Vec<_>>().join(";"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn csv_field(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn add(left: Money, right: Money) -> Money {
    Money::from_cents(left.cents() + right.cents())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::invoice::InvoiceLine;
    use crate::domain::pos::PosOrderLine;
    use crate::domain::purchase::PurchaseOrderLine;

    #[test]
    fn aggregates_invoices_pos_and_purchases_into_bwa_vat_opos_and_z_report() {
        let invoice = Invoice {
            id: uuid::Uuid::new_v4(),
            number: "2026-001".into(),
            contact_id: uuid::Uuid::new_v4(),
            status: InvoiceStatus::Sent,
            issued_at: 1_000,
            due_at: 2_000,
            currency_symbol: "€".into(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Service".into(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1_900,
            }],
        };
        let purchase = PurchaseOrder {
            id: uuid::Uuid::new_v4(),
            number: "P-001".into(),
            vendor_id: uuid::Uuid::new_v4(),
            status: PurchaseOrderStatus::Received,
            order_date: 1_000,
            expected_at: None,
            currency_symbol: "€".into(),
            note: None,
            lines: vec![PurchaseOrderLine {
                product_id: None,
                description: "Supplies".into(),
                quantity_milli: 1_000,
                unit_cost: Money::from_cents(2_000),
                tax_rate_bp: 1_900,
            }],
            legacy_id: None,
            created_at: 1_000,
            updated_at: 1_000,
        };
        let pos = PosOrder {
            id: uuid::Uuid::new_v4(),
            receipt_number: "Z-001".into(),
            contact_id: None,
            payment_method: PaymentMethod::Nfc,
            paid_at: 1_000,
            currency_symbol: "€".into(),
            note: None,
            tax_total_override_cents: None,
            cash_given: None,
            lines: vec![PosOrderLine {
                product_id: None,
                description: "Coffee".into(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(5_000),
                tax_rate_bp: 700,
            }],
            legacy_id: None,
        };

        let report = build_business_accounting_report(
            &[invoice],
            &[purchase],
            &[pos],
            ReportRange::default(),
            3_000,
        );
        assert_eq!(report.invoice_net.cents(), 10_000);
        assert_eq!(report.pos_net.cents(), 5_000);
        assert_eq!(report.purchase_net.cents(), 2_000);
        assert_eq!(report.revenue_net.cents(), 15_000);
        assert_eq!(report.revenue_gross.cents(), 17_250);
        assert_eq!(report.operating_profit_net.cents(), 13_000);
        assert_eq!(report.vat_liability.cents(), 1_870);
        assert_eq!(report.vat_19.net.cents(), 10_000);
        assert_eq!(report.vat_7.net.cents(), 5_000);
        assert_eq!(report.open_receivables.len(), 1);
        assert!(report.open_receivables[0].overdue);
        assert_eq!(report.open_receivables_total.cents(), 11_900);
        assert_eq!(report.z_report.receipts, 1);
        assert_eq!(report.z_report.nfc.cents(), 5_350);
        assert_eq!(report.z_report.gross.cents(), 5_350);
    }

    #[test]
    fn applies_period_range_and_excludes_draft_documents() {
        let draft = Invoice {
            id: uuid::Uuid::new_v4(),
            number: "D-001".into(),
            contact_id: uuid::Uuid::new_v4(),
            status: InvoiceStatus::Draft,
            issued_at: 1_000,
            due_at: 2_000,
            currency_symbol: "€".into(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Draft".into(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1_900,
            }],
        };
        let mut outside = draft.clone();
        outside.status = InvoiceStatus::Paid;
        outside.issued_at = 10_000;
        let report = build_business_accounting_report(
            &[draft, outside],
            &[],
            &[],
            ReportRange {
                from: Some(0),
                to: Some(5_000),
            },
            5_000,
        );
        assert_eq!(report.invoice_net.cents(), 0);
        assert!(report.open_receivables.is_empty());
    }

    #[test]
    fn exports_business_report_with_company_period_and_currency_headers() {
        let report = BusinessAccountingReport {
            revenue_net: Money::from_cents(10_000),
            revenue_gross: Money::from_cents(11_900),
            ..BusinessAccountingReport::default()
        };
        let csv = export_business_accounting_csv(
            &report,
            "Example GmbH",
            "Current month",
            "13.11.2026",
            "€",
        );
        assert!(csv.contains("\"Example GmbH\""));
        assert!(csv.contains("\"Net (€)\""));
        assert!(csv.contains("\"Total Revenue\";\"100.00\""));
    }
}
