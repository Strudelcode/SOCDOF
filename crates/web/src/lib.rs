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

use eframe::egui::{self, Align2, Context, Id, RichText};
use socdof_core::app_store;
use socdof_core::domain::permission::{AppModule, ALL_MODULES};
use socdof_core::domain::settings::Language;
use socdof_core::store::Store;
use socdof_core::{now_millis, CoreResult};
use socdof_ui::accounting::{accounting, AccountingState};
use socdof_ui::app_store::{app_store, AppStoreState};
use socdof_ui::appointments::{
    appointments, AppointmentsDetail, AppointmentsState, AppointmentsView,
};
use socdof_ui::auth::{auth, AuthState, AuthView};
use socdof_ui::chrome::{app_chrome, app_window};
use socdof_ui::components::{button, ButtonVariant};
use socdof_ui::contacts::{contacts, ContactsState};
use socdof_ui::dashboard::{dashboard, DashboardAction, DashboardData, DashboardState};
use socdof_ui::desktop::{desktop, AppId, DesktopFrame, DesktopIcon, IconGrid, WindowManager};
use socdof_ui::editor::{editor, EditorState};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::invoices::{invoices, InvoicesState};
use socdof_ui::pos::{pos, PosState};
use socdof_ui::products::{products, ProductsState};
use socdof_ui::purchases::{purchases, PurchasesState};
use socdof_ui::reports::{reports, ReportsState};
use socdof_ui::settings::{settings, SettingsState};
use socdof_ui::shell::{Onboarding, ShellState};
use socdof_ui::support::{support, SupportState};
use socdof_ui::theme::{Appearance, Theme};
use socdof_ui::therapie::{therapie, TherapieState};
use socdof_ui::tokens::FONT_SMALL;
use socdof_ui::users::{users, UsersState};

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
    /// Catalogue key of a startup failure.
    error: Option<&'static str>,
}

impl WebApp {
    /// Builds the application for the given browser session.
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
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
            appearance: if cc.egui_ctx.style().visuals.dark_mode {
                Appearance::Dark
            } else {
                Appearance::Light
            },
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
            error: None,
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
                self.settings.refresh(&self.store)?;
            }
            "users" => self.users.refresh(&self.store)?,
            "editor" => self.editor.reset_for_open(&self.store)?,
            "app-store" => self.app_store.reset_for_open(&self.store)?,
            "support" => self.support.reset_for_open(&self.store)?,
            "reports" => self.reports.reset_for_open(&self.store, now)?,
            "therapy" => self.therapie.reset_for_open(&self.store)?,
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
            _ => self.leave_screen(now),
        }
    }

    /// Draws the desktop and handles the app that was launched from it.
    fn render_desktop(&mut self, ctx: &Context, theme: &Theme, texts: &UiTexts, now: i64) {
        let outcome = desktop(
            ctx,
            DesktopFrame {
                theme,
                texts,
                shell: &mut self.shell,
                store: &self.store,
            },
            &mut self.focus,
            &mut self.icons,
            &mut self.windows,
            now,
        );
        if outcome.toggle_theme {
            self.appearance = if self.appearance.is_dark() {
                Appearance::Light
            } else {
                Appearance::Dark
            };
        }
        if let Some(app) = outcome.open_app {
            if self.open_screen(app, now).is_err() {
                self.error = Some("auth_error_storage");
            }
        }
    }

    /// Draws the session chip with the signed-in account and the sign-out action.
    fn account_chip(&mut self, ctx: &Context, theme: &Theme, texts: &UiTexts, now: i64) {
        let Some(user) = self.auth.user.clone() else {
            return;
        };
        let mut sign_out = false;
        egui::Area::new(Id::new("socdof-web-account"))
            .anchor(Align2::RIGHT_TOP, egui::vec2(-18.0, 14.0))
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
        self.focus.begin_frame(ctx);
        let theme = Theme::new(self.appearance, &self.accent_id);
        theme.apply(ctx);
        let texts = self.texts.clone();
        let now = now_millis();

        if self.signed_in() {
            if ctx.input(|input| !input.events.is_empty()) {
                self.auth.note_activity(now);
            }
            self.auth.tick(now);
        }

        if !self.signed_in() {
            auth(
                ctx,
                &theme,
                &texts,
                &mut self.focus,
                &mut self.auth,
                &self.store,
                now,
            );
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
    }
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
    IconGrid::new(icons)
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
