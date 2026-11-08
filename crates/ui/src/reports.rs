//! Reports module screen: revenue, payments and tracked time per period.
//!
//! The screen is a thin view over [`Store::report`]: the core gathers the invoices of the period with
//! their contact names and totals, adds the tracked minutes of the same range and returns a
//! [`socdof_core::store::reports::Report`]. Nothing is recomputed here, so the figures of the report
//! cannot drift from the invoices, the payments or the time entries.
//!
//! The period is a filter over the same report, the per-state totals show where the revenue stands,
//! and the table lists the invoices of the period. Every visible string comes from the catalogue and
//! all painting uses the design tokens.

use egui::{Context, ProgressBar, RichText};
use socdof_core::money::Money;
use socdof_core::store::reports::{status_index, Report, STATUS_ORDER};
use socdof_core::store::Store;

use crate::components::{badge, button, card, empty_state, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample report, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::contacts::SAMPLE_NOW_MS;

/// Milliseconds of one day.
const DAY_MS: i64 = 86_400_000;

/// Supported period lengths in days, in button order.
const PERIOD_DAYS: [i64; 4] = [7, 30, 90, 365];

/// Catalogue keys of the period buttons, in [`PERIOD_DAYS`] order.
const PERIOD_KEYS: [&str; 4] = [
    "reports_period_7",
    "reports_period_30",
    "reports_period_90",
    "reports_period_365",
];

/// Catalogue keys of the five invoice states, in [`STATUS_ORDER`] order.
const STATUS_KEYS: [&str; 5] = [
    "reports_status_draft",
    "reports_status_sent",
    "reports_status_paid",
    "reports_status_overdue",
    "reports_status_cancelled",
];

/// Currency symbol of the report; SOCDOF bills in euro.
pub const CURRENCY: &str = "€";

/// State of the reports screen.
#[derive(Debug, Clone, Default)]
pub struct ReportsState {
    /// Index into [`PERIOD_DAYS`]; the default is the last 30 days.
    pub period: usize,
    /// Report of the selected period.
    pub report: Option<Report>,
    /// Catalogue key of the load error.
    pub error: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded: Option<(usize, i64)>,
}

impl ReportsState {
    /// Creates the screen with the 30 day period selected.
    pub fn new() -> Self {
        Self {
            period: 1,
            ..Self::default()
        }
    }

    /// Length of the selected period in days.
    pub fn days(&self) -> i64 {
        PERIOD_DAYS[self.period.min(PERIOD_DAYS.len() - 1)]
    }

    /// Half-open range of the selected period, ending at `now`.
    pub fn span(&self, now: i64) -> (i64, i64) {
        (now - self.days() * DAY_MS, now + 1)
    }

    /// Reloads the report when the period changed or a new day started.
    pub fn refresh(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let day = now.div_euclid(DAY_MS);
        if self.loaded == Some((self.period, day)) && self.report.is_some() {
            return Ok(());
        }

        let (from, to) = self.span(now);
        self.report = Some(store.report(from, to)?);
        self.loaded = Some((self.period, day));
        Ok(())
    }

    /// Selects another period; the next [`ReportsState::refresh`] reloads the report.
    pub fn select_period(&mut self, period: usize) {
        if period < PERIOD_DAYS.len() {
            self.period = period;
            self.loaded = None;
        }
    }

    /// Reloads the module state before it is shown, as the desktop does when an app is launched.
    pub fn reset_for_open(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        self.period = 1;
        self.back = false;
        self.error = None;
        self.loaded = None;
        self.refresh(store, now)
    }
}

/// Formats a timestamp as `dd.mm.yyyy` without depending on the platform locale.
pub fn format_date(millis: i64) -> String {
    let (year, month, day) = civil_from_days(millis.div_euclid(DAY_MS));
    format!("{day:02}.{month:02}.{year}")
}

/// Converts days since the Unix epoch into a Gregorian date (Howard Hinnant's algorithm).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = (z - era * 146_097) as u64;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era as i64 + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_index + 2) / 5 + 1) as u32;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    } as u32;
    (if month <= 2 { year + 1 } else { year }, month, day)
}

fn money(value: Money) -> String {
    value.format_localized(CURRENCY)
}

fn kpi(ui: &mut egui::Ui, theme: &Theme, label: &str, value: &str) {
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(4.0);
        ui.label(RichText::new(value).size(FONT_TITLE).strong());
    });
}

/// Renders the reports screen into the context.
pub fn reports(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ReportsState,
    store: &Store,
    now: i64,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        state.back = true;
    }

    if state.refresh(store, now).is_err() {
        state.error = Some("reports_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| body(ui, theme, texts, focus, state));
        });
}

fn body(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ReportsState,
) {
    let subtitle = format!(
        "{} {} {}",
        texts.get("reports_period_label"),
        state.days(),
        texts.get("reports_period_unit")
    );
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("reports"),
            title: texts.get("reports_title"),
            subtitle: &subtitle,
            status: None,
        },
        &mut state.back,
    );
    ui.add_space(8.0);
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
        ui.add_space(6.0);
    }

    let mut chosen = None;
    ui.horizontal_wrapped(|ui| {
        for (index, key) in PERIOD_KEYS.iter().enumerate() {
            let variant = if index == state.period {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, texts.get(key), variant).activated {
                chosen = Some(index);
            }
        }
    });
    if let Some(index) = chosen {
        state.select_period(index);
    }

    let Some(report) = state.report.clone() else {
        ui.add_space(12.0);
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("reports_empty_title"),
                texts.get("reports_empty_hint"),
            );
        });
        return;
    };

    ui.add_space(12.0);
    ui.columns(4, |columns| {
        kpi(
            &mut columns[0],
            theme,
            texts.get("reports_kpi_invoices"),
            &report.summary.invoices.to_string(),
        );
        kpi(
            &mut columns[1],
            theme,
            texts.get("reports_kpi_gross"),
            &money(report.summary.gross),
        );
        kpi(
            &mut columns[2],
            theme,
            texts.get("reports_kpi_paid"),
            &money(report.summary.paid),
        );
        kpi(
            &mut columns[3],
            theme,
            texts.get("reports_kpi_open"),
            &money(report.summary.open),
        );
    });

    ui.add_space(12.0);
    ui.columns(3, |columns| {
        kpi(
            &mut columns[0],
            theme,
            texts.get("reports_kpi_net"),
            &money(report.summary.net),
        );
        kpi(
            &mut columns[1],
            theme,
            texts.get("reports_kpi_tax"),
            &money(report.summary.tax),
        );
        kpi(
            &mut columns[2],
            theme,
            texts.get("reports_kpi_hours"),
            &format!("{:.2} h", report.summary.minutes as f64 / 60.0),
        );
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("reports_states_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(8.0);
        let gross = report.summary.gross.cents().max(0);
        for (index, status) in STATUS_ORDER.iter().enumerate() {
            let total = report.status_totals[status_index(*status)];
            let ratio = if gross > 0 {
                (total.cents() as f32 / gross as f32).clamp(0.0, 1.0)
            } else {
                0.0
            };
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(STATUS_KEYS[index]))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money(total)).size(FONT_SMALL));
            });
            ui.add(ProgressBar::new(ratio).desired_width(ui.available_width()));
            ui.add_space(6.0);
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("reports_table_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(8.0);
        if report.rows.is_empty() {
            ui.label(
                RichText::new(texts.get("reports_no_rows"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            return;
        }
        egui::Grid::new("socdof-reports-table")
            .num_columns(5)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "reports_col_number",
                    "reports_col_contact",
                    "reports_col_date",
                    "reports_col_status",
                    "reports_col_gross",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for row in &report.rows {
                    ui.label(&row.number);
                    ui.label(&row.contact);
                    ui.label(format_date(row.issued_at));
                    badge(
                        ui,
                        theme,
                        texts.get(STATUS_KEYS[status_index(row.status)]),
                        match row.status {
                            socdof_core::domain::invoice::InvoiceStatus::Paid => Tone::Success,
                            socdof_core::domain::invoice::InvoiceStatus::Overdue => Tone::Danger,
                            _ => Tone::Accent,
                        },
                    );
                    ui.label(money(row.gross));
                    ui.end_row();
                }
            });
    });
}

/// Seeds nothing: the report reads the invoices and time entries that already exist.
///
/// The gallery seeds invoices through [`crate::invoices::seed_invoices`], so the module shows real
/// data there without a second sample set.
pub fn seed_sample() {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::settings::Language;

    fn render(state: &mut ReportsState, store: &Store) -> String {
        let ctx = Context::default();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(900.0, 1400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                reports(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("reports frame")).join("\n")
    }

    #[test]
    fn formats_dates_without_a_locale() {
        assert_eq!(format_date(0), "01.01.1970");
        assert_eq!(format_date(86_399_999), "01.01.1970");
        assert_eq!(format_date(1_760_000_000_000), "09.10.2025");
    }

    #[test]
    fn switches_periods_and_reloads() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ReportsState::new();
        state.refresh(&store, SAMPLE_NOW_MS).expect("report");
        assert_eq!(state.days(), 30);
        let (from, to) = state.span(SAMPLE_NOW_MS);
        assert_eq!(to - from, 30 * DAY_MS + 1);

        state.select_period(3);
        assert_eq!(state.days(), 365);
        state.refresh(&store, SAMPLE_NOW_MS).expect("report");
        let report = state.report.as_ref().expect("report");
        assert_eq!(report.to - report.from, 365 * DAY_MS + 1);
    }

    #[test]
    fn reports_the_seeded_invoices() {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        crate::invoices::seed_invoices(&store, &texts).expect("seed invoices");

        let mut state = ReportsState::new();
        state.refresh(&store, SAMPLE_NOW_MS).expect("report");
        let report = state.report.as_ref().expect("report");
        assert!(report.summary.invoices > 0);
        assert!(report.summary.gross.cents() > 0);

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("reports_title")));
        assert!(painted.contains(texts.get("reports_kpi_gross")));
        assert!(painted.contains(texts.get("reports_col_number")));
    }
}
