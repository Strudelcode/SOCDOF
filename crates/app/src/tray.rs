//! System tray menu: ids, order, labels and the command behind each entry.
//!
//! The window layer builds the platform tray from this model and performs only the command the entry
//! returns, so nothing about the menu is decided in `src-tauri` and the whole decision path runs
//! without GTK. The menu offers exactly the three actions the desktop shell can really perform —
//! show the main window, write a backup through `socdof_app::desktop::DesktopState`, quit — and no
//! entry that would need a click the shell cannot serve. Labels come from the embedded core
//! catalogue in German, English, French and Spanish, chosen by the desktop locale.

use socdof_core::domain::settings::Language;
use socdof_core::i18n::Translator;

/// Action behind a tray entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayCommand {
    /// Show and focus the main window.
    ShowWindow,
    /// Write a consistent backup next to the database.
    CreateBackup,
    /// Close the application.
    Quit,
}

impl TrayCommand {
    /// Stable name used in the `SOCDOF_TRAY` markers.
    pub fn as_str(self) -> &'static str {
        match self {
            TrayCommand::ShowWindow => "show_window",
            TrayCommand::CreateBackup => "create_backup",
            TrayCommand::Quit => "quit",
        }
    }
}

/// One entry of the tray menu. A separator carries no label and no command.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TrayEntry {
    /// Stable menu id the platform reports back when the entry is activated.
    pub id: &'static str,
    /// Catalogue key of the label; empty for a separator.
    pub label_key: &'static str,
    /// Action of the entry.
    pub command: Option<TrayCommand>,
}

/// Id of the entry that shows the window; a left click on the icon uses it as well.
pub const SHOW_ID: &str = "show";

/// The tray menu in reading order: the window action first, the application exit last.
pub const MENU: [TrayEntry; 5] = [
    TrayEntry {
        id: SHOW_ID,
        label_key: "tray_show_window",
        command: Some(TrayCommand::ShowWindow),
    },
    TrayEntry {
        id: "separator-window",
        label_key: "",
        command: None,
    },
    TrayEntry {
        id: "backup",
        label_key: "tray_create_backup",
        command: Some(TrayCommand::CreateBackup),
    },
    TrayEntry {
        id: "separator-quit",
        label_key: "",
        command: None,
    },
    TrayEntry {
        id: "quit",
        label_key: "tray_quit",
        command: Some(TrayCommand::Quit),
    },
];

/// The tray menu, for a caller that wants to iterate it.
pub fn menu() -> &'static [TrayEntry] {
    &MENU
}

/// Entry and command used by a left click on the tray icon.
///
/// The platform window layer maps only a completed left-button click to this pair; the menu event
/// and the icon click therefore both end in `TrayCommand::ShowWindow`.
pub fn icon_click() -> (&'static str, TrayCommand) {
    (SHOW_ID, TrayCommand::ShowWindow)
}

/// Command behind a menu id. Unknown ids and separators return `None`.
pub fn command_for(id: &str) -> Option<TrayCommand> {
    MENU.iter()
        .find(|entry| entry.id == id)
        .and_then(|entry| entry.command)
}

/// Language of a POSIX locale such as `de_DE.UTF-8` or `fr-CA`; anything else is English.
fn language_from_locale(locale: &str) -> Language {
    let code = locale.split(['_', '-', '.']).next().unwrap_or_default();
    match code.to_ascii_lowercase().as_str() {
        "de" => Language::De,
        "fr" => Language::Fr,
        "es" => Language::Es,
        _ => Language::En,
    }
}

/// Catalogue text of `key`. A missing catalogue cannot leave the tray without a label, so the key
/// itself is returned and stays visible instead of rendering an empty entry.
fn text(language: Language, key: &str) -> String {
    match Translator::new(language) {
        Ok(translator) => translator.translate(key),
        Err(_) => key.to_string(),
    }
}

/// Label of one catalogue key in the language of `locale`.
pub fn label_for_locale(locale: &str, key: &str) -> String {
    text(language_from_locale(locale), key)
}

/// Tooltip of the tray icon in the language of `locale`.
pub fn tooltip_for_locale(locale: &str) -> String {
    label_for_locale(locale, "tray_tooltip")
}

/// The labeled menu entries of a locale, separators omitted, in menu order.
pub fn labeled_menu_for_locale(locale: &str) -> Vec<(&'static TrayEntry, String)> {
    let language = language_from_locale(locale);
    MENU.iter()
        .filter(|entry| entry.command.is_some())
        .map(|entry| (entry, text(language, entry.label_key)))
        .collect()
}

/// Every label of every embedded language as `(language code, menu id, label)`, for the smoke run.
pub fn label_dump() -> Vec<(&'static str, &'static str, String)> {
    let mut dump = Vec::new();
    for language in [Language::De, Language::En, Language::Fr, Language::Es] {
        for entry in MENU.iter().filter(|entry| entry.command.is_some()) {
            dump.push((language.as_str(), entry.id, text(language, entry.label_key)));
        }
    }
    dump
}

/// Smoke marker of an activated entry, e.g. `SOCDOF_TRAY item=backup action=create_backup`.
pub fn marker(entry_id: &str, command: TrayCommand) -> String {
    format!("SOCDOF_TRAY item={entry_id} action={}", command.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_menu_has_one_entry_per_action_in_reading_order() {
        let ids: Vec<&str> = MENU.iter().map(|entry| entry.id).collect();
        assert_eq!(
            ids,
            [
                "show",
                "separator-window",
                "backup",
                "separator-quit",
                "quit"
            ]
        );
        let commands: Vec<TrayCommand> = MENU.iter().filter_map(|entry| entry.command).collect();
        assert_eq!(
            commands,
            [
                TrayCommand::ShowWindow,
                TrayCommand::CreateBackup,
                TrayCommand::Quit
            ]
        );
        let separators = MENU.iter().filter(|entry| entry.command.is_none()).count();
        assert_eq!(separators, 2, "only separators may be without a command");
    }

    #[test]
    fn every_id_resolves_to_its_own_command_and_unknown_ids_do_nothing() {
        for entry in MENU.iter() {
            assert_eq!(command_for(entry.id), entry.command, "id {}", entry.id);
        }
        assert_eq!(command_for("no-such-entry"), None);
        assert_eq!(command_for(""), None);
        assert_eq!(command_for("separator-window"), None);
    }

    #[test]
    fn the_locale_selects_the_catalogue_language() {
        let german = labeled_menu_for_locale("de_DE.UTF-8");
        assert_eq!(german[0].1, "Fenster anzeigen");
        assert_eq!(labeled_menu_for_locale("fr-CA")[0].1, "Afficher la fenêtre");
        assert_eq!(
            labeled_menu_for_locale("es_ES.UTF-8")[0].1,
            "Mostrar ventana"
        );
        assert_eq!(labeled_menu_for_locale("en_GB.UTF-8")[0].1, "Show window");
        assert_eq!(labeled_menu_for_locale("it_IT")[0].1, "Show window");
        assert_eq!(labeled_menu_for_locale("")[0].1, "Show window");
    }

    #[test]
    fn every_label_comes_from_the_catalogue_in_all_four_languages() {
        let dump = label_dump();
        assert_eq!(dump.len(), 4 * 3, "four languages, three labeled entries");
        for (language, id, label) in dump {
            let key = MENU
                .iter()
                .find(|entry| entry.id == id)
                .map(|entry| entry.label_key)
                .expect("menu id");
            assert!(!label.is_empty(), "{language} {id} is empty");
            assert_ne!(label, key, "{language} {id} returned the key");
            assert_ne!(label, "", "{language} {id} is blank");
        }
    }

    #[test]
    fn the_tooltip_is_localized_and_never_the_key() {
        assert_eq!(tooltip_for_locale("de_DE.UTF-8"), "SOCDOF — Schnellzugriff");
        assert_eq!(tooltip_for_locale("en_US.UTF-8"), "SOCDOF — quick access");
        assert_ne!(tooltip_for_locale("fr_FR.UTF-8"), "tray_tooltip");
        assert_ne!(tooltip_for_locale("es_ES.UTF-8"), "tray_tooltip");
    }

    #[test]
    fn a_left_click_on_the_icon_uses_the_show_command() {
        let (id, command) = icon_click();
        assert_eq!(id, SHOW_ID);
        assert_eq!(command, TrayCommand::ShowWindow);
        assert_eq!(
            marker(id, command),
            "SOCDOF_TRAY item=show action=show_window"
        );
    }

    #[test]
    fn the_labeled_menu_skips_separators_and_markers_are_stable() {
        let labeled = labeled_menu_for_locale("en_US.UTF-8");
        let ids: Vec<&str> = labeled.iter().map(|(entry, _)| entry.id).collect();
        assert_eq!(ids, ["show", "backup", "quit"]);
        assert_eq!(
            marker("backup", TrayCommand::CreateBackup),
            "SOCDOF_TRAY item=backup action=create_backup"
        );
        assert_eq!(
            marker(SHOW_ID, TrayCommand::ShowWindow),
            "SOCDOF_TRAY item=show action=show_window"
        );
        assert_eq!(TrayCommand::Quit.as_str(), "quit");
    }
}
