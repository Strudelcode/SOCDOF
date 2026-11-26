//! Security switches of the sign-in area.
//!
//! The reference app keeps these next to the account lockout policy in its security settings. The
//! port stores them as one JSON value in the settings table, next to the company profile.

use serde::{Deserialize, Serialize};

use crate::error::CoreResult;
use crate::store::{settings, Store};

/// Key of the security settings inside the settings table.
pub const AUTH_SECURITY_KEY: &str = "auth_security";

/// Sign-in conveniences of the reference app.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct AuthSecuritySettings {
    /// Sign the single active account in automatically on start.
    pub auto_login_single_user: bool,
    /// Allow switching to a passwordless account without entering a password.
    pub allow_quick_user_switch: bool,
}

impl Default for AuthSecuritySettings {
    fn default() -> Self {
        AuthSecuritySettings {
            auto_login_single_user: false,
            allow_quick_user_switch: true,
        }
    }
}

/// Reads the security settings, defaulting when nothing is stored yet.
pub fn load(store: &Store) -> CoreResult<AuthSecuritySettings> {
    Ok(store
        .get_setting(AUTH_SECURITY_KEY)?
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default())
}

/// Validates and stores the security settings.
pub fn save(store: &Store, settings: &AuthSecuritySettings) -> CoreResult<()> {
    store.put_setting(AUTH_SECURITY_KEY, &serde_json::to_value(settings)?)
}

pub(crate) fn load_conn(conn: &rusqlite::Connection) -> CoreResult<AuthSecuritySettings> {
    Ok(settings::get(conn, AUTH_SECURITY_KEY)?
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default())
}
