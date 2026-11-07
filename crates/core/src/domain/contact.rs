//! Contacts: persons and companies, including company sub-contacts in later phases.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Whether a contact is a natural person or a company.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContactKind {
    /// A natural person.
    Person,
    /// A company, optionally with sub-contacts.
    Company,
}

impl ContactKind {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            ContactKind::Person => "person",
            ContactKind::Company => "company",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "person" => Some(ContactKind::Person),
            "company" => Some(ContactKind::Company),
            _ => None,
        }
    }
}

/// A customer or supplier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contact {
    /// Stable identifier.
    pub id: Uuid,
    /// Person or company.
    pub kind: ContactKind,
    /// Company name, only set for companies.
    pub company_name: Option<String>,
    /// First name, only set for persons.
    pub first_name: Option<String>,
    /// Last name, only set for persons.
    pub last_name: Option<String>,
    /// Street and house number.
    pub street: Option<String>,
    /// Postal code.
    pub zip: Option<String>,
    /// City.
    pub city: Option<String>,
    /// Country name or ISO code.
    pub country: Option<String>,
    /// Email address.
    pub email: Option<String>,
    /// Phone number.
    pub phone: Option<String>,
    /// Tax number / VAT id.
    pub tax_id: Option<String>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Contact {
    /// Creates an empty contact of the given kind with a fresh identifier.
    pub fn new(kind: ContactKind, now: i64) -> Self {
        Contact {
            id: Uuid::new_v4(),
            kind,
            company_name: None,
            first_name: None,
            last_name: None,
            street: None,
            zip: None,
            city: None,
            country: None,
            email: None,
            phone: None,
            tax_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Name shown in lists: the company name, or the full person name, or the email as fallback.
    pub fn display_name(&self) -> String {
        if let Some(company) = self.company_name.as_deref().map(str::trim) {
            if !company.is_empty() {
                return company.to_string();
            }
        }

        let parts: Vec<&str> = [self.first_name.as_deref(), self.last_name.as_deref()]
            .into_iter()
            .flatten()
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .collect();

        if !parts.is_empty() {
            return parts.join(" ");
        }

        self.email.clone().unwrap_or_default()
    }

    /// Validates the fields required by the UI.
    pub fn validate(&self) -> Result<(), String> {
        match self.kind {
            ContactKind::Company => {
                if self.display_name().trim().is_empty() {
                    return Err("company_name_required".to_string());
                }
            }
            ContactKind::Person => {
                if self.last_name.as_deref().unwrap_or("").trim().is_empty() {
                    return Err("last_name_required".to_string());
                }
            }
        }

        if let Some(email) = self
            .email
            .as_deref()
            .map(str::trim)
            .filter(|e| !e.is_empty())
        {
            if !email.contains('@') || email.starts_with('@') || email.ends_with('@') {
                return Err("email_invalid".to_string());
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_display_name_for_companies_and_persons() {
        let now = 0;
        let mut company = Contact::new(ContactKind::Company, now);
        company.company_name = Some("  Strudelcode  ".to_string());
        assert_eq!(company.display_name(), "Strudelcode");

        let mut person = Contact::new(ContactKind::Person, now);
        person.first_name = Some("Yuri".to_string());
        person.last_name = Some("Strudel".to_string());
        assert_eq!(person.display_name(), "Yuri Strudel");
    }

    #[test]
    fn validates_required_fields() {
        let now = 0;
        let mut person = Contact::new(ContactKind::Person, now);
        person.email = Some("invalid".to_string());
        assert_eq!(person.validate(), Err("last_name_required".to_string()));

        person.last_name = Some("Strudel".to_string());
        assert_eq!(person.validate(), Err("email_invalid".to_string()));

        person.email = Some("yuri@example.com".to_string());
        assert_eq!(person.validate(), Ok(()));
    }
}
