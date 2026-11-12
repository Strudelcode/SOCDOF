//! Commands the window layer invokes.
//!
//! Each command is a thin adapter: path or text in, `socdof-core` service called, typed result out.
//! No SQL and no business rule lives here.

use std::path::Path;

use socdof_core::backup::{self, BackupInfo, BackupMetadata};
use socdof_core::csv::{self, ImportReport};
use socdof_core::document_layout;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::now_millis;
use socdof_core::pdf::din5008;
use socdof_core::store::Store;

use crate::shell::Shell;

impl Shell {
    /// Exports all contacts as the legacy-compatible semicolon CSV.
    pub fn export_contacts_csv(&self, path: &Path) -> CoreResult<usize> {
        csv::export_contacts_csv(self.store(), path)
    }

    /// Imports contacts from the legacy-compatible semicolon CSV.
    pub fn import_contacts_csv(&self, path: &Path) -> CoreResult<ImportReport> {
        csv::import_contacts_csv(self.store(), path)
    }

    /// Exports all contacts as vCard 3.0 for Outlook, Apple and Android.
    pub fn export_contacts_vcf(&self, path: &Path) -> CoreResult<usize> {
        fn escape(value: &str) -> String {
            value
                .replace('\\', "\\\\")
                .replace(';', "\\;")
                .replace(',', "\\,")
                .replace('\n', "\\n")
        }

        let contacts = self.store().list_contacts()?;
        let mut output = String::new();
        for contact in &contacts {
            let display = contact
                .company_name
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .or(contact.name.as_deref())
                .unwrap_or("");
            output.push_str("BEGIN:VCARD\r\nVERSION:3.0\r\n");
            output.push_str(&format!("N:{};;;\r\n", escape(display)));
            output.push_str(&format!("FN:{}\r\n", escape(display)));
            if let Some(company) = contact
                .company_name
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("ORG:{}\r\n", escape(company)));
            }
            if let Some(email) = contact
                .email
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("EMAIL;TYPE=INTERNET:{}\r\n", escape(email)));
            }
            if let Some(phone) = contact
                .phone
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("TEL;TYPE=WORK,VOICE:{}\r\n", escape(phone)));
            }
            let street = contact.street.as_deref().unwrap_or("");
            let city = contact.city.as_deref().unwrap_or("");
            let zip = contact.zip.as_deref().unwrap_or("");
            let country = contact.country.as_deref().unwrap_or("");
            if !street.is_empty() || !city.is_empty() || !zip.is_empty() || !country.is_empty() {
                output.push_str(&format!(
                    "ADR;TYPE=WORK:;;{};{};{};{};{}\r\n",
                    escape(street),
                    escape(city),
                    "",
                    escape(zip),
                    escape(country)
                ));
            }
            if let Some(notes) = contact
                .notes
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("NOTE:{}\r\n", escape(notes)));
            }
            output.push_str("END:VCARD\r\n");
        }
        std::fs::write(path, output.as_bytes())?;
        Ok(contacts.len())
    }

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
        let template = socdof_core::invoice_template::active(self.store())?;

        socdof_core::docx::write_invoice_docx_with_template(
            path, &invoice, &recipient, &company, &template,
        )?;
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
        let template = socdof_core::invoice_template::active(self.store())?;

        din5008::write_invoice_pdf_with_layout_and_template(
            path, &invoice, &recipient, &company, &layout, &template,
        )
    }
}
