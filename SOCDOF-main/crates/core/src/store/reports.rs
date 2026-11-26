//! Reporting over invoices and tracked working time.
//!
//! A report is a pure value: [`load`] gathers the invoices of a period with their contact names and
//! totals, adds the tracked minutes of the same period from the support time entries, and returns a
//! [`Report`]. All arithmetic happens here in the core, so the screen only formats what it gets and
//! the numbers of the report cannot drift from the invoices or the time entries.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::domain::invoice::InvoiceStatus;
use crate::error::CoreResult;
use crate::money::Money;
use crate::store::{contacts, invoices, support};

/// One invoice of the report table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReportRow {
    /// Human readable invoice number.
    pub number: String,
    /// Display name of the billed contact.
    pub contact: String,
    /// Lifecycle state of the invoice.
    pub status: InvoiceStatus,
    /// Issue date in milliseconds since the Unix epoch.
    pub issued_at: i64,
    /// Net total over all positions.
    pub net: Money,
    /// Tax total over all positions.
    pub tax: Money,
    /// Gross total over all positions.
    pub gross: Money,
}

/// Totals of one reporting period.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ReportSummary {
    /// Number of invoices in the period.
    pub invoices: i64,
    /// Sum of the net totals.
    pub net: Money,
    /// Sum of the tax totals.
    pub tax: Money,
    /// Sum of the gross totals.
    pub gross: Money,
    /// Share of the gross total that is already paid.
    pub paid: Money,
    /// Share of the gross total that is sent or overdue.
    pub open: Money,
    /// Tracked working minutes in the period.
    pub minutes: i64,
}

/// A complete report for one half-open period `[from, to)`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Report {
    /// Start of the period in milliseconds since the Unix epoch.
    pub from: i64,
    /// End of the period in milliseconds since the Unix epoch.
    pub to: i64,
    /// Invoices of the period, oldest first.
    pub rows: Vec<ReportRow>,
    /// Totals of the period.
    pub summary: ReportSummary,
    /// Gross total per invoice state, in [`InvoiceStatus::ALL`] order.
    pub status_totals: [Money; 5],
}

/// Every invoice state in report order, used for the per-state totals.
pub const STATUS_ORDER: [InvoiceStatus; 5] = [
    InvoiceStatus::Draft,
    InvoiceStatus::Sent,
    InvoiceStatus::Paid,
    InvoiceStatus::Overdue,
    InvoiceStatus::Cancelled,
];

/// Position of a state in [`STATUS_ORDER`].
pub fn status_index(status: InvoiceStatus) -> usize {
    STATUS_ORDER
        .iter()
        .position(|candidate| *candidate == status)
        .unwrap_or(0)
}

/// Gathers the report of the half-open period `[from, to)`.
pub fn load(conn: &Connection, from: i64, to: i64) -> CoreResult<Report> {
    let mut rows = Vec::new();
    for invoice in invoices::list(conn)? {
        if invoice.issued_at < from || invoice.issued_at >= to {
            continue;
        }
        let contact = contacts::find(conn, invoice.contact_id)?
            .map(|contact| contact.display_name())
            .unwrap_or_default();
        let net = invoice.total_net();
        let tax = invoice.total_tax();
        let gross = invoice.total_gross();
        rows.push(ReportRow {
            number: invoice.number,
            contact,
            status: invoice.status,
            issued_at: invoice.issued_at,
            net,
            tax,
            gross,
        });
    }
    rows.sort_by(|left, right| {
        left.issued_at
            .cmp(&right.issued_at)
            .then_with(|| left.number.cmp(&right.number))
    });

    let minutes = support::list_time_entries_between(conn, from, to)?
        .into_iter()
        .map(|entry| entry.minutes)
        .sum();

    Ok(Report {
        from,
        to,
        summary: summarize(&rows, minutes),
        status_totals: status_totals(&rows),
        rows,
    })
}

/// Adds up a table of invoices and the tracked minutes of the same period.
pub fn summarize(rows: &[ReportRow], minutes: i64) -> ReportSummary {
    let mut summary = ReportSummary {
        invoices: rows.len() as i64,
        minutes,
        ..ReportSummary::default()
    };

    for row in rows {
        summary.net = summary.net + row.net;
        summary.tax = summary.tax + row.tax;
        summary.gross = summary.gross + row.gross;
        match row.status {
            InvoiceStatus::Paid => summary.paid = summary.paid + row.gross,
            InvoiceStatus::Sent | InvoiceStatus::Overdue => summary.open = summary.open + row.gross,
            InvoiceStatus::Draft | InvoiceStatus::Cancelled => {}
        }
    }

    summary
}

/// Gross total per invoice state, in [`InvoiceStatus::ALL`] order.
pub fn status_totals(rows: &[ReportRow]) -> [Money; 5] {
    let mut totals = [Money::ZERO; 5];
    for row in rows {
        totals[status_index(row.status)] = totals[status_index(row.status)] + row.gross;
    }
    totals
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;

    const NOW: i64 = 1_760_000_000_000;
    const DAY: i64 = 86_400_000;

    fn row(status: InvoiceStatus, cents: i64) -> ReportRow {
        ReportRow {
            number: "RE-1".to_string(),
            contact: "Muster GmbH".to_string(),
            status,
            issued_at: NOW,
            net: Money::from_cents(cents),
            tax: Money::ZERO,
            gross: Money::from_cents(cents),
        }
    }

    #[test]
    fn summarize_splits_paid_open_and_ignored_states() {
        let rows = vec![
            row(InvoiceStatus::Paid, 100_000),
            row(InvoiceStatus::Sent, 60_000),
            row(InvoiceStatus::Overdue, 10_000),
            row(InvoiceStatus::Draft, 30_000),
            row(InvoiceStatus::Cancelled, 5_000),
        ];

        let summary = summarize(&rows, 45);
        assert_eq!(summary.invoices, 5);
        assert_eq!(summary.gross, Money::from_cents(205_000));
        assert_eq!(summary.paid, Money::from_cents(100_000));
        assert_eq!(summary.open, Money::from_cents(70_000));
        assert_eq!(summary.minutes, 45);

        let totals = status_totals(&rows);
        assert_eq!(totals[0], Money::from_cents(30_000));
        assert_eq!(totals[2], Money::from_cents(100_000));
        assert_eq!(totals[3], Money::from_cents(10_000));
    }

    #[test]
    fn an_empty_period_reports_zero() {
        let store = Store::open_in_memory().expect("store");
        let report = store.report(NOW, NOW + DAY).expect("report");
        assert!(report.rows.is_empty());
        assert_eq!(report.summary, ReportSummary::default());
        assert_eq!(report.status_totals, [Money::ZERO; 5]);
    }

    #[test]
    fn status_index_covers_every_state() {
        let mut seen = [false; 5];
        for status in STATUS_ORDER {
            seen[status_index(status)] = true;
        }
        assert!(seen.iter().all(|flag| *flag));
    }
}
