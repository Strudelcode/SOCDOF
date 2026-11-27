//! SOCDOF in the browser.
//!
//! This crate is the web (WebAssembly) host of the Rust interface. `eframe` paints the egui screens
//! into a canvas and `socdof-core` opens its SQLite store through `sqlite-wasm-rs`, so sign-in,
//! first-run setup, user management and every module run the same code as the desktop build. There
//! is no second UI implementation and no JavaScript screen: the browser only supplies the canvas,
//! the clock and the random numbers.
//!
//! The host is limited to the `wasm32-unknown-unknown` target. A native build compiles an empty
//! crate, which keeps the desktop workspace free of browser dependencies.
//!
//! Build and run it with Trunk from this directory:
//!
//! ```text
//! trunk serve --address 0.0.0.0 --port 3000
//! ```

#![cfg(target_arch = "wasm32")]
#![deny(missing_docs)]

mod storage;

use eframe::egui::{self, Align2, Context, Id, RichText};
use socdof_core::app_store;
use socdof_core::domain::permission::{AppModule, PermissionLevel, ALL_MODULES};
use socdof_core::domain::settings::{Language, ThemeMode};
use socdof_core::settings_service::{self, Preferences};
use socdof_core::store::Store;
use socdof_core::{now_millis, CoreResult};
use socdof_ui::accounting::{accounting, AccountingState};
use socdof_ui::app_store::{app_store, AppStoreState};
use socdof_ui::appointments::{
    appointments, AppointmentsDetail, AppointmentsState, AppointmentsView,
};
use socdof_ui::auth::{auth, AuthState, AuthView, SetupTemplate};
use socdof_ui::auth_screens::{module_visible_for, template_apps_for};
use socdof_ui::calculator::{calculator_window, CalculatorWindow};
use socdof_ui::chrome::{app_chrome, app_title, app_window};
use socdof_ui::components::{button, ButtonVariant};
use socdof_ui::contacts::{contacts, ContactsState};
use socdof_ui::dashboard::{dashboard, DashboardAction, DashboardData, DashboardState};
use socdof_ui::desktop::{
    desktop, AppId, ClockSettings, DesktopFrame, DesktopIcon, IconGrid, WindowManager,
    TASKBAR_HEIGHT,
};
use socdof_ui::documentation::{documentation, DocumentationState};
use socdof_ui::editor::{editor, EditorState};
use socdof_ui::fleet::{fleet, FleetState};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::{load_texts, UiTexts};
use socdof_ui::invoices::{invoices, InvoicesState};
use socdof_ui::pos::{pos, PosState};
use socdof_ui::products::{products, ProductsState};
use socdof_ui::projects::{projects, ProjectsState};
use socdof_ui::purchases::{purchases, PurchasesState};
use socdof_ui::reports::{reports, ReportsState};
use socdof_ui::restaurant::{restaurant, RestaurantState};
use socdof_ui::settings::{settings, SettingsState};
use socdof_ui::shell::{Onboarding, ShellState};
use socdof_ui::support::{support, SupportState};
use socdof_ui::theme::{Appearance, Theme};
use socdof_ui::therapie::{therapie, TherapieState};
use socdof_ui::tokens::FONT_SMALL;
use socdof_ui::users::{users, UsersState};
use socdof_ui::widgets::widgets_app;
use wasm_bindgen::JsCast;

/// Accent of the first start; the appearance settings change it later.
const DEFAULT_ACCENT: &str = "indigo";

/// The browser application: one store, one session and the desktop with every module.
struct WebApp {
    /// SQLite store of this browser tab.
    store: Store,
    /// Translations of the active language.
    texts: UiTexts,
    /// Light or dark appearance.
    appearance: Appearance,
    /// Accent preset id.
    accent_id: String,
    /// Keyboard focus of the current screen.
    focus: FocusState,
    /// Login, first-run setup and lock screen.
    auth: AuthState,
    /// Desktop icon grid.
    icons: IconGrid,
    /// Open windows of the desktop.
    windows: WindowManager,
    /// Taskbar, start menu, palette, tray and wallpapers.
    shell: ShellState,
    /// Module screen that is open instead of the desktop.
    open: Option<AppId>,
    /// Dashboard, loaded from the store when the screen opens.
    dashboard: Option<DashboardState>,
    /// Contacts module.
    contacts: ContactsState,
    /// Products module.
    products: ProductsState,
    /// Invoices module.
    invoices: InvoicesState,
    /// Accounting module.
    accounting: AccountingState,
    /// Purchases module.
    purchases: PurchasesState,
    /// Point of sale module.
    pos: PosState,
    /// Calendar module.
    appointments: AppointmentsState,
    /// Settings module.
    settings: SettingsState,
    /// User management module.
    users: UsersState,
    /// Document editor module.
    editor: EditorState,
    /// App Store module.
    app_store: AppStoreState,
    /// Support module.
    support: SupportState,
    /// Reports module.
    reports: ReportsState,
    /// Therapy module.
    therapie: TherapieState,
    /// Projects module.
    projects: ProjectsState,
    /// Fleet module.
    fleet: FleetState,
    /// Restaurant module.
    restaurant: RestaurantState,
    /// Documentation module.
    documentation: DocumentationState,
    /// Desktop calculator utility.
    calculator: CalculatorWindow,
    /// Catalogue key of a startup failure.
    error: Option<&'static str>,
    /// IndexedDB handle that keeps the database image of this browser.
    storage: storage::Storage,
    /// Whether the stored database has been applied; the app starts on a loading screen.
    loaded: bool,
    /// Bytes of the last successful save, used to detect changes.
    last_saved: Vec<u8>,
    /// Last change check, in milliseconds.
    last_check: i64,
    /// Whether the stored image could not be applied and must not be replaced.
    protect_snapshot: bool,
}

impl WebApp {
    /// Builds the application for the given browser session.
    fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let language = browser_language();
        let texts = UiTexts::embedded(language).expect("embedded UI catalogue");
        let store = Store::open_in_memory().expect("in-memory SQLite store");
        let now = now_millis();
        let auth = AuthState::new(&store, now).expect("authentication state");
        let active = app_store::active_modules(&store).unwrap_or_else(|_| ALL_MODULES.to_vec());
        let mut shell = ShellState::new();
        // The onboarding wizard is replayable from the component gallery; the browser host starts on
        // the desktop so the first screen is the same as in the desktop build.
        shell.onboarding = Onboarding::restore(true);
        let icons = desktop_icons(&texts, &active);
        Self {
            store,
            texts,
            // The reference desktop opens in the dark theme. eframe's browser default visuals are
            // light, so the host starts dark and lets a stored preference replace it once the
            // snapshot has been read.
            appearance: Appearance::Dark,
            accent_id: DEFAULT_ACCENT.to_string(),
            focus: FocusState::default(),
            auth,
            icons,
            windows: WindowManager::default(),
            shell,
            open: None,
            dashboard: None,
            contacts: ContactsState::new(),
            products: ProductsState::new(),
            invoices: InvoicesState::new(),
            accounting: AccountingState::new(),
            purchases: PurchasesState::new(),
            pos: PosState::new(),
            appointments: AppointmentsState::new(),
            settings: SettingsState::new(),
            users: UsersState::new(),
            editor: EditorState::new(),
            app_store: AppStoreState::new(),
            support: SupportState::new(),
            reports: ReportsState::new(),
            therapie: TherapieState::new(),
            projects: ProjectsState::new(),
            fleet: FleetState::new(),
            restaurant: RestaurantState::new(),
            documentation: DocumentationState::default(),
            calculator: CalculatorWindow::new(),
            error: None,
            storage: storage::Storage::start(),
            loaded: false,
            last_saved: Vec::new(),
            last_check: 0,
            protect_snapshot: false,
        }
    }

    /// Applies the stored database once IndexedDB answered.
    ///
    /// Returns `false` while the read is still running; the caller then shows the loading hint. A
    /// browser without storage (or with a corrupted snapshot) keeps working in memory and reports
    /// it through the error line, so the user is never silently left without persistence.
    fn load_snapshot(&mut self) -> bool {
        let result = match self.storage.take_load() {
            Some(result) => result,
            None => return false,
        };
        self.loaded = true;
        match result {
            Ok(Some(bytes)) => {
                if self.store.restore_snapshot(&bytes).is_err() {
                    self.error = Some("web_storage_error");
                    self.store = Store::open_in_memory().expect("in-memory SQLite store");
                    // The stored image is still the user's data: the empty stand-in must never be
                    // written over it, otherwise a failed read would destroy the database.
                    self.protect_snapshot = true;
                }
            }
            Ok(None) => {}
            Err(()) => {
                self.error = Some("web_storage_error");
                self.protect_snapshot = true;
            }
        }
        if !self.storage.is_writable() {
            self.error = Some("web_storage_error");
        }
        // A restored database carries other accounts, roles and settings than the empty one.
        let now = now_millis();
        if let Ok(auth) = AuthState::new(&self.store, now) {
            self.auth = auth;
        }
        if let Ok(profile) = self.store.company_profile() {
            let clock = ClockSettings::from_profile(&profile);
            self.auth.clock = clock.clone();
            self.shell.clock = clock;
        }
        if let Ok(pref) = settings_service::desktop_wallpaper(&self.store) {
            self.shell.wallpaper.apply_preference(&pref, 1);
        }
        if self.signed_in() {
            self.apply_user_session(now, false, None, false);
        } else {
            self.sync_module_navigation();
        }
        true
    }

    /// Switches the browser interface language while relabeling desktop icons and windows.
    fn set_language(&mut self, language: Language) {
        if let Ok(texts) = load_texts(language, &self.store) {
            self.icons
                .relabel(|app| app_title(&texts, app_chrome(app.as_str())));
            self.windows
                .relabel_titles(|app| app_title(&texts, app_chrome(app.as_str())));
            self.texts = texts;
        }
    }

    /// Rebuilds the active module list filtered by user permissions and reloads desktop icons.
    fn sync_module_navigation(&mut self) {
        let mut active = self.active_modules();
        if let Some(user) = self.auth.user.as_ref() {
            active.retain(|module| {
                self.store
                    .user_allows(user, *module, PermissionLevel::View)
                    .unwrap_or(false)
            });
        }
        self.icons = desktop_icons(&self.texts, &active);
    }

    /// Loads or saves per-user preferences, wallpaper and desktop layout after authentication.
    fn apply_user_session(
        &mut self,
        now: i64,
        wizard_completed: bool,
        wizard_theme: Option<ThemeMode>,
        wallpaper_changed: bool,
    ) {
        let Some(user_id) = self.auth.user.as_ref().map(|user| user.id) else {
            return;
        };
        let mut startup_module = None;
        if wizard_completed {
            let preferences = Preferences {
                language: self.texts.language(),
                theme_mode: wizard_theme.unwrap_or(if self.appearance.is_dark() {
                    ThemeMode::Dark
                } else {
                    ThemeMode::Light
                }),
                accent_color: self.accent_id.clone(),
                ..Preferences::default()
            };
            let _ = settings_service::save_preferences(&self.store, user_id, &preferences);
            let _ = settings_service::save_wallpaper(
                &self.store,
                Some(user_id),
                &self.shell.wallpaper.to_preference(),
            );
        } else {
            if wallpaper_changed {
                let _ = settings_service::save_wallpaper(
                    &self.store,
                    Some(user_id),
                    &self.shell.wallpaper.to_preference(),
                );
            } else if let Ok(pref) = settings_service::user_wallpaper(&self.store, user_id) {
                self.shell
                    .wallpaper
                    .apply_preference(&pref, now.max(1) as u64);
            }
            if let Ok(preferences) = settings_service::preferences(&self.store, user_id) {
                self.set_language(preferences.language);
                self.appearance = match preferences.theme_mode {
                    ThemeMode::Dark => Appearance::Dark,
                    ThemeMode::Light => Appearance::Light,
                    ThemeMode::System => self.appearance,
                };
                self.accent_id = preferences.accent_color;
                if !preferences.startup_module.is_empty() {
                    startup_module = Some(preferences.startup_module);
                }
            }
        }
        self.sync_module_navigation();
        if let Some(slug) = startup_module {
            if let Some(app) = startup_app_id(&slug) {
                if self.icons.index_of(app).is_some() {
                    let _ = self.open_screen(app, now);
                }
            }
        }
    }

    /// Draws the hint that is shown while the stored database is read.
    fn render_loading(&self, ctx: &Context) {
        let text = self.texts.get("web_storage_loading").to_owned();
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.centered_and_justified(|ui| {
                ui.label(RichText::new(text).size(FONT_SMALL));
            });
        });
    }

    /// Writes the database image to IndexedDB when it changed.
    ///
    /// `user_acted` is set on frames that handled a press, a key or text: those are written right
    /// away, because the browser can hide or unload the tab before the debounce expires and the
    /// last change (a created account, for example) would be lost.
    fn persist(&mut self, now: i64, user_acted: bool) {
        if !self.loaded || self.protect_snapshot {
            return;
        }
        if !socdof_core::store::snapshot_due(now, self.last_check, user_acted) {
            return;
        }
        self.last_check = now;
        let Ok(bytes) = self.store.snapshot_bytes() else {
            return;
        };
        if bytes != self.last_saved {
            self.storage.save(&bytes);
            self.last_saved = bytes;
        }
    }

    /// Whether a session is signed in and therefore the desktop is shown.
    fn signed_in(&self) -> bool {
        self.auth.view == AuthView::Unlocked && self.auth.user.is_some()
    }

    /// Loads the dashboard figures from the live store.
    fn load_dashboard(&self, now: i64) -> CoreResult<DashboardData> {
        let (company, counts, entries, low_stock) = self.store.dashboard_snapshot(now)?;
        Ok(DashboardData::new(company, counts, entries, low_stock))
    }

    /// Opens a module screen and reloads its state from the store.
    fn open_screen(&mut self, app: AppId, now: i64) -> CoreResult<()> {
        match app.as_str() {
            "dashboard" => {
                let data = self.load_dashboard(now)?;
                let mut state = DashboardState::new(data);
                state.set_active_modules(self.active_modules());
                self.dashboard = Some(state);
            }
            "contacts" => self.contacts.refresh(&self.store)?,
            "products" => self.products.refresh(&self.store)?,
            "invoices" => self.invoices.refresh(&self.store)?,
            "accounting" => self.accounting.refresh(&self.store, now)?,
            "purchases" => self.purchases.refresh(&self.store)?,
            "pos" => self.pos.refresh(&self.store)?,
            "calendar" => {
                self.appointments.refresh(&self.store)?;
                self.appointments.screen = AppointmentsDetail::Calendar;
                self.appointments.view = AppointmentsView::Month;
            }
            "settings" => {
                self.settings.reset_for_open();
                self.settings
                    .set_active_user(self.auth.user.as_ref().map(|user| user.id));
                self.settings.refresh(&self.store)?;
            }
            "users" => self.users.refresh(&self.store)?,
            "editor" => self.editor.reset_for_open(&self.store)?,
            "app-store" => self.app_store.reset_for_open(&self.store)?,
            "support" => self.support.reset_for_open(&self.store)?,
            "reports" => self.reports.reset_for_open(&self.store, now)?,
            "therapy" => self.therapie.reset_for_open(&self.store)?,
            "projects" => self.projects.reset_for_open(&self.store)?,
            "fleet" => self.fleet.reset_for_open(&self.store)?,
            "restaurant" => self.restaurant.reset_for_open(&self.store)?,
            "documentation" => self.documentation.back = false,
            "calculator" | "widgets" => {}
            _ => return Ok(()),
        }
        self.open = Some(app);
        Ok(())
    }

    /// Enabled modules of the App Store catalogue.
    fn active_modules(&self) -> Vec<AppModule> {
        app_store::active_modules(&self.store).unwrap_or_else(|_| ALL_MODULES.to_vec())
    }

    /// Leaves the module screen and closes its desktop window.
    fn leave_screen(&mut self, now: i64) {
        if let Some(app) = self.open.take() {
            self.windows.close(app, now);
            // The App Store changes which modules are enabled. The launcher grid is built once at
            // start-up, so it has to be rebuilt here — otherwise a freshly activated module keeps
            // its missing tile until the host restarts.
            if app.as_str() == "app-store" {
                self.sync_module_navigation();
            }
        }
    }

    /// Runs a quick action of the dashboard.
    fn run_dashboard_action(&mut self, action: DashboardAction, now: i64) {
        let result = match action {
            DashboardAction::NewContact => {
                let result = self.open_screen(AppId::new("contacts"), now);
                self.contacts.start_new();
                result
            }
            DashboardAction::NewProduct => {
                let result = self.open_screen(AppId::new("products"), now);
                self.products.start_new();
                result
            }
            DashboardAction::NewInvoice => {
                let result = self.open_screen(AppId::new("invoices"), now);
                self.invoices.start_new(now);
                result
            }
            DashboardAction::OpenAccounting => self.open_screen(AppId::new("accounting"), now),
            DashboardAction::OpenPurchases => self.open_screen(AppId::new("purchases"), now),
            DashboardAction::OpenPos => self.open_screen(AppId::new("pos"), now),
            DashboardAction::OpenCalendar => self.open_screen(AppId::new("calendar"), now),
            DashboardAction::OpenSettings => self.open_screen(AppId::new("settings"), now),
            DashboardAction::ManageUsers => self.open_screen(AppId::new("users"), now),
            DashboardAction::OpenEditor => self.open_screen(AppId::new("editor"), now),
            DashboardAction::OpenAppStore => self.open_screen(AppId::new("app-store"), now),
            DashboardAction::LockSession => {
                self.auth.lock(now);
                self.leave_screen(now);
                Ok(())
            }
        };
        if result.is_err() {
            self.error = Some("auth_error_storage");
        }
    }

    /// Draws the module screen that is open instead of the desktop.
    fn render_screen(&mut self, ctx: &Context, theme: &Theme, texts: &UiTexts, now: i64) {
        let Some(app) = self.open.clone() else {
            return;
        };
        match app.as_str() {
            "dashboard" => {
                let (closed, back, pending) = match self.dashboard.as_mut() {
                    Some(state) => {
                        let action = app_window(
                            ctx,
                            theme,
                            texts,
                            &mut self.focus,
                            app_chrome("dashboard"),
                            |focus| dashboard(ctx, theme, texts, focus, state, now),
                        );
                        (
                            action.close || action.minimize,
                            std::mem::take(&mut state.back),
                            state.take_action(),
                        )
                    }
                    None => (true, false, None),
                };
                if closed || back {
                    self.leave_screen(now);
                    return;
                }
                if let Some(action) = pending {
                    self.run_dashboard_action(action, now);
                }
            }
            "contacts" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("contacts"),
                    |focus| {
                        contacts(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.contacts,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.contacts.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "products" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("products"),
                    |focus| {
                        products(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.products,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.products.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "invoices" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("invoices"),
                    |focus| {
                        invoices(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.invoices,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.invoices.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "accounting" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("accounting"),
                    |focus| {
                        accounting(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.accounting,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.accounting.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "purchases" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("purchases"),
                    |focus| {
                        purchases(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.purchases,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.purchases.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "pos" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("pos"),
                    |focus| pos(ctx, theme, texts, focus, &mut self.pos, &self.store, now),
                );
                let back = std::mem::take(&mut self.pos.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "calendar" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("calendar"),
                    |focus| {
                        appointments(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.appointments,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.appointments.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "settings" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("settings"),
                    |focus| {
                        settings(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.settings,
                            &self.store,
                            now,
                        )
                    },
                );
                if let Some(preferences) = self.settings.take_saved_preferences() {
                    self.set_language(preferences.language);
                    self.appearance = match preferences.theme_mode {
                        ThemeMode::Dark => Appearance::Dark,
                        ThemeMode::Light => Appearance::Light,
                        ThemeMode::System => self.appearance,
                    };
                    self.accent_id = preferences.accent_color;
                }
                if self.settings.take_language_pack_changed() {
                    self.set_language(self.texts.language());
                }
                let back = std::mem::take(&mut self.settings.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "users" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("users"),
                    |focus| users(ctx, theme, texts, focus, &mut self.users, &self.store, now),
                );
                let back = std::mem::take(&mut self.users.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "editor" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("editor"),
                    |focus| editor(ctx, theme, texts, focus, &mut self.editor, &self.store, now),
                );
                let back = std::mem::take(&mut self.editor.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "projects" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("projects"),
                    |focus| {
                        projects(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.projects,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.projects.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "fleet" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("fleet"),
                    |focus| fleet(ctx, theme, texts, focus, &mut self.fleet, &self.store, now),
                );
                let back = std::mem::take(&mut self.fleet.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "restaurant" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("restaurant"),
                    |focus| {
                        restaurant(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.restaurant,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.restaurant.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "documentation" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("documentation"),
                    |focus| documentation(ctx, theme, texts, focus, &mut self.documentation),
                );
                let back = std::mem::take(&mut self.documentation.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "app-store" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("app-store"),
                    |focus| app_store(ctx, theme, texts, focus, &mut self.app_store, &self.store),
                );
                let back = std::mem::take(&mut self.app_store.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "support" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("support"),
                    |focus| {
                        support(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.support,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.support.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "reports" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("reports"),
                    |focus| {
                        reports(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.reports,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.reports.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "therapy" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("therapy"),
                    |focus| {
                        therapie(
                            ctx,
                            theme,
                            texts,
                            focus,
                            &mut self.therapie,
                            &self.store,
                            now,
                        )
                    },
                );
                let back = std::mem::take(&mut self.therapie.back);
                if action.close || action.minimize || back {
                    self.leave_screen(now);
                }
            }
            "calculator" => {
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("calculator"),
                    |focus| {
                        egui::CentralPanel::default()
                            .frame(egui::Frame::none().fill(theme.palette.background))
                            .show(ctx, |ui| {
                                calculator_window(
                                    ctx,
                                    true,
                                    ui,
                                    theme,
                                    texts,
                                    focus,
                                    &mut self.calculator,
                                );
                            });
                    },
                );
                if action.close || action.minimize {
                    self.leave_screen(now);
                }
            }
            "widgets" => {
                let mut widget_layer = self.shell.widgets.clone();
                let action = app_window(
                    ctx,
                    theme,
                    texts,
                    &mut self.focus,
                    app_chrome("widgets"),
                    |focus| {
                        egui::CentralPanel::default()
                            .frame(egui::Frame::none().fill(theme.palette.background))
                            .show(ctx, |ui| {
                                widgets_app(ui, theme, texts, focus, &mut widget_layer, now);
                            });
                    },
                );
                self.shell.widgets = widget_layer;
                if action.close || action.minimize {
                    self.leave_screen(now);
                }
            }
            _ => self.leave_screen(now),
        }
    }

    /// Draws the desktop and handles the app that was launched from it.
    fn render_desktop(&mut self, ctx: &Context, theme: &Theme, texts: &UiTexts, now: i64) {
        if let Ok(profile) = self.store.company_profile() {
            self.shell.clock = ClockSettings::from_profile(&profile);
        }
        let outcome = desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut self.shell,
                store: &self.store,
                current_user: self.auth.user.as_ref().map(|user| user.id),
            },
            &mut self.focus,
            &mut self.icons,
            &mut self.windows,
            now,
        );
        if outcome.lock {
            self.auth.lock(now);
        }
        if outcome.sign_out {
            let _ = self.auth.sign_out(&self.store, now);
        }
        if let Some(username) = outcome.switch_account.clone() {
            self.auth.begin_switch(&username);
        }
        if outcome.toggle_theme {
            self.appearance = if self.appearance.is_dark() {
                Appearance::Light
            } else {
                Appearance::Dark
            };
            if let Some(user_id) = self.auth.user.as_ref().map(|user| user.id) {
                if let Ok(mut preferences) = settings_service::preferences(&self.store, user_id) {
                    preferences.theme_mode = if self.appearance.is_dark() {
                        ThemeMode::Dark
                    } else {
                        ThemeMode::Light
                    };
                    let _ = settings_service::save_preferences(&self.store, user_id, &preferences);
                }
            }
        }
        if let Some(app) = outcome.open_app {
            if self.open_screen(app, now).is_err() {
                self.error = Some("auth_error_storage");
            }
        }
        // The browser host draws every module as a full screen, so the desktop never needs its own
        // windows. Left in the manager they would linger as empty frames that only show the desktop
        // hint once the screen closes.
        self.windows = WindowManager::default();
    }

    /// Draws the session chip with the signed-in account and the sign-out action.
    fn account_chip(&mut self, ctx: &Context, theme: &Theme, texts: &UiTexts, now: i64) {
        let Some(user) = self.auth.user.clone() else {
            return;
        };
        let mut sign_out = false;
        egui::Area::new(Id::new("socdof-web-account"))
            // Directly above the taskbar in the free right-hand area. The icon grid reserves the
            // same band (`desktop::SESSION_CHIP_BAND`), so the chip never covers icon labels.
            .anchor(
                Align2::RIGHT_BOTTOM,
                egui::vec2(-18.0, -(TASKBAR_HEIGHT + 8.0)),
            )
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                egui::Frame::none()
                    .fill(theme.palette.surface)
                    .rounding(egui::Rounding::same(14.0))
                    .stroke(egui::Stroke::new(1.0_f32, theme.palette.border))
                    .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(&user.display_name)
                                    .size(FONT_SMALL)
                                    .strong()
                                    .color(theme.palette.text),
                            );
                            ui.label(
                                RichText::new(format!("@{}", user.username))
                                    .size(FONT_SMALL)
                                    .color(theme.palette.text_muted),
                            );
                            if button(
                                ui,
                                theme,
                                &mut self.focus,
                                texts.get("auth_sign_out"),
                                ButtonVariant::Secondary,
                            )
                            .activated
                            {
                                sign_out = true;
                            }
                        });
                    });
            });
        if sign_out {
            let _ = self.auth.sign_out(&self.store, now);
            self.open = None;
            self.dashboard = None;
            self.windows = WindowManager::default();
            self.shell = ShellState::new();
            self.shell.onboarding = Onboarding::restore(true);
        }
    }
}

impl eframe::App for WebApp {
    fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        // Keeps the backing store on the CSS box, so painting and pointer positions stay on one
        // grid after the panel or the browser window changed size.
        sync_canvas_size();
        self.focus.begin_frame(ctx);
        // The browser reads the stored database asynchronously, therefore the first frames are a hint.
        if !self.loaded && !self.load_snapshot() {
            let theme = Theme::new(self.appearance, &self.accent_id);
            theme.apply(ctx);
            self.render_loading(ctx);
            self.focus.finish_frame();
            ctx.request_repaint_after(std::time::Duration::from_millis(50));
            return;
        }
        let theme = Theme::new(self.appearance, &self.accent_id);
        theme.apply(ctx);
        let texts = self.texts.clone();
        let now = now_millis();
        // Keep frames coming so the debounced save runs without further user input.
        ctx.request_repaint_after(std::time::Duration::from_millis(400));

        if self.signed_in() {
            if ctx.input(|input| !input.events.is_empty()) {
                self.auth.note_activity(now);
            }
            self.auth.tick(now);
        }

        if !self.signed_in() {
            if let Ok(profile) = self.store.company_profile() {
                self.auth.clock = ClockSettings::from_profile(&profile);
            }
            auth(
                ctx,
                &theme,
                &texts,
                &mut self.focus,
                &mut self.auth,
                &self.store,
                now,
            );
            if let Some(language) = self.auth.language_choice.take() {
                if language != self.texts.language() {
                    self.set_language(language);
                }
            }
            if let Some(appearance) = self.auth.appearance_choice.take() {
                self.appearance = appearance;
            }
            let wizard_theme = self.auth.theme_mode_choice;
            if let Some(mode) = wizard_theme {
                self.appearance = match mode {
                    ThemeMode::Light => Appearance::Light,
                    ThemeMode::Dark => Appearance::Dark,
                    ThemeMode::System => self.appearance,
                };
            }
            if let Some(accent) = self.auth.accent_choice.take() {
                self.accent_id = accent;
            }
            let mut wallpaper_changed = false;
            if let Some(wallpaper) = self.auth.wallpaper_choice.take() {
                self.shell.wallpaper.wallpaper = wallpaper;
                self.shell.wallpaper.custom = None;
                wallpaper_changed = true;
            }
            if let Some(mut custom) = self.auth.wallpaper_custom.take() {
                custom.revision = now.max(1) as u64;
                self.shell.wallpaper.custom = Some(custom);
                wallpaper_changed = true;
            }
            let wizard_completed = self.auth.take_wizard_completed();
            if wizard_completed {
                let selected = resolve_web_setup_apps(&self.auth);
                if !selected.is_empty() {
                    let _ = app_store::apply_selection(&self.store, &selected);
                }
            }
            if self.signed_in() {
                self.apply_user_session(now, wizard_completed, wizard_theme, wallpaper_changed);
            } else if wallpaper_changed {
                let _ = settings_service::save_wallpaper(
                    &self.store,
                    None,
                    &self.shell.wallpaper.to_preference(),
                );
            }
            if let Some(key) = self.error {
                egui::TopBottomPanel::bottom("socdof-web-error").show(ctx, |ui| {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .color(theme.palette.danger),
                    );
                });
            }
        } else if self.open.is_some() {
            self.render_screen(ctx, &theme, &texts, now);
        } else {
            self.render_desktop(ctx, &theme, &texts, now);
            self.account_chip(ctx, &theme, &texts, now);
        }
        self.focus.finish_frame();
        let user_acted = ctx.input(|input| {
            input.events.iter().any(|event| {
                matches!(
                    event,
                    egui::Event::Text(_)
                        | egui::Event::Key { pressed: true, .. }
                        | egui::Event::PointerButton { .. }
                )
            })
        });
        self.persist(now, user_acted);
    }
}

/// Resolves setup wizard modules with required modules intact.
fn resolve_web_setup_apps(auth: &AuthState) -> Vec<String> {
    let mut apps: Vec<String> = if auth.setup_apps.is_empty() {
        template_apps_for(auth.template_choice, auth.account_type)
            .into_iter()
            .map(str::to_owned)
            .collect()
    } else {
        auth.setup_apps
            .iter()
            .filter(|slug| module_visible_for(auth.account_type, slug))
            .cloned()
            .collect()
    };
    if apps.is_empty() && auth.template_choice != SetupTemplate::All {
        return Vec::new();
    }
    if auth.template_choice == SetupTemplate::All && apps.is_empty() {
        apps = ALL_MODULES
            .iter()
            .map(|module| module.as_str().to_owned())
            .filter(|slug| module_visible_for(auth.account_type, slug))
            .collect();
    }
    for required in ["dashboard", "settings", "users"] {
        if !apps.iter().any(|slug| slug == required) {
            apps.push(required.to_owned());
        }
    }
    apps
}

/// Resolves a stored startup module slug into an `AppId`.
fn startup_app_id(slug: &str) -> Option<AppId> {
    Some(match slug {
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

/// Desktop and start-menu icons of the modules that are currently enabled.
fn desktop_icons(texts: &UiTexts, active: &[AppModule]) -> IconGrid {
    let mut icons = Vec::new();
    for (module, slug) in [
        (AppModule::Dashboard, "dashboard"),
        (AppModule::Contacts, "contacts"),
        (AppModule::Products, "products"),
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
        (AppModule::Projects, "projects"),
        (AppModule::Fleet, "fleet"),
        (AppModule::Restaurant, "restaurant"),
        (AppModule::Documentation, "documentation"),
    ] {
        if !active.contains(&module) {
            continue;
        }
        let app = app_chrome(slug);
        icons.push(DesktopIcon::new(
            AppId::new(app.slug),
            texts.get(app.title_key),
            app.icon,
        ));
    }
    for slug in ["app-store", "calculator", "widgets"] {
        let app = app_chrome(slug);
        icons.push(DesktopIcon::new(
            AppId::new(app.slug),
            texts.get(app.title_key),
            app.icon,
        ));
    }
    IconGrid::new(icons)
}

/// Reference grid of the browser host; the panel is expected to be this large.
pub const CANVAS_WIDTH: u32 = 1512;
/// Height of the reference grid, in pixels.
pub const CANVAS_HEIGHT: u32 = 982;

/// Keeps the canvas backing store on the CSS box at the current display scale.
///
/// eframe converts pointers with `client position / zoom` while it paints `pixels_per_point` device
/// pixels per point, so the backing store has to be `client size × devicePixelRatio`. A pinned
/// 1512 × 982 store (the previous approach) drifted by the display scale: at a 1.25 scale the app
/// painted 1.25 pixels per point into a surface that matched the CSS box 1:1, which moved every
/// widget around and made clicks land next to the control they aimed at.
fn sync_canvas_size() {
    let Some(window) = web_sys::window() else {
        return;
    };
    let Some(document) = window.document() else {
        return;
    };
    let canvas = document
        .get_element_by_id("socdof-canvas")
        .and_then(|element| element.dyn_into::<web_sys::HtmlCanvasElement>().ok());
    let Some(canvas) = canvas else {
        return;
    };
    let scale = window.device_pixel_ratio().max(1.0);
    let width = ((canvas.client_width().max(1) as f64 * scale).round() as u32).max(1);
    let height = ((canvas.client_height().max(1) as f64 * scale).round() as u32).max(1);
    if canvas.width() != width {
        canvas.set_width(width);
    }
    if canvas.height() != height {
        canvas.set_height(height);
    }
}

/// Language of the browser, German when it is not one of the four supported languages.
fn browser_language() -> Language {
    let tag = web_sys::window()
        .and_then(|window| window.navigator().language())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match tag.split(['-', '_']).next().unwrap_or("") {
        "en" => Language::En,
        "fr" => Language::Fr,
        "es" => Language::Es,
        _ => Language::De,
    }
}

/// Stops the browser from acting on keys the interface already uses.
///
/// Without this the browser moves the DOM focus off the canvas on `Tab`: the interface still paints
/// the caret in the focused field, but every following key press goes to the browser instead of the
/// form, so a user could tab into a field and type nothing.
fn keep_keyboard_focus() {
    let Some(window) = web_sys::window() else {
        return;
    };
    let callback = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(
        move |event: web_sys::KeyboardEvent| {
            if event.key() == "Tab" {
                event.prevent_default();
            }
        },
    );
    let _ = window.add_event_listener_with_callback("keydown", callback.as_ref().unchecked_ref());
    callback.forget();
}

/// Starts the WASM application on the `socdof-canvas` element of `index.html`.
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    // The boot hint of `index.html` is only needed until the WASM module is loaded.
    if let Some(loading) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.get_element_by_id("loading"))
    {
        loading.remove();
    }
    // A panel that changes size before the app starts leaves the canvas at a stale size.
    sync_canvas_size();
    keep_keyboard_focus();
    let options = eframe::WebOptions::default();
    wasm_bindgen_futures::spawn_local(async {
        eframe::WebRunner::new()
            .start(
                "socdof-canvas",
                options,
                Box::new(|cc| Box::new(WebApp::new(cc))),
            )
            .await
            .expect("failed to start the SOCDOF web application");
    });
}
