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
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use socdof_app::shortcuts::{
    self, AppAction, Key, KeyChord, Modifiers, ShortcutContext, ShortcutOutcome,
};
use socdof_app::desktop::{BackupReport, ContactInput, DesktopState, ProductInput};
use socdof_app::dialogs::{self, DialogKind, DialogOutcome};
use socdof_app::shell::ShellStatus;
use socdof_app::tray;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::countries::{self as countries, Country};
use socdof_core::domain::label::{LabelFormat, ProductLabel};
use socdof_core::domain::product::Product;
use socdof_core::domain::purchase::PurchaseOrder;
use socdof_core::domain::reorder::{self, ReorderPlan, Threshold};
use socdof_core::domain::settings::Language;
use socdof_core::legacy::{LegacyExportReport, LegacyImportReport};
use uuid::Uuid;

const SMOKE_REPORT_ENV: &str = "SOCDOF_SMOKE_REPORT";

/// Returns whether the runtime smoke mode is enabled.
#[tauri::command]
pub fn smoke_enabled() -> bool {
    smoke_report_path().is_some()
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
    let outcome = shortcuts::resolve(
        context,
        &shortcuts::default_bindings(),
        chord,
        event.repeat,
    );
    if smoke_report_path().is_some() {
        println!("{}", shortcuts::marker(chord, outcome));
    }
    if let ShortcutOutcome::Action {
        action: AppAction::ToggleFullscreen,
    } = outcome
    {
        if let Some(window) = app.get_window("main") {
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

/// Exercises the tray menu (CI smoke only).
///
/// Reports every label the menu can show and the unknown-id path, then dispatches the entries in
/// menu order through the function the platform menu event calls — including quit, which ends the
/// run. The icon itself needs a status-notifier host, which the Xvfb session does not provide; the
/// menu, the window effect and the backup are real.
pub fn tray_smoke(app: &tauri::AppHandle) {
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
    for entry in tray::menu() {
        if let Some(command) = entry.command {
            crate::run_tray_command(app, entry.id, command);
        }
    }
}

/// Exercises the dialog bridge with canned selections (CI smoke only).
pub fn dialog_smoke() {
    let cases = [
        (
            DialogKind::Folder,
            smoke_selection("SOCDOF_SMOKE_DIALOG_FOLDER").flatten(),
        ),
        (
            DialogKind::OpenFile {
                extensions: vec!["json".to_string()],
            },
            smoke_selection("SOCDOF_SMOKE_DIALOG_OPEN").flatten(),
        ),
        (
            DialogKind::SaveFile {
                suggested_name: "backup.socdofbak".to_string(),
            },
            smoke_selection("SOCDOF_SMOKE_DIALOG_SAVE").flatten(),
        ),
        (DialogKind::Folder, None),
        (DialogKind::Message, None),
    ];
    for (kind, selection) in cases {
        let result = dialogs::resolve(&kind, selection);
        smoke_log(&dialogs::marker(&kind, &result));
    }
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
        price_text: label.price_text(),
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

fn build_plan(
    state: &DesktopState,
    request: &ReorderRequest,
) -> Result<ReorderPlan, String> {
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
    plan.domain = reorder::clean_domain(
        request
            .domain
            .as_deref()
            .unwrap_or(reorder::DEFAULT_DOMAIN),
    );
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
