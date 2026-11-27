//! Support module screen: tickets, customer link, timesheets, invoice creation and Mobile Companion sync.
//!
//! The screen works on the core store directly: it lists tickets through
//! [`Store::list_support_tickets`]/[`Store::open_support_tickets`], writes through
//! [`Store::insert_support_ticket`], [`Store::update_support_ticket`] and
//! [`Store::set_support_ticket_status`], keeps tracked time in `time_entries`, imports Mobile
//! Companion payloads via [`socdof_core::mobile_sync`], and turns ticket hours into draft invoices.

#[cfg(not(target_arch = "wasm32"))]
use std::sync::{Arc, Mutex};

use egui::{Context, RichText, TextEdit};
use socdof_core::csv::write_csv;
use socdof_core::date::format_iso8601;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::support::{SupportTicket, TicketPriority, TicketStatus, TimeEntry};
use socdof_core::mobile_sync::{self, DEFAULT_HOURLY_RATE_CENTS};
use socdof_core::money::Money;
use socdof_core::pdf::writer::{mm, Document, PAGE_HEIGHT_MM};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample tickets, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::contacts::SAMPLE_NOW_MS;

/// Standard German VAT rate (19 %) for the draft invoices created from tracked ticket time.
/// `CompanyProfile` carries no configurable default rate, and the reference support module does
/// not expose one either.
const SUPPORT_INVOICE_TAX_RATE_BP: i64 = 1_900;

/// Milliseconds of one hour, used to place the sample tickets relative to [`SAMPLE_NOW_MS`].
const HOUR_MS: i64 = 60 * 60 * 1000;
const DAY_MS: i64 = 24 * HOUR_MS;

/// Catalogue keys of the four ticket states, in [`TicketStatus`] order.
const STATUS_KEYS: [&str; 4] = [
    "support_status_open",
    "support_status_in_progress",
    "support_status_waiting",
    "support_status_closed",
];

/// Catalogue keys of the four priorities, in [`TicketPriority`] order.
const PRIORITY_KEYS: [&str; 4] = [
    "support_priority_low",
    "support_priority_normal",
    "support_priority_high",
    "support_priority_urgent",
];

/// View currently shown by the support screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum SupportView {
    /// Searchable list of all tickets.
    #[default]
    List,
    /// Ticket detail with the tracked time.
    Detail,
    /// Create or edit form.
    Form,
}

impl SupportView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            SupportView::List => "support_title",
            SupportView::Detail => "support_detail_title",
            SupportView::Form => "support_form_title",
        }
    }
}

/// Editable values of one ticket.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TicketDraft {
    /// Linked customer contact, if assigned.
    pub contact_id: Option<Uuid>,
    /// Short summary.
    pub subject: String,
    /// Full description.
    pub description: String,
    /// Index into [`PRIORITY_KEYS`].
    pub priority: usize,
    /// Index into [`STATUS_KEYS`].
    pub status: usize,
}

impl TicketDraft {
    /// Fills the draft from a stored ticket.
    pub fn from_ticket(ticket: &SupportTicket) -> Self {
        Self {
            contact_id: ticket.contact_id,
            subject: ticket.subject.clone(),
            description: ticket.description.clone(),
            priority: priority_index(ticket.priority),
            status: status_index(ticket.status),
        }
    }

    /// Builds the ticket to store; `base` keeps the id and creation time when editing.
    pub fn to_ticket(&self, base: Option<&SupportTicket>, now: i64) -> SupportTicket {
        let status = status_from_index(self.status);
        let mut ticket = match base {
            Some(ticket) => ticket.clone(),
            None => SupportTicket {
                id: Uuid::new_v4(),
                contact_id: None,
                subject: String::new(),
                description: String::new(),
                status: TicketStatus::Open,
                priority: TicketPriority::Normal,
                created_at: now,
                updated_at: now,
                closed_at: None,
            },
        };

        ticket.contact_id = self.contact_id;
        ticket.subject = self.subject.trim().to_string();
        ticket.description = self.description.trim().to_string();
        ticket.priority = priority_from_index(self.priority);
        ticket.status = status;
        ticket.updated_at = now;
        ticket.closed_at = if status == TicketStatus::Closed {
            ticket.closed_at.or(Some(now))
        } else {
            None
        };
        ticket
    }
}

/// Summary extracted from a validated Mobile Companion payload for UI preview.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MobilePreviewSummary {
    /// Number of tickets in the payload.
    pub tickets: usize,
    /// Number of field sessions in the payload.
    pub sessions: usize,
    /// Number of standalone timesheets in the payload.
    pub timesheets: usize,
    /// Number of travel trips in the payload.
    pub trips: usize,
    /// Number of expenses in the payload.
    pub expenses: usize,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Default)]
struct GatewayInner {
    running: Option<mobile_sync::Running>,
    inbox: Vec<serde_json::Value>,
    error: Option<String>,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone, Default)]
struct MobileGatewayHandle {
    inner: Arc<Mutex<GatewayInner>>,
}

#[cfg(not(target_arch = "wasm32"))]
impl std::fmt::Debug for MobileGatewayHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MobileGatewayHandle").finish()
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl PartialEq for MobileGatewayHandle {
    fn eq(&self, _other: &Self) -> bool {
        true
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Eq for MobileGatewayHandle {}

/// State of the support screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SupportState {
    /// Search text; empty lists every ticket.
    pub query: String,
    /// Whether closed tickets are hidden.
    pub only_open: bool,
    /// Optional explicit status filter chip (`None` keeps all or `only_open`).
    pub status_filter: Option<TicketStatus>,
    /// Tickets matching the last loaded query.
    pub tickets: Vec<SupportTicket>,
    /// Loaded contacts for customer linking.
    pub contacts: Vec<Contact>,
    /// Selected ticket, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: SupportView,
    /// Editable values of the form.
    pub draft: TicketDraft,
    /// Dropdown state of the contact select.
    pub contact_popup: PopupState,
    /// Dropdown state of the priority select.
    pub priority_popup: PopupState,
    /// Dropdown state of the status select.
    pub status_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Whether the timesheet overview modal is open.
    pub timesheet_open: bool,
    /// All loaded time entries shown inside the timesheet overview modal.
    pub all_time_entries: Vec<TimeEntry>,
    /// Whether the Mobile Companion import modal is open.
    pub mobile_open: bool,
    /// Raw JSON pasted into the Mobile Companion import box.
    pub mobile_json: String,
    /// Parsed summary of the JSON currently staged in `mobile_json`.
    pub mobile_preview: Option<MobilePreviewSummary>,
    /// Result feedback rendered inside the Mobile Companion modal.
    pub mobile_notice: Option<String>,
    /// Error feedback rendered inside the Mobile Companion modal.
    pub mobile_error: Option<&'static str>,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    /// Time entries of the selected ticket.
    pub entries: Vec<TimeEntry>,
    /// Minutes of the time entry being written, as typed.
    pub entry_minutes: String,
    /// Description of the time entry being written.
    pub entry_description: String,
    #[cfg(not(target_arch = "wasm32"))]
    gateway: MobileGatewayHandle,
    loaded_query: String,
    loaded_open_only: bool,
    loaded_status_filter: Option<TicketStatus>,
    reload: bool,
}

impl SupportState {
    /// Creates an empty screen; the first [`SupportState::refresh`] loads the list.
    pub fn new() -> Self {
        Self {
            reload: true,
            ..Self::default()
        }
    }

    /// Reloads the tickets when the filter changed or a write invalidated the list.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload
            && self.loaded_query == self.query
            && self.loaded_open_only == self.only_open
            && self.loaded_status_filter == self.status_filter
        {
            return Ok(());
        }

        let mut tickets = if self.only_open && self.status_filter.is_none() {
            store.open_support_tickets()?
        } else {
            store.list_support_tickets()?
        };
        if let Some(status) = self.status_filter {
            tickets.retain(|ticket| ticket.status == status);
        }
        let needle = self.query.trim().to_lowercase();
        if !needle.is_empty() {
            tickets.retain(|ticket| {
                ticket.subject.to_lowercase().contains(&needle)
                    || ticket.description.to_lowercase().contains(&needle)
            });
        }

        let mut contacts = store.list_contacts()?;
        contacts.sort_by_key(|contact| contact.display_name().to_lowercase());
        self.contacts = contacts;

        self.tickets = tickets;
        self.loaded_query = self.query.clone();
        self.loaded_open_only = self.only_open;
        self.loaded_status_filter = self.status_filter;
        self.reload = false;
        self.load_entries(store)?;
        Ok(())
    }

    /// Reloads the time entries of the selected ticket.
    fn load_entries(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.entries = match self.selected {
            Some(id) => store.time_entries_for_ticket(id)?,
            None => Vec::new(),
        };
        Ok(())
    }

    /// Total tracked minutes of the selected ticket.
    pub fn tracked_minutes(&self) -> i64 {
        self.entries.iter().map(|entry| entry.minutes).sum()
    }

    /// Selected ticket, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&SupportTicket> {
        self.selected
            .and_then(|id| self.tickets.iter().find(|ticket| ticket.id == id))
    }

    /// Resolves a contact name by id.
    pub fn contact_name(&self, contact_id: Option<Uuid>) -> Option<String> {
        let id = contact_id?;
        self.contacts
            .iter()
            .find(|contact| contact.id == id)
            .map(Contact::display_name)
    }

    /// Opens the detail view of a ticket.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = SupportView::Detail;
        self.entries.clear();
        self.error = None;
        self.status = None;
        self.reload = true;
    }

    /// Opens an empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = TicketDraft::default();
        self.error = None;
        self.status = None;
        self.view = SupportView::Form;
    }

    /// Opens the form with the selected ticket.
    pub fn start_edit(&mut self) {
        let Some(ticket) = self.current() else {
            return;
        };
        self.draft = TicketDraft::from_ticket(ticket);
        self.error = None;
        self.status = None;
        self.view = SupportView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            SupportView::Detail
        } else {
            SupportView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`SupportState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let ticket = self.draft.to_ticket(base.as_ref(), now);

        if let Err(code) = ticket.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_support_ticket(&ticket)?;
        } else {
            store.insert_support_ticket(&ticket)?;
        }

        self.selected = Some(ticket.id);
        self.view = SupportView::Detail;
        self.error = None;
        self.status = Some("support_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Moves the selected ticket to another state.
    pub fn set_status(
        &mut self,
        store: &Store,
        status: TicketStatus,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.set_support_ticket_status(id, status, now)?;
        self.error = None;
        self.status = Some("support_status_saved");
        self.only_open = false;
        self.status_filter = None;
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected ticket after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_support_ticket(id)?;
        self.selected = None;
        self.view = SupportView::List;
        self.confirm_delete = false;
        self.entries.clear();
        self.error = None;
        self.status = Some("support_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Books the typed time on the selected ticket.
    ///
    /// A missing or non-positive duration sets [`SupportState::error`] and returns `Ok(())`.
    pub fn add_time(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(ticket_id) = self.selected else {
            return Ok(());
        };
        let minutes = match self.entry_minutes.trim().parse::<i64>() {
            Ok(minutes) if minutes > 0 => minutes,
            _ => {
                self.error = Some("support_error_minutes");
                self.status = None;
                return Ok(());
            }
        };

        let entry = TimeEntry {
            id: Uuid::new_v4(),
            ticket_id: Some(ticket_id),
            user_id: None,
            description: self.entry_description.trim().to_string(),
            minutes,
            started_at: now,
            created_at: now,
            updated_at: now,
        };

        if let Err(code) = entry.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        store.insert_time_entry(&entry)?;
        self.entry_minutes.clear();
        self.entry_description.clear();
        self.error = None;
        self.status = Some("support_time_saved");
        self.load_entries(store)?;
        Ok(())
    }

    /// Removes one time entry.
    pub fn delete_entry(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_time_entry(id)?;
        self.status = Some("support_time_deleted");
        self.load_entries(store)?;
        Ok(())
    }

    /// Creates a draft invoice from the selected ticket's tracked hours.
    pub fn create_invoice_from_selected(
        &mut self,
        store: &Store,
        now: i64,
    ) -> socdof_core::CoreResult<Option<Uuid>> {
        let Some(ticket) = self.current().cloned() else {
            return Ok(None);
        };
        let Some(contact_id) = ticket.contact_id else {
            self.error = Some("support_error_no_contact_for_invoice");
            self.status = None;
            return Ok(None);
        };
        let total_minutes = self.tracked_minutes();
        if total_minutes <= 0 {
            self.error = Some("support_error_no_time_for_invoice");
            self.status = None;
            return Ok(None);
        }

        let profile = store.company_profile().unwrap_or_default();
        let existing_count = store.invoice_count().unwrap_or(0) + 1;
        let invoice_id = Uuid::new_v4();
        let quantity_milli = (total_minutes * 1_000 / 60).max(1);
        let invoice = Invoice {
            id: invoice_id,
            number: format!("SUP-{existing_count:04}"),
            contact_id,
            status: InvoiceStatus::Draft,
            issued_at: now,
            due_at: now + 14 * DAY_MS,
            currency_symbol: profile.currency.clone(),
            note: Some(ticket.subject.clone()),
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: format!("{} ({})", ticket.subject, hours_label(total_minutes)),
                quantity_milli,
                unit_price: Money::from_cents(DEFAULT_HOURLY_RATE_CENTS),
                tax_rate_bp: SUPPORT_INVOICE_TAX_RATE_BP,
            }],
        };
        store.insert_invoice(&invoice)?;
        self.error = None;
        self.status = Some("support_invoice_created");
        Ok(Some(invoice_id))
    }

    /// Parses and previews the Mobile Companion JSON staged in `mobile_json`.
    pub fn preview_mobile_json(&mut self) {
        self.mobile_error = None;
        self.mobile_notice = None;
        match mobile_sync::normalize_bytes(self.mobile_json.as_bytes()) {
            Ok(payload) => {
                self.mobile_preview = Some(MobilePreviewSummary {
                    tickets: payload.tickets.len(),
                    sessions: payload.sessions.len(),
                    timesheets: payload.standalone_timesheets.len(),
                    trips: payload.trips.len(),
                    expenses: payload.standalone_expenses.len()
                        + payload
                            .tickets
                            .iter()
                            .map(|ticket| ticket.expenses.len())
                            .sum::<usize>(),
                });
            }
            Err(_) => {
                self.mobile_preview = None;
                self.mobile_error = Some("support_mobile_error_invalid");
            }
        }
    }

    /// Imports the Mobile Companion JSON staged in `mobile_json` into the SQLite store.
    pub fn import_mobile_json(&mut self, store: &Store) -> socdof_core::CoreResult<bool> {
        self.mobile_error = None;
        match mobile_sync::import_bytes(store, self.mobile_json.as_bytes()) {
            Ok(report) => {
                self.mobile_notice = Some(format!(
                    "+{} tickets · +{} entries · {} min",
                    report.tickets_created, report.timesheets, report.minutes
                ));
                self.mobile_json.clear();
                self.mobile_preview = None;
                self.status = Some("support_mobile_imported");
                self.reload = true;
                self.refresh(store)?;
                Ok(true)
            }
            Err(_) => {
                self.mobile_error = Some("support_mobile_error_invalid");
                Ok(false)
            }
        }
    }

    /// Opens the timesheet overview modal and loads all stored time entries.
    pub fn open_timesheets(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.all_time_entries = store.time_entries_between(0, i64::MAX)?;
        self.timesheet_open = true;
        Ok(())
    }

    /// Builds a CSV export string across all loaded time entries.
    pub fn timesheets_csv(&self) -> String {
        let headers = ["Date", "Ticket", "Description", "Minutes", "Hours"];
        let rows: Vec<Vec<String>> = self
            .all_time_entries
            .iter()
            .map(|entry| {
                let subject = entry
                    .ticket_id
                    .and_then(|tid| self.tickets.iter().find(|t| t.id == tid))
                    .map(|t| t.subject.clone())
                    .unwrap_or_default();
                vec![
                    format_iso8601(entry.started_at),
                    subject,
                    entry.description.clone(),
                    entry.minutes.to_string(),
                    format!("{:.2}", entry.minutes as f64 / 60.0),
                ]
            })
            .collect();
        write_csv(&headers, &rows)
    }

    /// Reloads the module state before it is shown, as the desktop does when an app is launched.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.back = false;
        self.error = None;
        self.status = None;
        self.confirm_delete = false;
        self.timesheet_open = false;
        self.mobile_open = false;
        self.view = SupportView::List;
        self.reload = true;
        self.refresh(store)
    }
}

fn status_index(status: TicketStatus) -> usize {
    match status {
        TicketStatus::Open => 0,
        TicketStatus::InProgress => 1,
        TicketStatus::Waiting => 2,
        TicketStatus::Closed => 3,
    }
}

fn status_from_index(index: usize) -> TicketStatus {
    match index {
        1 => TicketStatus::InProgress,
        2 => TicketStatus::Waiting,
        3 => TicketStatus::Closed,
        _ => TicketStatus::Open,
    }
}

fn priority_index(priority: TicketPriority) -> usize {
    match priority {
        TicketPriority::Low => 0,
        TicketPriority::Normal => 1,
        TicketPriority::High => 2,
        TicketPriority::Urgent => 3,
    }
}

fn priority_from_index(index: usize) -> TicketPriority {
    match index {
        0 => TicketPriority::Low,
        2 => TicketPriority::High,
        3 => TicketPriority::Urgent,
        _ => TicketPriority::Normal,
    }
}

fn status_tone(status: TicketStatus) -> Tone {
    match status {
        TicketStatus::Closed => Tone::Success,
        TicketStatus::Waiting => Tone::Accent,
        TicketStatus::InProgress => Tone::Accent,
        TicketStatus::Open => Tone::Accent,
    }
}

fn priority_tone(priority: TicketPriority) -> Tone {
    match priority {
        TicketPriority::Urgent | TicketPriority::High => Tone::Danger,
        TicketPriority::Normal | TicketPriority::Low => Tone::Accent,
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "minutes_invalid" => "support_error_minutes",
        _ => "support_error_subject",
    }
}

/// Formats a duration the way the time panel shows it.
pub fn hours_label(minutes: i64) -> String {
    format!("{:.2} h", minutes as f64 / 60.0)
}

/// Builds a concise A4 PDF summary for one support ticket and its time entries.
pub fn ticket_pdf(
    ticket: &SupportTicket,
    customer: Option<&str>,
    entries: &[TimeEntry],
    texts: &UiTexts,
) -> Vec<u8> {
    let mut doc = Document::new(&ticket.subject);
    let page = doc.page_mut();
    let left = mm(20.0);
    let mut y = mm(PAGE_HEIGHT_MM - 22.0);
    page.text_bold(left, y, 16.0, texts.get("support_detail_title"));
    y -= mm(8.0);
    page.text_bold(left, y, 12.0, &ticket.subject);
    y -= mm(6.0);
    let status = texts.get(STATUS_KEYS[status_index(ticket.status)]);
    let priority = texts.get(PRIORITY_KEYS[priority_index(ticket.priority)]);
    page.text(
        left,
        y,
        10.0,
        &format!(
            "{status} · {priority} · {}",
            format_iso8601(ticket.created_at)
        ),
    );
    if let Some(name) = customer {
        y -= mm(5.5);
        page.text(
            left,
            y,
            10.0,
            &format!("{}: {name}", texts.get("support_contact")),
        );
    }
    if !ticket.description.trim().is_empty() {
        y -= mm(7.0);
        for line in ticket.description.lines().take(12) {
            page.text(left, y, 9.5, line);
            y -= mm(4.8);
        }
    }
    y -= mm(6.0);
    page.line(left, y, mm(190.0), 0.6);
    y -= mm(6.0);
    page.text_bold(left, y, 11.0, texts.get("support_time_title"));
    y -= mm(5.5);
    let mut total = 0_i64;
    for entry in entries {
        total += entry.minutes;
        if y < mm(25.0) {
            break;
        }
        page.text(
            left,
            y,
            9.5,
            &format!(
                "{} · {} · {}",
                format_iso8601(entry.started_at),
                hours_label(entry.minutes),
                entry.description
            ),
        );
        y -= mm(5.0);
    }
    y -= mm(3.0);
    page.text_bold(
        left,
        y,
        10.5,
        &format!("{} {}", hours_label(total), texts.get("support_time_total")),
    );
    doc.to_bytes()
}

/// Seeds three deterministic tickets with tracked time for the gallery and the golden snapshots.
///
/// The function is a no-op when the store already has tickets, so it never overwrites data.
pub fn seed_sample(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if !store.list_support_tickets()?.is_empty() {
        return Ok(());
    }

    let urgent = SupportTicket {
        id: Uuid::new_v4(),
        contact_id: None,
        subject: texts.get("support_sample_urgent").to_string(),
        description: texts.get("support_sample_urgent_body").to_string(),
        status: TicketStatus::InProgress,
        priority: TicketPriority::Urgent,
        created_at: SAMPLE_NOW_MS - 6 * HOUR_MS,
        updated_at: SAMPLE_NOW_MS - HOUR_MS,
        closed_at: None,
    };
    store.insert_support_ticket(&urgent)?;

    let entry = TimeEntry {
        id: Uuid::new_v4(),
        ticket_id: Some(urgent.id),
        user_id: None,
        description: texts.get("support_sample_entry").to_string(),
        minutes: 90,
        started_at: SAMPLE_NOW_MS - 2 * HOUR_MS,
        created_at: SAMPLE_NOW_MS - 2 * HOUR_MS,
        updated_at: SAMPLE_NOW_MS - 2 * HOUR_MS,
    };
    store.insert_time_entry(&entry)?;

    let open = SupportTicket {
        id: Uuid::new_v4(),
        contact_id: None,
        subject: texts.get("support_sample_open").to_string(),
        description: texts.get("support_sample_open_body").to_string(),
        status: TicketStatus::Open,
        priority: TicketPriority::Normal,
        created_at: SAMPLE_NOW_MS - 30 * HOUR_MS,
        updated_at: SAMPLE_NOW_MS - 30 * HOUR_MS,
        closed_at: None,
    };
    store.insert_support_ticket(&open)?;

    let closed = SupportTicket {
        id: Uuid::new_v4(),
        contact_id: None,
        subject: texts.get("support_sample_closed").to_string(),
        description: texts.get("support_sample_closed_body").to_string(),
        status: TicketStatus::Closed,
        priority: TicketPriority::Low,
        created_at: SAMPLE_NOW_MS - 72 * HOUR_MS,
        updated_at: SAMPLE_NOW_MS - 48 * HOUR_MS,
        closed_at: Some(SAMPLE_NOW_MS - 48 * HOUR_MS),
    };
    store.insert_support_ticket(&closed)?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("support"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &SupportState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders support in the full application work area.
pub fn support(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
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
            support_window(ctx, true, ui, theme, texts, focus, state, store, now);
        });
}

/// Renders support inside one native desktop child window.
#[allow(clippy::too_many_arguments)]
pub fn support_window(
    ctx: &Context,
    active: bool,
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
    now: i64,
) {
    if active
        && !state.confirm_delete
        && !state.timesheet_open
        && !state.mobile_open
        && ctx.input(|input| input.key_pressed(egui::Key::Escape))
    {
        match state.view {
            SupportView::List => state.back = true,
            SupportView::Detail => state.view = SupportView::List,
            SupportView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("support_error_load");
    }

    egui::ScrollArea::vertical().show(ui, |ui| match state.view {
        SupportView::List => list_view(ui, theme, texts, focus, state, store),
        SupportView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
        SupportView::Form => form_view(ui, theme, texts, focus, state, store, now),
    });

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("support_delete_title"),
            |ui| {
                ui.label(texts.get("support_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("support_delete_confirm"),
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
                        texts.get("support_delete_cancel"),
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
        state.error = Some("support_error_delete");
    }

    render_timesheet_modal(ctx, theme, texts, focus, state);
    render_mobile_modal(ctx, theme, texts, focus, state, store);
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
) {
    let subtitle = format!(
        "{} · {}",
        state.tickets.len(),
        texts.get("support_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("support_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    let mut toggled = false;
    let mut open_timesheets = false;
    let mut open_mobile = false;
    ui.horizontal_wrapped(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("support_search"),
            360.0,
        );
        let filter = if state.only_open {
            "support_show_all"
        } else {
            "support_only_open"
        };
        if button(
            ui,
            theme,
            focus,
            texts.get(filter),
            ButtonVariant::Secondary,
        )
        .activated
        {
            toggled = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_timesheet_button"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            open_timesheets = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_mobile_sync"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            open_mobile = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });
    if toggled {
        state.only_open = !state.only_open;
        state.status_filter = None;
    }
    if open_timesheets && state.open_timesheets(store).is_err() {
        state.error = Some("support_error_load");
    }
    if open_mobile {
        state.mobile_open = true;
        state.mobile_error = None;
    }
    if create {
        state.start_new();
        return;
    }

    ui.add_space(6.0);
    ui.horizontal_wrapped(|ui| {
        let all_variant = if state.status_filter.is_none() && !state.only_open {
            ButtonVariant::Primary
        } else {
            ButtonVariant::Secondary
        };
        if button(
            ui,
            theme,
            focus,
            texts.get("support_filter_all"),
            all_variant,
        )
        .activated
        {
            state.status_filter = None;
            state.only_open = false;
        }
        for (status, key) in [
            (TicketStatus::Open, "support_status_open"),
            (TicketStatus::InProgress, "support_status_in_progress"),
            (TicketStatus::Waiting, "support_status_waiting"),
            (TicketStatus::Closed, "support_status_closed"),
        ] {
            let variant = if state.status_filter == Some(status) {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, texts.get(key), variant).activated {
                state.status_filter = Some(status);
                state.only_open = false;
            }
        }
    });

    ui.add_space(12.0);
    if state.tickets.is_empty() {
        let filtered =
            state.only_open || state.status_filter.is_some() || !state.query.trim().is_empty();
        card(ui, theme, |ui| {
            let (title, hint) = if filtered {
                ("support_no_results", "support_no_results_hint")
            } else {
                ("support_empty_title", "support_empty_hint")
            };
            empty_state(ui, theme, texts.get(title), texts.get(hint));
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        if ui.available_width() < crate::components::FORM_STACK_WIDTH {
            for ticket in &state.tickets {
                if button(ui, theme, focus, &ticket.subject, ButtonVariant::Ghost).activated {
                    chosen = Some(ticket.id);
                }
                ui.horizontal_wrapped(|ui| {
                    if let Some(name) = state.contact_name(ticket.contact_id) {
                        badge(ui, theme, &name, Tone::Neutral);
                    }
                    badge(
                        ui,
                        theme,
                        texts.get(STATUS_KEYS[status_index(ticket.status)]),
                        status_tone(ticket.status),
                    );
                    badge(
                        ui,
                        theme,
                        texts.get(PRIORITY_KEYS[priority_index(ticket.priority)]),
                        priority_tone(ticket.priority),
                    );
                });
                ui.add_space(6.0);
            }
            return;
        }
        egui::Grid::new("socdof-support-table")
            .num_columns(4)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "support_col_subject",
                    "support_contact",
                    "support_col_status",
                    "support_col_priority",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for ticket in &state.tickets {
                    if button(ui, theme, focus, &ticket.subject, ButtonVariant::Ghost).activated {
                        chosen = Some(ticket.id);
                    }
                    let customer = state
                        .contact_name(ticket.contact_id)
                        .unwrap_or_else(|| texts.get("support_no_contact").to_string());
                    ui.label(
                        RichText::new(customer)
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    badge(
                        ui,
                        theme,
                        texts.get(STATUS_KEYS[status_index(ticket.status)]),
                        status_tone(ticket.status),
                    );
                    badge(
                        ui,
                        theme,
                        texts.get(PRIORITY_KEYS[priority_index(ticket.priority)]),
                        priority_tone(ticket.priority),
                    );
                    ui.end_row();
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
    state: &mut SupportState,
    store: &Store,
    now: i64,
) {
    let Some(ticket) = state.current().cloned() else {
        state.view = SupportView::List;
        return;
    };

    let subtitle = format!(
        "{} · {}",
        texts.get(STATUS_KEYS[status_index(ticket.status)]),
        texts.get(PRIORITY_KEYS[priority_index(ticket.priority)])
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("support_detail_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let customer = state.contact_name(ticket.contact_id);
    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.label(RichText::new(&ticket.subject).size(FONT_TITLE).strong());
            if let Some(name) = customer.as_deref() {
                badge(ui, theme, name, Tone::Neutral);
            }
            badge(
                ui,
                theme,
                texts.get(STATUS_KEYS[status_index(ticket.status)]),
                status_tone(ticket.status),
            );
            badge(
                ui,
                theme,
                texts.get(PRIORITY_KEYS[priority_index(ticket.priority)]),
                priority_tone(ticket.priority),
            );
        });
        if !ticket.description.is_empty() {
            ui.add_space(8.0);
            ui.label(&ticket.description);
        }
    });

    ui.add_space(12.0);
    let mut next_status = None;
    let mut edit = false;
    let mut delete = false;
    let mut make_invoice = false;
    let mut print_pdf = false;
    ui.horizontal_wrapped(|ui| {
        for status in [
            TicketStatus::Open,
            TicketStatus::InProgress,
            TicketStatus::Waiting,
            TicketStatus::Closed,
        ] {
            if status == ticket.status {
                continue;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get(STATUS_KEYS[status_index(status)]),
                ButtonVariant::Secondary,
            )
            .activated
            {
                next_status = Some(status);
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_create_invoice"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            make_invoice = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_print_pdf"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            print_pdf = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("support_edit"),
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
            texts.get("support_delete"),
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
            texts.get("support_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = SupportView::List;
        }
    });
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
    if make_invoice && state.create_invoice_from_selected(store, now).is_err() {
        state.error = Some("support_error_save");
    }
    if print_pdf {
        let bytes = ticket_pdf(&ticket, customer.as_deref(), &state.entries, texts);
        #[cfg(feature = "dialogs")]
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name("support-ticket.pdf")
            .add_filter("PDF", &["pdf"])
            .save_file()
        {
            if std::fs::write(path, bytes).is_ok() {
                state.status = Some("support_pdf_saved");
            } else {
                state.error = Some("support_error_save");
            }
        }
        #[cfg(not(feature = "dialogs"))]
        {
            let _ = bytes;
            state.status = Some("support_pdf_saved");
        }
    }
    if let Some(status) = next_status {
        if state.set_status(store, status, now).is_err() {
            state.error = Some("support_error_save");
        }
    }

    ui.add_space(12.0);
    time_card(ui, theme, texts, focus, state, store, now);
}

fn time_card(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
    now: i64,
) {
    let entries = state.entries.clone();
    let mut remove = None;
    let mut add = false;

    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(texts.get("support_time_title"))
                    .size(FONT_TITLE)
                    .strong(),
            );
            badge(
                ui,
                theme,
                &format!(
                    "{} {}",
                    hours_label(state.tracked_minutes()),
                    texts.get("support_time_total")
                ),
                Tone::Accent,
            );
        });
        ui.add_space(8.0);

        if entries.is_empty() {
            ui.label(
                RichText::new(texts.get("support_time_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        } else if ui.available_width() < crate::components::FORM_STACK_WIDTH {
            for entry in &entries {
                ui.label(&entry.description);
                ui.horizontal_wrapped(|ui| {
                    ui.label(hours_label(entry.minutes));
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("support_time_delete"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        remove = Some(entry.id);
                    }
                });
                ui.add_space(4.0);
            }
        } else {
            egui::Grid::new("socdof-support-time")
                .num_columns(3)
                .spacing(egui::vec2(16.0, 8.0))
                .show(ui, |ui| {
                    for entry in &entries {
                        ui.label(&entry.description);
                        ui.label(hours_label(entry.minutes));
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("support_time_delete"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            remove = Some(entry.id);
                        }
                        ui.end_row();
                    }
                });
        }

        ui.add_space(10.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.entry_minutes,
            texts.get("support_time_minutes"),
            texts.get("support_time_minutes_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.entry_description,
            texts.get("support_time_description"),
            texts.get("support_time_description_hint"),
            None,
        );
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("support_time_add"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                add = true;
            }
        });
    });

    if let Some(id) = remove {
        if state.delete_entry(store, id).is_err() {
            state.error = Some("support_error_save");
        }
    }
    if add && state.add_time(store, now).is_err() {
        state.error = Some("support_error_save");
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("support_form_title")
    } else {
        texts.get("support_new_title")
    };
    let subtitle = texts.get("support_subtitle").to_string();
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
            &mut state.draft.subject,
            texts.get("support_subject"),
            texts.get("support_subject_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.description,
            texts.get("support_description"),
            texts.get("support_description_hint"),
            None,
        );
        ui.add_space(6.0);

        ui.label(
            RichText::new(texts.get("support_contact"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        let mut contact_labels = vec![texts.get("support_no_contact").to_string()];
        contact_labels.extend(state.contacts.iter().map(Contact::display_name));
        let contact_refs: Vec<&str> = contact_labels.iter().map(String::as_str).collect();
        let mut contact_idx = state
            .draft
            .contact_id
            .and_then(|id| state.contacts.iter().position(|c| c.id == id))
            .map(|pos| pos + 1)
            .unwrap_or(0);
        select(
            ui,
            theme,
            focus,
            &mut state.contact_popup,
            "socdof-support-contact",
            &mut contact_idx,
            &contact_refs,
        );
        state.draft.contact_id = contact_idx
            .checked_sub(1)
            .and_then(|idx| state.contacts.get(idx))
            .map(|contact| contact.id);

        ui.add_space(6.0);
        ui.label(
            RichText::new(texts.get("support_priority"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        let priorities: [&str; 4] = std::array::from_fn(|index| texts.get(PRIORITY_KEYS[index]));
        select(
            ui,
            theme,
            focus,
            &mut state.priority_popup,
            "socdof-support-priority",
            &mut state.draft.priority,
            &priorities,
        );
        ui.add_space(6.0);
        ui.label(
            RichText::new(texts.get("support_status"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        let statuses: [&str; 4] = std::array::from_fn(|index| texts.get(STATUS_KEYS[index]));
        select(
            ui,
            theme,
            focus,
            &mut state.status_popup,
            "socdof-support-status",
            &mut state.draft.status,
            &statuses,
        );
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
                texts.get("support_save"),
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
                texts.get("support_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("support_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

fn render_timesheet_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
) {
    let mut open = state.timesheet_open;
    let mut export_csv = false;
    let total_minutes: i64 = state
        .all_time_entries
        .iter()
        .map(|entry| entry.minutes)
        .sum();
    let entries = state.all_time_entries.clone();
    let tickets = state.tickets.clone();

    modal(
        ctx,
        theme,
        &mut open,
        texts.get("support_timesheet_title"),
        |ui| {
            badge(
                ui,
                theme,
                &format!(
                    "{} {}",
                    hours_label(total_minutes),
                    texts.get("support_time_total")
                ),
                Tone::Accent,
            );
            ui.add_space(8.0);
            if entries.is_empty() {
                ui.label(
                    RichText::new(texts.get("support_time_empty"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            } else {
                egui::ScrollArea::vertical()
                    .max_height(240.0)
                    .show(ui, |ui| {
                        for entry in &entries {
                            let subject = entry
                                .ticket_id
                                .and_then(|tid| tickets.iter().find(|t| t.id == tid))
                                .map(|t| t.subject.as_str())
                                .unwrap_or("-");
                            ui.label(format!(
                                "{} · {} · {} ({})",
                                format_iso8601(entry.started_at),
                                hours_label(entry.minutes),
                                entry.description,
                                subject
                            ));
                        }
                    });
            }
            ui.add_space(10.0);
            let mut close = false;
            ui.horizontal_wrapped(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("support_timesheet_export_csv"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    export_csv = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("support_delete_cancel"),
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
    state.timesheet_open = open;

    if export_csv {
        let csv = state.timesheets_csv();
        #[cfg(feature = "dialogs")]
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name("support-timesheets.csv")
            .add_filter("CSV", &["csv"])
            .save_file()
        {
            if std::fs::write(path, csv.as_bytes()).is_ok() {
                state.status = Some("support_timesheet_exported");
            }
        }
        #[cfg(not(feature = "dialogs"))]
        {
            ctx.copy_text(csv);
            state.status = Some("support_timesheet_exported");
        }
    }
}

fn render_mobile_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
) {
    let mut open = state.mobile_open;
    let mut do_preview = false;
    let mut do_import = false;
    #[cfg(not(target_arch = "wasm32"))]
    let (mut toggle_gateway, mut import_inbox) = (false, false);

    modal(
        ctx,
        theme,
        &mut open,
        texts.get("support_mobile_title"),
        |ui| {
            #[cfg(not(target_arch = "wasm32"))]
            {
                let (is_running, url, inbox_len, gw_err) = {
                    let guard = state.gateway.inner.lock().expect("gateway mutex");
                    (
                        guard.running.is_some(),
                        guard.running.as_ref().map(|r| r.url()),
                        guard.inbox.len(),
                        guard.error.clone(),
                    )
                };
                ui.horizontal_wrapped(|ui| {
                    let label = if is_running {
                        texts.get("support_mobile_gateway_stop")
                    } else {
                        texts.get("support_mobile_gateway_start")
                    };
                    if button(ui, theme, focus, label, ButtonVariant::Secondary).activated {
                        toggle_gateway = true;
                    }
                    if is_running {
                        badge(
                            ui,
                            theme,
                            texts.get("support_mobile_gateway_active"),
                            Tone::Success,
                        );
                    }
                    if inbox_len > 0
                        && button(
                            ui,
                            theme,
                            focus,
                            &format!(
                                "{} ({inbox_len})",
                                texts.get("support_mobile_gateway_import")
                            ),
                            ButtonVariant::Primary,
                        )
                        .activated
                    {
                        import_inbox = true;
                    }
                });
                if let Some(url) = url {
                    ui.label(
                        RichText::new(url)
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                if let Some(err) = gw_err {
                    badge(ui, theme, &err, Tone::Danger);
                }
                ui.add_space(8.0);
            }

            ui.label(
                RichText::new(texts.get("support_mobile_json_label"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            ui.add(
                TextEdit::multiline(&mut state.mobile_json)
                    .desired_rows(6)
                    .desired_width(420.0)
                    .hint_text(texts.get("support_mobile_json_hint")),
            );
            ui.add_space(6.0);
            if let Some(summary) = &state.mobile_preview {
                badge(
                    ui,
                    theme,
                    &format!(
                        "{} tickets · {} sessions · {} timesheets · {} trips · {} expenses",
                        summary.tickets,
                        summary.sessions,
                        summary.timesheets,
                        summary.trips,
                        summary.expenses
                    ),
                    Tone::Accent,
                );
            }
            if let Some(notice) = &state.mobile_notice {
                badge(ui, theme, notice, Tone::Success);
            }
            if let Some(err) = state.mobile_error {
                badge(ui, theme, texts.get(err), Tone::Danger);
            }
            ui.add_space(8.0);
            let mut close = false;
            ui.horizontal_wrapped(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("support_mobile_preview"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    do_preview = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("support_mobile_import"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    do_import = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("support_delete_cancel"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    close = true;
                }
            });
            close
        },
    );
    state.mobile_open = open;

    #[cfg(not(target_arch = "wasm32"))]
    if toggle_gateway {
        let mut guard = state.gateway.inner.lock().expect("gateway mutex");
        if let Some(mut running) = guard.running.take() {
            running.stop();
        } else {
            guard.error = None;
            let inbox_handle = state.gateway.clone();
            match mobile_sync::http::start_with(mobile_sync::Options::default(), move |payload| {
                if let Ok(mut inner) = inbox_handle.inner.lock() {
                    inner.inbox.push(payload.clone());
                }
            }) {
                Ok(running) => guard.running = Some(running),
                Err(error) => guard.error = Some(error.to_string()),
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    if import_inbox {
        let pending = {
            let mut guard = state.gateway.inner.lock().expect("gateway mutex");
            std::mem::take(&mut guard.inbox)
        };
        let mut imported = 0_usize;
        for payload in pending {
            if let Ok(bytes) = serde_json::to_vec(&payload) {
                if let Ok(report) = mobile_sync::import_bytes(store, &bytes) {
                    imported += report.tickets_created;
                }
            }
        }
        state.mobile_notice = Some(format!("+{imported} tickets"));
        state.status = Some("support_mobile_imported");
        state.reload = true;
        let _ = state.refresh(store);
    }

    if do_preview {
        state.preview_mobile_json();
    }
    if do_import {
        let _ = state.import_mobile_json(store);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::contact::{ContactKind, ContactType};
    use socdof_core::domain::settings::Language;

    fn seeded() -> (Store, SupportState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_sample(&store, &texts).expect("seed");
        let mut state = SupportState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut SupportState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
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
                support(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("support frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_a_ticket() {
        let store = Store::open_in_memory().expect("store");
        let mut state = SupportState::new();
        state.refresh(&store).expect("refresh");
        assert!(state.tickets.is_empty());

        state.start_new();
        state.draft.subject = "Drucker defekt".to_string();
        state.draft.description = "Papierstau im Fach 2".to_string();
        state.draft.priority = 2;
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, SupportView::Detail);
        let id = store.list_support_tickets().expect("list")[0].id;
        assert_eq!(state.selected, Some(id));
        let stored = state.current().expect("current");
        assert_eq!(stored.priority, TicketPriority::High);

        state.start_edit();
        state.draft.subject = "Drucker defekt (Fach 2)".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        let stored = store
            .find_support_ticket(id)
            .expect("find")
            .expect("ticket");
        assert_eq!(stored.subject, "Drucker defekt (Fach 2)");
        assert_eq!(stored.updated_at, SAMPLE_NOW_MS + 1);

        state.delete_selected(&store).expect("delete");
        assert!(store.list_support_tickets().expect("list").is_empty());
        assert_eq!(state.view, SupportView::List);
    }

    #[test]
    fn rejects_an_empty_subject_before_writing() {
        let store = Store::open_in_memory().expect("store");
        let mut state = SupportState::new();
        state.start_new();
        state.draft.subject = "   ".to_string();
        state
            .save(&store, SAMPLE_NOW_MS)
            .expect("validation returns ok");

        assert_eq!(state.error, Some("support_error_subject"));
        assert_eq!(state.view, SupportView::Form);
        assert!(store.list_support_tickets().expect("list").is_empty());
    }

    #[test]
    fn closing_a_ticket_keeps_the_closing_time() {
        let (store, mut state, _texts) = seeded();
        let id = state.tickets[0].id;
        state.select(id);
        assert!(state.selected.is_some());

        state
            .set_status(&store, TicketStatus::Closed, SAMPLE_NOW_MS + 10)
            .expect("status");
        assert!(state
            .tickets
            .iter()
            .any(|ticket| ticket.id == id && ticket.status == TicketStatus::Closed));
        let stored = store
            .find_support_ticket(id)
            .expect("find")
            .expect("ticket");
        assert_eq!(stored.status, TicketStatus::Closed);
        assert_eq!(stored.closed_at, Some(SAMPLE_NOW_MS + 10));
    }

    #[test]
    fn books_and_removes_tracked_time() {
        let (store, mut state, _texts) = seeded();
        let id = state.tickets[0].id;
        state.select(id);
        state.refresh(&store).expect("entries");
        assert_eq!(state.tracked_minutes(), 90);

        state.entry_minutes = "30".to_string();
        state.entry_description = "Rückruf".to_string();
        state.add_time(&store, SAMPLE_NOW_MS).expect("book");
        assert_eq!(state.tracked_minutes(), 120);
        assert!(state.entry_minutes.is_empty());
        assert_eq!(store.tracked_minutes(id).expect("total"), 120);

        let first = state.entries[0].id;
        state.delete_entry(&store, first).expect("delete");
        assert_eq!(store.tracked_minutes(id).expect("total"), 30);
    }

    #[test]
    fn rejects_invalid_durations_before_writing() {
        let (store, mut state, _texts) = seeded();
        let id = state.tickets[0].id;
        state.select(id);
        state.refresh(&store).expect("entries");

        state.entry_minutes = "0".to_string();
        state.add_time(&store, SAMPLE_NOW_MS).expect("validated");
        assert_eq!(state.error, Some("support_error_minutes"));
        assert_eq!(store.tracked_minutes(id).expect("total"), 90);
    }

    #[test]
    fn filters_closed_tickets_and_searches_locally() {
        let (store, mut state, texts) = seeded();
        assert_eq!(state.tickets.len(), 3);

        state.only_open = true;
        state.refresh(&store).expect("filter");
        assert_eq!(state.tickets.len(), 2);

        state.only_open = false;
        state.query = texts.get("support_sample_closed").to_string();
        state.refresh(&store).expect("search");
        assert_eq!(state.tickets.len(), 1);
    }

    #[test]
    fn creates_invoice_from_ticket_with_customer_and_imports_mobile_payload() {
        let store = Store::open_in_memory().expect("store");
        let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
        contact.contact_type = ContactType::Customer;
        contact.name = Some("AlpenTech GmbH".to_string());
        store.insert_contact(&contact).expect("contact");

        let mut state = SupportState::new();
        state.start_new();
        state.draft.contact_id = Some(contact.id);
        state.draft.subject = "Serverwartung".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("save");
        state.entry_minutes = "120".to_string();
        state.entry_description = "Patchday".to_string();
        state.add_time(&store, SAMPLE_NOW_MS).expect("time");

        let invoice_id = state
            .create_invoice_from_selected(&store, SAMPLE_NOW_MS)
            .expect("invoice")
            .expect("created");
        let invoice = store.find_invoice(invoice_id).expect("find").expect("inv");
        assert_eq!(invoice.contact_id, contact.id);
        assert_eq!(invoice.lines[0].quantity_milli, 2_000);

        state.mobile_json = serde_json::json!({
            "protocol": mobile_sync::PROTOCOL,
            "tickets": [{
                "title": "Mobil-Ticket",
                "description": "Vor-Ort",
                "timesheets": [{ "description": "Anfahrt", "hours": 1.0, "billable": true }]
            }]
        })
        .to_string();
        state.preview_mobile_json();
        assert_eq!(state.mobile_preview.as_ref().map(|p| p.tickets), Some(1));
        assert!(state.import_mobile_json(&store).expect("import"));
        assert_eq!(store.list_support_tickets().expect("tickets").len(), 2);
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("support_title")));
        assert!(painted.contains(texts.get("support_sample_urgent")));
        assert!(painted.contains(texts.get("support_new")));

        let id = state.tickets[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("support_time_title")));
        assert!(painted.contains(texts.get("support_edit")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("support_save")));
        assert!(painted.contains(texts.get("support_priority")));
    }

    #[test]
    fn seeding_is_idempotent() {
        let (store, _state, texts) = seeded();
        seed_sample(&store, &texts).expect("second seed");
        assert_eq!(store.list_support_tickets().expect("list").len(), 3);
    }
}
