//! Payment capture of invoices, ported from `PaymentModal.tsx`.
//!
//! The TypeScript modal writes `status: 'paid'`, `paid_at`, `payment_method`,
//! `payment_reference` and `tse_signature` onto the invoice. The port records the same values in
//! `invoice_payments`, one row per invoice, and moves the invoice to `paid` in the same transaction.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::money::Money;

/// How an invoice was paid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMethod {
    /// Bank transfer (SEPA).
    Transfer,
    /// Cash at the register.
    Cash,
    /// Card terminal.
    Card,
}

impl PaymentMethod {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            PaymentMethod::Transfer => "transfer",
            PaymentMethod::Cash => "cash",
            PaymentMethod::Card => "card",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "transfer" => Some(PaymentMethod::Transfer),
            "cash" => Some(PaymentMethod::Cash),
            "card" => Some(PaymentMethod::Card),
            _ => None,
        }
    }
}

/// Recorded payment of one invoice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoicePayment {
    /// Invoice the payment belongs to.
    pub invoice_id: Uuid,
    /// When the money arrived.
    pub paid_at: i64,
    /// Chosen method.
    pub method: PaymentMethod,
    /// Reference written to the books.
    pub reference: String,
    /// Cash-register signature (`CASH-TSE-…`), only for cash.
    pub tse_signature: Option<String>,
}

impl InvoicePayment {
    /// Payment without a register signature.
    pub fn new(invoice_id: Uuid, method: PaymentMethod, paid_at: i64, reference: String) -> Self {
        InvoicePayment {
            invoice_id,
            paid_at,
            method,
            reference,
            tse_signature: None,
        }
    }
}

/// Masks a card number the way the TypeScript modal does.
pub fn mask_card_number(card: &str) -> String {
    if card.is_empty() {
        return String::new();
    }
    let lower = card.to_lowercase();
    if lower.contains("apple")
        || lower.contains("google")
        || lower.contains("nfc")
        || lower.contains("tokenized")
    {
        return card.to_string();
    }
    let digits: String = card.chars().filter(char::is_ascii_digit).collect();
    if digits.is_empty() {
        return card.to_string();
    }
    let prefix: String = digits.chars().take(4).collect();
    let remaining = digits.len().saturating_sub(4);
    let asterisks = "*".repeat(remaining.max(12));
    let full = format!("{prefix}{asterisks}");
    full.as_bytes()
        .chunks(4)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or_default())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Reference of a bank transfer.
pub fn transfer_reference(reference: &str, bank_name: &str) -> String {
    let reference = reference.trim();
    if reference.is_empty() {
        format!(
            "Banküberweisung ({})",
            if bank_name.trim().is_empty() {
                "Konto"
            } else {
                bank_name.trim()
            }
        )
    } else {
        format!("Banküberweisung ({reference})")
    }
}

/// Reference of a cash payment.
pub const CASH_REFERENCE: &str = "Barzahlung Kasse";

/// Reference of a card payment, including the masked card and the authorisation code.
pub fn card_reference(terminal: &str, card_type: &str, masked: &str, auth: &str) -> String {
    format!(
        "{} ({} {} / {})",
        if terminal.trim().is_empty() {
            "Kartenterminal"
        } else {
            terminal.trim()
        },
        card_type.to_uppercase(),
        masked,
        auth
    )
}

/// GoBD signature of a cash payment.
pub fn tse_signature(stamp: i64) -> String {
    format!("CASH-TSE-{}", base36(stamp.max(0) as u64).to_uppercase())
}

/// Base-36 representation with the digits and lower-case letters, like `Number.toString(36)`.
pub fn base36(mut value: u64) -> String {
    if value == 0 {
        return "0".to_string();
    }
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = Vec::new();
    while value > 0 {
        out.push(DIGITS[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

/// Change handed back at the register.
pub fn change_due(total: Money, given: Money) -> Money {
    Money::from_cents((given.cents() - total.cents()).max(0))
}

/// Quick cash amounts: the rounded total and the usual notes that are at least the amount due.
pub fn cash_quick_amounts(total: Money) -> Vec<Money> {
    let due = total.cents();
    let rounded = ((due + 99) / 100) * 100;
    let mut amounts = Vec::new();
    for candidate in [rounded, 5_000, 10_000, 20_000, 50_000] {
        if candidate >= due && !amounts.contains(&candidate) {
            amounts.push(candidate);
        }
    }
    amounts.truncate(4);
    amounts.into_iter().map(Money::from_cents).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_card_numbers_like_the_modal() {
        assert_eq!(
            mask_card_number("4532 **** **** ****"),
            "4532 **** **** ****"
        );
        assert_eq!(mask_card_number("4532000000001234"), "4532 **** **** ****");
        assert_eq!(
            mask_card_number("Apple Pay (NFC Tokenized)"),
            "Apple Pay (NFC Tokenized)"
        );
        assert_eq!(mask_card_number(""), "");
        assert_eq!(mask_card_number("abcd"), "abcd");
    }

    #[test]
    fn builds_the_references_of_all_three_methods() {
        assert_eq!(
            transfer_reference("", "Sparkasse"),
            "Banküberweisung (Sparkasse)"
        );
        assert_eq!(transfer_reference("", ""), "Banküberweisung (Konto)");
        assert_eq!(
            transfer_reference("Kontoauszug 42", ""),
            "Banküberweisung (Kontoauszug 42)"
        );
        assert_eq!(CASH_REFERENCE, "Barzahlung Kasse");
        assert_eq!(
            card_reference("ZVT", "visa", "4532 ************", "AUTH-1"),
            "ZVT (VISA 4532 ************ / AUTH-1)"
        );
        assert_eq!(
            card_reference("", "girocard", "6759 ********", "T-9"),
            "Kartenterminal (GIROCARD 6759 ******** / T-9)"
        );
    }

    #[test]
    fn signs_cash_payments_in_base36() {
        assert_eq!(base36(0), "0");
        assert_eq!(base36(35), "z");
        assert_eq!(base36(36), "10");
        assert_eq!(tse_signature(1_760_000_000_000), "CASH-TSE-MGJ6K3CW");
    }

    #[test]
    fn rounds_the_quick_cash_amounts() {
        let total = Money::from_cents(25_138);
        let amounts: Vec<i64> = cash_quick_amounts(total)
            .into_iter()
            .map(Money::cents)
            .collect();
        assert_eq!(amounts, vec![25_200, 50_000]);

        let total = Money::from_cents(60_050);
        let amounts: Vec<i64> = cash_quick_amounts(total)
            .into_iter()
            .map(Money::cents)
            .collect();
        assert_eq!(amounts, vec![60_100]);

        assert_eq!(
            change_due(Money::from_cents(2_000), Money::from_cents(5_000)),
            Money::from_cents(3_000)
        );
        assert_eq!(
            change_due(Money::from_cents(5_000), Money::from_cents(4_000)),
            Money::ZERO
        );
    }

    #[test]
    fn roundtrips_the_payment_method() {
        for method in [
            PaymentMethod::Transfer,
            PaymentMethod::Cash,
            PaymentMethod::Card,
        ] {
            assert_eq!(PaymentMethod::from_storage(method.as_str()), Some(method));
        }
        assert_eq!(PaymentMethod::from_storage("cheque"), None);
    }
}
