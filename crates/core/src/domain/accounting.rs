//! Accounting: journal entries, the BWA summary, the cash book and CSV export.
//!
//! All amounts are net; [`JournalEntry::tax`] and [`JournalEntry::gross`] derive the tax and the
//! gross amount from the stored rate. [`summarize`] groups the entries by account for the BWA,
//! [`cash_book`] filters the cash channel and keeps a running balance, and [`export_csv`] serialises
//! entries with RFC 4180 quoting so spreadsheet tools read the result unchanged.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::date;
use crate::money::Money;

/// Direction of a journal entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JournalKind {
    /// Revenue.
    Income,
    /// Expense.
    Expense,
}

impl JournalKind {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            JournalKind::Income => "income",
            JournalKind::Expense => "expense",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "income" => Some(JournalKind::Income),
            "expense" => Some(JournalKind::Expense),
            _ => None,
        }
    }
}

/// Account the money moved through.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookingChannel {
    /// Bank account.
    Bank,
    /// Cash register.
    Cash,
}

impl BookingChannel {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            BookingChannel::Bank => "bank",
            BookingChannel::Cash => "cash",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "bank" => Some(BookingChannel::Bank),
            "cash" => Some(BookingChannel::Cash),
            _ => None,
        }
    }
}

/// One booking of the journal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JournalEntry {
    /// Stable identifier.
    pub id: Uuid,
    /// Booking date in milliseconds since the Unix epoch.
    pub booked_at: i64,
    /// Description shown in the journal and the BWA.
    pub description: String,
    /// Account the entry is booked on.
    pub account: String,
    /// Counter account.
    pub counter_account: String,
    /// Net amount, always positive; [`JournalEntry::kind`] gives the direction.
    pub amount: Money,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
    /// Revenue or expense.
    pub kind: JournalKind,
    /// Bank or cash.
    pub channel: BookingChannel,
    /// Optional reference, for example an invoice number.
    pub reference: Option<String>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl JournalEntry {
    /// Creates an empty income entry booked on the bank account.
    pub fn new(now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            booked_at: now,
            description: String::new(),
            account: String::new(),
            counter_account: String::new(),
            amount: Money::ZERO,
            tax_rate_bp: 1900,
            kind: JournalKind::Income,
            channel: BookingChannel::Bank,
            reference: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Tax amount of the entry.
    pub fn tax(&self) -> Money {
        self.amount.tax(self.tax_rate_bp)
    }

    /// Net plus tax.
    pub fn gross(&self) -> Money {
        self.amount + self.tax()
    }

    /// Net amount with the sign of the entry: positive for revenue, negative for expenses.
    pub fn signed_net(&self) -> Money {
        match self.kind {
            JournalKind::Income => self.amount,
            JournalKind::Expense => Money::from_cents(-self.amount.cents()),
        }
    }

    /// Gross amount with the sign of the entry.
    pub fn signed_gross(&self) -> Money {
        match self.kind {
            JournalKind::Income => self.gross(),
            JournalKind::Expense => Money::from_cents(-self.gross().cents()),
        }
    }

    /// Validates the entry before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("description_required".to_string());
        }
        if self.account.trim().is_empty() {
            return Err("account_required".to_string());
        }
        if self.counter_account.trim().is_empty() {
            return Err("counter_account_required".to_string());
        }
        if self.amount.cents() <= 0 {
            return Err("amount_not_positive".to_string());
        }
        if !(0..=10_000).contains(&self.tax_rate_bp) {
            return Err("tax_rate_out_of_range".to_string());
        }
        Ok(())
    }
}

/// One account line of the BWA.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BwaRow {
    /// Account name.
    pub account: String,
    /// Revenue booked on the account.
    pub revenue: Money,
    /// Expenses booked on the account.
    pub expense: Money,
}

impl BwaRow {
    /// Revenue minus expenses.
    pub fn result(&self) -> Money {
        Money::from_cents(self.revenue.cents() - self.expense.cents())
    }
}

/// Totals and account rows of the BWA for a period.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct JournalSummary {
    /// One row per account, sorted by account name.
    pub rows: Vec<BwaRow>,
    /// Net revenue of all income entries.
    pub revenue_net: Money,
    /// Net expenses of all expense entries.
    pub expense_net: Money,
    /// Tax collected on revenue.
    pub tax_collected: Money,
    /// Tax paid on expenses.
    pub tax_paid: Money,
}

impl JournalSummary {
    /// Net revenue minus net expenses.
    pub fn result(&self) -> Money {
        Money::from_cents(self.revenue_net.cents() - self.expense_net.cents())
    }

    /// Collected minus paid tax.
    pub fn tax_balance(&self) -> Money {
        Money::from_cents(self.tax_collected.cents() - self.tax_paid.cents())
    }
}

/// Summarises entries for the BWA, grouping by account.
pub fn summarize(entries: &[JournalEntry]) -> JournalSummary {
    let mut accounts: BTreeMap<String, (Money, Money)> = BTreeMap::new();
    let mut summary = JournalSummary::default();

    for entry in entries {
        let slot = accounts
            .entry(entry.account.clone())
            .or_insert((Money::ZERO, Money::ZERO));
        match entry.kind {
            JournalKind::Income => {
                summary.revenue_net = summary.revenue_net + entry.amount;
                summary.tax_collected = summary.tax_collected + entry.tax();
                slot.0 = slot.0 + entry.amount;
            }
            JournalKind::Expense => {
                summary.expense_net = summary.expense_net + entry.amount;
                summary.tax_paid = summary.tax_paid + entry.tax();
                slot.1 = slot.1 + entry.amount;
            }
        }
    }

    summary.rows = accounts
        .into_iter()
        .map(|(account, (revenue, expense))| BwaRow {
            account,
            revenue,
            expense,
        })
        .collect();
    summary
}

/// One line of the cash book with the balance after the entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CashBookRow {
    /// The cash entry.
    pub entry: JournalEntry,
    /// Cash balance after booking the entry, based on gross amounts.
    pub balance: Money,
}

/// Builds the cash book from all entries: only cash bookings, oldest first, with a running balance.
pub fn cash_book(entries: &[JournalEntry]) -> Vec<CashBookRow> {
    let mut cash: Vec<&JournalEntry> = entries
        .iter()
        .filter(|entry| entry.channel == BookingChannel::Cash)
        .collect();
    cash.sort_by_key(|entry| (entry.booked_at, entry.created_at));

    let mut balance = Money::ZERO;
    cash.into_iter()
        .map(|entry| {
            balance = Money::from_cents(balance.cents() + entry.signed_gross().cents());
            CashBookRow {
                entry: entry.clone(),
                balance,
            }
        })
        .collect()
}

/// Columns written by [`export_csv`].
pub const JOURNAL_HEADERS: [&str; 9] = [
    "booked_at",
    "description",
    "account",
    "counter_account",
    "kind",
    "channel",
    "amount",
    "tax_rate",
    "reference",
];

/// Serialises entries as CSV with a header row, oldest first.
pub fn export_csv(entries: &[JournalEntry]) -> String {
    let mut sorted: Vec<&JournalEntry> = entries.iter().collect();
    sorted.sort_by_key(|entry| (entry.booked_at, entry.created_at));

    let mut out = JOURNAL_HEADERS.join(",");
    out.push('\n');
    for entry in sorted {
        let (year, month, day) = date::civil_from_millis(entry.booked_at);
        let fields = [
            format!("{year:04}-{month:02}-{day:02}"),
            entry.description.clone(),
            entry.account.clone(),
            entry.counter_account.clone(),
            entry.kind.as_str().to_string(),
            entry.channel.as_str().to_string(),
            entry.amount.to_decimal_string(),
            format!("{}", entry.tax_rate_bp as f64 / 100.0),
            entry.reference.clone().unwrap_or_default(),
        ];
        let line: Vec<String> = fields.iter().map(|field| csv_field(field)).collect();
        out.push_str(&line.join(","));
        out.push('\n');
    }
    out
}

fn csv_field(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(
        description: &str,
        account: &str,
        amount_cents: i64,
        tax_rate_bp: i64,
        kind: JournalKind,
        channel: BookingChannel,
        booked_at: i64,
    ) -> JournalEntry {
        let mut entry = JournalEntry::new(booked_at);
        entry.description = description.to_string();
        entry.account = account.to_string();
        entry.counter_account = "Bank".to_string();
        entry.amount = Money::from_cents(amount_cents);
        entry.tax_rate_bp = tax_rate_bp;
        entry.kind = kind;
        entry.channel = channel;
        entry
    }

    #[test]
    fn computes_tax_gross_and_signed_amounts() {
        let income = entry(
            "Rechnung",
            "Erlöse",
            10_000,
            1900,
            JournalKind::Income,
            BookingChannel::Bank,
            0,
        );
        assert_eq!(income.tax(), Money::from_cents(1_900));
        assert_eq!(income.gross(), Money::from_cents(11_900));
        assert_eq!(income.signed_net(), Money::from_cents(10_000));

        let expense = entry(
            "Material",
            "Material",
            5_000,
            700,
            JournalKind::Expense,
            BookingChannel::Cash,
            0,
        );
        assert_eq!(expense.signed_net(), Money::from_cents(-5_000));
        assert_eq!(expense.signed_gross(), Money::from_cents(-5_350));
    }

    #[test]
    fn validates_required_fields() {
        let mut entry = JournalEntry::new(0);
        assert_eq!(entry.validate(), Err("description_required".to_string()));
        entry.description = "Miete".to_string();
        assert_eq!(entry.validate(), Err("account_required".to_string()));
        entry.account = "Miete".to_string();
        assert_eq!(
            entry.validate(),
            Err("counter_account_required".to_string())
        );
        entry.counter_account = "Bank".to_string();
        assert_eq!(entry.validate(), Err("amount_not_positive".to_string()));
        entry.amount = Money::from_cents(100);
        entry.tax_rate_bp = 20_000;
        assert_eq!(entry.validate(), Err("tax_rate_out_of_range".to_string()));
        entry.tax_rate_bp = 1900;
        assert_eq!(entry.validate(), Ok(()));
    }

    #[test]
    fn summarises_revenue_expenses_and_tax() {
        let entries = vec![
            entry(
                "Rechnung",
                "Erlöse",
                20_000,
                1900,
                JournalKind::Income,
                BookingChannel::Bank,
                1,
            ),
            entry(
                "Barverkauf",
                "Erlöse",
                10_000,
                700,
                JournalKind::Income,
                BookingChannel::Cash,
                2,
            ),
            entry(
                "Material",
                "Material",
                5_000,
                1900,
                JournalKind::Expense,
                BookingChannel::Bank,
                3,
            ),
        ];
        let summary = summarize(&entries);
        assert_eq!(summary.revenue_net, Money::from_cents(30_000));
        assert_eq!(summary.expense_net, Money::from_cents(5_000));
        assert_eq!(summary.result(), Money::from_cents(25_000));
        assert_eq!(summary.tax_collected, Money::from_cents(4_500));
        assert_eq!(summary.tax_paid, Money::from_cents(950));
        assert_eq!(summary.tax_balance(), Money::from_cents(3_550));
        assert_eq!(summary.rows.len(), 2);
        assert_eq!(summary.rows[0].account, "Erlöse");
        assert_eq!(summary.rows[0].result(), Money::from_cents(30_000));
        assert_eq!(summary.rows[1].result(), Money::from_cents(-5_000));
    }

    #[test]
    fn builds_the_cash_book_with_a_running_balance() {
        let entries = vec![
            entry(
                "Barverkauf",
                "Erlöse",
                10_000,
                700,
                JournalKind::Income,
                BookingChannel::Cash,
                2,
            ),
            entry(
                "Bank",
                "Erlöse",
                99_000,
                1900,
                JournalKind::Income,
                BookingChannel::Bank,
                3,
            ),
            entry(
                "Miete",
                "Miete",
                4_000,
                0,
                JournalKind::Expense,
                BookingChannel::Cash,
                1,
            ),
        ];
        let book = cash_book(&entries);
        assert_eq!(book.len(), 2);
        assert_eq!(book[0].entry.description, "Miete");
        assert_eq!(book[0].balance, Money::from_cents(-4_000));
        assert_eq!(book[1].balance, Money::from_cents(6_700));
    }

    #[test]
    fn exports_sorted_csv_with_quoting() {
        let mut entries = vec![
            entry(
                "Material, gross",
                "Material",
                5_000,
                1900,
                JournalKind::Expense,
                BookingChannel::Bank,
                2,
            ),
            entry(
                "Rechnung \"2026-0001\"",
                "Erlöse",
                10_000,
                1900,
                JournalKind::Income,
                BookingChannel::Bank,
                1,
            ),
        ];
        entries[0].reference = Some("2026-0001".to_string());
        let csv = export_csv(&entries);
        let lines: Vec<&str> = csv.lines().collect();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], JOURNAL_HEADERS.join(","));
        assert!(lines[1].starts_with("1970-01-01,\"Rechnung \"\"2026-0001\"\"\""));
        assert!(lines[2].contains("\"Material, gross\""));
        assert!(lines[2].ends_with("2026-0001"));
    }
}
