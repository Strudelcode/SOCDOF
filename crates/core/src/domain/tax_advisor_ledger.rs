//! Monthly tax-advisor cash/bank ledger and Excel SpreadsheetML export.
//!
//! The report is a read-only projection of persisted cash movements. Invoice revenue is included
//! only when a payment record exists, POS receipts use their recorded tender, non-draft purchases
//! mirror the legacy manager, journal entries supply manual cash/bank bookings, and business fleet
//! trips use the configured mileage allowance. No source record is changed.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::date;
use crate::domain::accounting::{BookingChannel, JournalEntry, JournalKind};
use crate::domain::billing::BillingItem;
use crate::domain::invoice::{Invoice, InvoiceStatus};
use crate::domain::payment::{InvoicePayment, PaymentMethod};
use crate::domain::pos::{PaymentMethod as PosPaymentMethod, PosOrder};
use crate::domain::purchase::{PurchaseOrder, PurchaseOrderStatus};
use crate::money::Money;

/// Direction of one cash-book transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LedgerKind {
    /// Money received.
    Income,
    /// Money spent.
    Expense,
}

/// Account receiving or paying the transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LedgerChannel {
    /// Physical cash register.
    Cash,
    /// Bank account or card settlement.
    Bank,
}

/// One normalized transaction in the monthly ledger.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LedgerTransaction {
    /// Transaction date in YYYY-MM-DD.
    pub date: String,
    /// Description printed in the ledger.
    pub description: String,
    /// Positive amount; direction is stored separately.
    pub amount: Money,
    /// Income or expense.
    pub kind: LedgerKind,
    /// Cash or bank.
    pub channel: LedgerChannel,
}

impl LedgerTransaction {
    fn new(
        timestamp: i64,
        description: String,
        amount: Money,
        kind: LedgerKind,
        channel: LedgerChannel,
    ) -> Self {
        Self {
            date: date::format_iso8601(timestamp)[..10].to_string(),
            description,
            amount: Money::from_cents(amount.cents().abs()),
            kind,
            channel,
        }
    }
}

/// All totals and transactions for one calendar month.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MonthlyLedgerData {
    /// Zero-based month number.
    pub month: usize,
    /// Localized month name.
    pub month_name: String,
    /// Calendar year.
    pub year: i32,
    /// Cash balance carried into the month.
    pub carry_over_cash: Money,
    /// Bank balance carried into the month.
    pub carry_over_bank: Money,
    /// Cash income in the month.
    pub income_cash: Money,
    /// Bank income in the month.
    pub income_bank: Money,
    /// Cash expenses in the month.
    pub expense_cash: Money,
    /// Bank expenses in the month.
    pub expense_bank: Money,
    /// Cash balance at month end.
    pub current_balance_cash: Money,
    /// Bank balance at month end.
    pub current_balance_bank: Money,
    /// Ordered transactions for the month.
    pub transactions: Vec<LedgerTransaction>,
}

impl MonthlyLedgerData {
    /// Combined carry-over balance.
    pub fn carry_over_total(&self) -> Money {
        self.carry_over_cash + self.carry_over_bank
    }

    /// Total income for the month.
    pub fn total_income(&self) -> Money {
        self.income_cash + self.income_bank
    }

    /// Total expenses for the month.
    pub fn total_expense(&self) -> Money {
        self.expense_cash + self.expense_bank
    }

    /// Combined month-end balance.
    pub fn current_balance_total(&self) -> Money {
        self.current_balance_cash + self.current_balance_bank
    }
}

/// Builds normalized ledger transactions from persisted SOCDOF modules.
///
/// Practice billable items are included before invoices; linked invoices are skipped to prevent
/// double counting. Unpaid invoices without a practice billing item are excluded as receivables.
/// Purchases in every state except Draft match the legacy tax-advisor ledger behavior.
pub fn build_tax_advisor_transactions(
    invoices: &[Invoice],
    payments: &[InvoicePayment],
    purchases: &[PurchaseOrder],
    pos_orders: &[PosOrder],
    journal_entries: &[JournalEntry],
    billing_items: &[BillingItem],
) -> Vec<LedgerTransaction> {
    let payments_by_invoice: HashMap<Uuid, &InvoicePayment> =
        payments.iter().map(|payment| (payment.invoice_id, payment)).collect();
    let mut represented_invoices = HashSet::new();
    let mut transactions = Vec::new();

    // Legacy practice billings are inserted before invoices; an invoice already represented by
    // one or more billable positions is skipped to prevent the same service being counted twice.
    for item in billing_items {
        if let Some(invoice_id) = item.invoice_id {
            represented_invoices.insert(invoice_id);
        }
        if item.gross().cents() > 0 {
            transactions.push(LedgerTransaction::new(
                item.service_date,
                format!("Praxis-Honorar – {}", item.description),
                item.gross(),
                LedgerKind::Income,
                LedgerChannel::Bank,
            ));
        }
    }

    for invoice in invoices
        .iter()
        .filter(|invoice| {
            invoice.status == InvoiceStatus::Paid && !represented_invoices.contains(&invoice.id)
        })
    {
        let Some(payment) = payments_by_invoice.get(&invoice.id) else {
            continue;
        };
        let channel = match payment.method {
            PaymentMethod::Cash => LedgerChannel::Cash,
            PaymentMethod::Transfer | PaymentMethod::Card => LedgerChannel::Bank,
        };
        transactions.push(LedgerTransaction::new(
            payment.paid_at,
            format!("Rechnung {}", invoice.number),
            invoice.total_gross(),
            LedgerKind::Income,
            channel,
        ));
    }

    for order in pos_orders {
        let channel = match order.payment_method {
            PosPaymentMethod::Cash => LedgerChannel::Cash,
            PosPaymentMethod::Card
            | PosPaymentMethod::Nfc
            | PosPaymentMethod::BankTransfer
            | PosPaymentMethod::Invoice
            | PosPaymentMethod::Other => LedgerChannel::Bank,
        };
        transactions.push(LedgerTransaction::new(
            order.paid_at,
            format!("POS {}", order.receipt_number),
            order.total_gross(),
            LedgerKind::Income,
            channel,
        ));
    }

    for purchase in purchases
        .iter()
        .filter(|purchase| purchase.status != PurchaseOrderStatus::Draft)
    {
        transactions.push(LedgerTransaction::new(
            purchase.order_date,
            format!("Einkauf {}", purchase.number),
            purchase.total_gross(),
            LedgerKind::Expense,
            LedgerChannel::Bank,
        ));
    }

    for entry in journal_entries {
        transactions.push(LedgerTransaction::new(
            entry.booked_at,
            entry.description.clone(),
            entry.gross(),
            match entry.kind {
                JournalKind::Income => LedgerKind::Income,
                JournalKind::Expense => LedgerKind::Expense,
            },
            match entry.channel {
                BookingChannel::Cash => LedgerChannel::Cash,
                BookingChannel::Bank => LedgerChannel::Bank,
            },
        ));
    }

    transactions.sort_by(|left, right| {
        left.date
            .cmp(&right.date)
            .then_with(|| left.description.cmp(&right.description))
    });
    transactions
}

/// Builds twelve monthly ledgers with sequential cash and bank carry-over.
pub fn build_yearly_ledger(
    year: i32,
    transactions: &[LedgerTransaction],
    month_names: &[String],
    initial_cash: Money,
    initial_bank: Money,
) -> Vec<MonthlyLedgerData> {
    let mut cash_balance = initial_cash;
    let mut bank_balance = initial_bank;
    let mut months = Vec::with_capacity(12);

    for month in 0..12 {
        let prefix = format!("{year:04}-{:02}-", month + 1);
        let mut month_transactions: Vec<_> = transactions
            .iter()
            .filter(|transaction| transaction.date.starts_with(&prefix))
            .cloned()
            .collect();
        month_transactions.sort_by(|left, right| {
            left.date
                .cmp(&right.date)
                .then_with(|| left.description.cmp(&right.description))
        });

        let carry_over_cash = cash_balance;
        let carry_over_bank = bank_balance;
        let mut income_cash = Money::ZERO;
        let mut income_bank = Money::ZERO;
        let mut expense_cash = Money::ZERO;
        let mut expense_bank = Money::ZERO;

        for transaction in &month_transactions {
            match (transaction.kind, transaction.channel) {
                (LedgerKind::Income, LedgerChannel::Cash) => {
                    income_cash = income_cash + transaction.amount;
                }
                (LedgerKind::Income, LedgerChannel::Bank) => {
                    income_bank = income_bank + transaction.amount;
                }
                (LedgerKind::Expense, LedgerChannel::Cash) => {
                    expense_cash = expense_cash + transaction.amount;
                }
                (LedgerKind::Expense, LedgerChannel::Bank) => {
                    expense_bank = expense_bank + transaction.amount;
                }
            }
        }

        cash_balance = Money::from_cents(
            carry_over_cash.cents() + income_cash.cents() - expense_cash.cents(),
        );
        bank_balance = Money::from_cents(
            carry_over_bank.cents() + income_bank.cents() - expense_bank.cents(),
        );

        months.push(MonthlyLedgerData {
            month,
            month_name: month_names
                .get(month)
                .cloned()
                .unwrap_or_else(|| format!("Month {}", month + 1)),
            year,
            carry_over_cash,
            carry_over_bank,
            income_cash,
            income_bank,
            expense_cash,
            expense_bank,
            current_balance_cash: cash_balance,
            current_balance_bank: bank_balance,
            transactions: month_transactions,
        });
    }

    months
}

/// Exports the twelve monthly sheets as Excel-compatible SpreadsheetML (.xls).
pub fn export_tax_advisor_excel_xml(
    year: i32,
    owner_name: &str,
    currency: &str,
    months: &[MonthlyLedgerData],
) -> String {
    let owner = if owner_name.trim().is_empty() {
        "Praxis"
    } else {
        owner_name.trim()
    };
    let title = format!("Ein- und Ausgaben – {owner}");
    let mut worksheets = String::new();

    for (month_index, month) in months.iter().enumerate() {
        let mut rows = String::new();
        let transaction_rows = 50_usize.max(month.transactions.len() + 15);
        let last_row = 10 + transaction_rows;

        push_text_row(&mut rows, &title, "MainTitle", 6);
        push_text_row(&mut rows, "K = Kassa, B = Bank", "LegendCell", 6);
        push_row(
            &mut rows,
            &[
                ("Zeitraum:", "String", ""),
                (&format!("{} {}", month.month_name, year), "String", ""),
            ],
        );
        push_row(
            &mut rows,
            &[
                ("Übersicht", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                ("Kassa", "String", ""),
                ("Bank", "String", ""),
                ("Gesamt", "String", ""),
            ],
        );

        if month_index == 0 {
            push_row_with_formulas(
                &mut rows,
                &[
                    ("Übertrag Vormonat", "String", ""),
                    ("", "String", ""),
                    ("", "String", ""),
                    ("", "String", ""),
                    (
                        &month.carry_over_cash.to_decimal_string(),
                        "Number",
                        &month.carry_over_cash.to_decimal_string(),
                    ),
                    (
                        &month.carry_over_bank.to_decimal_string(),
                        "Number",
                        &month.carry_over_bank.to_decimal_string(),
                    ),
                    (
                        &month.carry_over_total().to_decimal_string(),
                        "Formula",
                        "=RC[-2]+RC[-1]",
                    ),
                ],
            );
        } else {
            let previous_sheet = months[month_index - 1].month_name.replace('\'', "''");
            let cash_formula = format!("=&apos;{previous_sheet}&apos;!R8C5");
            let bank_formula = format!("=&apos;{previous_sheet}&apos;!R8C6");
            push_row_with_formulas(
                &mut rows,
                &[
                    ("Übertrag Vormonat", "String", ""),
                    ("", "String", ""),
                    ("", "String", ""),
                    ("", "String", ""),
                    (
                        &month.carry_over_cash.to_decimal_string(),
                        "Formula",
                        &cash_formula,
                    ),
                    (
                        &month.carry_over_bank.to_decimal_string(),
                        "Formula",
                        &bank_formula,
                    ),
                    (
                        &month.carry_over_total().to_decimal_string(),
                        "Formula",
                        "=RC[-2]+RC[-1]",
                    ),
                ],
            );
        }

        let income_cash_formula = format!(
            "=SUMIF(R11C2:R{last_row}C2,&quot;K*&quot;,R11C5:R{last_row}C5)"
        );
        let income_bank_formula = format!(
            "=SUMIF(R11C2:R{last_row}C2,&quot;B*&quot;,R11C5:R{last_row}C5)"
        );
        push_row_with_formulas(
            &mut rows,
            &[
                ("Summe Einnahmen", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                (
                    &month.income_cash.to_decimal_string(),
                    "Formula",
                    &income_cash_formula,
                ),
                (
                    &month.income_bank.to_decimal_string(),
                    "Formula",
                    &income_bank_formula,
                ),
                (
                    &month.total_income().to_decimal_string(),
                    "Formula",
                    "=RC[-2]+RC[-1]",
                ),
            ],
        );

        let expense_cash_formula = format!(
            "=SUMIF(R11C2:R{last_row}C2,&quot;K*&quot;,R11C6:R{last_row}C6)"
        );
        let expense_bank_formula = format!(
            "=SUMIF(R11C2:R{last_row}C2,&quot;B*&quot;,R11C6:R{last_row}C6)"
        );
        push_row_with_formulas(
            &mut rows,
            &[
                ("Summe Ausgaben", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                (
                    &month.expense_cash.to_decimal_string(),
                    "Formula",
                    &expense_cash_formula,
                ),
                (
                    &month.expense_bank.to_decimal_string(),
                    "Formula",
                    &expense_bank_formula,
                ),
                (
                    &month.total_expense().to_decimal_string(),
                    "Formula",
                    "=RC[-2]+RC[-1]",
                ),
            ],
        );

        push_row_with_formulas(
            &mut rows,
            &[
                ("Aktueller Kassastand", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                ("", "String", ""),
                (
                    &month.current_balance_cash.to_decimal_string(),
                    "Formula",
                    "=R5C5+R6C5-R7C5",
                ),
                (
                    &month.current_balance_bank.to_decimal_string(),
                    "Formula",
                    "=R5C6+R6C6-R7C6",
                ),
                (
                    &month.current_balance_total().to_decimal_string(),
                    "Formula",
                    "=RC[-2]+RC[-1]",
                ),
            ],
        );
        rows.push_str("<Row ss:Height=\"12\"/>");
        push_row(
            &mut rows,
            &[
                ("Nr.", "String", ""),
                ("Kassa/Bank", "String", ""),
                ("Datum", "String", ""),
                ("Beschreibung", "String", ""),
                ("Einnahmen", "String", ""),
                ("Ausgaben", "String", ""),
                ("Saldo", "String", ""),
            ],
        );

        let mut running_balance = month.carry_over_total();
        for row_index in 1..=transaction_rows {
            let zebra = row_index % 2 == 0;
            let center_style = if zebra { "GridCenterZebra" } else { "GridCenter" };
            let left_style = if zebra { "GridLeftZebra" } else { "GridLeft" };
            let money_style = if zebra { "GridCurrencyZebra" } else { "GridCurrency" };

            if let Some(transaction) = month.transactions.get(row_index - 1) {
                let method = match transaction.channel {
                    LedgerChannel::Cash => "K",
                    LedgerChannel::Bank => "B",
                };
                let date = format_short_date(&transaction.date);
                let income = if transaction.kind == LedgerKind::Income {
                    transaction.amount.to_decimal_string()
                } else {
                    String::new()
                };
                let expense = if transaction.kind == LedgerKind::Expense {
                    transaction.amount.to_decimal_string()
                } else {
                    String::new()
                };
                running_balance = match transaction.kind {
                    LedgerKind::Income => {
                        Money::from_cents(running_balance.cents() + transaction.amount.cents())
                    }
                    LedgerKind::Expense => {
                        Money::from_cents(running_balance.cents() - transaction.amount.cents())
                    }
                };
                let balance_formula = format!(
                    "=IF(AND(RC2&lt;&gt;&quot;&quot;,OR(RC5&lt;&gt;&quot;&quot;,RC6&lt;&gt;&quot;&quot;)),R5C7+SUMIF(R11C2:RC2,&quot;?*&quot;,R11C5:RC5)-SUMIF(R11C2:RC2,&quot;?*&quot;,R11C6:RC6),&quot;&quot;)"
                );
                push_transaction_row(
                    &mut rows,
                    row_index,
                    method,
                    &date,
                    &transaction.description,
                    &income,
                    &expense,
                    &running_balance.to_decimal_string(),
                    &balance_formula,
                    center_style,
                    left_style,
                    money_style,
                );
            } else {
                push_transaction_row(
                    &mut rows,
                    row_index,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "=IF(AND(RC2&lt;&gt;&quot;&quot;,OR(RC5&lt;&gt;&quot;&quot;,RC6&lt;&gt;&quot;&quot;)),R5C7+SUMIF(R11C2:RC2,&quot;?*&quot;,R11C5:RC5)-SUMIF(R11C2:RC2,&quot;?*&quot;,R11C6:RC6),&quot;&quot;)",
                    center_style,
                    left_style,
                    money_style,
                );
            }
        }

        worksheets.push_str(&format!(
            "<Worksheet ss:Name=\"{}\"><Table ss:ExpandedColumnCount=\"7\" ss:ExpandedRowCount=\"{}\" ss:DefaultColumnWidth=\"90\">\
             <Column ss:Index=\"1\" ss:Width=\"42\"/><Column ss:Index=\"2\" ss:Width=\"85\"/>\
             <Column ss:Index=\"3\" ss:Width=\"80\"/><Column ss:Index=\"4\" ss:Width=\"250\"/>\
             <Column ss:Index=\"5\" ss:Width=\"105\"/><Column ss:Index=\"6\" ss:Width=\"105\"/>\
             <Column ss:Index=\"7\" ss:Width=\"110\"/>{}</Table>\
             <WorksheetOptions xmlns=\"urn:schemas-microsoft-com:office:excel\"><DoNotDisplayGridlines/>\
             <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>\
             </WorksheetOptions></Worksheet>",
            xml_escape(&month.month_name),
            10 + transaction_rows,
            rows
        ));
    }

    format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><?mso-application progid=\"Excel.Sheet\"?>\
         <Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" \
         xmlns:o=\"urn:schemas-microsoft-com:office:office\" \
         xmlns:x=\"urn:schemas-microsoft-com:office:excel\" \
         xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\
         <DocumentProperties xmlns=\"urn:schemas-microsoft-com:office:office\">\
         <Title>{}</Title><Author>SOCDOF</Author></DocumentProperties>\
         <Styles>\
         <Style ss:ID=\"MainTitle\"><Font ss:Bold=\"1\" ss:Size=\"16\" ss:Color=\"#1B365D\"/></Style>\
         <Style ss:ID=\"LegendCell\"><Font ss:Italic=\"1\" ss:Size=\"9\" ss:Color=\"#64748B\"/></Style>\
         <Style ss:ID=\"Period\"><Font ss:Bold=\"1\"/></Style>\
         <Style ss:ID=\"SummaryNavyHeader\"><Font ss:Bold=\"1\" ss:Color=\"#FFFFFF\"/><Interior ss:Color=\"#1B365D\" ss:Pattern=\"Solid\"/></Style>\
         <Style ss:ID=\"SummaryNavyAmount\"><Font ss:Bold=\"1\" ss:Color=\"#FFFFFF\"/><Interior ss:Color=\"#1B365D\" ss:Pattern=\"Solid\"/><NumberFormat ss:Format=\"#,##0.00\"/></Style>\
         <Style ss:ID=\"SummaryLightLabel\"><Font ss:Bold=\"1\"/><Interior ss:Color=\"#E2E8F0\" ss:Pattern=\"Solid\"/></Style>\
         <Style ss:ID=\"SummaryLightAmount\"><Interior ss:Color=\"#E2E8F0\" ss:Pattern=\"Solid\"/><NumberFormat ss:Format=\"#,##0.00\"/></Style>\
         <Style ss:ID=\"ColHeader\"><Font ss:Bold=\"1\" ss:Color=\"#FFFFFF\"/><Interior ss:Color=\"#1B365D\" ss:Pattern=\"Solid\"/></Style>\
         <Style ss:ID=\"GridCenter\"><Alignment ss:Horizontal=\"Center\"/><Borders><Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#CBD5E1\"/></Borders></Style>\
         <Style ss:ID=\"GridCenterZebra\"><Alignment ss:Horizontal=\"Center\"/><Interior ss:Color=\"#F1F5F9\" ss:Pattern=\"Solid\"/></Style>\
         <Style ss:ID=\"GridLeft\"><Alignment ss:Horizontal=\"Left\"/></Style>\
         <Style ss:ID=\"GridLeftZebra\"><Alignment ss:Horizontal=\"Left\"/><Interior ss:Color=\"#F1F5F9\" ss:Pattern=\"Solid\"/></Style>\
         <Style ss:ID=\"GridCurrency\"><Alignment ss:Horizontal=\"Right\"/><NumberFormat ss:Format=\"#,##0.00\"/></Style>\
         <Style ss:ID=\"GridCurrencyZebra\"><Alignment ss:Horizontal=\"Right\"/><Interior ss:Color=\"#F1F5F9\" ss:Pattern=\"Solid\"/><NumberFormat ss:Format=\"#,##0.00\"/></Style>\
         </Styles>{}</Workbook>",
        xml_escape(&format!("{title} ({currency})")),
        worksheets
    )
}

fn push_text_row(output: &mut String, text: &str, style: &str, merge_across: usize) {
    output.push_str(&format!(
        "<Row><Cell ss:MergeAcross=\"{merge_across}\" ss:StyleID=\"{style}\"><Data ss:Type=\"String\">{}</Data></Cell></Row>",
        xml_escape(text)
    ));
}

fn push_row(output: &mut String, fields: &[(&str, &str, &str)]) {
    output.push_str("<Row>");
    for (text, kind, value) in fields {
        if *kind == "Number" && !value.is_empty() {
            output.push_str(&format!(
                "<Cell><Data ss:Type=\"Number\">{}</Data></Cell>",
                xml_escape(value)
            ));
        } else {
            output.push_str(&format!(
                "<Cell><Data ss:Type=\"String\">{}</Data></Cell>",
                xml_escape(text)
            ));
        }
    }
    output.push_str("</Row>");
}

fn push_row_with_formulas(output: &mut String, fields: &[(&str, &str, &str)]) {
    output.push_str("<Row>");
    for (text, kind, value) in fields {
        if *kind == "Formula" {
            output.push_str(&format!(
                "<Cell ss:Formula=\"{}\"><Data ss:Type=\"Number\">{}</Data></Cell>",
                value,
                xml_escape(text)
            ));
        } else if *kind == "Number" {
            output.push_str(&format!(
                "<Cell><Data ss:Type=\"Number\">{}</Data></Cell>",
                xml_escape(value)
            ));
        } else {
            output.push_str(&format!(
                "<Cell><Data ss:Type=\"String\">{}</Data></Cell>",
                xml_escape(text)
            ));
        }
    }
    output.push_str("</Row>");
}

fn push_transaction_row(
    output: &mut String,
    index: usize,
    method: &str,
    date: &str,
    description: &str,
    income: &str,
    expense: &str,
    balance: &str,
    balance_formula: &str,
    center_style: &str,
    left_style: &str,
    money_style: &str,
) {
    output.push_str("<Row ss:Height=\"19\">");
    output.push_str(&format!(
        "<Cell ss:StyleID=\"{center_style}\"><Data ss:Type=\"Number\">{index}</Data></Cell>"
    ));
    output.push_str(&format!(
        "<Cell ss:StyleID=\"{center_style}\"><Data ss:Type=\"String\">{}</Data></Cell>",
        xml_escape(method)
    ));
    output.push_str(&format!(
        "<Cell ss:StyleID=\"{center_style}\"><Data ss:Type=\"String\">{}</Data></Cell>",
        xml_escape(date)
    ));
    output.push_str(&format!(
        "<Cell ss:StyleID=\"{left_style}\"><Data ss:Type=\"String\">{}</Data></Cell>",
        xml_escape(description)
    ));
    for amount in [income, expense] {
        if amount.is_empty() {
            output.push_str(&format!(
                "<Cell ss:StyleID=\"{money_style}\"><Data ss:Type=\"String\"></Data></Cell>"
            ));
        } else {
            output.push_str(&format!(
                "<Cell ss:StyleID=\"{money_style}\"><Data ss:Type=\"Number\">{}</Data></Cell>",
                xml_escape(amount)
            ));
        }
    }
    output.push_str(&format!(
        "<Cell ss:Formula=\"{balance_formula}\" ss:StyleID=\"{money_style}\"><Data ss:Type=\"{}\">{}</Data></Cell>",
        if balance.is_empty() { "String" } else { "Number" },
        xml_escape(balance)
    ));
    output.push_str("</Row>");
}

/// Exports one monthly sheet as UTF-8 BOM semicolon-separated CSV.
pub fn export_monthly_ledger_csv(month: &MonthlyLedgerData, owner_name: &str) -> String {
    let owner = if owner_name.trim().is_empty() {
        "Praxis"
    } else {
        owner_name.trim()
    };
    let mut rows = vec![
        vec![format!("EIN- UND AUSGABEN - {owner}")],
        vec![format!("Zeitraum: {} {}", month.month_name, month.year)],
        Vec::new(),
        vec![
            "Uebertrag Vormonat Kassa".into(),
            month.carry_over_cash.to_decimal_string(),
            "Uebertrag Vormonat Bank".into(),
            month.carry_over_bank.to_decimal_string(),
        ],
        vec![
            "Summe Einnahmen Kassa".into(),
            month.income_cash.to_decimal_string(),
            "Summe Einnahmen Bank".into(),
            month.income_bank.to_decimal_string(),
        ],
        vec![
            "Summe Ausgaben Kassa".into(),
            month.expense_cash.to_decimal_string(),
            "Summe Ausgaben Bank".into(),
            month.expense_bank.to_decimal_string(),
        ],
        vec![
            "Endstand Kassa".into(),
            month.current_balance_cash.to_decimal_string(),
            "Endstand Bank".into(),
            month.current_balance_bank.to_decimal_string(),
        ],
        Vec::new(),
        vec![
            "Nr.".into(),
            "Kassa/Bank".into(),
            "Datum".into(),
            "Beschreibung".into(),
            "Einnahmen".into(),
            "Ausgaben".into(),
        ],
    ];

    for (index, transaction) in month.transactions.iter().enumerate() {
        rows.push(vec![
            (index + 1).to_string(),
            match transaction.channel {
                LedgerChannel::Cash => "K".into(),
                LedgerChannel::Bank => "B".into(),
            },
            format_short_date(&transaction.date),
            transaction.description.clone(),
            if transaction.kind == LedgerKind::Income {
                transaction.amount.to_decimal_string()
            } else {
                String::new()
            },
            if transaction.kind == LedgerKind::Expense {
                transaction.amount.to_decimal_string()
            } else {
                String::new()
            },
        ]);
    }

    let body = rows
        .iter()
        .map(|row| {
            row.iter()
                .map(|field| csv_field(field))
                .collect::<Vec<_>>()
                .join(";")
        })
        .collect::<Vec<_>>()
        .join("\r\n");
    format!("\u{feff}{body}\r\n")
}

fn csv_field(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn format_short_date(value: &str) -> String {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() == 3 {
        format!("{}.{}.{}", parts[2], parts[1], &parts[0][2..])
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx(date: &str, amount: i64, kind: LedgerKind, channel: LedgerChannel) -> LedgerTransaction {
        LedgerTransaction {
            date: date.into(),
            description: "Test".into(),
            amount: Money::from_cents(amount),
            kind,
            channel,
        }
    }

    #[test]
    fn monthly_balances_carry_cash_and_bank_forward_separately() {
        let transactions = vec![
            tx("2026-01-03", 10_000, LedgerKind::Income, LedgerChannel::Cash),
            tx("2026-01-04", 2_500, LedgerKind::Expense, LedgerChannel::Bank),
            tx("2026-02-01", 1_000, LedgerKind::Expense, LedgerChannel::Cash),
            tx("2026-02-05", 4_000, LedgerKind::Income, LedgerChannel::Bank),
        ];
        let names = (1..=12).map(|month| format!("M{month}")).collect::<Vec<_>>();
        let months = build_yearly_ledger(
            2026,
            &transactions,
            &names,
            Money::from_cents(500),
            Money::from_cents(1_000),
        );
        assert_eq!(months.len(), 12);
        assert_eq!(months[0].current_balance_cash.cents(), 10_500);
        assert_eq!(months[0].current_balance_bank.cents(), -1_500);
        assert_eq!(months[1].carry_over_cash.cents(), 10_500);
        assert_eq!(months[1].current_balance_cash.cents(), 9_500);
        assert_eq!(months[1].current_balance_bank.cents(), 2_500);
        assert_eq!(months[2].carry_over_total().cents(), 12_000);
    }

    #[test]
    fn monthly_csv_quotes_fields_and_preserves_german_excel_encoding() {
        let names = (1..=12).map(|month| format!("M{month}")).collect::<Vec<_>>();
        let months = build_yearly_ledger(
            2026,
            &[tx("2026-03-04", 12_345, LedgerKind::Income, LedgerChannel::Cash)],
            &names,
            Money::ZERO,
            Money::ZERO,
        );
        let mut month = months[2].clone();
        month.transactions[0].description = "Miete; \"Büro\"".into();
        let csv = export_monthly_ledger_csv(&month, "Muster & Partner");
        assert!(csv.starts_with('\u{feff}'));
        assert!(csv.contains("\"Miete; \"\"Büro\"\"\""));
        assert!(csv.contains("04.03.26"));
    }

    #[test]
    fn workbook_contains_twelve_sheets_and_escapes_user_text() {
        let names = (1..=12).map(|month| format!("M{month}")).collect::<Vec<_>>();
        let months = build_yearly_ledger(2026, &[], &names, Money::ZERO, Money::ZERO);
        let xml = export_tax_advisor_excel_xml(2026, "Muster & Partner", "€", &months);
        assert_eq!(xml.matches("<Worksheet ").count(), 12);
        assert!(xml.contains("Muster &amp; Partner"));
        assert!(xml.contains("€"));
    }
}
