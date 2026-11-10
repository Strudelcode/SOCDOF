//! Application settings and the company profile.

use serde::{Deserialize, Serialize};

/// Appearance mode chosen by the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    /// Always light.
    Light,
    /// Always dark.
    Dark,
    /// Follow the operating system. This is the default.
    #[default]
    System,
}

/// Supported interface languages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    /// German. This is the default.
    #[default]
    De,
    /// English.
    En,
    /// French.
    Fr,
    /// Spanish.
    Es,
}

impl Language {
    /// Stable storage and file representation.
    pub fn as_str(self) -> &'static str {
        match self {
            Language::De => "de",
            Language::En => "en",
            Language::Fr => "fr",
            Language::Es => "es",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "de" => Some(Language::De),
            "en" => Some(Language::En),
            "fr" => Some(Language::Fr),
            "es" => Some(Language::Es),
            _ => None,
        }
    }
}

/// Business data printed on invoices and letters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct CompanyProfile {
    /// Legal company name.
    pub name: String,
    /// Street and house number.
    pub street: String,
    /// Postal code and city.
    pub zip_city: String,
    /// Country.
    pub country: String,
    /// Contact email.
    pub email: String,
    /// Phone number.
    pub phone: String,
    /// Tax number / VAT id.
    pub tax_id: String,
    /// Bank name printed on dunning letters and mail drafts.
    pub bank_name: String,
    /// IBAN printed on letters and drafts.
    pub iban: String,
    /// BIC printed on letters and drafts.
    pub bic: String,
    /// Account holder printed on drafts.
    pub bank_account_holder: String,
    /// SMTP host, empty when mail is handed to the local client.
    pub smtp_host: String,
    /// SMTP port.
    pub smtp_port: i64,
    /// SMTP user.
    pub smtp_user: String,
    /// Whether a card terminal is configured.
    pub card_payment_enabled: bool,
    /// Name of the card terminal.
    pub card_terminal_name: String,
    /// Currency symbol used for printing.
    pub currency: String,
    /// Interface language.
    pub language: Language,
    /// Accent color identifier or hex value.
    pub accent_color: String,
    /// Appearance mode.
    pub theme_mode: ThemeMode,
    /// Folder for automatic backups, empty when disabled.
    pub backup_folder_path: String,
    /// Whether automatic backups are enabled.
    pub auto_backup_enabled: bool,
    /// Minutes between two automatic backups.
    pub backup_interval_minutes: i64,
    /// Number of automatic backups that are kept.
    pub backup_max_keep_count: i64,
}

impl Default for CompanyProfile {
    fn default() -> Self {
        CompanyProfile {
            name: String::new(),
            street: String::new(),
            zip_city: String::new(),
            country: String::new(),
            email: String::new(),
            phone: String::new(),
            tax_id: String::new(),
            bank_name: String::new(),
            iban: String::new(),
            bic: String::new(),
            bank_account_holder: String::new(),
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_user: String::new(),
            card_payment_enabled: false,
            card_terminal_name: String::new(),
            currency: "€".to_string(),
            language: Language::default(),
            accent_color: "indigo".to_string(),
            theme_mode: ThemeMode::default(),
            backup_folder_path: String::new(),
            auto_backup_enabled: false,
            backup_interval_minutes: 120,
            backup_max_keep_count: 10,
        }
    }
}

impl CompanyProfile {
    /// Validates the fields that must be present for printing.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("company_name_required".to_string());
        }
        if self.currency.trim().is_empty() {
            return Err("currency_required".to_string());
        }
        if self.auto_backup_enabled && self.backup_folder_path.trim().is_empty() {
            return Err("backup_folder_required".to_string());
        }
        if self.backup_interval_minutes < 1 {
            return Err("backup_interval_invalid".to_string());
        }
        if self.backup_max_keep_count < 1 {
            return Err("backup_keep_invalid".to_string());
        }
        Ok(())
    }

    /// Whether the profile has been filled in at least once.
    pub fn is_configured(&self) -> bool {
        !self.name.trim().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_follow_the_system_theme() {
        let profile = CompanyProfile::default();
        assert_eq!(profile.theme_mode, ThemeMode::System);
        assert_eq!(profile.language, Language::De);
        assert_eq!(profile.currency, "€");
        assert_eq!(profile.backup_interval_minutes, 120);
        assert_eq!(profile.backup_max_keep_count, 10);
        assert!(!profile.is_configured());
    }

    #[test]
    fn validates_company_name_and_currency() {
        let mut profile = CompanyProfile::default();
        assert_eq!(profile.validate(), Err("company_name_required".to_string()));

        profile.name = "Strudelcode".to_string();
        assert_eq!(profile.validate(), Ok(()));

        profile.currency = String::new();
        assert_eq!(profile.validate(), Err("currency_required".to_string()));
    }

    #[test]
    fn roundtrips_language_strings() {
        for language in [Language::De, Language::En, Language::Fr, Language::Es] {
            assert_eq!(Language::from_storage(language.as_str()), Some(language));
        }
        assert_eq!(Language::from_storage("it"), None);
    }

    #[test]
    fn deserializes_partial_profiles_with_defaults() {
        let profile: CompanyProfile =
            serde_json::from_str(r#"{"name":"Strudelcode"}"#).expect("profile");
        assert_eq!(profile.name, "Strudelcode");
        assert_eq!(profile.theme_mode, ThemeMode::System);
    }
}
