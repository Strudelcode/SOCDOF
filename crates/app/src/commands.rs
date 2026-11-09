//! Commands the window layer invokes.
//!
//! Each command is a thin adapter: path or text in, `socdof-core` service called, typed result out.
//! No SQL and no business rule lives here.

use std::path::Path;

use socdof_core::backup::{self, BackupInfo, BackupMetadata};
use socdof_core::document_layout;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::now_millis;
use socdof_core::pdf::din5008;
use socdof_core::store::Store;

use crate::shell::Shell;

impl Shell {
    /// Writes a consistent backup archive of the open database.
    pub fn backup(&self, archive: &Path) -> CoreResult<BackupInfo> {
        backup::create_backup(
            self.store(),
            archive,
            env!("CARGO_PKG_VERSION"),
            now_millis(),
        )
    }

    /// Verifies an archive, replaces the database with it and reopens the store.
    ///
    /// The connection is closed before the file is swapped, so SQLite never sees a replaced file.
    /// The instance lock stays held for the whole command. A rejected archive leaves the database
    /// untouched and reopens it unchanged.
    pub fn restore(&mut self, archive: &Path) -> CoreResult<BackupMetadata> {
        drop(self.take_store());

        let result = backup::restore_backup(archive, &self.paths().database);
        let reopened = Store::open(&self.paths().database);

        match (result, reopened) {
            (Ok(metadata), Ok(store)) => {
                self.put_store(store);
                Ok(metadata)
            }
            (Ok(_), Err(error)) => Err(error),
            (Err(error), Ok(store)) => {
                self.put_store(store);
                Err(error)
            }
            (Err(_), Err(error)) => Err(error),
        }
    }

    /// Renders the invoice with `number` as a Word package.
    pub fn export_invoice_docx(&self, number: &str, path: &Path) -> CoreResult<()> {
        let invoice = self
            .store()
            .list_invoices()?
            .into_iter()
            .find(|invoice| invoice.number == number)
            .ok_or_else(|| CoreError::NotFound(format!("invoice {number}")))?;
        let recipient = self
            .store()
            .find_contact(invoice.contact_id)?
            .ok_or_else(|| CoreError::NotFound(invoice.contact_id.to_string()))?;
        let company = self.store().company_profile()?;

        socdof_core::docx::write_invoice_docx(path, &invoice, &recipient, &company)?;
        Ok(())
    }

    /// Renders the invoice with `number` as a DIN 5008 PDF file.
    pub fn export_invoice_pdf(&self, number: &str, path: &Path) -> CoreResult<()> {
        let invoice = self
            .store()
            .list_invoices()?
            .into_iter()
            .find(|invoice| invoice.number == number)
            .ok_or_else(|| CoreError::NotFound(format!("invoice {number}")))?;
        let recipient = self
            .store()
            .find_contact(invoice.contact_id)?
            .ok_or_else(|| CoreError::NotFound(invoice.contact_id.to_string()))?;
        let company = self.store().company_profile()?;
        let layout = document_layout::load(self.store())?;

        din5008::write_invoice_pdf_with_layout(path, &invoice, &recipient, &company, &layout)
    }
}
