//! Money handling.
//!
//! All amounts are stored and computed as integer cents. Floats are never used for monetary values,
//! because binary floating point cannot represent decimal amounts exactly.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::iter::Sum;
use std::ops::{Add, Neg, Sub};

/// An amount of money in cents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Money(i64);

impl Money {
    /// Zero.
    pub const ZERO: Money = Money(0);

    /// Builds an amount from integer cents.
    pub const fn from_cents(cents: i64) -> Self {
        Money(cents)
    }

    /// Returns the amount in integer cents.
    pub const fn cents(self) -> i64 {
        self.0
    }

    /// Parses a plain decimal into an integer with the requested number of fractional digits.
    ///
    /// Unlike a floating-point conversion, this never rounds values that cannot be represented at
    /// the requested scale. Both decimal comma and decimal point are accepted; grouping separators
    /// are deliberately rejected so an ambiguous value cannot silently change its meaning.
    pub fn parse_scaled_decimal(input: &str, decimal_places: u32) -> Option<i64> {
        if decimal_places > 9 {
            return None;
        }
        let compact = input.trim();
        if compact.is_empty() {
            return None;
        }

        let (negative, body) = match compact.as_bytes()[0] {
            b'-' => (true, &compact[1..]),
            b'+' => (false, &compact[1..]),
            _ => (false, compact.as_str()),
        };
        if body.is_empty() {
            return None;
        }

        let separator = body.bytes().position(|byte| byte == b'.' || byte == b',');
        let (whole_part, fraction_part) = match separator {
            Some(index) => (&body[..index], &body[index + 1..]),
            None => (body, ""),
        };
        if fraction_part.bytes().any(|byte| byte == b'.' || byte == b',') {
            return None;
        }
        if whole_part.is_empty() && fraction_part.is_empty() {
            return None;
        }
        if !whole_part.bytes().all(|byte| byte.is_ascii_digit())
            || !fraction_part.bytes().all(|byte| byte.is_ascii_digit())
            || fraction_part.len() > decimal_places as usize
        {
            return None;
        }

        let whole = if whole_part.is_empty() { 0 } else { whole_part.parse::<i64>().ok()? };
        let scale = 10_i64.checked_pow(decimal_places)?;
        let mut fraction = if fraction_part.is_empty() { 0 } else { fraction_part.parse::<i64>().ok()? };
        for _ in fraction_part.len()..decimal_places as usize {
            fraction = fraction.checked_mul(10)?;
        }
        let value = whole.checked_mul(scale)?.checked_add(fraction)?;
        if negative { value.checked_neg() } else { Some(value) }
    }

    /// Parses user input such as `1234.56`, `1.234,56` or `-12,50`.
    ///
    /// The last separator wins as decimal separator when at most two digits follow it, otherwise all
    /// separators are treated as grouping marks. Returns `None` for input that is not a number.
    pub fn parse(input: &str) -> Option<Money> {
        let compact: String = input.chars().filter(|c| !c.is_whitespace()).collect();
        if compact.is_empty() {
            return None;
        }

        let negative = compact.starts_with('-');
        let body = compact.trim_start_matches(['-', '+']);

        let decimal_at = body.rfind(['.', ',']).filter(|index| {
            let tail = &body[*index + 1..];
            !tail.is_empty() && tail.len() <= 2 && tail.chars().all(|c| c.is_ascii_digit())
        });

        let (whole_part, fraction_part) = match decimal_at {
            Some(index) => (&body[..index], &body[index + 1..]),
            None => (body, ""),
        };

        if !whole_part
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.' || c == ',')
        {
            return None;
        }
        if !fraction_part.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }

        let whole_digits: String = whole_part.chars().filter(|c| c.is_ascii_digit()).collect();
        if whole_digits.is_empty() && fraction_part.is_empty() {
            return None;
        }

        let whole: i64 = if whole_digits.is_empty() {
            0
        } else {
            whole_digits.parse().ok()?
        };

        let mut fraction = fraction_part.to_string();
        while fraction.len() < 2 {
            fraction.push('0');
        }
        let fraction: i64 = fraction.parse().ok()?;

        let cents = whole.checked_mul(100)?.checked_add(fraction)?;
        Some(Money(if negative { -cents } else { cents }))
    }

    /// Plain decimal representation with a dot, for storage and machine input (`1234.56`).
    pub fn to_decimal_string(self) -> String {
        let sign = if self.0 < 0 { "-" } else { "" };
        let absolute = self.0.unsigned_abs();
        format!("{sign}{}.{:02}", absolute / 100, absolute % 100)
    }

    /// Localized representation with grouping marks, decimal comma and currency symbol
    /// (`1.234,56 €`).
    pub fn format_localized(self, symbol: &str) -> String {
        let sign = if self.0 < 0 { "-" } else { "" };
        let absolute = self.0.unsigned_abs();
        let whole = group_thousands(absolute / 100);
        let amount = format!("{sign}{whole},{:02}", absolute % 100);
        if symbol.is_empty() {
            amount
        } else {
            format!("{amount} {symbol}")
        }
    }

    /// Tax contained in or added to this amount, using basis points (`1900` = 19 %), rounded half up.
    pub fn tax(self, rate_bp: i64) -> Money {
        const DIVISOR: i128 = 10_000;
        let raw = self.0 as i128 * rate_bp as i128;
        let rounded = if raw >= 0 {
            (raw + DIVISOR / 2) / DIVISOR
        } else {
            (raw - DIVISOR / 2) / DIVISOR
        };
        Money(rounded as i64)
    }

    /// Multiplies by an integer quantity (for example a number of pieces).
    pub fn times(self, quantity: i64) -> Money {
        Money(self.0 * quantity)
    }
}

fn group_thousands(value: u64) -> String {
    let digits = value.to_string();
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(digit);
    }
    grouped
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_decimal_string())
    }
}

impl Add for Money {
    type Output = Money;

    fn add(self, other: Money) -> Money {
        Money(self.0 + other.0)
    }
}

impl Sub for Money {
    type Output = Money;

    fn sub(self, other: Money) -> Money {
        Money(self.0 - other.0)
    }
}

impl Neg for Money {
    type Output = Money;

    fn neg(self) -> Money {
        Money(-self.0)
    }
}

impl Sum for Money {
    fn sum<I: Iterator<Item = Money>>(iter: I) -> Money {
        iter.fold(Money::ZERO, |total, amount| total + amount)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_german_and_english_formats() {
        assert_eq!(Money::parse("1.234,56"), Some(Money::from_cents(123_456)));
        assert_eq!(Money::parse("1234.56"), Some(Money::from_cents(123_456)));
        assert_eq!(Money::parse("1234,56"), Some(Money::from_cents(123_456)));
        assert_eq!(Money::parse("12.5"), Some(Money::from_cents(1_250)));
        assert_eq!(Money::parse("-12,50"), Some(Money::from_cents(-1_250)));
        assert_eq!(Money::parse("0"), Some(Money::ZERO));
        assert_eq!(Money::parse(""), None);
        assert_eq!(Money::parse("abc"), None);
    }

    #[test]
    fn parses_scaled_decimals_without_rounding() {
        assert_eq!(Money::parse_scaled_decimal("1,25", 3), Some(1_250));
        assert_eq!(Money::parse_scaled_decimal("0.5", 2), Some(50));
        assert_eq!(Money::parse_scaled_decimal(".125", 3), Some(125));
        assert_eq!(Money::parse_scaled_decimal("-2.5", 2), Some(-250));
        assert_eq!(Money::parse_scaled_decimal("1.0009", 3), None);
        assert_eq!(Money::parse_scaled_decimal("1,234", 2), None);
        assert_eq!(Money::parse_scaled_decimal("1.2,3", 2), None);
        assert_eq!(Money::parse_scaled_decimal("1 000", 2), None);
        assert_eq!(Money::parse_scaled_decimal("999999999999999999999", 2), None);
    }

    #[test]
    fn formats_localized_amounts() {
        assert_eq!(
            Money::from_cents(123_456).format_localized("€"),
            "1.234,56 €"
        );
        assert_eq!(Money::from_cents(-5).format_localized("€"), "-0,05 €");
        assert_eq!(Money::from_cents(0).format_localized(""), "0,00");
        assert_eq!(Money::from_cents(123_456).to_decimal_string(), "1234.56");
    }

    #[test]
    fn computes_tax_with_half_up_rounding() {
        assert_eq!(
            Money::from_cents(10_000).tax(1900),
            Money::from_cents(1_900)
        );
        assert_eq!(Money::from_cents(100).tax(700), Money::from_cents(7));
        assert_eq!(Money::from_cents(105).tax(1900), Money::from_cents(20));
        assert_eq!(Money::from_cents(-105).tax(1900), Money::from_cents(-20));
    }

    #[test]
    fn adds_and_sums() {
        let amounts = [
            Money::from_cents(1_250),
            Money::from_cents(2_500),
            Money::from_cents(25),
        ];
        let total: Money = amounts.into_iter().sum();
        assert_eq!(total, Money::from_cents(3_775));
        assert_eq!(Money::from_cents(10).times(3), Money::from_cents(30));
    }

    #[test]
    fn roundtrips_through_parse_and_display() {
        for cents in [-99_999, -1, 0, 1, 12_345, 999_999] {
            let parsed = Money::parse(&Money::from_cents(cents).to_decimal_string());
            assert_eq!(parsed, Some(Money::from_cents(cents)));
        }
    }
}
