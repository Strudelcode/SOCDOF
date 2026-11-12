//! Invoices module screen: the Phase 6 billing document.
//!
//! The screen works on the core store: list and search through [`Store::list_invoices`]/
//! [`Store::search_invoices`], writes through [`Store::insert_invoice`], [`Store::update_invoice`]
//! and [`Store::delete_invoice`], and moves the lifecycle through [`Store::set_invoice_status`].
//! Validation stays in the domain ([`socdof_core::domain::invoice::Invoice::validate`]); the screen
//! maps the returned snake_case codes to catalogue keys, so invalid input never reaches the
//! database.
//!
//! Views are list, detail and form. Every control registers in the shared [`FocusState`], every
//! visible string comes from the catalogue and all painting uses the design tokens.

use egui::{Context, RichText};
use socdof_core::date;
use socdof_core::document_layout;
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, table_cell, table_columns,
    ButtonVariant, Tone, TABLE_ROW_HEIGHT,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::invoice_actions::{self, InvoiceActions};
use crate::invoice_templates::{self, InvoiceTemplatesState};
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample invoices, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Length of one day in milliseconds.
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Payment term of a new invoice.
const DUE_DAYS: i64 = 14;

/// View currently shown by the invoices screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum InvoicesView {
    /// Searchable list of all invoices.
    #[default]
    List,
    /// Detail of the selected invoice with totals and status actions.
    Detail,
    /// Create or edit form with the positions.
    Form,
}

impl InvoicesView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            InvoicesView::List => "invoices_title",
            InvoicesView::Detail => "invoices_detail_title",
            InvoicesView::Form => "invoices_form_title",
        }
    }
}

/// Editable values of one invoice position.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceLineDraft {
    /// Description printed on the invoice.
    pub description: String,
    /// Quantity in whole units or decimals, as entered.
    pub quantity: String,
    /// Net unit price as entered.
    pub unit_price: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
}

impl Default for InvoiceLineDraft {
    fn default() -> Self {
        Self {
            description: String::new(),
            quantity: "1".to_string(),
            unit_price: String::new(),
            tax_rate: "19".to_string(),
        }
    }
}

impl InvoiceLineDraft {
    /// Fills the draft from a stored position.
    pub fn from_line(line: &InvoiceLine) -> Self {
        Self {
            description: line.description.clone(),
            quantity: milli_text(line.quantity_milli),
            unit_price: line.unit_price.to_decimal_string(),
            tax_rate: percent_text(line.tax_rate_bp),
        }
    }

    fn to_line(&self) -> Result<InvoiceLine, &'static str> {
        if self.description.trim().is_empty() {
            return Err("invoices_error_line_description");
        }
        let quantity_milli = parse_quantity(&self.quantity).ok_or("invoices_error_quantity")?;
        let unit_price = Money::parse(&self.unit_price).ok_or("invoices_error_price")?;
        if unit_price.cents() < 0 {
            return Err("invoices_error_price");
        }
        let tax_rate_bp = parse_percent_bp(&self.tax_rate).ok_or("invoices_error_tax")?;

        Ok(InvoiceLine {
            description: self.description.trim().to_string(),
            quantity_milli,
            unit_price,
            tax_rate_bp,
        })
    }
}

/// Editable values of one invoice.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceDraft {
    /// Human readable number, unique per company.
    pub number: String,
    /// Index into the loaded contacts.
    pub contact: usize,
    /// Optional note printed above the totals.
    pub note: String,
    /// Positions of the invoice.
    pub lines: Vec<InvoiceLineDraft>,
}

impl Default for InvoiceDraft {
    fn default() -> Self {
        Self {
            number: String::new(),
            contact: 0,
            note: String::new(),
            lines: vec![InvoiceLineDraft::default()],
        }
    }
}

impl InvoiceDraft {
    /// Fills the draft from a stored invoice.
    pub fn from_invoice(invoice: &Invoice, contacts: &[Contact]) -> Self {
        Self {
            number: invoice.number.clone(),
            contact: contacts
                .iter()
                .position(|contact| contact.id == invoice.contact_id)
                .unwrap_or(0),
            note: invoice.note.clone().unwrap_or_default(),
            lines: invoice
                .lines
                .iter()
                .map(InvoiceLineDraft::from_line)
                .collect(),
        }
    }

    /// Builds the invoice to store; `base` keeps id, dates, currency and status when editing.
    pub fn to_invoice(
        &self,
        base: Option<&Invoice>,
        contacts: &[Contact],
        now: i64,
    ) -> Result<Invoice, &'static str> {
        let contact = contacts.get(self.contact).ok_or("invoices_error_contact")?;
        if self.number.trim().is_empty() {
            return Err("invoices_error_number");
        }
        if self.lines.is_empty() {
            return Err("invoices_error_lines");
        }

        let mut lines = Vec::with_capacity(self.lines.len());
        for line in &self.lines {
            lines.push(line.to_line()?);
        }

        let mut invoice = match base {
            Some(invoice) => invoice.clone(),
            None => Invoice {
                id: Uuid::new_v4(),
                number: String::new(),
                contact_id: contact.id,
                status: InvoiceStatus::Draft,
                issued_at: now,
                due_at: now + DUE_DAYS * DAY_MS,
                currency_symbol: "€".to_string(),
                note: None,
                lines: Vec::new(),
            },
        };

        invoice.number = self.number.trim().to_string();
        invoice.contact_id = contact.id;
        invoice.note = non_empty(&self.note);
        invoice.lines = lines;

        Ok(invoice)
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

fn parse_quantity(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    let milli = (value * 1_000.0).round() as i64;
    (milli > 0).then_some(milli)
}

fn parse_percent_bp(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
        return None;
    }
    Some((value * 100.0).round() as i64)
}

fn milli_text(milli: i64) -> String {
    if milli % 1_000 == 0 {
        (milli / 1_000).to_string()
    } else {
        let mut text = format!("{:.3}", milli as f64 / 1_000.0);
        while text.ends_with('0') {
            text.pop();
        }
        text.replace('.', ",")
    }
}

fn percent_text(bp: i64) -> String {
    format!("{}", bp as f64 / 100.0)
}

fn format_date(ms: i64) -> String {
    let (year, month, day) = date::civil_from_millis(ms);
    format!("{day:02}.{month:02}.{year}")
}

fn money(symbol: &str, amount: Money) -> String {
    amount.format_localized(symbol)
}

fn contact_label(contact: &Contact) -> String {
    contact
        .name
        .clone()
        .or_else(|| contact.company_name.clone())
        .or_else(|| contact.email.clone())
        .or_else(|| contact.phone.clone())
        .unwrap_or_default()
}

fn contact_name(contacts: &[Contact], id: Uuid) -> String {
    contacts
        .iter()
        .find(|contact| contact.id == id)
        .map(contact_label)
        .unwrap_or_default()
}

fn status_key(status: InvoiceStatus) -> &'static str {
    match status {
        InvoiceStatus::Draft => "invoices_status_draft",
        InvoiceStatus::Sent => "invoices_status_sent",
        InvoiceStatus::Paid => "invoices_status_paid",
        InvoiceStatus::Overdue => "invoices_status_overdue",
        InvoiceStatus::Cancelled => "invoices_status_cancelled",
    }
}

fn status_tone(status: InvoiceStatus) -> Tone {
    match status {
        InvoiceStatus::Draft => Tone::Neutral,
        InvoiceStatus::Sent => Tone::Accent,
        InvoiceStatus::Paid => Tone::Success,
        InvoiceStatus::Overdue => Tone::Danger,
        InvoiceStatus::Cancelled => Tone::Warning,
    }
}

fn suggest_number(invoices: &[Invoice], now: i64) -> String {
    let (year, _, _) = date::civil_from_millis(now);
    let prefix = format!("{year}-");
    let highest = invoices
        .iter()
        .filter_map(|invoice| invoice.number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

fn draft_totals(draft: &InvoiceDraft) -> (Money, Money, Money) {
    let mut net = Money::ZERO;
    let mut tax = Money::ZERO;
    for line in &draft.lines {
        if let Ok(line) = line.to_line() {
            net = net + line.net();
            tax = tax + line.tax();
        }
    }
    (net, tax, net + tax)
}

/// State of the invoices screen.
#[derive(Debug, Clone, PartialEq)]
pub struct InvoicesState {
    /// Search text; empty lists every invoice.
    pub query: String,
    /// Invoices matching the last loaded query.
    pub invoices: Vec<Invoice>,
    /// Customers selectable in the form.
    pub contacts: Vec<Contact>,
    /// Customer labels by contact id, rebuilt on every refresh so the list needs no scan.
    pub contact_labels: std::collections::HashMap<Uuid, String>,
    /// Selected invoice, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: InvoicesView,
    /// Editable values of the form.
    pub draft: InvoiceDraft,
    /// Dropdown state of the customer select.
    pub contact_popup: PopupState,
    /// Dialogs of the detail view.
    pub actions: InvoiceActions,
    /// Print template manager.
    pub templates: InvoiceTemplatesState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    reload: bool,
}

impl Default for InvoicesState {
    fn default() -> Self {
        Self {
            query: String::new(),
            invoices: Vec::new(),
            contacts: Vec::new(),
            contact_labels: std::collections::HashMap::new(),
            selected: None,
            view: InvoicesView::List,
            draft: InvoiceDraft::default(),
            contact_popup: PopupState::default(),
            actions: InvoiceActions::default(),
            templates: InvoiceTemplatesState::new(),
            confirm_delete: false,
            error: None,
            status: None,
            back: false,
            loaded_query: String::new(),
            reload: true,
        }
    }
}

impl InvoicesState {
    /// Creates an empty screen; the first [`InvoicesState::refresh`] loads the list.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads the list when the query changed or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload && self.loaded_query == self.query {
            return Ok(());
        }

        self.invoices = if self.query.trim().is_empty() {
            store.list_invoices()?
        } else {
            store.search_invoices(&self.query)?
        };
        self.contacts = store.list_contacts()?;
        self.templates.ensure_loaded(store);
        self.contact_labels = self
            .contacts
            .iter()
            .map(|contact| (contact.id, contact_label(contact)))
            .collect();
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Selected invoice, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&Invoice> {
        self.selected
            .and_then(|id| self.invoices.iter().find(|invoice| invoice.id == id))
    }

    /// Opens the detail view of an invoice.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = InvoicesView::Detail;
    }

    /// Opens an empty form with the next number and the first customer.
    pub fn start_new(&mut self, now: i64) {
        self.selected = None;
        self.draft = InvoiceDraft {
            number: suggest_number(&self.invoices, now),
            contact: 0,
            note: String::new(),
            lines: vec![InvoiceLineDraft::default()],
        };
        self.error = None;
        self.status = None;
        self.view = InvoicesView::Form;
    }

    /// Opens the form with the selected invoice.
    pub fn start_edit(&mut self) {
        let Some(invoice) = self.current() else {
            return;
        };
        self.draft = InvoiceDraft::from_invoice(invoice, &self.contacts);
        self.error = None;
        self.status = None;
        self.view = InvoicesView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            InvoicesView::Detail
        } else {
            InvoicesView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`InvoicesState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let invoice = match self.draft.to_invoice(base.as_ref(), &self.contacts, now) {
            Ok(invoice) => invoice,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(());
            }
        };

        if let Err(code) = invoice.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_invoice(&invoice)?;
        } else {
            store.insert_invoice(&invoice)?;
        }

        self.selected = Some(invoice.id);
        self.view = InvoicesView::Detail;
        self.error = None;
        self.status = Some("invoices_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected invoice after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_invoice(id)?;
        self.selected = None;
        self.view = InvoicesView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("invoices_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Moves the selected invoice to the given lifecycle state.
    pub fn set_status(
        &mut self,
        store: &Store,
        status: InvoiceStatus,
    ) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.set_invoice_status(id, status)?;
        self.error = None;
        self.status = Some("invoices_status_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "number_required" => "invoices_error_number",
        "lines_required" => "invoices_error_lines",
        "line_description_required" => "invoices_error_line_description",
        "line_quantity_invalid" => "invoices_error_quantity",
        "line_price_negative" => "invoices_error_price",
        "line_tax_rate_out_of_range" => "invoices_error_tax",
        _ => "invoices_error_save",
    }
}

fn sample_line(
    description: String,
    quantity_milli: i64,
    unit_price_cents: i64,
    tax_rate_bp: i64,
) -> InvoiceLine {
    InvoiceLine {
        description,
        quantity_milli,
        unit_price: Money::from_cents(unit_price_cents),
        tax_rate_bp,
    }
}

fn sample_invoice(
    contact_id: Uuid,
    number: &str,
    status: InvoiceStatus,
    issued_at: i64,
    lines: Vec<InvoiceLine>,
    note: Option<String>,
) -> Invoice {
    Invoice {
        id: Uuid::new_v4(),
        number: number.to_string(),
        contact_id,
        status,
        issued_at,
        due_at: issued_at + DUE_DAYS * DAY_MS,
        currency_symbol: "€".to_string(),
        note,
        lines,
    }
}

/// Seeds three deterministic invoices for the gallery and the golden snapshots.
///
/// The sample attaches to the first stored contact and is a no-op when the store already has
/// invoices, so it never overwrites data.
pub fn seed_invoices(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.invoice_count()? > 0 {
        return Ok(());
    }

    let contact = match store.list_contacts()?.into_iter().next() {
        Some(contact) => contact,
        None => {
            let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
            contact.name = Some(texts.get("invoices_sample_contact").to_string());
            contact.company_name = contact.name.clone();
            store.insert_contact(&contact)?;
            contact
        }
    };

    let service = texts.get("invoices_sample_line_service").to_string();
    let material = texts.get("invoices_sample_line_material").to_string();

    store.insert_invoice(&sample_invoice(
        contact.id,
        "2026-0001",
        InvoiceStatus::Sent,
        SAMPLE_NOW_MS - 5 * DAY_MS,
        vec![
            sample_line(service.clone(), 2_500, 8_000, 1900),
            sample_line(material.clone(), 1_000, 1_250, 700),
        ],
        Some(texts.get("invoices_sample_note").to_string()),
    ))?;

    store.insert_invoice(&sample_invoice(
        contact.id,
        "2026-0002",
        InvoiceStatus::Paid,
        SAMPLE_NOW_MS - 20 * DAY_MS,
        vec![sample_line(service, 1_000, 12_000, 1900)],
        None,
    ))?;

    store.insert_invoice(&sample_invoice(
        contact.id,
        "2026-0003",
        InvoiceStatus::Draft,
        SAMPLE_NOW_MS - DAY_MS,
        vec![sample_line(material, 3_000, 450, 1900)],
        None,
    ))?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoicesState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("invoices"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &InvoicesState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the invoices screen into the context.
pub fn invoices(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoicesState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete
        && !state.templates.open
        && ctx.input(|input| input.key_pressed(egui::Key::Escape))
    {
        match state.view {
            InvoicesView::List => state.back = true,
            InvoicesView::Detail => state.view = InvoicesView::List,
            InvoicesView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("invoices_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                InvoicesView::List => list_view(ui, theme, texts, focus, state, store, now),
                InvoicesView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
                InvoicesView::Form => form_view(ui, theme, texts, focus, state, store, now),
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
            texts.get("invoices_delete_title"),
            |ui| {
                ui.label(texts.get("invoices_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("invoices_delete_confirm"),
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
                        texts.get("invoices_delete_cancel"),
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

    if confirm && state.delete_selected(store).is_err() {
        state.error = Some("invoices_error_delete");
    }

    if let Some(invoice) = state.current().cloned() {
        let company = store.company_profile().unwrap_or_default();
        let customer = state
            .contact_labels
            .get(&invoice.contact_id)
            .cloned()
            .unwrap_or_default();
        let contact = store.find_contact(invoice.contact_id).ok().flatten();
        let template = state
            .templates
            .active()
            .cloned()
            .unwrap_or_else(socdof_core::invoice_template::default_template);
        let layout = document_layout::load(store).unwrap_or_default();
        let changed = invoice_actions::dialogs(
            ctx,
            theme,
            texts,
            focus,
            &mut state.actions,
            &invoice_actions::DialogData {
                invoice: &invoice,
                customer: &customer,
                contact: contact.as_ref(),
                company: &company,
                store,
                now,
                template: &template,
                layout: &layout,
            },
        );
        if let Some(status) = changed {
            if state.set_status(store, status).is_err() {
                state.error = Some("invoices_error_status");
            }
        }
    }

    let preview_invoice = state
        .current()
        .cloned()
        .or_else(|| state.invoices.first().cloned());
    let preview_contact = preview_invoice
        .as_ref()
        .and_then(|invoice| store.find_contact(invoice.contact_id).ok().flatten());
    let preview_company = store.company_profile().unwrap_or_default();
    let preview_currency = preview_invoice
        .as_ref()
        .map(|invoice| invoice.currency_symbol.as_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(preview_company.currency.as_str());
    invoice_templates::templates_modal(
        ctx,
        theme,
        texts,
        focus,
        &mut state.templates,
        store,
        invoice_templates::TemplatePreview {
            invoice: preview_invoice.as_ref(),
            contact: preview_contact.as_ref(),
            company: &preview_company,
            currency: preview_currency,
        },
    );
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoicesState,
    store: &Store,
    now: i64,
) {
    let subtitle = format!(
        "{} · {}",
        state.invoices.len(),
        texts.get("invoices_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("invoices_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    let mut templates = false;
    ui.horizontal(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("invoices_search"),
            310.0,
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_templates_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            templates = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });
    if templates {
        state.templates.open(store);
    }
    if create {
        state.start_new(now);
        return;
    }

    ui.add_space(12.0);
    if state.invoices.is_empty() {
        let searching = !state.query.trim().is_empty();
        card(ui, theme, |ui| {
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("invoices_no_results"),
                    texts.get("invoices_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("invoices_empty_title"),
                    texts.get("invoices_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        let gap = 16.0;
        let widths = table_columns(ui.available_width(), &[0.18, 0.28, 0.16, 0.20, 0.18], gap);
        ui.spacing_mut().item_spacing.x = gap;
        ui.horizontal(|ui| {
            for (key, width) in [
                "invoices_col_number",
                "invoices_col_contact",
                "invoices_col_date",
                "invoices_col_total",
                "invoices_col_status",
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

        // Virtualised like the contact list: 100k invoices must not be laid out per frame.
        egui::ScrollArea::vertical()
            .id_source("socdof-invoices-rows")
            .max_height(ui.available_height().clamp(TABLE_ROW_HEIGHT, 720.0))
            .show_rows(ui, TABLE_ROW_HEIGHT, state.invoices.len(), |ui, range| {
                ui.spacing_mut().item_spacing.x = gap;
                for invoice in &state.invoices[range] {
                    let customer = state
                        .contact_labels
                        .get(&invoice.contact_id)
                        .cloned()
                        .unwrap_or_default();
                    ui.horizontal(|ui| {
                        table_cell(ui, widths[0], |ui| {
                            if button(ui, theme, focus, &invoice.number, ButtonVariant::Ghost)
                                .activated
                            {
                                chosen = Some(invoice.id);
                            }
                        });
                        table_cell(ui, widths[1], |ui| {
                            ui.label(customer);
                        });
                        table_cell(ui, widths[2], |ui| {
                            ui.label(format_date(invoice.issued_at));
                        });
                        table_cell(ui, widths[3], |ui| {
                            ui.label(money(&invoice.currency_symbol, invoice.total_gross()));
                        });
                        table_cell(ui, widths[4], |ui| {
                            badge(
                                ui,
                                theme,
                                texts.get(status_key(invoice.status)),
                                status_tone(invoice.status),
                            );
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
    state: &mut InvoicesState,
    store: &Store,
    now: i64,
) {
    let Some(invoice) = state.current().cloned() else {
        state.view = InvoicesView::List;
        return;
    };

    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("invoices_detail_title"),
        &invoice.number,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&invoice.number).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(status_key(invoice.status)),
                status_tone(invoice.status),
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            (
                "invoices_col_contact",
                contact_name(&state.contacts, invoice.contact_id),
            ),
            ("invoices_issued", format_date(invoice.issued_at)),
            ("invoices_due", format_date(invoice.due_at)),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(value);
            });
        }
        if let Some(note) = &invoice.note {
            ui.add_space(6.0);
            ui.label(RichText::new(note).size(FONT_SMALL));
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("invoices_lines_title")).strong());
        ui.add_space(6.0);
        egui::Grid::new("socdof-invoice-lines")
            .num_columns(6)
            .spacing(egui::vec2(14.0, 6.0))
            .show(ui, |ui| {
                for key in [
                    "invoices_line_description",
                    "invoices_line_quantity",
                    "invoices_line_price",
                    "invoices_total_net",
                    "invoices_total_tax",
                    "invoices_total_gross",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for line in &invoice.lines {
                    ui.label(&line.description);
                    ui.label(milli_text(line.quantity_milli));
                    ui.label(money(&invoice.currency_symbol, line.unit_price));
                    ui.label(money(&invoice.currency_symbol, line.net()));
                    ui.label(money(&invoice.currency_symbol, line.tax()));
                    ui.label(money(&invoice.currency_symbol, line.gross()));
                    ui.end_row();
                }
            });
        ui.add_space(8.0);
        for (label, amount) in [
            ("invoices_total_net", invoice.total_net()),
            ("invoices_total_tax", invoice.total_tax()),
            ("invoices_total_gross", invoice.total_gross()),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money(&invoice.currency_symbol, amount)).strong());
            });
        }
    });

    ui.add_space(12.0);
    let mut mark = None;
    let mut edit = false;
    let mut delete = false;
    let mut dunning = false;
    let mut mail = false;
    let mut payment = false;
    let mut print = false;
    let mut templates = false;
    ui.horizontal(|ui| {
        if invoice.status != InvoiceStatus::Sent && invoice.status != InvoiceStatus::Cancelled {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("invoices_mark_sent"),
                ButtonVariant::Secondary,
            )
            .activated;
            if activated {
                mark = Some(InvoiceStatus::Sent);
            }
        }
        if invoice.status != InvoiceStatus::Paid && invoice.status != InvoiceStatus::Cancelled {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("invoices_mark_paid"),
                ButtonVariant::Primary,
            )
            .activated;
            if activated {
                mark = Some(InvoiceStatus::Paid);
            }
        }
        if invoice.status == InvoiceStatus::Cancelled {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("invoices_reopen"),
                ButtonVariant::Secondary,
            )
            .activated;
            if activated {
                mark = Some(InvoiceStatus::Draft);
            }
        } else {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("invoices_cancel_invoice"),
                ButtonVariant::Danger,
            )
            .activated;
            if activated {
                mark = Some(InvoiceStatus::Cancelled);
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_dunning_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            dunning = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_mail_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            mail = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_payment_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            payment = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_print_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            print = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_templates_button"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            templates = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_edit"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            edit = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_delete"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            delete = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = InvoicesView::List;
        }
    });

    if let Some(status) = mark {
        if state.set_status(store, status).is_err() {
            state.error = Some("invoices_error_status");
        }
    }
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
    if templates {
        state.templates.open(store);
    }
    if print {
        state.actions.open_print(&invoice);
    }

    if dunning || mail || payment {
        let company = store.company_profile().unwrap_or_default();
        let customer = state
            .contact_labels
            .get(&invoice.contact_id)
            .cloned()
            .unwrap_or_default();
        let contact = store.find_contact(invoice.contact_id).ok().flatten();
        if dunning {
            state.actions.open_dunning(&invoice, now);
        }
        if mail {
            state
                .actions
                .open_email(&invoice, &customer, contact.as_ref(), &company);
        }
        if payment {
            state.actions.open_payment(now);
        }
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoicesState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("invoices_edit_title")
    } else {
        texts.get("invoices_new_title")
    };
    let subtitle = texts.get("invoices_subtitle").to_string();
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
            &mut state.draft.number,
            texts.get("invoices_number"),
            texts.get("invoices_number_hint"),
            None,
        );
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("invoices_contact"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let names: Vec<String> = state.contacts.iter().map(contact_label).collect();
            let labels: Vec<&str> = names.iter().map(String::as_str).collect();
            select(
                ui,
                theme,
                focus,
                &mut state.contact_popup,
                "invoice-contact",
                &mut state.draft.contact,
                &labels,
            );
        });
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.note,
            texts.get("invoices_note"),
            texts.get("invoices_note_hint"),
            None,
        );
    });

    ui.add_space(12.0);
    let mut add_line = false;
    let mut remove_line = None;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("invoices_lines_title")).strong());
        ui.add_space(6.0);
        if state.draft.lines.is_empty() {
            ui.label(
                RichText::new(texts.get("invoices_lines_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }
        for (index, line) in state.draft.lines.iter_mut().enumerate() {
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{} {}",
                    index + 1,
                    texts.get("invoices_line_description")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            text_field(
                ui,
                theme,
                focus,
                &mut line.description,
                texts.get("invoices_line_description"),
                texts.get("invoices_line_description_hint"),
                None,
            );
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.quantity,
                        texts.get("invoices_line_quantity"),
                        texts.get("invoices_line_quantity_hint"),
                        None,
                    );
                });
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.unit_price,
                        texts.get("invoices_line_price"),
                        texts.get("invoices_line_price_hint"),
                        None,
                    );
                });
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.tax_rate,
                        texts.get("invoices_line_tax"),
                        texts.get("invoices_line_tax_hint"),
                        None,
                    );
                });
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_line_remove"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    remove_line = Some(index);
                }
            });
        }
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_line_add"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            add_line = true;
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        let (net, tax, gross) = draft_totals(&state.draft);
        for (label, amount) in [
            ("invoices_total_net", net),
            ("invoices_total_tax", tax),
            ("invoices_total_gross", gross),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money("€", amount)).strong());
            });
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("invoices_save"),
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
                texts.get("invoices_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if add_line {
        state.draft.lines.push(InvoiceLineDraft::default());
    }
    if let Some(index) = remove_line {
        state.draft.lines.remove(index);
    }
    if save && state.save(store, now).is_err() {
        state.error = Some("invoices_error_save");
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

    fn contact(store: &Store, name: &str) -> Contact {
        let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
        contact.name = Some(name.to_string());
        contact.company_name = contact.name.clone();
        store.insert_contact(&contact).expect("contact");
        contact
    }

    fn seeded() -> (Store, InvoicesState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        contact(&store, "Muster GmbH");
        seed_invoices(&store, &texts).expect("seed");
        let mut state = InvoicesState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut InvoicesState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1000.0, 2400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                invoices(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("invoice frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_an_invoice() {
        let store = Store::open_in_memory().expect("store");
        contact(&store, "Muster GmbH");
        let mut state = InvoicesState::new();
        state.refresh(&store).expect("refresh");
        state.start_new(SAMPLE_NOW_MS);
        assert_eq!(state.draft.number, "2026-0001");

        state.draft.lines[0].description = "Beratung".to_string();
        state.draft.lines[0].quantity = "2".to_string();
        state.draft.lines[0].unit_price = "50".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, InvoicesView::Detail);
        let stored = store.list_invoices().expect("list")[0].clone();
        assert_eq!(stored.total_net(), Money::from_cents(10_000));
        assert_eq!(stored.total_gross(), Money::from_cents(11_900));

        state.start_edit();
        state.draft.lines[0].quantity = "3".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        assert_eq!(
            store
                .find_invoice(stored.id)
                .expect("find")
                .unwrap()
                .total_net(),
            Money::from_cents(15_000)
        );

        state.delete_selected(&store).expect("delete");
        assert_eq!(store.invoice_count().expect("count"), 0);
        assert_eq!(state.view, InvoicesView::List);
    }

    #[test]
    fn moves_the_invoice_through_its_status() {
        let (store, mut state, _texts) = seeded();
        let id = state.invoices[0].id;
        state.select(id);
        state
            .set_status(&store, InvoiceStatus::Paid)
            .expect("status");
        assert_eq!(
            store.find_invoice(id).expect("find").unwrap().status,
            InvoiceStatus::Paid
        );
        assert_eq!(state.status, Some("invoices_status_saved"));

        state
            .set_status(&store, InvoiceStatus::Cancelled)
            .expect("status");
        assert_eq!(
            store.find_invoice(id).expect("find").unwrap().status,
            InvoiceStatus::Cancelled
        );
    }

    #[test]
    fn rejects_invalid_positions_and_contacts() {
        let store = Store::open_in_memory().expect("store");
        let mut state = InvoicesState::new();
        state.refresh(&store).expect("refresh");
        state.start_new(SAMPLE_NOW_MS);
        state.draft.lines[0].description = "Beratung".to_string();
        state.draft.lines[0].unit_price = "50".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("invoices_error_contact"));

        contact(&store, "Muster GmbH");
        state.reload = true;
        state.refresh(&store).expect("reload contacts");
        state.draft.lines[0].quantity = "0".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("invoices_error_quantity"));

        state.draft.lines[0].quantity = "1".to_string();
        state.draft.lines[0].description.clear();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("invoices_error_line_description"));
    }

    #[test]
    fn searches_invoices_through_the_store() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.invoices.len(), 3);

        state.query = "0002".to_string();
        state.refresh(&store).expect("search");

        assert_eq!(state.invoices.len(), 1);
        assert_eq!(state.invoices[0].number, "2026-0002");
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("invoices_title")));
        assert!(painted.contains("2026-0001"));
        assert!(painted.contains(texts.get("invoices_status_sent")));
        assert!(painted.contains(texts.get("invoices_new")));

        let id = state.invoices[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("invoices_lines_title")));
        assert!(painted.contains(texts.get("invoices_total_gross")));
        assert!(painted.contains(texts.get("invoices_mark_paid")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("invoices_save")));
        assert!(painted.contains(texts.get("invoices_line_add")));
    }

    #[test]
    fn seeding_is_idempotent_and_uses_the_store() {
        let (store, _state, texts) = seeded();
        seed_invoices(&store, &texts).expect("second seed");
        assert_eq!(store.invoice_count().expect("count"), 3);
        let statuses: Vec<InvoiceStatus> = store
            .list_invoices()
            .expect("list")
            .iter()
            .map(|invoice| invoice.status)
            .collect();
        assert!(statuses.contains(&InvoiceStatus::Sent));
        assert!(statuses.contains(&InvoiceStatus::Paid));
        assert!(statuses.contains(&InvoiceStatus::Draft));
    }
}
