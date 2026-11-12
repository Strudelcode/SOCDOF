//! Shared state for the desktop window layer.
//!
//! The Tauri commands are one-line adapters over [`DesktopState`]. Keeping the state in this crate,
//! instead of inside `src-tauri`, makes the exact command path testable on machines that have no
//! GTK/WebKit development packages.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use socdof_core::app_store::{self, ModuleLicense};
use socdof_core::backup;
use socdof_core::domain::accounting::{
    self, BookingChannel, JournalEntry, JournalKind, JournalSummary,
};
use socdof_core::domain::appointment::{Appointment, AppointmentStatus};
use socdof_core::domain::contact::{Contact, ContactKind, ContactPerson, ContactType};
use socdof_core::domain::document::Document;
use socdof_core::domain::dunning::DunningLevel;
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::payment::{self, InvoicePayment, PaymentMethod};
use socdof_core::domain::pos::{PaymentMethod as PosPaymentMethod, PosOrder, PosOrderLine};
use socdof_core::domain::product::Product;
use socdof_core::domain::project;
use socdof_core::domain::purchase::{PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus};
use socdof_core::domain::restaurant::{self, TableOrder};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::domain::user::{User, UserRole};
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::invoice_template;
use socdof_core::legacy;
use socdof_core::money::Money;
use socdof_core::now_millis;
use socdof_core::security;
use uuid::Uuid;

use crate::fleet_bridge::{
    csv_bytes, fuel_view, overview, trip_view, vehicle_view, FleetCsvReport, FleetFuelInput,
    FleetFuelView, FleetOverviewView, FleetTripInput, FleetTripView, FleetVehicleInput,
    FleetVehicleView,
};
use crate::invoice_bridge::{
    contact_mail_view, dunning_view, fattura_view, invoice_view, invoice_views, mail_view,
    payment_view, preview_tokens, resolve_template, status_from_wire, suggest_number,
    write_invoice_export, ContactMailView, FatturaInput, InvoiceDefaults, InvoiceDunningView,
    InvoiceExportFormat, InvoiceExportReport, InvoiceFatturaView, InvoiceInput, InvoiceItemInput,
    InvoiceMailView, InvoicePaymentView, InvoicePreview, InvoiceView,
};
use crate::project_bridge::{
    csv_bytes as project_csv_bytes, overview as project_overview_view, project_view, task_view,
    ProjectCsvReport, ProjectInput, ProjectOverviewView, ProjectPersistenceView, ProjectTaskInput,
    ProjectTaskView, ProjectView,
};
use crate::restaurant_bridge::{
    csv_bytes as restaurant_csv_bytes, menu_item, menu_view, order_view,
    overview as restaurant_overview_view, MenuItemInput, MenuItemView, RestaurantCheckoutInput,
    RestaurantCheckoutView, RestaurantCsvReport, RestaurantOrderMutationView,
    RestaurantOverviewView, RestaurantPersistenceView, TableOrderView,
};
use crate::shell::{Paths, Shell, ShellStatus};
use crate::template_bridge::InvoiceTemplateBookView;

/// One backup archive in the configured backup folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupFileView {
    /// Full path of the archive.
    pub path: String,
    /// Creation time stored in the archive.
    pub created_at: i64,
    /// Schema version stored in the archive.
    pub schema_version: i64,
    /// File size in bytes.
    pub bytes: u64,
}

/// One journal entry received from the webview.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct JournalInput {
    /// Existing entry, empty for a new one.
    pub id: Option<Uuid>,
    /// Booking date in milliseconds since the Unix epoch.
    pub booked_at: i64,
    /// Description.
    pub description: String,
    /// Account booked on.
    pub account: String,
    /// Counter account.
    pub counter_account: String,
    /// Net amount in cents.
    pub amount_cents: i64,
    /// Tax rate in basis points.
    pub tax_rate_bp: i64,
    /// `income` or `expense`.
    pub kind: String,
    /// `bank` or `cash`.
    pub channel: String,
    /// Optional reference.
    pub reference: String,
}

/// One purchase-order position received from the webview.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PurchaseLineInput {
    /// Linked product.
    pub product_id: Option<Uuid>,
    /// Description.
    pub description: String,
    /// Quantity in thousandths.
    pub quantity_milli: i64,
    /// Net unit cost in cents.
    pub unit_cost_cents: i64,
    /// Tax rate in basis points.
    pub tax_rate_bp: i64,
}

/// One purchase order received from the webview.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PurchaseInput {
    /// Existing order, empty for a new one.
    pub id: Option<Uuid>,
    /// Order number.
    pub number: String,
    /// Supplier id.
    pub vendor_id: Option<Uuid>,
    /// Optional note.
    pub note: String,
    /// Expected delivery in milliseconds since the Unix epoch.
    pub expected_at: Option<i64>,
    /// Positions.
    pub lines: Vec<PurchaseLineInput>,
}

/// App-store catalogue entry sent to the webview.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppStoreModuleView {
    /// Stable module identifier.
    pub id: String,
    /// Translation key of the name.
    pub name_key: String,
    /// Translation key of the description.
    pub description_key: String,
    /// Installed version.
    pub version: String,
    /// `included`, `trial` or `locked`.
    pub license: String,
    /// Whether the module cannot be disabled.
    pub required: bool,
    /// Whether the module is active.
    pub active: bool,
    /// Whether the switch can be changed.
    pub can_toggle: bool,
}

/// Result of verifying or restoring an archive.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RestoreReport {
    /// `container` or `legacy`.
    pub kind: String,
    /// Creation time of the archive.
    pub created_at: i64,
    /// Schema version after the restore.
    pub schema_version: i64,
    /// Imported legacy records, when applicable.
    pub imported_records: Option<usize>,
}

/// Editable appointment of the calendar.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct AppointmentInput {
    /// Existing appointment, empty for a new one.
    pub id: Option<Uuid>,
    /// Linked contact.
    pub contact_id: Option<Uuid>,
    /// Short title.
    pub title: String,
    /// Room, address or link.
    pub location: String,
    /// Free text notes.
    pub notes: String,
    /// Storage status name.
    pub status: String,
    /// Start in milliseconds since the Unix epoch.
    pub starts_at: i64,
    /// End in milliseconds since the Unix epoch.
    pub ends_at: i64,
}

/// Editable document of the built-in text editor.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct DocumentInput {
    /// Existing document, empty for a new one.
    pub id: Option<Uuid>,
    /// Document name.
    pub name: String,
    /// Plain-text body.
    pub body: String,
}

/// A backup written by the desktop command layer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupReport {
    /// Path of the archive that was written.
    pub path: PathBuf,
    /// Size of the archive file in bytes.
    pub bytes: u64,
    /// Size of the database inside the archive in bytes.
    pub database_bytes: u64,
    /// Schema version stored in the archive metadata.
    pub schema_version: i64,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

/// Editable contact person fields from the UI; the field names are those of the legacy model.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ContactPersonInput {
    /// Identifier; empty means a new person and gets a fresh one.
    #[serde(default)]
    pub id: String,
    /// First name.
    #[serde(default)]
    pub first_name: String,
    /// Last name.
    #[serde(default)]
    pub last_name: String,
    /// Email address.
    #[serde(default)]
    pub email: String,
    /// Phone number, including the extension.
    #[serde(default)]
    pub phone: String,
    /// Role or department.
    #[serde(default)]
    pub role: String,
    /// Whether this person is the primary contact of the company.
    #[serde(default)]
    pub is_primary: bool,
}

/// Editable contact fields from the UI.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ContactInput {
    /// Display name.
    #[serde(default)]
    pub name: String,
    /// Company name.
    #[serde(default)]
    pub company: String,
    /// Person or company.
    #[serde(default)]
    pub is_company: bool,
    /// Customer, vendor, both or guest.
    #[serde(default)]
    pub contact_type: String,
    /// First name.
    #[serde(default)]
    pub first_name: String,
    /// Last name.
    #[serde(default)]
    pub last_name: String,
    /// Street and house number.
    #[serde(default)]
    pub street: String,
    /// Postal code.
    #[serde(default)]
    pub zip: String,
    /// City.
    #[serde(default)]
    pub city: String,
    /// Country.
    #[serde(default)]
    pub country: String,
    /// Email address.
    #[serde(default)]
    pub email: String,
    /// Phone number.
    #[serde(default)]
    pub phone: String,
    /// Tax number / VAT id.
    #[serde(default)]
    pub tax_id: String,
    /// Free-form notes.
    #[serde(default)]
    pub notes: String,
    /// Contact persons of a company ("sub-contacts" in the legacy UI).
    ///
    /// `None` means the caller does not manage them and keeps the stored list; an empty vector
    /// clears it, which is how a client removes every person.
    #[serde(default)]
    pub contact_persons: Option<Vec<ContactPersonInput>>,
}

/// Editable product fields from the UI.
#[derive(Debug, Clone, Deserialize)]
pub struct ProductInput {
    /// Product name.
    #[serde(default)]
    pub name: String,
    /// SKU / article number.
    #[serde(default)]
    pub sku: String,
    /// Category.
    #[serde(default)]
    pub category: String,
    /// Unit of measure.
    #[serde(default)]
    pub unit: String,
    /// Net sales price in cents.
    #[serde(default)]
    pub price_cents: i64,
    /// Cost price in cents.
    #[serde(default)]
    pub cost_price_cents: i64,
    /// Tax rate in basis points.
    #[serde(default = "default_tax_rate")]
    pub tax_rate_bp: i64,
    /// Current stock.
    #[serde(default)]
    pub stock: i64,
    /// Reorder level.
    #[serde(default)]
    pub reorder_level: i64,
    /// Target stock.
    #[serde(default)]
    pub target_stock: i64,
    /// Barcode / EAN.
    #[serde(default)]
    pub barcode: String,
    /// Amazon ASIN.
    #[serde(default)]
    pub asin: String,
    /// Supplier or shop link.
    #[serde(default)]
    pub web_link: String,
    /// Shop the link points to.
    #[serde(default)]
    pub source_domain: String,
    /// Description.
    #[serde(default)]
    pub description: String,
    /// Emoji preview.
    #[serde(default)]
    pub image_emoji: String,
    /// Exclude from reorder suggestions.
    #[serde(default)]
    pub exclude_from_reorder: bool,
}

fn default_tax_rate() -> i64 {
    1900
}

/// The desktop session managed by the window layer.
///
/// One state is created during application setup and then managed by Tauri. All commands share the
/// same [`Shell`], so the instance lock and the SQLite connection stay owned by one place.
pub struct DesktopState {
    shell: Mutex<Shell>,
}

impl DesktopState {
    /// Takes the instance lock and opens (or creates) the database.
    pub fn open(database: impl Into<PathBuf>) -> CoreResult<Self> {
        Ok(Self {
            shell: Mutex::new(Shell::start(Paths::new(database))?),
        })
    }

    /// Current database status for the first screen.
    pub fn status(&self) -> CoreResult<ShellStatus> {
        self.shell()?.status()
    }

    /// Lists local accounts without password hashes.
    pub fn users(&self) -> CoreResult<Vec<UserView>> {
        Ok(self
            .shell()?
            .store()
            .list_users()?
            .iter()
            .map(UserView::from_user)
            .collect())
    }

    /// Creates or updates a local account. An empty password keeps the stored hash on updates.
    pub fn save_user(&self, input: &UserInput) -> CoreResult<UserView> {
        let shell = self.shell()?;
        let store = shell.store();
        let now = now_millis();
        let role = UserRole::from_storage(input.role.trim())
            .ok_or_else(|| CoreError::Validation("user_role_invalid".to_string()))?;
        let username = input.username.trim();
        let display_name = input.display_name.trim();

        let existing = match input.id {
            Some(id) => store.list_users()?.into_iter().find(|user| user.id == id),
            None => None,
        };
        if let Some(id) = input.id {
            if existing.is_none() {
                return Err(CoreError::NotFound(id.to_string()));
            }
        }
        if existing.is_none() && input.password.trim().is_empty() {
            return Err(CoreError::Validation("password_required".to_string()));
        }
        if store.find_user_by_username(username)?.is_some_and(|user| {
            existing
                .as_ref()
                .map_or(true, |current| current.id != user.id)
        }) {
            return Err(CoreError::Validation("username_taken".to_string()));
        }

        let password_hash = if input.password.trim().is_empty() {
            existing
                .as_ref()
                .map(|user| user.password_hash.clone())
                .unwrap_or_default()
        } else {
            security::hash_password(&input.password)?
        };
        let user = User {
            id: existing
                .as_ref()
                .map(|user| user.id)
                .unwrap_or_else(Uuid::new_v4),
            username: username.to_string(),
            display_name: display_name.to_string(),
            role,
            role_id: existing.as_ref().and_then(|user| user.role_id.clone()),
            active: input.active,
            password_hash,
            must_change_password: false,
            created_at: existing.as_ref().map(|user| user.created_at).unwrap_or(now),
            updated_at: now,
        };
        user.validate().map_err(CoreError::Validation)?;
        match existing {
            Some(_) => store.update_user(&user)?,
            None => store.insert_user(&user)?,
        }
        Ok(UserView::from_user(&user))
    }

    /// Deletes an account; the core keeps the last administrator.
    pub fn delete_user(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_user(id)
    }

    /// Verifies credentials for the webview login gate.
    pub fn login_user(&self, username: &str, password: &str) -> CoreResult<UserView> {
        self.shell()?
            .store()
            .authenticate(username, password)?
            .map(|user| UserView::from_user(&user))
            .ok_or_else(|| CoreError::Validation("invalid_credentials".to_string()))
    }

    /// Database path, size and row counts for the storage inspector.
    pub fn storage_inspector(&self) -> CoreResult<StorageInspectorView> {
        let shell = self.shell()?;
        let store = shell.store();
        let database = shell.paths().database.clone();
        let database_bytes = std::fs::metadata(&database)
            .map(|meta| meta.len())
            .unwrap_or(0);
        let profile = store.company_profile()?;
        let backup_folder = {
            let configured = profile.backup_folder_path.trim();
            if configured.is_empty() {
                database
                    .parent()
                    .map(|parent| parent.join("backups"))
                    .unwrap_or_else(|| PathBuf::from("backups"))
            } else {
                PathBuf::from(configured)
            }
        };
        Ok(StorageInspectorView {
            database,
            database_bytes,
            schema_version: store.schema_version()?,
            backup_folder,
            counts: vec![
                StorageCountView {
                    name: "contacts".to_string(),
                    rows: store.contact_count()?,
                },
                StorageCountView {
                    name: "products".to_string(),
                    rows: store.product_count()?,
                },
                StorageCountView {
                    name: "invoices".to_string(),
                    rows: store.invoice_count()?,
                },
                StorageCountView {
                    name: "users".to_string(),
                    rows: store.user_count()?,
                },
                StorageCountView {
                    name: "documents".to_string(),
                    rows: store.list_documents()?.len() as i64,
                },
            ],
        })
    }

    /// Dashboard key figures, the newest invoices and the products below their reorder level.
    pub fn dashboard(&self, from: i64, to: i64, now: i64) -> CoreResult<DashboardView> {
        let shell = self.shell()?;
        let store = shell.store();
        let company = store.company_profile()?.name;
        let summary = store.dashboard_summary(from, to, now)?;
        let pos_orders = store.pos_orders_between(from, to)?;
        let pos_sales: Money = pos_orders.iter().map(PosOrder::total_gross).sum();
        let recent = store.recent_invoices(8)?;
        let low_stock = store.low_stock_products(8)?;

        Ok(DashboardView {
            company,
            summary: DashboardSummaryView {
                contacts: summary.contacts,
                products: summary.products,
                low_stock: summary.low_stock,
                invoices: summary.invoices,
                draft_invoices: summary.draft_invoices,
                open_invoices: summary.open_invoices,
                overdue_invoices: summary.overdue_invoices,
                paid_invoices: summary.paid_invoices,
                gross: summary.gross.cents(),
                paid: summary.paid.cents(),
                open: summary.open.cents(),
                overdue: summary.overdue.cents(),
                draft: summary.draft.cents(),
                inventory_cost: summary.inventory_cost.cents(),
                inventory_retail: summary.inventory_retail.cents(),
                pos_sales: pos_sales.cents(),
                pos_count: pos_orders.len() as i64,
                upcoming_appointments: summary.upcoming_appointments,
            },
            recent: recent
                .into_iter()
                .map(|invoice| DashboardInvoiceView {
                    number: invoice.number,
                    contact: invoice.contact,
                    status: invoice.status.as_str().to_string(),
                    issued_at: invoice.issued_at,
                    gross: invoice.gross.cents(),
                    currency_symbol: invoice.currency_symbol,
                })
                .collect(),
            low_stock: low_stock
                .into_iter()
                .map(|row| DashboardLowStockView {
                    name: row.name,
                    sku: row.sku,
                    stock: row.stock,
                    reorder_level: row.reorder_level,
                    unit: row.unit,
                })
                .collect(),
        })
    }

    /// Releases the instance lock so an immediate restart is not blocked.
    pub fn release_lock(&self) {
        if let Ok(shell) = self.shell() {
            shell.release_lock();
        }
    }

    /// Loads the invoice template book through the command layer.
    pub fn invoice_templates(&self) -> CoreResult<socdof_core::invoice_template::TemplateBook> {
        socdof_core::invoice_template::load(self.shell()?.store())
    }

    /// Validates and stores the invoice template book through the command layer.
    pub fn save_invoice_templates(
        &self,
        book: &socdof_core::invoice_template::TemplateBook,
    ) -> CoreResult<()> {
        socdof_core::invoice_template::save(self.shell()?.store(), book)
    }

    /// Loads the template book in the TypeScript field format used by the webview.
    pub fn invoice_template_book(&self) -> CoreResult<InvoiceTemplateBookView> {
        Ok(InvoiceTemplateBookView::from_book(
            &self.invoice_templates()?,
        ))
    }

    /// Validates and stores a template book received from the webview.
    pub fn save_invoice_template_book(&self, book: &InvoiceTemplateBookView) -> CoreResult<()> {
        self.save_invoice_templates(&book.to_book())
    }

    /// Writes a backup and returns its path and sizes.
    ///
    /// Without an explicit path the archive is written next to the database under
    /// `backups/socdof-<timestamp>.socdofbak`.
    pub fn backup(&self, archive: Option<&Path>) -> CoreResult<BackupReport> {
        let shell = self.shell()?;
        let archive = match archive {
            Some(path) => path.to_path_buf(),
            None => default_archive(&shell.paths().database),
        };

        if let Some(parent) = archive.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let info = shell.backup(&archive)?;
        Ok(BackupReport {
            path: archive,
            bytes: info.archive_bytes,
            database_bytes: info.database_bytes,
            schema_version: info.metadata.schema_version,
            created_at: info.metadata.created_at,
        })
    }

    /// Writes a backup to an explicit path chosen by the user.
    pub fn save_backup_to(&self, path: &Path) -> CoreResult<BackupReport> {
        self.backup(Some(path))
    }

    /// Lists valid backup archives in the configured backup folder.
    ///
    /// Without an explicit profile folder the default `backups/` directory next to the database is
    /// used, matching the destination of [`Self::backup`] when no path is passed.
    pub fn backup_files(&self) -> CoreResult<Vec<BackupFileView>> {
        let folder = {
            let shell = self.shell()?;
            let profile = shell.store().company_profile()?;
            let configured = profile.backup_folder_path.trim();
            if configured.is_empty() {
                default_backup_dir(&shell.paths().database)
            } else {
                PathBuf::from(configured)
            }
        };
        Ok(backup::list_backups(&folder)?
            .into_iter()
            .map(|file| BackupFileView {
                path: file.path.to_string_lossy().into_owned(),
                created_at: file.metadata.created_at,
                schema_version: file.metadata.schema_version,
                bytes: file.archive_bytes,
            })
            .collect())
    }

    /// Loads the active company profile.
    pub fn company_profile(&self) -> CoreResult<CompanyProfile> {
        self.shell()?.store().company_profile()
    }

    /// Validates and stores the company profile.
    pub fn save_company_profile(&self, profile: &CompanyProfile) -> CoreResult<()> {
        profile.validate().map_err(CoreError::Validation)?;
        self.shell()?.store().save_company_profile(profile)
    }

    /// Lists all documents of the text editor.
    pub fn documents(&self) -> CoreResult<Vec<Document>> {
        self.shell()?.store().list_documents()
    }

    /// Creates or updates a document.
    pub fn save_document(&self, input: &DocumentInput) -> CoreResult<Document> {
        let shell = self.shell()?;
        let store = shell.store();
        let now = now_millis();
        let mut document = match input.id {
            Some(id) => store.get_document(id)?,
            None => Document::new(input.name.clone(), input.body.clone(), now),
        };
        document.name = input.name.clone();
        document.body = input.body.clone();
        document.updated_at = now;
        document.validate().map_err(CoreError::Validation)?;
        if input.id.is_some() {
            store.update_document(&document)?;
        } else {
            store.insert_document(&document)?;
        }
        Ok(document)
    }

    /// Deletes a document.
    pub fn delete_document(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_document(id)
    }

    /// Lists appointments overlapping the half-open range `[from, to)`.
    pub fn appointments_between(&self, from: i64, to: i64) -> CoreResult<Vec<Appointment>> {
        self.shell()?.store().appointments_between(from, to)
    }

    /// Creates or updates an appointment and rejects overlapping open slots.
    pub fn save_appointment(&self, input: &AppointmentInput) -> CoreResult<Appointment> {
        let shell = self.shell()?;
        let store = shell.store();
        let now = now_millis();
        let status = AppointmentStatus::from_storage(&input.status)
            .ok_or_else(|| CoreError::Validation("appointment_status_invalid".to_string()))?;
        let mut appointment = match input.id {
            Some(id) => store
                .find_appointment(id)?
                .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            None => Appointment {
                id: Uuid::new_v4(),
                contact_id: None,
                title: String::new(),
                location: None,
                notes: None,
                status,
                starts_at: 0,
                ends_at: 0,
                created_at: now,
                updated_at: now,
            },
        };
        appointment.contact_id = input.contact_id;
        appointment.title = input.title.clone();
        appointment.location =
            Some(input.location.clone()).filter(|value| !value.trim().is_empty());
        appointment.notes = Some(input.notes.clone()).filter(|value| !value.trim().is_empty());
        appointment.status = status;
        appointment.starts_at = input.starts_at;
        appointment.ends_at = input.ends_at;
        appointment.updated_at = now;
        appointment.validate().map_err(CoreError::Validation)?;
        if !store.appointment_conflicts(&appointment)?.is_empty() {
            return Err(CoreError::Validation("appointment_conflict".to_string()));
        }
        if input.id.is_some() {
            store.update_appointment(&appointment)?;
        } else {
            store.insert_appointment(&appointment)?;
        }
        Ok(appointment)
    }

    /// Deletes an appointment.
    pub fn delete_appointment(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_appointment(id)
    }

    /// Lists contacts, optionally filtered by a search term.
    pub fn contacts(&self, query: Option<&str>) -> CoreResult<Vec<Contact>> {
        let shell = self.shell()?;
        match query.map(str::trim).filter(|query| !query.is_empty()) {
            Some(query) => shell.store().search_contacts(query),
            None => shell.store().list_contacts(),
        }
    }

    /// Creates a contact from the UI form.
    pub fn create_contact(&self, input: &ContactInput) -> CoreResult<Contact> {
        let shell = self.shell()?;
        let contact = build_contact(input, None)?;
        shell.store().insert_contact(&contact)?;
        Ok(contact)
    }

    /// Updates an existing contact from the UI form.
    pub fn update_contact(&self, id: Uuid, input: &ContactInput) -> CoreResult<Contact> {
        let shell = self.shell()?;
        let existing = shell
            .store()
            .find_contact(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let contact = build_contact(input, Some(&existing))?;
        shell.store().update_contact(&contact)?;
        Ok(contact)
    }

    /// Deletes a contact.
    pub fn delete_contact(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_contact(id)
    }

    /// Lists products, optionally filtered by a search term.
    pub fn products(&self, query: Option<&str>) -> CoreResult<Vec<Product>> {
        let shell = self.shell()?;
        match query.map(str::trim).filter(|query| !query.is_empty()) {
            Some(query) => shell.store().search_products(query),
            None => shell.store().list_products(),
        }
    }

    /// Loads one product by id.
    pub fn product(&self, id: Uuid) -> CoreResult<Product> {
        self.shell()?
            .store()
            .find_product(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))
    }

    /// Stores a changed product, for example the reorder exclusion.
    pub fn store_product(&self, product: &Product) -> CoreResult<()> {
        self.shell()?.store().update_product(product)
    }

    /// Stores a purchase order that the reorder assistant generated.
    pub fn create_purchase_order(&self, order: &PurchaseOrder) -> CoreResult<()> {
        self.shell()?.store().insert_purchase_order(order)
    }

    /// Creates a product from the UI form.
    pub fn create_product(&self, input: &ProductInput) -> CoreResult<Product> {
        let shell = self.shell()?;
        let product = build_product(input, None)?;
        shell.store().insert_product(&product)?;
        Ok(product)
    }

    /// Updates an existing product from the UI form.
    pub fn update_product(&self, id: Uuid, input: &ProductInput) -> CoreResult<Product> {
        let shell = self.shell()?;
        let existing = shell
            .store()
            .find_product(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let product = build_product(input, Some(&existing))?;
        shell.store().update_product(&product)?;
        Ok(product)
    }

    /// Deletes a product.
    pub fn delete_product(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_product(id)
    }

    /// Imports a legacy `.socdof.json` backup.
    pub fn import_legacy_backup(&self, archive: &Path) -> CoreResult<legacy::LegacyImportReport> {
        legacy::import(self.shell()?.store(), archive)
    }

    /// Writes a legacy-compatible `.socdof.json` backup.
    pub fn export_legacy_backup(&self, archive: &Path) -> CoreResult<legacy::LegacyExportReport> {
        if let Some(parent) = archive.parent() {
            std::fs::create_dir_all(parent)?;
        }
        legacy::export(self.shell()?.store(), archive)
    }

    /// Lists invoices in the webview format, optionally searched and filtered by status.
    ///
    /// The search goes through the same FTS index as the other screens; `posted` is accepted as the
    /// TypeScript name of the stored `sent` state.
    pub fn invoice_views(
        &self,
        query: Option<&str>,
        status: Option<&str>,
    ) -> CoreResult<Vec<InvoiceView>> {
        let shell = self.shell()?;
        let store = shell.store();
        let invoices = store.list_invoices()?;
        // The TypeScript list searches number, customer and positions. The FTS index covers
        // number, note and positions; the customer labels are matched here.
        let invoices = match query.map(str::trim).filter(|query| !query.is_empty()) {
            Some(query) => {
                let needle = query.to_lowercase();
                let contacts: std::collections::HashMap<Uuid, Contact> = store
                    .list_contacts()?
                    .into_iter()
                    .map(|contact| (contact.id, contact))
                    .collect();
                let hits: HashSet<Uuid> = store
                    .search_invoices(query)?
                    .into_iter()
                    .map(|invoice| invoice.id)
                    .collect();
                invoices
                    .into_iter()
                    .filter(|invoice| {
                        if hits.contains(&invoice.id) {
                            return true;
                        }
                        let contact_match = contacts
                            .get(&invoice.contact_id)
                            .map(|contact| {
                                contact.display_name().to_lowercase().contains(&needle)
                                    || contact
                                        .company_name
                                        .as_deref()
                                        .unwrap_or_default()
                                        .to_lowercase()
                                        .contains(&needle)
                            })
                            .unwrap_or(false);
                        contact_match
                            || invoice.number.to_lowercase().contains(&needle)
                            || invoice
                                .note
                                .as_deref()
                                .unwrap_or_default()
                                .to_lowercase()
                                .contains(&needle)
                            || invoice
                                .lines
                                .iter()
                                .any(|line| line.description.to_lowercase().contains(&needle))
                    })
                    .collect()
            }
            None => invoices,
        };
        let invoices = match status
            .map(str::trim)
            .filter(|status| !status.is_empty() && *status != "all")
        {
            Some(status) => {
                let wanted = status_from_wire(status)
                    .ok_or_else(|| CoreError::Validation("invoice_status_invalid".to_string()))?;
                invoices
                    .into_iter()
                    .filter(|invoice| invoice.status == wanted)
                    .collect()
            }
            None => invoices,
        };
        invoice_views(store, &invoices)
    }

    /// Loads one invoice with the customer labels and computed totals.
    pub fn invoice(&self, id: Uuid) -> CoreResult<InvoiceView> {
        let shell = self.shell()?;
        let invoice = shell
            .store()
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        invoice_view(shell.store(), &invoice)
    }

    /// Dunning letter of an invoice with optional fee and deadline overrides.
    pub fn invoice_dunning(
        &self,
        id: Uuid,
        level: &str,
        fee_cents: Option<i64>,
        days: Option<i64>,
    ) -> CoreResult<InvoiceDunningView> {
        let level = DunningLevel::from_storage(level)
            .ok_or_else(|| CoreError::Validation(format!("unknown dunning level {level}")))?;
        let shell = self.shell()?;
        let store = shell.store();
        let invoice = store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let contact = store.find_contact(invoice.contact_id)?;
        let company = store.company_profile()?;
        Ok(dunning_view(
            &invoice,
            contact.as_ref(),
            &company,
            level,
            fee_cents,
            days,
            now_millis(),
        ))
    }

    /// Mail draft of an invoice.
    pub fn invoice_mail(&self, id: Uuid) -> CoreResult<InvoiceMailView> {
        let shell = self.shell()?;
        let store = shell.store();
        let invoice = store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let contact = store.find_contact(invoice.contact_id)?;
        let company = store.company_profile()?;
        Ok(mail_view(&invoice, contact.as_ref(), &company))
    }

    /// Records a payment and marks the invoice paid in the same transaction.
    pub fn record_invoice_payment(
        &self,
        id: Uuid,
        method: &str,
        reference: Option<&str>,
        paid_at: Option<i64>,
    ) -> CoreResult<InvoicePaymentView> {
        let method = PaymentMethod::from_storage(method)
            .ok_or_else(|| CoreError::Validation(format!("unknown payment method {method}")))?;
        let shell = self.shell()?;
        let store = shell.store();
        store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let company = store.company_profile()?;
        let paid_at = paid_at.unwrap_or_else(now_millis);
        let reference = reference.unwrap_or("").trim();
        let payment = match method {
            PaymentMethod::Transfer => InvoicePayment::new(
                id,
                method,
                paid_at,
                payment::transfer_reference(reference, &company.bank_name),
            ),
            PaymentMethod::Cash => {
                let mut payment =
                    InvoicePayment::new(id, method, paid_at, payment::CASH_REFERENCE.to_string());
                payment.tse_signature = Some(payment::tse_signature(paid_at));
                payment
            }
            PaymentMethod::Card => {
                let auth = if reference.is_empty() {
                    format!(
                        "AUTH-{}",
                        payment::base36(paid_at.max(0) as u64).to_uppercase()
                    )
                } else {
                    reference.to_string()
                };
                let masked = payment::mask_card_number("4532 1234 5678 9012");
                InvoicePayment::new(
                    id,
                    method,
                    paid_at,
                    payment::card_reference(&company.card_terminal_name, "card", &masked, &auth),
                )
            }
        };
        store.record_invoice_payment(&payment)?;
        Ok(payment_view(&payment))
    }

    /// Payment recorded for an invoice, if any.
    pub fn invoice_payment(&self, id: Uuid) -> CoreResult<Option<InvoicePaymentView>> {
        let shell = self.shell()?;
        Ok(shell
            .store()
            .invoice_payment(id)?
            .as_ref()
            .map(payment_view))
    }

    /// Mail draft of a contact.
    pub fn contact_mail(&self, id: Uuid) -> CoreResult<ContactMailView> {
        let shell = self.shell()?;
        let store = shell.store();
        let contact = store
            .find_contact(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let company = store.company_profile()?;
        Ok(contact_mail_view(&contact, &company, now_millis()))
    }

    /// Complete `.eml` of a contact mail with the edited fields of the dialog.
    pub fn contact_eml(
        &self,
        id: Uuid,
        recipient_name: &str,
        recipient_email: &str,
        subject: &str,
        body: &str,
    ) -> CoreResult<String> {
        let shell = self.shell()?;
        let store = shell.store();
        let contact = store
            .find_contact(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let company = store.company_profile()?;
        Ok(socdof_core::domain::mail::contact_eml_with(
            &contact,
            &company,
            recipient_name,
            recipient_email,
            subject,
            body,
            now_millis(),
        ))
    }

    /// FatturaPA document of an invoice.
    pub fn invoice_fattura(
        &self,
        id: Uuid,
        input: &FatturaInput,
    ) -> CoreResult<InvoiceFatturaView> {
        let shell = self.shell()?;
        let store = shell.store();
        let invoice = store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let contact = store.find_contact(invoice.contact_id)?;
        let company = store.company_profile()?;
        let method = store.invoice_payment(id)?.map(|payment| payment.method);
        Ok(fattura_view(
            &invoice,
            contact.as_ref(),
            &company,
            method.as_ref().map(|method| method.as_str()),
            input,
        ))
    }

    /// Complete fleet snapshot with vehicles, logbook, receipts and KPI values.
    pub fn fleet_overview(&self) -> CoreResult<FleetOverviewView> {
        let shell = self.shell()?;
        let store = shell.store();
        let vehicles = store.fleet_vehicles()?;
        let trips = store.fleet_trips()?;
        let fuel = store.fleet_fuel()?;
        let company = store.company_profile()?;
        let csv_file_name = socdof_core::domain::fleet::csv_file_name(&company.name, now_millis());
        Ok(overview(&vehicles, &trips, &fuel, csv_file_name))
    }

    /// Creates or updates a fleet vehicle.
    pub fn save_fleet_vehicle(&self, input: &FleetVehicleInput) -> CoreResult<FleetVehicleView> {
        let shell = self.shell()?;
        let store = shell.store();
        let existing = input
            .id
            .map(|id| store.fleet_vehicle(id))
            .transpose()?
            .flatten();
        let vehicle = input.to_vehicle(now_millis(), existing.as_ref().map(|v| v.created_at));
        if existing.is_some() {
            store.update_fleet_vehicle(&vehicle)?;
        } else {
            store.insert_fleet_vehicle(&vehicle)?;
        }
        Ok(vehicle_view(&vehicle))
    }

    /// Deletes a fleet vehicle.
    pub fn delete_fleet_vehicle(&self, id: Uuid) -> CoreResult<()> {
        let shell = self.shell()?;
        shell.store().delete_fleet_vehicle(id)
    }

    /// Creates or updates a logbook trip.
    pub fn save_fleet_trip(&self, input: &FleetTripInput) -> CoreResult<FleetTripView> {
        let shell = self.shell()?;
        let store = shell.store();
        let vehicle_id = input.vehicle_id.unwrap_or_else(Uuid::nil);
        let plate = store
            .fleet_vehicle(vehicle_id)?
            .map(|vehicle| vehicle.license_plate)
            .unwrap_or_else(|| "M-SO 2026".to_string());
        let existing = match input.id {
            None => None,
            Some(id) => Some(
                store
                    .fleet_trips()?
                    .into_iter()
                    .find(|trip| trip.id == id)
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
        };
        let trip = input.to_trip(
            now_millis(),
            existing.as_ref().map(|trip| trip.created_at),
            plate,
        );
        if existing.is_some() {
            store.update_fleet_trip(&trip)?;
        } else {
            store.insert_fleet_trip(&trip)?;
        }
        Ok(trip_view(&trip))
    }

    /// Deletes a logbook trip.
    pub fn delete_fleet_trip(&self, id: Uuid) -> CoreResult<()> {
        let shell = self.shell()?;
        shell.store().delete_fleet_trip(id)
    }

    /// Creates or updates a fuel receipt.
    pub fn save_fleet_fuel(&self, input: &FleetFuelInput) -> CoreResult<FleetFuelView> {
        let shell = self.shell()?;
        let store = shell.store();
        let vehicle_id = input.vehicle_id.unwrap_or_else(Uuid::nil);
        let plate = store
            .fleet_vehicle(vehicle_id)?
            .map(|vehicle| vehicle.license_plate)
            .unwrap_or_else(|| "M-SO 2026".to_string());
        let existing = match input.id {
            None => None,
            Some(id) => Some(
                store
                    .fleet_fuel()?
                    .into_iter()
                    .find(|entry| entry.id == id)
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
        };
        let entry = input.to_fuel(
            now_millis(),
            existing.as_ref().map(|entry| entry.created_at),
            plate,
        );
        if existing.is_some() {
            store.update_fleet_fuel(&entry)?;
        } else {
            store.insert_fleet_fuel(&entry)?;
        }
        Ok(fuel_view(&entry))
    }

    /// Deletes a fuel receipt.
    pub fn delete_fleet_fuel(&self, id: Uuid) -> CoreResult<()> {
        let shell = self.shell()?;
        shell.store().delete_fleet_fuel(id)
    }

    /// Exports all contacts as the legacy-compatible semicolon CSV.
    pub fn export_contacts_csv(&self, path: &std::path::Path) -> CoreResult<usize> {
        self.shell()?.export_contacts_csv(path)
    }

    /// Imports contacts from the legacy-compatible semicolon CSV.
    pub fn import_contacts_csv(
        &self,
        path: &std::path::Path,
    ) -> CoreResult<socdof_core::csv::ImportReport> {
        self.shell()?.import_contacts_csv(path)
    }

    /// Exports all contacts as vCard 3.0.
    pub fn export_contacts_vcf(&self, path: &std::path::Path) -> CoreResult<usize> {
        self.shell()?.export_contacts_vcf(path)
    }

    /// Writes the GoBD logbook CSV.
    pub fn export_fleet_csv(&self, path: &std::path::Path) -> CoreResult<FleetCsvReport> {
        let shell = self.shell()?;
        let trips = shell.store().fleet_trips()?;
        let (content, rows) = csv_bytes(&trips);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(FleetCsvReport {
            path: path.display().to_string(),
            bytes: content.len() as u64,
            rows,
        })
    }

    /// Complete project portfolio with Kanban tasks, contacts and KPI values.
    pub fn project_overview(&self) -> CoreResult<ProjectOverviewView> {
        let shell = self.shell()?;
        let store = shell.store();
        let projects = store.projects()?;
        let tasks = store.project_tasks_all()?;
        let contacts = store.list_contacts()?;
        let company = store.company_profile()?;
        let csv_file_name = project::csv_file_name(&company.name, now_millis());
        Ok(project_overview_view(
            &projects,
            &tasks,
            &contacts,
            csv_file_name,
        ))
    }

    /// Creates or updates a project of the portfolio.
    pub fn save_project(&self, input: &ProjectInput) -> CoreResult<ProjectView> {
        let shell = self.shell()?;
        let store = shell.store();
        let existing = match input.id {
            Some(id) => Some(
                store
                    .project(id)?
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
            None => None,
        };
        let client_name = match input.contact_id {
            Some(id) => store
                .find_contact(id)?
                .ok_or_else(|| CoreError::Validation("project_contact_unknown".to_string()))?
                .display_name(),
            None => String::new(),
        };
        let now = now_millis();
        let year = socdof_core::date::civil_from_millis(now).0;
        let count = store.projects()?.len();
        let fallback_code = existing
            .as_ref()
            .map(|project| project.code.clone())
            .unwrap_or_else(|| project::default_code(year, count));
        let project = input.to_project(
            now,
            existing.as_ref().map(|project| project.created_at),
            fallback_code,
            client_name,
        );
        if existing.is_some() {
            store.update_project(&project)?;
        } else {
            store.insert_project(&project)?;
        }
        let tasks = store.project_tasks(project.id)?;
        Ok(project_view(&project, &tasks))
    }

    /// Deletes a project and all of its tasks.
    pub fn delete_project(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_project(id)
    }

    /// Creates or updates a Kanban task and touches the project timestamp.
    pub fn save_project_task(&self, input: &ProjectTaskInput) -> CoreResult<ProjectTaskView> {
        let shell = self.shell()?;
        let store = shell.store();
        let project_id = input
            .project_id
            .ok_or_else(|| CoreError::Validation("project_required".to_string()))?;
        let project = store
            .project(project_id)?
            .ok_or_else(|| CoreError::NotFound(project_id.to_string()))?;
        let existing = match input.id {
            Some(id) => Some(
                store
                    .project_task(id)?
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
            None => None,
        };
        if existing
            .as_ref()
            .is_some_and(|task| task.project_id != project_id)
        {
            return Err(CoreError::NotFound(
                input.id.unwrap_or_default().to_string(),
            ));
        }
        let now = now_millis();
        let task = input.to_task(
            now,
            existing.as_ref().map(|task| task.created_at),
            project_id,
        );
        if existing.is_some() {
            store.update_project_task(&task)?;
        } else {
            store.insert_project_task(&task)?;
        }
        let mut touched = project;
        touched.updated_at = now;
        store.update_project(&touched)?;
        Ok(task_view(&task))
    }

    /// Deletes one task of a project.
    pub fn delete_project_task(&self, project_id: Uuid, task_id: Uuid) -> CoreResult<()> {
        self.shell()?
            .store()
            .delete_project_task(project_id, task_id)
    }

    /// Moves a Kanban task to another status.
    pub fn set_project_task_status(
        &self,
        project_id: Uuid,
        task_id: Uuid,
        status: &str,
    ) -> CoreResult<ProjectTaskView> {
        let shell = self.shell()?;
        let store = shell.store();
        store.set_project_task_status(project_id, task_id, status)?;
        let task = store
            .project_task(task_id)?
            .ok_or_else(|| CoreError::NotFound(task_id.to_string()))?;
        Ok(task_view(&task))
    }

    /// Writes the portfolio CSV.
    pub fn export_projects_csv(&self, path: &std::path::Path) -> CoreResult<ProjectCsvReport> {
        let shell = self.shell()?;
        let store = shell.store();
        let projects = store.projects()?;
        let tasks = store.project_tasks_all()?;
        let (content, rows) = project_csv_bytes(&projects, &tasks);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(ProjectCsvReport {
            path: path.display().to_string(),
            bytes: content.len() as u64,
            rows,
        })
    }

    /// Re-reads one project from the database; the native smoke uses it as a persistence check.
    pub fn project_persistence(&self, id: Uuid) -> CoreResult<ProjectPersistenceView> {
        let shell = self.shell()?;
        let store = shell.store();
        let project = store.project(id)?;
        let tasks = match project.as_ref() {
            Some(project) => store.project_tasks(project.id)?.len() as i64,
            None => 0,
        };
        Ok(ProjectPersistenceView {
            present: project.is_some(),
            tasks,
            code: project.map(|project| project.code).unwrap_or_default(),
        })
    }

    /// Creates a draft invoice from all billable, logged tasks of a project.
    pub fn create_project_invoice(&self, id: Uuid) -> CoreResult<InvoiceView> {
        let (contact_id, number, date_text, due_text, currency, note, items) = {
            let shell = self.shell()?;
            let store = shell.store();
            let project = store
                .project(id)?
                .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
            let contact_id = project
                .contact_id
                .ok_or_else(|| CoreError::Validation("project_contact_required".to_string()))?;
            let tasks = store.project_tasks(project.id)?;
            let billable: Vec<_> = tasks
                .into_iter()
                .filter(|task| task.billable && task.logged_hours_milli > 0)
                .collect();
            if billable.is_empty() {
                return Err(CoreError::Validation(
                    "project_billable_tasks_required".to_string(),
                ));
            }
            let company = store.company_profile()?;
            let template = invoice_template::active(store)?;
            let invoices = store.list_invoices()?;
            let now = now_millis();
            let rate = if project.hourly_rate_cents == 0 {
                project::DEFAULT_HOURLY_RATE_CENTS
            } else {
                project.hourly_rate_cents
            };
            let items = billable
                .iter()
                .map(|task| InvoiceItemInput {
                    description: format!("{} - {}", project.code, task.title),
                    quantity_milli: task.logged_hours_milli,
                    unit_price_cents: rate,
                    tax_rate_bp: 1900,
                })
                .collect();
            (
                contact_id,
                suggest_number(&invoices, now),
                project::iso_date(now),
                project::iso_date(now + template.due_days.max(0) * crate::invoice_bridge::DAY_MS),
                company.currency,
                format!("Projekt {} - {}", project.code, project.title),
                items,
            )
        };
        self.save_invoice(&InvoiceInput {
            id: None,
            number,
            contact_id,
            status: "draft".to_string(),
            date: date_text,
            due_date: due_text,
            currency_symbol: currency,
            notes: note,
            items,
        })
    }

    /// Complete restaurant screen with menu, floor plan, orders, KPIs and Z-report values.
    pub fn restaurant_overview(&self) -> CoreResult<RestaurantOverviewView> {
        let shell = self.shell()?;
        let store = shell.store();
        let menu = store.restaurant_menu()?;
        let orders = store.restaurant_orders()?;
        let company = store.company_profile()?;
        Ok(restaurant_overview_view(
            &menu,
            &orders,
            &company,
            now_millis(),
        ))
    }

    /// Creates or updates one menu dish.
    pub fn save_restaurant_menu_item(&self, input: &MenuItemInput) -> CoreResult<MenuItemView> {
        let shell = self.shell()?;
        let store = shell.store();
        let existing = match input.id {
            Some(id) => Some(
                store
                    .restaurant_menu_item(id)?
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
            None => None,
        };
        let item = menu_item(input, existing.as_ref(), now_millis());
        if existing.is_some() {
            store.update_restaurant_menu_item(&item)?;
        } else {
            store.insert_restaurant_menu_item(&item)?;
        }
        Ok(menu_view(&item))
    }

    /// Deletes one menu dish; existing order lines keep their copied values.
    pub fn delete_restaurant_menu_item(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_restaurant_menu_item(id)
    }

    /// Adds one dish to the open order of a table, opening the order when necessary.
    pub fn add_restaurant_item(
        &self,
        table_number: &str,
        menu_item_id: Uuid,
    ) -> CoreResult<RestaurantOrderMutationView> {
        let shell = self.shell()?;
        let store = shell.store();
        let dish = store
            .restaurant_menu_item(menu_item_id)?
            .ok_or_else(|| CoreError::NotFound(menu_item_id.to_string()))?;
        let now = now_millis();
        let existing = store.restaurant_open_order(table_number)?;
        let created = existing.is_none();
        let mut order = existing.unwrap_or_else(|| TableOrder::new(table_number, now));
        order.add_menu_item(&dish, now);
        store.save_restaurant_order(&order)?;
        Ok(RestaurantOrderMutationView {
            order: Some(order_view(&order)),
            created,
        })
    }

    /// Changes the quantity of one ordered position, deleting the order when it becomes empty.
    pub fn set_restaurant_order_item_qty(
        &self,
        order_id: Uuid,
        item_id: Uuid,
        qty: i64,
    ) -> CoreResult<RestaurantOrderMutationView> {
        let shell = self.shell()?;
        let store = shell.store();
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| CoreError::NotFound(order_id.to_string()))?;
        if order.status == "paid" {
            return Err(CoreError::Validation(
                "restaurant_order_already_paid".to_string(),
            ));
        }
        if !order.set_item_qty(item_id, qty, now_millis()) {
            store.delete_restaurant_order(order.id)?;
            return Ok(RestaurantOrderMutationView {
                order: None,
                created: false,
            });
        }
        store.update_restaurant_order(&order)?;
        Ok(RestaurantOrderMutationView {
            order: Some(order_view(&order)),
            created: false,
        })
    }

    /// Replaces the kitchen note of one ordered position.
    pub fn set_restaurant_order_item_notes(
        &self,
        order_id: Uuid,
        item_id: Uuid,
        notes: &str,
    ) -> CoreResult<TableOrderView> {
        let shell = self.shell()?;
        let store = shell.store();
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| CoreError::NotFound(order_id.to_string()))?;
        if !order.set_item_notes(item_id, notes, now_millis()) {
            return Err(CoreError::NotFound(item_id.to_string()));
        }
        store.update_restaurant_order(&order)?;
        Ok(order_view(&order))
    }

    /// Stores the server name of an open table order.
    pub fn set_restaurant_order_server(
        &self,
        order_id: Uuid,
        server_name: &str,
    ) -> CoreResult<TableOrderView> {
        let shell = self.shell()?;
        let store = shell.store();
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| CoreError::NotFound(order_id.to_string()))?;
        if order.status == "paid" {
            return Err(CoreError::Validation(
                "restaurant_order_already_paid".to_string(),
            ));
        }
        order.server_name = server_name.trim().to_string();
        order.updated_at = now_millis();
        store.update_restaurant_order(&order)?;
        Ok(order_view(&order))
    }

    /// Moves a table order through the kitchen flow.
    pub fn set_restaurant_order_status(
        &self,
        order_id: Uuid,
        status: &str,
    ) -> CoreResult<TableOrderView> {
        if !restaurant::valid_status(status) || status == "paid" {
            return Err(CoreError::Validation(
                "restaurant_order_status_invalid".to_string(),
            ));
        }
        let shell = self.shell()?;
        let store = shell.store();
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| CoreError::NotFound(order_id.to_string()))?;
        if order.status == "paid" {
            return Err(CoreError::Validation(
                "restaurant_order_already_paid".to_string(),
            ));
        }
        order.status = status.to_string();
        order.updated_at = now_millis();
        store.update_restaurant_order(&order)?;
        Ok(order_view(&order))
    }

    /// Cancels / deletes an open or archived table order.
    pub fn delete_restaurant_order(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_restaurant_order(id)
    }

    /// Settles a table: paid restaurant order, POS receipt and official ERP invoice in one transaction.
    pub fn restaurant_checkout(
        &self,
        input: &RestaurantCheckoutInput,
    ) -> CoreResult<RestaurantCheckoutView> {
        if !restaurant::valid_payment_method(&input.payment_method) {
            return Err(CoreError::Validation(
                "restaurant_payment_method_invalid".to_string(),
            ));
        }
        let tip_cents = (input.tip * 100.0).round().max(0.0) as i64;
        let split_count = input.split_count.max(1);
        let (paid, invoice, receipt, invoice_number, total_with_tip, change) = {
            let shell = self.shell()?;
            let store = shell.store();
            let order_id = input
                .order_id
                .ok_or_else(|| CoreError::Validation("restaurant_order_required".to_string()))?;
            let order = store
                .restaurant_order(order_id)?
                .ok_or_else(|| CoreError::NotFound(order_id.to_string()))?;
            if order.status == "paid" {
                return Err(CoreError::Validation(
                    "restaurant_order_already_paid".to_string(),
                ));
            }
            if order.items.is_empty() {
                return Err(CoreError::Validation(
                    "restaurant_order_items_required".to_string(),
                ));
            }
            let now = now_millis();
            let (year, _, _) = socdof_core::date::civil_from_millis(now);
            let receipt_number = store.restaurant_receipt_number(year)?;
            let company = store.company_profile()?;
            let contact = store.restaurant_walk_in_contact(now)?;
            let currency = if company.currency.trim().is_empty() {
                "€".to_string()
            } else {
                company.currency.clone()
            };
            let total_with_tip = order.total_cents + tip_cents;
            let cash_tendered = input.cash_given.map(|value| (value * 100.0).round() as i64);
            let change = if input.payment_method == "cash" {
                cash_tendered
                    .map(|cash| (cash - total_with_tip).max(0))
                    .unwrap_or(0)
            } else {
                0
            };

            let mut paid = order.clone();
            paid.status = "paid".to_string();
            paid.payment_method = Some(input.payment_method.clone());
            paid.paid_at = Some(now);
            paid.tip_cents = tip_cents;
            paid.cash_tendered_cents = cash_tendered;
            paid.cash_change_cents = if input.payment_method == "cash" {
                Some(change)
            } else {
                None
            };
            paid.is_hospitality_receipt = input.is_hospitality_receipt;
            paid.hospitality_host = input.hospitality_host.trim().to_string();
            paid.hospitality_occasion = input.hospitality_occasion.trim().to_string();
            paid.hospitality_guests = input.hospitality_guests.trim().to_string();
            paid.receipt_number = Some(receipt_number.clone());
            paid.invoice_id = Some(Uuid::new_v4());
            paid.updated_at = now;
            paid.recalculate();

            let note = if paid.is_hospitality_receipt {
                format!(
                    "Bewirtungsbeleg: Anlass: {} • Bewirtete Personen: {} • Gastgeber: {} • Zahlart: {}",
                    if paid.hospitality_occasion.is_empty() {
                        "Geschäftsessen"
                    } else {
                        &paid.hospitality_occasion
                    },
                    if paid.hospitality_guests.is_empty() {
                        "Gäste"
                    } else {
                        &paid.hospitality_guests
                    },
                    if paid.hospitality_host.is_empty() {
                        &company.name
                    } else {
                        &paid.hospitality_host
                    },
                    input.payment_method.to_uppercase()
                )
            } else {
                format!(
                    "Gastronomie Kassenbeleg • {} • Zahlart: {}",
                    paid.table_number,
                    input.payment_method.to_uppercase()
                )
            };
            let invoice = Invoice {
                id: paid.invoice_id.unwrap_or_else(Uuid::new_v4),
                number: receipt_number.clone(),
                contact_id: contact.id,
                status: InvoiceStatus::Paid,
                issued_at: now,
                due_at: now,
                currency_symbol: currency.clone(),
                note: Some(note.clone()),
                lines: paid
                    .items
                    .iter()
                    .map(|item| InvoiceLine {
                        description: item.name.clone(),
                        quantity_milli: item.qty * 1_000,
                        unit_price: Money::from_cents(item.price_cents),
                        tax_rate_bp: item.tax_rate_bp,
                    })
                    .collect(),
            };
            let pos_method = if input.payment_method == "cash" {
                PosPaymentMethod::Cash
            } else {
                PosPaymentMethod::Card
            };
            let receipt = PosOrder {
                id: Uuid::new_v4(),
                receipt_number: receipt_number.clone(),
                contact_id: Some(contact.id),
                payment_method: pos_method,
                paid_at: now,
                currency_symbol: currency,
                note: Some(note),
                cash_given: if input.payment_method == "cash" {
                    cash_tendered.map(Money::from_cents)
                } else {
                    None
                },
                lines: paid
                    .items
                    .iter()
                    .map(|item| PosOrderLine {
                        product_id: None,
                        description: item.name.clone(),
                        quantity_milli: item.qty * 1_000,
                        unit_price: Money::from_cents(item.price_cents),
                        tax_rate_bp: item.tax_rate_bp,
                    })
                    .collect(),
                legacy_id: None,
            };
            store.restaurant_checkout(&paid, &invoice, &receipt)?;
            (
                paid,
                invoice,
                receipt,
                receipt_number,
                total_with_tip,
                change,
            )
        };
        let _ = &receipt;
        Ok(RestaurantCheckoutView {
            order: order_view(&paid),
            invoice_id: invoice.id,
            invoice_number,
            total_with_tip: total_with_tip as f64 / 100.0,
            change: change as f64 / 100.0,
            split_count,
            total_per_person: (total_with_tip as f64 / 100.0) / split_count as f64,
        })
    }

    /// Re-reads one restaurant order and the menu size for the persistence marker.
    pub fn restaurant_persistence(&self, id: Uuid) -> CoreResult<RestaurantPersistenceView> {
        let shell = self.shell()?;
        let store = shell.store();
        let order = store.restaurant_order(id)?;
        Ok(RestaurantPersistenceView {
            present: order.is_some(),
            items: order
                .as_ref()
                .map(|order| order.items.len() as i64)
                .unwrap_or(0),
            menu: store.restaurant_menu()?.len() as i64,
            status: order
                .as_ref()
                .map(|order| order.status.clone())
                .unwrap_or_default(),
            receipt_number: order.and_then(|order| order.receipt_number),
        })
    }

    /// Writes the paid restaurant receipts as CSV.
    pub fn export_restaurant_csv(&self, path: &std::path::Path) -> CoreResult<RestaurantCsvReport> {
        let shell = self.shell()?;
        let orders = shell.store().restaurant_orders()?;
        let (content, rows) = restaurant_csv_bytes(&orders);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(RestaurantCsvReport {
            path: path.display().to_string(),
            bytes: content.len() as u64,
            rows,
        })
    }

    /// Defaults of a new invoice: the next number, the company currency and the template term.
    pub fn invoice_defaults(&self) -> CoreResult<InvoiceDefaults> {
        let shell = self.shell()?;
        let store = shell.store();
        let invoices = store.list_invoices()?;
        let company = store.company_profile()?;
        let template = invoice_template::active(store)?;
        let currency_symbol = match company.currency.trim() {
            "" => "€".to_string(),
            value => value.to_string(),
        };
        Ok(InvoiceDefaults {
            number: suggest_number(&invoices, now_millis()),
            currency_symbol,
            due_days: template.due_days.max(0),
        })
    }

    /// Creates or replaces an invoice from the editor and returns the stored view.
    pub fn save_invoice(&self, input: &InvoiceInput) -> CoreResult<InvoiceView> {
        let shell = self.shell()?;
        let store = shell.store();
        let company = store.company_profile()?;
        let existing = match input.id {
            Some(id) => Some(
                store
                    .find_invoice(id)?
                    .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            ),
            None => None,
        };
        if store.find_contact(input.contact_id)?.is_none() {
            return Err(CoreError::Validation(
                "invoice_contact_required".to_string(),
            ));
        }
        let invoice = input.to_invoice(existing.as_ref(), &company)?;
        match existing {
            Some(_) => store.update_invoice(&invoice)?,
            None => store.insert_invoice(&invoice)?,
        }
        invoice_view(store, &invoice)
    }

    /// Deletes an invoice and its positions.
    pub fn delete_invoice(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_invoice(id)
    }

    /// Moves an invoice to another lifecycle state and reports the stored state.
    pub fn set_invoice_status(&self, id: Uuid, status: &str) -> CoreResult<InvoiceView> {
        let status = status_from_wire(status)
            .ok_or_else(|| CoreError::Validation("invoice_status_invalid".to_string()))?;
        {
            let shell = self.shell()?;
            shell.store().set_invoice_status(id, status)?;
        }
        self.invoice(id)
    }

    /// Renders the preview dialog of one invoice with the selected template.
    pub fn invoice_preview(
        &self,
        id: Uuid,
        template_id: Option<&str>,
    ) -> CoreResult<InvoicePreview> {
        let shell = self.shell()?;
        let store = shell.store();
        let invoice = store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let contact = store
            .find_contact(invoice.contact_id)?
            .ok_or_else(|| CoreError::NotFound(invoice.contact_id.to_string()))?;
        let company = store.company_profile()?;
        let book = invoice_template::load(store)?;
        let template = resolve_template(&book, template_id);
        let currency = invoice.currency_symbol.as_str();
        let html = template.render_html(&invoice, &contact, &company, currency);
        let tokens = preview_tokens(&template, &invoice, &contact, &company, currency);

        Ok(InvoicePreview {
            invoice: InvoiceView::from_invoice(&invoice, Some(&contact)),
            template_id: template.id.clone(),
            template_name: template.name.clone(),
            html,
            stationery_mode: template.stationery_mode,
            stationery_source: template.stationery_source.clone(),
            tokens,
        })
    }

    /// Writes an invoice as PDF or DOCX with the selected template.
    ///
    /// Without an explicit path the file is written next to the database under `exports/`.
    pub fn export_invoice(
        &self,
        id: Uuid,
        template_id: Option<&str>,
        format: &str,
        path: Option<&Path>,
    ) -> CoreResult<InvoiceExportReport> {
        let format = InvoiceExportFormat::from_wire(format)
            .ok_or_else(|| CoreError::Validation("invoice_export_format_invalid".to_string()))?;
        let shell = self.shell()?;
        let store = shell.store();
        let invoice = store
            .find_invoice(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let book = invoice_template::load(store)?;
        let template = resolve_template(&book, template_id);
        let path = match path {
            Some(path) => path.to_path_buf(),
            None => {
                default_export_path(&shell.paths().database, &invoice.number, format.extension())
            }
        };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        write_invoice_export(store, &invoice, &template, format, &path)
    }

    /// Lists journal entries, optionally filtered by a search term.
    pub fn journal_entries(&self, query: Option<&str>) -> CoreResult<Vec<JournalEntry>> {
        let shell = self.shell()?;
        match query.map(str::trim).filter(|query| !query.is_empty()) {
            Some(query) => shell.store().search_journal_entries(query),
            None => shell.store().list_journal_entries(),
        }
    }

    /// Summarises the journal for the BWA.
    pub fn journal_summary(&self) -> CoreResult<JournalSummary> {
        Ok(accounting::summarize(
            &self.shell()?.store().list_journal_entries()?,
        ))
    }

    /// Builds the cash book with the running balance.
    pub fn journal_cash_book(&self) -> CoreResult<Vec<accounting::CashBookRow>> {
        Ok(accounting::cash_book(
            &self.shell()?.store().list_journal_entries()?,
        ))
    }

    /// Creates or updates a journal entry.
    pub fn save_journal_entry(&self, input: &JournalInput) -> CoreResult<JournalEntry> {
        let shell = self.shell()?;
        let store = shell.store();
        let now = now_millis();
        let kind = JournalKind::from_storage(&input.kind)
            .ok_or_else(|| CoreError::Validation("journal_kind_invalid".to_string()))?;
        let channel = BookingChannel::from_storage(&input.channel)
            .ok_or_else(|| CoreError::Validation("journal_channel_invalid".to_string()))?;
        let mut entry = match input.id {
            Some(id) => store
                .find_journal_entry(id)?
                .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            None => JournalEntry::new(now),
        };
        entry.booked_at = if input.booked_at > 0 {
            input.booked_at
        } else {
            now
        };
        entry.description = input.description.clone();
        entry.account = input.account.clone();
        entry.counter_account = input.counter_account.clone();
        entry.amount = Money::from_cents(input.amount_cents);
        entry.tax_rate_bp = input.tax_rate_bp;
        entry.kind = kind;
        entry.channel = channel;
        entry.reference = Some(input.reference.clone()).filter(|value| !value.trim().is_empty());
        entry.updated_at = now;
        entry.validate().map_err(CoreError::Validation)?;
        if input.id.is_some() {
            store.update_journal_entry(&entry)?;
        } else {
            store.insert_journal_entry(&entry)?;
        }
        Ok(entry)
    }

    /// Deletes a journal entry.
    pub fn delete_journal_entry(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_journal_entry(id)
    }

    /// Writes the journal as CSV and returns the number of bytes.
    pub fn export_journal_csv(&self, path: &Path) -> CoreResult<usize> {
        let entries = self.shell()?.store().list_journal_entries()?;
        let csv = accounting::export_csv(&entries);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, csv.as_bytes())?;
        Ok(csv.len())
    }

    /// Lists purchase orders, optionally filtered by a search term.
    pub fn purchase_orders(&self, query: Option<&str>) -> CoreResult<Vec<PurchaseOrder>> {
        let shell = self.shell()?;
        match query.map(str::trim).filter(|query| !query.is_empty()) {
            Some(query) => shell.store().search_purchase_orders(query),
            None => shell.store().list_purchase_orders(),
        }
    }

    /// Creates or updates a purchase order after validating its vendor and product references.
    pub fn save_purchase_order(&self, input: &PurchaseInput) -> CoreResult<PurchaseOrder> {
        let shell = self.shell()?;
        let store = shell.store();
        let now = now_millis();
        let vendor_id = input
            .vendor_id
            .ok_or_else(|| CoreError::Validation("purchase_vendor_required".to_string()))?;
        let vendor = store
            .find_contact(vendor_id)?
            .ok_or_else(|| CoreError::Validation("purchase_vendor_unknown".to_string()))?;
        if !matches!(vendor.contact_type, ContactType::Vendor | ContactType::Both) {
            return Err(CoreError::Validation(
                "purchase_vendor_not_supplier".to_string(),
            ));
        }
        let mut order = match input.id {
            Some(id) => store
                .find_purchase_order(id)?
                .ok_or_else(|| CoreError::NotFound(id.to_string()))?,
            None => PurchaseOrder {
                id: Uuid::new_v4(),
                number: String::new(),
                vendor_id,
                status: PurchaseOrderStatus::Draft,
                order_date: now,
                expected_at: input.expected_at,
                currency_symbol: "€".to_string(),
                note: None,
                lines: Vec::new(),
                legacy_id: None,
                created_at: now,
                updated_at: now,
            },
        };
        order.number = input.number.trim().to_string();
        order.vendor_id = vendor_id;
        order.note = Some(input.note.clone()).filter(|value| !value.trim().is_empty());
        order.expected_at = input.expected_at;
        order.updated_at = now;
        order.lines = input
            .lines
            .iter()
            .map(|line| {
                if let Some(product_id) = line.product_id {
                    if store.find_product(product_id)?.is_none() {
                        return Err(CoreError::Validation(
                            "purchase_product_unknown".to_string(),
                        ));
                    }
                }
                Ok(PurchaseOrderLine {
                    product_id: line.product_id,
                    description: line.description.clone(),
                    quantity_milli: line.quantity_milli,
                    unit_cost: Money::from_cents(line.unit_cost_cents),
                    tax_rate_bp: line.tax_rate_bp,
                })
            })
            .collect::<CoreResult<Vec<_>>>()?;
        order.validate().map_err(CoreError::Validation)?;
        if input.id.is_some() {
            store.update_purchase_order(&order)?;
        } else {
            store.insert_purchase_order(&order)?;
        }
        Ok(order)
    }

    /// Deletes a purchase order.
    pub fn delete_purchase_order(&self, id: Uuid) -> CoreResult<()> {
        self.shell()?.store().delete_purchase_order(id)
    }

    /// Changes the lifecycle state of a purchase order.
    pub fn set_purchase_order_status(&self, id: Uuid, status: &str) -> CoreResult<()> {
        let status = PurchaseOrderStatus::from_storage(status)
            .ok_or_else(|| CoreError::Validation("purchase_status_invalid".to_string()))?;
        self.shell()?
            .store()
            .set_purchase_order_status(id, status, now_millis())
    }

    /// Books the whole purchase order into stock and marks it received.
    pub fn receive_purchase_order(&self, id: Uuid) -> CoreResult<()> {
        let shell = self.shell()?;
        let store = shell.store();
        let order = store
            .find_purchase_order(id)?
            .ok_or_else(|| CoreError::NotFound(id.to_string()))?;
        let movements = order.stock_moves(now_millis());
        store.receive_purchase_order(id, &movements, now_millis())
    }

    /// Builds the report for the half-open period `[from, to)`.
    pub fn report(&self, from: i64, to: i64) -> CoreResult<socdof_core::store::reports::Report> {
        self.shell()?.store().report(from, to)
    }

    /// Loads the AppStore catalogue and activation state.
    pub fn app_store_modules(&self) -> CoreResult<Vec<AppStoreModuleView>> {
        Ok(app_store::modules(self.shell()?.store())?
            .into_iter()
            .map(|module| AppStoreModuleView {
                id: module.module.as_str().to_string(),
                name_key: module.name_key.to_string(),
                description_key: module.description_key.to_string(),
                version: module.version.to_string(),
                license: match module.license {
                    ModuleLicense::Included => "included",
                    ModuleLicense::Trial => "trial",
                    ModuleLicense::Locked => "locked",
                }
                .to_string(),
                required: module.required,
                active: module.active,
                can_toggle: module.can_toggle(),
            })
            .collect())
    }

    /// Activates or deactivates one AppStore module.
    pub fn set_app_store_module(&self, id: &str, active: bool) -> CoreResult<()> {
        app_store::set_active(self.shell()?.store(), id, active)
    }

    /// Reads and validates a native backup archive without writing anything.
    pub fn verify_backup(&self, archive: &Path) -> CoreResult<backup::BackupMetadata> {
        Ok(backup::read_backup(archive)?.metadata)
    }

    /// Restores a native archive over the open database and reopens the store.
    pub fn restore_backup(&self, archive: &Path) -> CoreResult<RestoreReport> {
        let mut shell = self.shell()?;
        let metadata = shell.restore(archive)?;
        let schema_version = shell.store().schema_version()?;
        Ok(RestoreReport {
            kind: "container".to_string(),
            created_at: metadata.created_at,
            schema_version,
            imported_records: None,
        })
    }

    fn shell(&self) -> CoreResult<MutexGuard<'_, Shell>> {
        self.shell
            .lock()
            .map_err(|_| CoreError::Validation("desktop_state_poisoned".to_string()))
    }
}

fn build_contact(input: &ContactInput, existing: Option<&Contact>) -> CoreResult<Contact> {
    let now = now_millis();
    let mut contact = existing
        .cloned()
        .unwrap_or_else(|| Contact::new(ContactKind::Person, now));

    contact.kind = if input.is_company {
        ContactKind::Company
    } else {
        ContactKind::Person
    };
    contact.contact_type = ContactType::from_storage(input.contact_type.trim())
        .ok_or_else(|| CoreError::Validation("contact_type_invalid".to_string()))?;
    contact.name = non_empty(&input.name);
    contact.company_name = non_empty(&input.company);
    contact.first_name = non_empty(&input.first_name);
    contact.last_name = non_empty(&input.last_name);
    contact.street = non_empty(&input.street);
    contact.zip = non_empty(&input.zip);
    contact.city = non_empty(&input.city);
    contact.country = non_empty(&input.country);
    contact.email = non_empty(&input.email);
    contact.phone = non_empty(&input.phone);
    contact.tax_id = non_empty(&input.tax_id);
    contact.notes = non_empty(&input.notes);
    if let Some(persons) = input.contact_persons.as_deref() {
        contact.contact_persons = persons
            .iter()
            .enumerate()
            .map(|(index, input)| {
                let id = if input.id.trim().is_empty() {
                    ContactPerson::draft_id(now, &format!("{index}"))
                } else {
                    input.id.trim().to_string()
                };
                let mut person = ContactPerson::draft(id, input.is_primary);
                person.first_name = input.first_name.trim().to_string();
                person.last_name = input.last_name.trim().to_string();
                person.email = input.email.trim().to_string();
                person.phone = input.phone.trim().to_string();
                person.role = input.role.trim().to_string();
                person
            })
            .collect();
        // The legacy save path drops persons without a name, email or phone and keeps one primary.
        contact.sanitize_contact_persons();
    }
    contact.updated_at = now;
    if existing.is_none() {
        contact.created_at = now;
    }
    contact.validate().map_err(CoreError::Validation)?;
    Ok(contact)
}

fn build_product(input: &ProductInput, existing: Option<&Product>) -> CoreResult<Product> {
    let now = now_millis();
    let mut product = existing
        .cloned()
        .unwrap_or_else(|| Product::new(input.name.trim(), now));

    product.name = input.name.trim().to_string();
    product.sku = input.sku.trim().to_string();
    product.category = input.category.trim().to_string();
    product.unit = if input.unit.trim().is_empty() {
        "Stk".to_string()
    } else {
        input.unit.trim().to_string()
    };
    product.price = Money::from_cents(input.price_cents);
    product.cost_price = Money::from_cents(input.cost_price_cents);
    product.tax_rate_bp = input.tax_rate_bp;
    product.stock = input.stock;
    product.reorder_level = input.reorder_level;
    product.target_stock = input.target_stock;
    product.barcode = non_empty(&input.barcode);
    product.asin = non_empty(&input.asin);
    product.web_link = non_empty(&input.web_link);
    product.source_domain = non_empty(&input.source_domain);
    product.description = non_empty(&input.description);
    product.image_emoji = non_empty(&input.image_emoji);
    product.exclude_from_reorder = input.exclude_from_reorder;
    product.updated_at = now;
    if existing.is_none() {
        product.created_at = now;
    }
    product.validate().map_err(CoreError::Validation)?;
    Ok(product)
}

fn non_empty(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn default_export_path(database: &Path, number: &str, extension: &str) -> PathBuf {
    let stem: String = number
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect();
    let stem = if stem.trim_matches('_').is_empty() {
        "rechnung".to_string()
    } else {
        stem
    };
    database
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("exports")
        .join(format!("{stem}.{extension}"))
}

fn default_backup_dir(database: &Path) -> PathBuf {
    database
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups")
}

fn default_archive(database: &Path) -> PathBuf {
    default_backup_dir(database).join(format!("socdof-{}.socdofbak", now_millis()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_send_sync<T: Send + Sync>() {}

    #[test]
    fn desktop_state_can_be_managed_by_tauri() {
        assert_send_sync::<DesktopState>();
    }
}

/// Key figures of the dashboard in cents, ready for the webview.
#[derive(Debug, Clone, Serialize)]
pub struct DashboardSummaryView {
    /// Rows in `contacts`.
    pub contacts: i64,
    /// Rows in `products`.
    pub products: i64,
    /// Products at or below their reorder level.
    pub low_stock: i64,
    /// Non-cancelled invoices in the period.
    pub invoices: i64,
    /// Draft invoices in the period.
    pub draft_invoices: i64,
    /// Sent and overdue invoices in the period.
    pub open_invoices: i64,
    /// Overdue invoices in the period.
    pub overdue_invoices: i64,
    /// Paid invoices in the period.
    pub paid_invoices: i64,
    /// Gross of all non-cancelled invoices in cents.
    pub gross: i64,
    /// Gross of paid invoices in cents.
    pub paid: i64,
    /// Gross of sent and overdue invoices in cents.
    pub open: i64,
    /// Gross of overdue invoices in cents.
    pub overdue: i64,
    /// Gross of draft invoices in cents.
    pub draft: i64,
    /// Stock valued at cost price in cents.
    pub inventory_cost: i64,
    /// Stock valued at sales price in cents.
    pub inventory_retail: i64,
    /// Gross cash-register sales in the period in cents.
    pub pos_sales: i64,
    /// Cash-register receipts in the period.
    pub pos_count: i64,
    /// Appointments in the next seven days.
    pub upcoming_appointments: i64,
}

/// One invoice row of the dashboard.
#[derive(Debug, Clone, Serialize)]
pub struct DashboardInvoiceView {
    /// Human readable invoice number.
    pub number: String,
    /// Display name of the billed contact.
    pub contact: String,
    /// Lifecycle state.
    pub status: String,
    /// Issue date in milliseconds since the Unix epoch.
    pub issued_at: i64,
    /// Gross total including tax in cents.
    pub gross: i64,
    /// Currency symbol used for printing.
    pub currency_symbol: String,
}

/// One product that needs to be reordered.
#[derive(Debug, Clone, Serialize)]
pub struct DashboardLowStockView {
    /// Display name.
    pub name: String,
    /// Article number.
    pub sku: String,
    /// Current stock in whole units.
    pub stock: i64,
    /// Reorder level.
    pub reorder_level: i64,
    /// Unit of measure.
    pub unit: String,
}

/// Everything the dashboard screen shows.
#[derive(Debug, Clone, Serialize)]
pub struct DashboardView {
    /// Company name from the profile, empty when none is configured.
    pub company: String,
    /// Key figures of the selected period.
    pub summary: DashboardSummaryView,
    /// Newest invoices, period independent.
    pub recent: Vec<DashboardInvoiceView>,
    /// Products at or below their reorder level.
    pub low_stock: Vec<DashboardLowStockView>,
}

/// Public account data returned to the webview; password hashes never leave the core.
#[derive(Debug, Clone, Serialize)]
pub struct UserView {
    /// Stable identifier.
    pub id: Uuid,
    /// Login name.
    pub username: String,
    /// Name shown in the UI.
    pub display_name: String,
    /// Built-in role (`admin` or `user`).
    pub role: String,
    /// Whether the account can sign in.
    pub active: bool,
    /// Whether the next sign-in must change the password.
    pub must_change_password: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl UserView {
    fn from_user(user: &User) -> Self {
        Self {
            id: user.id,
            username: user.username.clone(),
            display_name: user.display_name.clone(),
            role: user.role.as_str().to_string(),
            active: user.active,
            must_change_password: user.must_change_password,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

/// Editable account fields from the webview.
#[derive(Debug, Clone, Deserialize)]
pub struct UserInput {
    /// Existing account to change; `None` creates an account.
    #[serde(default)]
    pub id: Option<Uuid>,
    /// Login name.
    #[serde(default)]
    pub username: String,
    /// Name shown in the UI.
    #[serde(default)]
    pub display_name: String,
    /// `admin` or `user`.
    #[serde(default = "default_user_role")]
    pub role: String,
    /// Whether the account can sign in.
    #[serde(default = "default_active")]
    pub active: bool,
    /// New plain password; empty keeps the stored hash on updates.
    #[serde(default)]
    pub password: String,
}

fn default_user_role() -> String {
    "user".to_string()
}

fn default_active() -> bool {
    true
}

/// One table count of the storage inspector.
#[derive(Debug, Clone, Serialize)]
pub struct StorageCountView {
    /// Table name.
    pub name: String,
    /// Current row count.
    pub rows: i64,
}

/// Storage facts shown in Settings.
#[derive(Debug, Clone, Serialize)]
pub struct StorageInspectorView {
    /// Active SQLite database.
    pub database: PathBuf,
    /// File size in bytes, zero when the file cannot be read.
    pub database_bytes: u64,
    /// Current schema version.
    pub schema_version: i64,
    /// Folder where backups are written.
    pub backup_folder: PathBuf,
    /// Row counts shown in the inspector.
    pub counts: Vec<StorageCountView>,
}
