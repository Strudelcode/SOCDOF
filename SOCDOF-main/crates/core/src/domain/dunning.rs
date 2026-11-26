//! Dunning letters, ported from `DunningModal.tsx`.
//!
//! The TypeScript modal picks one of three levels, which preset the fee, the default interest and
//! the new payment deadline; it prints the letter with the German texts below and exports it as
//! `.eml`. The level is not stored on the invoice (the modal only writes a chatter message), so the
//! port keeps the letter pure as well.

use crate::date::format_date;
use crate::domain::settings::CompanyProfile;
use crate::money::Money;

/// Milliseconds of one day.
pub const DAY_MS: i64 = 86_400_000;

/// Dunning level of the modal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DunningLevel {
    /// Payment reminder.
    Reminder,
    /// First formal notice.
    First,
    /// Last notice before court proceedings.
    Last,
}

impl DunningLevel {
    /// All levels in the order of the tabs.
    pub fn all() -> [DunningLevel; 3] {
        [
            DunningLevel::Reminder,
            DunningLevel::First,
            DunningLevel::Last,
        ]
    }

    /// Level number shown in the modal.
    pub fn number(self) -> u8 {
        match self {
            DunningLevel::Reminder => 1,
            DunningLevel::First => 2,
            DunningLevel::Last => 3,
        }
    }

    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            DunningLevel::Reminder => "reminder",
            DunningLevel::First => "first",
            DunningLevel::Last => "last",
        }
    }

    /// Parses the storage representation, the level number or the English name.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "reminder" | "1" => Some(DunningLevel::Reminder),
            "first" | "2" => Some(DunningLevel::First),
            "last" | "3" => Some(DunningLevel::Last),
            _ => None,
        }
    }

    /// Default dunning fee of the level.
    pub fn fee_cents(self) -> i64 {
        match self {
            DunningLevel::Reminder => 0,
            DunningLevel::First => 250,
            DunningLevel::Last => 500,
        }
    }

    /// Default days until the new deadline.
    pub fn deadline_days(self) -> i64 {
        match self {
            DunningLevel::Reminder | DunningLevel::First => 7,
            DunningLevel::Last => 5,
        }
    }

    /// Default interest: 5 % of the invoice total on the last level only.
    pub fn interest_cents(self, total_cents: i64) -> i64 {
        match self {
            DunningLevel::Last => (total_cents * 5 + 50) / 100,
            _ => 0,
        }
    }

    /// Title of the letter.
    pub fn title(self) -> &'static str {
        match self {
            DunningLevel::Reminder => "Zahlungserinnerung",
            DunningLevel::First => "1. Mahnung",
            DunningLevel::Last => "2. und letzte Mahnung",
        }
    }

    /// Opening paragraph with the new deadline.
    pub fn intro(self, deadline: &str) -> String {
        match self {
            DunningLevel::Reminder => format!(
                "sicherlich ist es Ihrer Aufmerksamkeit entgangen, dass die nachfolgend aufgeführte \
                 Rechnung bisher noch nicht bei uns eingegangen ist. Wir bitten Sie höflich, den \
                 offenen Betrag bis zum {deadline} zu überweisen."
            ),
            DunningLevel::First => format!(
                "trotz unserer bisherigen Erinnerung konnten wir für die unten genannte Rechnung noch \
                 keinen Zahlungseingang feststellen. Bitte begleichen Sie den fälligen Gesamtbetrag \
                 inkl. Mahngebühren bis spätestens {deadline}."
            ),
            DunningLevel::Last => format!(
                "trotz mehrfacher Mahnungen ist die genannte Forderung weiterhin offen. Sollte der \
                 Gesamtbetrag bis zum {deadline} nicht auf unserem Konto gutgeschrieben sein, sehen \
                 wir uns gezwungen, das gerichtliche Mahnverfahren einzuleiten."
            ),
        }
    }
}

/// Days an invoice is past its due date.
pub fn overdue_days(due_at: i64, now: i64) -> i64 {
    let diff = (now - due_at) as f64 / DAY_MS as f64;
    diff.ceil().max(0.0) as i64
}

/// Letter of one dunning level with its figures.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DunningLetter {
    /// Chosen level.
    pub level: DunningLevel,
    /// Dunning fee.
    pub fee: Money,
    /// Default interest.
    pub interest: Money,
    /// Days until the new deadline.
    pub days: i64,
    /// New deadline.
    pub deadline: i64,
}

impl DunningLetter {
    /// Letter with the defaults of the level.
    pub fn new(level: DunningLevel, total: Money, now: i64) -> Self {
        DunningLetter {
            level,
            fee: Money::from_cents(level.fee_cents()),
            interest: Money::from_cents(level.interest_cents(total.cents())),
            days: level.deadline_days(),
            deadline: now + level.deadline_days() * DAY_MS,
        }
    }

    /// Total claim: invoice total plus fee plus interest.
    pub fn total(&self, invoice_total: Money) -> Money {
        invoice_total + self.fee + self.interest
    }

    /// Deadline as `dd.mm.yyyy`.
    pub fn deadline_text(&self) -> String {
        format_date(self.deadline)
    }

    /// Subject of the exported mail.
    pub fn subject(&self, invoice_number: &str, company_name: &str) -> String {
        let company = if company_name.trim().is_empty() {
            "Ihr Firmenname"
        } else {
            company_name.trim()
        };
        format!(
            "{} zu Rechnung {} - {}",
            self.level.title(),
            invoice_number,
            company
        )
    }

    /// Name of the `.eml` file.
    pub fn file_name(&self, invoice_number: &str) -> String {
        format!(
            "Mahnung_{}_Stufe{}.eml",
            invoice_number,
            self.level.number()
        )
    }

    /// Letter body of the mail export.
    pub fn body(
        &self,
        invoice_number: &str,
        invoice_total: Money,
        due_at: i64,
        currency: &str,
        company: &CompanyProfile,
    ) -> String {
        let bank = if company.iban.trim().is_empty() {
            "DE00 0000 0000 0000 0000 00".to_string()
        } else {
            company.iban.trim().to_string()
        };
        let company_name = if company.name.trim().is_empty() {
            "Geschäftsleitung".to_string()
        } else {
            company.name.trim().to_string()
        };
        let mut lines = vec![
            "Sehr geehrte Damen und Herren,".to_string(),
            String::new(),
            self.level.intro(&self.deadline_text()),
            String::new(),
            format!("Rechnungsnummer: {invoice_number}"),
            format!("Ursprüngliches Fälligkeitsdatum: {}", format_date(due_at)),
            format!(
                "Offener Rechnungsbetrag: {} {currency}",
                invoice_total.to_decimal_string()
            ),
            format!("Mahngebühr: {} {currency}", self.fee.to_decimal_string()),
            format!(
                "Verzugszinsen: {} {currency}",
                self.interest.to_decimal_string()
            ),
            "------------------------------------------".to_string(),
            format!(
                "Gesamtforderung: {} {currency}",
                self.total(invoice_total).to_decimal_string()
            ),
            format!("Zahlbar bis: {}", self.deadline_text()),
            String::new(),
            "Bankverbindung:".to_string(),
            format!("IBAN: {bank}"),
            format!("BIC: {}", company.bic.trim()),
            format!("Bank: {}", company.bank_name.trim()),
            String::new(),
            "Mit freundlichen Grüßen,".to_string(),
            company_name,
        ];
        while lines.last().is_some_and(|line| line.is_empty()) {
            lines.pop();
        }
        lines.join("\n")
    }

    /// RFC 822 draft of the letter, ready for `X-Unsent` clients.
    pub fn eml(
        &self,
        recipient: &str,
        invoice_number: &str,
        invoice_total: Money,
        due_at: i64,
        currency: &str,
        company: &CompanyProfile,
    ) -> String {
        let subject = format!(
            "=?UTF-8?B?{}?=",
            super::mail::base64(self.subject(invoice_number, &company.name).as_bytes())
        );
        let body = self.body(invoice_number, invoice_total, due_at, currency, company);
        format!(
            "To: {recipient}\r\nSubject: {subject}\r\nX-Unsent: 1\r\n\
             Content-Type: text/plain; charset=utf-8\r\n\r\n{body}"
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_company() -> CompanyProfile {
        CompanyProfile {
            name: "Beispiel GmbH".to_string(),
            iban: "DE12 3456 7890 1234 5678 90".to_string(),
            bic: "BEISDEFFXXX".to_string(),
            bank_name: "Beispielbank".to_string(),
            ..CompanyProfile::default()
        }
    }

    #[test]
    fn presets_follow_the_modal() {
        assert_eq!(DunningLevel::Reminder.fee_cents(), 0);
        assert_eq!(DunningLevel::First.fee_cents(), 250);
        assert_eq!(DunningLevel::Last.fee_cents(), 500);
        assert_eq!(DunningLevel::Reminder.deadline_days(), 7);
        assert_eq!(DunningLevel::First.deadline_days(), 7);
        assert_eq!(DunningLevel::Last.deadline_days(), 5);
        assert_eq!(DunningLevel::Last.interest_cents(25_138), 1_257);
        assert_eq!(DunningLevel::First.interest_cents(25_138), 0);
        assert_eq!(DunningLevel::all().len(), 3);
        assert_eq!(DunningLevel::Last.number(), 3);
    }

    #[test]
    fn letter_adds_fee_and_interest() {
        let now = 1_760_000_000_000;
        let letter = DunningLetter::new(DunningLevel::Last, Money::from_cents(25_138), now);
        assert_eq!(letter.fee, Money::from_cents(500));
        assert_eq!(letter.interest, Money::from_cents(1_257));
        assert_eq!(
            letter.total(Money::from_cents(25_138)),
            Money::from_cents(26_895)
        );
        assert_eq!(letter.deadline, now + 5 * DAY_MS);
        assert_eq!(letter.deadline_text(), format_date(now + 5 * DAY_MS));
    }

    #[test]
    fn titles_and_intro_match_the_legacy_texts() {
        assert_eq!(DunningLevel::Reminder.title(), "Zahlungserinnerung");
        assert_eq!(DunningLevel::First.title(), "1. Mahnung");
        assert_eq!(DunningLevel::Last.title(), "2. und letzte Mahnung");
        assert!(DunningLevel::Reminder
            .intro("01.01.2027")
            .starts_with("sicherlich ist es Ihrer Aufmerksamkeit entgangen"));
        assert!(DunningLevel::First
            .intro("01.01.2027")
            .ends_with("bis spätestens 01.01.2027."));
        assert!(DunningLevel::Last
            .intro("01.01.2027")
            .contains("gerichtliche Mahnverfahren"));
    }

    #[test]
    fn export_contains_every_figure() {
        let now = 1_760_000_000_000;
        let letter = DunningLetter::new(DunningLevel::First, Money::from_cents(25_138), now);
        let body = letter.body(
            "2026-0001",
            Money::from_cents(25_138),
            now - 30 * DAY_MS,
            "€",
            &sample_company(),
        );
        assert!(body.contains("Rechnungsnummer: 2026-0001"));
        assert!(body.contains("Offener Rechnungsbetrag: 251.38 €"));
        assert!(body.contains("Mahngebühr: 2.50 €"));
        assert!(body.contains("Verzugszinsen: 0.00 €"));
        assert!(body.contains("Gesamtforderung: 253.88 €"));
        assert!(body.contains("IBAN: DE12 3456 7890 1234 5678 90"));
        assert!(body.ends_with("Beispiel GmbH"));

        let eml = letter.eml(
            "kunde@example.de",
            "2026-0001",
            Money::from_cents(25_138),
            now - 30 * DAY_MS,
            "€",
            &sample_company(),
        );
        assert!(eml.starts_with("To: kunde@example.de\r\nSubject: =?UTF-8?B?"));
        assert!(eml.contains("X-Unsent: 1"));
        assert_eq!(
            letter.file_name("2026-0001"),
            "Mahnung_2026-0001_Stufe2.eml"
        );
    }

    #[test]
    fn overdue_days_round_up() {
        let due = 1_000_000;
        assert_eq!(overdue_days(due, due), 0);
        assert_eq!(overdue_days(due, due + DAY_MS), 1);
        assert_eq!(overdue_days(due, due + DAY_MS + 1), 2);
        assert_eq!(overdue_days(due, due - 5 * DAY_MS), 0);
    }
}
