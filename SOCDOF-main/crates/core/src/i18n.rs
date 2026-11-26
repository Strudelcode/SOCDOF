//! Translation loader.
//!
//! The core catalogue (validation and service messages) is compiled into the binary for German,
//! English, French and Spanish, so a missing language file can never leave the UI without texts.
//! External language packs are flat JSON objects that are merged over the embedded catalogue; the
//! same loader is used for the full UI catalogue in Phase 7.
//!
//! Keys are stable snake_case codes. There is no hardcoded user-facing text in the Rust code: a
//! missing key falls back to German and finally to the key itself, which the CI check treats as a
//! failure.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use crate::domain::settings::Language;
use crate::error::CoreResult;

/// Languages with a catalogue embedded in this binary.
pub const EMBEDDED_LANGUAGES: [Language; 4] =
    [Language::De, Language::En, Language::Fr, Language::Es];

const CATALOG_DE: &str = include_str!("../locales/de.json");
const CATALOG_EN: &str = include_str!("../locales/en.json");
const CATALOG_FR: &str = include_str!("../locales/fr.json");
const CATALOG_ES: &str = include_str!("../locales/es.json");

/// One flat key/value catalogue.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Catalog {
    language: Language,
    entries: BTreeMap<String, String>,
}

impl Catalog {
    /// Loads the embedded catalogue of a language.
    pub fn embedded(language: Language) -> CoreResult<Self> {
        let raw = match language {
            Language::De => CATALOG_DE,
            Language::En => CATALOG_EN,
            Language::Fr => CATALOG_FR,
            Language::Es => CATALOG_ES,
        };
        Self::from_json(language, raw)
    }

    /// Parses a flat JSON object.
    pub fn from_json(language: Language, raw: &str) -> CoreResult<Self> {
        let entries: BTreeMap<String, String> = serde_json::from_str(raw)?;
        Ok(Self { language, entries })
    }

    /// Reads a language pack from disk.
    pub fn from_file(language: Language, path: impl AsRef<Path>) -> CoreResult<Self> {
        let raw = std::fs::read_to_string(path)?;
        Self::from_json(language, &raw)
    }

    /// Language of the catalogue.
    pub fn language(&self) -> Language {
        self.language
    }

    /// Number of entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the catalogue has no entries.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Translation of a key, if present.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.entries.get(key).map(String::as_str)
    }

    /// Whether the catalogue contains a key.
    pub fn contains(&self, key: &str) -> bool {
        self.entries.contains_key(key)
    }

    /// All keys of the catalogue.
    pub fn keys(&self) -> impl Iterator<Item = &String> {
        self.entries.keys()
    }

    /// Overlays another catalogue. Existing keys are replaced, new keys are added.
    pub fn merge(&mut self, overlay: &Catalog) {
        for (key, value) in &overlay.entries {
            self.entries.insert(key.clone(), value.clone());
        }
    }

    /// Keys that exist in `master` but not in this catalogue.
    pub fn missing_against(&self, master: &Catalog) -> Vec<String> {
        master
            .keys()
            .filter(|key| !self.contains(key))
            .cloned()
            .collect()
    }
}

/// Catalogue resolution for one language: primary, German fallback, then the key itself.
#[derive(Debug, Clone)]
pub struct Translator {
    primary: Catalog,
    fallback: Catalog,
}

impl Translator {
    /// Builds a translator from the embedded catalogues.
    pub fn new(language: Language) -> CoreResult<Self> {
        Ok(Self {
            primary: Catalog::embedded(language)?,
            fallback: Catalog::embedded(Language::De)?,
        })
    }

    /// Builds a translator whose embedded catalogue is overlaid with an external language pack.
    pub fn with_pack(language: Language, pack: impl AsRef<Path>) -> CoreResult<Self> {
        let mut primary = Catalog::embedded(language)?;
        primary.merge(&Catalog::from_file(language, pack)?);
        Ok(Self {
            primary,
            fallback: Catalog::embedded(Language::De)?,
        })
    }

    /// Language of the primary catalogue.
    pub fn language(&self) -> Language {
        self.primary.language()
    }

    /// Translates a key. Unknown keys are returned unchanged so they are visible in the UI and in
    /// the missing-key check instead of rendering an empty label.
    pub fn translate(&self, key: &str) -> String {
        self.primary
            .get(key)
            .or_else(|| self.fallback.get(key))
            .unwrap_or(key)
            .to_string()
    }

    /// Translates a key and replaces `{name}` placeholders.
    pub fn translate_args(&self, key: &str, args: &[(&str, &str)]) -> String {
        let mut text = self.translate(key);
        for (name, value) in args {
            text = text.replace(&format!("{{{name}}}"), value);
        }
        text
    }

    /// Whether the primary catalogue knows a key.
    pub fn has(&self, key: &str) -> bool {
        self.primary.contains(key)
    }

    /// Keys of the master catalogue that the primary catalogue does not translate.
    pub fn missing_keys(&self, master: &Catalog) -> Vec<String> {
        self.primary.missing_against(master)
    }
}

/// Result of checking an external language pack.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PackReport {
    /// Keys of the embedded catalogue that the pack does not translate.
    pub missing: Vec<String>,
    /// Keys the pack defines that the embedded catalogue does not know.
    pub unknown: Vec<String>,
}

/// Checks an external language pack against the embedded catalogue of the same language.
pub fn validate_pack(language: Language, path: impl AsRef<Path>) -> CoreResult<PackReport> {
    let master = Catalog::embedded(language)?;
    let pack = Catalog::from_file(language, path)?;

    let known: BTreeSet<&String> = master.keys().collect();
    let unknown = pack
        .keys()
        .filter(|key| !known.contains(key))
        .cloned()
        .collect();

    Ok(PackReport {
        missing: pack.missing_against(&master),
        unknown,
    })
}

/// Missing keys of every embedded language compared to the German master catalogue.
pub fn coverage() -> CoreResult<Vec<(Language, Vec<String>)>> {
    let master = Catalog::embedded(Language::De)?;
    let mut report = Vec::new();
    for language in EMBEDDED_LANGUAGES {
        let catalog = Catalog::embedded(language)?;
        report.push((language, catalog.missing_against(&master)));
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embeds_all_four_languages_with_the_same_keys() {
        for (language, missing) in coverage().expect("coverage") {
            assert!(
                missing.is_empty(),
                "{} misses {missing:?}",
                language.as_str()
            );
        }
        assert_eq!(
            Catalog::embedded(Language::En).expect("catalog").len(),
            Catalog::embedded(Language::De).expect("catalog").len()
        );
    }

    #[test]
    fn falls_back_to_german_then_to_the_key() {
        let translator = Translator::new(Language::Fr).expect("translator");
        assert_eq!(
            translator.translate("stock_insufficient"),
            "Le stock est insuffisant pour ce mouvement."
        );
        assert!(translator.has("stock_insufficient"));
        assert_eq!(translator.translate("unknown_key"), "unknown_key");
        assert!(!translator.has("unknown_key"));
    }

    #[test]
    fn replaces_named_placeholders() {
        let translator = Translator::new(Language::En).expect("translator");
        assert_eq!(
            translator.translate_args("stock_insufficient", &[("count", "2")]),
            "There is not enough stock for this movement."
        );
    }
}
