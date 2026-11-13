//! App Store: browse the core module catalogue and activate or deactivate modules.
//!
//! The screen never keeps a module list of its own. [`AppStoreState::refresh`] loads the catalogue
//! and activation state from [`socdof_core::app_store`], and every switch writes back through the
//! same service. The host observes [`AppStoreState::changed`] to refresh the dashboard and desktop
//! navigation immediately.
//!
//! Errors stay as catalogue keys. Core validation codes are mapped to dedicated messages, while
//! database, serialization and IO failures use the storage message.

use egui::{Context, RichText};
use socdof_core::app_store::{self, ModuleLicense, StoreModule};
use socdof_core::domain::permission::AppModule;
use socdof_core::error::CoreError;
use socdof_core::store::Store;

use crate::components::{badge, button, card, empty_state, search_field, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// State of the App Store screen.
#[derive(Debug, Clone, Default)]
pub struct AppStoreState {
    /// Catalogue entries loaded from the core.
    pub modules: Vec<StoreModule>,
    /// Search text over translated names, descriptions and module identifiers.
    pub query: String,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when a module was activated or deactivated, consumed by the host.
    pub changed: bool,
    /// Set when the back button or Escape was used.
    pub back: bool,
    loaded: bool,
}

impl AppStoreState {
    /// Creates an unloaded screen; the first [`AppStoreState::refresh`] loads the catalogue.
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads the catalogue once.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if self.loaded {
            return Ok(());
        }
        self.reload(store)
    }

    /// Reloads the catalogue and activation state from the store.
    pub fn reload(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.modules = app_store::modules(store)?;
        self.loaded = true;
        Ok(())
    }

    /// Clears transient messages and reloads when the screen is opened.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.error = None;
        self.status = None;
        self.back = false;
        self.changed = false;
        self.query.clear();
        self.reload(store)
    }

    /// Modules matching the search text.
    pub fn filtered(&self, texts: &UiTexts) -> Vec<&StoreModule> {
        let needle = self.query.trim().to_lowercase();
        self.modules
            .iter()
            .filter(|module| {
                needle.is_empty()
                    || module.module.as_str().contains(&needle)
                    || texts.get(module.name_key).to_lowercase().contains(&needle)
                    || texts
                        .get(module.description_key)
                        .to_lowercase()
                        .contains(&needle)
            })
            .collect()
    }

    /// Number of active modules.
    pub fn active_count(&self) -> usize {
        self.modules.iter().filter(|module| module.active).count()
    }

    /// Activates or deactivates one module through the core, then reloads the catalogue.
    pub fn toggle(&mut self, store: &Store, module: AppModule) -> bool {
        let Some(entry) = self
            .modules
            .iter()
            .find(|entry| entry.module == module)
            .cloned()
        else {
            self.error = Some("app_store_error_unknown");
            return false;
        };
        if !entry.can_toggle() {
            self.error = Some(if entry.required {
                "app_store_error_required"
            } else {
                "app_store_error_locked"
            });
            return false;
        }
        let activate = !entry.active;
        self.error = None;
        self.status = None;
        match app_store::set_active(store, module.as_str(), activate) {
            Ok(()) => {
                if self.reload(store).is_err() {
                    self.error = Some("app_store_error_storage");
                    return false;
                }
                self.status = Some(if activate {
                    "app_store_activated"
                } else {
                    "app_store_deactivated"
                });
                self.changed = true;
                true
            }
            Err(error) => {
                self.error = Some(error_key(&error));
                false
            }
        }
    }
}

/// Maps a core error to a translated catalogue key.
pub fn error_key(error: &CoreError) -> &'static str {
    match error {
        CoreError::NotFound(_) => "app_store_error_unknown",
        CoreError::Validation(code) => match code.as_str() {
            "app_module_already_active" => "app_store_error_already_active",
            "app_module_already_inactive" => "app_store_error_already_inactive",
            "app_module_required" => "app_store_error_required",
            "app_module_not_licensed" => "app_store_error_locked",
            _ => "app_store_error_storage",
        },
        CoreError::Database(_)
        | CoreError::Serialization(_)
        | CoreError::Io(_)
        | CoreError::Document(_) => "app_store_error_storage",
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &AppStoreState) {
    if let Some(key) = state.error {
        ui.label(
            RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.danger),
        );
    }
    if let Some(key) = state.status {
        ui.label(
            RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.success),
        );
    }
}

fn header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppStoreState,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("app-store"),
            title: texts.get("app_store_title"),
            subtitle: texts.get("app_store_subtitle"),
            status: None,
        },
        &mut state.back,
    );
}

/// Renders the App Store into the context.
pub fn app_store(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AppStoreState,
    store: &Store,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        state.back = true;
    }
    if state.refresh(store).is_err() {
        state.error = Some("app_store_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                header(ui, theme, texts, focus, state);
                ui.add_space(10.0);
                card(ui, theme, |ui| {
                    ui.horizontal(|ui| {
                        badge(
                            ui,
                            theme,
                            &format!("{} / {}", state.active_count(), state.modules.len()),
                            Tone::Accent,
                        );
                        badge(ui, theme, texts.get("app_store_local_badge"), Tone::Neutral);
                    });
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("app_store_hero_hint"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(10.0);
                    search_field(
                        ui,
                        theme,
                        focus,
                        &mut state.query,
                        texts.get("app_store_search"),
                    );
                });
                ui.add_space(8.0);
                messages(ui, theme, texts, state);
                ui.add_space(6.0);

                let ids: Vec<AppModule> = state
                    .filtered(texts)
                    .into_iter()
                    .map(|module| module.module)
                    .collect();
                if ids.is_empty() {
                    card(ui, theme, |ui| {
                        empty_state(
                            ui,
                            theme,
                            texts.get("app_store_empty_title"),
                            texts.get("app_store_empty_hint"),
                        );
                    });
                    return;
                }

                for id in ids {
                    let Some(module) = state
                        .modules
                        .iter()
                        .find(|module| module.module == id)
                        .cloned()
                    else {
                        continue;
                    };
                    ui.add_space(10.0);
                    card(ui, theme, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(RichText::new(texts.get(module.name_key)).strong());
                            badge(
                                ui,
                                theme,
                                texts.get(module.state_key()),
                                if module.active {
                                    Tone::Success
                                } else {
                                    Tone::Neutral
                                },
                            );
                            badge(
                                ui,
                                theme,
                                texts.get(module.license_key()),
                                match module.license {
                                    ModuleLicense::Included => Tone::Accent,
                                    ModuleLicense::Trial => Tone::Warning,
                                    ModuleLicense::Locked => Tone::Danger,
                                },
                            );
                        });
                        ui.add_space(3.0);
                        ui.label(
                            RichText::new(texts.get(module.description_key))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                        ui.add_space(7.0);
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!(
                                    "{} {}",
                                    texts.get("app_store_version"),
                                    module.version
                                ))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                            );
                            if module.required {
                                badge(ui, theme, texts.get("app_store_required"), Tone::Neutral);
                            }
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    let enabled = module.can_toggle();
                                    ui.add_enabled_ui(enabled, |ui| {
                                        let label = if module.active {
                                            texts.get("app_store_deactivate")
                                        } else if module.license == ModuleLicense::Locked {
                                            texts.get("app_store_locked_action")
                                        } else {
                                            texts.get("app_store_activate")
                                        };
                                        if button(
                                            ui,
                                            theme,
                                            focus,
                                            label,
                                            if module.active {
                                                ButtonVariant::Secondary
                                            } else {
                                                ButtonVariant::Primary
                                            },
                                        )
                                        .activated
                                        {
                                            state.toggle(store, module.module);
                                        }
                                    });
                                },
                            );
                        });
                    });
                }
            });
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    fn texts() -> UiTexts {
        UiTexts::embedded(Language::De).expect("catalogue")
    }

    #[test]
    fn loads_the_core_catalogue_and_filters_it() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AppStoreState::new();
        state.refresh(&store).expect("catalogue");
        assert_eq!(state.modules.len(), 18);
        assert_eq!(state.active_count(), 18);
        let mut texts = texts();
        state.query = "therapie".to_string();
        let filtered = state.filtered(&texts);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].module, AppModule::Therapy);
        state.query = "nicht vorhanden".to_string();
        assert!(state.filtered(&texts).is_empty());
        texts = UiTexts::embedded(Language::En).expect("catalogue");
        state.query = "point of sale".to_string();
        assert_eq!(state.filtered(&texts)[0].module, AppModule::Pos);
    }

    #[test]
    fn toggles_through_the_core_and_reloads() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AppStoreState::new();
        state.refresh(&store).expect("catalogue");
        assert!(state.toggle(&store, AppModule::Contacts));
        assert!(state.changed);
        assert_eq!(state.status, Some("app_store_deactivated"));
        assert!(!app_store::is_active(&store, AppModule::Contacts).expect("state"));
        assert!(state.toggle(&store, AppModule::Contacts));
        assert!(app_store::is_active(&store, AppModule::Contacts).expect("state"));
    }

    #[test]
    fn maps_core_errors_and_blocks_system_modules() {
        assert_eq!(
            error_key(&CoreError::NotFound("x".to_string())),
            "app_store_error_unknown"
        );
        assert_eq!(
            error_key(&CoreError::Validation(
                "app_module_not_licensed".to_string()
            )),
            "app_store_error_locked"
        );
        assert_eq!(
            error_key(&CoreError::Validation(
                "app_module_already_active".to_string()
            )),
            "app_store_error_already_active"
        );
        assert_eq!(
            error_key(&CoreError::Validation("other".to_string())),
            "app_store_error_storage"
        );
        let store = Store::open_in_memory().expect("store");
        let mut state = AppStoreState::new();
        state.refresh(&store).expect("catalogue");
        assert!(!state.toggle(&store, AppModule::Dashboard));
        assert_eq!(state.error, Some("app_store_error_required"));
        assert!(state.toggle(&store, AppModule::Therapy));
        assert!(!app_store::is_active(&store, AppModule::Therapy).expect("state"));
        assert!(state.toggle(&store, AppModule::Therapy));
        assert!(app_store::is_active(&store, AppModule::Therapy).expect("state"));
    }

    #[test]
    fn renders_the_catalogue_and_empty_search() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AppStoreState::new();
        state.refresh(&store).expect("catalogue");
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts = texts();
        for query in ["", "xyz"] {
            state.query = query.to_string();
            let ctx = crate::theme::headless_context();
            let mut focus = FocusState::default();
            let mut output = None;
            for _ in 0..2 {
                let input = egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::Vec2::new(1180.0, 1900.0),
                    )),
                    time: Some(1.0),
                    ..Default::default()
                };
                output = Some(ctx.run(input, |ctx| {
                    app_store(ctx, &theme, &texts, &mut focus, &mut state, &store);
                }));
            }
            assert!(output.expect("frame").shapes.len() > 5);
        }
    }
}
