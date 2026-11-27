//! Component gallery: every control of the kit, in both appearances, four languages and the built-in
//! accents.
//!
//! The gallery is the Phase 4 acceptance surface and the visual reference for the later module
//! screens. It is drawn entirely by Rust: there is no HTML, no CSS and no JavaScript involved. With
//! the `window` feature the same function runs inside the eframe window host.

use egui::{Context, Id, Key, Modifiers, Pos2, Rect, RichText, Vec2};
use socdof_core::app_store;
use socdof_core::domain::permission::{AppModule, PermissionLevel};
use socdof_core::domain::settings::{Language, ThemeMode};
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::money::Money;
use socdof_core::now_millis;
use socdof_core::settings_service::{self, Preferences};

use crate::accounting::{accounting, seed_accounting, AccountingState};
use crate::app_store::{app_store as app_store_screen, AppStoreState};
use crate::appointments::{appointments, seed_appointments, AppointmentsState};
use crate::auth::{auth, AuthState};
use crate::calendar::CalendarState;
use crate::components::{
    badge, button, card, empty_state, icon_button, modal, search_field, sort_header, tabs,
    toast_stack, ButtonVariant, SortState, Toasts, Tone,
};
use crate::contacts::{contacts, seed_sample, ContactsState};
use crate::controls::{
    calendar, checkbox, drawer, drop_zone, menu, select, switch, text_field, CalendarLabels,
    DrawerLabels, PopupState,
};
use crate::dashboard::{dashboard, DashboardAction, DashboardData, DashboardState};
use crate::desktop::{
    desktop_with_content, work_area, AppId, DesktopFrame, DesktopIcon, IconGrid, Window,
    WindowManager,
};
use crate::editor::{editor as editor_screen, seed_documents, EditorState};
use crate::fleet::{fleet, FleetState};
use crate::focus::FocusState;
use crate::form::{CloseDecision, Field, FormState, UnsavedGuard};
use crate::i18n::{detect_system_language, load_texts, system_language_sync_enabled, UiTexts};
use crate::icons::Icon;
use crate::invoices::{invoices, seed_invoices, InvoicesState};
use crate::pos::{pos, seed_pos, PosState};
use crate::products::{products, seed_products, ProductsState};
use crate::projects::{projects, ProjectsState};
use crate::purchases::{purchases, seed_purchases, PurchasesState};
use crate::reports::{reports as reports_screen, ReportsState};
use crate::settings::{seed_settings, settings, SettingsState};
use crate::shell::{onboarding, PaletteQuickAction, ShellState};
use crate::support::{seed_sample as seed_support, support as support_screen, SupportState};
use crate::theme::{Appearance, Theme};
use crate::therapie::{seed_sample as seed_therapie, therapie as therapie_screen, TherapieState};
use crate::tokens::{preset_ids, AccentPreset, FONT_SMALL, FONT_TITLE};
use crate::users::{users, UsersState};
use socdof_core::store::Store;

/// How long a toast stays visible in the gallery.
const TOAST_TTL_MS: i64 = 4_000;

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

/// Icons shown with their tooltip key.
const GALLERY_ICONS: [(Icon, &str); 8] = [
    (Icon::Search, "icon_label_search"),
    (Icon::Plus, "icon_label_add"),
    (Icon::Edit, "icon_label_edit"),
    (Icon::Trash, "icon_label_delete"),
    (Icon::Close, "icon_label_close"),
    (Icon::Upload, "icon_label_upload"),
    (Icon::Calendar, "icon_label_calendar"),
    (Icon::More, "icon_label_more"),
];

/// Draws a module screen inside its SOCDOF application window.
///
/// Returns `true` when the window buttons asked to close or minimize the screen, so the host can
/// navigate back to the desktop.
fn app_view(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    slug: &str,
    body: impl FnOnce(&mut FocusState),
) -> crate::chrome::WindowAction {
    crate::chrome::app_window(
        ctx,
        theme,
        texts,
        focus,
        crate::chrome::app_chrome(slug),
        body,
    )
}

/// Translated label of a desktop app.
fn app_label(texts: &UiTexts, app: AppId) -> String {
    crate::chrome::app_title(texts, crate::chrome::app_chrome(app.as_str()))
}

/// Apps the legacy shell pins to the desktop after the personal first-run setup.
///
/// The setup stores `SETUP_CORE_MODULES` plus the personal template as `odoo_pinned_desktop`
/// (`SOCDOF - TS/src/components/auth/AuthGate.tsx:173–178, 973–991`), and the desktop renders
/// exactly that list (`DesktopWindowWorkspace.tsx:323–340, 2780`) instead of every installed
/// module.
pub const PINNED_DESKTOP: [&str; 8] = [
    "dashboard",
    "app-store",
    "documentation",
    "settings",
    "contacts",
    "calendar",
    "calculator",
    "widgets",
];

/// Desktop and start-menu icons of the modules that are currently enabled.
///
/// Every enabled module gets its own tile with the icon and color of the legacy app launcher, so the
/// desktop shows the same apps as the shipped application.
fn desktop_icons(texts: &UiTexts, active: &[AppModule]) -> IconGrid {
    let mut icons = Vec::new();
    for (module, slug) in [
        (AppModule::Dashboard, "dashboard"),
        (AppModule::Contacts, "contacts"),
        (AppModule::Products, "products"),
        (AppModule::Projects, "projects"),
        (AppModule::Fleet, "fleet"),
        (AppModule::Restaurant, "restaurant"),
        (AppModule::Invoices, "invoices"),
        (AppModule::Accounting, "accounting"),
        (AppModule::Purchases, "purchases"),
        (AppModule::Pos, "pos"),
        (AppModule::Calendar, "calendar"),
        (AppModule::Support, "support"),
        (AppModule::Reports, "reports"),
        (AppModule::Therapy, "therapy"),
        (AppModule::Users, "users"),
        (AppModule::Settings, "settings"),
        (AppModule::Editor, "editor"),
        (AppModule::Documentation, "documentation"),
    ] {
        if !active.contains(&module) {
            continue;
        }
        let app = crate::chrome::app_chrome(slug);
        icons.push(DesktopIcon::new(
            AppId::new(app.slug),
            texts.get(app.title_key),
            app.icon,
        ));
    }
    // App Store, calculator and widgets are desktop utilities rather than permission-controlled
    // business modules, so they are always available on the desktop and in the start menu.
    for slug in ["app-store", "calculator", "widgets"] {
        let app = crate::chrome::app_chrome(slug);
        icons.push(DesktopIcon::new(
            AppId::new(app.slug),
            texts.get(app.title_key),
            app.icon,
        ));
    }
    IconGrid::new(icons)
}

/// Resolves a persisted start-up module to a stable desktop app identifier.
fn startup_app(module: &str) -> Option<AppId> {
    Some(match module {
        "dashboard" => AppId::new("dashboard"),
        "contacts" => AppId::new("contacts"),
        "products" => AppId::new("products"),
        "projects" => AppId::new("projects"),
        "fleet" => AppId::new("fleet"),
        "restaurant" => AppId::new("restaurant"),
        "invoices" => AppId::new("invoices"),
        "accounting" => AppId::new("accounting"),
        "purchases" => AppId::new("purchases"),
        "pos" => AppId::new("pos"),
        "calendar" => AppId::new("calendar"),
        "support" => AppId::new("support"),
        "reports" => AppId::new("reports"),
        "therapy" => AppId::new("therapy"),
        "users" => AppId::new("users"),
        "settings" => AppId::new("settings"),
        "editor" => AppId::new("editor"),
        "documentation" => AppId::new("documentation"),
        _ => return None,
    })
}

/// Slugs whose native window state is managed by the desktop window manager.
const NATIVE_WINDOW_SLUGS: &[&str] = &[
    "contacts",
    "invoices",
    "settings",
    "accounting",
    "pos",
    "therapy",
    "users",
    "dashboard",
    "products",
    "projects",
    "fleet",
    "restaurant",
    "purchases",
    "calendar",
    "editor",
    "app-store",
    "support",
    "reports",
    "documentation",
];

/// Replaces the saved open-window set with the windows that are actually open now.
///
/// Clearing every known slug first is important: otherwise a window closed during this session
/// remains marked as open in the previous layout and unexpectedly reappears on the next login.
fn capture_native_windows(layout: &mut settings_service::DesktopLayout, windows: &WindowManager) {
    for slug in NATIVE_WINDOW_SLUGS {
        let saved = layout.window_states.entry((*slug).to_string()).or_default();
        saved.open = false;
        saved.minimized = false;
    }

    for (z_order, window) in windows.windows().iter().enumerate() {
        let rect = window.normal_rect();
        layout.window_states.insert(
            window.app().as_str().to_string(),
            settings_service::DesktopWindowLayout {
                x: rect.min.x.round() as i32,
                y: rect.min.y.round() as i32,
                width: rect.width().round().max(320.0) as u32,
                height: rect.height().round().max(220.0) as u32,
                maximized: window.is_maximized(),
                open: true,
                minimized: window.is_minimized(),
                z_order: z_order as u32,
                desktop_id: window.desktop().map(str::to_owned),
            },
        );
    }
}

/// Restores only native windows that were open for this account at the previous exit.
fn restore_native_windows(
    state: &mut GalleryState,
    layout: &settings_service::DesktopLayout,
    screen: Rect,
    now: i64,
) {
    let area = work_area(screen);
    let mut saved_windows = layout
        .window_states
        .iter()
        .filter(|(_, window)| window.open)
        .collect::<Vec<_>>();
    saved_windows.sort_by(|(left_slug, left), (right_slug, right)| {
        left.z_order
            .cmp(&right.z_order)
            .then_with(|| left_slug.cmp(right_slug))
    });

    for (slug, saved) in saved_windows {
        let app = match slug.as_str() {
            "contacts" => AppId::new("contacts"),
            "invoices" => AppId::new("invoices"),
            "settings" => AppId::new("settings"),
            "accounting" => AppId::new("accounting"),
            "pos" => AppId::new("pos"),
            "therapy" => AppId::new("therapy"),
            "users" => AppId::new("users"),
            "dashboard" => AppId::new("dashboard"),
            "products" => AppId::new("products"),
            "projects" => AppId::new("projects"),
            "fleet" => AppId::new("fleet"),
            "restaurant" => AppId::new("restaurant"),
            "purchases" => AppId::new("purchases"),
            "calendar" => AppId::new("calendar"),
            "editor" => AppId::new("editor"),
            "support" => AppId::new("support"),
            "reports" => AppId::new("reports"),
            "app-store" => AppId::new("app-store"),
            "documentation" => AppId::new("documentation"),
            _ => continue,
        };
        let Some(title) = state.desktop_icons.label_of(app) else {
            continue;
        };

        let width = (saved.width as f32).clamp(320.0, area.width());
        let height = (saved.height as f32).clamp(220.0, area.height());
        let x = (saved.x as f32).clamp(area.left(), (area.right() - width).max(area.left()));
        let y = (saved.y as f32).clamp(area.top(), (area.bottom() - height).max(area.top()));
        let rect = Rect::from_min_size(Pos2::new(x, y), Vec2::new(width, height));

        // A desktop that no longer exists falls back to the shared `all` filing.
        let desktop = saved.desktop_id.as_ref().and_then(|id| {
            let known = layout
                .virtual_desktops
                .iter()
                .any(|desktop| desktop.id == *id)
                || id == settings_service::DESKTOP_ALL_ID;
            known.then(|| id.clone())
        });
        state
            .desktop_windows
            .open(Window::new(app, title, rect), now);
        state.desktop_windows.move_to_desktop(app, desktop);
        if saved.maximized {
            state.desktop_windows.toggle_maximize(app, area);
        }
        if saved.minimized {
            state.desktop_windows.minimize(app);
        }
    }
}

/// Resolves the ordered module slugs selected by the first-run setup wizard.
fn resolve_setup_apps(auth: &AuthState) -> Vec<String> {
    let mut apps: Vec<String> = if auth.setup_apps.is_empty() {
        crate::auth_screens::template_apps_for(auth.template_choice, auth.account_type)
            .into_iter()
            .map(str::to_owned)
            .collect()
    } else {
        auth.setup_apps
            .iter()
            .filter(|slug| crate::auth_screens::module_visible_for(auth.account_type, slug))
            .cloned()
            .collect()
    };
    if apps.is_empty() && auth.template_choice != crate::auth::SetupTemplate::All {
        return Vec::new();
    }
    if auth.template_choice == crate::auth::SetupTemplate::All && apps.is_empty() {
        apps = socdof_core::domain::permission::ALL_MODULES
            .iter()
            .map(|module| module.as_str().to_owned())
            .filter(|slug| crate::auth_screens::module_visible_for(auth.account_type, slug))
            .collect();
    }
    for required in ["dashboard", "settings", "users"] {
        if !apps.iter().any(|slug| slug == required) {
            apps.push(required.to_owned());
        }
    }
    apps
}

/// Trims the desktop to the template and the apps chosen in the wizard.
fn apply_setup_template(state: &mut GalleryState) {
    let apps = resolve_setup_apps(&state.auth);
    if apps.is_empty() {
        return;
    }
    let refs: Vec<&str> = apps.iter().map(String::as_str).collect();
    state.desktop_icons.retain_apps(&refs);
    state.desktop_pinned = state.desktop_icons.pinned(&PINNED_DESKTOP);
}

/// Setting key the demo action menu stores its accepted choice under.
const MENU_ACTION_SETTING: &str = "gallery:menu_action";
/// Labels of the demo action menu in paint order; the index is the value the menu stands for.
const MENU_ACTIONS: [&str; 4] = ["menu_open", "menu_duplicate", "menu_archive", "menu_delete"];

/// State of the gallery screen.
pub struct GalleryState {
    /// Language of every label.
    pub language: Language,
    /// Resolved appearance.
    pub appearance: Appearance,
    /// Selected accent id.
    pub accent_id: String,
    /// Translated labels.
    pub texts: UiTexts,
    /// Keyboard focus of the screen.
    pub focus: FocusState,
    /// Current search text.
    pub search: String,
    /// Selected tab.
    pub tab: usize,
    /// Table sort state.
    pub sort: SortState,
    /// Transient messages.
    pub toasts: Toasts,
    /// Whether the demo dialog is open.
    pub modal_open: bool,
    /// Selected payment term.
    pub select: usize,
    /// Dropdown state of the payment term.
    pub select_popup: PopupState,
    /// Selected value of the second dropdown, which deliberately shares the first one's source.
    pub select_second: usize,
    /// Dropdown state of that second select; it must stay separate from the first one.
    pub select_popup_second: PopupState,
    /// Value of the dropdown that only appears while the draft switch is on.
    pub select_extra: usize,
    /// Dropdown state of that conditional select; its identity must survive appearing late.
    pub select_popup_extra: PopupState,
    /// Action chosen in the menu that only appears while the draft switch is on.
    pub menu_choice_extra: Option<usize>,
    /// Dropdown state of that conditional menu; its identity must survive appearing late.
    pub menu_popup_extra: PopupState,
    /// How often the file drop area was activated by pointer or keyboard.
    pub drop_activations: usize,
    /// Value of the dropdown that owns the shared popup state.
    pub mirror_a: usize,
    /// Value of the dropdown that is handed a copy of that popup state.
    pub mirror_b: usize,
    /// Popup state of the first dropdown of the copied-state pair.
    pub mirror_popup: PopupState,
    /// Deliberately a copy of `mirror_popup`, handed to the second dropdown in the same frame.
    pub mirror_copy: PopupState,
    /// Whether the copy of the popup state has been taken yet.
    pub mirror_copied: bool,
    /// Menu state of the actions menu.
    pub menu_popup: PopupState,
    /// Action chosen in the demo menu, `None` until the menu was used.
    pub menu_choice: Option<usize>,
    /// Action the demo form accepted, restored from the store on startup.
    pub menu_saved: Option<usize>,
    /// Action chosen in the second, equally labelled menu of the demo row.
    pub menu_choice_second: Option<usize>,
    /// Dropdown state of that second menu; it must stay separate from the first one.
    pub menu_popup_second: PopupState,
    /// Demo checkbox.
    pub draft: bool,
    /// Demo switch.
    pub backup: bool,
    /// Date picker selection.
    pub calendar: CalendarState,
    /// Demo form with validation.
    pub form: FormState,
    /// Guard for unsaved form edits.
    pub guard: UnsavedGuard,
    /// Whether the details drawer is open.
    pub drawer_open: bool,
    /// Focus target the drawer returns to when it closes.
    pub drawer_trigger: Id,
    /// Whether files are currently dragged over the drop area.
    pub drop_hovering: bool,
    /// Whether the desktop shell is shown instead of the gallery.
    pub desktop_open: bool,
    /// Desktop icon grid with cell positions and selection.
    pub desktop_icons: IconGrid,
    /// Desktop surface: only the pinned apps, while `desktop_icons` keeps every installed module
    /// for the start menu and window titles.
    pub desktop_pinned: IconGrid,
    /// Display, memory and mode of the calculator window.
    pub calculator: crate::calculator::CalculatorWindow,
    /// Open windows, z-order and focus of the desktop.
    pub desktop_windows: WindowManager,
    /// Shell overlays, wallpaper and widgets of the desktop and gallery.
    pub shell: ShellState,
    /// Dashboard module state.
    pub dashboard: DashboardState,
    /// Whether the dashboard screen is shown instead of the gallery.
    pub dashboard_open: bool,
    /// Contacts module state.
    pub contacts: ContactsState,
    /// Whether the contacts screen is shown instead of the gallery.
    pub contacts_open: bool,
    /// Products module state.
    pub products: ProductsState,
    /// Whether the products screen is shown instead of the gallery.
    pub products_open: bool,
    /// Project portfolio and task management state.
    pub projects: ProjectsState,
    /// Whether the project management screen is open.
    pub projects_open: bool,
    /// Vehicle fleet, logbook and fuel state.
    pub fleet: FleetState,
    /// Restaurant floor plan, menu, kitchen and checkout state.
    pub restaurant: crate::restaurant::RestaurantState,
    /// Whether the fleet screen is open.
    pub fleet_open: bool,
    /// Whether the restaurant screen is open.
    pub restaurant_open: bool,
    /// Invoices module state.
    pub invoices: InvoicesState,
    /// Whether the invoices screen is shown instead of the gallery.
    pub invoices_open: bool,
    /// Accounting module state.
    pub accounting: AccountingState,
    /// Whether the accounting screen is shown instead of the gallery.
    pub accounting_open: bool,
    /// Purchases module state.
    pub purchases: PurchasesState,
    /// Whether the purchases screen is shown instead of the gallery.
    pub purchases_open: bool,
    /// POS module state.
    pub pos: PosState,
    /// Whether the POS screen is shown instead of the gallery.
    pub pos_open: bool,
    /// Calendar module state.
    pub appointments: AppointmentsState,
    /// Whether the calendar screen is shown instead of the gallery.
    pub appointments_open: bool,
    /// Settings module state.
    pub settings: SettingsState,
    /// Whether the settings screen is shown instead of the gallery.
    pub settings_open: bool,
    /// User management module state.
    pub users: UsersState,
    /// Whether the user management screen is shown instead of the gallery.
    pub users_open: bool,
    /// Text editor module state.
    pub editor: EditorState,
    /// Ribbon text editor window of the desktop.
    pub textwerk: crate::textwerk::TextwerkState,
    /// Whether the editor screen is shown instead of the gallery.
    pub editor_open: bool,
    /// Searchable local documentation manual.
    pub documentation: crate::documentation::DocumentationState,
    /// App Store module state.
    pub app_store: AppStoreState,
    /// Whether the App Store screen is shown instead of the gallery.
    pub app_store_open: bool,
    /// Support module state.
    pub support: SupportState,
    /// Whether the support screen is shown instead of the gallery.
    pub support_open: bool,
    /// Reports module state.
    pub reports: ReportsState,
    /// Whether the reports screen is shown instead of the gallery.
    pub reports_open: bool,
    /// Therapy module state.
    pub therapie: TherapieState,
    /// Whether the therapy screen is shown instead of the gallery.
    pub therapie_open: bool,
    /// Login and lock screen state.
    pub auth: AuthState,
    /// Whether the authentication screen is shown instead of the gallery.
    pub auth_open: bool,
    /// Database backing the UI; in-memory for gallery fixtures and persistent for the desktop host.
    pub store: Store,
}

impl GalleryState {
    /// Builds the sample state used by the component gallery and visual snapshots.
    pub fn new(language: Language, appearance: Appearance, accent_id: &str) -> CoreResult<Self> {
        let store = Store::open_in_memory()?;
        Self::build(language, appearance, accent_id, store, true)
    }

    /// Builds the real application state around an existing persistent database.
    ///
    /// Unlike GalleryState::new, this constructor never inserts sample business records or
    /// demo credentials. Existing accounts are shown at the login screen; a new database starts
    /// in the first-run setup flow.
    pub fn from_store(
        language: Language,
        appearance: Appearance,
        accent_id: &str,
        store: Store,
    ) -> CoreResult<Self> {
        Self::build(language, appearance, accent_id, store, false)
    }

    fn build(
        language: Language,
        appearance: Appearance,
        accent_id: &str,
        store: Store,
        seed_demo_data: bool,
    ) -> CoreResult<Self> {
        let language = if system_language_sync_enabled(&store)? {
            detect_system_language()
        } else {
            language
        };
        let texts = load_texts(language, &store)?;
        let form = FormState::new(vec![
            Field::new(texts.get("field_company"), texts.get("field_company_hint"))
                .required()
                .max_len(80),
            Field::new(texts.get("field_email"), texts.get("field_email_hint"))
                .required()
                .email(),
        ]);
        // The demo menu keeps its accepted action in the store, so a restart starts from the
        // saved value instead of an empty one.
        let menu_saved = store
            .get_setting(MENU_ACTION_SETTING)?
            .and_then(|value| value.as_str().map(str::to_owned))
            .and_then(|key| MENU_ACTIONS.iter().position(|action| *action == key));

        if seed_demo_data {
            seed_sample(&store, &texts)?;
            seed_products(&store, &texts)?;
            seed_invoices(&store, &texts)?;
            seed_accounting(&store, &texts)?;
            seed_purchases(&store, &texts)?;
            seed_pos(&store, &texts)?;
            seed_appointments(&store, &texts)?;
            UsersState::seed(&store)?;
            seed_settings(&store, &texts)?;
            seed_documents(&store, &texts)?;
            seed_support(&store, &texts)?;
            seed_therapie(&store, &texts)?;
        }

        // Keep the real desktop's login/startup path lightweight. Each app refreshes from the
        // persistent store when it is opened; the component gallery still eagerly loads its
        // fixtures so visual and interaction tests keep their established starting state.
        let mut contacts_state = ContactsState::new();
        let mut products_state = ProductsState::new();
        let mut projects_state = ProjectsState::new();
        let mut fleet_state = FleetState::new();
        let mut restaurant_state = crate::restaurant::RestaurantState::new();
        let mut invoices_state = InvoicesState::new();
        let mut accounting_state = AccountingState::new();
        let mut purchases_state = PurchasesState::new();
        let mut pos_state = PosState::new();
        let mut appointments_state = AppointmentsState::new();
        let mut users_state = UsersState::new();
        let mut settings_state = SettingsState::new();
        if seed_demo_data {
            contacts_state.refresh(&store)?;
            products_state.refresh(&store)?;
            projects_state.refresh(&store)?;
            fleet_state.refresh(&store)?;
            restaurant_state.refresh(&store)?;
            invoices_state.refresh(&store)?;
            accounting_state.refresh(&store, now_millis())?;
            purchases_state.refresh(&store)?;
            pos_state.refresh(&store)?;
            appointments_state.refresh(&store)?;
            users_state.refresh(&store)?;
        }
        // Display scaling and night-light are global native-window preferences. Load only
        // this small record at startup; hydrate users, roles and other settings lazily on open.
        settings_state.refresh_display_preferences(&store)?;
        let auth_state = if seed_demo_data {
            AuthState::signed_in(&store, "admin", "Socdof2026!", now_millis())?
        } else {
            AuthState::new(&store, now_millis())?
        };
        let mut editor_state = EditorState::new();
        if seed_demo_data {
            editor_state.reset_for_open(&store)?;
        }

        let mut active_modules = app_store::active_modules(&store)?;
        if active_modules.is_empty() {
            active_modules = socdof_core::domain::permission::ALL_MODULES.to_vec();
        }
        let desktop_icons = desktop_icons(&texts, &active_modules);
        let desktop_pinned = desktop_icons.pinned(&PINNED_DESKTOP);
        let dashboard_data = if seed_demo_data {
            DashboardData::sample(&texts)
        } else {
            let (company, counts, invoices, low_stock) = store.dashboard_snapshot(now_millis())?;
            DashboardData::new(company, counts, invoices, low_stock)
        };
        let mut dashboard = DashboardState::new(dashboard_data);
        dashboard.set_active_modules(active_modules);

        let app_store_state = AppStoreState::new();
        let support_state = SupportState::new();
        let reports_state = ReportsState::new();
        let therapie_state = TherapieState::new();

        Ok(Self {
            language,
            appearance,
            accent_id: accent_id.to_string(),
            texts,
            focus: FocusState::default(),
            search: String::new(),
            tab: 0,
            sort: SortState::default(),
            toasts: Toasts::default(),
            modal_open: false,
            select: 1,
            select_popup: PopupState::default(),
            select_second: 0,
            select_popup_second: PopupState::default(),
            select_extra: 0,
            select_popup_extra: PopupState::default(),
            menu_choice_extra: None,
            menu_popup_extra: PopupState::default(),
            drop_activations: 0,
            mirror_a: 1,
            mirror_b: 0,
            mirror_popup: PopupState::default(),
            mirror_copy: PopupState::default(),
            mirror_copied: false,
            menu_popup: PopupState::default(),
            menu_choice: menu_saved,
            menu_saved,
            menu_choice_second: None,
            menu_popup_second: PopupState::default(),
            draft: false,
            backup: true,
            calendar: CalendarState::from_millis(now_millis()),
            form,
            guard: UnsavedGuard::default(),
            drawer_open: false,
            drawer_trigger: Id::new("socdof-gallery-drawer"),
            drop_hovering: false,
            desktop_open: false,
            desktop_icons,
            desktop_pinned,
            calculator: crate::calculator::CalculatorWindow::new(),
            desktop_windows: WindowManager::default(),
            shell: {
                let mut shell = ShellState::new();
                shell.clock =
                    crate::desktop::ClockSettings::from_profile(&store.company_profile()?);
                if let Ok(pref) = settings_service::desktop_wallpaper(&store) {
                    shell.wallpaper.apply_preference(&pref, 1);
                }
                shell
            },
            dashboard,
            dashboard_open: false,
            contacts: contacts_state,
            contacts_open: false,
            products: products_state,
            products_open: false,
            projects: projects_state,
            projects_open: false,
            fleet: fleet_state,
            fleet_open: false,
            restaurant: restaurant_state,
            restaurant_open: false,
            invoices: invoices_state,
            invoices_open: false,
            accounting: accounting_state,
            accounting_open: false,
            purchases: purchases_state,
            purchases_open: false,
            pos: pos_state,
            pos_open: false,
            appointments: appointments_state,
            appointments_open: false,
            settings: settings_state,
            settings_open: false,
            users: users_state,
            users_open: false,
            editor: editor_state,
            textwerk: Default::default(),
            documentation: crate::documentation::DocumentationState::default(),
            editor_open: false,
            app_store: app_store_state,
            app_store_open: false,
            support: support_state,
            support_open: false,
            reports: reports_state,
            reports_open: false,
            therapie: therapie_state,
            therapie_open: false,
            auth: auth_state,
            auth_open: !seed_demo_data,
            store,
        })
    }

    /// Switches the language and relabels the form while keeping its values and errors.
    pub fn set_language(&mut self, language: Language) -> CoreResult<()> {
        let language = if system_language_sync_enabled(&self.store)? {
            detect_system_language()
        } else {
            language
        };
        let texts = load_texts(language, &self.store)?;
        self.language = language;
        let labels = [
            (texts.get("field_company"), texts.get("field_company_hint")),
            (texts.get("field_email"), texts.get("field_email_hint")),
        ];
        self.form.relabel(&labels);
        self.desktop_icons.relabel(|app| app_label(&texts, app));
        self.desktop_pinned.relabel(|app| app_label(&texts, app));
        self.desktop_windows
            .relabel_titles(|app| app_label(&texts, app));
        self.texts = texts;
        Ok(())
    }

    /// Theme of the current appearance and accent.
    pub fn theme(&self) -> Theme {
        Theme::new(self.appearance, &self.accent_id)
    }

    /// Closes every module view before changing the active workspace.
    ///
    /// This is also used after account switches so a previous user's screen cannot remain active.
    fn close_module_views(&mut self) {
        self.dashboard_open = false;
        self.contacts_open = false;
        self.products_open = false;
        self.projects_open = false;
        self.fleet_open = false;
        self.restaurant_open = false;
        self.invoices_open = false;
        self.accounting_open = false;
        self.purchases_open = false;
        self.pos_open = false;
        self.appointments_open = false;
        self.settings_open = false;
        self.users_open = false;
        self.editor_open = false;
        self.app_store_open = false;
        self.support_open = false;
        self.reports_open = false;
        self.therapie_open = false;
    }

    /// Opens the screen of a desktop app and leaves the desktop.
    ///
    /// The desktop reports the launched app; this method reloads the module state from the store so
    /// the screen shows live rows instead of the last visit.
    fn open_desktop_app(&mut self, app: AppId, now: i64) -> CoreResult<()> {
        let module = AppModule::from_storage(app.as_str());
        if let Some(module) = module {
            let user = self
                .auth
                .user
                .as_ref()
                .ok_or_else(|| CoreError::Validation("permission_denied".to_string()))?;
            if !self
                .store
                .user_allows(user, module, PermissionLevel::View)?
            {
                return Err(CoreError::Validation("permission_denied".to_string()));
            }
        }
        self.close_module_views();
        self.desktop_open = false;
        match app.as_str() {
            "dashboard" => self.dashboard_open = true,
            "contacts" => {
                self.contacts.refresh(&self.store)?;
                self.contacts_open = true;
            }
            "products" => {
                self.products.refresh(&self.store)?;
                self.products_open = true;
            }
            "projects" => {
                self.projects.reset_for_open(&self.store)?;
                self.projects_open = true;
            }
            "fleet" => {
                self.fleet.reset_for_open(&self.store)?;
                self.fleet_open = true;
            }
            "restaurant" => {
                self.restaurant.reset_for_open(&self.store)?;
                self.restaurant_open = true;
            }
            "invoices" => {
                self.invoices.refresh(&self.store)?;
                self.invoices_open = true;
            }
            "accounting" => {
                self.accounting.invalidate();
                self.accounting.refresh(&self.store, now)?;
                self.accounting_open = true;
            }
            "purchases" => {
                self.purchases.refresh(&self.store)?;
                self.purchases_open = true;
            }
            "pos" => {
                self.pos.refresh(&self.store)?;
                self.pos_open = true;
            }
            "calendar" => {
                self.appointments.refresh(&self.store)?;
                self.appointments.screen = crate::appointments::AppointmentsDetail::Calendar;
                self.appointments.view = crate::appointments::AppointmentsView::Month;
                self.appointments_open = true;
            }
            "users" => {
                self.users.refresh(&self.store)?;
                self.users_open = true;
            }
            "settings" => {
                self.settings.reset_for_open();
                self.settings
                    .set_active_user(self.auth.user.as_ref().map(|user| user.id));
                self.settings.refresh(&self.store)?;
                self.settings_open = true;
            }
            // Calculator and widgets are windowed desktop utilities: the legacy shell opens a
            // floating window and keeps the desktop visible (`DesktopWindowWorkspace.tsx:4830`).
            "calculator" | "widgets" => {
                let title = self
                    .desktop_icons
                    .label_of(app)
                    .unwrap_or_default()
                    .to_owned();
                let area = work_area(Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1280.0, 800.0),
                ));
                let rect =
                    crate::desktop::default_window_rect(area, self.desktop_windows.windows().len());
                self.desktop_windows
                    .open(Window::new(app, title, rect), now);
                self.desktop_open = true;
                return Ok(());
            }
            "documentation" => {
                let title = self
                    .desktop_icons
                    .label_of(app)
                    .unwrap_or("Manual")
                    .to_owned();
                let area = work_area(Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1280.0, 800.0),
                ));
                let rect =
                    crate::desktop::default_window_rect(area, self.desktop_windows.windows().len());
                self.desktop_windows
                    .open(Window::new(app, title, rect), now);
                self.desktop_open = true;
                return Ok(());
            }
            "editor" => {
                self.editor.reset_for_open(&self.store)?;
                self.editor_open = true;
            }
            "app-store" => {
                self.app_store.reset_for_open(&self.store)?;
                self.app_store_open = true;
            }
            "support" => {
                self.support.reset_for_open(&self.store)?;
                self.support_open = true;
            }
            "reports" => {
                self.reports.reset_for_open(&self.store, now)?;
                self.reports_open = true;
            }
            "therapy" => {
                self.therapie.reset_for_open(&self.store)?;
                self.therapie_open = true;
            }
            _ => {
                self.desktop_open = true;
                return Ok(());
            }
        }
        Ok(())
    }

    fn apply_palette_quick_action(&mut self, action: PaletteQuickAction, now: i64) {
        match action {
            PaletteQuickAction::NewInvoice => self.invoices.start_new(now),
            PaletteQuickAction::NewContact => self.contacts.start_new(),
            PaletteQuickAction::NewProduct => self.products.start_new(),
            PaletteQuickAction::NewStockMove => {
                self.products.view = crate::products::ProductsView::Journal;
                self.products.stock_moves.create_open = true;
            }
            PaletteQuickAction::NewPurchase => self.purchases.start_new(now),
        }
    }

    /// Reloads the module selection into the dashboard and desktop navigation.
    fn sync_module_navigation(&mut self) -> CoreResult<()> {
        let mut active = app_store::active_modules(&self.store)?;
        if active.is_empty() {
            active = socdof_core::domain::permission::ALL_MODULES.to_vec();
        }
        if let Some(user) = self.auth.user.as_ref() {
            let mut permitted = Vec::with_capacity(active.len());
            for module in active {
                if self
                    .store
                    .user_allows(user, module, PermissionLevel::View)?
                {
                    permitted.push(module);
                }
            }
            active = permitted;
        } else {
            active.clear();
        }
        self.dashboard.set_active_modules(active.clone());
        self.desktop_icons = desktop_icons(&self.texts, &active);
        self.desktop_pinned = self.desktop_icons.pinned(&PINNED_DESKTOP);
        Ok(())
    }
}

/// Handles the documented application-wide keyboard shortcuts for the native desktop.
///
/// The shortcuts are consumed here rather than by individual app screens, so they behave the
/// same regardless of which module window currently owns keyboard focus.
fn handle_global_shortcuts(ctx: &Context, state: &mut GalleryState, now: i64) {
    let (fullscreen, help, palette, lock, start_menu, task_view, escape) = ctx.input_mut(|input| {
        (
            input.consume_key(Modifiers::NONE, Key::F11),
            input.consume_key(Modifiers::NONE, Key::F1),
            input.consume_key(Modifiers::CTRL, Key::K),
            input.consume_key(Modifiers::CTRL, Key::L),
            input.consume_key(Modifiers::CTRL, Key::Space),
            input.consume_key(Modifiers::CTRL, Key::Tab)
                || input.consume_key(Modifiers::ALT, Key::Tab),
            input.consume_key(Modifiers::NONE, Key::Escape),
        )
    });
    let desktop_ready = !state.auth_open && state.auth.view == crate::auth::AuthView::Unlocked;
    if fullscreen && desktop_ready {
        crate::desktop::toggle_fullscreen(ctx);
    }
    if help && desktop_ready {
        let _ = state.open_desktop_app(AppId::new("documentation"), now);
    }
    if palette && desktop_ready {
        state.shell.open_palette();
    }
    if lock && desktop_ready {
        state.shell.close_overlays();
        state.auth.lock(now);
        state.auth_open = true;
        state.desktop_open = false;
        state.close_module_views();
        state.desktop_windows = WindowManager::new();
    }
    if start_menu && desktop_ready {
        state.shell.toggle_start();
    }
    if task_view && desktop_ready {
        if state.shell.task_view.is_open() {
            state.shell.task_view.close();
        } else {
            state.shell.close_overlays();
            state.shell.task_view.open();
        }
    }
    if escape && desktop_ready {
        if state.shell.dismiss_top_overlay() {
            // The topmost transient overlay owns Escape.
        } else if state.shell.overlay_open() || state.shell.studio.is_open() {
            // First-run onboarding and Studio retain their modal/focus behavior.
        } else if let Some(active) = state.desktop_windows.active() {
            state.desktop_windows.close(active, now);
        }
    }
}

/// Renders the gallery or active desktop screen into the egui context.
pub fn gallery(ctx: &Context, state: &mut GalleryState) {
    state.focus.begin_frame(ctx);
    let theme = state.theme();
    theme.apply(ctx);
    let texts = state.texts.clone();
    let now = now_millis();

    handle_global_shortcuts(ctx, state, now);

    // Authentication remains active while the desktop is visible. The login renderer cannot
    // own the idle timer because it is not called during normal desktop frames.
    if !state.auth_open && state.auth.view == crate::auth::AuthView::Unlocked {
        let interacting = ctx.input(|input| input.pointer.any_down() || !input.events.is_empty());
        if interacting {
            state.auth.note_activity(now);
        }
        if state.auth.tick_with_store(&state.store, now).is_err() {
            state.auth.show_login();
        }
        if state.auth.view != crate::auth::AuthView::Unlocked {
            state.desktop_open = false;
            state.auth_open = true;
            state.close_module_views();
            state.desktop_windows = WindowManager::new();
        }
        if state.auth.view == crate::auth::AuthView::Locked {
            state.desktop_open = false;
            state.auth_open = true;
        }
    }

    if state.auth_open {
        if state.auth.import_pending {
            let _ = state.auth.run_pending_import(&state.store);
        }
        let was_unlocked = state.auth.view == crate::auth::AuthView::Unlocked;
        auth(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            &mut state.auth,
            &state.store,
            now,
        );
        // The wizard collects language, appearance, accent and layout; apply them immediately
        // and persist the account preferences so they survive the next application start.
        if let Some(language) = state.auth.language_choice.take() {
            let _ = state.set_language(language);
        }
        if let Some(appearance) = state.auth.appearance_choice.take() {
            state.appearance = appearance;
        }
        let wizard_theme = state.auth.theme_mode_choice;
        if let Some(mode) = wizard_theme {
            state.appearance = match mode {
                ThemeMode::Light => Appearance::Light,
                ThemeMode::Dark => Appearance::Dark,
                // System keeps whatever the host resolved for the running desktop.
                ThemeMode::System => state.appearance,
            };
        }
        if let Some(accent) = state.auth.accent_choice.take() {
            state.accent_id = accent;
        }
        let mut wallpaper_changed = false;
        if let Some(wallpaper) = state.auth.wallpaper_choice.take() {
            state.shell.wallpaper.wallpaper = wallpaper;
            state.shell.wallpaper.custom = None;
            wallpaper_changed = true;
        }
        if let Some(mut custom) = state.auth.wallpaper_custom.take() {
            custom.revision = now as u64;
            state.shell.wallpaper.custom = Some(custom);
            wallpaper_changed = true;
        }
        let wizard_completed = state.auth.take_wizard_completed();
        if wizard_completed {
            let selected = resolve_setup_apps(&state.auth);
            if !selected.is_empty() {
                if let Err(error) = app_store::apply_selection(&state.store, &selected) {
                    eprintln!("SOCDOF could not persist setup module selection: {error}");
                }
            }
            apply_setup_template(state);
        }
        let mut startup_module = None;
        if !was_unlocked && state.auth.view == crate::auth::AuthView::Unlocked {
            if let Some(user_id) = state.auth.user.as_ref().map(|user| user.id) {
                let preferences = if wizard_completed {
                    Preferences {
                        language: state.language,
                        theme_mode: wizard_theme.unwrap_or(if state.appearance.is_dark() {
                            ThemeMode::Dark
                        } else {
                            ThemeMode::Light
                        }),
                        accent_color: state.accent_id.clone(),
                        ..Preferences::default()
                    }
                } else {
                    settings_service::preferences(&state.store, user_id).unwrap_or_default()
                };
                if wizard_completed {
                    if let Err(error) =
                        settings_service::save_preferences(&state.store, user_id, &preferences)
                    {
                        eprintln!("SOCDOF could not save first-run preferences: {error}");
                    }
                    if let Err(error) = settings_service::save_wallpaper(
                        &state.store,
                        Some(user_id),
                        &state.shell.wallpaper.to_preference(),
                    ) {
                        eprintln!("SOCDOF could not save first-run wallpaper: {error}");
                    }
                } else {
                    let _ = state.set_language(preferences.language);
                    state.appearance = match preferences.theme_mode {
                        ThemeMode::Dark => Appearance::Dark,
                        ThemeMode::Light => Appearance::Light,
                        ThemeMode::System => state.appearance,
                    };
                    state.accent_id = preferences.accent_color;
                    startup_module = startup_app(&preferences.startup_module);
                    if !wallpaper_changed {
                        if let Ok(pref) = settings_service::user_wallpaper(&state.store, user_id) {
                            state
                                .shell
                                .wallpaper
                                .apply_preference(&pref, now.max(1) as u64);
                        }
                    }
                }
            }
        } else if wallpaper_changed {
            let user_id = state.auth.user.as_ref().map(|user| user.id);
            let _ = settings_service::save_wallpaper(
                &state.store,
                user_id,
                &state.shell.wallpaper.to_preference(),
            );
        }
        if state.auth.view == crate::auth::AuthView::Unlocked && state.auth.user.is_some() {
            state.auth_open = false;
            state.close_module_views();
            state.desktop_windows = WindowManager::new();
            state.desktop_open = true;
            if state.sync_module_navigation().is_err() {
                // A permission lookup failure must never expose the previous account's launcher.
                state.desktop_icons = IconGrid::new(Vec::new());
                state.dashboard.set_active_modules(Vec::new());
            } else if let Some(user_id) = state.auth.user.as_ref().map(|user| user.id) {
                if let Ok(layout) = settings_service::desktop_layout(&state.store, user_id) {
                    let positions = state
                        .desktop_icons
                        .icons()
                        .iter()
                        .filter_map(|icon| {
                            layout
                                .icon_positions
                                .get(icon.app().as_str())
                                .map(|cell| (icon.app(), *cell))
                        })
                        .collect::<Vec<_>>();
                    state.desktop_icons.restore_positions(&positions);
                    let folders = layout
                        .folders
                        .iter()
                        .map(|folder| {
                            crate::desktop::DesktopFolder::from_persisted(
                                &folder.id,
                                &folder.name,
                                &folder.modules,
                                folder.cell,
                            )
                        })
                        .collect::<Vec<_>>();
                    state.shell.folders.restore(folders);
                    let assets = layout.assets.iter().map(|asset| {
                        crate::desktop::StorageAsset::from_persisted(
                            &asset.id,
                            &asset.name,
                            asset.size,
                            &asset.category,
                            &asset.location,
                            asset.folder_id.clone(),
                            asset.created_at,
                        )
                    });
                    state
                        .shell
                        .storage
                        .restore(assets, &layout.storage_location);
                    state.shell.task_view.restore(
                        layout
                            .virtual_desktops
                            .iter()
                            .map(|desktop| (desktop.id.clone(), desktop.name.clone())),
                        &layout.active_desktop_id,
                    );
                    restore_native_windows(state, &layout, ctx.screen_rect(), now);
                    state
                        .desktop_windows
                        .set_current_desktop(state.shell.task_view.active_id());
                }
            }
            if let Some(app) =
                startup_module.filter(|app| state.desktop_icons.index_of(*app).is_some())
            {
                // A stale or disabled start-up module falls back to the desktop instead of
                // leaving the user on a blank screen.
                if state.open_desktop_app(app, now).is_err() {
                    state.desktop_open = true;
                }
            }
        }
        // The sign-in clock follows the company profile, which the settings app may have changed.
        if let Ok(profile) = state.store.company_profile() {
            state.auth.clock = crate::desktop::ClockSettings::from_profile(&profile);
        }
        if state.auth.back && state.auth.allow_exit {
            state.auth_open = false;
            state.auth.back = false;
        }
        state.focus.finish_frame();
        return;
    }

    if state.desktop_open {
        // Clock preferences may have changed in the settings app since the last frame.
        if let Ok(profile) = state.store.company_profile() {
            state.shell.clock = crate::desktop::ClockSettings::from_profile(&profile);
        }
        // The desktop frame borrows the whole shell, so the widgets panel edits a copy of the
        // widget layer and hands it back after the frame.
        let mut widget_layer = state.shell.widgets.clone();
        let outcome = desktop_with_content(
            ctx,
            DesktopFrame {
                theme: &theme,
                texts: &texts,
                shell: &mut state.shell,
                store: &state.store,
                current_user: state.auth.user.as_ref().map(|user| user.id),
            },
            &mut state.focus,
            &mut state.desktop_pinned,
            &mut state.desktop_windows,
            now,
            |app, active, ui, ctx, theme, texts, focus, store, now| match app.as_str() {
                "calculator" => {
                    crate::calculator::calculator_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.calculator,
                    );
                    false
                }
                "widgets" => {
                    crate::widgets::widgets_app(ui, theme, texts, focus, &mut widget_layer, now);
                    false
                }
                "contacts" => {
                    crate::contacts::contacts_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.contacts,
                        store,
                        now,
                    );
                    let back = state.contacts.back;
                    state.contacts.back = false;
                    back
                }
                "invoices" => {
                    crate::invoices::invoices_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.invoices,
                        store,
                        now,
                    );
                    let back = state.invoices.back;
                    state.invoices.back = false;
                    back
                }
                "accounting" => {
                    crate::accounting::accounting_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.accounting,
                        store,
                        now,
                    );
                    let back = state.accounting.back;
                    state.accounting.back = false;
                    back
                }
                "projects" => {
                    crate::projects::projects_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.projects,
                        store,
                        now,
                    );
                    let back = state.projects.back;
                    state.projects.back = false;
                    back
                }
                "fleet" => {
                    crate::fleet::fleet_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.fleet,
                        store,
                        now,
                    );
                    let back = state.fleet.back;
                    state.fleet.back = false;
                    back
                }
                "restaurant" => {
                    crate::restaurant::restaurant_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.restaurant,
                        store,
                        now,
                    );
                    let back = state.restaurant.back;
                    state.restaurant.back = false;
                    back
                }
                "products" => {
                    crate::products::products_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.products,
                        store,
                        now,
                    );
                    let back = state.products.back;
                    state.products.back = false;
                    back
                }
                "purchases" => {
                    crate::purchases::purchases_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.purchases,
                        store,
                        now,
                    );
                    let back = state.purchases.back;
                    state.purchases.back = false;
                    back
                }
                "calendar" => {
                    crate::appointments::appointments_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.appointments,
                        store,
                        now,
                    );
                    let back = state.appointments.back;
                    state.appointments.back = false;
                    back
                }
                "documentation" => {
                    crate::documentation::documentation_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.documentation,
                    );
                    false
                }
                "editor" => {
                    crate::textwerk::textwerk_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.textwerk,
                    );
                    false
                }
                "app-store" => {
                    crate::app_store::app_store_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.app_store,
                        store,
                    );
                    let back = state.app_store.back;
                    state.app_store.back = false;
                    back
                }
                "support" => {
                    crate::support::support_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.support,
                        store,
                        now,
                    );
                    let back = state.support.back;
                    state.support.back = false;
                    back
                }
                "reports" => {
                    crate::reports::reports_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.reports,
                        store,
                        now,
                    );
                    let back = state.reports.back;
                    state.reports.back = false;
                    back
                }
                "dashboard" => {
                    crate::dashboard::dashboard_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.dashboard,
                        now,
                    );
                    false
                }
                "pos" => {
                    crate::pos::pos_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.pos,
                        store,
                        now,
                    );
                    let back = state.pos.back;
                    state.pos.back = false;
                    back
                }
                "therapy" => {
                    crate::therapie::therapie_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.therapie,
                        store,
                        now,
                    );
                    let back = state.therapie.back;
                    state.therapie.back = false;
                    back
                }
                "users" => {
                    crate::users::users_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.users,
                        store,
                        now,
                    );
                    let back = state.users.back;
                    state.users.back = false;
                    back
                }
                "settings" => {
                    crate::settings::settings_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.settings,
                        store,
                        now,
                    );
                    let back = state.settings.back;
                    state.settings.back = false;
                    back
                }
                _ => {
                    ui.label(texts.get("desktop_hint"));
                    false
                }
            },
        );
        state.shell.widgets = widget_layer;
        // The desktop only asks for an import; the host runs the platform picker so the UI layer
        // stays free of blocking dialogs and the WASM build keeps compiling.
        let mut storage_changed = outcome.storage_changed;
        if let Some(target) = outcome.upload_assets.clone() {
            if crate::desktop::import_from_location(&mut state.shell.storage, &target, now) > 0 {
                storage_changed = true;
            }
        }
        if outcome.icon_positions_changed
            || outcome.window_layout_changed
            || outcome.folders_changed
            || outcome.task_view_changed
            || storage_changed
        {
            if let Some(user_id) = state.auth.user.as_ref().map(|user| user.id) {
                match settings_service::desktop_layout(&state.store, user_id) {
                    Ok(mut layout) => {
                        if outcome.icon_positions_changed {
                            layout.icon_positions = state
                                .desktop_icons
                                .positions()
                                .into_iter()
                                .map(|(app, cell)| (app.as_str().to_string(), cell))
                                .collect();
                        }
                        if outcome.window_layout_changed {
                            capture_native_windows(&mut layout, &state.desktop_windows);
                        }
                        if outcome.task_view_changed {
                            layout.virtual_desktops = state
                                .shell
                                .task_view
                                .desktops()
                                .iter()
                                .map(|desktop| settings_service::VirtualDesktopLayout {
                                    id: desktop.id().to_owned(),
                                    name: desktop.name().to_owned(),
                                })
                                .collect();
                            layout.active_desktop_id = state.shell.task_view.active_id().to_owned();
                            // Switching or removing a desktop moves windows too, so the filing of
                            // every window is captured with the strip.
                            capture_native_windows(&mut layout, &state.desktop_windows);
                        }
                        if outcome.folders_changed {
                            layout.folders = state
                                .shell
                                .folders
                                .folders()
                                .iter()
                                .map(|folder| settings_service::DesktopFolderLayout {
                                    id: folder.id().to_owned(),
                                    name: folder.name().to_owned(),
                                    modules: folder
                                        .apps()
                                        .iter()
                                        .map(|app| app.as_str().to_owned())
                                        .collect(),
                                    cell: folder.cell(),
                                })
                                .collect();
                        }
                        if storage_changed {
                            layout.storage_location = state.shell.storage.location().to_owned();
                            layout.assets = state
                                .shell
                                .storage
                                .assets()
                                .iter()
                                .map(|asset| settings_service::StorageAssetLayout {
                                    id: asset.id().to_owned(),
                                    name: asset.name().to_owned(),
                                    size: asset.size(),
                                    category: asset.category().slug().to_owned(),
                                    location: asset.location().to_owned(),
                                    folder_id: asset.folder_id().map(str::to_owned),
                                    created_at: asset.created_at(),
                                })
                                .collect();
                        }
                        if let Err(error) =
                            settings_service::save_desktop_layout(&state.store, user_id, &layout)
                        {
                            eprintln!("SOCDOF could not save desktop layout: {error}");
                        }
                    }
                    Err(error) => {
                        // Do not replace a user's saved layout with defaults after a read failure.
                        eprintln!(
                            "SOCDOF could not load desktop layout; skipping save to protect existing data: {error}"
                        );
                    }
                }
            }
        }
        if outcome.back {
            state.desktop_open = false;
        }
        if outcome.lock {
            state.auth.lock(now);
            state.desktop_open = false;
            state.auth_open = true;
        }
        if outcome.sign_out {
            let _ = state.auth.sign_out(&state.store, now);
            state.close_module_views();
            state.desktop_windows = WindowManager::new();
            state.desktop_open = false;
            state.auth_open = true;
        }
        if let Some(username) = outcome.switch_account.clone() {
            state.auth.begin_switch(&username);
            state.close_module_views();
            state.desktop_windows = WindowManager::new();
            state.desktop_open = false;
            state.auth_open = true;
        }
        if outcome.toggle_theme {
            state.appearance = if state.appearance.is_dark() {
                Appearance::Light
            } else {
                Appearance::Dark
            };
            if let Some(user_id) = state.auth.user.as_ref().map(|user| user.id) {
                match settings_service::preferences(&state.store, user_id) {
                    Ok(mut preferences) => {
                        preferences.theme_mode = if state.appearance.is_dark() {
                            ThemeMode::Dark
                        } else {
                            ThemeMode::Light
                        };
                        if let Err(error) =
                            settings_service::save_preferences(&state.store, user_id, &preferences)
                        {
                            eprintln!("SOCDOF could not persist desktop theme: {error}");
                        }
                    }
                    Err(error) => {
                        eprintln!("SOCDOF could not load desktop theme preferences: {error}")
                    }
                }
            }
        }
        if let Some(app) = outcome.open_app {
            if state.open_desktop_app(app, now).is_err() {
                state.desktop_open = true;
            } else if let Some(action) = outcome.quick_action {
                state.apply_palette_quick_action(action, now);
            }
        }
        state.focus.finish_frame();
        return;
    }

    if state.dashboard_open {
        let closed = app_view(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            "dashboard",
            |focus| {
                dashboard(ctx, &theme, &texts, focus, &mut state.dashboard, now);
            },
        );
        if let Some(action) = state.dashboard.take_action() {
            match action {
                DashboardAction::NewContact => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.contacts_open = true;
                    state.contacts.start_new();
                }
                DashboardAction::NewProduct => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.products_open = true;
                    state.products.start_new();
                }
                DashboardAction::NewInvoice => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.invoices_open = true;
                    state.invoices.start_new(now_millis());
                }
                DashboardAction::OpenAccounting => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.accounting.invalidate();
                    state.accounting_open = true;
                }
                DashboardAction::OpenPurchases => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.purchases_open = true;
                }
                DashboardAction::OpenPos => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.pos_open = true;
                }
                DashboardAction::OpenCalendar => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.appointments.screen = crate::appointments::AppointmentsDetail::Calendar;
                    state.appointments.view = crate::appointments::AppointmentsView::Month;
                    state.appointments.back = false;
                    state.appointments_open = true;
                }
                DashboardAction::OpenSettings => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.settings.reset_for_open();
                    state.settings_open = true;
                }
                DashboardAction::ManageUsers => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.users_open = true;
                }
                DashboardAction::OpenEditor => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    if state.editor.reset_for_open(&state.store).is_err() {
                        state.editor.error = Some("editor_error_load");
                    }
                    state.editor_open = true;
                }
                DashboardAction::OpenAppStore => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    if state.app_store.reset_for_open(&state.store).is_err() {
                        state.app_store.error = Some("app_store_error_load");
                    }
                    state.app_store_open = true;
                }
                DashboardAction::LockSession => {
                    state.dashboard_open = false;
                    state.dashboard.back = false;
                    state.auth.allow_exit = false;
                    state.auth.lock(now);
                    state.auth_open = true;
                }
            }
        }
        if closed.close || closed.minimize || state.dashboard.back {
            state.dashboard_open = false;
            state.dashboard.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("dashboard"));
            } else {
                state.desktop_windows.close(AppId::new("dashboard"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.contacts_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "contacts", |focus| {
            contacts(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.contacts,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.contacts.back {
            state.contacts_open = false;
            state.contacts.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("contacts"));
            } else {
                state.desktop_windows.close(AppId::new("contacts"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.products_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "products", |focus| {
            products(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.products,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.products.back {
            state.products_open = false;
            state.products.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("products"));
            } else {
                state.desktop_windows.close(AppId::new("products"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.projects_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "projects", |focus| {
            projects(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.projects,
                &state.store,
                now,
            );
        });
        if let Some(invoice_id) = state.projects.created_invoice.take() {
            state.projects_open = false;
            state.desktop_windows.close(AppId::new("projects"), now);
            state.invoices.invalidate();
            match state.invoices.refresh(&state.store) {
                Ok(()) => {
                    state.invoices.select(invoice_id);
                    state.invoices_open = true;
                }
                Err(error) => state.projects.error = Some(error.to_string()),
            }
        }
        if closed.close || closed.minimize || state.projects.back {
            state.projects_open = false;
            state.projects.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("projects"));
            } else {
                state.desktop_windows.close(AppId::new("projects"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.fleet_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "fleet", |focus| {
            fleet(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.fleet,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.fleet.back {
            state.fleet_open = false;
            state.fleet.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("fleet"));
            } else {
                state.desktop_windows.close(AppId::new("fleet"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.restaurant_open {
        let closed = app_view(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            "restaurant",
            |focus| {
                crate::restaurant::restaurant(
                    ctx,
                    &theme,
                    &texts,
                    focus,
                    &mut state.restaurant,
                    &state.store,
                    now,
                );
            },
        );
        if closed.close || closed.minimize || state.restaurant.back {
            state.restaurant_open = false;
            state.restaurant.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("restaurant"));
            } else {
                state.desktop_windows.close(AppId::new("restaurant"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.invoices_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "invoices", |focus| {
            invoices(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.invoices,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.invoices.back {
            state.invoices_open = false;
            state.invoices.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("invoices"));
            } else {
                state.desktop_windows.close(AppId::new("invoices"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.accounting_open {
        let closed = app_view(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            "accounting",
            |focus| {
                accounting(
                    ctx,
                    &theme,
                    &texts,
                    focus,
                    &mut state.accounting,
                    &state.store,
                    now,
                );
            },
        );
        if closed.close || closed.minimize || state.accounting.back {
            state.accounting_open = false;
            state.accounting.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("accounting"));
            } else {
                state.desktop_windows.close(AppId::new("accounting"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.purchases_open {
        let closed = app_view(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            "purchases",
            |focus| {
                purchases(
                    ctx,
                    &theme,
                    &texts,
                    focus,
                    &mut state.purchases,
                    &state.store,
                    now,
                );
            },
        );
        if closed.close || closed.minimize || state.purchases.back {
            state.purchases_open = false;
            state.purchases.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("purchases"));
            } else {
                state.desktop_windows.close(AppId::new("purchases"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.pos_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "pos", |focus| {
            pos(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.pos,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.pos.back {
            state.pos_open = false;
            state.pos.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("pos"));
            } else {
                state.desktop_windows.close(AppId::new("pos"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.appointments_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "calendar", |focus| {
            appointments(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.appointments,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.appointments.back {
            state.appointments_open = false;
            state.appointments.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("calendar"));
            } else {
                state.desktop_windows.close(AppId::new("calendar"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.users_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "users", |focus| {
            users(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.users,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.users.back {
            state.users_open = false;
            state.users.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("users"));
            } else {
                state.desktop_windows.close(AppId::new("users"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.editor_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "editor", |focus| {
            editor_screen(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.editor,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.editor.back {
            state.editor_open = false;
            state.editor.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("editor"));
            } else {
                state.desktop_windows.close(AppId::new("editor"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.app_store_open {
        let closed = app_view(
            ctx,
            &theme,
            &texts,
            &mut state.focus,
            "app-store",
            |focus| {
                app_store_screen(
                    ctx,
                    &theme,
                    &texts,
                    focus,
                    &mut state.app_store,
                    &state.store,
                );
            },
        );
        if state.app_store.changed {
            state.app_store.changed = false;
            if state.sync_module_navigation().is_err() {
                state.app_store.error = Some("app_store_error_storage");
            }
        }
        if closed.close || closed.minimize || state.app_store.back {
            state.app_store_open = false;
            state.app_store.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("app-store"));
            } else {
                state.desktop_windows.close(AppId::new("app-store"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.support_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "support", |focus| {
            support_screen(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.support,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.support.back {
            state.support_open = false;
            state.support.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("support"));
            } else {
                state.desktop_windows.close(AppId::new("support"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.reports_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "reports", |focus| {
            reports_screen(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.reports,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.reports.back {
            state.reports_open = false;
            state.reports.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("reports"));
            } else {
                state.desktop_windows.close(AppId::new("reports"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.therapie_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "therapy", |focus| {
            therapie_screen(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.therapie,
                &state.store,
                now,
            );
        });
        if closed.close || closed.minimize || state.therapie.back {
            state.therapie_open = false;
            state.therapie.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("therapy"));
            } else {
                state.desktop_windows.close(AppId::new("therapy"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    if state.settings_open {
        let closed = app_view(ctx, &theme, &texts, &mut state.focus, "settings", |focus| {
            settings(
                ctx,
                &theme,
                &texts,
                focus,
                &mut state.settings,
                &state.store,
                now,
            );
        });
        if let Some(preferences) = state.settings.take_saved_preferences() {
            let _ = state.set_language(preferences.language);
            state.appearance = match preferences.theme_mode {
                ThemeMode::Dark => Appearance::Dark,
                ThemeMode::Light => Appearance::Light,
                ThemeMode::System => state.appearance,
            };
            state.accent_id = preferences.accent_color;
        }
        if state.settings.take_language_pack_changed() {
            if let Err(error) = state.set_language(state.language) {
                eprintln!("SOCDOF could not reload the UI language pack: {error}");
            }
        }
        if closed.close || closed.minimize || state.settings.back {
            state.settings_open = false;
            state.settings.back = false;
            if closed.minimize {
                state.desktop_windows.minimize(AppId::new("settings"));
            } else {
                state.desktop_windows.close(AppId::new("settings"), now);
            }
            state.desktop_open = true;
        }
        state.focus.finish_frame();
        return;
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                ui.label(
                    RichText::new(texts.get("gallery_title"))
                        .size(FONT_TITLE)
                        .strong(),
                );
                ui.label(
                    RichText::new(texts.get("gallery_subtitle"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.add_space(8.0);

                ui.horizontal_wrapped(|ui| {
                    ui.label(
                        RichText::new(texts.get("language_label"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    for language in [Language::De, Language::En, Language::Fr, Language::Es] {
                        let variant = if state.language == language {
                            ButtonVariant::Primary
                        } else {
                            ButtonVariant::Ghost
                        };
                        let label = language.as_str().to_uppercase();
                        if button(ui, &theme, &mut state.focus, &label, variant).activated
                            && state.language != language
                            && state.set_language(language).is_ok()
                        {
                            ctx.request_repaint();
                        }
                    }
                    ui.separator();
                    let dark = state.appearance.is_dark();
                    let (icon, tooltip) = if dark {
                        (Icon::Sun, texts.get("theme_light"))
                    } else {
                        (Icon::Moon, texts.get("theme_dark"))
                    };
                    if icon_button(ui, &theme, &mut state.focus, icon, tooltip).activated {
                        state.appearance = if dark {
                            Appearance::Light
                        } else {
                            Appearance::Dark
                        };
                        ctx.request_repaint();
                    }
                });
                ui.add_space(16.0);

                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("accent_title")).strong());
                    ui.add_space(6.0);
                    ui.horizontal_wrapped(|ui| {
                        ui.spacing_mut().item_spacing.x = 6.0;
                        for id in preset_ids() {
                            let preset = AccentPreset::resolve(id);
                            let variant = if state.accent_id == id {
                                ButtonVariant::Primary
                            } else {
                                ButtonVariant::Secondary
                            };
                            let mut hit = button(ui, &theme, &mut state.focus, id, variant);
                            hit.response = hit.response.on_hover_text(&preset.label);
                            if hit.activated {
                                state.accent_id = id.to_string();
                                ctx.request_repaint();
                            }
                        }
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("desktop_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("desktop_hint"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("desktop_open"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.desktop_open = true;
                    }
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("onboarding_restart"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        state.shell.onboarding.restart();
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("dashboard_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("dashboard_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("dashboard_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.dashboard_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("contacts_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("contacts_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("contacts_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.contacts_open = true;
                        state.contacts.view = crate::contacts::ContactsView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("products_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("products_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("products_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.products_open = true;
                        state.products.view = crate::products::ProductsView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("invoices_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("invoices_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("invoices_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.invoices_open = true;
                        state.invoices.view = crate::invoices::InvoicesView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("accounting_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("accounting_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("accounting_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.accounting.invalidate();
                        state.accounting_open = true;
                        state.accounting.view = crate::accounting::AccountingView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("purchases_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("purchases_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("purchases_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.purchases_open = true;
                        state.purchases.view = crate::purchases::PurchasesView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("pos_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("pos_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("pos_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.pos_open = true;
                        state.pos.view = crate::pos::PosView::List;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("appointments_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("appointments_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("appointments_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.appointments_open = true;
                        state.appointments.screen =
                            crate::appointments::AppointmentsDetail::Calendar;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("settings_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("settings_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("settings_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.settings.reset_for_open();
                        state.settings_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("users_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("users_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("users_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.users_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("editor_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("editor_open_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("editor_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        if state.editor.reset_for_open(&state.store).is_err() {
                            state.editor.error = Some("editor_error_load");
                        }
                        state.editor_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("app_store_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("app_store_open_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("app_store_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        if state.app_store.reset_for_open(&state.store).is_err() {
                            state.app_store.error = Some("app_store_error_load");
                        }
                        state.app_store_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("support_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("support_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("support_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        if state.support.reset_for_open(&state.store).is_err() {
                            state.support.error = Some("support_error_load");
                        }
                        state.support_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("reports_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("reports_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("reports_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        if state
                            .reports
                            .reset_for_open(&state.store, now_millis())
                            .is_err()
                        {
                            state.reports.error = Some("reports_error_load");
                        }
                        state.reports_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("therapie_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("therapie_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("therapie_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        if state.therapie.reset_for_open(&state.store).is_err() {
                            state.therapie.error = Some("therapie_error_load");
                        }
                        state.therapie_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("auth_open_title")).strong());
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("auth_open_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("auth_open_button"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        state.auth.allow_exit = true;
                        state.auth.show_login();
                        state.auth_open = true;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_buttons")).strong());
                    ui.add_space(6.0);
                    ui.horizontal_wrapped(|ui| {
                        if button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("button_primary"),
                            ButtonVariant::Primary,
                        )
                        .activated
                        {
                            state.toasts.push_titled(
                                Tone::Success,
                                texts.get("toast_title_success"),
                                texts.get("toast_saved"),
                                now,
                            );
                        }
                        button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("button_secondary"),
                            ButtonVariant::Secondary,
                        );
                        button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("button_ghost"),
                            ButtonVariant::Ghost,
                        );
                        button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("button_danger"),
                            ButtonVariant::Danger,
                        );
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_icons")).strong());
                    ui.add_space(6.0);
                    ui.horizontal_wrapped(|ui| {
                        ui.spacing_mut().item_spacing.x = 4.0;
                        for (icon, key) in GALLERY_ICONS {
                            icon_button(ui, &theme, &mut state.focus, icon, texts.get(key));
                        }
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_badges")).strong());
                    ui.add_space(6.0);
                    ui.horizontal_wrapped(|ui| {
                        for (key, tone) in [
                            ("badge_neutral", Tone::Neutral),
                            ("badge_success", Tone::Success),
                            ("badge_warning", Tone::Warning),
                            ("badge_danger", Tone::Danger),
                            ("badge_accent", Tone::Accent),
                        ] {
                            badge(ui, &theme, texts.get(key), tone);
                        }
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_inputs")).strong());
                    ui.add_space(6.0);
                    let labels = [
                        texts.get("tabs_overview"),
                        texts.get("tabs_details"),
                        texts.get("tabs_history"),
                    ];
                    let mut tab = state.tab;
                    if tabs(ui, &theme, &mut state.focus, &labels, &mut tab) {
                        state.tab = tab;
                    }
                    ui.add_space(8.0);
                    search_field(
                        ui,
                        &theme,
                        &mut state.focus,
                        &mut state.search,
                        texts.get("search_placeholder"),
                    );
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_controls")).strong());
                    ui.add_space(6.0);
                    let terms = [
                        texts.get("select_net_7"),
                        texts.get("select_net_14"),
                        texts.get("select_net_30"),
                    ];
                    if state.draft {
                        // Drawn above the two fixed dropdowns on purpose: a conditional control
                        // must not shift the identity of the controls painted after it.
                        select(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.select_popup_extra,
                            "socdof-gallery-term",
                            &mut state.select_extra,
                            &terms,
                        );
                        ui.add_space(8.0);
                        // Two dropdowns with one source and a copied popup state. The owner is
                        // painted first and its state is copied straight afterwards, so the copy
                        // starts with the owner's slot; both are painted in the same frame from the
                        // first draft frame on and still have to open, choose and keep their value
                        // apart.
                        select(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.mirror_popup,
                            "socdof-gallery-mirror",
                            &mut state.mirror_a,
                            &terms,
                        );
                        if !state.mirror_copied {
                            state.mirror_copy = state.mirror_popup;
                            state.mirror_copied = true;
                        }
                        ui.add_space(8.0);
                        select(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.mirror_copy,
                            "socdof-gallery-mirror",
                            &mut state.mirror_b,
                            &terms,
                        );
                        ui.add_space(8.0);
                    }
                    ui.label(
                        RichText::new(texts.get("select_label"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    select(
                        ui,
                        &theme,
                        &mut state.focus,
                        &mut state.select_popup,
                        "socdof-gallery-term",
                        &mut state.select,
                        &terms,
                    );
                    ui.add_space(8.0);
                    // A second dropdown with the very same source: the catalogue shows that the
                    // identity is per instance, so both open and keep their own value even though
                    // the source alone names one control.
                    select(
                        ui,
                        &theme,
                        &mut state.focus,
                        &mut state.select_popup_second,
                        "socdof-gallery-term",
                        &mut state.select_second,
                        &terms,
                    );
                    ui.add_space(8.0);
                    ui.horizontal_wrapped(|ui| {
                        checkbox(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.draft,
                            texts.get("checkbox_draft"),
                        );
                        switch(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.backup,
                            texts.get("switch_backup"),
                        );
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_table")).strong());
                    ui.add_space(6.0);
                    let rows = [
                        (
                            texts.get("table_row_customer").to_string(),
                            texts.get("badge_success"),
                            Tone::Success,
                            124_000_i64,
                        ),
                        (
                            texts.get("table_row_draft").to_string(),
                            texts.get("badge_neutral"),
                            Tone::Neutral,
                            89_900,
                        ),
                        (
                            texts.get("table_row_paid").to_string(),
                            texts.get("badge_warning"),
                            Tone::Warning,
                            45_600,
                        ),
                    ];
                    let sort = state.sort;
                    let mut rows = rows.to_vec();
                    if let Some(column) = sort.column {
                        rows.sort_by(|a, b| {
                            let ordering = match column {
                                0 => a.0.cmp(&b.0),
                                1 => a.1.cmp(b.1),
                                _ => a.3.cmp(&b.3),
                            };
                            if sort.ascending {
                                ordering
                            } else {
                                ordering.reverse()
                            }
                        });
                    }

                    let mut next_sort = sort;
                    egui::Grid::new("socdof-gallery-table")
                        .num_columns(3)
                        .spacing(egui::vec2(16.0, 8.0))
                        .show(ui, |ui| {
                            sort_header(
                                ui,
                                &theme,
                                &mut state.focus,
                                texts.get("table_name"),
                                0,
                                &mut next_sort,
                            );
                            sort_header(
                                ui,
                                &theme,
                                &mut state.focus,
                                texts.get("table_status"),
                                1,
                                &mut next_sort,
                            );
                            sort_header(
                                ui,
                                &theme,
                                &mut state.focus,
                                texts.get("table_total"),
                                2,
                                &mut next_sort,
                            );
                            ui.end_row();
                            for (name, status, tone, cents) in &rows {
                                ui.label(name);
                                badge(ui, &theme, status, *tone);
                                ui.label(Money::from_cents(*cents).format_localized("€"));
                                ui.end_row();
                            }
                        });
                    state.sort = next_sort;
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_dates")).strong());
                    ui.add_space(6.0);
                    let weekdays: [&str; 7] =
                        std::array::from_fn(|index| texts.get(WEEKDAY_KEYS[index]));
                    let months: [&str; 12] =
                        std::array::from_fn(|index| texts.get(MONTH_KEYS[index]));
                    let labels = CalendarLabels {
                        weekdays,
                        months,
                        previous: texts.get("calendar_previous"),
                        next: texts.get("calendar_next"),
                    };
                    calendar(ui, &theme, &mut state.focus, &mut state.calendar, &labels);
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(format!(
                            "{} {}",
                            texts.get("date_due"),
                            state.calendar.formatted()
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(texts.get("section_form")).strong());
                        if state.form.is_dirty() {
                            badge(ui, &theme, texts.get("checkbox_draft"), Tone::Warning);
                        }
                    });
                    ui.add_space(6.0);
                    for index in 0..state.form.fields.len() {
                        let field = &mut state.form.fields[index];
                        let label = field.label.clone();
                        let hint = field.hint.clone();
                        let error = field.error.clone();
                        text_field(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut field.value,
                            &label,
                            &hint,
                            error.as_deref(),
                        );
                        ui.add_space(6.0);
                    }
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("form_save"),
                            ButtonVariant::Primary,
                        )
                        .activated
                        {
                            let valid = state.form.validate(
                                texts.get("error_required"),
                                texts.get("error_too_long"),
                                texts.get("error_invalid_email"),
                            );
                            if valid {
                                state.form.mark_saved();
                                // Saving accepts the chosen menu action too: the store keeps it,
                                // so a second save without a new choice writes the same value.
                                if let Some(index) = state.menu_choice {
                                    let key =
                                        MENU_ACTIONS.get(index).copied().unwrap_or(MENU_ACTIONS[0]);
                                    let stored = state.store.put_setting(
                                        MENU_ACTION_SETTING,
                                        &serde_json::Value::String(key.to_owned()),
                                    );
                                    if stored.is_ok() {
                                        state.menu_saved = Some(index);
                                    }
                                }
                                state.toasts.push_titled(
                                    Tone::Success,
                                    texts.get("toast_title_success"),
                                    texts.get("toast_saved"),
                                    now,
                                );
                            } else {
                                state.toasts.push_titled(
                                    Tone::Danger,
                                    texts.get("toast_title_error"),
                                    texts.get("toast_invalid"),
                                    now,
                                );
                            }
                        }
                        if button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("form_discard"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            state.form.discard();
                        }
                        if button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("button_secondary"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            let dirty = state.form.is_dirty();
                            if state.guard.request_close(dirty) == CloseDecision::Confirm {
                                ctx.request_repaint();
                            }
                        }
                    });
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_feedback")).strong());
                    ui.add_space(6.0);
                    empty_state(
                        ui,
                        &theme,
                        texts.get("empty_title"),
                        texts.get("empty_hint"),
                    );
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_overlay")).strong());
                    ui.add_space(6.0);
                    if state.draft {
                        // A third menu with the same caption, painted above the fixed pair: its
                        // appearance must not move the identity of the two menus below it.
                        if let Some(index) = menu(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.menu_popup_extra,
                            texts.get("menu_actions"),
                            &[
                                texts.get("menu_open"),
                                texts.get("menu_duplicate"),
                                texts.get("menu_archive"),
                                texts.get("menu_delete"),
                            ],
                        ) {
                            state.menu_choice_extra = Some(index);
                            let key = MENU_ACTIONS.get(index).copied().unwrap_or(MENU_ACTIONS[0]);
                            state.toasts.push(Tone::Neutral, texts.get(key), now);
                        }
                        ui.add_space(6.0);
                    }
                    // Two menus plus the drawer button no longer fit one phone row, so the row
                    // wraps instead of pushing the drawer button past the panel edge.
                    ui.horizontal_wrapped(|ui| {
                        if let Some(index) = menu(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.menu_popup,
                            texts.get("menu_actions"),
                            &[
                                texts.get("menu_open"),
                                texts.get("menu_duplicate"),
                                texts.get("menu_archive"),
                                texts.get("menu_delete"),
                            ],
                        ) {
                            // The chosen row is the menu's value; the form's save button accepts
                            // it into the store, the toast only reports it.
                            state.menu_choice = Some(index);
                            let key = MENU_ACTIONS.get(index).copied().unwrap_or(MENU_ACTIONS[0]);
                            state.toasts.push(Tone::Neutral, texts.get(key), now);
                        }
                        // A deliberate second instance with the same caption: the catalogue shows
                        // that the control's identity is per instance, so both menus open, select
                        // and remember independently. Only the first menu's choice is accepted by
                        // the form's save button above.
                        if let Some(index) = menu(
                            ui,
                            &theme,
                            &mut state.focus,
                            &mut state.menu_popup_second,
                            texts.get("menu_actions"),
                            &[
                                texts.get("menu_open"),
                                texts.get("menu_duplicate"),
                                texts.get("menu_archive"),
                                texts.get("menu_delete"),
                            ],
                        ) {
                            state.menu_choice_second = Some(index);
                            let key = MENU_ACTIONS.get(index).copied().unwrap_or(MENU_ACTIONS[0]);
                            state.toasts.push(Tone::Neutral, texts.get(key), now);
                        }
                        let hit = button(
                            ui,
                            &theme,
                            &mut state.focus,
                            texts.get("drawer_action"),
                            ButtonVariant::Ghost,
                        );
                        if hit.activated {
                            state.drawer_open = true;
                            state.drawer_trigger = hit.response.id;
                        }
                    });
                    ui.add_space(8.0);
                    let drop = drop_zone(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("drop_hint"),
                        state.drop_hovering,
                    );
                    if drop.activated {
                        state.drop_activations += 1;
                    }
                });

                ui.add_space(12.0);
                card(ui, &theme, |ui| {
                    ui.label(RichText::new(texts.get("section_modal")).strong());
                    ui.add_space(6.0);
                    if button(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("button_modal"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        state.modal_open = true;
                    }
                });
            });
        });

    let trigger = state.drawer_trigger;
    {
        let focus = &mut state.focus;
        let mut close_requested = false;
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
            |ui, focus| {
                ui.label(RichText::new(texts.get("drawer_body")).color(theme.palette.text_muted));
                ui.add_space(8.0);
                if button(
                    ui,
                    &theme,
                    focus,
                    texts.get("drawer_action"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    close_requested = true;
                }
                close_requested
            },
        );
    }

    let mut discard = false;
    let mut keep_editing = false;
    {
        let focus = &mut state.focus;
        modal(
            ctx,
            &theme,
            &mut state.guard.confirm_open,
            texts.get("form_unsaved_title"),
            |ui| {
                ui.label(texts.get("form_unsaved_body"));
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        &theme,
                        focus,
                        texts.get("form_discard_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        discard = true;
                    }
                    if button(
                        ui,
                        &theme,
                        focus,
                        texts.get("form_keep_editing"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        keep_editing = true;
                    }
                });
                discard || keep_editing
            },
        );
    }
    if discard {
        state.guard.confirm_discard();
        state.form.discard();
        state
            .toasts
            .push(Tone::Neutral, texts.get("form_discard"), now);
    }
    if keep_editing {
        state.guard.keep_editing();
    }

    {
        let focus = &mut state.focus;
        modal(
            ctx,
            &theme,
            &mut state.modal_open,
            texts.get("modal_title"),
            |ui| {
                ui.label(texts.get("modal_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        &theme,
                        focus,
                        texts.get("modal_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        close = true;
                    }
                    if button(
                        ui,
                        &theme,
                        focus,
                        texts.get("modal_cancel"),
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
    state.toasts.prune(now, TOAST_TTL_MS);
    let _ = toast_stack(ctx, &theme, &mut state.toasts, now, TOAST_TTL_MS, 16.0);
    onboarding(
        ctx,
        &theme,
        &texts,
        &mut state.focus,
        &mut state.shell.onboarding,
    );
    state.focus.finish_frame();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persistent_state_uses_the_supplied_store_without_demo_records() {
        let store = Store::open_in_memory().expect("store");
        let mut state = GalleryState::from_store(Language::De, Appearance::Dark, "indigo", store)
            .expect("persistent state");

        assert!(state.auth_open);
        assert_eq!(state.auth.view, crate::auth::AuthView::Setup);
        assert_eq!(state.store.contact_count().expect("contacts"), 0);
        assert_eq!(state.store.product_count().expect("products"), 0);
        assert_eq!(state.store.invoice_count().expect("invoices"), 0);
        assert_eq!(state.store.user_count().expect("users"), 0);

        // Heavy module catalogues are deferred until the user actually opens the app.
        assert!(state.app_store.modules.is_empty());
        state
            .open_desktop_app(AppId::new("app-store"), now_millis())
            .expect("open App Store");
        assert_eq!(state.app_store.modules.len(), 18);
    }

    #[test]
    fn startup_uses_the_detected_system_language_when_sync_is_enabled() {
        let store = Store::open_in_memory().expect("store");
        store
            .put_setting(
                crate::i18n::SYSTEM_LANGUAGE_SYNC_SETTING_KEY,
                &serde_json::Value::Bool(true),
            )
            .expect("enable locale sync");
        let state = GalleryState::from_store(Language::De, Appearance::Light, "indigo", store)
            .expect("persistent state");
        assert_eq!(state.language, detect_system_language());
    }

    #[test]
    fn palette_quick_actions_open_their_create_workflows() {
        let store = Store::open_in_memory().expect("store");
        let mut state = GalleryState::from_store(Language::De, Appearance::Light, "indigo", store)
            .expect("persistent state");

        state.apply_palette_quick_action(PaletteQuickAction::NewContact, 1_000);
        assert_eq!(state.contacts.view, crate::contacts::ContactsView::Form);

        state.apply_palette_quick_action(PaletteQuickAction::NewProduct, 1_000);
        assert_eq!(state.products.view, crate::products::ProductsView::Form);

        state.apply_palette_quick_action(PaletteQuickAction::NewInvoice, 1_000);
        assert_eq!(state.invoices.view, crate::invoices::InvoicesView::Form);

        state.apply_palette_quick_action(PaletteQuickAction::NewPurchase, 1_000);
        assert_eq!(state.purchases.view, crate::purchases::PurchasesView::Form);

        state.apply_palette_quick_action(PaletteQuickAction::NewStockMove, 1_000);
        assert_eq!(state.products.view, crate::products::ProductsView::Journal);
        assert!(state.products.stock_moves.create_open);
    }

    #[test]
    fn the_desktop_utilities_open_windows_and_keep_the_desktop_visible() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.auth_open = false;
        state.desktop_open = true;
        let now = now_millis();
        for slug in ["calculator", "widgets"] {
            state
                .open_desktop_app(AppId::new(slug), now)
                .expect("open desktop utility");
            assert!(state.desktop_open, "{slug} keeps the desktop visible");
            assert!(
                state.desktop_windows.is_open(AppId::new(slug)),
                "{slug} opens a window"
            );
        }
        // Both windows paint inside one desktop frame without panicking.
        let input = egui::RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(432.0, 771.0))),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
    }

    fn send_shortcut(ctx: &Context, state: &mut GalleryState, key: Key, modifiers: Modifiers) {
        let input = egui::RawInput {
            events: vec![egui::Event::Key {
                key,
                physical_key: None,
                pressed: true,
                repeat: false,
                modifiers,
            }],
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| {
            handle_global_shortcuts(ctx, state, now_millis())
        });
    }

    #[test]
    fn global_start_menu_shortcut_toggles_the_start_menu() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.shell.onboarding.finish();
        send_shortcut(&ctx, &mut state, Key::Space, Modifiers::CTRL);
        assert!(state.shell.start.is_open());
        send_shortcut(&ctx, &mut state, Key::Space, Modifiers::CTRL);
        assert!(!state.shell.start.is_open());
    }

    #[test]
    fn global_task_view_shortcut_opens_the_window_overview() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.shell.onboarding.finish();
        send_shortcut(&ctx, &mut state, Key::Tab, Modifiers::CTRL);
        assert!(state.shell.task_view.is_open());
        assert!(!state.shell.start.is_open());
        assert!(!state.shell.palette.is_open());
    }

    #[test]
    fn f1_opens_the_native_documentation_window() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.shell.onboarding.finish();
        let admin =
            crate::auth::seed_auth_user(&state.store, socdof_core::now_millis()).expect("admin");
        state.auth.user = Some(admin);
        send_shortcut(&ctx, &mut state, Key::F1, Modifiers::NONE);
        assert!(state.desktop_windows.is_open(AppId::new("documentation")));
        assert!(state.desktop_open);
    }

    #[test]
    fn global_command_palette_shortcut_works_from_the_native_desktop() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.desktop_icons =
            desktop_icons(&state.texts, &socdof_core::domain::permission::ALL_MODULES);
        state.auth_open = false;
        state.desktop_open = true;

        send_shortcut(&ctx, &mut state, Key::K, Modifiers::CTRL);

        assert!(state.shell.palette.is_open());
        assert!(!state.shell.start.is_open());
        assert!(!state.shell.tray.is_open());
    }

    #[test]
    fn global_lock_shortcut_preserves_the_session_and_closes_desktop_windows() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.desktop_open = true;
        let contacts = AppId::new("contacts");
        state.desktop_windows.open(
            Window::new(
                contacts,
                "Contacts",
                Rect::from_min_size(Pos2::new(48.0, 48.0), Vec2::new(900.0, 600.0)),
            ),
            now_millis(),
        );
        assert!(!state.desktop_windows.windows().is_empty());
        let session_id = state.auth.session.as_ref().expect("active session").id;

        send_shortcut(&ctx, &mut state, Key::L, Modifiers::CTRL);

        assert!(state.auth_open);
        assert!(!state.desktop_open);
        assert_eq!(state.auth.view, crate::auth::AuthView::Locked);
        assert_eq!(
            state.auth.session.as_ref().expect("preserved session").id,
            session_id
        );
        assert!(state.desktop_windows.windows().is_empty());
        assert!(!state.contacts_open);
    }

    #[test]
    fn escape_dismisses_the_shell_palette_without_signing_out() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.desktop_open = true;
        state.shell.open_palette();
        let session_id = state.auth.session.as_ref().expect("active session").id;

        send_shortcut(&ctx, &mut state, Key::Escape, Modifiers::NONE);

        assert!(!state.shell.palette.is_open());
        assert_eq!(state.auth.view, crate::auth::AuthView::Unlocked);
        assert_eq!(
            state.auth.session.as_ref().expect("active session").id,
            session_id
        );
    }

    #[test]
    fn global_shortcuts_are_ignored_while_authentication_is_visible() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::from_store(
            Language::En,
            Appearance::Dark,
            "indigo",
            Store::open_in_memory().expect("store"),
        )
        .expect("setup state");

        send_shortcut(&ctx, &mut state, Key::K, Modifiers::CTRL);
        send_shortcut(&ctx, &mut state, Key::L, Modifiers::CTRL);

        assert!(state.auth_open);
        assert_eq!(state.auth.view, crate::auth::AuthView::Setup);
        assert!(!state.shell.palette.is_open());
    }

    fn render(language: Language, appearance: Appearance, modal_open: bool) -> usize {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(language, appearance, "indigo").expect("gallery state");
        state.modal_open = modal_open;
        let output = ctx.run(egui::RawInput::default(), |ctx| gallery(ctx, &mut state));
        assert!(output.shapes.len() > 10, "nothing was drawn");
        output.shapes.len()
    }

    #[test]
    fn standard_user_launcher_hides_and_rejects_ungranted_modules() {
        use socdof_core::domain::user::{User, UserRole};

        let store = Store::open_in_memory().expect("store");
        let user = User {
            id: uuid::Uuid::new_v4(),
            username: "staff".to_string(),
            display_name: "Staff member".to_string(),
            role: UserRole::User,
            role_id: None,
            active: true,
            password_hash: "test-hash".to_string(),
            must_change_password: false,
            passwordless: false,
            created_at: now_millis(),
            updated_at: now_millis(),
        };
        store.insert_user(&user).expect("insert standard user");
        let mut state = GalleryState::from_store(Language::De, Appearance::Light, "indigo", store)
            .expect("persistent state");
        state.auth.user = Some(user);

        state.sync_module_navigation().expect("filter launcher");

        assert!(state
            .desktop_icons
            .index_of(AppId::new("contacts"))
            .is_some());
        assert!(state
            .desktop_icons
            .index_of(AppId::new("settings"))
            .is_none());
        assert!(state.desktop_icons.index_of(AppId::new("users")).is_none());
        assert!(state
            .open_desktop_app(AppId::new("settings"), now_millis())
            .is_err());
        assert!(state
            .open_desktop_app(AppId::new("contacts"), now_millis())
            .is_ok());
        assert!(state.contacts_open);
    }

    #[test]
    fn startup_module_resolves_only_known_desktop_apps() {
        assert_eq!(startup_app("invoices"), Some(AppId::new("invoices")));
        assert_eq!(startup_app("dashboard"), Some(AppId::new("dashboard")));
        assert_eq!(startup_app("missing"), None);
        assert_eq!(startup_app(""), None);
    }

    #[test]
    fn renders_every_language_in_both_appearances() {
        for language in [Language::De, Language::En, Language::Fr, Language::Es] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let shapes = render(language, appearance, false);
                assert!(
                    shapes > 20,
                    "{} {appearance:?} rendered only {shapes} shapes",
                    language.as_str()
                );
            }
        }
    }

    #[test]
    fn modal_adds_drawings_when_open() {
        let closed = render(Language::De, Appearance::Light, false);
        let open = render(Language::De, Appearance::Light, true);
        assert!(
            open > closed,
            "open dialog added no drawings ({closed} vs {open})"
        );
    }

    #[test]
    fn every_accent_builds_a_theme() {
        for id in preset_ids() {
            let state = GalleryState::new(Language::En, Appearance::Dark, id).expect("state");
            let theme = state.theme();
            assert_eq!(theme.accent.id, id);
            assert_eq!(theme.palette.background, state.theme().palette.background);
        }
    }

    #[test]
    fn language_switch_relabels_the_form_without_losing_values() {
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.form.fields[0].value = "Muster AG".to_string();
        state.set_language(Language::Fr).expect("catalogue");
        assert_eq!(state.form.fields[0].value, "Muster AG");
        assert_eq!(state.form.fields[0].label, "Nom de l'entreprise");
        assert!(state.form.is_dirty());
    }

    #[test]
    fn desktop_mode_renders_the_shell() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.desktop_open = true;
        state.shell.onboarding = crate::shell::Onboarding::restore(true);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 800.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(
            output.shapes.len() >= 25,
            "desktop drew only {} shapes",
            output.shapes.len()
        );
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Kontakte"), "desktop labels missing");
        assert!(
            painted.contains("Dashboard"),
            "pinned dashboard tile missing"
        );
        assert_eq!(
            state.desktop_pinned.icons().len(),
            PINNED_DESKTOP.len(),
            "the desktop draws the pinned apps only"
        );
        assert_eq!(
            state.desktop_icons.icons().len(),
            socdof_core::domain::permission::ALL_MODULES.len() + 3
                - socdof_core::app_store::REFERENCE_STARTUP_DISABLED.len(),
            "the start menu lists the reference start set plus the always-available utilities"
        );
    }

    #[test]
    fn dashboard_mode_renders_the_overview() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Übersicht"), "dashboard title missing");
        assert!(
            painted.contains("Letzte Rechnungen"),
            "invoice list missing"
        );
        assert!(state.dashboard_open);
    }

    #[test]
    fn contacts_mode_renders_the_address_book() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.contacts_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Kontakte"), "contacts title missing");
        assert!(painted.contains("Neuer Kontakt"), "new button missing");
        assert!(state.contacts_open);
    }

    #[test]
    fn dashboard_contact_action_opens_the_contacts_form() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::NewContact);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.contacts_open, "contacts screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.contacts.view, crate::contacts::ContactsView::Form);
    }

    #[test]
    fn products_mode_renders_the_catalogue() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.products_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Produkte"), "products title missing");
        assert!(painted.contains("Neuer Artikel"), "new button missing");
        assert!(state.products_open);
    }

    #[test]
    fn dashboard_product_action_opens_the_products_form() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::NewProduct);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.products_open, "products screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.products.view, crate::products::ProductsView::Form);
    }

    #[test]
    fn invoices_mode_renders_the_documents() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.invoices_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Rechnungen"), "invoices title missing");
        assert!(painted.contains("Neue Rechnung"), "new button missing");
        assert!(state.invoices_open);
    }

    #[test]
    fn dashboard_invoice_action_opens_the_invoices_form() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::NewInvoice);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.invoices_open, "invoices screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.invoices.view, crate::invoices::InvoicesView::Form);
    }

    #[test]
    fn accounting_mode_renders_the_journal() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.accounting_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Buchhaltung"), "accounting title missing");
        assert!(painted.contains("Neue Buchung"), "new button missing");
        assert!(state.accounting_open);
    }

    #[test]
    fn dashboard_accounting_action_opens_the_journal() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state
            .dashboard
            .queue_action(DashboardAction::OpenAccounting);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.accounting_open, "accounting screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(
            state.accounting.view,
            crate::accounting::AccountingView::List
        );
    }

    #[test]
    fn purchases_mode_renders_the_order_list() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.purchases_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Bestellungen"), "purchases title missing");
        assert!(painted.contains("Neue Bestellung"), "new button missing");
        assert!(state.purchases_open);
    }

    #[test]
    fn dashboard_purchases_action_opens_the_orders() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenPurchases);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.purchases_open, "purchases screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.purchases.view, crate::purchases::PurchasesView::List);
    }

    #[test]
    fn pos_mode_renders_the_receipts() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.pos_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Kasse"), "POS title missing");
        assert!(painted.contains("Neuer Bon"), "new button missing");
        assert!(state.pos_open);
    }

    #[test]
    fn dashboard_pos_action_opens_the_receipts() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenPos);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.pos_open, "POS screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.pos.view, crate::pos::PosView::List);
    }

    #[test]
    fn calendar_mode_renders_the_month() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.appointments_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Kalender"), "calendar title missing");
        assert!(painted.contains("Neuer Termin"), "new button missing");
        assert!(state.appointments_open);
    }

    #[test]
    fn dashboard_calendar_action_opens_the_month() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenCalendar);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.appointments_open, "calendar did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(
            state.appointments.screen,
            crate::appointments::AppointmentsDetail::Calendar
        );
    }

    #[test]
    fn dashboard_lock_action_opens_the_lock_screen() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::LockSession);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.auth_open, "lock screen did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.auth.view, crate::auth::AuthView::Locked);
    }

    #[test]
    fn dashboard_editor_action_opens_documents() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenEditor);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.editor_open, "editor did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.editor.documents.len(), 2);
        assert!(state.editor.selected.is_some());
    }

    #[test]
    fn app_store_editor_switch_filters_the_dashboard_action() {
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        assert!(state
            .dashboard
            .action_available(DashboardAction::OpenEditor));
        assert!(state.app_store.toggle(&state.store, AppModule::Editor));
        state.sync_module_navigation().expect("navigation");
        assert!(!state
            .dashboard
            .action_available(DashboardAction::OpenEditor));
        assert!(state.app_store.toggle(&state.store, AppModule::Editor));
        state.sync_module_navigation().expect("navigation");
        assert!(state
            .dashboard
            .action_available(DashboardAction::OpenEditor));
    }

    #[test]
    fn dashboard_app_store_action_opens_the_catalogue() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenAppStore);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 900.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.app_store_open, "App Store did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.app_store.modules.len(), 18);
    }

    #[test]
    fn app_store_changes_filter_the_dashboard_and_desktop() {
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        assert!(state
            .dashboard
            .action_available(DashboardAction::NewContact));
        assert!(state
            .desktop_icons
            .icons()
            .iter()
            .any(|icon| icon.app() == AppId::new("contacts")));

        assert!(state.app_store.toggle(&state.store, AppModule::Contacts));
        state.sync_module_navigation().expect("navigation");
        assert!(!state
            .dashboard
            .action_available(DashboardAction::NewContact));
        assert!(!state
            .desktop_icons
            .icons()
            .iter()
            .any(|icon| icon.app() == AppId::new("contacts")));

        assert!(state.app_store.toggle(&state.store, AppModule::Contacts));
        state.sync_module_navigation().expect("navigation");
        assert!(state
            .dashboard
            .action_available(DashboardAction::NewContact));
    }

    #[test]
    fn settings_mode_renders_all_tabs() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.settings_open = true;
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 1000.0),
            )),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");
        assert!(painted.contains("Einstellungen"), "settings title missing");
        assert!(painted.contains("Darstellung"), "appearance tab missing");
        assert!(painted.contains("Sicherung"), "backup tab missing");
        assert!(state.settings_open);
    }

    #[test]
    fn dashboard_settings_action_opens_the_settings() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.dashboard_open = true;
        state.dashboard.queue_action(DashboardAction::OpenSettings);
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 1000.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));
        assert!(state.settings_open, "settings did not open");
        assert!(!state.dashboard_open, "dashboard did not close");
        assert_eq!(state.settings.tab(), crate::settings::SettingsTab::General);
    }

    #[test]
    fn desktop_idle_timeout_returns_to_the_locked_authentication_screen() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.desktop_open = true;
        state.auth_open = false;
        state.auth.idle_timeout_ms = 1_000;
        state.auth.last_activity_ms = now_millis() - 1_001;

        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1280.0, 800.0),
            )),
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| gallery(ctx, &mut state));

        assert!(
            !state.desktop_open,
            "desktop remained visible after idle timeout"
        );
        assert!(state.auth_open, "lock screen was not shown");
        assert_eq!(state.auth.view, crate::auth::AuthView::Locked);
        assert!(
            state.auth.session.is_some(),
            "locking revoked the active session"
        );
    }

    #[test]
    fn saving_window_layout_clears_closed_windows_and_preserves_open_geometry() {
        let mut layout = settings_service::DesktopLayout::default();
        for slug in NATIVE_WINDOW_SLUGS {
            layout.window_states.insert(
                (*slug).to_string(),
                settings_service::DesktopWindowLayout {
                    x: 10,
                    y: 20,
                    width: 800,
                    height: 600,
                    maximized: false,
                    open: true,
                    minimized: true,
                    z_order: 99,
                    desktop_id: None,
                },
            );
        }
        let mut windows = WindowManager::new();
        let projects = AppId::new("projects");
        let rect = Rect::from_min_size(Pos2::new(120.0, 90.0), Vec2::new(920.0, 640.0));
        windows.open(Window::new(projects, "Projects", rect), 1_000);
        windows.open(
            Window::new(
                AppId::new("fleet"),
                "Fleet",
                Rect::from_min_size(Pos2::new(80.0, 70.0), Vec2::new(820.0, 560.0)),
            ),
            1_001,
        );
        windows.minimize(AppId::new("fleet"));

        capture_native_windows(&mut layout, &windows);

        let projects_slug = String::from("projects");
        let projects_state = layout
            .window_states
            .get(&projects_slug)
            .expect("projects state");
        assert!(projects_state.open);
        assert_eq!(projects_state.x, 120);
        assert_eq!(projects_state.y, 90);
        assert_eq!(projects_state.width, 920);
        assert_eq!(projects_state.height, 640);
        assert_eq!(projects_state.z_order, 0);
        let fleet_slug = String::from("fleet");
        let fleet_state = layout.window_states.get(&fleet_slug).expect("fleet state");
        assert!(fleet_state.open);
        assert!(fleet_state.minimized);
        assert_eq!(fleet_state.z_order, 1);
        for slug in ["contacts", "invoices", "app-store", "support", "reports"] {
            let saved = layout.window_states.get(slug).expect("known window state");
            assert!(
                !saved.open,
                "closed {slug} window stayed open in the saved layout"
            );
            assert!(!saved.minimized);
        }
    }

    #[test]
    fn desktop_restores_only_previously_open_native_windows() {
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.desktop_icons =
            desktop_icons(&state.texts, &socdof_core::domain::permission::ALL_MODULES);
        let mut layout = settings_service::DesktopLayout::default();
        layout.window_states.insert(
            "contacts".to_string(),
            settings_service::DesktopWindowLayout {
                x: -500,
                y: -200,
                width: 900,
                height: 600,
                maximized: true,
                open: true,
                minimized: false,
                z_order: 2,
                desktop_id: None,
            },
        );
        layout.window_states.insert(
            "invoices".to_string(),
            settings_service::DesktopWindowLayout {
                x: 40,
                y: 50,
                width: 1000,
                height: 700,
                maximized: false,
                open: true,
                minimized: true,
                z_order: 1,
                desktop_id: None,
            },
        );
        for (slug, z_order) in [
            ("accounting", 0),
            ("pos", 3),
            ("therapy", 4),
            ("users", 5),
            ("projects", 6),
            ("fleet", 7),
            ("restaurant", 8),
            ("products", 9),
            ("purchases", 10),
            ("calendar", 11),
            ("editor", 12),
            ("app-store", 13),
            ("support", 14),
            ("reports", 15),
            ("dashboard", 16),
            ("documentation", 17),
        ] {
            layout.window_states.insert(
                slug.to_string(),
                settings_service::DesktopWindowLayout {
                    x: 80,
                    y: 70,
                    width: 820,
                    height: 560,
                    maximized: false,
                    open: true,
                    minimized: false,
                    z_order,
                    desktop_id: None,
                },
            );
        }

        let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0));
        restore_native_windows(&mut state, &layout, screen, 1_000);

        let contacts = AppId::new("contacts");
        assert!(state.desktop_windows.is_open(contacts));
        assert!(state
            .desktop_windows
            .window(contacts)
            .expect("restored contacts window")
            .is_maximized());
        let normal = state
            .desktop_windows
            .window(contacts)
            .expect("restored contacts window")
            .normal_rect();
        assert!(normal.min.x >= work_area(screen).left());
        assert!(normal.min.y >= work_area(screen).top());
        assert_eq!(normal.width(), 900.0);
        assert_eq!(normal.height(), 600.0);
        assert!(state.desktop_windows.is_open(AppId::new("invoices")));
        assert!(state
            .desktop_windows
            .window(AppId::new("invoices"))
            .expect("restored minimized invoices window")
            .is_minimized());
        assert!(state.desktop_windows.is_open(AppId::new("accounting")));
        assert!(state.desktop_windows.is_open(AppId::new("pos")));
        assert!(state.desktop_windows.is_open(AppId::new("therapy")));
        assert!(state.desktop_windows.is_open(AppId::new("users")));
        assert!(state.desktop_windows.is_open(AppId::new("projects")));
        assert!(state.desktop_windows.is_open(AppId::new("fleet")));
        assert!(state.desktop_windows.is_open(AppId::new("restaurant")));
        assert!(state.desktop_windows.is_open(AppId::new("documentation")));
        for slug in [
            "products",
            "purchases",
            "calendar",
            "editor",
            "app-store",
            "support",
            "reports",
            "dashboard",
        ] {
            assert!(
                state.desktop_windows.is_open(AppId::new(slug)),
                "{slug} window did not remain open"
            );
        }
        assert!(state.desktop_windows.is_open(AppId::new("projects")));
        assert!(state.desktop_windows.is_open(AppId::new("fleet")));
        assert!(state.desktop_windows.is_open(AppId::new("restaurant")));
        assert_eq!(
            state.desktop_windows.windows()[0].app(),
            AppId::new("accounting")
        );
        assert_eq!(
            state.desktop_windows.windows()[1].app(),
            AppId::new("invoices")
        );
        assert_eq!(state.desktop_windows.windows()[2].app(), contacts);
        assert_eq!(state.desktop_windows.windows()[3].app(), AppId::new("pos"));
        assert_eq!(
            state.desktop_windows.windows()[4].app(),
            AppId::new("therapy")
        );
        assert_eq!(
            state.desktop_windows.windows()[5].app(),
            AppId::new("users")
        );
        assert!(!state.desktop_windows.is_open(AppId::new("settings")));
    }

    #[test]
    fn escape_does_not_close_module_windows_while_first_run_onboarding_is_open() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.desktop_open = true;
        state.desktop_windows.open(
            Window::new(
                AppId::new("fleet"),
                "Fleet".to_owned(),
                Rect::from_min_size(Pos2::ZERO, Vec2::new(800.0, 600.0)),
            ),
            1_000,
        );
        send_shortcut(&ctx, &mut state, Key::Escape, Modifiers::NONE);
        assert!(state.shell.onboarding.is_open());
        assert!(state.desktop_windows.is_open(AppId::new("fleet")));
    }

    #[test]
    fn escape_in_the_active_module_window_does_not_close_other_modules() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.desktop_open = true;
        // The default shell state deliberately starts with first-run onboarding visible.
        // Complete it here so Escape tests the focused app window rather than the modal wizard.
        state.shell.onboarding.finish();
        let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0));

        for (index, slug) in ["projects", "calendar"].into_iter().enumerate() {
            let app = AppId::new(slug);
            let title = state
                .desktop_icons
                .label_of(app)
                .expect("module icon")
                .to_owned();
            let rect = crate::desktop::default_window_rect(work_area(screen), index);
            state
                .desktop_windows
                .open(Window::new(app, title, rect), 1_000);
        }
        assert_eq!(
            state.desktop_windows.active(),
            Some(AppId::new("calendar")),
            "the last opened module should own keyboard focus"
        );

        let initial = egui::RawInput {
            screen_rect: Some(screen),
            ..Default::default()
        };
        let _ = ctx.run(initial, |ctx| gallery(ctx, &mut state));
        // The first desktop frame may leave a shell overlay focused; isolate the module-window
        // Escape behavior so the shortcut does not merely dismiss that overlay.
        state.shell.close_overlays();
        state.shell.studio.close();
        let escape = egui::RawInput {
            screen_rect: Some(screen),
            events: vec![egui::Event::Key {
                key: Key::Escape,
                physical_key: None,
                pressed: true,
                repeat: false,
                modifiers: Modifiers::NONE,
            }],
            ..Default::default()
        };
        let _ = ctx.run(escape, |ctx| gallery(ctx, &mut state));

        assert!(
            state.desktop_windows.is_open(AppId::new("projects")),
            "Escape in Fleet closed the background Projects window"
        );
        assert!(
            !state.desktop_windows.is_open(AppId::new("fleet")),
            "Escape did not close the active Fleet window"
        );
    }

    #[test]
    fn native_desktop_renders_all_registered_business_module_windows() {
        let ctx = crate::theme::headless_context();
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.desktop_icons =
            desktop_icons(&state.texts, &socdof_core::domain::permission::ALL_MODULES);
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.desktop_open = true;
        let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0));
        for (index, slug) in [
            "accounting",
            "pos",
            "therapy",
            "users",
            "projects",
            "fleet",
            "restaurant",
            "products",
            "purchases",
            "calendar",
            "editor",
            "app-store",
            "support",
            "reports",
            "dashboard",
            "documentation",
        ]
        .into_iter()
        .enumerate()
        {
            let app = AppId::new(slug);
            let title = state
                .desktop_icons
                .label_of(app)
                .expect("module icon")
                .to_owned();
            let rect = crate::desktop::default_window_rect(work_area(screen), index);
            state
                .desktop_windows
                .open(Window::new(app, title, rect), 1_000);
        }

        let input = egui::RawInput {
            screen_rect: Some(screen),
            ..Default::default()
        };
        // egui Areas establish their persisted layer geometry during the first frame.
        // Render a second frame before inspecting the native floating-window contents.
        let _ = ctx.run(input.clone(), |ctx| gallery(ctx, &mut state));
        let output = ctx.run(input, |ctx| gallery(ctx, &mut state));
        let painted = crate::snapshot::signature(&output).join("\n");

        assert!(
            painted.contains("BWA") || painted.contains("UStVA"),
            "accounting window content was not drawn"
        );
        assert!(
            painted.contains("Neuer Bon"),
            "POS window content was not drawn"
        );
        assert!(
            painted.contains(state.texts.get("users_new")),
            "users window content was not drawn; painted={painted:?}"
        );
        assert!(
            painted.contains(state.texts.get("projects_title")),
            "projects window content was not drawn; painted={painted:?}"
        );
        assert!(
            painted.contains(state.texts.get("fleet_title")),
            "fleet window content was not drawn; painted={painted:?}"
        );
        assert!(
            painted.contains(state.texts.get("restaurant_title")),
            "restaurant window content was not drawn; painted={painted:?}"
        );
        assert!(
            painted.contains(state.texts.get("docs_title")),
            "documentation window content was not drawn; painted={painted:?}"
        );
        for key in [
            "products_title",
            "purchases_title",
            "appointments_title",
            "editor_title",
            "app_store_title",
            "support_title",
            "reports_title",
            "dashboard_title",
        ] {
            assert!(
                painted.contains(state.texts.get(key)),
                "{key} window content was not drawn; painted={painted:?}"
            );
        }
        assert!(state.desktop_windows.is_open(AppId::new("accounting")));
        assert!(state.desktop_windows.is_open(AppId::new("pos")));
        assert!(state.desktop_windows.is_open(AppId::new("therapy")));
        assert!(state.desktop_windows.is_open(AppId::new("users")));
        assert!(
            output.shapes.len() > 80,
            "native module windows drew too few shapes"
        );
    }

    #[test]
    fn guard_blocks_closing_a_dirty_form() {
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "teal").expect("state");
        assert_eq!(
            state.guard.request_close(state.form.is_dirty()),
            CloseDecision::Close
        );
        state.form.fields[0].value = "Example Ltd".to_string();
        assert_eq!(
            state.guard.request_close(state.form.is_dirty()),
            CloseDecision::Confirm
        );
        assert!(state.guard.confirm_open);
        state.guard.confirm_discard();
        state.form.discard();
        assert!(!state.form.is_dirty());
    }

    /// Drives the gallery with real pointer and keyboard events at one phone size.
    struct GalleryInput {
        ctx: Context,
        state: GalleryState,
        width: f32,
        height: f32,
        time: f64,
    }

    impl GalleryInput {
        fn at(width: f32, height: f32, appearance: Appearance) -> Self {
            let mut state =
                GalleryState::new(Language::De, appearance, "indigo").expect("gallery state");
            // The onboarding card is a foreground overlay; it would swallow the wheel input the
            // harness uses to reach the controls further down.
            state.shell.onboarding.finish();
            Self {
                ctx: crate::theme::headless_context(),
                state,
                width,
                height,
                time: 1.0,
            }
        }

        fn frame(&mut self, events: Vec<egui::Event>) {
            self.time += 1.0 / 60.0;
            let input = egui::RawInput {
                screen_rect: Some(Rect::from_min_size(
                    Pos2::ZERO,
                    Vec2::new(self.width, self.height),
                )),
                events,
                time: Some(self.time),
                ..Default::default()
            };
            let Self { ctx, state, .. } = self;
            let _ = ctx.run(input, |ctx| gallery(ctx, state));
            // The kit owns the keyboard, egui keeps a second focus next to it. A Tab sequence
            // moves that focus onto some widget that Enter would then click, so it is dropped
            // whenever it disagrees with the kit. A focused text field is the same id in both and
            // keeps its focus, because egui reads the typed text through its own memory.
            let kit_focus = self.state.focus.focused();
            self.ctx.memory_mut(|memory| {
                if let Some(focused) = memory.focused() {
                    if Some(focused) != kit_focus {
                        memory.surrender_focus(focused);
                    }
                }
            });
        }

        fn viewport(&self) -> Rect {
            Rect::from_min_size(Pos2::ZERO, Vec2::new(self.width, self.height))
        }

        fn menu_id(&self, occurrence: usize) -> Id {
            crate::controls::menu_id(self.state.texts.get("menu_actions"), occurrence)
        }

        fn row_id(&self, occurrence: usize, index: usize) -> Id {
            self.menu_id(occurrence).with(("item", index))
        }

        fn select_id(&self, slot: usize) -> Id {
            crate::controls::select_id("socdof-gallery-term", slot)
        }

        fn option_id(&self, slot: usize, index: usize) -> Id {
            self.select_id(slot).with(("option", index))
        }

        /// Id of the file drop area, recognised by the height only it paints with.
        fn drop_zone_id(&mut self) -> Id {
            self.frame(Vec::new());
            let ids: Vec<Id> = self.state.focus.order().to_vec();
            let found: Vec<Id> = ids
                .into_iter()
                .filter(|id| {
                    self.ctx
                        .read_response(*id)
                        .map(|response| {
                            (response.rect.height() - 96.0).abs() < 0.5
                                && response.rect.width() > 200.0
                        })
                        .unwrap_or(false)
                })
                .collect();
            assert_eq!(found.len(), 1, "expected exactly one drop area");
            found[0]
        }

        /// Lets the smoothed wheel scrolling come to rest before geometry is compared.
        fn settle(&mut self) {
            for _ in 0..10 {
                self.frame(Vec::new());
            }
        }

        fn rect_of(&self, id: Id) -> Rect {
            self.ctx
                .read_response(id)
                .expect("control was painted")
                .rect
        }

        /// Scrolls until the control is fully visible with room for `rows` popup rows below it.
        fn scroll_with_room(&mut self, id: Id, rows: usize) -> Rect {
            let mut previous = None;
            for _ in 0..40 {
                self.frame(Vec::new());
                let rect = self.rect_of(id);
                let room = rect.bottom() + 8.0 + 33.0 * rows as f32;
                if self.viewport().contains_rect(rect) && room <= self.height {
                    // The wheel scroll is animated, so the rectangle has to stay put for a frame
                    // before a click may address it.
                    if previous == Some(rect) {
                        assert!(
                            rect.right() <= self.width + 0.5,
                            "the gallery control ends at {} px, the panel ends at {} px",
                            rect.right(),
                            self.width + 0.5
                        );
                        return rect;
                    }
                } else {
                    assert!(
                        previous != Some(rect),
                        "the gallery does not scroll to the control: it stays at {rect:?} outside \
                         the {} × {} viewport",
                        self.width,
                        self.height
                    );
                    let step = if rect.top() < 0.0 { 240.0 } else { -240.0 };
                    let pos = Pos2::new(self.width / 2.0, self.height / 2.0);
                    self.frame(vec![
                        egui::Event::PointerMoved(pos),
                        egui::Event::Scroll(Vec2::new(0.0, step)),
                    ]);
                }
                previous = Some(rect);
            }
            panic!(
                "the gallery never brought the control into the {} × {} viewport",
                self.width, self.height
            );
        }

        fn scroll_to(&mut self, id: Id) -> Rect {
            self.scroll_with_room(id, 0)
        }

        /// Moves, presses and releases the primary pointer at `pos`; the move gets its own frame
        /// because egui hit-tests a press against the controls it knew from the frame before.
        fn click_at(&mut self, pos: Pos2) {
            let button = |pressed| egui::Event::PointerButton {
                pos,
                button: egui::PointerButton::Primary,
                pressed,
                modifiers: Modifiers::NONE,
            };
            self.frame(vec![egui::Event::PointerMoved(pos)]);
            self.frame(vec![egui::Event::PointerMoved(pos), button(true)]);
            self.frame(vec![button(false)]);
        }

        /// Clicks the field and types `text` into it.
        fn type_into(&mut self, id: Id, text: &str) {
            let rect = self.scroll_to(id);
            self.click_at(rect.center());
            // The field takes the focus at the end of the release frame, after it has already read
            // that frame's events; the idle frame lets it start the next one focused.
            self.frame(Vec::new());
            self.frame(vec![egui::Event::Text(text.to_string())]);
        }

        /// Id of the control painted `back` positions before the menu (1 = directly before it).
        fn control_before_menu(&mut self, back: usize) -> Id {
            self.frame(Vec::new());
            let order = self.state.focus.order().to_vec();
            let menu = order
                .iter()
                .position(|id| *id == self.menu_id(0))
                .expect("the action menu was painted");
            assert!(
                menu >= back,
                "only {menu} controls were painted before the menu"
            );
            order[menu - back]
        }

        fn key(key: Key) -> egui::Event {
            egui::Event::Key {
                key,
                physical_key: None,
                pressed: true,
                repeat: false,
                modifiers: Modifiers::NONE,
            }
        }

        fn stored_action(&self) -> Option<String> {
            self.state
                .store
                .get_setting(MENU_ACTION_SETTING)
                .expect("read the stored menu action")
                .and_then(|value| value.as_str().map(str::to_owned))
        }
    }

    #[test]
    fn the_action_menu_opens_with_one_click_and_saves_the_choice_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                // The form paints its two fields, then save, discard and the secondary button;
                // the action menu follows them in the form's sibling card.
                let company = h.control_before_menu(5);
                let email = h.control_before_menu(4);
                let save = h.control_before_menu(3);
                h.type_into(company, "Muster AG");
                h.type_into(email, "kunde@example.org");
                assert_eq!(
                    h.state.form.fields[0].value, "Muster AG",
                    "typing at {width} px, {appearance:?} did not reach the company field"
                );

                // The popup paints below the control, so the menu needs room for its four rows.
                let rect = h.scroll_with_room(h.menu_id(0), 4);
                h.click_at(rect.center());
                assert_eq!(
                    h.state.menu_popup.open,
                    Some(0),
                    "one click at {width} px, {appearance:?} did not open the action menu"
                );

                let row = h.rect_of(h.row_id(0, 2));
                assert!(
                    h.viewport().contains_rect(row),
                    "the popup row at {width} px, {appearance:?} is painted outside the viewport: \
                     {row:?}"
                );
                assert!(
                    row.right() <= width + 0.5,
                    "the popup row at {width} px, {appearance:?} reaches {} px, the panel ends at \
                     {} px",
                    row.right(),
                    width + 0.5
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.menu_choice,
                    Some(2),
                    "clicking the third row at {width} px, {appearance:?} did not choose it"
                );
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "the popup stayed open at {width} px, {appearance:?} after choosing"
                );

                let rect = h.scroll_to(save);
                h.click_at(rect.center());
                assert_eq!(
                    h.state.menu_saved,
                    Some(2),
                    "saving at {width} px, {appearance:?} did not accept the chosen action"
                );
                assert_eq!(
                    h.stored_action().as_deref(),
                    Some("menu_archive"),
                    "the store at {width} px, {appearance:?} holds a different action"
                );

                // A second save without a new choice writes the same value again.
                let rect = h.scroll_to(save);
                h.click_at(rect.center());
                assert_eq!(
                    h.state.menu_saved,
                    Some(2),
                    "the second save at {width} px, {appearance:?} changed the action"
                );
                assert_eq!(
                    h.stored_action().as_deref(),
                    Some("menu_archive"),
                    "the second save at {width} px, {appearance:?} changed the stored action"
                );
                assert!(
                    !h.state.form.is_dirty(),
                    "the second save at {width} px, {appearance:?} left the form dirty"
                );
            }
        }
    }

    #[test]
    fn the_action_menu_opens_and_chooses_with_the_keyboard() {
        let mut h = GalleryInput::at(360.0, 768.0, Appearance::Light);
        h.scroll_to(h.menu_id(0));
        let mut reached = false;
        for _ in 0..400 {
            h.frame(vec![GalleryInput::key(Key::Tab)]);
            if h.state.focus.is_focused(h.menu_id(0)) {
                reached = true;
                break;
            }
        }
        assert!(
            reached,
            "tabbing never moved the focus onto the action menu"
        );

        h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
        assert_eq!(
            h.state.menu_popup.open,
            Some(0),
            "the keyboard did not open the action menu"
        );
        h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
        h.frame(vec![GalleryInput::key(Key::Enter)]);
        assert_eq!(
            h.state.menu_choice,
            Some(1),
            "Enter did not choose the highlighted row"
        );
        assert_eq!(
            h.state.menu_popup.open, None,
            "the keyboard left the menu open"
        );
        assert!(
            h.state.focus.is_focused(h.menu_id(0)),
            "closing the menu did not return the focus to it"
        );
    }

    #[test]
    fn the_two_menus_with_the_same_label_keep_their_own_state_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                assert_ne!(
                    h.menu_id(0),
                    h.menu_id(1),
                    "both menus share one id at {width} px, {appearance:?}"
                );

                // Both menus sit in one row; the popup of each needs room below it.
                let first = h.scroll_with_room(h.menu_id(0), 4);
                let second = h.rect_of(h.menu_id(1));
                assert_ne!(first, second, "both menus paint on the same rectangle");
                assert!(
                    h.viewport().contains_rect(second),
                    "the second menu at {width} px, {appearance:?} is outside the viewport: \
                     {second:?}"
                );
                assert!(
                    second.right() <= width + 0.5,
                    "the second menu at {width} px, {appearance:?} reaches {} px, the panel ends \
                     at {} px",
                    second.right(),
                    width + 0.5
                );

                h.click_at(second.center());
                assert_eq!(
                    h.state.menu_popup_second.open,
                    Some(0),
                    "one click at {width} px, {appearance:?} did not open the second menu"
                );
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "opening the second menu at {width} px, {appearance:?} opened the first one too"
                );
                h.frame(vec![GalleryInput::key(Key::Escape)]);
                assert_eq!(
                    h.state.menu_popup_second.open, None,
                    "Escape left the second menu open at {width} px, {appearance:?}"
                );

                // Choosing in the first menu leaves the second one's value alone.
                let rect = h.scroll_with_room(h.menu_id(0), 4);
                h.click_at(rect.center());
                let row = h.rect_of(h.row_id(0, 1));
                assert!(
                    h.viewport().contains_rect(row),
                    "the row of the first menu at {width} px, {appearance:?} is outside the \
                     viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.menu_choice,
                    Some(1),
                    "the first menu did not choose its row at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice_second, None,
                    "choosing in the first menu at {width} px, {appearance:?} changed the second \
                     menu's value"
                );
                assert_eq!(h.state.menu_popup.open, None);
                assert_eq!(h.state.menu_popup_second.open, None);

                // The second menu opens and chooses on its own, with a different row.
                let rect = h.rect_of(h.menu_id(1));
                h.click_at(rect.center());
                assert_eq!(
                    h.state.menu_popup_second.open,
                    Some(0),
                    "the second menu did not open at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "opening the second menu at {width} px, {appearance:?} opened the first one too"
                );
                let row = h.rect_of(h.row_id(1, 3));
                assert_ne!(
                    h.row_id(1, 3),
                    h.row_id(0, 3),
                    "both menus share their popup row ids"
                );
                assert!(
                    h.viewport().contains_rect(row),
                    "the row of the second menu at {width} px, {appearance:?} is outside the \
                     viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.menu_choice_second,
                    Some(3),
                    "the second menu did not choose its row at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice,
                    Some(1),
                    "choosing in the second menu at {width} px, {appearance:?} changed the first \
                     menu's value"
                );
            }
        }
    }

    #[test]
    fn the_action_menu_keyboard_covers_escape_home_and_end_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                h.scroll_to(h.menu_id(0));
                let mut reached = false;
                for _ in 0..400 {
                    h.frame(vec![GalleryInput::key(Key::Tab)]);
                    if h.state.focus.is_focused(h.menu_id(0)) {
                        reached = true;
                        break;
                    }
                }
                assert!(
                    reached,
                    "tabbing never focused the first menu at {width} px, {appearance:?}"
                );

                // Arrow opens, Escape closes again without touching the value.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                assert_eq!(
                    h.state.menu_popup.open,
                    Some(0),
                    "the arrow key did not open the menu at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::Escape)]);
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "Escape left the menu open at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice, None,
                    "Escape changed the value at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice_second, None,
                    "Escape changed the second value at {width} px, {appearance:?}"
                );

                // Arrow moves the highlight, Enter takes it.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.menu_choice,
                    Some(1),
                    "the arrow key plus Enter did not choose the second row at {width} px, \
                     {appearance:?}"
                );

                // End jumps to the last row.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::End)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.menu_choice,
                    Some(3),
                    "End plus Enter did not choose the last row at {width} px, {appearance:?}"
                );

                // Home jumps back to the first row.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Home)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.menu_choice,
                    Some(0),
                    "Home plus Enter did not choose the first row at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice_second, None,
                    "the keyboard at {width} px, {appearance:?} changed the second menu's value"
                );
            }
        }
    }

    #[test]
    fn the_two_dropdowns_with_a_copied_popup_state_keep_their_own_identity_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                // The demo copies the owner's popup state right after the owner painted, so the
                // copy starts with the owner's slot and both are painted in the same frame.
                h.state.draft = true;
                h.frame(Vec::new());
                let owner = h.state.mirror_popup.slot().expect("owner slot");
                let copy = h.state.mirror_copy.slot().expect("copy slot");
                assert_ne!(
                    owner, copy,
                    "the copied popup state kept the owner's slot at {width} px, {appearance:?}"
                );
                // Painting again keeps both identities instead of handing out new ones.
                h.frame(Vec::new());
                assert_eq!(h.state.mirror_popup.slot(), Some(owner));
                assert_eq!(h.state.mirror_copy.slot(), Some(copy));
                let owner_id = crate::controls::select_id("socdof-gallery-mirror", owner);
                let copy_id = crate::controls::select_id("socdof-gallery-mirror", copy);
                assert_ne!(owner_id, copy_id);
                let owner_rect = h.rect_of(owner_id);
                let copy_rect = h.rect_of(copy_id);
                assert_ne!(owner_rect, copy_rect);
                assert!(
                    copy_rect.right() <= width + 0.5,
                    "the copied dropdown at {width} px, {appearance:?} reaches {} px, the panel \
                     ends at {} px",
                    copy_rect.right(),
                    width + 0.5
                );

                // The owner opens and chooses under its own id.
                let owner_rect = h.scroll_with_room(owner_id, 3);
                h.click_at(owner_rect.center());
                assert_eq!(
                    h.state.mirror_popup.open,
                    Some(1),
                    "one click at {width} px, {appearance:?} did not open the owning dropdown"
                );
                assert_eq!(
                    h.state.mirror_copy.open, None,
                    "opening the owning dropdown at {width} px, {appearance:?} opened the copy"
                );
                let row = h.rect_of(owner_id.with(("option", 2)));
                assert!(
                    h.viewport().contains_rect(row),
                    "the option at {width} px, {appearance:?} is outside the viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.mirror_a, 2,
                    "the owning dropdown did not choose at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.mirror_b, 0,
                    "choosing in the owning dropdown changed the copy at {width} px, {appearance:?}"
                );

                // The copy opens and chooses on its own.
                let copy_rect = h.scroll_with_room(copy_id, 3);
                h.click_at(copy_rect.center());
                assert_eq!(
                    h.state.mirror_copy.open,
                    Some(0),
                    "the copied dropdown did not open at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.mirror_popup.open, None,
                    "opening the copied dropdown at {width} px, {appearance:?} opened the owner"
                );
                assert_ne!(
                    copy_id.with(("option", 1)),
                    owner_id.with(("option", 1)),
                    "both dropdowns share their option ids"
                );
                let row = h.rect_of(copy_id.with(("option", 1)));
                assert!(
                    h.viewport().contains_rect(row),
                    "the copy's option at {width} px, {appearance:?} is outside the viewport: \
                     {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.mirror_b, 1,
                    "the copied dropdown did not choose at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.mirror_a,
                    2,
                    "choosing in the copied dropdown changed the owner at {width} px, {appearance:?}"
                );
            }
        }
    }

    #[test]
    fn the_menu_ids_survive_a_conditional_menu_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                assert_ne!(h.menu_id(0), h.menu_id(2));
                assert_ne!(h.select_id(0), h.menu_id(0));

                h.scroll_with_room(h.menu_id(0), 4);
                h.settle();
                let first_rect = h.rect_of(h.menu_id(0));
                h.click_at(first_rect.center());
                assert_eq!(
                    h.state.menu_popup.open,
                    Some(0),
                    "one click at {width} px, {appearance:?} did not open the first menu"
                );
                h.frame(vec![GalleryInput::key(Key::Escape)]);
                assert_eq!(h.state.menu_popup.open, None);
                assert_eq!(
                    h.state.focus.focused(),
                    Some(h.menu_id(0)),
                    "the focus did not return to the first menu at {width} px, {appearance:?}"
                );

                // A third menu with the same caption appears above the fixed pair.
                h.state.draft = true;
                h.frame(Vec::new());
                let extra = h.rect_of(h.menu_id(2));
                assert!(
                    extra.top() < h.rect_of(h.menu_id(0)).top(),
                    "the conditional menu at {width} px, {appearance:?} was not painted above the \
                     existing ones"
                );
                assert!(
                    extra.right() <= width + 0.5,
                    "the conditional menu at {width} px, {appearance:?} reaches {} px, the panel \
                     ends at {} px",
                    extra.right(),
                    width + 0.5
                );
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "the conditional menu opened on its own at {width} px, {appearance:?}"
                );
                assert_eq!(h.state.menu_choice, None);
                assert_eq!(h.state.menu_choice_extra, None);

                // Hiding and showing keeps the rectangle and the identity; nothing was chosen yet,
                // so no toast changes the layout while the rectangles are compared.
                h.state.draft = false;
                h.frame(Vec::new());
                h.settle();
                assert_eq!(
                    h.rect_of(h.menu_id(0)),
                    first_rect,
                    "the first menu moved to a different rectangle at {width} px, {appearance:?}"
                );
                h.state.draft = true;
                h.frame(Vec::new());
                h.settle();
                assert_eq!(
                    h.rect_of(h.menu_id(2)),
                    extra,
                    "the returning menu got a different identity at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.focus.focused(),
                    Some(h.menu_id(0)),
                    "the first menu lost the focus while the third one returned at {width} px, \
                     {appearance:?}"
                );

                // The arrow still belongs to the first menu; the conditional one stays closed.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                assert_eq!(
                    h.state.menu_popup.open,
                    Some(0),
                    "the first menu lost its keyboard at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_popup_extra.open, None,
                    "the conditional menu took the arrow at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.menu_choice,
                    Some(1),
                    "the first menu did not choose its row at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice_extra, None,
                    "choosing in the first menu changed the conditional value at {width} px, \
                     {appearance:?}"
                );

                // The conditional menu opens and chooses under its own id.
                let rect = h.scroll_with_room(h.menu_id(2), 4);
                h.click_at(rect.center());
                assert_eq!(
                    h.state.menu_popup_extra.open,
                    Some(0),
                    "one click at {width} px, {appearance:?} did not open the conditional menu"
                );
                assert_eq!(
                    h.state.menu_popup.open, None,
                    "opening the conditional menu opened the first one at {width} px, \
                     {appearance:?}"
                );
                let row = h.rect_of(h.row_id(2, 2));
                assert!(
                    h.viewport().contains_rect(row),
                    "the row of the conditional menu at {width} px, {appearance:?} is outside the \
                     viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.menu_choice_extra,
                    Some(2),
                    "the conditional menu did not choose its row at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.menu_choice,
                    Some(1),
                    "choosing in the conditional menu changed the first value at {width} px, \
                     {appearance:?}"
                );
            }
        }
    }

    #[test]
    fn the_drop_area_activates_with_space_like_enter_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                let id = h.drop_zone_id();
                let rect = h.scroll_with_room(id, 0);
                assert!(
                    h.viewport().contains_rect(rect),
                    "the drop area at {width} px, {appearance:?} is outside the viewport: {rect:?}"
                );
                assert!(
                    rect.right() <= width + 0.5,
                    "the drop area at {width} px, {appearance:?} reaches {} px, the panel ends at \
                     {} px",
                    rect.right(),
                    width + 0.5
                );

                // The pointer hits the control under its own id.
                h.click_at(rect.center());
                assert_eq!(
                    h.state.drop_activations, 1,
                    "one click at {width} px, {appearance:?} did not activate the drop area"
                );
                assert_eq!(
                    h.state.focus.focused(),
                    Some(id),
                    "the click did not focus the drop area at {width} px, {appearance:?}"
                );

                // Enter and Space activate it with the same result.
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.drop_activations, 2,
                    "Enter did not activate the drop area at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::Space)]);
                assert_eq!(
                    h.state.drop_activations, 3,
                    "Space did not activate the drop area at {width} px, {appearance:?}"
                );
            }
        }
    }

    #[test]
    fn the_select_ids_survive_a_conditional_dropdown_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                let first_rect = h.scroll_with_room(h.select_id(0), 3);
                h.click_at(first_rect.center());
                assert_eq!(
                    h.state.select_popup.open,
                    Some(1),
                    "one click at {width} px, {appearance:?} did not open the first select"
                );
                h.frame(vec![GalleryInput::key(Key::Escape)]);
                assert_eq!(h.state.select_popup.open, None);
                assert_eq!(
                    h.state.focus.focused(),
                    Some(h.select_id(0)),
                    "the focus did not return to the first select at {width} px, {appearance:?}"
                );

                // A third dropdown with the same source appears above the two existing ones.
                h.state.draft = true;
                h.frame(Vec::new());
                let extra = h.rect_of(h.select_id(2));
                assert!(
                    extra.top() < h.rect_of(h.select_id(0)).top(),
                    "the conditional select at {width} px, {appearance:?} was not painted above \
                     the existing ones"
                );
                assert!(
                    extra.right() <= width + 0.5,
                    "the conditional select at {width} px, {appearance:?} reaches {} px, the panel \
                     ends at {} px",
                    extra.right(),
                    width + 0.5
                );

                // The arrow still belongs to the first select, which kept its identity and focus;
                // the conditional one stays closed and selects nothing.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                assert_eq!(
                    h.state.select_popup.open,
                    Some(1),
                    "the first select lost its keyboard at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select_popup_extra.open, None,
                    "the conditional select took the arrow at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.select, 2,
                    "the first select did not choose its option at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select_extra, 0,
                    "choosing in the first select changed the conditional value at {width} px, \
                     {appearance:?}"
                );

                // The conditional dropdown goes away and comes back with the same identity.
                h.state.draft = false;
                h.frame(Vec::new());
                assert_eq!(
                    h.rect_of(h.select_id(0)),
                    first_rect,
                    "the first select moved back to a different rectangle at {width} px, \
                     {appearance:?}"
                );
                assert_eq!(
                    h.state.select, 2,
                    "hiding the conditional select changed the value"
                );
                h.state.draft = true;
                h.frame(Vec::new());
                assert_eq!(
                    h.rect_of(h.select_id(2)),
                    extra,
                    "the returning select got a different identity at {width} px, {appearance:?}"
                );
                assert_ne!(h.select_id(0), h.select_id(2));
                assert_ne!(h.select_id(1), h.select_id(2));
                assert_eq!(h.state.select, 2);
                assert_eq!(h.state.select_second, 0);
                assert_eq!(h.state.select_extra, 0);
            }
        }
    }

    #[test]
    fn the_drawer_closes_with_space_like_enter_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);

                // The drawer focuses its close button when it opens; Enter closes it.
                h.state.drawer_open = true;
                h.frame(Vec::new());
                assert!(
                    h.state.drawer_open,
                    "the drawer did not open at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert!(
                    !h.state.drawer_open,
                    "Enter did not close the drawer at {width} px, {appearance:?}"
                );

                // The same button takes Space with the same result.
                h.state.drawer_open = true;
                h.frame(Vec::new());
                assert!(h.state.drawer_open);
                h.frame(vec![GalleryInput::key(Key::Space)]);
                assert!(
                    !h.state.drawer_open,
                    "Space did not close the drawer at {width} px, {appearance:?}"
                );
            }
        }
    }

    #[test]
    fn the_two_selects_with_the_same_source_keep_their_own_state_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                assert_ne!(
                    h.select_id(0),
                    h.select_id(1),
                    "both selects share one id at {width} px, {appearance:?}"
                );

                let first = h.scroll_with_room(h.select_id(0), 3);
                let second = h.rect_of(h.select_id(1));
                assert_ne!(first, second, "both selects paint on the same rectangle");
                assert!(
                    second.right() <= width + 0.5,
                    "the second select at {width} px, {appearance:?} reaches {} px, the panel ends \
                     at {} px",
                    second.right(),
                    width + 0.5
                );

                // One click opens the first dropdown only, and it opens at its own value.
                h.click_at(first.center());
                assert_eq!(
                    h.state.select_popup.open,
                    Some(1),
                    "one click at {width} px, {appearance:?} did not open the first select"
                );
                assert_eq!(
                    h.state.select_popup_second.open, None,
                    "opening the first select at {width} px, {appearance:?} opened the second one too"
                );

                let row = h.rect_of(h.option_id(0, 2));
                assert!(
                    h.viewport().contains_rect(row),
                    "the option of the first select at {width} px, {appearance:?} is outside the \
                     viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.select, 2,
                    "the first select did not choose its option at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select_second, 0,
                    "choosing in the first select at {width} px, {appearance:?} changed the second \
                     one's value"
                );
                assert_eq!(h.state.select_popup.open, None);
                assert_eq!(h.state.select_popup_second.open, None);

                // The second dropdown then opens and chooses on its own.
                let second = h.scroll_with_room(h.select_id(1), 3);
                h.click_at(second.center());
                assert_eq!(
                    h.state.select_popup_second.open,
                    Some(0),
                    "the second select did not open at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select_popup.open, None,
                    "opening the second select at {width} px, {appearance:?} opened the first one too"
                );
                let row = h.rect_of(h.option_id(1, 1));
                assert!(
                    h.viewport().contains_rect(row),
                    "the option of the second select at {width} px, {appearance:?} is outside the \
                     viewport: {row:?}"
                );
                h.click_at(row.center());
                assert_eq!(
                    h.state.select_second, 1,
                    "the second select did not choose its option at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select, 2,
                    "choosing in the second select at {width} px, {appearance:?} changed the first \
                     one's value"
                );
            }
        }
    }

    #[test]
    fn the_select_keyboard_covers_space_escape_home_and_end_at_every_phone_width() {
        for width in [360.0, 390.0, 412.0, 432.0] {
            for appearance in [Appearance::Light, Appearance::Dark] {
                let mut h = GalleryInput::at(width, 768.0, appearance);
                h.scroll_with_room(h.select_id(0), 3);
                let mut reached = false;
                for _ in 0..400 {
                    h.frame(vec![GalleryInput::key(Key::Tab)]);
                    if h.state.focus.is_focused(h.select_id(0)) {
                        reached = true;
                        break;
                    }
                }
                assert!(
                    reached,
                    "tabbing never focused the first select at {width} px, {appearance:?}"
                );

                // The arrow opens at the current value, Escape closes without a value change.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                assert_eq!(
                    h.state.select_popup.open,
                    Some(1),
                    "the arrow key did not open the select at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Escape)]);
                assert_eq!(
                    h.state.select_popup.open, None,
                    "Escape left the select open at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select, 1,
                    "Escape changed the value at {width} px, {appearance:?}"
                );
                assert_eq!(
                    h.state.select_second, 0,
                    "Escape changed the second value at {width} px, {appearance:?}"
                );

                // End then Space takes the last row, just like Enter does.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::End)]);
                h.frame(vec![GalleryInput::key(Key::Space)]);
                assert_eq!(
                    h.state.select, 2,
                    "End plus Space did not choose the last row at {width} px, {appearance:?}"
                );

                // Home then Enter takes the first row.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Home)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.select, 0,
                    "Home plus Enter did not choose the first row at {width} px, {appearance:?}"
                );

                // Space and Enter confirm the highlighted row the same way: one step down from the
                // first row is the second row for both keys.
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Space)]);
                assert_eq!(
                    h.state.select, 1,
                    "Space did not confirm the highlighted row at {width} px, {appearance:?}"
                );
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Home)]);
                h.frame(vec![GalleryInput::key(Key::ArrowDown)]);
                h.frame(vec![GalleryInput::key(Key::Enter)]);
                assert_eq!(
                    h.state.select, 1,
                    "Enter did not confirm the same highlighted row as Space at {width} px, \
                     {appearance:?}"
                );
                assert_eq!(
                    h.state.select_second, 0,
                    "the keyboard at {width} px, {appearance:?} changed the second select's value"
                );
            }
        }
    }

    #[test]
    fn the_action_menu_restores_the_saved_choice_from_the_store() {
        let store = Store::open_in_memory().expect("store");
        store
            .put_setting(
                MENU_ACTION_SETTING,
                &serde_json::Value::String("menu_delete".to_string()),
            )
            .expect("seed the stored action");
        let state = GalleryState::from_store(Language::De, Appearance::Light, "indigo", store)
            .expect("persistent state");
        assert_eq!(state.menu_saved, Some(3));
        assert_eq!(state.menu_choice, Some(3));
    }
}
