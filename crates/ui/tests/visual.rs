//! Visual regression for the primitives without a display.
//!
//! Every appearance, language and scene variant is captured as stable text lines (see
//! `socdof_ui::snapshot`) and compared with a golden file. Run with `UPDATE_SNAPSHOTS=1` to rewrite
//! the goldens after an intended visual change:
//!
//! ```text
//! UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual
//! ```

use std::fs;
use std::path::PathBuf;

use socdof_core::domain::settings::Language;
use socdof_ui::snapshot::{capture, SnapshotVariant};
use socdof_ui::theme::Appearance;

fn golden_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("golden")
        .join(name)
}

#[test]
fn primitives_match_the_golden_files() {
    let mut failures = Vec::new();
    for language in [Language::De, Language::En, Language::Fr, Language::Es] {
        for appearance in [Appearance::Light, Appearance::Dark] {
            for variant in [
                SnapshotVariant::Idle,
                SnapshotVariant::Focused,
                SnapshotVariant::Drawer,
                SnapshotVariant::Desktop,
                SnapshotVariant::StartMenu,
                SnapshotVariant::Palette,
                SnapshotVariant::Tray,
                SnapshotVariant::Onboarding,
                SnapshotVariant::Wallpaper,
                SnapshotVariant::Dashboard,
                SnapshotVariant::Contacts,
                SnapshotVariant::Products,
                SnapshotVariant::Invoices,
                SnapshotVariant::Accounting,
                SnapshotVariant::Purchases,
                SnapshotVariant::Pos,
                SnapshotVariant::Calendar,
                SnapshotVariant::Settings,
                SnapshotVariant::Users,
                SnapshotVariant::AppStore,
                SnapshotVariant::Editor,
                SnapshotVariant::Login,
                SnapshotVariant::Locked,
                SnapshotVariant::Setup,
                SnapshotVariant::Unlocked,
            ] {
                let name = format!(
                    "{}-{}-{:?}.txt",
                    match appearance {
                        Appearance::Light => "light",
                        Appearance::Dark => "dark",
                    },
                    language.as_str(),
                    variant
                )
                .to_lowercase();
                let actual = capture(language, appearance, variant).join("\n");
                let path = golden_path(&name);
                if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
                    if let Some(parent) = path.parent() {
                        fs::create_dir_all(parent).expect("golden directory");
                    }
                    fs::write(&path, format!("{actual}\n")).expect("write golden");
                } else {
                    let expected = fs::read_to_string(&path).unwrap_or_else(|_| {
                        panic!(
                            "missing golden {name}; run UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual"
                        )
                    });
                    if expected.trim_end() != actual.trim_end() {
                        failures.push(format!("{name} ({} lines)", actual.lines().count()));
                    }
                }
            }
        }
    }
    assert!(
        failures.is_empty(),
        "golden mismatch: {}\nrun UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual",
        failures.join(", ")
    );
}
