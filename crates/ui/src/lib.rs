//! Rust UI layer for the SOCDOF rewrite.
//!
//! Phase 4 replaced the framework decision gate with a decision: the desktop interface is drawn by
//! **egui**, a pure Rust immediate-mode library. There is no JavaScript runtime, no WASM bundle and
//! no browser engine in the UI path, which is what the migration asks for. The reasoning is
//! recorded in [`docs/ui-decision.md`](../../../docs/ui-decision.md).
//!
//! The legacy `crates/app/ui` Vite/TypeScript app is the temporary frontend of the Tauri shell. It
//! stays only until the Rust UI offers the same screens, then it is deleted together with the npm
//! steps in CI. Nothing in this crate depends on it.
//!
//! This crate contains the foundation of that interface: design tokens ported from the legacy
//! stylesheet, the appearance/theme engine, the Rust-drawn icon set, the component kit with the
//! input controls, keyboard focus with token focus rings, a small form framework, the
//! four-language UI catalogue and the component gallery that renders every state. With the `window`
//! feature the gallery also runs as a real eframe window (`socdof-ui-gallery`); the default build
//! stays window free so tests need no desktop libraries.
//!
//! The primitives are pinned by deterministic snapshots ([`snapshot::capture`]): paint commands are
//! reduced to stable text and compared with golden files, so a geometry, color or text change is
//! caught without a display.

#![deny(missing_docs)]

pub mod accounting;
pub mod app_store;
pub mod appointments;
pub mod auth;
pub mod calendar;
pub mod components;
pub mod contacts;
pub mod controls;
pub mod dashboard;
pub mod desktop;
pub mod editor;
pub mod focus;
pub mod form;
pub mod gallery;
pub mod i18n;
pub mod icons;
pub mod invoices;
pub mod pos;
pub mod products;
pub mod purchases;
pub mod settings;
pub mod shell;
pub mod snapshot;
pub mod theme;
pub mod tokens;
pub mod users;
pub mod wallpaper;
pub mod widgets;

pub use accounting::{
    accounting, seed_accounting, AccountingDraft, AccountingState, AccountingTab, AccountingView,
};
pub use app_store::{app_store, AppStoreState};
pub use appointments::{
    appointments, seed_appointments, AppointmentDraft, AppointmentsDetail, AppointmentsState,
    AppointmentsView,
};
pub use auth::{auth, AuthState, AuthView, DEFAULT_IDLE_TIMEOUT_MS};
pub use calendar::CalendarState;
pub use components::{
    badge, button, card, empty_state, icon_button, modal, search_field, sort_header, tabs,
    Activated, ButtonVariant, SortState, Toast, Toasts, Tone,
};
pub use contacts::{contacts, seed_sample, ContactDraft, ContactsState, ContactsView};
pub use controls::{
    calendar, checkbox, drawer, drop_zone, menu, password_field, select, switch, text_field,
    CalendarLabels, DrawerLabels, PopupState,
};
pub use dashboard::{
    dashboard, DashboardAction, DashboardData, DashboardState, Period, SAMPLE_NOW_MS,
};
pub use desktop::{
    default_window_rect, desktop, format_clock, work_area, AppId, DesktopFrame, DesktopIcon,
    DesktopOutcome, IconGrid, OpenOutcome, SnapEdge, Window, WindowManager,
};
pub use editor::{
    editor, seed_documents, DocumentDraft, EditorState, SAMPLE_NOW_MS as EDITOR_SAMPLE_NOW_MS,
};
pub use focus::{focus_ring, FocusState};
pub use form::{CloseDecision, Field, FormState, UnsavedGuard};
pub use gallery::{gallery, GalleryState};
pub use i18n::{UiTexts, UI_KEYS};
pub use icons::{Icon, ALL_ICONS};
pub use invoices::{
    invoices, seed_invoices, InvoiceDraft, InvoiceLineDraft, InvoicesState, InvoicesView,
};
pub use pos::{pos, seed_pos, PosDraft, PosLineDraft, PosState, PosView};
pub use products::{products, seed_products, ProductDraft, ProductsState, ProductsView};
pub use purchases::{
    purchases, seed_purchases, PurchaseDraft, PurchaseLineDraft, PurchasesState, PurchasesView,
};
pub use settings::{
    seed_settings, settings, SettingsState, SettingsTab, SAMPLE_NOW_MS as SETTINGS_SAMPLE_NOW_MS,
};
pub use shell::{
    command_palette, onboarding, start_menu, tray_flyout, Command, CommandPalette, Onboarding,
    ShellAction, ShellState, StartMenu, Tray, TrayAction, COMMANDS,
};
pub use snapshot::{capture, PrimitiveState, SnapshotVariant};
pub use theme::{Appearance, Palette, Theme};
pub use tokens::{AccentPreset, CompanionColor};
pub use users::{seed_users, users, UserDraft, UsersState, UsersView};
pub use wallpaper::{Wallpaper, WallpaperFit, WallpaperState};
pub use widgets::{widgets, Connection, WidgetLayer};
