//! Command line access to the SOCDOF core.
//!
//! Used for tooling, data import checks, backups and fast verification without starting a window.

use std::path::Path;
use std::process::ExitCode;

use socdof_core::autosave;
use socdof_core::backup;
use socdof_core::backup_scheduler::{self, BackupSchedule};
use socdof_core::csv;
use socdof_core::domain::settings::Language;
use socdof_core::i18n;
use socdof_core::legacy;
use socdof_core::logging::Logger;
use socdof_core::now_millis;
use socdof_core::settings_service;
use socdof_core::store::Store;

const USAGE: &str = "usage: socdof-cli <command> [arguments]\n\
\n\
  info|contacts|products <database>\n\
  settings <database>\n\
  backup <database> <archive>\n\
  restore <archive> <database>\n\
  backup-if-due <database> <directory> [interval_minutes] [keep]\n\
  autosave <database> <directory> [keep]\n\
  legacy-import <database> <backup.json>\n\
  legacy-export <database> <backup.json>\n\
  contacts-csv-export <database> <file.csv>\n\
  contacts-csv-import <database> <file.csv>\n\
  products-csv-export <database> <file.csv>\n\
  products-csv-import <database> <file.csv>\n\
  i18n\n\
  i18n-pack <de|en|fr|es> <pack.json>\n\
  log <directory> <message>";

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
        "autosave" => {
            let directory = args
                .get(1)
                .ok_or("usage: socdof-cli autosave <database> <directory> [keep]")?;
            let keep = match args.get(2) {
                Some(value) => value.parse::<usize>()?,
                None => autosave::DEFAULT_KEEP,
            };

            let store = Store::open(&path)?;
            let info = autosave::write_snapshot(
                &store,
                Path::new(directory),
                env!("CARGO_PKG_VERSION"),
                now_millis(),
                keep,
            )?;

            println!("snapshot written: {}", info.path.display());
            println!("  created at: {}", info.created_at);
            println!("  bytes:      {}", info.bytes);
            for snapshot in autosave::list_snapshots(Path::new(directory))? {
                println!("  kept: {}", snapshot.path.display());
            }
        }
        "backup-if-due" => {
            let directory = args.get(1).ok_or(
                "usage: socdof-cli backup-if-due <database> <directory> [interval_minutes] [keep]",
            )?;
            let interval_minutes = match args.get(2) {
                Some(value) => value.parse::<i64>()?,
                None => 120,
            };
            let keep = match args.get(3) {
                Some(value) => value.parse::<i64>()?,
                None => 10,
            };

            let store = Store::open(&path)?;
            let folder = Path::new(directory);
            let schedule = BackupSchedule {
                enabled: true,
                folder: folder.to_path_buf(),
                interval_minutes,
                keep,
            };
            let last = backup_scheduler::last_backup_at(folder)?;

            match backup_scheduler::run_if_due(
                &store,
                &schedule,
                last,
                env!("CARGO_PKG_VERSION"),
                now_millis(),
            )? {
                Some(written) => {
                    println!("backup written: {}", written.path.display());
                    println!("  archive bytes: {}", written.archive_bytes);
                    println!("  pruned:        {}", written.pruned);
                }
                None => println!("no backup due (last backup: {last:?})"),
            }
        }
        "settings" => {
            let store = Store::open(&path)?;
            let profile = settings_service::company_profile(&store)?;
            println!("company:       {}", profile.name);
            println!("street:        {}", profile.street);
            println!("zip / city:    {}", profile.zip_city);
            println!("country:       {}", profile.country);
            println!("email:         {}", profile.email);
            println!("phone:         {}", profile.phone);
            println!("tax id:        {}", profile.tax_id);
            println!("currency:      {}", profile.currency);
            println!("language:      {}", profile.language.as_str());
            println!("theme:         {:?}", profile.theme_mode);
            println!("backup folder: {}", profile.backup_folder_path);
            println!("backup every:  {} min", profile.backup_interval_minutes);
            println!("backup keep:   {}", profile.backup_max_keep_count);
        }
        "contacts-csv-export" => {
            let file = args
                .get(1)
                .ok_or("usage: socdof-cli contacts-csv-export <database> <file.csv>")?;
            let store = Store::open(&path)?;
            let rows = csv::export_contacts_csv(&store, Path::new(file))?;
            println!("contacts exported: {rows} rows -> {file}");
        }
        "contacts-csv-import" => {
            let file = args
                .get(1)
                .ok_or("usage: socdof-cli contacts-csv-import <database> <file.csv>")?;
            let store = Store::open(&path)?;
            let report = csv::import_contacts_csv(&store, Path::new(file))?;
            println!("contacts imported: {}", report.imported);
            println!("  skipped: {}", report.skipped);
            for error in &report.errors {
                println!("  {error}");
            }
        }
        "products-csv-export" => {
            let file = args
                .get(1)
                .ok_or("usage: socdof-cli products-csv-export <database> <file.csv>")?;
            let store = Store::open(&path)?;
            let rows = csv::export_products_csv(&store, Path::new(file))?;
            println!("products exported: {rows} rows -> {file}");
        }
        "products-csv-import" => {
            let file = args
                .get(1)
                .ok_or("usage: socdof-cli products-csv-import <database> <file.csv>")?;
            let store = Store::open(&path)?;
            let report = csv::import_products_csv(&store, Path::new(file))?;
            println!("products imported: {}", report.imported);
            println!("  skipped: {}", report.skipped);
            for error in &report.errors {
                println!("  {error}");
            }
        }
        "i18n" => {
            for (language, missing) in i18n::coverage()? {
                let catalog = i18n::Catalog::embedded(language)?;
                println!(
                    "{}: {} keys, {} missing",
                    language.as_str(),
                    catalog.len(),
                    missing.len()
                );
                for key in missing {
                    println!("  missing: {key}");
                }
            }
        }
        "i18n-pack" => {
            let language = args
                .first()
                .and_then(|value| Language::from_storage(value))
                .ok_or("usage: socdof-cli i18n-pack <de|en|fr|es> <pack.json>")?;
            let pack = args
                .get(1)
                .ok_or("usage: socdof-cli i18n-pack <de|en|fr|es> <pack.json>")?;

            let report = i18n::validate_pack(language, pack)?;
            println!("pack: {pack} ({})", language.as_str());
            println!("  missing keys: {}", report.missing.len());
            for key in &report.missing {
                println!("    {key}");
            }
            println!("  unknown keys: {}", report.unknown.len());
            for key in &report.unknown {
                println!("    {key}");
            }
        }
        "log" => {
            let message = args.get(1).map(String::as_str).unwrap_or("cli");
            let logger = Logger::new(Path::new(&path))?;
            logger.info(message, now_millis())?;
            println!("log written: {}", logger.path().display());
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
                    eprintln!("{USAGE}");
                    return Err("invalid arguments".into());
                }
            }
        }
    }

    Ok(())
}
