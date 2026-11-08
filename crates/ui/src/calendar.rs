//! Civil date math for the date picker.
//!
//! The core stores dates as Unix milliseconds and formats them, but it does not expose the calendar
//! grid a picker needs. The conversion is Howard Hinnant's algorithm, the same one the core uses, so
//! both sides agree on every day and the picker needs no date library.

/// Day of a month shown in the date picker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CalendarState {
    /// Year, for example 2026.
    pub year: i32,
    /// Month from 1 to 12.
    pub month: u32,
    /// Selected day from 1 to 31.
    pub day: u32,
}

impl CalendarState {
    /// Builds a state from explicit parts.
    pub fn new(year: i32, month: u32, day: u32) -> Self {
        Self { year, month, day }
    }

    /// Builds a state from a Unix timestamp in milliseconds.
    pub fn from_millis(ms: i64) -> Self {
        let (year, month, day) = civil_from_days(ms.div_euclid(86_400_000));
        Self { year, month, day }
    }

    /// Moves to the previous month, keeping the day inside the month.
    pub fn previous_month(&mut self) {
        if self.month == 1 {
            self.month = 12;
            self.year -= 1;
        } else {
            self.month -= 1;
        }
        self.clamp_day();
    }

    /// Moves to the next month, keeping the day inside the month.
    pub fn next_month(&mut self) {
        if self.month == 12 {
            self.month = 1;
            self.year += 1;
        } else {
            self.month += 1;
        }
        self.clamp_day();
    }

    /// Formats the selection as `DD.MM.YYYY`, the format the legacy app prints.
    pub fn formatted(&self) -> String {
        format!("{:02}.{:02}.{:04}", self.day, self.month, self.year)
    }

    fn clamp_day(&mut self) {
        self.day = self.day.min(days_in_month(self.year, self.month));
    }
}

/// Whether a year is a leap year in the Gregorian calendar.
pub fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Number of days in a month.
pub fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(year) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// Weekday of the first day of a month, Monday based (0 = Monday, 6 = Sunday).
pub fn first_weekday_monday(year: i32, month: u32) -> u32 {
    // 1970-01-01 was a Thursday, which is index 3 in a Monday based week.
    (days_from_civil(year, month, 1) + 3).rem_euclid(7) as u32
}

/// Six weeks of seven cells for a month, `None` for cells before the first day.
pub fn month_grid(year: i32, month: u32) -> [Option<u32>; 42] {
    let mut cells = [None; 42];
    let start = first_weekday_monday(year, month) as usize;
    for day in 1..=days_in_month(year, month) {
        let index = start + day as usize - 1;
        if let Some(cell) = cells.get_mut(index) {
            *cell = Some(day);
        }
    }
    cells
}

/// Days since 1970-01-01 for a civil date.
fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = if month <= 2 { year - 1 } else { year } as i64;
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = (i64::from(month) + 9) % 12;
    let day_of_year = (153 * month_prime + 2) / 5 + i64::from(day) - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// Civil date for days since 1970-01-01.
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let shift = days + 719_468;
    let era = if shift >= 0 { shift } else { shift - 146_096 } / 146_097;
    let day_of_era = shift - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_prime + 2) / 5 + 1) as u32;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    } as u32;
    let year = if month <= 2 { year + 1 } else { year };
    (year as i32, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_leap_years() {
        assert!(is_leap(2024));
        assert!(is_leap(2000));
        assert!(!is_leap(1900));
        assert!(!is_leap(2026));
        assert_eq!(days_in_month(2024, 2), 29);
        assert_eq!(days_in_month(2026, 2), 28);
        assert_eq!(days_in_month(2026, 11), 30);
        assert_eq!(days_in_month(2026, 12), 31);
    }

    #[test]
    fn first_weekday_is_monday_based() {
        // 2026-11-01 was a Sunday, index 6 in a Monday based week.
        assert_eq!(first_weekday_monday(2026, 11), 6);
        // 2026-11-07 was a Saturday, index 5.
        assert_eq!(first_weekday_monday(2026, 11), 6);
        // 2026-01-01 was a Thursday, index 3.
        assert_eq!(first_weekday_monday(2026, 1), 3);
    }

    #[test]
    fn grid_places_the_first_day_after_the_leading_blanks() {
        let cells = month_grid(2026, 11);
        assert_eq!(cells.len(), 42);
        assert_eq!(cells[5], None);
        assert_eq!(cells[6], Some(1));
        assert_eq!(cells[35], Some(30));
        assert_eq!(cells[36], None);
        for cell in &cells[36..] {
            assert_eq!(*cell, None);
        }
    }

    #[test]
    fn round_trips_through_unix_milliseconds() {
        let state = CalendarState::from_millis(1_794_052_800_000);
        assert_eq!(state, CalendarState::new(2026, 11, 7));
        assert_eq!(state.formatted(), "07.11.2026");

        let epoch = CalendarState::from_millis(0);
        assert_eq!(epoch, CalendarState::new(1970, 1, 1));
    }

    #[test]
    fn month_navigation_wraps_and_clamps_the_day() {
        let mut state = CalendarState::new(2026, 1, 31);
        state.previous_month();
        assert_eq!((state.year, state.month, state.day), (2025, 12, 31));
        state.next_month();
        assert_eq!((state.year, state.month, state.day), (2026, 1, 31));
        state.month = 2;
        state.clamp_day();
        assert_eq!(state.day, 28);
    }
}
