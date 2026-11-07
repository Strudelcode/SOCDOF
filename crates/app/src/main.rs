//! Desktop application entry point.
//!
//! Phase 0 keeps this binary deliberately small: it opens the store, applies migrations and reports
//! the state of the database. The Tauri shell from Phase 3 replaces the reporting with the windows,
//! tray and desktop shell.

use std::process::ExitCode;

use socdof_core::store::Store;

fn main() -> ExitCode {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "socdof.db".to_string());

    match run(&path) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("SOCDOF could not start: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let store = Store::open(path)?;

    println!("SOCDOF core ready");
    println!("  database:       {path}");
    println!("  schema version: {}", store.schema_version()?);
    println!("  contacts:       {}", store.contact_count()?);
    println!("  invoices:       {}", store.invoice_count()?);
    println!();
    println!("The desktop shell (windows, tray, start menu) is built in Phase 3.");

    Ok(())
}
