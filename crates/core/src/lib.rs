//! SOCDOF core: domain model, money handling and SQLite persistence.
//!
//! The crate is UI agnostic. The desktop application (Phase 3 of `RUST_MIGRATION.md`) and the
//! headless CLI both talk to the store through this API.

pub mod app_store;
pub mod autosave;
pub mod backup;
pub mod backup_scheduler;
pub mod csv;
pub mod date;
pub mod domain;
pub mod error;
pub mod i18n;
pub mod legacy;
pub mod lock;
pub mod logging;
pub mod money;
pub mod pdf;
pub mod security;
pub mod security_questions;
pub mod settings_service;
pub mod store;

pub use error::{CoreError, CoreResult};
pub use money::Money;

/// Current time in milliseconds since the Unix epoch, used for all stored timestamps.
pub fn now_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}
