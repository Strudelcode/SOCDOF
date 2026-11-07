//! SOCDOF core: domain model, money handling and SQLite persistence.
//!
//! The crate is UI agnostic. The desktop application (Phase 3 of `RUST_MIGRATION.md`) and the
//! headless CLI both talk to the store through this API.

pub mod domain;
pub mod error;
pub mod money;
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
