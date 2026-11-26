//! Reader for the legacy TypeScript catalogue.
//!
//! The legacy app keeps all of its texts in one TypeScript object literal. This module turns that
//! literal into the same flat maps the Rust catalogue uses, so the migration can be measured
//! instead of guessed: [`coverage`] reports, per language and per module, how many legacy texts the
//! Rust catalogue already carries. Only literal `'key': 'value'` pairs are read; template strings
//! and concatenations stay out of the result and therefore show up as uncovered.

use std::collections::BTreeMap;

use crate::domain::settings::Language;
use crate::i18n::Catalog;

/// Legacy texts of one language: `module.key` to text.
pub type LegacyTexts = BTreeMap<String, String>;

/// Legacy texts per language code (`de`, `en`, `fr`, `es`).
pub type LegacyCatalogues = BTreeMap<String, LegacyTexts>;

/// Reads a quoted string starting at `index` (the opening quote) and returns the unescaped text with
/// the index after the closing quote.
fn read_quoted(chars: &[char], index: usize) -> Option<(String, usize)> {
    let quote = *chars.get(index)?;
    if quote != '\'' && quote != '"' {
        return None;
    }
    let mut text = String::new();
    let mut position = index + 1;
    while position < chars.len() {
        let character = chars[position];
        if character == '\\' {
            let escaped = *chars.get(position + 1)?;
            match escaped {
                'n' => text.push('\n'),
                't' => text.push('\t'),
                other => text.push(other),
            }
            position += 2;
            continue;
        }
        if character == quote {
            return Some((text, position + 1));
        }
        text.push(character);
        position += 1;
    }
    None
}

/// Reads a bare object key (`en`, `de_message`) starting at `index`.
fn read_bare(chars: &[char], index: usize) -> Option<(String, usize)> {
    let mut position = index;
    let mut name = String::new();
    while position < chars.len() && (chars[position].is_alphanumeric() || chars[position] == '_') {
        name.push(chars[position]);
        position += 1;
    }
    if name.is_empty() {
        None
    } else {
        Some((name, position))
    }
}

/// Index of the brace that closes the block opened at `open`.
fn matching_brace(chars: &[char], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    let mut position = open;
    while position < chars.len() {
        match chars[position] {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(position);
                }
            }
            '\'' | '"' => {
                let (_text, next) = read_quoted(chars, position)?;
                position = next;
                continue;
            }
            '`' => {
                let mut cursor = position + 1;
                while cursor < chars.len() {
                    if chars[cursor] == '\\' {
                        cursor += 2;
                        continue;
                    }
                    if chars[cursor] == '`' {
                        cursor += 1;
                        break;
                    }
                    cursor += 1;
                }
                position = cursor;
                continue;
            }
            '/' if chars.get(position + 1) == Some(&'/') => {
                while position < chars.len() && chars[position] != '\n' {
                    position += 1;
                }
                continue;
            }
            _ => {}
        }
        position += 1;
    }
    None
}

/// Reads the literal `'key': 'value'` pairs of one object block.
fn parse_block(chars: &[char], open: usize, close: usize) -> LegacyTexts {
    let mut texts = LegacyTexts::new();
    let mut position = open + 1;
    while position < close {
        let character = chars[position];
        if character == ',' || character.is_whitespace() {
            position += 1;
            continue;
        }
        let Some((key, next)) = read_quoted(chars, position) else {
            position += 1;
            continue;
        };
        let mut cursor = next;
        while cursor < close && chars[cursor].is_whitespace() {
            cursor += 1;
        }
        if chars.get(cursor) != Some(&':') {
            position = next;
            continue;
        }
        cursor += 1;
        while cursor < close && chars[cursor].is_whitespace() {
            cursor += 1;
        }
        match read_quoted(chars, cursor) {
            Some((value, after)) => {
                texts.insert(key, value);
                position = after;
            }
            None => {
                // A value the parser cannot read (template string, concatenation, call): skip to
                // the next separator so the following key is still found.
                position = cursor;
                while position < close && chars[position] != ',' {
                    position += 1;
                }
            }
        }
    }
    texts
}

/// Parses the `translations` object of the legacy TypeScript catalogue.
///
/// Languages the legacy file does not define stay absent; keys it defines without a literal value
/// are left out on purpose and counted as uncovered.
pub fn parse_translations(source: &str) -> LegacyCatalogues {
    let mut catalogues = LegacyCatalogues::new();
    let Some(anchor) = source.find("export const translations") else {
        return catalogues;
    };
    let anchor = source[..anchor].chars().count();
    let chars: Vec<char> = source.chars().collect();
    let Some(open) = chars[anchor..].iter().position(|value| *value == '{') else {
        return catalogues;
    };
    let open = open + anchor;
    let Some(close) = matching_brace(&chars, open) else {
        return catalogues;
    };
    let mut position = open + 1;
    while position < close {
        let character = chars[position];
        if character == ',' || character.is_whitespace() {
            position += 1;
            continue;
        }
        let pair = read_quoted(&chars, position).or_else(|| read_bare(&chars, position));
        let Some((name, next)) = pair else {
            position += 1;
            continue;
        };
        let mut cursor = next;
        while cursor < close && chars[cursor] != '{' {
            cursor += 1;
        }
        let Some(end) = matching_brace(&chars, cursor) else {
            break;
        };
        if Language::from_storage(&name).is_some() {
            catalogues.insert(name, parse_block(&chars, cursor, end));
        }
        position = end + 1;
    }
    catalogues
}

/// How much of one legacy language the Rust catalogue already carries.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LanguageCoverage {
    /// Language the comparison was run for.
    pub language: Language,
    /// Number of legacy keys.
    pub total: usize,
    /// Legacy keys whose text exists verbatim in the Rust catalogue.
    pub matched: usize,
    /// `(matched, total)` per module prefix.
    pub modules: BTreeMap<String, (usize, usize)>,
}

impl LanguageCoverage {
    /// Share of legacy texts the Rust catalogue already carries, in percent.
    pub fn percent(&self) -> f64 {
        if self.total == 0 {
            0.0
        } else {
            self.matched as f64 * 100.0 / self.total as f64
        }
    }
}

/// Measures one legacy catalogue against its Rust counterpart, by exact text.
pub fn coverage(language: Language, legacy: &LegacyTexts, catalog: &Catalog) -> LanguageCoverage {
    let mut values: Vec<&str> = catalog.keys().filter_map(|key| catalog.get(key)).collect();
    values.sort_unstable();
    values.dedup();
    let mut modules: BTreeMap<String, (usize, usize)> = BTreeMap::new();
    let mut matched = 0usize;
    for (key, text) in legacy {
        let module = key.split('.').next().unwrap_or(key).to_owned();
        let entry = modules.entry(module).or_insert((0, 0));
        entry.1 += 1;
        if values.binary_search(&text.trim()).is_ok() {
            matched += 1;
            entry.0 += 1;
        }
    }
    LanguageCoverage {
        language,
        total: legacy.len(),
        matched,
        modules,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"
import { useState } from 'react';

export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    'common.replay': 'Replay preview',
    'therapy.quote': 'It\'s fine',
    'dynamic.value': buildText(),
    'numbers.count': 'Three',
  },
  de: {
    'common.replay': 'Vorschau wiederholen',
    'other.value': 'Grüße',
  },
};
"#;

    #[test]
    fn reads_every_literal_pair_of_every_language() {
        let catalogues = parse_translations(FIXTURE);
        let en = catalogues.get("en").expect("english");
        assert_eq!(
            en.get("common.replay").map(String::as_str),
            Some("Replay preview")
        );
        assert_eq!(
            en.get("therapy.quote").map(String::as_str),
            Some("It's fine")
        );
        assert_eq!(en.get("numbers.count").map(String::as_str), Some("Three"));
        assert!(
            !en.contains_key("dynamic.value"),
            "values that are no literal stay out"
        );
        assert_eq!(catalogues.get("de").expect("german").len(), 2);
        assert!(!catalogues.contains_key("fr"));
    }

    #[test]
    fn coverage_counts_matched_texts_per_module() {
        let catalogues = parse_translations(FIXTURE);
        let legacy = catalogues.get("de").expect("german");
        let catalog = Catalog::from_json(
            Language::De,
            r#"{"common.replay": "Vorschau wiederholen", "other.value": "Anders"}"#,
        )
        .expect("catalogue");
        let report = coverage(Language::De, legacy, &catalog);
        assert_eq!(report.language, Language::De);
        assert_eq!(report.total, 2);
        assert_eq!(report.matched, 1);
        assert_eq!(report.modules.get("common"), Some(&(1, 1)));
        assert_eq!(report.modules.get("other"), Some(&(0, 1)));
        assert!((report.percent() - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn a_file_without_the_object_yields_nothing() {
        assert!(parse_translations("const x = 1;").is_empty());
    }
}
