//! Phone-width layout of the module list screens.
//!
//! The entry forms, the receipt detail and the wizard are covered by `forms.rs` and `wizard.rs`.
//! These tests open the remaining module screens at 432 × 768 and require every painted primitive
//! to stay inside the panel: toolbars, KPI rows, tables and empty states included. A row that only
//! fits its desktop width fails here instead of only in a screenshot.

use egui::{Context, Pos2, RawInput, Rect, Vec2};
use socdof_core::domain::settings::Language;
use socdof_core::store::Store;
use socdof_ui::app_store::{self, AppStoreState};
use socdof_ui::appointments::{self, AppointmentsState};
use socdof_ui::dashboard::{self, DashboardData, DashboardState};
use socdof_ui::documentation::{self, DocumentationState};
use socdof_ui::editor::{self, EditorState};
use socdof_ui::fleet::{self, FleetState};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::invoices::{self, InvoicesState};
use socdof_ui::products::{self, ProductsState};
use socdof_ui::projects::{self, ProjectsState};
use socdof_ui::reports::{self, ReportsState};
use socdof_ui::restaurant::{self, RestaurantState};
use socdof_ui::settings::{self, SettingsState, SettingsTab};
use socdof_ui::snapshot::signature;
use socdof_ui::support::{self, SupportState};
use socdof_ui::theme::{Appearance, Theme};

/// Width of the phone viewport the module screens have to fit.
const PHONE_WIDTH: f32 = 432.0;
/// Height of the phone viewport.
const PHONE_HEIGHT: f32 = 768.0;
/// Right edge of the phone panel; painted primitives may not cross it.
const PANEL_RIGHT: f32 = 432.5;

/// Renders two frames at the phone size — the second one is the settled layout — and returns the
/// signature.
fn render(mut draw: impl FnMut(&Context)) -> Vec<String> {
    let ctx = socdof_ui::theme::headless_context();
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(PHONE_WIDTH, PHONE_HEIGHT),
            )),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| draw(ctx)));
    }
    signature(&output.expect("frame"))
}

/// Right edge of the clip rectangle a signature line was painted with.
fn clip_right(line: &str) -> Option<f32> {
    let rest = line.strip_prefix("clip(")?;
    let end = rest.find(')')?;
    rest[..end].split(',').nth(2)?.trim().parse().ok()
}

/// Whether a shape is cut off at the panel instead of being reachable by scrolling.
///
/// Content inside a horizontal scroll area is clipped before the panel edge (the Settings tab
/// strip does this on purpose); its shapes may lie further right and still be reachable.
fn is_cut_off(line: &str) -> bool {
    clip_right(line).is_some_and(|right| right >= PANEL_RIGHT - 0.5)
}

/// Widest painted right edge with the shape that carries it, ignoring clip rectangles.
///
/// Drop shadows are skipped: they are painted six points outside the card they belong to, so the
/// card's own rectangle is the edge that decides whether a row fits the panel.
fn widest_right(lines: &[String]) -> (f32, String) {
    let mut widest: f32 = 0.0;
    let mut shape = String::new();
    for line in lines {
        if line.contains("Color32([0, 0, 0, 5])") || !is_cut_off(line) {
            continue;
        }
        let Some(rest) = line.split("rect(").nth(1) else {
            continue;
        };
        let values: Vec<f32> = rest
            .split(',')
            .take(4)
            .filter_map(|value| value.trim().parse().ok())
            .collect();
        // The panel background covers the whole viewport and grows with the content; only the
        // shapes on top of it say what actually runs out of the panel.
        let background = values[0] <= 0.01 && values[1] <= 0.01 && values[3] >= PHONE_HEIGHT - 0.5;
        if values.len() == 4 && !background && values[2] > widest {
            widest = values[2];
            shape = line.clone();
        }
    }
    (widest, shape)
}

/// Asserts the screen was painted and that nothing runs past the phone panel.
fn assert_inside(name: &str, lines: &[String], title: &str) {
    let painted = format!("{title:?}");
    assert!(
        lines.iter().any(|line| line.contains(&painted)),
        "{name}: the screen is not on screen"
    );
    let (widest, shape) = widest_right(lines);
    let mut widest_lines: Vec<String> = lines
        .iter()
        .filter(|line| !line.contains("Color32([0, 0, 0, 5])") && is_cut_off(line))
        .filter(|line| {
            let Some(rest) = line.split("rect(").nth(1) else {
                return false;
            };
            let values: Vec<f32> = rest
                .split(',')
                .take(4)
                .filter_map(|value| value.trim().parse().ok())
                .collect();
            values.len() == 4 && values[2] > PANEL_RIGHT
        })
        .cloned()
        .collect();
    widest_lines.sort_by_key(|line| std::cmp::Reverse(line.len()));
    assert!(
        widest <= PANEL_RIGHT,
        "{name}: a painted element reaches {widest} px, the panel ends at {PANEL_RIGHT} px\n{shape}\n\n{:#?}",
        &widest_lines[..widest_lines.len().min(6)]
    );
}

fn theme() -> Theme {
    Theme::new(Appearance::Light, "indigo")
}

fn texts() -> UiTexts {
    UiTexts::embedded(Language::De).expect("catalogue")
}

fn seeds_module(store: &Store, texts: &UiTexts) -> i64 {
    invoices::seed_invoices(store, texts).expect("invoices");
    appointments::seed_appointments(store, texts).expect("appointments");
    products::seed_products(store, texts).expect("products");
    editor::seed_documents(store, texts).expect("documents");
    support::seed_sample(store, texts).expect("support");
    socdof_ui::dashboard::SAMPLE_NOW_MS
}

#[test]
fn the_product_detail_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = ProductsState::new();
    state.refresh(&store).expect("refresh");
    let id = state.products[0].id;
    state.select(id);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        products::products(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("product detail", &lines, texts.get("products_detail_title"));
}

#[test]
fn the_invoice_detail_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = InvoicesState::new();
    state.refresh(&store).expect("refresh");
    let id = state.invoices[0].id;
    state.select(id);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        invoices::invoices(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("invoice detail", &lines, texts.get("invoices_detail_title"));
}

#[test]
fn the_appointment_detail_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = AppointmentsState::new();
    state.refresh(&store).expect("refresh");
    let id = state.appointments[0].id;
    state.select(id);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        appointments::appointments(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside(
        "appointment detail",
        &lines,
        texts.get("appointments_detail_title"),
    );
}

#[test]
fn the_ticket_detail_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = SupportState::new();
    state.refresh(&store).expect("refresh");
    let id = state.tickets[0].id;
    state.select(id);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        support::support(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("ticket detail", &lines, texts.get("support_detail_title"));
    // The stacked time rows must use the translated remove label, not a raw catalogue key.
    let remove = format!("{:?}", texts.get("support_time_delete"));
    assert!(
        lines.iter().any(|line| line.contains(&remove)),
        "the remove action of a tracked time is not painted"
    );
    assert!(
        !lines
            .iter()
            .any(|line| line.contains("support_time_remove")),
        "an untranslated catalogue key is painted"
    );
}

#[test]
fn the_products_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = ProductsState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        products::products(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("products", &lines, texts.get("products_title"));
}

#[test]
fn the_invoices_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = InvoicesState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        invoices::invoices(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("invoices", &lines, texts.get("invoices_title"));
}

#[test]
fn the_reports_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = ReportsState::new();
    state.refresh(&store, now).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        reports::reports(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("reports", &lines, texts.get("reports_title"));
}

#[test]
fn the_appointments_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = AppointmentsState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        appointments::appointments(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("appointments", &lines, texts.get("appointments_title"));
}

#[test]
fn the_restaurant_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = RestaurantState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        restaurant::restaurant(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("restaurant", &lines, texts.get("restaurant_title"));
}

#[test]
fn the_projects_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = ProjectsState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        projects::projects(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("projects", &lines, texts.get("projects_title"));
}

#[test]
fn the_fleet_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = FleetState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        fleet::fleet(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("fleet", &lines, texts.get("fleet_title"));
}

#[test]
fn the_support_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = SupportState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        support::support(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("support", &lines, texts.get("support_title"));
}

#[test]
fn the_editor_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let now = seeds_module(&store, &texts);
    let mut state = EditorState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        editor::editor(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("editor", &lines, texts.get("editor_title"));
}

#[test]
fn the_manual_screen_fits_the_phone_panel() {
    let texts = texts();
    let mut state = DocumentationState::default();
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        documentation::documentation(ctx, &theme, &texts, &mut focus, &mut state);
    });
    assert_inside("manual", &lines, texts.get("docs_title"));
}

#[test]
fn the_dashboard_fits_the_phone_panel() {
    let texts = texts();
    let mut state = DashboardState::new(DashboardData::sample(&texts));
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let lines = render(|ctx| {
        dashboard::dashboard(ctx, &theme, &texts, &mut focus, &mut state, now);
    });
    assert_inside("dashboard", &lines, texts.get("dashboard_title"));
}

#[test]
fn every_settings_tab_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    settings::seed_settings(&store, &texts).expect("seed");
    let mut state = SettingsState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    for tab in SettingsTab::ALL {
        state.set_tab(tab);
        let lines = render(|ctx| {
            settings::settings(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
        });
        assert_inside(
            &format!("settings {tab:?}"),
            &lines,
            texts.get("settings_title"),
        );
    }
}

#[test]
fn the_app_store_screen_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = texts();
    let mut state = AppStoreState::new();
    state.refresh(&store).expect("refresh");
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(|ctx| {
        app_store::app_store(ctx, &theme, &texts, &mut focus, &mut state, &store);
    });
    assert_inside("app store", &lines, texts.get("app_store_title"));
}
