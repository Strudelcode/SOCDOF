//! Authentication security switches persisted in the store settings table.
//!
//! Mirrors the TypeScript `SecuritySettings` record (`autoLoginSingleUser` and
//! `allowQuickUserSwitch`).

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::CoreResult;
use crate::store::{settings, Store};

const AUTH_SECURITY_KEY: &str = "auth_security_settings";

/// Security toggles controlling automatic single-user login and quick account switching.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct AuthSecuritySettings {
    /// Sign in automatically on startup when exactly one active account exists.
    pub auto_login_single_user: bool,
    /// Allow switching accounts directly from the lock screen strip.
    pub allow_quick_user_switch: bool,
}

impl Default for AuthSecuritySettings {
    fn default() -> Self {
        Self {
            auto_login_single_user: false,
            allow_quick_user_switch: true,
        }
    }
}

/// Loads persisted authentication security settings using an existing connection.
pub fn load_conn(conn: &Connection) -> CoreResult<AuthSecuritySettings> {
    match settings::get(conn, AUTH_SECURITY_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(AuthSecuritySettings::default()),
    }
}

/// Loads persisted authentication security settings from the store.
pub fn load(store: &Store) -> CoreResult<AuthSecuritySettings> {
    load_conn(store.connection())
}

/// Persists authentication security settings in the store.
pub fn save(store: &Store, value: &AuthSecuritySettings) -> CoreResult<()> {
    settings::put(
        store.connection(),
        AUTH_SECURITY_KEY,
        &serde_json::to_value(value)?,
    )
}
