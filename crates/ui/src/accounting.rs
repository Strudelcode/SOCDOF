//! Accounting module screen: journal, cash book, journal BWA, cross-module business report and CSV export.
//!
//! The screen works on the core store and the core accounting aggregate:
//! [`Store::journal_entries_between`]/[`Store::search_journal_entries`] load the entries,
//! [`Store::insert_journal_entry`], [`Store::update_journal_entry`] and
//! [`Store::delete_journal_entry`] write them, while
//! [`socdof_core::domain::accounting::summarize`] builds the BWA,
//! [`socdof_core::domain::accounting::cash_book`] the running cash balance,
//! [`socdof_core::domain::accounting_report::build_business_accounting_report`] the legacy-style
//! invoice/POS/purchase report and [`socdof_core::domain::accounting::export_csv`] the journal
//! export. No business logic lives in the screen.
//!
//! Views are list (journal, cash book or BWA), detail and form. Every control registers in the
//! shared [`FocusState`], every visible string comes from the catalogue and all painting uses the
//! design tokens.

use egui::{Context, RichText};
use socdof_core::date;
use socdof_core::domain::accounting::{
    cash_book, export_csv, summarize, BookingChannel, JournalEntry, JournalKind,
};
use socdof_core::domain::accounting_report::{
    build_business_accounting_report, export_business_accounting_csv, BusinessAccountingReport,
    ReportRange,
};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, tabs, ButtonVariant, Tone,
};
use crate::controls::{select, text_field, PopupState};
use crate::dashboard::Period as DashboardPeriod;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample entries, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Length of one day in milliseconds.
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Date period used by the Accounting module, including its legacy custom range.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AccountingPeriod {
    /// Every stored document.
    #[default]
    All,
    /// Current UTC calendar day.
    Today,
    /// Current calendar month.
    Month,
    /// Current calendar quarter.
    Quarter,
    /// Current calendar year.
    Year,
    /// User-selected inclusive date range.
    Custom,
}

impl AccountingPeriod {
    /// Periods in display order.
    pub const ALL: [AccountingPeriod; 6] = [
        AccountingPeriod::All,
        AccountingPeriod::Today,
        AccountingPeriod::Month,
        AccountingPeriod::Quarter,
        AccountingPeriod::Year,
        AccountingPeriod::Custom,
    ];

    /// Position in the period tab bar.
    pub fn index(self) -> usize {
        Self::ALL.iter().position(|period| *period == self).unwrap_or(0)
    }

    /// Period from a tab position, falling back to all documents.
    pub fn from_index(index: usize) -> Self {
        Self::ALL.get(index).copied().unwrap_or(AccountingPeriod::All)
    }

    /// Catalogue key of the period label.
    pub fn label_key(self) -> &'static str {
        match self {
            AccountingPeriod::All => "dashboard_period_all",
            AccountingPeriod::Today => "accounting_period_today",
            AccountingPeriod::Month => "dashboard_period_month",
            AccountingPeriod::Quarter => "dashboard_period_quarter",
            AccountingPeriod::Year => "dashboard_period_year",
            AccountingPeriod::Custom => "accounting_period_custom",
        }
    }

    /// Half-open timestamp range for the selected period.
    pub fn range(self, now: i64, custom_from: &str, custom_to: &str) -> Option<(i64, i64)> {
        match self {
            AccountingPeriod::All => Some((i64::MIN, i64::MAX)),
            AccountingPeriod::Today => {
                let (year, month, day) = date::civil_from_millis(now);
                let start = date::days_from_civil(year, month, day) * DAY_MS;
                Some((start, start + DAY_MS))
            }
            AccountingPeriod::Month => Some(DashboardPeriod::Month.range(now)),
            AccountingPeriod::Quarter => Some(DashboardPeriod::Quarter.range(now)),
            AccountingPeriod::Year => Some(DashboardPeriod::Year.range(now)),
            AccountingPeriod::Custom => {
                let from = parse_date_start(custom_from)?;
                let to = parse_date_start(custom_to)?.checked_add(DAY_MS)?;
                (from < to).then_some((from, to))
            }
        }
    }
}

fn parse_date_start(value: &str) -> Option<i64> {
    let value = value.trim();
    if value.len() != 10 {
        return None;
    }
    let timestamp = date::parse_iso8601(value)?;
    let (year, month, day) = date::civil_from_millis(timestamp);
    Some(date::days_from_civil(year, month, day) * DAY_MS)
}

/// Section of the accounting screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AccountingTab {
    /// All journal entries.
    #[default]
    Journal,
    /// Cash bookings with a running balance.
    CashBook,
    /// Revenue and expenses grouped by account.
    Bwa,
    /// Cross-module BWA, VAT, open receivables and POS close.
    BusinessReport,
}

impl AccountingTab {
    /// Position in the tab bar.
    pub fn index(self) -> usize {
        match self {
            AccountingTab::Journal => 0,
            AccountingTab::CashBook => 1,
            AccountingTab::Bwa => 2,
            AccountingTab::BusinessReport => 3,
        }
    }

    /// Tab from a bar position, falling back to the journal.
    pub fn from_index(index: usize) -> Self {
        match index {
            1 => AccountingTab::CashBook,
            2 => AccountingTab::Bwa,
            3 => AccountingTab::BusinessReport,
            _ => AccountingTab::Journal,
        }
    }

    /// Catalogue key of the tab label.
    pub fn label_key(self) -> &'static str {
        match self {
            AccountingTab::Journal => "accounting_tab_journal",
            AccountingTab::CashBook => "accounting_tab_cash",
            AccountingTab::Bwa => "accounting_tab_bwa",
            AccountingTab::BusinessReport => "accounting_tab_business",
        }
    }
}

/// View currently shown by the accounting screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AccountingView {
    /// Journal, cash book or BWA.
    #[default]
    List,
    /// Detail of the selected entry.
    Detail,
    /// Create or edit form.
    Form,
}

impl AccountingView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            AccountingView::List => "accounting_title",
            AccountingView::Detail => "accounting_detail_title",
            AccountingView::Form => "accounting_form_title",
        }
    }
}

/// Editable values of one journal entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccountingDraft {
    /// Description of the booking.
    pub description: String,
    /// Account booked on.
    pub account: String,
    /// Counter account.
    pub counter_account: String,
    /// Net amount as entered.
    pub amount: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
    /// Optional reference.
    pub reference: String,
    /// Revenue or expense.
    pub kind: JournalKind,
    /// Bank or cash.
    pub channel: BookingChannel,
}

impl Default for AccountingDraft {
    fn default() -> Self {
        Self {
            description: String::new(),
            account: String::new(),
            counter_account: String::new(),
            amount: String::new(),
            tax_rate: "19".to_string(),
            reference: String::new(),
            kind: JournalKind::Income,
            channel: BookingChannel::Bank,
        }
    }
}

impl AccountingDraft {
    /// Fills the draft from a stored entry.
    pub fn from_entry(entry: &JournalEntry) -> Self {
        Self {
            description: entry.description.clone(),
            account: entry.account.clone(),
            counter_account: entry.counter_account.clone(),
            amount: entry.amount.to_decimal_string(),
            tax_rate: format!("{}", entry.tax_rate_bp as f64 / 100.0),
            reference: entry.reference.clone().unwrap_or_default(),
            kind: entry.kind,
            channel: entry.channel,
        }
    }

    /// Builds the entry to store; `base` keeps id, booking time and creation time when editing.
    pub fn to_entry(
        &self,
        base: Option<&JournalEntry>,
        now: i64,
    ) -> Result<JournalEntry, &'static str> {
        if self.description.trim().is_empty() {
            return Err("accounting_error_description");
        }
        if self.account.trim().is_empty() {
            return Err("accounting_error_account");
        }
        if self.counter_account.trim().is_empty() {
            return Err("accounting_error_counter");
        }
        let amount = Money::parse(&self.amount).ok_or("accounting_error_amount")?;
        if amount.cents() <= 0 {
            return Err("accounting_error_amount");
        }
        let tax_rate_bp = parse_percent_bp(&self.tax_rate).ok_or("accounting_error_tax")?;

        let mut entry = match base {
            Some(entry) => entry.clone(),
            None => JournalEntry::new(now),
        };
        entry.description = self.description.trim().to_string();
        entry.account = self.account.trim().to_string();
        entry.counter_account = self.counter_account.trim().to_string();
        entry.amount = amount;
        entry.tax_rate_bp = tax_rate_bp;
        entry.reference = non_empty(&self.reference);
        entry.kind = self.kind;
        entry.channel = self.channel;
        entry.updated_at = now;

        Ok(entry)
    }
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_percent_bp(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
        return None;
    }
    Some((value * 100.0).round() as i64)
}

fn format_date(ms: i64) -> String {
    let (year, month, day) = date::civil_from_millis(ms);
    format!("{day:02}.{month:02}.{year}")
}

fn money(amount: Money) -> String {
    amount.format_localized("€")
}

fn money_in_currency(amount: Money, currency: &str) -> String {
    amount.format_localized(currency)
}

fn kind_key(kind: JournalKind) -> &'static str {
    match kind {
        JournalKind::Income => "accounting_kind_income",
        JournalKind::Expense => "accounting_kind_expense",
    }
}

fn channel_key(channel: BookingChannel) -> &'static str {
    match channel {
        BookingChannel::Bank => "accounting_channel_bank",
        BookingChannel::Cash => "accounting_channel_cash",
    }
}

fn kind_tone(kind: JournalKind) -> Tone {
    match kind {
        JournalKind::Income => Tone::Success,
        JournalKind::Expense => Tone::Warning,
    }
}

/// State of the accounting screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccountingState {
    /// Selected section.
    pub tab: AccountingTab,
    /// Selected period.
    pub period: AccountingPeriod,
    /// Custom range start (`YYYY-MM-DD`).
    pub custom_from: String,
    /// Custom range end (`YYYY-MM-DD`, inclusive).
    pub custom_to: String,
    /// Search text; empty lists every entry of the period.
    pub query: String,
    /// Entries of the loaded period and query.
    pub entries: Vec<JournalEntry>,
    /// Cross-module invoice, purchase and POS aggregates for the legacy Accounting dashboard.
    pub business_report: BusinessAccountingReport,
    /// Company name used in the business report export.
    pub company_name: String,
    /// Company currency used by the cross-module report.
    pub currency_symbol: String,
    /// Selected entry, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: AccountingView,
    /// Editable values of the form.
    pub draft: AccountingDraft,
    /// Dropdown state of the kind select.
    pub kind_popup: PopupState,
    /// Dropdown state of the channel select.
    pub channel_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Set when the export button was activated.
    pub export: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    loaded_period: Period,
    reload: bool,
}

impl Default for AccountingState {
    fn default() -> Self {
        Self {
            tab: AccountingTab::Journal,
            period: AccountingPeriod::All,
            custom_from: String::new(),
            custom_to: String::new(),
            query: String::new(),
            entries: Vec::new(),
            business_report: BusinessAccountingReport::default(),
            company_name: String::new(),
            currency_symbol: "€".to_string(),
            selected: None,
            view: AccountingView::List,
            draft: AccountingDraft::default(),
            kind_popup: PopupState::default(),
            channel_popup: PopupState::default(),
            confirm_delete: false,
            export: false,
            error: None,
            status: None,
            back: false,
            loaded_query: String::new(),
            loaded_period: Period::All,
            reload: true,
        }
    }
}

impl AccountingState {
    /// Creates an empty screen; the first [`AccountingState::refresh`] loads the entries.
    pub fn new() -> Self {
        Self::default()
    }

    /// Marks journal and cross-module document aggregates stale before the screen is reopened.
    pub fn invalidate(&mut self) {
        self.reload = true;
    }

    /// Reloads the entries when the period, the query or a write changed them.
    pub fn refresh(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        if !self.reload && self.loaded_period == self.period && self.loaded_query == self.query {
            return Ok(());
        }

        let Some((from, to)) = self.period.range(now, &self.custom_from, &self.custom_to) else {
            self.entries.clear();
            self.business_report = BusinessAccountingReport::default();
            self.error = Some("accounting_error_period");
            return Ok(());
        };
        let mut entries = store.journal_entries_between(from, to)?;
        let term = self.query.trim().to_lowercase();
        if !term.is_empty() {
            entries.retain(|entry| {
                entry.description.to_lowercase().contains(&term)
                    || entry.account.to_lowercase().contains(&term)
                    || entry.counter_account.to_lowercase().contains(&term)
                    || entry
                        .reference
                        .as_deref()
                        .is_some_and(|reference| reference.to_lowercase().contains(&term))
            });
        }

        self.entries = entries;

        let company = store.company_profile()?;
        self.company_name = company.name;
        self.currency_symbol = if company.currency.trim().is_empty() {
            "€".to_string()
        } else {
            company.currency
        };

        let invoices = store.list_invoices()?;
        let purchases = store.list_purchase_orders()?;
        let pos_orders = store.list_pos_orders()?;
        self.business_report = build_business_accounting_report(
            &invoices,
            &purchases,
            &pos_orders,
            ReportRange {
                from: Some(from),
                to: Some(to),
            },
            now,
        );

        self.loaded_query = self.query.clone();
        self.loaded_period = self.period;
        self.reload = false;
        Ok(())
    }

    /// Selected entry, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&JournalEntry> {
        self.selected
            .and_then(|id| self.entries.iter().find(|entry| entry.id == id))
    }

    /// Opens the detail view of an entry.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = AccountingView::Detail;
    }

    /// Opens an empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = AccountingDraft::default();
        self.error = None;
        self.status = None;
        self.view = AccountingView::Form;
    }

    /// Opens the form with the selected entry.
    pub fn start_edit(&mut self) {
        let Some(entry) = self.current() else {
            return;
        };
        self.draft = AccountingDraft::from_entry(entry);
        self.error = None;
        self.status = None;
        self.view = AccountingView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            AccountingView::Detail
        } else {
            AccountingView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`AccountingState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let entry = match self.draft.to_entry(base.as_ref(), now) {
            Ok(entry) => entry,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(());
            }
        };

        if let Err(code) = entry.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_journal_entry(&entry)?;
        } else {
            store.insert_journal_entry(&entry)?;
        }

        self.selected = Some(entry.id);
        self.view = AccountingView::Detail;
        self.error = None;
        self.status = Some("accounting_saved");
        self.reload = true;
        self.refresh(store, now)?;
        Ok(())
    }

    /// Deletes the selected entry after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_journal_entry(id)?;
        self.selected = None;
        self.view = AccountingView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("accounting_deleted");
        self.reload = true;
        self.refresh(store, now)?;
        Ok(())
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "description_required" => "accounting_error_description",
        "account_required" => "accounting_error_account",
        "counter_account_required" => "accounting_error_counter",
        "amount_not_positive" => "accounting_error_amount",
        "tax_rate_out_of_range" => "accounting_error_tax",
        _ => "accounting_error_save",
    }
}

#[allow(clippy::too_many_arguments)]
fn sample_entry(
    description: String,
    account: String,
    counter_account: String,
    amount_cents: i64,
    tax_rate_bp: i64,
    kind: JournalKind,
    channel: BookingChannel,
    booked_at: i64,
) -> JournalEntry {
    let mut entry = JournalEntry::new(booked_at);
    entry.description = description;
    entry.account = account;
    entry.counter_account = counter_account;
    entry.amount = Money::from_cents(amount_cents);
    entry.tax_rate_bp = tax_rate_bp;
    entry.kind = kind;
    entry.channel = channel;
    entry
}

/// Seeds four deterministic journal entries for the gallery and the golden snapshots.
///
/// The function is a no-op when the store already has entries, so it never overwrites data.
pub fn seed_accounting(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.journal_entry_count()? > 0 {
        return Ok(());
    }

    let revenue = texts.get("accounting_sample_account_revenue").to_string();
    let material = texts.get("accounting_sample_account_material").to_string();
    let rent = texts.get("accounting_sample_account_rent").to_string();
    let bank = texts.get("accounting_sample_account_bank").to_string();
    let cash = texts.get("accounting_sample_account_cash").to_string();

    store.insert_journal_entry(&sample_entry(
        texts.get("accounting_sample_income").to_string(),
        revenue.clone(),
        bank.clone(),
        21_250,
        1900,
        JournalKind::Income,
        BookingChannel::Bank,
        SAMPLE_NOW_MS - 5 * DAY_MS,
    ))?;
    store.insert_journal_entry(&sample_entry(
        texts.get("accounting_sample_material").to_string(),
        material,
        bank,
        4_500,
        1900,
        JournalKind::Expense,
        BookingChannel::Bank,
        SAMPLE_NOW_MS - 4 * DAY_MS,
    ))?;
    store.insert_journal_entry(&sample_entry(
        texts.get("accounting_sample_cash_income").to_string(),
        revenue,
        cash.clone(),
        8_000,
        700,
        JournalKind::Income,
        BookingChannel::Cash,
        SAMPLE_NOW_MS - 2 * DAY_MS,
    ))?;
    store.insert_journal_entry(&sample_entry(
        texts.get("accounting_sample_rent").to_string(),
        rent,
        cash,
        3_000,
        0,
        JournalKind::Expense,
        BookingChannel::Cash,
        SAMPLE_NOW_MS - DAY_MS,
    ))?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("accounting"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &AccountingState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the accounting screen into the context.
pub fn accounting(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            AccountingView::List => state.back = true,
            AccountingView::Detail => state.view = AccountingView::List,
            AccountingView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store, now).is_err() {
        state.error = Some("accounting_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                AccountingView::List => list_view(ui, theme, texts, focus, state),
                AccountingView::Detail => detail_view(ui, theme, texts, focus, state),
                AccountingView::Form => form_view(ui, theme, texts, focus, state, store, now),
            });
        });

    if state.export {
        let csv = if state.tab == AccountingTab::BusinessReport {
            export_business_accounting_csv(
                &state.business_report,
                &state.company_name,
                texts.get(state.period.label_key()),
                &format_date(now),
                &state.currency_symbol,
            )
        } else {
            export_csv(&state.entries)
        };
        #[cfg(feature = "dialogs")]
        {
            let (year, month, day) = date::civil_from_millis(now);
            let filename = if state.tab == AccountingTab::BusinessReport {
                format!("buchhaltung_bericht_{year:04}-{month:02}-{day:02}.csv")
            } else {
                format!("buchhaltung_buchungen_{year:04}-{month:02}-{day:02}.csv")
            };
            if let Some(path) = rfd::FileDialog::new()
                .set_file_name(&filename)
                .add_filter("CSV", &["csv"])
                .save_file()
            {
                if std::fs::write(path, csv).is_ok() {
                    state.status = Some("accounting_saved");
                    state.error = None;
                } else {
                    state.error = Some("accounting_error_save");
                    state.status = None;
                }
            }
        }
        #[cfg(not(feature = "dialogs"))]
        {
            ctx.output_mut(|output| output.copied_text = csv);
            state.error = None;
            state.status = Some("accounting_exported");
        }
        state.export = false;
    }

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("accounting_delete_title"),
            |ui| {
                ui.label(texts.get("accounting_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("accounting_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("accounting_delete_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        close = true;
                    }
                });
                close
            },
        );
    }
    state.confirm_delete = open;

    if confirm && state.delete_selected(store, now).is_err() {
        state.error = Some("accounting_error_delete");
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
) {
    let subtitle = format!(
        "{} · {}",
        texts.count("count_bookings", state.entries.len()),
        texts.get("accounting_subtitle"),
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("accounting_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut period_index = state.period.index();
    let period_labels: Vec<&str> = AccountingPeriod::ALL
        .iter()
        .map(|period| texts.get(period.label_key()))
        .collect();
    if tabs(ui, theme, focus, &period_labels, &mut period_index) {
        state.period = AccountingPeriod::from_index(period_index);
        if state.period == AccountingPeriod::Custom {
            let today = date::format_iso8601(now)[..10].to_string();
            if state.custom_from.is_empty() {
                state.custom_from = today.clone();
            }
            if state.custom_to.is_empty() {
                state.custom_to = today;
            }
        }
        state.reload = true;
    }
    if state.period == AccountingPeriod::Custom {
        ui.horizontal(|ui| {
            let from_changed = text_field(
                ui,
                theme,
                focus,
                &mut state.custom_from,
                texts.get("accounting_period_from"),
                "YYYY-MM-DD",
                None,
            )
            .response
            .changed();
            let to_changed = text_field(
                ui,
                theme,
                focus,
                &mut state.custom_to,
                texts.get("accounting_period_to"),
                "YYYY-MM-DD",
                None,
            )
            .response
            .changed();
            if from_changed || to_changed {
                state.reload = true;
            }
        });
    }
    ui.add_space(4.0);
    let mut tab_index = state.tab.index();
    let tab_labels: Vec<&str> = [
        AccountingTab::Journal,
        AccountingTab::CashBook,
        AccountingTab::Bwa,
        AccountingTab::BusinessReport,
    ]
    .iter()
    .map(|tab| texts.get(tab.label_key()))
    .collect();
    if tabs(ui, theme, focus, &tab_labels, &mut tab_index) {
        state.tab = AccountingTab::from_index(tab_index);
    }
    ui.add_space(8.0);

    ui.horizontal(|ui| {
        if state.tab != AccountingTab::BusinessReport {
            search_field_reserved(
                ui,
                theme,
                focus,
                &mut state.query,
                texts.get("accounting_search"),
                150.0,
            );
            if button(
                ui,
                theme,
                focus,
                texts.get("accounting_new"),
                ButtonVariant::Primary,
            )
            .activated
            {
                state.start_new();
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("accounting_export"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.export = true;
        }
    });

    ui.add_space(12.0);
    if state.view != AccountingView::List {
        return;
    }
    match state.tab {
        AccountingTab::Journal => journal_table(ui, theme, texts, focus, state),
        AccountingTab::CashBook => cash_book_view(ui, theme, texts, state),
        AccountingTab::Bwa => bwa_view(ui, theme, texts, state),
        AccountingTab::BusinessReport => business_report_view(ui, theme, texts, state),
    }
}

fn journal_table(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
) {
    if state.entries.is_empty() {
        card(ui, theme, |ui| {
            let searching = !state.query.trim().is_empty();
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("accounting_no_results"),
                    texts.get("accounting_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("accounting_empty_title"),
                    texts.get("accounting_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-journal-table")
            .num_columns(6)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "accounting_col_date",
                    "accounting_col_description",
                    "accounting_col_account",
                    "accounting_col_counter",
                    "accounting_col_net",
                    "accounting_col_kind",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for entry in &state.entries {
                    ui.label(format_date(entry.booked_at));
                    if button(ui, theme, focus, &entry.description, ButtonVariant::Ghost).activated
                    {
                        chosen = Some(entry.id);
                    }
                    ui.label(&entry.account);
                    ui.label(&entry.counter_account);
                    ui.label(money(entry.amount));
                    badge(
                        ui,
                        theme,
                        texts.get(kind_key(entry.kind)),
                        kind_tone(entry.kind),
                    );
                    ui.end_row();
                }
            });
    });
    if let Some(id) = chosen {
        state.select(id);
    }
}

fn cash_book_view(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &mut AccountingState) {
    let book = cash_book(&state.entries);
    if book.is_empty() {
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("accounting_cash_empty"),
                texts.get("accounting_cash_empty_hint"),
            );
        });
        return;
    }

    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("accounting_cash_title")).strong());
        ui.add_space(6.0);
        egui::Grid::new("socdof-cash-book")
            .num_columns(4)
            .spacing(egui::vec2(16.0, 6.0))
            .show(ui, |ui| {
                for key in [
                    "accounting_col_date",
                    "accounting_col_description",
                    "accounting_col_gross",
                    "accounting_cash_balance",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for row in &book {
                    ui.label(format_date(row.entry.booked_at));
                    ui.label(&row.entry.description);
                    ui.label(money(row.entry.signed_gross()));
                    ui.label(RichText::new(money(row.balance)).strong());
                    ui.end_row();
                }
            });
        if let Some(last) = book.last() {
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{}: {}",
                    texts.get("accounting_cash_balance"),
                    money(last.balance)
                ))
                .strong(),
            );
        }
    });
}

fn bwa_view(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &AccountingState) {
    let summary = summarize(&state.entries);
    if summary.rows.is_empty() {
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("accounting_bwa_empty"),
                texts.get("accounting_empty_hint"),
            );
        });
        return;
    }

    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("accounting_tab_business")).strong());
        ui.add_space(6.0);
        for (label, value, tone) in [
            ("accounting_revenue", summary.revenue_net, Tone::Success),
            ("accounting_expense", summary.expense_net, Tone::Warning),
            ("accounting_result", summary.result(), Tone::Accent),
            (
                "accounting_tax_balance",
                summary.tax_balance(),
                Tone::Neutral,
            ),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                badge(ui, theme, &money(value), tone);
            });
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-bwa-table")
            .num_columns(4)
            .spacing(egui::vec2(16.0, 6.0))
            .show(ui, |ui| {
                for key in [
                    "accounting_col_account",
                    "accounting_revenue",
                    "accounting_expense",
                    "accounting_result",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for row in &summary.rows {
                    ui.label(&row.account);
                    ui.label(money(row.revenue));
                    ui.label(money(row.expense));
                    ui.label(money(row.result()));
                    ui.end_row();
                }
            });
    });
}

fn business_report_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &AccountingState,
) {
    let report = &state.business_report;

    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("accounting_bwa_title")).strong());
        ui.add_space(8.0);
        for (label, value, tone) in [
            ("accounting_revenue", report.revenue_net, Tone::Success),
            ("accounting_expense", report.purchase_net, Tone::Warning),
            ("accounting_result", report.operating_profit_net, Tone::Accent),
            ("accounting_tax_balance", report.vat_liability, Tone::Neutral),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                badge(ui, theme, &money_in_currency(value, &state.currency_symbol), tone);
            });
        }
    });

    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("accounting_business_vat")).strong());
        ui.add_space(6.0);
        egui::Grid::new("socdof-business-vat")
            .num_columns(3)
            .spacing(egui::vec2(16.0, 6.0))
            .show(ui, |ui| {
                for label in [
                    "accounting_business_tax_rate",
                    "accounting_business_taxable_basis",
                    "accounting_business_vat_amount",
                ] {
                    ui.label(
                        RichText::new(texts.get(label))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for (rate, bucket) in [("7 %", report.vat_7), ("19 %", report.vat_19)] {
                    ui.label(rate);
                    ui.label(money_in_currency(bucket.net, &state.currency_symbol));
                    ui.label(money_in_currency(bucket.tax, &state.currency_symbol));
                    ui.end_row();
                }
                ui.label(RichText::new(texts.get("accounting_business_output_vat")).strong());
                ui.label(money_in_currency(report.revenue_net, &state.currency_symbol));
                ui.label(money_in_currency(report.output_vat, &state.currency_symbol));
                ui.end_row();
                ui.label(texts.get("accounting_business_input_vat"));
                ui.label(money_in_currency(report.purchase_net, &state.currency_symbol));
                ui.label(money_in_currency(report.purchase_tax, &state.currency_symbol));
                ui.end_row();
                ui.label(RichText::new(texts.get("accounting_tax_balance")).strong());
                ui.label("-");
                ui.label(
                    RichText::new(money_in_currency(
                        report.vat_liability,
                        &state.currency_symbol,
                    ))
                    .strong(),
                );
                ui.end_row();
            });
    });

    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(texts.get("accounting_business_open_items")).strong());
            badge(
                ui,
                theme,
                &format!(
                    "{} · {}",
                    report.open_receivables.len(),
                    money_in_currency(report.open_receivables_total, &state.currency_symbol)
                ),
                if report.open_receivables.is_empty() {
                    Tone::Success
                } else {
                    Tone::Warning
                },
            );
        });
        if report.open_receivables.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("accounting_no_results"),
                texts.get("accounting_empty_hint"),
            );
        } else {
            ui.add_space(6.0);
            egui::Grid::new("socdof-business-open-items")
                .num_columns(3)
                .spacing(egui::vec2(16.0, 6.0))
                .show(ui, |ui| {
                    for label in [
                        "accounting_col_date",
                        "accounting_col_description",
                        "accounting_col_gross",
                    ] {
                        ui.label(
                            RichText::new(texts.get(label))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for item in &report.open_receivables {
                        ui.horizontal(|ui| {
                            ui.label(format_date(item.due_at));
                            if item.overdue {
                                badge(
                                    ui,
                                    theme,
                                    texts.get("accounting_business_overdue"),
                                    Tone::Warning,
                                );
                            }
                        });
                        ui.label(&item.number);
                        ui.label(
                            RichText::new(money_in_currency(
                                item.amount,
                                &state.currency_symbol,
                            ))
                            .strong(),
                        );
                        ui.end_row();
                    }
                });
        }
    });

    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("accounting_business_pos_close")).strong());
        ui.add_space(6.0);
        for (label, value) in [
            ("pos_payment_cash", report.z_report.cash),
            ("pos_payment_card", report.z_report.card),
            ("pos_payment_nfc", report.z_report.nfc),
            ("pos_payment_other", report.z_report.other),
            ("pos_total_gross", report.z_report.gross),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money_in_currency(value, &state.currency_symbol)).strong());
            });
        }
        ui.label(
            RichText::new(format!(
                "{}: {}",
                texts.get("accounting_business_receipts"),
                report.z_report.receipts
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
    });
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
) {
    let Some(entry) = state.current().cloned() else {
        state.view = AccountingView::List;
        return;
    };

    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("accounting_detail_title"),
        &entry.description,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&entry.description).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(kind_key(entry.kind)),
                kind_tone(entry.kind),
            );
            badge(
                ui,
                theme,
                texts.get(channel_key(entry.channel)),
                Tone::Neutral,
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            ("accounting_booked", format_date(entry.booked_at)),
            ("accounting_account", entry.account.clone()),
            ("accounting_counter", entry.counter_account.clone()),
            ("accounting_amount", money(entry.amount)),
            ("accounting_tax", money(entry.tax())),
            ("accounting_col_gross", money(entry.gross())),
            (
                "accounting_reference",
                entry.reference.clone().unwrap_or_default(),
            ),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(value);
            });
        }
    });

    ui.add_space(12.0);
    let mut edit = false;
    let mut delete = false;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("accounting_edit"),
            ButtonVariant::Primary,
        )
        .activated
        {
            edit = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("accounting_delete"),
            ButtonVariant::Danger,
        )
        .activated
        {
            delete = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("accounting_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = AccountingView::List;
        }
    });
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AccountingState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("accounting_edit_title")
    } else {
        texts.get("accounting_new_title")
    };
    let subtitle = texts.get("accounting_subtitle").to_string();
    screen_header(ui, theme, texts, focus, state, title, &subtitle);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut save = false;
    let mut cancel = false;
    card(ui, theme, |ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.description,
            texts.get("accounting_description"),
            texts.get("accounting_description_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.account,
            texts.get("accounting_account"),
            texts.get("accounting_account_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.counter_account,
            texts.get("accounting_counter"),
            texts.get("accounting_counter_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.amount,
            texts.get("accounting_amount"),
            texts.get("accounting_amount_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.tax_rate,
            texts.get("accounting_tax"),
            texts.get("accounting_tax_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.reference,
            texts.get("accounting_reference"),
            texts.get("accounting_reference_hint"),
            None,
        );
        ui.add_space(8.0);

        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("accounting_kind"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let mut kind_index = match state.draft.kind {
                JournalKind::Income => 0,
                JournalKind::Expense => 1,
            };
            let labels = [
                texts.get("accounting_kind_income"),
                texts.get("accounting_kind_expense"),
            ];
            if select(
                ui,
                theme,
                focus,
                &mut state.kind_popup,
                "accounting-kind",
                &mut kind_index,
                &labels,
            ) {
                state.draft.kind = if kind_index == 1 {
                    JournalKind::Expense
                } else {
                    JournalKind::Income
                };
            }
        });
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("accounting_channel"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let mut channel_index = match state.draft.channel {
                BookingChannel::Bank => 0,
                BookingChannel::Cash => 1,
            };
            let labels = [
                texts.get("accounting_channel_bank"),
                texts.get("accounting_channel_cash"),
            ];
            if select(
                ui,
                theme,
                focus,
                &mut state.channel_popup,
                "accounting-channel",
                &mut channel_index,
                &labels,
            ) {
                state.draft.channel = if channel_index == 1 {
                    BookingChannel::Cash
                } else {
                    BookingChannel::Bank
                };
            }
        });
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("accounting_save"),
                ButtonVariant::Primary,
            )
            .activated
            {
                save = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("accounting_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("accounting_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::settings::Language;

    fn seeded() -> (Store, AccountingState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_accounting(&store, &texts).expect("seed");
        let mut state = AccountingState::new();
        state.refresh(&store, SAMPLE_NOW_MS).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut AccountingState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1000.0, 1600.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                accounting(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("accounting frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_an_entry() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AccountingState::new();
        state.refresh(&store, SAMPLE_NOW_MS).expect("refresh");
        state.start_new();
        state.draft.description = "Rechnung".to_string();
        state.draft.account = "Erlöse".to_string();
        state.draft.counter_account = "Bank".to_string();
        state.draft.amount = "100".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, AccountingView::Detail);
        let entry = store.list_journal_entries().expect("list")[0].clone();
        assert_eq!(entry.amount, Money::from_cents(10_000));
        assert_eq!(entry.kind, JournalKind::Income);

        state.start_edit();
        state.draft.amount = "120".to_string();
        state.draft.kind = JournalKind::Expense;
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        let stored = store
            .find_journal_entry(entry.id)
            .expect("find")
            .expect("present");
        assert_eq!(stored.amount, Money::from_cents(12_000));
        assert_eq!(stored.kind, JournalKind::Expense);

        state
            .delete_selected(&store, SAMPLE_NOW_MS + 2)
            .expect("delete");
        assert_eq!(store.journal_entry_count().expect("count"), 0);
        assert_eq!(state.view, AccountingView::List);
    }

    #[test]
    fn rejects_invalid_entries() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AccountingState::new();
        state.start_new();
        state.draft.description = "Miete".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("accounting_error_account"));
        assert_eq!(store.journal_entry_count().expect("count"), 0);

        state.draft.account = "Miete".to_string();
        state.draft.counter_account = "Bank".to_string();
        state.draft.amount = "0".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("accounting_error_amount"));
        assert_eq!(store.journal_entry_count().expect("count"), 0);
    }

    #[test]
    fn filters_by_period_and_query() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.entries.len(), 4);

        state.query = "Barverkauf".to_string();
        state.refresh(&store, SAMPLE_NOW_MS).expect("search");
        assert_eq!(state.entries.len(), 1);

        state.query.clear();
        state.period = AccountingPeriod::Month;
        state.refresh(&store, SAMPLE_NOW_MS).expect("period");
        assert_eq!(state.entries.len(), 4);
    }

    #[test]
    fn cash_book_and_bwa_use_the_core_aggregates() {
        let (_store, state, _texts) = seeded();
        let book = cash_book(&state.entries);
        assert_eq!(book.len(), 2);
        assert_eq!(book.last().unwrap().balance, Money::from_cents(5_560));

        let summary = summarize(&state.entries);
        assert_eq!(summary.revenue_net, Money::from_cents(29_250));
        assert_eq!(summary.expense_net, Money::from_cents(7_500));
        assert_eq!(summary.result(), Money::from_cents(21_750));
    }

    #[test]
    fn renders_the_journal_the_cash_book_and_the_bwa() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_title")));
        assert!(painted.contains(texts.get("accounting_sample_income")));
        assert!(painted.contains(texts.get("accounting_kind_income")));

        state.tab = AccountingTab::CashBook;
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_cash_title")));
        assert!(painted.contains(texts.get("accounting_sample_rent")));

        state.tab = AccountingTab::Bwa;
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_tab_business")));
        assert!(painted.contains(texts.get("accounting_sample_account_revenue")));
        assert!(painted.contains(texts.get("accounting_result")));

        state.tab = AccountingTab::BusinessReport;
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_bwa_title")));
        assert!(painted.contains(texts.get("accounting_business_pos_close")));
        assert!(painted.contains(texts.get("accounting_business_open_items")));
    }

    #[test]
    fn renders_the_detail_and_the_form_with_totals() {
        let (store, mut state, texts) = seeded();
        let id = state.entries[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_edit")));
        assert!(painted.contains(texts.get("accounting_col_gross")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("accounting_save")));
        assert!(painted.contains(texts.get("accounting_channel")));
    }

    #[test]
    fn seeding_is_idempotent_and_exports_csv() {
        let (store, state, texts) = seeded();
        seed_accounting(&store, &texts).expect("second seed");
        assert_eq!(store.journal_entry_count().expect("count"), 4);

        let csv = export_csv(&state.entries);
        assert!(csv.starts_with("booked_at,description,account,counter_account"));
        assert!(csv.contains(texts.get("accounting_sample_income")));
        assert_eq!(csv.lines().count(), 5);
    }

    #[test]
    fn business_report_refreshes_from_persisted_invoices_purchases_and_pos() {
        use socdof_core::domain::contact::{Contact, ContactKind, ContactType};
        use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
        use socdof_core::domain::pos::{PaymentMethod, PosOrder, PosOrderLine};
        use socdof_core::domain::purchase::{
            PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus,
        };

        let store = Store::open_in_memory().expect("store");
        let now = SAMPLE_NOW_MS;
        let mut company = store.company_profile().expect("company profile");
        company.name = "Accounting GmbH".to_string();
        company.currency = "$".to_string();
        store.save_company_profile(&company).expect("save company profile");
        let mut state = AccountingState::new();
        state.refresh(&store, now).expect("initial refresh");
        let mut contact = Contact::new(ContactKind::Person, now);
        contact.name = Some("Accounting Customer".to_string());
        contact.contact_type = ContactType::Both;
        store.insert_contact(&contact).expect("contact");

        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-REPORT-001".to_string(),
            contact_id: contact.id,
            status: InvoiceStatus::Sent,
            issued_at: now,
            due_at: now + DAY_MS,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Service".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1_900,
            }],
        };
        store.insert_invoice(&invoice).expect("invoice");

        let purchase = PurchaseOrder {
            id: Uuid::new_v4(),
            number: "PUR-REPORT-001".to_string(),
            vendor_id: contact.id,
            status: PurchaseOrderStatus::Received,
            order_date: now,
            expected_at: None,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![PurchaseOrderLine {
                product_id: None,
                description: "Supplies".to_string(),
                quantity_milli: 1_000,
                unit_cost: Money::from_cents(2_000),
                tax_rate_bp: 1_900,
            }],
            legacy_id: None,
            created_at: now,
            updated_at: now,
        };
        store.insert_purchase_order(&purchase).expect("purchase");

        let pos = PosOrder {
            id: Uuid::new_v4(),
            receipt_number: "POS-REPORT-001".to_string(),
            contact_id: None,
            payment_method: PaymentMethod::Nfc,
            paid_at: now,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            cash_given: None,
            lines: vec![PosOrderLine {
                product_id: None,
                description: "Coffee".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(5_000),
                tax_rate_bp: 700,
            }],
            legacy_id: None,
        };
        store.insert_pos_order(&pos, &[]).expect("POS receipt");

        state.invalidate();
        state.refresh(&store, now).expect("refresh business report");
        assert_eq!(state.company_name, "Accounting GmbH");
        assert_eq!(state.currency_symbol, "$");
        assert_eq!(state.business_report.invoice_net.cents(), 10_000);
        assert_eq!(state.business_report.purchase_net.cents(), 2_000);
        assert_eq!(state.business_report.pos_net.cents(), 5_000);
        assert_eq!(state.business_report.open_receivables.len(), 1);
        assert_eq!(state.business_report.z_report.nfc.cents(), 5_350);
    }
}
