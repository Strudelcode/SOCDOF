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

/// Parses an ISO-8601 UTC timestamp into milliseconds since the Unix epoch.
///
/// Accepts what the exporters write: `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM:SS`,
/// `YYYY-MM-DDTHH:MM:SSZ` and `YYYY-MM-DDTHH:MM:SS.mmmZ`. Anything else is `None`, including
/// impossible civil dates such as `2026-02-31`.
pub fn parse_iso8601(text: &str) -> Option<i64> {
    let text = text.trim();
    let (date, time) = match text.split_once('T').or_else(|| text.split_once('t')) {
        Some((date, time)) => (date, Some(time)),
        None => (text, None),
    };

    let mut parts = date.split('-');
    let year: i64 = parts.next()?.parse().ok()?;
    let month: u32 = parts.next()?.parse().ok()?;
    let day: u32 = parts.next()?.parse().ok()?;
    if parts.next().is_some() || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }

    let day_start = days_from_civil(year, month, day) * 86_400_000;
    if civil_from_millis(day_start) != (year, month, day) {
        return None;
    }
    let mut millis = day_start;

    if let Some(time) = time {
        let time = time.trim_end_matches(['Z', 'z']);
        let mut clock = time.split(':');
        let hours: i64 = clock.next()?.parse().ok()?;
        let minutes: i64 = clock.next()?.parse().ok()?;
        let seconds_part = clock.next()?;
        if clock.next().is_some() {
            return None;
        }

        let (seconds_text, fraction) = match seconds_part.split_once('.') {
            Some((seconds, fraction)) => (seconds, fraction),
            None => (seconds_part, ""),
        };
        let seconds: i64 = seconds_text.parse().ok()?;
        if hours > 23 || minutes > 59 || seconds > 59 {
            return None;
        }
        let fraction_ms = if fraction.is_empty() {
            0
        } else {
            if fraction.len() > 3 || !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
                return None;
            }
            let digits: i64 = fraction.parse().ok()?;
            digits * 10_i64.pow(3 - fraction.len() as u32)
        };

        millis += hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + fraction_ms;
    }

    Some(millis)
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

/// Formats a timestamp as an RFC 2822 date in UTC (`Mon, 11 Nov 2026 12:34:56 +0000`).
pub fn rfc2822(ms: i64) -> String {
    const DAY_MS: i64 = 86_400_000;
    let days = ms.div_euclid(DAY_MS);
    let time = ms.rem_euclid(DAY_MS);
    let (year, month, day) = civil_from_millis(days * DAY_MS);
    let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let weekday = weekdays[(days + 4).rem_euclid(7) as usize];
    let month_name = months[(month - 1) as usize];
    let seconds = time / 1000;
    format!(
        "{weekday}, {day:02} {month_name} {year:04} {:02}:{:02}:{:02} +0000",
        seconds / 3600,
        (seconds / 60) % 60,
        seconds % 60
    )
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
    fn parses_iso_timestamps() {
        assert_eq!(parse_iso8601("1970-01-01T00:00:00.000Z"), Some(0));
        assert_eq!(
            parse_iso8601("2026-11-07T12:00:00Z"),
            Some(1_794_052_800_000)
        );
        assert_eq!(
            parse_iso8601("2026-11-07T12:00:00.123Z"),
            Some(1_794_052_800_123)
        );
        assert_eq!(parse_iso8601("2026-11-07"), Some(1_794_009_600_000));

        let roundtrip = 1_794_052_800_123;
        assert_eq!(parse_iso8601(&format_iso8601(roundtrip)), Some(roundtrip));
    }

    #[test]
    fn rejects_impossible_iso_timestamps() {
        assert_eq!(parse_iso8601(""), None);
        assert_eq!(parse_iso8601("yesterday"), None);
        assert_eq!(parse_iso8601("2026-13-07"), None);
        assert_eq!(parse_iso8601("2026-02-31"), None);
        assert_eq!(parse_iso8601("2026-11-07T25:00:00Z"), None);
        assert_eq!(parse_iso8601("2026-11-07T12:00:00.1234Z"), None);
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

/// Time zones the company settings offer, matching the reference selector.
pub const TIMEZONES: [&str; 7] = [
    "Europe/Berlin",
    "Europe/Vienna",
    "Europe/Zurich",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "UTC",
];

/// Date formats the company settings offer, matching the reference selector.
pub const DATE_FORMATS: [&str; 3] = ["DD.MM.YYYY", "YYYY-MM-DD", "MM/DD/YYYY"];

/// Standard offset of a supported zone in seconds (`Europe/Berlin` → `3600`).
///
/// Unknown zones fall back to UTC, so a hand-edited settings file cannot shift the clock into an
/// arbitrary offset.
fn standard_offset_seconds(zone: &str) -> i64 {
    match zone {
        "Europe/Berlin" | "Europe/Vienna" | "Europe/Zurich" => 3_600,
        "Europe/London" => 0,
        "America/New_York" => -5 * 3_600,
        "America/Los_Angeles" => -8 * 3_600,
        _ => 0,
    }
}

/// Day of month of the `nth` (1-based) Sunday-like weekday, with `0 = Sunday`.
fn nth_weekday_day(year: i64, month: u32, weekday: i64, nth: i64) -> i64 {
    let first_weekday = (days_from_civil(year, month, 1) + 4).rem_euclid(7);
    let offset = (weekday - first_weekday).rem_euclid(7);
    1 + offset + (nth - 1) * 7
}

/// Day of month of the last Sunday of `month`.
fn last_weekday_day(year: i64, month: u32) -> i64 {
    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };
    let last_day = days_from_civil(next_year, next_month, 1) - days_from_civil(year, month, 1);
    let weekday_last = (days_from_civil(year, month, last_day as u32) + 4).rem_euclid(7);
    last_day - weekday_last
}

/// Daylight-saving offset of `zone` at `millis` in seconds.
///
/// The reference settings offer seven zones; their rules are fixed enough to encode here: the
/// European zones switch on the last Sunday of March and October at 01:00 UTC, the US zones on the
/// second Sunday of March and the first Sunday of November at 02:00 local time. This keeps the
/// core free of a time zone database dependency while matching the reference clock.
pub fn timezone_offset_seconds(zone: &str, millis: i64) -> i64 {
    let base = standard_offset_seconds(zone);
    let (year, _, _) = civil_from_millis(millis);
    let daylight = match zone {
        "Europe/Berlin" | "Europe/Vienna" | "Europe/Zurich" | "Europe/London" => {
            let start =
                days_from_civil(year, 3, last_weekday_day(year, 3) as u32) * 86_400_000 + 3_600_000;
            let end = days_from_civil(year, 10, last_weekday_day(year, 10) as u32) * 86_400_000
                + 3_600_000;
            millis >= start && millis < end
        }
        "America/New_York" => {
            let start = days_from_civil(year, 3, nth_weekday_day(year, 3, 0, 2) as u32)
                * 86_400_000
                + 7 * 3_600_000;
            let end = days_from_civil(year, 11, nth_weekday_day(year, 11, 0, 1) as u32)
                * 86_400_000
                + 6 * 3_600_000;
            millis >= start && millis < end
        }
        "America/Los_Angeles" => {
            let start = days_from_civil(year, 3, nth_weekday_day(year, 3, 0, 2) as u32)
                * 86_400_000
                + 10 * 3_600_000;
            let end = days_from_civil(year, 11, nth_weekday_day(year, 11, 0, 1) as u32)
                * 86_400_000
                + 9 * 3_600_000;
            millis >= start && millis < end
        }
        _ => false,
    };
    if daylight {
        base + 3_600
    } else {
        base
    }
}

/// Wall clock timestamp of `millis` in `zone`.
pub fn local_millis(millis: i64, zone: &str) -> i64 {
    millis + timezone_offset_seconds(zone, millis) * 1_000
}

/// Converts midnight at the start of a local calendar day to a UTC timestamp.
///
/// `day` is the number of days since 1970-01-01 in the selected time zone.
pub fn local_day_start_utc_ms(day: i64, zone: &str) -> Option<i64> {
    let local_midnight = day.checked_mul(86_400_000)?;
    let offset = timezone_offset_seconds(zone, local_midnight).checked_mul(1_000)?;
    local_midnight.checked_sub(offset)
}

/// Formats `millis` as a twelve hour clock in `zone` (`03:43 PM`, with seconds when asked).
pub fn format_time(millis: i64, seconds: bool, zone: &str) -> String {
    let local = local_millis(millis, zone);
    let total_seconds = local.div_euclid(1_000);
    let hour = total_seconds.div_euclid(3_600).rem_euclid(24);
    let minute = total_seconds.div_euclid(60).rem_euclid(60);
    let second = total_seconds.rem_euclid(60);
    let meridiem = if hour < 12 { "AM" } else { "PM" };
    let hour = match hour % 12 {
        0 => 12,
        other => other,
    };
    if seconds {
        format!("{hour:02}:{minute:02}:{second:02} {meridiem}")
    } else {
        format!("{hour:02}:{minute:02} {meridiem}")
    }
}

/// Formats `millis` as a twenty-four hour clock in `zone` (`12:36:11`), as the tray prints it.
pub fn format_time_24h(millis: i64, seconds: bool, zone: &str) -> String {
    let local = local_millis(millis, zone);
    let total_seconds = local.div_euclid(1_000);
    let hour = total_seconds.div_euclid(3_600).rem_euclid(24);
    let minute = total_seconds.div_euclid(60).rem_euclid(60);
    let second = total_seconds.rem_euclid(60);
    if seconds {
        format!("{hour:02}:{minute:02}:{second:02}")
    } else {
        format!("{hour:02}:{minute:02}")
    }
}

/// Formats `millis` as a date in `style` and `zone`, falling back to `DD.MM.YYYY`.
pub fn format_date_style(millis: i64, style: &str, zone: &str) -> String {
    let local = local_millis(millis, zone);
    let days = local.div_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    match style {
        "YYYY-MM-DD" => format!("{year:04}-{month:02}-{day:02}"),
        "MM/DD/YYYY" => format!("{month:02}/{day:02}/{year:04}"),
        _ => format!("{day:02}.{month:02}.{year:04}"),
    }
}

#[cfg(test)]
mod timezone_tests {
    use super::*;

    fn utc(year: i64, month: u32, day: u32, hour: i64) -> i64 {
        days_from_civil(year, month, day) * 86_400_000 + hour * 3_600_000
    }

    #[test]
    fn european_zones_follow_the_last_sunday_rule() {
        // 2026-03-29 is the last Sunday of March, 2026-10-25 the last Sunday of October.
        assert_eq!(
            timezone_offset_seconds("Europe/Berlin", utc(2026, 3, 29, 0)),
            3_600
        );
        assert_eq!(
            timezone_offset_seconds("Europe/Berlin", utc(2026, 3, 29, 1)),
            7_200
        );
        assert_eq!(
            timezone_offset_seconds("Europe/Berlin", utc(2026, 10, 25, 1)),
            3_600
        );
        assert_eq!(
            timezone_offset_seconds("Europe/London", utc(2026, 7, 1, 12)),
            3_600
        );
        assert_eq!(
            timezone_offset_seconds("Europe/Vienna", utc(2026, 1, 15, 12)),
            3_600
        );
        assert_eq!(timezone_offset_seconds("UTC", utc(2026, 7, 1, 12)), 0);
    }

    #[test]
    fn us_zones_follow_their_own_switch_dates() {
        // 2026-03-08 is the second Sunday of March, 2026-11-01 the first Sunday of November.
        assert_eq!(
            timezone_offset_seconds("America/New_York", utc(2026, 3, 8, 6)),
            -18_000
        );
        assert_eq!(
            timezone_offset_seconds("America/New_York", utc(2026, 3, 8, 7)),
            -14_400
        );
        assert_eq!(
            timezone_offset_seconds("America/New_York", utc(2026, 11, 1, 6)),
            -18_000
        );
        assert_eq!(
            timezone_offset_seconds("America/Los_Angeles", utc(2026, 7, 1, 12)),
            -25_200
        );
    }

    #[test]
    fn formats_clock_and_date_in_the_selected_zone() {
        let millis = utc(2026, 8, 25, 13);
        assert_eq!(format_time(millis, false, "UTC"), "01:00 PM");
        assert_eq!(format_time(millis, true, "UTC"), "01:00:00 PM");
        assert_eq!(format_time(millis, false, "Europe/Berlin"), "03:00 PM");
        assert_eq!(format_date_style(millis, "DD.MM.YYYY", "UTC"), "25.08.2026");
        assert_eq!(format_date_style(millis, "YYYY-MM-DD", "UTC"), "2026-08-25");
        assert_eq!(format_date_style(millis, "MM/DD/YYYY", "UTC"), "08/25/2026");
    }

    #[test]
    fn converts_local_midnights_across_daylight_saving_changes() {
        let march_29 = days_from_civil(2026, 3, 29);
        assert_eq!(
            local_day_start_utc_ms(march_29, "Europe/Berlin"),
            Some(utc(2026, 3, 28, 23))
        );
        assert_eq!(
            local_day_start_utc_ms(march_29 + 1, "Europe/Berlin"),
            Some(utc(2026, 3, 29, 22))
        );

        let march_8 = days_from_civil(2026, 3, 8);
        assert_eq!(
            local_day_start_utc_ms(march_8, "America/New_York"),
            Some(utc(2026, 3, 8, 5))
        );
        assert_eq!(
            local_day_start_utc_ms(march_8 + 1, "America/New_York"),
            Some(utc(2026, 3, 9, 4))
        );
        assert_eq!(local_day_start_utc_ms(i64::MAX, "UTC"), None);
    }
}
