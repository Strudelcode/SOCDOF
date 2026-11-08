//! Deterministic primitive snapshots without a display.
//!
//! The kit cannot be compared pixel by pixel in CI, so a snapshot hashes the paint commands instead:
//! every shape is reduced to a stable string (positions rounded, colors and strings verbatim) and
//! the test compares that text with a golden file. Any change in geometry, color or text fails the
//! comparison, and the diff shows the exact command that moved.
//!
//! [`capture`] renders the primitives with a fixed screen size, a fixed time and a fixed state, so
//! two runs on the same machine always produce the same lines.

use egui::{Context, FullOutput, Pos2, RawInput, Rect, Shape, Vec2};
use socdof_core::domain::settings::Language;
use socdof_core::error::CoreResult;

use crate::accounting::{accounting, seed_accounting, AccountingState};
use crate::app_store::{app_store, AppStoreState};
use crate::appointments::{appointments, seed_appointments, AppointmentsState};
use crate::auth::{auth, AuthState, DEFAULT_IDLE_TIMEOUT_MS};
use crate::calendar::CalendarState;
use crate::components::{button, icon_button, ButtonVariant};
use crate::contacts::{contacts, seed_sample as seed_contacts, ContactsState};
use crate::controls::{
    calendar, checkbox, drawer, drop_zone, select, switch, text_field, CalendarLabels,
    DrawerLabels, PopupState,
};
use crate::dashboard::{dashboard, DashboardData, DashboardState};
use crate::desktop::{
    default_window_rect, desktop, work_area, AppId, DesktopFrame, DesktopIcon, IconGrid, Window,
    WindowManager,
};
use crate::editor::{editor, seed_documents, EditorState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::invoices::{invoices, seed_invoices, InvoicesState};
use crate::pos::{pos, seed_pos, PosState};
use crate::products::{products, seed_products, ProductsState};
use crate::purchases::{purchases, seed_purchases, PurchasesState};
use crate::reports::{reports, ReportsState, SAMPLE_NOW_MS as REPORTS_SAMPLE_NOW_MS};
use crate::settings::{seed_settings, settings, SettingsState};
use crate::shell::{Onboarding, ShellState};
use crate::support::{
    seed_sample as seed_support, support, SupportState, SAMPLE_NOW_MS as SUPPORT_SAMPLE_NOW_MS,
};
use crate::theme::{Appearance, Theme};
use crate::therapie::{
    seed_sample as seed_therapie, therapie, TherapieState, SAMPLE_NOW_MS as THERAPIE_SAMPLE_NOW_MS,
};
use crate::users::{seed_users, users, UsersState};
use crate::wallpaper::{Wallpaper, WallpaperFit};

/// Variant of the primitive scene.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotVariant {
    /// Nothing focused.
    Idle,
    /// The first control has the focus and therefore the focus ring.
    Focused,
    /// The drawer is open and traps the focus.
    Drawer,
    /// The desktop shell with two open windows.
    Desktop,
    /// The desktop with the start menu open.
    StartMenu,
    /// The desktop with the command palette open.
    Palette,
    /// The desktop with the tray flyout open.
    Tray,
    /// The first-run onboarding over the desktop.
    Onboarding,
    /// The desktop with the dusk wallpaper, tiled.
    Wallpaper,
    /// The desktop with the Studio drawer on its letterhead tab.
    Studio,
    /// The desktop with the Studio drawer on its data tab.
    StudioData,
    /// The desktop with the Studio drawer on its document layout tab.
    StudioLayout,
    /// The dashboard module screen with its sample data.
    Dashboard,
    /// The contacts module screen with its sample data.
    Contacts,
    /// The products module screen with its sample data.
    Products,
    /// The invoices module screen with its sample data.
    Invoices,
    /// The accounting module screen with its sample data.
    Accounting,
    /// The purchases module screen with its sample data.
    Purchases,
    /// The point-of-sale screen with its sample data.
    Pos,
    /// The calendar screen with its sample data.
    Calendar,
    /// The settings screen with its sample data.
    Settings,
    /// The user management screen with its sample accounts.
    Users,
    /// The App Store with the core module catalogue.
    AppStore,
    /// The support module with its sample tickets and tracked time.
    Support,
    /// The reports module over the seeded invoices.
    Reports,
    /// The therapy module with its sample practice.
    Therapie,
    /// The text editor with its seeded documents.
    Editor,
    /// The text editor showing the formatted preview.
    EditorPreview,
    /// The text editor with the spell check panel and accepted words.
    EditorSpell,
    /// The sign-in screen.
    Login,
    /// The locked session screen.
    Locked,
    /// The first-run administrator setup.
    Setup,
    /// The signed-in session overview.
    Unlocked,
}

/// Fixed state of the primitive scene.
#[derive(Debug, Clone)]
pub struct PrimitiveState {
    /// Language of the labels.
    pub language: Language,
    /// Appearance of the palette.
    pub appearance: Appearance,
    /// Translated labels.
    pub texts: UiTexts,
    /// Focus state of the scene.
    pub focus: FocusState,
    /// Dropdown state.
    pub select: PopupState,
    /// Selected payment term.
    pub selected: usize,
    /// Checkbox value.
    pub checked: bool,
    /// Switch value.
    pub switched: bool,
    /// Company field value.
    pub company: String,
    /// Email field value.
    pub email: String,
    /// Calendar selection, fixed to a known day.
    pub calendar: CalendarState,
    /// Whether the drawer is open.
    pub drawer_open: bool,
    /// Trigger id the drawer returns the focus to.
    pub drawer_trigger: egui::Id,
}

impl PrimitiveState {
    /// Builds the fixed scene for a language and appearance.
    pub fn new(language: Language, appearance: Appearance) -> CoreResult<Self> {
        Ok(Self {
            language,
            appearance,
            texts: UiTexts::embedded(language)?,
            focus: FocusState::default(),
            select: PopupState::default(),
            selected: 1,
            checked: true,
            switched: false,
            company: "Muster AG".to_string(),
            email: "buchhaltung@muster.ag".to_string(),
            calendar: CalendarState::new(2026, 11, 7),
            drawer_open: false,
            drawer_trigger: egui::Id::new("snapshot-drawer-trigger"),
        })
    }
}

/// Renders the primitive scene with fixed input and returns the paint commands as text lines.
pub fn capture(
    language: Language,
    appearance: Appearance,
    variant: SnapshotVariant,
) -> Vec<String> {
    if variant == SnapshotVariant::Dashboard {
        return capture_dashboard(language, appearance);
    }
    if variant == SnapshotVariant::Contacts {
        return capture_contacts(language, appearance);
    }
    if variant == SnapshotVariant::Products {
        return capture_products(language, appearance);
    }
    if variant == SnapshotVariant::Invoices {
        return capture_invoices(language, appearance);
    }
    if variant == SnapshotVariant::Accounting {
        return capture_accounting(language, appearance);
    }
    if variant == SnapshotVariant::Purchases {
        return capture_purchases(language, appearance);
    }
    if variant == SnapshotVariant::Pos {
        return capture_pos(language, appearance);
    }
    if variant == SnapshotVariant::Calendar {
        return capture_calendar(language, appearance);
    }
    if variant == SnapshotVariant::Settings {
        return capture_settings(language, appearance);
    }
    if variant == SnapshotVariant::Users {
        return capture_users(language, appearance);
    }
    if variant == SnapshotVariant::AppStore {
        return capture_app_store(language, appearance);
    }
    if variant == SnapshotVariant::Support {
        return capture_support(language, appearance);
    }

    if variant == SnapshotVariant::Reports {
        return capture_reports(language, appearance);
    }

    if variant == SnapshotVariant::Therapie {
        return capture_therapie(language, appearance);
    }

    if variant == SnapshotVariant::Studio
        || variant == SnapshotVariant::StudioData
        || variant == SnapshotVariant::StudioLayout
    {
        return capture_desktop(language, appearance, variant);
    }

    if matches!(
        variant,
        SnapshotVariant::Editor | SnapshotVariant::EditorPreview | SnapshotVariant::EditorSpell
    ) {
        return capture_editor(language, appearance, variant);
    }
    if matches!(
        variant,
        SnapshotVariant::Login
            | SnapshotVariant::Locked
            | SnapshotVariant::Setup
            | SnapshotVariant::Unlocked
    ) {
        return capture_auth(language, appearance, variant);
    }
    if matches!(
        variant,
        SnapshotVariant::Desktop
            | SnapshotVariant::StartMenu
            | SnapshotVariant::Palette
            | SnapshotVariant::Tray
            | SnapshotVariant::Onboarding
            | SnapshotVariant::Wallpaper
    ) {
        return capture_desktop(language, appearance, variant);
    }
    let ctx = Context::default();
    let mut state = PrimitiveState::new(language, appearance).expect("embedded catalogue");
    if variant == SnapshotVariant::Drawer {
        state.drawer_open = true;
    }
    let _layout_frame = render_frame(&ctx, &mut state);
    if variant == SnapshotVariant::Focused {
        state.focus.focus_first();
    }
    let output = render_frame(&ctx, &mut state);
    signature(&output)
}

/// Renders the dashboard screen with its deterministic sample data.
fn capture_dashboard(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let mut focus = FocusState::default();
    let mut state = DashboardState::new(DashboardData::sample(&texts));
    // egui keeps parts of a freshly built scroll area invisible in the first frame; two frames
    // produce the settled paint commands, exactly like the desktop scenes.
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 1400.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("dashboard"),
                |focus| {
                    dashboard(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        crate::dashboard::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }
    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Dashboard)];
    lines.extend(signature(&output.expect("dashboard frame")));
    lines
}

/// Renders the contacts screen with its deterministic sample data.
fn capture_contacts(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_contacts(&store, &texts).expect("seed contacts");
    let mut focus = FocusState::default();
    let mut state = ContactsState::new();
    state.refresh(&store).expect("load contacts");

    // Two frames: egui settles scroll areas and text layout on the second pass.
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 1400.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("contacts"),
                |focus| {
                    contacts(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::contacts::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Contacts)];
    lines.extend(signature(&output.expect("contacts frame")));
    lines
}

/// Renders the products screen with its deterministic sample data.
fn capture_products(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_products(&store, &texts).expect("seed products");
    let mut focus = FocusState::default();
    let mut state = ProductsState::new();
    state.refresh(&store).expect("load products");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 1400.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("products"),
                |focus| {
                    products(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::products::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Products)];
    lines.extend(signature(&output.expect("products frame")));
    lines
}

/// Renders the invoices screen with its deterministic sample data.
fn capture_invoices(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_invoices(&store, &texts).expect("seed invoices");
    let mut focus = FocusState::default();
    let mut state = InvoicesState::new();
    state.refresh(&store).expect("load invoices");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("invoices"),
                |focus| {
                    invoices(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::invoices::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Invoices)];
    lines.extend(signature(&output.expect("invoices frame")));
    lines
}

/// Renders the accounting screen with its deterministic sample data.
fn capture_accounting(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_accounting(&store, &texts).expect("seed accounting");
    let mut focus = FocusState::default();
    let mut state = AccountingState::new();
    state
        .refresh(&store, crate::accounting::SAMPLE_NOW_MS)
        .expect("load journal");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("accounting"),
                |focus| {
                    accounting(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::accounting::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Accounting)];
    lines.extend(signature(&output.expect("accounting frame")));
    lines
}

/// Renders the purchases screen with its deterministic sample data.
fn capture_purchases(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_purchases(&store, &texts).expect("seed purchases");
    let mut focus = FocusState::default();
    let mut state = PurchasesState::new();
    state.refresh(&store).expect("load purchase orders");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("purchases"),
                |focus| {
                    purchases(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::purchases::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Purchases)];
    lines.extend(signature(&output.expect("purchases frame")));
    lines
}

/// Renders the POS screen with its deterministic sample data.
fn capture_pos(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_pos(&store, &texts).expect("seed receipts");
    let mut focus = FocusState::default();
    let mut state = PosState::new();
    state.refresh(&store).expect("load receipts");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("pos"),
                |focus| {
                    pos(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::pos::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Pos)];
    lines.extend(signature(&output.expect("pos frame")));
    lines
}

/// Renders the calendar screen with its deterministic sample data.
fn capture_calendar(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_appointments(&store, &texts).expect("seed appointments");
    let mut focus = FocusState::default();
    let mut state = AppointmentsState::new();
    state.refresh(&store).expect("load appointments");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("calendar"),
                |focus| {
                    appointments(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::appointments::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Calendar)];
    lines.extend(signature(&output.expect("calendar frame")));
    lines
}

/// Renders the settings screen with its deterministic sample data.
fn capture_settings(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_settings(&store, &texts).expect("seed settings");
    let mut focus = FocusState::default();
    let mut state = SettingsState::new();
    state.refresh(&store).expect("load settings");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("settings"),
                |focus| {
                    settings(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::settings::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Settings)];
    lines.extend(signature(&output.expect("settings frame")));
    lines
}

/// Renders the user management screen with its deterministic sample accounts.
fn capture_users(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_users(&store).expect("seed users");
    let mut focus = FocusState::default();
    let mut state = UsersState::new();
    state.refresh(&store).expect("load users");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("users"),
                |focus| {
                    users(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::users::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Users)];
    lines.extend(signature(&output.expect("users frame")));
    lines
}

/// Renders the App Store with one deactivated module and the locked therapy module.
fn capture_app_store(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    socdof_core::app_store::set_active(&store, "contacts", false).expect("deactivate contacts");
    let mut focus = FocusState::default();
    let mut state = AppStoreState::new();
    state.refresh(&store).expect("load catalogue");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 2800.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("app-store"),
                |focus| {
                    app_store(ctx, &theme, &texts, focus, &mut state, &store);
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::AppStore)];
    lines.extend(signature(&output.expect("app-store frame")));
    lines
}

/// Renders the support module with its sample tickets and tracked time.
fn capture_support(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_support(&store, &texts).expect("seed tickets");
    let mut focus = FocusState::default();
    let mut state = SupportState::new();
    state.refresh(&store).expect("load tickets");

    if let Some(id) = state.tickets.first().map(|ticket| ticket.id) {
        state.select(id);
        state.refresh(&store).expect("load time entries");
    }

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("support"),
                |focus| {
                    support(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        SUPPORT_SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Support)];
    lines.extend(signature(&output.expect("support frame")));
    lines
}

/// Renders the reports module over the seeded invoices.
fn capture_reports(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    crate::invoices::seed_invoices(&store, &texts).expect("seed invoices");
    let mut focus = FocusState::default();
    let mut state = ReportsState::new();
    state
        .refresh(&store, REPORTS_SAMPLE_NOW_MS)
        .expect("load report");

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1500.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("reports"),
                |focus| {
                    reports(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        REPORTS_SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Reports)];
    lines.extend(signature(&output.expect("reports frame")));
    lines
}

/// Renders the therapy module with its sample practice.
fn capture_therapie(language: Language, appearance: Appearance) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_therapie(&store, &texts).expect("seed practice");
    let mut focus = FocusState::default();
    let mut state = TherapieState::new();
    state.refresh(&store).expect("load clients");
    if let Some(id) = state.clients.first().map(|client| client.id) {
        state.select(&store, id).expect("load sessions");
    }

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1600.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("therapy"),
                |focus| {
                    therapie(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        THERAPIE_SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", SnapshotVariant::Therapie)];
    lines.extend(signature(&output.expect("therapy frame")));
    lines
}

/// Renders the text editor with two deterministic documents.
fn capture_editor(
    language: Language,
    appearance: Appearance,
    variant: SnapshotVariant,
) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    seed_documents(&store, &texts).expect("seed documents");
    let mut focus = FocusState::default();
    let mut state = EditorState::new();
    state.reset_for_open(&store).expect("load documents");
    if variant == SnapshotVariant::EditorPreview {
        state.preview = true;
    }
    if variant == SnapshotVariant::EditorSpell {
        state.spell_ignored = vec!["Landingpage".to_string(), "Feedback".to_string()];
        state.selection = (0, 0);
    }

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 1500.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            crate::chrome::app_window(
                ctx,
                &theme,
                &texts,
                &mut focus,
                crate::chrome::app_chrome("editor"),
                |focus| {
                    editor(
                        ctx,
                        &theme,
                        &texts,
                        focus,
                        &mut state,
                        &store,
                        crate::editor::SAMPLE_NOW_MS,
                    );
                },
            );
        }));
    }

    let mut lines = vec![format!("scene(variant={variant:?})")];
    lines.extend(signature(&output.expect("editor frame")));
    lines
}

/// Renders the login, lock, setup or signed-in screen with deterministic data.
fn capture_auth(
    language: Language,
    appearance: Appearance,
    variant: SnapshotVariant,
) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
    let now = crate::dashboard::SAMPLE_NOW_MS;
    let mut focus = FocusState::default();
    let mut state = if variant == SnapshotVariant::Setup {
        AuthState::new(&store, now).expect("setup state")
    } else {
        seed_users(&store).expect("seed users");
        AuthState::signed_in(&store, "admin", "Socdof2026!", now).expect("signed-in state")
    };
    state.idle_timeout_ms = DEFAULT_IDLE_TIMEOUT_MS;
    match variant {
        SnapshotVariant::Login => state.show_login(),
        SnapshotVariant::Locked => state.lock(now),
        SnapshotVariant::Setup => state.show_setup(),
        SnapshotVariant::Unlocked => state.show_unlocked(),
        _ => {}
    }

    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 820.0))),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            auth(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
        }));
    }

    let mut lines = vec![format!("scene(variant={:?})", variant)];
    lines.extend(signature(&output.expect("auth frame")));
    lines
}

/// Renders the desktop shell with a fixed screen, two open windows and a fixed clock.
fn capture_desktop(
    language: Language,
    appearance: Appearance,
    variant: SnapshotVariant,
) -> Vec<String> {
    let ctx = Context::default();
    let theme = Theme::new(appearance, "indigo");
    let texts = UiTexts::embedded(language).expect("embedded catalogue");
    let mut focus = FocusState::default();
    let mut icons = IconGrid::new(vec![
        DesktopIcon::new(
            AppId::new("contacts"),
            texts.get("app_contacts"),
            Icon::User,
        ),
        DesktopIcon::new(
            AppId::new("products"),
            texts.get("app_products"),
            Icon::Folder,
        ),
        DesktopIcon::new(
            AppId::new("invoices"),
            texts.get("app_invoices"),
            Icon::Calendar,
        ),
    ]);
    let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 1400.0));
    let area = work_area(screen);
    let mut windows = WindowManager::new();
    windows.open(
        Window::new(
            AppId::new("contacts"),
            texts.get("app_contacts"),
            default_window_rect(area, 0),
        ),
        1_000,
    );
    windows.open(
        Window::new(
            AppId::new("invoices"),
            texts.get("app_invoices"),
            default_window_rect(area, 1),
        ),
        1_000,
    );
    let store = {
        let store = socdof_core::store::Store::open_in_memory().expect("in-memory store");
        let profile = socdof_core::domain::settings::CompanyProfile {
            name: "Studio Lindner".to_string(),
            street: "Hauptstraße 4".to_string(),
            zip_city: "10115 Berlin".to_string(),
            email: "info@studiolindner.de".to_string(),
            ..Default::default()
        };
        store.save_company_profile(&profile).expect("profile");
        store
    };
    let mut shell = ShellState::new();
    shell.onboarding = Onboarding::restore(true);
    match variant {
        SnapshotVariant::Studio => shell.studio.open(&store),
        SnapshotVariant::StudioData => {
            shell.studio.open(&store);
            shell.studio.set_tab(crate::studio::StudioTab::Data);
        }
        SnapshotVariant::StudioLayout => {
            shell.studio.open(&store);
            shell.studio.set_tab(crate::studio::StudioTab::Layout);
            *shell.studio.layout_mut() = crate::studio::gallery_layout();
        }
        SnapshotVariant::StartMenu => shell.open_start(),
        SnapshotVariant::Palette => shell.open_palette(),
        SnapshotVariant::Tray => shell.toggle_tray(),
        SnapshotVariant::Onboarding => shell.onboarding.restart(),
        SnapshotVariant::Wallpaper => {
            shell.wallpaper.wallpaper = Wallpaper::Dusk;
            shell.wallpaper.fit = WallpaperFit::Tile;
        }
        _ => {}
    }
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(screen),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            theme.apply(ctx);
            desktop(
                ctx,
                DesktopFrame {
                    theme: &theme,
                    texts: &texts,
                    shell: &mut shell,
                    store: &store,
                },
                &mut focus,
                &mut icons,
                &mut windows,
                1_000,
            );
            focus.finish_frame();
        }));
    }
    let mut lines = vec![format!(
        "scene(wallpaper={},fit={:?},variant={:?})",
        shell.wallpaper.wallpaper.id(),
        shell.wallpaper.fit,
        variant
    )];
    lines.extend(signature(&output.expect("desktop frame")));
    lines
}

/// Reduces a frame to stable text lines.
pub fn signature(output: &FullOutput) -> Vec<String> {
    output
        .shapes
        .iter()
        .map(|clipped| {
            let clip = clipped.clip_rect;
            format!(
                "clip({:.1},{:.1},{:.1},{:.1}) {}",
                clip.min.x,
                clip.min.y,
                clip.max.x,
                clip.max.y,
                shape_signature(&clipped.shape)
            )
        })
        .collect()
}

/// Runs one frame of the scene with a fixed screen size and time.
fn render_frame(ctx: &Context, state: &mut PrimitiveState) -> FullOutput {
    let input = RawInput {
        screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 1400.0))),
        time: Some(1.0),
        ..Default::default()
    };
    ctx.run(input, |ctx| {
        state.focus.begin_frame(ctx);
        primitives(ctx, state);
        state.focus.finish_frame();
    })
}

/// Draws the primitive scene.
pub fn primitives(ctx: &Context, state: &mut PrimitiveState) {
    let theme = Theme::new(state.appearance, "indigo");
    theme.apply(ctx);
    let texts = state.texts.clone();
    let focus = &mut state.focus;

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            ui.set_min_width(640.0);
            ui.horizontal(|ui| {
                button(
                    ui,
                    &theme,
                    focus,
                    texts.get("button_primary"),
                    ButtonVariant::Primary,
                );
                button(
                    ui,
                    &theme,
                    focus,
                    texts.get("button_secondary"),
                    ButtonVariant::Secondary,
                );
                button(
                    ui,
                    &theme,
                    focus,
                    texts.get("button_ghost"),
                    ButtonVariant::Ghost,
                );
                button(
                    ui,
                    &theme,
                    focus,
                    texts.get("button_danger"),
                    ButtonVariant::Danger,
                );
            });
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                icon_button(
                    ui,
                    &theme,
                    focus,
                    Icon::Search,
                    texts.get("icon_label_search"),
                );
                icon_button(ui, &theme, focus, Icon::Plus, texts.get("icon_label_add"));
                icon_button(ui, &theme, focus, Icon::Edit, texts.get("icon_label_edit"));
                icon_button(
                    ui,
                    &theme,
                    focus,
                    Icon::Trash,
                    texts.get("icon_label_delete"),
                );
            });
            ui.add_space(8.0);
            let terms = [
                texts.get("select_net_7"),
                texts.get("select_net_14"),
                texts.get("select_net_30"),
            ];
            select(
                ui,
                &theme,
                focus,
                &mut state.select,
                "snapshot-term",
                &mut state.selected,
                &terms,
            );
            ui.add_space(8.0);
            checkbox(
                ui,
                &theme,
                focus,
                &mut state.checked,
                texts.get("checkbox_draft"),
            );
            switch(
                ui,
                &theme,
                focus,
                &mut state.switched,
                texts.get("switch_backup"),
            );
            ui.add_space(8.0);
            text_field(
                ui,
                &theme,
                focus,
                &mut state.company,
                texts.get("field_company"),
                texts.get("field_company_hint"),
                None,
            );
            text_field(
                ui,
                &theme,
                focus,
                &mut state.email,
                texts.get("field_email"),
                texts.get("field_email_hint"),
                Some(texts.get("error_required")),
            );
            ui.add_space(8.0);
            drop_zone(ui, &theme, focus, texts.get("drop_hint"), false);
            ui.add_space(8.0);
            let weekdays: [&str; 7] = std::array::from_fn(|index| texts.get(WEEKDAY_KEYS[index]));
            let months: [&str; 12] = std::array::from_fn(|index| texts.get(MONTH_KEYS[index]));
            let labels = CalendarLabels {
                weekdays,
                months,
                previous: texts.get("calendar_previous"),
                next: texts.get("calendar_next"),
            };
            calendar(ui, &theme, focus, &mut state.calendar, &labels);
        });

    if state.drawer_open {
        let trigger = state.drawer_trigger;
        drawer(
            ctx,
            &theme,
            focus,
            &mut state.drawer_open,
            trigger,
            DrawerLabels {
                title: texts.get("drawer_title"),
                close: texts.get("drawer_close"),
            },
            |ui, _focus| {
                ui.label(texts.get("drawer_body"));
                false
            },
        );
    }
}

/// Month keys in calendar order.
const MONTH_KEYS: [&str; 12] = [
    "month_1", "month_2", "month_3", "month_4", "month_5", "month_6", "month_7", "month_8",
    "month_9", "month_10", "month_11", "month_12",
];

/// Weekday keys, Monday first.
const WEEKDAY_KEYS: [&str; 7] = [
    "weekday_1",
    "weekday_2",
    "weekday_3",
    "weekday_4",
    "weekday_5",
    "weekday_6",
    "weekday_7",
];

fn shape_signature(shape: &Shape) -> String {
    match shape {
        Shape::Noop => "noop".to_string(),
        Shape::Vec(shapes) => {
            let inner: Vec<String> = shapes.iter().map(shape_signature).collect();
            format!("vec[{}]", inner.join(";"))
        }
        Shape::Circle(circle) => format!(
            "circle({:.2},{:.2},{:.2})",
            circle.center.x, circle.center.y, circle.radius
        ),
        Shape::Ellipse(ellipse) => format!(
            "ellipse({:.2},{:.2},{:.2},{:.2})",
            ellipse.center.x, ellipse.center.y, ellipse.radius.x, ellipse.radius.y
        ),
        Shape::LineSegment { points, stroke } => format!(
            "line({:.2},{:.2},{:.2},{:.2},{:?},{:.2})",
            points[0].x, points[0].y, points[1].x, points[1].y, stroke.color, stroke.width
        ),
        Shape::Path(path) => format!("path({},{})", path.points.len(), path.closed),
        Shape::Rect(rect) => format!(
            "rect({:.2},{:.2},{:.2},{:.2},{:?},{:?})",
            rect.rect.min.x,
            rect.rect.min.y,
            rect.rect.max.x,
            rect.rect.max.y,
            rect.fill,
            rect.stroke.color
        ),
        Shape::Text(text) => format!(
            "text({:.2},{:.2},{:?})",
            text.pos.x,
            text.pos.y,
            text.galley.text()
        ),
        Shape::Mesh(mesh) => format!("mesh({},{})", mesh.vertices.len(), mesh.indices.len()),
        Shape::QuadraticBezier(curve) => format!(
            "qbez({:.2},{:.2},{:.2},{:.2})",
            curve.points[0].x, curve.points[0].y, curve.points[2].x, curve.points[2].y
        ),
        Shape::CubicBezier(curve) => format!(
            "cbez({:.2},{:.2},{:.2},{:.2})",
            curve.points[0].x, curve.points[0].y, curve.points[3].x, curve.points[3].y
        ),
        Shape::Callback(_) => "callback".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_is_deterministic() {
        let first = capture(Language::De, Appearance::Light, SnapshotVariant::Idle);
        let second = capture(Language::De, Appearance::Light, SnapshotVariant::Idle);
        assert_eq!(first, second);
        assert!(first.len() > 50, "only {} shapes captured", first.len());
    }

    #[test]
    fn focus_and_drawer_change_the_paint_commands() {
        let idle = capture(Language::En, Appearance::Dark, SnapshotVariant::Idle);
        let focused = capture(Language::En, Appearance::Dark, SnapshotVariant::Focused);
        let drawer = capture(Language::En, Appearance::Dark, SnapshotVariant::Drawer);
        assert_ne!(idle, focused, "focus ring did not change the frame");
        assert_ne!(idle, drawer, "drawer did not change the frame");
    }

    #[test]
    fn languages_and_appearances_produce_different_frames() {
        let de = capture(Language::De, Appearance::Light, SnapshotVariant::Idle);
        let fr = capture(Language::Fr, Appearance::Light, SnapshotVariant::Idle);
        let dark = capture(Language::De, Appearance::Dark, SnapshotVariant::Idle);
        assert_ne!(de, fr);
        assert_ne!(de, dark);
    }
}
