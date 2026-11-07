//! Command line access to the SOCDOF core.
//!
//! Used for tooling, data import checks, backups and fast verification without starting a window.

use std::path::Path;
use std::process::ExitCode;

use socdof_core::backup;
use socdof_core::legacy;
use socdof_core::now_millis;
use socdof_core::store::Store;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "info".to_string());
    let rest: Vec<String> = args.collect();

    match run(&command, &rest) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(command: &str, args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let path = args
        .first()
        .cloned()
        .unwrap_or_else(|| "socdof.db".to_string());

    match command {
        "legacy-import" => {
            let backup = args
                .get(1)
                .ok_or("usage: socdof-cli legacy-import <database> <backup.json>")?;
            let store = Store::open(&path)?;
            let report = legacy::import(&store, Path::new(backup))?;
            println!("legacy backup imported: {backup}");
            println!("  contacts: {}", report.contacts);
            println!("  products: {}", report.products);
            println!("  invoices preserved: {}", report.invoices);
        }
        "legacy-export" => {
            let backup = args
                .get(1)
                .ok_or("usage: socdof-cli legacy-export <database> <backup.json>")?;
            let store = Store::open(&path)?;
            let report = legacy::export(&store, Path::new(backup))?;
            println!("legacy backup written: {backup}");
            println!("  bytes: {}", report.bytes);
            println!("  contacts: {}", report.contacts);
            println!("  products: {}", report.products);
        }
        "backup" => {
            let archive = args
                .get(1)
                .ok_or("usage: socdof-cli backup <database> <archive>")?;
            let store = Store::open(&path)?;
            let info = backup::create_backup(
                &store,
                Path::new(archive),
                env!("CARGO_PKG_VERSION"),
                now_millis(),
            )?;

            println!("backup written: {archive}");
            println!("  archive bytes:  {}", info.archive_bytes);
            println!("  database bytes: {}", info.database_bytes);
            println!("  schema version: {}", info.metadata.schema_version);
        }
        "restore" => {
            let database = args
                .get(1)
                .ok_or("usage: socdof-cli restore <archive> <database>")?;
            let metadata = backup::restore_backup(Path::new(&path), Path::new(database))?;

            println!("restored {database} from {path}");
            println!("  created at:     {}", metadata.created_at);
            println!("  schema version: {}", metadata.schema_version);
        }
        _ => {
            let store = Store::open(&path)?;

            match command {
                "info" => {
                    println!("database:       {path}");
                    println!("schema version: {}", store.schema_version()?);
                    println!("contacts:       {}", store.contact_count()?);
                    println!("products:       {}", store.product_count()?);
                    println!("invoices:       {}", store.invoice_count()?);
                    println!("users:          {}", store.user_count()?);
                }
                "contacts" => {
                    for contact in store.list_contacts()? {
                        println!("{}\t{}", contact.id, contact.display_name());
                    }
                }
                "products" => {
                    let currency = store.company_profile()?.currency;
                    for product in store.list_products()? {
                        println!(
                            "{}\t{}\t{}\t{}",
                            product.sku,
                            product.name,
                            product.stock,
                            product.price.format_localized(&currency)
                        );
                    }
                }
                other => {
                    eprintln!("unknown command: {other}");
                    eprintln!(
                        "usage: socdof-cli <info|contacts|products|backup|restore|legacy-import|legacy-export> [database] [path]"
                    );
                    return Err("invalid arguments".into());
                }
            }
        }
    }

    Ok(())
}
