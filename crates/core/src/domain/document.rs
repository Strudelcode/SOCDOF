//! Documents of the built-in text editor.
//!
//! The editor stores plain text with a document name. Validation lives here so the store and every
//! caller share the same limits; the UI only translates the returned codes.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Maximum number of characters in a document name.
pub const MAX_DOCUMENT_NAME_CHARS: usize = 120;

/// Maximum number of characters in a document body.
pub const MAX_DOCUMENT_BODY_CHARS: usize = 1_000_000;

/// A saved document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Document {
    /// Stable identifier.
    pub id: Uuid,
    /// Name shown in the document list.
    pub name: String,
    /// Plain-text contents.
    pub body: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Document {
    /// Creates a document with a fresh identifier.
    pub fn new(name: impl Into<String>, body: impl Into<String>, now: i64) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            body: body.into(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Validates the name and content before a write.
    pub fn validate(&self) -> Result<(), String> {
        let name = self.name.trim();
        if name.is_empty() {
            return Err("document_name_required".to_string());
        }
        if name.chars().count() > MAX_DOCUMENT_NAME_CHARS {
            return Err("document_name_too_long".to_string());
        }
        if self.body.trim().is_empty() {
            return Err("document_body_required".to_string());
        }
        if self.body.chars().count() > MAX_DOCUMENT_BODY_CHARS {
            return Err("document_body_too_long".to_string());
        }
        Ok(())
    }

    /// Number of words in the body, split on Unicode whitespace.
    pub fn word_count(&self) -> usize {
        self.body.split_whitespace().count()
    }

    /// Number of characters in the body.
    pub fn character_count(&self) -> usize {
        self.body.chars().count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_names_and_content() {
        let mut document = Document::new("Notizen", "Erste Zeile", 1);
        assert!(document.validate().is_ok());
        assert_eq!(document.word_count(), 2);
        assert_eq!(document.character_count(), 11);

        document.name = "   ".to_string();
        assert_eq!(
            document.validate(),
            Err("document_name_required".to_string())
        );
        document.name = "x".repeat(MAX_DOCUMENT_NAME_CHARS + 1);
        assert_eq!(
            document.validate(),
            Err("document_name_too_long".to_string())
        );

        document.name = "Notizen".to_string();
        document.body = " \n\t ".to_string();
        assert_eq!(
            document.validate(),
            Err("document_body_required".to_string())
        );
        document.body = "x".repeat(MAX_DOCUMENT_BODY_CHARS + 1);
        assert_eq!(
            document.validate(),
            Err("document_body_too_long".to_string())
        );
    }
}
