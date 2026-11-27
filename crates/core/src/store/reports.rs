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

impl Report {
    /// CSV of the report table and the period totals.
    ///
    /// The columns match the other exports of the suite (`;` separated, English snake_case
    /// headers), and the money values are decimal strings without a currency symbol, so the file
    /// opens in every spreadsheet without a locale guess.
    pub fn to_csv(&self) -> String {
        let mut text = String::from("number;contact;status;issued_at;net;tax;gross;minutes\n");
        for row in &self.rows {
            let (year, month, day) = crate::date::civil_from_millis(row.issued_at);
            text.push_str(&format!(
                "{};{};{};{year:04}-{month:02}-{day:02};{};{};{};\n",
                csv_field(&row.number),
                csv_field(&row.contact),
                row.status.as_str(),
                decimal(row.net.cents()),
                decimal(row.tax.cents()),
                decimal(row.gross.cents()),
            ));
        }
        text.push_str(&format!(
            "summary;;;;{};{};{};{}\n",
            decimal(self.summary.net.cents()),
            decimal(self.summary.tax.cents()),
            decimal(self.summary.gross.cents()),
            self.summary.minutes,
        ));
        text
    }

    /// A4 PDF with the period totals and the invoice table.
    pub fn to_pdf(&self, title: &str) -> Vec<u8> {
        use crate::pdf::writer::Document;

        let mut document = Document::new(title);
        let mut distance = 25.0_f64;
        line(&mut document, &mut distance, title, 14.0, true);
        line(
            &mut document,
            &mut distance,
            &format!(
                "{} - {}",
                iso_date(self.from),
                iso_date(self.to.saturating_sub(1))
            ),
            9.0,
            false,
        );
        distance += 2.0;
        line(
            &mut document,
            &mut distance,
            &format!(
                "invoices: {}  net: {}  tax: {}  gross: {}  paid: {}  open: {}  hours: {:.2}",
                self.summary.invoices,
                decimal(self.summary.net.cents()),
                decimal(self.summary.tax.cents()),
                decimal(self.summary.gross.cents()),
                decimal(self.summary.paid.cents()),
                decimal(self.summary.open.cents()),
                self.summary.minutes as f64 / 60.0,
            ),
            9.0,
            false,
        );
        distance += 4.0;
        line(
            &mut document,
            &mut distance,
            "number   contact   status   date   net   tax   gross",
            8.0,
            true,
        );
        for row in &self.rows {
            let text = format!(
                "{}   {}   {}   {}   {}   {}   {}",
                row.number,
                row.contact,
                row.status.as_str(),
                iso_date(row.issued_at),
                decimal(row.net.cents()),
                decimal(row.tax.cents()),
                decimal(row.gross.cents()),
            );
            line(&mut document, &mut distance, &text, 8.0, false);
        }
        document.to_bytes()
    }
}

/// One text line of the report PDF, with a page break before the footer margin.
fn line(
    document: &mut crate::pdf::writer::Document,
    distance: &mut f64,
    text: &str,
    size: f64,
    bold: bool,
) {
    use crate::pdf::writer::mm;
    if *distance > 275.0 {
        document.new_page();
        *distance = 25.0;
    }
    let page = document.page_mut();
    let y = mm(297.0 - *distance);
    if bold {
        page.text_bold(mm(20.0), y, size, text);
    } else {
        page.text(mm(20.0), y, size, text);
    }
    *distance += 6.0;
}

fn iso_date(millis: i64) -> String {
    let (year, month, day) = crate::date::civil_from_millis(millis);
    format!("{year:04}-{month:02}-{day:02}")
}

fn decimal(cents: i64) -> String {
    format!("{:.2}", cents as f64 / 100.0)
}

/// Quotes a CSV field when it contains the separator, a quote or a line break.
fn csv_field(value: &str) -> String {
    if value.contains(';') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
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
    fn exports_the_report_as_csv_and_pdf() {
        let rows = vec![row(InvoiceStatus::Paid, 100_000)];
        let report = Report {
            from: NOW,
            to: NOW + DAY,
            summary: summarize(&rows, 90),
            status_totals: status_totals(&rows),
            rows,
        };

        let csv = report.to_csv();
        assert!(csv.starts_with("number;contact;status;issued_at;net;tax;gross;minutes\n"));
        assert!(csv.contains("RE-1;Muster GmbH;paid;"));
        assert!(csv.contains("1000.00"));
        assert!(csv.contains("summary;;;;"));
        assert!(csv.contains("90"));

        let pdf = report.to_pdf("Report");
        assert!(pdf.starts_with(b"%PDF"), "the export must be a PDF file");
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
