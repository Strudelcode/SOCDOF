//! Text editor: a real document store with list, editor, save, create and delete.
//!
//! The screen reads and writes through [`Store::list_documents`], [`Store::search_documents`],
//! [`Store::get_document`], [`Store::insert_document`], [`Store::update_document`] and
//! [`Store::delete_document`]. Document validation lives in [`socdof_core::domain::document`];
//! the screen maps its codes to catalogue keys.
//!
//! Unsaved edits are guarded. Selecting another document, creating a new one or leaving the screen
//! opens a confirmation dialog and keeps the draft until the user decides. The guard also covers an
//! externally deleted document: loading it through the core reports a missing document instead of
//! showing an empty editor.

use egui::{Context, RichText};
use socdof_core::domain::document::Document;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::spell::{self, SpellIssue};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::text_field;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::richtext;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Fixed timestamp of the seeded documents for gallery and golden snapshots.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Settings key of the personal dictionary the spell check honours.
pub const PERSONAL_DICTIONARY_KEY: &str = "editor_spell_ignored";

/// Editable values of the open document.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DocumentDraft {
    /// Existing row, `None` for a new document.
    pub id: Option<Uuid>,
    /// Document name.
    pub name: String,
    /// Plain-text contents.
    pub body: String,
    /// Creation time kept while editing.
    pub created_at: i64,
}

impl DocumentDraft {
    /// Fills the draft from a stored document.
    pub fn from_document(document: &Document) -> Self {
        Self {
            id: Some(document.id),
            name: document.name.clone(),
            body: document.body.clone(),
            created_at: document.created_at,
        }
    }

    fn build(&self, now: i64) -> Document {
        Document {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            name: self.name.trim().to_string(),
            body: self.body.clone(),
            created_at: self.created_at,
            updated_at: now,
        }
    }
}

/// The last persisted values, used to detect unsaved edits.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct SavedDocument {
    name: String,
    body: String,
}

/// Action waiting for the unsaved-changes decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PendingAction {
    Select(Uuid),
    New,
    Back,
}

/// State of the text editor screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EditorState {
    /// Search text over names and contents.
    pub query: String,
    /// Documents loaded from the core.
    pub documents: Vec<Document>,
    /// Open document, `None` while creating.
    pub selected: Option<Uuid>,
    /// Values shown by the editor.
    pub draft: DocumentDraft,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Set when the screen should close.
    pub back: bool,
    /// Whether the body shows the formatted preview.
    pub preview: bool,
    /// Whether the spell check underlines unknown words and lists them.
    pub spell: bool,
    /// Words of the personal dictionary.
    pub spell_ignored: Vec<String>,
    /// Character selection of the body editor, kept while the ribbon has the focus.
    pub selection: (usize, usize),
    saved: Option<SavedDocument>,
    pending: Option<PendingAction>,
    loaded_query: String,
    reload: bool,
}

impl EditorState {
    /// Creates an unloaded editor.
    pub fn new() -> Self {
        Self {
            reload: true,
            spell: true,
            ..Self::default()
        }
    }

    /// Loads the document list when the query changed or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> CoreResult<()> {
        if !self.reload && self.loaded_query == self.query {
            return Ok(());
        }
        self.documents = if self.query.trim().is_empty() {
            store.list_documents()?
        } else {
            store.search_documents(&self.query)?
        };
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Prepares the screen for opening and selects the first document when none is open.
    pub fn reset_for_open(&mut self, store: &Store) -> CoreResult<()> {
        self.back = false;
        self.error = None;
        self.status = None;
        self.confirm_delete = false;
        self.pending = None;
        self.loaded_query.clear();
        self.reload = true;
        self.refresh(store)?;
        self.load_personal_dictionary(store)?;
        if self.selected.is_none() && !self.is_dirty() {
            if let Some(id) = self.documents.first().map(|document| document.id) {
                self.load(store, id)?;
            }
        }
        Ok(())
    }

    /// Open document, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&Document> {
        self.selected
            .and_then(|id| self.documents.iter().find(|document| document.id == id))
    }

    /// Whether the draft differs from the last saved values.
    pub fn is_dirty(&self) -> bool {
        match &self.saved {
            Some(saved) => self.draft.name != saved.name || self.draft.body != saved.body,
            None => !self.draft.name.trim().is_empty() || !self.draft.body.trim().is_empty(),
        }
    }

    /// Whether the unsaved-changes dialog is open.
    pub fn has_pending_discard(&self) -> bool {
        self.pending.is_some()
    }

    /// Word count of the draft.
    pub fn word_count(&self) -> usize {
        richtext::word_count(&self.draft.body)
    }

    /// Character count of the draft.
    pub fn character_count(&self) -> usize {
        self.draft.body.chars().count()
    }

    /// Unknown words of the draft, most frequent first.
    pub fn spell_issues(&self) -> Vec<SpellIssue> {
        spell::issues(&self.draft.body, &self.spell_ignored)
    }

    /// Loads the personal dictionary of the spell check from the settings.
    pub fn load_personal_dictionary(&mut self, store: &Store) -> CoreResult<()> {
        self.spell_ignored = match store.get_setting(PERSONAL_DICTIONARY_KEY)? {
            Some(value) => serde_json::from_value(value).unwrap_or_default(),
            None => Vec::new(),
        };
        Ok(())
    }

    /// Adds a word to the personal dictionary and stores it.
    pub fn ignore_word(&mut self, store: &Store, word: &str) -> CoreResult<()> {
        if !self
            .spell_ignored
            .iter()
            .any(|entry| entry.eq_ignore_ascii_case(word))
        {
            self.spell_ignored.push(word.to_string());
        }
        store.put_setting(
            PERSONAL_DICTIONARY_KEY,
            &serde_json::json!(self.spell_ignored),
        )
    }

    /// Empties the personal dictionary of the spell check.
    pub fn clear_personal_dictionary(&mut self, store: &Store) -> CoreResult<()> {
        self.spell_ignored.clear();
        store.remove_setting(PERSONAL_DICTIONARY_KEY)
    }

    /// Formats the current selection as bold.
    pub fn format_bold(&mut self) {
        let selection = self.selection;
        self.selection = richtext::wrap_selection(&mut self.draft.body, selection, "**");
    }

    /// Formats the current selection as italic.
    pub fn format_italic(&mut self) {
        let selection = self.selection;
        self.selection = richtext::wrap_selection(&mut self.draft.body, selection, "_");
    }

    /// Turns the selected lines into headings, or back.
    pub fn format_heading(&mut self) {
        let selection = self.selection;
        self.selection = richtext::toggle_line_prefix(&mut self.draft.body, selection, "# ");
    }

    /// Turns the selected lines into bullets, or back.
    pub fn format_list(&mut self) {
        let selection = self.selection;
        self.selection = richtext::toggle_line_prefix(&mut self.draft.body, selection, "- ");
    }

    /// Turns the selected lines into quotes, or back.
    pub fn format_quote(&mut self) {
        let selection = self.selection;
        self.selection = richtext::toggle_line_prefix(&mut self.draft.body, selection, "> ");
    }

    /// Asks to open a document, guarding unsaved changes.
    pub fn open_document(&mut self, store: &Store, id: Uuid) -> CoreResult<()> {
        if self.selected == Some(id) {
            return Ok(());
        }
        if self.is_dirty() {
            self.pending = Some(PendingAction::Select(id));
            return Ok(());
        }
        self.load(store, id)
    }

    /// Asks for a new document, guarding unsaved changes.
    pub fn request_new(&mut self) {
        if self.is_dirty() {
            self.pending = Some(PendingAction::New);
            return;
        }
        self.start_new();
    }

    /// Asks to leave the screen, guarding unsaved changes.
    pub fn request_back(&mut self) {
        if self.is_dirty() {
            self.pending = Some(PendingAction::Back);
            return;
        }
        self.back = true;
    }

    /// Discards the draft and executes the pending navigation.
    pub fn confirm_discard(&mut self, store: &Store) -> CoreResult<()> {
        let pending = self.pending.take();
        match pending {
            Some(PendingAction::Select(id)) => self.load(store, id),
            Some(PendingAction::New) => {
                self.start_new();
                Ok(())
            }
            Some(PendingAction::Back) => {
                if let Some(id) = self.selected {
                    self.load(store, id)?;
                } else {
                    self.start_new();
                }
                self.back = true;
                Ok(())
            }
            None => Ok(()),
        }
    }

    /// Keeps the draft and closes the unsaved-changes dialog.
    pub fn cancel_discard(&mut self) {
        self.pending = None;
    }

    /// Saves the draft through the core.
    pub fn save(&mut self, store: &Store, now: i64) -> CoreResult<()> {
        self.error = None;
        self.status = None;
        if self.draft.created_at == 0 {
            self.draft.created_at = now;
        }
        let document = self.draft.build(now);
        if self.selected.is_some() {
            store.update_document(&document)?;
        } else {
            store.insert_document(&document)?;
        }
        self.selected = Some(document.id);
        self.draft.id = Some(document.id);
        self.draft.name = document.name.clone();
        self.saved = Some(SavedDocument {
            name: document.name,
            body: document.body,
        });
        self.status = Some("editor_status_saved");
        self.reload = true;
        self.refresh(store)
    }

    /// Deletes the open document after confirmation.
    pub fn delete_selected(&mut self, store: &Store) -> CoreResult<()> {
        let Some(id) = self.selected else {
            self.error = Some("editor_error_missing");
            return Ok(());
        };
        store.delete_document(id)?;
        self.confirm_delete = false;
        self.reload = true;
        self.refresh(store)?;
        if let Some(next) = self.documents.first().map(|document| document.id) {
            self.load(store, next)?;
        } else {
            self.start_new();
        }
        self.status = Some("editor_status_deleted");
        Ok(())
    }

    fn load(&mut self, store: &Store, id: Uuid) -> CoreResult<()> {
        let document = store.get_document(id)?;
        self.selected = Some(document.id);
        self.draft = DocumentDraft::from_document(&document);
        self.saved = Some(SavedDocument {
            name: document.name,
            body: document.body,
        });
        self.error = None;
        self.status = None;
        Ok(())
    }

    fn start_new(&mut self) {
        self.selected = None;
        self.draft = DocumentDraft::default();
        self.saved = None;
        self.error = None;
        self.status = None;
        self.confirm_delete = false;
        self.pending = None;
    }
}

/// Translates a core validation or storage error into a catalogue key.
pub fn error_key(error: &CoreError) -> &'static str {
    match error {
        CoreError::NotFound(_) => "editor_error_missing",
        CoreError::Validation(code) => match code.as_str() {
            "document_name_required" => "editor_error_name",
            "document_name_too_long" => "editor_error_name_long",
            "document_body_required" => "editor_error_body",
            "document_body_too_long" => "editor_error_body_long",
            _ => "editor_error_storage",
        },
        CoreError::Database(_)
        | CoreError::Serialization(_)
        | CoreError::Io(_)
        | CoreError::Document(_) => "editor_error_storage",
    }
}

/// Seeds two deterministic documents for the gallery and golden snapshots.
pub fn seed_documents(store: &Store, texts: &UiTexts) -> CoreResult<()> {
    if store.document_count()? > 0 {
        return Ok(());
    }
    let mut notes = Document::new(
        texts.get("editor_sample_notes_name"),
        texts.get("editor_sample_notes_body"),
        SAMPLE_NOW_MS - 86_400_000,
    );
    notes.updated_at = SAMPLE_NOW_MS - 3_600_000;
    store.insert_document(&notes)?;

    let mut meeting = Document::new(
        texts.get("editor_sample_meeting_name"),
        texts.get("editor_sample_meeting_body"),
        SAMPLE_NOW_MS,
    );
    meeting.updated_at = SAMPLE_NOW_MS;
    store.insert_document(&meeting)?;
    Ok(())
}

#[derive(Default)]
struct Actions {
    save: bool,
    new: bool,
    delete: bool,
    select: Option<Uuid>,
    back: bool,
    ignore: Option<String>,
    reset_dictionary: bool,
}

/// Ribbon action applied to the current selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Formatting {
    Bold,
    Italic,
    Heading,
    List,
    Quote,
}

fn apply_formatting(state: &mut EditorState, formatting: Formatting) {
    match formatting {
        Formatting::Bold => state.format_bold(),
        Formatting::Italic => state.format_italic(),
        Formatting::Heading => state.format_heading(),
        Formatting::List => state.format_list(),
        Formatting::Quote => state.format_quote(),
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &EditorState) {
    if let Some(key) = state.error {
        ui.label(
            RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.danger),
        );
    }
    if let Some(key) = state.status {
        ui.label(
            RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.success),
        );
    }
}

fn header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    actions: &mut Actions,
) {
    let status = state
        .is_dirty()
        .then(|| (texts.get("editor_unsaved"), Tone::Warning));
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("editor"),
            title: texts.get("editor_title"),
            subtitle: texts.get("editor_subtitle"),
            status,
        },
        &mut actions.back,
    );
}

fn document_list(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    actions: &mut Actions,
) {
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(texts.get("editor_documents")).strong());
            badge(ui, theme, &state.documents.len().to_string(), Tone::Neutral);
        });
        ui.add_space(6.0);
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("editor_search"),
            150.0,
        );
        ui.add_space(4.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("editor_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            actions.new = true;
        }
    });
    ui.add_space(8.0);
    if state.documents.is_empty() {
        card(ui, theme, |ui| {
            if state.query.trim().is_empty() {
                empty_state(
                    ui,
                    theme,
                    texts.get("editor_empty_title"),
                    texts.get("editor_empty_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("editor_no_results"),
                    texts.get("editor_no_results_hint"),
                );
            }
        });
        return;
    }

    card(ui, theme, |ui| {
        egui::ScrollArea::vertical()
            .id_source("editor-document-list")
            .max_height(760.0)
            .show(ui, |ui| {
                for document in &state.documents {
                    let open = state.selected == Some(document.id);
                    if button(
                        ui,
                        theme,
                        focus,
                        &document.name,
                        if open {
                            ButtonVariant::Primary
                        } else {
                            ButtonVariant::Ghost
                        },
                    )
                    .activated
                    {
                        actions.select = Some(document.id);
                    }
                    ui.label(
                        RichText::new(format!(
                            "{} {}",
                            richtext::word_count(&document.body),
                            texts.get("editor_words")
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                    ui.add_space(5.0);
                }
            });
    });
}

fn document_editor(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    actions: &mut Actions,
) {
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(if state.selected.is_some() {
                    texts.get("editor_open_document")
                } else {
                    texts.get("editor_new_document")
                })
                .strong(),
            );
            badge(
                ui,
                theme,
                texts.get(if state.selected.is_some() {
                    "editor_saved_badge"
                } else {
                    "editor_draft_badge"
                }),
                if state.selected.is_some() {
                    Tone::Success
                } else {
                    Tone::Neutral
                },
            );
        });
        ui.add_space(7.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.name,
            texts.get("editor_name"),
            texts.get("editor_name_hint"),
            None,
        );
    });
    ui.add_space(8.0);
    let formatting = ribbon(ui, theme, texts, focus, state);
    ui.add_space(8.0);
    body_editor(ui, theme, texts, focus, state, formatting);
    ui.add_space(8.0);
    if state.spell && !state.preview {
        spell_panel(ui, theme, texts, focus, state, actions);
        ui.add_space(8.0);
    }
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("editor_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            actions.save = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("editor_new"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            actions.new = true;
        }
        ui.add_enabled_ui(state.selected.is_some(), |ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("editor_delete"),
                ButtonVariant::Danger,
            )
            .activated
            {
                actions.delete = true;
            }
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                RichText::new(format!(
                    "{} {} · {} {}",
                    state.word_count(),
                    texts.get("editor_words"),
                    state.character_count(),
                    texts.get("editor_characters")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
        });
    });
    ui.add_space(4.0);
    ui.label(
        RichText::new(texts.get("editor_format_hint"))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    ui.label(
        RichText::new(texts.get("editor_shortcut_hint"))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
}

/// Draws the formatting ribbon and returns the action the user picked.
fn ribbon(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
) -> Option<Formatting> {
    let mut action = None;
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            for (key, formatting) in [
                ("editor_bold", Formatting::Bold),
                ("editor_italic", Formatting::Italic),
                ("editor_heading", Formatting::Heading),
                ("editor_list", Formatting::List),
                ("editor_quote", Formatting::Quote),
            ] {
                if button(ui, theme, focus, texts.get(key), ButtonVariant::Ghost).activated {
                    action = Some(formatting);
                }
            }
            ui.separator();
            let preview = if state.preview {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get("editor_preview"), preview).activated {
                state.preview = !state.preview;
            }
            let spell = if state.spell {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get("editor_spell"), spell).activated {
                state.spell = !state.spell;
            }
        });
    });
    action
}

/// Draws either the markup editor with spell underlines or the formatted preview.
fn body_editor(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    formatting: Option<Formatting>,
) {
    let unknown = if state.spell && !state.preview {
        spell::unknown_ranges(&state.draft.body, &state.spell_ignored)
    } else {
        Vec::new()
    };
    card(ui, theme, |ui| {
        if state.preview {
            ui.label(
                RichText::new(texts.get("editor_preview_hint"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            ui.add_space(6.0);
            egui::ScrollArea::vertical()
                .id_source("editor-preview")
                .max_height(500.0)
                .show(ui, |ui| {
                    richtext::render(ui, theme, &state.draft.body);
                });
            return;
        }
        let mut layouter = |ui: &egui::Ui, text: &str, wrap_width: f32| {
            let mut job = egui::text::LayoutJob::default();
            job.wrap.max_width = wrap_width;
            let plain = egui::TextFormat {
                font_id: egui::FontId::proportional(crate::tokens::FONT_BODY),
                color: theme.palette.text,
                ..Default::default()
            };
            let mut marked = plain.clone();
            marked.underline = richtext::spell_underline(theme.palette.danger);
            let mut last = 0usize;
            for (start, end) in unknown.iter().copied() {
                if start < last || end > text.len() {
                    continue;
                }
                if start > last {
                    job.append(&text[last..start], 0.0, plain.clone());
                }
                job.append(&text[start..end], 0.0, marked.clone());
                last = end;
            }
            job.append(&text[last..], 0.0, plain);
            ui.fonts(|fonts| fonts.layout_job(job))
        };
        let output = egui::TextEdit::multiline(&mut state.draft.body)
            .hint_text(texts.get("editor_body_hint"))
            .desired_width(f32::INFINITY)
            .desired_rows(16)
            .text_color(theme.palette.text)
            .layouter(&mut layouter)
            .show(ui);
        focus.register(output.response.id);
        if output.response.clicked() {
            focus.set_focus(Some(output.response.id));
        }
        if let Some(range) = output.cursor_range {
            let range = range.as_sorted_char_range();
            state.selection = (range.start, range.end);
        }
        let shortcut = |key: egui::Key| {
            output.response.has_focus()
                && ui
                    .ctx()
                    .input(|input| input.modifiers.ctrl && input.key_pressed(key))
        };
        let shortcut_action = if shortcut(egui::Key::B) {
            Some(Formatting::Bold)
        } else if shortcut(egui::Key::I) {
            Some(Formatting::Italic)
        } else {
            None
        };
        if let Some(action) = shortcut_action.or(formatting) {
            apply_formatting(state, action);
            output.response.request_focus();
        }
    });
}

/// Lists the unknown words of the draft with an action to accept each one.
fn spell_panel(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    actions: &mut Actions,
) {
    let issues = state.spell_issues();
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(texts.get("editor_spell_title")).strong());
            badge(
                ui,
                theme,
                &issues.len().to_string(),
                if issues.is_empty() {
                    Tone::Success
                } else {
                    Tone::Warning
                },
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new(texts.get("editor_spell_language"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            });
        });
        ui.add_space(5.0);
        if issues.is_empty() {
            ui.label(
                RichText::new(texts.get("editor_spell_ok"))
                    .size(FONT_SMALL)
                    .color(theme.palette.success),
            );
        } else {
            egui::ScrollArea::vertical()
                .id_source("editor-spell-issues")
                .max_height(110.0)
                .show(ui, |ui| {
                    for issue in &issues {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(&issue.word)
                                    .size(FONT_SMALL)
                                    .color(theme.palette.danger),
                            );
                            ui.label(
                                RichText::new(format!("\u{00d7} {}", issue.count))
                                    .size(FONT_SMALL)
                                    .color(theme.palette.text_muted),
                            );
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("editor_spell_ignore"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                actions.ignore = Some(issue.word.clone());
                            }
                        });
                    }
                });
        }
        if !state.spell_ignored.is_empty()
            && button(
                ui,
                theme,
                focus,
                texts.get("editor_spell_reset"),
                ButtonVariant::Ghost,
            )
            .activated
        {
            actions.reset_dictionary = true;
        }
    });
}

/// Renders the text editor into the context.
pub fn editor(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut EditorState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete
        && !state.has_pending_discard()
        && ctx.input(|input| input.key_pressed(egui::Key::Escape))
    {
        state.request_back();
    }
    if state.refresh(store).is_err() {
        state.error = Some("editor_error_load");
    }

    let mut actions = Actions::default();
    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical()
                .id_source("editor-screen")
                .show(ui, |ui| {
                    header(ui, theme, texts, focus, state, &mut actions);
                    ui.add_space(8.0);
                    messages(ui, theme, texts, state);
                    ui.add_space(6.0);
                    ui.horizontal_top(|ui| {
                        ui.vertical(|ui| {
                            ui.set_width(310.0);
                            document_list(ui, theme, texts, focus, state, &mut actions);
                        });
                        ui.add_space(14.0);
                        ui.vertical(|ui| {
                            ui.set_min_width(ui.available_width());
                            document_editor(ui, theme, texts, focus, state, &mut actions);
                        });
                    });
                });
        });

    if actions.save || ctx.input(|input| input.modifiers.ctrl && input.key_pressed(egui::Key::S)) {
        if let Err(error) = state.save(store, now) {
            state.error = Some(error_key(&error));
        }
    }
    if actions.new {
        state.request_new();
    }
    if let Some(id) = actions.select {
        if let Err(error) = state.open_document(store, id) {
            state.error = Some(error_key(&error));
        }
    }
    if let Some(word) = actions.ignore.take() {
        if let Err(error) = state.ignore_word(store, &word) {
            state.error = Some(error_key(&error));
        }
    }
    if actions.reset_dictionary {
        match state.clear_personal_dictionary(store) {
            Ok(()) => state.status = Some("editor_spell_reset_done"),
            Err(error) => state.error = Some(error_key(&error)),
        }
    }
    if actions.delete {
        state.confirm_delete = true;
    }
    if actions.back {
        state.request_back();
    }

    let mut discard_open = state.has_pending_discard();
    if discard_open {
        let focus = &mut *focus;
        let mut discard = false;
        modal(
            ctx,
            theme,
            &mut discard_open,
            texts.get("editor_discard_title"),
            |ui| {
                ui.label(texts.get("editor_discard_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("editor_discard_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        discard = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("editor_discard_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        close = true;
                    }
                });
                close
            },
        );
        if discard {
            if let Err(error) = state.confirm_discard(store) {
                state.error = Some(error_key(&error));
            }
        } else if !discard_open {
            state.cancel_discard();
        }
    }

    let mut delete_open = state.confirm_delete;
    if delete_open {
        let focus = &mut *focus;
        let mut delete = false;
        modal(
            ctx,
            theme,
            &mut delete_open,
            texts.get("editor_delete_title"),
            |ui| {
                ui.label(texts.get("editor_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("editor_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        delete = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("editor_delete_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        close = true;
                    }
                });
                close
            },
        );
        state.confirm_delete = delete_open;
        if delete {
            if let Err(error) = state.delete_selected(store) {
                state.error = Some(match error {
                    CoreError::NotFound(_) => "editor_error_missing",
                    _ => "editor_error_delete",
                });
            }
            state.confirm_delete = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    fn texts() -> UiTexts {
        UiTexts::embedded(Language::De).expect("catalogue")
    }

    fn state(store: &Store) -> EditorState {
        let mut state = EditorState::new();
        state.reset_for_open(store).expect("open");
        state
    }

    fn state_for(store: &Store) -> EditorState {
        state(store)
    }

    #[test]
    fn seeds_and_loads_documents_from_the_core() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let state = state(&store);
        assert_eq!(state.documents.len(), 2);
        assert!(state.selected.is_some());
        assert!(!state.is_dirty());
        assert!(state.word_count() > 0);
        assert_eq!(store.document_count().expect("count"), 2);
    }

    #[test]
    fn edits_and_saves_through_the_core() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let mut state = state(&store);
        let id = state.selected.expect("selected");
        state.draft.body.push_str("\nNeue Zeile");
        assert!(state.is_dirty());
        state.save(&store, 5_000).expect("save");
        assert!(!state.is_dirty());
        assert_eq!(state.status, Some("editor_status_saved"));
        let stored = store.get_document(id).expect("stored");
        assert!(stored.body.contains("Neue Zeile"));
        assert_eq!(stored.updated_at, 5_000);
    }

    #[test]
    fn creates_and_deletes_documents() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let mut state = state(&store);
        state.request_new();
        assert!(state.selected.is_none());
        assert!(!state.is_dirty());
        state.draft.name = "Neues Dokument".to_string();
        state.draft.body = "Inhalt".to_string();
        assert!(state.is_dirty());
        state.save(&store, 6_000).expect("save");
        assert!(state.selected.is_some());
        assert_eq!(store.document_count().expect("count"), 3);

        state.delete_selected(&store).expect("delete");
        assert_eq!(store.document_count().expect("count"), 2);
        assert_eq!(state.status, Some("editor_status_deleted"));
        assert!(state.selected.is_some(), "the next document is selected");
    }

    #[test]
    fn guards_unsaved_changes_until_confirmed() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let mut state = state(&store);
        let first = state.selected.expect("selected");
        let second = state
            .documents
            .iter()
            .find(|document| document.id != first)
            .expect("second")
            .id;
        state.draft.body.push_str(" ungespeichert");
        state.open_document(&store, second).expect("request");
        assert_eq!(state.selected, Some(first));
        assert!(state.has_pending_discard());
        state.cancel_discard();
        assert_eq!(state.selected, Some(first));
        assert!(state.is_dirty());

        state.open_document(&store, second).expect("request");
        state.confirm_discard(&store).expect("discard");
        assert_eq!(state.selected, Some(second));
        assert!(!state.is_dirty());

        state.draft.body.push_str(" noch etwas");
        state.request_back();
        assert!(!state.back);
        assert!(state.has_pending_discard());
        state.confirm_discard(&store).expect("discard back");
        assert!(state.back);
    }

    #[test]
    fn maps_validation_missing_and_storage_errors() {
        let store = Store::open_in_memory().expect("store");
        let mut state = state(&store);
        state.draft.name = " ".to_string();
        state.draft.body = "Inhalt".to_string();
        let error = state.save(&store, 1).expect_err("name");
        assert_eq!(error_key(&error), "editor_error_name");
        state.draft.name = "Name".to_string();
        state.draft.body = "   ".to_string();
        let error = state.save(&store, 1).expect_err("body");
        assert_eq!(error_key(&error), "editor_error_body");

        state.draft.name = "Name".to_string();
        state.draft.body = "Inhalt".to_string();
        state.selected = Some(Uuid::new_v4());
        let error = state.save(&store, 1).expect_err("missing");
        assert_eq!(error_key(&error), "editor_error_missing");
        state.selected = None;
        assert_eq!(
            error_key(&CoreError::Io(std::io::Error::other("disk"))),
            "editor_error_storage"
        );
    }

    #[test]
    fn renders_the_editor_and_empty_search() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let mut state = state(&store);
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts = texts();
        for query in ["", "nicht vorhanden"] {
            state.query = query.to_string();
            let ctx = crate::theme::headless_context();
            let mut focus = FocusState::default();
            let mut output = None;
            for _ in 0..2 {
                let input = egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::Vec2::new(1180.0, 1500.0),
                    )),
                    time: Some(1.0),
                    ..Default::default()
                };
                output = Some(ctx.run(input, |ctx| {
                    editor(
                        ctx,
                        &theme,
                        &texts,
                        &mut focus,
                        &mut state,
                        &store,
                        SAMPLE_NOW_MS,
                    );
                }));
            }
            assert!(output.expect("frame").shapes.len() > 20);
        }
    }

    #[test]
    fn ribbon_applies_markup_to_the_selection() {
        let store = Store::open_in_memory().expect("store");
        let mut state = state(&store);
        state.draft.body = "Ein Wort".to_string();
        state.selection = (4, 8);
        state.format_bold();
        assert_eq!(state.draft.body, "Ein **Wort**");
        assert_eq!(state.selection, (6, 10));
        state.format_italic();
        assert_eq!(state.draft.body, "Ein **_Wort_**");

        state.draft.body = "Zeile".to_string();
        state.selection = (0, 0);
        state.format_heading();
        assert_eq!(state.draft.body, "# Zeile");
        state.format_heading();
        assert_eq!(state.draft.body, "Zeile");

        state.selection = (0, 5);
        state.format_list();
        assert_eq!(state.draft.body, "- Zeile");
        state.format_list();
        assert_eq!(state.draft.body, "Zeile");
        state.selection = (0, 5);
        state.format_quote();
        assert_eq!(state.draft.body, "> Zeile");
        state.format_quote();
        assert_eq!(state.draft.body, "Zeile");
    }

    #[test]
    fn checks_spelling_and_keeps_the_personal_dictionary() {
        let store = Store::open_in_memory().expect("store");
        let mut state = state(&store);
        state.draft.body = "Ein scohnes Beispiel mit Wort.".to_string();
        let issues = state.spell_issues();
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].word, "scohnes");
        state.ignore_word(&store, "scohnes").expect("ignore");
        assert!(state.spell_issues().is_empty());
        assert!(spell::unknown_ranges(&state.draft.body, &state.spell_ignored).is_empty());

        let mut reloaded = state_for(&store);
        assert_eq!(reloaded.spell_ignored, vec!["scohnes".to_string()]);
        reloaded.clear_personal_dictionary(&store).expect("clear");
        reloaded.draft.body = "Ein scohnes Beispiel.".to_string();
        assert_eq!(reloaded.spell_issues().len(), 1);
    }

    #[test]
    fn renders_the_preview_and_the_spell_panel() {
        let store = Store::open_in_memory().expect("store");
        seed_documents(&store, &texts()).expect("seed");
        let mut state = state(&store);
        let theme = Theme::new(crate::theme::Appearance::Dark, "indigo");
        let texts = texts();
        for preview in [false, true] {
            state.preview = preview;
            state.spell = true;
            let ctx = crate::theme::headless_context();
            let mut focus = FocusState::default();
            let mut shapes = 0;
            for _ in 0..2 {
                let input = egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::Vec2::new(1180.0, 1600.0),
                    )),
                    time: Some(1.0),
                    ..Default::default()
                };
                shapes = ctx
                    .run(input, |ctx| {
                        editor(
                            ctx,
                            &theme,
                            &texts,
                            &mut focus,
                            &mut state,
                            &store,
                            SAMPLE_NOW_MS,
                        );
                    })
                    .shapes
                    .len();
            }
            assert!(shapes > 20);
        }
    }
}
