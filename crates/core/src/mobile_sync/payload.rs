//! Mobile companion payloads.
//!
//! The protocol is the one the TypeScript application implements. Its dev gateway
//! (`mobileSyncPlugin` in `SOCDOF - TS/vite.config.ts`) and its packaged Electron server
//! (`startMobileSyncServer` in `SOCDOF - TS/electron/main.cjs`) accept one JSON document on
//! `/api/mobile-sync` and hand it to `validateMobilePayload`
//! (`SOCDOF - TS/src/lib/mobileCompanionTypes.ts`), which turns work sessions into tickets with
//! timesheets and expenses. This module parses that document and maps it onto support tickets and
//! tracked time.
//!
//! Mapping notes:
//!
//! - A `tickets` entry becomes a support ticket; its `timesheets` become time entries.
//! - A `sessions` entry is converted like the TypeScript validator does: its five note fields form
//!   the description, the duration becomes tracked minutes (one hour when the session has none), and
//!   the kilometres plus matching trips become travel.
//! - `standalone_timesheets` are booked on one collective ticket, exactly like the TypeScript
//!   importer does.
//! - Rust has no expense and rate columns yet, so the amounts are reported (count and sum) and
//!   appended to the ticket description instead of being invented as schema.
//! - `ticket_number`, `voice_notes`, coordinates and the device name have no Rust column either;
//!   the number and the voice note transcripts stay in the description, the rest stays in the raw
//!   payload that the server keeps for polling.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::date::{format_iso8601, parse_iso8601};
use crate::domain::support::{SupportTicket, TicketPriority, TicketStatus, TimeEntry};
use crate::error::{CoreError, CoreResult};
use crate::money::Money;
use crate::now_millis;
use crate::store::{support, Store};

/// Protocol marker the mobile app writes into every payload.
pub const PROTOCOL: &str = "SOCDOF_MOBILE_COMPANION_V1";

/// Hourly rate the TypeScript importer falls back to (65 currency units).
pub const DEFAULT_HOURLY_RATE_CENTS: i64 = 6_500;

/// One tracked block of a mobile ticket.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileTimesheet {
    /// Day of the work.
    pub date: Option<String>,
    /// Who worked.
    pub staff: Option<String>,
    /// What was done.
    pub description: Option<String>,
    /// Duration in decimal hours.
    pub hours: f64,
    /// Hourly rate in currency units.
    pub hourly_rate: Option<f64>,
    /// Whether the time can be billed.
    pub billable: bool,
    /// Start of the work.
    pub started_at: Option<i64>,
    /// End of the work.
    pub ended_at: Option<i64>,
    /// Travelled kilometres.
    pub travel_km: f64,
    /// Where the work happened.
    pub location: Option<String>,
}

/// One expense of a mobile ticket or the standalone list.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileExpense {
    /// Day the expense belongs to.
    pub date: Option<String>,
    /// Short title.
    pub title: String,
    /// Amount in cents.
    pub amount_cents: i64,
    /// Category the app assigned.
    pub category: Option<String>,
    /// Notes.
    pub notes: Option<String>,
    /// Whether the expense can be billed.
    pub billable: bool,
}

/// One voice note transcript.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileVoiceNote {
    /// Who recorded it.
    pub author: Option<String>,
    /// Transcript of the recording.
    pub transcript: Option<String>,
    /// When it was recorded.
    pub created_at: Option<i64>,
}

/// One ticket of the payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileTicket {
    /// Identifier the mobile app assigned.
    pub id: Option<String>,
    /// Human readable number (`MOB-101`).
    pub number: Option<String>,
    /// Short summary.
    pub title: String,
    /// Customer name.
    pub customer_name: Option<String>,
    /// Customer e-mail.
    pub customer_email: Option<String>,
    /// Customer phone.
    pub customer_phone: Option<String>,
    /// Description text.
    pub description: String,
    /// Lifecycle state as the app spells it.
    pub status: Option<String>,
    /// Priority as the app numbers it (0 to 3).
    pub priority: Option<i64>,
    /// Team name.
    pub team: Option<String>,
    /// Assigned staff.
    pub assigned_staff: Option<String>,
    /// Creation time.
    pub created_at: Option<i64>,
    /// Where the work happened.
    pub location: Option<String>,
    /// Travelled kilometres.
    pub travel_km: f64,
    /// Tracked blocks.
    pub timesheets: Vec<MobileTimesheet>,
    /// Expenses.
    pub expenses: Vec<MobileExpense>,
    /// Voice notes.
    pub voice_notes: Vec<MobileVoiceNote>,
}

/// One field session of the payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileSession {
    /// Identifier the mobile app assigned.
    pub id: Option<String>,
    /// Day of the session.
    pub date: Option<String>,
    /// Customer identifier.
    pub customer_id: Option<String>,
    /// Customer name.
    pub customer_name: Option<String>,
    /// Short summary.
    pub title: String,
    /// Duration in minutes.
    pub duration_minutes: Option<f64>,
    /// Duration in seconds.
    pub duration_seconds: Option<f64>,
    /// Duration in hours.
    pub hours: Option<f64>,
    /// Duration in minutes or hours, depending on the magnitude.
    pub duration: Option<f64>,
    /// Start time.
    pub started_at: Option<i64>,
    /// End time.
    pub ended_at: Option<i64>,
    /// Travelled kilometres.
    pub kilometers: Option<f64>,
    /// Hourly rate in currency units.
    pub hourly_rate: Option<f64>,
    /// Material cost in currency units.
    pub material_cost_cents: i64,
    /// Material and expenses text.
    pub material: Option<String>,
    /// The five note fields.
    pub notes: SessionNotes,
    /// Description fallback.
    pub description: Option<String>,
    /// Priority.
    pub priority: Option<i64>,
    /// Assigned staff.
    pub staff: Option<String>,
}

/// The five note fields the mobile app records per session.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SessionNotes {
    /// Task of the visit.
    pub task: Option<String>,
    /// Goal of the visit.
    pub objective: Option<String>,
    /// Report written on site.
    pub on_site_report: Option<String>,
    /// Material and expenses.
    pub material_and_expenses: Option<String>,
    /// Remarks and acceptance.
    pub remarks: Option<String>,
}

/// One trip of the payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileTrip {
    /// Identifier.
    pub id: Option<String>,
    /// Day of the trip.
    pub date: Option<String>,
    /// Customer identifier.
    pub customer_id: Option<String>,
    /// Customer name.
    pub customer_name: Option<String>,
    /// Where the trip started.
    pub start_location: Option<String>,
    /// Where it ended.
    pub end_location: Option<String>,
    /// Distance in kilometres.
    pub distance_km: f64,
    /// Cost in cents.
    pub cost_cents: i64,
    /// Notes.
    pub notes: Option<String>,
}

/// One customer of the payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct MobileCustomer {
    /// Identifier.
    pub id: Option<String>,
    /// Company name.
    pub company_name: Option<String>,
    /// Contact person.
    pub contact_person: Option<String>,
    /// E-mail.
    pub email: Option<String>,
    /// Phone.
    pub phone: Option<String>,
    /// Street.
    pub street: Option<String>,
    /// Postal code and city.
    pub zip_city: Option<String>,
    /// Hourly rate the app suggests.
    pub hourly_rate: Option<f64>,
}

/// Summary block of the payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SyncSummary {
    /// Sessions the app counted.
    pub total_sessions: Option<i64>,
    /// Trips the app counted.
    pub total_trips: Option<i64>,
    /// Customers the app counted.
    pub total_customers: Option<i64>,
    /// Working hours the app counted.
    pub total_work_hours: Option<f64>,
    /// Kilometres the app counted.
    pub total_kilometers: Option<f64>,
    /// Currency of the amounts.
    pub currency: Option<String>,
}

/// A validated mobile companion payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SyncPayload {
    /// Protocol marker.
    pub protocol: String,
    /// Export version of the app.
    pub export_version: Option<String>,
    /// Export time in milliseconds since the Unix epoch.
    pub exported_at: Option<i64>,
    /// Name of the app.
    pub app_name: Option<String>,
    /// Device that sent the payload.
    pub device: Option<String>,
    /// Tickets.
    pub tickets: Vec<MobileTicket>,
    /// Field sessions.
    pub sessions: Vec<MobileSession>,
    /// Trips.
    pub trips: Vec<MobileTrip>,
    /// Customers.
    pub customers: Vec<MobileCustomer>,
    /// Timesheets without a ticket.
    pub standalone_timesheets: Vec<MobileTimesheet>,
    /// Expenses without a ticket.
    pub standalone_expenses: Vec<MobileExpense>,
    /// Summary block.
    pub summary: SyncSummary,
}

impl SyncPayload {
    /// Currency of the payload, `EUR` when the app did not send one.
    pub fn currency(&self) -> &str {
        self.summary
            .currency
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("EUR")
    }

    /// Everything the payload carries, planned as support tickets.
    ///
    /// Sessions come first because the TypeScript validator converts them before it appends the
    /// explicit tickets; a standalone booking becomes one collective ticket at the end.
    fn plan(&self) -> Vec<PlannedTicket> {
        let mut planned = Vec::new();
        for session in &self.sessions {
            planned.push(self.plan_session(session));
        }
        for ticket in &self.tickets {
            planned.push(self.plan_ticket(ticket));
        }
        if !self.standalone_timesheets.is_empty() || !self.standalone_expenses.is_empty() {
            planned.push(self.plan_standalone());
        }
        planned
    }

    fn plan_ticket(&self, ticket: &MobileTicket) -> PlannedTicket {
        let mut description = ticket.description.clone();
        append_details(
            &mut description,
            ticket.number.as_deref(),
            None,
            &ticket.timesheets,
            &ticket.expenses,
            ticket.travel_km,
            self.currency(),
        );
        for note in &ticket.voice_notes {
            if let Some(transcript) = note.transcript.as_deref() {
                if !description.trim().is_empty() {
                    description.push('\n');
                }
                description.push_str("Sprachnotiz: ");
                description.push_str(transcript.trim());
            }
        }

        PlannedTicket {
            subject: subject_or(&ticket.title, "Mobiler Einsatz"),
            description,
            status: status_of(ticket.status.as_deref()),
            priority: priority_of(ticket.priority),
            created_at: ticket.created_at.unwrap_or_else(now_millis),
            timesheets: ticket.timesheets.iter().map(plan_timesheet).collect(),
            expenses: real_expenses(&ticket.expenses),
            kilometers: ticket.travel_km,
        }
    }

    fn plan_session(&self, session: &MobileSession) -> PlannedTicket {
        let customer_name = session
            .customer_name
            .clone()
            .unwrap_or_else(|| "Kunde".to_string());
        let customer = self.customers.iter().find(|customer| {
            customer.id.is_some() && customer.id == session.customer_id
                || customer.company_name.as_deref() == Some(customer_name.as_str())
        });
        let trips: Vec<&MobileTrip> = self
            .trips
            .iter()
            .filter(|trip| {
                session.customer_id.is_some() && trip.customer_id == session.customer_id
                    || trip.customer_name.as_deref() == Some(customer_name.as_str())
                    || trip.date.is_some() && trip.date == session.date
            })
            .collect();
        let trip_kilometers: f64 = trips.iter().map(|trip| trip.distance_km).sum();
        let kilometers = session.kilometers.unwrap_or(trip_kilometers);
        let hours = session_hours(session).unwrap_or(1.0);
        let rate = session
            .hourly_rate
            .or_else(|| customer.and_then(|customer| customer.hourly_rate));

        let mut description = session_description(session);
        let location = trips
            .first()
            .and_then(|trip| trip.end_location.clone())
            .or_else(|| {
                customer.and_then(|customer| {
                    match (customer.street.clone(), customer.zip_city.clone()) {
                        (Some(street), Some(city)) => Some(format!("{street}, {city}")),
                        (Some(street), None) => Some(street),
                        (None, Some(city)) => Some(city),
                        (None, None) => None,
                    }
                })
            });
        if let Some(location) = location.as_deref() {
            if !description.trim().is_empty() {
                description.push('\n');
            }
            description.push_str("Ort: ");
            description.push_str(location);
        }

        let mut expenses = Vec::new();
        if session.material.is_some() || session.material_cost_cents != 0 {
            expenses.push(MobileExpense {
                date: session.date.clone(),
                title: session
                    .material
                    .clone()
                    .unwrap_or_else(|| "Material".to_string()),
                amount_cents: session.material_cost_cents,
                category: Some("material".to_string()),
                notes: session.material.clone(),
                billable: true,
            });
        }
        for trip in &trips {
            if trip.cost_cents == 0 {
                continue;
            }
            expenses.push(MobileExpense {
                date: trip.date.clone().or_else(|| session.date.clone()),
                title: format!(
                    "Fahrtkosten ({:.0} km, {} ➔ {})",
                    trip.distance_km,
                    trip.start_location.as_deref().unwrap_or("Start"),
                    trip.end_location.as_deref().unwrap_or("Ziel")
                ),
                amount_cents: trip.cost_cents,
                category: Some("travel".to_string()),
                notes: trip.notes.clone(),
                billable: true,
            });
        }

        let timesheet = MobileTimesheet {
            date: session.date.clone(),
            staff: session.staff.clone(),
            description: Some(subject_or(&session.title, "Vor-Ort Einsatz")),
            hours,
            hourly_rate: rate,
            billable: true,
            started_at: session.started_at,
            ended_at: session.ended_at,
            travel_km: kilometers,
            location: location.clone(),
        };

        append_details(
            &mut description,
            None,
            Some(&timesheet),
            std::slice::from_ref(&timesheet),
            &expenses,
            kilometers,
            self.currency(),
        );

        PlannedTicket {
            subject: subject_or(&session.title, &format!("Einsatz bei {customer_name}")),
            description,
            status: TicketStatus::InProgress,
            priority: priority_of(session.priority.or(Some(1))),
            created_at: session.started_at.unwrap_or_else(now_millis),
            timesheets: vec![plan_timesheet(&timesheet)],
            expenses: real_expenses(&expenses),
            kilometers,
        }
    }

    fn plan_standalone(&self) -> PlannedTicket {
        let mut description =
            "Aus der mobilen App importierte Zeiteinträge ohne spezifisches Ticket.".to_string();
        append_details(
            &mut description,
            None,
            None,
            &self.standalone_timesheets,
            &self.standalone_expenses,
            0.0,
            self.currency(),
        );
        let timesheets: Vec<PlannedTime> = self
            .standalone_timesheets
            .iter()
            .map(plan_timesheet)
            .collect();
        let kilometers: f64 = self
            .standalone_timesheets
            .iter()
            .map(|timesheet| timesheet.travel_km)
            .sum();

        PlannedTicket {
            subject: "Sammel-Zeiterfassung (Mobile App)".to_string(),
            description,
            status: TicketStatus::InProgress,
            priority: TicketPriority::Normal,
            created_at: self.exported_at.unwrap_or_else(now_millis),
            timesheets,
            expenses: real_expenses(&self.standalone_expenses),
            kilometers,
        }
    }
}

/// A ticket planned from the payload before it is stored.
#[derive(Debug, Clone)]
struct PlannedTicket {
    subject: String,
    description: String,
    status: TicketStatus,
    priority: TicketPriority,
    created_at: i64,
    timesheets: Vec<PlannedTime>,
    expenses: Vec<MobileExpense>,
    kilometers: f64,
}

/// A time entry planned from the payload before it is stored.
#[derive(Debug, Clone)]
struct PlannedTime {
    description: String,
    minutes: i64,
    started_at: i64,
}

/// Counts of one import.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct ImportReport {
    /// Tickets that were created.
    pub tickets_created: usize,
    /// Tickets that were skipped because the same subject already exists on that day.
    pub duplicates: usize,
    /// Time entries that were created.
    pub timesheets: usize,
    /// Tracked minutes that were created.
    pub minutes: i64,
    /// Expenses the payload carried.
    pub expenses: usize,
    /// Sum of the expense amounts in cents.
    pub expense_cents: i64,
    /// Kilometres the payload carried.
    pub kilometers: f64,
}

/// Parses a payload document into its typed form.
pub fn normalize(value: &Value) -> CoreResult<SyncPayload> {
    let root = unwrap_root(value)?;
    let object = root.as_object().expect("root is an object");

    if let Some(protocol) = object.get("protocol").and_then(Value::as_str) {
        if protocol != PROTOCOL {
            return Err(CoreError::Validation(
                "mobile_unsupported_protocol".to_string(),
            ));
        }
    }

    let tickets = array(object, &["tickets"])
        .iter()
        .map(parse_ticket)
        .collect::<CoreResult<Vec<_>>>()?;
    let sessions = array(
        object,
        &[
            "sessions",
            "records",
            "items",
            "time_entries",
            "entries",
            "logs",
            "work_logs",
        ],
    )
    .iter()
    .map(parse_session)
    .collect::<CoreResult<Vec<_>>>()?;
    let trips = array(object, &["trips", "fahrten", "gps_routes"])
        .iter()
        .map(parse_trip)
        .collect::<CoreResult<Vec<_>>>()?;
    let customers = array(object, &["customers", "kunden", "contacts"])
        .iter()
        .map(parse_customer)
        .collect::<CoreResult<Vec<_>>>()?;
    let standalone_timesheets = array(object, &["standalone_timesheets"])
        .iter()
        .map(parse_timesheet)
        .collect::<CoreResult<Vec<_>>>()?;
    let standalone_expenses = array(object, &["standalone_expenses"])
        .iter()
        .map(parse_expense)
        .collect::<CoreResult<Vec<_>>>()?;

    let summary_value = object.get("summary").and_then(Value::as_object);
    let payload = SyncPayload {
        protocol: PROTOCOL.to_string(),
        export_version: text_of(
            object
                .get("exportVersion")
                .or_else(|| object.get("export_version")),
        ),
        exported_at: timestamp(
            object
                .get("exportTimestamp")
                .or_else(|| object.get("exported_at")),
        ),
        app_name: text_of(object.get("appName").or_else(|| object.get("app_name"))),
        device: text_of(object.get("deviceId").or_else(|| object.get("device_name"))),
        tickets,
        sessions,
        trips,
        customers,
        standalone_timesheets,
        standalone_expenses,
        summary: SyncSummary {
            total_sessions: summary_value.and_then(|summary| integer(summary.get("totalSessions"))),
            total_trips: summary_value.and_then(|summary| integer(summary.get("totalTrips"))),
            total_customers: summary_value
                .and_then(|summary| integer(summary.get("totalCustomers"))),
            total_work_hours: summary_value
                .and_then(|summary| number(summary.get("totalWorkHours"))),
            total_kilometers: summary_value
                .and_then(|summary| number(summary.get("totalKilometers"))),
            currency: summary_value
                .and_then(|summary| text_of(summary.get("currency")))
                .filter(|currency| !currency.trim().is_empty()),
        },
    };

    if payload.tickets.is_empty()
        && payload.sessions.is_empty()
        && payload.standalone_timesheets.is_empty()
        && payload.standalone_expenses.is_empty()
        && payload.trips.is_empty()
    {
        return Err(CoreError::Validation("mobile_empty_payload".to_string()));
    }

    Ok(payload)
}

/// Parses a payload document from bytes.
pub fn normalize_bytes(bytes: &[u8]) -> CoreResult<SyncPayload> {
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|_| CoreError::Validation("mobile_invalid_json".to_string()))?;
    normalize(&value)
}

/// Imports a payload into support tickets and tracked time.
pub fn import(store: &Store, payload: &SyncPayload) -> CoreResult<ImportReport> {
    let mut report = ImportReport::default();
    let existing = support::list_tickets(store.connection())?;
    let now = now_millis();
    let transaction = store.connection().unchecked_transaction()?;

    for planned in payload.plan() {
        let duplicate = existing.iter().any(|ticket| {
            ticket
                .subject
                .trim()
                .eq_ignore_ascii_case(planned.subject.trim())
                && ticket.created_at.div_euclid(86_400_000)
                    == planned.created_at.div_euclid(86_400_000)
        });
        if duplicate {
            report.duplicates += 1;
            continue;
        }

        let ticket = SupportTicket {
            id: uuid::Uuid::new_v4(),
            contact_id: None,
            subject: planned.subject.clone(),
            description: planned.description.clone(),
            status: planned.status,
            priority: planned.priority,
            created_at: planned.created_at,
            updated_at: now,
            closed_at: None,
        };
        ticket.validate().map_err(CoreError::Validation)?;
        support::insert_ticket(&transaction, &ticket)?;
        report.tickets_created += 1;

        for timesheet in &planned.timesheets {
            if timesheet.minutes <= 0 {
                continue;
            }
            let entry = TimeEntry {
                id: uuid::Uuid::new_v4(),
                ticket_id: Some(ticket.id),
                user_id: None,
                description: timesheet.description.clone(),
                minutes: timesheet.minutes,
                started_at: timesheet.started_at,
                created_at: now,
                updated_at: now,
            };
            entry.validate().map_err(CoreError::Validation)?;
            support::insert_time_entry(&transaction, &entry)?;
            report.timesheets += 1;
            report.minutes += entry.minutes;
        }

        report.expenses += planned.expenses.len();
        report.expense_cents += planned
            .expenses
            .iter()
            .map(|expense| expense.amount_cents)
            .sum::<i64>();
        report.kilometers += planned.kilometers;
    }

    transaction.commit()?;
    Ok(report)
}

/// Imports a payload document into support tickets and tracked time.
pub fn import_value(store: &Store, value: &Value) -> CoreResult<ImportReport> {
    import(store, &normalize(value)?)
}

/// Imports a payload document from bytes.
pub fn import_bytes(store: &Store, bytes: &[u8]) -> CoreResult<ImportReport> {
    import(store, &normalize_bytes(bytes)?)
}

/// Imports a payload document from a file.
pub fn import_file(store: &Store, path: &Path) -> CoreResult<ImportReport> {
    let bytes = std::fs::read(path)?;
    import_bytes(store, &bytes)
}

fn unwrap_root(value: &Value) -> CoreResult<Value> {
    if value.is_array() {
        return Ok(json!({ "sessions": value.clone() }));
    }
    if !value.is_object() {
        return Err(CoreError::Validation("mobile_invalid_payload".to_string()));
    }

    let mut current = value.clone();
    for key in ["data", "payload", "export"] {
        if let Some(inner) = current.get(key).and_then(Value::as_object) {
            let mut merged = inner.clone();
            for (name, field) in current.as_object().cloned().unwrap_or_default() {
                merged.entry(name).or_insert(field);
            }
            current = Value::Object(merged);
            break;
        }
    }
    Ok(current)
}

fn array<'a>(object: &'a Map<String, Value>, keys: &[&str]) -> &'a [Value] {
    for key in keys {
        if let Some(items) = object.get(*key).and_then(Value::as_array) {
            return items;
        }
    }
    &[]
}

fn parse_ticket(value: &Value) -> CoreResult<MobileTicket> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;

    Ok(MobileTicket {
        id: text_of(object.get("id")),
        number: text_of(object.get("ticket_number")),
        title: text_of(object.get("title")).unwrap_or_default(),
        customer_name: text_of(object.get("customer_name")),
        customer_email: text_of(object.get("customer_email")),
        customer_phone: text_of(object.get("customer_phone")),
        description: text_of(object.get("description")).unwrap_or_default(),
        status: text_of(object.get("status")),
        priority: integer(object.get("priority")),
        team: text_of(object.get("team")),
        assigned_staff: text_of(object.get("assigned_staff")),
        created_at: timestamp(object.get("created_at")),
        location: text_of(object.get("location_name")),
        travel_km: number(object.get("travel_km")).unwrap_or(0.0),
        timesheets: object
            .get("timesheets")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(parse_timesheet)
                    .collect::<CoreResult<Vec<_>>>()
            })
            .transpose()?
            .unwrap_or_default(),
        expenses: object
            .get("expenses")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(parse_expense)
                    .collect::<CoreResult<Vec<_>>>()
            })
            .transpose()?
            .unwrap_or_default(),
        voice_notes: object
            .get("voice_notes")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_object)
                    .map(|note| MobileVoiceNote {
                        author: text_of(note.get("author")),
                        transcript: text_of(note.get("text_transcript")),
                        created_at: timestamp(note.get("created_at")),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    })
    .map(|ticket| MobileTicket {
        title: subject_or(&ticket.title, "Mobiler Einsatz"),
        ..ticket
    })
}

fn parse_session(value: &Value) -> CoreResult<MobileSession> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;
    let notes = object.get("notes").and_then(Value::as_object);
    let notes = match notes {
        Some(notes) => SessionNotes {
            task: text_of(notes.get("task")),
            objective: text_of(notes.get("objective")),
            on_site_report: text_of(notes.get("onSiteReport")),
            material_and_expenses: text_of(notes.get("materialAndExpenses")),
            remarks: text_of(notes.get("remarks")),
        },
        None => SessionNotes {
            remarks: text_of(object.get("notes")),
            ..SessionNotes::default()
        },
    };

    Ok(MobileSession {
        id: text_of(object.get("id")),
        date: text_of(object.get("date")),
        customer_id: text_of(
            object
                .get("customerId")
                .or_else(|| object.get("customer_id")),
        ),
        customer_name: text_of(
            object
                .get("customerName")
                .or_else(|| object.get("customer"))
                .or_else(|| object.get("kunde"))
                .or_else(|| object.get("company"))
                .or_else(|| object.get("client")),
        ),
        title: text_of(object.get("title").or_else(|| object.get("name"))).unwrap_or_default(),
        duration_minutes: number(object.get("durationMinutes")),
        duration_seconds: number(object.get("durationSeconds")),
        hours: number(object.get("hours")),
        duration: number(object.get("duration")),
        started_at: timestamp(object.get("startTime").or_else(|| object.get("start"))),
        ended_at: timestamp(object.get("endTime").or_else(|| object.get("end"))),
        kilometers: number(object.get("kilometers").or_else(|| object.get("km"))),
        hourly_rate: number(object.get("hourlyRate").or_else(|| object.get("rate"))),
        material_cost_cents: money_cents(
            object
                .get("materialCost")
                .or_else(|| object.get("expenseAmount")),
        ),
        material: notes_material(object),
        notes,
        description: text_of(
            object
                .get("description")
                .or_else(|| object.get("beschreibung"))
                .or_else(|| object.get("memo")),
        ),
        priority: integer(object.get("priority")),
        staff: text_of(
            object
                .get("staff")
                .or_else(|| object.get("mitarbeiter"))
                .or_else(|| object.get("user")),
        ),
    })
}

fn notes_material(object: &Map<String, Value>) -> Option<String> {
    object
        .get("notes")
        .and_then(Value::as_object)
        .and_then(|notes| text_of(notes.get("materialAndExpenses")))
}

fn parse_timesheet(value: &Value) -> CoreResult<MobileTimesheet> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;

    Ok(MobileTimesheet {
        date: text_of(object.get("date")),
        staff: text_of(object.get("staff")),
        description: text_of(object.get("description")),
        hours: number(object.get("hours")).unwrap_or(0.0),
        hourly_rate: number(object.get("hourly_rate")),
        billable: object
            .get("billable")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        started_at: timestamp(object.get("started_at")),
        ended_at: timestamp(object.get("ended_at")),
        travel_km: number(object.get("travel_km")).unwrap_or(0.0),
        location: text_of(object.get("location_name")),
    })
}

fn parse_expense(value: &Value) -> CoreResult<MobileExpense> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;

    Ok(MobileExpense {
        date: text_of(object.get("date")),
        title: text_of(object.get("title")).unwrap_or_else(|| "Spesen".to_string()),
        amount_cents: money_cents(object.get("amount")),
        category: text_of(object.get("category")),
        notes: text_of(object.get("notes")),
        billable: object
            .get("billable")
            .and_then(Value::as_bool)
            .unwrap_or(true),
    })
}

fn parse_trip(value: &Value) -> CoreResult<MobileTrip> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;

    Ok(MobileTrip {
        id: text_of(object.get("id")),
        date: text_of(object.get("date")),
        customer_id: text_of(
            object
                .get("customerId")
                .or_else(|| object.get("customer_id")),
        ),
        customer_name: text_of(
            object
                .get("customerName")
                .or_else(|| object.get("customer")),
        ),
        start_location: text_of(
            object
                .get("startLocation")
                .or_else(|| object.get("start_location")),
        ),
        end_location: text_of(
            object
                .get("endLocation")
                .or_else(|| object.get("end_location")),
        ),
        distance_km: number(
            object
                .get("distanceKm")
                .or_else(|| object.get("km"))
                .or_else(|| object.get("distance")),
        )
        .unwrap_or(0.0),
        cost_cents: money_cents(object.get("calculatedCost").or_else(|| object.get("cost"))),
        notes: text_of(object.get("notes")),
    })
}

fn parse_customer(value: &Value) -> CoreResult<MobileCustomer> {
    let object = value
        .as_object()
        .ok_or_else(|| CoreError::Validation("mobile_invalid_payload".to_string()))?;

    Ok(MobileCustomer {
        id: text_of(object.get("id")),
        company_name: text_of(object.get("companyName").or_else(|| object.get("name"))),
        contact_person: text_of(object.get("contactPerson")),
        email: text_of(object.get("email")),
        phone: text_of(object.get("phone")),
        street: text_of(object.get("street")),
        zip_city: text_of(object.get("zipCity")),
        hourly_rate: number(object.get("customHourlyRate")),
    })
}

fn session_hours(session: &MobileSession) -> Option<f64> {
    let hours = session
        .duration_minutes
        .map(|minutes| minutes / 60.0)
        .or_else(|| session.duration_seconds.map(|seconds| seconds / 3600.0))
        .or(session.hours)
        .or_else(|| {
            session.duration.map(|duration| {
                if duration > 20.0 {
                    duration / 60.0
                } else {
                    duration
                }
            })
        })
        .or_else(|| match (session.started_at, session.ended_at) {
            (Some(start), Some(end)) if end > start => Some((end - start) as f64 / 3_600_000.0),
            _ => None,
        });

    hours.filter(|hours| *hours > 0.0)
}

fn session_description(session: &MobileSession) -> String {
    let mut parts = Vec::new();
    if let Some(task) = session.notes.task.as_deref() {
        parts.push(format!("Auftrag: {task}"));
    }
    if let Some(objective) = session.notes.objective.as_deref() {
        parts.push(format!("Ziel: {objective}"));
    }
    if let Some(report) = session.notes.on_site_report.as_deref() {
        parts.push(format!("Tätigkeitsbericht vor Ort: {report}"));
    }
    if let Some(material) = session.notes.material_and_expenses.as_deref() {
        parts.push(format!("Material & Spesen: {material}"));
    }
    if let Some(remarks) = session.notes.remarks.as_deref() {
        parts.push(format!("Besonderheiten & Abnahme: {remarks}"));
    }
    if parts.is_empty() {
        if let Some(description) = session.description.as_deref() {
            parts.push(description.to_string());
        } else if !session.title.trim().is_empty() {
            parts.push(session.title.clone());
        }
    }
    parts.join("\n\n")
}

fn plan_timesheet(timesheet: &MobileTimesheet) -> PlannedTime {
    let minutes = ((timesheet.hours * 60.0).round() as i64).max(0);
    let started_at = timesheet
        .started_at
        .or_else(|| timesheet.date.as_deref().and_then(parse_iso8601))
        .unwrap_or_else(now_millis);

    PlannedTime {
        description: timesheet
            .description
            .clone()
            .unwrap_or_else(|| "Mobiler Einsatz".to_string()),
        minutes,
        started_at,
    }
}

fn append_details(
    description: &mut String,
    number: Option<&str>,
    _timesheets_extra: Option<&MobileTimesheet>,
    timesheets: &[MobileTimesheet],
    expenses: &[MobileExpense],
    kilometers: f64,
    currency: &str,
) {
    if let Some(number) = number.filter(|number| !number.trim().is_empty()) {
        if !description.trim().is_empty() {
            description.push('\n');
        }
        description.push_str("Ticket-Nr.: ");
        description.push_str(number.trim());
    }

    let minutes: i64 = timesheets
        .iter()
        .map(|timesheet| ((timesheet.hours * 60.0).round() as i64).max(0))
        .sum();
    let expense_cents: i64 = expenses.iter().map(|expense| expense.amount_cents).sum();
    if minutes == 0 && expenses.is_empty() && kilometers <= 0.0 {
        return;
    }

    let mut parts = Vec::new();
    if minutes > 0 {
        parts.push(format!("{:.2} h", minutes as f64 / 60.0));
    }
    if !expenses.is_empty() {
        parts.push(format!(
            "{} Spesen ({})",
            expenses.len(),
            Money::from_cents(expense_cents).format_localized(currency)
        ));
    }
    if kilometers > 0.0 {
        parts.push(format!("{kilometers:.1} km"));
    }

    if !description.trim().is_empty() {
        description.push_str("\n\n");
    }
    description.push_str("Mobil-Sync: ");
    description.push_str(&parts.join(", "));
    description.push('.');
}

fn real_expenses(expenses: &[MobileExpense]) -> Vec<MobileExpense> {
    expenses
        .iter()
        .filter(|expense| expense.amount_cents != 0 || !expense.title.trim().is_empty())
        .cloned()
        .collect()
}

fn subject_or(value: &str, fallback: &str) -> String {
    let value = value.trim();
    if value.is_empty() {
        fallback.to_string()
    } else {
        value.to_string()
    }
}

fn status_of(value: Option<&str>) -> TicketStatus {
    match value.map(str::trim) {
        Some("waiting") => TicketStatus::Waiting,
        Some("resolved") | Some("closed") | Some("done") => TicketStatus::Closed,
        Some("open") | Some("new") => TicketStatus::Open,
        _ => TicketStatus::InProgress,
    }
}

fn priority_of(value: Option<i64>) -> TicketPriority {
    match value {
        Some(0) => TicketPriority::Low,
        Some(2) => TicketPriority::High,
        Some(3) => TicketPriority::Urgent,
        _ => TicketPriority::Normal,
    }
}

fn text_of(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn number(value: Option<&Value>) -> Option<f64> {
    value
        .and_then(|value| {
            value
                .as_f64()
                .or_else(|| value.as_str().and_then(|text| text.trim().parse().ok()))
        })
        .filter(|value| value.is_finite())
}

fn integer(value: Option<&Value>) -> Option<i64> {
    value.and_then(|value| {
        value.as_i64().or_else(|| {
            value
                .as_f64()
                .filter(|number| number.is_finite())
                .map(|number| number.round() as i64)
        })
    })
}

fn money_cents(value: Option<&Value>) -> i64 {
    number(value)
        .map(|amount| (amount * 100.0).round() as i64)
        .unwrap_or(0)
}

fn timestamp(value: Option<&Value>) -> Option<i64> {
    let value = value?;
    if let Some(text) = value.as_str() {
        return parse_iso8601(text);
    }
    value.as_i64()
}

/// Milliseconds of the payload export, for logs and the CLI.
pub fn export_time(payload: &SyncPayload) -> String {
    payload
        .exported_at
        .map(format_iso8601)
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../tests/fixtures/mobile/sync_payload.json");

    fn fixture() -> SyncPayload {
        let value: Value = serde_json::from_str(FIXTURE).expect("fixture json");
        normalize(&value).expect("fixture payload")
    }

    #[test]
    fn normalizes_the_published_payload() {
        let payload = fixture();
        assert_eq!(payload.protocol, PROTOCOL);
        assert_eq!(payload.export_version.as_deref(), Some("1.0"));
        assert_eq!(
            payload.app_name.as_deref(),
            Some("SOCDOF TimeTracking Mobile")
        );
        assert_eq!(payload.device.as_deref(), Some("sunrise-fields-01"));
        assert_eq!(payload.currency(), "EUR");
        assert_eq!(payload.tickets.len(), 1);
        assert_eq!(payload.sessions.len(), 1);
        assert_eq!(payload.trips.len(), 1);
        assert_eq!(payload.customers.len(), 1);
        assert_eq!(payload.standalone_timesheets.len(), 1);
        assert_eq!(payload.standalone_expenses.len(), 1);
        assert_eq!(payload.summary.total_sessions, Some(2));
        assert_eq!(payload.summary.total_kilometers, Some(42.0));

        let ticket = &payload.tickets[0];
        assert_eq!(ticket.number.as_deref(), Some("MOB-101"));
        assert_eq!(ticket.priority, Some(2));
        assert_eq!(ticket.expenses[0].amount_cents, 2_520);
        assert_eq!(ticket.timesheets[0].hours, 2.5);
        assert_eq!(
            ticket.voice_notes[0].transcript.as_deref(),
            Some("Filterpatrone getauscht, Anlage läuft wieder.")
        );
    }

    #[test]
    fn plans_sessions_like_the_type_schemas() {
        let payload = fixture();
        let planned = payload.plan();
        assert_eq!(planned.len(), 3, "session, ticket and standalone booking");

        let session = planned
            .iter()
            .find(|ticket| {
                ticket.subject == "Wartung Filteranlage" && ticket.timesheets[0].minutes == 135
            })
            .expect("session ticket");
        assert_eq!(session.timesheets[0].minutes, 135);
        assert_eq!(session.kilometers, 42.0);
        assert_eq!(session.priority, TicketPriority::Normal);
        assert!(session
            .description
            .contains("Auftrag: Filterpatrone tauschen"));
        assert!(session.description.contains("Ort: Brixen"));
        // Material plus the matching trip are counted as expenses of the session.
        assert_eq!(session.expenses.len(), 2);
        assert_eq!(
            session
                .expenses
                .iter()
                .map(|expense| expense.amount_cents)
                .sum::<i64>(),
            2_520 + 3_830
        );

        let ticket = planned
            .iter()
            .find(|ticket| ticket.timesheets[0].minutes == 150)
            .expect("explicit ticket");
        assert_eq!(ticket.status, TicketStatus::InProgress);
        assert_eq!(ticket.priority, TicketPriority::High);
        assert!(ticket.description.contains("Ticket-Nr.: MOB-101"));
        assert!(ticket
            .description
            .contains("Sprachnotiz: Filterpatrone getauscht"));
        assert!(ticket
            .description
            .contains("Mobil-Sync: 2.50 h, 1 Spesen (25,20"));

        let standalone = planned
            .iter()
            .find(|ticket| ticket.subject.contains("Sammel-Zeiterfassung"))
            .expect("standalone booking");
        assert_eq!(standalone.timesheets[0].minutes, 120);
    }

    #[test]
    fn unwraps_wrapped_payloads_and_arrays() {
        let inner = json!({ "tickets": [{ "title": "Wartung" }] });
        let wrapped = json!({ "payload": inner });
        let payload = normalize(&wrapped).expect("wrapped payload");
        assert_eq!(payload.tickets.len(), 1);

        let sessions = json!([{ "title": "Einsatz", "durationMinutes": 30 }]);
        let payload = normalize(&sessions).expect("array payload");
        assert_eq!(payload.sessions.len(), 1);
    }

    #[test]
    fn rejects_foreign_protocols_and_empty_payloads() {
        let foreign = json!({ "protocol": "SOMETHING_ELSE_V9", "tickets": [] });
        assert!(matches!(
            normalize(&foreign),
            Err(CoreError::Validation(code)) if code == "mobile_unsupported_protocol"
        ));

        let empty = json!({ "protocol": PROTOCOL });
        assert!(matches!(
            normalize(&empty),
            Err(CoreError::Validation(code)) if code == "mobile_empty_payload"
        ));

        assert!(matches!(
            normalize(&json!("text")),
            Err(CoreError::Validation(code)) if code == "mobile_invalid_payload"
        ));
        assert!(matches!(
            normalize_bytes(b"{oops"),
            Err(CoreError::Validation(code)) if code == "mobile_invalid_json"
        ));
    }
}
