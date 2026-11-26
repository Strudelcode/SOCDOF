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
