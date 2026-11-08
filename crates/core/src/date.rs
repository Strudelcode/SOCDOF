//! Civil date helpers.
//!
//! Dates are stored as milliseconds since the Unix epoch. Printing needs `DD.MM.YYYY`, which is
//! implemented here so the core stays free of a date library.

/// Civil date of a Unix timestamp in milliseconds.
pub fn civil_from_millis(ms: i64) -> (i64, u32, u32) {
    civil_from_days(ms.div_euclid(86_400_000))
}

/// Days since 1970-01-01 of a civil date; the inverse of [`civil_from_millis`].
pub fn days_from_civil(year: i64, month: u32, day: u32) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = if month > 2 {
        month as i64 - 3
    } else {
        month as i64 + 9
    };
    let day_of_year = (153 * month_prime + 2) / 5 + day as i64 - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// Milliseconds of the first day of a month at 00:00 UTC.
pub fn start_of_month_ms(year: i64, month: u32) -> i64 {
    days_from_civil(year, month, 1) * 86_400_000
}

/// Formats a Unix timestamp in milliseconds as `DD.MM.YYYY`.
pub fn format_date(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    format!("{day:02}.{month:02}.{year:04}")
}

/// Formats a Unix timestamp in milliseconds as an ISO-8601 UTC timestamp.
pub fn format_iso8601(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    let millis_of_day = ms.rem_euclid(86_400_000);
    let hours = millis_of_day / 3_600_000;
    let minutes = (millis_of_day % 3_600_000) / 60_000;
    let seconds = (millis_of_day % 60_000) / 1_000;
    let millis = millis_of_day % 1_000;
    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}.{millis:03}Z")
}

/// Converts days since 1970-01-01 into a civil date (Howard Hinnant's algorithm).
fn civil_from_days(days_since_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097; // [0, 146096]
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
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_the_epoch() {
        assert_eq!(format_date(0), "01.01.1970");
        assert_eq!(format_date(86_400_000), "02.01.1970");
    }

    #[test]
    fn formats_known_dates() {
        // 2026-11-07 12:00:00 UTC
        assert_eq!(format_date(1_794_052_800_000), "07.11.2026");
        // 2024-02-29, leap day
        assert_eq!(format_date(1_709_164_800_000), "29.02.2024");
    }

    #[test]
    fn formats_dates_before_the_epoch() {
        assert_eq!(format_date(-86_400_000), "31.12.1969");
    }

    #[test]
    fn roundtrips_civil_dates_and_month_starts() {
        let ms = 1_794_052_800_000; // 2026-11-07 12:00 UTC
        assert_eq!(civil_from_millis(ms), (2026, 11, 7));
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(days_from_civil(2026, 11, 7), ms.div_euclid(86_400_000));
        assert_eq!(start_of_month_ms(2026, 11), 1_793_491_200_000);
        assert_eq!(format_date(start_of_month_ms(2026, 11)), "01.11.2026");
        assert_eq!(civil_from_millis(start_of_month_ms(2024, 2)), (2024, 2, 1));
    }

    #[test]
    fn formats_iso_timestamps() {
        assert_eq!(format_iso8601(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            format_iso8601(1_794_052_800_123),
            "2026-11-07T12:00:00.123Z"
        );
    }
}
