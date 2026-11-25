//! Systematic 432 px overflow sweep over every screen of the application.
//!
//! `crates/ui/tests/phone.rs` checks individual screens. This module walks the complete surface
//! instead: every module registered in [`ALL_MODULES`], every view of every module view enum,
//! every settings tab, every form, the delete/cancel dialogs, open dropdowns, the toast stack and
//! the authentication screens. Each case is painted at 360, 390, 412 and 432 px wide in both the
//! light and the dark theme and fails when a painted shape crosses the right panel edge.
//!
//! The sweep cannot silently miss a new screen: the module list is asserted against
//! [`ALL_MODULES`], and every view enum is matched exhaustively while the cases are built, so a new
//! variant stops the test crate from compiling until it has a case.
//!
//! Only two kinds of shapes are ignored, both documented at the filter: drop shadows (painted six
//! points outside the card they belong to) and content that a narrower clip rectangle already
//! scrolled out of view (horizontal tab strips). A panel background is ignored because it grows
//! with the content instead of describing it.

use std::cell::Cell;

use egui::{Context, Id, Pos2, RawInput, Rect, Vec2};
use socdof_core::domain::permission::{AppModule, Role, ALL_MODULES};
use socdof_core::domain::settings::Language;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::accounting::{AccountingPeriod, AccountingState, AccountingTab, AccountingView};
use crate::app_store::AppStoreState;
use crate::appointments::{AppointmentsDetail, AppointmentsState, AppointmentsView};
use crate::auth::{AuthState, AuthView, SETUP_STEPS};
use crate::contacts::{ContactsState, ContactsView};
use crate::dashboard::{DashboardData, DashboardState, Period};
use crate::desktop::{AppId, DesktopFrame, DesktopIcon, IconGrid, WindowManager};
use crate::documentation::DocumentationState;
use crate::editor::EditorState;
use crate::fleet::{FleetState, FleetView};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::invoices::{InvoicesState, InvoicesView};
use crate::pos::{PosState, PosView};
use crate::products::{ProductsState, ProductsView};
use crate::projects::{ProjectsState, ProjectsView};
use crate::purchases::{PurchasesState, PurchasesView};
use crate::reports::ReportsState;
use crate::restaurant::{RestaurantState, RestaurantView};
use crate::settings::{SettingsIntent, SettingsState, SettingsTab};
use crate::shell::ShellState;
use crate::studio::StudioTab;
use crate::support::{SupportState, SupportView};
use crate::theme::{Appearance, Theme};
use crate::therapie::{TherapieState, TherapieView};
use crate::users::{UsersState, UsersView};

/// Real phone widths the sweep renders every case at.
const PHONE_WIDTHS: [f32; 4] = [360.0, 390.0, 412.0, 432.0];
/// Height of the phone viewport.
const PHONE_HEIGHT: f32 = 768.0;

thread_local! {
    /// Width of the case currently being painted.
    static VIEWPORT_WIDTH: Cell<f32> = const { Cell::new(432.0) };
    /// Appearance of the case currently being painted.
    static VIEWPORT_APPEARANCE: Cell<Appearance> = const { Cell::new(Appearance::Light) };
}

fn viewport_width() -> f32 {
    VIEWPORT_WIDTH.with(Cell::get)
}

fn viewport_appearance() -> Appearance {
    VIEWPORT_APPEARANCE.with(Cell::get)
}

/// Right edge of the phone panel; painted primitives may not cross it.
fn panel_right() -> f32 {
    viewport_width() + 0.5
}

/// Renders two frames at the current phone size and returns the settled paint signature.
fn render(mut draw: impl FnMut(&Context)) -> Vec<String> {
    let ctx = crate::theme::headless_context();
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(viewport_width(), PHONE_HEIGHT),
            )),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| draw(ctx)));
    }
    crate::snapshot::signature(&output.expect("frame"))
}

/// Whether a painted line is a card drop shadow rather than content.
///
/// Cards paint six points of shadow outside their frame; those shapes describe the card, not an
/// element that overflows it. The wizard card uses a slightly blue-tinted shadow, all other cards
/// use pure black.
fn is_drop_shadow(line: &str) -> bool {
    line.contains("Color32([0, 0, 0, 5])") || line.contains("Color32([0, 0, 1, 5])")
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
    clip_right(line).is_some_and(|right| right >= panel_right() - 0.5)
}

/// Widest painted right edge with the shape that carries it.
fn widest_right(lines: &[String]) -> (f32, String) {
    let mut widest: f32 = 0.0;
    let mut shape = String::new();
    for line in lines {
        if is_drop_shadow(line) || !is_cut_off(line) {
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

/// Settings editor and dialog flows that need their own case, independent of the module count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SettingsFlow {
    UserEditor,
    NewUser,
    RoleEditor,
    NewRole,
    DeleteConfirm,
    RestoreConfirm,
    ConfirmDeleteUser,
    ConfirmDeleteRole,
    ConfirmRestore,
    EditorDelete,
    EditorSaveUser,
    EditorSaveRole,
    EditorPermissionToggle,
    EditorRoleDelete,
    LanguagePopup,
}

/// Flows of the component gallery that need real pointer input, independent of the module count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GalleryFlow {
    Open,
    Choose,
    Pair,
    Selects,
    Conditional,
    MenuConditional,
    Mirror,
}

const GALLERY_FLOWS: [GalleryFlow; 7] = [
    GalleryFlow::Open,
    GalleryFlow::Choose,
    GalleryFlow::Pair,
    GalleryFlow::Selects,
    GalleryFlow::Conditional,
    GalleryFlow::MenuConditional,
    GalleryFlow::Mirror,
];

const SETTINGS_FLOWS: [SettingsFlow; 15] = [
    SettingsFlow::UserEditor,
    SettingsFlow::NewUser,
    SettingsFlow::RoleEditor,
    SettingsFlow::NewRole,
    SettingsFlow::DeleteConfirm,
    SettingsFlow::RestoreConfirm,
    SettingsFlow::ConfirmDeleteUser,
    SettingsFlow::ConfirmDeleteRole,
    SettingsFlow::ConfirmRestore,
    SettingsFlow::EditorDelete,
    SettingsFlow::EditorSaveUser,
    SettingsFlow::EditorSaveRole,
    SettingsFlow::EditorPermissionToggle,
    SettingsFlow::EditorRoleDelete,
    SettingsFlow::LanguagePopup,
];

/// Collects cases, the modules they cover and the overflows they found.
#[derive(Default)]
struct Report {
    failures: Vec<String>,
    cases: usize,
    covered: Vec<AppModule>,
    covered_flows: Vec<SettingsFlow>,
    covered_gallery: Vec<GalleryFlow>,
}

impl Report {
    /// Marks a module as covered.
    fn cover(&mut self, module: AppModule) {
        if !self.covered.contains(&module) {
            self.covered.push(module);
        }
    }

    /// Marks a settings editor or dialog flow as covered.
    fn cover_flow(&mut self, flow: SettingsFlow) {
        if !self.covered_flows.contains(&flow) {
            self.covered_flows.push(flow);
        }
    }

    /// Marks a gallery flow as covered.
    fn cover_gallery(&mut self, flow: GalleryFlow) {
        if !self.covered_gallery.contains(&flow) {
            self.covered_gallery.push(flow);
        }
    }

    /// Paints one case and records an overflow instead of stopping at the first one.
    ///
    /// The case counts as painted when the frame contains at least one text primitive; the view
    /// itself is selected structurally through the state before the call, so a blank frame means a
    /// screen did not render at all. `_painted` documents the label the case expects for readers;
    /// headers change per view, so it is not asserted here.
    fn case(&mut self, name: &str, _painted: &str, draw: impl FnMut(&Context)) {
        self.cases += 1;
        let name = format!(
            "{name} at {} × {PHONE_HEIGHT} px, {:?}",
            viewport_width(),
            viewport_appearance()
        );
        let lines = render(draw);
        if !lines.iter().any(|line| line.contains("text(")) {
            self.failures.push(format!("{name}: nothing was painted"));
            return;
        }
        let (widest, shape) = widest_right(&lines);
        if widest > panel_right() {
            let mut offenders: Vec<String> = lines
                .iter()
                .filter(|line| !is_drop_shadow(line) && is_cut_off(line))
                .cloned()
                .collect();
            offenders.sort_by_key(|line| std::cmp::Reverse(line.len()));
            self.failures.push(format!(
                "{name}: a painted element reaches {widest} px, the panel ends at {} px\n{shape}\n{:#?}",
                panel_right(),
                &offenders[..offenders.len().min(4)]
            ));
        }
    }
}

fn theme() -> Theme {
    Theme::new(viewport_appearance(), "indigo")
}

fn texts() -> UiTexts {
    UiTexts::embedded(Language::De).expect("catalogue")
}

/// Creates the in-memory store with every module sample the screens can show.
fn seeded_store(texts: &UiTexts) -> Store {
    let store = Store::open_in_memory().expect("store");
    crate::invoices::seed_invoices(&store, texts).expect("invoices");
    crate::appointments::seed_appointments(&store, texts).expect("appointments");
    crate::products::seed_products(&store, texts).expect("products");
    crate::editor::seed_documents(&store, texts).expect("documents");
    crate::support::seed_sample(&store, texts).expect("support");
    crate::contacts::seed_sample(&store, texts).expect("contacts");
    crate::accounting::seed_accounting(&store, texts).expect("accounting");
    crate::purchases::seed_purchases(&store, texts).expect("purchases");
    crate::pos::seed_pos(&store, texts).expect("pos");
    crate::users::seed_users(&store).expect("users");
    crate::therapie::seed_sample(&store, texts).expect("therapy");
    crate::settings::seed_settings(&store, texts).expect("settings");
    store
}

fn now() -> i64 {
    crate::dashboard::SAMPLE_NOW_MS
}

/// Applies one contact view; the match keeps the enumeration exhaustive.
fn contacts_case(state: &mut ContactsState, view: ContactsView) {
    match view {
        ContactsView::List => state.view = ContactsView::List,
        ContactsView::Detail => {
            state.select(state.contacts[0].id);
        }
        ContactsView::Form => state.start_new(),
    }
}

fn products_case(state: &mut ProductsState, view: ProductsView) {
    match view {
        ProductsView::List => state.view = ProductsView::List,
        ProductsView::Detail => {
            state.select(state.products[0].id);
        }
        ProductsView::Form => state.start_new(),
        ProductsView::Journal => state.view = ProductsView::Journal,
    }
}

fn invoices_case(state: &mut InvoicesState, view: InvoicesView) {
    match view {
        InvoicesView::List => state.view = InvoicesView::List,
        InvoicesView::Detail => {
            state.select(state.invoices[0].id);
        }
        InvoicesView::Form => state.start_new(now()),
    }
}

fn accounting_tabs() -> [AccountingTab; 7] {
    [
        AccountingTab::Journal,
        AccountingTab::CashBook,
        AccountingTab::Bwa,
        AccountingTab::BusinessReport,
        AccountingTab::VatReturn,
        AccountingTab::OpenItems,
        AccountingTab::ZReport,
    ]
}

/// Applies one accounting tab; the match keeps the enumeration exhaustive.
fn accounting_tab(state: &mut AccountingState, tab: AccountingTab) {
    match tab {
        AccountingTab::Journal => state.tab = AccountingTab::Journal,
        AccountingTab::CashBook => state.tab = AccountingTab::CashBook,
        AccountingTab::Bwa => state.tab = AccountingTab::Bwa,
        AccountingTab::BusinessReport => state.tab = AccountingTab::BusinessReport,
        AccountingTab::VatReturn => state.tab = AccountingTab::VatReturn,
        AccountingTab::OpenItems => state.tab = AccountingTab::OpenItems,
        AccountingTab::ZReport => state.tab = AccountingTab::ZReport,
    }
}

fn accounting_case(state: &mut AccountingState, view: AccountingView) {
    match view {
        AccountingView::List => state.view = AccountingView::List,
        AccountingView::Detail => {
            if let Some(entry) = state.entries.first() {
                state.select(entry.id);
            }
        }
        AccountingView::Form => state.start_new(),
    }
}

fn purchases_case(state: &mut PurchasesState, view: PurchasesView) {
    match view {
        PurchasesView::List => state.view = PurchasesView::List,
        PurchasesView::Detail => {
            if let Some(order) = state.orders.first() {
                state.select(order.id);
            }
        }
        PurchasesView::Form => state.start_new(now()),
    }
}

fn pos_case(state: &mut PosState, view: PosView) {
    match view {
        PosView::List => state.view = PosView::List,
        PosView::Detail => {
            if let Some(receipt) = state.orders.first() {
                state.select(receipt.id);
            }
        }
        PosView::Form => state.start_new(now()),
    }
}

fn users_case(state: &mut UsersState, view: UsersView) {
    match view {
        UsersView::List => state.view = UsersView::List,
        UsersView::Detail => {
            if let Some(user) = state.users.first() {
                state.select(user.id);
            }
        }
        UsersView::Form => state.start_new(),
    }
}

fn support_case(state: &mut SupportState, view: SupportView) {
    match view {
        SupportView::List => state.view = SupportView::List,
        SupportView::Detail => {
            if let Some(ticket) = state.tickets.first() {
                state.select(ticket.id);
            }
        }
        SupportView::Form => state.start_new(),
    }
}

fn appointments_case(state: &mut AppointmentsState, view: AppointmentsView) {
    match view {
        AppointmentsView::Month => state.view = AppointmentsView::Month,
        AppointmentsView::Week => state.view = AppointmentsView::Week,
        AppointmentsView::Day => state.view = AppointmentsView::Day,
    }
}

fn appointments_detail(state: &mut AppointmentsState, detail: AppointmentsDetail) {
    match detail {
        AppointmentsDetail::Calendar => state.screen = AppointmentsDetail::Calendar,
        AppointmentsDetail::Detail => {
            if let Some(appointment) = state.appointments.first() {
                state.select(appointment.id);
            }
        }
        AppointmentsDetail::Form => state.start_new(),
    }
}

fn projects_case(state: &mut ProjectsState, view: ProjectsView) {
    match view {
        ProjectsView::Portfolio => state.view = ProjectsView::Portfolio,
        ProjectsView::Kanban => state.view = ProjectsView::Kanban,
        ProjectsView::Tasks => state.view = ProjectsView::Tasks,
    }
}

fn fleet_case(state: &mut FleetState, view: FleetView) {
    match view {
        FleetView::Logbook => state.view = FleetView::Logbook,
        FleetView::Vehicles => state.view = FleetView::Vehicles,
        FleetView::Fuel => state.view = FleetView::Fuel,
        FleetView::Analytics => state.view = FleetView::Analytics,
    }
}

fn restaurant_case(state: &mut RestaurantState, view: RestaurantView) {
    match view {
        RestaurantView::Tables => state.view = RestaurantView::Tables,
        RestaurantView::Kitchen => state.view = RestaurantView::Kitchen,
        RestaurantView::Menu => state.view = RestaurantView::Menu,
        RestaurantView::History => state.view = RestaurantView::History,
    }
}

fn dashboard_case(state: &mut DashboardState, period: Period) {
    match period {
        Period::All => state.period = Period::All,
        Period::Month => state.period = Period::Month,
        Period::Quarter => state.period = Period::Quarter,
        Period::Year => state.period = Period::Year,
    }
}

fn auth_case(state: &mut AuthState, view: AuthView) {
    match view {
        AuthView::Login => state.view = AuthView::Login,
        AuthView::Setup => state.view = AuthView::Setup,
        AuthView::Locked => state.view = AuthView::Locked,
        AuthView::Unlocked => state.view = AuthView::Unlocked,
        AuthView::Recover => state.view = AuthView::Recover,
        AuthView::ChangePassword => state.view = AuthView::ChangePassword,
    }
}

#[test]
fn every_screen_fits_the_phone_panel() {
    let texts = texts();
    let mut failures = Vec::new();
    let mut cases = 0;
    let mut per_combo = Vec::new();
    for width in PHONE_WIDTHS {
        for appearance in [Appearance::Light, Appearance::Dark] {
            VIEWPORT_WIDTH.with(|cell| cell.set(width));
            VIEWPORT_APPEARANCE.with(|cell| cell.set(appearance));
            // Every width/theme combination starts from fresh sample data so mutations in a case
            // cannot leak into the next run.
            let store = seeded_store(&texts);
            let theme = theme();
            let now = now();
            let mut focus = FocusState::default();
            let mut report = Report::default();

            sweep_dashboard(&theme, &texts, now, &mut focus, &mut report);
            sweep_contacts(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_products(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_invoices(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_accounting(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_purchases(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_pos(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_appointments(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_settings(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_users(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_editor(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_app_store(&store, &theme, &texts, &mut focus, &mut report);
            sweep_support(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_reports(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_therapie(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_projects(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_fleet(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_restaurant(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_documentation(&theme, &texts, &mut focus, &mut report);
            sweep_auth(&store, &theme, &texts, now, &mut focus, &mut report);
            sweep_desktop(&store, &theme, &texts, now, &mut report);
            sweep_overlays(&theme, &texts, &mut focus, &mut report);
            sweep_gallery_menu(&texts, &mut report);
            sweep_gallery_selects(&texts, &mut report);
            sweep_gallery_conditional_selects(&texts, &mut report);
            sweep_gallery_conditional_menu(&texts, &mut report);
            sweep_gallery_mirror(&texts, &mut report);

            // Completeness: a module that is registered but has no case above fails here instead
            // of silently dropping out of the sweep for one width or theme.
            for module in ALL_MODULES {
                assert!(
                    report.covered.contains(&module),
                    "{module:?} is registered in ALL_MODULES but the phone sweep does not cover it \
                     at {width} px, {appearance:?}"
                );
            }
            // The same guarantee for every settings editor and dialog flow: a new dialog without
            // a case is named here instead of being silently untested.
            for flow in SETTINGS_FLOWS {
                assert!(
                    report.covered_flows.contains(&flow),
                    "{flow:?} is a settings editor or dialog flow but the phone sweep does not \
                     cover it at {width} px, {appearance:?}"
                );
            }
            // The component gallery is not one of the 18 module entries; its menu flow has its own
            // registry so a new flow that is not clicked cannot slip through.
            for flow in GALLERY_FLOWS {
                assert!(
                    report.covered_gallery.contains(&flow),
                    "{flow:?} is a gallery flow but the phone sweep does not cover it at {width} \
                     px, {appearance:?}"
                );
            }
            assert!(
                report.cases > 80,
                "the sweep only produced {} cases at {width} px, {appearance:?}; the enumeration \
                 lost screens",
                report.cases
            );
            println!(
                "phone sweep: {width} px {appearance:?}: {} modules, {} settings flows, {} gallery \
                 flows, {} cases, {} overflows",
                report.covered.len(),
                report.covered_flows.len(),
                report.covered_gallery.len(),
                report.cases,
                report.failures.len()
            );
            cases += report.cases;
            per_combo.push(report.cases);
            failures.extend(report.failures);
        }
    }
    // Every width/theme combination must enumerate the same number of cases; a case that is only
    // built for one width would otherwise slip through unnoticed.
    let expected = per_combo.first().copied().unwrap_or(0);
    assert!(
        per_combo.iter().all(|count| *count == expected),
        "the phone sweep enumerated different case counts per width/theme: {per_combo:?}"
    );
    println!(
        "phone sweep total: {} cases across {} width/theme combinations, {} overflows",
        cases,
        per_combo.len(),
        failures.len()
    );
    assert!(
        failures.is_empty(),
        "{} of {} phone cases (360/390/412/432 px, light/dark) overflow their panel:\n\n{}",
        failures.len(),
        cases,
        failures.join("\n\n")
    );
}

fn sweep_dashboard(
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Dashboard);
    let mut state = DashboardState::new(DashboardData::sample(texts));
    for period in Period::ALL {
        dashboard_case(&mut state, period);
        report.case(
            &format!("dashboard {period:?}"),
            texts.get("dashboard_title"),
            |ctx| {
                crate::dashboard::dashboard(ctx, theme, texts, focus, &mut state, now);
            },
        );
    }
}

fn sweep_contacts(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Contacts);
    let mut state = ContactsState::new();
    state.refresh(store).expect("refresh");
    for view in [ContactsView::List, ContactsView::Detail, ContactsView::Form] {
        contacts_case(&mut state, view);
        report.case(
            &format!("contacts {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    // Open category dropdown on the form.
    contacts_case(&mut state, ContactsView::Form);
    state.type_popup.open = Some(0);
    report.case(
        "contacts form dropdown",
        texts.get("contacts_title"),
        |ctx| {
            crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.type_popup.open = None;
    // Country suggestion list below the field.
    state.country_open = true;
    report.case(
        "contacts form country list",
        texts.get("contacts_title"),
        |ctx| {
            crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.country_open = false;
    // Batch creation dialog with three rows.
    contacts_case(&mut state, ContactsView::List);
    state.batch_open = true;
    state.batch_drafts = vec![crate::contacts::ContactDraft::default(); 3];
    report.case(
        "contacts batch dialog",
        texts.get("contacts_title"),
        |ctx| {
            crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.batch_open = false;
    // Import preview with the seeded contacts.
    state.import_open = true;
    state.import_preview = state.contacts.iter().take(4).cloned().collect();
    state.import_file_name = "kontakte-2026.csv".to_string();
    report.case(
        "contacts import preview",
        texts.get("contacts_title"),
        |ctx| {
            crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.import_open = false;
    // Delete confirmation.
    state.select(state.contacts[0].id);
    state.confirm_delete = true;
    report.case(
        "contacts delete dialog",
        texts.get("contacts_detail_title"),
        |ctx| {
            crate::contacts::contacts(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
}

fn sweep_products(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Products);
    let mut state = ProductsState::new();
    state.refresh(store).expect("refresh");
    for view in [
        ProductsView::List,
        ProductsView::Detail,
        ProductsView::Form,
        ProductsView::Journal,
    ] {
        products_case(&mut state, view);
        report.case(
            &format!("products {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::products::products(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    state.select(state.products[0].id);
    state.confirm_delete = true;
    report.case(
        "products delete dialog",
        texts.get("products_detail_title"),
        |ctx| {
            crate::products::products(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
}

fn sweep_invoices(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Invoices);
    let mut state = InvoicesState::new();
    state.refresh(store).expect("refresh");
    for view in [InvoicesView::List, InvoicesView::Detail, InvoicesView::Form] {
        invoices_case(&mut state, view);
        report.case(
            &format!("invoices {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::invoices::invoices(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    state.select(state.invoices[0].id);
    state.confirm_delete = true;
    report.case(
        "invoices delete dialog",
        texts.get("invoices_detail_title"),
        |ctx| {
            crate::invoices::invoices(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
}

fn sweep_accounting(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Accounting);
    let mut state = AccountingState::new();
    state.refresh(store, now).expect("refresh");
    for tab in accounting_tabs() {
        accounting_tab(&mut state, tab);
        accounting_case(&mut state, AccountingView::List);
        report.case(
            &format!("accounting {tab:?}"),
            texts.get("accounting_title"),
            |ctx| {
                crate::accounting::accounting(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    for view in [AccountingView::Detail, AccountingView::Form] {
        accounting_case(&mut state, view);
        report.case(
            &format!("accounting {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::accounting::accounting(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    for period in AccountingPeriod::ALL {
        state.period = period;
        state.tab = AccountingTab::Journal;
        accounting_case(&mut state, AccountingView::List);
        report.case(
            &format!("accounting period {period:?}"),
            texts.get("accounting_title"),
            |ctx| {
                crate::accounting::accounting(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    // A filled custom range draws the two date fields with real values; the empty range above
    // draws the validation band.
    state.period = AccountingPeriod::Custom;
    state.custom_from = "2026-11-01".to_string();
    state.custom_to = "2026-11-23".to_string();
    accounting_case(&mut state, AccountingView::List);
    report.case(
        "accounting custom range",
        texts.get("accounting_title"),
        |ctx| {
            crate::accounting::accounting(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.period = AccountingPeriod::All;
    if let Some(entry) = state.entries.first() {
        state.select(entry.id);
        state.confirm_delete = true;
        report.case(
            "accounting delete dialog",
            texts.get("accounting_detail_title"),
            |ctx| {
                crate::accounting::accounting(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_purchases(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Purchases);
    let mut state = PurchasesState::new();
    state.refresh(store).expect("refresh");
    for view in [
        PurchasesView::List,
        PurchasesView::Detail,
        PurchasesView::Form,
    ] {
        purchases_case(&mut state, view);
        report.case(
            &format!("purchases {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::purchases::purchases(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    if let Some(order) = state.orders.first() {
        state.select(order.id);
        state.confirm_delete = true;
        report.case(
            "purchases delete dialog",
            texts.get("purchases_detail_title"),
            |ctx| {
                crate::purchases::purchases(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
        state.confirm_delete = false;
    }
    // The longest catalogue message: at 360 px the pill must wrap into several lines instead of
    // painting past the panel.
    state.view = PurchasesView::List;
    state.error = Some("accounting_error_period");
    report.case("purchases long error badge", "", |ctx| {
        crate::purchases::purchases(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.error = None;
}

fn sweep_pos(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Pos);
    let mut state = PosState::new();
    state.refresh(store).expect("refresh");
    for view in [PosView::List, PosView::Detail, PosView::Form] {
        pos_case(&mut state, view);
        report.case(
            &format!("pos {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::pos::pos(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    // Open payment dropdown in the form.
    pos_case(&mut state, PosView::Form);
    state.payment_popup.open = Some(0);
    report.case("pos form dropdown", texts.get("pos_title"), |ctx| {
        crate::pos::pos(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.payment_popup.open = None;
    if let Some(receipt) = state.orders.first() {
        state.select(receipt.id);
        state.confirm_cancel = true;
        report.case("pos cancel dialog", texts.get("pos_detail_title"), |ctx| {
            crate::pos::pos(ctx, theme, texts, focus, &mut state, store, now);
        });
    }
}

fn sweep_appointments(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Calendar);
    let mut state = AppointmentsState::new();
    state.refresh(store).expect("refresh");
    for view in [
        AppointmentsView::Month,
        AppointmentsView::Week,
        AppointmentsView::Day,
    ] {
        appointments_case(&mut state, view);
        report.case(
            &format!("calendar {view:?}"),
            texts.get("appointments_title"),
            |ctx| {
                crate::appointments::appointments(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    for detail in [
        AppointmentsDetail::Detail,
        AppointmentsDetail::Form,
        AppointmentsDetail::Calendar,
    ] {
        appointments_detail(&mut state, detail);
        report.case(
            &format!("calendar {detail:?}"),
            texts.get("appointments_title"),
            |ctx| {
                crate::appointments::appointments(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    if let Some(appointment) = state.appointments.first() {
        state.select(appointment.id);
        state.confirm_delete = true;
        report.case(
            "calendar delete dialog",
            texts.get("appointments_detail_title"),
            |ctx| {
                crate::appointments::appointments(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_settings(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Settings);
    let mut state = SettingsState::new();
    state.refresh(store).expect("refresh");
    for tab in SettingsTab::ALL {
        state.set_tab(tab);
        report.case(
            &format!("settings {tab:?}"),
            texts.get("settings_title"),
            |ctx| {
                crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    // The editors are painted here for the overflow check; their Save buttons are pressed with
    // real pointer input at every phone width in the settings module's own tests.
    state.set_tab(SettingsTab::Users);
    report.cover_flow(SettingsFlow::UserEditor);
    if let Some(id) = state.users().first().map(|user| user.id) {
        state.dispatch(SettingsIntent::EditUser(id), store);
    }
    report.case("settings user form", texts.get("settings_title"), |ctx| {
        crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
    });
    report.cover_flow(SettingsFlow::NewUser);
    state.dispatch(SettingsIntent::NewUser, store);
    report.case(
        "settings new user form",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.set_tab(SettingsTab::Roles);
    report.cover_flow(SettingsFlow::RoleEditor);
    if let Some(id) = state.roles().first().map(|role| role.id) {
        state.dispatch(SettingsIntent::EditRole(id), store);
    }
    report.case("settings role form", texts.get("settings_title"), |ctx| {
        crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
    });
    report.cover_flow(SettingsFlow::NewRole);
    state.dispatch(SettingsIntent::NewRole, store);
    report.case(
        "settings new role form",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.set_tab(SettingsTab::Users);
    report.cover_flow(SettingsFlow::DeleteConfirm);
    if let Some(id) = state.users().first().map(|user| user.id) {
        state.dispatch(SettingsIntent::DeleteUser(id), store);
    }
    report.case(
        "settings delete dialog",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.set_tab(SettingsTab::Backup);
    report.cover_flow(SettingsFlow::RestoreConfirm);
    state.dispatch(
        SettingsIntent::RequestRestore {
            archive: "Backups/SOCDOF/2026-11-23/socdof-backup-2026-11-23-1200.zip".to_string(),
            target: "Restore/SOCDOF-2026-11-23".to_string(),
        },
        store,
    );
    report.case(
        "settings restore dialog",
        texts.get("settings_backup_title"),
        |ctx| {
            crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    state.set_tab(SettingsTab::Language);
    report.cover_flow(SettingsFlow::LanguagePopup);
    state.dispatch(SettingsIntent::OpenLanguagePopup, store);
    report.case(
        "settings language dropdown",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
    sweep_settings_confirmations(texts, theme, now, report);
    sweep_settings_editor_delete(texts, theme, now, report);
    sweep_settings_editor_actions(texts, theme, now, report);
}

/// Drives the real settings screen with pointer and wheel input at the current phone size.
struct SettingsInput<'a> {
    ctx: Context,
    focus: FocusState,
    texts: &'a UiTexts,
    theme: &'a Theme,
    store: &'a Store,
    now: i64,
    /// Frame clock. It has to advance: the settings content scrolls with egui's animated scroll
    /// state, which stands still when every frame reports the same time.
    time: f64,
}

impl<'a> SettingsInput<'a> {
    fn new(texts: &'a UiTexts, theme: &'a Theme, store: &'a Store, now: i64) -> Self {
        Self {
            ctx: crate::theme::headless_context(),
            focus: FocusState::default(),
            texts,
            theme,
            store,
            now,
            time: 1.0,
        }
    }

    fn frame(&mut self, state: &mut SettingsState, events: Vec<egui::Event>) {
        self.time += 1.0 / 60.0;
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(viewport_width(), PHONE_HEIGHT),
            )),
            events,
            time: Some(self.time),
            ..Default::default()
        };
        let Self {
            ctx,
            focus,
            texts,
            theme,
            store,
            now,
            ..
        } = self;
        let _ = ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            crate::settings::settings(ctx, theme, texts, focus, state, store, *now);
            focus.finish_frame();
        });
    }

    /// Presses and releases the button that is `from_end` controls from the end of the focus order
    /// (1 = last control, 2 = the one before it), after scrolling it into the phone viewport.
    fn click_from_end(&mut self, state: &mut SettingsState, from_end: usize) {
        let id = self.visible_button(state, from_end);
        let rect = self.ctx.read_response(id).expect("button was painted").rect;
        let pos = rect.center();
        let button = |pressed| egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        self.frame(state, vec![egui::Event::PointerMoved(pos), button(true)]);
        self.frame(state, vec![egui::Event::PointerMoved(pos), button(false)]);
    }

    /// Paints and scrolls until the button `from_end` controls from the end is fully visible.
    fn visible_button(&mut self, state: &mut SettingsState, from_end: usize) -> egui::Id {
        let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
        let mut previous = None;
        for _ in 0..16 {
            self.frame(state, Vec::new());
            self.frame(state, Vec::new());
            let order = self.focus.order().to_vec();
            assert!(
                order.len() >= from_end,
                "the settings screen painted {} controls at {} px, so the button {from_end} from \
                 the end cannot be addressed",
                order.len(),
                viewport_width()
            );
            let id = order[order.len() - from_end];
            let rect = self.ctx.read_response(id).expect("button was painted").rect;
            if viewport.contains_rect(rect) {
                return id;
            }
            assert!(
                previous != Some(rect),
                "the settings screen does not scroll to the button {from_end} from the end at {} \
                 px: it stays at {rect:?} outside the {PHONE_HEIGHT} px phone viewport",
                viewport_width()
            );
            previous = Some(rect);
            // A control above the viewport has to scroll the content back down, not further up.
            let step = if rect.top() < 0.0 { 240.0 } else { -240.0 };
            let pos = Pos2::new(viewport_width() / 2.0, PHONE_HEIGHT / 2.0);
            self.frame(
                state,
                vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::Scroll(Vec2::new(0.0, step)),
                ],
            );
        }
        panic!(
            "the settings screen never brought the button {from_end} from the end into the {} px \
             phone viewport",
            viewport_width()
        );
    }

    /// Paints until the control `from_end` from the end stops moving, so a click addresses the
    /// settled rectangle instead of one a running scroll animation has already left.
    fn settled_control(&mut self, state: &mut SettingsState, from_end: usize) -> egui::Rect {
        let mut previous = None;
        for _ in 0..40 {
            self.frame(state, Vec::new());
            let order = self.focus.order().to_vec();
            assert!(
                order.len() >= from_end,
                "the settings screen painted {} controls at {} px, so the control {from_end} \
                     from the end cannot be addressed",
                order.len(),
                viewport_width()
            );
            let id = order[order.len() - from_end];
            let rect = self
                .ctx
                .read_response(id)
                .expect("control was painted")
                .rect;
            assert!(
                rect.right() <= panel_right(),
                "the settings control {from_end} from the end at {} px ends at {} px, the panel \
                     ends at {} px",
                viewport_width(),
                rect.right(),
                panel_right()
            );
            if previous == Some(rect) {
                return rect;
            }
            previous = Some(rect);
        }
        let order = self.focus.order().to_vec();
        let id = order[order.len() - from_end];
        self.ctx
            .read_response(id)
            .expect("control was painted")
            .rect
    }

    /// Moves, presses and releases the primary pointer at `pos`. The move gets its own frame
    /// because egui hit-tests a press against the controls it knew from the frame before it.
    fn click_at(&mut self, state: &mut SettingsState, pos: Pos2) {
        let button = |pressed| egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        self.frame(state, vec![egui::Event::PointerMoved(pos)]);
        self.frame(state, vec![egui::Event::PointerMoved(pos), button(true)]);
        self.frame(state, vec![button(false)]);
    }

    /// Clicks the field `from_end` controls from the end and types `text` into it.
    fn type_from_end(&mut self, state: &mut SettingsState, from_end: usize, text: &str) {
        let rect = self.settled_control(state, from_end);
        self.click_at(state, rect.center());
        // The field takes the focus at the end of the release frame, after it has already read
        // that frame's events; the idle frame lets it start the next one focused.
        self.frame(state, Vec::new());
        self.frame(state, vec![egui::Event::Text(text.to_string())]);
    }

    /// Scrolls until the control `from_end` from the end is fully visible with room for
    /// `rows` dropdown rows below it.
    fn control_with_room(
        &mut self,
        state: &mut SettingsState,
        from_end: usize,
        rows: usize,
    ) -> egui::Rect {
        let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
        let mut previous = None;
        for _ in 0..16 {
            let rect = self.settled_control(state, from_end);
            if viewport.contains_rect(rect)
                && rect.bottom() + 8.0 + 33.0 * rows as f32 <= PHONE_HEIGHT
            {
                return rect;
            }
            assert!(
                previous != Some(rect),
                "the settings screen does not scroll to the control {from_end} from the end \
                     with room for {rows} dropdown rows: it stays at {rect:?}"
            );
            previous = Some(rect);
            let step = if rect.top() < viewport.top() {
                240.0
            } else {
                -240.0
            };
            let pos = Pos2::new(viewport_width() / 2.0, PHONE_HEIGHT / 2.0);
            self.frame(
                state,
                vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::Scroll(Vec2::new(0.0, step)),
                ],
            );
        }
        panic!(
            "the settings screen never brought the control {from_end} from the end with room \
                 for {rows} dropdown rows into the {} px phone viewport",
            viewport_width()
        );
    }

    /// Opens the dropdown `from_end` controls from the end and picks `option` with a pointer
    /// click on its row.
    fn choose_option(&mut self, state: &mut SettingsState, from_end: usize, option: usize) {
        let rect = self.control_with_room(state, from_end, 4);
        self.click_at(state, rect.center());
        let row = Pos2::new(
            rect.left() + 4.0 + 110.0,
            rect.bottom() + 8.0 + 33.0 * option as f32 + 15.0,
        );
        let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
        assert!(
            viewport.contains(row),
            "option {option} of the dropdown {from_end} from the end is painted at {row:?} \
                 outside the {} px phone viewport",
            viewport_width()
        );
        self.click_at(state, row);
    }
}

/// Confirms deletions and a restore on an isolated store, so the confirmation flows are covered in
/// every width/theme run without mutating the shared sample data.
fn click_settings_confirm(
    state: &mut SettingsState,
    store: &Store,
    texts: &UiTexts,
    theme: &Theme,
    now: i64,
) {
    SettingsInput::new(texts, theme, store, now).click_from_end(state, 2);
}

/// Deletes an account from the Delete button *inside* its editor on an isolated store, so the
/// editor action and the confirmation dialog behind it are covered at every width and theme.
fn sweep_settings_editor_delete(texts: &UiTexts, theme: &Theme, now: i64, report: &mut Report) {
    let store = Store::open_in_memory().expect("editor delete store");
    crate::settings::seed_settings(&store, texts).expect("seed editor delete store");
    let mut state = SettingsState::new();
    state.refresh(&store).expect("refresh editor delete store");
    let mut input = SettingsInput::new(texts, theme, &store, now);

    let victim = state.users().last().expect("seeded account").id;
    let before = store.user_count().expect("users before the editor delete");
    state.set_tab(SettingsTab::Users);
    state.dispatch(SettingsIntent::EditUser(victim), &store);
    // The editor paints delete before save and cancel, so it is the third control from the end.
    input.click_from_end(&mut state, 3);
    input.click_from_end(&mut state, 2);
    assert_eq!(
        store.user_count().expect("users after the editor delete"),
        before - 1,
        "user editor delete button: expected {} accounts after confirming, got {}",
        before - 1,
        store.user_count().expect("users after the editor delete")
    );
    assert!(
        store
            .list_users()
            .expect("users after the editor delete")
            .iter()
            .all(|user| user.id != victim),
        "user editor delete button: account {victim} is still in the store after confirming"
    );
    report.case(
        "settings editor delete dialog",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(
                ctx,
                theme,
                texts,
                &mut FocusState::default(),
                &mut state,
                &store,
                now,
            );
        },
    );
    report.cover_flow(SettingsFlow::EditorDelete);
}

/// Creates, resaves, toggles and deletes settings records through the real form controls on an
/// isolated store, so the editor actions are covered at every width and theme.
fn sweep_settings_editor_actions(texts: &UiTexts, theme: &Theme, now: i64, report: &mut Report) {
    let store = Store::open_in_memory().expect("editor action store");
    crate::settings::seed_settings(&store, texts).expect("seed editor action store");
    let witness = Role::new("Sweep-Zeuge", now);
    store.insert_role(&witness).expect("insert witness role");
    let mut state = SettingsState::new();
    state.refresh(&store).expect("refresh editor action store");
    let mut input = SettingsInput::new(texts, theme, &store, now);

    // A new account typed into the form and saved with its button.
    let users_before = store.user_count().expect("users before the account");
    state.set_tab(SettingsTab::Users);
    state.dispatch(SettingsIntent::NewUser, &store);
    input.type_from_end(&mut state, 10, "Sweep Editor User");
    input.type_from_end(&mut state, 9, "sweep-editor-user");
    input.type_from_end(&mut state, 8, "sweep-password-2026");
    input.type_from_end(&mut state, 7, "sweep-password-2026");
    input.click_from_end(&mut state, 2);
    assert_eq!(
        store.user_count().expect("users after the account"),
        users_before + 1,
        "editor save user: expected {} accounts after the form save, got {}",
        users_before + 1,
        store.user_count().expect("users after the account")
    );
    let created_user = store
        .find_user_by_username("sweep-editor-user")
        .expect("find sweep editor user")
        .expect(
            "editor save user: expected the account sweep-editor-user in the store, found none",
        );

    // The same record saved a second time updates instead of inserting a copy: the switch in the
    // reopened form changes, the account count does not.
    state.dispatch(SettingsIntent::EditUser(created_user.id), &store);
    input.click_from_end(&mut state, 4);
    input.click_from_end(&mut state, 2);
    assert_eq!(
        store.user_count().expect("users after the resave"),
        users_before + 1,
        "editor save user: resaving the form changed the account count"
    );
    let resaved = store
        .find_user_by_username("sweep-editor-user")
        .expect("find resaved sweep user")
        .expect("editor save user: the account sweep-editor-user disappeared after the resave");
    assert_eq!(
        resaved.id, created_user.id,
        "editor save user: the resave wrote a different id"
    );
    assert_ne!(
        resaved.must_change_password, created_user.must_change_password,
        "editor save user: the toggled switch was not saved"
    );
    report.case(
        "settings editor user saved",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(
                ctx,
                theme,
                texts,
                &mut FocusState::default(),
                &mut state,
                &store,
                now,
            );
        },
    );
    report.cover_flow(SettingsFlow::EditorSaveUser);

    // A new role typed into the form and saved with its button.
    let roles_before = store.list_roles().expect("roles before the create").len();
    state.set_tab(SettingsTab::Roles);
    state.dispatch(SettingsIntent::NewRole, &store);
    input.type_from_end(&mut state, 22, "Sweep-Rolle");
    input.type_from_end(&mut state, 21, "Über den Sweep-Button angelegt");
    input.click_from_end(&mut state, 2);
    let roles = store.list_roles().expect("roles after the create");
    assert_eq!(
        roles.len(),
        roles_before + 1,
        "editor save role: expected {} roles after the form save, got {}",
        roles_before + 1,
        roles.len()
    );
    let created_role = roles
        .iter()
        .find(|role| role.name == "Sweep-Rolle")
        .expect("editor save role: expected the role Sweep-Rolle in the store, found none")
        .clone();
    report.case(
        "settings editor role saved",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(
                ctx,
                theme,
                texts,
                &mut FocusState::default(),
                &mut state,
                &store,
                now,
            );
        },
    );
    report.cover_flow(SettingsFlow::EditorSaveRole);

    // Saving the same role again keeps the count and the id.
    state.dispatch(SettingsIntent::EditRole(created_role.id), &store);
    input.click_from_end(&mut state, 2);
    let roles = store.list_roles().expect("roles after the resave");
    assert_eq!(
        roles.len(),
        roles_before + 1,
        "editor save role: resaving the form changed the role count"
    );
    assert!(
        roles.iter().any(|role| role.id == created_role.id),
        "editor save role: the role {} disappeared after the resave",
        created_role.id
    );

    // Toggling one permission through the real dropdown and saving persists exactly that change.
    state.dispatch(SettingsIntent::EditRole(created_role.id), &store);
    input.choose_option(&mut state, 18, 2);
    input.click_from_end(&mut state, 2);
    let toggled = store
        .list_roles()
        .expect("roles after the toggle")
        .into_iter()
        .find(|role| role.id == created_role.id)
        .expect("editor permission toggle: the role disappeared after the toggle");
    assert_eq!(
        toggled.level(AppModule::Invoices),
        ::socdof_core::domain::permission::PermissionLevel::Edit,
        "editor permission toggle: expected Invoices Edit after saving, got {:?}",
        toggled.level(AppModule::Invoices)
    );
    report.case(
        "settings editor permission toggled",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(
                ctx,
                theme,
                texts,
                &mut FocusState::default(),
                &mut state,
                &store,
                now,
            );
        },
    );
    report.cover_flow(SettingsFlow::EditorPermissionToggle);

    // The delete button inside the role editor removes exactly that role.
    state.dispatch(SettingsIntent::EditRole(created_role.id), &store);
    input.click_from_end(&mut state, 3);
    input.click_from_end(&mut state, 2);
    let roles = store.list_roles().expect("roles after the editor delete");
    assert!(
        roles.iter().all(|role| role.id != created_role.id),
        "editor role delete: the role {} is still in the store after confirming",
        created_role.id
    );
    assert!(
        roles.iter().any(|role| role.id == witness.id),
        "editor role delete: the witness role was removed too"
    );
    report.case(
        "settings editor role deleted",
        texts.get("settings_title"),
        |ctx| {
            crate::settings::settings(
                ctx,
                theme,
                texts,
                &mut FocusState::default(),
                &mut state,
                &store,
                now,
            );
        },
    );
    report.cover_flow(SettingsFlow::EditorRoleDelete);
}

fn sweep_settings_confirmations(texts: &UiTexts, theme: &Theme, now: i64, report: &mut Report) {
    let store = Store::open_in_memory().expect("confirmation store");
    crate::settings::seed_settings(&store, texts).expect("seed confirmation store");
    let mut state = SettingsState::new();
    state.refresh(&store).expect("refresh confirmation store");

    let victim = state.users().last().expect("seeded account").id;
    let before = state.users().len();
    state.dispatch(SettingsIntent::DeleteUser(victim), &store);
    click_settings_confirm(&mut state, &store, texts, theme, now);
    state.refresh(&store).expect("refresh after account delete");
    assert_eq!(
        state.users().len(),
        before - 1,
        "user delete confirmation: expected {} accounts, got {}",
        before - 1,
        state.users().len()
    );
    assert!(
        state.users().iter().all(|user| user.id != victim),
        "user delete confirmation: account {victim} is still listed after confirming"
    );
    report.cover_flow(SettingsFlow::ConfirmDeleteUser);

    let role = Role::new("Sweep Delete Confirmation", now);
    store.insert_role(&role).expect("insert confirmation role");
    let before = store.list_roles().expect("roles after insert").len();
    state.dispatch(SettingsIntent::DeleteRole(role.id), &store);
    click_settings_confirm(&mut state, &store, texts, theme, now);
    state.refresh(&store).expect("refresh after role delete");
    assert_eq!(
        state.roles().len(),
        before - 1,
        "role delete confirmation: expected {} roles, got {}",
        before - 1,
        state.roles().len()
    );
    assert!(
        state.roles().iter().all(|stored| stored.id != role.id),
        "role delete confirmation: role {} is still listed after confirming",
        role.id
    );
    report.cover_flow(SettingsFlow::ConfirmDeleteRole);

    let dir = std::env::temp_dir().join(format!("socdof-sweep-confirm-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("confirmation temp dir");
    let archive = dir.join("confirmation-backup.zip");
    socdof_core::backup::create_backup(&store, &archive, env!("CARGO_PKG_VERSION"), now)
        .expect("confirmation backup");
    let target = dir.join("restored.db");
    state.dispatch(
        SettingsIntent::RequestRestore {
            archive: archive.to_string_lossy().to_string(),
            target: target.to_string_lossy().to_string(),
        },
        &store,
    );
    click_settings_confirm(&mut state, &store, texts, theme, now);
    assert!(
        target.exists(),
        "restore confirmation: expected a restored database at {}, found none",
        target.display()
    );
    report.cover_flow(SettingsFlow::ConfirmRestore);
    let _ = std::fs::remove_dir_all(dir);
}

fn sweep_users(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Users);
    let mut state = UsersState::new();
    state.refresh(store).expect("refresh");
    for view in [UsersView::List, UsersView::Detail, UsersView::Form] {
        users_case(&mut state, view);
        let title = match view {
            UsersView::List => "users_title",
            UsersView::Detail => "users_detail_title",
            UsersView::Form => "users_title",
        };
        report.case(&format!("users {view:?}"), texts.get(title), |ctx| {
            crate::users::users(ctx, theme, texts, focus, &mut state, store, now);
        });
    }
    users_case(&mut state, UsersView::Form);
    state.role_popup.open = Some(0);
    report.case("users form dropdown", texts.get("users_title"), |ctx| {
        crate::users::users(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.role_popup.open = None;
    if let Some(user) = state.users.first() {
        state.select(user.id);
        state.confirm_delete = true;
        report.case(
            "users delete dialog",
            texts.get("users_detail_title"),
            |ctx| {
                crate::users::users(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_editor(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Editor);
    let mut state = EditorState::new();
    state.refresh(store).expect("refresh");
    report.case("editor list", texts.get("editor_title"), |ctx| {
        crate::editor::editor(ctx, theme, texts, focus, &mut state, store, now);
    });
    if let Some(document) = state.documents.first() {
        let id = document.id;
        state.open_document(store, id).expect("open");
    }
    report.case("editor document", texts.get("editor_title"), |ctx| {
        crate::editor::editor(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.preview = true;
    report.case("editor preview", texts.get("editor_title"), |ctx| {
        crate::editor::editor(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.preview = false;
    state.spell = true;
    state.spell_ignored = vec!["SOCDOF".to_string(), "Rust".to_string()];
    report.case("editor spell check", texts.get("editor_title"), |ctx| {
        crate::editor::editor(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.confirm_delete = true;
    report.case("editor delete dialog", texts.get("editor_title"), |ctx| {
        crate::editor::editor(ctx, theme, texts, focus, &mut state, store, now);
    });
}

fn sweep_app_store(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    report: &mut Report,
) {
    let mut state = AppStoreState::new();
    state.refresh(store).expect("refresh");
    report.case("app store", texts.get("app_store_title"), |ctx| {
        crate::app_store::app_store(ctx, theme, texts, focus, &mut state, store);
    });
}

fn sweep_support(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Support);
    let mut state = SupportState::new();
    state.refresh(store).expect("refresh");
    for view in [SupportView::List, SupportView::Detail, SupportView::Form] {
        support_case(&mut state, view);
        report.case(
            &format!("support {view:?}"),
            texts.get(view.title_key()),
            |ctx| {
                crate::support::support(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    if let Some(ticket) = state.tickets.first() {
        state.select(ticket.id);
        state.confirm_delete = true;
        report.case(
            "support delete dialog",
            texts.get("support_detail_title"),
            |ctx| {
                crate::support::support(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_reports(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Reports);
    let mut state = ReportsState::new();
    state.refresh(store, now).expect("refresh");
    for period in 0..4 {
        state.period = period;
        report.case(
            &format!("reports period {period}"),
            texts.get("reports_title"),
            |ctx| {
                crate::reports::reports(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_therapie(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Therapy);
    let mut state = TherapieState::new();
    state.refresh(store).expect("refresh");
    for view in [
        TherapieView::List,
        TherapieView::Detail,
        TherapieView::Form,
        TherapieView::Mileage,
    ] {
        if view == TherapieView::Detail {
            if let Some(client) = state.clients.first() {
                let id = client.id;
                state.select(store, id).expect("select");
            }
        } else if view == TherapieView::Form {
            state.start_new();
        } else {
            state.view = view;
        }
        let title = match view {
            TherapieView::List => "therapie_title",
            TherapieView::Detail => "therapie_detail_title",
            TherapieView::Form => "therapie_form_title",
            TherapieView::Mileage => "therapie_mileage_title",
        };
        report.case(&format!("therapy {view:?}"), texts.get(title), |ctx| {
            crate::therapie::therapie(ctx, theme, texts, focus, &mut state, store, now);
        });
    }
    if let Some(client) = state.clients.first() {
        let id = client.id;
        state.select(store, id).expect("select");
        state.confirm_delete = true;
        report.case(
            "therapy delete dialog",
            texts.get("therapie_detail_title"),
            |ctx| {
                crate::therapie::therapie(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    // Mileage trip delete confirmation.
    state.view = TherapieView::Mileage;
    state.refresh(store).expect("refresh");
    if let Some(trip) = state.trips.first() {
        state.trip_to_delete = Some(trip.id);
        report.case(
            "therapy trip delete dialog",
            texts.get("therapie_mileage_title"),
            |ctx| {
                crate::therapie::therapie(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
}

fn sweep_projects(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Projects);
    let mut state = ProjectsState::new();
    state.refresh(store).expect("refresh");
    // Build one project through the module's own new-project draft so the portfolio has content.
    state.start_new(now);
    if let Some(mut project) = state.draft.take() {
        project.title = "Website relaunch mit langem Projekttitel".to_string();
        project.client_name = "AlpenTech Systemhaus GmbH".to_string();
        state.selected = Some(project.id);
        state.projects.push(project);
    }
    state.start_task(now);
    if let Some(task) = state.task_draft.take() {
        state.tasks.push(task);
    }
    for view in [
        ProjectsView::Portfolio,
        ProjectsView::Kanban,
        ProjectsView::Tasks,
    ] {
        projects_case(&mut state, view);
        report.case(
            &format!("projects {view:?}"),
            texts.get("projects_title"),
            |ctx| {
                crate::projects::projects(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    state.view = ProjectsView::Portfolio;
    state.start_new(now);
    report.case("projects form", texts.get("projects_title"), |ctx| {
        crate::projects::projects(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.draft = None;
    state.start_task(now);
    report.case("projects task form", texts.get("projects_title"), |ctx| {
        crate::projects::projects(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.task_draft = None;
    state.confirm_delete = true;
    report.case(
        "projects delete dialog",
        texts.get("projects_title"),
        |ctx| {
            crate::projects::projects(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
}

fn sweep_fleet(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Fleet);
    let mut state = FleetState::new();
    state.refresh(store).expect("refresh");
    // One vehicle through the module's own draft so the register has a row.
    state.start_vehicle(now);
    if let Some(mut vehicle) = state.vehicle_draft.take() {
        vehicle.license_plate = "B-SO 432".to_string();
        vehicle.make = "Mercedes-Benz".to_string();
        vehicle.model = "Sprinter 316 CDI".to_string();
        state.selected_vehicle = Some(vehicle.id);
        state.vehicles.push(vehicle);
    }
    for view in [
        FleetView::Logbook,
        FleetView::Vehicles,
        FleetView::Fuel,
        FleetView::Analytics,
    ] {
        fleet_case(&mut state, view);
        report.case(
            &format!("fleet {view:?}"),
            texts.get("fleet_title"),
            |ctx| {
                crate::fleet::fleet(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    state.view = FleetView::Vehicles;
    state.start_vehicle(now);
    report.case("fleet vehicle form", texts.get("fleet_title"), |ctx| {
        crate::fleet::fleet(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.vehicle_draft = None;
    state.view = FleetView::Logbook;
    state.start_trip(now);
    report.case("fleet trip form", texts.get("fleet_title"), |ctx| {
        crate::fleet::fleet(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.trip_draft = None;
    state.view = FleetView::Fuel;
    state.start_fuel(now);
    report.case("fleet fuel form", texts.get("fleet_title"), |ctx| {
        crate::fleet::fleet(ctx, theme, texts, focus, &mut state, store, now);
    });
    state.fuel_draft = None;
    if let Some(vehicle) = state.vehicles.first() {
        state.confirm_delete = Some(("fleet_vehicle", vehicle.id));
        report.case("fleet delete dialog", texts.get("fleet_title"), |ctx| {
            crate::fleet::fleet(ctx, theme, texts, focus, &mut state, store, now);
        });
    }
}

fn sweep_restaurant(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Restaurant);
    let mut state = RestaurantState::new();
    state.refresh(store).expect("refresh");
    state.start_new_dish(now);
    if let Some(mut dish) = state.dish_draft.take() {
        dish.name = "Rinderroulade mit Rotkohl und Klößen".to_string();
        dish.ingredients = "Rindfleisch, Speck, Zwiebeln, Rotkohl, Kartoffelklöße".to_string();
        state.menu.push(dish);
    }
    for view in [
        RestaurantView::Tables,
        RestaurantView::Kitchen,
        RestaurantView::Menu,
        RestaurantView::History,
    ] {
        restaurant_case(&mut state, view);
        report.case(
            &format!("restaurant {view:?}"),
            texts.get("restaurant_title"),
            |ctx| {
                crate::restaurant::restaurant(ctx, theme, texts, focus, &mut state, store, now);
            },
        );
    }
    state.view = RestaurantView::Menu;
    state.start_new_dish(now);
    report.case(
        "restaurant dish form",
        texts.get("restaurant_title"),
        |ctx| {
            crate::restaurant::restaurant(ctx, theme, texts, focus, &mut state, store, now);
        },
    );
}

fn sweep_documentation(
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    report: &mut Report,
) {
    report.cover(AppModule::Documentation);
    let mut state = DocumentationState::default();
    report.case("manual", texts.get("docs_title"), |ctx| {
        crate::documentation::documentation(ctx, theme, texts, focus, &mut state);
    });
    state.query = "Rechnung".to_string();
    report.case("manual search", texts.get("docs_title"), |ctx| {
        crate::documentation::documentation(ctx, theme, texts, focus, &mut state);
    });
}

fn sweep_auth(
    store: &Store,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    focus: &mut FocusState,
    report: &mut Report,
) {
    let mut state = AuthState::default();
    state.username = "admin".to_string();
    state.display_name = "Alex Administrator".to_string();
    state.password = "geheim".to_string();
    state.password_confirm = "geheim".to_string();
    for view in [
        AuthView::Login,
        AuthView::Setup,
        AuthView::Locked,
        AuthView::Recover,
        AuthView::ChangePassword,
        AuthView::Unlocked,
    ] {
        auth_case(&mut state, view);
        let steps = if view == AuthView::Setup {
            SETUP_STEPS
        } else {
            1
        };
        for step in 0..steps {
            state.setup_step = step;
            report.case(&format!("auth {view:?} step {step}"), "", |ctx| {
                crate::auth::auth(ctx, theme, texts, focus, &mut state, store, now);
            });
        }
    }
    state.error = Some("auth_error_credentials");
    report.case("auth login error", "", |ctx| {
        crate::auth::auth(ctx, theme, texts, focus, &mut state, store, now);
    });
}

/// The three tabs of the Studio drawer; the match keeps the enumeration exhaustive.
fn studio_tabs() -> [StudioTab; 3] {
    [StudioTab::Company, StudioTab::Data, StudioTab::Layout]
}

/// Applies one Studio tab; the match keeps the enumeration exhaustive.
fn studio_tab(state: &mut crate::studio::StudioState, store: &Store, tab: StudioTab) {
    match tab {
        StudioTab::Company => {
            state.open(store);
            state.set_tab(StudioTab::Company);
        }
        StudioTab::Data => {
            state.open(store);
            state.set_tab(StudioTab::Data);
        }
        StudioTab::Layout => {
            state.open(store);
            state.set_tab(StudioTab::Layout);
        }
    }
}

/// Desktop shell and its overlays: start menu (including the power submenu), command palette,
/// tray flyout, first-run onboarding, task view, taskbar overflow and the Studio drawer tabs.
fn sweep_desktop(store: &Store, theme: &Theme, texts: &UiTexts, now: i64, report: &mut Report) {
    let icons = |count: usize| {
        let mut icons = Vec::new();
        for (index, name) in [
            "contacts",
            "products",
            "invoices",
            "accounting",
            "purchases",
            "pos",
            "calendar",
            "projects",
        ]
        .iter()
        .take(count)
        .enumerate()
        {
            icons.push(DesktopIcon::new(
                AppId::new(name),
                texts.get("dashboard_title"),
                if index % 2 == 0 {
                    Icon::User
                } else {
                    Icon::Dashboard
                },
            ));
        }
        IconGrid::new(icons)
    };
    let mut shell = ShellState::new();
    shell.onboarding = crate::shell::Onboarding::restore(true);
    report.case("desktop", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.onboarding = crate::shell::Onboarding::restore(true);
    shell.open_start();
    report.case("desktop start menu", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.start.open_power();
    report.case("desktop start menu power", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.close_overlays();
    shell.open_palette();
    report.case("desktop command palette", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.close_overlays();
    shell.tray.open();
    report.case("desktop tray", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.close_overlays();
    shell.onboarding.restart();
    report.case("desktop onboarding", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.onboarding.finish();
    shell.task_view.open();
    report.case("desktop task view", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.close_overlays();
    shell.toggle_overflow();
    report.case("desktop overflow menu", "", |ctx| {
        let mut focus = FocusState::default();
        let mut icons = icons(8);
        let mut windows = WindowManager::new();
        crate::desktop::desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut shell,
                store,
                current_user: None,
            },
            &mut focus,
            &mut icons,
            &mut windows,
            now,
        );
    });

    shell.close_overlays();
    for tab in studio_tabs() {
        studio_tab(&mut shell.studio, store, tab);
        report.case(&format!("desktop studio {tab:?}"), "", |ctx| {
            let mut focus = FocusState::default();
            let mut icons = icons(8);
            let mut windows = WindowManager::new();
            crate::desktop::desktop(
                ctx,
                DesktopFrame {
                    theme,
                    texts,
                    shell: &mut shell,
                    store,
                    current_user: None,
                },
                &mut focus,
                &mut icons,
                &mut windows,
                now,
            );
        });
    }
}

/// Drives the component gallery with real pointer input so its menu flow is swept as well.
struct GalleryInput {
    ctx: Context,
    state: crate::gallery::GalleryState,
    time: f64,
}

impl GalleryInput {
    fn new() -> Self {
        let mut state =
            crate::gallery::GalleryState::new(Language::De, viewport_appearance(), "indigo")
                .expect("gallery state");
        // The onboarding card is a foreground overlay and would swallow the wheel input.
        state.shell.onboarding.finish();
        Self {
            ctx: crate::theme::headless_context(),
            state,
            time: 1.0,
        }
    }

    fn frame(&mut self, events: Vec<egui::Event>) {
        self.time += 1.0 / 60.0;
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(viewport_width(), PHONE_HEIGHT),
            )),
            events,
            time: Some(self.time),
            ..Default::default()
        };
        let Self { ctx, state, .. } = self;
        let _ = ctx.run(input, |ctx| crate::gallery::gallery(ctx, state));
        // egui keeps its own focus next to the kit's; dropping it whenever the two disagree keeps
        // a synthetic Enter from clicking a widget the kit is not focused on.
        let kit_focus = self.state.focus.focused();
        self.ctx.memory_mut(|memory| {
            if let Some(focused) = memory.focused() {
                if Some(focused) != kit_focus {
                    memory.surrender_focus(focused);
                }
            }
        });
    }

    fn menu_id(&self, occurrence: usize) -> Id {
        crate::controls::menu_id(self.state.texts.get("menu_actions"), occurrence)
    }

    fn row_id(&self, occurrence: usize, index: usize) -> Id {
        self.menu_id(occurrence).with(("item", index))
    }

    fn select_id(&self, occurrence: usize) -> Id {
        crate::controls::select_id("socdof-gallery-term", occurrence)
    }

    fn option_id(&self, occurrence: usize, index: usize) -> Id {
        self.select_id(occurrence).with(("option", index))
    }

    /// Lets the smoothed wheel scrolling come to rest before geometry is compared.
    fn settle(&mut self) {
        for _ in 0..10 {
            self.frame(Vec::new());
        }
    }

    /// Scrolls until the control is fully visible with room for `rows` popup rows below it.
    fn scroll_with_room(&mut self, id: Id, rows: usize) -> Rect {
        let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
        let mut previous = None;
        for _ in 0..40 {
            self.frame(Vec::new());
            let rect = self.rect_of(id);
            let fits = viewport.contains_rect(rect)
                && rect.bottom() + 8.0 + 33.0 * rows as f32 <= PHONE_HEIGHT;
            if fits {
                if previous == Some(rect) {
                    assert!(
                        rect.right() <= panel_right(),
                        "the gallery control ends at {} px, the panel ends at {} px",
                        rect.right(),
                        panel_right()
                    );
                    return rect;
                }
            } else {
                assert!(
                    previous != Some(rect),
                    "the gallery does not scroll to the control: it stays at {rect:?}"
                );
                let step = if rect.top() < 0.0 { 240.0 } else { -240.0 };
                let pos = Pos2::new(viewport_width() / 2.0, PHONE_HEIGHT / 2.0);
                self.frame(vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::Scroll(Vec2::new(0.0, step)),
                ]);
            }
            previous = Some(rect);
        }
        panic!(
            "the gallery never brought the control into the {} px viewport",
            viewport_width()
        );
    }

    fn rect_of(&self, id: Id) -> Rect {
        self.ctx
            .read_response(id)
            .expect("gallery control was painted")
            .rect
    }

    /// Scrolls until the menu is fully visible with room for its four popup rows.
    fn scroll_to_menu(&mut self) -> Rect {
        let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
        let mut previous = None;
        for _ in 0..40 {
            self.frame(Vec::new());
            let rect = self.rect_of(self.menu_id(0));
            let fits =
                viewport.contains_rect(rect) && rect.bottom() + 8.0 + 33.0 * 4.0 <= PHONE_HEIGHT;
            if fits {
                // The wheel scroll is animated; the rectangle has to hold still for a frame.
                if previous == Some(rect) {
                    assert!(
                        rect.right() <= panel_right(),
                        "the gallery menu ends at {} px, the panel ends at {} px",
                        rect.right(),
                        panel_right()
                    );
                    return rect;
                }
            } else {
                assert!(
                    previous != Some(rect),
                    "the gallery does not scroll to the action menu: it stays at {rect:?}"
                );
                let step = if rect.top() < 0.0 { 240.0 } else { -240.0 };
                let pos = Pos2::new(viewport_width() / 2.0, PHONE_HEIGHT / 2.0);
                self.frame(vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::Scroll(Vec2::new(0.0, step)),
                ]);
            }
            previous = Some(rect);
        }
        panic!(
            "the gallery never brought the action menu with room for its rows into the {} px \
             viewport",
            viewport_width()
        );
    }

    /// Moves, presses and releases the primary pointer; the move gets its own frame because egui
    /// hit-tests a press against the controls it knew from the frame before.
    fn click_at(&mut self, pos: Pos2) {
        let button = |pressed| egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        self.frame(vec![egui::Event::PointerMoved(pos)]);
        self.frame(vec![egui::Event::PointerMoved(pos), button(true)]);
        self.frame(vec![button(false)]);
    }
}

/// Drives the gallery's copied-state dropdown pair, so the per-instance slot is swept at every
/// width and theme.
fn sweep_gallery_mirror(texts: &UiTexts, report: &mut Report) {
    let mut input = GalleryInput::new();
    input.state.draft = true;
    input.frame(Vec::new());
    input.frame(Vec::new());
    let owner = input.state.mirror_popup.slot().expect("owner slot");
    let copy = input.state.mirror_copy.slot().expect("copy slot");
    assert_ne!(
        owner,
        copy,
        "the copied popup state kept the owner's slot at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let owner_id = crate::controls::select_id("socdof-gallery-mirror", owner);
    let copy_id = crate::controls::select_id("socdof-gallery-mirror", copy);
    assert_ne!(
        input.rect_of(owner_id),
        input.rect_of(copy_id),
        "both copied-state dropdowns paint on one rectangle at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );

    let rect = input.scroll_with_room(owner_id, 3);
    input.click_at(rect.center());
    assert_eq!(
        input.state.mirror_popup.open,
        Some(1),
        "one click did not open the owning dropdown at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.mirror_copy.open,
        None,
        "opening the owner opened the copied dropdown at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(owner_id.with(("option", 2)));
    input.click_at(row.center());
    assert_eq!(
        input.state.mirror_a,
        2,
        "the owning dropdown did not choose at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.mirror_b,
        0,
        "choosing in the owner changed the copied value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Mirror);
    report.case(
        "gallery copied state owner chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    let rect = input.scroll_with_room(copy_id, 3);
    input.click_at(rect.center());
    assert_eq!(
        input.state.mirror_copy.open,
        Some(0),
        "the copied dropdown did not open at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.mirror_popup.open,
        None,
        "opening the copied dropdown opened the owner at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(copy_id.with(("option", 1)));
    input.click_at(row.center());
    assert_eq!(
        input.state.mirror_b,
        1,
        "the copied dropdown did not choose at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.mirror_a,
        2,
        "choosing in the copied dropdown changed the owner at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery copied state copy chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );
}

/// Enables and hides the conditional third menu of the gallery while the two fixed menus keep
/// their identity, so the stable menu id is swept at every width and theme.
fn sweep_gallery_conditional_menu(texts: &UiTexts, report: &mut Report) {
    let mut input = GalleryInput::new();
    input.scroll_with_room(input.menu_id(0), 4);
    input.settle();
    let first = input.rect_of(input.menu_id(0));
    input.click_at(first.center());
    assert_eq!(
        input.state.menu_popup.open,
        Some(0),
        "one click did not open the first gallery menu at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(input.row_id(0, 1));
    input.click_at(row.center());
    assert_eq!(
        input.state.menu_choice,
        Some(1),
        "the first menu did not choose its row at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );

    // A third menu with the same caption appears above the two fixed ones.
    input.state.draft = true;
    input.frame(Vec::new());
    input.settle();
    let extra = input.rect_of(input.menu_id(2));
    assert!(
        extra.top() < input.rect_of(input.menu_id(0)).top(),
        "the conditional menu is not painted above the fixed ones at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert!(
        extra.right() <= panel_right(),
        "the conditional menu ends at {} px, the panel ends at {} px",
        extra.right(),
        panel_right()
    );
    assert_eq!(
        input.state.menu_choice,
        Some(1),
        "showing the conditional menu changed the first value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_choice_extra,
        None,
        "showing the conditional menu changed its own value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::MenuConditional);
    report.case(
        "gallery conditional menu appears",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    // Hiding it again leaves the fixed menus where they were.
    input.state.draft = false;
    input.frame(Vec::new());
    input.settle();
    assert_eq!(
        input.rect_of(input.menu_id(0)),
        first,
        "the first menu moved to a different rectangle at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery conditional menu hidden",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    // It comes back with its own identity and chooses on its own.
    input.state.draft = true;
    input.frame(Vec::new());
    input.settle();
    assert_eq!(
        input.rect_of(input.menu_id(2)),
        extra,
        "the returning menu got a different identity at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let rect = input.scroll_with_room(input.menu_id(2), 4);
    input.click_at(rect.center());
    assert_eq!(
        input.state.menu_popup_extra.open,
        Some(0),
        "the conditional menu did not open at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_popup.open,
        None,
        "opening the conditional menu opened the first one at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(input.row_id(2, 3));
    input.click_at(row.center());
    assert_eq!(
        input.state.menu_choice_extra,
        Some(3),
        "the conditional menu did not choose its row at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_choice,
        Some(1),
        "choosing in the conditional menu changed the first value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery conditional menu chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );
}

/// Enables and hides the conditional third dropdown of the gallery while the two fixed ones keep
/// their identity, so the stable select id is swept at every width and theme.
fn sweep_gallery_conditional_selects(texts: &UiTexts, report: &mut Report) {
    let mut input = GalleryInput::new();
    let first = input.scroll_with_room(input.select_id(0), 3);
    input.click_at(first.center());
    assert_eq!(
        input.state.select_popup.open,
        Some(1),
        "one click did not open the first gallery select at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(input.option_id(0, 2));
    input.click_at(row.center());
    assert_eq!(
        input.state.select,
        2,
        "the first select did not choose its option at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );

    // A third dropdown with the same source appears above the two fixed ones.
    input.state.draft = true;
    input.frame(Vec::new());
    let extra = input.rect_of(input.select_id(2));
    assert!(
        extra.top() < input.rect_of(input.select_id(0)).top(),
        "the conditional select is not painted above the fixed ones at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert!(
        extra.right() <= panel_right(),
        "the conditional select ends at {} px, the panel ends at {} px",
        extra.right(),
        panel_right()
    );
    assert_eq!(
        input.state.select,
        2,
        "showing the conditional select changed the first value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select_second,
        0,
        "showing the conditional select changed the second value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Conditional);
    report.case(
        "gallery conditional select appears",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    // Hiding it again leaves the fixed dropdowns where they were.
    input.state.draft = false;
    input.frame(Vec::new());
    assert_eq!(
        input.rect_of(input.select_id(0)),
        first,
        "the first select moved to a different rectangle at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery conditional select hidden",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    // It comes back with its own identity and chooses on its own.
    input.state.draft = true;
    input.frame(Vec::new());
    assert_eq!(
        input.rect_of(input.select_id(2)),
        extra,
        "the returning select got a different identity at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let rect = input.scroll_with_room(input.select_id(2), 3);
    input.click_at(rect.center());
    assert_eq!(
        input.state.select_popup_extra.open,
        Some(0),
        "the conditional select did not open at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select_popup.open,
        None,
        "opening the conditional select opened the first one at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(input.option_id(2, 1));
    input.click_at(row.center());
    assert_eq!(
        input.state.select_extra,
        1,
        "the conditional select did not choose its option at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select,
        2,
        "choosing in the conditional select changed the first value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery conditional select chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );
}

/// Opens both dropdowns of the gallery, which deliberately share one source, and chooses an option
/// in each, so the instance identity of the select is swept at every width and theme.
fn sweep_gallery_selects(texts: &UiTexts, report: &mut Report) {
    let mut input = GalleryInput::new();
    let first = input.scroll_with_room(input.select_id(0), 3);
    input.click_at(first.center());
    assert_eq!(
        input.state.select_popup.open,
        Some(1),
        "one click did not open the first gallery select at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select_popup_second.open,
        None,
        "opening the first select opened the second one at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery first select open",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    let row = input.rect_of(input.option_id(0, 2));
    assert!(
        Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT))
            .contains_rect(row),
        "the option of the first select is painted outside the {} px viewport: {row:?}",
        viewport_width()
    );
    input.click_at(row.center());
    assert_eq!(
        input.state.select,
        2,
        "the first select did not choose its option at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select_second,
        0,
        "choosing in the first select changed the second value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Selects);
    report.case(
        "gallery first select chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    let second = input.scroll_with_room(input.select_id(1), 3);
    input.click_at(second.center());
    assert_eq!(
        input.state.select_popup_second.open,
        Some(0),
        "the second select did not open at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select_popup.open,
        None,
        "opening the second select opened the first one at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    let row = input.rect_of(input.option_id(1, 1));
    assert!(
        Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT))
            .contains_rect(row),
        "the option of the second select is painted outside the {} px viewport: {row:?}",
        viewport_width()
    );
    input.click_at(row.center());
    assert_eq!(
        input.state.select_second,
        1,
        "the second select did not choose its option at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.select,
        2,
        "choosing in the second select changed the first value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery second select chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );
}

/// Opens the component gallery's action menu with one click and chooses a row with a second one,
/// so the menu flow is swept at every width and theme.
fn sweep_gallery_menu(texts: &UiTexts, report: &mut Report) {
    let mut input = GalleryInput::new();
    let rect = input.scroll_to_menu();
    input.click_at(rect.center());
    assert_eq!(
        input.state.menu_popup.open,
        Some(0),
        "one click did not open the gallery action menu at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Open);
    report.case(
        "gallery action menu open",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    let row = input.rect_of(input.row_id(0, 2));
    let viewport = Rect::from_min_size(Pos2::ZERO, Vec2::new(viewport_width(), PHONE_HEIGHT));
    assert!(
        viewport.contains_rect(row),
        "the chosen popup row is painted outside the {} px viewport: {row:?}",
        viewport_width()
    );
    input.click_at(row.center());
    assert_eq!(
        input.state.menu_choice,
        Some(2),
        "the popup row did not set the menu value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_popup.open,
        None,
        "the popup stayed open after choosing at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Choose);
    report.case(
        "gallery action menu chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    // The second menu carries the same caption and must not share focus, open state or value with
    // the first one.
    let second = input.rect_of(input.menu_id(1));
    assert!(
        viewport.contains_rect(second),
        "the second menu is painted outside the {} px viewport: {second:?}",
        viewport_width()
    );
    input.click_at(second.center());
    assert_eq!(
        input.state.menu_popup_second.open,
        Some(0),
        "one click did not open the second gallery menu at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_popup.open,
        None,
        "opening the second menu opened the first one at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.cover_gallery(GalleryFlow::Pair);
    report.case(
        "gallery second action menu open",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );

    let row = input.rect_of(input.row_id(1, 0));
    assert!(
        viewport.contains_rect(row),
        "the second menu's row is painted outside the {} px viewport: {row:?}",
        viewport_width()
    );
    input.click_at(row.center());
    assert_eq!(
        input.state.menu_choice_second,
        Some(0),
        "the second menu did not choose its row at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    assert_eq!(
        input.state.menu_choice,
        Some(2),
        "choosing in the second menu changed the first menu's value at {} px, {:?}",
        viewport_width(),
        viewport_appearance()
    );
    report.case(
        "gallery second action menu chosen",
        texts.get("gallery_title"),
        |ctx| crate::gallery::gallery(ctx, &mut input.state),
    );
}

fn sweep_overlays(theme: &Theme, _texts: &UiTexts, _focus: &mut FocusState, report: &mut Report) {
    use crate::components::{Toasts, Tone};

    let mut toasts = Toasts::default();
    toasts.push_titled(
        Tone::Warning,
        "Sicherung abgeschlossen",
        "Die Sicherung der Datenbank wurde mit einer sehr langen Beschreibung abgeschlossen.",
        now(),
    );
    report.case("toast stack", "Sicherung abgeschlossen", |ctx| {
        crate::components::toast_stack(ctx, theme, &mut toasts, now(), 60_000, 88.0);
    });
}
