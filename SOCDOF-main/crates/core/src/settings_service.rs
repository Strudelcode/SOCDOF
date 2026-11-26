//! Settings service: company profile and per-user preferences.
//!
//! The store keeps the profile as one JSON value and every user's preferences under its own key.
//! This module is the only place that validates and normalises those values, so the UI, the CLI and
//! later the mobile companion all get the same rules.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::settings::{CompanyProfile, Language, ThemeMode};
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// Prefix of the per-user preference keys in the settings table.
pub const PREFERENCES_PREFIX: &str = "user_preferences:";

/// Key of the update policy.
pub const UPDATE_SETTINGS_KEY: &str = "update_settings";

/// Key of the portable-mode configuration.
pub const PORTABLE_SETTINGS_KEY: &str = "portable_settings";

/// Release channel the update policy watches.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    /// Stable releases only.
    #[default]
    Stable,
    /// Stable and beta releases.
    Beta,
}

/// Persisted update policy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct UpdateSettings {
    /// Release channel.
    pub channel: UpdateChannel,
    /// Whether the application checks for updates on start.
    pub check_on_start: bool,
    /// Whether a found update is downloaded automatically.
    pub automatic_download: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        UpdateSettings {
            channel: UpdateChannel::Stable,
            check_on_start: true,
            automatic_download: false,
        }
    }
}

impl UpdateSettings {
    /// Validates the policy; automatic downloads require a start-up check.
    pub fn validate(&self) -> Result<(), String> {
        if self.automatic_download && !self.check_on_start {
            return Err("update_check_required".to_string());
        }
        Ok(())
    }
}

/// Persisted portable-mode configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
#[derive(Default)]
pub struct PortableSettings {
    /// Whether portable mode is enabled.
    pub enabled: bool,
    /// Folder that holds database and backups in portable mode.
    pub data_folder: String,
}

impl PortableSettings {
    /// Validates the configuration; an enabled mode needs a data folder.
    pub fn validate(&self) -> Result<(), String> {
        if self.enabled && self.data_folder.trim().is_empty() {
            return Err("portable_folder_required".to_string());
        }
        Ok(())
    }
}

/// Personal appearance and start-up preferences of one user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Preferences {
    /// Interface language.
    pub language: Language,
    /// Light, dark or system.
    pub theme_mode: ThemeMode,
    /// Accent color identifier or hex value.
    pub accent_color: String,
    /// Whether the sidebar is collapsed.
    pub sidebar_collapsed: bool,
    /// Module shown after sign-in, empty for the dashboard.
    pub startup_module: String,
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences {
            language: Language::default(),
            theme_mode: ThemeMode::default(),
            accent_color: "indigo".to_string(),
            sidebar_collapsed: false,
            startup_module: String::new(),
        }
    }
}

impl Preferences {
    /// Defaults taken from the company profile, used before a user changed anything.
    pub fn from_profile(profile: &CompanyProfile) -> Self {
        Preferences {
            language: profile.language,
            theme_mode: profile.theme_mode,
            accent_color: profile.accent_color.clone(),
            ..Preferences::default()
        }
    }

    /// Validates the preference values.
    pub fn validate(&self) -> Result<(), String> {
        if self.accent_color.trim().is_empty() {
            return Err("accent_required".to_string());
        }
        if self.startup_module.chars().any(char::is_whitespace) {
            return Err("startup_module_invalid".to_string());
        }
        Ok(())
    }
}

fn preferences_key(user_id: Uuid) -> String {
    format!("{PREFERENCES_PREFIX}{user_id}")
}

/// Loads the company profile (defaults when nothing was saved yet).
pub fn company_profile(store: &Store) -> CoreResult<CompanyProfile> {
    store.company_profile()
}

/// Normalises and validates a company profile, then stores it.
pub fn save_company_profile(store: &Store, profile: &CompanyProfile) -> CoreResult<()> {
    let mut normalized = profile.clone();
    normalize_profile(&mut normalized);
    normalized.validate().map_err(CoreError::Validation)?;
    store.save_company_profile(&normalized)
}

/// Trims the text fields of a profile so stored values compare cleanly.
pub fn normalize_profile(profile: &mut CompanyProfile) {
    for value in [
        &mut profile.name,
        &mut profile.street,
        &mut profile.zip_city,
        &mut profile.country,
        &mut profile.email,
        &mut profile.phone,
        &mut profile.tax_id,
        &mut profile.backup_folder_path,
    ] {
        *value = value.trim().to_string();
    }

    if profile.currency.trim().is_empty() {
        profile.currency = "€".to_string();
    }

    if profile.accent_color.trim().is_empty() {
        profile.accent_color = "indigo".to_string();
    }
}

/// Preferences of a user, defaulting to the company profile values.
pub fn preferences(store: &Store, user_id: Uuid) -> CoreResult<Preferences> {
    match store.get_setting(&preferences_key(user_id))? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(Preferences::from_profile(&company_profile(store)?)),
    }
}

/// Validates and stores the preferences of a user.
pub fn save_preferences(store: &Store, user_id: Uuid, preferences: &Preferences) -> CoreResult<()> {
    preferences.validate().map_err(CoreError::Validation)?;
    store.put_setting(
        &preferences_key(user_id),
        &serde_json::to_value(preferences)?,
    )
}

/// Language that applies to a user: their own preference, otherwise the company profile.
pub fn resolve_language(store: &Store, user_id: Option<Uuid>) -> CoreResult<Language> {
    match user_id {
        Some(user_id) => Ok(preferences(store, user_id)?.language),
        None => Ok(company_profile(store)?.language),
    }
}

/// Removes the preferences of a user, for example when the account is deleted.
pub fn delete_preferences(store: &Store, user_id: Uuid) -> CoreResult<()> {
    store.remove_setting(&preferences_key(user_id))
}

/// Loads the update policy (defaults before the first save).
pub fn update_settings(store: &Store) -> CoreResult<UpdateSettings> {
    match store.get_setting(UPDATE_SETTINGS_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(UpdateSettings::default()),
    }
}

/// Validates and stores the update policy.
pub fn save_update_settings(store: &Store, settings: &UpdateSettings) -> CoreResult<()> {
    settings.validate().map_err(CoreError::Validation)?;
    store.put_setting(UPDATE_SETTINGS_KEY, &serde_json::to_value(settings)?)
}

/// Loads the portable-mode configuration (defaults before the first save).
pub fn portable_settings(store: &Store) -> CoreResult<PortableSettings> {
    match store.get_setting(PORTABLE_SETTINGS_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(PortableSettings::default()),
    }
}

/// Normalises and stores the portable-mode configuration.
pub fn save_portable_settings(store: &Store, settings: &PortableSettings) -> CoreResult<()> {
    let mut normalized = settings.clone();
    normalized.data_folder = normalized.data_folder.trim().to_string();
    normalized.validate().map_err(CoreError::Validation)?;
    store.put_setting(PORTABLE_SETTINGS_KEY, &serde_json::to_value(normalized)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::settings::ThemeMode;

    #[test]
    fn preferences_start_from_the_profile() {
        let store = Store::open_in_memory().expect("store");
        let profile = CompanyProfile {
            language: Language::Fr,
            theme_mode: ThemeMode::Dark,
            accent_color: "emerald".to_string(),
            ..CompanyProfile::default()
        };
        store.save_company_profile(&profile).expect("profile");

        let user_id = Uuid::new_v4();
        let loaded = preferences(&store, user_id).expect("preferences");
        assert_eq!(loaded.language, Language::Fr);
        assert_eq!(loaded.theme_mode, ThemeMode::Dark);
        assert_eq!(loaded.accent_color, "emerald");
        assert_eq!(
            resolve_language(&store, Some(user_id)).expect("language"),
            Language::Fr
        );
    }

    #[test]
    fn saves_and_validates_preferences_per_user() {
        let store = Store::open_in_memory().expect("store");
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        let custom = Preferences {
            language: Language::Es,
            theme_mode: ThemeMode::Light,
            accent_color: "rose".to_string(),
            sidebar_collapsed: true,
            startup_module: "invoices".to_string(),
        };
        save_preferences(&store, first, &custom).expect("saved");

        assert_eq!(preferences(&store, first).expect("loaded"), custom);
        assert_eq!(
            preferences(&store, second).expect("loaded").language,
            Language::De
        );

        let invalid = Preferences {
            accent_color: " ".to_string(),
            ..Preferences::default()
        };
        assert!(save_preferences(&store, first, &invalid).is_err());

        delete_preferences(&store, first).expect("deleted");
        assert_eq!(
            preferences(&store, first).expect("loaded").language,
            Language::De
        );
    }

    #[test]
    fn roundtrips_update_and_portable_settings() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(
            update_settings(&store).expect("defaults"),
            UpdateSettings::default()
        );

        let update = UpdateSettings {
            channel: UpdateChannel::Beta,
            check_on_start: true,
            automatic_download: true,
        };
        save_update_settings(&store, &update).expect("saved");
        assert_eq!(update_settings(&store).expect("loaded"), update);

        let invalid = UpdateSettings {
            check_on_start: false,
            automatic_download: true,
            ..UpdateSettings::default()
        };
        assert!(save_update_settings(&store, &invalid).is_err());

        let portable = PortableSettings {
            enabled: true,
            data_folder: "  /media/usb/socdof  ".to_string(),
        };
        save_portable_settings(&store, &portable).expect("saved");
        assert_eq!(
            portable_settings(&store).expect("loaded").data_folder,
            "/media/usb/socdof"
        );

        let invalid = PortableSettings {
            enabled: true,
            data_folder: " ".to_string(),
        };
        assert!(save_portable_settings(&store, &invalid).is_err());
    }

    #[test]
    fn validates_and_normalizes_the_profile() {
        let store = Store::open_in_memory().expect("store");
        let profile = CompanyProfile {
            name: "  Strudelcode  ".to_string(),
            backup_folder_path: "  ".to_string(),
            ..CompanyProfile::default()
        };
        save_company_profile(&store, &profile).expect("saved");

        let loaded = company_profile(&store).expect("profile");
        assert_eq!(loaded.name, "Strudelcode");
        assert_eq!(loaded.backup_folder_path, "");

        let invalid = CompanyProfile {
            name: " ".to_string(),
            ..CompanyProfile::default()
        };
        assert!(save_company_profile(&store, &invalid).is_err());
    }
}
