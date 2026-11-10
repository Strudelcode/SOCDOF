//! Import step of the first-run assistant.
//!
//! The step reads a legacy `.socdof.json` backup through `socdof_core::legacy`, which writes a
//! pre-migration backup before it touches the store. The state machine is UI-free so it can be
//! tested without a window; [`migration_step`] only renders it.

use std::path::Path;

use socdof_core::legacy;
use socdof_core::store::Store;

use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Counts of a finished import: contacts, products, invoices.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Imported {
    /// Imported contacts.
    pub contacts: usize,
    /// Imported products.
    pub products: usize,
    /// Invoices preserved in the raw document.
    pub invoices: usize,
}

/// State of the migration step of the setup wizard.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MigrationState {
    /// Path of the legacy backup the user typed in.
    pub path: String,
    /// Result of the last successful import.
    pub imported: Option<Imported>,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// The user skipped the step on purpose.
    pub skipped: bool,
    /// The import finished.
    pub done: bool,
}

impl MigrationState {
    /// Empty step.
    pub fn new() -> Self {
        Self::default()
    }

    /// Imports the file in [`Self::path`].
    ///
    /// An empty path or a missing file sets an error and leaves the store untouched; a broken
    /// document reports `setup_import_failed` and keeps the step open.
    pub fn import(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.error = None;
        self.done = false;

        let path = self.path.trim().to_string();
        if path.is_empty() {
            self.error = Some("setup_import_missing_path");
            return Ok(());
        }
        if !Path::new(&path).is_file() {
            self.error = Some("setup_import_missing_file");
            return Ok(());
        }

        match legacy::import(store, Path::new(&path)) {
            Ok(report) => {
                self.imported = Some(Imported {
                    contacts: report.contacts,
                    products: report.products,
                    invoices: report.invoices,
                });
                self.done = true;
                Ok(())
            }
            Err(error) => {
                self.imported = None;
                self.error = Some("setup_import_failed");
                Err(error)
            }
        }
    }

    /// Continues without importing anything.
    pub fn skip(&mut self) {
        self.skipped = true;
        self.done = true;
        self.error = None;
    }

    /// Whether the wizard may leave the step.
    pub fn can_continue(&self) -> bool {
        self.done || self.skipped
    }

    /// Readable result line, if an import finished.
    pub fn summary(&self) -> Option<String> {
        let imported = self.imported?;
        Some(format!(
            "{} / {} / {}",
            imported.contacts, imported.products, imported.invoices
        ))
    }
}

/// Draws the step and reports whether the user asked to run the import.
pub fn migration_step(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &mut MigrationState,
) -> bool {
    let mut run = false;

    ui.label(
        egui::RichText::new(texts.get("setup_import_hint"))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    ui.add_space(8.0);
    ui.label(egui::RichText::new(texts.get("setup_import_path")).size(FONT_SMALL));
    ui.add(
        egui::TextEdit::singleline(&mut state.path)
            .desired_width(320.0)
            .hint_text("*.socdof.json"),
    );
    ui.add_space(8.0);
    ui.horizontal(|ui| {
        if ui.button(texts.get("setup_import_run")).clicked() {
            run = true;
        }
        if ui.button(texts.get("setup_import_skip")).clicked() {
            state.skip();
        }
    });

    if let Some(key) = state.error {
        ui.label(
            egui::RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.danger),
        );
    }
    if state.done {
        if let Some(imported) = state.imported {
            let text = texts
                .get("setup_import_done")
                .replace("{contacts}", &imported.contacts.to_string())
                .replace("{products}", &imported.products.to_string())
                .replace("{invoices}", &imported.invoices.to_string());
            ui.label(egui::RichText::new(text).size(FONT_SMALL));
        }
    }

    run
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn store() -> Store {
        Store::open_in_memory().expect("store")
    }

    fn legacy_fixture() -> String {
        let path = std::path::Path::new("../core/tests/fixtures/legacy");
        let name = std::fs::read_dir(path)
            .expect("fixture folder")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .find(|path| {
                path.file_name()
                    .map(|name| name.to_string_lossy().ends_with(".socdof.json"))
                    .unwrap_or(false)
            })
            .expect("legacy fixture");
        name.to_string_lossy().to_string()
    }

    #[test]
    fn imports_the_legacy_backup_with_its_counts() {
        let store = store();
        let mut state = MigrationState::new();
        state.path = legacy_fixture();

        state.import(&store).expect("import");

        assert!(state.done);
        assert_eq!(state.error, None);
        let imported = state.imported.expect("counts");
        assert_eq!(imported.contacts, 3);
        assert_eq!(imported.products, 2);
        assert_eq!(imported.invoices, 1);
        assert_eq!(store.contact_count().expect("contacts"), 3);
        assert!(state.can_continue());
        assert!(state.summary().is_some());
    }

    #[test]
    fn empty_and_missing_paths_stay_on_the_step() {
        let store = store();
        let mut state = MigrationState::new();

        state.import(&store).expect("no-op");
        assert_eq!(state.error, Some("setup_import_missing_path"));
        assert!(!state.can_continue());

        state.path = format!("/tmp/does-not-exist-{}.json", Uuid::new_v4());
        state.import(&store).expect("no-op");
        assert_eq!(state.error, Some("setup_import_missing_file"));
        assert!(!state.done);
        assert_eq!(store.contact_count().expect("contacts"), 0);
    }

    #[test]
    fn broken_document_keeps_the_step_open_and_the_store_empty() {
        let store = store();
        let dir = std::env::temp_dir().join(format!("socdof-migration-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("dir");
        let broken = dir.join("broken.socdof.json");
        std::fs::write(&broken, b"{\"app\":\"other\"}").expect("broken file");

        let mut state = MigrationState::new();
        state.path = broken.to_string_lossy().to_string();
        assert!(state.import(&store).is_err());

        assert_eq!(state.error, Some("setup_import_failed"));
        assert!(!state.done);
        assert!(!state.can_continue());
        assert_eq!(store.contact_count().expect("contacts"), 0);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn skipping_finishes_the_step_without_data() {
        let mut state = MigrationState::new();
        state.skip();
        assert!(state.skipped);
        assert!(state.can_continue());
        assert!(state.imported.is_none());
    }
}
