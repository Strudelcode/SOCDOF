//! Support tickets and tracked working time.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Lifecycle state of a support ticket.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    /// Reported, nobody picked it up yet.
    Open,
    /// Being worked on.
    InProgress,
    /// Waiting for the customer.
    Waiting,
    /// Done.
    Closed,
}

impl TicketStatus {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            TicketStatus::Open => "open",
            TicketStatus::InProgress => "in_progress",
            TicketStatus::Waiting => "waiting",
            TicketStatus::Closed => "closed",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "open" => Some(TicketStatus::Open),
            "in_progress" => Some(TicketStatus::InProgress),
            "waiting" => Some(TicketStatus::Waiting),
            "closed" => Some(TicketStatus::Closed),
            _ => None,
        }
    }

    /// Whether the ticket still needs attention.
    pub fn is_open(self) -> bool {
        self != TicketStatus::Closed
    }
}

/// How urgent a ticket is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TicketPriority {
    /// Can wait.
    Low,
    /// Default.
    Normal,
    /// Needs attention today.
    High,
    /// Production is down.
    Urgent,
}

impl TicketPriority {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            TicketPriority::Low => "low",
            TicketPriority::Normal => "normal",
            TicketPriority::High => "high",
            TicketPriority::Urgent => "urgent",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "low" => Some(TicketPriority::Low),
            "normal" => Some(TicketPriority::Normal),
            "high" => Some(TicketPriority::High),
            "urgent" => Some(TicketPriority::Urgent),
            _ => None,
        }
    }
}

/// A support ticket.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupportTicket {
    /// Stable identifier.
    pub id: Uuid,
    /// Customer the ticket belongs to.
    pub contact_id: Option<Uuid>,
    /// Short summary.
    pub subject: String,
    /// Full description.
    pub description: String,
    /// Current lifecycle state.
    pub status: TicketStatus,
    /// Urgency.
    pub priority: TicketPriority,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
    /// Closing time, empty while the ticket is open.
    pub closed_at: Option<i64>,
}

impl SupportTicket {
    /// Validates the ticket before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.subject.trim().is_empty() {
            return Err("subject_required".to_string());
        }
        Ok(())
    }
}

/// One block of tracked working time.
///
/// Entries belong to a ticket or stand alone, so the same table serves support time tracking and
/// project work.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeEntry {
    /// Stable identifier.
    pub id: Uuid,
    /// Ticket the entry was booked on, empty for free work.
    pub ticket_id: Option<Uuid>,
    /// User who worked, empty when recorded before authentication.
    pub user_id: Option<Uuid>,
    /// What was done.
    pub description: String,
    /// Duration in whole minutes.
    pub minutes: i64,
    /// Start of the work in milliseconds since the Unix epoch.
    pub started_at: i64,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl TimeEntry {
    /// Duration as decimal hours, rounded to two decimals.
    pub fn hours(&self) -> f64 {
        (self.minutes as f64 / 60.0 * 100.0).round() / 100.0
    }

    /// Validates the entry before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.minutes <= 0 {
            return Err("minutes_invalid".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_tickets_and_time_entries() {
        let mut ticket = SupportTicket {
            id: Uuid::new_v4(),
            contact_id: None,
            subject: "Drucker defekt".to_string(),
            description: String::new(),
            status: TicketStatus::Open,
            priority: TicketPriority::Normal,
            created_at: 0,
            updated_at: 0,
            closed_at: None,
        };
        assert_eq!(ticket.validate(), Ok(()));
        ticket.subject = " ".to_string();
        assert_eq!(ticket.validate(), Err("subject_required".to_string()));

        let mut entry = TimeEntry {
            id: Uuid::new_v4(),
            ticket_id: Some(ticket.id),
            user_id: None,
            description: "Vor Ort".to_string(),
            minutes: 90,
            started_at: 0,
            created_at: 0,
            updated_at: 0,
        };
        assert_eq!(entry.validate(), Ok(()));
        assert_eq!(entry.hours(), 1.5);

        entry.minutes = 0;
        assert_eq!(entry.validate(), Err("minutes_invalid".to_string()));
    }

    #[test]
    fn roundtrips_status_and_priority_strings() {
        for status in [
            TicketStatus::Open,
            TicketStatus::InProgress,
            TicketStatus::Waiting,
            TicketStatus::Closed,
        ] {
            assert_eq!(TicketStatus::from_storage(status.as_str()), Some(status));
        }
        for priority in [
            TicketPriority::Low,
            TicketPriority::Normal,
            TicketPriority::High,
            TicketPriority::Urgent,
        ] {
            assert_eq!(
                TicketPriority::from_storage(priority.as_str()),
                Some(priority)
            );
        }
        assert!(TicketStatus::Waiting.is_open());
        assert!(!TicketStatus::Closed.is_open());
    }
}
