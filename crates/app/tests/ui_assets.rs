//! Webview asset checks: the four language packs must stay key-identical and carry
//! every label used by the parity surfaces added in this pass.

use std::collections::BTreeSet;
use std::path::PathBuf;

fn locales() -> Vec<(&'static str, BTreeSet<String>)> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/locales");
    ["de", "en", "fr", "es"]
        .into_iter()
        .map(|language| {
            let raw = std::fs::read_to_string(root.join(format!("{language}.json")))
                .unwrap_or_else(|error| panic!("read {language}.json: {error}"));
            let parsed: serde_json::Value = serde_json::from_str(&raw)
                .unwrap_or_else(|error| panic!("parse {language}.json: {error}"));
            let keys = parsed
                .as_object()
                .expect("language pack is an object")
                .keys()
                .cloned()
                .collect::<BTreeSet<_>>();
            (language, keys)
        })
        .collect()
}

#[test]
fn all_language_packs_have_identical_keys_and_parity_labels() {
    let packs = locales();
    let (reference_language, reference) = &packs[0];
    assert!(!reference.is_empty(), "the German pack is empty");
    for (language, keys) in packs.iter().skip(1) {
        let missing = reference.difference(keys).cloned().collect::<Vec<_>>();
        let extra = keys.difference(reference).cloned().collect::<Vec<_>>();
        assert!(
            missing.is_empty() && extra.is_empty(),
            "{language} differs from {reference_language}: missing={missing:?} extra={extra:?}"
        );
    }

    for required in [
        "contactDetailRevenue",
        "customerPickerTitle",
        "calcHistory",
        "widgetsKpis",
        "commandTitle",
        "taskviewTitle",
        "usersLogin",
        "languageTitle",
        "docsTitle",
        "storageTitle",
    ] {
        assert!(
            reference.contains(required),
            "missing parity key {required}"
        );
    }
}
