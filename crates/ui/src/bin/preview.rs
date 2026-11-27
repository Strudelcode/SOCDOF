//! Renders the current egui screens to PNG files and writes a static gallery.
//!
//! This is the browser preview path: it runs the real screen functions from this crate, tessellates
//! the resulting egui frame and rasterises the meshes and font atlas into RGBA images. Run it from
//! the repository root:
//!
//! ```text
//! cargo run -p socdof-ui --bin socdof-ui-preview
//! ```
//!
//! The generated directory (`target/ui-preview`) is served by the local preview host. No screen is
//! redrawn by a separate mock renderer: the images come from the same functions the desktop window
//! calls.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use egui::epaint::Primitive;
use egui::{ImageData, Pos2, RawInput, Rect, TextureId, Vec2};
use socdof_core::domain::settings::Language;
use socdof_ui::auth::AuthState;
use socdof_ui::gallery::{gallery, GalleryState};
use socdof_ui::settings::SettingsTab;
use socdof_ui::shell::Onboarding;
use socdof_ui::theme::Appearance;
use socdof_ui::wallpaper::{Wallpaper, WallpaperFit};

/// Reference viewport of the compact desktop (the TS app at a 432 × 771 window).
const COMPACT_WIDTH: f32 = 432.0;
const COMPACT_HEIGHT: f32 = 771.0;

const LANGUAGES: [Language; 4] = [Language::De, Language::En, Language::Fr, Language::Es];
const APPEARANCES: [Appearance; 2] = [Appearance::Light, Appearance::Dark];

#[derive(Clone, Copy)]
enum Scene {
    Gallery,
    Desktop,
    DesktopOverflow,
    DesktopFree,
    DesktopFolders,
    DesktopFolderOpen,
    DesktopFoldersCompact,
    /// Folder modal with the files tab and a filed document.
    DesktopFolderFiles,
    /// Desktop background context menu.
    DesktopMenu,
    DesktopTaskView,
    DesktopTaskViewEmpty,
    DesktopTaskViewCompact,
    DesktopTaskViewRename,
    /// Folder modal with the files tab on a phone viewport.
    DesktopFolderFilesCompact,
    StartMenu,
    StartMenuPower,
    Palette,
    Tray,
    Onboarding,
    Wallpaper,
    Studio,
    StudioData,
    StudioLayout,
    Focused,
    Drawer,
    Dashboard,
    Contacts,
    ContactsBatch,
    Products,
    ProductsJournal,
    ProductsForm,
    Invoices,
    InvoicesForm,
    Accounting,
    AccountingVat,
    AccountingCustom,
    Purchases,
    PurchasesDetail,
    PurchasesForm,
    PurchasesError,
    PurchasesDelete,
    Pos,
    Calendar,
    CalendarWeek,
    CalendarForm,
    Users,
    UserDetail,
    Editor,
    EditorPreview,
    EditorSpell,
    AppStore,
    Support,
    Reports,
    Therapie,
    TherapieList,
    AuthLogin,
    AuthLoginOther,
    AuthLoginLocked,
    AuthSigningIn,
    AuthQuitConfirm,
    AuthLocked,
    AuthLanguage,
    AuthWelcome,
    AuthSetup,
    AuthAppearance,
    AuthApps,
    AuthFinish,
    AuthFinishSkipped,
    AuthRecoveryCustom,
    AuthRecover,
    AuthPasswordChange,
    AuthUnlocked,
    AuthParityLogin,
    AuthParityLocked,
    AuthParityQuickSwitch,
    Settings(SettingsTab),
    SettingsRoleForm,
    SettingsDelete,
    SettingsRestore,
    DesktopCalculator,
    DesktopWidgets,
    DesktopEditor,
}

impl Scene {
    fn id(self) -> String {
        match self {
            Scene::Gallery => "gallery".to_string(),
            Scene::Desktop => "desktop".to_string(),
            Scene::DesktopOverflow => "desktop-overflow".to_string(),
            Scene::DesktopFree => "desktop-free".to_string(),
            Scene::DesktopFolders => "desktop-folders".to_string(),
            Scene::DesktopFolderOpen => "desktop-folder-open".to_string(),
            Scene::DesktopFoldersCompact => "desktop-folders-compact".to_string(),
            Scene::DesktopFolderFiles => "desktop-folder-files".to_string(),
            Scene::DesktopMenu => "desktop-menu".to_string(),
            Scene::DesktopTaskView => "desktop-task-view".to_string(),
            Scene::DesktopTaskViewEmpty => "desktop-task-view-empty".to_string(),
            Scene::DesktopTaskViewCompact => "desktop-task-view-compact".to_string(),
            Scene::DesktopTaskViewRename => "desktop-task-view-rename".to_string(),
            Scene::DesktopFolderFilesCompact => "desktop-folder-files-compact".to_string(),
            Scene::DesktopCalculator => "desktop-calculator".to_string(),
            Scene::DesktopWidgets => "desktop-widgets".to_string(),
            Scene::DesktopEditor => "desktop-editor".to_string(),
            Scene::StartMenu => "start-menu".to_string(),
            Scene::StartMenuPower => "start-menu-power".to_string(),
            Scene::Palette => "palette".to_string(),
            Scene::Tray => "tray".to_string(),
            Scene::Onboarding => "onboarding".to_string(),
            Scene::Wallpaper => "wallpaper".to_string(),
            Scene::Studio => "studio".to_string(),
            Scene::StudioData => "studio-data".to_string(),
            Scene::StudioLayout => "studio-layout".to_string(),
            Scene::Focused => "focused".to_string(),
            Scene::Drawer => "drawer".to_string(),
            Scene::Dashboard => "dashboard".to_string(),
            Scene::Contacts => "contacts".to_string(),
            Scene::Products => "products".to_string(),
            Scene::Invoices => "invoices".to_string(),
            Scene::Accounting => "accounting".to_string(),
            Scene::Purchases => "purchases".to_string(),
            Scene::PurchasesDetail => "purchases-detail".to_string(),
            Scene::PurchasesForm => "purchases-form".to_string(),
            Scene::PurchasesError => "purchases-error".to_string(),
            Scene::PurchasesDelete => "purchases-delete".to_string(),
            Scene::ContactsBatch => "contacts-batch".to_string(),
            Scene::AccountingVat => "accounting-vat".to_string(),
            Scene::AccountingCustom => "accounting-custom".to_string(),
            Scene::InvoicesForm => "invoices-form".to_string(),
            Scene::ProductsJournal => "products-journal".to_string(),
            Scene::CalendarWeek => "calendar-week".to_string(),
            Scene::CalendarForm => "calendar-form".to_string(),
            Scene::Pos => "pos".to_string(),
            Scene::Calendar => "calendar".to_string(),
            Scene::Users => "users".to_string(),
            Scene::UserDetail => "users-detail".to_string(),
            Scene::Editor => "editor".to_string(),
            Scene::EditorPreview => "editor-preview".to_string(),
            Scene::EditorSpell => "editor-spell".to_string(),
            Scene::AppStore => "app-store".to_string(),
            Scene::Support => "support".to_string(),
            Scene::Reports => "reports".to_string(),
            Scene::Therapie => "therapy".to_string(),
            Scene::TherapieList => "therapy-list".to_string(),
            Scene::ProductsForm => "products-form".to_string(),
            Scene::AuthLogin => "auth-login".to_string(),
            Scene::AuthLoginOther => "auth-login-other".to_string(),
            Scene::AuthLoginLocked => "auth-login-locked".to_string(),
            Scene::AuthSigningIn => "auth-signing-in".to_string(),
            Scene::AuthQuitConfirm => "auth-quit-confirm".to_string(),
            Scene::AuthLocked => "auth-locked".to_string(),
            Scene::AuthLanguage => "auth-language".to_string(),
            Scene::AuthWelcome => "auth-welcome".to_string(),
            Scene::AuthSetup => "auth-setup".to_string(),
            Scene::AuthAppearance => "auth-appearance".to_string(),
            Scene::AuthApps => "auth-apps".to_string(),
            Scene::AuthFinish => "auth-finish".to_string(),
            Scene::AuthFinishSkipped => "auth-finish-skipped".to_string(),
            Scene::AuthRecoveryCustom => "auth-recovery-custom".to_string(),
            Scene::AuthRecover => "auth-recover".to_string(),
            Scene::AuthPasswordChange => "auth-password-change".to_string(),
            Scene::AuthParityLogin => "auth-parity-login".to_string(),
            Scene::AuthParityLocked => "auth-parity-locked".to_string(),
            Scene::AuthParityQuickSwitch => "auth-parity-quick-switch".to_string(),
            Scene::AuthUnlocked => "auth-unlocked".to_string(),
            Scene::Settings(tab) => format!("settings-{}", settings_id(tab)),
            Scene::SettingsRoleForm => "settings-role-form".to_string(),
            Scene::SettingsDelete => "settings-delete".to_string(),
            Scene::SettingsRestore => "settings-restore".to_string(),
        }
    }

    fn title(self) -> String {
        match self {
            Scene::Gallery => "Component gallery".to_string(),
            Scene::Desktop => "Desktop shell".to_string(),
            Scene::DesktopOverflow => "Desktop · Overflow menu".to_string(),
            Scene::DesktopFree => "Desktop · Free icon placement".to_string(),
            Scene::DesktopFolders => "Desktop · Folders".to_string(),
            Scene::DesktopFolderOpen => "Desktop · Open folder".to_string(),
            Scene::DesktopFoldersCompact => "Desktop · Folders (compact)".to_string(),
            Scene::DesktopFolderFiles => "Desktop · Folder files".to_string(),
            Scene::DesktopMenu => "Desktop · Context menu".to_string(),
            Scene::DesktopTaskView => "Desktop · Task view".to_string(),
            Scene::DesktopTaskViewEmpty => "Desktop · Task view (empty)".to_string(),
            Scene::DesktopTaskViewCompact => "Desktop · Task view (compact)".to_string(),
            Scene::DesktopTaskViewRename => "Desktop · Task view (rename)".to_string(),
            Scene::DesktopFolderFilesCompact => "Desktop · Folder files (compact)".to_string(),
            Scene::StartMenu => "Start menu".to_string(),
            Scene::StartMenuPower => "Start menu with power flyout".to_string(),
            Scene::Palette => "Command palette".to_string(),
            Scene::Tray => "Tray flyout".to_string(),
            Scene::Onboarding => "Onboarding".to_string(),
            Scene::Wallpaper => "Wallpaper".to_string(),
            Scene::Studio => "Studio · Letterhead".to_string(),
            Scene::StudioData => "Studio · Business data".to_string(),
            Scene::StudioLayout => "Studio · Document layout".to_string(),
            Scene::Focused => "Keyboard focus".to_string(),
            Scene::Drawer => "Details drawer".to_string(),
            Scene::Dashboard => "Dashboard".to_string(),
            Scene::Contacts => "Contacts".to_string(),
            Scene::Products => "Products & stock".to_string(),
            Scene::Invoices => "Invoices".to_string(),
            Scene::ProductsForm => "Products · Form".to_string(),
            Scene::Accounting => "Accounting".to_string(),
            Scene::Purchases => "Purchases".to_string(),
            Scene::PurchasesDetail => "Purchases · Order".to_string(),
            Scene::PurchasesForm => "Purchases · Form".to_string(),
            Scene::PurchasesError => "Purchases · Long error badge".to_string(),
            Scene::PurchasesDelete => "Purchases · Delete dialog".to_string(),
            Scene::ContactsBatch => "Contacts · Batch dialog".to_string(),
            Scene::AccountingVat => "Accounting · VAT return".to_string(),
            Scene::AccountingCustom => "Accounting · Custom range".to_string(),
            Scene::InvoicesForm => "Invoices · Form".to_string(),
            Scene::ProductsJournal => "Products · Movement journal".to_string(),
            Scene::CalendarWeek => "Calendar · Week".to_string(),
            Scene::CalendarForm => "Calendar · Appointment form".to_string(),
            Scene::Pos => "POS / cash register".to_string(),
            Scene::Calendar => "Calendar".to_string(),
            Scene::Users => "User management".to_string(),
            Scene::UserDetail => "User management · Account".to_string(),
            Scene::Editor => "Text editor · Documents".to_string(),
            Scene::EditorPreview => "Text editor · Preview".to_string(),
            Scene::EditorSpell => "Text editor · Spell check".to_string(),
            Scene::AppStore => "App Store · Modules".to_string(),
            Scene::Support => "Support · Tickets".to_string(),
            Scene::Reports => "Reports · Period totals".to_string(),
            Scene::Therapie => "Therapy · Client detail".to_string(),
            Scene::TherapieList => "Therapy · Clients".to_string(),
            Scene::AuthLogin => "Login".to_string(),
            Scene::AuthLoginOther => "Login · other account".to_string(),
            Scene::AuthLoginLocked => "Login · lockout countdown".to_string(),
            Scene::AuthSigningIn => "Login · signing in".to_string(),
            Scene::AuthQuitConfirm => "Login · close confirmation".to_string(),
            Scene::AuthLocked => "Lock screen".to_string(),
            Scene::AuthLanguage => "First-run language".to_string(),
            Scene::AuthWelcome => "First-run welcome".to_string(),
            Scene::AuthSetup => "First-run account".to_string(),
            Scene::AuthAppearance => "First-run appearance".to_string(),
            Scene::AuthApps => "First-run apps".to_string(),
            Scene::AuthFinish => "First-run finish".to_string(),
            Scene::AuthFinishSkipped => "First-run finish · setup skipped".to_string(),
            Scene::AuthRecoveryCustom => "First-run account · custom recovery question".to_string(),
            Scene::AuthRecover => "Password recovery".to_string(),
            Scene::AuthPasswordChange => "Password change".to_string(),
            Scene::AuthParityLogin => "Login · passwordless continue".to_string(),
            Scene::AuthParityLocked => "Lock screen · configured clock".to_string(),
            Scene::AuthParityQuickSwitch => "Lock screen · quick switch".to_string(),
            Scene::AuthUnlocked => "Signed in".to_string(),
            Scene::Settings(tab) => format!("Settings · {}", settings_title(tab)),
            Scene::SettingsRoleForm => "Settings · Role editor".to_string(),
            Scene::SettingsDelete => "Settings · Delete dialog".to_string(),
            Scene::SettingsRestore => "Settings · Restore dialog".to_string(),
            Scene::DesktopCalculator => "Desktop · Calculator window".to_string(),
            Scene::DesktopWidgets => "Desktop · Widgets window".to_string(),
            Scene::DesktopEditor => "Desktop · Text editor window".to_string(),
        }
    }

    fn size(self) -> (f32, f32) {
        match self {
            Scene::Desktop
            | Scene::DesktopOverflow
            | Scene::DesktopFree
            | Scene::DesktopFolders
            | Scene::DesktopFolderOpen
            | Scene::DesktopFolderFiles
            | Scene::DesktopMenu
            | Scene::DesktopTaskView
            | Scene::DesktopTaskViewEmpty
            | Scene::DesktopTaskViewRename
            | Scene::StartMenu
            | Scene::Palette
            | Scene::Tray
            | Scene::Onboarding
            | Scene::Wallpaper
            | Scene::Studio
            | Scene::StudioData => (1280.0, 820.0),
            Scene::StudioLayout => (1280.0, 1620.0),
            Scene::Gallery => (1180.0, 2320.0),
            Scene::Editor | Scene::EditorPreview | Scene::EditorSpell => (1180.0, 1620.0),
            Scene::AppStore => (1180.0, 2800.0),
            Scene::Settings(_) => (1180.0, 2050.0),
            Scene::Users => (1180.0, 1500.0),
            Scene::UserDetail => (1180.0, 1900.0),
            Scene::AuthLogin
            | Scene::AuthLoginOther
            | Scene::AuthLoginLocked
            | Scene::AuthSigningIn
            | Scene::AuthQuitConfirm
            | Scene::AuthLocked
            | Scene::AuthUnlocked
            | Scene::AuthParityLogin
            | Scene::AuthParityLocked
            | Scene::AuthParityQuickSwitch => (900.0, 820.0),
            Scene::AuthLanguage => (900.0, 780.0),
            Scene::AuthWelcome => (900.0, 620.0),
            Scene::AuthSetup => (900.0, 1700.0),
            Scene::AuthAppearance => (900.0, 1100.0),
            Scene::AuthApps => (900.0, 1700.0),
            Scene::AuthFinish => (900.0, 1000.0),
            Scene::AuthFinishSkipped => (900.0, 1000.0),
            Scene::AuthRecoveryCustom => (900.0, 1700.0),
            Scene::AuthRecover | Scene::AuthPasswordChange => (900.0, 1060.0),
            Scene::DesktopCalculator | Scene::DesktopWidgets | Scene::DesktopEditor => {
                (COMPACT_WIDTH, COMPACT_HEIGHT)
            }
            Scene::DesktopFoldersCompact
            | Scene::DesktopFolderFilesCompact
            | Scene::DesktopTaskViewCompact => (COMPACT_WIDTH, COMPACT_HEIGHT),
            _ => (1180.0, 1500.0),
        }
    }

    fn prepare(self, state: &mut GalleryState) {
        state.desktop_open = false;
        state.dashboard_open = false;
        state.contacts_open = false;
        state.products_open = false;
        state.invoices_open = false;
        state.accounting_open = false;
        state.purchases_open = false;
        state.pos_open = false;
        state.appointments_open = false;
        state.settings_open = false;
        state.users_open = false;
        state.users.view = socdof_ui::users::UsersView::List;
        state.users.error = None;
        state.users.status = None;
        state.editor_open = false;
        state.editor.back = false;
        state.editor.error = None;
        state.editor.status = None;
        state.app_store_open = false;
        state.app_store.back = false;
        state.app_store.error = None;
        state.app_store.status = None;
        state.app_store.changed = false;
        state.support_open = false;
        state.support.back = false;
        state.support.error = None;
        state.support.status = None;
        state.support.view = socdof_ui::support::SupportView::List;
        state.reports_open = false;
        state.reports.back = false;
        state.reports.error = None;
        state.therapie_open = false;
        state.therapie.back = false;
        state.therapie.error = None;
        state.therapie.status = None;
        state.therapie.view = socdof_ui::therapie::TherapieView::List;
        state.auth_open = false;
        state.auth.back = false;
        state.auth.allow_exit = false;
        state.drawer_open = false;
        state.modal_open = false;
        state.shell.close_overlays();
        state.shell.folders = socdof_ui::desktop::FolderSet::new();
        state.shell.onboarding = Onboarding::restore(true);
        state.shell.wallpaper.wallpaper = Wallpaper::Plain;
        state.shell.wallpaper.fit = WallpaperFit::Cover;

        match self {
            Scene::Gallery => {}
            Scene::Desktop => state.desktop_open = true,
            Scene::DesktopCalculator | Scene::DesktopWidgets | Scene::DesktopEditor => {
                state.desktop_open = true;
                let (app, title_key) = match self {
                    Scene::DesktopCalculator => ("calculator", "app_calculator"),
                    Scene::DesktopWidgets => ("widgets", "app_widgets"),
                    _ => ("editor", "app_editor"),
                };
                let screen = egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(COMPACT_WIDTH, COMPACT_HEIGHT),
                );
                // The calculator and widgets windows sit over the taskbar and end 5 px above
                // the viewport bottom; the measured editor window ends on the taskbar edge.
                let bottom = match self {
                    Scene::DesktopEditor => screen.max.y - socdof_ui::desktop::TASKBAR_HEIGHT,
                    _ => screen.max.y - 5.0,
                };
                let rect =
                    egui::Rect::from_min_max(screen.min, egui::Pos2::new(screen.max.x, bottom));
                let window = socdof_ui::desktop::Window::new(
                    socdof_ui::desktop::AppId::new(app),
                    state.texts.get(title_key),
                    rect,
                );
                let _ = state.desktop_windows.open(window, 0);
            }
            Scene::DesktopOverflow => {
                state.desktop_open = true;
                state.shell.toggle_overflow();
            }
            Scene::DesktopFree => {
                state.desktop_open = true;
                state.desktop_icons.place_at(
                    socdof_ui::desktop::AppId::new("contacts"),
                    egui::Pos2::new(460.0, 250.0),
                );
                state.desktop_icons.place_at(
                    socdof_ui::desktop::AppId::new("products"),
                    egui::Pos2::new(460.0, 400.0),
                );
            }
            Scene::DesktopFolders | Scene::DesktopFolderOpen | Scene::DesktopFolderFiles => {
                state.desktop_open = true;
                // The icons fill the first three columns; the folders take the free cells next to
                // them, like a folder created from the desktop menu.
                let three = state.shell.folders.create(
                    state.texts.get("desktop_folder_default_name"),
                    vec![
                        socdof_ui::desktop::AppId::new("contacts"),
                        socdof_ui::desktop::AppId::new("invoices"),
                        socdof_ui::desktop::AppId::new("calendar"),
                    ],
                    (3, 0),
                );
                // Five apps exercise the counter badge of the reference folder tile.
                state.shell.folders.create(
                    "Büro",
                    vec![
                        socdof_ui::desktop::AppId::new("products"),
                        socdof_ui::desktop::AppId::new("purchases"),
                        socdof_ui::desktop::AppId::new("pos"),
                        socdof_ui::desktop::AppId::new("accounting"),
                        socdof_ui::desktop::AppId::new("reports"),
                    ],
                    (3, 1),
                );
                if matches!(self, Scene::DesktopFolderOpen | Scene::DesktopFolderFiles) {
                    state.shell.folders.open(&three);
                }
                if matches!(self, Scene::DesktopFolderFiles) {
                    // The files tab with two filed documents and the details of the first one,
                    // like the reference storage list.
                    state
                        .shell
                        .folders
                        .set_tab(socdof_ui::desktop::FolderTab::Files);
                    state.shell.storage.set_location("/home/belege");
                    state
                        .shell
                        .storage
                        .add(socdof_ui::desktop::StorageAsset::new(
                            "asset-quote",
                            "Angebot 2026-11.pdf",
                            2_411_724,
                            "/home/belege",
                            Some(three.clone()),
                            1_764_201_600_000,
                        ));
                    state
                        .shell
                        .storage
                        .add(socdof_ui::desktop::StorageAsset::new(
                            "asset-receipt",
                            "Beleg_Kasse_0421.pdf",
                            184_320,
                            "/home/belege",
                            Some(three.clone()),
                            1_764_115_200_000,
                        ));
                    state
                        .shell
                        .storage
                        .add(socdof_ui::desktop::StorageAsset::new(
                            "asset-photo",
                            "Werkstatt_Foto.jpg",
                            1_048_576,
                            "/home/belege",
                            None,
                            1_763_942_400_000,
                        ));
                    state.shell.storage.select("asset-quote");
                }
            }
            Scene::DesktopMenu => {
                state.desktop_open = true;
                state.shell.folders.open_menu(egui::Pos2::new(420.0, 240.0));
            }
            Scene::DesktopTaskView
            | Scene::DesktopTaskViewCompact
            | Scene::DesktopTaskViewRename => {
                state.desktop_open = true;
                close_all_windows(state);
                // A fixed strip keeps the scene identical across languages and appearances.
                state.shell.task_view.restore(
                    [
                        ("desktop-1", "Desktop 1"),
                        ("desktop-2", "Desktop 2"),
                        ("desktop-3", "Desktop 3"),
                    ]
                    .map(|(id, name)| (id.to_string(), name.to_string())),
                    "desktop-1",
                );
                state.shell.task_view.open();
                let entries: [(&str, &str, &str, bool); 5] = [
                    ("dashboard", "app_dashboard", "desktop-1", false),
                    ("contacts", "app_contacts", "desktop-1", false),
                    ("invoices", "app_invoices", "desktop-1", true),
                    ("products", "app_products", "desktop-2", false),
                    ("calendar", "app_calendar", "desktop-2", false),
                ];
                for (index, (app, key, desktop, minimized)) in entries.iter().enumerate() {
                    let rect = egui::Rect::from_min_size(
                        egui::Pos2::new(64.0 + index as f32 * 32.0, 64.0 + index as f32 * 26.0),
                        egui::Vec2::new(880.0, 600.0),
                    );
                    let window = socdof_ui::desktop::Window::new(
                        socdof_ui::desktop::AppId::new(app),
                        state.texts.get(key),
                        rect,
                    )
                    .on_desktop(Some((*desktop).to_string()));
                    let _ = state.desktop_windows.open(window, 0);
                    if *minimized {
                        state
                            .desktop_windows
                            .minimize(socdof_ui::desktop::AppId::new(app));
                    }
                }
                state.shell.task_view.open();
                if matches!(self, Scene::DesktopTaskViewRename) {
                    state.shell.task_view.open();
                    state.shell.task_view.begin_rename("desktop-2");
                }
            }
            Scene::DesktopTaskViewEmpty => {
                state.desktop_open = true;
                close_all_windows(state);
                state.shell.task_view.restore(
                    [("desktop-1", "Desktop 1"), ("desktop-2", "Desktop 2")]
                        .map(|(id, name)| (id.to_string(), name.to_string())),
                    "desktop-1",
                );
                state.shell.task_view.open();
            }
            Scene::DesktopFolderFilesCompact => {
                state.desktop_open = true;
                let slot = state.desktop_icons.icons().len() as u32;
                let folder = state.shell.folders.create(
                    state.texts.get("desktop_folder_default_name"),
                    vec![
                        socdof_ui::desktop::AppId::new("contacts"),
                        socdof_ui::desktop::AppId::new("invoices"),
                        socdof_ui::desktop::AppId::new("calendar"),
                    ],
                    socdof_ui::desktop::FolderSet::slot_cell(slot),
                );
                state.shell.folders.open(&folder);
                state
                    .shell
                    .folders
                    .set_tab(socdof_ui::desktop::FolderTab::Files);
                state.shell.storage.set_location("/home/belege");
                state
                    .shell
                    .storage
                    .add(socdof_ui::desktop::StorageAsset::new(
                        "asset-quote",
                        "Angebot 2026-11.pdf",
                        2_411_724,
                        "/home/belege",
                        Some(folder.clone()),
                        1_764_201_600_000,
                    ));
                state
                    .shell
                    .storage
                    .add(socdof_ui::desktop::StorageAsset::new(
                        "asset-photo",
                        "Werkstatt_Foto_Radkappe_verpackt.jpg",
                        1_048_576,
                        "/home/belege",
                        Some(folder),
                        1_763_942_400_000,
                    ));
            }
            Scene::DesktopFoldersCompact => {
                state.desktop_open = true;
                // The compact grid holds three columns of six icons, so one folder follows the
                // icons in the last free cell.
                let slot = state.desktop_icons.icons().len() as u32;
                state.shell.folders.create(
                    state.texts.get("desktop_folder_default_name"),
                    vec![
                        socdof_ui::desktop::AppId::new("contacts"),
                        socdof_ui::desktop::AppId::new("invoices"),
                        socdof_ui::desktop::AppId::new("calendar"),
                    ],
                    socdof_ui::desktop::FolderSet::slot_cell(slot),
                );
            }
            Scene::StartMenu => {
                state.desktop_open = true;
                state.shell.open_start();
            }
            Scene::StartMenuPower => {
                state.desktop_open = true;
                state.shell.open_start();
                state.shell.start.set_accounts(vec![
                    socdof_ui::shell::AccountEntry {
                        id: uuid::Uuid::from_u128(1),
                        username: String::from("anna"),
                        name: String::from("Anna Weber"),
                        current: true,
                    },
                    socdof_ui::shell::AccountEntry {
                        id: uuid::Uuid::from_u128(2),
                        username: String::from("ben"),
                        name: String::from("Ben Ostermann"),
                        current: false,
                    },
                ]);
                state.shell.start.open_power();
            }
            Scene::Palette => {
                state.desktop_open = true;
                state.shell.open_palette();
            }
            Scene::Tray => {
                state.desktop_open = true;
                state.shell.toggle_tray();
            }
            Scene::Onboarding => {
                state.desktop_open = true;
                state.shell.onboarding.restart();
            }
            Scene::Wallpaper => {
                state.desktop_open = true;
                state.shell.wallpaper.wallpaper = Wallpaper::Dusk;
                state.shell.wallpaper.fit = WallpaperFit::Tile;
            }
            Scene::Studio => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
            }
            Scene::StudioData => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
                state
                    .shell
                    .studio
                    .set_tab(socdof_ui::studio::StudioTab::Data);
            }
            Scene::StudioLayout => {
                state.desktop_open = true;
                state.shell.studio.open(&state.store);
                state
                    .shell
                    .studio
                    .set_tab(socdof_ui::studio::StudioTab::Layout);
                *state.shell.studio.layout_mut() = socdof_ui::studio::gallery_layout();
            }
            Scene::Focused => {}
            Scene::Drawer => state.drawer_open = true,
            Scene::Dashboard => state.dashboard_open = true,
            Scene::Contacts => state.contacts_open = true,
            Scene::Products => state.products_open = true,
            Scene::Invoices => state.invoices_open = true,
            Scene::Accounting => state.accounting_open = true,
            Scene::Purchases => state.purchases_open = true,
            Scene::PurchasesDetail => {
                state.purchases_open = true;
                let _ = state.purchases.refresh(&state.store);
                if let Some(id) = state.purchases.orders.first().map(|order| order.id) {
                    state.purchases.select(id);
                }
            }
            Scene::PurchasesForm => {
                state.purchases_open = true;
                let _ = state.purchases.refresh(&state.store);
                state.purchases.start_new(socdof_core::now_millis());
            }
            Scene::PurchasesError => {
                state.purchases_open = true;
                let _ = state.purchases.refresh(&state.store);
                state.purchases.error = Some("accounting_error_period");
            }
            Scene::PurchasesDelete => {
                state.purchases_open = true;
                let _ = state.purchases.refresh(&state.store);
                if let Some(id) = state.purchases.orders.first().map(|order| order.id) {
                    state.purchases.select(id);
                }
                state.purchases.confirm_delete = true;
            }
            Scene::ContactsBatch => {
                state.contacts_open = true;
                let _ = state.contacts.refresh(&state.store);
                state.contacts.start_batch();
            }
            Scene::AccountingVat => {
                state.accounting_open = true;
                state.accounting.tab = socdof_ui::accounting::AccountingTab::VatReturn;
                let _ = state
                    .accounting
                    .refresh(&state.store, socdof_core::now_millis());
            }
            Scene::AccountingCustom => {
                state.accounting_open = true;
                state.accounting.period = socdof_ui::accounting::AccountingPeriod::Custom;
                state.accounting.custom_from = "2026-01-01".to_string();
                state.accounting.custom_to = "2026-12-31".to_string();
                let _ = state
                    .accounting
                    .refresh(&state.store, socdof_core::now_millis());
            }
            Scene::InvoicesForm => {
                state.invoices_open = true;
                let _ = state.invoices.refresh(&state.store);
                state.invoices.start_new(socdof_core::now_millis());
            }
            Scene::ProductsForm => {
                state.products_open = true;
                let _ = state.products.refresh(&state.store);
                state.products.start_new();
            }
            Scene::TherapieList => {
                let _ = state.therapie.reset_for_open(&state.store);
                state.therapie.view = socdof_ui::therapie::TherapieView::List;
                state.therapie_open = true;
            }
            Scene::ProductsJournal => {
                state.products_open = true;
                let _ = state.products.refresh(&state.store);
                state.products.view = socdof_ui::products::ProductsView::Journal;
            }
            Scene::CalendarWeek => {
                state.appointments_open = true;
                state.appointments.screen = socdof_ui::appointments::AppointmentsDetail::Calendar;
                let _ = state.appointments.refresh(&state.store);
                state
                    .appointments
                    .set_view(socdof_ui::appointments::AppointmentsView::Week);
            }
            Scene::CalendarForm => {
                state.appointments_open = true;
                state.appointments.screen = socdof_ui::appointments::AppointmentsDetail::Form;
                let _ = state.appointments.refresh(&state.store);
                state.appointments.start_new();
            }
            Scene::Pos => state.pos_open = true,
            Scene::Calendar => {
                state.appointments_open = true;
                state.appointments.screen = socdof_ui::appointments::AppointmentsDetail::Calendar;
                state.appointments.view = socdof_ui::appointments::AppointmentsView::Month;
            }
            Scene::Users => state.users_open = true,
            Scene::Editor | Scene::EditorPreview | Scene::EditorSpell => {
                let _ = state.editor.reset_for_open(&state.store);
                state.editor.spell_ignored =
                    vec!["Landingpage".to_string(), "Feedback".to_string()];
                state.editor.preview = matches!(self, Scene::EditorPreview);
                state.editor_open = true;
            }
            Scene::AppStore => {
                let _ = socdof_core::app_store::set_active(&state.store, "contacts", false);
                let _ = state.app_store.reset_for_open(&state.store);
                state.app_store_open = true;
            }
            Scene::Support => {
                let _ = state.support.reset_for_open(&state.store);
                if let Some(id) = state.support.tickets.first().map(|ticket| ticket.id) {
                    state.support.select(id);
                    let _ = state.support.refresh(&state.store);
                }
                state.support_open = true;
            }
            Scene::Reports => {
                let _ = state
                    .reports
                    .reset_for_open(&state.store, socdof_core::now_millis());
                state.reports_open = true;
            }
            Scene::Therapie => {
                let _ = state.therapie.reset_for_open(&state.store);
                if let Some(id) = state.therapie.clients.first().map(|client| client.id) {
                    let _ = state.therapie.select(&state.store, id);
                }
                state.therapie_open = true;
            }
            Scene::AuthLogin => {
                state.auth.show_login();
                state.auth_open = true;
            }
            Scene::AuthLoginOther => {
                state.auth.show_login();
                state.auth.other_user = true;
                state.auth.username.clear();
                state.auth_open = true;
            }
            Scene::AuthLoginLocked => {
                state.auth.show_login();
                state.auth.locked_until = Some(socdof_core::now_millis() + 45_000);
                state.auth.error = Some("auth_error_locked");
                state.auth_open = true;
            }
            Scene::AuthSigningIn => {
                state.auth.show_login();
                state.auth.username = "admin".to_string();
                state.auth.password = "Socdof2026!".to_string();
                state.auth.signing_in_until = socdof_core::now_millis() + 5_000;
                state.auth_open = true;
            }
            Scene::AuthQuitConfirm => {
                state.auth.show_login();
                state.auth.quit_confirm = true;
                state.auth_open = true;
            }
            Scene::AuthLocked => {
                state.auth.lock(socdof_core::now_millis());
                state.auth_open = true;
            }
            Scene::AuthParityLogin => {
                parity_clock(state);
                parity_profile_pictures(state);
                state.auth = AuthState::new(&state.store, socdof_core::now_millis())
                    .expect("parity auth state");
                state.auth.show_login();
                state.auth.username = "mira".to_string();
                state.auth_open = true;
            }
            Scene::AuthParityLocked => {
                parity_clock(state);
                parity_profile_pictures(state);
                state.auth = AuthState::signed_in(
                    &state.store,
                    "admin",
                    "Socdof2026!",
                    socdof_core::now_millis(),
                )
                .expect("parity session");
                state.auth.lock(socdof_core::now_millis());
                state.auth_open = true;
            }
            Scene::AuthParityQuickSwitch => {
                parity_clock(state);
                parity_profile_pictures(state);
                state.auth = AuthState::signed_in(
                    &state.store,
                    "mira",
                    "Socdof2026!",
                    socdof_core::now_millis(),
                )
                .expect("parity session");
                state.auth.lock(socdof_core::now_millis());
                state.auth_open = true;
            }
            Scene::AuthLanguage => {
                state.auth.show_setup();
                state.auth.setup_step = 0;
                state.auth_open = true;
            }
            Scene::AuthWelcome => {
                state.auth.show_setup();
                state.auth.setup_step = 1;
                state.auth_open = true;
            }
            Scene::AuthSetup => {
                state.auth.show_setup();
                state.auth.setup_step = 2;
                state.auth_open = true;
            }
            Scene::AuthAppearance => {
                state.auth.show_setup();
                state.auth.setup_step = 3;
                state.auth.theme_mode_choice =
                    Some(socdof_core::domain::settings::ThemeMode::System);
                state.auth.accent_choice = Some("indigo".to_string());
                // A chosen wallpaper shows the remove action of the appearance step.
                state.auth.wallpaper_choice = Some(Wallpaper::Dusk);
                state.auth.wallpaper_picked = true;
                state.auth_open = true;
            }
            Scene::AuthRecoveryCustom => {
                state.auth.show_setup();
                state.auth.setup_step = 2;
                state.auth.recovery_choice = socdof_ui::auth::RecoveryChoice::Custom;
                state.auth.recovery_custom_question = "Wie hieß mein Hund?".to_string();
                state.auth.recovery_answer_one = "Bella".to_string();
                state.auth_open = true;
            }
            Scene::AuthApps => {
                state.auth.show_setup();
                state.auth.setup_step = 4;
                // The TypeScript wizard hides the business modules for a personal account.
                state.auth.account_type = socdof_ui::auth::SetupAccountType::Personal;
                state.auth.template_choice = socdof_ui::auth::SetupTemplate::Personal;
                state.auth.setup_apps = socdof_ui::auth_screens::template_apps_for(
                    socdof_ui::auth::SetupTemplate::Personal,
                    socdof_ui::auth::SetupAccountType::Personal,
                )
                .iter()
                .map(|slug| (*slug).to_owned())
                .collect();
                state.auth_open = true;
            }
            Scene::AuthFinish => {
                state.auth.show_setup();
                state.auth.setup_step = 5;
                state.auth.display_name = "Alex Administrator".to_string();
                state.auth.username = "admin".to_string();
                state.auth_open = true;
            }
            Scene::AuthFinishSkipped => {
                state.auth.show_setup();
                state.auth.setup_step = 5;
                state.auth.setup_skip_extras = true;
                state.auth.display_name = "Alex Administrator".to_string();
                state.auth.username = "admin".to_string();
                state.auth_open = true;
            }
            Scene::AuthRecover => {
                state.auth.view = socdof_ui::auth::AuthView::Recover;
                state.auth.username = "admin".to_string();
                state.auth.status = None;
                state.auth_open = true;
            }
            Scene::AuthPasswordChange => {
                state.auth.view = socdof_ui::auth::AuthView::ChangePassword;
                state.auth.username = "admin".to_string();
                state.auth_open = true;
            }
            Scene::AuthUnlocked => {
                state.auth.show_unlocked();
                state.auth_open = true;
            }
            Scene::UserDetail => {
                state.users_open = true;
                if let Some(id) = state
                    .users
                    .users
                    .iter()
                    .find(|user| !user.is_admin() && user.active)
                    .map(|user| user.id)
                {
                    state.users.select(id);
                }
            }
            Scene::Settings(tab) => {
                state.settings_open = true;
                state.settings.set_tab(tab);
            }
            Scene::SettingsRoleForm => {
                state.settings_open = true;
                let _ = state.settings.refresh(&state.store);
                state
                    .settings
                    .set_tab(socdof_ui::settings::SettingsTab::Roles);
                if let Some(id) = state.settings.roles().first().map(|role| role.id) {
                    state.settings.dispatch(
                        socdof_ui::settings::SettingsIntent::EditRole(id),
                        &state.store,
                    );
                }
            }
            Scene::SettingsDelete => {
                state.settings_open = true;
                let _ = state.settings.refresh(&state.store);
                state
                    .settings
                    .set_tab(socdof_ui::settings::SettingsTab::Users);
                if let Some(id) = state.settings.users().first().map(|user| user.id) {
                    state.settings.dispatch(
                        socdof_ui::settings::SettingsIntent::DeleteUser(id),
                        &state.store,
                    );
                }
            }
            Scene::SettingsRestore => {
                state.settings_open = true;
                let _ = state.settings.refresh(&state.store);
                state
                    .settings
                    .set_tab(socdof_ui::settings::SettingsTab::Backup);
                state.settings.dispatch(
                    socdof_ui::settings::SettingsIntent::RequestRestore {
                        archive: "Backups/SOCDOF/2026-11-23/socdof-backup-2026-11-23-1200.zip"
                            .to_string(),
                        target: "Restore/SOCDOF-2026-11-23".to_string(),
                    },
                    &state.store,
                );
            }
        }
    }
}

fn settings_id(tab: SettingsTab) -> &'static str {
    match tab {
        SettingsTab::Display => "display",
        SettingsTab::General => "general",
        SettingsTab::Payments => "payments",
        SettingsTab::Letterhead => "letterhead",
        SettingsTab::Language => "language",
        SettingsTab::Appearance => "personalization",
        SettingsTab::Security => "security",
        SettingsTab::Backup => "backup",
        SettingsTab::Users => "users",
        SettingsTab::Roles => "roles",
        SettingsTab::Updates => "updates",
        SettingsTab::Portable => "portable",
        SettingsTab::Audio => "audio",
        SettingsTab::Shortcuts => "shortcuts",
    }
}

fn settings_title(tab: SettingsTab) -> &'static str {
    match tab {
        SettingsTab::Display => "Display",
        SettingsTab::General => "General",
        SettingsTab::Payments => "Payments",
        SettingsTab::Letterhead => "Letterhead",
        SettingsTab::Language => "Language",
        SettingsTab::Appearance => "Personalization",
        SettingsTab::Security => "Security",
        SettingsTab::Backup => "Backup",
        SettingsTab::Users => "Users",
        SettingsTab::Roles => "Roles",
        SettingsTab::Updates => "Updates",
        SettingsTab::Portable => "Portable",
        SettingsTab::Audio => "Sound & volume",
        SettingsTab::Shortcuts => "Shortcuts",
    }
}

/// Starts a scene from an empty desktop.
///
/// A fresh manager is used instead of closing window by window: closing is deferred to the next
/// frame in the running shell, which would leak the previous scene's windows into this one.
fn close_all_windows(state: &mut GalleryState) {
    let mut windows = socdof_ui::desktop::WindowManager::new();
    windows.set_current_desktop("desktop-1");
    state.desktop_windows = windows;
}

fn scenes() -> Vec<Scene> {
    let mut scenes = vec![
        Scene::Gallery,
        Scene::Desktop,
        Scene::DesktopOverflow,
        Scene::DesktopFree,
        Scene::DesktopFolders,
        Scene::DesktopFolderOpen,
        Scene::DesktopFoldersCompact,
        Scene::DesktopFolderFiles,
        Scene::DesktopMenu,
        Scene::DesktopTaskView,
        Scene::DesktopTaskViewEmpty,
        Scene::DesktopTaskViewCompact,
        Scene::DesktopTaskViewRename,
        Scene::DesktopFolderFilesCompact,
        Scene::DesktopCalculator,
        Scene::DesktopWidgets,
        Scene::DesktopEditor,
        Scene::StartMenu,
        Scene::StartMenuPower,
        Scene::Palette,
        Scene::Tray,
        Scene::Onboarding,
        Scene::Wallpaper,
        Scene::Studio,
        Scene::StudioData,
        Scene::StudioLayout,
        Scene::Focused,
        Scene::Drawer,
        Scene::Dashboard,
        Scene::Contacts,
        Scene::ContactsBatch,
        Scene::Products,
        Scene::ProductsJournal,
        Scene::ProductsForm,
        Scene::Invoices,
        Scene::InvoicesForm,
        Scene::Accounting,
        Scene::AccountingVat,
        Scene::AccountingCustom,
        Scene::Purchases,
        Scene::PurchasesDetail,
        Scene::PurchasesForm,
        Scene::PurchasesError,
        Scene::PurchasesDelete,
        Scene::Pos,
        Scene::Calendar,
        Scene::CalendarWeek,
        Scene::CalendarForm,
        Scene::Users,
        Scene::UserDetail,
        Scene::Editor,
        Scene::EditorPreview,
        Scene::EditorSpell,
        Scene::AppStore,
        Scene::Support,
        Scene::Reports,
        Scene::Therapie,
        Scene::TherapieList,
        Scene::AuthLogin,
        Scene::AuthLoginOther,
        Scene::AuthLoginLocked,
        Scene::AuthSigningIn,
        Scene::AuthQuitConfirm,
        Scene::AuthLocked,
        Scene::AuthLanguage,
        Scene::AuthWelcome,
        Scene::AuthSetup,
        Scene::AuthAppearance,
        Scene::AuthApps,
        Scene::AuthFinish,
        Scene::AuthFinishSkipped,
        Scene::AuthRecoveryCustom,
        Scene::AuthRecover,
        Scene::AuthPasswordChange,
        Scene::AuthUnlocked,
        Scene::AuthParityLogin,
        Scene::AuthParityLocked,
        Scene::AuthParityQuickSwitch,
    ];
    scenes.extend(SettingsTab::ALL.into_iter().map(Scene::Settings));
    scenes.push(Scene::SettingsRoleForm);
    scenes.push(Scene::SettingsDelete);
    scenes.push(Scene::SettingsRestore);
    scenes
}

#[derive(Clone)]
struct Texture {
    size: [usize; 2],
    pixels: Vec<[u8; 4]>,
}

impl Texture {
    fn from_image(image: &ImageData) -> Self {
        match image {
            ImageData::Color(image) => Self {
                size: image.size,
                pixels: image.pixels.iter().map(|pixel| pixel.to_array()).collect(),
            },
            ImageData::Font(image) => Self {
                size: image.size,
                pixels: image
                    .srgba_pixels(None)
                    .map(|pixel| pixel.to_array())
                    .collect(),
            },
        }
    }

    fn patch(&mut self, pos: [usize; 2], image: &ImageData) {
        let patch = Self::from_image(image);
        for y in 0..patch.size[1] {
            for x in 0..patch.size[0] {
                let target_x = pos[0] + x;
                let target_y = pos[1] + y;
                if target_x < self.size[0] && target_y < self.size[1] {
                    self.pixels[target_y * self.size[0] + target_x] =
                        patch.pixels[y * patch.size[0] + x];
                }
            }
        }
    }

    fn sample(&self, u: f32, v: f32) -> [u8; 4] {
        if self.size[0] == 0 || self.size[1] == 0 {
            return [255, 255, 255, 255];
        }
        let x = (u * self.size[0] as f32 - 0.5).clamp(0.0, self.size[0] as f32 - 1.0);
        let y = (v * self.size[1] as f32 - 0.5).clamp(0.0, self.size[1] as f32 - 1.0);
        let x0 = x.floor() as usize;
        let y0 = y.floor() as usize;
        let x1 = (x0 + 1).min(self.size[0] - 1);
        let y1 = (y0 + 1).min(self.size[1] - 1);
        let fx = x - x0 as f32;
        let fy = y - y0 as f32;
        let p00 = self.pixels[y0 * self.size[0] + x0];
        let p10 = self.pixels[y0 * self.size[0] + x1];
        let p01 = self.pixels[y1 * self.size[0] + x0];
        let p11 = self.pixels[y1 * self.size[0] + x1];
        let mut out = [0u8; 4];
        for channel in 0..4 {
            let top = p00[channel] as f32 * (1.0 - fx) + p10[channel] as f32 * fx;
            let bottom = p01[channel] as f32 * (1.0 - fx) + p11[channel] as f32 * fx;
            out[channel] = (top * (1.0 - fy) + bottom * fy).round().clamp(0.0, 255.0) as u8;
        }
        out
    }
}

fn apply_textures(textures: &mut HashMap<TextureId, Texture>, delta: &egui::TexturesDelta) {
    for (id, image) in &delta.set {
        if let Some(pos) = image.pos {
            if let Some(texture) = textures.get_mut(id) {
                texture.patch(pos, &image.image);
            }
        } else {
            textures.insert(*id, Texture::from_image(&image.image));
        }
    }
}

/// Clock settings of the sign-in parity scenes: a selected date format, time zone and seconds.
fn parity_clock(state: &GalleryState) {
    let mut profile = state.store.company_profile().expect("company profile");
    if profile.name.trim().is_empty() {
        profile.name = "Strudelcode GmbH".to_string();
    }
    profile.date_format = "MM/DD/YYYY".to_string();
    profile.timezone = "America/New_York".to_string();
    profile.time_show_seconds = Some(true);
    socdof_core::settings_service::save_company_profile(&state.store, &profile)
        .expect("saved parity profile");
}

/// Makes `mira` a passwordless account and stores profile pictures for the demo accounts.
fn parity_profile_pictures(state: &GalleryState) {
    if let Ok(Some(mut mira)) = state.store.find_user_by_username("mira") {
        mira.passwordless = true;
        state
            .store
            .update_user(&mira)
            .expect("passwordless account");
    }
    for (username, color) in [
        ("admin", [37u8, 99, 235, 255]),
        ("mira", [16u8, 185, 129, 255]),
        ("jonas", [217u8, 119, 6, 255]),
    ] {
        let Some(user) = state.store.find_user_by_username(username).ok().flatten() else {
            continue;
        };
        let mut pixels = Vec::with_capacity(8 * 8 * 4);
        for y in 0..8u8 {
            for x in 0..8u8 {
                let shade = if (x / 4 + y / 4) % 2 == 0 { 1.0 } else { 0.78 };
                pixels.extend_from_slice(&[
                    (color[0] as f32 * shade) as u8,
                    (color[1] as f32 * shade) as u8,
                    (color[2] as f32 * shade) as u8,
                    255,
                ]);
            }
        }
        let data_url =
            socdof_core::settings_service::encode_png_data_url(8, 8, &pixels).expect("avatar png");
        socdof_core::settings_service::save_user_avatar(&state.store, user.id, Some(&data_url))
            .expect("avatar saved");
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // `SOCDOF_PREVIEW_OUT` keeps parity renders apart from the regular catalogue images.
    let out = PathBuf::from(
        std::env::var("SOCDOF_PREVIEW_OUT").unwrap_or_else(|_| "target/ui-preview".to_string()),
    );
    let images = out.join("images");
    fs::create_dir_all(&images)?;

    // Optional scene filter, for example `socdof-ui-preview settings-general`, so a single screen
    // can be rendered and inspected without rasterising the whole catalogue.
    let filter = std::env::args().nth(1);
    let binary_time = std::env::current_exe()?.metadata()?.modified()?;
    let mut manifest = Vec::new();
    let all_scenes = scenes();
    for language in LANGUAGES {
        for appearance in APPEARANCES {
            let mut state = GalleryState::new(language, appearance, "indigo")?;
            for scene in &all_scenes {
                if let Some(filter) = &filter {
                    if !scene.id().contains(filter.as_str()) {
                        continue;
                    }
                }
                let file = format!(
                    "{}-{}-{}.png",
                    appearance_name(appearance),
                    language.as_str(),
                    scene.id()
                );
                let path = images.join(&file);
                let fresh = path
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .map(|modified| modified >= binary_time)
                    .unwrap_or(false);
                if !fresh {
                    let pixels = render_scene(&mut state, *scene, language, appearance);
                    write_png(&path, pixels.0, pixels.1, &pixels.2)?;
                    println!(
                        "rendered {} {} {}",
                        language.as_str(),
                        appearance_name(appearance),
                        scene.id()
                    );
                }
                manifest.push((*scene, language, appearance, file));
            }
        }
    }

    write_index(&out, &manifest)?;
    println!("preview written to {}", out.display());
    Ok(())
}

fn appearance_name(appearance: Appearance) -> &'static str {
    match appearance {
        Appearance::Light => "light",
        Appearance::Dark => "dark",
    }
}

fn render_scene(
    state: &mut GalleryState,
    scene: Scene,
    language: Language,
    appearance: Appearance,
) -> (usize, usize, Vec<u8>) {
    scene.prepare(state);
    state.appearance = appearance;
    state.accent_id = "indigo".to_string();
    state.language = language;
    let ctx = socdof_ui::theme::headless_context();
    // `SOCDOF_PREVIEW_SIZE=432x771` renders a scene in the window size of a reference screenshot,
    // so the GUI parity artefacts in `docs/artifacts/gui-parity/` are directly comparable.
    let override_size = std::env::var("SOCDOF_PREVIEW_SIZE").ok().and_then(|raw| {
        let (width, height) = raw.split_once('x')?;
        Some((
            width.trim().parse::<f32>().ok()?,
            height.trim().parse::<f32>().ok()?,
        ))
    });
    let (width, height) = override_size.unwrap_or_else(|| scene.size());
    let width = width as usize;
    let height = height as usize;
    let mut textures = HashMap::new();
    let mut last = None;

    for frame_index in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(width as f32, height as f32),
            )),
            time: Some(1.0),
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| gallery(ctx, state));
        apply_textures(&mut textures, &output.textures_delta);
        if scene_is_focused(scene) && frame_index == 0 {
            state.focus.focus_first();
        }
        last = Some(output);
    }

    let output = last.expect("two frames were rendered");
    let pixels_per_point = output.pixels_per_point;
    let primitives = ctx.tessellate(output.shapes, pixels_per_point);
    let mut pixels = vec![0u8; width * height * 4];
    let background = state.theme().palette.background;
    for pixel in pixels.chunks_exact_mut(4) {
        pixel.copy_from_slice(&[background.r(), background.g(), background.b(), 255]);
    }

    for primitive in primitives {
        let clip = primitive.clip_rect;
        let clip_min_x = (clip.min.x * pixels_per_point).floor().max(0.0) as i32;
        let clip_min_y = (clip.min.y * pixels_per_point).floor().max(0.0) as i32;
        let clip_max_x = (clip.max.x * pixels_per_point).ceil().min(width as f32) as i32;
        let clip_max_y = (clip.max.y * pixels_per_point).ceil().min(height as f32) as i32;
        if clip_max_x <= clip_min_x || clip_max_y <= clip_min_y {
            continue;
        }
        let Primitive::Mesh(mesh) = primitive.primitive else {
            continue;
        };
        let texture = textures.get(&mesh.texture_id);
        for triangle in mesh.indices.chunks_exact(3) {
            let a = mesh.vertices[triangle[0] as usize];
            let b = mesh.vertices[triangle[1] as usize];
            let c = mesh.vertices[triangle[2] as usize];
            raster_triangle(
                &mut pixels,
                width,
                height,
                (clip_min_x, clip_min_y, clip_max_x, clip_max_y),
                [a, b, c],
                texture,
                pixels_per_point,
            );
        }
    }

    (width, height, pixels)
}

fn scene_is_focused(scene: Scene) -> bool {
    matches!(scene, Scene::Focused)
}

#[allow(clippy::too_many_arguments)]
fn raster_triangle(
    pixels: &mut [u8],
    width: usize,
    height: usize,
    clip: (i32, i32, i32, i32),
    vertices: [egui::epaint::Vertex; 3],
    texture: Option<&Texture>,
    pixels_per_point: f32,
) {
    let points = vertices.map(|vertex| {
        (
            vertex.pos.x * pixels_per_point,
            vertex.pos.y * pixels_per_point,
            vertex.uv,
            vertex.color.to_array(),
        )
    });
    let (ax, ay, _, _) = points[0];
    let (bx, by, _, _) = points[1];
    let (cx, cy, _, _) = points[2];
    let area = edge(ax, ay, bx, by, cx, cy);
    if area.abs() < 0.0001 {
        return;
    }
    let min_x = ax.min(bx).min(cx).floor().max(clip.0 as f32) as i32;
    let max_x = ax.max(bx).max(cx).ceil().min(clip.2 as f32) as i32;
    let min_y = ay.min(by).min(cy).floor().max(clip.1 as f32) as i32;
    let max_y = ay.max(by).max(cy).ceil().min(clip.3 as f32) as i32;
    if max_x <= min_x || max_y <= min_y {
        return;
    }

    for y in min_y..max_y {
        for x in min_x..max_x {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let w0 = edge(bx, by, cx, cy, px, py) / area;
            let w1 = edge(cx, cy, ax, ay, px, py) / area;
            let w2 = edge(ax, ay, bx, by, px, py) / area;
            if w0 < -0.0001 || w1 < -0.0001 || w2 < -0.0001 {
                continue;
            }
            let u = points[0].2.x * w0 + points[1].2.x * w1 + points[2].2.x * w2;
            let v = points[0].2.y * w0 + points[1].2.y * w1 + points[2].2.y * w2;
            let mut color = [0u8; 4];
            for (channel, value) in color.iter_mut().enumerate() {
                *value = (points[0].3[channel] as f32 * w0
                    + points[1].3[channel] as f32 * w1
                    + points[2].3[channel] as f32 * w2)
                    .round()
                    .clamp(0.0, 255.0) as u8;
            }
            let sample = texture
                .map(|texture| texture.sample(u, v))
                .unwrap_or([255; 4]);
            let src = [
                ((color[0] as u16 * sample[0] as u16) / 255) as u8,
                ((color[1] as u16 * sample[1] as u16) / 255) as u8,
                ((color[2] as u16 * sample[2] as u16) / 255) as u8,
                ((color[3] as u16 * sample[3] as u16) / 255) as u8,
            ];
            if src[3] == 0 {
                continue;
            }
            let index = (y as usize * width + x as usize) * 4;
            let inverse = 255 - src[3] as u16;
            pixels[index] = (src[0] as u16 + pixels[index] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 1] =
                (src[1] as u16 + pixels[index + 1] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 2] =
                (src[2] as u16 + pixels[index + 2] as u16 * inverse / 255).min(255) as u8;
            pixels[index + 3] = 255;
        }
    }
    let _ = height;
}

fn edge(ax: f32, ay: f32, bx: f32, by: f32, px: f32, py: f32) -> f32 {
    (px - ax) * (by - ay) - (py - ay) * (bx - ax)
}

fn write_png(
    path: &Path,
    width: usize,
    height: usize,
    pixels: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let file = fs::File::create(path)?;
    let mut encoder = png::Encoder::new(file, width as u32, height as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header()?;
    writer.write_image_data(pixels)?;
    Ok(())
}

fn write_index(
    out: &Path,
    manifest: &[(Scene, Language, Appearance, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut scene_list = String::new();
    let mut seen = Vec::new();
    for (scene, _, _, _) in manifest {
        let id = scene.id();
        if !seen.contains(&id) {
            seen.push(id.clone());
            let _ = write!(
                scene_list,
                "<button class=\"scene\" data-scene=\"{}\">{}</button>",
                id,
                html_escape(&scene.title())
            );
        }
    }

    let mut shots = Vec::new();
    for (scene, language, appearance, file) in manifest {
        shots.push(format!(
            "{{scene:\"{}\",lang:\"{}\",theme:\"{}\",file:\"{}\"}}",
            scene.id(),
            language.as_str(),
            appearance_name(*appearance),
            file
        ));
    }

    let html = format!(
        r##"<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%237c9cff%22/><text x=%2216%22 y=%2222%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216%22 font-weight=%22bold%22 fill=%22%230b1020%22>S</text></svg>">
<title>SOCDOF Rust UI preview</title>
<style>
:root {{ color-scheme: dark; --bg:#0e1116; --panel:#171c24; --line:#2a3340; --text:#e8edf4; --muted:#93a0b3; --accent:#7c9cff; --accent-2:#b18cff; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:radial-gradient(1200px 700px at 80% -10%, #1d2b4d 0%, transparent 60%), var(--bg); color:var(--text); font:14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; }}
header {{ position:sticky; top:0; z-index:5; display:flex; gap:18px; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid var(--line); background:rgba(14,17,22,.88); backdrop-filter:blur(16px); }}
.brand {{ display:flex; flex-direction:column; gap:2px; }}
.brand strong {{ letter-spacing:.08em; font-size:15px; }}
.brand span {{ color:var(--muted); font-size:12px; }}
.controls {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
select, button {{ border:1px solid var(--line); border-radius:9px; background:var(--panel); color:var(--text); padding:8px 10px; font:inherit; }}
button {{ cursor:pointer; }}
button:hover, select:hover {{ border-color:var(--accent); }}
button.primary {{ background:linear-gradient(135deg,var(--accent),var(--accent-2)); color:#0b1020; border:0; font-weight:700; }}
main {{ display:grid; grid-template-columns:250px minmax(0,1fr); min-height:calc(100vh - 74px); }}
aside {{ border-right:1px solid var(--line); padding:16px; overflow:auto; max-height:calc(100vh - 74px); position:sticky; top:74px; }}
aside h2 {{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--muted); margin:0 0 10px; }}
.scene {{ display:block; width:100%; text-align:left; margin:2px 0; border-color:transparent; background:transparent; color:var(--muted); }}
.scene:hover {{ color:var(--text); background:var(--panel); }}
.scene.active {{ color:var(--text); border-color:var(--line); background:linear-gradient(90deg, rgba(124,156,255,.18), transparent); }}
.stage {{ padding:20px; }}
.meta {{ display:flex; gap:10px; align-items:center; justify-content:space-between; margin:0 0 12px; color:var(--muted); }}
.pill {{ border:1px solid var(--line); border-radius:999px; padding:4px 9px; font-size:12px; }}
.frame {{ border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#000; box-shadow:0 22px 70px rgba(0,0,0,.45); }}
img {{ display:block; width:100%; height:auto; }}
.nav {{ display:flex; gap:8px; }}
@media (max-width:800px) {{ main {{ grid-template-columns:1fr; }} aside {{ position:static; max-height:none; border-right:0; border-bottom:1px solid var(--line); display:flex; gap:6px; overflow-x:auto; }} aside h2 {{ display:none; }} .scene {{ width:auto; white-space:nowrap; }} }}
</style>
</head>
<body>
<header>
  <div class="brand"><strong>SOCDOF · Rust UI</strong><span>generated from the current egui build · v{version} · {count} images</span></div>
  <div class="controls">
    <select id="lang" aria-label="Language"><option value="de">Deutsch</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select>
    <select id="theme" aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option></select>
    <div class="nav"><button id="prev" title="Previous scene">←</button><button id="next" title="Next scene">→</button></div>
  </div>
</header>
<main>
  <aside><h2>Screens</h2>{scene_list}</aside>
  <section class="stage">
    <div class="meta"><div id="title"></div><div class="pill" id="filename"></div></div>
    <div class="frame"><img id="shot" alt="SOCDOF screen"></div>
  </section>
</main>
<script>
const shots = [{shots}];
const scenes = [...new Set(shots.map(s => s.scene))];
let state = {{ lang: "de", theme: "light", scene: "settings-general" }};
const saved = location.hash.slice(1).split("-");
if (saved.length >= 3) {{ state.lang = saved[0]; state.theme = saved[1]; state.scene = saved.slice(2).join("-"); }}
if (!scenes.includes(state.scene)) state.scene = scenes[0];
if (!["de","en","fr","es"].includes(state.lang)) state.lang = "de";
if (!["light","dark"].includes(state.theme)) state.theme = "light";
function current() {{ return shots.find(s => s.scene === state.scene && s.lang === state.lang && s.theme === state.theme); }}
function render() {{
  const shot = current();
  if (!shot) return;
  document.getElementById("shot").src = "images/" + shot.file;
  document.getElementById("shot").alt = shot.scene + " in " + shot.lang + " " + shot.theme;
  document.getElementById("filename").textContent = shot.file;
  document.getElementById("title").textContent = state.scene.replaceAll("-", " ") + " · " + state.lang.toUpperCase() + " · " + state.theme;
  document.querySelectorAll(".scene").forEach(button => button.classList.toggle("active", button.dataset.scene === state.scene));
  document.getElementById("lang").value = state.lang;
  document.getElementById("theme").value = state.theme;
  history.replaceState(null, "", "#" + state.lang + "-" + state.theme + "-" + state.scene);
}}
document.querySelectorAll(".scene").forEach(button => button.addEventListener("click", () => {{ state.scene = button.dataset.scene; render(); }}));
document.getElementById("lang").addEventListener("change", event => {{ state.lang = event.target.value; render(); }});
document.getElementById("theme").addEventListener("change", event => {{ state.theme = event.target.value; render(); }});
document.getElementById("prev").addEventListener("click", () => {{ const i = scenes.indexOf(state.scene); state.scene = scenes[(i - 1 + scenes.length) % scenes.length]; render(); }});
document.getElementById("next").addEventListener("click", () => {{ const i = scenes.indexOf(state.scene); state.scene = scenes[(i + 1) % scenes.length]; render(); }});
render();
</script>
</body>
</html>
"##,
        version = env!("CARGO_PKG_VERSION"),
        count = manifest.len(),
        scene_list = scene_list,
        shots = shots.join(","),
    );
    fs::write(out.join("index.html"), html)?;
    Ok(())
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
