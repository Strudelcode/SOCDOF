//! Domain entities.
//!
//! Each module mirrors a module of the legacy TypeScript application. Fields are named after the
//! legacy JSON keys where possible so the import of existing data stays a straight mapping.

pub mod accounting;
pub mod accounting_report;
pub mod appointment;
pub mod billing;
pub mod contact;
pub mod countries;
pub mod document;
pub mod dunning;
pub mod fattura;
pub mod fleet;
pub mod invoice;
pub mod label;
pub mod mail;
pub mod payment;
pub mod permission;
pub mod pos;
pub mod product;
pub mod project;
pub mod purchase;
pub mod reorder;
pub mod restaurant;
pub mod session;
pub mod settings;
pub mod stock;
pub mod tax_advisor_ledger;
pub mod support;
pub mod therapy;
pub mod user;
pub mod workspace;
