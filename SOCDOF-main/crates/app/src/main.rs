//! SOCDOF desktop application.
//!
//! This binary runs the application shell headlessly. The Tauri window layer is added once the
//! build environment provides WebKitGTK (see `docs/architecture.md`); until then this is the real
//! start path and the smoke test exercises it.

use std::path::PathBuf;
use std::process::ExitCode;

use socdof_app::shell::{Paths, Shell};

const USAGE: &str =
    "usage: socdof-app --database <file> [--restore <archive>] [--backup <archive>] \
                     [--export-invoice <number> <pdf>]";

struct Options {
    database: PathBuf,
    restore: Option<PathBuf>,
    backup: Option<PathBuf>,
    export_invoice: Option<(String, PathBuf)>,
}

fn main() -> ExitCode {
    if std::env::args()
        .skip(1)
        .any(|argument| argument == "--help" || argument == "-h")
    {
        println!("{USAGE}");
        return ExitCode::SUCCESS;
    }

    let options = match parse_arguments() {
        Ok(options) => options,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    match run(options) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("SOCDOF could not start: {error}");
            ExitCode::FAILURE
        }
    }
}

fn parse_arguments() -> Result<Options, String> {
    let mut database = None;
    let mut restore = None;
    let mut backup = None;
    let mut export_invoice = None;
    let mut args = std::env::args().skip(1);

    while let Some(argument) = args.next() {
        match argument.as_str() {
            "--database" => database = Some(PathBuf::from(next_value(&mut args, "--database")?)),
            "--restore" => restore = Some(PathBuf::from(next_value(&mut args, "--restore")?)),
            "--backup" => backup = Some(PathBuf::from(next_value(&mut args, "--backup")?)),
            "--export-invoice" => {
                let number = next_value(&mut args, "--export-invoice")?;
                let path = next_value(&mut args, "--export-invoice")?;
                export_invoice = Some((number, PathBuf::from(path)));
            }
            other => return Err(format!("unknown argument: {other}\n{USAGE}")),
        }
    }

    let database = database.ok_or_else(|| USAGE.to_string())?;

    Ok(Options {
        database,
        restore,
        backup,
        export_invoice,
    })
}

fn next_value(args: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, String> {
    args.next().ok_or_else(|| format!("{flag} needs a value"))
}

fn run(options: Options) -> Result<(), Box<dyn std::error::Error>> {
    let paths = Paths::new(options.database.clone());
    let mut shell = Shell::start(paths)?;
    print_status(&shell)?;

    if let Some(archive) = &options.restore {
        let metadata = shell.restore(archive)?;
        println!(
            "restored {} (created at {})",
            archive.display(),
            metadata.created_at
        );
    }

    if let Some(archive) = &options.backup {
        let info = shell.backup(archive)?;
        println!(
            "backup written {} ({} bytes)",
            archive.display(),
            info.archive_bytes
        );
    }

    if let Some((number, path)) = &options.export_invoice {
        shell.export_invoice_pdf(number, path)?;
        println!("invoice {number} exported to {}", path.display());
    }

    print_status(&shell)?;
    shell.heartbeat()?;
    shell.shutdown();

    Ok(())
}

fn print_status(shell: &Shell) -> Result<(), Box<dyn std::error::Error>> {
    let status = shell.status()?;
    let owner = status
        .lock_owner_pid
        .map_or_else(|| "-".to_string(), |pid| pid.to_string());

    println!("SOCDOF shell ready");
    println!("  database:       {}", status.database.display());
    println!("  schema version: {}", status.schema_version);
    println!("  contacts:       {}", status.contacts);
    println!("  products:       {}", status.products);
    println!("  invoices:       {}", status.invoices);
    println!("  users:          {}", status.users);
    println!("  lock owner pid: {owner}");

    Ok(())
}
