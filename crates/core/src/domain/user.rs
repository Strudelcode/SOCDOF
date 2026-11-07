//! User accounts and roles.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Built-in roles. Custom roles with per-app permissions arrive in a later phase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    /// Full access, can manage users and settings.
    Admin,
    /// Regular user, access is limited by the assigned role.
    User,
}

impl UserRole {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            UserRole::Admin => "admin",
            UserRole::User => "user",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "admin" => Some(UserRole::Admin),
            "user" => Some(UserRole::User),
            _ => None,
        }
    }
}

/// A local account.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    /// Stable identifier.
    pub id: Uuid,
    /// Login name, unique and case insensitive.
    pub username: String,
    /// Name shown in the UI.
    pub display_name: String,
    /// Built-in role.
    pub role: UserRole,
    /// Optional custom role reference.
    pub role_id: Option<String>,
    /// Whether the account can sign in.
    pub active: bool,
    /// Argon2id PHC string.
    pub password_hash: String,
    /// Forces a password change on the next sign-in.
    pub must_change_password: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl User {
    /// Whether the account has administrator rights.
    pub fn is_admin(&self) -> bool {
        self.role == UserRole::Admin
    }

    /// Validates the fields required by the UI.
    pub fn validate(&self) -> Result<(), String> {
        let username = self.username.trim();
        if username.len() < 3 {
            return Err("username_too_short".to_string());
        }
        if !username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
        {
            return Err("username_invalid_characters".to_string());
        }
        if self.display_name.trim().is_empty() {
            return Err("display_name_required".to_string());
        }
        if self.password_hash.trim().is_empty() {
            return Err("password_hash_required".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> User {
        User {
            id: Uuid::new_v4(),
            username: "admin".to_string(),
            display_name: "Administrator".to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: "$argon2id$placeholder".to_string(),
            must_change_password: false,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn validates_username_and_display_name() {
        let mut user = sample();
        assert!(user.is_admin());
        assert_eq!(user.validate(), Ok(()));

        user.username = "ab".to_string();
        assert_eq!(user.validate(), Err("username_too_short".to_string()));

        user.username = "admin user".to_string();
        assert_eq!(
            user.validate(),
            Err("username_invalid_characters".to_string())
        );

        user.username = "admin".to_string();
        user.display_name = "  ".to_string();
        assert_eq!(user.validate(), Err("display_name_required".to_string()));
    }

    #[test]
    fn roundtrips_role_strings() {
        for role in [UserRole::Admin, UserRole::User] {
            assert_eq!(UserRole::from_storage(role.as_str()), Some(role));
        }
        assert_eq!(UserRole::from_storage("owner"), None);
    }
}
