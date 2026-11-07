//! Civil date helpers.
//!
//! Dates are stored as milliseconds since the Unix epoch. Printing needs `DD.MM.YYYY`, which is
//! implemented here so the core stays free of a date library.

/// Formats a Unix timestamp in milliseconds as `DD.MM.YYYY`.
pub fn format_date(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    format!("{day:02}.{month:02}.{year:04}")
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
}
