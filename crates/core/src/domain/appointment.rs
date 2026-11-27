//! Calendar appointments.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::contact::Contact;
use crate::domain::invoice::{Invoice, InvoiceStatus};

/// Lifecycle state of an appointment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppointmentStatus {
    /// Created, not confirmed by the customer yet.
    Scheduled,
    /// Confirmed by the customer.
    Confirmed,
    /// Took place.
    Completed,
    /// Cancelled by either side.
    Cancelled,
    /// The customer did not show up.
    NoShow,
}

impl AppointmentStatus {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            AppointmentStatus::Scheduled => "scheduled",
            AppointmentStatus::Confirmed => "confirmed",
            AppointmentStatus::Completed => "completed",
            AppointmentStatus::Cancelled => "cancelled",
            AppointmentStatus::NoShow => "no_show",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "scheduled" => Some(AppointmentStatus::Scheduled),
            "confirmed" => Some(AppointmentStatus::Confirmed),
            "completed" => Some(AppointmentStatus::Completed),
            "cancelled" => Some(AppointmentStatus::Cancelled),
            "no_show" => Some(AppointmentStatus::NoShow),
            _ => None,
        }
    }

    /// Whether the appointment still occupies a slot in the calendar.
    pub fn is_open(self) -> bool {
        matches!(
            self,
            AppointmentStatus::Scheduled | AppointmentStatus::Confirmed
        )
    }
}

/// Colour-coded kind of a calendar entry.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppointmentCategory {
    /// Due date of an invoice.
    Invoice,
    /// Visit or call at a customer.
    Customer,
    /// Internal meeting.
    Meeting,
    /// Deadline or submission.
    Deadline,
    /// Private entry.
    Personal,
    /// Everything else.
    #[default]
    General,
}

impl AppointmentCategory {
    /// Categories in display order.
    pub const ALL: [AppointmentCategory; 6] = [
        AppointmentCategory::Invoice,
        AppointmentCategory::Customer,
        AppointmentCategory::Meeting,
        AppointmentCategory::Deadline,
        AppointmentCategory::Personal,
        AppointmentCategory::General,
    ];

    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            AppointmentCategory::Invoice => "invoice",
            AppointmentCategory::Customer => "customer",
            AppointmentCategory::Meeting => "meeting",
            AppointmentCategory::Deadline => "deadline",
            AppointmentCategory::Personal => "personal",
            AppointmentCategory::General => "general",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "invoice" => Some(AppointmentCategory::Invoice),
            "customer" => Some(AppointmentCategory::Customer),
            "meeting" => Some(AppointmentCategory::Meeting),
            "deadline" => Some(AppointmentCategory::Deadline),
            "personal" => Some(AppointmentCategory::Personal),
            "general" => Some(AppointmentCategory::General),
            _ => None,
        }
    }

    /// Catalogue key of the category label.
    pub fn label_key(self) -> &'static str {
        match self {
            AppointmentCategory::Invoice => "appointments_category_invoice",
            AppointmentCategory::Customer => "appointments_category_customer",
            AppointmentCategory::Meeting => "appointments_category_meeting",
            AppointmentCategory::Deadline => "appointments_category_deadline",
            AppointmentCategory::Personal => "appointments_category_personal",
            AppointmentCategory::General => "appointments_category_general",
        }
    }
}

/// A calendar entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Appointment {
    /// Stable identifier.
    pub id: Uuid,
    /// Customer or supplier the appointment belongs to.
    pub contact_id: Option<Uuid>,
    /// Short title shown in the calendar.
    pub title: String,
    /// Room, address or link.
    pub location: Option<String>,
    /// Free text notes.
    pub notes: Option<String>,
    /// Colour-coded kind shown as accent and filter.
    #[serde(default)]
    pub category: AppointmentCategory,
    /// Whether the entry fills whole days; its times are then the day boundaries.
    #[serde(default)]
    pub all_day: bool,
    /// Current lifecycle state.
    pub status: AppointmentStatus,
    /// Start in milliseconds since the Unix epoch.
    pub starts_at: i64,
    /// End in milliseconds since the Unix epoch.
    pub ends_at: i64,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Appointment {
    /// Length of the appointment in minutes, rounded down.
    pub fn duration_minutes(&self) -> i64 {
        (self.ends_at - self.starts_at) / 60_000
    }

    /// Number of calendar days the appointment touches.
    pub fn day_count(&self) -> i64 {
        ((self.ends_at - 1 - self.starts_at).max(0) / 86_400_000) + 1
    }

    /// Whether the appointment overlaps the given half-open range.
    pub fn overlaps(&self, from: i64, to: i64) -> bool {
        self.starts_at < to && from < self.ends_at
    }

    /// Whether two open appointments occupy the same slot.
    pub fn conflicts_with(&self, other: &Appointment) -> bool {
        self.id != other.id
            && self.status.is_open()
            && other.status.is_open()
            && self.starts_at < other.ends_at
            && other.starts_at < self.ends_at
    }

    /// Whether this appointment collides with any of the given appointments.
    pub fn has_conflict(&self, others: &[Appointment]) -> bool {
        others.iter().any(|other| self.conflicts_with(other))
    }

    /// Validates the appointment before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() {
            return Err("title_required".to_string());
        }
        if self.starts_at <= 0 {
            return Err("start_required".to_string());
        }
        if self.ends_at <= self.starts_at {
            return Err("end_before_start".to_string());
        }
        Ok(())
    }
}

/// Exports local appointments as an RFC 5545 iCalendar file.
///
/// Timestamps are serialized in UTC because appointments are stored as Unix milliseconds. Text
/// properties are escaped and folded to the 75-octet line limit required by iCalendar clients.
pub fn export_appointments_ics(appointments: &[Appointment], generated_at_ms: i64) -> String {
    let mut output = String::from(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SOCDOF//Local Calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:SOCDOF\r\n",
    );
    let mut ordered = appointments.iter().collect::<Vec<_>>();
    ordered.sort_by_key(|appointment| (appointment.starts_at, appointment.id));

    for appointment in ordered {
        push_ical_line(&mut output, "BEGIN:VEVENT");
        push_ical_line(&mut output, &format!("UID:{}@socdof", appointment.id));
        push_ical_line(
            &mut output,
            &format!("DTSTAMP:{}", ical_datetime(generated_at_ms)),
        );
        if appointment.all_day {
            // All-day events use DATE values; DTEND is exclusive, so the stored range already
            // points at the first millisecond of the day that follows the last covered day.
            let ends_at = if appointment.ends_at > appointment.starts_at {
                appointment.ends_at
            } else {
                appointment.starts_at + 86_400_000
            };
            push_ical_line(
                &mut output,
                &format!("DTSTART;VALUE=DATE:{}", ical_date(appointment.starts_at)),
            );
            push_ical_line(
                &mut output,
                &format!("DTEND;VALUE=DATE:{}", ical_date(ends_at)),
            );
        } else {
            push_ical_line(
                &mut output,
                &format!("DTSTART:{}", ical_datetime(appointment.starts_at)),
            );
            push_ical_line(
                &mut output,
                &format!("DTEND:{}", ical_datetime(appointment.ends_at)),
            );
        }
        push_ical_line(
            &mut output,
            &format!("CREATED:{}", ical_datetime(appointment.created_at)),
        );
        push_ical_line(
            &mut output,
            &format!(
                "LAST-MODIFIED:{}",
                ical_datetime(appointment.updated_at.max(appointment.created_at))
            ),
        );
        push_ical_line(
            &mut output,
            &format!("SUMMARY:{}", escape_ical_text(&appointment.title)),
        );
        if let Some(location) = appointment
            .location
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            push_ical_line(
                &mut output,
                &format!("LOCATION:{}", escape_ical_text(location)),
            );
        }
        if let Some(notes) = appointment
            .notes
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            push_ical_line(
                &mut output,
                &format!("DESCRIPTION:{}", escape_ical_text(notes)),
            );
        }
        push_ical_line(
            &mut output,
            &format!(
                "CATEGORIES:{}",
                appointment.category.as_str().to_uppercase()
            ),
        );
        let status = match appointment.status {
            AppointmentStatus::Scheduled => "TENTATIVE",
            AppointmentStatus::Confirmed
            | AppointmentStatus::Completed
            | AppointmentStatus::NoShow => "CONFIRMED",
            AppointmentStatus::Cancelled => "CANCELLED",
        };
        push_ical_line(&mut output, &format!("STATUS:{status}"));
        push_ical_line(&mut output, "END:VEVENT");
    }

    output.push_str("END:VCALENDAR\r\n");
    output
}

fn ical_date(timestamp_ms: i64) -> String {
    let (year, month, day) = crate::date::civil_from_millis(timestamp_ms);
    format!("{year:04}{month:02}{day:02}")
}

fn ical_datetime(timestamp_ms: i64) -> String {
    let (year, month, day) = crate::date::civil_from_millis(timestamp_ms);
    let millis_of_day = timestamp_ms.rem_euclid(86_400_000);
    let hours = millis_of_day / 3_600_000;
    let minutes = (millis_of_day % 3_600_000) / 60_000;
    let seconds = (millis_of_day % 60_000) / 1_000;
    format!("{year:04}{month:02}{day:02}T{hours:02}{minutes:02}{seconds:02}Z")
}

fn escape_ical_text(value: &str) -> String {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    let mut escaped = String::with_capacity(normalized.len());
    for character in normalized.chars() {
        match character {
            '\\' => escaped.push_str("\\\\"),
            ';' => escaped.push_str("\\;"),
            ',' => escaped.push_str("\\,"),
            '\n' => escaped.push_str("\\n"),
            _ => escaped.push(character),
        }
    }
    escaped
}

fn push_ical_line(output: &mut String, line: &str) {
    let mut current = String::new();
    let mut octets = 0;
    for character in line.chars() {
        let width = character.len_utf8();
        if octets + width > 75 {
            output.push_str(&current);
            output.push_str("\r\n ");
            current.clear();
            octets = 1;
        }
        current.push(character);
        octets += width;
    }
    output.push_str(&current);
    output.push_str("\r\n");
}

/// Due date of an invoice as a read-only calendar entry.
///
/// The screen merges these entries with the stored appointments the same way the TypeScript
/// template merges invoice due dates, local events and Google events into one list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceEvent {
    /// Invoice the entry belongs to.
    pub invoice_id: Uuid,
    /// Human readable invoice number.
    pub number: String,
    /// Title shown in the calendar.
    pub title: String,
    /// Amount, status and customer shown in the detail view.
    pub notes: String,
    /// Due date at midnight.
    pub starts_at: i64,
    /// Start of the day after the due date.
    pub ends_at: i64,
    /// Whether the invoice is paid.
    pub paid: bool,
    /// Whether the due date passed without payment.
    pub overdue: bool,
}

/// Builds the read-only calendar entries of all due invoices except cancelled ones.
pub fn invoice_events(invoices: &[Invoice], contacts: &[Contact], now: i64) -> Vec<InvoiceEvent> {
    let mut events = invoices
        .iter()
        .filter(|invoice| invoice.status != InvoiceStatus::Cancelled && invoice.due_at > 0)
        .map(|invoice| {
            let paid = invoice.status == InvoiceStatus::Paid;
            let overdue =
                !paid && (invoice.status == InvoiceStatus::Overdue || invoice.due_at < now);
            let contact = contacts
                .iter()
                .find(|contact| contact.id == invoice.contact_id)
                .map(contact_label)
                .unwrap_or_default();
            let total = invoice.total_gross().cents();
            InvoiceEvent {
                invoice_id: invoice.id,
                number: invoice.number.clone(),
                title: format!("Rechnung #{}", invoice.number),
                notes: format!(
                    "Fällige Rechnung über {}.{:02} {} (Status: {})\n{}",
                    total / 100,
                    total.rem_euclid(100),
                    invoice.currency_symbol,
                    invoice.status.as_str().to_uppercase(),
                    contact
                ),
                starts_at: invoice.due_at.div_euclid(86_400_000) * 86_400_000,
                ends_at: (invoice.due_at.div_euclid(86_400_000) + 1) * 86_400_000,
                paid,
                overdue,
            }
        })
        .collect::<Vec<_>>();
    events.sort_by_key(|event| (event.starts_at, event.number.clone()));
    events
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::InvoiceLine;
    use crate::money::Money;

    fn sample() -> Appointment {
        Appointment {
            id: Uuid::new_v4(),
            contact_id: None,
            title: "Kickoff".to_string(),
            location: None,
            notes: None,
            category: AppointmentCategory::General,
            all_day: false,
            status: AppointmentStatus::Scheduled,
            starts_at: 1_700_000_000_000,
            ends_at: 1_700_000_000_000 + 45 * 60_000,
            created_at: 0,
            updated_at: 0,
        }
    }

    fn sample_invoice(contact_id: Uuid, due_at: i64) -> Invoice {
        Invoice {
            id: Uuid::new_v4(),
            number: "2026-0042".to_string(),
            contact_id,
            status: InvoiceStatus::Sent,
            issued_at: due_at - 14 * 86_400_000,
            due_at,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(12_500),
                tax_rate_bp: 1900,
            }],
        }
    }

    #[test]
    fn roundtrips_categories_and_counts_days() {
        for category in AppointmentCategory::ALL {
            assert_eq!(
                AppointmentCategory::from_storage(category.as_str()),
                Some(category)
            );
            assert!(category.label_key().starts_with("appointments_category_"));
        }
        let mut appointment = sample();
        appointment.all_day = true;
        appointment.starts_at = 1_700_000_000_000 / 86_400_000 * 86_400_000;
        appointment.ends_at = appointment.starts_at + 3 * 86_400_000;
        assert_eq!(appointment.day_count(), 3);
        appointment.ends_at = appointment.starts_at + 86_400_000;
        assert_eq!(appointment.day_count(), 1);
    }

    #[test]
    fn exports_all_day_entries_with_date_values_and_categories() {
        let mut appointment = sample();
        appointment.all_day = true;
        appointment.category = AppointmentCategory::Deadline;
        appointment.starts_at = 1_700_000_000_000 / 86_400_000 * 86_400_000;
        appointment.ends_at = appointment.starts_at + 2 * 86_400_000;
        let ics = export_appointments_ics(&[appointment], 1_700_000_000_000);
        assert!(ics.contains("DTSTART;VALUE=DATE:20231114"));
        assert!(ics.contains("DTEND;VALUE=DATE:20231116"));
        assert!(ics.contains("CATEGORIES:DEADLINE"));
        assert!(!ics.contains("DTSTART:2023"));
    }

    #[test]
    fn builds_invoice_due_events_and_skips_cancelled_ones() {
        let now = 1_700_000_000_000;
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.name = Some("Müller GmbH".to_string());
        let due_at = now + 2 * 86_400_000;
        let invoice = sample_invoice(contact.id, due_at);
        let mut cancelled = invoice.clone();
        cancelled.id = Uuid::new_v4();
        cancelled.number = "2026-0043".to_string();
        cancelled.status = InvoiceStatus::Cancelled;

        let events = invoice_events(&[invoice.clone(), cancelled], &[contact], now);
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.title, "Rechnung #2026-0042");
        assert!(event.notes.contains("Müller GmbH"));
        assert!(event.notes.contains("148.75 €"));
        assert!(event.notes.contains("SENT"));
        assert!(!event.paid);
        assert!(!event.overdue);
        assert_eq!(
            event.starts_at.div_euclid(86_400_000),
            due_at.div_euclid(86_400_000)
        );
        assert_eq!(event.ends_at - event.starts_at, 86_400_000);

        let overdue = invoice_events(&[invoice], &[], now + 3 * 86_400_000);
        assert!(overdue[0].overdue);
    }

    #[test]
    fn exports_valid_utc_icalendar_with_escaped_text_and_status() {
        let mut appointment = sample();
        appointment.title = "Review, project; release\nNext".to_string();
        appointment.location = Some("Room 2, north".to_string());
        appointment.notes = Some("Bring slides\nand notes".to_string());
        appointment.status = AppointmentStatus::Cancelled;
        let ics = export_appointments_ics(std::slice::from_ref(&appointment), 1_700_000_000_000);

        assert!(ics.starts_with("BEGIN:VCALENDAR\r\nVERSION:2.0"));
        assert!(ics.contains("DTSTAMP:20231114T221320Z"));
        assert!(ics.contains("DTSTART:20231114T221320Z"));
        assert!(ics.contains("SUMMARY:Review\\, project\\; release\\nNext"));
        assert!(ics.contains("LOCATION:Room 2\\, north"));
        assert!(ics.contains("DESCRIPTION:Bring slides\\nand notes"));
        assert!(ics.contains("STATUS:CANCELLED"));
        assert!(ics.ends_with("END:VCALENDAR\r\n"));
    }

    #[test]
    fn sorts_ical_events_and_folds_long_utf8_lines() {
        let mut later = sample();
        later.title = "Ä".repeat(80);
        later.starts_at += 86_400_000;
        later.ends_at += 86_400_000;
        let earlier = sample();
        let ics = export_appointments_ics(&[later, earlier], 1_700_000_000_000);
        let first_event = ics.find("DTSTART:").expect("first start");
        let second_event = ics[first_event + 1..]
            .find("DTSTART:")
            .expect("second start")
            + first_event
            + 1;
        assert!(ics[first_event..].starts_with("DTSTART:20231114"));
        assert!(ics[second_event..].starts_with("DTSTART:20231115"));
        assert!(ics
            .lines()
            .all(|line| line.trim_end_matches('\r').len() <= 75));
    }

    #[test]
    fn computes_duration_and_overlap() {
        let appointment = sample();
        assert_eq!(appointment.duration_minutes(), 45);
        assert!(appointment.overlaps(appointment.starts_at + 60_000, appointment.ends_at + 60_000));
        assert!(!appointment.overlaps(appointment.ends_at, appointment.ends_at + 60_000));
    }

    #[test]
    fn detects_open_slot_conflicts() {
        let first = sample();
        let mut second = sample();
        second.id = Uuid::new_v4();
        second.starts_at = first.ends_at - 60_000;
        second.ends_at = second.starts_at + 30 * 60_000;
        assert!(first.conflicts_with(&second));
        assert!(first.has_conflict(&[second.clone()]));

        let mut cancelled = second.clone();
        cancelled.status = AppointmentStatus::Cancelled;
        assert!(!first.conflicts_with(&cancelled));

        let mut later = second;
        later.starts_at = first.ends_at;
        later.ends_at = later.starts_at + 30 * 60_000;
        assert!(!first.conflicts_with(&later));
        assert!(!first.conflicts_with(&first.clone()));
    }

    #[test]
    fn validates_time_range() {
        let mut appointment = sample();
        assert_eq!(appointment.validate(), Ok(()));

        appointment.ends_at = appointment.starts_at;
        assert_eq!(appointment.validate(), Err("end_before_start".to_string()));

        let mut appointment = sample();
        appointment.title = " ".to_string();
        assert_eq!(appointment.validate(), Err("title_required".to_string()));
    }

    #[test]
    fn roundtrips_status_strings() {
        for status in [
            AppointmentStatus::Scheduled,
            AppointmentStatus::Confirmed,
            AppointmentStatus::Completed,
            AppointmentStatus::Cancelled,
            AppointmentStatus::NoShow,
        ] {
            assert_eq!(
                AppointmentStatus::from_storage(status.as_str()),
                Some(status)
            );
        }
        assert!(AppointmentStatus::Confirmed.is_open());
        assert!(!AppointmentStatus::NoShow.is_open());
    }
}
