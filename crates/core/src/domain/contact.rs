//! Contacts: persons and companies, including the contact persons of a company.
//!
//! A company carries any number of contact persons ("sub-contacts" in the legacy application). The
//! shape follows `SOCDOF - TS/src/types.ts`: `id`, `first_name`, `last_name`, `email`, `phone`,
//! `role` and `is_primary`, and the rules follow `ContactEditModal.tsx` — the first person of a
//! company is the primary one, deleting the primary promotes the first remaining person, setting a
//! primary demotes every other one, and saving drops persons whose first name, last name, email and
//! phone are all empty.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Whether a contact is a natural person or a company.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContactKind {
    /// A natural person.
    Person,
    /// A company, optionally with contact persons.
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

/// The legacy CRM category of a contact.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContactType {
    /// A customer.
    Customer,
    /// A supplier.
    Vendor,
    /// A customer and supplier.
    Both,
    /// An address-book / guest entry.
    Guest,
}

impl ContactType {
    /// Stable storage and legacy-JSON representation.
    pub fn as_str(self) -> &'static str {
        match self {
            ContactType::Customer => "customer",
            ContactType::Vendor => "vendor",
            ContactType::Both => "both",
            ContactType::Guest => "guest",
        }
    }

    /// Parses the legacy representation, defaulting to a customer.
    pub fn from_legacy(value: Option<&str>) -> Self {
        match value.unwrap_or("customer") {
            "customer" => ContactType::Customer,
            "vendor" => ContactType::Vendor,
            "both" => ContactType::Both,
            "guest" => ContactType::Guest,
            _ => ContactType::Customer,
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "customer" => Some(ContactType::Customer),
            "vendor" => Some(ContactType::Vendor),
            "both" => Some(ContactType::Both),
            "guest" => Some(ContactType::Guest),
            _ => None,
        }
    }
}

/// One contact person of a company, called "sub-contact" in the legacy UI.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContactPerson {
    /// Stable identifier. The legacy application used `cp_<millis>_<suffix>`.
    pub id: String,
    /// First name.
    #[serde(default)]
    pub first_name: String,
    /// Last name.
    #[serde(default)]
    pub last_name: String,
    /// Email address.
    #[serde(default)]
    pub email: String,
    /// Phone number, including the extension.
    #[serde(default)]
    pub phone: String,
    /// Role or department, e.g. "Purchasing".
    #[serde(default)]
    pub role: String,
    /// Whether this person is the primary contact of the company.
    #[serde(default)]
    pub is_primary: bool,
}

impl ContactPerson {
    /// Identifier in the legacy shape `cp_<millis>_<suffix>`.
    pub fn draft_id(now: i64, suffix: &str) -> String {
        format!("cp_{now}_{suffix}")
    }

    /// Builds an empty person; the caller marks the first person of a company as primary.
    pub fn draft(id: String, primary: bool) -> Self {
        Self {
            id,
            first_name: String::new(),
            last_name: String::new(),
            email: String::new(),
            phone: String::new(),
            role: String::new(),
            is_primary: primary,
        }
    }

    /// Full name with the parts that are filled in.
    pub fn full_name(&self) -> String {
        [self.first_name.trim(), self.last_name.trim()]
            .into_iter()
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// The form the legacy contact list prints: the full name and the role in parentheses.
    pub fn summary(&self) -> String {
        let name = self.full_name();
        let role = self.role.trim();
        match (name.is_empty(), role.is_empty()) {
            (true, true) => String::new(),
            (false, true) => name,
            (true, false) => format!("({role})"),
            (false, false) => format!("{name} ({role})"),
        }
    }

    /// Whether every identity field is empty, which the save path drops.
    pub fn is_blank(&self) -> bool {
        [&self.first_name, &self.last_name, &self.email, &self.phone]
            .into_iter()
            .all(|value| value.trim().is_empty())
    }

    /// Trims every text field.
    pub fn sanitize(&mut self) {
        self.first_name = self.first_name.trim().to_string();
        self.last_name = self.last_name.trim().to_string();
        self.email = self.email.trim().to_string();
        self.phone = self.phone.trim().to_string();
        self.role = self.role.trim().to_string();
    }
}

/// A customer or supplier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contact {
    /// Stable identifier.
    pub id: Uuid,
    /// Person or company.
    pub kind: ContactKind,
    /// CRM category (customer, supplier, both, guest).
    pub contact_type: ContactType,
    /// Display name as entered in the legacy address book.
    pub name: Option<String>,
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
    /// Free-form notes.
    pub notes: Option<String>,
    /// Contact persons of a company, primary first.
    #[serde(default)]
    pub contact_persons: Vec<ContactPerson>,
    /// Numeric legacy identifier used by legacy backups and invoices.
    pub legacy_id: Option<i64>,
    /// Original legacy JSON object, kept so unknown fields survive a round trip.
    #[serde(skip)]
    pub legacy_json: Option<String>,
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
            contact_type: ContactType::Customer,
            name: None,
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
            notes: None,
            contact_persons: Vec::new(),
            legacy_id: None,
            legacy_json: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Name shown in lists: the legacy display name, the company name, or the full person name.
    pub fn display_name(&self) -> String {
        if let Some(name) = self.name.as_deref().map(str::trim) {
            if !name.is_empty() {
                return name.to_string();
            }
        }

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

    /// Appends a contact person; the first one becomes the primary contact.
    pub fn add_contact_person(&mut self, person: ContactPerson) {
        self.contact_persons.push(person);
        self.ensure_single_primary_contact_person();
    }

    /// Removes a contact person; the primary flag moves to the first remaining person.
    ///
    /// Returns whether a person with that id existed.
    pub fn remove_contact_person(&mut self, id: &str) -> bool {
        let before = self.contact_persons.len();
        self.contact_persons.retain(|person| person.id != id);
        if self.contact_persons.len() == before {
            return false;
        }
        self.ensure_single_primary_contact_person();
        true
    }

    /// Marks one person as the primary contact and clears the flag on every other.
    ///
    /// Returns whether a person with that id existed.
    pub fn set_primary_contact_person(&mut self, id: &str) -> bool {
        if !self.contact_persons.iter().any(|person| person.id == id) {
            return false;
        }
        for person in &mut self.contact_persons {
            person.is_primary = person.id == id;
        }
        true
    }

    /// The person marked as primary, if any.
    pub fn primary_contact_person(&self) -> Option<&ContactPerson> {
        self.contact_persons
            .iter()
            .find(|person| person.is_primary)
            .or_else(|| self.contact_persons.first())
    }

    /// The primary person in the form the legacy contact list prints, e.g. `Anna Weber (Einkauf)`.
    pub fn contact_person_summary(&self) -> Option<String> {
        self.primary_contact_person()
            .map(ContactPerson::summary)
            .filter(|summary| !summary.is_empty())
    }

    /// Exactly one primary person: the first person takes the flag when no one carries it, and a
    /// second primary is cleared.
    pub fn ensure_single_primary_contact_person(&mut self) {
        let mut seen = false;
        for person in &mut self.contact_persons {
            if person.is_primary {
                if seen {
                    person.is_primary = false;
                } else {
                    seen = true;
                }
            }
        }
        if !seen {
            if let Some(first) = self.contact_persons.first_mut() {
                first.is_primary = true;
            }
        }
    }

    /// Drops persons without a name, email or phone and trims the rest, the way the legacy save
    /// path normalises them.
    pub fn sanitize_contact_persons(&mut self) {
        self.contact_persons.retain(|person| !person.is_blank());
        for person in &mut self.contact_persons {
            person.sanitize();
        }
        self.ensure_single_primary_contact_person();
    }

    /// Validates the fields required by the UI.
    pub fn validate(&self) -> Result<(), String> {
        let has_identity = [
            self.name.as_deref(),
            self.company_name.as_deref(),
            self.first_name.as_deref(),
            self.last_name.as_deref(),
        ]
        .into_iter()
        .flatten()
        .any(|value| !value.trim().is_empty());
        if !has_identity {
            return Err("name_required".to_string());
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

    fn person(id: &str, first: &str, last: &str, role: &str) -> ContactPerson {
        let mut person = ContactPerson::draft(id.to_string(), false);
        person.first_name = first.to_string();
        person.last_name = last.to_string();
        person.role = role.to_string();
        person
    }

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
    fn prefers_the_legacy_display_name() {
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.name = Some("Dr. Florian Weber".to_string());
        contact.company_name = Some("AlpenTech Solutions AG".to_string());
        assert_eq!(contact.display_name(), "Dr. Florian Weber");
    }

    #[test]
    fn validates_required_fields() {
        let now = 0;
        let mut person = Contact::new(ContactKind::Person, now);
        person.email = Some("invalid".to_string());
        assert_eq!(person.validate(), Err("name_required".to_string()));

        person.last_name = Some("Strudel".to_string());
        assert_eq!(person.validate(), Err("email_invalid".to_string()));

        person.email = Some("yuri@example.com".to_string());
        assert_eq!(person.validate(), Ok(()));
    }

    #[test]
    fn the_first_contact_person_becomes_primary() {
        let mut company = Contact::new(ContactKind::Company, 0);
        assert!(company.contact_persons.is_empty());
        assert_eq!(company.contact_person_summary(), None);

        company.add_contact_person(person("cp_1", "Anna", "Weber", "Einkauf"));
        assert!(company.contact_persons[0].is_primary);
        company.add_contact_person(person("cp_2", "Ben", "Klein", ""));
        assert!(company.contact_persons[0].is_primary);
        assert!(!company.contact_persons[1].is_primary);
        assert_eq!(
            company.contact_person_summary().as_deref(),
            Some("Anna Weber (Einkauf)")
        );
    }

    #[test]
    fn removing_the_primary_promotes_the_first_remaining_person() {
        let mut company = Contact::new(ContactKind::Company, 0);
        company.add_contact_person(person("cp_1", "Anna", "Weber", ""));
        company.add_contact_person(person("cp_2", "Ben", "Klein", ""));
        company.add_contact_person(person("cp_3", "Cleo", "Mert", ""));

        assert!(company.remove_contact_person("cp_1"));
        assert!(
            company.contact_persons[0].is_primary,
            "the next person takes over"
        );
        assert_eq!(company.contact_persons.len(), 2);
        assert!(!company.remove_contact_person("cp_missing"));
        assert_eq!(company.contact_persons.len(), 2);
    }

    #[test]
    fn only_one_contact_person_can_be_primary() {
        let mut company = Contact::new(ContactKind::Company, 0);
        company.add_contact_person(person("cp_1", "Anna", "Weber", ""));
        company.add_contact_person(person("cp_2", "Ben", "Klein", ""));

        assert!(company.set_primary_contact_person("cp_2"));
        let primaries: Vec<&str> = company
            .contact_persons
            .iter()
            .filter(|person| person.is_primary)
            .map(|person| person.id.as_str())
            .collect();
        assert_eq!(primaries, ["cp_2"]);
        assert!(!company.set_primary_contact_person("cp_missing"));

        company.contact_persons[0].is_primary = true;
        company.ensure_single_primary_contact_person();
        assert_eq!(
            company
                .contact_persons
                .iter()
                .filter(|person| person.is_primary)
                .count(),
            1,
            "a second primary flag is cleared"
        );
    }

    #[test]
    fn saving_drops_blank_persons_and_trims_the_rest() {
        let mut company = Contact::new(ContactKind::Company, 0);
        let mut blank = ContactPerson::draft("cp_blank".to_string(), false);
        blank.role = "  ".to_string();
        company.add_contact_person(blank);
        let mut trimmed = ContactPerson::draft("cp_trim".to_string(), false);
        trimmed.first_name = "  Anna ".to_string();
        trimmed.last_name = " Weber  ".to_string();
        trimmed.email = " anna@example.com ".to_string();
        trimmed.role = " Einkauf ".to_string();
        company.add_contact_person(trimmed);

        company.sanitize_contact_persons();
        assert_eq!(
            company.contact_persons.len(),
            1,
            "the blank person is dropped"
        );
        let only = &company.contact_persons[0];
        assert_eq!(only.first_name, "Anna");
        assert_eq!(only.last_name, "Weber");
        assert_eq!(only.email, "anna@example.com");
        assert_eq!(only.role, "Einkauf");
        assert!(only.is_primary, "the remaining person becomes primary");
    }

    #[test]
    fn contact_persons_keep_the_legacy_field_names() {
        let mut company = Contact::new(ContactKind::Company, 0);
        company.company_name = Some("AlpenTech".to_string());
        let mut anna = person("cp_1700000000000_ab12c", "Anna", "Weber", "Einkauf");
        anna.email = "anna@example.com".to_string();
        company.add_contact_person(anna);

        let document = serde_json::to_value(&company).expect("serialize");
        let persons = document["contact_persons"]
            .as_array()
            .expect("contact_persons array");
        assert_eq!(persons.len(), 1);
        assert_eq!(persons[0]["id"], "cp_1700000000000_ab12c");
        assert_eq!(persons[0]["first_name"], "Anna");
        assert_eq!(persons[0]["last_name"], "Weber");
        assert_eq!(persons[0]["role"], "Einkauf");
        assert_eq!(persons[0]["is_primary"], true);
        assert_eq!(persons[0]["email"], "anna@example.com");

        // A legacy row without the optional fields still parses.
        let parsed: Contact = serde_json::from_value(serde_json::json!({
            "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "kind": "company",
            "contact_type": "customer",
            "name": "AlpenTech",
            "company_name": "AlpenTech",
            "first_name": null,
            "last_name": null,
            "street": null,
            "zip": null,
            "city": null,
            "country": null,
            "email": null,
            "phone": null,
            "tax_id": null,
            "notes": null,
            "contact_persons": [{ "id": "cp_1", "first_name": "Anna", "last_name": "Weber" }],
            "legacy_id": 4,
            "created_at": 1,
            "updated_at": 2
        }))
        .expect("deserialize");
        assert_eq!(parsed.contact_persons.len(), 1);
        assert_eq!(parsed.contact_persons[0].summary(), "Anna Weber");
        assert_eq!(parsed.contact_persons[0].email, "");
        assert!(!parsed.contact_persons[0].is_primary);
    }

    #[test]
    fn draft_ids_follow_the_legacy_shape() {
        assert_eq!(
            ContactPerson::draft_id(1_700_000_000_000, "ab12c"),
            "cp_1700000000000_ab12c"
        );
    }
}
