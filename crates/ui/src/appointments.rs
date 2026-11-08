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
use socdof_core::domain::appointment::{Appointment, AppointmentStatus};
use socdof_core::domain::contact::Contact;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::calendar::{days_in_month, month_grid, CalendarState};
use crate::components::{
    badge, button, card, empty_state, modal, search_field, ButtonVariant, Tone,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

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
            AppointmentsView::Week => "appointments_view_week",
            AppointmentsView::Day => "appointments_view_day",
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

/// Editable values of one appointment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppointmentDraft {
    /// Short title shown in the calendar.
    pub title: String,
    /// Date as `DD.MM.YYYY`.
    pub date: String,
    /// Start time as `HH:MM`.
    pub start: String,
    /// Duration in minutes.
    pub duration: String,
    /// Room, address or link.
    pub location: String,
    /// Free text notes.
    pub notes: String,
    /// Index into the loaded contacts, `0` meaning no contact.
    pub contact: usize,
    /// Index into [`STATUSES`].
    pub status: usize,
}

impl Default for AppointmentDraft {
    fn default() -> Self {
        Self {
            title: String::new(),
            date: String::new(),
            start: "09:00".to_string(),
            duration: "60".to_string(),
            location: String::new(),
            notes: String::new(),
            contact: 0,
            status: 0,
        }
    }
}

impl AppointmentDraft {
    /// Fills the draft from a stored appointment.
    pub fn from_appointment(appointment: &Appointment, contacts: &[Contact]) -> Self {
        Self {
            title: appointment.title.clone(),
            date: format_date(appointment.starts_at),
            start: format_time(appointment.starts_at),
            duration: appointment.duration_minutes().to_string(),
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
        let time = parse_time(&self.start).ok_or("appointments_error_time")?;
        let duration: i64 = self
            .duration
            .trim()
            .parse()
            .map_err(|_| "appointments_error_duration")?;
        if !(1..=1_440).contains(&duration) {
            return Err("appointments_error_duration");
        }
        let starts_at = day + time;
        let ends_at = starts_at + duration * MINUTE_MS;
        let status = *STATUSES
            .get(self.status)
            .ok_or("appointments_error_status")?;
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
        appointment.status = status;
        appointment.starts_at = starts_at;
        appointment.ends_at = ends_at;
        appointment.updated_at = now;

        Ok(appointment)
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

fn format_range(appointment: &Appointment) -> String {
    format!(
        "{} – {}",
        format_time(appointment.starts_at),
        format_time(appointment.ends_at)
    )
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
    /// Search text over title, location and notes.
    pub query: String,
    /// Appointments in the loaded range.
    pub appointments: Vec<Appointment>,
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
    /// Current calendar, detail or form view.
    pub screen: AppointmentsDetail,
    /// Selected appointment, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Editable values of the form.
    pub draft: AppointmentDraft,
    /// Dropdown state of the contact select.
    pub contact_popup: PopupState,
    /// Dropdown state of the status select.
    pub status_popup: PopupState,
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
            contacts: Vec::new(),
            view: AppointmentsView::Month,
            calendar: CalendarState::from_millis(SAMPLE_NOW_MS),
            status_filter: None,
            status_choice: 0,
            screen: AppointmentsDetail::Calendar,
            selected: None,
            draft: AppointmentDraft::default(),
            contact_popup: PopupState::default(),
            status_popup: PopupState::default(),
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

    /// Reloads the appointments when the range or the search changed.
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
        self.loaded_day = day;
        self.loaded_view = self.view;
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Appointments matching the status filter, ordered by start.
    pub fn visible(&self) -> Vec<&Appointment> {
        self.appointments
            .iter()
            .filter(|appointment| {
                self.status_filter
                    .map(|status| appointment.status == status)
                    .unwrap_or(true)
            })
            .collect()
    }

    /// Selected appointment, if it is still part of the loaded range.
    pub fn current(&self) -> Option<&Appointment> {
        self.selected
            .and_then(|id| self.appointments.iter().find(|item| item.id == id))
    }

    /// Opens the detail view of an appointment.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.screen = AppointmentsDetail::Detail;
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
            AppointmentsView::Week => {
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

    /// Opens an empty form on the selected day.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = AppointmentDraft {
            title: String::new(),
            date: self.calendar.formatted(),
            start: "09:00".to_string(),
            duration: "60".to_string(),
            location: String::new(),
            notes: String::new(),
            contact: 0,
            status: 0,
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

        if appointment.status.is_open() && !store.appointment_conflicts(&appointment)?.is_empty() {
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
        self.calendar = CalendarState::from_millis(appointment.starts_at);
        self.screen = AppointmentsDetail::Detail;
        self.error = None;
        self.status = Some("appointments_saved");
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

        if status.is_open() && !store.appointment_conflicts(&appointment)?.is_empty() {
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
        ),
        (
            texts.get("appointments_sample_consulting"),
            9,
            14,
            0,
            90,
            AppointmentStatus::Scheduled,
        ),
        (
            texts.get("appointments_sample_workshop"),
            12,
            10,
            0,
            120,
            AppointmentStatus::Confirmed,
        ),
        (
            texts.get("appointments_sample_followup"),
            20,
            16,
            0,
            30,
            AppointmentStatus::Scheduled,
        ),
    ];

    for (title, day, hour, minute, duration, status) in samples {
        let starts_at = sample_at(calendar, day, hour, minute);
        store.insert_appointment(&Appointment {
            id: Uuid::new_v4(),
            contact_id: None,
            title: title.to_string(),
            location: Some(location.clone()),
            notes: Some(note.clone()),
            status,
            starts_at,
            ends_at: starts_at + duration * MINUTE_MS,
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
    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            ui.label(RichText::new(title).size(FONT_TITLE).strong());
            ui.label(
                RichText::new(subtitle)
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("appointments_back"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                state.back = true;
            }
        });
    });
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
pub fn appointments(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppointmentsState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.screen {
            AppointmentsDetail::Calendar => state.back = true,
            AppointmentsDetail::Detail => state.screen = AppointmentsDetail::Calendar,
            AppointmentsDetail::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("appointments_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.screen {
                AppointmentsDetail::Calendar => {
                    calendar_view(ui, theme, texts, focus, state, store, now)
                }
                AppointmentsDetail::Detail => {
                    detail_view(ui, theme, texts, focus, state, store, now)
                }
                AppointmentsDetail::Form => form_view(ui, theme, texts, focus, state, store, now),
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
    let count = state.appointments.len();
    let subtitle = format!("{} · {}", count, texts.get("appointments_subtitle"));
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
    ui.horizontal_wrapped(|ui| {
        for view in [
            AppointmentsView::Month,
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
        ui.add_space(10.0);
        search_field(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("appointments_search"),
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
    if create {
        state.start_new();
        return;
    }

    ui.add_space(8.0);
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
        ui.add_space(8.0);
        ui.label(RichText::new(range_label(state, texts)).strong());
    });

    ui.add_space(8.0);
    match state.view {
        AppointmentsView::Month => month_view(ui, theme, texts, focus, state, store),
        AppointmentsView::Week => week_view(ui, theme, focus, state),
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
        AppointmentsView::Week => {
            let (from, _) = week_bounds(state.calendar);
            format!("{} – {}", format_date(from), format_date(from + 6 * DAY_MS))
        }
        AppointmentsView::Day => state.calendar.formatted(),
    }
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
    let mut clicked = None;
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-calendar-month")
            .num_columns(7)
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
                                let count = state
                                    .appointments
                                    .iter()
                                    .filter(|appointment| {
                                        appointment.overlaps(start, start + DAY_MS)
                                    })
                                    .count();
                                let selected = calendar.day == day;
                                let variant = if selected {
                                    ButtonVariant::Primary
                                } else {
                                    ButtonVariant::Ghost
                                };
                                if button(ui, theme, focus, &day.to_string(), variant).activated {
                                    clicked = Some(day);
                                }
                                if count > 0 {
                                    ui.label(
                                        RichText::new(format!("{count}"))
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
    focus: &mut FocusState,
    state: &mut AppointmentsState,
) {
    let (monday, _) = week_bounds(state.calendar);
    let mut chosen = None;
    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            for offset in 0..7 {
                let start = monday + offset * DAY_MS;
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(format_date(start))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                    let items: Vec<&Appointment> = state
                        .visible()
                        .into_iter()
                        .filter(|appointment| appointment.overlaps(start, start + DAY_MS))
                        .collect();
                    if items.is_empty() {
                        ui.label(
                            RichText::new("—")
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                    for appointment in items {
                        if button(ui, theme, focus, &appointment.title, ButtonVariant::Ghost)
                            .activated
                        {
                            chosen = Some(appointment.id);
                        }
                        ui.label(
                            RichText::new(format_time(appointment.starts_at))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                });
            }
        });
    });
    if let Some(id) = chosen {
        state.select(id);
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
    let mut chosen = None;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(state.calendar.formatted())
                .size(FONT_SMALL)
                .strong()
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        let items: Vec<&Appointment> = state
            .visible()
            .into_iter()
            .filter(|appointment| appointment.overlaps(start, start + DAY_MS))
            .collect();
        if items.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("appointments_empty_title"),
                texts.get("appointments_empty_hint"),
            );
        }
        for appointment in items {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format_range(appointment))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                if button(ui, theme, focus, &appointment.title, ButtonVariant::Ghost).activated {
                    chosen = Some(appointment.id);
                }
                badge(
                    ui,
                    theme,
                    texts.get(status_key(appointment.status)),
                    status_tone(appointment.status),
                );
            });
        }
    });
    if let Some(id) = chosen {
        state.select(id);
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
        ui.label(RichText::new(texts.get("appointments_agenda")).strong());
        ui.add_space(6.0);
        let items = state.visible();
        if items.is_empty() {
            let searching = !state.query.trim().is_empty() || state.status_filter.is_some();
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
        egui::Grid::new("socdof-calendar-agenda")
            .num_columns(5)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "appointments_col_date",
                    "appointments_col_time",
                    "appointments_col_title",
                    "appointments_col_contact",
                    "appointments_col_status",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for appointment in items {
                    ui.label(format_date(appointment.starts_at));
                    ui.label(format_range(appointment));
                    if button(ui, theme, focus, &appointment.title, ButtonVariant::Ghost).activated
                    {
                        chosen = Some(appointment.id);
                    }
                    ui.label(contact_name(&state.contacts, appointment.contact_id));
                    badge(
                        ui,
                        theme,
                        texts.get(status_key(appointment.status)),
                        status_tone(appointment.status),
                    );
                    ui.end_row();
                }
            });
        if let Some(id) = chosen {
            state.select(id);
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
    let Some(appointment) = state.current().cloned() else {
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
        &appointment.title,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&appointment.title).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(status_key(appointment.status)),
                status_tone(appointment.status),
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            ("appointments_date", format_date(appointment.starts_at)),
            ("appointments_start", format_range(&appointment)),
            (
                "appointments_duration",
                format!(
                    "{} {}",
                    appointment.duration_minutes(),
                    texts.get("appointments_minutes")
                ),
            ),
            (
                "appointments_contact",
                contact_name(&state.contacts, appointment.contact_id),
            ),
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
        if let Some(location) = &appointment.location {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get("appointments_location"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(location);
            });
        }
        if let Some(notes) = &appointment.notes {
            ui.add_space(6.0);
            ui.label(RichText::new(notes).size(FONT_SMALL));
        }
    });

    ui.add_space(12.0);
    let mut next_status = None;
    let mut edit = false;
    let mut delete = false;
    ui.horizontal_wrapped(|ui| {
        if appointment.status != AppointmentStatus::Confirmed
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
        if appointment.status != AppointmentStatus::Completed
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
        if appointment.status != AppointmentStatus::Cancelled {
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
        ui.columns(3, |columns| {
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
                &mut state.draft.start,
                texts.get("appointments_start"),
                texts.get("appointments_start_hint"),
                None,
            );
            text_field(
                &mut columns[2],
                theme,
                focus,
                &mut state.draft.duration,
                texts.get("appointments_duration"),
                texts.get("appointments_duration_hint"),
                None,
            );
        });
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
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("appointments_contact"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let mut names: Vec<String> = vec![texts.get("appointments_no_contact").to_string()];
            names.extend(state.contacts.iter().map(contact_label));
            let labels: Vec<&str> = names.iter().map(String::as_str).collect();
            select(
                ui,
                theme,
                focus,
                &mut state.contact_popup,
                "appointment-contact",
                &mut state.draft.contact,
                &labels,
            );
            ui.add_space(12.0);
            ui.label(
                RichText::new(texts.get("appointments_status"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let status_names: Vec<String> = STATUSES
                .iter()
                .map(|status| texts.get(status_key(*status)).to_string())
                .collect();
            let status_labels: Vec<&str> = status_names.iter().map(String::as_str).collect();
            select(
                ui,
                theme,
                focus,
                &mut state.status_popup,
                "appointment-status",
                &mut state.draft.status,
                &status_labels,
            );
        });
    });

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
    use socdof_core::domain::settings::Language;

    fn seeded() -> (Store, AppointmentsState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_appointments(&store, &texts).expect("seed");
        let mut state = AppointmentsState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut AppointmentsState, store: &Store) -> String {
        let ctx = Context::default();
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

    #[test]
    fn creates_edits_and_deletes_an_appointment() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AppointmentsState::new();
        state.refresh(&store).expect("refresh");
        state.start_new();
        state.draft.title = "Erstgespräch".to_string();
        state.draft.date = "07.11.2026".to_string();
        state.draft.start = "09:30".to_string();
        state.draft.duration = "45".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");
        assert!(state.error.is_none());
        let stored = store.list_appointments().expect("list")[0].clone();
        assert_eq!(stored.duration_minutes(), 45);

        state.start_edit();
        state.draft.duration = "60".to_string();
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
    fn rejects_invalid_input_and_overlapping_slots() {
        let (store, mut state, _texts) = seeded();
        state.start_new();
        state.draft.title = "Konflikt".to_string();
        state.draft.date = format_date(SAMPLE_NOW_MS);
        state.draft.start = "09:30".to_string();
        state.draft.duration = "30".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("conflict check");
        assert_eq!(state.error, Some("appointments_error_conflict"));

        state.draft.start = "11:00".to_string();
        state.draft.duration = "0".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("duration check");
        assert_eq!(state.error, Some("appointments_error_duration"));

        state.draft.duration = "30".to_string();
        state.draft.date = "32.11.2026".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("date check");
        assert_eq!(state.error, Some("appointments_error_date"));
    }

    #[test]
    fn navigates_month_week_and_day_ranges() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.appointments.len(), 4);
        let month = state.calendar.month;

        state.set_view(AppointmentsView::Week);
        state.refresh(&store).expect("week");
        assert!(state.appointments.len() <= 4);

        state.set_view(AppointmentsView::Day);
        state.refresh(&store).expect("day");
        assert_eq!(state.appointments.len(), 1);

        state.shift(true);
        state.refresh(&store).expect("next day");
        assert!(state.appointments.is_empty() || state.appointments.len() == 1);

        state.go_today(SAMPLE_NOW_MS);
        assert_eq!(state.calendar.month, month);
    }

    #[test]
    fn searches_and_filters_appointments() {
        let (store, mut state, _texts) = seeded();
        state.query = "workshop".to_string();
        state.refresh(&store).expect("search");
        assert_eq!(state.appointments.len(), 1);
        assert!(state.appointments[0].title.contains("Workshop"));

        state.query.clear();
        state.reload = true;
        state.refresh(&store).expect("reload");
        state.filter_status(Some(AppointmentStatus::Scheduled));
        assert_eq!(state.visible().len(), 2);
        state.filter_status(None);
        assert_eq!(state.visible().len(), 4);
    }

    #[test]
    fn renders_month_week_day_detail_and_form() {
        let (store, mut state, texts) = seeded();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_title")));
        assert!(painted.contains(texts.get("appointments_view_month")));
        assert!(painted.contains("Kickoff"));

        state.set_view(AppointmentsView::Week);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_agenda")));

        state.set_view(AppointmentsView::Day);
        let painted = render(&mut state, &store);
        assert!(painted.contains("Kickoff"));

        let id = state.appointments[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_detail_title")));
        assert!(painted.contains(texts.get("appointments_edit")));
        assert!(painted.contains(texts.get("appointments_mark_completed")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("appointments_save")));
        assert!(painted.contains(texts.get("appointments_duration")));
    }

    #[test]
    fn seeding_is_idempotent_and_uses_the_store() {
        let (store, _state, texts) = seeded();
        seed_appointments(&store, &texts).expect("second seed");
        assert_eq!(store.list_appointments().expect("list").len(), 4);
        let statuses: Vec<AppointmentStatus> = store
            .list_appointments()
            .expect("list")
            .iter()
            .map(|appointment| appointment.status)
            .collect();
        assert!(statuses.contains(&AppointmentStatus::Confirmed));
        assert!(statuses.contains(&AppointmentStatus::Scheduled));
    }
}
