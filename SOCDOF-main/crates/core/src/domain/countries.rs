//! Country list and autocomplete matching for contact address forms.
//!
//! Ported from `SOCDOF - TS/src/lib/countries.ts`: the same 47 entries in the same order, the same
//! five localized names per country, and the same matching rules of `searchCountries()` — a trimmed,
//! lower-cased query matches the ISO code by prefix and any localized name (current language first)
//! by prefix or substring; an empty query returns the first eight entries; prefix matches sort
//! before substring matches, ties break alphabetically by the localized name. Diacritics are not
//! folded, exactly like the legacy `toLowerCase()` comparison.

use serde::Serialize;

use crate::domain::settings::Language;

/// Localized names of one country; `de` is also the primary name.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct CountryNames {
    /// German name.
    pub de: &'static str,
    /// English name.
    pub en: &'static str,
    /// French name.
    pub fr: &'static str,
    /// Spanish name.
    pub es: &'static str,
    /// Italian name.
    pub it: &'static str,
}

impl CountryNames {
    /// All five names, in the order the legacy search checks them.
    pub fn all(&self) -> [&'static str; 5] {
        [self.de, self.en, self.fr, self.es, self.it]
    }
}

/// One entry of [`COUNTRIES`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Country {
    /// ISO 3166-1 alpha-2 code, upper case.
    pub code: &'static str,
    /// Primary name (German, matching the legacy `name` field).
    pub name: &'static str,
    /// Names in every supported language.
    pub names: CountryNames,
    /// Flag emoji.
    pub flag: &'static str,
}

impl Country {
    /// Name of the country in `language`, falling back to the primary name.
    pub fn localized_name(&self, language: Language) -> &'static str {
        match language {
            Language::De => self.names.de,
            Language::En => self.names.en,
            Language::Fr => self.names.fr,
            Language::Es => self.names.es,
        }
    }
}

macro_rules! country {
    ($code:literal, $de:literal, $en:literal, $fr:literal, $es:literal, $it:literal, $flag:literal) => {
        Country {
            code: $code,
            name: $de,
            names: CountryNames {
                de: $de,
                en: $en,
                fr: $fr,
                es: $es,
                it: $it,
            },
            flag: $flag,
        }
    };
}

/// Countries offered by the address form, in the legacy order (DACH first).
pub const COUNTRIES: &[Country] = &[
    country!(
        "DE",
        "Deutschland",
        "Germany",
        "Allemagne",
        "Alemania",
        "Germania",
        "🇩🇪"
    ),
    country!(
        "AT",
        "Österreich",
        "Austria",
        "Autriche",
        "Austria",
        "Austria",
        "🇦🇹"
    ),
    country!(
        "CH",
        "Schweiz",
        "Switzerland",
        "Suisse",
        "Suiza",
        "Svizzera",
        "🇨🇭"
    ),
    country!("IT", "Italien", "Italy", "Italie", "Italia", "Italia", "🇮🇹"),
    country!(
        "LI",
        "Liechtenstein",
        "Liechtenstein",
        "Liechtenstein",
        "Liechtenstein",
        "Liechtenstein",
        "🇱🇮"
    ),
    country!(
        "LU",
        "Luxemburg",
        "Luxembourg",
        "Luxembourg",
        "Luxemburgo",
        "Lussemburgo",
        "🇱🇺"
    ),
    country!(
        "FR",
        "Frankreich",
        "France",
        "France",
        "Francia",
        "Francia",
        "🇫🇷"
    ),
    country!(
        "NL",
        "Niederlande",
        "Netherlands",
        "Pays-Bas",
        "Países Bajos",
        "Paesi Bassi",
        "🇳🇱"
    ),
    country!("BE", "Belgien", "Belgium", "Belgique", "Bélgica", "Belgio", "🇧🇪"),
    country!("ES", "Spanien", "Spain", "Espagne", "España", "Spagna", "🇪🇸"),
    country!(
        "GB",
        "Vereinigtes Königreich",
        "United Kingdom",
        "Royaume-Uni",
        "Reino Unido",
        "Regno Unito",
        "🇬🇧"
    ),
    country!(
        "US",
        "Vereinigte Staaten",
        "United States",
        "États-Unis",
        "Estados Unidos",
        "Stati Uniti",
        "🇺🇸"
    ),
    country!("PL", "Polen", "Poland", "Pologne", "Polonia", "Polonia", "🇵🇱"),
    country!(
        "CZ",
        "Tschechien",
        "Czech Republic",
        "République tchèque",
        "República Checa",
        "Repubblica Ceca",
        "🇨🇿"
    ),
    country!(
        "DK",
        "Dänemark",
        "Denmark",
        "Danemark",
        "Dinamarca",
        "Danimarca",
        "🇩🇰"
    ),
    country!("SE", "Schweden", "Sweden", "Suède", "Suecia", "Svezia", "🇸🇪"),
    country!("NO", "Norwegen", "Norway", "Norvège", "Noruega", "Norvegia", "🇳🇴"),
    country!(
        "FI",
        "Finnland",
        "Finland",
        "Finlande",
        "Finlandia",
        "Finlandia",
        "🇫🇮"
    ),
    country!(
        "PT",
        "Portugal",
        "Portugal",
        "Portugal",
        "Portugal",
        "Portogallo",
        "🇵🇹"
    ),
    country!(
        "GR",
        "Griechenland",
        "Greece",
        "Grèce",
        "Grecia",
        "Grecia",
        "🇬🇷"
    ),
    country!("IE", "Irland", "Ireland", "Irlande", "Irlanda", "Irlanda", "🇮🇪"),
    country!("HU", "Ungarn", "Hungary", "Hongrie", "Hungría", "Ungheria", "🇭🇺"),
    country!(
        "RO",
        "Rumänien",
        "Romania",
        "Roumanie",
        "Rumania",
        "Romania",
        "🇷🇴"
    ),
    country!(
        "SK",
        "Slowakei",
        "Slovakia",
        "Slovaquie",
        "Eslovaquia",
        "Slovacchia",
        "🇸🇰"
    ),
    country!(
        "SI",
        "Slowenien",
        "Slovenia",
        "Slovénie",
        "Eslovenia",
        "Slovenia",
        "🇸🇮"
    ),
    country!("HR", "Kroatien", "Croatia", "Croatie", "Croacia", "Croazia", "🇭🇷"),
    country!(
        "BG",
        "Bulgarien",
        "Bulgaria",
        "Bulgarie",
        "Bulgaria",
        "Bulgaria",
        "🇧🇬"
    ),
    country!("CY", "Zypern", "Cyprus", "Chypre", "Chipre", "Cipro", "🇨🇾"),
    country!("MT", "Malta", "Malta", "Malte", "Malta", "Malta", "🇲🇹"),
    country!("EE", "Estland", "Estonia", "Estonie", "Estonia", "Estonia", "🇪🇪"),
    country!("LV", "Lettland", "Latvia", "Lettonie", "Letonia", "Lettonia", "🇱🇻"),
    country!(
        "LT",
        "Litauen",
        "Lithuania",
        "Lituanie",
        "Lituania",
        "Lituania",
        "🇱🇹"
    ),
    country!("IS", "Island", "Iceland", "Islande", "Islandia", "Islanda", "🇮🇸"),
    country!("TR", "Türkei", "Turkey", "Turquie", "Turquía", "Turchia", "🇹🇷"),
    country!("CA", "Kanada", "Canada", "Canada", "Canadá", "Canada", "🇨🇦"),
    country!(
        "AU",
        "Australien",
        "Australia",
        "Australie",
        "Australia",
        "Australia",
        "🇦🇺"
    ),
    country!(
        "NZ",
        "Neuseeland",
        "New Zealand",
        "Nouvelle-Zélande",
        "Nueva Zelanda",
        "Nuova Zelanda",
        "🇳🇿"
    ),
    country!("JP", "Japan", "Japan", "Japon", "Japón", "Giappone", "🇯🇵"),
    country!("CN", "China", "China", "Chine", "China", "Cina", "🇨🇳"),
    country!(
        "BR",
        "Brasilien",
        "Brazil",
        "Brésil",
        "Brasil",
        "Brasile",
        "🇧🇷"
    ),
    country!("MX", "Mexiko", "Mexico", "Mexique", "México", "Messico", "🇲🇽"),
    country!(
        "ZA",
        "Südafrika",
        "South Africa",
        "Afrique du Sud",
        "Sudáfrica",
        "Sudafrica",
        "🇿🇦"
    ),
    country!(
        "AE",
        "Vereinigte Arabische Emirate",
        "United Arab Emirates",
        "Émirats arabes unis",
        "Emiratos Árabes Unidos",
        "Emirati Arabi Uniti",
        "🇦🇪"
    ),
    country!(
        "SM",
        "San Marino",
        "San Marino",
        "Saint-Marin",
        "San Marino",
        "San Marino",
        "🇸🇲"
    ),
    country!("MC", "Monaco", "Monaco", "Monaco", "Mónaco", "Monaco", "🇲🇨"),
    country!("AD", "Andorra", "Andorra", "Andorre", "Andorra", "Andorra", "🇦🇩"),
    country!(
        "VA",
        "Vatikanstadt",
        "Vatican City",
        "Vatican",
        "Ciudad del Vaticano",
        "Città del Vaticano",
        "🇻🇦"
    ),
];

/// Number of suggestions offered for an empty query, as the legacy helper returns them.
pub const EMPTY_QUERY_SUGGESTIONS: usize = 8;

/// Countries matching `query`, prefix hits first and alphabetical within each group.
///
/// Mirrors `searchCountries(query, lang)` of the legacy app: the query is trimmed and lower-cased,
/// an empty query returns the first [`EMPTY_QUERY_SUGGESTIONS`] entries of [`COUNTRIES`], and a
/// non-empty query matches the ISO code by prefix or any localized name by prefix or substring.
pub fn search_countries(query: &str, language: Language) -> Vec<&'static Country> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return COUNTRIES.iter().take(EMPTY_QUERY_SUGGESTIONS).collect();
    }

    let mut matched: Vec<&'static Country> = COUNTRIES
        .iter()
        .filter(|country| matches(country, &query, language))
        .collect();

    // Prefix matches first, then the localized names alphabetically; the sort is stable, so names
    // that differ only in punctuation keep the list order, like the legacy `localeCompare` ties.
    matched.sort_by(|left, right| {
        let left_prefix = is_prefix(left, &query, language);
        let right_prefix = is_prefix(right, &query, language);
        right_prefix.cmp(&left_prefix).then_with(|| {
            sort_key(left.localized_name(language)).cmp(&sort_key(right.localized_name(language)))
        })
    });
    matched
}

fn matches(country: &'static Country, query: &str, language: Language) -> bool {
    if country.code.to_lowercase().starts_with(query) {
        return true;
    }
    if country
        .localized_name(language)
        .to_lowercase()
        .contains(query)
    {
        return true;
    }
    country
        .names
        .all()
        .iter()
        .any(|name| name.to_lowercase().contains(query))
}

fn is_prefix(country: &'static Country, query: &str, language: Language) -> bool {
    country.code.to_lowercase() == query
        || country
            .localized_name(language)
            .to_lowercase()
            .starts_with(query)
}

/// Lower-cased comparison key with the accents of the list folded onto their base letters, the way
/// `localeCompare` orders names in the German UI ("Österreich" next to "O", not after "Z").
fn sort_key(name: &str) -> String {
    let mut key = String::with_capacity(name.len());
    for character in name.to_lowercase().chars() {
        match character {
            'ä' | 'á' | 'à' | 'â' | 'å' | 'ã' => key.push('a'),
            'ß' => key.push_str("ss"),
            'ç' => key.push('c'),
            'é' | 'è' | 'ê' | 'ë' => key.push('e'),
            'í' | 'ì' | 'î' | 'ï' => key.push('i'),
            'ñ' => key.push('n'),
            'ö' | 'ó' | 'ò' | 'ô' | 'õ' | 'ø' => key.push('o'),
            'ú' | 'ù' | 'û' | 'ü' => key.push('u'),
            'ý' | 'ÿ' => key.push('y'),
            other => key.push(other),
        }
    }
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codes(countries: &[&'static Country]) -> Vec<&'static str> {
        countries.iter().map(|country| country.code).collect()
    }

    #[test]
    fn list_matches_the_legacy_order_and_shape() {
        assert_eq!(COUNTRIES.len(), 47);
        assert_eq!(
            codes(&search_countries("", Language::De)),
            vec!["DE", "AT", "CH", "IT", "LI", "LU", "FR", "NL"],
            "an empty query returns the first eight entries, DACH first"
        );
        assert_eq!(COUNTRIES[0].name, "Deutschland");
        assert_eq!(COUNTRIES[0].flag, "🇩🇪");
        assert_eq!(COUNTRIES[46].code, "VA");
        assert_eq!(COUNTRIES[46].names.it, "Città del Vaticano");

        let mut seen = Vec::new();
        for country in COUNTRIES {
            assert_eq!(country.code.len(), 2);
            assert!(country.code.chars().all(|c| c.is_ascii_uppercase()));
            assert!(!country.flag.is_empty());
            assert!(!country.names.all().iter().any(|name| name.is_empty()));
            assert!(!seen.contains(&country.code), "duplicate {}", country.code);
            seen.push(country.code);
        }
    }

    #[test]
    fn empty_and_blank_queries_return_the_shortlist() {
        let expected = codes(&search_countries("", Language::De));
        assert_eq!(codes(&search_countries("   ", Language::De)), expected);
        assert_eq!(codes(&search_countries("\t\n", Language::En)), expected);
    }

    #[test]
    fn matches_codes_by_prefix_case_insensitively() {
        assert_eq!(codes(&search_countries("DE", Language::De))[0], "DE");
        assert_eq!(codes(&search_countries("de", Language::De))[0], "DE");
        assert_eq!(
            codes(&search_countries("schweiz", Language::De)),
            vec!["CH"]
        );

        // "c" matches the codes CA/CH/CN/CY/CZ and every name containing a "c"; the localized
        // name prefix (China) sorts before the code-only hits, like the legacy comparator.
        let by_code = codes(&search_countries("c", Language::De));
        assert_eq!(by_code[0], "CN");
        for expected in ["CA", "CH", "CZ", "CY"] {
            assert!(by_code.contains(&expected), "{expected} in {by_code:?}");
        }
    }

    #[test]
    fn matches_localized_names_of_every_language() {
        for (query, language) in [
            ("deutschland", Language::De),
            ("germany", Language::En),
            ("allemagne", Language::Fr),
            ("alemania", Language::Es),
        ] {
            let found = search_countries(query, language);
            assert_eq!(found[0].code, "DE", "{query} in {language:?}");
        }

        // The current language sorts the prefix hit first; another language still matches.
        assert_eq!(codes(&search_countries("germany", Language::De))[0], "DE");
        assert_eq!(codes(&search_countries("svizzera", Language::De))[0], "CH");
    }

    #[test]
    fn matches_substrings_and_puts_prefix_hits_first() {
        let found = codes(&search_countries("reich", Language::De));
        for expected in ["AT", "FR", "GB"] {
            assert!(found.contains(&expected), "{expected} in {found:?}");
        }
        assert!(!found.contains(&"DE"));

        let by_prefix = codes(&search_countries("de", Language::De));
        assert_eq!(by_prefix[0], "DE");
        assert!(by_prefix.contains(&"SE"), "{by_prefix:?}");
        assert!(by_prefix.contains(&"NL"), "{by_prefix:?}");
        assert!(
            by_prefix[1..].windows(2).all(|pair| {
                sort_key(
                    COUNTRIES
                        .iter()
                        .find(|country| country.code == pair[0])
                        .expect("country")
                        .localized_name(Language::De),
                ) <= sort_key(
                    COUNTRIES
                        .iter()
                        .find(|country| country.code == pair[1])
                        .expect("country")
                        .localized_name(Language::De),
                )
            }),
            "substring hits are alphabetical: {by_prefix:?}"
        );
    }

    #[test]
    fn trims_the_query_and_keeps_accents_significant() {
        assert_eq!(
            codes(&search_countries("  schweiz  ", Language::De))[0],
            "CH"
        );
        assert_eq!(
            codes(&search_countries("Österreich", Language::De))[0],
            "AT"
        );
        assert_eq!(
            codes(&search_countries("österreich", Language::De))[0],
            "AT"
        );
        // Like the legacy `toLowerCase()` matching, an unaccented spelling does not match.
        assert!(search_countries("osterreich", Language::De).is_empty());
        assert!(search_countries("oesterreich", Language::De).is_empty());
    }

    #[test]
    fn unknown_queries_match_nothing() {
        assert!(search_countries("atlantis", Language::De).is_empty());
        assert!(search_countries("xyz", Language::En).is_empty());
    }

    #[test]
    fn localized_names_follow_the_language() {
        let switzerland = &COUNTRIES[2];
        assert_eq!(switzerland.localized_name(Language::De), "Schweiz");
        assert_eq!(switzerland.localized_name(Language::En), "Switzerland");
        assert_eq!(switzerland.localized_name(Language::Fr), "Suisse");
        assert_eq!(switzerland.localized_name(Language::Es), "Suiza");
    }
}
