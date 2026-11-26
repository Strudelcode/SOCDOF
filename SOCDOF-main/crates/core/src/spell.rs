//! Offline spell checking for the text editor.
//!
//! The editor checks its documents against the German Hunspell dictionary the shipped application
//! uses (`assets/dictionary`, igerman98, GPL-2.0/GPL-3.0). The word list and the affix rules are
//! compiled into the binary; nothing is fetched and no text leaves the machine.
//!
//! This is a deliberately small Hunspell subset. A surface form counts as correct when
//!
//! - it is a dictionary stem, or
//! - it is a stem with one suffix or prefix rule applied (the rule's condition and flag must match),
//! - it is a stem with one prefix and one suffix rule, or
//! - it is a compound of two known words.
//!
//! Cross-product suffixes and morphological analysis are not implemented, so a rare inflection may
//! be reported although it is correct. The editor lets the user ignore a word or add it to the
//! personal dictionary, which keeps the check usable despite that limit.

use std::collections::HashMap;
use std::sync::OnceLock;

const DICTIONARY: &str = include_str!("../assets/dictionary/de_DE.dic");
const AFFIXES: &str = include_str!("../assets/dictionary/de_DE.aff");

/// One word the check does not know, with the number of occurrences.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpellIssue {
    /// The spelling as it first appears in the text.
    pub word: String,
    /// Number of occurrences in the text.
    pub count: usize,
}

#[derive(Debug, Clone)]
enum Condition {
    /// `.` matches any character.
    Any,
    /// A literal character.
    Literal(char),
    /// A character class; the flag marks a negated class.
    Class(Vec<char>, bool),
}

#[derive(Debug, Clone)]
struct Rule {
    flag: char,
    strip: String,
    add: String,
    condition: Vec<Condition>,
}

#[derive(Debug)]
struct Dictionary {
    /// Stem to affix flags; the flags are an empty string for entries without any.
    words: HashMap<&'static str, &'static str>,
    prefixes: Vec<Rule>,
    suffixes: Vec<Rule>,
}

fn dictionary() -> &'static Dictionary {
    static CACHE: OnceLock<Dictionary> = OnceLock::new();
    CACHE.get_or_init(parse_dictionary)
}

fn parse_dictionary() -> Dictionary {
    let mut words = HashMap::new();
    for line in DICTIONARY.lines() {
        let line = line.trim_end_matches('\r');
        if line.is_empty() || line.starts_with('\t') || line.starts_with('#') {
            continue;
        }
        if line.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let entry = match line.split_once('\t') {
            Some((entry, _)) => entry,
            None => line,
        };
        match entry.split_once('/') {
            Some((word, flags)) => {
                words.insert(word, flags);
            }
            None => {
                words.insert(entry, "");
            }
        }
    }

    let mut prefixes = Vec::new();
    let mut suffixes = Vec::new();
    for line in AFFIXES.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split_whitespace().collect();
        // Headers carry four fields (`SFX F Y 35`), rules five or more.
        if fields.len() < 5 {
            continue;
        }
        let (kind, flag) = (fields[0], fields[1]);
        if kind != "SFX" && kind != "PFX" {
            continue;
        }
        let Some(flag) = flag.chars().next() else {
            continue;
        };
        let strip = if fields[2] == "0" { "" } else { fields[2] };
        let add = if fields[3] == "0" { "" } else { fields[3] };
        let rule = Rule {
            flag,
            strip: strip.to_string(),
            add: add.to_string(),
            condition: parse_condition(fields[4]),
        };
        if kind == "SFX" {
            suffixes.push(rule);
        } else {
            prefixes.push(rule);
        }
    }

    Dictionary {
        words,
        prefixes,
        suffixes,
    }
}

fn parse_condition(pattern: &str) -> Vec<Condition> {
    let mut conditions = Vec::new();
    let mut chars = pattern.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '.' => conditions.push(Condition::Any),
            '[' => {
                let mut negated = false;
                let mut class = Vec::new();
                if chars.peek() == Some(&'^') {
                    chars.next();
                    negated = true;
                }
                for inner in chars.by_ref() {
                    if inner == ']' {
                        break;
                    }
                    class.push(inner);
                }
                conditions.push(Condition::Class(class, negated));
            }
            other => conditions.push(Condition::Literal(other)),
        }
    }
    conditions
}

fn matches(conditions: &[Condition], characters: &[char]) -> bool {
    if conditions.len() != characters.len() {
        return false;
    }
    conditions
        .iter()
        .zip(characters)
        .all(|(cond, c)| match cond {
            Condition::Any => true,
            Condition::Literal(literal) => literal == c,
            Condition::Class(class, negated) => class.contains(c) != *negated,
        })
}

fn condition_holds(stem: &str, rule: &Rule, at_end: bool) -> bool {
    if rule.condition.is_empty() {
        return true;
    }
    let chars: Vec<char> = stem.chars().collect();
    if chars.len() < rule.condition.len() {
        return false;
    }
    let slice = if at_end {
        &chars[chars.len() - rule.condition.len()..]
    } else {
        &chars[..rule.condition.len()]
    };
    matches(&rule.condition, slice)
}

fn has_flag(flags: &str, flag: char) -> bool {
    flags.chars().any(|c| c == flag)
}

fn suffix_known(dict: &Dictionary, word: &str) -> bool {
    for rule in &dict.suffixes {
        if rule.add.is_empty() {
            continue;
        }
        let Some(rest) = word.strip_suffix(rule.add.as_str()) else {
            continue;
        };
        let stem = format!("{rest}{}", rule.strip);
        if let Some(flags) = dict.words.get(stem.as_str()) {
            if has_flag(flags, rule.flag) && condition_holds(&stem, rule, true) {
                return true;
            }
        }
    }
    false
}

fn prefix_known(dict: &Dictionary, word: &str) -> bool {
    for rule in &dict.prefixes {
        if rule.add.is_empty() {
            continue;
        }
        let Some(rest) = word.strip_prefix(rule.add.as_str()) else {
            continue;
        };
        let stem = format!("{}{rest}", rule.strip);
        if let Some(flags) = dict.words.get(stem.as_str()) {
            if has_flag(flags, rule.flag) && condition_holds(&stem, rule, false) {
                return true;
            }
        }
    }
    false
}

fn word_known(dict: &Dictionary, word: &str) -> bool {
    if dict.words.contains_key(word) {
        return true;
    }
    if suffix_known(dict, word) || prefix_known(dict, word) {
        return true;
    }
    // One prefix plus one suffix, checked on the prefix-stripped form.
    for rule in &dict.prefixes {
        if rule.add.is_empty() {
            continue;
        }
        let Some(rest) = word.strip_prefix(rule.add.as_str()) else {
            continue;
        };
        let stem = format!("{}{rest}", rule.strip);
        if let Some(flags) = dict.words.get(stem.as_str()) {
            if has_flag(flags, rule.flag) && condition_holds(&stem, rule, false) {
                return true;
            }
        }
        if suffix_known(dict, &stem) {
            return true;
        }
    }
    false
}

fn variants(word: &str) -> Vec<String> {
    let mut variants = vec![word.to_string()];
    let mut chars = word.chars();
    if let Some(first) = chars.next() {
        let rest: String = chars.collect();
        let mut lower = String::new();
        for c in first.to_lowercase() {
            lower.push(c);
        }
        let mut upper = String::new();
        for c in first.to_uppercase() {
            upper.push(c);
        }
        variants.push(format!("{lower}{rest}"));
        variants.push(format!("{upper}{rest}"));
        variants.push(word.to_lowercase());
    }
    variants.dedup();
    variants
}

fn known_with_compounds(dict: &Dictionary, word: &str, depth: usize) -> bool {
    for variant in variants(word) {
        if word_known(dict, &variant) {
            return true;
        }
    }
    if depth == 0 {
        return false;
    }
    let chars: Vec<char> = word.chars().collect();
    if chars.len() < 6 {
        return false;
    }
    // Try every split that leaves at least three characters on both sides.
    for split in 3..=chars.len() - 3 {
        let left: String = chars[..split].iter().collect();
        let right: String = chars[split..].iter().collect();
        if known_with_compounds(dict, &left, depth - 1)
            && known_with_compounds(dict, &right, depth - 1)
        {
            return true;
        }
    }
    false
}

/// Whether the dictionary knows the word (case-insensitive for the first letter, compounds allowed).
pub fn is_known(word: &str) -> bool {
    let word = word.trim();
    if word.chars().count() < 2 {
        return true;
    }
    known_with_compounds(dictionary(), word, 2)
}

/// Splits text into word tokens with their byte ranges; digits and punctuation separate words.
pub fn word_ranges(text: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut start = None;
    for (index, c) in text.char_indices() {
        if c.is_alphabetic() || c == '\u{00AD}' {
            if start.is_none() {
                start = Some(index);
            }
        } else if let Some(begin) = start.take() {
            ranges.push((begin, index));
        }
    }
    if let Some(begin) = start {
        ranges.push((begin, text.len()));
    }
    ranges
}

fn ignored(ignored: &[String], word: &str) -> bool {
    ignored.iter().any(|entry| entry.eq_ignore_ascii_case(word))
}

/// Byte ranges of the unknown words, in reading order.
pub fn unknown_ranges(text: &str, ignored_words: &[String]) -> Vec<(usize, usize)> {
    word_ranges(text)
        .into_iter()
        .filter(|(start, end)| {
            let word = &text[*start..*end];
            !ignored(ignored_words, word) && !is_known(word)
        })
        .collect()
}

/// Unique unknown words with their occurrence count, most frequent first.
pub fn issues(text: &str, ignored_words: &[String]) -> Vec<SpellIssue> {
    let mut issues: Vec<SpellIssue> = Vec::new();
    for (start, end) in word_ranges(text) {
        let word = &text[start..end];
        if ignored(ignored_words, word) || is_known(word) {
            continue;
        }
        match issues
            .iter_mut()
            .find(|issue| issue.word.eq_ignore_ascii_case(word))
        {
            Some(issue) => issue.count += 1,
            None => issues.push(SpellIssue {
                word: word.to_string(),
                count: 1,
            }),
        }
    }
    issues.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| a.word.to_lowercase().cmp(&b.word.to_lowercase()))
    });
    issues
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_stems_inflections_and_compounds() {
        for word in [
            "Haus",
            "Häuser",
            "Behandlung",
            "Behandlungen",
            "Straße",
            "Straßen",
            "Termin",
            "Termine",
            "Notiz",
            "Notizen",
            "Kaffee",
            "heute",
            "Rechnung",
            "Rechnungsnummer",
            "Team",
            "Meeting",
            "Kunde",
            "Kunden",
            "Angebot",
            "Angebote",
        ] {
            assert!(is_known(word), "dictionary does not know {word}");
        }
    }

    #[test]
    fn rejects_gibberish() {
        for word in ["Xqzvbn", "Qwertzuiop", "Flurbelzwack"] {
            assert!(!is_known(word), "gibberish accepted: {word}");
        }
    }

    #[test]
    fn reports_unique_unknown_words_with_counts() {
        let text = "Das Haus ist scohn, wirklich scohn.\nXqzvbn bleibt Xqzvbn.";
        let issues = issues(text, &[]);
        assert_eq!(issues.len(), 2);
        assert_eq!(issues[0].word, "scohn");
        assert_eq!(issues[0].count, 2);
        assert_eq!(issues[1].word, "Xqzvbn");
        assert_eq!(issues[1].count, 2);
    }

    #[test]
    fn honours_the_ignored_words() {
        let text = "Ein scohn Beispiel.";
        assert_eq!(issues(text, &[]).len(), 1);
        assert!(issues(text, &["scohn".to_string()]).is_empty());
        assert!(unknown_ranges(text, &["SCOHN".to_string()]).is_empty());
    }

    #[test]
    fn ignores_numbers_and_short_tokens() {
        let text = "2026 12,50 € a b";
        assert!(issues(text, &[]).is_empty());
    }

    #[test]
    fn reports_byte_ranges_in_reading_order() {
        let text = "Haus scohn und Xqzvbn";
        let ranges = unknown_ranges(text, &[]);
        assert_eq!(ranges.len(), 2);
        assert_eq!(&text[ranges[0].0..ranges[0].1], "scohn");
        assert_eq!(&text[ranges[1].0..ranges[1].1], "Xqzvbn");
    }
}
