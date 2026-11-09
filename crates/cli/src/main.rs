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
use socdof_core::i18n_legacy;
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
  backups <directory>\n\
  backup-if-due <database> <directory> [interval_minutes] [keep]\n\
  autosave <database> <directory> [keep]\n\
  legacy-import <database> <backup.json>\n\
  legacy-export <database> <backup.json>\n\
  contacts-csv-export <database> <file.csv>\n\
  contacts-csv-import <database> <file.csv>\n\
  products-csv-export <database> <file.csv>\n\
  products-csv-import <database> <file.csv>\n\
  locales <src/lib/i18n.ts> <report.json>\n\
  i18n\n\
  i18n-pack <de|en|fr|es> <pack.json>\n\
  log <directory> <message>\n\
  qr <text> [L|M|Q|H] [label.pdf]\n\
  invoice-docx <database> <number> <out.docx>";

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

            // A `.socdof.json` target is the document the TypeScript application restores; every
            // other name writes the native container.
            if backup::is_legacy_path(Path::new(archive)) {
                let report = legacy::export(&store, Path::new(archive))?;
                println!("legacy backup written: {archive}");
                println!("  bytes:    {}", report.bytes);
                println!("  contacts: {}", report.contacts);
                println!("  products: {}", report.products);
                println!("  invoices: {}", report.invoices);
            } else {
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
        }
        "restore" => {
            let database = args
                .get(1)
                .ok_or("usage: socdof-cli restore <archive> <database>")?;

            match backup::restore_archive(Path::new(&path), Path::new(database))? {
                backup::Restore::Container(metadata) => {
                    println!("restored {database} from {path} (container)");
                    println!("  created at:     {}", metadata.created_at);
                    println!("  schema version: {}", metadata.schema_version);
                    println!("  app version:    {}", metadata.app_version);
                }
                backup::Restore::Legacy { metadata, report } => {
                    println!("restored {database} from {path} (legacy-json)");
                    println!("  document version:   {}", metadata.document_version);
                    println!("  created at:         {}", metadata.created_at);
                    println!("  owner:              {}", metadata.owner);
                    println!("  contacts imported:  {}", report.contacts);
                    println!("  products imported:  {}", report.products);
                    println!("  invoices preserved: {}", report.invoices);
                }
            }
        }
        "backups" => {
            let directory = args
                .first()
                .ok_or("usage: socdof-cli backups <directory>")?;
            let archives = backup::list_archives(Path::new(directory))?;
            if archives.is_empty() {
                println!("no archives in {directory}");
            }
            for archive in archives {
                println!(
                    "{}\t{}\t{} bytes\tcreated {}",
                    archive.path().display(),
                    archive.kind().as_str(),
                    archive.archive_bytes(),
                    socdof_core::date::format_date(archive.created_at())
                );
            }
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
        "locales" => {
            let source = args
                .first()
                .ok_or("usage: socdof-cli locales <src/lib/i18n.ts> <report.json>")?;
            let target = args.get(1).ok_or(
                "usage: socdof-cli locales <src/lib/i18n.ts> <report.json> [catalogue-dir]",
            )?;
            let directory = args
                .get(2)
                .map(String::as_str)
                .unwrap_or("crates/ui/locales");
            let raw = std::fs::read_to_string(source)?;
            let legacy = i18n_legacy::parse_translations(&raw);
            let mut languages = serde_json::Map::new();
            for language in i18n::EMBEDDED_LANGUAGES {
                let texts = legacy.get(language.as_str()).cloned().unwrap_or_default();
                let file = Path::new(directory).join(format!("{}.json", language.as_str()));
                let catalog = if file.exists() {
                    i18n::Catalog::from_file(language, &file)?
                } else {
                    i18n::Catalog::embedded(language)?
                };
                let report = i18n_legacy::coverage(language, &texts, &catalog);
                println!(
                    "{}: {}/{} legacy texts present ({:.1} %)",
                    language.as_str(),
                    report.matched,
                    report.total,
                    report.percent()
                );
                let modules: serde_json::Map<String, serde_json::Value> = report
                    .modules
                    .iter()
                    .map(|(module, (matched, total))| {
                        (
                            module.clone(),
                            serde_json::json!({ "matched": matched, "total": total }),
                        )
                    })
                    .collect();
                languages.insert(
                    language.as_str().to_owned(),
                    serde_json::json!({
                        "total": report.total,
                        "matched": report.matched,
                        "percent": (report.percent() * 10.0).round() / 10.0,
                        "modules": modules,
                    }),
                );
            }
            let document = serde_json::json!({
                "source": source,
                "catalogue": directory,
                "languages": languages,
            });
            std::fs::write(
                target,
                format!("{}\n", serde_json::to_string_pretty(&document)?),
            )?;
            println!("report: {target}");
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
        "qr" => {
            use socdof_core::barcode::qr::{qr as encode, EcLevel};
            use socdof_core::pdf::writer::{mm, Document};

            let text = args
                .first()
                .ok_or("usage: socdof-cli qr <text> [L|M|Q|H] [label.pdf]")?;
            let level = EcLevel::from_label(args.get(1).map(String::as_str).unwrap_or("M"))
                .ok_or("unknown error correction level, expected L, M, Q or H")?;
            let code = encode(text, level)?;
            match args.get(2) {
                None => {
                    for row in code.rows() {
                        println!("{row}");
                    }
                }
                Some(target) => {
                    let mut document = Document::new("QR code");
                    {
                        let page = document.page_mut();
                        page.text(mm(20.0), mm(287.0), 11.0, "QR code");
                        page.qr(mm(20.0), mm(237.0), mm(40.0), &code);
                        let caption: String = if text.chars().count() > 70 {
                            text.chars().take(70).chain(['…']).collect()
                        } else {
                            text.clone()
                        };
                        page.text(mm(20.0), mm(228.0), 9.0, &caption);
                        page.text(
                            mm(20.0),
                            mm(222.0),
                            9.0,
                            &format!(
                                "Version {} · Level {} · Maske {} · {} × {} Module",
                                code.version(),
                                code.level().label(),
                                code.mask(),
                                code.size(),
                                code.size()
                            ),
                        );
                    }
                    std::fs::write(target, document.to_bytes())?;
                    println!("qr written: {target}");
                }
            }
        }
        "invoice-docx" => {
            const USAGE: &str = "usage: socdof-cli invoice-docx <database> <number> <out.docx>";
            let database = args.first().ok_or(USAGE)?;
            let number = args.get(1).ok_or(USAGE)?;
            let target = args.get(2).ok_or(USAGE)?;
            let store = Store::open(Path::new(database))?;
            let invoice = store
                .list_invoices()?
                .into_iter()
                .find(|invoice| invoice.number == *number)
                .ok_or_else(|| format!("invoice {number} not found"))?;
            let contact = store
                .find_contact(invoice.contact_id)?
                .ok_or_else(|| format!("contact {} not found", invoice.contact_id))?;
            let company = store.company_profile()?;
            socdof_core::docx::write_invoice_docx(Path::new(target), &invoice, &contact, &company)?;
            println!("docx written: {target}");
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
