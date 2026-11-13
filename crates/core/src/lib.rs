//! SOCDOF core: domain model, money handling and SQLite persistence.
//!
//! The crate is UI agnostic. The desktop application (Phase 3 of `RUST_MIGRATION.md`) and the
//! headless CLI both talk to the store through this API.

pub mod app_store;
pub mod autosave;
pub mod backup;
pub mod backup_scheduler;
pub mod barcode;
pub mod csv;
pub mod contact_import_export;
pub mod date;
pub mod document_layout;
pub mod docx;
pub mod domain;
pub mod error;
pub mod i18n;
pub mod i18n_legacy;
pub mod invoice_template;
pub mod legacy;
pub mod lock;
pub mod logging;
pub mod mobile_sync;
pub mod money;
pub mod pdf;
pub mod rich_html;
pub mod security;
pub mod security_questions;
pub mod settings_service;
pub mod spell;
pub mod store;
pub mod updates;

pub use error::{CoreError, CoreResult};
pub use money::Money;

/// Current time in milliseconds since the Unix epoch, used for all stored timestamps.
///
/// `std::time::SystemTime` has no clock behind it on `wasm32-unknown-unknown`, so the browser build
/// reads `Date.now()` instead. Both paths return the same unit, so stored timestamps stay
/// comparable between the desktop and the browser database.
pub fn now_millis() -> i64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now() as i64
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(duration) => duration.as_millis() as i64,
            Err(_) => 0,
        }
    }
}
