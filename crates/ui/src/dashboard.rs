//! Dashboard screen: the overview module of Phase 6.
//!
//! The screen is data driven. The host loads [`DashboardData`] from the core aggregates
//! (`socdof_core::store::dashboard`) and the screen only formats it; period totals are computed with
//! [`summarize`], the same function the store uses, so the CLI, the window commands and the screen
//! always agree. Every label comes from the catalogue, every control registers in the shared
//! [`FocusState`].

use egui::{Context, RichText};
use socdof_core::date;
use socdof_core::domain::invoice::InvoiceStatus;
use socdof_core::domain::permission::{AppModule, ALL_MODULES};
use socdof_core::money::Money;
use socdof_core::store::dashboard::{
    summarize, DashboardCounts, DashboardSummary, InvoiceOverview, LowStockRow,
};

use crate::components::{badge, button, card, empty_state, tabs, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample data, so the gallery and the golden snapshots stay deterministic.
pub const SAMPLE_NOW_MS: i64 = 1_794_052_800_000; // 2026-11-07 12:00 UTC

/// Simulated one day for the sample invoice dates.
const SAMPLE_DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Period of the key figures.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Period {
    /// Every stored document.
    #[default]
    All,
    /// Current calendar month.
    Month,
    /// Current calendar quarter.
    Quarter,
    /// Current calendar year.
    Year,
}

impl Period {
    /// Every period in display order.
    pub const ALL: [Period; 4] = [Period::All, Period::Month, Period::Quarter, Period::Year];

    /// Position in the tab bar.
    pub fn index(self) -> usize {
        match self {
            Period::All => 0,
            Period::Month => 1,
            Period::Quarter => 2,
            Period::Year => 3,
        }
    }

    /// Period from a tab position, falling back to `All`.
    pub fn from_index(index: usize) -> Self {
        Self::ALL.get(index).copied().unwrap_or(Period::All)
    }

    /// Catalogue key of the tab label.
    pub fn label_key(self) -> &'static str {
        match self {
            Period::All => "dashboard_period_all",
            Period::Month => "dashboard_period_month",
            Period::Quarter => "dashboard_period_quarter",
            Period::Year => "dashboard_period_year",
        }
    }

    /// Half-open issue-date range (`from <= issued_at < to`) of the period around `now`.
    pub fn range(self, now: i64) -> (i64, i64) {
        let (year, month, _) = date::civil_from_millis(now);
        match self {
            Period::All => (i64::MIN, i64::MAX),
            Period::Month => {
                let (next_year, next_month) = if month == 12 {
                    (year + 1, 1)
                } else {
                    (year, month + 1)
                };
                (
                    date::start_of_month_ms(year, month),
                    date::start_of_month_ms(next_year, next_month),
                )
            }
            Period::Quarter => {
                let first = (month - 1) / 3 * 3 + 1;
                if first == 10 {
                    (
                        date::start_of_month_ms(year, first),
                        date::start_of_month_ms(year + 1, 1),
                    )
                } else {
                    (
                        date::start_of_month_ms(year, first),
                        date::start_of_month_ms(year, first + 3),
                    )
                }
            }
            Period::Year => (
                date::start_of_month_ms(year, 1),
                date::start_of_month_ms(year + 1, 1),
            ),
        }
    }
}

/// Quick action offered by the dashboard.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DashboardAction {
    /// Open the contact editor for a new contact.
    NewContact,
    /// Open the product editor for a new product.
    NewProduct,
    /// Start a new invoice.
    NewInvoice,
    /// Open the accounting journal.
    OpenAccounting,
    /// Open the purchase orders.
    OpenPurchases,
    /// Open the point of sale.
    OpenPos,
    /// Open the calendar.
    OpenCalendar,
    /// Open the settings screen.
    OpenSettings,
    /// Open the user management screen.
    ManageUsers,
    /// Open the text editor.
    OpenEditor,
    /// Open the App Store.
    OpenAppStore,
    /// Lock the current session and show the lock screen.
    LockSession,
}

impl DashboardAction {
    /// Every action in display order.
    pub const ALL: [DashboardAction; 12] = [
        DashboardAction::NewContact,
        DashboardAction::NewProduct,
        DashboardAction::NewInvoice,
        DashboardAction::OpenAccounting,
        DashboardAction::OpenPurchases,
        DashboardAction::OpenPos,
        DashboardAction::OpenCalendar,
        DashboardAction::OpenSettings,
        DashboardAction::ManageUsers,
        DashboardAction::OpenEditor,
        DashboardAction::OpenAppStore,
        DashboardAction::LockSession,
    ];

    /// Module whose activation controls the action, if any.
    pub fn module(self) -> Option<AppModule> {
        match self {
            DashboardAction::NewContact => Some(AppModule::Contacts),
            DashboardAction::NewProduct => Some(AppModule::Products),
            DashboardAction::NewInvoice => Some(AppModule::Invoices),
            DashboardAction::OpenAccounting => Some(AppModule::Accounting),
            DashboardAction::OpenPurchases => Some(AppModule::Purchases),
            DashboardAction::OpenPos => Some(AppModule::Pos),
            DashboardAction::OpenCalendar => Some(AppModule::Calendar),
            DashboardAction::OpenSettings => Some(AppModule::Settings),
            DashboardAction::ManageUsers => Some(AppModule::Users),
            DashboardAction::OpenEditor => Some(AppModule::Editor),
            DashboardAction::OpenAppStore | DashboardAction::LockSession => None,
        }
    }

    /// Catalogue key of the button label.
    pub fn label_key(self) -> &'static str {
        match self {
            DashboardAction::NewContact => "dashboard_action_contact",
            DashboardAction::NewProduct => "dashboard_action_product",
            DashboardAction::NewInvoice => "dashboard_action_invoice",
            DashboardAction::OpenAccounting => "dashboard_action_accounting",
            DashboardAction::OpenPurchases => "dashboard_action_purchases",
            DashboardAction::OpenPos => "dashboard_action_pos",
            DashboardAction::OpenCalendar => "dashboard_action_calendar",
            DashboardAction::OpenSettings => "dashboard_action_settings",
            DashboardAction::ManageUsers => "dashboard_action_users",
            DashboardAction::OpenEditor => "dashboard_action_editor",
            DashboardAction::OpenAppStore => "dashboard_action_app_store",
            DashboardAction::LockSession => "dashboard_action_lock",
        }
    }
}

/// Everything the screen shows, loaded by the host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DashboardData {
    /// Company name shown in the subtitle.
    pub company: String,
    /// Counts that do not depend on the period.
    pub counts: DashboardCounts,
    /// All invoices, newest first, with contact names.
    pub invoices: Vec<InvoiceOverview>,
    /// Products at or below their reorder level.
    pub low_stock: Vec<LowStockRow>,
}

impl DashboardData {
    /// Builds the screen data from the core aggregates.
    pub fn new(
        company: impl Into<String>,
        counts: DashboardCounts,
        invoices: Vec<InvoiceOverview>,
        low_stock: Vec<LowStockRow>,
    ) -> Self {
        Self {
            company: company.into(),
            counts,
            invoices,
            low_stock,
        }
    }

    /// Key figures for a period.
    pub fn summary(&self, period: Period, now: i64) -> DashboardSummary {
        let (from, to) = period.range(now);
        summarize(&self.invoices, &self.counts, from, to)
    }

    /// The newest invoices, at most `limit`.
    pub fn recent(&self, limit: usize) -> impl Iterator<Item = &InvoiceOverview> {
        self.invoices.iter().take(limit)
    }

    /// Currency symbol of the stored invoices, `€` when there is none.
    pub fn currency(&self) -> &str {
        self.invoices
            .first()
            .map(|invoice| invoice.currency_symbol.as_str())
            .unwrap_or("€")
    }

    /// Whether the database has no contacts, products or invoices at all.
    pub fn is_empty(&self) -> bool {
        self.counts.contacts == 0 && self.counts.products == 0 && self.invoices.is_empty()
    }

    /// Deterministic sample for the gallery and the golden snapshots.
    ///
    /// The sample mirrors a small company with five invoices across three periods. Real screens
    /// always receive data through [`DashboardData::new`] from the core aggregates.
    pub fn sample(texts: &UiTexts) -> Self {
        let contact_a = texts.get("dashboard_sample_contact_a").to_string();
        let contact_b = texts.get("dashboard_sample_contact_b").to_string();
        let product_a = texts.get("dashboard_sample_product_a").to_string();
        let product_b = texts.get("dashboard_sample_product_b").to_string();

        let invoices = vec![
            sample_invoice("2026-0005", &contact_a, InvoiceStatus::Sent, 2, 178_500),
            sample_invoice("2026-0004", &contact_b, InvoiceStatus::Paid, 5, 89_250),
            sample_invoice("2026-0003", &contact_a, InvoiceStatus::Overdue, 12, 238_000),
            sample_invoice("2026-0002", &contact_b, InvoiceStatus::Draft, 20, 47_600),
            sample_invoice("2026-0001", &contact_a, InvoiceStatus::Paid, 40, 357_000),
        ];

        let low_stock = vec![
            LowStockRow {
                name: product_a,
                sku: "A-100".to_string(),
                stock: 2,
                reorder_level: 10,
                unit: "Stk".to_string(),
            },
            LowStockRow {
                name: product_b,
                sku: "B-204".to_string(),
                stock: 0,
                reorder_level: 5,
                unit: "Stk".to_string(),
            },
        ];

        Self {
            company: texts.get("dashboard_sample_company").to_string(),
            counts: DashboardCounts {
                contacts: 12,
                products: 34,
                low_stock: low_stock.len() as i64,
                inventory_cost: Money::from_cents(128_400),
                inventory_retail: Money::from_cents(246_900),
                upcoming_appointments: 3,
            },
            invoices,
            low_stock,
        }
    }
}

fn sample_invoice(
    number: &str,
    contact: &str,
    status: InvoiceStatus,
    offset_days: i64,
    gross_cents: i64,
) -> InvoiceOverview {
    InvoiceOverview {
        number: number.to_string(),
        contact: contact.to_string(),
        status,
        issued_at: SAMPLE_NOW_MS - offset_days * SAMPLE_DAY_MS,
        gross: Money::from_cents(gross_cents),
        currency_symbol: "€".to_string(),
    }
}

/// State of the dashboard screen.
#[derive(Debug, Clone)]
pub struct DashboardState {
    /// Selected period of the key figures.
    pub period: Period,
    /// Loaded data.
    pub data: DashboardData,
    /// Modules enabled in the App Store; controls which quick actions are shown.
    active_modules: Vec<AppModule>,
    /// Quick action the host has to handle, consumed by [`DashboardState::take_action`].
    action: Option<DashboardAction>,
    /// Set when the back button was activated.
    pub back: bool,
}

impl DashboardState {
    /// Creates the screen for the given data.
    pub fn new(data: DashboardData) -> Self {
        Self {
            period: Period::default(),
            data,
            active_modules: ALL_MODULES.to_vec(),
            action: None,
            back: false,
        }
    }

    /// Key figures of the selected period.
    pub fn summary(&self, now: i64) -> DashboardSummary {
        self.data.summary(self.period, now)
    }

    /// Selects a period; the host may reload the data for it.
    pub fn set_period(&mut self, period: Period) {
        self.period = period;
    }

    /// Replaces the enabled modules, for example after an App Store change.
    pub fn set_active_modules(&mut self, modules: Vec<AppModule>) {
        self.active_modules = modules;
    }

    /// Whether a module is enabled.
    pub fn module_active(&self, module: AppModule) -> bool {
        self.active_modules.contains(&module)
    }

    /// Whether the action is offered with the current module selection.
    pub fn action_available(&self, action: DashboardAction) -> bool {
        match action.module() {
            Some(module) => self.module_active(module),
            None => true,
        }
    }

    /// Queues a quick action, used by the host and by the tests.
    pub fn queue_action(&mut self, action: DashboardAction) {
        self.action = Some(action);
    }

    /// Returns the pending quick action once.
    pub fn take_action(&mut self) -> Option<DashboardAction> {
        self.action.take()
    }
}

/// Catalogue key of an invoice status.
fn status_key(status: InvoiceStatus) -> &'static str {
    match status {
        InvoiceStatus::Draft => "dashboard_status_draft",
        InvoiceStatus::Sent => "dashboard_status_sent",
        InvoiceStatus::Paid => "dashboard_status_paid",
        InvoiceStatus::Overdue => "dashboard_status_overdue",
        InvoiceStatus::Cancelled => "dashboard_status_cancelled",
    }
}

/// Badge tone of an invoice status.
fn status_tone(status: InvoiceStatus) -> Tone {
    match status {
        InvoiceStatus::Draft | InvoiceStatus::Cancelled => Tone::Neutral,
        InvoiceStatus::Sent => Tone::Accent,
        InvoiceStatus::Paid => Tone::Success,
        InvoiceStatus::Overdue => Tone::Danger,
    }
}

fn kpi_card(ui: &mut egui::Ui, theme: &Theme, label: &str, value: &str, hint: &str, tone: Tone) {
    card(ui, theme, |ui| {
        ui.set_min_width(150.0);
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.label(
            RichText::new(value)
                .size(FONT_TITLE)
                .strong()
                .color(tone.color(theme)),
        );
        ui.label(
            RichText::new(hint)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
}

/// Renders the dashboard into the context.
pub fn dashboard(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut DashboardState,
    now: i64,
) {
    let summary = state.summary(now);
    let symbol = state.data.currency().to_string();

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new(texts.get("dashboard_title"))
                                .size(FONT_TITLE)
                                .strong(),
                        );
                        ui.label(
                            RichText::new(format!(
                                "{} · {}",
                                state.data.company,
                                texts.get("dashboard_subtitle")
                            ))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("dashboard_back"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            state.back = true;
                        }
                    });
                });

                ui.add_space(12.0);
                let labels: [&str; 4] =
                    std::array::from_fn(|index| texts.get(Period::ALL[index].label_key()));
                let mut selected = state.period.index();
                if tabs(ui, theme, focus, &labels, &mut selected) {
                    state.set_period(Period::from_index(selected));
                    ctx.request_repaint();
                }

                ui.add_space(12.0);
                if state.data.is_empty() {
                    card(ui, theme, |ui| {
                        empty_state(
                            ui,
                            theme,
                            texts.get("dashboard_empty_title"),
                            texts.get("dashboard_empty_hint"),
                        );
                    });
                }

                let kpis = [
                    (
                        texts.get("dashboard_revenue"),
                        summary.gross.format_localized(&symbol),
                        texts.get("dashboard_revenue_hint"),
                        Tone::Accent,
                    ),
                    (
                        texts.get("dashboard_open_amount"),
                        summary.open.format_localized(&symbol),
                        texts.get("dashboard_open_hint"),
                        Tone::Warning,
                    ),
                    (
                        texts.get("dashboard_overdue"),
                        summary.overdue.format_localized(&symbol),
                        texts.get("dashboard_overdue_hint"),
                        Tone::Danger,
                    ),
                    (
                        texts.get("dashboard_inventory"),
                        summary.inventory_cost.format_localized(&symbol),
                        texts.get("dashboard_inventory_hint"),
                        Tone::Accent,
                    ),
                    (
                        texts.get("dashboard_contacts"),
                        summary.contacts.to_string(),
                        texts.get("dashboard_contacts_hint"),
                        Tone::Success,
                    ),
                    (
                        texts.get("dashboard_products"),
                        summary.products.to_string(),
                        texts.get("dashboard_products_hint"),
                        Tone::Success,
                    ),
                    (
                        texts.get("dashboard_low_stock"),
                        summary.low_stock.to_string(),
                        texts.get("dashboard_low_stock_hint"),
                        if summary.low_stock > 0 {
                            Tone::Warning
                        } else {
                            Tone::Neutral
                        },
                    ),
                    (
                        texts.get("dashboard_upcoming"),
                        summary.upcoming_appointments.to_string(),
                        texts.get("dashboard_upcoming_hint"),
                        Tone::Neutral,
                    ),
                ];
                egui::Grid::new("socdof-dashboard-kpis")
                    .num_columns(4)
                    .spacing(egui::vec2(12.0, 12.0))
                    .show(ui, |ui| {
                        for (index, (label, value, hint, tone)) in kpis.iter().enumerate() {
                            kpi_card(ui, theme, label, value, hint, *tone);
                            if (index + 1) % 4 == 0 {
                                ui.end_row();
                            }
                        }
                    });

                ui.add_space(12.0);
                card(ui, theme, |ui| {
                    ui.label(RichText::new(texts.get("dashboard_quick_actions")).strong());
                    ui.add_space(6.0);
                    ui.horizontal_wrapped(|ui| {
                        for action in DashboardAction::ALL {
                            if !state.action_available(action) {
                                continue;
                            }
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get(action.label_key()),
                                ButtonVariant::Secondary,
                            )
                            .activated
                            {
                                state.action = Some(action);
                            }
                        }
                    });
                });

                ui.add_space(12.0);
                card(ui, theme, |ui| {
                    ui.label(RichText::new(texts.get("dashboard_recent_invoices")).strong());
                    ui.add_space(6.0);
                    let rows: Vec<&InvoiceOverview> = state.data.recent(5).collect();
                    if rows.is_empty() {
                        empty_state(
                            ui,
                            theme,
                            texts.get("dashboard_no_invoices"),
                            texts.get("dashboard_no_invoices_hint"),
                        );
                    } else {
                        egui::Grid::new("socdof-dashboard-invoices")
                            .num_columns(4)
                            .spacing(egui::vec2(16.0, 8.0))
                            .show(ui, |ui| {
                                for key in [
                                    "dashboard_col_number",
                                    "dashboard_col_customer",
                                    "dashboard_col_status",
                                    "dashboard_col_total",
                                ] {
                                    ui.label(
                                        RichText::new(texts.get(key))
                                            .size(FONT_SMALL)
                                            .strong()
                                            .color(theme.palette.text_muted),
                                    );
                                }
                                ui.end_row();
                                for invoice in rows {
                                    let contact = if invoice.contact.is_empty() {
                                        texts.get("dashboard_col_customer")
                                    } else {
                                        invoice.contact.as_str()
                                    };
                                    ui.label(&invoice.number);
                                    ui.label(contact);
                                    badge(
                                        ui,
                                        theme,
                                        texts.get(status_key(invoice.status)),
                                        status_tone(invoice.status),
                                    );
                                    ui.label(
                                        invoice.gross.format_localized(&invoice.currency_symbol),
                                    );
                                    ui.end_row();
                                }
                            });
                    }
                });

                ui.add_space(12.0);
                card(ui, theme, |ui| {
                    ui.label(RichText::new(texts.get("dashboard_reorder_title")).strong());
                    ui.add_space(6.0);
                    if state.data.low_stock.is_empty() {
                        empty_state(
                            ui,
                            theme,
                            texts.get("dashboard_no_reorder"),
                            texts.get("dashboard_no_reorder_hint"),
                        );
                    } else {
                        egui::Grid::new("socdof-dashboard-reorder")
                            .num_columns(3)
                            .spacing(egui::vec2(16.0, 8.0))
                            .show(ui, |ui| {
                                for key in [
                                    "dashboard_col_product",
                                    "dashboard_col_stock",
                                    "dashboard_col_reorder_level",
                                ] {
                                    ui.label(
                                        RichText::new(texts.get(key))
                                            .size(FONT_SMALL)
                                            .strong()
                                            .color(theme.palette.text_muted),
                                    );
                                }
                                ui.end_row();
                                for row in &state.data.low_stock {
                                    if row.sku.is_empty() {
                                        ui.label(&row.name);
                                    } else {
                                        ui.label(format!("{} ({})", row.name, row.sku));
                                    }
                                    ui.label(format!("{} {}", row.stock, row.unit));
                                    ui.label(row.reorder_level.to_string());
                                    ui.end_row();
                                }
                            });
                    }
                });
            });
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_state() -> DashboardState {
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        DashboardState::new(DashboardData::sample(&texts))
    }

    fn render(state: &mut DashboardState) -> egui::FullOutput {
        let ctx = Context::default();
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(900.0, 1400.0),
            )),
            ..Default::default()
        };
        ctx.run(input, |ctx| {
            dashboard(ctx, &theme, &texts, &mut focus, state, SAMPLE_NOW_MS);
        })
    }

    #[test]
    fn period_ranges_follow_the_calendar() {
        let now = date::start_of_month_ms(2026, 11) + 5 * SAMPLE_DAY_MS;

        assert_eq!(
            Period::Month.range(now),
            (
                date::start_of_month_ms(2026, 11),
                date::start_of_month_ms(2026, 12)
            )
        );
        assert_eq!(
            Period::Quarter.range(now),
            (
                date::start_of_month_ms(2026, 10),
                date::start_of_month_ms(2027, 1)
            )
        );
        assert_eq!(
            Period::Year.range(now),
            (
                date::start_of_month_ms(2026, 1),
                date::start_of_month_ms(2027, 1)
            )
        );
        assert_eq!(Period::All.range(now), (i64::MIN, i64::MAX));
    }

    #[test]
    fn period_ranges_wrap_at_the_year_end() {
        let december = date::start_of_month_ms(2026, 12);
        assert_eq!(
            Period::Month.range(december),
            (
                date::start_of_month_ms(2026, 12),
                date::start_of_month_ms(2027, 1)
            )
        );

        let january = date::start_of_month_ms(2027, 1);
        assert_eq!(
            Period::Month.range(january),
            (
                date::start_of_month_ms(2027, 1),
                date::start_of_month_ms(2027, 2)
            )
        );
    }

    #[test]
    fn sample_summary_changes_with_the_period() {
        let state = sample_state();

        let all = state.data.summary(Period::All, SAMPLE_NOW_MS);
        assert_eq!(all.invoices, 5);
        assert_eq!(all.gross, Money::from_cents(910_350));

        let month = state.data.summary(Period::Month, SAMPLE_NOW_MS);
        assert_eq!(month.invoices, 2);
        assert_eq!(month.gross, Money::from_cents(267_750));

        let quarter = state.data.summary(Period::Quarter, SAMPLE_NOW_MS);
        assert_eq!(quarter.invoices, 4);

        let year = state.data.summary(Period::Year, SAMPLE_NOW_MS);
        assert_eq!(year.invoices, 5);
    }

    #[test]
    fn sample_counts_are_consistent_with_the_lists() {
        let state = sample_state();
        assert_eq!(
            state.data.counts.low_stock as usize,
            state.data.low_stock.len()
        );
        assert_eq!(state.data.recent(5).count(), 5);
        assert!(!state.data.is_empty());
        assert_eq!(state.data.currency(), "€");
    }

    #[test]
    fn renders_kpis_tables_and_the_empty_state() {
        let mut state = sample_state();
        let output = render(&mut state);
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(
            painted.contains(state.data.company.as_str()),
            "company missing"
        );
        assert!(painted.contains("Übersicht"), "title missing");
        assert!(
            painted.contains("Letzte Rechnungen"),
            "invoice list missing"
        );

        let mut empty = DashboardState::new(DashboardData::new(
            "Leer",
            DashboardCounts::default(),
            Vec::new(),
            Vec::new(),
        ));
        let output = render(&mut empty);
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Noch keine Daten"), "empty state missing");
    }

    #[test]
    fn quick_actions_are_reported_once() {
        let mut state = sample_state();
        state.action = Some(DashboardAction::NewInvoice);
        assert_eq!(state.take_action(), Some(DashboardAction::NewInvoice));
        assert_eq!(state.take_action(), None);
    }

    #[test]
    fn period_tabs_map_to_their_labels() {
        for (index, period) in Period::ALL.iter().enumerate() {
            assert_eq!(period.index(), index);
            assert_eq!(Period::from_index(index), *period);
            assert!(period.label_key().starts_with("dashboard_period_"));
        }
        assert_eq!(Period::from_index(99), Period::All);
    }
}
