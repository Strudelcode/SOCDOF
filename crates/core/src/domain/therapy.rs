//! Therapy practice: clients, sessions and their billing link.
//!
//! The legacy app kept the practice in its own licensed module: clients with an hourly rate and a
//! rate per kilometre, sessions with duration, driven distance and notes, and a link from every
//! session to the invoice that billed it. [`summarize`] and [`session_amount`] are pure functions,
//! so the totals of a client can be tested without a database and the screen only formats them.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// A client of the practice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TherapyClient {
    /// Stable identifier.
    pub id: Uuid,
    /// Display name.
    pub name: String,
    /// Email address, empty when unknown.
    pub email: String,
    /// Phone number, empty when unknown.
    pub phone: String,
    /// Hourly rate charged for treatment time.
    pub hourly_rate: Money,
    /// Rate per driven kilometre.
    pub kilometer_rate: Money,
    /// Free notes about the client.
    pub notes: String,
    /// Whether the client is still treated; inactive clients keep their history.
    pub active: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl TherapyClient {
    /// Builds an empty client with the given creation time.
    pub fn new(now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: String::new(),
            email: String::new(),
            phone: String::new(),
            hourly_rate: Money::ZERO,
            kilometer_rate: Money::ZERO,
            notes: String::new(),
            active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Validates the client before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("name_required".to_string());
        }
        if self.hourly_rate.cents() < 0 || self.kilometer_rate.cents() < 0 {
            return Err("rate_invalid".to_string());
        }
        Ok(())
    }
}

/// One treatment session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TherapySession {
    /// Stable identifier.
    pub id: Uuid,
    /// Client the session belongs to.
    pub client_id: Uuid,
    /// Start of the session in milliseconds since the Unix epoch.
    pub started_at: i64,
    /// Duration in whole minutes.
    pub minutes: i64,
    /// Driven distance in thousandths of a kilometre.
    pub kilometers_milli: i64,
    /// What was done.
    pub notes: String,
    /// Invoice that billed the session, empty while it is open.
    pub invoice_id: Option<Uuid>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl TherapySession {
    /// Builds an empty session of a client with the given creation time.
    pub fn new(client_id: Uuid, now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            client_id,
            started_at: now,
            minutes: 0,
            kilometers_milli: 0,
            notes: String::new(),
            invoice_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Driven distance as decimal kilometres.
    pub fn kilometers(&self) -> f64 {
        self.kilometers_milli as f64 / 1000.0
    }

    /// Whether the session is already on an invoice.
    pub fn is_billed(&self) -> bool {
        self.invoice_id.is_some()
    }

    /// Validates the session before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.minutes <= 0 {
            return Err("minutes_invalid".to_string());
        }
        if self.kilometers_milli < 0 {
            return Err("kilometers_invalid".to_string());
        }
        Ok(())
    }
}

/// One separately recorded practice trip from the legacy TherapyMileage screen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TherapyTrip {
    /// Stable identifier.
    pub id: Uuid,
    /// Optional client; general practice trips are allowed.
    pub client_id: Option<Uuid>,
    /// Calendar date in YYYY-MM-DD format.
    pub date: String,
    /// Starting location.
    pub departure: String,
    /// Destination.
    pub destination: String,
    /// Reason for the trip.
    pub purpose: String,
    /// Odometer at departure in thousandths of a kilometre.
    pub start_km_milli: i64,
    /// Odometer at arrival in thousandths of a kilometre.
    pub end_km_milli: i64,
    /// Individually selected reimbursement rate in cents per kilometre.
    pub rate_cents_per_km: i64,
}

impl TherapyTrip {
    /// Distance driven, clamped at zero like the legacy TypeScript screen.
    pub fn distance_km_milli(&self) -> i64 {
        (self.end_km_milli - self.start_km_milli).max(0)
    }

    /// Reimbursement shown in the mileage screen; legacy UI defaults a missing/zero rate to 0.30.
    pub fn reimbursement(&self) -> Money {
        self.reimbursement_at_rate(30)
    }

    /// Reimbursement using an explicit fallback rate, rounded to the nearest cent.
    pub fn reimbursement_at_rate(&self, fallback_cents_per_km: i64) -> Money {
        let rate = if self.rate_cents_per_km == 0 {
            fallback_cents_per_km.max(0)
        } else {
            self.rate_cents_per_km.max(0)
        };
        let cents = (i128::from(self.distance_km_milli()) * i128::from(rate) + 500) / 1000;
        Money::from_cents(cents.min(i128::from(i64::MAX)) as i64)
    }

    /// Validates the values before persistence.
    pub fn validate(&self) -> Result<(), String> {
        let valid_shape = self.date.len() == 10
            && self.date.as_bytes().get(4) == Some(&b'-')
            && self.date.as_bytes().get(7) == Some(&b'-')
            && self
                .date
                .chars()
                .enumerate()
                .all(|(index, value)| matches!(index, 4 | 7) || value.is_ascii_digit());
        let valid_calendar_date = if valid_shape {
            let year = self.date[..4].parse::<i32>().ok();
            let month = self.date[5..7].parse::<u32>().ok();
            let day = self.date[8..10].parse::<u32>().ok();
            match (year, month, day) {
                (Some(year), Some(month @ 1..=12), Some(day)) => {
                    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
                    let days = match month {
                        2 if leap => 29,
                        2 => 28,
                        4 | 6 | 9 | 11 => 30,
                        _ => 31,
                    };
                    (1..=days).contains(&day)
                }
                _ => false,
            }
        } else {
            false
        };
        if !valid_calendar_date {
            return Err("trip_date_invalid".to_string());
        }
        if self.departure.trim().is_empty() || self.destination.trim().is_empty() {
            return Err("trip_route_required".to_string());
        }
        if self.start_km_milli < 0 || self.end_km_milli < 0 || self.rate_cents_per_km < 0 {
            return Err("trip_values_invalid".to_string());
        }
        Ok(())
    }
}

/// Amount of one session: treatment time at the hourly rate plus the driven kilometres.
pub fn session_amount(session: &TherapySession, client: &TherapyClient) -> Money {
    let minutes = session.minutes.max(0);
    let time_cents = (client.hourly_rate.cents() * minutes + 30) / 60;
    let travel_cents =
        (client.kilometer_rate.cents() * session.kilometers_milli.max(0) + 500) / 1000;
    Money::from_cents(time_cents + travel_cents)
}

/// Totals of one client over all of its sessions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct TherapySummary {
    /// Number of sessions.
    pub sessions: i64,
    /// Sum of the durations in minutes.
    pub minutes: i64,
    /// Sum of the driven distance in thousandths of a kilometre.
    pub kilometers_milli: i64,
    /// Amount of all sessions.
    pub billable: Money,
    /// Amount of the sessions that are already on an invoice.
    pub billed: Money,
    /// Amount of the sessions that are still open.
    pub open: Money,
}

/// Adds up the sessions of one client with its rates.
pub fn summarize(sessions: &[TherapySession], client: &TherapyClient) -> TherapySummary {
    let mut summary = TherapySummary::default();
    for session in sessions {
        let amount = session_amount(session, client);
        summary.sessions += 1;
        summary.minutes += session.minutes.max(0);
        summary.kilometers_milli += session.kilometers_milli.max(0);
        summary.billable = summary.billable + amount;
        if session.is_billed() {
            summary.billed = summary.billed + amount;
        } else {
            summary.open = summary.open + amount;
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    fn client() -> TherapyClient {
        let mut client = TherapyClient::new(0);
        client.name = "Muster".to_string();
        client.hourly_rate = Money::from_cents(9_000);
        client.kilometer_rate = Money::from_cents(60);
        client
    }

    fn session(minutes: i64, kilometers_milli: i64, billed: bool) -> TherapySession {
        let mut session = TherapySession::new(Uuid::new_v4(), 0);
        session.minutes = minutes;
        session.kilometers_milli = kilometers_milli;
        if billed {
            session.invoice_id = Some(Uuid::new_v4());
        }
        session
    }

    #[test]
    fn bills_time_and_travel_with_rounding() {
        assert_eq!(
            session_amount(&session(60, 0, false), &client()),
            Money::from_cents(9_000)
        );
        assert_eq!(
            session_amount(&session(45, 0, false), &client()),
            Money::from_cents(6_750)
        );
        assert_eq!(
            session_amount(&session(30, 15_000, false), &client()),
            Money::from_cents(5_400)
        );
        assert_eq!(
            session_amount(&session(20, 0, false), &client()),
            Money::from_cents(3_000)
        );
    }

    #[test]
    fn splits_billed_and_open_amounts() {
        let client = client();
        let sessions = [session(60, 0, true), session(30, 10_000, false)];
        let summary = summarize(&sessions, &client);

        assert_eq!(summary.sessions, 2);
        assert_eq!(summary.minutes, 90);
        assert_eq!(summary.kilometers_milli, 10_000);
        assert_eq!(summary.billable, Money::from_cents(14_100));
        assert_eq!(summary.billed, Money::from_cents(9_000));
        assert_eq!(summary.open, Money::from_cents(5_100));
    }

    #[test]
    fn rejects_invalid_clients_and_sessions() {
        let mut unnamed = client();
        unnamed.name = "  ".to_string();
        assert_eq!(unnamed.validate(), Err("name_required".to_string()));

        let mut negative = client();
        negative.hourly_rate = Money::from_cents(-1);
        assert_eq!(negative.validate(), Err("rate_invalid".to_string()));

        let mut session = session(0, 0, false);
        assert_eq!(session.validate(), Err("minutes_invalid".to_string()));
        session.minutes = 20;
        session.kilometers_milli = -1;
        assert_eq!(session.validate(), Err("kilometers_invalid".to_string()));
    }

    #[test]
    fn kilometers_are_decimal() {
        let session = session(30, 12_500, false);
        assert_eq!(session.kilometers(), 12.5);
        assert!(!session.is_billed());
    }
}
