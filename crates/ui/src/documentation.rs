//! Searchable native help for everyday SOCDOF workflows.

use egui::{Context, RichText, TextEdit, Ui};

use crate::components::card;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_TITLE;

/// Search state of the local documentation window.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DocumentationState {
    /// Text used to filter manual sections and their paragraphs.
    pub query: String,
}

const TOPICS: [(&str, [&str; 3]); 4] = [
    (
        "docs_quickstart_title",
        [
            "docs_quickstart_1",
            "docs_quickstart_2",
            "docs_quickstart_3",
        ],
    ),
    (
        "docs_modules_title",
        ["docs_modules_1", "docs_modules_2", "docs_modules_3"],
    ),
    (
        "docs_shortcuts_title",
        ["docs_shortcuts_1", "docs_shortcuts_2", "docs_shortcuts_3"],
    ),
    (
        "docs_security_title",
        ["docs_security_1", "docs_security_2", "docs_security_3"],
    ),
];

/// Draws the searchable manual inside its native desktop window.
pub fn documentation_window(
    _ctx: &Context,
    _active: bool,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    _focus: &mut FocusState,
    state: &mut DocumentationState,
) {
    ui.vertical(|ui| {
        ui.label(
            RichText::new(texts.get("docs_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.label(RichText::new(texts.get("docs_subtitle")).color(theme.palette.text_muted));
        ui.add_space(10.0);
        ui.horizontal(|ui| {
            ui.label(texts.get("docs_search"));
            ui.add(
                TextEdit::singleline(&mut state.query)
                    .desired_width(300.0)
                    .hint_text(texts.get("docs_search")),
            );
        });
        ui.add_space(12.0);

        let query = state.query.trim().to_lowercase();
        let mut visible = 0;
        for (title_key, paragraph_keys) in TOPICS {
            if !topic_matches(texts, title_key, &paragraph_keys, &query) {
                continue;
            }
            visible += 1;
            card(ui, theme, |ui| {
                ui.label(
                    RichText::new(texts.get(title_key))
                        .size(FONT_TITLE)
                        .strong(),
                );
                ui.add_space(8.0);
                for paragraph_key in paragraph_keys {
                    ui.label(texts.get(paragraph_key));
                    ui.add_space(6.0);
                }
            });
            ui.add_space(10.0);
        }
        if visible == 0 {
            ui.label(texts.get("docs_no_results"));
        }
    });
}

fn topic_matches(texts: &UiTexts, title: &str, paragraphs: &[&str; 3], query: &str) -> bool {
    if query.is_empty() {
        return true;
    }
    std::iter::once(title)
        .chain(paragraphs.iter().copied())
        .any(|key| texts.get(key).to_lowercase().contains(query))
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    #[test]
    fn search_matches_titles_and_body_text_but_not_unrelated_topics() {
        let texts = UiTexts::embedded(Language::De).expect("German catalogue");
        let (title, body) = TOPICS[0];
        assert!(topic_matches(&texts, title, &body, "backup"));
        assert!(topic_matches(&texts, title, &body, "schnellstart"));
        assert!(!topic_matches(&texts, title, &body, "restaurant"));
        assert!(topic_matches(&texts, title, &body, ""));
    }
}
