//! Form state, validation and the unsaved-changes guard.
//!
//! The kit stays free of business rules: messages and labels are passed in already translated, and
//! the caller decides what to do with a valid or dirty form. What lives here is the part every
//! screen would otherwise reimplement — validation, dirty tracking against a saved baseline and the
//! decision whether closing a screen needs a confirmation.

/// One editable field.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Field {
    /// Translated label above the input.
    pub label: String,
    /// Translated placeholder shown while the field is empty.
    pub hint: String,
    /// Current text.
    pub value: String,
    /// Whether an empty value is an error.
    pub required: bool,
    /// Optional maximum length in characters.
    pub max_len: Option<usize>,
    /// Whether the value has to look like an email address.
    pub email: bool,
    /// Translated error of the last validation, `None` when valid.
    pub error: Option<String>,
}

impl Field {
    /// Builds an optional text field.
    pub fn new(label: impl Into<String>, hint: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            hint: hint.into(),
            value: String::new(),
            required: false,
            max_len: None,
            email: false,
            error: None,
        }
    }

    /// Marks the field as required.
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }

    /// Limits the length in characters.
    pub fn max_len(mut self, len: usize) -> Self {
        self.max_len = Some(len);
        self
    }

    /// Requires an email shaped value.
    pub fn email(mut self) -> Self {
        self.email = true;
        self
    }

    /// Validates the field and stores the translated error, if any.
    pub fn validate(&mut self, required_msg: &str, too_long_msg: &str, email_msg: &str) -> bool {
        let trimmed = self.value.trim();
        self.error = if self.required && trimmed.is_empty() {
            Some(required_msg.to_string())
        } else if self
            .max_len
            .is_some_and(|len| trimmed.chars().count() > len)
        {
            Some(too_long_msg.to_string())
        } else if self.email && !trimmed.is_empty() && !looks_like_email(trimmed) {
            Some(email_msg.to_string())
        } else {
            None
        };
        self.error.is_none()
    }

    /// Clears the stored error, for example while the user types.
    pub fn clear_error(&mut self) {
        self.error = None;
    }
}

/// A form with fields, validation and a saved baseline for dirty tracking.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormState {
    /// Editable fields in display order.
    pub fields: Vec<Field>,
    baseline: Vec<String>,
}

impl FormState {
    /// Builds a form and treats the initial values as the saved state.
    pub fn new(fields: Vec<Field>) -> Self {
        let baseline = fields.iter().map(|field| field.value.clone()).collect();
        Self { fields, baseline }
    }

    /// Validates every field; `false` means at least one error is shown.
    pub fn validate(&mut self, required_msg: &str, too_long_msg: &str, email_msg: &str) -> bool {
        let mut valid = true;
        for field in &mut self.fields {
            if !field.validate(required_msg, too_long_msg, email_msg) {
                valid = false;
            }
        }
        valid
    }

    /// Whether any value differs from the saved baseline.
    pub fn is_dirty(&self) -> bool {
        self.fields
            .iter()
            .zip(self.baseline.iter())
            .any(|(field, saved)| &field.value != saved)
    }

    /// Accepts the current values as saved and clears every error.
    pub fn mark_saved(&mut self) {
        self.baseline = self
            .fields
            .iter()
            .map(|field| field.value.clone())
            .collect();
        for field in &mut self.fields {
            field.clear_error();
        }
    }

    /// Throws away the edits and restores the saved values.
    pub fn discard(&mut self) {
        for (field, saved) in self.fields.iter_mut().zip(self.baseline.iter()) {
            field.value = saved.clone();
            field.error = None;
        }
    }

    /// Number of fields with an error.
    pub fn error_count(&self) -> usize {
        self.fields
            .iter()
            .filter(|field| field.error.is_some())
            .count()
    }

    /// Replaces labels and hints after a language change, keeping values and errors.
    pub fn relabel(&mut self, labels: &[(&str, &str)]) {
        for (field, (label, hint)) in self.fields.iter_mut().zip(labels.iter()) {
            field.label = (*label).to_string();
            field.hint = (*hint).to_string();
        }
    }
}

/// Decision for a screen that may have unsaved changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseDecision {
    /// Nothing to save, the screen can close.
    Close,
    /// The user has to confirm that the edits are discarded.
    Confirm,
}

/// Guards a screen against losing unsaved edits.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct UnsavedGuard {
    /// Whether the confirmation dialog is open.
    pub confirm_open: bool,
}

impl UnsavedGuard {
    /// Asks whether the screen may close; a dirty form opens the confirmation instead.
    pub fn request_close(&mut self, dirty: bool) -> CloseDecision {
        if dirty {
            self.confirm_open = true;
            CloseDecision::Confirm
        } else {
            CloseDecision::Close
        }
    }

    /// Keeps the screen open after the user cancelled the confirmation.
    pub fn keep_editing(&mut self) {
        self.confirm_open = false;
    }

    /// Confirms discarding the edits and closes the dialog.
    pub fn confirm_discard(&mut self) {
        self.confirm_open = false;
    }
}

/// Rough email check: both sides of the `@` are non-empty and the domain has a dot.
pub fn looks_like_email(text: &str) -> bool {
    let trimmed = text.trim();
    let mut parts = trimmed.split('@');
    match (parts.next(), parts.next(), parts.next()) {
        (Some(local), Some(domain), None) => {
            !local.is_empty()
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn company() -> Field {
        Field::new("Firmenname", "Muster AG").required().max_len(80)
    }

    fn email_field() -> Field {
        Field::new("E-Mail", "name@firma.de").required().email()
    }

    #[test]
    fn required_fields_reject_blank_values() {
        let mut field = company();
        field.value = "   ".to_string();
        assert!(!field.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert_eq!(field.error.as_deref(), Some("Pflichtfeld"));

        field.value = "Muster AG".to_string();
        assert!(field.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert!(field.error.is_none());
    }

    #[test]
    fn length_and_email_rules_report_translated_messages() {
        let mut field = company();
        field.value = "x".repeat(90);
        assert!(!field.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert_eq!(field.error.as_deref(), Some("zu lang"));

        let mut field = email_field();
        field.value = "keine-adresse".to_string();
        assert!(!field.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert_eq!(field.error.as_deref(), Some("ungültig"));

        field.value = "buchhaltung@muster.ag".to_string();
        assert!(field.validate("Pflichtfeld", "zu lang", "ungültig"));
    }

    #[test]
    fn email_shapes() {
        assert!(looks_like_email("a@b.ch"));
        assert!(looks_like_email(" buchhaltung@muster.ag "));
        assert!(!looks_like_email("a@b"));
        assert!(!looks_like_email("a@@b.ch"));
        assert!(!looks_like_email("a@.ch"));
        assert!(!looks_like_email("ab.ch"));
        assert!(!looks_like_email(""));
    }

    #[test]
    fn dirty_tracking_follows_the_saved_baseline() {
        let mut form = FormState::new(vec![company(), email_field()]);
        assert!(!form.is_dirty());

        form.fields[0].value = "Muster AG".to_string();
        assert!(form.is_dirty());
        form.mark_saved();
        assert!(!form.is_dirty());

        form.fields[1].value = "a@b.ch".to_string();
        assert!(form.is_dirty());
        form.discard();
        assert!(!form.is_dirty());
        assert_eq!(form.fields[1].value, "");
    }

    #[test]
    fn validation_reports_errors_per_field() {
        let mut form = FormState::new(vec![company(), email_field()]);
        assert!(!form.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert_eq!(form.error_count(), 2);
        assert_eq!(form.fields[0].error.as_deref(), Some("Pflichtfeld"));

        form.fields[0].value = "Muster AG".to_string();
        form.fields[1].value = "a@b.ch".to_string();
        assert!(form.validate("Pflichtfeld", "zu lang", "ungültig"));
        assert_eq!(form.error_count(), 0);
    }

    #[test]
    fn relabel_keeps_values_and_errors() {
        let mut form = FormState::new(vec![company(), email_field()]);
        form.fields[0].value = "Muster AG".to_string();
        form.fields[1].error = Some("Pflichtfeld".to_string());
        form.relabel(&[("Company", "Example Ltd"), ("Email", "name@example.com")]);
        assert_eq!(form.fields[0].label, "Company");
        assert_eq!(form.fields[0].value, "Muster AG");
        assert_eq!(form.fields[1].error.as_deref(), Some("Pflichtfeld"));
    }

    #[test]
    fn guard_only_asks_when_the_form_is_dirty() {
        let mut guard = UnsavedGuard::default();
        assert_eq!(guard.request_close(false), CloseDecision::Close);
        assert!(!guard.confirm_open);

        assert_eq!(guard.request_close(true), CloseDecision::Confirm);
        assert!(guard.confirm_open);
        guard.keep_editing();
        assert!(!guard.confirm_open);

        assert_eq!(guard.request_close(true), CloseDecision::Confirm);
        guard.confirm_discard();
        assert!(!guard.confirm_open);
    }
}
