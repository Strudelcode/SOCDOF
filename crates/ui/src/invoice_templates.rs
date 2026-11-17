//! Invoice template manager of the invoices screen.
//!
//! The book lives in the core (`socdof_core::invoice_template`) and is persisted in the settings
//! table. This screen edits that book, selects the active template and never keeps a second source
//! of truth: every save goes through the validated core API.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use egui::{Context, DroppedFile, RichText, TextEdit, Ui};

use socdof_core::domain::contact::Contact;
use socdof_core::domain::invoice::Invoice;
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::invoice_template::{
    self, InvoiceTemplate, TemplateAsset, TemplateAssetError, TemplateAssetKind, TemplateBook,
};
use socdof_core::rich_html::{RichBlock, RichDocument, TextRun};
use socdof_core::store::Store;

use crate::components::{badge, button, modal, ButtonVariant, Tone};
use crate::controls::{drop_zone, switch, text_field};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::invoice_tokens::PreviewTexture;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Real invoice data shown in the template preview.
#[derive(Clone, Copy)]
pub struct TemplatePreview<'a> {
    /// Invoice whose values are rendered.
    pub invoice: Option<&'a Invoice>,
    /// Billed contact of the invoice.
    pub contact: Option<&'a Contact>,
    /// Global company profile used as fallback.
    pub company: &'a CompanyProfile,
    /// Currency symbol.
    pub currency: &'a str,
}

/// Result of asking the desktop host for a template asset.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssetDialogOutcome {
    /// The user chose a file.
    Picked(PathBuf),
    /// The user closed the picker without choosing a file.
    Cancelled,
    /// No desktop host is attached, as in tests and the headless preview.
    Unavailable,
}

type AssetPickerFn = Arc<dyn Fn(TemplateAssetKind) -> AssetDialogOutcome + Send + Sync>;

/// Native file picker of the template dialog.
///
/// The window host installs it; without a host the dialog reports
/// [`AssetDialogOutcome::Unavailable`] and the screen shows a translated error instead of
/// panicking. Equality compares the installed picker, so the editor state keeps its `PartialEq`.
#[derive(Clone, Default)]
pub struct AssetPicker(Option<AssetPickerFn>);

impl AssetPicker {
    /// Picker of a headless build, which cannot open a native dialog.
    pub fn unavailable() -> Self {
        Self(None)
    }

    /// Wraps the host's native file dialog.
    pub fn new(
        picker: impl Fn(TemplateAssetKind) -> AssetDialogOutcome + Send + Sync + 'static,
    ) -> Self {
        Self(Some(Arc::new(picker)))
    }

    /// Whether a desktop host installed a picker.
    pub fn is_available(&self) -> bool {
        self.0.is_some()
    }

    fn pick(&self, kind: TemplateAssetKind) -> AssetDialogOutcome {
        match &self.0 {
            Some(picker) => picker(kind),
            None => AssetDialogOutcome::Unavailable,
        }
    }
}

impl std::fmt::Debug for AssetPicker {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_tuple("AssetPicker")
            .field(&if self.is_available() {
                "native"
            } else {
                "unavailable"
            })
            .finish()
    }
}

impl PartialEq for AssetPicker {
    fn eq(&self, other: &Self) -> bool {
        match (&self.0, &other.0) {
            (None, None) => true,
            (Some(left), Some(right)) => Arc::ptr_eq(left, right),
            _ => false,
        }
    }
}

/// Native picker of the desktop host, with the same filters as the TypeScript inputs.
#[cfg(feature = "dialogs")]
pub fn native_asset_picker() -> AssetPicker {
    AssetPicker::new(|kind| {
        let mut dialog = rfd::FileDialog::new();
        let extensions = kind.extensions();
        if !extensions.is_empty() {
            dialog = dialog.add_filter("Supported files", extensions);
        }
        match dialog.pick_file() {
            Some(path) => AssetDialogOutcome::Picked(path),
            None => AssetDialogOutcome::Cancelled,
        }
    })
}

/// State of the template manager.
#[derive(Debug, Clone, PartialEq)]
pub struct InvoiceTemplatesState {
    /// Whether the manager is visible.
    pub open: bool,
    /// Loaded template book.
    pub book: TemplateBook,
    /// Index of the template being edited.
    pub selected: usize,
    /// Editable copy of the selected template.
    pub draft: InvoiceTemplate,
    /// Raw payment term input, kept as text while the user types.
    pub due_days_input: String,
    /// Whether the fields differ from the stored template.
    pub dirty: bool,
    /// Whether the reset confirmation is open.
    pub confirm_reset: bool,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub notice: Option<&'static str>,
    loaded: bool,
    /// Field selected in the stationery placement studio.
    pub(crate) selected_token: Option<String>,
    /// Field currently dragged on the canvas.
    pub(crate) dragging_token: Option<String>,
    /// Token key chosen for the next add action.
    pub(crate) new_token_key: String,
    /// Cached stationery texture of the preview canvas.
    pub(crate) stationery_texture: PreviewTexture,
    /// Source key the cached texture belongs to.
    pub(crate) stationery_texture_key: String,
    /// Cached logo texture of the template dialog.
    pub(crate) logo_texture: PreviewTexture,
    /// Source key the cached logo texture belongs to.
    pub(crate) logo_texture_key: String,
    /// Native picker installed by the desktop host.
    asset_picker: AssetPicker,
}

impl Default for InvoiceTemplatesState {
    fn default() -> Self {
        let book = TemplateBook::default();
        let draft = book
            .templates
            .first()
            .cloned()
            .unwrap_or_else(InvoiceTemplate::default);
        let due_days_input = draft.due_days.to_string();
        Self {
            open: false,
            book,
            selected: 0,
            draft,
            due_days_input,
            dirty: false,
            confirm_reset: false,
            error: None,
            notice: None,
            loaded: false,
            selected_token: None,
            dragging_token: None,
            new_token_key: "{Rechnungsnummer}".to_string(),
            stationery_texture: PreviewTexture::default(),
            stationery_texture_key: String::new(),
            logo_texture: PreviewTexture::default(),
            logo_texture_key: String::new(),
            asset_picker: AssetPicker::default(),
        }
    }
}

impl InvoiceTemplatesState {
    /// Creates an unloaded manager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads the book once.
    pub fn ensure_loaded(&mut self, store: &Store) {
        if self.loaded {
            return;
        }
        match invoice_template::load(store) {
            Ok(book) => {
                self.book = book;
                self.selected = 0;
                self.draft = self
                    .book
                    .templates
                    .first()
                    .cloned()
                    .unwrap_or_else(InvoiceTemplate::default);
                self.error = None;
            }
            Err(error) => {
                self.error = Some(InvoiceTemplate::error_key(&error.to_string()));
            }
        }
        self.loaded = true;
    }

    /// Opens the manager on the active template.
    pub fn open(&mut self, store: &Store) {
        self.ensure_loaded(store);
        self.selected = self
            .book
            .templates
            .iter()
            .position(|template| template.id == self.book.active_id)
            .unwrap_or(0);
        self.draft = self
            .book
            .templates
            .get(self.selected)
            .cloned()
            .unwrap_or_else(InvoiceTemplate::default);
        self.due_days_input = self.draft.due_days.to_string();
        self.dirty = false;
        self.confirm_reset = false;
        self.error = None;
        self.notice = None;
        self.selected_token = None;
        self.dragging_token = None;
        self.stationery_texture_key.clear();
        self.open = true;
    }

    /// Selects a template by index.
    pub fn select(&mut self, index: usize) {
        if let Some(template) = self.book.templates.get(index) {
            self.selected = index;
            self.draft = template.clone();
            self.due_days_input = self.draft.due_days.to_string();
            self.dirty = false;
            self.confirm_reset = false;
            self.error = None;
            self.notice = None;
            self.selected_token = None;
            self.dragging_token = None;
            self.stationery_texture_key.clear();
        }
    }

    /// Active template, if a book has been loaded.
    pub fn active(&self) -> Option<&InvoiceTemplate> {
        self.book.active()
    }

    /// Saves the draft in the local book and in the store.
    pub fn save(&mut self, store: &Store) -> bool {
        let Ok(due_days) = self.due_days_input.trim().parse::<i64>() else {
            self.error = Some("invoices_template_error_due");
            return false;
        };
        self.draft.due_days = due_days;
        if let Some(template) = self.book.templates.get_mut(self.selected) {
            *template = self.draft.clone();
        } else {
            self.book.templates.push(self.draft.clone());
            self.selected = self.book.templates.len() - 1;
        }
        match invoice_template::save(store, &self.book) {
            Ok(()) => {
                self.dirty = false;
                self.error = None;
                self.notice = Some("invoices_template_saved");
                true
            }
            Err(error) => {
                self.error = Some(InvoiceTemplate::error_key(&error.to_string()));
                false
            }
        }
    }

    /// Stores the selected template as the active one.
    pub fn activate(&mut self, store: &Store) -> bool {
        if self.dirty && !self.save(store) {
            return false;
        }
        let id = self.draft.id.clone();
        if !self.book.activate(&id) {
            self.error = Some("invoices_template_error_active");
            return false;
        }
        match invoice_template::save(store, &self.book) {
            Ok(()) => {
                self.error = None;
                self.notice = Some("invoices_template_activated");
                true
            }
            Err(error) => {
                self.error = Some(InvoiceTemplate::error_key(&error.to_string()));
                false
            }
        }
    }

    /// Duplicates the selected template and selects the copy.
    pub fn duplicate(&mut self, store: &Store) -> bool {
        let mut next = self.book.templates.len() + 1;
        let id = loop {
            let candidate = format!("template_copy_{next}");
            if !self
                .book
                .templates
                .iter()
                .any(|template| template.id == candidate)
            {
                break candidate;
            }
            next += 1;
        };
        let source = self.draft.id.clone();
        if self.book.duplicate(&source, id).is_none() {
            self.error = Some("invoices_template_error_empty");
            return false;
        }
        self.selected = self.book.templates.len() - 1;
        self.draft = self.book.templates[self.selected].clone();
        self.due_days_input = self.draft.due_days.to_string();
        self.dirty = false;
        if !self.save(store) {
            return false;
        }
        self.notice = Some("invoices_template_duplicated");
        true
    }

    /// Deletes the selected template, keeping at least one.
    pub fn delete(&mut self, store: &Store) -> bool {
        if !self.book.remove(&self.draft.id) {
            self.error = Some("invoices_template_error_empty");
            return false;
        }
        self.selected = self.selected.min(self.book.templates.len() - 1);
        self.draft = self.book.templates[self.selected].clone();
        self.due_days_input = self.draft.due_days.to_string();
        self.dirty = false;
        match invoice_template::save(store, &self.book) {
            Ok(()) => {
                self.error = None;
                self.notice = Some("invoices_template_deleted");
                true
            }
            Err(error) => {
                self.error = Some(InvoiceTemplate::error_key(&error.to_string()));
                false
            }
        }
    }

    /// Restores the factory templates.
    pub fn reset(&mut self, store: &Store) -> bool {
        self.book = TemplateBook::default();
        self.selected = 0;
        self.draft = self.book.templates[0].clone();
        self.due_days_input = self.draft.due_days.to_string();
        self.dirty = false;
        self.confirm_reset = false;
        match invoice_template::save(store, &self.book) {
            Ok(()) => {
                self.error = None;
                self.notice = Some("invoices_template_reset_done");
                true
            }
            Err(error) => {
                self.error = Some(InvoiceTemplate::error_key(&error.to_string()));
                false
            }
        }
    }

    /// Installs the native file picker of the desktop host.
    pub fn set_asset_picker(&mut self, picker: AssetPicker) {
        self.asset_picker = picker;
    }

    /// Opens the native picker for `kind` and stores the chosen file.
    pub fn choose_asset(&mut self, kind: TemplateAssetKind) -> bool {
        match self.asset_picker.pick(kind) {
            AssetDialogOutcome::Picked(path) => self.load_asset_path(kind, &path),
            AssetDialogOutcome::Cancelled => false,
            AssetDialogOutcome::Unavailable => {
                self.error = Some("invoices_template_error_dialog");
                self.notice = None;
                false
            }
        }
    }

    /// Reads `path` with the shared asset rules and applies it to the draft.
    pub fn load_asset_path(&mut self, kind: TemplateAssetKind, path: &Path) -> bool {
        match invoice_template::read_template_asset(kind, path) {
            Ok(asset) => {
                self.apply_asset(asset);
                true
            }
            Err(error) => {
                self.set_asset_error(&error);
                false
            }
        }
    }

    /// Applies bytes dropped onto the logo or stationery area.
    pub fn load_asset_bytes(
        &mut self,
        kind: TemplateAssetKind,
        file_name: &str,
        bytes: &[u8],
    ) -> bool {
        match invoice_template::template_asset_from_bytes(kind, file_name, bytes) {
            Ok(asset) => {
                self.apply_asset(asset);
                true
            }
            Err(error) => {
                self.set_asset_error(&error);
                false
            }
        }
    }

    /// Applies a file dropped by the window host, reading it from memory or from its path.
    pub fn load_dropped_asset(&mut self, kind: TemplateAssetKind, file: &DroppedFile) -> bool {
        let file_name = if file.name.trim().is_empty() {
            file.path
                .as_deref()
                .and_then(Path::file_name)
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_string()
        } else {
            file.name.clone()
        };
        let bytes = match (&file.bytes, &file.path) {
            (Some(bytes), _) => Some(bytes.to_vec()),
            (None, Some(path)) => std::fs::read(path).ok(),
            (None, None) => None,
        };
        match bytes {
            Some(bytes) => self.load_asset_bytes(kind, &file_name, &bytes),
            None => {
                self.error = Some("invoices_template_error_asset");
                self.notice = None;
                false
            }
        }
    }

    fn apply_asset(&mut self, asset: TemplateAsset) {
        match asset.kind {
            TemplateAssetKind::Logo => {
                self.draft.logo = asset.data_url;
                self.draft.show_logo = true;
            }
            TemplateAssetKind::Stationery => {
                self.draft.stationery_source = asset.data_url;
                self.draft.stationery_mode = true;
                if self.draft.stationery_tokens.is_empty() {
                    self.apply_default_stationery_tokens();
                }
            }
        }
        self.mark_dirty();
        self.error = None;
        self.notice = Some("invoices_template_asset_loaded");
    }

    fn set_asset_error(&mut self, error: &TemplateAssetError) {
        self.error = Some(match error {
            TemplateAssetError::TooLarge { .. } => "invoices_template_error_asset_size",
            _ => "invoices_template_error_asset",
        });
        self.notice = None;
    }

    /// Loads the logo path into the template as a persisted data URL.
    pub fn load_logo(&mut self) -> bool {
        if self.draft.logo.trim().starts_with("data:") {
            return true;
        }
        let path = self.draft.logo.trim().to_string();
        if path.is_empty() {
            self.error = Some("invoices_template_error_asset");
            return false;
        }
        self.load_asset_path(TemplateAssetKind::Logo, Path::new(&path))
    }

    /// Loads an image or PDF stationery file into the template as a data URL.
    pub fn load_stationery(&mut self) -> bool {
        if self.draft.stationery_source.trim().starts_with("data:") {
            return true;
        }
        let path = self.draft.stationery_source.trim().to_string();
        if path.is_empty() {
            self.error = Some("invoices_template_error_asset");
            return false;
        }
        self.load_asset_path(TemplateAssetKind::Stationery, Path::new(&path))
    }

    /// Adds a stationery field with the TypeScript defaults and selects it.
    pub fn add_stationery_token(&mut self, token_key: &str) {
        let mut id = format!("tok_{}", socdof_core::now_millis());
        while self
            .draft
            .stationery_tokens
            .iter()
            .any(|token| token.id == id)
        {
            id.push('_');
        }
        self.draft
            .stationery_tokens
            .push(invoice_template::new_stationery_token(
                id.clone(),
                token_key,
            ));
        self.selected_token = Some(id);
        self.mark_dirty();
    }

    /// Removes a stationery field and clears its selection.
    pub fn remove_stationery_token(&mut self, id: &str) {
        self.draft.stationery_tokens.retain(|token| token.id != id);
        if self.selected_token.as_deref() == Some(id) {
            self.selected_token = None;
        }
        self.dragging_token = None;
        self.mark_dirty();
    }

    /// Moves a field to page percentages, clamped to 0–95 like the TypeScript canvas.
    pub fn move_stationery_token(&mut self, id: &str, x: f64, y: f64) {
        if let Some(token) = self
            .draft
            .stationery_tokens
            .iter_mut()
            .find(|token| token.id == id)
        {
            token.x_pct = (x.clamp(0.0, 95.0) * 10.0).round() / 10.0;
            token.y_pct = (y.clamp(0.0, 95.0) * 10.0).round() / 10.0;
            self.mark_dirty();
        }
    }

    /// Replaces the fields with the TypeScript "default fields" set.
    pub fn apply_default_stationery_tokens(&mut self) {
        self.draft.stationery_tokens = invoice_template::default_stationery_tokens();
        self.selected_token = self
            .draft
            .stationery_tokens
            .first()
            .map(|token| token.id.clone());
        self.dragging_token = None;
        self.mark_dirty();
    }

    /// Marks the draft dirty when a field changed.
    pub fn mark_dirty(&mut self) {
        self.dirty = self
            .book
            .templates
            .get(self.selected)
            .map(|template| *template != self.draft)
            .unwrap_or(true);
    }
}

/// Draws the template manager and returns whether it is still open.
pub fn templates_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
    store: &Store,
    preview: TemplatePreview<'_>,
) -> bool {
    if !state.open {
        return false;
    }
    state.ensure_loaded(store);
    let mut open = state.open;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("invoices_templates_title"),
        |ui| {
            ui.set_min_width(760.0);
            ui.label(
                RichText::new(texts.get("invoices_templates_hint"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            ui.add_space(8.0);

            if let Some(key) = state.error {
                badge(ui, theme, texts.get(key), Tone::Danger);
            }
            if let Some(key) = state.notice {
                badge(ui, theme, texts.get(key), Tone::Success);
            }
            ui.add_space(6.0);

            ui.horizontal_top(|ui| {
                ui.vertical(|ui| {
                    ui.set_min_width(190.0);
                    ui.label(RichText::new(texts.get("invoices_templates_list")).strong());
                    ui.add_space(4.0);
                    let mut choose = None;
                    for (index, template) in state.book.templates.iter().enumerate() {
                        let mut label = template.name.clone();
                        if template.id == state.book.active_id {
                            label = format!("★ {label}");
                        }
                        let variant = if index == state.selected {
                            ButtonVariant::Secondary
                        } else {
                            ButtonVariant::Ghost
                        };
                        if button(ui, theme, focus, &label, variant).activated {
                            choose = Some(index);
                        }
                    }
                    if let Some(index) = choose {
                        state.select(index);
                    }
                    ui.add_space(6.0);
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("invoices_template_reset"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        state.confirm_reset = true;
                    }
                });
                ui.separator();
                ui.vertical(|ui| {
                    let max_height = (ctx.screen_rect().height() - 260.0).max(360.0);
                    egui::ScrollArea::vertical()
                        .max_height(max_height)
                        .show(ui, |ui| {
                            editor(ui, theme, texts, focus, state, preview);
                        });
                });
            });

            ui.add_space(8.0);
            if state.confirm_reset {
                ui.label(texts.get("invoices_template_reset_confirm"));
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("invoices_template_reset_yes"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        state.reset(store);
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("invoices_template_reset_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        state.confirm_reset = false;
                    }
                });
            }

            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_template_save"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    state.save(store);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_template_activate"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    state.activate(store);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_template_duplicate"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    state.duplicate(store);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_template_delete"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    state.delete(store);
                }
                button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_close"),
                    ButtonVariant::Ghost,
                )
                .activated
            })
            .inner
        },
    );
    state.open = open;
    open
}

fn render_preview_document(ui: &mut Ui, theme: &Theme, texts: &UiTexts, document: &RichDocument) {
    render_preview_blocks(ui, theme, texts, &document.blocks);
}

fn render_preview_blocks(ui: &mut Ui, theme: &Theme, texts: &UiTexts, blocks: &[RichBlock]) {
    let mut previous_bottom: Option<f32> = None;
    for (index, block) in blocks.iter().enumerate() {
        if matches!(block, RichBlock::PageBreak) {
            ui.add_space(4.0);
            ui.separator();
            ui.label(
                RichText::new(texts.get("invoices_template_page_break"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            previous_bottom = None;
            continue;
        }
        let margins = socdof_core::rich_html::block_margins(block);
        let before = previous_bottom.map_or(margins.top(), |bottom| bottom.max(margins.top()));
        if before > 0.01 {
            ui.add_space(before);
        }
        match block {
            RichBlock::Heading { runs, .. } => {
                render_preview_runs(ui, theme, runs, true);
            }
            RichBlock::Paragraph { runs, .. } => {
                render_preview_runs(ui, theme, runs, false);
            }
            RichBlock::Table(table) => {
                ui.push_id(("invoice-template-table", index), |ui| {
                    egui::Grid::new(("invoice-template-grid", index))
                        .striped(true)
                        .show(ui, |ui| {
                            for row in &table.rows {
                                for cell in row {
                                    ui.vertical(|ui| {
                                        render_preview_runs(ui, theme, &cell.runs, cell.header);
                                    });
                                }
                                ui.end_row();
                            }
                        });
                });
            }
            RichBlock::Container(container) => {
                render_preview_container(ui, theme, texts, container);
            }
            RichBlock::Image { source, .. } => {
                let label = if source.starts_with("data:") {
                    texts.get("invoices_template_image").to_string()
                } else {
                    format!("{}: {source}", texts.get("invoices_template_image"))
                };
                ui.label(
                    RichText::new(label)
                        .italics()
                        .color(theme.palette.text_muted),
                );
            }
            RichBlock::PageBreak => unreachable!("handled above"),
            RichBlock::Rule { .. } => {
                ui.separator();
            }
        }
        previous_bottom = Some(
            margins
                .bottom
                .unwrap_or_else(|| socdof_core::rich_html::default_block_gap(block)),
        );
    }
    if let Some(bottom) = previous_bottom {
        ui.add_space(bottom);
    }
}

/// Paints a flex/grid container on the slots of the shared layout plan.
///
/// The plan is the same one the PDF and DOCX exports consume, so column order, widths, gaps and
/// `justify-content`/`align-items` offsets are identical in the preview. The preview measures text
/// with the egui fonts, while the plan measures it with the Helvetica metrics of the exports.
fn render_preview_container(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    container: &socdof_core::rich_html::RichContainer,
) {
    let layout = socdof_core::rich_html::layout_container(container, ui.available_width());
    for (row_index, row) in layout.rows.iter().enumerate() {
        if row_index > 0 {
            ui.add_space(container.row_gap);
        }
        ui.horizontal_top(|ui| {
            let mut cursor = 0.0f32;
            for slot in &row.slots {
                let Some(item) = container.items.get(slot.item) else {
                    continue;
                };
                if slot.x > cursor + 0.01 {
                    ui.add_space(slot.x - cursor);
                }
                let inner = (slot.width - item.padding.left - item.padding.right).max(4.0);
                ui.vertical(|ui| {
                    ui.set_width(inner);
                    if slot.y > 0.01 {
                        ui.add_space(slot.y);
                    }
                    if item.padding.top > 0.0 {
                        ui.add_space(item.padding.top);
                    }
                    render_preview_blocks(ui, theme, texts, &item.blocks);
                    if item.padding.bottom > 0.0 {
                        ui.add_space(item.padding.bottom);
                    }
                });
                cursor = slot.x + slot.width;
            }
        });
    }
}

fn render_preview_runs(ui: &mut Ui, theme: &Theme, runs: &[TextRun], bold: bool) {
    ui.horizontal_wrapped(|ui| {
        for run in runs {
            let mut text = RichText::new(run.text.replace('\n', " "))
                .size(run.size_pt)
                .color(
                    run.color
                        .map(|[red, green, blue]| egui::Color32::from_rgb(red, green, blue))
                        .unwrap_or(theme.palette.text),
                );
            if run.bold || bold {
                text = text.strong();
            }
            if run.italic {
                text = text.italics();
            }
            if run.underline {
                text = text.underline();
            }
            ui.label(text);
        }
    });
}

fn multiline_field(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    label: &str,
    hint: &str,
    rows: usize,
) {
    ui.label(
        RichText::new(label)
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    ui.add_space(2.0);
    let response = ui.add(
        TextEdit::multiline(value)
            .hint_text(hint)
            .desired_rows(rows)
            .desired_width(f32::INFINITY)
            .text_color(theme.palette.text),
    );
    let focused = focus.register(response.id);
    if response.clicked() {
        focus.set_focus(Some(response.id));
    }
    if focused {
        ui.memory_mut(|memory| memory.request_focus(response.id));
    }
    response.widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::TextEdit, label));
}

fn asset_drop_zone(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
    kind: TemplateAssetKind,
    hint_key: &str,
) {
    let dragging = !ui.ctx().input(|input| input.raw.hovered_files.is_empty());
    let zone = drop_zone(ui, theme, focus, texts.get(hint_key), dragging);
    if zone.response.hovered() {
        for file in ui.ctx().input(|input| input.raw.dropped_files.clone()) {
            state.load_dropped_asset(kind, &file);
        }
    }
    if zone.activated {
        state.choose_asset(kind);
    }
}

fn refresh_logo_texture(ctx: &Context, state: &mut InvoiceTemplatesState) {
    let key = crate::invoice_tokens::texture_key(&state.draft.logo);
    if state.logo_texture_key == key {
        return;
    }
    state.logo_texture_key = key;
    let texture = if state.draft.show_logo {
        state.draft.logo_image().map(|image| {
            let pixels = egui::ColorImage::from_rgb(
                [image.width as usize, image.height as usize],
                &image.rgb,
            );
            ctx.load_texture("socdof-logo-preview", pixels, egui::TextureOptions::LINEAR)
        })
    } else {
        None
    };
    state.logo_texture = PreviewTexture(texture);
}

fn editor(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
    preview: TemplatePreview<'_>,
) {
    ui.set_min_width(560.0);
    let before = state.draft.clone();
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.name,
        texts.get("invoices_template_name"),
        "",
        None,
    );
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.header_title,
        texts.get("invoices_template_header_title"),
        texts.get("invoices_template_header_title_hint"),
        None,
    );
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.header_text,
        texts.get("invoices_template_header_text"),
        texts.get("invoices_template_header_text_hint"),
        None,
    );
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.footer_text,
        texts.get("invoices_template_footer_text"),
        texts.get("invoices_template_footer_hint"),
        None,
    );
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.tax_note,
        texts.get("invoices_template_tax_note"),
        texts.get("invoices_template_tax_hint"),
        None,
    );
    ui.horizontal(|ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.primary_color,
            texts.get("invoices_template_color"),
            "#2563eb",
            None,
        );
        let before_due = state.due_days_input.clone();
        text_field(
            ui,
            theme,
            focus,
            &mut state.due_days_input,
            texts.get("invoices_template_due_days"),
            "14",
            None,
        );
        if state.due_days_input != before_due {
            if let Ok(days) = state.due_days_input.trim().parse::<i64>() {
                state.draft.due_days = days;
            }
        }
    });
    switch(
        ui,
        theme,
        focus,
        &mut state.draft.show_fold_marks,
        texts.get("invoices_template_fold_marks"),
    );
    text_field(
        ui,
        theme,
        focus,
        &mut state.draft.logo,
        texts.get("invoices_template_logo"),
        texts.get("invoices_template_logo_hint"),
        None,
    );
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_template_load_logo"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.load_logo();
        }
        switch(
            ui,
            theme,
            focus,
            &mut state.draft.show_logo,
            texts.get("invoices_template_show_logo"),
        );
    });
    asset_drop_zone(
        ui,
        theme,
        texts,
        focus,
        state,
        TemplateAssetKind::Logo,
        "invoices_template_logo_drop",
    );
    if state.draft.show_logo {
        refresh_logo_texture(ui.ctx(), state);
        if let Some(texture) = &state.logo_texture.0 {
            let texture_size = texture.size();
            let natural = egui::vec2(texture_size[0] as f32, texture_size[1] as f32);
            if natural.x > 0.0 && natural.y > 0.0 {
                let max = egui::vec2(160.0, 80.0);
                let scale = (max.x / natural.x).min(max.y / natural.y).min(1.0);
                let (rect, _) = ui.allocate_exact_size(natural * scale, egui::Sense::hover());
                ui.painter().image(
                    texture.id(),
                    rect,
                    egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
                    egui::Color32::WHITE,
                );
            }
        }
    }
    ui.horizontal(|ui| {
        ui.label(
            RichText::new(texts.get("invoices_template_logo_position"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        for (value, key) in [
            ("left", "invoices_template_left"),
            ("center", "invoices_template_center"),
            ("right", "invoices_template_right"),
        ] {
            let variant = if state.draft.logo_position == value {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(key), variant).activated {
                state.draft.logo_position = value.to_string();
                state.mark_dirty();
            }
        }
    });

    switch(
        ui,
        theme,
        focus,
        &mut state.draft.stationery_mode,
        texts.get("invoices_template_stationery_mode"),
    );
    if state.draft.stationery_mode {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.stationery_source,
            texts.get("invoices_template_stationery"),
            texts.get("invoices_template_stationery_hint"),
            None,
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_template_load_stationery"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.load_stationery();
        }
        asset_drop_zone(
            ui,
            theme,
            texts,
            focus,
            state,
            TemplateAssetKind::Stationery,
            "invoices_template_stationery_drop",
        );
        crate::invoice_tokens::stationery_editor(ui, theme, texts, focus, state, preview);
    }

    switch(
        ui,
        theme,
        focus,
        &mut state.draft.use_custom_layout,
        texts.get("invoices_template_custom_layout"),
    );
    if state.draft.use_custom_layout {
        multiline_field(
            ui,
            theme,
            focus,
            &mut state.draft.custom_body_template,
            texts.get("invoices_template_html"),
            texts.get("invoices_template_html_hint"),
            9,
        );
        ui.label(
            RichText::new(texts.get("invoices_template_variables"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    }

    egui::CollapsingHeader::new(texts.get("invoices_template_company"))
        .default_open(false)
        .show(ui, |ui| {
            for (value, key) in [
                (
                    &mut state.draft.company.name,
                    "invoices_template_company_name",
                ),
                (
                    &mut state.draft.company.subtitle,
                    "invoices_template_company_subtitle",
                ),
                (
                    &mut state.draft.company.owner,
                    "invoices_template_company_owner",
                ),
                (
                    &mut state.draft.company.street,
                    "invoices_template_company_street",
                ),
                (
                    &mut state.draft.company.zip_city,
                    "invoices_template_company_zip_city",
                ),
                (
                    &mut state.draft.company.phone,
                    "invoices_template_company_phone",
                ),
                (
                    &mut state.draft.company.email,
                    "invoices_template_company_email",
                ),
                (
                    &mut state.draft.company.website,
                    "invoices_template_company_website",
                ),
                (
                    &mut state.draft.company.tax_id,
                    "invoices_template_company_tax_id",
                ),
                (
                    &mut state.draft.company.vat_id,
                    "invoices_template_company_vat_id",
                ),
                (
                    &mut state.draft.company.bank_name,
                    "invoices_template_company_bank",
                ),
                (
                    &mut state.draft.company.iban,
                    "invoices_template_company_iban",
                ),
                (
                    &mut state.draft.company.bic,
                    "invoices_template_company_bic",
                ),
                (
                    &mut state.draft.company.commercial_register,
                    "invoices_template_company_register",
                ),
            ] {
                text_field(ui, theme, focus, value, texts.get(key), "", None);
            }
        });

    if state.draft != before {
        state.mark_dirty();
        state.error = None;
    }

    ui.add_space(8.0);
    ui.label(RichText::new(texts.get("invoices_template_preview")).strong());
    let color = egui::Color32::from_rgb(
        (state.draft.color()[0] * 255.0) as u8,
        (state.draft.color()[1] * 255.0) as u8,
        (state.draft.color()[2] * 255.0) as u8,
    );
    ui.painter().rect_filled(
        egui::Rect::from_min_size(ui.cursor().min, egui::vec2(ui.available_width(), 4.0)),
        0.0,
        color,
    );
    ui.add_space(10.0);
    ui.label(RichText::new(&state.draft.header_title).size(20.0).strong());
    ui.label(
        RichText::new(&state.draft.header_text)
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    ui.add_space(6.0);
    if let (Some(invoice), Some(contact)) = (preview.invoice, preview.contact) {
        let document =
            state
                .draft
                .rendered_document(invoice, contact, preview.company, preview.currency);
        egui::ScrollArea::vertical()
            .max_height(280.0)
            .show(ui, |ui| {
                render_preview_document(ui, theme, texts, &document);
            });
    } else {
        ui.label(
            RichText::new(texts.get("invoices_template_preview_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    }

    if state.dirty {
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("invoices_template_unsaved"))
                .size(FONT_SMALL)
                .color(theme.palette.warning),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manager_round_trips_templates_and_validation() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        assert_eq!(state.book.templates.len(), 5);

        state.draft.name = "Eigene Vorlage".to_string();
        state.mark_dirty();
        assert!(state.save(&store));
        assert_eq!(
            invoice_template::load(&store).expect("load").templates[0].name,
            "Eigene Vorlage"
        );

        state.select(1);
        assert!(state.activate(&store));
        assert_eq!(
            invoice_template::load(&store).expect("load").active_id,
            state.book.templates[1].id
        );

        assert!(state.duplicate(&store));
        assert_eq!(
            invoice_template::load(&store)
                .expect("load")
                .templates
                .len(),
            6
        );
        assert!(state.delete(&store));
        assert_eq!(
            invoice_template::load(&store)
                .expect("load")
                .templates
                .len(),
            5
        );

        state.due_days_input = "400".to_string();
        assert!(!state.save(&store));
        assert_eq!(state.error, Some("invoices_template_error_due"));
    }

    #[test]
    fn token_editor_persists_tokens_and_keeps_existing_templates_unchanged() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        assert!(state
            .book
            .templates
            .iter()
            .all(|template| template.stationery_tokens.is_empty()));
        assert!(state.draft.stationery_tokens.is_empty());

        state.add_stationery_token("{Rechnungsnummer}");
        let id = state.selected_token.clone().expect("selected token");
        assert_eq!(state.draft.stationery_tokens.len(), 1);
        assert_eq!(
            state.draft.stationery_tokens[0].token_key,
            "{Rechnungsnummer}"
        );
        assert_eq!(state.draft.stationery_tokens[0].font_size, Some(13.0));

        state.move_stationery_token(&id, 120.0, -10.0);
        assert_eq!(state.draft.stationery_tokens[0].x_pct, 95.0);
        assert_eq!(state.draft.stationery_tokens[0].y_pct, 0.0);

        state.apply_default_stationery_tokens();
        assert_eq!(state.draft.stationery_tokens.len(), 7);
        assert_eq!(state.draft.stationery_tokens[5].width_pct, Some(80.0));
        assert!(state.save(&store));

        let loaded = invoice_template::load(&store).expect("load");
        assert_eq!(
            loaded.templates[state.selected].stationery_tokens,
            state.draft.stationery_tokens
        );

        let mut reopened = InvoiceTemplatesState::new();
        reopened.open(&store);
        assert_eq!(
            reopened.draft.stationery_tokens,
            state.draft.stationery_tokens
        );

        reopened.remove_stationery_token("tok_num");
        assert_eq!(reopened.draft.stationery_tokens.len(), 6);
        assert!(reopened.selected_token.is_none());
        assert!(reopened.save(&store));
        assert_eq!(
            invoice_template::load(&store).expect("load").templates[0]
                .stationery_tokens
                .len(),
            6
        );
    }

    #[test]
    fn template_dialog_paints_flex_and_grid_blocks() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        state.draft.use_custom_layout = true;
        state.draft.custom_body_template =
            "<div style=\"display:flex;justify-content:space-between\">\
            <div>Links</div><div>Rechts</div></div>\
          <div style=\"display:grid;grid-template-columns:repeat(4, 1fr);gap:16px\">\
            <div>Eins</div><div>Zwei</div><div>Drei</div><div>Vier</div></div>"
                .to_string();

        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let company = CompanyProfile::default();
        let ctx = crate::theme::headless_context();
        for _ in 0..2 {
            let _ = ctx.run(egui::RawInput::default(), |ctx| {
                templates_modal(
                    ctx,
                    &theme,
                    &texts,
                    &mut focus,
                    &mut state,
                    &store,
                    TemplatePreview {
                        invoice: None,
                        contact: None,
                        company: &company,
                        currency: "€",
                    },
                );
            });
        }
        assert!(state.draft.custom_body_template.contains("display:flex"));
    }

    #[test]
    fn template_dialog_paints_the_stationery_canvas_with_tokens() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);

        let path =
            std::env::temp_dir().join(format!("socdof-token-canvas-{}.png", std::process::id()));
        {
            let file = std::fs::File::create(&path).expect("png file");
            let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), 2, 2);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().expect("png header");
            writer
                .write_image_data(&[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255])
                .expect("png data");
        }
        state.draft.stationery_mode = true;
        state.draft.stationery_source = path.to_string_lossy().to_string();
        state.apply_default_stationery_tokens();

        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let company = CompanyProfile::default();
        let ctx = crate::theme::headless_context();
        for _ in 0..2 {
            let _ = ctx.run(egui::RawInput::default(), |ctx| {
                templates_modal(
                    ctx,
                    &theme,
                    &texts,
                    &mut focus,
                    &mut state,
                    &store,
                    TemplatePreview {
                        invoice: None,
                        contact: None,
                        company: &company,
                        currency: "€",
                    },
                );
            });
        }
        let _ = std::fs::remove_file(&path);
        assert_eq!(state.draft.stationery_tokens.len(), 7);
    }

    fn sample_png_bytes() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 2, 2);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().expect("png header");
            writer
                .write_image_data(&[255u8; 2 * 2 * 3])
                .expect("png data");
        }
        bytes
    }

    fn dropped_file(name: &str, bytes: Option<Vec<u8>>) -> DroppedFile {
        DroppedFile {
            path: None,
            name: name.to_string(),
            mime: String::new(),
            last_modified: None,
            bytes: bytes.map(Into::into),
        }
    }

    #[test]
    fn native_picker_sets_logo_and_stationery_and_persists() {
        let store = Store::open_in_memory().expect("store");
        let directory =
            std::env::temp_dir().join(format!("socdof-template-picker-{}", std::process::id()));
        std::fs::create_dir_all(&directory).expect("asset directory");
        let logo = directory.join("logo.png");
        let stationery = directory.join("briefpapier.png");
        std::fs::write(&logo, sample_png_bytes()).expect("logo file");
        std::fs::write(&stationery, sample_png_bytes()).expect("stationery file");

        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        let logo_path = logo.clone();
        let stationery_path = stationery.clone();
        state.set_asset_picker(AssetPicker::new(move |kind| {
            AssetDialogOutcome::Picked(match kind {
                TemplateAssetKind::Logo => logo_path.clone(),
                TemplateAssetKind::Stationery => stationery_path.clone(),
            })
        }));

        assert!(state.choose_asset(TemplateAssetKind::Logo));
        assert!(state.draft.logo.starts_with("data:image/png;base64,"));
        assert!(state.draft.show_logo);
        assert!(state.choose_asset(TemplateAssetKind::Stationery));
        assert!(state.draft.stationery_mode);
        assert!(state
            .draft
            .stationery_source
            .starts_with("data:image/png;base64,"));
        assert_eq!(state.draft.stationery_tokens.len(), 7);
        assert_eq!(state.selected_token.as_deref(), Some("tok_num"));
        assert!(state.save(&store));

        let loaded = invoice_template::load(&store).expect("reload templates");
        let template = &loaded.templates[state.selected];
        assert_eq!(template.logo, state.draft.logo);
        assert_eq!(template.stationery_source, state.draft.stationery_source);
        assert!(template.logo_image().is_some());
        assert!(template.stationery_image().is_some());

        let mut reopened = InvoiceTemplatesState::new();
        reopened.open(&store);
        assert_eq!(reopened.draft.logo, state.draft.logo);
        assert_eq!(
            reopened.draft.stationery_source,
            state.draft.stationery_source
        );
        assert_eq!(reopened.draft.stationery_tokens.len(), 7);
        let _ = std::fs::remove_dir_all(&directory);
    }

    #[test]
    fn drops_apply_valid_files_and_report_invalid_ones_without_panicking() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        let png = sample_png_bytes();

        assert!(state.load_dropped_asset(
            TemplateAssetKind::Logo,
            &dropped_file("logo.png", Some(png.clone()))
        ));
        assert!(state.draft.show_logo);
        assert!(state.load_dropped_asset(
            TemplateAssetKind::Stationery,
            &dropped_file("briefpapier.png", Some(png))
        ));
        assert!(state.draft.stationery_mode);
        assert_eq!(state.draft.stationery_tokens.len(), 7);

        let before = state.draft.clone();
        assert!(!state.load_dropped_asset(
            TemplateAssetKind::Stationery,
            &dropped_file("notes.txt", Some(b"nope".to_vec()))
        ));
        assert_eq!(state.error, Some("invoices_template_error_asset"));
        assert_eq!(state.draft, before);

        assert!(!state.load_dropped_asset(TemplateAssetKind::Logo, &dropped_file("logo.png", None)));
        assert_eq!(state.error, Some("invoices_template_error_asset"));
        assert_eq!(state.draft, before);

        assert!(!state.load_dropped_asset(
            TemplateAssetKind::Logo,
            &dropped_file(
                "logo.png",
                Some(vec![0u8; invoice_template::MAX_LOGO_BYTES + 1])
            )
        ));
        assert_eq!(state.error, Some("invoices_template_error_asset_size"));
        assert_eq!(state.draft, before);
    }

    #[test]
    fn a_missing_native_picker_degrades_to_a_translated_error() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        let before = state.draft.clone();

        assert!(!state.choose_asset(TemplateAssetKind::Logo));
        assert_eq!(state.error, Some("invoices_template_error_dialog"));
        assert_eq!(state.draft, before);
    }

    #[test]
    fn svg_logo_reaches_the_dialog_preview_and_broken_svgs_fall_back() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoiceTemplatesState::new();
        state.open(&store);
        let svg = br#"<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4'><rect width='8' height='4' fill='#ff0000'/></svg>"#;
        assert!(state.load_asset_bytes(TemplateAssetKind::Logo, "logo.svg", svg));
        assert!(state.draft.show_logo);
        assert!(state.draft.logo_image().is_some());

        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let company = CompanyProfile::default();
        let ctx = crate::theme::headless_context();
        for _ in 0..2 {
            let _ = ctx.run(egui::RawInput::default(), |ctx| {
                templates_modal(
                    ctx,
                    &theme,
                    &texts,
                    &mut focus,
                    &mut state,
                    &store,
                    TemplatePreview {
                        invoice: None,
                        contact: None,
                        company: &company,
                        currency: "€",
                    },
                );
            });
        }
        assert!(state.logo_texture.0.is_some());

        assert!(state.load_asset_bytes(TemplateAssetKind::Logo, "broken.svg", b"<svg><rect"));
        assert!(state.draft.logo_image().is_none());
        let _ = ctx.run(egui::RawInput::default(), |ctx| {
            templates_modal(
                ctx,
                &theme,
                &texts,
                &mut focus,
                &mut state,
                &store,
                TemplatePreview {
                    invoice: None,
                    contact: None,
                    company: &company,
                    currency: "€",
                },
            );
        });
        assert!(state.logo_texture.0.is_none());
    }
}
