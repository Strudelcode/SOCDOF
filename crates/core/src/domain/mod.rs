//! Domain entities.
//!
//! Each module mirrors a module of the legacy TypeScript application. Fields are named after the
//! legacy JSON keys where possible so the import of existing data stays a straight mapping.

pub mod accounting;
pub mod appointment;
pub mod billing;
pub mod contact;
pub mod countries;
pub mod document;
pub mod invoice;
pub mod permission;
pub mod pos;
pub mod product;
pub mod purchase;
pub mod session;
pub mod settings;
pub mod stock;
pub mod support;
pub mod therapy;
pub mod user;
pub mod workspace;
