//! Calendar appointments.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
        push_ical_line(
            &mut output,
            &format!("DTSTART:{}", ical_datetime(appointment.starts_at)),
        );
        push_ical_line(
            &mut output,
            &format!("DTEND:{}", ical_datetime(appointment.ends_at)),
        );
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
        if let Some(location) = appointment.location.as_deref().filter(|value| !value.trim().is_empty()) {
            push_ical_line(
                &mut output,
                &format!("LOCATION:{}", escape_ical_text(location)),
            );
        }
        if let Some(notes) = appointment.notes.as_deref().filter(|value| !value.trim().is_empty()) {
            push_ical_line(
                &mut output,
                &format!("DESCRIPTION:{}", escape_ical_text(notes)),
            );
        }
        let status = match appointment.status {
            AppointmentStatus::Scheduled => "TENTATIVE",
            AppointmentStatus::Confirmed | AppointmentStatus::Completed | AppointmentStatus::NoShow => {
                "CONFIRMED"
            }
            AppointmentStatus::Cancelled => "CANCELLED",
        };
        push_ical_line(&mut output, &format!("STATUS:{status}"));
        push_ical_line(&mut output, "END:VEVENT");
    }

    output.push_str("END:VCALENDAR\r\n");
    output
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Appointment {
        Appointment {
            id: Uuid::new_v4(),
            contact_id: None,
            title: "Kickoff".to_string(),
            location: None,
            notes: None,
            status: AppointmentStatus::Scheduled,
            starts_at: 1_700_000_000_000,
            ends_at: 1_700_000_000_000 + 45 * 60_000,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn exports_valid_utc_icalendar_with_escaped_text_and_status() {
        let mut appointment = sample();
        appointment.title = "Review, project; release\\\nNext".to_string();
        appointment.location = Some("Room 2, north".to_string());
        appointment.notes = Some("Bring slides\\\nand notes".to_string());
        appointment.status = AppointmentStatus::Cancelled;
        let ics = export_appointments_ics(&[appointment.clone()], 1_700_000_000_000);

        assert!(ics.starts_with("BEGIN:VCALENDAR\\r\\nVERSION:2.0"));
        assert!(ics.contains("DTSTAMP:20231114T221320Z"));
        assert!(ics.contains("DTSTART:20231114T221320Z"));
        assert!(ics.contains("SUMMARY:Review\\\\, project\\\\; release\\\\\\\\\\\\nNext"));
        assert!(ics.contains("LOCATION:Room 2\\\\, north"));
        assert!(ics.contains("DESCRIPTION:Bring slides\\\\\\\\\\\\n and notes") == false);
        assert!(ics.contains("STATUS:CANCELLED"));
        assert!(ics.ends_with("END:VCALENDAR\\r\\n"));
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
        let second_event = ics[first_event + 1..].find("DTSTART:").expect("second start")
            + first_event + 1;
        assert!(ics[first_event..].starts_with("DTSTART:20231114"));
        assert!(ics[second_event..].starts_with("DTSTART:20231115"));
        assert!(ics.lines().all(|line| line.len() <= 75));
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
