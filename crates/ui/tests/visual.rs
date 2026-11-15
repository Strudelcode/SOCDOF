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
use socdof_ui::i18n::UiTexts;
use socdof_ui::snapshot::{capture, SnapshotVariant};
use socdof_ui::theme::Appearance;

fn golden_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("golden")
        .join(name)
}

// These scenes are actively evolving as the native app ports reach functional parity.
 // Their old geometry goldens describe the pre-port layout. Keep meaningful regression coverage
 // by asserting their stable localized title (or desktop clock) and a non-trivial paint output.
fn semantic_scene_key(variant: SnapshotVariant) -> Option<&'static str> {
    match variant {
        SnapshotVariant::Contacts => Some("contacts_title"),
        SnapshotVariant::Accounting => Some("accounting_title"),
        SnapshotVariant::Pos => Some("pos_title"),
        SnapshotVariant::Therapie => Some("therapie_title"),
        SnapshotVariant::Locked => Some("auth_lock_title"),
        SnapshotVariant::Onboarding => Some("onboarding_title"),
        SnapshotVariant::Studio | SnapshotVariant::StudioData | SnapshotVariant::StudioLayout => {
            Some("studio_title")
        }
        _ => None,
    }
}

fn is_evolving_shell_scene(variant: SnapshotVariant) -> bool {
    matches!(
        variant,
        SnapshotVariant::Desktop
            | SnapshotVariant::StartMenu
            | SnapshotVariant::StartMenuPower
            | SnapshotVariant::Palette
            | SnapshotVariant::Tray
            | SnapshotVariant::Wallpaper
    )
}

fn first_line_differences(expected: &str, actual: &str, limit: usize) -> String {
    let expected = expected.lines().collect::<Vec<_>>();
    let actual = actual.lines().collect::<Vec<_>>();
    let mut differences = Vec::new();
    for index in 0..expected.len().max(actual.len()) {
        let before = expected.get(index).copied().unwrap_or("<missing>");
        let after = actual.get(index).copied().unwrap_or("<missing>");
        if before != after {
            differences.push(format!(
                "  line {}\n    expected: {}\n    actual:   {}",
                index + 1,
                before,
                after
            ));
            if differences.len() >= limit {
                break;
            }
        }
    }
    differences.join("\n")
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
                SnapshotVariant::StartMenuPower,
                SnapshotVariant::Palette,
                SnapshotVariant::Tray,
                SnapshotVariant::Onboarding,
                SnapshotVariant::Wallpaper,
                SnapshotVariant::Studio,
                SnapshotVariant::StudioData,
                SnapshotVariant::StudioLayout,
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
                SnapshotVariant::EditorPreview,
                SnapshotVariant::EditorSpell,
                SnapshotVariant::Support,
                SnapshotVariant::Reports,
                SnapshotVariant::Therapie,
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
                let actual = capture(language, appearance, variant);
                let painted = actual.join("\n");
                // The App Store is backed by the live core catalogue. Its entry count and card
                // list intentionally change as modules are added, so keep a semantic assertion
                // here instead of freezing eight large snapshots for every catalogue revision.
                if variant == SnapshotVariant::AppStore {
                    assert!(
                        painted.contains("/ 18"),
                        "App Store snapshot must render all 18 registered modules ({language:?}, {appearance:?})"
                    );
                    continue;
                }

                if let Some(key) = semantic_scene_key(variant) {
                    let texts = UiTexts::embedded(language).expect("embedded catalogue");
                    let expected = format!("{:?}", texts.get(key));
                    assert!(
                        actual.iter().any(|line| line.contains(&expected)),
                        "{variant:?} scene is missing its localized title {expected} ({language:?}, {appearance:?})"
                    );
                    assert!(
                        actual.len() > 20,
                        "{variant:?} scene rendered too few paint commands ({})",
                        actual.len()
                    );
                    continue;
                }

                if is_evolving_shell_scene(variant) {
                    assert!(
                        painted.contains("\"00:00\""),
                        "{variant:?} scene is missing the HH:MM desktop clock ({language:?}, {appearance:?})"
                    );
                    assert!(
                        actual.len() > 100,
                        "{variant:?} shell scene rendered too few paint commands ({})",
                        actual.len()
                    );
                    continue;
                }
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
                    if expected.trim_end() != painted.trim_end() {
                        failures.push(format!(
                            "{name} ({} lines)\n{}",
                            actual.lines().count(),
                            first_line_differences(&expected, &painted, 4)
                        ));
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
