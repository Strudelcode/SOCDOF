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
use crate::auth::{auth, AuthState, SetupTemplate};
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
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::invoices::{invoices, seed_invoices, InvoicesState};
use crate::pos::{pos, seed_pos, PosState};
use crate::products::{products, seed_products, ProductsState};
use crate::projects::{projects, ProjectsState};
use crate::purchases::{purchases, seed_purchases, PurchasesState};
use crate::reports::{reports as reports_screen, ReportsState};
use crate::settings::{seed_settings, settings, SettingsState};
use crate::shell::{onboarding, ShellState};
use crate::support::{seed_sample as seed_support, support as support_screen, SupportState};
use crate::theme::{Appearance, Theme};
use crate::therapie::{seed_sample as seed_therapie, therapie as therapie_screen, TherapieState};
use crate::tokens::{preset_ids, AccentPreset, FONT_SMALL, FONT_TITLE};
use crate::users::{users, UsersState};
use socdof_core::store::Store;

/// How long a toast stays visible in the gallery.
const TOAST_TTL_MS: i64 = 4_000;

/// Loads the UI catalogue for a language, overlaying external packs from `SOCDOF_UI_PACKS` when the
/// host points that variable at a folder of `*.json` packs.
fn load_texts(language: Language) -> CoreResult<UiTexts> {
    match std::env::var("SOCDOF_UI_PACKS") {
        Ok(directory) if !directory.trim().is_empty() => UiTexts::with_packs(language, directory),
        _ => UiTexts::embedded(language),
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
        _ => return None,
    })
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

        state
            .desktop_windows
            .open(Window::new(app, title, rect), now);
        if saved.maximized {
            state.desktop_windows.toggle_maximize(app, area);
        }
        if saved.minimized {
            state.desktop_windows.minimize(app);
        }
    }
}

/// Trims the desktop to the layout template chosen in the wizard.
fn apply_setup_template(state: &mut GalleryState) {
    let apps: &[&str] = match state.auth.template_choice {
        SetupTemplate::Sales => &[
            "dashboard",
            "pos",
            "invoices",
            "products",
            "reports",
            "settings",
        ],
        SetupTemplate::Office => &[
            "dashboard",
            "contacts",
            "calendar",
            "support",
            "editor",
            "settings",
        ],
        SetupTemplate::All => return,
    };
    state.desktop_icons.retain_apps(apps);
}

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
    /// Menu state of the actions menu.
    pub menu_popup: PopupState,
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
    /// Whether the editor screen is shown instead of the gallery.
    pub editor_open: bool,
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
        let texts = load_texts(language)?;
        let form = FormState::new(vec![
            Field::new(texts.get("field_company"), texts.get("field_company_hint"))
                .required()
                .max_len(80),
            Field::new(texts.get("field_email"), texts.get("field_email_hint"))
                .required()
                .email(),
        ]);

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
            settings_state.refresh(&store)?;
        }
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
            menu_popup: PopupState::default(),
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
            desktop_windows: WindowManager::default(),
            shell: ShellState::new(),
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
        let texts = load_texts(language)?;
        self.language = language;
        let labels = [
            (texts.get("field_company"), texts.get("field_company_hint")),
            (texts.get("field_email"), texts.get("field_email_hint")),
        ];
        self.form.relabel(&labels);
        self.desktop_icons.relabel(|app| app_label(&texts, app));
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
                self.settings.refresh(&self.store)?;
                self.settings_open = true;
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
        Ok(())
    }
}

/// Handles the documented application-wide keyboard shortcuts for the native desktop.
///
/// The shortcuts are consumed here rather than by individual app screens, so they behave the
/// same regardless of which module window currently owns keyboard focus.
fn handle_global_shortcuts(ctx: &Context, state: &mut GalleryState, now: i64) {
    let (fullscreen, palette, lock, escape) = ctx.input_mut(|input| {
        (
            input.consume_key(Modifiers::NONE, Key::F11),
            input.consume_key(Modifiers::CTRL, Key::K),
            input.consume_key(Modifiers::CTRL, Key::L),
            input.consume_key(Modifiers::NONE, Key::Escape),
        )
    });

    let desktop_ready = !state.auth_open && state.auth.view == crate::auth::AuthView::Unlocked;
    if fullscreen && desktop_ready {
        let current = ctx.input(|input| input.viewport().fullscreen.unwrap_or(false));
        ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(!current));
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
    if escape && desktop_ready {
        if state.shell.overlay_open() {
            state.shell.close_overlays();
        } else if let Some(active) = state.desktop_windows.active() {
            // Escape closes only the focused module window; other workspace windows remain open.
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
        if let Some(accent) = state.auth.accent_choice.take() {
            state.accent_id = accent;
        }
        if let Some(wallpaper) = state.auth.wallpaper_choice.take() {
            state.shell.wallpaper.wallpaper = wallpaper;
        }
        if let Some(mut custom) = state.auth.wallpaper_custom.take() {
            custom.revision = now as u64;
            state.shell.wallpaper.custom = Some(custom);
        }
        let wizard_completed = state.auth.take_wizard_completed();
        if wizard_completed {
            apply_setup_template(state);
        }
        let mut startup_module = None;
        if !was_unlocked && state.auth.view == crate::auth::AuthView::Unlocked {
            if let Some(user_id) = state.auth.user.as_ref().map(|user| user.id) {
                let preferences = if wizard_completed {
                    Preferences {
                        language: state.language,
                        theme_mode: if state.appearance.is_dark() {
                            ThemeMode::Dark
                        } else {
                            ThemeMode::Light
                        },
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
                } else {
                    let _ = state.set_language(preferences.language);
                    state.appearance = match preferences.theme_mode {
                        ThemeMode::Dark => Appearance::Dark,
                        ThemeMode::Light => Appearance::Light,
                        ThemeMode::System => state.appearance,
                    };
                    state.accent_id = preferences.accent_color;
                    startup_module = startup_app(&preferences.startup_module);
                }
            }
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
                    restore_native_windows(state, &layout, ctx.screen_rect(), now);
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
        if state.auth.back && state.auth.allow_exit {
            state.auth_open = false;
            state.auth.back = false;
        }
        state.focus.finish_frame();
        return;
    }

    if state.desktop_open {
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
            &mut state.desktop_icons,
            &mut state.desktop_windows,
            now,
            |app, active, ui, ctx, theme, texts, focus, store, now| match app.as_str() {
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
                "editor" => {
                    crate::editor::editor_window(
                        ctx,
                        active,
                        ui,
                        theme,
                        texts,
                        focus,
                        &mut state.editor,
                        store,
                        now,
                    );
                    let back = state.editor.back;
                    state.editor.back = false;
                    back
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
        if outcome.icon_positions_changed || outcome.window_layout_changed {
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
                            for slug in [
                                "contacts",
                                "invoices",
                                "settings",
                                "accounting",
                                "pos",
                                "therapy",
                                "users",
                            ] {
                                let saved =
                                    layout.window_states.entry(slug.to_string()).or_default();
                                saved.open = false;
                                saved.minimized = false;
                            }
                            for (z_order, window) in
                                state.desktop_windows.windows().iter().enumerate()
                            {
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
                                    },
                                );
                            }
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
                    ui.horizontal(|ui| {
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
                            let keys =
                                ["menu_open", "menu_duplicate", "menu_archive", "menu_delete"];
                            let key = keys.get(index).copied().unwrap_or("menu_open");
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
                    drop_zone(
                        ui,
                        &theme,
                        &mut state.focus,
                        texts.get("drop_hint"),
                        state.drop_hovering,
                    );
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
    fn global_command_palette_shortcut_works_from_the_native_desktop() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
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
        assert!(painted.contains("Buchhaltung"), "modules missing");
        assert_eq!(
            state.desktop_icons.icons().len(),
            socdof_core::domain::permission::ALL_MODULES
                .iter()
                .filter(|module| !matches!(
                    module,
                    socdof_core::domain::permission::AppModule::Documentation
                ))
                .count()
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
    fn desktop_restores_only_previously_open_native_windows() {
        let mut state =
            GalleryState::new(Language::De, Appearance::Light, "indigo").expect("state");
        state.desktop_icons = desktop_icons(
            &state.texts,
            &socdof_core::domain::permission::ALL_MODULES,
        );
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
            },
        );
        for (slug, z_order) in [("accounting", 0), ("pos", 3), ("therapy", 4), ("users", 5)] {
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
    fn escape_in_the_active_module_window_does_not_close_other_modules() {
        let ctx = crate::theme::headless_context();
        let mut state = GalleryState::new(Language::En, Appearance::Dark, "indigo").expect("state");
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Unlocked;
        state.desktop_open = true;
        let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0));

        for (index, slug) in ["projects", "fleet"].into_iter().enumerate() {
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
            Some(AppId::new("fleet")),
            "the last opened module should own keyboard focus"
        );

        let initial = egui::RawInput {
            screen_rect: Some(screen),
            ..Default::default()
        };
        let _ = ctx.run(initial, |ctx| gallery(ctx, &mut state));
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
        state.auth_open = false;
        state.auth.view = crate::auth::AuthView::Login;
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
}
