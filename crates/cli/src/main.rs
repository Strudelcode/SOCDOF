//! Command line access to the SOCDOF core.
//!
//! Used for tooling, data import checks and fast verification without starting a window.

use std::process::ExitCode;

use socdof_core::store::Store;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "info".to_string());
    let path = args.next().unwrap_or_else(|| "socdof.db".to_string());

    match run(&command, &path) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(command: &str, path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let store = Store::open(path)?;

    match command {
        "info" => {
            println!("database:       {path}");
            println!("schema version: {}", store.schema_version()?);
            println!("contacts:       {}", store.contact_count()?);
            println!("invoices:       {}", store.invoice_count()?);
        }
        "contacts" => {
            for contact in store.list_contacts()? {
                println!("{}\t{}", contact.id, contact.display_name());
            }
        }
        other => {
            eprintln!("unknown command: {other}");
            eprintln!("usage: socdof-cli <info|contacts> [database]");
            return Err("invalid arguments".into());
        }
    }

    Ok(())
}
