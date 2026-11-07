//! PDF generation without third-party dependencies.
//!
//! `writer` produces valid PDF 1.4 documents with the built-in Helvetica fonts, `din5008` lays out
//! invoices according to the German letter norm.

pub mod din5008;
pub mod writer;
