//! Calendar screen: month, week and day views with the appointment agenda.
//!
//! The screen works on the core store: every view loads its range through
//! [`Store::appointments_between`] or [`Store::search_appointments_between`], writes through
//! [`Store::insert_appointment`], [`Store::update_appointment`] and [`Store::delete_appointment`],
//! and checks overlapping open slots through [`Store::appointment_conflicts`]. Validation and the
//! overlap rule stay in [`socdof_core::domain::appointment`]; the screen only maps snake_case codes
//! to catalogue keys, so invalid input never reaches the database.
//!
//! Views are month, week and day, with a shared agenda list. Every control registers in the shared
//! [`FocusState`], every visible string comes from the catalogue and all painting uses the design
//! tokens.

use egui::{Context, RichText};
use socdof_core::date;
use socdof_core::domain::appointment::{
    export_appointments_ics, invoice_events, Appointment, AppointmentCategory, AppointmentStatus,
    InvoiceEvent,
};
use socdof_core::domain::contact::Contact;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::calendar::{days_in_month, month_grid, CalendarState};
use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::{select, switch, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample appointments, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Length of one day in milliseconds.
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Length of one minute in milliseconds.
const MINUTE_MS: i64 = 60 * 1_000;

/// Statuses in display order.
const STATUSES: [AppointmentStatus; 5] = [
    AppointmentStatus::Scheduled,
    AppointmentStatus::Confirmed,
    AppointmentStatus::Completed,
    AppointmentStatus::Cancelled,
    AppointmentStatus::NoShow,
];

/// Calendar view currently shown.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AppointmentsView {
    /// Month grid with the agenda of the month.
    #[default]
    Month,
    /// Five weekday columns from Monday to Friday.
    WorkWeek,
    /// Seven day columns with the agenda of the week.
    Week,
    /// One day with its agenda.
    Day,
}

impl AppointmentsView {
    /// Catalogue key of the view label.
    pub fn label_key(self) -> &'static str {
        match self {
            AppointmentsView::Month => "appointments_view_month",
            AppointmentsView::WorkWeek => "appointments_view_workweek",
            AppointmentsView::Week => "appointments_view_week",
            AppointmentsView::Day => "appointments_view_day",
        }
    }

    /// Number of day columns of the view; the month grid draws its own.
    pub fn days(self) -> i64 {
        match self {
            AppointmentsView::Month => 0,
            AppointmentsView::WorkWeek => 5,
            AppointmentsView::Week => 7,
            AppointmentsView::Day => 1,
        }
    }
}

/// View currently shown by the screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AppointmentsDetail {
    /// Calendar and agenda.
    #[default]
    Calendar,
    /// Detail of the selected appointment.
    Detail,
    /// Create or edit form.
    Form,
}

/// Identity of a calendar entry: a stored appointment or a read-only invoice due date.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryId {
    /// Stored appointment.
    Appointment(Uuid),
    /// Due date of an invoice.
    Invoice(Uuid),
}

/// One row of the merged calendar: a stored appointment or an invoice due date.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarEntry {
    /// Identity used for selection and widget ids.
    pub id: EntryId,
    /// Title shown in the calendar.
    pub title: String,
    /// Room, address or link.
    pub location: Option<String>,
    /// Free text notes.
    pub notes: Option<String>,
    /// Colour-coded kind.
    pub category: AppointmentCategory,
    /// Whether the entry fills whole days.
    pub all_day: bool,
    /// Start in milliseconds since the Unix epoch.
    pub starts_at: i64,
    /// End in milliseconds since the Unix epoch, exclusive for all-day entries.
    pub ends_at: i64,
    /// Lifecycle state of a stored appointment.
    pub status: AppointmentStatus,
    /// Linked contact of a stored appointment.
    pub contact_id: Option<Uuid>,
    /// Invoice number of a read-only invoice entry.
    pub invoice_number: Option<String>,
    /// Whether an invoice entry is paid.
    pub invoice_paid: bool,
    /// Whether an invoice entry is past its due date.
    pub invoice_overdue: bool,
}

impl CalendarEntry {
    /// Builds the entry of a stored appointment.
    pub fn from_appointment(appointment: &Appointment) -> Self {
        Self {
            id: EntryId::Appointment(appointment.id),
            title: appointment.title.clone(),
            location: appointment.location.clone(),
            notes: appointment.notes.clone(),
            category: appointment.category,
            all_day: appointment.all_day,
            starts_at: appointment.starts_at,
            ends_at: appointment.ends_at,
            status: appointment.status,
            contact_id: appointment.contact_id,
            invoice_number: None,
            invoice_paid: false,
            invoice_overdue: false,
        }
    }

    /// Builds the entry of an invoice due date.
    pub fn from_invoice(event: &InvoiceEvent) -> Self {
        Self {
            id: EntryId::Invoice(event.invoice_id),
            title: event.title.clone(),
            location: None,
            notes: Some(event.notes.clone()),
            category: AppointmentCategory::Invoice,
            all_day: true,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            status: if event.paid {
                AppointmentStatus::Completed
            } else {
                AppointmentStatus::Confirmed
            },
            contact_id: None,
            invoice_number: Some(event.number.clone()),
            invoice_paid: event.paid,
            invoice_overdue: event.overdue,
        }
    }

    /// Whether the entry comes from an invoice.
    pub fn is_invoice(&self) -> bool {
        matches!(self.id, EntryId::Invoice(_))
    }

    /// Number of calendar days the entry touches.
    pub fn day_count(&self) -> i64 {
        ((self.ends_at - 1 - self.starts_at).max(0) / DAY_MS) + 1
    }

    /// Whether the entry overlaps the given half-open range.
    pub fn overlaps(&self, from: i64, to: i64) -> bool {
        self.starts_at < to && from < self.ends_at
    }
}

/// Editable values of one appointment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppointmentDraft {
    /// Short title shown in the calendar.
    pub title: String,
    /// Start date as `DD.MM.YYYY`.
    pub date: String,
    /// Start time as `HH:MM`.
    pub start: String,
    /// End date as `DD.MM.YYYY`; empty reuses the start date.
    pub end_date: String,
    /// End time as `HH:MM`.
    pub end: String,
    /// Whether the entry fills whole days; times are then ignored.
    pub all_day: bool,
    /// Room, address or link.
    pub location: String,
    /// Free text notes.
    pub notes: String,
    /// Index into the loaded contacts, `0` meaning no contact.
    pub contact: usize,
    /// Index into [`STATUSES`].
    pub status: usize,
    /// Index into [`AppointmentCategory::ALL`].
    pub category: usize,
}

impl Default for AppointmentDraft {
    fn default() -> Self {
        Self {
            title: String::new(),
            date: String::new(),
            start: "09:00".to_string(),
            end_date: String::new(),
            end: "10:00".to_string(),
            all_day: false,
            location: String::new(),
            notes: String::new(),
            contact: 0,
            status: 0,
            category: AppointmentCategory::ALL.len() - 1,
        }
    }
}

impl AppointmentDraft {
    /// Fills the draft from a stored appointment.
    pub fn from_appointment(appointment: &Appointment, contacts: &[Contact]) -> Self {
        let last_day = if appointment.all_day {
            appointment.ends_at - DAY_MS
        } else {
            appointment.ends_at
        };
        Self {
            title: appointment.title.clone(),
            date: format_date(appointment.starts_at),
            start: format_time(appointment.starts_at),
            end_date: format_date(last_day),
            end: format_time(appointment.ends_at),
            all_day: appointment.all_day,
            location: appointment.location.clone().unwrap_or_default(),
            notes: appointment.notes.clone().unwrap_or_default(),
            contact: appointment
                .contact_id
                .and_then(|id| contacts.iter().position(|contact| contact.id == id))
                .map(|index| index + 1)
                .unwrap_or(0),
            status: STATUSES
                .iter()
                .position(|status| *status == appointment.status)
                .unwrap_or(0),
            category: AppointmentCategory::ALL
                .iter()
                .position(|category| *category == appointment.category)
                .unwrap_or(AppointmentCategory::ALL.len() - 1),
        }
    }

    /// Builds the appointment to store; `base` keeps id and creation time when editing.
    pub fn to_appointment(
        &self,
        base: Option<&Appointment>,
        contacts: &[Contact],
        now: i64,
    ) -> Result<Appointment, &'static str> {
        if self.title.trim().is_empty() {
            return Err("appointments_error_title");
        }
        let day = parse_date(&self.date).ok_or("appointments_error_date")?;
        let end_day = if self.end_date.trim().is_empty() {
            day
        } else {
            parse_date(&self.end_date).ok_or("appointments_error_date")?
        };

        let (starts_at, ends_at) = if self.all_day {
            // All-day entries are stored as half-open day ranges so every view and the iCalendar
            // export work on plain timestamps.
            (day, end_day + DAY_MS)
        } else {
            let time = parse_time(&self.start).ok_or("appointments_error_time")?;
            let end = parse_time(&self.end).ok_or("appointments_error_time")?;
            (day + time, end_day + end)
        };
        if ends_at <= starts_at {
            return Err("appointments_error_end");
        }

        let status = *STATUSES
            .get(self.status)
            .ok_or("appointments_error_status")?;
        let category = *AppointmentCategory::ALL
            .get(self.category)
            .ok_or("appointments_error_category")?;
        let contact_id = self
            .contact
            .checked_sub(1)
            .and_then(|index| contacts.get(index))
            .map(|contact| contact.id);

        let mut appointment = match base {
            Some(appointment) => appointment.clone(),
            None => Appointment {
                id: Uuid::new_v4(),
                contact_id: None,
                title: String::new(),
                location: None,
                notes: None,
                category,
                all_day: self.all_day,
                status,
                starts_at,
                ends_at,
                created_at: now,
                updated_at: now,
            },
        };

        appointment.contact_id = contact_id;
        appointment.title = self.title.trim().to_string();
        appointment.location = non_empty(&self.location);
        appointment.notes = non_empty(&self.notes);
        appointment.category = category;
        appointment.all_day = self.all_day;
        appointment.status = status;
        appointment.starts_at = starts_at;
        appointment.ends_at = ends_at;
        appointment.updated_at = now;

        Ok(appointment)
    }

    /// Applies one of the quick duration buttons; `0` switches to an all-day entry.
    pub fn quick_duration(&mut self, minutes: i64) {
        if minutes <= 0 {
            self.all_day = true;
            return;
        }
        self.all_day = false;
        self.end_date = self.date.clone();
        let start = parse_time(&self.start).unwrap_or(9 * 60 * MINUTE_MS);
        self.end = format_time(start + minutes * MINUTE_MS);
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

fn parse_date(input: &str) -> Option<i64> {
    let parts: Vec<&str> = input.trim().split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let day: u32 = parts[0].parse().ok()?;
    let month: u32 = parts[1].parse().ok()?;
    let year: i64 = parts[2].parse().ok()?;
    if !(1..=12).contains(&month) || day == 0 || day > days_in_month(year as i32, month) {
        return None;
    }
    Some(date::days_from_civil(year, month, day) * DAY_MS)
}

fn parse_time(input: &str) -> Option<i64> {
    let parts: Vec<&str> = input.trim().split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let hours: i64 = parts[0].parse().ok()?;
    let minutes: i64 = parts[1].parse().ok()?;
    if !(0..24).contains(&hours) || !(0..60).contains(&minutes) {
        return None;
    }
    Some((hours * 60 + minutes) * MINUTE_MS)
}

fn format_date(ms: i64) -> String {
    date::format_date(ms)
}

fn format_time(ms: i64) -> String {
    let minutes = ms.rem_euclid(DAY_MS) / MINUTE_MS;
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

fn format_range_ms(starts_at: i64, ends_at: i64) -> String {
    format!("{} – {}", format_time(starts_at), format_time(ends_at))
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

fn contact_name(contacts: &[Contact], id: Option<Uuid>) -> String {
    id.and_then(|id| {
        contacts
            .iter()
            .find(|contact| contact.id == id)
            .map(contact_label)
    })
    .unwrap_or_default()
}

fn status_key(status: AppointmentStatus) -> &'static str {
    match status {
        AppointmentStatus::Scheduled => "appointments_status_scheduled",
        AppointmentStatus::Confirmed => "appointments_status_confirmed",
        AppointmentStatus::Completed => "appointments_status_completed",
        AppointmentStatus::Cancelled => "appointments_status_cancelled",
        AppointmentStatus::NoShow => "appointments_status_no_show",
    }
}

fn status_tone(status: AppointmentStatus) -> Tone {
    match status {
        AppointmentStatus::Scheduled => Tone::Neutral,
        AppointmentStatus::Confirmed => Tone::Accent,
        AppointmentStatus::Completed => Tone::Success,
        AppointmentStatus::Cancelled => Tone::Danger,
        AppointmentStatus::NoShow => Tone::Warning,
    }
}

/// Accent colour of a category; invoices follow their paid and overdue state.
fn category_color(theme: &Theme, entry: &CalendarEntry) -> egui::Color32 {
    if entry.is_invoice() {
        if entry.invoice_overdue {
            return theme.palette.danger;
        }
        if !entry.invoice_paid {
            return egui::Color32::from_rgb(0x4f, 0x46, 0xe5);
        }
    }
    match entry.category {
        AppointmentCategory::Invoice => egui::Color32::from_rgb(0x4f, 0x46, 0xe5),
        AppointmentCategory::Customer => egui::Color32::from_rgb(0x10, 0xb9, 0x81),
        AppointmentCategory::Meeting => egui::Color32::from_rgb(0xf5, 0x9e, 0x0b),
        AppointmentCategory::Deadline => theme.palette.danger,
        AppointmentCategory::Personal => egui::Color32::from_rgb(0x93, 0x33, 0xea),
        AppointmentCategory::General => theme.palette.text_muted,
    }
}

fn month_bounds(calendar: CalendarState) -> (i64, i64) {
    let start = date::start_of_month_ms(calendar.year as i64, calendar.month);
    let next = if calendar.month == 12 {
        date::start_of_month_ms(calendar.year as i64 + 1, 1)
    } else {
        date::start_of_month_ms(calendar.year as i64, calendar.month + 1)
    };
    (start, next)
}

fn day_start(calendar: CalendarState) -> i64 {
    date::days_from_civil(calendar.year as i64, calendar.month, calendar.day) * DAY_MS
}

fn week_bounds(calendar: CalendarState) -> (i64, i64) {
    let start = day_start(calendar);
    let weekday = (start / DAY_MS + 3).rem_euclid(7);
    let monday = start - weekday * DAY_MS;
    (monday, monday + 7 * DAY_MS)
}

fn view_bounds(calendar: CalendarState, view: AppointmentsView) -> (i64, i64) {
    match view {
        AppointmentsView::Month => month_bounds(calendar),
        AppointmentsView::WorkWeek => {
            let (monday, _) = week_bounds(calendar);
            (monday, monday + 5 * DAY_MS)
        }
        AppointmentsView::Week => week_bounds(calendar),
        AppointmentsView::Day => {
            let start = day_start(calendar);
            (start, start + DAY_MS)
        }
    }
}

/// State of the calendar screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppointmentsState {
    /// Search text over title, location, notes and invoice numbers.
    pub query: String,
    /// Appointments in the loaded range.
    pub appointments: Vec<Appointment>,
    /// Read-only invoice due dates in the loaded range.
    pub invoice_events: Vec<InvoiceEvent>,
    /// Contacts selectable in the form.
    pub contacts: Vec<Contact>,
    /// Current view.
    pub view: AppointmentsView,
    /// Day the calendar is centred on.
    pub calendar: CalendarState,
    /// Status filter; `None` shows every status.
    pub status_filter: Option<AppointmentStatus>,
    /// Index into the filter list, `0` meaning every status.
    pub status_choice: usize,
    /// Enabled categories in [`AppointmentCategory::ALL`] order.
    pub categories: [bool; 6],
    /// Whether only invoice due dates are shown.
    pub invoices_only: bool,
    /// Current calendar, detail or form view.
    pub screen: AppointmentsDetail,
    /// Selected appointment, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Selected invoice due date, shown by the detail view.
    pub selected_invoice: Option<Uuid>,
    /// Editable values of the form.
    pub draft: AppointmentDraft,
    /// Dropdown state of the contact select.
    pub contact_popup: PopupState,
    /// Dropdown state of the status select.
    pub status_popup: PopupState,
    /// Dropdown state of the category select.
    pub category_popup: PopupState,
    /// Dropdown state of the status filter.
    pub filter_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_day: i64,
    loaded_view: AppointmentsView,
    loaded_query: String,
    reload: bool,
}

impl Default for AppointmentsState {
    fn default() -> Self {
        Self {
            query: String::new(),
            appointments: Vec::new(),
            invoice_events: Vec::new(),
            contacts: Vec::new(),
            view: AppointmentsView::Month,
            calendar: CalendarState::from_millis(SAMPLE_NOW_MS),
            status_filter: None,
            status_choice: 0,
            categories: [true; 6],
            invoices_only: false,
            screen: AppointmentsDetail::Calendar,
            selected: None,
            selected_invoice: None,
            draft: AppointmentDraft::default(),
            contact_popup: PopupState::default(),
            status_popup: PopupState::default(),
            category_popup: PopupState::default(),
            filter_popup: PopupState::default(),
            confirm_delete: false,
            error: None,
            status: None,
            back: false,
            loaded_day: i64::MIN,
            loaded_view: AppointmentsView::Month,
            loaded_query: String::new(),
            reload: true,
        }
    }
}

impl AppointmentsState {
    /// Creates an empty screen; the first [`AppointmentsState::refresh`] loads the range.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads appointments, contacts and invoice due dates when the range or search changed.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let day = day_start(self.calendar);
        if !self.reload
            && self.loaded_day == day
            && self.loaded_view == self.view
            && self.loaded_query == self.query
        {
            return Ok(());
        }

        let (from, to) = view_bounds(self.calendar, self.view);
        self.appointments = if self.query.trim().is_empty() {
            store.appointments_between(from, to)?
        } else {
            store.search_appointments_between(&self.query, from, to)?
        };
        self.contacts = store.list_contacts()?;
        let invoices = store.list_invoices()?;
        self.invoice_events = invoice_events(&invoices, &self.contacts, socdof_core::now_millis())
            .into_iter()
            .filter(|event| event.starts_at < to && from < event.ends_at)
            .collect();
        self.loaded_day = day;
        self.loaded_view = self.view;
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Whether a category passes the filter.
    pub fn category_enabled(&self, category: AppointmentCategory) -> bool {
        AppointmentCategory::ALL
            .iter()
            .position(|candidate| *candidate == category)
            .map(|index| self.categories[index])
            .unwrap_or(true)
    }

    /// Switches one category on or off.
    pub fn toggle_category(&mut self, category: AppointmentCategory) {
        if let Some(index) = AppointmentCategory::ALL
            .iter()
            .position(|candidate| *candidate == category)
        {
            self.categories[index] = !self.categories[index];
        }
    }

    /// Shows either every entry or only invoice due dates.
    pub fn set_invoices_only(&mut self, only: bool) {
        self.invoices_only = only;
    }

    /// Merged entries of the loaded range after search, status and category filters.
    pub fn entries(&self) -> Vec<CalendarEntry> {
        let query = self.query.trim().to_lowercase();
        let mut entries = Vec::new();
        if !self.invoices_only {
            for appointment in &self.appointments {
                if self
                    .status_filter
                    .is_some_and(|status| appointment.status != status)
                {
                    continue;
                }
                if !self.category_enabled(appointment.category) {
                    continue;
                }
                entries.push(CalendarEntry::from_appointment(appointment));
            }
        }
        if self.category_enabled(AppointmentCategory::Invoice) {
            for event in &self.invoice_events {
                let entry = CalendarEntry::from_invoice(event);
                if !query.is_empty() {
                    let haystack = format!(
                        "{} {} {}",
                        entry.title.to_lowercase(),
                        entry.notes.clone().unwrap_or_default().to_lowercase(),
                        event.number.to_lowercase()
                    );
                    if !haystack.contains(&query) {
                        continue;
                    }
                }
                entries.push(entry);
            }
        }
        entries.sort_by(|left, right| {
            left.starts_at
                .cmp(&right.starts_at)
                .then_with(|| left.title.cmp(&right.title))
        });
        entries
    }

    /// Selected appointment, if it is still part of the loaded range.
    pub fn current(&self) -> Option<&Appointment> {
        self.selected
            .and_then(|id| self.appointments.iter().find(|item| item.id == id))
    }

    /// Selected invoice due date, if it is still part of the loaded range.
    pub fn current_invoice(&self) -> Option<&InvoiceEvent> {
        self.selected_invoice.and_then(|id| {
            self.invoice_events
                .iter()
                .find(|item| item.invoice_id == id)
        })
    }

    /// Selected entry of either source.
    pub fn current_entry(&self) -> Option<CalendarEntry> {
        if let Some(appointment) = self.current() {
            return Some(CalendarEntry::from_appointment(appointment));
        }
        self.current_invoice().map(CalendarEntry::from_invoice)
    }

    /// Exports the currently filtered entries as an iCalendar file.
    pub fn export_ics(
        &self,
        path: &std::path::Path,
        generated_at_ms: i64,
    ) -> socdof_core::CoreResult<u64> {
        let appointments = self
            .entries()
            .into_iter()
            .map(|entry| appointment_from_entry(&entry))
            .collect::<Vec<_>>();
        let content = export_appointments_ics(&appointments, generated_at_ms);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(content.len() as u64)
    }

    /// Switches the view and reloads its range.
    pub fn set_view(&mut self, view: AppointmentsView) {
        self.view = view;
        self.reload = true;
    }

    /// Moves the calendar one month, week or day forward or back.
    pub fn shift(&mut self, forward: bool) {
        match self.view {
            AppointmentsView::Month => {
                if forward {
                    self.calendar.next_month();
                } else {
                    self.calendar.previous_month();
                }
            }
            AppointmentsView::WorkWeek | AppointmentsView::Week => {
                let delta = if forward { 7 } else { -7 };
                self.calendar =
                    CalendarState::from_millis(day_start(self.calendar) + delta * DAY_MS);
            }
            AppointmentsView::Day => {
                let delta = if forward { 1 } else { -1 };
                self.calendar =
                    CalendarState::from_millis(day_start(self.calendar) + delta * DAY_MS);
            }
        }
        self.reload = true;
    }

    /// Centres the calendar on today.
    pub fn go_today(&mut self, now: i64) {
        self.calendar = CalendarState::from_millis(now);
        self.reload = true;
    }

    /// Selects a day in the current month and opens the day view.
    pub fn open_day(&mut self, day: u32) {
        self.calendar.day = day;
        self.view = AppointmentsView::Day;
        self.reload = true;
    }

    /// Restricts the agenda to one status; `None` shows every status.
    pub fn filter_status(&mut self, status: Option<AppointmentStatus>) {
        self.status_filter = status;
        self.status_choice = status
            .and_then(|status| STATUSES.iter().position(|candidate| *candidate == status))
            .map(|index| index + 1)
            .unwrap_or(0);
    }

    /// Opens the detail view of an appointment.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.selected_invoice = None;
        self.screen = AppointmentsDetail::Detail;
    }

    /// Opens the detail view of an invoice due date.
    pub fn select_invoice(&mut self, id: Uuid) {
        self.selected = None;
        self.selected_invoice = Some(id);
        self.screen = AppointmentsDetail::Detail;
    }

    /// Opens the detail view of either entry source.
    pub fn select_entry(&mut self, id: EntryId) {
        match id {
            EntryId::Appointment(id) => self.select(id),
            EntryId::Invoice(id) => self.select_invoice(id),
        }
    }

    /// Opens an empty form on the selected day.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.selected_invoice = None;
        self.draft = AppointmentDraft {
            title: String::new(),
            date: self.calendar.formatted(),
            start: "09:00".to_string(),
            end_date: self.calendar.formatted(),
            end: "10:00".to_string(),
            all_day: false,
            location: String::new(),
            notes: String::new(),
            contact: 0,
            status: 0,
            category: AppointmentCategory::ALL.len() - 1,
        };
        self.error = None;
        self.status = None;
        self.screen = AppointmentsDetail::Form;
    }

    /// Opens the form with the selected appointment.
    pub fn start_edit(&mut self) {
        let Some(appointment) = self.current() else {
            return;
        };
        self.draft = AppointmentDraft::from_appointment(appointment, &self.contacts);
        self.error = None;
        self.status = None;
        self.screen = AppointmentsDetail::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.screen = if self.selected.is_some() {
            AppointmentsDetail::Detail
        } else {
            AppointmentsDetail::Calendar
        };
    }

    /// Validates, checks overlapping open slots and stores the draft.
    ///
    /// Validation and conflict failures set [`AppointmentsState::error`] and return `Ok(())`;
    /// storage errors are returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let appointment = match self
            .draft
            .to_appointment(base.as_ref(), &self.contacts, now)
        {
            Ok(appointment) => appointment,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(());
            }
        };

        if let Err(code) = appointment.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        // All-day entries intentionally overlap; only timed slots are checked, as in the template.
        if appointment.status.is_open()
            && !appointment.all_day
            && !store.appointment_conflicts(&appointment)?.is_empty()
        {
            self.error = Some("appointments_error_conflict");
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_appointment(&appointment)?;
        } else {
            store.insert_appointment(&appointment)?;
        }

        self.selected = Some(appointment.id);
        self.selected_invoice = None;
        self.calendar = CalendarState::from_millis(appointment.starts_at);
        self.screen = AppointmentsDetail::Detail;
        self.error = None;
        self.status = Some("appointments_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Copies the selected entry into a new local appointment.
    pub fn duplicate_selected(
        &mut self,
        store: &Store,
        now: i64,
        suffix: &str,
    ) -> socdof_core::CoreResult<()> {
        let Some(entry) = self.current_entry() else {
            return Ok(());
        };
        let mut copy = if let Some(appointment) = self.current() {
            appointment.clone()
        } else {
            appointment_from_entry(&entry)
        };
        copy.id = Uuid::new_v4();
        copy.title = format!("{} {}", copy.title, suffix);
        copy.contact_id = entry.contact_id;
        copy.created_at = now;
        copy.updated_at = now;
        store.insert_appointment(&copy)?;

        self.selected = Some(copy.id);
        self.selected_invoice = None;
        self.screen = AppointmentsDetail::Detail;
        self.error = None;
        self.status = Some("appointments_duplicated");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected appointment after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_appointment(id)?;
        self.selected = None;
        self.selected_invoice = None;
        self.screen = AppointmentsDetail::Calendar;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("appointments_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Moves the selected appointment to another lifecycle state.
    pub fn set_status(
        &mut self,
        store: &Store,
        status: AppointmentStatus,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let Some(mut appointment) = self.current().cloned() else {
            return Ok(());
        };
        appointment.status = status;
        appointment.updated_at = now;

        if status.is_open()
            && !appointment.all_day
            && !store.appointment_conflicts(&appointment)?.is_empty()
        {
            self.error = Some("appointments_error_conflict");
            return Ok(());
        }

        store.update_appointment(&appointment)?;
        self.error = None;
        self.status = Some("appointments_status_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }
}

fn appointment_from_entry(entry: &CalendarEntry) -> Appointment {
    Appointment {
        id: match entry.id {
            EntryId::Appointment(id) | EntryId::Invoice(id) => id,
        },
        contact_id: entry.contact_id,
        title: entry.title.clone(),
        location: entry.location.clone(),
        notes: entry.notes.clone(),
        category: entry.category,
        all_day: entry.all_day,
        status: entry.status,
        starts_at: entry.starts_at,
        ends_at: entry.ends_at,
        created_at: entry.starts_at,
        updated_at: entry.starts_at,
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "title_required" => "appointments_error_title",
        "start_required" => "appointments_error_start",
        "end_before_start" => "appointments_error_end",
        _ => "appointments_error_save",
    }
}

fn sample_at(calendar: CalendarState, day: u32, hour: i64, minute: i64) -> i64 {
    date::days_from_civil(calendar.year as i64, calendar.month, day) * DAY_MS
        + hour * 60 * MINUTE_MS
        + minute * MINUTE_MS
}

/// Seeds four deterministic appointments for the gallery and the golden snapshots.
///
/// The sample sits in the month of [`SAMPLE_NOW_MS`] and is a no-op when the store already has
/// appointments, so it never overwrites data.
pub fn seed_appointments(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if !store.list_appointments()?.is_empty() {
        return Ok(());
    }

    let calendar = CalendarState::from_millis(SAMPLE_NOW_MS);
    let location = texts.get("appointments_sample_location").to_string();
    let note = texts.get("appointments_sample_notes").to_string();
    let samples = [
        (
            texts.get("appointments_sample_kickoff"),
            day_of_month(calendar),
            9,
            0,
            60,
            AppointmentStatus::Confirmed,
            AppointmentCategory::Customer,
            false,
        ),
        (
            texts.get("appointments_sample_consulting"),
            9,
            14,
            0,
            90,
            AppointmentStatus::Scheduled,
            AppointmentCategory::Meeting,
            false,
        ),
        (
            texts.get("appointments_sample_workshop"),
            12,
            10,
            0,
            120,
            AppointmentStatus::Confirmed,
            AppointmentCategory::Customer,
            false,
        ),
        (
            texts.get("appointments_sample_followup"),
            20,
            16,
            0,
            30,
            AppointmentStatus::Scheduled,
            AppointmentCategory::General,
            false,
        ),
        (
            texts.get("appointments_sample_inventory"),
            26,
            0,
            0,
            0,
            AppointmentStatus::Confirmed,
            AppointmentCategory::Deadline,
            true,
        ),
    ];

    for (title, day, hour, minute, duration, status, category, all_day) in samples {
        let starts_at = sample_at(calendar, day, hour, minute);
        store.insert_appointment(&Appointment {
            id: Uuid::new_v4(),
            contact_id: None,
            title: title.to_string(),
            location: Some(location.clone()),
            notes: Some(note.clone()),
            category,
            all_day,
            status,
            starts_at,
            ends_at: if all_day {
                starts_at + DAY_MS
            } else {
                starts_at + duration * MINUTE_MS
            },
            created_at: starts_at,
            updated_at: starts_at,
        })?;
    }

    Ok(())
}

fn day_of_month(calendar: CalendarState) -> u32 {
    calendar.day.max(1)
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("calendar"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &AppointmentsState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}
/// Renders the calendar screen into the context.
/// Renders appointments in the full application work area.
pub fn appointments(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
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
            appointments_window(ctx, true, ui, theme, texts, focus, state, store, now);
        });
}
/// Renders appointments inside one native desktop child window.
#[allow(clippy::too_many_arguments)]
pub fn appointments_window(
    ctx: &Context,
    active: bool,
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
    now: i64,
) {
    if active && !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.screen {
            AppointmentsDetail::Calendar => state.back = true,
            AppointmentsDetail::Detail => state.screen = AppointmentsDetail::Calendar,
            AppointmentsDetail::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("appointments_error_load");
    }

    egui::ScrollArea::vertical().show(ui, |ui| match state.screen {
        AppointmentsDetail::Calendar => calendar_view(ui, theme, texts, focus, state, store, now),
        AppointmentsDetail::Detail => detail_view(ui, theme, texts, focus, state, store, now),
        AppointmentsDetail::Form => form_view(ui, theme, texts, focus, state, store, now),
    });

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("appointments_delete_title"),
            |ui| {
                ui.label(texts.get("appointments_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("appointments_delete_confirm"),
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
                        texts.get("appointments_delete_cancel"),
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
        state.error = Some("appointments_error_delete");
    }
}

fn calendar_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
    now: i64,
) {
    let count = state.entries().len();
    let subtitle = format!(
        "{} · {}",
        texts.count("count_appointments", count),
        texts.get("appointments_subtitle"),
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("appointments_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    #[cfg(feature = "dialogs")]
    let mut export_ics = false;
    ui.horizontal_wrapped(|ui| {
        for view in [
            AppointmentsView::Month,
            AppointmentsView::WorkWeek,
            AppointmentsView::Week,
            AppointmentsView::Day,
        ] {
            let variant = if state.view == view {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(view.label_key()), variant).activated {
                state.set_view(view);
            }
        }
    });
    ui.add_space(4.0);
    // The search field grows with the row, so it gets a row of its own; beside it the status
    // filter and the two actions still fit on the desktop and wrap on the phone.
    ui.horizontal_wrapped(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("appointments_search"),
            210.0,
        );
        let mut names: Vec<String> = vec![texts.get("appointments_all_statuses").to_string()];
        names.extend(
            STATUSES
                .iter()
                .map(|status| texts.get(status_key(*status)).to_string()),
        );
        let labels: Vec<&str> = names.iter().map(String::as_str).collect();
        let previous = state.status_choice;
        select(
            ui,
            theme,
            focus,
            &mut state.filter_popup,
            "appointments-status-filter",
            &mut state.status_choice,
            &labels,
        );
        if state.status_choice != previous {
            let status = state
                .status_choice
                .checked_sub(1)
                .and_then(|index| STATUSES.get(index))
                .copied();
            state.filter_status(status);
        }
        #[cfg(feature = "dialogs")]
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_export_ics"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            export_ics = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });

    // Category chips and the invoice-only switch mirror the category list of the template.
    ui.add_space(4.0);
    ui.horizontal_wrapped(|ui| {
        for category in AppointmentCategory::ALL {
            let enabled = state.category_enabled(category);
            let variant = if enabled {
                ButtonVariant::Secondary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(category.label_key()), variant).activated {
                state.toggle_category(category);
            }
        }
        ui.add_space(8.0);
        let variant = if state.invoices_only {
            ButtonVariant::Secondary
        } else {
            ButtonVariant::Ghost
        };
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_invoices_only"),
            variant,
        )
        .activated
        {
            state.set_invoices_only(!state.invoices_only);
        }
    });

    if create {
        state.start_new();
        return;
    }
    #[cfg(feature = "dialogs")]
    if export_ics {
        let (year, month, day) = socdof_core::date::civil_from_millis(now);
        let filename = format!("socdof-kalender-{year:04}-{month:02}-{day:02}.ics");
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name(&filename)
            .add_filter("iCalendar", &["ics"])
            .save_file()
        {
            match state.export_ics(&path, now) {
                Ok(_) => state.status = Some("appointments_exported"),
                Err(_) => state.error = Some("appointments_error_export"),
            }
        }
    }

    ui.add_space(8.0);
    // On the phone the range label had only ~200 px left after the navigation buttons and was
    // cut off at the panel edge; there it gets its own line under them.
    let narrow = ui.available_width() < crate::components::FORM_STACK_WIDTH;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_previous"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.shift(false);
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_today"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.go_today(now);
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_next"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.shift(true);
        }
        if !narrow {
            ui.add_space(8.0);
            ui.label(RichText::new(range_label(state, texts)).strong());
        }
    });
    if narrow {
        ui.label(RichText::new(range_label(state, texts)).strong());
    }

    ui.add_space(8.0);
    match state.view {
        AppointmentsView::Month => month_view(ui, theme, texts, focus, state, store),
        AppointmentsView::WorkWeek => week_view(ui, theme, texts, focus, state, 5),
        AppointmentsView::Week => week_view(ui, theme, texts, focus, state, 7),
        AppointmentsView::Day => day_view(ui, theme, texts, focus, state),
    }

    ui.add_space(12.0);
    agenda(ui, theme, texts, focus, state);
}

fn range_label(state: &AppointmentsState, texts: &UiTexts) -> String {
    match state.view {
        AppointmentsView::Month => {
            let month_key = [
                "month_1", "month_2", "month_3", "month_4", "month_5", "month_6", "month_7",
                "month_8", "month_9", "month_10", "month_11", "month_12",
            ][(state.calendar.month - 1) as usize];
            format!("{} {}", texts.get(month_key), state.calendar.year)
        }
        AppointmentsView::WorkWeek | AppointmentsView::Week => {
            let (from, _) = week_bounds(state.calendar);
            format!(
                "{} – {}",
                format_date(from),
                format_date(from + (state.view.days() - 1) * DAY_MS)
            )
        }
        AppointmentsView::Day => state.calendar.formatted(),
    }
}

fn entry_time(entry: &CalendarEntry, texts: &UiTexts) -> String {
    if entry.all_day {
        texts.get("appointments_all_day").to_string()
    } else {
        format_range_ms(entry.starts_at, entry.ends_at)
    }
}

fn entry_date(entry: &CalendarEntry) -> String {
    if entry.day_count() > 1 {
        format!(
            "{} – {}",
            format_date(entry.starts_at),
            format_date(entry.ends_at - 1)
        )
    } else {
        format_date(entry.starts_at)
    }
}

fn entry_duration(entry: &CalendarEntry, texts: &UiTexts) -> String {
    if entry.all_day {
        format!("{} {}", entry.day_count(), texts.get("appointments_days"))
    } else {
        let minutes = (entry.ends_at - entry.starts_at) / MINUTE_MS;
        format!("{minutes} {}", texts.get("appointments_minutes"))
    }
}

/// Shortens a label to a character budget so a wide invoice title cannot widen a grid column.
fn truncate_label(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut shortened = text.chars().take(limit).collect::<String>();
    shortened.push('…');
    shortened
}

fn category_dot(ui: &mut egui::Ui, color: egui::Color32) {
    let (rect, _) = ui.allocate_exact_size(egui::Vec2::new(10.0, 10.0), egui::Sense::hover());
    ui.painter().circle_filled(rect.center(), 4.0, color);
}

/// Ghost button of an entry title that shortens long invoice or customer names with an ellipsis
/// instead of growing past the panel.
fn text_button(
    ui: &mut egui::Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    variant: ButtonVariant,
) -> crate::components::Activated {
    let max_width = (ui.available_width() - 8.0).max(80.0);
    let font = egui::FontId::proportional(FONT_BODY);
    let measure = |text: &str| {
        ui.painter()
            .layout_no_wrap(text.to_owned(), font.clone(), theme.palette.text)
            .size()
            .x
    };
    if measure(label) + 28.0 <= max_width {
        return button(ui, theme, focus, label, variant);
    }
    let mut characters: Vec<char> = label.chars().collect();
    while !characters.is_empty() {
        characters.pop();
        let candidate = format!("{}…", characters.iter().collect::<String>());
        if measure(&candidate) + 28.0 <= max_width {
            return button(ui, theme, focus, &candidate, variant);
        }
    }
    button(ui, theme, focus, "…", variant)
}

fn month_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
) {
    let cells = month_grid(state.calendar.year, state.calendar.month);
    let calendar = state.calendar;
    let entries = state.entries();
    let mut clicked = None;
    card(ui, theme, |ui| {
        if ui.available_width() < crate::components::FORM_STACK_WIDTH {
            // Seven day buttons with 28 px padding reached 391.8 px content at 360-412 px. The
            // compact grid sizes every cell from the width that is actually left.
            let spacing = 2.0;
            let cell = ((ui.available_width() - spacing * 6.0) / 7.0).max(28.0);
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = spacing;
                for index in 1..=7 {
                    let (rect, _) =
                        ui.allocate_exact_size(egui::Vec2::new(cell, 18.0), egui::Sense::hover());
                    ui.painter().text(
                        rect.center(),
                        egui::Align2::CENTER_CENTER,
                        texts.get(&format!("weekday_{index}")),
                        egui::FontId::proportional(FONT_SMALL),
                        theme.palette.text_muted,
                    );
                }
            });
            let weekday_width = spacing * 6.0 + cell * 7.0;
            let left = ui.min_rect().left();
            for row in 0..6 {
                let top = ui.cursor().top();
                for column in 0..7 {
                    let day = cells[row * 7 + column];
                    let Some(day) = day else {
                        continue;
                    };
                    let rect = egui::Rect::from_min_size(
                        egui::Pos2::new(left + column as f32 * (cell + spacing), top),
                        egui::Vec2::new(cell, 40.0),
                    );
                    let response =
                        ui.interact(rect, ui.id().with((row, column)), egui::Sense::click());
                    let selected = calendar.day == day;
                    let painter = ui.painter();
                    if selected {
                        painter.rect(
                            rect.shrink(2.0),
                            egui::Rounding::same(8.0),
                            theme.accent.base,
                            egui::Stroke::NONE,
                        );
                    }
                    painter.text(
                        rect.center(),
                        egui::Align2::CENTER_CENTER,
                        day.to_string(),
                        egui::FontId::proportional(FONT_BODY),
                        if selected {
                            theme.palette.accent_on
                        } else {
                            theme.palette.text
                        },
                    );
                    let start = sample_at(calendar, day, 0, 0);
                    let count = entries
                        .iter()
                        .filter(|entry| entry.overlaps(start, start + DAY_MS))
                        .count();
                    if count > 0 {
                        painter.text(
                            egui::Pos2::new(rect.center().x, rect.bottom() - 4.0),
                            egui::Align2::CENTER_BOTTOM,
                            count.to_string(),
                            egui::FontId::proportional(FONT_SMALL),
                            theme.accent.base,
                        );
                    }
                    if response.clicked() {
                        clicked = Some(day);
                    }
                }
                ui.advance_cursor_after_rect(egui::Rect::from_min_size(
                    egui::Pos2::new(left, top),
                    egui::Vec2::new(weekday_width, 40.0),
                ));
            }
        } else {
            let column = ((ui.available_width() - 36.0) / 7.0).max(80.0);
            egui::Grid::new("socdof-calendar-month")
                .num_columns(7)
                .min_col_width(column)
                .spacing(egui::vec2(6.0, 6.0))
                .show(ui, |ui| {
                    for index in 1..=7 {
                        ui.label(
                            RichText::new(texts.get(&format!("weekday_{index}")))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for row in 0..6 {
                        for column in 0..7 {
                            let day = cells[row * 7 + column];
                            ui.vertical(|ui| {
                                if let Some(day) = day {
                                    let start = sample_at(calendar, day, 0, 0);
                                    let day_entries: Vec<&CalendarEntry> = entries
                                        .iter()
                                        .filter(|entry| entry.overlaps(start, start + DAY_MS))
                                        .collect();
                                    let selected = calendar.day == day;
                                    let variant = if selected {
                                        ButtonVariant::Primary
                                    } else {
                                        ButtonVariant::Ghost
                                    };
                                    if button(ui, theme, focus, &day.to_string(), variant).activated
                                    {
                                        clicked = Some(day);
                                    }
                                    for entry in day_entries.iter().take(2) {
                                        ui.horizontal(|ui| {
                                            category_dot(ui, category_color(theme, entry));
                                            ui.label(
                                                RichText::new(truncate_label(&entry.title, 18))
                                                    .size(FONT_SMALL)
                                                    .color(theme.palette.text_muted),
                                            );
                                        });
                                    }
                                    if day_entries.len() > 2 {
                                        ui.label(
                                            RichText::new(format!("+{}", day_entries.len() - 2))
                                                .size(FONT_SMALL)
                                                .color(theme.accent.base),
                                        );
                                    }
                                }
                            });
                        }
                        ui.end_row();
                    }
                });
        }
    });

    if let Some(day) = clicked {
        state.open_day(day);
        state.reload = true;
        if state.refresh(store).is_err() {
            state.error = Some("appointments_error_load");
        }
    }
}

fn week_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    days: i64,
) {
    let (monday, _) = week_bounds(state.calendar);
    let entries = state.entries();
    let mut chosen = None;
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        // All-day entries get their own banner above the columns, like the reference layout.
        let all_day: Vec<&CalendarEntry> = entries
            .iter()
            .filter(|entry| entry.all_day && entry.overlaps(monday, monday + days * DAY_MS))
            .collect();
        if !all_day.is_empty() {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(texts.get("appointments_all_day"))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                for entry in all_day {
                    category_dot(ui, category_color(theme, entry));
                    if text_button(ui, theme, focus, &entry.title, ButtonVariant::Ghost).activated {
                        chosen = Some(entry.id);
                    }
                }
            });
            ui.add_space(6.0);
        }

        if ui.available_width() < crate::components::FORM_STACK_WIDTH {
            // Seven day columns side by side reached 561 px; on the phone each day gets a block
            // that spans the card so appointment titles keep the full panel width.
            ui.set_min_width(ui.available_width());
            for offset in 0..days {
                let start = monday + offset * DAY_MS;
                ui.label(
                    RichText::new(format_date(start))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                let items: Vec<&CalendarEntry> = entries
                    .iter()
                    .filter(|entry| !entry.all_day && entry.overlaps(start, start + DAY_MS))
                    .collect();
                if items.is_empty() {
                    ui.label(
                        RichText::new("—")
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                for entry in items {
                    ui.horizontal(|ui| {
                        category_dot(ui, category_color(theme, entry));
                        let title = ui.add(
                            egui::Label::new(truncate_label(&entry.title, 38))
                                .sense(egui::Sense::click()),
                        );
                        if title.clicked() || focus.activate(title.id) {
                            chosen = Some(entry.id);
                        }
                    });
                    ui.label(
                        RichText::new(format_range_ms(entry.starts_at, entry.ends_at))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                ui.add_space(4.0);
            }
            return;
        }
        ui.columns(days as usize, |columns| {
            for (offset, ui) in columns.iter_mut().enumerate() {
                let start = monday + offset as i64 * DAY_MS;
                {
                    ui.label(
                        RichText::new(format_date(start))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                    let items: Vec<&CalendarEntry> = entries
                        .iter()
                        .filter(|entry| !entry.all_day && entry.overlaps(start, start + DAY_MS))
                        .collect();
                    if items.is_empty() {
                        ui.label(
                            RichText::new("—")
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                    for entry in items {
                        ui.horizontal(|ui| {
                            category_dot(ui, category_color(theme, entry));
                            if text_button(ui, theme, focus, &entry.title, ButtonVariant::Ghost)
                                .activated
                            {
                                chosen = Some(entry.id);
                            }
                        });
                        ui.label(
                            RichText::new(format_range_ms(entry.starts_at, entry.ends_at))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                }
            }
        });
    });
    if let Some(id) = chosen {
        state.select_entry(id);
    }
}

fn day_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
) {
    let start = day_start(state.calendar);
    let entries = state.entries();
    let mut chosen = None;
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.label(
            RichText::new(state.calendar.formatted())
                .size(FONT_SMALL)
                .strong()
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        let items: Vec<&CalendarEntry> = entries
            .iter()
            .filter(|entry| entry.overlaps(start, start + DAY_MS))
            .collect();
        if items.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("appointments_empty_title"),
                texts.get("appointments_empty_hint"),
            );
        }
        for entry in items {
            ui.horizontal(|ui| {
                category_dot(ui, category_color(theme, entry));
                ui.label(
                    RichText::new(entry_time(entry, texts))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                if text_button(ui, theme, focus, &entry.title, ButtonVariant::Ghost).activated {
                    chosen = Some(entry.id);
                }
                badge(
                    ui,
                    theme,
                    texts.get(entry.category.label_key()),
                    if entry.is_invoice() {
                        Tone::Accent
                    } else {
                        status_tone(entry.status)
                    },
                );
            });
        }
    });
    if let Some(id) = chosen {
        state.select_entry(id);
    }
}

fn agenda(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
) {
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.label(RichText::new(texts.get("appointments_agenda")).strong());
        ui.add_space(6.0);
        let items = state.entries();
        if items.is_empty() {
            let searching = !state.query.trim().is_empty()
                || state.status_filter.is_some()
                || state.invoices_only
                || state.categories.iter().any(|enabled| !enabled);
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("appointments_no_results"),
                    texts.get("appointments_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("appointments_empty_title"),
                    texts.get("appointments_empty_hint"),
                );
            }
            return;
        }

        let mut chosen = None;
        // The agenda is a list, not a table: the title keeps the full panel width and the
        // remaining values follow on a second line, which also holds on the phone.
        for entry in &items {
            ui.horizontal(|ui| {
                category_dot(ui, category_color(theme, entry));
                if text_button(ui, theme, focus, &entry.title, ButtonVariant::Ghost).activated {
                    chosen = Some(entry.id);
                }
            });
            ui.horizontal_wrapped(|ui| {
                ui.add_space(18.0);
                ui.label(
                    RichText::new(format!(
                        "{} · {} · {}",
                        entry_date(entry),
                        entry_time(entry, texts),
                        texts.get(entry.category.label_key())
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                let (label, tone) = if entry.is_invoice() {
                    (texts.get("appointments_category_invoice"), Tone::Accent)
                } else {
                    (
                        texts.get(status_key(entry.status)),
                        status_tone(entry.status),
                    )
                };
                badge(ui, theme, label, tone);
            });
            ui.add_space(6.0);
        }
        if let Some(id) = chosen {
            state.select_entry(id);
        }
    });
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
    now: i64,
) {
    let Some(entry) = state.current_entry() else {
        state.screen = AppointmentsDetail::Calendar;
        return;
    };

    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("appointments_detail_title"),
        &entry.title,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            category_dot(ui, category_color(theme, &entry));
            ui.label(RichText::new(&entry.title).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(entry.category.label_key()),
                if entry.is_invoice() {
                    Tone::Accent
                } else {
                    status_tone(entry.status)
                },
            );
            if entry.is_invoice() {
                let (label, tone) = if entry.invoice_overdue {
                    ("appointments_invoice_overdue", Tone::Danger)
                } else if entry.invoice_paid {
                    ("appointments_invoice_paid", Tone::Success)
                } else {
                    ("appointments_invoice_open", Tone::Warning)
                };
                badge(ui, theme, texts.get(label), tone);
            }
        });
        ui.add_space(8.0);
        let mut rows = vec![
            ("appointments_date", entry_date(&entry)),
            ("appointments_start", entry_time(&entry, texts)),
            ("appointments_duration", entry_duration(&entry, texts)),
            (
                "appointments_category",
                texts.get(entry.category.label_key()).to_string(),
            ),
        ];
        if !entry.is_invoice() {
            rows.push((
                "appointments_contact",
                contact_name(&state.contacts, entry.contact_id),
            ));
        }
        if let Some(number) = &entry.invoice_number {
            rows.push(("appointments_invoice_number", format!("#{number}")));
        }
        for (label, value) in rows {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(value);
            });
        }
        if let Some(location) = &entry.location {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get("appointments_location"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(location);
            });
        }
        if let Some(notes) = &entry.notes {
            ui.add_space(6.0);
            ui.label(RichText::new(notes).size(FONT_SMALL));
        }
    });

    ui.add_space(12.0);
    let mut next_status = None;
    let mut edit = false;
    let mut duplicate = false;
    let mut delete = false;
    ui.horizontal_wrapped(|ui| {
        if !entry.is_invoice() {
            if entry.status != AppointmentStatus::Confirmed
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("appointments_mark_confirmed"),
                    ButtonVariant::Secondary,
                )
                .activated
            {
                next_status = Some(AppointmentStatus::Confirmed);
            }
            if entry.status != AppointmentStatus::Completed
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("appointments_mark_completed"),
                    ButtonVariant::Primary,
                )
                .activated
            {
                next_status = Some(AppointmentStatus::Completed);
            }
            if entry.status != AppointmentStatus::Cancelled {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("appointments_mark_cancelled"),
                    ButtonVariant::Danger,
                )
                .activated
                {
                    next_status = Some(AppointmentStatus::Cancelled);
                }
            } else if button(
                ui,
                theme,
                focus,
                texts.get("appointments_reopen"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                next_status = Some(AppointmentStatus::Scheduled);
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("appointments_edit"),
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
                texts.get("appointments_delete"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                delete = true;
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_duplicate"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            duplicate = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("appointments_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.screen = AppointmentsDetail::Calendar;
        }
    });

    if duplicate
        && state
            .duplicate_selected(store, now, texts.get("appointments_copy_suffix"))
            .is_err()
    {
        state.error = Some("appointments_error_save");
    }
    if let Some(status) = next_status {
        if state.set_status(store, status, now).is_err() {
            state.error = Some("appointments_error_status");
        }
    }
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("appointments_edit_title")
    } else {
        texts.get("appointments_new_title")
    };
    let subtitle = texts.get("appointments_subtitle").to_string();
    screen_header(ui, theme, texts, focus, state, title, &subtitle);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut save = false;
    let mut cancel = false;
    let mut quick: Option<i64> = None;
    card(ui, theme, |ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.title,
            texts.get("appointments_title_label"),
            texts.get("appointments_title_hint"),
            None,
        );
        ui.add_space(6.0);
        let stack = ui.available_width() < crate::components::FORM_STACK_WIDTH;
        if stack {
            for (value, label, hint) in [
                (
                    &mut state.draft.date,
                    texts.get("appointments_date"),
                    texts.get("appointments_date_hint"),
                ),
                (
                    &mut state.draft.end_date,
                    texts.get("appointments_end_date"),
                    texts.get("appointments_date_hint"),
                ),
            ] {
                text_field(ui, theme, focus, value, label, hint, None);
                ui.add_space(4.0);
            }
        } else {
            ui.columns(2, |columns| {
                text_field(
                    &mut columns[0],
                    theme,
                    focus,
                    &mut state.draft.date,
                    texts.get("appointments_date"),
                    texts.get("appointments_date_hint"),
                    None,
                );
                text_field(
                    &mut columns[1],
                    theme,
                    focus,
                    &mut state.draft.end_date,
                    texts.get("appointments_end_date"),
                    texts.get("appointments_date_hint"),
                    None,
                );
            });
        }
        let mut all_day = state.draft.all_day;
        if switch(
            ui,
            theme,
            focus,
            &mut all_day,
            texts.get("appointments_all_day"),
        )
        .activated
        {
            state.draft.all_day = all_day;
        }
        if !state.draft.all_day {
            ui.add_space(4.0);
            if stack {
                for (value, label, hint) in [
                    (
                        &mut state.draft.start,
                        texts.get("appointments_start"),
                        texts.get("appointments_start_hint"),
                    ),
                    (
                        &mut state.draft.end,
                        texts.get("appointments_end_time"),
                        texts.get("appointments_start_hint"),
                    ),
                ] {
                    text_field(ui, theme, focus, value, label, hint, None);
                    ui.add_space(4.0);
                }
            } else {
                ui.columns(2, |columns| {
                    text_field(
                        &mut columns[0],
                        theme,
                        focus,
                        &mut state.draft.start,
                        texts.get("appointments_start"),
                        texts.get("appointments_start_hint"),
                        None,
                    );
                    text_field(
                        &mut columns[1],
                        theme,
                        focus,
                        &mut state.draft.end,
                        texts.get("appointments_end_time"),
                        texts.get("appointments_start_hint"),
                        None,
                    );
                });
            }
            ui.add_space(4.0);
            ui.horizontal_wrapped(|ui| {
                for (label, minutes) in [
                    ("15m", 15_i64),
                    ("30m", 30),
                    ("45m", 45),
                    ("1h", 60),
                    ("2h", 120),
                ] {
                    if button(ui, theme, focus, label, ButtonVariant::Ghost).activated {
                        quick = Some(minutes);
                    }
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("appointments_all_day"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    quick = Some(0);
                }
            });
        }
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.location,
            texts.get("appointments_location"),
            texts.get("appointments_location_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.notes,
            texts.get("appointments_notes"),
            texts.get("appointments_notes_hint"),
            None,
        );
        ui.add_space(6.0);
        let select_width = ui.available_width();
        let stack_selects = select_width < crate::components::FORM_STACK_WIDTH;
        let mut contact_names: Vec<String> = vec![texts.get("appointments_no_contact").to_string()];
        contact_names.extend(state.contacts.iter().map(contact_label));
        let contact_labels: Vec<&str> = contact_names.iter().map(String::as_str).collect();
        let status_names: Vec<String> = STATUSES
            .iter()
            .map(|status| texts.get(status_key(*status)).to_string())
            .collect();
        let status_labels: Vec<&str> = status_names.iter().map(String::as_str).collect();
        let category_names: Vec<String> = AppointmentCategory::ALL
            .iter()
            .map(|category| texts.get(category.label_key()).to_string())
            .collect();
        let category_labels: Vec<&str> = category_names.iter().map(String::as_str).collect();
        let row = |ui: &mut egui::Ui,
                   theme: &Theme,
                   focus: &mut FocusState,
                   state: &mut AppointmentsState| {
            ui.label(
                RichText::new(texts.get("appointments_contact"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                ui,
                theme,
                focus,
                &mut state.contact_popup,
                "appointment-contact",
                &mut state.draft.contact,
                &contact_labels,
            );
            ui.add_space(12.0);
            ui.label(
                RichText::new(texts.get("appointments_status"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                ui,
                theme,
                focus,
                &mut state.status_popup,
                "appointment-status",
                &mut state.draft.status,
                &status_labels,
            );
            ui.add_space(12.0);
            ui.label(
                RichText::new(texts.get("appointments_category"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                ui,
                theme,
                focus,
                &mut state.category_popup,
                "appointment-category",
                &mut state.draft.category,
                &category_labels,
            );
        };
        if stack_selects {
            row(ui, theme, focus, state);
        } else {
            ui.horizontal(|ui| row(ui, theme, focus, state));
        }
    });

    if let Some(minutes) = quick {
        state.draft.quick_duration(minutes);
    }

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("appointments_save"),
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
                texts.get("appointments_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("appointments_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::contact::ContactKind;
    use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
    use socdof_core::domain::settings::Language;
    use socdof_core::money::Money;

    fn seeded() -> (Store, AppointmentsState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_appointments(&store, &texts).expect("seed");
        let mut state = AppointmentsState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut AppointmentsState, store: &Store) -> String {
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
                appointments(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("appointment frame")).join("\n")
    }

    fn insert_open_invoice(store: &Store, texts: &UiTexts) -> Invoice {
        let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
        contact.name = Some(texts.get("appointments_sample_contact").to_string());
        store.insert_contact(&contact).expect("contact");
        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-0100".to_string(),
            contact_id: contact.id,
            status: InvoiceStatus::Sent,
            issued_at: SAMPLE_NOW_MS,
            due_at: SAMPLE_NOW_MS + 2 * DAY_MS,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1900,
            }],
        };
        store.insert_invoice(&invoice).expect("invoice");
        invoice
    }

    #[test]
    fn creates_edits_and_deletes_an_appointment() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AppointmentsState::new();
        state.refresh(&store).expect("refresh");
        state.start_new();
        state.draft.title = "Erstgespräch".to_string();
        state.draft.date = "07.11.2026".to_string();
        state.draft.end_date = "07.11.2026".to_string();
        state.draft.start = "09:30".to_string();
        state.draft.end = "10:15".to_string();
        state.draft.category = 1;
        state.save(&store, SAMPLE_NOW_MS).expect("insert");
        assert!(state.error.is_none());
        let stored = store.list_appointments().expect("list")[0].clone();
        assert_eq!(stored.duration_minutes(), 45);
        assert_eq!(stored.category, AppointmentCategory::Customer);

        state.start_edit();
        state.draft.end = "10:30".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        assert_eq!(
            store
                .find_appointment(stored.id)
                .expect("find")
                .unwrap()
                .duration_minutes(),
            60
        );

        state.delete_selected(&store).expect("delete");
        assert!(store.list_appointments().expect("list").is_empty());
    }

    #[test]
    fn stores_all_day_ranges_and_duplicates_them() {
        let (store, mut state, _texts) = seeded();
        state.start_new();
        state.draft.title = "Messe".to_string();
        state.draft.date = format_date(day_start(state.calendar));
        state.draft.end_date = format_date(day_start(state.calendar) + 2 * DAY_MS);
        state.draft.quick_duration(0);
        assert!(state.draft.all_day);
        state.save(&store, SAMPLE_NOW_MS).expect("insert");
        assert!(state.error.is_none());
        let stored = state.current().expect("saved").clone();
        assert!(stored.all_day);
        assert_eq!(stored.day_count(), 3);
        assert_eq!(stored.starts_at, day_start(state.calendar));
        assert_eq!(stored.ends_at, day_start(state.calendar) + 3 * DAY_MS);

        state
            .duplicate_selected(&store, SAMPLE_NOW_MS, "(Kopie)")
            .expect("duplicate");
        assert!(state.current().expect("copy").title.ends_with("(Kopie)"));
        assert_eq!(store.list_appointments().expect("list").len(), 7);
    }

    #[test]
    fn rejects_invalid_input_and_overlapping_slots() {
        let (store, mut state, _texts) = seeded();
        state.start_new();
        state.draft.title = "Konflikt".to_string();
        state.draft.date = format_date(SAMPLE_NOW_MS);
        state.draft.end_date = format_date(SAMPLE_NOW_MS);
        state.draft.start = "09:30".to_string();
        state.draft.end = "09:50".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("conflict check");
        assert_eq!(state.error, Some("appointments_error_conflict"));

        state.draft.start = "11:00".to_string();
        state.draft.end = "10:00".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("end check");
        assert_eq!(state.error, Some("appointments_error_end"));

        state.draft.end = "12:00".to_string();
        state.draft.date = "32.11.2026".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("date check");
        assert_eq!(state.error, Some("appointments_error_date"));
    }

    #[test]
    fn navigates_month_workweek_week_and_day_ranges() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.appointments.len(), 5);
        let month = state.calendar.month;

        state.set_view(AppointmentsView::WorkWeek);
        state.refresh(&store).expect("work week");
        assert!(state.appointments.len() <= 5);

        state.set_view(AppointmentsView::Week);
        state.refresh(&store).expect("week");
        assert!(state.appointments.len() <= 5);

        state.set_view(AppointmentsView::Day);
        state.calendar.day = 12;
        state.reload = true;
        state.refresh(&store).expect("day");
        assert_eq!(state.appointments.len(), 1);

        state.shift(true);
        state.refresh(&store).expect("next day");
        assert!(state.appointments.is_empty() || state.appointments.len() == 1);

        state.go_today(SAMPLE_NOW_MS);
        assert_eq!(state.calendar.month, month);
    }

    #[test]
    fn searches_and_filters_categories_and_invoice_entries() {
        let (store, mut state, texts) = seeded();
        state.query = "workshop".to_string();
        state.refresh(&store).expect("search");
        assert_eq!(state.appointments.len(), 1);
        assert!(state.appointments[0].title.contains("Workshop"));
        assert_eq!(state.entries().len(), 1);

        state.query.clear();
        state.reload = true;
        state.refresh(&store).expect("reload");
        state.filter_status(Some(AppointmentStatus::Scheduled));
        assert_eq!(state.entries().len(), 2);
        state.filter_status(None);
        assert_eq!(state.entries().len(), 5);

        state.toggle_category(AppointmentCategory::Customer);
        assert_eq!(state.entries().len(), 3);
        state.toggle_category(AppointmentCategory::Customer);
        assert_eq!(state.entries().len(), 5);

        insert_open_invoice(&store, &texts);
        state.reload = true;
        state.refresh(&store).expect("invoices");
        assert_eq!(state.entries().len(), 6);
        state.set_invoices_only(true);
        let entries = state.entries();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_invoice());
        assert_eq!(entries[0].category, AppointmentCategory::Invoice);
        assert!(entries[0].title.contains("2026-0100"));
    }

    #[test]
    fn duplicates_invoice_entries_as_local_appointments() {
        let (store, mut state, texts) = seeded();
        let invoice = insert_open_invoice(&store, &texts);
        state.reload = true;
        state.refresh(&store).expect("invoices");
        state.select_invoice(invoice.id);
        assert!(state.screen == AppointmentsDetail::Detail);
        state.start_edit();
        assert!(state.current().is_none());

        state
            .duplicate_selected(&store, SAMPLE_NOW_MS, "(Kopie)")
            .expect("duplicate");
        let copy = state.current().expect("copy");
        assert!(copy.all_day);
        assert_eq!(copy.category, AppointmentCategory::Invoice);
        assert!(copy.title.ends_with("(Kopie)"));
        assert_eq!(store.list_appointments().expect("list").len(), 6);
    }

    #[test]
    fn exports_only_visible_local_appointments_to_icalendar() {
        let (_store, mut state, _texts) = seeded();
        state.filter_status(Some(AppointmentStatus::Scheduled));
        let export_path =
            std::env::temp_dir().join(format!("socdof-calendar-{}.ics", Uuid::new_v4()));
        let bytes = state
            .export_ics(&export_path, SAMPLE_NOW_MS)
            .expect("export");
        let content = std::fs::read_to_string(&export_path).expect("read export");
        assert_eq!(usize::try_from(bytes).expect("file length"), content.len());
        assert!(content.starts_with("BEGIN:VCALENDAR\r\n"));
        assert!(content.contains("BEGIN:VEVENT"));
        assert_eq!(content.matches("BEGIN:VEVENT").count(), 2);
        assert!(content.contains("CATEGORIES:"));
        std::fs::remove_file(export_path).expect("cleanup");
    }

    #[test]
    fn exports_all_day_entries_with_date_values() {
        let (_store, mut state, _texts) = seeded();
        state.filter_status(Some(AppointmentStatus::Confirmed));
        let export_path =
            std::env::temp_dir().join(format!("socdof-calendar-{}.ics", Uuid::new_v4()));
        state
            .export_ics(&export_path, SAMPLE_NOW_MS)
            .expect("export");
        let content = std::fs::read_to_string(&export_path).expect("read export");
        assert!(content.contains("DTSTART;VALUE=DATE:"));
        assert!(content.contains("CATEGORIES:DEADLINE"));
        std::fs::remove_file(export_path).expect("cleanup");
    }

    #[test]
    fn renders_month_workweek_week_day_detail_and_form() {
        let (store, mut state, texts) = seeded();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_title")));
        assert!(painted.contains(texts.get("appointments_view_month")));
        assert!(painted.contains("Kickoff"));
        assert!(painted.contains(texts.get("appointments_category_customer")));

        state.set_view(AppointmentsView::WorkWeek);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_view_workweek")));
        assert!(painted.contains(texts.get("appointments_agenda")));

        state.set_view(AppointmentsView::Week);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_view_week")));

        state.calendar.day = 26;
        state.set_view(AppointmentsView::Day);
        state.reload = true;
        state.refresh(&store).expect("all-day day");
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_all_day")));
        assert!(painted.contains(texts.get("appointments_sample_inventory")));

        state.calendar.day = 12;
        state.reload = true;
        state.refresh(&store).expect("workshop day");
        let painted = render(&mut state, &store);
        assert!(painted.contains("Kickoff") || painted.contains("Workshop"));

        let id = state.appointments[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_detail_title")));
        assert!(painted.contains(texts.get("appointments_edit")));
        assert!(painted.contains(texts.get("appointments_duplicate")));
        assert!(painted.contains(texts.get("appointments_mark_completed")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_save")));
        assert!(painted.contains(texts.get("appointments_end_date")));
        assert!(painted.contains(texts.get("appointments_category")));
    }

    #[test]
    fn seeding_is_idempotent_and_uses_the_store() {
        let (store, _state, texts) = seeded();
        seed_appointments(&store, &texts).expect("second seed");
        assert_eq!(store.list_appointments().expect("list").len(), 5);
        let statuses: Vec<AppointmentStatus> = store
            .list_appointments()
            .expect("list")
            .iter()
            .map(|appointment| appointment.status)
            .collect();
        assert!(statuses.contains(&AppointmentStatus::Confirmed));
        assert!(statuses.contains(&AppointmentStatus::Scheduled));
        assert!(store
            .list_appointments()
            .expect("list")
            .iter()
            .any(|appointment| appointment.all_day));
    }
}
