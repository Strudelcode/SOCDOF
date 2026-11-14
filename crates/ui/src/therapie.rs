//! Therapy practice screen: clients, sessions and their billing link.
//!
//! The screen works on the core store: clients and sessions live in the schema v8 tables, the
//! amounts come from [`socdof_core::domain::therapy::summarize`] and
//! [`socdof_core::domain::therapy::session_amount`], and validation stays in the domain, so the
//! screen only maps the returned snake_case code to a catalogue key.
//!
//! Views are list, detail and form. The detail view is the practice day-to-day surface: it shows the
//! key figures of the client, the session history with the amount of every session, and books new
//! sessions. Linking puts every still open session of the client on one invoice by number.

use egui::{Context, RichText};
use socdof_core::domain::therapy::{
    self, TherapyClient, TherapySession, TherapySummary, TherapyTrip,
};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::text_field;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::reports::{format_date, CURRENCY};
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample practice, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::contacts::SAMPLE_NOW_MS;

/// Milliseconds of one day.
const DAY_MS: i64 = 86_400_000;

/// View currently shown by the therapy screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum TherapieView {
    /// Searchable client list.
    #[default]
    List,
    /// Client detail with the session history.
    Detail,
    /// Create or edit form.
    Form,
    /// Practice mileage logbook.
    Mileage,
}

/// Editable values of one client.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ClientDraft {
    /// Display name.
    pub name: String,
    /// Email address.
    pub email: String,
    /// Phone number.
    pub phone: String,
    /// Hourly rate as typed.
    pub hourly_rate: String,
    /// Rate per kilometre as typed.
    pub kilometer_rate: String,
    /// Free notes.
    pub notes: String,
    /// Whether the client is still treated.
    pub active: bool,
}

impl ClientDraft {
    /// Fills the draft from a stored client.
    pub fn from_client(client: &TherapyClient) -> Self {
        Self {
            name: client.name.clone(),
            email: client.email.clone(),
            phone: client.phone.clone(),
            hourly_rate: client.hourly_rate.to_decimal_string(),
            kilometer_rate: client.kilometer_rate.to_decimal_string(),
            notes: client.notes.clone(),
            active: client.active,
        }
    }

    /// Builds the client to store; `base` keeps the id and creation time when editing.
    pub fn to_client(&self, base: Option<&TherapyClient>, now: i64) -> TherapyClient {
        let mut client = match base {
            Some(client) => client.clone(),
            None => TherapyClient::new(now),
        };
        client.name = self.name.trim().to_string();
        client.email = self.email.trim().to_string();
        client.phone = self.phone.trim().to_string();
        client.hourly_rate = Money::parse(&self.hourly_rate).unwrap_or(Money::ZERO);
        client.kilometer_rate = Money::parse(&self.kilometer_rate).unwrap_or(Money::ZERO);
        client.notes = self.notes.trim().to_string();
        client.active = self.active;
        client.updated_at = now;
        client
    }
}

/// State of the therapy screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TherapieState {
    /// Search text; empty lists every client.
    pub query: String,
    /// Clients matching the last loaded query.
    pub clients: Vec<TherapyClient>,
    /// Selected client, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: TherapieView,
    /// Editable values of the client form.
    pub draft: ClientDraft,
    /// Sessions of the selected client, newest first.
    pub sessions: Vec<TherapySession>,
    /// Persisted practice mileage trips, newest first.
    pub trips: Vec<TherapyTrip>,
    /// Search query for the mileage logbook.
    pub trip_query: String,
    /// Optional client linked to the mileage trip.
    pub trip_client_id: Option<Uuid>,
    /// Date of the mileage trip.
    pub trip_date: String,
    /// Starting point of the mileage trip.
    pub trip_departure: String,
    /// Destination of the mileage trip.
    pub trip_destination: String,
    /// Purpose of the mileage trip.
    pub trip_purpose: String,
    /// Odometer start value in kilometres.
    pub trip_start_km: String,
    /// Odometer end value in kilometres.
    pub trip_end_km: String,
    /// Individually selected reimbursement rate in currency per kilometre.
    pub trip_rate: String,
    /// Existing trip being edited.
    pub editing_trip: Option<Uuid>,
    /// Date of the session as an ISO date.
    pub session_date: String,
    /// Start time of the session as HH:MM.
    pub session_time: String,
    /// Minutes of the session being booked, as typed.
    pub session_minutes: String,
    /// Driven kilometres of the session being booked, as typed.
    pub session_kilometers: String,
    /// Notes of the session being booked or edited.
    pub session_notes: String,
    /// Existing open session being edited, if any.
    pub editing_session: Option<Uuid>,
    /// Invoice number typed to bill the open sessions.
    pub invoice_number: String,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Trip awaiting explicit deletion confirmation.
    pub trip_to_delete: Option<Uuid>,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    reload: bool,
}

impl TherapieState {
    /// Creates an empty screen; the first [`TherapieState::refresh`] loads the client list.
    pub fn new() -> Self {
        Self {
            reload: true,
            ..Self::default()
        }
    }

    /// Reloads the client list when the query changed or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload && self.loaded_query == self.query {
            return Ok(());
        }

        let mut clients = store.list_therapy_clients()?;
        let needle = self.query.trim().to_lowercase();
        if !needle.is_empty() {
            clients.retain(|client| {
                client.name.to_lowercase().contains(&needle)
                    || client.email.to_lowercase().contains(&needle)
            });
        }
        self.clients = clients;
        self.trips = store.therapy_trips()?;
        self.loaded_query = self.query.clone();
        self.reload = false;
        self.load_sessions(store)?;
        Ok(())
    }

    /// Reloads the sessions of the selected client.
    fn load_sessions(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.sessions = match self.selected {
            Some(id) => store.therapy_sessions_for_client(id)?,
            None => Vec::new(),
        };
        Ok(())
    }

    /// Selected client, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&TherapyClient> {
        self.selected
            .and_then(|id| self.clients.iter().find(|client| client.id == id))
    }

    /// Key figures of the selected client.
    pub fn summary(&self) -> TherapySummary {
        match self.current() {
            Some(client) => therapy::summarize(&self.sessions, client),
            None => TherapySummary::default(),
        }
    }

    /// Opens the detail view of a client.
    pub fn select(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        self.cancel_session_edit();
        self.selected = Some(id);
        self.view = TherapieView::Detail;
        self.error = None;
        self.status = None;
        self.reload = true;
        self.load_sessions(store)
    }

    /// Opens an empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = ClientDraft {
            active: true,
            ..ClientDraft::default()
        };
        self.error = None;
        self.status = None;
        self.view = TherapieView::Form;
    }

    /// Opens the form with the selected client.
    pub fn start_edit(&mut self) {
        let Some(client) = self.current() else {
            return;
        };
        self.draft = ClientDraft::from_client(client);
        self.error = None;
        self.status = None;
        self.view = TherapieView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            TherapieView::Detail
        } else {
            TherapieView::List
        };
    }

    /// Validates and stores the client draft.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let client = self.draft.to_client(base.as_ref(), now);

        if let Err(code) = client.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_therapy_client(&client)?;
        } else {
            store.insert_therapy_client(&client)?;
        }

        self.selected = Some(client.id);
        self.view = TherapieView::Detail;
        self.error = None;
        self.status = Some("therapie_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected client after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_therapy_client(id)?;
        self.selected = None;
        self.view = TherapieView::List;
        self.confirm_delete = false;
        self.sessions.clear();
        self.error = None;
        self.status = Some("therapie_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Opens the practice mileage logbook.
    pub fn open_mileage(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.trips = store.therapy_trips()?;
        self.clear_trip_draft();
        self.view = TherapieView::Mileage;
        self.error = None;
        self.status = None;
        Ok(())
    }

    /// Clears the mileage editor without changing stored records.
    pub fn clear_trip_draft(&mut self) {
        self.editing_trip = None;
        self.trip_client_id = None;
        self.trip_date = socdof_core::date::format_iso8601(socdof_core::now_millis())
            .split('T')
            .next()
            .unwrap_or("2026-01-01")
            .to_string();
        self.trip_departure = "Praxis".to_string();
        self.trip_destination.clear();
        self.trip_purpose = "Hausbesuch / Kliententermin".to_string();
        let previous_end = self
            .trips
            .first()
            .map(|trip| trip.end_km_milli)
            .unwrap_or(0);
        self.trip_start_km = format!("{:.3}", previous_end as f64 / 1000.0)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        self.trip_end_km = format!("{:.3}", (previous_end + 15_000) as f64 / 1000.0)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        self.trip_rate = "0,30".to_string();
    }

    /// Loads one persisted trip into the mileage editor.
    pub fn edit_trip(&mut self, id: Uuid) {
        let Some(trip) = self.trips.iter().find(|trip| trip.id == id) else {
            return;
        };
        self.editing_trip = Some(id);
        self.trip_client_id = trip.client_id;
        self.trip_date = trip.date.clone();
        self.trip_departure = trip.departure.clone();
        self.trip_destination = trip.destination.clone();
        self.trip_purpose = trip.purpose.clone();
        self.trip_start_km = format!("{:.3}", trip.start_km_milli as f64 / 1000.0)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        self.trip_end_km = format!("{:.3}", trip.end_km_milli as f64 / 1000.0)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        self.trip_rate = format!("{:.2}", trip.rate_cents_per_km as f64 / 100.0);
        self.trip_rate = self.trip_rate.replace('.', ",");
        self.error = None;
        self.status = None;
    }

    /// Validates and persists the current mileage trip.
    pub fn save_trip(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let start = parse_kilometers(&self.trip_start_km);
        let end = parse_kilometers(&self.trip_end_km);
        let rate = {
            let value = self.trip_rate.trim().replace(',', ".");
            value
                .parse::<f64>()
                .ok()
                .filter(|value| value.is_finite() && *value >= 0.0)
                .map(|value| (value * 100.0).round() as i64)
        };
        let (Some(start_km_milli), Some(end_km_milli), Some(rate_cents_per_km)) =
            (start, end, rate)
        else {
            self.error = Some("therapie_trip_values_invalid");
            self.status = None;
            return Ok(());
        };
        let existing = self
            .editing_trip
            .and_then(|id| self.trips.iter().find(|trip| trip.id == id).cloned());
        let trip = TherapyTrip {
            id: existing
                .as_ref()
                .map(|trip| trip.id)
                .unwrap_or_else(Uuid::new_v4),
            client_id: self.trip_client_id,
            date: self.trip_date.trim().to_string(),
            departure: self.trip_departure.trim().to_string(),
            destination: self.trip_destination.trim().to_string(),
            purpose: self.trip_purpose.trim().to_string(),
            start_km_milli,
            end_km_milli,
            rate_cents_per_km,
        };
        if let Err(code) = trip.validate() {
            self.error = Some(match code.as_str() {
                "trip_date_invalid" => "therapie_trip_date_invalid",
                "trip_route_required" => "therapie_trip_route_required",
                _ => "therapie_trip_values_invalid",
            });
            self.status = None;
            return Ok(());
        }
        if existing.is_some() {
            store.update_therapy_trip(&trip)?;
        } else {
            store.insert_therapy_trip(&trip)?;
        }
        self.trips = store.therapy_trips()?;
        self.clear_trip_draft();
        self.error = None;
        self.status = Some("therapie_trip_saved");
        Ok(())
    }

    /// Deletes one practice mileage trip.
    pub fn delete_trip(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_therapy_trip(id)?;
        self.trips = store.therapy_trips()?;
        if self.editing_trip == Some(id) {
            self.clear_trip_draft();
        }
        self.status = Some("therapie_trip_deleted");
        self.error = None;
        Ok(())
    }

    /// Starts editing an unbilled session.
    pub fn start_edit_session(&mut self, id: Uuid) {
        self.cancel_session_edit();
        let Some(session) = self.sessions.iter().find(|session| session.id == id) else {
            return;
        };
        if session.is_billed() {
            self.error = Some("therapie_error_session_billed");
            return;
        }
        let timestamp = socdof_core::date::format_iso8601(session.started_at);
        let (date, time) = timestamp
            .split_once('T')
            .unwrap_or((&timestamp, "00:00:00.000Z"));
        self.session_date = date.to_string();
        self.session_time = time.get(..5).unwrap_or("00:00").to_string();
        self.session_minutes = session.minutes.to_string();
        self.session_kilometers = format!("{:.3}", session.kilometers())
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        self.session_notes = session.notes.clone();
        self.editing_session = Some(id);
        self.error = None;
        self.status = None;
    }

    /// Leaves the session editor without writing.
    pub fn cancel_session_edit(&mut self) {
        self.editing_session = None;
        self.session_date.clear();
        self.session_time.clear();
        self.session_minutes.clear();
        self.session_kilometers.clear();
        self.session_notes.clear();
        self.error = None;
    }

    /// Saves a new session or updates the currently edited unbilled session.
    pub fn add_session(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(client_id) = self.selected else {
            return Ok(());
        };
        let minutes = match self.session_minutes.trim().parse::<i64>() {
            Ok(minutes) if minutes > 0 => minutes,
            _ => {
                self.error = Some("therapie_error_minutes");
                self.status = None;
                return Ok(());
            }
        };
        let kilometers_milli = match parse_kilometers(&self.session_kilometers) {
            Some(value) => value,
            None => {
                self.error = Some("therapie_error_kilometers");
                self.status = None;
                return Ok(());
            }
        };

        let started_at =
            if self.session_date.trim().is_empty() && self.session_time.trim().is_empty() {
                if self.editing_session.is_some() {
                    self.sessions
                        .iter()
                        .find(|session| Some(session.id) == self.editing_session)
                        .map(|session| session.started_at)
                        .unwrap_or(now)
                } else {
                    now
                }
            } else {
                let now_iso = socdof_core::date::format_iso8601(now);
                let (now_date, now_time) = now_iso
                    .split_once('T')
                    .unwrap_or((&now_iso, "00:00:00.000Z"));
                let date = if self.session_date.trim().is_empty() {
                    now_date
                } else {
                    self.session_date.trim()
                };
                let time = if self.session_time.trim().is_empty() {
                    &now_time[..5]
                } else {
                    self.session_time.trim()
                };
                if time.len() != 5 || !time.as_bytes().get(2).is_some_and(|byte| *byte == b':') {
                    self.error = Some("therapie_error_date");
                    self.status = None;
                    return Ok(());
                }
                match socdof_core::date::parse_iso8601(&format!("{date}T{time}:00Z")) {
                    Some(value) => value,
                    None => {
                        self.error = Some("therapie_error_date");
                        self.status = None;
                        return Ok(());
                    }
                }
            };

        let mut session = if let Some(id) = self.editing_session {
            let Some(existing) = self
                .sessions
                .iter()
                .find(|session| session.id == id)
                .cloned()
            else {
                self.error = Some("therapie_error_session");
                return Ok(());
            };
            if existing.is_billed() || existing.client_id != client_id {
                self.error = Some("therapie_error_session_billed");
                return Ok(());
            }
            existing
        } else {
            TherapySession::new(client_id, now)
        };
        session.started_at = started_at;
        session.minutes = minutes;
        session.kilometers_milli = kilometers_milli;
        session.notes = self.session_notes.trim().to_string();
        session.updated_at = now;

        if let Err(code) = session.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if self.editing_session.is_some() {
            store.update_therapy_session(&session)?;
            self.status = Some("therapie_session_updated");
        } else {
            store.insert_therapy_session(&session)?;
            self.status = Some("therapie_session_saved");
        }
        self.editing_session = None;
        self.session_date.clear();
        self.session_time.clear();
        self.session_minutes.clear();
        self.session_kilometers.clear();
        self.session_notes.clear();
        self.error = None;
        self.load_sessions(store)?;
        Ok(())
    }

    /// Removes one session.
    pub fn delete_session(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_therapy_session(id)?;
        self.status = Some("therapie_session_deleted");
        self.load_sessions(store)?;
        Ok(())
    }

    /// Puts every open session of the client on the invoice with the typed number.
    pub fn link_invoice(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(client_id) = self.selected else {
            return Ok(());
        };
        let number = self.invoice_number.trim();
        if number.is_empty() {
            self.error = Some("therapie_error_invoice");
            self.status = None;
            return Ok(());
        }

        let invoice = store
            .list_invoices()?
            .into_iter()
            .find(|invoice| invoice.number.as_str() == number);
        let Some(invoice) = invoice else {
            self.error = Some("therapie_error_invoice");
            self.status = None;
            return Ok(());
        };

        let linked = store.link_therapy_sessions(client_id, invoice.id, now)?;
        self.load_sessions(store)?;
        if linked == 0 {
            self.error = Some("therapie_error_nothing_open");
            self.status = None;
        } else {
            self.error = None;
            self.status = Some("therapie_linked");
            self.invoice_number.clear();
        }
        Ok(())
    }

    /// Reloads the module state before it is shown, as the desktop does when an app is launched.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.back = false;
        self.error = None;
        self.status = None;
        self.confirm_delete = false;
        self.cancel_session_edit();
        self.view = TherapieView::List;
        self.selected = None;
        self.sessions.clear();
        self.reload = true;
        self.refresh(store)
    }
}

/// Parses typed kilometres into thousandths; empty input counts as no travel.
fn parse_kilometers(input: &str) -> Option<i64> {
    let trimmed = input.trim().replace(',', ".");
    if trimmed.is_empty() {
        return Some(0);
    }
    let value: f64 = trimmed.parse().ok()?;
    if value < 0.0 || !value.is_finite() {
        return None;
    }
    Some((value * 1000.0).round() as i64)
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "rate_invalid" => "therapie_error_rate",
        "minutes_invalid" => "therapie_error_minutes",
        "kilometers_invalid" => "therapie_error_kilometers",
        _ => "therapie_error_name",
    }
}

fn money(value: Money) -> String {
    value.format_localized(CURRENCY)
}

/// Seeds two clients and four sessions for the gallery and the golden snapshots.
///
/// The function is a no-op when the store already has clients, so it never overwrites data.
pub fn seed_sample(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if !store.list_therapy_clients()?.is_empty() {
        return Ok(());
    }

    let mut first = TherapyClient::new(SAMPLE_NOW_MS - 20 * DAY_MS);
    first.name = texts.get("therapie_sample_client_one").to_string();
    first.email = "muster@praxis.example".to_string();
    first.phone = "+39 0471 000 010".to_string();
    first.hourly_rate = Money::from_cents(9_000);
    first.kilometer_rate = Money::from_cents(60);
    first.notes = texts.get("therapie_sample_notes_one").to_string();
    store.insert_therapy_client(&first)?;

    let mut session = TherapySession::new(first.id, SAMPLE_NOW_MS - 6 * DAY_MS);
    session.minutes = 60;
    session.kilometers_milli = 12_000;
    session.notes = texts.get("therapie_sample_session_one").to_string();
    store.insert_therapy_session(&session)?;

    let mut billed = TherapySession::new(first.id, SAMPLE_NOW_MS - 13 * DAY_MS);
    billed.minutes = 45;
    billed.kilometers_milli = 8_000;
    billed.notes = texts.get("therapie_sample_session_two").to_string();
    billed.invoice_id = Some(Uuid::new_v4());
    store.insert_therapy_session(&billed)?;

    let mut second = TherapyClient::new(SAMPLE_NOW_MS - 9 * DAY_MS);
    second.name = texts.get("therapie_sample_client_two").to_string();
    second.email = "zweit@praxis.example".to_string();
    second.hourly_rate = Money::from_cents(8_000);
    second.kilometer_rate = Money::from_cents(55);
    store.insert_therapy_client(&second)?;

    let mut third = TherapySession::new(second.id, SAMPLE_NOW_MS - 2 * DAY_MS);
    third.minutes = 30;
    third.kilometers_milli = 5_500;
    third.notes = texts.get("therapie_sample_session_three").to_string();
    store.insert_therapy_session(&third)?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TherapieState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("therapy"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &TherapieState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

fn kpi(ui: &mut egui::Ui, theme: &Theme, label: &str, value: &str) {
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(4.0);
        ui.label(RichText::new(value).size(FONT_TITLE).strong());
    });
}

fn mileage_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TherapieState,
    store: &Store,
) {
    let subtitle = format!(
        "{} · {}",
        state.trips.len(),
        texts.get("therapie_mileage_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("therapie_mileage_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let total_km_milli: i64 = state.trips.iter().map(TherapyTrip::distance_km_milli).sum();
    let total_cents: i64 = state
        .trips
        .iter()
        .map(|trip| trip.reimbursement().cents())
        .sum();
    ui.columns(2, |columns| {
        kpi(
            &mut columns[0],
            theme,
            texts.get("therapie_mileage_total_distance"),
            &format!("{:.1} km", total_km_milli as f64 / 1000.0),
        );
        kpi(
            &mut columns[1],
            theme,
            texts.get("therapie_mileage_total_reimbursement"),
            &money(Money::from_cents(total_cents)),
        );
    });
    ui.add_space(10.0);

    let mut save = false;
    let mut clear = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("therapie_mileage_editor")).strong());
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_date,
            texts.get("therapie_trip_date"),
            "",
            None,
        );
        ui.label(
            RichText::new(texts.get("therapie_trip_client"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        egui::ComboBox::from_id_source("therapy-mileage-client")
            .selected_text(
                state
                    .trip_client_id
                    .and_then(|id| state.clients.iter().find(|client| client.id == id))
                    .map(|client| client.name.as_str())
                    .unwrap_or(texts.get("therapie_trip_no_client")),
            )
            .show_ui(ui, |ui| {
                ui.selectable_value(
                    &mut state.trip_client_id,
                    None,
                    texts.get("therapie_trip_no_client"),
                );
                for client in &state.clients {
                    ui.selectable_value(&mut state.trip_client_id, Some(client.id), &client.name);
                }
            });
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_departure,
            texts.get("therapie_trip_departure"),
            "",
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_destination,
            texts.get("therapie_trip_destination"),
            "",
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_purpose,
            texts.get("therapie_trip_purpose"),
            "",
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_start_km,
            texts.get("therapie_trip_start_km"),
            "",
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_end_km,
            texts.get("therapie_trip_end_km"),
            "",
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.trip_rate,
            texts.get("therapie_trip_rate"),
            "",
            None,
        );
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("therapie_trip_save"),
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
                texts.get("therapie_trip_clear"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                clear = true;
            }
        });
    });
    if save && state.save_trip(store).is_err() {
        state.error = Some("therapie_error_load");
    }
    if clear {
        state.clear_trip_draft();
        state.error = None;
        state.status = None;
    }

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("therapie_mileage_history")).strong());
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.trip_query,
            texts.get("therapie_mileage_search"),
            240.0,
        );
        let needle = state.trip_query.trim().to_lowercase();
        let trips: Vec<_> = state
            .trips
            .iter()
            .filter(|trip| {
                needle.is_empty()
                    || trip.departure.to_lowercase().contains(&needle)
                    || trip.destination.to_lowercase().contains(&needle)
                    || trip.purpose.to_lowercase().contains(&needle)
                    || trip
                        .client_id
                        .and_then(|id| state.clients.iter().find(|client| client.id == id))
                        .is_some_and(|client| client.name.to_lowercase().contains(&needle))
            })
            .cloned()
            .collect();
        if trips.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("therapie_mileage_empty"),
                texts.get("therapie_mileage_empty_hint"),
            );
        } else {
            let mut edit = None;
            let mut delete = None;
            egui::Grid::new("socdof-therapy-mileage")
                .num_columns(8)
                .spacing(egui::vec2(12.0, 8.0))
                .show(ui, |ui| {
                    for key in [
                        "therapie_trip_date",
                        "therapie_trip_route",
                        "therapie_trip_purpose",
                        "therapie_trip_odometer",
                        "therapie_trip_distance",
                        "therapie_trip_rate",
                        "therapie_trip_amount",
                        "therapie_trip_actions",
                    ] {
                        ui.label(RichText::new(texts.get(key)).strong().size(FONT_SMALL));
                    }
                    ui.end_row();
                    for trip in &trips {
                        ui.label(&trip.date);
                        ui.label(format!("{} → {}", trip.departure, trip.destination));
                        ui.label(&trip.purpose);
                        ui.label(format!(
                            "{:.1} → {:.1}",
                            trip.start_km_milli as f64 / 1000.0,
                            trip.end_km_milli as f64 / 1000.0
                        ));
                        ui.label(format!(
                            "{:.1} km",
                            trip.distance_km_milli() as f64 / 1000.0
                        ));
                        ui.label(format!("{:.2}", trip.rate_cents_per_km as f64 / 100.0));
                        ui.label(money(trip.reimbursement()));
                        ui.horizontal(|ui| {
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("therapie_edit"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                edit = Some(trip.id);
                            }
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("therapie_session_delete"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                delete = Some(trip.id);
                            }
                        });
                        ui.end_row();
                    }
                });
            if let Some(id) = edit {
                state.edit_trip(id);
            }
            if let Some(id) = delete {
                state.trip_to_delete = Some(id);
            }
        }
    });
}

/// Renders the therapy screen into the context.
pub fn therapie(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TherapieState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            TherapieView::List => state.back = true,
            TherapieView::Detail => state.view = TherapieView::List,
            TherapieView::Form => state.cancel_edit(),
            TherapieView::Mileage => state.view = TherapieView::List,
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("therapie_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                TherapieView::List => list_view(ui, theme, texts, focus, state, store),
                TherapieView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
                TherapieView::Form => form_view(ui, theme, texts, focus, state, store, now),
                TherapieView::Mileage => mileage_view(ui, theme, texts, focus, state, store),
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
            texts.get("therapie_delete_title"),
            |ui| {
                ui.label(texts.get("therapie_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("therapie_delete_confirm"),
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
                        texts.get("therapie_delete_cancel"),
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
        state.error = Some("therapie_error_delete");
    }

    let mut trip_dialog_open = state.trip_to_delete.is_some();
    let mut confirm_trip_delete = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut trip_dialog_open,
            texts.get("therapie_trip_delete_title"),
            |ui| {
                ui.label(texts.get("therapie_trip_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("therapie_trip_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm_trip_delete = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("therapie_delete_cancel"),
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
    if confirm_trip_delete {
        if let Some(id) = state.trip_to_delete.take() {
            if state.delete_trip(store, id).is_err() {
                state.error = Some("therapie_error_load");
            }
        }
    } else if !trip_dialog_open {
        state.trip_to_delete = None;
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TherapieState,
    store: &Store,
) {
    let subtitle = format!(
        "{} · {}",
        state.clients.len(),
        texts.get("therapie_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("therapie_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    ui.horizontal(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("therapie_search"),
            170.0,
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("therapie_mileage_open"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            let _ = state.open_mileage(store);
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("therapie_new"),
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

    ui.add_space(12.0);
    if state.clients.is_empty() {
        let searching = !state.query.trim().is_empty();
        card(ui, theme, |ui| {
            let (title, hint) = if searching {
                ("therapie_no_results", "therapie_no_results_hint")
            } else {
                ("therapie_empty_title", "therapie_empty_hint")
            };
            empty_state(ui, theme, texts.get(title), texts.get(hint));
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-therapie-table")
            .num_columns(4)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "therapie_col_name",
                    "therapie_col_sessions",
                    "therapie_col_hourly",
                    "therapie_col_state",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for client in &state.clients {
                    let count = store.therapy_session_count(client.id).unwrap_or(0);
                    if button(ui, theme, focus, &client.name, ButtonVariant::Ghost).activated {
                        chosen = Some(client.id);
                    }
                    ui.label(count.to_string());
                    ui.label(money(client.hourly_rate));
                    badge(
                        ui,
                        theme,
                        texts.get(if client.active {
                            "therapie_state_active"
                        } else {
                            "therapie_state_inactive"
                        }),
                        if client.active {
                            Tone::Success
                        } else {
                            Tone::Accent
                        },
                    );
                    ui.end_row();
                }
            });
    });

    if let Some(id) = chosen {
        if state.select(store, id).is_err() {
            state.error = Some("therapie_error_load");
        }
    }
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut TherapieState,
    store: &Store,
    now: i64,
) {
    let Some(client) = state.current().cloned() else {
        state.view = TherapieView::List;
        return;
    };
    let summary = state.summary();
    let sessions = state.sessions.clone();

    let subtitle = format!(
        "{} · {}",
        money(client.hourly_rate),
        texts.get("therapie_per_hour")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("therapie_detail_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    ui.columns(4, |columns| {
        kpi(
            &mut columns[0],
            theme,
            texts.get("therapie_kpi_sessions"),
            &summary.sessions.to_string(),
        );
        kpi(
            &mut columns[1],
            theme,
            texts.get("therapie_kpi_hours"),
            &format!("{:.2} h", summary.minutes as f64 / 60.0),
        );
        kpi(
            &mut columns[2],
            theme,
            texts.get("therapie_kpi_kilometers"),
            &format!("{:.1} km", summary.kilometers_milli as f64 / 1000.0),
        );
        kpi(
            &mut columns[3],
            theme,
            texts.get("therapie_kpi_open"),
            &money(summary.open),
        );
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.horizontal(|ui| {
            ui.label(RichText::new(&client.name).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(if client.active {
                    "therapie_state_active"
                } else {
                    "therapie_state_inactive"
                }),
                if client.active {
                    Tone::Success
                } else {
                    Tone::Accent
                },
            );
            badge(
                ui,
                theme,
                &format!("{} {}", texts.get("therapie_billed"), money(summary.billed)),
                Tone::Accent,
            );
        });
        ui.add_space(6.0);
        for (label, value) in [
            ("therapie_email", client.email.as_str()),
            ("therapie_phone", client.phone.as_str()),
            ("therapie_kilometer_rate", ""),
            ("therapie_notes", client.notes.as_str()),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                if label == "therapie_kilometer_rate" {
                    ui.label(format!("{} / km", money(client.kilometer_rate)));
                } else {
                    ui.label(value);
                }
            });
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("therapie_sessions_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(8.0);
        if sessions.is_empty() {
            ui.label(
                RichText::new(texts.get("therapie_sessions_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        } else {
            let mut remove = None;
            let mut edit_session = None;
            egui::Grid::new("socdof-therapie-sessions")
                .num_columns(5)
                .spacing(egui::vec2(16.0, 8.0))
                .show(ui, |ui| {
                    for key in [
                        "therapie_col_date",
                        "therapie_col_minutes",
                        "therapie_col_kilometers",
                        "therapie_col_amount",
                        "therapie_col_notes",
                    ] {
                        ui.label(
                            RichText::new(texts.get(key))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for session in &sessions {
                        ui.label(format_date(session.started_at));
                        ui.label(session.minutes.to_string());
                        ui.label(format!("{:.1}", session.kilometers()));
                        ui.horizontal(|ui| {
                            ui.label(money(therapy::session_amount(session, &client)));
                            if session.is_billed() {
                                badge(ui, theme, texts.get("therapie_billed_badge"), Tone::Success);
                            } else if button(
                                ui,
                                theme,
                                focus,
                                texts.get("therapie_session_delete"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                remove = Some(session.id);
                            }
                        });
                        ui.horizontal(|ui| {
                            ui.label(&session.notes);
                            if !session.is_billed()
                                && button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("therapie_edit"),
                                    ButtonVariant::Ghost,
                                )
                                .activated
                            {
                                edit_session = Some(session.id);
                            }
                        });
                        ui.end_row();
                    }
                });

            if let Some(id) = edit_session {
                state.start_edit_session(id);
            }
            if let Some(id) = remove {
                if state.delete_session(store, id).is_err() {
                    state.error = Some("therapie_error_session");
                }
            }
        }

        ui.add_space(10.0);
        let mut add = false;
        ui.horizontal(|ui| {
            text_field(
                ui,
                theme,
                focus,
                &mut state.session_date,
                texts.get("therapie_session_date"),
                "YYYY-MM-DD",
                None,
            );
            text_field(
                ui,
                theme,
                focus,
                &mut state.session_time,
                texts.get("therapie_session_time"),
                "HH:MM",
                None,
            );
        });
        text_field(
            ui,
            theme,
            focus,
            &mut state.session_minutes,
            texts.get("therapie_session_minutes"),
            texts.get("therapie_session_minutes_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.session_kilometers,
            texts.get("therapie_session_kilometers"),
            texts.get("therapie_session_kilometers_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.session_notes,
            texts.get("therapie_session_notes"),
            texts.get("therapie_session_notes_hint"),
            None,
        );
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get(if state.editing_session.is_some() {
                    "therapie_session_update"
                } else {
                    "therapie_session_add"
                }),
                ButtonVariant::Primary,
            )
            .activated
            {
                add = true;
            }
            if state.editing_session.is_some()
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("therapie_cancel"),
                    ButtonVariant::Ghost,
                )
                .activated
            {
                state.cancel_session_edit();
            }
        });
        if add && state.add_session(store, now).is_err() {
            state.error = Some("therapie_error_session");
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("therapie_billing_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("therapie_billing_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(8.0);
        let mut link = false;
        text_field(
            ui,
            theme,
            focus,
            &mut state.invoice_number,
            texts.get("therapie_invoice_number"),
            texts.get("therapie_invoice_number_hint"),
            None,
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("therapie_link"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            link = true;
        }
        if link && state.link_invoice(store, now).is_err() {
            state.error = Some("therapie_error_invoice");
        }
    });

    ui.add_space(12.0);
    let mut edit = false;
    let mut delete = false;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("therapie_edit"),
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
            texts.get("therapie_delete"),
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
            texts.get("therapie_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = TherapieView::List;
        }
    });
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
    state: &mut TherapieState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("therapie_edit_title")
    } else {
        texts.get("therapie_new_title")
    };
    let subtitle = texts.get("therapie_subtitle").to_string();
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
            texts.get("therapie_name"),
            texts.get("therapie_name_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.email,
            texts.get("therapie_email"),
            texts.get("therapie_email_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.phone,
            texts.get("therapie_phone"),
            texts.get("therapie_phone_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.hourly_rate,
            texts.get("therapie_hourly_rate"),
            texts.get("therapie_hourly_rate_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.kilometer_rate,
            texts.get("therapie_kilometer_rate"),
            texts.get("therapie_kilometer_rate_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.notes,
            texts.get("therapie_notes"),
            texts.get("therapie_notes_hint"),
            None,
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
                texts.get("therapie_save"),
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
                texts.get("therapie_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("therapie_error_save");
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

    fn seeded() -> (Store, TherapieState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_sample(&store, &texts).expect("seed");
        let mut state = TherapieState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut TherapieState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(900.0, 1600.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                therapie(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("therapy frame")).join("\n")
    }

    #[test]
    fn creates_a_client_with_rates_and_sessions() {
        let store = Store::open_in_memory().expect("store");
        let mut state = TherapieState::new();
        state.start_new();
        state.draft.name = "Muster".to_string();
        state.draft.hourly_rate = "90,00".to_string();
        state.draft.kilometer_rate = "0,60".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert_eq!(state.view, TherapieView::Detail);
        let client = state.current().expect("client").clone();
        assert_eq!(client.hourly_rate, Money::from_cents(9_000));

        state.session_minutes = "45".to_string();
        state.session_kilometers = "10,5".to_string();
        state.session_notes = "Erstgespräch".to_string();
        state.add_session(&store, SAMPLE_NOW_MS).expect("session");

        assert_eq!(state.sessions.len(), 1);
        assert_eq!(state.sessions[0].kilometers_milli, 10_500);
        let summary = state.summary();
        assert_eq!(summary.sessions, 1);
        assert_eq!(summary.minutes, 45);
        assert_eq!(summary.billed, Money::ZERO);
        assert!(summary.open.cents() > 0);
    }

    #[test]
    fn rejects_a_client_without_a_name() {
        let store = Store::open_in_memory().expect("store");
        let mut state = TherapieState::new();
        state.start_new();
        state.draft.name = "   ".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validated");

        assert_eq!(state.error, Some("therapie_error_name"));
        assert_eq!(state.view, TherapieView::Form);
        assert!(store.list_therapy_clients().expect("clients").is_empty());
    }

    #[test]
    fn edits_open_sessions_and_keeps_billed_sessions_locked() {
        let (store, mut state, _texts) = seeded();
        let client_id = state.clients[0].id;
        state.select(&store, client_id).expect("select");
        let open = state
            .sessions
            .iter()
            .find(|session| !session.is_billed())
            .expect("open session")
            .clone();

        state.start_edit_session(open.id);
        assert_eq!(state.editing_session, Some(open.id));
        state.session_date = "2026-11-12".to_string();
        state.session_time = "09:45".to_string();
        state.session_minutes = "75".to_string();
        state.session_kilometers = "14,25".to_string();
        state.session_notes = "Updated treatment note".to_string();
        state
            .add_session(&store, SAMPLE_NOW_MS + 1)
            .expect("update");

        let updated = store
            .therapy_sessions_for_client(client_id)
            .expect("sessions")
            .into_iter()
            .find(|session| session.id == open.id)
            .expect("updated session");
        assert_eq!(
            updated.started_at,
            socdof_core::date::parse_iso8601("2026-11-12T09:45:00Z").unwrap()
        );
        assert_eq!(updated.minutes, 75);
        assert_eq!(updated.kilometers_milli, 14_250);
        assert_eq!(updated.notes, "Updated treatment note");
        assert_eq!(updated.updated_at, SAMPLE_NOW_MS + 1);
        assert_eq!(state.editing_session, None);

        let mut billed = updated.clone();
        billed.id = Uuid::new_v4();
        billed.invoice_id = Some(Uuid::new_v4());
        state.sessions.push(billed.clone());
        state.start_edit_session(billed.id);
        assert_eq!(state.editing_session, None);
        assert_eq!(state.error, Some("therapie_error_session_billed"));

        state.editing_session = Some(billed.id);
        state.session_minutes = "30".to_string();
        state.session_kilometers = "0".to_string();
        state
            .add_session(&store, SAMPLE_NOW_MS + 2)
            .expect("billed sessions stay locked");
        assert_eq!(state.error, Some("therapie_error_session_billed"));
    }

    #[test]
    fn rejects_invalid_session_date_without_changing_the_saved_session() {
        let (store, mut state, _texts) = seeded();
        let client_id = state.clients[0].id;
        state.select(&store, client_id).expect("select");
        let session = state
            .sessions
            .iter()
            .find(|session| !session.is_billed())
            .expect("open")
            .clone();
        state.start_edit_session(session.id);
        state.session_date = "2026-02-31".to_string();
        state.session_time = "10:30".to_string();
        state.add_session(&store, SAMPLE_NOW_MS).expect("validate");
        assert_eq!(state.error, Some("therapie_error_date"));
        let saved = store
            .therapy_sessions_for_client(client_id)
            .expect("sessions")
            .into_iter()
            .find(|item| item.id == session.id)
            .unwrap();
        assert_eq!(saved.started_at, session.started_at);
    }

    #[test]
    fn rejects_invalid_session_input() {
        let (store, mut state, _texts) = seeded();
        let id = state.clients[0].id;
        state.select(&store, id).expect("select");

        state.session_minutes = "0".to_string();
        state.add_session(&store, SAMPLE_NOW_MS).expect("validated");
        assert_eq!(state.error, Some("therapie_error_minutes"));

        state.session_minutes = "30".to_string();
        state.session_kilometers = "abc".to_string();
        state.add_session(&store, SAMPLE_NOW_MS).expect("validated");
        assert_eq!(state.error, Some("therapie_error_kilometers"));
    }

    #[test]
    fn links_the_open_sessions_to_an_invoice() {
        let (store, mut state, _texts) = seeded();
        let id = state.clients[0].id;
        state.select(&store, id).expect("select");

        let open = state.summary().open;
        assert!(open.cents() > 0);

        let invoice_id = uuid::Uuid::new_v4();
        let linked = store
            .link_therapy_sessions(id, invoice_id, SAMPLE_NOW_MS)
            .expect("link");
        assert!(linked > 0);

        state.select(&store, id).expect("reload");
        assert_eq!(state.summary().open, Money::ZERO);
        assert!(state.sessions.iter().all(|session| session.is_billed()));

        state.invoice_number = "gibt-es-nicht".to_string();
        state.link_invoice(&store, SAMPLE_NOW_MS).expect("lookup");
        assert_eq!(state.error, Some("therapie_error_invoice"));
    }

    #[test]
    fn deletes_a_client_with_its_sessions() {
        let (store, mut state, _texts) = seeded();
        let id = state.clients[0].id;
        state.select(&store, id).expect("select");
        assert!(store.therapy_session_count(id).expect("count") > 0);

        state.delete_selected(&store).expect("delete");
        assert_eq!(state.view, TherapieView::List);
        assert_eq!(store.therapy_session_count(id).expect("count"), 0);
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("therapie_title")));
        assert!(painted.contains(texts.get("therapie_sample_client_one")));

        let id = state.clients[0].id;
        state.select(&store, id).expect("select");
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("therapie_sessions_title")));
        assert!(painted.contains(texts.get("therapie_kpi_open")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("therapie_save")));
        assert!(painted.contains(texts.get("therapie_hourly_rate")));
    }

    #[test]
    fn mileage_screen_saves_edits_filters_and_deletes_custom_rate_trips() {
        let store = Store::open_in_memory().expect("store");
        let mut state = TherapieState::new();
        state.open_mileage(&store).expect("open mileage");
        state.trip_date = "2026-11-14".to_string();
        state.trip_departure = "Praxis".to_string();
        state.trip_destination = "Bozen".to_string();
        state.trip_purpose = "Hausbesuch".to_string();
        state.trip_start_km = "100".to_string();
        state.trip_end_km = "142".to_string();
        state.trip_rate = "0,38".to_string();
        state.save_trip(&store).expect("save trip");
        assert_eq!(state.trips.len(), 1);
        assert_eq!(state.trips[0].reimbursement(), Money::from_cents(1_596));

        let id = state.trips[0].id;
        state.edit_trip(id);
        state.trip_rate = "0,42".to_string();
        state.save_trip(&store).expect("update trip");
        assert_eq!(state.trips[0].reimbursement(), Money::from_cents(1_764));

        state.trip_query = "bozen".to_string();
        assert!(state
            .trips
            .iter()
            .any(|trip| trip.destination.to_lowercase().contains(&state.trip_query)));
        state.delete_trip(&store, id).expect("delete trip");
        assert!(state.trips.is_empty());
    }

    #[test]
    fn seeding_is_idempotent() {
        let (store, _state, texts) = seeded();
        seed_sample(&store, &texts).expect("second seed");
        assert_eq!(store.list_therapy_clients().expect("clients").len(), 2);
    }
}
