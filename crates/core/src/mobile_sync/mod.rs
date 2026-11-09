//! Mobile companion sync.
//!
//! The Rust side of the pairing the TypeScript application implements: a payload model
//! ([`payload`]) and, on native targets, the HTTP gateway and client ([`http`]). The endpoints,
//! headers, status codes and bodies are the ones in `SOCDOF - TS/vite.config.ts` and
//! `SOCDOF - TS/electron/main.cjs`; the payload is the one
//! `SOCDOF - TS/src/lib/mobileCompanionTypes.ts` documents.
//!
//! The gateway is reachable from `socdof-cli companion-sync <database> [port]` and
//! `socdof-cli companion-import <database> <payload.json>`. It is not compiled for `wasm32`, where
//! `std::net` does not exist; the payload model itself stays portable.

pub mod payload;

pub use payload::{
    import, import_bytes, import_file, import_value, normalize, normalize_bytes, ImportReport,
    MobileCustomer, MobileExpense, MobileSession, MobileTicket, MobileTimesheet, MobileTrip,
    MobileVoiceNote, SessionNotes, SyncPayload, SyncSummary, DEFAULT_HOURLY_RATE_CENTS, PROTOCOL,
};

#[cfg(not(target_arch = "wasm32"))]
pub mod http;

#[cfg(not(target_arch = "wasm32"))]
pub use http::{
    client, Options, Running, DEFAULT_PORT, FALLBACK_PORT, MAX_AGE_MS, MAX_BODY_BYTES, SERVICE_NAME,
};
