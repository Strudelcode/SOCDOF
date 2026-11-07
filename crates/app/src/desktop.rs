//! Shared state for the desktop window layer.
//!
//! The Tauri commands are one-line adapters over [`DesktopState`]. Keeping the state in this crate,
//! instead of inside `src-tauri`, makes the exact command path testable on machines that have no
//! GTK/WebKit development packages.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use socdof_core::domain::contact::{Contact, ContactKind, ContactType};
use socdof_core::domain::product::Product;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::legacy;
use socdof_core::money::Money;
use socdof_core::now_millis;
use uuid::Uuid;

use crate::shell::{Paths, Shell, ShellStatus};

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

fn default_archive(database: &Path) -> PathBuf {
    let directory = database
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups");
    directory.join(format!("socdof-{}.socdofbak", now_millis()))
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
