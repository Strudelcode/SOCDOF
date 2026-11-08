//! Support module screen: tickets, priorities and tracked working time.
//!
//! The screen works on the core store directly: it lists tickets through
//! [`Store::list_support_tickets`]/[`Store::open_support_tickets`], writes through
//! [`Store::insert_support_ticket`], [`Store::update_support_ticket`] and
//! [`Store::set_support_ticket_status`], and keeps the tracked time in the same `time_entries`
//! table the legacy app used. Validation stays in the domain
//! ([`socdof_core::domain::support::SupportTicket::validate`] and
//! [`socdof_core::domain::support::TimeEntry::validate`]); the screen only maps the returned
//! snake_case code to a catalogue key, so invalid input never reaches the database.
//!
//! Views are list, detail and form. The detail view also books time, because that is where the
//! legacy app kept its stopwatch panel. Every control registers in the shared [`FocusState`], every
//! visible string comes from the catalogue and all painting uses the design tokens.

use egui::{Context, RichText};
use socdof_core::domain::support::{SupportTicket, TicketPriority, TicketStatus, TimeEntry};
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

/// Milliseconds of one hour, used to place the sample tickets relative to [`SAMPLE_NOW_MS`].
const HOUR_MS: i64 = 60 * 60 * 1000;

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

/// State of the support screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SupportState {
    /// Search text; empty lists every ticket.
    pub query: String,
    /// Whether closed tickets are hidden.
    pub only_open: bool,
    /// Tickets matching the last loaded query.
    pub tickets: Vec<SupportTicket>,
    /// Selected ticket, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: SupportView,
    /// Editable values of the form.
    pub draft: TicketDraft,
    /// Dropdown state of the priority select.
    pub priority_popup: PopupState,
    /// Dropdown state of the status select.
    pub status_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
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
    loaded_query: String,
    loaded_open_only: bool,
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
        {
            return Ok(());
        }

        let mut tickets = if self.only_open {
            store.open_support_tickets()?
        } else {
            store.list_support_tickets()?
        };
        let needle = self.query.trim().to_lowercase();
        if !needle.is_empty() {
            tickets.retain(|ticket| {
                ticket.subject.to_lowercase().contains(&needle)
                    || ticket.description.to_lowercase().contains(&needle)
            });
        }

        self.tickets = tickets;
        self.loaded_query = self.query.clone();
        self.loaded_open_only = self.only_open;
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

    /// Reloads the module state before it is shown, as the desktop does when an app is launched.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.back = false;
        self.error = None;
        self.status = None;
        self.confirm_delete = false;
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

/// Renders the support screen into the context.
pub fn support(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            SupportView::List => state.back = true,
            SupportView::Detail => state.view = SupportView::List,
            SupportView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("support_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                SupportView::List => list_view(ui, theme, texts, focus, state),
                SupportView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
                SupportView::Form => form_view(ui, theme, texts, focus, state, store, now),
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
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SupportState,
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
    ui.horizontal_wrapped(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("support_search"),
            260.0,
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
    }
    if create {
        state.start_new();
        return;
    }

    ui.add_space(12.0);
    if state.tickets.is_empty() {
        let filtered = state.only_open || !state.query.trim().is_empty();
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
        egui::Grid::new("socdof-support-table")
            .num_columns(3)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "support_col_subject",
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

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&ticket.subject).size(FONT_TITLE).strong());
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
    ui.horizontal(|ui| {
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
        ui.horizontal(|ui| {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
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
        let ctx = Context::default();
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
