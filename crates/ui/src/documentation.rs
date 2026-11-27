//! Searchable native help portal, module manual and release history for SOCDOF.

use egui::{Context, RichText, TextEdit, Ui};

use crate::chrome::{app_chrome, module_header, ModuleHeader};
use crate::components::{badge, button, card, empty_state, tabs, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Active top-level tab inside the Documentation portal.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DocTab {
    /// Searchable module manual (default so direct help search lands here).
    #[default]
    Manual,
    /// System capabilities and architectural overview.
    Overview,
    /// Release notes across major SOCDOF versions.
    Releases,
    /// Structured desktop and editor keyboard shortcuts.
    Shortcuts,
    /// Local storage, encryption and multi-workstation safety.
    Security,
}

/// Category filter for the manual chapters.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DocManualCategory {
    /// Show every chapter.
    #[default]
    All,
    /// Desktop, shell, permissions and quickstart.
    Fundamentals,
    /// Contacts, invoices, POS, purchases and accounting.
    Finance,
    /// Calendar, therapy practice, support, projects, fleet and restaurant.
    Operations,
    /// Textwerk editor, settings, backups and security.
    Tools,
}

/// Major-version filter for the Release History tab.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DocReleaseFilter {
    /// Two most recent major cycles (V25 & V24).
    #[default]
    Recent,
    /// All recorded releases.
    All,
    /// Only 25.x releases.
    V25,
    /// Only 24.x releases.
    V24,
    /// Only 23.x releases.
    V23,
}

/// Search and navigation state of the local documentation window.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DocumentationState {
    /// Active portal tab.
    pub tab: DocTab,
    /// Manual category filter.
    pub category: DocManualCategory,
    /// Text used to filter manual sections and their paragraphs.
    pub query: String,
    /// Major version filter for release history.
    pub release_filter: DocReleaseFilter,
    /// Search text used in the release history tab.
    pub release_query: String,
    /// Set by the header's back button; the host leaves the screen afterwards.
    pub back: bool,
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

struct ManualChapter {
    category: DocManualCategory,
    title_key: &'static str,
    summary_key: Option<&'static str>,
    body_keys: &'static [&'static str],
}

const MANUAL_CHAPTERS: &[ManualChapter] = &[
    ManualChapter {
        category: DocManualCategory::Fundamentals,
        title_key: "docs_quickstart_title",
        summary_key: None,
        body_keys: &[
            "docs_quickstart_1",
            "docs_quickstart_2",
            "docs_quickstart_3",
        ],
    },
    ManualChapter {
        category: DocManualCategory::Fundamentals,
        title_key: "docs_modules_title",
        summary_key: None,
        body_keys: &["docs_modules_1", "docs_modules_2", "docs_modules_3"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_contacts_title",
        summary_key: Some("docs_sec_contacts_summary"),
        body_keys: &["docs_sec_contacts_body"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_invoices_title",
        summary_key: Some("docs_sec_invoices_summary"),
        body_keys: &["docs_sec_invoices_body"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_products_title",
        summary_key: Some("docs_sec_products_summary"),
        body_keys: &["docs_sec_products_body"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_purchases_title",
        summary_key: Some("docs_sec_purchases_summary"),
        body_keys: &["docs_sec_purchases_body"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_pos_title",
        summary_key: Some("docs_sec_pos_summary"),
        body_keys: &["docs_sec_pos_body"],
    },
    ManualChapter {
        category: DocManualCategory::Finance,
        title_key: "docs_sec_accounting_title",
        summary_key: Some("docs_sec_accounting_summary"),
        body_keys: &["docs_sec_accounting_body"],
    },
    ManualChapter {
        category: DocManualCategory::Operations,
        title_key: "docs_sec_calendar_title",
        summary_key: Some("docs_sec_calendar_summary"),
        body_keys: &["docs_sec_calendar_body"],
    },
    ManualChapter {
        category: DocManualCategory::Operations,
        title_key: "docs_sec_therapy_title",
        summary_key: Some("docs_sec_therapy_summary"),
        body_keys: &["docs_sec_therapy_body"],
    },
    ManualChapter {
        category: DocManualCategory::Operations,
        title_key: "docs_sec_support_title",
        summary_key: Some("docs_sec_support_summary"),
        body_keys: &["docs_sec_support_body"],
    },
    ManualChapter {
        category: DocManualCategory::Operations,
        title_key: "docs_sec_operations_title",
        summary_key: Some("docs_sec_operations_summary"),
        body_keys: &["docs_sec_operations_body"],
    },
    ManualChapter {
        category: DocManualCategory::Tools,
        title_key: "docs_shortcuts_title",
        summary_key: None,
        body_keys: &["docs_shortcuts_1", "docs_shortcuts_2", "docs_shortcuts_3"],
    },
    ManualChapter {
        category: DocManualCategory::Tools,
        title_key: "docs_security_title",
        summary_key: None,
        body_keys: &["docs_security_1", "docs_security_2", "docs_security_3"],
    },
];

struct ReleaseEntry {
    major: u8,
    version: &'static str,
    date: &'static str,
    title: &'static str,
    highlights: &'static [&'static str],
}

const RELEASES: &[ReleaseEntry] = &[
    ReleaseEntry {
        major: 25,
        version: "25.2.27",
        date: "2026-11-01",
        title: "First-Run Setup: System Theme, Step Layout & Documentation Filters",
        highlights: &[
            "First-run language selection follows the system light or dark appearance right away.",
            "Business details header wraps cleanly on narrow windows.",
            "Documentation version filters highlight V25 & V24 major cycles.",
        ],
    },
    ReleaseEntry {
        major: 25,
        version: "25.1.0",
        date: "2026-10-31",
        title: "Shared Workstation Mode, 1-Click Profile Switching & Portable Hardening",
        highlights: &[
            "Dedicated shared workstation configuration for multi-user computers with quick profile switching.",
            "Uppercase initials avatar system synchronized with dynamic accent colors.",
            "Portable & shared drive instance lock and safe data folder layout.",
        ],
    },
    ReleaseEntry {
        major: 25,
        version: "25.0.0",
        date: "2026-10-31",
        title: "Multi-User Collaboration, Per-User Language Profiles & Portable Architecture",
        highlights: &[
            "Language settings bound per user account profile across German, English, French and Spanish.",
            "Argon2id local authentication with failed-attempt lockout and recovery questions.",
            "Modular App Store permissions and synchronized desktop icons.",
        ],
    },
    ReleaseEntry {
        major: 24,
        version: "24.12.0",
        date: "2026-10-30",
        title: "Textwerk Editor Ribbon, Proofing & Modern Table Export",
        highlights: &[
            "Native rich-text editor with DOCX, ODT and HTML export/import.",
            "Offline German spell-checking with custom ignore/reset controls.",
            "Document statistics with word and character counts.",
        ],
    },
    ReleaseEntry {
        major: 24,
        version: "24.11.0",
        date: "2026-10-28",
        title: "OS Language Detection, Desktop Wallpaper Persistence & Grid Spacing",
        highlights: &[
            "Automatic OS locale detection during initial setup with manual override persistence.",
            "Per-user and workspace wallpaper persistence across desktop and browser sessions.",
            "Anti-collision desktop icon grid layout.",
        ],
    },
    ReleaseEntry {
        major: 24,
        version: "24.8.7",
        date: "2026-10-10",
        title: "Comprehensive ERP Manual Expansion & Changelog Search",
        highlights: &[
            "Dual-major default preset (V25 & V24) with instant older archive access.",
            "Expanded manual chapters across Inventory, Purchasing, POS, Accounting and Practice Suite.",
            "Full keyword search across titles, versions, dates and highlights.",
        ],
    },
    ReleaseEntry {
        major: 24,
        version: "24.7.0",
        date: "2026-10-05",
        title: "Therapy Practice Billing Sync, Mileage Logbook & FatturaPA 1.2 XML",
        highlights: &[
            "Batch invoicing linking unbilled practice sessions and billing items to official invoices.",
            "Dedicated §4 Nr. 14 UStG therapy tax-exempt invoice layout support.",
            "Structured Italian FatturaPA 1.2 electronic invoice XML generation.",
        ],
    },
    ReleaseEntry {
        major: 24,
        version: "24.4.0",
        date: "2026-10-01",
        title: "DIN 5008 PDF Letterhead Engine & Template Placement",
        highlights: &[
            "Vector DIN 5008 invoice PDF rendering with fold/punch marks and payment terms.",
            "Customizable invoice templates with company profile, IBAN/BIC, logo and color tokens.",
            "Built-in dunning calculator and .eml mail draft generation.",
        ],
    },
    ReleaseEntry {
        major: 23,
        version: "23.0.0",
        date: "2026-08-15",
        title: "SOCDOF Core ERP Architecture & Offline SQLite Store",
        highlights: &[
            "Transactional SQLite database engine with exact integer-cent currency math.",
            "Complete CRM, double-entry Stock Journal, POS receipts, Calendar ICS and Support suite.",
            "Cross-platform Desktop and Browser WASM architecture in pure Rust.",
        ],
    },
];

/// Renders documentation in the full application work area.
#[allow(clippy::too_many_arguments)]
pub fn documentation(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut DocumentationState,
) {
    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                module_header(
                    ui,
                    theme,
                    texts,
                    focus,
                    ModuleHeader {
                        app: app_chrome("documentation"),
                        title: texts.get("docs_title"),
                        subtitle: texts.get("docs_subtitle"),
                        status: None,
                    },
                    &mut state.back,
                );
                ui.add_space(10.0);
                documentation_body(ui, theme, texts, focus, state);
            });
        });
}

/// Draws the searchable manual inside its native desktop window.
pub fn documentation_window(
    _ctx: &Context,
    _active: bool,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
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
        documentation_body(ui, theme, texts, focus, state);
    });
}

fn documentation_body(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut DocumentationState,
) {
    let labels = [
        texts.get("docs_tab_manual"),
        texts.get("docs_tab_overview"),
        texts.get("docs_tab_releases"),
        texts.get("docs_tab_shortcuts"),
        texts.get("docs_tab_security"),
    ];
    let mut selected = tab_index(state.tab);
    if tabs(ui, theme, focus, &labels, &mut selected) {
        state.tab = tab_from_index(selected);
    }
    ui.add_space(12.0);

    match state.tab {
        DocTab::Manual => render_manual_tab(ui, theme, texts, focus, state),
        DocTab::Overview => render_overview_tab(ui, theme, texts),
        DocTab::Releases => render_releases_tab(ui, theme, texts, focus, state),
        DocTab::Shortcuts => render_shortcuts_tab(ui, theme, texts),
        DocTab::Security => render_security_tab(ui, theme, texts),
    }
}

fn render_manual_tab(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut DocumentationState,
) {
    let search_width = (ui.available_width() - 24.0).clamp(180.0, 340.0);
    ui.horizontal_wrapped(|ui| {
        ui.label(texts.get("docs_search"));
        ui.add(
            TextEdit::singleline(&mut state.query)
                .desired_width(search_width)
                .hint_text(texts.get("docs_search")),
        );
    });
    ui.add_space(8.0);

    ui.horizontal_wrapped(|ui| {
        for (cat, key) in [
            (DocManualCategory::All, "docs_cat_all"),
            (DocManualCategory::Fundamentals, "docs_cat_fundamentals"),
            (DocManualCategory::Finance, "docs_cat_finance"),
            (DocManualCategory::Operations, "docs_cat_operations"),
            (DocManualCategory::Tools, "docs_cat_tools"),
        ] {
            let variant = if state.category == cat {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, texts.get(key), variant).activated {
                state.category = cat;
            }
        }
    });
    ui.add_space(12.0);

    let query = state.query.trim().to_lowercase();
    let mut visible = 0;
    for chapter in MANUAL_CHAPTERS {
        if state.category != DocManualCategory::All && chapter.category != state.category {
            continue;
        }
        if !chapter_matches(texts, chapter, &query) {
            continue;
        }
        visible += 1;
        card(ui, theme, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(texts.get(chapter.title_key))
                        .size(FONT_TITLE)
                        .strong(),
                );
                badge(
                    ui,
                    theme,
                    texts.get(category_key(chapter.category)),
                    Tone::Accent,
                );
            });
            if let Some(summary_key) = chapter.summary_key {
                ui.add_space(4.0);
                ui.label(
                    RichText::new(texts.get(summary_key))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            }
            ui.add_space(8.0);
            for body_key in chapter.body_keys {
                ui.label(texts.get(body_key));
                ui.add_space(4.0);
            }
        });
        ui.add_space(10.0);
    }

    if visible == 0 {
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("docs_no_results"),
                texts.get("docs_search"),
            );
        });
    }
}

fn render_overview_tab(ui: &mut Ui, theme: &Theme, texts: &UiTexts) {
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("docs_overview_heading"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(4.0);
        ui.label(RichText::new(texts.get("docs_overview_lead")).color(theme.palette.text_muted));
    });
    ui.add_space(10.0);

    for (title_key, body_key, tag) in [
        (
            "docs_overview_card_offline_title",
            "docs_overview_card_offline_body",
            "SQLite",
        ),
        (
            "docs_overview_card_i18n_title",
            "docs_overview_card_i18n_body",
            "DE · EN · FR · ES",
        ),
        (
            "docs_overview_card_theme_title",
            "docs_overview_card_theme_body",
            "Light · Dark",
        ),
        (
            "docs_overview_card_compliance_title",
            "docs_overview_card_compliance_body",
            "DIN 5008 · FatturaPA",
        ),
        (
            "docs_overview_card_security_title",
            "docs_overview_card_security_body",
            "Argon2id",
        ),
        (
            "docs_overview_card_modules_title",
            "docs_overview_card_modules_body",
            "18+ Apps",
        ),
    ] {
        card(ui, theme, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(texts.get(title_key))
                        .size(FONT_TITLE)
                        .strong(),
                );
                badge(ui, theme, tag, Tone::Accent);
            });
            ui.add_space(6.0);
            ui.label(texts.get(body_key));
        });
        ui.add_space(8.0);
    }
}

fn render_releases_tab(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut DocumentationState,
) {
    let search_width = (ui.available_width() - 24.0).clamp(180.0, 320.0);
    ui.horizontal_wrapped(|ui| {
        ui.label(texts.get("docs_releases_search"));
        ui.add(
            TextEdit::singleline(&mut state.release_query)
                .desired_width(search_width)
                .hint_text(texts.get("docs_releases_search")),
        );
    });
    ui.add_space(8.0);

    ui.horizontal_wrapped(|ui| {
        for (filter, label) in [
            (
                DocReleaseFilter::Recent,
                texts.get("docs_releases_filter_recent"),
            ),
            (DocReleaseFilter::All, texts.get("docs_releases_filter_all")),
            (DocReleaseFilter::V25, "V25"),
            (DocReleaseFilter::V24, "V24"),
            (DocReleaseFilter::V23, "V23"),
        ] {
            let variant = if state.release_filter == filter {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, label, variant).activated {
                state.release_filter = filter;
            }
        }
    });
    ui.add_space(10.0);

    let matches = filter_releases(state.release_filter, &state.release_query);
    ui.label(
        RichText::new(format!(
            "{}: {}",
            texts.get("docs_releases_count"),
            matches.len()
        ))
        .size(FONT_SMALL)
        .color(theme.palette.text_muted),
    );
    ui.add_space(8.0);

    if matches.is_empty() {
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("docs_releases_empty"),
                texts.get("docs_releases_search"),
            );
        });
        return;
    }

    for rel in matches {
        card(ui, theme, |ui| {
            ui.horizontal_wrapped(|ui| {
                badge(ui, theme, &format!("v{}", rel.version), Tone::Accent);
                badge(ui, theme, rel.date, Tone::Neutral);
                ui.label(RichText::new(rel.title).strong());
            });
            ui.add_space(6.0);
            for item in rel.highlights {
                ui.label(format!("• {item}"));
            }
        });
        ui.add_space(8.0);
    }
}

fn render_shortcuts_tab(ui: &mut Ui, theme: &Theme, texts: &UiTexts) {
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("docs_shortcuts_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        for key in ["docs_shortcuts_1", "docs_shortcuts_2", "docs_shortcuts_3"] {
            ui.label(texts.get(key));
            ui.add_space(4.0);
        }
    });
    ui.add_space(10.0);

    card(ui, theme, |ui| {
        egui::Grid::new("socdof-docs-shortcuts-grid")
            .num_columns(2)
            .spacing(egui::vec2(20.0, 10.0))
            .show(ui, |ui| {
                ui.label(
                    RichText::new(texts.get("docs_shortcut_key"))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                ui.label(
                    RichText::new(texts.get("docs_shortcut_action"))
                        .size(FONT_SMALL)
                        .strong()
                        .color(theme.palette.text_muted),
                );
                ui.end_row();

                for (shortcut, desc_key) in [
                    ("F1", "docs_shortcut_f1"),
                    ("Ctrl + K", "docs_shortcut_palette"),
                    ("Ctrl + Shift + L", "docs_shortcut_lock"),
                    ("F11", "docs_shortcut_fullscreen"),
                    ("Esc", "docs_shortcut_escape"),
                    ("Ctrl + Tab / Ctrl + W", "docs_shortcut_tab"),
                    ("Ctrl + B / Ctrl + I / Ctrl + S", "docs_shortcut_editor"),
                ] {
                    badge(ui, theme, shortcut, Tone::Neutral);
                    ui.label(texts.get(desc_key));
                    ui.end_row();
                }
            });
    });
}

fn render_security_tab(ui: &mut Ui, theme: &Theme, texts: &UiTexts) {
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("docs_security_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(8.0);
        for key in ["docs_security_1", "docs_security_2", "docs_security_3"] {
            ui.label(format!("• {}", texts.get(key)));
            ui.add_space(4.0);
        }
    });
    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("docs_overview_card_security_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        ui.label(texts.get("docs_overview_card_security_body"));
        ui.add_space(6.0);
        ui.label(texts.get("docs_overview_card_offline_body"));
    });
}

fn tab_index(tab: DocTab) -> usize {
    match tab {
        DocTab::Manual => 0,
        DocTab::Overview => 1,
        DocTab::Releases => 2,
        DocTab::Shortcuts => 3,
        DocTab::Security => 4,
    }
}

fn tab_from_index(index: usize) -> DocTab {
    match index {
        1 => DocTab::Overview,
        2 => DocTab::Releases,
        3 => DocTab::Shortcuts,
        4 => DocTab::Security,
        _ => DocTab::Manual,
    }
}

fn category_key(category: DocManualCategory) -> &'static str {
    match category {
        DocManualCategory::All => "docs_cat_all",
        DocManualCategory::Fundamentals => "docs_cat_fundamentals",
        DocManualCategory::Finance => "docs_cat_finance",
        DocManualCategory::Operations => "docs_cat_operations",
        DocManualCategory::Tools => "docs_cat_tools",
    }
}

fn chapter_matches(texts: &UiTexts, chapter: &ManualChapter, query: &str) -> bool {
    if query.is_empty() {
        return true;
    }
    std::iter::once(chapter.title_key)
        .chain(chapter.summary_key)
        .chain(chapter.body_keys.iter().copied())
        .any(|key| texts.get(key).to_lowercase().contains(query))
}

fn filter_releases(filter: DocReleaseFilter, query: &str) -> Vec<&'static ReleaseEntry> {
    let needle = query.trim().to_lowercase();
    RELEASES
        .iter()
        .filter(|rel| {
            if !needle.is_empty() {
                let ver_tag = format!("v{}", rel.version).to_lowercase();
                return ver_tag.contains(&needle)
                    || rel.version.to_lowercase().contains(&needle)
                    || rel.date.to_lowercase().contains(&needle)
                    || rel.title.to_lowercase().contains(&needle)
                    || rel
                        .highlights
                        .iter()
                        .any(|item| item.to_lowercase().contains(&needle));
            }
            match filter {
                DocReleaseFilter::Recent => rel.major >= 24,
                DocReleaseFilter::All => true,
                DocReleaseFilter::V25 => rel.major == 25,
                DocReleaseFilter::V24 => rel.major == 24,
                DocReleaseFilter::V23 => rel.major == 23,
            }
        })
        .collect()
}

#[allow(dead_code)]
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

    #[test]
    fn manual_chapters_and_release_filters_match_expected_entries() {
        let texts = UiTexts::embedded(Language::De).expect("German catalogue");
        assert!(MANUAL_CHAPTERS.len() >= 12);
        assert!(chapter_matches(&texts, &MANUAL_CHAPTERS[0], ""));
        assert!(filter_releases(DocReleaseFilter::V25, "").iter().all(|r| r.major == 25));
        assert!(filter_releases(DocReleaseFilter::V23, "").iter().any(|r| r.version == "23.0.0"));
        assert!(!filter_releases(DocReleaseFilter::Recent, "FatturaPA").is_empty());
        assert!(filter_releases(DocReleaseFilter::All, "no-such-xyz-release").is_empty());
    }
}
