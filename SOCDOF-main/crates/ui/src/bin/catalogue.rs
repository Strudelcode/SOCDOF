//! Writes the committed catalogue key inventory.
//!
//! `crates/ui/locales/catalogue-keys.json` is the reviewable copy of `UI_KEYS`. The catalogue test
//! fails when a key is added or removed without regenerating it, so no key can disappear unnoticed.

fn main() -> std::process::ExitCode {
    let target = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "crates/ui/locales/catalogue-keys.json".to_string());
    let mut keys: Vec<&str> = socdof_ui::i18n::UI_KEYS.to_vec();
    keys.sort_unstable();
    keys.dedup();
    let document = match serde_json::to_string_pretty(&keys) {
        Ok(document) => document,
        Err(error) => {
            eprintln!("error: {error}");
            return std::process::ExitCode::FAILURE;
        }
    };
    if let Err(error) = std::fs::write(&target, format!("{document}\n")) {
        eprintln!("error: {error}");
        return std::process::ExitCode::FAILURE;
    }
    println!("{} keys written to {target}", keys.len());
    std::process::ExitCode::SUCCESS
}
