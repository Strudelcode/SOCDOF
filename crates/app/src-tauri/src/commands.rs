//! Tauri commands exposed to the SOCDOF frontend.
//!
//! Every command delegates to [`socdof_app::desktop::DesktopState`]; no SQL, file format or business
//! rule is implemented here.
//!
//! The `*_smoke` commands are only active when `SOCDOF_SMOKE_REPORT` is set. They let CI start the
//! real WebView, invoke the normal commands from the loaded frontend, persist the returned values and
//! terminate with a status that reflects whether the runtime contract held.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use socdof_app::desktop::{
    AppStoreModuleView, AppointmentInput, BackupFileView, BackupReport, ContactInput, DesktopState,
    DocumentInput, DashboardView, JournalInput, PosInput, PosOverviewView, PosView, ProductInput,
    PurchaseInput, RestoreReport, StorageInspectorView, SupportTicketInput, SupportTimeInput,
    TherapyClientInput, TherapySessionInput,
    UserInput, UserView,
};
use socdof_app::dialogs::{self, DialogKind, DialogOutcome};
use socdof_app::external_assets::{
    self, ExternalFlag, ExternalLanguage, ExternalTemplate, ExternalTemplateContent,
};
use socdof_app::fleet_bridge::{FleetFuelInput, FleetTripInput, FleetVehicleInput};
use socdof_app::invoice_bridge::{
    ContactMailView, FatturaInput, InvoiceDefaults, InvoiceDunningView, InvoiceExportReport,
    InvoiceFatturaView, InvoiceInput, InvoiceMailView, InvoicePaymentView, InvoicePreview,
    InvoiceView,
};
use socdof_app::project_bridge::{ProjectInput, ProjectTaskInput};
use socdof_app::restaurant_bridge::{MenuItemInput, RestaurantCheckoutInput};
use socdof_app::shell::ShellStatus;
use socdof_app::shortcuts::{
    self, AppAction, Key, KeyChord, Modifiers, ShortcutContext, ShortcutOutcome,
};
use socdof_app::template_bridge::InvoiceTemplateBookView;
use socdof_app::tray;
use socdof_core::backup::BackupMetadata;
use socdof_core::domain::accounting::{CashBookRow, JournalEntry, JournalSummary};
use socdof_core::domain::appointment::Appointment;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::purchase::PurchaseOrder;
use socdof_core::store::reports::Report;
use socdof_core::domain::countries::{self as countries, Country};
use socdof_core::domain::document::Document;
use socdof_core::domain::label::{LabelFormat, ProductLabel};
use socdof_core::domain::product::Product;
use socdof_core::domain::reorder::{self, ReorderPlan, Threshold};
use socdof_core::domain::settings::{CompanyProfile, Language};
use socdof_core::invoice_template::{StationeryToken, STATIONERY_TOKEN_KEYS};
use socdof_core::legacy::{LegacyExportReport, LegacyImportReport};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use uuid::Uuid;

const SMOKE_REPORT_ENV: &str = "SOCDOF_SMOKE_REPORT";

/// Returns whether the runtime smoke mode is enabled.
#[tauri::command]
pub fn smoke_enabled() -> bool {
    smoke_report_path().is_some()
}

/// Lists local accounts.
#[tauri::command]
pub fn users(state: tauri::State<'_, DesktopState>) -> Result<Vec<UserView>, String> {
    state.users().map_err(|error| error.to_string())
}

/// Creates or updates a local account.
#[tauri::command]
pub fn save_user(
    state: tauri::State<'_, DesktopState>,
    input: UserInput,
) -> Result<UserView, String> {
    state.save_user(&input).map_err(|error| error.to_string())
}

/// Deletes a local account.
#[tauri::command]
pub fn delete_user(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.delete_user(id).map_err(|error| error.to_string())
}

/// Verifies the login gate credentials.
#[tauri::command]
pub fn login_user(
    state: tauri::State<'_, DesktopState>,
    username: String,
    password: String,
) -> Result<UserView, String> {
    state
        .login_user(&username, &password)
        .map_err(|error| error.to_string())
}

/// Database path, size and row counts for Settings.
#[tauri::command]
pub fn storage_inspector(
    state: tauri::State<'_, DesktopState>,
) -> Result<StorageInspectorView, String> {
    state
        .storage_inspector()
        .map_err(|error| error.to_string())
}

/// Dashboard key figures and the lists shown on the first screen.
#[tauri::command]
pub fn dashboard(
    state: tauri::State<'_, DesktopState>,
    from: i64,
    to: i64,
    now: i64,
) -> Result<DashboardView, String> {
    state
        .dashboard(from, to, now)
        .map_err(|error| error.to_string())
}

/// Lists POS receipts and summarizes the requested period.
#[tauri::command]
pub fn pos_overview(
    state: tauri::State<'_, DesktopState>,
    from: i64,
    to: i64,
    query: Option<String>,
) -> Result<PosOverviewView, String> {
    state
        .pos_overview(from, to, query.as_deref())
        .map_err(|error| error.to_string())
}

/// Stores a POS receipt.
#[tauri::command]
pub fn save_pos(
    state: tauri::State<'_, DesktopState>,
    input: PosInput,
) -> Result<PosView, String> {
    state.save_pos(&input).map_err(|error| error.to_string())
}

/// Cancels a POS receipt.
#[tauri::command]
pub fn cancel_pos(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.cancel_pos(id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn support_tickets(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
) -> Result<Vec<socdof_core::domain::support::SupportTicket>, String> {
    state.support_tickets(query.as_deref()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_support_ticket(
    state: tauri::State<'_, DesktopState>,
    input: SupportTicketInput,
) -> Result<socdof_core::domain::support::SupportTicket, String> {
    state.save_support_ticket(&input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_support_ticket_status(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    status: String,
) -> Result<socdof_core::domain::support::SupportTicket, String> {
    state.set_support_ticket_status(id, &status).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_support_ticket(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.delete_support_ticket(id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn support_time_entries(
    state: tauri::State<'_, DesktopState>,
    ticket_id: Uuid,
) -> Result<Vec<socdof_core::domain::support::TimeEntry>, String> {
    state.support_time_entries(ticket_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_support_time(
    state: tauri::State<'_, DesktopState>,
    input: SupportTimeInput,
) -> Result<socdof_core::domain::support::TimeEntry, String> {
    state.save_support_time(&input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn therapy_clients(state: tauri::State<'_, DesktopState>) -> Result<Vec<socdof_core::domain::therapy::TherapyClient>, String> {
    state.therapy_clients().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_therapy_client(state: tauri::State<'_, DesktopState>, input: TherapyClientInput) -> Result<socdof_core::domain::therapy::TherapyClient, String> {
    state.save_therapy_client(&input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn therapy_sessions(state: tauri::State<'_, DesktopState>, client_id: Uuid) -> Result<Vec<socdof_core::domain::therapy::TherapySession>, String> {
    state.therapy_sessions(client_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_therapy_client(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.delete_therapy_client(id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_therapy_session(state: tauri::State<'_, DesktopState>, input: TherapySessionInput) -> Result<socdof_core::domain::therapy::TherapySession, String> {
    state.save_therapy_session(&input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_therapy_session(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.delete_therapy_session(id).map_err(|error| error.to_string())
}

/// Returns the schema version, row counts and lock owner of the open database.
#[tauri::command]
pub fn database_status(state: tauri::State<'_, DesktopState>) -> Result<ShellStatus, String> {
    let status = state.status().map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE database_status schema_version={} database={}",
            status.schema_version,
            status.database.display()
        ));
    }
    Ok(status)
}

/// Writes a backup next to the database and returns its path and sizes.
#[tauri::command]
pub fn create_backup(state: tauri::State<'_, DesktopState>) -> Result<BackupReport, String> {
    let report = state.backup(None).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE create_backup path={} bytes={} database_bytes={}",
            report.path.display(),
            report.bytes,
            report.database_bytes
        ));
    }
    Ok(report)
}

/// Lists the valid backup archives in the configured backup folder.
#[tauri::command]
pub fn backup_files(state: tauri::State<'_, DesktopState>) -> Result<Vec<BackupFileView>, String> {
    if smoke_report_path().is_some() {
        smoke_log("SOCDOF_SMOKE backup_files_enter");
    }
    let files = state
        .backup_files()
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!("SOCDOF_SMOKE backup_files_count count={}", files.len()));
    }
    Ok(files)
}

/// Writes a backup to a path chosen by the user.
#[tauri::command]
pub fn save_backup_to_disk(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<BackupReport, String> {
    state
        .save_backup_to(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Opens the configured backup folder in the OS file manager.
#[tauri::command]
pub fn open_backup_folder(path: String) -> Result<(), String> {
    external_assets::open_folder(Path::new(&path)).map_err(|error| error.to_string())
}

/// Opens a folder picker for the backup directory.
#[tauri::command]
pub fn select_backup_folder(app: tauri::AppHandle) -> DialogReply {
    pick_folder(app)
}

/// Loads the active company profile.
#[tauri::command]
pub fn company_profile(state: tauri::State<'_, DesktopState>) -> Result<CompanyProfile, String> {
    state.company_profile().map_err(|error| error.to_string())
}

/// Validates and stores the active company profile.
#[tauri::command]
pub fn save_company_profile(
    state: tauri::State<'_, DesktopState>,
    profile: CompanyProfile,
) -> Result<(), String> {
    state
        .save_company_profile(&profile)
        .map_err(|error| error.to_string())
}

/// Lists appointments overlapping a range.
#[tauri::command]
pub fn appointments(
    state: tauri::State<'_, DesktopState>,
    from: i64,
    to: i64,
) -> Result<Vec<Appointment>, String> {
    state
        .appointments_between(from, to)
        .map_err(|error| error.to_string())
}

/// Creates or updates an appointment.
#[tauri::command]
pub fn save_appointment(
    state: tauri::State<'_, DesktopState>,
    input: AppointmentInput,
) -> Result<Appointment, String> {
    state
        .save_appointment(&input)
        .map_err(|error| error.to_string())
}

/// Deletes an appointment.
#[tauri::command]
pub fn delete_appointment(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_appointment(id)
        .map_err(|error| error.to_string())
}

/// Lists journal entries, optionally filtered by a search term.
#[tauri::command]
pub fn journal_entries(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
) -> Result<Vec<JournalEntry>, String> {
    state
        .journal_entries(query.as_deref())
        .map_err(|error| error.to_string())
}

/// Summarises the journal for the BWA.
#[tauri::command]
pub fn journal_summary(state: tauri::State<'_, DesktopState>) -> Result<JournalSummary, String> {
    state.journal_summary().map_err(|error| error.to_string())
}

/// Builds the cash book with its running balance.
#[tauri::command]
pub fn journal_cash_book(state: tauri::State<'_, DesktopState>) -> Result<Vec<CashBookRow>, String> {
    state
        .journal_cash_book()
        .map_err(|error| error.to_string())
}

/// Creates or updates a journal entry.
#[tauri::command]
pub fn save_journal_entry(
    state: tauri::State<'_, DesktopState>,
    input: JournalInput,
) -> Result<JournalEntry, String> {
    state
        .save_journal_entry(&input)
        .map_err(|error| error.to_string())
}

/// Deletes a journal entry.
#[tauri::command]
pub fn delete_journal_entry(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_journal_entry(id)
        .map_err(|error| error.to_string())
}

/// Writes the journal as CSV and returns the byte count.
#[tauri::command]
pub fn export_journal_csv(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<usize, String> {
    state
        .export_journal_csv(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Lists purchase orders, optionally filtered by a search term.
#[tauri::command]
pub fn purchase_orders(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
) -> Result<Vec<PurchaseOrder>, String> {
    state
        .purchase_orders(query.as_deref())
        .map_err(|error| error.to_string())
}

/// Creates or updates a purchase order.
#[tauri::command]
pub fn save_purchase_order(
    state: tauri::State<'_, DesktopState>,
    input: PurchaseInput,
) -> Result<PurchaseOrder, String> {
    state
        .save_purchase_order(&input)
        .map_err(|error| error.to_string())
}

/// Deletes a purchase order.
#[tauri::command]
pub fn delete_purchase_order(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_purchase_order(id)
        .map_err(|error| error.to_string())
}

/// Changes the lifecycle state of a purchase order.
#[tauri::command]
pub fn set_purchase_order_status(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    status: String,
) -> Result<(), String> {
    state
        .set_purchase_order_status(id, &status)
        .map_err(|error| error.to_string())
}

/// Books a purchase order into stock.
#[tauri::command]
pub fn receive_purchase_order(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .receive_purchase_order(id)
        .map_err(|error| error.to_string())
}

/// Builds the invoice report for a period.
#[tauri::command]
pub fn report(
    state: tauri::State<'_, DesktopState>,
    from: i64,
    to: i64,
) -> Result<Report, String> {
    state.report(from, to).map_err(|error| error.to_string())
}

/// Loads the AppStore catalogue.
#[tauri::command]
pub fn app_store_modules(
    state: tauri::State<'_, DesktopState>,
) -> Result<Vec<AppStoreModuleView>, String> {
    state
        .app_store_modules()
        .map_err(|error| error.to_string())
}

/// Activates or deactivates one AppStore module.
#[tauri::command]
pub fn app_store_set_active(
    state: tauri::State<'_, DesktopState>,
    id: String,
    active: bool,
) -> Result<(), String> {
    state
        .set_app_store_module(&id, active)
        .map_err(|error| error.to_string())
}

/// Verifies a native backup archive without writing anything.
#[tauri::command]
pub fn verify_backup(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<BackupMetadata, String> {
    state
        .verify_backup(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Restores a backup over the open database.
#[tauri::command]
pub fn restore_backup(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<RestoreReport, String> {
    state
        .restore_backup(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Lists all documents of the text editor.
#[tauri::command]
pub fn list_documents(state: tauri::State<'_, DesktopState>) -> Result<Vec<Document>, String> {
    state.documents().map_err(|error| error.to_string())
}

/// Creates or updates a document.
#[tauri::command]
pub fn save_document(
    state: tauri::State<'_, DesktopState>,
    input: DocumentInput,
) -> Result<Document, String> {
    state
        .save_document(&input)
        .map_err(|error| error.to_string())
}

/// Deletes a document.
#[tauri::command]
pub fn delete_document(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_document(id)
        .map_err(|error| error.to_string())
}

/// Textwerk open dialog with the document extensions.
#[tauri::command]
pub fn textwerk_open_dialog(app: tauri::AppHandle) -> DialogReply {
    pick_open_file(
        app,
        vec![
            "txt".to_string(),
            "md".to_string(),
            "markdown".to_string(),
            "json".to_string(),
        ],
    )
}

/// Textwerk save dialog with a document suggestion.
#[tauri::command]
pub fn textwerk_save_dialog(app: tauri::AppHandle, suggested_name: String) -> DialogReply {
    pick_save_file(app, suggested_name)
}

/// Whether the window is fullscreen.
#[tauri::command]
pub fn window_is_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_fullscreen().map_err(|error| error.to_string())
}

/// Sets the window fullscreen state.
#[tauri::command]
pub fn window_set_fullscreen(window: tauri::WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| error.to_string())
}

/// Toggles the window fullscreen state and returns the new value.
#[tauri::command]
pub fn window_toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let next = !window.is_fullscreen().map_err(|error| error.to_string())?;
    window
        .set_fullscreen(next)
        .map_err(|error| error.to_string())?;
    Ok(next)
}

/// Whether the window is maximized.
#[tauri::command]
pub fn window_is_maximized(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|error| error.to_string())
}

/// Toggles the window maximized state and returns the new value.
#[tauri::command]
pub fn window_toggle_maximize(window: tauri::WebviewWindow) -> Result<bool, String> {
    let maximized = window.is_maximized().map_err(|error| error.to_string())?;
    if maximized {
        window.unmaximize().map_err(|error| error.to_string())?;
    } else {
        window.maximize().map_err(|error| error.to_string())?;
    }
    Ok(!maximized)
}

/// Close the desktop window.
#[tauri::command]
pub fn window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

/// Minimizes the window.
#[tauri::command]
pub fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

/// Returns the invoice template book in the TypeScript field format.
#[tauri::command]
pub fn invoice_templates(
    state: tauri::State<'_, DesktopState>,
) -> Result<InvoiceTemplateBookView, String> {
    let book = state
        .invoice_template_book()
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE invoice_templates count={} active={}",
            book.templates.len(),
            book.active_id
        ));
    }
    Ok(book)
}

/// Validates and stores a template book sent by the webview.
#[tauri::command]
pub fn save_invoice_templates(
    state: tauri::State<'_, DesktopState>,
    book: InvoiceTemplateBookView,
) -> Result<(), String> {
    state
        .save_invoice_template_book(&book)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE save_invoice_templates count={} active={}",
            book.templates.len(),
            book.active_id
        ));
    }
    Ok(())
}

/// Stationery token keys offered by the template editor.
///
/// The list comes from the core, so the webview dropdown and the export resolve the same keys.
#[tauri::command]
pub fn template_token_keys() -> Vec<&'static str> {
    STATIONERY_TOKEN_KEYS.to_vec()
}

/// The seven TypeScript default stationery fields of the "Standardfelder" button.
#[tauri::command]
pub fn template_default_stationery_tokens() -> Vec<StationeryToken> {
    socdof_core::invoice_template::default_stationery_tokens()
}

/// Lists invoices in the webview format, optionally searched and filtered by status.
#[tauri::command]
pub fn list_invoices(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
    status: Option<String>,
) -> Result<Vec<InvoiceView>, String> {
    let invoices = state
        .invoice_views(query.as_deref(), status.as_deref())
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE list_invoices count={} query={} status={}",
            invoices.len(),
            query.as_deref().unwrap_or("-"),
            status.as_deref().unwrap_or("-")
        ));
    }
    Ok(invoices)
}

/// Loads one invoice with the customer labels and totals.
#[tauri::command]
pub fn invoice_detail(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<InvoiceView, String> {
    state.invoice(id).map_err(|error| error.to_string())
}

/// Returns the defaults of a new invoice.
#[tauri::command]
pub fn invoice_defaults(state: tauri::State<'_, DesktopState>) -> Result<InvoiceDefaults, String> {
    state.invoice_defaults().map_err(|error| error.to_string())
}

/// Creates or replaces an invoice from the editor.
#[tauri::command]
pub fn save_invoice(
    state: tauri::State<'_, DesktopState>,
    input: InvoiceInput,
) -> Result<InvoiceView, String> {
    let view = state
        .save_invoice(&input)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE save_invoice number={} items={} total={}",
            view.number,
            view.items.len(),
            view.total_cents
        ));
    }
    Ok(view)
}

/// Deletes an invoice and its positions.
#[tauri::command]
pub fn delete_invoice(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state.delete_invoice(id).map_err(|error| error.to_string())
}

/// Moves an invoice to another lifecycle state.
#[tauri::command]
pub fn set_invoice_status(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    status: String,
) -> Result<InvoiceView, String> {
    state
        .set_invoice_status(id, &status)
        .map_err(|error| error.to_string())
}

/// Renders the preview of one invoice with the selected template.
#[tauri::command]
pub fn invoice_preview(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    template_id: Option<String>,
) -> Result<InvoicePreview, String> {
    let preview = state
        .invoice_preview(id, template_id.as_deref())
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE invoice_preview template={} html_bytes={} tokens={}",
            preview.template_id,
            preview.html.len(),
            preview.tokens.len()
        ));
    }
    Ok(preview)
}

/// Writes an invoice as PDF or DOCX with the selected template.
#[tauri::command]
pub fn export_invoice(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    template_id: Option<String>,
    format: String,
    path: Option<String>,
) -> Result<InvoiceExportReport, String> {
    let report = state
        .export_invoice(
            id,
            template_id.as_deref(),
            &format,
            path.as_deref().map(|path| Path::new(path)),
        )
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE export_invoice format={} path={} bytes={}",
            report.format,
            report.path.display(),
            report.bytes
        ));
    }
    Ok(report)
}

/// Lists contacts with an optional search query.
#[tauri::command]
pub fn list_contacts(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
) -> Result<Vec<Contact>, String> {
    state
        .contacts(query.as_deref())
        .map_err(|error| error.to_string())
}

/// Creates a contact.
#[tauri::command]
pub fn create_contact(
    state: tauri::State<'_, DesktopState>,
    input: ContactInput,
) -> Result<Contact, String> {
    let contact = state
        .create_contact(&input)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE create_contact id={} name={}",
            contact.id,
            contact.display_name()
        ));
    }
    Ok(contact)
}

/// Updates a contact.
#[tauri::command]
pub fn update_contact(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    input: ContactInput,
) -> Result<Contact, String> {
    let contact = state
        .update_contact(id, &input)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE update_contact id={} name={}",
            contact.id,
            contact.display_name()
        ));
    }
    Ok(contact)
}

/// Deletes a contact.
#[tauri::command]
pub fn delete_contact(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_contact(id)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!("SOCDOF_SMOKE delete_contact id={id}"));
    }
    Ok(())
}

/// One entry of the country suggestion list of the contact form.
#[derive(Serialize)]
pub struct CountrySuggestion {
    /// ISO 3166-1 alpha-2 code.
    pub code: &'static str,
    /// Country name in the requested language.
    pub name: &'static str,
    /// Flag emoji.
    pub flag: &'static str,
}

/// Searches the country list for the contact address form.
///
/// The matching lives in `socdof_core::domain::countries` and mirrors `searchCountries()` of the
/// legacy app, so the frontend only renders what the core returns.
#[tauri::command]
pub fn search_countries(query: String, language: Option<String>) -> Vec<CountrySuggestion> {
    let language = language
        .as_deref()
        .and_then(Language::from_storage)
        .unwrap_or_default();
    countries::search_countries(&query, language)
        .into_iter()
        .map(|country: &Country| CountrySuggestion {
            code: country.code,
            name: country.localized_name(language),
            flag: country.flag,
        })
        .collect()
}

/// Lists products with an optional search query.
#[tauri::command]
pub fn list_products(
    state: tauri::State<'_, DesktopState>,
    query: Option<String>,
) -> Result<Vec<Product>, String> {
    state
        .products(query.as_deref())
        .map_err(|error| error.to_string())
}

/// Creates a product.
#[tauri::command]
pub fn create_product(
    state: tauri::State<'_, DesktopState>,
    input: ProductInput,
) -> Result<Product, String> {
    let product = state
        .create_product(&input)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE create_product id={} name={} sku={}",
            product.id, product.name, product.sku
        ));
    }
    Ok(product)
}

/// Updates a product.
#[tauri::command]
pub fn update_product(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    input: ProductInput,
) -> Result<Product, String> {
    let product = state
        .update_product(id, &input)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE update_product id={} name={} sku={}",
            product.id, product.name, product.sku
        ));
    }
    Ok(product)
}

/// Deletes a product.
#[tauri::command]
pub fn delete_product(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_product(id)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!("SOCDOF_SMOKE delete_product id={id}"));
    }
    Ok(())
}

/// Imports a legacy `.socdof.json` backup.
#[tauri::command]
pub fn import_legacy_backup(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<LegacyImportReport, String> {
    state
        .import_legacy_backup(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Exports a legacy `.socdof.json` backup.
#[tauri::command]
pub fn export_legacy_backup(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<LegacyExportReport, String> {
    state
        .export_legacy_backup(Path::new(&path))
        .map_err(|error| error.to_string())
}

/// The values the loaded frontend received from `database_status`, the master-data commands and
/// `create_backup`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SmokeReport {
    /// Schema version returned by `database_status`.
    pub schema_version: i64,
    /// Database path returned by `database_status`.
    pub database: String,
    /// Backup path returned by `create_backup`.
    pub backup_path: String,
    /// Number of bytes written by `create_backup`.
    pub backup_bytes: u64,
    /// Display name of the contact kept by the smoke run.
    #[serde(default)]
    pub contact_name: String,
    /// SKU of the product kept by the smoke run.
    #[serde(default)]
    pub product_sku: String,
    /// Number of contacts after the smoke CRUD operations.
    #[serde(default)]
    pub contact_count: i64,
    /// Number of products after the smoke CRUD operations.
    #[serde(default)]
    pub product_count: i64,
}

/// Verifies the frontend report against the live desktop state and writes it for CI.
///
/// This command exists only for the Xvfb smoke run. It refuses to run without
/// `SOCDOF_SMOKE_REPORT`, validates every value against the live database, writes the JSON report
/// and exits the application with code 0. Any mismatch produces a report with an `error` field and
/// exits with code 1.
#[tauri::command]
pub fn finish_smoke(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
    report: SmokeReport,
) -> Result<(), String> {
    let Some(path) = smoke_report_path() else {
        return Err("smoke mode is not enabled".to_string());
    };

    if let Err(error) = validate_smoke_report(&state, &report) {
        smoke_log(&format!("SOCDOF_SMOKE_FAILED error={error}"));
        let _ = std::fs::write(&path, serde_json::json!({ "error": &error }).to_string());
        app.exit(1);
        return Err(error);
    }

    let json = serde_json::to_vec_pretty(&report).map_err(|error| error.to_string())?;
    if let Err(error) = std::fs::write(&path, json) {
        smoke_log(&format!("SOCDOF_SMOKE_FAILED error={error}"));
        app.exit(1);
        return Err(error.to_string());
    }

    smoke_log(&format!(
        "SOCDOF_SMOKE_OK schema_version={} database={} backup_path={} backup_bytes={} \
         contacts={} products={} contact_name={} product_sku={}",
        report.schema_version,
        report.database,
        report.backup_path,
        report.backup_bytes,
        report.contact_count,
        report.product_count,
        report.contact_name,
        report.product_sku
    ));
    app.exit(0);
    Ok(())
}

/// Logs a marker emitted by the headless webview smoke scenario.
///
/// The marker is only available while `SOCDOF_SMOKE_REPORT` is set; it lets the runner prove that
/// the real navigation and form flows reached the rendered views.
#[tauri::command]
pub fn smoke_ui_marker(marker: String) -> Result<(), String> {
    if smoke_report_path().is_none() {
        return Err("smoke mode is not enabled".to_string());
    }
    smoke_log(&format!("SOCDOF_SMOKE_UI {marker}"));
    Ok(())
}

/// Aborts the smoke run with an error report when the frontend could not invoke a command.
#[tauri::command]
pub fn abort_smoke(app: tauri::AppHandle, message: String) -> Result<(), String> {
    let Some(path) = smoke_report_path() else {
        return Err("smoke mode is not enabled".to_string());
    };

    smoke_log(&format!("SOCDOF_SMOKE_FAILED error={message}"));
    let _ = std::fs::write(&path, serde_json::json!({ "error": &message }).to_string());
    app.exit(1);
    Ok(())
}

fn smoke_report_path() -> Option<PathBuf> {
    std::env::var_os(SMOKE_REPORT_ENV).map(PathBuf::from)
}

fn smoke_log(message: &str) {
    println!("{message}");
    let _ = std::io::stdout().flush();
}

fn validate_smoke_report(state: &DesktopState, report: &SmokeReport) -> Result<(), String> {
    let status = state.status().map_err(|error| error.to_string())?;

    if status.schema_version != report.schema_version {
        return Err(format!(
            "schema version mismatch: live={} reported={}",
            status.schema_version, report.schema_version
        ));
    }
    if status.database.as_path() != Path::new(&report.database) {
        return Err(format!(
            "database path mismatch: live={} reported={}",
            status.database.display(),
            report.database
        ));
    }

    let contacts = state
        .contacts(Some(&report.contact_name))
        .map_err(|error| error.to_string())?;
    if contacts.is_empty() {
        return Err(format!("smoke contact is missing: {}", report.contact_name));
    }
    let products = state
        .products(Some(&report.product_sku))
        .map_err(|error| error.to_string())?;
    if products.is_empty() {
        return Err(format!("smoke product is missing: {}", report.product_sku));
    }
    if report.contact_count < 1 || report.product_count < 1 {
        return Err(format!(
            "smoke counts are empty: contacts={} products={}",
            report.contact_count, report.product_count
        ));
    }
    if contacts.len() < 1 || products.len() < 1 {
        return Err("smoke search did not return data".to_string());
    }

    let backup = Path::new(&report.backup_path);
    let metadata =
        std::fs::metadata(backup).map_err(|error| format!("backup is missing: {error}"))?;
    if !metadata.is_file() {
        return Err(format!("backup is not a file: {}", backup.display()));
    }
    if metadata.len() == 0 || report.backup_bytes == 0 {
        return Err("backup is empty".to_string());
    }
    if metadata.len() != report.backup_bytes {
        return Err(format!(
            "backup size mismatch: file={} reported={}",
            metadata.len(),
            report.backup_bytes
        ));
    }

    let mut magic = [0u8; 8];
    std::fs::File::open(backup)
        .and_then(|mut file| file.read_exact(&mut magic))
        .map_err(|error| format!("backup cannot be read: {error}"))?;
    if &magic != b"SOCDOFBK" {
        return Err("backup does not start with the SOCDOF container magic".to_string());
    }

    Ok(())
}

/// Key event reported by the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct ShortcutEvent {
    /// `event.key` as reported by the web layer.
    pub key: String,
    /// Ctrl (or Cmd).
    #[serde(default)]
    pub control: bool,
    /// Shift.
    #[serde(default)]
    pub shift: bool,
    /// Alt.
    #[serde(default)]
    pub alt: bool,
    /// Meta/Cmd.
    #[serde(default)]
    pub meta: bool,
    /// Whether the key is held down (`event.repeat`).
    #[serde(default)]
    pub repeat: bool,
}

/// Returns whether the smoke run should stay open instead of finishing the contract.
#[tauri::command]
pub fn smoke_idle() -> bool {
    std::env::var_os("SOCDOF_SMOKE_IDLE").is_some()
}

/// Resolves one key event through [`socdof_app::shortcuts`] and performs window actions.
///
/// The decision (binding, repeat, locked context) comes from the tested module; this command only
/// performs what the decision allows.
#[tauri::command]
pub fn dispatch_shortcut(app: tauri::AppHandle, event: ShortcutEvent) -> ShortcutOutcome {
    let chord = KeyChord::new(
        Key::from_name(&event.key),
        Modifiers {
            control: event.control,
            shift: event.shift,
            alt: event.alt,
            meta: event.meta,
        },
    );
    let context = if std::env::var_os("SOCDOF_SMOKE_LOCKED").is_some() {
        ShortcutContext::locked()
    } else {
        ShortcutContext::ready()
    };
    let outcome = shortcuts::resolve(context, &shortcuts::default_bindings(), chord, event.repeat);
    if smoke_report_path().is_some() {
        println!("{}", shortcuts::marker(chord, outcome));
    }
    if let ShortcutOutcome::Action {
        action: AppAction::ToggleFullscreen,
    } = outcome
    {
        if let Some(window) = app.get_webview_window("main") {
            let fullscreen = window.is_fullscreen().unwrap_or(false);
            let _ = window.set_fullscreen(!fullscreen);
        }
    }
    outcome
}

/// Reply of a native dialog request.
#[derive(Debug, Clone, Serialize)]
pub struct DialogReply {
    /// `chosen`, `cancelled`, `acknowledged` or `error`.
    pub outcome: String,
    /// Chosen path, if any.
    pub path: Option<String>,
    /// Validation error code, if any.
    pub error: Option<String>,
}

/// Runs the shared validation for `kind` and reports it in smoke mode.
fn dialog_reply(kind: &DialogKind, selection: Option<PathBuf>) -> DialogReply {
    let result = dialogs::resolve(kind, selection);
    if smoke_report_path().is_some() {
        smoke_log(&dialogs::marker(kind, &result));
    }
    match result {
        Ok(DialogOutcome::Path(path)) => DialogReply {
            outcome: "chosen".to_string(),
            path: Some(path.display().to_string()),
            error: None,
        },
        Ok(DialogOutcome::Cancelled) => DialogReply {
            outcome: "cancelled".to_string(),
            path: None,
            error: None,
        },
        Ok(DialogOutcome::Acknowledged) => DialogReply {
            outcome: "acknowledged".to_string(),
            path: None,
            error: None,
        },
        Ok(DialogOutcome::Confirmed) => DialogReply {
            outcome: "confirmed".to_string(),
            path: None,
            error: None,
        },
        Ok(DialogOutcome::Declined) => DialogReply {
            outcome: "declined".to_string(),
            path: None,
            error: None,
        },
        Err(error) => DialogReply {
            outcome: "error".to_string(),
            path: None,
            error: Some(error.as_str().to_string()),
        },
    }
}

/// Reads a canned selection from the environment so CI can exercise the bridge.
fn smoke_selection(variable: &str) -> Option<Option<PathBuf>> {
    if smoke_report_path().is_none() {
        return None;
    }
    std::env::var_os(variable).map(|value| {
        if value == "cancel" {
            None
        } else {
            Some(PathBuf::from(value))
        }
    })
}

/// Opens the folder picker.
#[tauri::command]
pub fn pick_folder(app: tauri::AppHandle) -> DialogReply {
    let selection = smoke_selection("SOCDOF_SMOKE_DIALOG_FOLDER").unwrap_or_else(|| {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .and_then(|path| path.into_path().ok())
    });
    dialog_reply(&DialogKind::Folder, selection)
}

/// Opens the file picker and validates the chosen path.
#[tauri::command]
pub fn pick_open_file(app: tauri::AppHandle, extensions: Vec<String>) -> DialogReply {
    let kind = DialogKind::OpenFile {
        extensions: extensions.clone(),
    };
    let selection = smoke_selection("SOCDOF_SMOKE_DIALOG_OPEN").unwrap_or_else(|| {
        let mut builder = app.dialog().file();
        if !extensions.is_empty() {
            let allowed: Vec<&str> = extensions.iter().map(String::as_str).collect();
            builder = builder.add_filter("Supported files", &allowed);
        }
        builder
            .blocking_pick_file()
            .and_then(|path| path.into_path().ok())
    });
    dialog_reply(&kind, selection)
}

/// Opens the save dialog with a proposed name and validates the chosen target.
#[tauri::command]
pub fn pick_save_file(app: tauri::AppHandle, suggested_name: String) -> DialogReply {
    let kind = DialogKind::SaveFile {
        suggested_name: suggested_name.clone(),
    };
    let selection = smoke_selection("SOCDOF_SMOKE_DIALOG_SAVE").unwrap_or_else(|| {
        app.dialog()
            .file()
            .set_file_name(&suggested_name)
            .blocking_save_file()
            .and_then(|path| path.into_path().ok())
    });
    dialog_reply(&kind, selection)
}

/// Shows a message box.
#[tauri::command]
pub fn show_message(app: tauri::AppHandle, text: String, title: String) -> DialogReply {
    if smoke_selection("SOCDOF_SMOKE_DIALOG_MESSAGE").is_none() {
        app.dialog().message(&text).title(&title).blocking_show();
    }
    dialog_reply(&DialogKind::Message, None)
}

/// Shows a native yes/no confirmation and returns the user's decision.
///
/// The TypeScript webview uses `window.confirm`; the desktop port uses the platform dialog plugin
/// so the decision is native and testable. Smoke runs read `SOCDOF_SMOKE_DIALOG_CONFIRM`
/// (`yes`, `no`, `cancel`) instead of opening a window.
#[tauri::command]
pub fn confirm_message(app: tauri::AppHandle, text: String, title: String) -> DialogReply {
    let answer = if smoke_report_path().is_some() {
        match std::env::var("SOCDOF_SMOKE_DIALOG_CONFIRM").as_deref() {
            Ok("yes") => Some(true),
            Ok("no") => Some(false),
            _ => None,
        }
    } else {
        Some(
            app.dialog()
                .message(&text)
                .title(&title)
                .buttons(MessageDialogButtons::YesNo)
                .blocking_show(),
        )
    };

    let outcome = dialogs::resolve_confirm(answer);
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_DIALOG kind=confirm outcome={}",
            match outcome {
                DialogOutcome::Confirmed => "confirmed",
                DialogOutcome::Declined => "declined",
                DialogOutcome::Cancelled => "cancelled",
                _ => "error",
            }
        ));
    }
    match outcome {
        DialogOutcome::Confirmed => DialogReply {
            outcome: "confirmed".to_string(),
            path: None,
            error: None,
        },
        DialogOutcome::Declined => DialogReply {
            outcome: "declined".to_string(),
            path: None,
            error: None,
        },
        _ => DialogReply {
            outcome: "cancelled".to_string(),
            path: None,
            error: None,
        },
    }
}

/// App data directory used by the external template/language/flag folders.
fn external_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

/// Lists files in the external template folder.
#[tauri::command]
pub fn list_external_templates(app: tauri::AppHandle) -> Result<Vec<ExternalTemplate>, String> {
    let data_dir = external_data_dir(&app)?;
    external_assets::ensure_external_folders(&data_dir).map_err(|error| error.to_string())?;
    let templates =
        external_assets::list_templates(&data_dir).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_templates count={}",
            templates.len()
        ));
    }
    Ok(templates)
}

/// Reads one external template as Base64.
#[tauri::command]
pub fn read_external_template(
    app: tauri::AppHandle,
    filename: String,
) -> Result<ExternalTemplateContent, String> {
    let data_dir = external_data_dir(&app)?;
    let content = external_assets::read_template(&data_dir, &filename);
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_template_read filename={} success={} bytes={}",
            content.filename, content.success, content.size
        ));
    }
    Ok(content)
}

/// Lists external language packs merged with their flags.
#[tauri::command]
pub fn list_external_languages(app: tauri::AppHandle) -> Result<Vec<ExternalLanguage>, String> {
    let data_dir = external_data_dir(&app)?;
    external_assets::ensure_external_folders(&data_dir).map_err(|error| error.to_string())?;
    let languages =
        external_assets::list_languages(&data_dir).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_languages count={}",
            languages.len()
        ));
    }
    Ok(languages)
}

/// Lists available flag images as data URLs.
#[tauri::command]
pub fn list_available_flags(app: tauri::AppHandle) -> Result<Vec<ExternalFlag>, String> {
    let data_dir = external_data_dir(&app)?;
    external_assets::ensure_external_folders(&data_dir).map_err(|error| error.to_string())?;
    let flags = external_assets::list_flags(&data_dir).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_flags count={}",
            flags.len()
        ));
    }
    Ok(flags)
}

/// Saves a user language pack.
#[tauri::command]
pub fn save_external_language(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<ExternalLanguage, String> {
    let data_dir = external_data_dir(&app)?;
    let language = external_assets::save_language(&data_dir, &filename, &content)
        .map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_language_saved code={} filename={}",
            language.code, language.filename
        ));
    }
    Ok(language)
}

/// Reply to a folder action; mirrors the TypeScript `{success, path}` payload.
#[derive(Debug, Clone, Serialize)]
pub struct ExternalFolderReply {
    /// Whether the folder exists and was opened.
    pub success: bool,
    /// Absolute folder path.
    pub path: String,
}

/// Returns the external folder path for `kind` (`templates`, `languages`, `flags`).
#[tauri::command]
pub fn external_folder_path(
    app: tauri::AppHandle,
    kind: String,
) -> Result<ExternalFolderReply, String> {
    let data_dir = external_data_dir(&app)?;
    external_assets::ensure_external_folders(&data_dir).map_err(|error| error.to_string())?;
    let path = match kind.as_str() {
        "templates" => external_assets::templates_dir(&data_dir),
        "languages" => external_assets::languages_dir(&data_dir),
        "flags" => external_assets::flags_dir(&data_dir),
        other => return Err(format!("unknown external folder: {other}")),
    };
    Ok(ExternalFolderReply {
        success: true,
        path: path.display().to_string(),
    })
}

/// Opens an external folder in the platform file manager.
#[tauri::command]
pub fn open_external_folder(
    app: tauri::AppHandle,
    kind: String,
) -> Result<ExternalFolderReply, String> {
    let reply = external_folder_path(app, kind)?;
    external_assets::open_folder(Path::new(&reply.path)).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE external_folder_opened path={}",
            reply.path
        ));
    }
    Ok(reply)
}

/// Options the webview needs to drive the native smoke surface.
#[derive(Serialize)]
pub struct SmokeOptions {
    /// Whether the tray menu actions should be dispatched.
    pub tray: bool,
    /// `chosen`, `cancel`, or empty when the dialog flows are not part of this run.
    pub dialogs: String,
    /// Whether the tray quit action ends the run.
    pub quit: bool,
}

/// Reports which native smoke flows this run enables.
#[tauri::command]
pub fn smoke_options() -> SmokeOptions {
    if smoke_report_path().is_none() {
        return SmokeOptions {
            tray: false,
            dialogs: String::new(),
            quit: false,
        };
    }
    let selection = |variable: &str| {
        std::env::var_os(variable).and_then(|value| value.to_str().map(str::to_string))
    };
    let dialogs = if std::env::var_os("SOCDOF_SMOKE_DIALOGS").is_none() {
        String::new()
    } else if [
        "SOCDOF_SMOKE_DIALOG_FOLDER",
        "SOCDOF_SMOKE_DIALOG_OPEN",
        "SOCDOF_SMOKE_DIALOG_SAVE",
    ]
    .iter()
    .any(|variable| selection(variable).as_deref() == Some("cancel"))
    {
        "cancel".to_string()
    } else {
        "chosen".to_string()
    };
    SmokeOptions {
        tray: std::env::var_os("SOCDOF_SMOKE_TRAY").is_some(),
        dialogs,
        quit: std::env::var_os("SOCDOF_SMOKE_QUIT").is_some(),
    }
}

/// Dispatches the tray menu through the function the platform menu event calls.
///
/// The tray icon needs a status-notifier host, which the Xvfb session does not provide, so the
/// menu cannot be opened with a pointer there; the entries, their labels, the window effect, the
/// backup and the quit path are the real ones. `include_quit` ends the run through `app.exit(0)`.
#[tauri::command]
pub fn smoke_tray_run(app: tauri::AppHandle, include_quit: bool) -> Result<Vec<String>, String> {
    if smoke_report_path().is_none() {
        return Err("smoke mode is not enabled".to_string());
    }
    for (language, id, label) in tray::label_dump() {
        smoke_log(&format!(
            "SOCDOF_TRAY labels lang={language} item={id} label={label}"
        ));
    }
    let unknown = tray::command_for("no-such-entry");
    smoke_log(&format!(
        "SOCDOF_TRAY item=unknown action={}",
        unknown.map(|command| command.as_str()).unwrap_or("none")
    ));
    let mut dispatched = Vec::new();
    for entry in tray::menu() {
        let Some(command) = entry.command else {
            continue;
        };
        if command == tray::TrayCommand::Quit && !include_quit {
            continue;
        }
        dispatched.push(tray::marker(entry.id, command));
        crate::run_tray_command(&app, entry.id, command);
    }
    Ok(dispatched)
}

/// One selectable label format.
#[derive(Serialize)]
pub struct LabelFormatView {
    /// Stable identifier.
    pub id: &'static str,
    /// Catalogue key of the format name.
    pub label_key: &'static str,
    /// Width in pixels.
    pub width: f32,
}

/// Barcode and QR label of a product, ready for the webview dialog.
#[derive(Serialize)]
pub struct ProductLabelView {
    /// Product name.
    pub name: String,
    /// Article number.
    pub sku: String,
    /// Amazon ASIN, when known.
    pub asin: Option<String>,
    /// Category with the legacy fallback.
    pub category: String,
    /// Unit with the legacy fallback.
    pub unit: String,
    /// Price formatted like the TypeScript label.
    pub price_text: String,
    /// Payload encoded in the QR symbol.
    pub payload: String,
    /// Selectable formats.
    pub formats: Vec<LabelFormatView>,
    /// QR matrix, one string of `0`/`1` per row.
    pub qr: Vec<String>,
}

/// Returns the label payload and QR matrix of a product.
#[tauri::command]
pub fn product_label(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<ProductLabelView, String> {
    let product = state.product(id).map_err(|error| error.to_string())?;
    let label = ProductLabel::from_product(&product, "€");
    let code = label.qr().map_err(|error| error.to_string())?;
    let price_text = label.price_text();
    let mut qr = Vec::with_capacity(code.size());
    for row in 0..code.size() {
        let mut line = String::with_capacity(code.size());
        for column in 0..code.size() {
            line.push(if code.dark(row, column) { '1' } else { '0' });
        }
        qr.push(line);
    }
    Ok(ProductLabelView {
        name: label.name,
        sku: label.sku,
        asin: label.asin,
        category: label.category,
        unit: label.unit,
        price_text,
        payload: label.payload,
        formats: LabelFormat::all()
            .iter()
            .map(|format| LabelFormatView {
                id: format.as_str(),
                label_key: format.label_key(),
                width: format.width(),
            })
            .collect(),
        qr,
    })
}

/// Adjustment the webview applies to one reorder row.
#[derive(Deserialize)]
pub struct ReorderAdjustment {
    /// Product of the row.
    pub product_id: Uuid,
    /// Quantity entered by the user.
    pub quantity: Option<i64>,
    /// Whether the row is part of the order.
    pub included: Option<bool>,
}

/// Request of the reorder assistant.
#[derive(Deserialize)]
pub struct ReorderRequest {
    /// `individual` or `fixed`.
    pub threshold: Option<String>,
    /// Threshold of the fixed mode.
    pub fixed: Option<i64>,
    /// Marketplace domain.
    pub domain: Option<String>,
    /// Search text.
    pub query: Option<String>,
    /// Whether only permanently excluded articles are listed.
    pub excluded_only: Option<bool>,
    /// Per-row overrides.
    pub adjustments: Option<Vec<ReorderAdjustment>>,
}

/// One request line.
#[derive(Serialize)]
pub struct ReorderLineView {
    /// Product of the row.
    pub product_id: Uuid,
    /// Product name.
    pub name: String,
    /// Article number.
    pub sku: String,
    /// Amazon ASIN, when known.
    pub asin: Option<String>,
    /// Requested quantity.
    pub quantity: i64,
    /// Whether the row is part of the order.
    pub included: bool,
    /// Whether the article is permanently excluded.
    pub excluded: bool,
    /// Current stock.
    pub stock: i64,
    /// Unit cost in cents.
    pub unit_cost_cents: i64,
}

/// Key figures of the assistant.
#[derive(Serialize)]
pub struct ReorderStatsView {
    /// Number of low-stock articles.
    pub low_stock_count: i64,
    /// Units in the request.
    pub total_units: i64,
    /// Estimated cost in cents.
    pub estimated_cost_cents: i64,
    /// Permanently excluded articles.
    pub excluded_count: i64,
    /// Articles with a usable ASIN.
    pub asin_ready_count: i64,
    /// Articles without an ASIN.
    pub missing_asin_count: i64,
}

/// Result of the reorder assistant.
#[derive(Serialize)]
pub struct ReorderView {
    /// Request lines.
    pub lines: Vec<ReorderLineView>,
    /// Key figures.
    pub stats: ReorderStatsView,
    /// Amazon cart link of the included ASINs.
    pub cart_url: String,
    /// Amazon search link of the request.
    pub search_url: String,
}

fn build_plan(state: &DesktopState, request: &ReorderRequest) -> Result<ReorderPlan, String> {
    let products = state.products(None).map_err(|error| error.to_string())?;
    let threshold = match request.threshold.as_deref() {
        Some("fixed") => Threshold::Fixed(request.fixed.unwrap_or(reorder::FIXED_THRESHOLD).max(1)),
        _ => Threshold::Individual,
    };
    let mut plan = ReorderPlan::new(&products, threshold);
    for adjustment in request.adjustments.iter().flatten() {
        let Some(index) = plan
            .lines
            .iter()
            .position(|line| line.product.id == adjustment.product_id)
        else {
            continue;
        };
        if let Some(quantity) = adjustment.quantity {
            plan.set_quantity(index, quantity);
        }
        if let Some(included) = adjustment.included {
            if plan.lines[index].included != included {
                plan.toggle(index);
            }
        }
    }
    plan.query = request.query.clone().unwrap_or_default();
    plan.excluded_only = request.excluded_only.unwrap_or(false);
    plan.domain =
        reorder::clean_domain(request.domain.as_deref().unwrap_or(reorder::DEFAULT_DOMAIN));
    Ok(plan)
}

/// Computes the reorder assistant result.
#[tauri::command]
pub fn reorder_plan(
    state: tauri::State<'_, DesktopState>,
    request: ReorderRequest,
) -> Result<ReorderView, String> {
    let plan = build_plan(&state, &request)?;
    let lines = plan
        .visible()
        .into_iter()
        .map(|index| {
            let line = &plan.lines[index];
            ReorderLineView {
                product_id: line.product.id,
                name: line.product.name.clone(),
                sku: line.product.sku.clone(),
                asin: line.asin(),
                quantity: line.quantity,
                included: line.included,
                excluded: line.is_excluded(),
                stock: line.product.stock,
                unit_cost_cents: line.unit_cost().cents(),
            }
        })
        .collect();
    let stats = plan.stats();
    Ok(ReorderView {
        lines,
        stats: ReorderStatsView {
            low_stock_count: stats.low_stock_count as i64,
            total_units: stats.total_units,
            estimated_cost_cents: stats.estimated_cost.cents(),
            excluded_count: stats.excluded_count as i64,
            asin_ready_count: stats.asin_ready_count as i64,
            missing_asin_count: stats.missing_asin_count as i64,
        },
        cart_url: plan.cart_url(),
        search_url: plan.search_url(),
    })
}

/// Creates the draft purchase order of the reorder assistant and returns its number.
#[tauri::command]
pub fn create_reorder_draft(
    state: tauri::State<'_, DesktopState>,
    request: ReorderRequest,
) -> Result<String, String> {
    let plan = build_plan(&state, &request)?;
    let vendor = state
        .contacts(None)
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|contact| {
            matches!(
                contact.contact_type,
                socdof_core::domain::contact::ContactType::Vendor
                    | socdof_core::domain::contact::ContactType::Both
            )
        })
        .ok_or_else(|| "no_vendor".to_string())?;
    let now = socdof_core::now_millis();
    let stamp = socdof_core::date::format_iso8601(now);
    let year: i32 = stamp
        .get(0..4)
        .and_then(|year| year.parse().ok())
        .unwrap_or(2026);
    let number = reorder::order_number(year, 1000 + (now.rem_euclid(9000)) as u16);
    let order: PurchaseOrder = plan
        .draft_order(vendor.id, number.clone(), now, "€")
        .ok_or_else(|| "no_lines".to_string())?;
    state
        .create_purchase_order(&order)
        .map_err(|error| error.to_string())?;
    Ok(number)
}

/// Sets the permanent reorder exclusion of a product.
#[tauri::command]
pub fn set_product_reorder_exclusion(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    excluded: bool,
) -> Result<Product, String> {
    let mut product = state.product(id).map_err(|error| error.to_string())?;
    product.exclude_from_reorder = excluded;
    state
        .store_product(&product)
        .map_err(|error| error.to_string())?;
    Ok(product)
}

/// Dunning letter of an invoice.
#[tauri::command]
pub fn invoice_dunning(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    level: String,
    fee_cents: Option<i64>,
    days: Option<i64>,
) -> Result<InvoiceDunningView, String> {
    let view = state
        .invoice_dunning(id, &level, fee_cents, days)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE invoice_dunning invoice={} level={} fee_cents={} days={} claim_cents={}",
        view.invoice_number, view.level, view.fee_cents, view.days, view.claim_cents
    );
    Ok(view)
}

/// Mail draft of an invoice.
#[tauri::command]
pub fn invoice_mail_draft(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<InvoiceMailView, String> {
    let view = state.invoice_mail(id).map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE invoice_mail invoice={} recipient={} bytes={}",
        view.invoice_number,
        view.recipient,
        view.eml.len()
    );
    Ok(view)
}

/// Payment recorded for an invoice.
#[tauri::command]
pub fn invoice_payment(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<Option<InvoicePaymentView>, String> {
    state.invoice_payment(id).map_err(|error| error.to_string())
}

/// Records a payment and marks the invoice paid.
#[tauri::command]
pub fn record_invoice_payment(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    method: String,
    reference: Option<String>,
    paid_at: Option<i64>,
) -> Result<InvoicePaymentView, String> {
    let view = state
        .record_invoice_payment(id, &method, reference.as_deref(), paid_at)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE record_payment invoice_id={} method={} reference={}",
        view.invoice_id, view.method, view.reference
    );
    Ok(view)
}

/// Export report of an `.eml` draft.
#[derive(serde::Serialize)]
pub struct EmlExport {
    /// Written file.
    pub path: String,
    /// Written bytes.
    pub bytes: u64,
}

/// Writes the dunning letter or the invoice mail draft as `.eml`.
#[tauri::command]
pub fn export_invoice_eml(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    kind: String,
    level: Option<String>,
    fee_cents: Option<i64>,
    days: Option<i64>,
    path: String,
) -> Result<EmlExport, String> {
    let kind = kind.trim().to_ascii_lowercase();
    let eml = match kind.as_str() {
        "dunning" => {
            let level = level.unwrap_or_else(|| "reminder".to_string());
            state
                .invoice_dunning(id, &level, fee_cents, days)
                .map_err(|error| error.to_string())?
                .eml
        }
        "invoice" | "mail" => {
            state
                .invoice_mail(id)
                .map_err(|error| error.to_string())?
                .eml
        }
        other => return Err(format!("unknown eml kind {other}")),
    };
    std::fs::write(&path, eml.as_bytes()).map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_eml kind={kind} path={path} bytes={}",
        eml.len()
    );
    Ok(EmlExport {
        path,
        bytes: eml.len() as u64,
    })
}

/// Contact mail draft.
#[tauri::command]
pub fn contact_mail_draft(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<ContactMailView, String> {
    let view = state.contact_mail(id).map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE contact_mail contact_id={} recipient={} bytes={}",
        view.contact_id,
        view.recipient,
        view.eml.len()
    );
    Ok(view)
}

/// Writes the edited contact draft as `.eml`.
#[tauri::command]
pub fn export_contact_eml(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    recipient_name: Option<String>,
    recipient_email: Option<String>,
    subject: Option<String>,
    body: Option<String>,
    path: String,
) -> Result<EmlExport, String> {
    let eml = state
        .contact_eml(
            id,
            recipient_name.as_deref().unwrap_or(""),
            recipient_email.as_deref().unwrap_or(""),
            subject.as_deref().unwrap_or(""),
            body.as_deref().unwrap_or(""),
        )
        .map_err(|error| error.to_string())?;
    std::fs::write(&path, eml.as_bytes()).map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_contact_eml path={path} bytes={}",
        eml.len()
    );
    Ok(EmlExport {
        path,
        bytes: eml.len() as u64,
    })
}

/// FatturaPA document of an invoice.
#[tauri::command]
pub fn invoice_fattura(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    input: FatturaInput,
) -> Result<InvoiceFatturaView, String> {
    let view = state
        .invoice_fattura(id, &input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE fattura file={} valid={} lines={} bytes={}",
        view.file_name,
        view.valid,
        view.xml.matches("<DettaglioLinee>").count(),
        view.xml.len()
    );
    Ok(view)
}

/// Writes the FatturaPA XML, ready for the SdI upload.
#[tauri::command]
pub fn export_invoice_fattura(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
    input: FatturaInput,
    path: String,
) -> Result<EmlExport, String> {
    let view = state
        .invoice_fattura(id, &input)
        .map_err(|error| error.to_string())?;
    std::fs::write(&path, view.xml.as_bytes()).map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_fattura file={} path={path} bytes={}",
        view.file_name,
        view.xml.len()
    );
    Ok(EmlExport {
        path,
        bytes: view.xml.len() as u64,
    })
}

/// Complete fleet snapshot.
#[tauri::command]
pub fn fleet_overview(
    state: tauri::State<'_, DesktopState>,
) -> Result<socdof_app::fleet_bridge::FleetOverviewView, String> {
    let view = state.fleet_overview().map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE fleet_list vehicles={} trips={} fuel={} total_km={} active={}",
        view.vehicles.len(),
        view.trips.len(),
        view.fuel.len(),
        view.metrics.total_km,
        view.metrics.active_vehicles
    );
    Ok(view)
}

/// Creates or updates a fleet vehicle.
#[tauri::command]
pub fn save_fleet_vehicle(
    state: tauri::State<'_, DesktopState>,
    input: FleetVehicleInput,
) -> Result<socdof_app::fleet_bridge::FleetVehicleView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_fleet_vehicle(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE fleet_vehicle_saved mode={mode} id={} plate={} odometer={} status={}",
        view.id, view.license_plate, view.current_odometer, view.status
    );
    Ok(view)
}

/// Deletes a fleet vehicle.
#[tauri::command]
pub fn delete_fleet_vehicle(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_fleet_vehicle(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE fleet_vehicle_deleted id={id}");
    Ok(())
}

/// Creates or updates a logbook trip.
#[tauri::command]
pub fn save_fleet_trip(
    state: tauri::State<'_, DesktopState>,
    input: FleetTripInput,
) -> Result<socdof_app::fleet_bridge::FleetTripView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_fleet_trip(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE fleet_trip_saved mode={mode} id={} plate={} km={} cost_cents={}",
        view.id,
        view.vehicle_plate,
        view.distance_km,
        (view.calculated_cost * 100.0).round() as i64
    );
    Ok(view)
}

/// Deletes a logbook trip.
#[tauri::command]
pub fn delete_fleet_trip(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_fleet_trip(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE fleet_trip_deleted id={id}");
    Ok(())
}

/// Creates or updates a fuel receipt.
#[tauri::command]
pub fn save_fleet_fuel(
    state: tauri::State<'_, DesktopState>,
    input: FleetFuelInput,
) -> Result<socdof_app::fleet_bridge::FleetFuelView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_fleet_fuel(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE fleet_fuel_saved mode={mode} id={} plate={} total_cents={} price_milli={}",
        view.id,
        view.vehicle_plate,
        (view.total_cost * 100.0).round() as i64,
        (view.price_per_unit * 1000.0).round() as i64
    );
    Ok(view)
}

/// Deletes a fuel receipt.
#[tauri::command]
pub fn delete_fleet_fuel(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_fleet_fuel(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE fleet_fuel_deleted id={id}");
    Ok(())
}

/// Exports all contacts as the legacy-compatible semicolon CSV.
#[tauri::command]
pub fn export_contacts_csv(state: tauri::State<'_, DesktopState>, path: String) -> Result<usize, String> {
    state
        .export_contacts_csv(std::path::Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Imports contacts from the legacy-compatible semicolon CSV.
#[tauri::command]
pub fn import_contacts_csv(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<socdof_core::csv::ImportReport, String> {
    state
        .import_contacts_csv(std::path::Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Exports all contacts as vCard 3.0.
#[tauri::command]
pub fn export_contacts_vcf(state: tauri::State<'_, DesktopState>, path: String) -> Result<usize, String> {
    state
        .export_contacts_vcf(std::path::Path::new(&path))
        .map_err(|error| error.to_string())
}

/// Writes the GoBD logbook CSV.
#[tauri::command]
pub fn export_fleet_csv(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<socdof_app::fleet_bridge::FleetCsvReport, String> {
    let report = state
        .export_fleet_csv(std::path::Path::new(&path))
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_fleet_csv path={} rows={} bytes={}",
        report.path, report.rows, report.bytes
    );
    Ok(report)
}

/// Complete project portfolio with tasks and KPI values.
#[tauri::command]
pub fn project_overview(
    state: tauri::State<'_, DesktopState>,
) -> Result<socdof_app::project_bridge::ProjectOverviewView, String> {
    let view = state
        .project_overview()
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_list projects={} tasks={} active={} logged_milli={} revenue_cents={}",
        view.projects.len(),
        view.metrics.total_tasks_count,
        view.metrics.active_projects_count,
        (view.metrics.total_logged_hours * 1000.0).round() as i64,
        (view.metrics.billable_revenue * 100.0).round() as i64
    );
    Ok(view)
}

/// Creates or updates a project.
#[tauri::command]
pub fn save_project(
    state: tauri::State<'_, DesktopState>,
    input: ProjectInput,
) -> Result<socdof_app::project_bridge::ProjectView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_project(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_saved mode={mode} id={} code={} status={} budget_cents={} tasks={}",
        view.id,
        view.code,
        view.status,
        (view.budget * 100.0).round() as i64,
        view.task_count
    );
    Ok(view)
}

/// Deletes a project and its tasks.
#[tauri::command]
pub fn delete_project(state: tauri::State<'_, DesktopState>, id: Uuid) -> Result<(), String> {
    state
        .delete_project(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE project_deleted id={id}");
    Ok(())
}

/// Creates or updates a Kanban task.
#[tauri::command]
pub fn save_project_task(
    state: tauri::State<'_, DesktopState>,
    input: ProjectTaskInput,
) -> Result<socdof_app::project_bridge::ProjectTaskView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_project_task(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_task_saved mode={mode} id={} project={} status={} logged_milli={}",
        view.id,
        view.project_id,
        view.status,
        (view.logged_hours * 1000.0).round() as i64
    );
    Ok(view)
}

/// Changes the status of a Kanban task.
#[tauri::command]
pub fn set_project_task_status(
    state: tauri::State<'_, DesktopState>,
    project_id: Uuid,
    task_id: Uuid,
    status: String,
) -> Result<socdof_app::project_bridge::ProjectTaskView, String> {
    let view = state
        .set_project_task_status(project_id, task_id, &status)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_task_status id={} project={} status={}",
        view.id, view.project_id, view.status
    );
    Ok(view)
}

/// Deletes one Kanban task.
#[tauri::command]
pub fn delete_project_task(
    state: tauri::State<'_, DesktopState>,
    project_id: Uuid,
    task_id: Uuid,
) -> Result<(), String> {
    state
        .delete_project_task(project_id, task_id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE project_task_deleted id={task_id} project={project_id}");
    Ok(())
}

/// Writes the project portfolio CSV.
#[tauri::command]
pub fn export_projects_csv(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<socdof_app::project_bridge::ProjectCsvReport, String> {
    let report = state
        .export_projects_csv(std::path::Path::new(&path))
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_projects_csv path={} rows={} bytes={}",
        report.path, report.rows, report.bytes
    );
    Ok(report)
}

/// Re-reads a project from the database for the persistence marker.
#[tauri::command]
pub fn project_persistence(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<socdof_app::project_bridge::ProjectPersistenceView, String> {
    let view = state
        .project_persistence(id)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_persisted id={} present={} tasks={} code={}",
        id, view.present, view.tasks, view.code
    );
    Ok(view)
}

/// Complete restaurant screen: menu, floor plan, orders, KPIs and Z-report values.
#[tauri::command]
pub fn restaurant_overview(
    state: tauri::State<'_, DesktopState>,
) -> Result<socdof_app::restaurant_bridge::RestaurantOverviewView, String> {
    let view = state
        .restaurant_overview()
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_list menu={} orders={} open={} kitchen={} paid_today={} revenue_cents={}",
        view.menu.len(),
        view.orders.len(),
        view.metrics.open_tables,
        view.metrics.in_kitchen,
        view.metrics.today_orders,
        (view.metrics.today_revenue * 100.0).round() as i64
    );
    Ok(view)
}

/// Creates or updates one dish.
#[tauri::command]
pub fn save_restaurant_menu_item(
    state: tauri::State<'_, DesktopState>,
    input: MenuItemInput,
) -> Result<socdof_app::restaurant_bridge::MenuItemView, String> {
    let mode = if input.id.is_some() {
        "updated"
    } else {
        "created"
    };
    let view = state
        .save_restaurant_menu_item(&input)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_dish_saved mode={mode} id={} name={} category={} price_cents={} available={}",
        view.id,
        view.name,
        view.category,
        (view.price * 100.0).round() as i64,
        view.is_available
    );
    Ok(view)
}

/// Deletes one dish.
#[tauri::command]
pub fn delete_restaurant_menu_item(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<(), String> {
    state
        .delete_restaurant_menu_item(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE restaurant_dish_deleted id={id}");
    Ok(())
}

/// Adds a dish to the open order of a table.
#[tauri::command]
pub fn add_restaurant_item(
    state: tauri::State<'_, DesktopState>,
    table_number: String,
    menu_item_id: Uuid,
) -> Result<socdof_app::restaurant_bridge::RestaurantOrderMutationView, String> {
    let view = state
        .add_restaurant_item(&table_number, menu_item_id)
        .map_err(|error| error.to_string())?;
    if let Some(order) = &view.order {
        eprintln!(
            "SOCDOF_SMOKE restaurant_order_saved mode={} order={} table={} items={} total_cents={}",
            if view.created { "created" } else { "updated" },
            order.id,
            order.table_number,
            order.items.len(),
            (order.total * 100.0).round() as i64
        );
    }
    Ok(view)
}

/// Changes the quantity of an ordered position.
#[tauri::command]
pub fn set_restaurant_order_item_qty(
    state: tauri::State<'_, DesktopState>,
    order_id: Uuid,
    item_id: Uuid,
    qty: i64,
) -> Result<socdof_app::restaurant_bridge::RestaurantOrderMutationView, String> {
    let view = state
        .set_restaurant_order_item_qty(order_id, item_id, qty)
        .map_err(|error| error.to_string())?;
    if let Some(order) = &view.order {
        eprintln!(
            "SOCDOF_SMOKE restaurant_order_updated order={} items={} total_cents={}",
            order.id,
            order.items.len(),
            (order.total * 100.0).round() as i64
        );
    } else {
        eprintln!("SOCDOF_SMOKE restaurant_order_deleted order={order_id}");
    }
    Ok(view)
}

/// Replaces the kitchen note of an ordered position.
#[tauri::command]
pub fn set_restaurant_order_item_notes(
    state: tauri::State<'_, DesktopState>,
    order_id: Uuid,
    item_id: Uuid,
    notes: String,
) -> Result<socdof_app::restaurant_bridge::TableOrderView, String> {
    let view = state
        .set_restaurant_order_item_notes(order_id, item_id, &notes)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_order_updated order={} notes={}",
        view.id, notes
    );
    Ok(view)
}

/// Stores the server name of an open table order.
#[tauri::command]
pub fn set_restaurant_order_server(
    state: tauri::State<'_, DesktopState>,
    order_id: Uuid,
    server_name: String,
) -> Result<socdof_app::restaurant_bridge::TableOrderView, String> {
    let view = state
        .set_restaurant_order_server(order_id, &server_name)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_order_updated order={} server={}",
        view.id, view.server_name
    );
    Ok(view)
}

/// Moves a table order through the kitchen flow.
#[tauri::command]
pub fn set_restaurant_order_status(
    state: tauri::State<'_, DesktopState>,
    order_id: Uuid,
    status: String,
) -> Result<socdof_app::restaurant_bridge::TableOrderView, String> {
    let view = state
        .set_restaurant_order_status(order_id, &status)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_order_status order={} status={}",
        view.id, view.status
    );
    Ok(view)
}

/// Deletes / cancels a table order.
#[tauri::command]
pub fn delete_restaurant_order(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<(), String> {
    state
        .delete_restaurant_order(id)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE restaurant_order_deleted order={id}");
    Ok(())
}

/// Settles a table with POS receipt and official invoice.
#[tauri::command]
pub fn restaurant_checkout(
    state: tauri::State<'_, DesktopState>,
    input: RestaurantCheckoutInput,
) -> Result<socdof_app::restaurant_bridge::RestaurantCheckoutView, String> {
    let view = state
        .restaurant_checkout(&input)
        .map_err(|error| error.to_string())?;
    eprintln!("SOCDOF_SMOKE restaurant_checkout order={} invoice={} invoice_number={} total_cents={} tip_cents={} method={} split={}",
        view.order.id,
        view.invoice_id,
        view.invoice_number,
        (view.total_with_tip * 100.0).round() as i64,
        (view.order.tip * 100.0).round() as i64,
        view.order.payment_method.as_deref().unwrap_or("-"),
        view.split_count
    );
    Ok(view)
}

/// Writes the restaurant sales CSV.
#[tauri::command]
pub fn export_restaurant_csv(
    state: tauri::State<'_, DesktopState>,
    path: String,
) -> Result<socdof_app::restaurant_bridge::RestaurantCsvReport, String> {
    let report = state
        .export_restaurant_csv(std::path::Path::new(&path))
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE export_restaurant_csv path={} rows={} bytes={}",
        report.path, report.rows, report.bytes
    );
    Ok(report)
}

/// Re-reads a restaurant order for the persistence marker.
#[tauri::command]
pub fn restaurant_persistence(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<socdof_app::restaurant_bridge::RestaurantPersistenceView, String> {
    let view = state
        .restaurant_persistence(id)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE restaurant_persisted order={} present={} items={} menu={} status={} receipt={}",
        id,
        view.present,
        view.items,
        view.menu,
        view.status,
        view.receipt_number.as_deref().unwrap_or("-")
    );
    Ok(view)
}

/// Creates a draft invoice from the billable tasks of a project.
#[tauri::command]
pub fn create_project_invoice(
    state: tauri::State<'_, DesktopState>,
    id: Uuid,
) -> Result<socdof_app::invoice_bridge::InvoiceView, String> {
    let view = state
        .create_project_invoice(id)
        .map_err(|error| error.to_string())?;
    eprintln!(
        "SOCDOF_SMOKE project_invoice project={} number={} items={} total_cents={}",
        id,
        view.number,
        view.items.len(),
        view.total_cents
    );
    Ok(view)
}
