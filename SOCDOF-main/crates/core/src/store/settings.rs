//! JSON settings storage.
//!
//! Settings are stored as JSON values in a key/value table. Typed accessors live next to the raw
//! functions so callers never have to touch the table directly.

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::domain::settings::CompanyProfile;
use crate::error::CoreResult;

/// Key of the company profile inside the settings table.
pub const COMPANY_PROFILE_KEY: &str = "company_profile";

/// Reads a setting.
pub fn get(conn: &Connection, key: &str) -> CoreResult<Option<Value>> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;

    match raw {
        Some(text) => Ok(Some(serde_json::from_str(&text)?)),
        None => Ok(None),
    }
}

/// Inserts or replaces a setting.
pub fn put(conn: &Connection, key: &str, value: &Value) -> CoreResult<()> {
    let text = serde_json::to_string(value)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, text],
    )?;
    Ok(())
}

/// Removes a setting.
pub fn remove(conn: &Connection, key: &str) -> CoreResult<()> {
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

/// Loads the company profile, returning defaults when nothing was stored yet.
pub fn load_company_profile(conn: &Connection) -> CoreResult<CompanyProfile> {
    match get(conn, COMPANY_PROFILE_KEY)? {
        Some(value) => Ok(serde_json::from_value(value)?),
        None => Ok(CompanyProfile::default()),
    }
}

/// Stores the company profile.
pub fn save_company_profile(conn: &Connection, profile: &CompanyProfile) -> CoreResult<()> {
    put(conn, COMPANY_PROFILE_KEY, &serde_json::to_value(profile)?)
}
