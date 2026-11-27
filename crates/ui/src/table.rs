//! Spreadsheet screen of the `table` module.
//!
//! Ported from `SOCDOF - TS/src/components/sales/TableModule.tsx`. The reference is a ribbon
//! spreadsheet without persistence: a grid of at least 8 × 20 cells, per-cell formatting, formulas
//! with `A1` references and the five range functions, CSV import/export and two view switches.
//!
//! The port keeps every control and adds what the reference only simulates: documents live in
//! SQLite ([`Store::save_spreadsheet`] and friends), so a sheet survives a restart, and the CSV
//! buttons write and read real files instead of a browser download.
//!
//! Ribbon tabs are `file`, `home`, `insert` and `view`; the formula bar and the status bar stay
//! visible under the ribbon, like the reference.

use std::collections::BTreeMap;

use egui::{Align, Color32, FontFamily, FontId, Layout, RichText, Sense, Vec2};
use socdof_core::domain::spreadsheet::{
    cell_id, column_name, shift_styles, CellAlign, CellStyle, CellValue, Sheet,
    SpreadsheetDocument, StyleMap, FONT_FAMILIES, MAX_COLS, MAX_ROWS, MIN_COLS, MIN_ROWS,
    STANDARD_COLORS,
};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{badge, button, card, modal, ButtonVariant, Tone};
use crate::controls::{switch, text_field};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_SMALL};

/// Width of one grid cell.
pub const CELL_WIDTH: f32 = 92.0;
/// Height of one grid cell.
pub const CELL_HEIGHT: f32 = 26.0;
/// Width of the row-number column.
pub const ROW_HEADER_WIDTH: f32 = 44.0;

/// Tabs of the ribbon.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum TableTab {
    /// Documents, saving, CSV.
    #[default]
    File,
    /// Formatting and row/column editing.
    Home,
    /// The five range functions.
    Insert,
    /// Grid lines and formula bar.
    View,
}

impl TableTab {
    /// The four tabs in ribbon order.
    pub const ALL: [TableTab; 4] = [
        TableTab::File,
        TableTab::Home,
        TableTab::Insert,
        TableTab::View,
    ];

    /// i18n key of the tab label.
    pub fn label_key(self) -> &'static str {
        match self {
            TableTab::File => "table_tab_file",
            TableTab::Home => "table_tab_home",
            TableTab::Insert => "table_tab_insert",
            TableTab::View => "table_tab_view",
        }
    }
}

/// Formula functions of the insert tab, in the reference's order.
pub const FUNCTIONS: [(&str, &str); 5] = [
    ("SUMME", "table_fn_sum"),
    ("MITTELWERT", "table_fn_average"),
    ("MAX", "table_fn_max"),
    ("MIN", "table_fn_min"),
    ("ANZAHL", "table_fn_count"),
];

/// State of the spreadsheet screen.
pub struct TableState {
    /// Active ribbon tab.
    pub tab: TableTab,
    /// Stored documents, most recently changed first.
    pub documents: Vec<SpreadsheetDocument>,
    /// Document currently being edited.
    pub document: SpreadsheetDocument,
    /// Evaluated values of the current sheet, refreshed on every edit.
    pub values: Vec<Vec<CellValue>>,
    /// Active cell as `(column, row)`.
    pub active: (usize, usize),
    /// Raw text of the active cell, shared by the inline editor and the formula bar.
    pub buffer: String,
    /// Name typed for a new document.
    pub new_name: String,
    /// Path of the CSV file for import and export.
    pub path: String,
    /// Success message key.
    pub status: Option<&'static str>,
    /// Error message key.
    pub error: Option<&'static str>,
    /// Document the delete confirmation is open for.
    pub confirm_delete: Option<Uuid>,
    /// Set when the screen should close.
    pub back: bool,
    /// Set when the inline editor changed the cell.
    pub edited: bool,
}

impl Default for TableState {
    fn default() -> Self {
        let document = SpreadsheetDocument::new(String::new(), 0);
        let values = document.sheet.values();
        Self {
            tab: TableTab::File,
            documents: Vec::new(),
            document,
            values,
            active: (0, 0),
            buffer: String::new(),
            new_name: String::new(),
            path: String::new(),
            status: None,
            error: None,
            confirm_delete: None,
            back: false,
            edited: false,
        }
    }
}

impl TableState {
    /// A fresh screen with an unsaved document.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads the document list from the store.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.documents = store.list_spreadsheets()?;
        Ok(())
    }

    /// Re-evaluates the sheet and reloads the formula bar from the active cell.
    pub fn recompute(&mut self) {
        self.values = self.document.sheet.values();
        self.buffer = self
            .document
            .sheet
            .raw(self.active.0, self.active.1)
            .to_string();
    }

    /// Writes the buffer into the active cell and re-evaluates.
    pub fn commit_buffer(&mut self) {
        let (col, row) = self.active;
        if self.document.sheet.raw(col, row) != self.buffer {
            self.document.sheet.set(col, row, self.buffer.clone());
            self.recompute();
        }
    }

    /// Moves the selection, keeping the buffer and the sheet in sync.
    ///
    /// Only a cell that was actually edited is written back: moving the selection with an untouched
    /// buffer must not overwrite the target cell with the text of the previous one.
    pub fn select(&mut self, col: usize, row: usize) {
        if self.edited {
            self.commit_buffer();
            self.edited = false;
        }
        let col = col.min(self.document.sheet.col_count().saturating_sub(1));
        let row = row.min(self.document.sheet.row_count().saturating_sub(1));
        self.active = (col, row);
        self.buffer = self.document.sheet.raw(col, row).to_string();
    }

    /// Moves the selection by a delta, clamped to the grid.
    pub fn move_by(&mut self, d_col: isize, d_row: isize) {
        let (col, row) = self.active;
        self.select(
            col.saturating_add_signed(d_col),
            row.saturating_add_signed(d_row),
        );
    }

    /// Starts a new unsaved document.
    pub fn new_document(&mut self, now: i64) {
        self.document = SpreadsheetDocument::new(String::new(), now);
        self.active = (0, 0);
        self.recompute();
        self.status = Some("table_ready_new");
        self.error = None;
    }

    /// Loads a stored document.
    pub fn open(&mut self, store: &Store, id: Uuid) {
        match store.find_spreadsheet(id) {
            Ok(Some(document)) => {
                self.document = document;
                self.active = (0, 0);
                self.recompute();
                self.status = Some("table_ready_open");
                self.error = None;
            }
            Ok(None) => self.error = Some("table_error_missing"),
            Err(_) => self.error = Some("table_error_load"),
        }
    }

    /// Saves the document, using the untitled fallback when no name was entered.
    pub fn save(&mut self, store: &Store, now: i64, fallback_name: &str) {
        if self.document.name.trim().is_empty() {
            self.document.name = fallback_name.to_string();
        }
        self.document.updated_at = now;
        match store.save_spreadsheet(&self.document) {
            Ok(()) => {
                self.status = Some("table_saved");
                self.error = None;
                if self.refresh(store).is_err() {
                    self.error = Some("table_error_load");
                }
            }
            Err(_) => {
                self.error = Some("table_error_name");
                self.status = None;
            }
        }
    }

    /// Deletes a stored document; the open document falls back to a fresh sheet.
    pub fn delete(&mut self, store: &Store, id: Uuid, now: i64) {
        match store.delete_spreadsheet(id) {
            Ok(()) => {
                let was_open = self.document.id == id;
                if self.refresh(store).is_err() {
                    self.error = Some("table_error_load");
                }
                if was_open {
                    self.new_document(now);
                }
                self.status = Some("table_deleted");
                self.error = None;
            }
            Err(_) => self.error = Some("table_error_save"),
        }
    }

    /// Renames the open document through the store.
    pub fn rename(&mut self, store: &Store, name: &str, now: i64) {
        if name.trim().is_empty() {
            self.error = Some("table_error_name");
            return;
        }
        self.document.name = name.trim().to_string();
        match store.rename_spreadsheet(self.document.id, name, now) {
            Ok(()) => {
                self.status = Some("table_saved");
                let _ = self.refresh(store);
            }
            Err(_) => self.error = Some("table_error_name"),
        }
    }

    /// The contiguous block around the active cell, as `(c0, r0, c1, r1)`.
    ///
    /// The reference formats and clears exactly this block: an empty cell selects itself, otherwise
    /// the block grows over the connected filled cells of its row and then over the connected filled
    /// rows of that column span.
    pub fn selection(&self) -> (usize, usize, usize, usize) {
        let (col, row) = self.active;
        let sheet = &self.document.sheet;
        let filled = |c: usize, r: usize| !sheet.raw(c, r).trim().is_empty();
        if !filled(col, row) {
            return (col, row, col, row);
        }
        let mut c0 = col;
        while c0 > 0 && filled(c0 - 1, row) {
            c0 -= 1;
        }
        let mut c1 = col;
        while c1 + 1 < sheet.col_count() && filled(c1 + 1, row) {
            c1 += 1;
        }
        let row_filled = |r: usize| (c0..=c1).all(|c| filled(c, r));
        let mut r0 = row;
        while r0 > 0 && row_filled(r0 - 1) {
            r0 -= 1;
        }
        let mut r1 = row;
        while r1 + 1 < sheet.row_count() && row_filled(r1 + 1) {
            r1 += 1;
        }
        (c0, r0, c1, r1)
    }

    /// Range text of the selection, e.g. `A1:B3`.
    fn selection_range(&self) -> String {
        let (c0, r0, c1, r1) = self.selection();
        format!("{}:{}", cell_id(c0, r0), cell_id(c1, r1))
    }

    /// Style of the active cell.
    pub fn active_style(&self) -> CellStyle {
        self.document
            .styles
            .get(&cell_id(self.active.0, self.active.1))
            .cloned()
            .unwrap_or_default()
    }

    /// Applies a formatting change to every cell of the selection.
    pub fn apply_style(&mut self, change: impl Fn(&mut CellStyle)) {
        let (c0, r0, c1, r1) = self.selection();
        for row in r0..=r1 {
            for col in c0..=c1 {
                let id = cell_id(col, row);
                let entry = self.document.styles.entry(id.clone()).or_default();
                change(entry);
                if entry.is_empty() {
                    self.document.styles.remove(&id);
                }
            }
        }
    }

    /// Clears the text of every cell in the selection.
    pub fn clear_selection(&mut self) {
        let (c0, r0, c1, r1) = self.selection();
        for row in r0..=r1 {
            for col in c0..=c1 {
                self.document.sheet.set(col, row, "");
            }
        }
        self.recompute();
        self.status = Some("table_cleared_cells");
    }

    /// Empties the whole sheet (the reference's "Leeren").
    pub fn clear_sheet(&mut self) {
        let rows = self.document.sheet.row_count();
        let cols = self.document.sheet.col_count();
        self.document.sheet = Sheet::sized(rows, cols);
        self.document.styles.clear();
        self.recompute();
        self.status = Some("table_cleared_sheet");
    }

    /// Inserts an empty row above the active row and moves the styles with their cells.
    pub fn insert_row(&mut self) {
        let (_, row) = self.active;
        if self.document.sheet.insert_row(row) {
            shift_styles(&mut self.document.styles, true, row, 1);
            self.recompute();
            self.status = None;
        } else {
            self.error = Some("table_limit_reached");
        }
    }

    /// Deletes the active row and moves the styles with their cells.
    pub fn delete_row(&mut self) {
        let (_, row) = self.active;
        if self.document.sheet.delete_row(row) {
            shift_styles(&mut self.document.styles, true, row, -1);
            self.active.1 = row.min(self.document.sheet.row_count() - 1);
            self.recompute();
        } else {
            self.error = Some("table_limit_reached");
        }
    }

    /// Inserts an empty column left of the active column and moves the styles with their cells.
    pub fn insert_col(&mut self) {
        let (col, _) = self.active;
        if self.document.sheet.insert_col(col) {
            shift_styles(&mut self.document.styles, false, col, 1);
            self.recompute();
            self.status = None;
        } else {
            self.error = Some("table_limit_reached");
        }
    }

    /// Deletes the active column and moves the styles with their cells.
    pub fn delete_col(&mut self) {
        let (col, _) = self.active;
        if self.document.sheet.delete_col(col) {
            shift_styles(&mut self.document.styles, false, col, -1);
            self.active.0 = col.min(self.document.sheet.col_count() - 1);
            self.recompute();
        } else {
            self.error = Some("table_limit_reached");
        }
    }

    /// Writes a range formula above the selection, like the reference's insert tab.
    ///
    /// The formula goes into the cell directly above the block's first column; when the block starts
    /// in the first row the active cell is replaced instead, because there is no row above it.
    pub fn insert_function(&mut self, name: &str) {
        let (c0, r0, _, _) = self.selection();
        let range = self.selection_range();
        let formula = format!("={name}({range})");
        if r0 == 0 {
            // There is no row above the block, and writing the formula into the block itself would
            // make it reference its own cell; the reference has no answer for this case either.
            self.error = Some("table_function_no_row");
            self.status = None;
            return;
        }
        let (col, row) = (c0, r0 - 1);
        self.document.sheet.set(col, row, formula);
        self.select(col, row);
        self.recompute();
        self.status = Some("table_function_inserted");
    }

    /// Writes the sheet as a BOM prefixed CSV file.
    pub fn export_csv(&mut self) {
        let path = self.path.trim().to_string();
        if path.is_empty() {
            self.error = Some("table_error_path");
            return;
        }
        match std::fs::write(&path, self.document.csv_export()) {
            Ok(()) => {
                self.status = Some("table_exported");
                self.error = None;
            }
            Err(_) => self.error = Some("table_error_write"),
        }
    }

    /// Replaces the sheet with the cells of a CSV file; formatting is dropped.
    pub fn import_csv(&mut self) {
        let path = self.path.trim().to_string();
        if path.is_empty() {
            self.error = Some("table_error_path");
            return;
        }
        match std::fs::read_to_string(&path) {
            Ok(text) => {
                self.document.sheet = Sheet::from_csv(&text);
                self.document.styles = StyleMap::new();
                self.active = (0, 0);
                self.recompute();
                self.status = Some("table_imported");
                self.error = None;
            }
            Err(_) => self.error = Some("table_error_read"),
        }
    }

    /// Whether the open document was never saved (no stored row with its id).
    pub fn is_stored(&self) -> bool {
        self.documents
            .iter()
            .any(|document| document.id == self.document.id)
    }
}

/// Fills the store with the reference sample sheets on a first run.
pub fn seed_table(store: &Store) -> socdof_core::CoreResult<()> {
    if store.spreadsheet_count()? > 0 {
        return Ok(());
    }
    let now = crate::dashboard::SAMPLE_NOW_MS;
    let mut inventory = SpreadsheetDocument::new("Inventur", now);
    for (col, text) in ["Artikel", "Menge", "Einzelpreis", "Gesamt"]
        .iter()
        .enumerate()
    {
        inventory.sheet.set(col, 0, *text);
        inventory.styles.insert(
            cell_id(col, 0),
            CellStyle {
                bold: true,
                fill: Some("#dbeafe".to_string()),
                ..CellStyle::default()
            },
        );
    }
    let rows = [
        ("Schraube M4", "120", "0,12"),
        ("Mutter M4", "120", "0,08"),
        ("Unterlegscheibe", "240", "0,03"),
        ("Kabelbinder", "50", "0,15"),
    ];
    for (index, (name, amount, price)) in rows.iter().enumerate() {
        let row = index + 1;
        inventory.sheet.set(0, row, *name);
        inventory.sheet.set(1, row, *amount);
        inventory.sheet.set(2, row, *price);
        inventory
            .sheet
            .set(3, row, format!("=B{}*C{}", row + 1, row + 1));
    }
    inventory.sheet.set(1, 5, "=SUMME(B2:B5)");
    inventory.sheet.set(3, 5, "=SUMME(D2:D5)");
    inventory.styles.insert(
        "A6".to_string(),
        CellStyle {
            bold: true,
            ..CellStyle::default()
        },
    );
    store.save_spreadsheet(&inventory)?;

    let mut budget = SpreadsheetDocument::new("Budget 2026", now + 1_000);
    for (col, text) in ["Monat", "Plan", "Ist"].iter().enumerate() {
        budget.sheet.set(col, 0, *text);
    }
    for (index, month) in ["Januar", "Februar", "März"].iter().enumerate() {
        let row = index + 1;
        budget.sheet.set(0, row, *month);
        budget.sheet.set(1, row, format!("{}", 1_200 + index * 100));
        budget.sheet.set(2, row, format!("{}", 1_050 + index * 120));
    }
    budget.sheet.set(0, 5, "Summe");
    budget.sheet.set(1, 5, "=SUMME(B2:B4)");
    budget.sheet.set(2, 5, "=SUMME(C2:C4)");
    store.save_spreadsheet(&budget)?;
    Ok(())
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &TableState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

fn tabs(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
) {
    ui.horizontal_wrapped(|ui| {
        for tab in TableTab::ALL {
            let variant = if tab == state.tab {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(tab.label_key()), variant).activated {
                state.tab = tab;
                state.error = None;
            }
        }
    });
}

/// Renders the spreadsheet into the context.
pub fn table(
    ctx: &egui::Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
    store: &Store,
    now: i64,
) {
    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            table_window(ctx, true, ui, theme, texts, focus, state, store, now);
        });
}

/// Renders the spreadsheet and its dialogs inside a native desktop window.
#[allow(clippy::too_many_arguments)]
pub fn table_window(
    ctx: &egui::Context,
    active: bool,
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
    store: &Store,
    now: i64,
) {
    if active && state.confirm_delete.is_none() {
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) && !ctx.wants_keyboard_input() {
            state.back = true;
        }
        if !ctx.wants_keyboard_input() {
            let (mut d_col, mut d_row) = (0isize, 0isize);
            let mut handled = false;
            ctx.input(|input| {
                if input.key_pressed(egui::Key::ArrowDown) {
                    d_row = 1;
                    handled = true;
                } else if input.key_pressed(egui::Key::ArrowUp) {
                    d_row = -1;
                    handled = true;
                } else if input.key_pressed(egui::Key::ArrowRight) {
                    d_col = 1;
                    handled = true;
                } else if input.key_pressed(egui::Key::ArrowLeft) {
                    d_col = -1;
                    handled = true;
                } else if input.key_pressed(egui::Key::Enter) {
                    d_row = 1;
                    handled = true;
                } else if input.key_pressed(egui::Key::Tab) {
                    d_col = if input.modifiers.shift { -1 } else { 1 };
                    handled = true;
                }
            });
            if handled {
                state.move_by(d_col, d_row);
            }
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("table_error_load");
    }

    if state.edited {
        state.edited = false;
        state.commit_buffer();
    }

    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("table"),
            title: texts.get("table_title"),
            subtitle: texts.get("table_subtitle"),
            status: None,
        },
        &mut state.back,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);
    tabs(ui, theme, texts, focus, state);
    ui.add_space(10.0);
    // The ribbon wraps to several rows on a phone and the grid is taller than the panel, so the
    // whole sheet scrolls: without it the lower ribbon rows and the status bar were painted off the
    // panel and could not be reached at all.
    egui::ScrollArea::vertical().show(ui, |ui| {
        match state.tab {
            TableTab::File => file_tab(ui, theme, texts, focus, state, store, now),
            TableTab::Home => home_tab(ui, theme, texts, focus, state),
            TableTab::Insert => insert_tab(ui, theme, texts, focus, state),
            TableTab::View => view_tab(ui, theme, texts, focus, state),
        }
        ui.add_space(10.0);
        formula_bar(ui, theme, texts, state);
        ui.add_space(6.0);
        grid(ui, theme, state);
        ui.add_space(4.0);
        status_bar(ui, theme, texts, state);
    });
    confirm_dialog(ctx, theme, texts, focus, state, store, now);
}

fn file_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
    store: &Store,
    now: i64,
) {
    ui.horizontal_wrapped(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("table_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            state.new_document(now);
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_save"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.commit_buffer();
            let fallback = texts.get("table_untitled").to_string();
            state.save(store, now, &fallback);
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_clear_sheet"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.clear_sheet();
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_export_csv"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.commit_buffer();
            state.export_csv();
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_import_csv"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.import_csv();
        }
    });
    ui.add_space(8.0);
    // One field per row: a text field already fills the phone panel, so a second one beside it was
    // laid out past the right edge.
    let mut path = state.path.clone();
    let changed = text_field(
        ui,
        theme,
        focus,
        &mut path,
        texts.get("table_path"),
        texts.get("table_path_hint"),
        None,
    );
    if changed.activated || path != state.path {
        state.path = path;
    }
    ui.add_space(6.0);
    let mut name = state.document.name.clone();
    let renamed = text_field(
        ui,
        theme,
        focus,
        &mut name,
        texts.get("table_name"),
        texts.get("table_name_hint"),
        None,
    );
    if renamed.activated {
        state.document.name = name;
    }
    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("table_documents"))
                .size(FONT_BODY)
                .family(crate::theme::semibold())
                .color(theme.palette.text),
        );
        ui.add_space(6.0);
        if state.documents.is_empty() {
            ui.label(
                RichText::new(texts.get("table_no_documents"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            return;
        }
        let mut open: Option<Uuid> = None;
        let mut delete: Option<Uuid> = None;
        for document in &state.documents {
            ui.horizontal_wrapped(|ui| {
                let name = if document.name.trim().is_empty() {
                    texts.get("table_untitled").to_string()
                } else {
                    document.name.clone()
                };
                let marker = if document.id == state.document.id {
                    "● "
                } else {
                    ""
                };
                ui.label(
                    RichText::new(format!("{marker}{name}"))
                        .size(FONT_BODY)
                        .color(theme.palette.text),
                );
                ui.label(
                    RichText::new(format!(
                        "{} × {}",
                        document.sheet.row_count(),
                        document.sheet.col_count()
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("table_open"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    open = Some(document.id);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("table_delete"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    delete = Some(document.id);
                }
            });
        }
        if let Some(id) = open {
            state.open(store, id);
        }
        if let Some(id) = delete {
            state.confirm_delete = Some(id);
        }
    });
    ui.add_space(8.0);
    let mut new_name = state.new_name.clone();
    let typed = text_field(
        ui,
        theme,
        focus,
        &mut new_name,
        texts.get("table_new_name"),
        texts.get("table_name_hint"),
        None,
    );
    if typed.activated {
        state.new_name = new_name;
    }
    ui.add_space(6.0);
    ui.horizontal_wrapped(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("table_new"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            let name = if state.new_name.trim().is_empty() {
                texts.get("table_untitled").to_string()
            } else {
                state.new_name.trim().to_string()
            };
            let mut document = SpreadsheetDocument::new(name, now);
            document.updated_at = now;
            if store.save_spreadsheet(&document).is_ok() {
                state.document = document;
                state.active = (0, 0);
                state.recompute();
                state.new_name.clear();
                state.status = Some("table_ready_new");
                state.error = None;
                if let Err(error) = state.refresh(store) {
                    let _ = error;
                    state.error = Some("table_error_load");
                }
            } else {
                state.error = Some("table_error_name");
            }
        }
    });
}

fn home_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
) {
    let style = state.active_style();
    ui.horizontal_wrapped(|ui| {
        let variants = [
            (style.bold, "B", "table_bold", CellStyleBold::Bold),
            (style.italic, "I", "table_italic", CellStyleBold::Italic),
            (
                style.underline,
                "U",
                "table_underline",
                CellStyleBold::Underline,
            ),
        ];
        for (on, glyph, key, which) in variants {
            let variant = if on {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, glyph, variant)
                .on_hover_text(texts.get(key))
                .activated
            {
                state.apply_style(|style| match which {
                    CellStyleBold::Bold => style.bold = !on,
                    CellStyleBold::Italic => style.italic = !on,
                    CellStyleBold::Underline => style.underline = !on,
                });
            }
        }
        ui.separator();
        for family in FONT_FAMILIES {
            let on = style.font.as_deref() == Some(family);
            let variant = if on {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, family, variant).activated {
                state.apply_style(|style| {
                    style.font = if on { None } else { Some(family.to_string()) };
                });
            }
        }
    });
    ui.add_space(6.0);
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(texts.get("table_font_color"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        for color in STANDARD_COLORS {
            if swatch(ui, theme, color, style.color.as_deref() == Some(color)) {
                state.apply_style(|style| {
                    style.color = if style.color.as_deref() == Some(color) {
                        None
                    } else {
                        Some(color.to_string())
                    };
                });
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_color_none"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.apply_style(|style| style.color = None);
        }
    });
    ui.add_space(4.0);
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(texts.get("table_fill_color"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        for color in STANDARD_COLORS {
            if swatch(ui, theme, color, style.fill.as_deref() == Some(color)) {
                state.apply_style(|style| {
                    style.fill = if style.fill.as_deref() == Some(color) {
                        None
                    } else {
                        Some(color.to_string())
                    };
                });
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_color_none"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.apply_style(|style| style.fill = None);
        }
    });
    ui.add_space(6.0);
    ui.horizontal_wrapped(|ui| {
        for (align, key, glyph) in [
            (CellAlign::Left, "table_align_left", "⬅"),
            (CellAlign::Center, "table_align_center", "⬌"),
            (CellAlign::Right, "table_align_right", "➡"),
        ] {
            let on = style.align == Some(align);
            let variant = if on {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, glyph, variant)
                .on_hover_text(texts.get(key))
                .activated
            {
                state.apply_style(|style| {
                    style.align = if on { None } else { Some(align) };
                });
            }
        }
        ui.separator();
        if button(
            ui,
            theme,
            focus,
            texts.get("table_clear_cell"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.clear_selection();
        }
    });
    ui.add_space(6.0);
    ui.horizontal_wrapped(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("table_insert_row"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.insert_row();
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_delete_row"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.delete_row();
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_insert_col"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.insert_col();
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("table_delete_col"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.delete_col();
        }
    });
}

#[derive(Clone, Copy)]
enum CellStyleBold {
    Bold,
    Italic,
    Underline,
}

fn swatch(ui: &mut egui::Ui, theme: &Theme, color: &str, active: bool) -> bool {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(20.0, 20.0), Sense::click());
    let fill = parse_color(color).unwrap_or(theme.palette.text);
    ui.painter().rect_filled(rect, 3.0, fill);
    let stroke = if active {
        egui::Stroke::new(2.0_f32, theme.palette.text)
    } else {
        egui::Stroke::new(1.0_f32, theme.palette.border)
    };
    ui.painter().rect_stroke(rect, 3.0, stroke);
    response.clicked()
}

/// Parses `#rrggbb` into a colour.
pub fn parse_color(value: &str) -> Option<Color32> {
    let hex = value.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let red = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let green = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let blue = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some(Color32::from_rgb(red, green, blue))
}

fn insert_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
) {
    ui.horizontal_wrapped(|ui| {
        for (name, key) in FUNCTIONS {
            if button(ui, theme, focus, texts.get(key), ButtonVariant::Secondary).activated {
                state.insert_function(name);
            }
        }
    });
    ui.add_space(6.0);
    ui.label(
        RichText::new(format!(
            "{} · {}",
            texts.get("table_range_hint"),
            state.selection_range()
        ))
        .size(FONT_SMALL)
        .color(theme.palette.text_muted),
    );
}

fn view_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
) {
    ui.horizontal_wrapped(|ui| {
        let mut gridlines = state.document.show_gridlines;
        if switch(
            ui,
            theme,
            focus,
            &mut gridlines,
            texts.get("table_gridlines"),
        )
        .activated
        {
            state.document.show_gridlines = gridlines;
        }
        let mut bar = state.document.show_formula_bar;
        if switch(ui, theme, focus, &mut bar, texts.get("table_formula_bar")).activated {
            state.document.show_formula_bar = bar;
        }
    });
    ui.add_space(6.0);
    ui.label(
        RichText::new(format!("{} × {}", MAX_ROWS, MAX_COLS))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
}

fn formula_bar(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &mut TableState) {
    if !state.document.show_formula_bar {
        return;
    }
    ui.horizontal(|ui| {
        ui.label(
            RichText::new(cell_id(state.active.0, state.active.1))
                .size(FONT_BODY)
                .family(crate::theme::semibold())
                .color(theme.palette.text_muted),
        );
        let response = ui.add(
            egui::TextEdit::singleline(&mut state.buffer)
                .hint_text(texts.get("table_formula_hint"))
                .desired_width(ui.available_width())
                .font(FontId::proportional(FONT_BODY)),
        );
        if response.changed() {
            state.edited = true;
        }
    });
}

fn grid(ui: &mut egui::Ui, theme: &Theme, state: &mut TableState) {
    let values = state.values.clone();
    let styles: BTreeMap<String, CellStyle> = state.document.styles.clone();
    let rows = state.document.sheet.row_count();
    let cols = state.document.sheet.col_count();
    let gridlines = state.document.show_gridlines;
    let active = state.active;
    // Inside the outer scroll area `available_height` grows with the content, so the grid gets a
    // fixed, viewport-sized height that keeps its own horizontal scroll usable on every screen.
    let height = if ui.available_width() < 720.0 {
        320.0
    } else {
        520.0
    };

    // The grid may be wider than the panel; without the width limit its vertical scroll bar was
    // laid out past the panel edge on a 360 px screen.
    let max_width = ui
        .available_width()
        .min(ui.ctx().screen_rect().width() - 48.0);
    egui::ScrollArea::both()
        .max_width(max_width)
        .max_height(height)
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing = Vec2::ZERO;
            // Column headers with the reference's A … Z letters.
            ui.horizontal(|ui| {
                let (rect, _) = ui
                    .allocate_exact_size(Vec2::new(ROW_HEADER_WIDTH, CELL_HEIGHT), Sense::hover());
                ui.painter()
                    .rect_filled(rect, 0.0, theme.palette.surface_muted);
                ui.painter().text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    "▦",
                    FontId::proportional(FONT_SMALL),
                    theme.palette.text_muted,
                );
                for col in 0..cols {
                    let size = Vec2::new(CELL_WIDTH, CELL_HEIGHT);
                    ui.allocate_ui_with_layout(
                        size,
                        Layout::centered_and_justified(egui::Direction::LeftToRight),
                        |ui| {
                            ui.set_min_size(size);
                            let rect = ui.max_rect();
                            ui.painter()
                                .rect_filled(rect, 0.0, theme.palette.surface_muted);
                            ui.painter().rect_stroke(
                                rect,
                                0.0,
                                egui::Stroke::new(1.0_f32, theme.palette.border),
                            );
                            ui.painter().text(
                                rect.center(),
                                egui::Align2::CENTER_CENTER,
                                column_name(col),
                                FontId::proportional(FONT_SMALL),
                                theme.palette.text_muted,
                            );
                        },
                    );
                }
            });
            for row in 0..rows {
                ui.horizontal(|ui| {
                    let (rect, _) = ui.allocate_exact_size(
                        Vec2::new(ROW_HEADER_WIDTH, CELL_HEIGHT),
                        Sense::hover(),
                    );
                    let fill = if row == active.1 {
                        theme.palette.surface_muted
                    } else {
                        theme.palette.surface
                    };
                    ui.painter().rect_filled(rect, 0.0, fill);
                    ui.painter().text(
                        rect.center(),
                        egui::Align2::CENTER_CENTER,
                        format!("{}", row + 1),
                        FontId::proportional(FONT_SMALL),
                        theme.palette.text_muted,
                    );
                    for col in 0..cols {
                        let id = cell_id(col, row);
                        let style = styles.get(&id).cloned().unwrap_or_default();
                        let value = values
                            .get(row)
                            .and_then(|line| line.get(col))
                            .cloned()
                            .unwrap_or(CellValue::Empty);
                        let is_active = (col, row) == active;
                        let size = Vec2::new(CELL_WIDTH, CELL_HEIGHT);
                        let layout = match style.align {
                            Some(CellAlign::Center) => {
                                Layout::centered_and_justified(egui::Direction::LeftToRight)
                            }
                            Some(CellAlign::Right) => Layout::right_to_left(Align::Center),
                            _ if value.is_number() && style.align.is_none() => {
                                Layout::right_to_left(Align::Center)
                            }
                            _ => Layout::left_to_right(Align::Center),
                        };
                        // Every cell needs its own id scope: without it the label and the inline
                        // editor of different cells share an automatic id and egui reports an id
                        // clash, which also painted debug boxes over the sheet.
                        let inner = ui
                            .push_id(("table-cell", col, row), |ui| {
                                ui.allocate_ui_with_layout(size, layout, |ui| {
                                    // A layout shrinks to its content unless it is told the size:
                                    // without this, empty cells collapsed and the columns of a
                                    // sheet no longer lined up.
                                    ui.set_min_size(size);
                                    let rect = ui.max_rect();
                                    if let Some(fill) = style.fill.as_deref().and_then(parse_color)
                                    {
                                        ui.painter().rect_filled(rect, 0.0, fill);
                                    } else if is_active {
                                        ui.painter().rect_filled(rect, 0.0, theme.palette.surface);
                                    }
                                    if gridlines || is_active {
                                        let stroke = if is_active {
                                            egui::Stroke::new(2.0_f32, theme.accent.base)
                                        } else {
                                            egui::Stroke::new(1.0_f32, theme.palette.border)
                                        };
                                        ui.painter().rect_stroke(
                                            rect,
                                            0.0,
                                            egui::Stroke::new(stroke.width, stroke.color),
                                        );
                                    }
                                    ui.add_space(4.0);
                                    if is_active {
                                        let response = ui.add(
                                            egui::TextEdit::singleline(&mut state.buffer)
                                                .frame(false)
                                                .desired_width(CELL_WIDTH - 12.0)
                                                .font(FontId::proportional(FONT_BODY)),
                                        );
                                        if response.changed() {
                                            state.edited = true;
                                        }
                                    } else {
                                        let mut text = RichText::new(if value.is_filled() {
                                            truncate(&value.display(), 14)
                                        } else {
                                            String::new()
                                        })
                                        .size(FONT_BODY);
                                        let family = match style.font.as_deref() {
                                            Some("Courier New") => FontFamily::Monospace,
                                            _ if style.bold => crate::theme::semibold(),
                                            _ => FontFamily::Proportional,
                                        };
                                        text = text.family(family);
                                        if style.italic {
                                            text = text.italics();
                                        }
                                        if style.underline {
                                            text = text.underline();
                                        }
                                        if let Some(color) =
                                            style.color.as_deref().and_then(parse_color)
                                        {
                                            text = text.color(color);
                                        } else if matches!(value, CellValue::Error) {
                                            text = text.color(theme.palette.danger);
                                        } else {
                                            text = text.color(theme.palette.text);
                                        }
                                        ui.add(egui::Label::new(text).truncate(true));
                                    }
                                })
                            })
                            .inner;
                        if inner.response.interact(Sense::click()).clicked() && !is_active {
                            state.select(col, row);
                            state.edited = false;
                        }
                    }
                });
            }
            ui.add_space(4.0);
            ui.label(
                RichText::new(format!("{MIN_ROWS}–{MAX_ROWS} · {MIN_COLS}–{MAX_COLS}"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });
}

fn status_bar(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &TableState) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(format!(
                "{} {}{}",
                texts.get("table_status_cell"),
                column_name(state.active.0),
                state.active.1 + 1
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        ui.separator();
        ui.label(
            RichText::new(format!(
                "{}: {}",
                texts.get("table_status_filled"),
                state.document.sheet.filled_count()
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        ui.separator();
        ui.label(
            RichText::new(texts.get("table_status_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
}

fn confirm_dialog(
    ctx: &egui::Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TableState,
    store: &Store,
    now: i64,
) {
    let mut open = state.confirm_delete.is_some();
    let confirmed = modal(
        ctx,
        theme,
        &mut open,
        texts.get("table_confirm_delete"),
        |ui| {
            ui.set_max_width((ctx.screen_rect().width() - 96.0).max(240.0));
            ui.label(
                RichText::new(texts.get("table_confirm_delete_hint"))
                    .size(FONT_BODY)
                    .color(theme.palette.text),
            );
            ui.add_space(10.0);
            let mut confirm = false;
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("table_cancel"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    state.confirm_delete = None;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("table_confirm"),
                    ButtonVariant::Danger,
                )
                .activated
                {
                    confirm = true;
                }
            });
            confirm
        },
    );
    if confirmed {
        if let Some(id) = state.confirm_delete.take() {
            state.delete(store, id, now);
        }
    } else if !open {
        state.confirm_delete = None;
    }
}

fn truncate(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut out: String = text.chars().take(limit.saturating_sub(1)).collect();
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    fn state() -> TableState {
        let mut state = TableState::new();
        state.document = SpreadsheetDocument::new("Test", 1_000);
        state.recompute();
        state
    }

    #[test]
    fn typing_a_cell_updates_values_and_formulas() {
        let mut state = state();
        state.select(0, 0);
        state.buffer = "10".to_string();
        state.commit_buffer();
        state.select(0, 1);
        state.buffer = "20".to_string();
        state.commit_buffer();
        state.select(1, 2);
        state.buffer = "=SUMME(A1:A2)".to_string();
        state.commit_buffer();
        assert_eq!(state.values[2][1], CellValue::Number(30.0));
        state.select(0, 3);
        assert_eq!(state.buffer, "");
    }

    #[test]
    fn selection_is_the_connected_block_and_receives_formatting() {
        let mut state = state();
        for col in 0..2 {
            for row in 0..2 {
                state.document.sheet.set(col, row, "x");
            }
        }
        state.select(0, 0);
        assert_eq!(state.selection(), (0, 0, 1, 1));
        state.apply_style(|style| style.bold = true);
        for id in ["A1", "B1", "A2", "B2"] {
            assert!(state.document.styles.get(id).expect("style").bold, "{id}");
        }
        state.apply_style(|style| style.bold = false);
        assert!(state.document.styles.is_empty());
        state.select(3, 4);
        assert_eq!(state.selection(), (3, 4, 3, 4));
    }

    #[test]
    fn insert_and_delete_move_styles_and_clamp_the_selection() {
        let mut state = state();
        state.select(0, 1);
        state.apply_style(|style| style.italic = true);
        state.insert_row();
        assert!(state.document.styles.contains_key("A3"));
        assert_eq!(state.document.sheet.row_count(), MIN_ROWS + 1);
        state.select(0, 1);
        state.delete_row();
        assert!(state.document.styles.contains_key("A2"));
        assert_eq!(state.document.sheet.row_count(), MIN_ROWS);
        state.select(1, 0);
        state.apply_style(|style| style.underline = true);
        state.insert_col();
        assert!(state.document.styles.contains_key("C1"));
        state.select(1, 0);
        state.delete_col();
        assert!(state.document.styles.contains_key("B1"));
    }

    #[test]
    fn insert_function_writes_the_range_formula_above_the_block() {
        let mut state = state();
        state.document.sheet.set(0, 1, "10");
        state.document.sheet.set(0, 2, "20");
        state.select(0, 1);
        state.insert_function("SUMME");
        assert_eq!(state.document.sheet.raw(0, 0), "=SUMME(A2:A3)");
        assert_eq!(state.active, (0, 0));
        assert_eq!(state.values[0][0], CellValue::Number(30.0));

        // A block that starts in the first row has no row above it; nothing is overwritten.
        state.document.sheet.set(1, 0, "5");
        state.select(1, 0);
        state.insert_function("MAX");
        assert_eq!(state.document.sheet.raw(1, 0), "5");
        assert_eq!(state.error, Some("table_function_no_row"));
    }

    #[test]
    fn save_open_delete_round_trips_through_sqlite() {
        let store = Store::open_in_memory().expect("store");
        let mut state = state();
        state.select(0, 0);
        state.buffer = "42".to_string();
        state.commit_buffer();
        state.save(&store, 2_000, "Tabelle");
        assert_eq!(store.spreadsheet_count().expect("count"), 1);
        let id = state.document.id;

        state.new_document(3_000);
        assert_eq!(state.document.name, "");
        state.open(&store, id);
        assert_eq!(state.document.name, "Test");
        assert_eq!(state.document.sheet.raw(0, 0), "42");
        assert_eq!(state.values[0][0], CellValue::Number(42.0));

        state.delete(&store, id, 4_000);
        assert_eq!(store.spreadsheet_count().expect("count"), 0);
        assert_eq!(state.document.name, "");
    }

    #[test]
    fn csv_export_and_import_use_the_real_file_system() {
        let mut state = state();
        state.select(0, 0);
        state.buffer = "Betrag; brutto".to_string();
        state.commit_buffer();
        state.select(1, 0);
        state.buffer = "12,5".to_string();
        state.commit_buffer();
        let path = std::env::temp_dir().join(format!("socdof-table-{}.csv", Uuid::new_v4()));
        state.path = path.display().to_string();
        state.export_csv();
        assert_eq!(state.status, Some("table_exported"));
        let written = std::fs::read_to_string(&path).expect("csv");
        assert!(written.starts_with('\u{feff}'));
        assert!(written.contains("\"Betrag; brutto\""));

        state.clear_sheet();
        assert_eq!(state.document.sheet.filled_count(), 0);
        state.import_csv();
        assert_eq!(state.status, Some("table_imported"));
        assert_eq!(state.document.sheet.raw(0, 0), "Betrag; brutto");
        assert_eq!(state.values[0][1], CellValue::Number(12.5));
        let _ = std::fs::remove_file(&path);

        state.path = "   ".to_string();
        state.export_csv();
        assert_eq!(state.error, Some("table_error_path"));
    }

    #[test]
    fn clearing_the_selection_removes_only_its_cells() {
        let mut state = state();
        state.document.sheet.set(0, 0, "a");
        state.document.sheet.set(1, 0, "b");
        state.document.sheet.set(3, 3, "c");
        state.select(0, 0);
        state.clear_selection();
        assert_eq!(state.document.sheet.raw(0, 0), "");
        assert_eq!(state.document.sheet.raw(1, 0), "");
        assert_eq!(state.document.sheet.raw(3, 3), "c");
    }

    #[test]
    fn seed_creates_the_two_reference_sheets_once() {
        let store = Store::open_in_memory().expect("store");
        seed_table(&store).expect("seed");
        seed_table(&store).expect("second seed is a no-op");
        let documents = store.list_spreadsheets().expect("list");
        assert_eq!(documents.len(), 2);
        let inventory = documents
            .iter()
            .find(|document| document.name == "Inventur")
            .expect("inventory");
        let values = inventory.sheet.values();
        assert_eq!(values[5][1], CellValue::Number(530.0));
        assert_eq!(values[1][3], CellValue::Number(14.4));
    }

    #[test]
    fn every_label_key_exists_in_all_four_languages() {
        for language in [Language::De, Language::En, Language::Fr, Language::Es] {
            let texts = UiTexts::embedded(language).expect("catalogue");
            for key in [
                "table_title",
                "table_subtitle",
                "table_tab_file",
                "table_tab_home",
                "table_tab_insert",
                "table_tab_view",
                "table_new",
                "table_save",
                "table_open",
                "table_delete",
                "table_name",
                "table_new_name",
                "table_untitled",
                "table_documents",
                "table_no_documents",
                "table_clear_sheet",
                "table_clear_cell",
                "table_cleared_cells",
                "table_cleared_sheet",
                "table_insert_row",
                "table_delete_row",
                "table_insert_col",
                "table_delete_col",
                "table_bold",
                "table_italic",
                "table_underline",
                "table_font_color",
                "table_fill_color",
                "table_color_none",
                "table_align_left",
                "table_align_center",
                "table_align_right",
                "table_fn_sum",
                "table_fn_average",
                "table_fn_max",
                "table_fn_min",
                "table_fn_count",
                "table_range_hint",
                "table_function_inserted",
                "table_function_no_row",
                "table_gridlines",
                "table_formula_bar",
                "table_formula_hint",
                "table_export_csv",
                "table_import_csv",
                "table_exported",
                "table_imported",
                "table_path",
                "table_path_hint",
                "table_status_cell",
                "table_status_filled",
                "table_status_hint",
                "table_saved",
                "table_deleted",
                "table_ready_new",
                "table_ready_open",
                "table_error_load",
                "table_error_save",
                "table_error_name",
                "table_error_path",
                "table_error_read",
                "table_error_write",
                "table_error_missing",
                "table_limit_reached",
                "table_confirm_delete",
                "table_confirm_delete_hint",
                "table_cancel",
                "table_confirm",
                "app_table",
                "settings_module_table",
                "app_store_desc_table",
            ] {
                assert_ne!(texts.get(key), key, "{} misses {key}", language.as_str());
            }
        }
    }
}
