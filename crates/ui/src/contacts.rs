//! Contacts module screen: the Phase 6 address book.
//!
//! The screen works on the core store directly: it lists and searches through
//! [`Store::list_contacts`]/[`Store::search_contacts`] and writes through [`Store::insert_contact`],
//! [`Store::update_contact`] and [`Store::delete_contact`]. Validation stays in the domain
//! ([`socdof_core::domain::contact::Contact::validate`]); the screen only maps the returned
//! snake_case code to a catalogue key, so invalid input never reaches the database.
//!
//! Views are list, detail and form. Every control registers in the shared [`FocusState`], every
//! visible string comes from the catalogue and all painting uses the design tokens.

use egui::{Context, RichText};
#[cfg(feature = "dialogs")]
use socdof_core::contact_import_export::{
    export_contacts_csv, export_contacts_vcard, parse_contacts_csv, parse_contacts_vcard,
};
use socdof_core::domain::contact::{Contact, ContactKind, ContactPerson, ContactType};
use socdof_core::domain::countries::{search_countries, Country};
use socdof_core::domain::settings::Language;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, table_cell, table_columns,
    ButtonVariant, Tone, TABLE_ROW_HEIGHT,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample contacts, shared with the dashboard fixture.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Country a new contact starts with, the same default the legacy modal's form uses.
pub const DEFAULT_COUNTRY: &str = "Deutschland";

/// Catalogue keys of the four CRM categories, in [`ContactType`] order.
const TYPE_KEYS: [&str; 4] = [
    "contacts_type_customer",
    "contacts_type_vendor",
    "contacts_type_both",
    "contacts_type_guest",
];

/// View currently shown by the contacts screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ContactsView {
    /// Searchable list of all contacts.
    #[default]
    List,
    /// Read-only detail of the selected contact.
    Detail,
    /// Create or edit form.
    Form,
}

impl ContactsView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            ContactsView::List => "contacts_title",
            ContactsView::Detail => "contacts_detail_title",
            ContactsView::Form => "contacts_form_title",
        }
    }
}

/// Editable values of one contact.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ContactDraft {
    /// Display name.
    pub name: String,
    /// Company name; filled in only for companies.
    pub company: String,
    /// Email address.
    pub email: String,
    /// Phone number.
    pub phone: String,
    /// Street and house number.
    pub street: String,
    /// Postal code.
    pub zip: String,
    /// City.
    pub city: String,
    /// Country; free text, with suggestions from [`COUNTRIES`](socdof_core::domain::countries::COUNTRIES).
    pub country: String,
    /// VAT number or tax id.
    pub tax_id: String,
    /// Internal notes.
    pub notes: String,
    /// Index into [`TYPE_KEYS`].
    pub contact_type: usize,
    /// Contact persons of a company ("sub-contacts" in the legacy UI).
    pub persons: Vec<ContactPerson>,
}

impl ContactDraft {
    /// Fills the draft from a stored contact.
    pub fn from_contact(contact: &Contact) -> Self {
        Self {
            name: contact
                .name
                .clone()
                .or_else(|| contact.company_name.clone())
                .unwrap_or_default(),
            company: contact.company_name.clone().unwrap_or_default(),
            email: contact.email.clone().unwrap_or_default(),
            phone: contact.phone.clone().unwrap_or_default(),
            street: contact.street.clone().unwrap_or_default(),
            zip: contact.zip.clone().unwrap_or_default(),
            city: contact.city.clone().unwrap_or_default(),
            country: contact.country.clone().unwrap_or_default(),
            tax_id: contact.tax_id.clone().unwrap_or_default(),
            notes: contact.notes.clone().unwrap_or_default(),
            contact_type: type_index(contact.contact_type),
            persons: contact.contact_persons.clone(),
        }
    }

    /// Builds the contact to store; `base` keeps id, kind details and creation time when editing.
    pub fn to_contact(&self, base: Option<&Contact>, now: i64) -> Contact {
        let company = non_empty(&self.company);
        let kind = if company.is_some() {
            ContactKind::Company
        } else {
            ContactKind::Person
        };
        let mut contact = match base {
            Some(contact) => contact.clone(),
            None => Contact::new(kind, now),
        };

        contact.kind = kind;
        contact.contact_type = type_from_index(self.contact_type);
        contact.name = non_empty(&self.name);
        contact.company_name = company;
        contact.email = non_empty(&self.email);
        contact.phone = non_empty(&self.phone);
        contact.street = non_empty(&self.street);
        contact.zip = non_empty(&self.zip);
        contact.city = non_empty(&self.city);
        contact.country = non_empty(&self.country);
        contact.tax_id = non_empty(&self.tax_id);
        contact.notes = non_empty(&self.notes);
        contact.contact_persons = self.persons.clone();
        // The legacy save path drops persons without a name, email or phone and keeps one primary.
        contact.sanitize_contact_persons();
        contact.updated_at = now;
        contact
    }
}

/// State of the contacts screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ContactsState {
    /// Search text; empty lists every contact.
    pub query: String,
    /// Contacts matching the last loaded query.
    pub contacts: Vec<Contact>,
    /// Selected contact, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: ContactsView,
    /// Editable values of the form.
    pub draft: ContactDraft,
    /// Dropdown state of the category select.
    pub type_popup: PopupState,
    /// Whether the country suggestion list is open.
    pub country_open: bool,
    /// Highlighted row of the country suggestion list.
    pub country_active: usize,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Whether the multi-contact creation dialog is open.
    pub batch_open: bool,
    /// Rows in the batch creation dialog.
    pub batch_drafts: Vec<ContactDraft>,
    /// Whether the contact import preview is open.
    pub import_open: bool,
    /// Parsed contacts awaiting confirmation.
    pub import_preview: Vec<Contact>,
    /// Selected category for imported contacts.
    pub import_target_type: usize,
    /// Original filename shown in the preview.
    pub import_file_name: String,
    /// Whether exports should use the currently filtered view instead of every contact.
    pub export_filtered: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    reload: bool,
    legacy_sanitized: bool,
}

impl ContactsState {
    /// Creates an empty screen; the first [`ContactsState::refresh`] loads the list.
    pub fn new() -> Self {
        Self {
            reload: true,
            ..Self::default()
        }
    }

    /// Reloads the list when the query changed or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.legacy_sanitized {
            store.sanitize_legacy_contact_emails()?;
            self.legacy_sanitized = true;
            self.reload = true;
        }
        if !self.reload && self.loaded_query == self.query {
            return Ok(());
        }

        self.contacts = if self.query.trim().is_empty() {
            store.list_contacts()?
        } else {
            store.search_contacts(&self.query)?
        };
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Selected contact, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&Contact> {
        self.selected
            .and_then(|id| self.contacts.iter().find(|contact| contact.id == id))
    }

    /// Opens the detail view of a contact.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = ContactsView::Detail;
    }

    /// Opens an empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = ContactDraft::default();
        self.draft.country = DEFAULT_COUNTRY.to_string();
        self.country_open = false;
        self.country_active = 0;
        self.error = None;
        self.status = None;
        self.view = ContactsView::Form;
    }

    /// Opens the legacy-style multi-contact creation dialog with three editable rows.
    pub fn start_batch(&mut self) {
        self.batch_drafts = vec![ContactDraft::default(); 3];
        for draft in &mut self.batch_drafts {
            draft.country = DEFAULT_COUNTRY.to_string();
        }
        self.batch_open = true;
        self.error = None;
        self.status = None;
    }

    /// Validates and inserts every non-empty batch row atomically.
    pub fn save_batch(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let contacts: Vec<Contact> = self
            .batch_drafts
            .iter()
            .filter(|draft| !draft.name.trim().is_empty() || !draft.company.trim().is_empty())
            .enumerate()
            .map(|(index, draft)| draft.to_contact(None, now + index as i64))
            .collect();
        if contacts.is_empty() {
            self.error = Some("contacts_error_name");
            return Ok(());
        }
        for contact in &contacts {
            if let Err(code) = contact.validate() {
                self.error = Some(validation_key(&code));
                return Ok(());
            }
        }
        store.insert_contacts(&contacts)?;
        self.batch_open = false;
        self.batch_drafts.clear();
        self.error = None;
        self.status = Some("contacts_imported");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Opens the form with the selected contact.
    pub fn start_edit(&mut self) {
        let Some(contact) = self.current() else {
            return;
        };
        self.draft = ContactDraft::from_contact(contact);
        self.country_open = false;
        self.country_active = 0;
        self.error = None;
        self.status = None;
        self.view = ContactsView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.country_open = false;
        self.country_active = 0;
        self.error = None;
        self.view = if self.selected.is_some() {
            ContactsView::Detail
        } else {
            ContactsView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`ContactsState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let contact = self.draft.to_contact(base.as_ref(), now);

        if let Err(code) = contact.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_contact(&contact)?;
        } else {
            store.insert_contact(&contact)?;
        }

        self.selected = Some(contact.id);
        self.view = ContactsView::Detail;
        self.country_open = false;
        self.country_active = 0;
        self.error = None;
        self.status = Some("contacts_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected contact after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_contact(id)?;
        self.selected = None;
        self.view = ContactsView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("contacts_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn type_index(contact_type: ContactType) -> usize {
    match contact_type {
        ContactType::Customer => 0,
        ContactType::Vendor => 1,
        ContactType::Both => 2,
        ContactType::Guest => 3,
    }
}

fn type_from_index(index: usize) -> ContactType {
    match index {
        1 => ContactType::Vendor,
        2 => ContactType::Both,
        3 => ContactType::Guest,
        _ => ContactType::Customer,
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "email_invalid" => "error_invalid_email",
        _ => "contacts_error_name",
    }
}

/// Seeds three deterministic contacts for the gallery and the golden snapshots.
///
/// The function is a no-op when the store already has contacts, so it never overwrites data.
pub fn seed_sample(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.contact_count()? > 0 {
        return Ok(());
    }

    let mut company = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
    company.name = Some(texts.get("contacts_sample_company").to_string());
    company.company_name = company.name.clone();
    company.email = Some("info@muster.example".to_string());
    company.phone = Some("+39 0471 000 001".to_string());
    company.city = Some("Bozen".to_string());
    store.insert_contact(&company)?;

    let mut person = Contact::new(ContactKind::Person, SAMPLE_NOW_MS);
    person.name = Some(texts.get("contacts_sample_person").to_string());
    person.email = Some("yuri@strudel.example".to_string());
    person.phone = Some("+39 0471 000 002".to_string());
    person.city = Some("Meran".to_string());
    person.contact_type = ContactType::Customer;
    store.insert_contact(&person)?;

    let mut vendor = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
    vendor.name = Some(texts.get("contacts_sample_company_two").to_string());
    vendor.company_name = vendor.name.clone();
    vendor.email = Some("orders@nordlicht.example".to_string());
    vendor.city = Some("Innsbruck".to_string());
    vendor.contact_type = ContactType::Vendor;
    store.insert_contact(&vendor)?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ContactsState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("contacts"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &ContactsState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the contacts screen into the context.
pub fn contacts(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ContactsState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            ContactsView::List => state.back = true,
            ContactsView::Detail => state.view = ContactsView::List,
            ContactsView::Form if state.country_open => state.country_open = false,
            ContactsView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("contacts_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                ContactsView::List => list_view(ui, theme, texts, focus, state, store, now),
                ContactsView::Detail => detail_view(ui, theme, texts, focus, state),
                ContactsView::Form => form_view(ui, theme, texts, focus, state, store, now),
            });
        });

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("contacts_delete_title"),
            |ui| {
                ui.label(texts.get("contacts_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("contacts_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("contacts_delete_cancel"),
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
    }
    state.confirm_delete = open;

    let mut batch_open = state.batch_open;
    let mut save_batch = false;
    let mut cancel_batch = false;
    egui::Window::new(texts.get("contacts_batch_title"))
        .open(&mut batch_open)
        .collapsible(false)
        .resizable(true)
        .default_width(720.0)
        .show(ctx, |ui| {
            ui.label(texts.get("contacts_batch_hint"));
            ui.add_space(8.0);
            for (index, draft) in state.batch_drafts.iter_mut().enumerate() {
                ui.group(|ui| {
                    ui.label(format!("{} {}", texts.get("contacts_batch_row"), index + 1));
                    egui::Grid::new(("contacts-batch", index))
                        .num_columns(2)
                        .show(ui, |ui| {
                            ui.label(texts.get("contacts_name"));
                            ui.text_edit_singleline(&mut draft.name);
                            ui.end_row();
                            ui.label(texts.get("contacts_company"));
                            ui.text_edit_singleline(&mut draft.company);
                            ui.end_row();
                            ui.label(texts.get("contacts_email"));
                            ui.text_edit_singleline(&mut draft.email);
                            ui.end_row();
                            ui.label(texts.get("contacts_phone"));
                            ui.text_edit_singleline(&mut draft.phone);
                            ui.end_row();
                            ui.label(texts.get("contacts_type"));
                            egui::ComboBox::from_id_source(("contacts-batch-type", index))
                                .selected_text(texts.get(TYPE_KEYS[draft.contact_type.min(3)]))
                                .show_ui(ui, |ui| {
                                    for (value, key) in TYPE_KEYS.iter().enumerate() {
                                        ui.selectable_value(
                                            &mut draft.contact_type,
                                            value,
                                            texts.get(key),
                                        );
                                    }
                                });
                            ui.end_row();
                        });
                });
                ui.add_space(6.0);
            }
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_batch_add_row"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    state.batch_drafts.push(ContactDraft {
                        country: DEFAULT_COUNTRY.to_string(),
                        ..ContactDraft::default()
                    });
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_save"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    save_batch = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_cancel"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    cancel_batch = true;
                }
            });
        });
    state.batch_open = batch_open && !cancel_batch;
    if save_batch {
        if state.save_batch(store, now).is_err() {
            state.error = Some("contacts_error_save");
        }
    }
    if cancel_batch {
        state.batch_open = false;
    }

    let mut import_open = state.import_open;
    let mut confirm_import = false;
    let mut cancel_import = false;
    egui::Window::new(texts.get("contacts_import_preview_title"))
        .open(&mut import_open)
        .collapsible(false)
        .resizable(true)
        .default_width(640.0)
        .show(ctx, |ui| {
            ui.label(format!(
                "{} · {}",
                state.import_file_name,
                state.import_preview.len()
            ));
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                ui.label(texts.get("contacts_import_category"));
                egui::ComboBox::from_id_source("contacts-import-type")
                    .selected_text(texts.get(TYPE_KEYS[state.import_target_type.min(3)]))
                    .show_ui(ui, |ui| {
                        for (value, key) in TYPE_KEYS.iter().enumerate() {
                            if ui
                                .selectable_value(
                                    &mut state.import_target_type,
                                    value,
                                    texts.get(key),
                                )
                                .changed()
                            {
                                for contact in &mut state.import_preview {
                                    contact.contact_type = type_from_index(value);
                                }
                            }
                        }
                    });
            });
            ui.separator();
            let mut remove = Vec::new();
            egui::ScrollArea::vertical()
                .max_height(360.0)
                .show(ui, |ui| {
                    for (index, contact) in state.import_preview.iter().enumerate() {
                        ui.horizontal(|ui| {
                            ui.label(contact.display_name());
                            ui.label(contact.email.as_deref().unwrap_or(""));
                            ui.label(contact.phone.as_deref().unwrap_or(""));
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("contacts_import_remove"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                remove.push(index);
                            }
                        });
                    }
                });
            for index in remove.into_iter().rev() {
                state.import_preview.remove(index);
            }
            ui.separator();
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_import_confirm"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    confirm_import = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_cancel"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    cancel_import = true;
                }
            });
        });
    state.import_open = import_open && !cancel_import;
    if confirm_import {
        if state.import_preview.is_empty() {
            state.error = Some("contacts_import_empty");
        } else if store.insert_contacts(&state.import_preview).is_ok() {
            state.import_preview.clear();
            state.import_open = false;
            state.reload = true;
            state.status = Some("contacts_imported");
            state.error = None;
            let _ = state.refresh(store);
        } else {
            state.error = Some("contacts_error_save");
            state.status = None;
        }
    }
    if cancel_import {
        state.import_preview.clear();
        state.import_open = false;
    }

    if confirm && state.delete_selected(store).is_err() {
        state.error = Some("contacts_error_delete");
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ContactsState,
    store: &Store,
    now: i64,
) {
    let _ = (store, now);
    let subtitle = format!(
        "{} · {}",
        state.contacts.len(),
        texts.get("contacts_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("contacts_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    let mut batch = false;
    let mut import = false;
    let mut export_csv = false;
    let mut export_vcard = false;
    ui.horizontal_wrapped(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("contacts_search"),
            150.0,
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_batch"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            batch = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_import"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            import = true;
        }
        egui::ComboBox::from_id_source("contacts-export-scope")
            .selected_text(if state.export_filtered {
                texts.get("contacts_export_filtered")
            } else {
                texts.get("contacts_export_all")
            })
            .show_ui(ui, |ui| {
                ui.selectable_value(
                    &mut state.export_filtered,
                    false,
                    texts.get("contacts_export_all"),
                );
                ui.selectable_value(
                    &mut state.export_filtered,
                    true,
                    texts.get("contacts_export_filtered"),
                );
            });
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_export_csv"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            export_csv = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_export_vcard"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            export_vcard = true;
        }
    });
    if create {
        state.start_new();
        return;
    }
    if batch {
        state.start_batch();
    }

    // Native file pickers are enabled by the desktop host. The headless gallery remains portable.
    if import {
        #[cfg(feature = "dialogs")]
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("Contacts", &["csv", "vcf", "vcard"])
            .pick_file()
        {
            match std::fs::read_to_string(&path) {
                Ok(contents) => {
                    let is_vcard = path.extension().and_then(|v| v.to_str()).is_some_and(|v| {
                        v.eq_ignore_ascii_case("vcf") || v.eq_ignore_ascii_case("vcard")
                    });
                    let parsed = if is_vcard {
                        parse_contacts_vcard(&contents, ContactType::Guest, now)
                    } else {
                        parse_contacts_csv(&contents, ContactType::Guest, now)
                    };
                    if parsed.is_empty() {
                        state.error = Some("contacts_import_empty");
                        state.status = None;
                    } else {
                        state.import_preview = parsed;
                        state.import_file_name = path
                            .file_name()
                            .and_then(|v| v.to_str())
                            .unwrap_or("")
                            .to_string();
                        state.import_target_type = 3;
                        state.import_open = true;
                        state.error = None;
                        state.status = None;
                    }
                }
                Err(_) => {
                    state.error = Some("contacts_error_load");
                    state.status = None;
                }
            }
        }
        #[cfg(not(feature = "dialogs"))]
        {
            state.error = Some("contacts_error_picker");
        }
    }

    if export_csv || export_vcard {
        #[cfg(feature = "dialogs")]
        {
            let contacts_to_export = if state.export_filtered {
                state.contacts.clone()
            } else {
                match store.list_contacts() {
                    Ok(contacts) => contacts,
                    Err(_) => {
                        state.error = Some("contacts_error_load");
                        Vec::new()
                    }
                }
            };
            if contacts_to_export.is_empty() {
                state.error = Some("contacts_import_empty");
                state.status = None;
            } else {
                let (extension, filter) = if export_csv {
                    ("csv", "CSV")
                } else {
                    ("vcf", "vCard")
                };
                let (year, month, day) = socdof_core::date::civil_from_millis(now);
                let filename = format!("kontakte_export_{year:04}-{month:02}-{day:02}.{extension}");
                if let Some(path) = rfd::FileDialog::new()
                    .set_file_name(&filename)
                    .add_filter(filter, &[extension])
                    .save_file()
                {
                    let content = if export_csv {
                        export_contacts_csv(&contacts_to_export, ';')
                    } else {
                        export_contacts_vcard(&contacts_to_export)
                    };
                    if std::fs::write(path, content).is_ok() {
                        state.status = Some("contacts_exported");
                        state.error = None;
                    } else {
                        state.error = Some("contacts_error_save");
                        state.status = None;
                    }
                }
            }
        }
        #[cfg(not(feature = "dialogs"))]
        {
            state.error = Some("contacts_error_picker");
        }
    }

    ui.add_space(12.0);
    if state.contacts.is_empty() {
        let searching = !state.query.trim().is_empty();
        card(ui, theme, |ui| {
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("contacts_no_results"),
                    texts.get("contacts_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("contacts_empty_title"),
                    texts.get("contacts_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        let gap = 16.0;
        let widths = table_columns(ui.available_width(), &[0.32, 0.26, 0.26, 0.16], gap);
        ui.spacing_mut().item_spacing.x = gap;
        ui.horizontal(|ui| {
            for (key, width) in [
                "contacts_col_name",
                "contacts_col_company",
                "contacts_col_email",
                "contacts_col_city",
            ]
            .into_iter()
            .zip(&widths)
            {
                table_cell(ui, *width, |ui| {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                });
            }
        });

        // Only the rows inside the viewport are laid out; a full grid of 50k contacts would cost
        // a frame per scroll step.
        egui::ScrollArea::vertical()
            .id_source("socdof-contacts-rows")
            .max_height(ui.available_height().clamp(TABLE_ROW_HEIGHT, 720.0))
            .show_rows(ui, TABLE_ROW_HEIGHT, state.contacts.len(), |ui, range| {
                ui.spacing_mut().item_spacing.x = gap;
                for contact in &state.contacts[range] {
                    ui.horizontal(|ui| {
                        table_cell(ui, widths[0], |ui| {
                            if button(
                                ui,
                                theme,
                                focus,
                                &contact.display_name(),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                chosen = Some(contact.id);
                            }
                        });
                        table_cell(ui, widths[1], |ui| {
                            ui.label(contact.company_name.as_deref().unwrap_or(""));
                        });
                        table_cell(ui, widths[2], |ui| {
                            ui.label(contact.email.as_deref().unwrap_or(""));
                        });
                        table_cell(ui, widths[3], |ui| {
                            ui.label(contact.city.as_deref().unwrap_or(""));
                        });
                    });
                }
            });
    });
    if let Some(id) = chosen {
        state.select(id);
    }
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ContactsState,
) {
    let Some(contact) = state.current().cloned() else {
        state.view = ContactsView::List;
        return;
    };

    let subtitle = contact.display_name();
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("contacts_detail_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(contact.display_name())
                    .size(FONT_TITLE)
                    .strong(),
            );
            badge(
                ui,
                theme,
                texts.get(TYPE_KEYS[type_index(contact.contact_type)]),
                Tone::Accent,
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            ("contacts_col_company", contact.company_name.as_deref()),
            ("contacts_email", contact.email.as_deref()),
            ("contacts_phone", contact.phone.as_deref()),
            ("contacts_street", contact.street.as_deref()),
            ("contacts_zip", contact.zip.as_deref()),
            ("contacts_col_city", contact.city.as_deref()),
            ("contacts_country", contact.country.as_deref()),
            ("contacts_tax_id", contact.tax_id.as_deref()),
            ("contacts_notes", contact.notes.as_deref()),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(value.unwrap_or(""));
            });
        }
    });

    if !contact.contact_persons.is_empty() {
        ui.add_space(12.0);
        card(ui, theme, |ui| {
            ui.label(
                RichText::new(texts.get("contacts_persons_title"))
                    .size(FONT_SMALL)
                    .strong()
                    .color(theme.palette.text_muted),
            );
            for person in &contact.contact_persons {
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new(person.full_name()).strong());
                    if person.is_primary {
                        badge(
                            ui,
                            theme,
                            texts.get("contacts_person_primary"),
                            Tone::Accent,
                        );
                    }
                    if !person.role.is_empty() {
                        ui.label(
                            RichText::new(person.role.clone())
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                    if !person.email.is_empty() {
                        ui.label(person.email.clone());
                    }
                    if !person.phone.is_empty() {
                        ui.label(person.phone.clone());
                    }
                });
            }
        });
    }

    ui.add_space(12.0);
    let mut edit = false;
    let mut delete = false;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_edit"),
            ButtonVariant::Primary,
        )
        .activated
        {
            edit = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_delete"),
            ButtonVariant::Danger,
        )
        .activated
        {
            delete = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = ContactsView::List;
        }
    });
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
}

/// Writes the localized name of a suggestion into the draft, as selecting it in the legacy modal
/// does, and closes the list.
fn apply_country_suggestion(
    state: &mut ContactsState,
    country: &'static Country,
    language: Language,
) {
    state.draft.country = country.localized_name(language).to_string();
    state.country_open = false;
}

/// Keyboard control of the open country list, like the legacy modal: the arrows move the
/// highlight and Enter takes it. Escape is handled by the screen, which closes the list first.
fn country_keys(ctx: &egui::Context, state: &mut ContactsState, texts: &UiTexts) {
    let language = texts.language();
    let matches = search_countries(&state.draft.country, language);
    if matches.is_empty() {
        return;
    }

    let (down, up, enter) = ctx.input(|input| {
        (
            input.key_pressed(egui::Key::ArrowDown),
            input.key_pressed(egui::Key::ArrowUp),
            input.key_pressed(egui::Key::Enter),
        )
    });
    if down {
        state.country_active = (state.country_active + 1) % matches.len();
    }
    if up {
        state.country_active = if state.country_active == 0 {
            matches.len() - 1
        } else {
            state.country_active - 1
        };
    }
    if enter {
        let index = state.country_active.min(matches.len() - 1);
        apply_country_suggestion(state, matches[index], language);
    }
}

/// Suggestion list under the country field: flag, localized name, prefix hits first.
fn country_suggestions(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &mut ContactsState,
) {
    let language = texts.language();
    let matches = search_countries(&state.draft.country, language);
    if matches.is_empty() {
        return;
    }

    ui.add_space(4.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("contacts_country_suggestions"))
                .size(FONT_SMALL)
                .strong()
                .color(theme.palette.text_muted),
        );
        let active = state.country_active.min(matches.len() - 1);
        let mut chosen = None;
        for (index, country) in matches.iter().enumerate() {
            let label = format!("{} {}", country.flag, country.localized_name(language));
            if ui
                .selectable_label(index == active, RichText::new(label).size(FONT_SMALL))
                .clicked()
            {
                chosen = Some(*country);
            }
        }
        if let Some(country) = chosen {
            apply_country_suggestion(state, country, language);
        }
    });
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ContactsState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("contacts_edit_title")
    } else {
        texts.get("contacts_new_title")
    };
    let subtitle = texts.get("contacts_subtitle").to_string();
    screen_header(ui, theme, texts, focus, state, title, &subtitle);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut save = false;
    let mut cancel = false;
    card(ui, theme, |ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.name,
            texts.get("contacts_name"),
            texts.get("contacts_name_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.company,
            texts.get("contacts_company"),
            texts.get("contacts_company_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.email,
            texts.get("contacts_email"),
            texts.get("contacts_email_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.phone,
            texts.get("contacts_phone"),
            texts.get("contacts_phone_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.street,
            texts.get("contacts_street"),
            texts.get("contacts_street_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.zip,
            texts.get("contacts_zip"),
            texts.get("contacts_zip_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.city,
            texts.get("contacts_city"),
            texts.get("contacts_city_hint"),
            None,
        );
        ui.add_space(6.0);
        // Country is free text with the legacy suggestion list, not a closed select.
        let country = text_field(
            ui,
            theme,
            focus,
            &mut state.draft.country,
            texts.get("contacts_country"),
            texts.get("contacts_country_hint"),
            None,
        );
        if country.response.changed() || country.response.clicked() {
            state.country_open = true;
            state.country_active = 0;
        }
        if state.country_open {
            country_keys(ui.ctx(), state, texts);
        }
        if state.country_open {
            country_suggestions(ui, theme, texts, state);
        }
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.tax_id,
            texts.get("contacts_tax_id"),
            texts.get("contacts_tax_id_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.notes,
            texts.get("contacts_notes"),
            texts.get("contacts_notes_hint"),
            None,
        );
        ui.add_space(6.0);
        ui.label(
            RichText::new(texts.get("contacts_type"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        let labels: [&str; 4] = std::array::from_fn(|index| texts.get(TYPE_KEYS[index]));
        select(
            ui,
            theme,
            focus,
            &mut state.type_popup,
            "socdof-contact-type",
            &mut state.draft.contact_type,
            &labels,
        );

        // Contact persons ("sub-contacts") of a company, edited in place.
        ui.add_space(12.0);
        ui.label(
            RichText::new(texts.get("contacts_persons_title"))
                .size(FONT_SMALL)
                .strong()
                .color(theme.palette.text_muted),
        );
        if state.draft.persons.is_empty() {
            ui.label(
                RichText::new(texts.get("contacts_persons_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }
        let mut remove_person = None;
        let mut set_primary = None;
        for index in 0..state.draft.persons.len() {
            let person = &mut state.draft.persons[index];
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut person.first_name,
                    texts.get("contacts_person_first"),
                    "",
                    None,
                );
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut person.last_name,
                    texts.get("contacts_person_last"),
                    "",
                    None,
                );
            });
            ui.horizontal(|ui| {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut person.email,
                    texts.get("contacts_person_email"),
                    "",
                    None,
                );
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut person.phone,
                    texts.get("contacts_person_phone"),
                    "",
                    None,
                );
            });
            ui.horizontal(|ui| {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut person.role,
                    texts.get("contacts_person_role"),
                    "",
                    None,
                );
                if person.is_primary {
                    badge(
                        ui,
                        theme,
                        texts.get("contacts_person_primary"),
                        Tone::Accent,
                    );
                } else if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_person_primary"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    set_primary = Some(index);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("contacts_person_remove"),
                    ButtonVariant::Danger,
                )
                .activated
                {
                    remove_person = Some(index);
                }
            });
        }
        if let Some(index) = set_primary {
            for (position, person) in state.draft.persons.iter_mut().enumerate() {
                person.is_primary = position == index;
            }
        }
        if let Some(index) = remove_person {
            state.draft.persons.remove(index);
            let has_primary = state.draft.persons.iter().any(|person| person.is_primary);
            if !has_primary {
                if let Some(first) = state.draft.persons.first_mut() {
                    first.is_primary = true;
                }
            }
        }
        ui.add_space(6.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("contacts_person_add"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            let suffix = Uuid::new_v4().simple().to_string();
            let id = ContactPerson::draft_id(now, &suffix[..5]);
            let primary = state.draft.persons.is_empty();
            state.draft.persons.push(ContactPerson::draft(id, primary));
        }

        if let Some(key) = state.error {
            ui.add_space(6.0);
            ui.label(
                RichText::new(texts.get(key))
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("contacts_save"),
                ButtonVariant::Primary,
            )
            .activated
            {
                save = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("contacts_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("contacts_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::settings::Language;

    fn seeded() -> (Store, ContactsState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_sample(&store, &texts).expect("seed");
        let mut state = ContactsState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut ContactsState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        // Two frames: egui settles scroll areas and text layout on the second pass.
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(900.0, 1400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                contacts(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("contacts frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_a_contact() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ContactsState::new();
        state.refresh(&store).expect("refresh");
        assert!(state.contacts.is_empty());

        state.start_new();
        state.draft.name = "Muster GmbH".to_string();
        state.draft.company = "Muster GmbH".to_string();
        state.draft.email = "info@example.com".to_string();
        state.draft.city = "Bozen".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, ContactsView::Detail);
        assert_eq!(store.contact_count().expect("count"), 1);
        let id = store.list_contacts().expect("list")[0].id;
        assert_eq!(state.selected, Some(id));

        state.start_edit();
        state.draft.name = "Muster AG".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        let stored = store.find_contact(id).expect("find").expect("contact");
        assert_eq!(stored.name.as_deref(), Some("Muster AG"));
        assert_eq!(stored.updated_at, SAMPLE_NOW_MS + 1);

        state.delete_selected(&store).expect("delete");
        assert_eq!(store.contact_count().expect("count"), 0);
        assert_eq!(state.view, ContactsView::List);
        assert_eq!(state.selected, None);
    }

    #[test]
    fn batch_creation_inserts_only_named_rows_atomically() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ContactsState::new();
        state.start_batch();
        state.batch_drafts[0].name = "Ada Lovelace".to_string();
        state.batch_drafts[0].email = "ada@example.org".to_string();
        state.batch_drafts[1].company = "Analytical Engines".to_string();
        state.batch_drafts[1].contact_type = 1;
        state.batch_drafts[2].phone = "+441234567".to_string();

        state
            .save_batch(&store, SAMPLE_NOW_MS)
            .expect("batch insert");

        let contacts = store.list_contacts().expect("contacts");
        assert_eq!(
            contacts.len(),
            2,
            "a row without name or company is skipped"
        );
        assert_eq!(contacts[0].display_name(), "Ada Lovelace");
        assert_eq!(
            contacts[1].company_name.as_deref(),
            Some("Analytical Engines")
        );
        assert_eq!(contacts[1].contact_type, ContactType::Vendor);
        assert!(!state.batch_open);
        assert!(state.batch_drafts.is_empty());
    }

    #[test]
    fn refresh_removes_only_legacy_placeholder_emails() {
        let store = Store::open_in_memory().expect("store");
        let mut legacy = Contact::new(ContactKind::Person, 1);
        legacy.name = Some("Legacy contact".to_string());
        legacy.email = Some("old@import.local".to_string());
        store.insert_contact(&legacy).expect("legacy insert");
        let mut valid = Contact::new(ContactKind::Person, 2);
        valid.name = Some("Real contact".to_string());
        valid.email = Some("real@example.org".to_string());
        store.insert_contact(&valid).expect("valid insert");

        let mut state = ContactsState::new();
        state.refresh(&store).expect("refresh");

        let stored_legacy = store
            .find_contact(legacy.id)
            .expect("find")
            .expect("legacy");
        let stored_valid = store.find_contact(valid.id).expect("find").expect("valid");
        assert_eq!(stored_legacy.email, None);
        assert_eq!(stored_valid.email.as_deref(), Some("real@example.org"));
    }

    #[test]
    fn keeps_the_address_through_the_draft() {
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.company_name = Some("AlpenTech".to_string());
        contact.street = Some("Bahnhofstrasse 1".to_string());
        contact.zip = Some("8001".to_string());
        contact.city = Some("Zürich".to_string());
        contact.country = Some("Schweiz".to_string());

        let mut draft = ContactDraft::from_contact(&contact);
        assert_eq!(draft.country, "Schweiz");
        draft.street = " Bahnhofstrasse 2 ".to_string();
        draft.tax_id = "CHE-123.456".to_string();
        draft.notes = "Stammkunde".to_string();

        let saved = draft.to_contact(Some(&contact), 5);
        assert_eq!(saved.country.as_deref(), Some("Schweiz"));
        assert_eq!(saved.street.as_deref(), Some("Bahnhofstrasse 2"));
        assert_eq!(saved.tax_id.as_deref(), Some("CHE-123.456"));
        assert_eq!(saved.notes.as_deref(), Some("Stammkunde"));
    }

    #[test]
    fn new_contacts_start_with_the_legacy_default_country() {
        let mut state = ContactsState::new();
        state.start_new();
        assert_eq!(state.draft.country, DEFAULT_COUNTRY);
        assert!(!state.country_open);
    }

    #[test]
    fn country_suggestions_write_the_localized_name() {
        let mut state = ContactsState::new();
        state.start_new();
        state.draft.country = "schweiz".to_string();
        let found = search_countries(&state.draft.country, Language::En);
        assert_eq!(found[0].code, "CH");
        apply_country_suggestion(&mut state, found[0], Language::En);
        assert_eq!(state.draft.country, "Switzerland");
        assert!(!state.country_open);

        // A free-text country survives the save untouched, like the legacy input.
        state.draft.country = "Mittelreich".to_string();
        let saved = state.draft.to_contact(None, 1);
        assert_eq!(saved.country.as_deref(), Some("Mittelreich"));

        // Deleting the value persists no country at all.
        state.draft.country = "   ".to_string();
        let saved = state.draft.to_contact(None, 2);
        assert_eq!(saved.country, None);
    }

    fn press_key(state: &mut ContactsState, store: &Store, key: egui::Key) {
        let text = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let ctx = crate::theme::headless_context();
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(900.0, 1600.0),
            )),
            events: vec![egui::Event::Key {
                key,
                physical_key: None,
                pressed: true,
                repeat: false,
                modifiers: egui::Modifiers::default(),
            }],
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| {
            contacts(ctx, &theme, &text, &mut focus, state, store, SAMPLE_NOW_MS);
        });
    }

    #[test]
    fn country_list_follows_the_keyboard() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ContactsState::new();
        state.start_new();
        state.draft.country = "sch".to_string();
        state.country_open = true;

        let matches = search_countries("sch", Language::De);
        assert!(
            matches.len() > 1,
            "the test query matches several countries"
        );

        press_key(&mut state, &store, egui::Key::ArrowDown);
        assert_eq!(state.country_active, 1);
        assert!(state.country_open, "moving does not close the list");

        press_key(&mut state, &store, egui::Key::Enter);
        assert_eq!(
            state.draft.country,
            matches[1].localized_name(Language::De),
            "Enter takes the highlighted row"
        );
        assert!(!state.country_open);

        // Escape closes the list without touching the value.
        state.draft.country = "sch".to_string();
        state.country_open = true;
        state.country_active = 0;
        press_key(&mut state, &store, egui::Key::Escape);
        assert!(!state.country_open);
        assert_eq!(state.draft.country, "sch");
        assert_eq!(state.view, ContactsView::Form);

        // The arrow up from the first row wraps to the last one.
        state.country_open = true;
        state.country_active = 0;
        press_key(&mut state, &store, egui::Key::ArrowUp);
        assert_eq!(
            state.country_active,
            search_countries("sch", Language::De).len() - 1
        );
    }

    #[test]
    fn keeps_contact_persons_through_the_draft() {
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.company_name = Some("AlpenTech".to_string());
        let mut person = ContactPerson::draft(ContactPerson::draft_id(0, "a1"), true);
        person.first_name = "Anna".to_string();
        person.last_name = " Weber ".to_string();
        person.role = "Einkauf".to_string();
        contact.add_contact_person(person);

        let mut draft = ContactDraft::from_contact(&contact);
        assert_eq!(draft.persons.len(), 1);
        assert!(draft.persons[0].is_primary);
        draft
            .persons
            .push(ContactPerson::draft("cp_blank".to_string(), false));

        let saved = draft.to_contact(Some(&contact), 5);
        assert_eq!(
            saved.contact_persons.len(),
            1,
            "the blank person is dropped"
        );
        assert_eq!(saved.contact_persons[0].last_name, "Weber");
        assert!(saved.contact_persons[0].is_primary);
        assert_eq!(
            saved.contact_person_summary().as_deref(),
            Some("Anna Weber (Einkauf)")
        );
    }

    #[test]
    fn rejects_an_invalid_email_before_writing() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ContactsState::new();
        state.start_new();
        state.draft.name = "Muster GmbH".to_string();
        state.draft.email = "not-an-email".to_string();
        state
            .save(&store, SAMPLE_NOW_MS)
            .expect("validation returns ok");

        assert_eq!(state.error, Some("error_invalid_email"));
        assert_eq!(state.view, ContactsView::Form);
        assert_eq!(store.contact_count().expect("count"), 0);
    }

    #[test]
    fn search_filters_the_list_through_the_store() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.contacts.len(), 3);

        let target = state.contacts[0].display_name();
        state.query = target.clone();
        state.refresh(&store).expect("search");

        assert_eq!(state.contacts.len(), 1);
        assert_eq!(state.contacts[0].display_name(), target);
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("contacts_title")));
        assert!(painted.contains(texts.get("contacts_sample_company")));
        assert!(painted.contains(texts.get("contacts_new")));

        let id = state.contacts[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("contacts_edit")));
        assert!(painted.contains(texts.get("contacts_delete")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("contacts_save")));
        assert!(painted.contains(texts.get("contacts_type")));
        assert!(painted.contains(texts.get("contacts_country")));
    }

    #[test]
    fn seeding_is_idempotent() {
        let (store, _state, texts) = seeded();
        seed_sample(&store, &texts).expect("second seed");
        assert_eq!(store.contact_count().expect("count"), 3);
    }
}
