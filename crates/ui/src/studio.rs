//! Studio drawer: the company letterhead and the clean-mode maintenance.
//!
//! The drawer is the Rust counterpart of the legacy SOCDOF Studio: it edits the company profile the
//! documents print as letterhead, shows how many business records are stored, and offers the
//! destructive clean mode. Everything is written through the core services, so the drawer holds no
//! business rules of its own: validation comes from `CompanyProfile::validate`, the reset from
//! `Store::reset_business_data`, and every visible label from the catalogue.

use egui::{Align2, Context, Id, RichText, Stroke, Ui, Vec2};
use socdof_core::document_layout::{self, DocumentLayout, TokenAlign};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::settings_service;
use socdof_core::store::Store;

use crate::components::{badge, button, card, empty_state, icon_button, tabs, ButtonVariant, Tone};
use crate::controls::text_field;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{FONT_HEADING, FONT_SMALL};

/// Tab of the Studio drawer.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum StudioTab {
    /// Company letterhead.
    #[default]
    Company,
    /// Record counts and clean mode.
    Data,
    /// Letterhead background and token placement of printed documents.
    Layout,
}

impl StudioTab {
    /// Zero-based tab index, used by the segmented control.
    pub fn index(self) -> usize {
        match self {
            StudioTab::Company => 0,
            StudioTab::Data => 1,
            StudioTab::Layout => 2,
        }
    }

    /// Tab for a zero-based index, clamped to the last tab.
    pub fn from_index(index: usize) -> Self {
        match index {
            1 => StudioTab::Data,
            2 => StudioTab::Layout,
            _ => StudioTab::Company,
        }
    }
}

/// Editable copy of the fields the letterhead prints.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct StudioDraft {
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
    /// Currency symbol used for printing.
    pub currency: String,
}

impl StudioDraft {
    /// Copies the letterhead fields out of a stored profile.
    pub fn from_profile(profile: &CompanyProfile) -> Self {
        StudioDraft {
            name: profile.name.clone(),
            street: profile.street.clone(),
            zip_city: profile.zip_city.clone(),
            country: profile.country.clone(),
            email: profile.email.clone(),
            phone: profile.phone.clone(),
            tax_id: profile.tax_id.clone(),
            currency: profile.currency.clone(),
        }
    }

    /// Writes the draft back onto `profile`, keeping every field the drawer does not edit.
    pub fn apply(&self, profile: &mut CompanyProfile) {
        profile.name = self.name.trim().to_string();
        profile.street = self.street.trim().to_string();
        profile.zip_city = self.zip_city.trim().to_string();
        profile.country = self.country.trim().to_string();
        profile.email = self.email.trim().to_string();
        profile.phone = self.phone.trim().to_string();
        profile.tax_id = self.tax_id.trim().to_string();
        profile.currency = self.currency.trim().to_string();
    }
}

/// Stored business records per module, as shown in the data tab.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StudioCounts {
    /// Stored contacts.
    pub contacts: i64,
    /// Stored products.
    pub products: i64,
    /// Stored invoices.
    pub invoices: i64,
    /// Stored purchase orders.
    pub purchase_orders: i64,
    /// Stored POS receipts.
    pub pos_orders: i64,
}

impl StudioCounts {
    /// Sum over all counted modules.
    pub fn total(&self) -> i64 {
        self.contacts + self.products + self.invoices + self.purchase_orders + self.pos_orders
    }
}

/// State of the Studio drawer.
#[derive(Debug, Clone, Default)]
pub struct StudioState {
    open: bool,
    tab: StudioTab,
    draft: StudioDraft,
    profile: CompanyProfile,
    counts: StudioCounts,
    error: Option<&'static str>,
    status: Option<&'static str>,
    confirm_reset: bool,
    layout: DocumentLayout,
    layout_image: LetterheadPreview,
}

impl StudioState {
    /// Builds a closed drawer with an empty draft.
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether the drawer is visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Current tab.
    pub fn tab(&self) -> StudioTab {
        self.tab
    }

    /// Switches the tab and clears the transient messages.
    pub fn set_tab(&mut self, tab: StudioTab) {
        self.tab = tab;
        self.error = None;
        self.status = None;
    }

    /// Draft of the letterhead fields.
    pub fn draft(&self) -> &StudioDraft {
        &self.draft
    }

    /// Record counts of the last refresh.
    pub fn counts(&self) -> StudioCounts {
        self.counts
    }

    /// Last error key, if any.
    pub fn error(&self) -> Option<&'static str> {
        self.error
    }

    /// Last success key, if any.
    pub fn status(&self) -> Option<&'static str> {
        self.status
    }

    /// Whether the clean-mode confirmation is showing.
    pub fn confirm_reset(&self) -> bool {
        self.confirm_reset
    }

    /// Opens the drawer on the letterhead tab and loads profile and counts.
    pub fn open(&mut self, store: &Store) {
        self.open = true;
        self.tab = StudioTab::Company;
        self.error = None;
        self.status = None;
        self.confirm_reset = false;
        if self.refresh(store).is_err() {
            self.error = Some("studio_error_load");
        }
    }

    /// Closes the drawer and drops a pending confirmation.
    pub fn close(&mut self) {
        self.open = false;
        self.confirm_reset = false;
    }

    /// Opens or closes the drawer.
    pub fn toggle(&mut self, store: &Store) {
        if self.open {
            self.close();
        } else {
            self.open(store);
        }
    }

    /// Reloads the profile and the record counts from the store.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.profile = store.company_profile()?;
        self.draft = StudioDraft::from_profile(&self.profile);
        self.counts = StudioCounts {
            contacts: store.contact_count()?,
            products: store.product_count()?,
            invoices: store.invoice_count()?,
            purchase_orders: store.purchase_order_count()?,
            pos_orders: store.pos_order_count()?,
        };
        self.layout = document_layout::load(store).unwrap_or_default();
        Ok(())
    }

    /// Saves the draft through the settings service; returns whether it was written.
    pub fn save(&mut self, store: &Store) -> bool {
        let mut profile = self.profile.clone();
        self.draft.apply(&mut profile);
        if let Err(code) = profile.validate() {
            self.error = Some(if code == "company_name_required" {
                "studio_error_name"
            } else {
                "studio_error_invalid"
            });
            self.status = None;
            return false;
        }
        match settings_service::save_company_profile(store, &profile) {
            Ok(()) => {
                self.profile = profile;
                self.error = None;
                self.status = Some("studio_status_saved");
                true
            }
            Err(_) => {
                self.error = Some("studio_error_storage");
                self.status = None;
                false
            }
        }
    }

    /// Stored document layout.
    pub fn layout(&self) -> &DocumentLayout {
        &self.layout
    }

    /// Mutable layout draft the tab edits.
    pub fn layout_mut(&mut self) -> &mut DocumentLayout {
        &mut self.layout
    }

    /// Validates and stores the layout draft; returns whether it was written.
    pub fn save_layout(&mut self, store: &Store) -> bool {
        if let Err(code) = self.layout.validate() {
            self.error = Some(if code == "layout_image_invalid" {
                "studio_layout_error_image"
            } else {
                "studio_layout_error_invalid"
            });
            self.status = None;
            return false;
        }
        match document_layout::save(store, &self.layout) {
            Ok(()) => {
                self.error = None;
                self.status = Some("studio_layout_status_saved");
                self.layout_image.texture = None;
                true
            }
            Err(_) => {
                self.error = Some("studio_layout_error_storage");
                self.status = None;
                false
            }
        }
    }

    /// Decodes the letterhead of the preview when the configured path changed.
    pub fn refresh_letterhead(&mut self, ctx: &Context) {
        let path = self.layout.letterhead_image.trim().to_string();
        if path.is_empty() {
            self.layout_image = LetterheadPreview::default();
            return;
        }
        if self.layout_image.path == path && self.layout_image.texture.is_some() {
            return;
        }
        self.layout_image = LetterheadPreview {
            texture: load_letterhead(ctx, &path),
            path,
        };
    }

    /// Runs clean mode: deletes every business record and reloads the counts.
    pub fn reset(&mut self, store: &Store) -> bool {
        self.confirm_reset = false;
        match store.reset_business_data() {
            Ok(_) => {
                self.error = None;
                self.status = Some("studio_status_cleared");
                let _ = self.refresh(store);
                true
            }
            Err(_) => {
                self.error = Some("studio_error_storage");
                self.status = None;
                false
            }
        }
    }
}

/// Draws the Studio drawer while it is open and reports whether it stays open.
///
/// The drawer is an overlay above the desktop, like the shell overlays: it traps the focus while it
/// is visible, so the desktop behind it is not reachable with Tab. Escape, the close button and a
/// click outside hand the focus back to the taskbar button that opened it.
pub fn studio_drawer(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StudioState,
    store: &Store,
) -> bool {
    if !state.open {
        return false;
    }
    let key = Id::new("socdof-studio-drawer");
    if focus.escape() {
        state.close();
        if focus.is_overlay_open() {
            focus.close_overlay();
        }
        return false;
    }
    if !focus.is_overlay_open() {
        focus.open_overlay_for(key, Id::new("socdof-taskbar-studio"));
    }
    focus.collecting(true);

    let mut save = false;
    let mut save_layout = false;
    let mut ask_reset = false;
    let mut close = false;
    let screen = ctx.screen_rect();
    let panel = egui::Area::new(key)
        .order(egui::Order::Foreground)
        .anchor(Align2::RIGHT_TOP, Vec2::ZERO)
        .show(ctx, |ui| {
            egui::Frame::none()
                .fill(theme.palette.surface)
                .stroke(Stroke::new(1.0_f32, theme.palette.border))
                .inner_margin(egui::Margin::same(16.0))
                .show(ui, |ui| {
                    ui.set_width(368.0);
                    ui.set_min_height((screen.height() - 34.0).max(360.0));
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(texts.get("studio_title"))
                                .size(FONT_HEADING)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if icon_button(ui, theme, focus, Icon::Close, texts.get("drawer_close"))
                                .activated
                            {
                                close = true;
                            }
                        });
                    });
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new(texts.get("studio_subtitle"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    let labels = [
                        texts.get("studio_tab_company"),
                        texts.get("studio_tab_data"),
                        texts.get("studio_tab_layout"),
                    ];
                    let mut index = state.tab.index();
                    if tabs(ui, theme, focus, &labels, &mut index) {
                        state.set_tab(StudioTab::from_index(index));
                    }
                    ui.add_space(10.0);
                    egui::ScrollArea::vertical()
                        .auto_shrink([false, false])
                        .show(ui, |ui| match state.tab {
                            StudioTab::Company => {
                                company_tab(ui, theme, texts, focus, state, &mut save)
                            }
                            StudioTab::Data => {
                                data_tab(ui, theme, texts, focus, state, &mut ask_reset)
                            }
                            StudioTab::Layout => {
                                layout_tab(ctx, ui, theme, texts, focus, state, &mut save_layout)
                            }
                        });
                });
        });
    focus.collecting(false);

    if !close {
        let outside = ctx.input(|input| {
            input.pointer.any_click()
                && input
                    .pointer
                    .interact_pos()
                    .is_some_and(|pos| !panel.response.rect.contains(pos))
        });
        if outside {
            close = true;
        }
    }
    if close {
        state.close();
        if focus.is_overlay_open() {
            focus.close_overlay();
        }
        return false;
    }
    if save {
        state.save(store);
    }
    if save_layout {
        state.save_layout(store);
    }
    if ask_reset {
        state.confirm_reset = true;
    }
    if state.confirm_reset {
        let mut visible = true;
        let mut confirm = false;
        let mut cancel = false;
        focus.collecting(true);
        modal_reset(
            ctx,
            theme,
            texts,
            focus,
            &mut visible,
            &mut confirm,
            &mut cancel,
        );
        focus.collecting(false);
        if confirm {
            state.reset(store);
        } else if cancel || !visible || focus.escape() {
            state.confirm_reset = false;
        }
    }
    state.open
}

/// Confirmation dialog of the clean mode.
fn modal_reset(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    visible: &mut bool,
    confirm: &mut bool,
    cancel: &mut bool,
) {
    crate::components::modal(
        ctx,
        theme,
        visible,
        texts.get("studio_reset_confirm_title"),
        |ui| {
            ui.label(texts.get("studio_reset_confirm_body"));
            ui.add_space(12.0);
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("studio_reset_confirm_action"),
                    ButtonVariant::Danger,
                )
                .activated
                {
                    *confirm = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("studio_reset_cancel"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    *cancel = true;
                }
            });
            *confirm || *cancel
        },
    );
}

/// Letterhead tab: the company profile fields and the save action.
fn company_tab(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StudioState,
    save: &mut bool,
) {
    if !state.profile.is_configured() {
        empty_state(
            ui,
            theme,
            texts.get("studio_empty_title"),
            texts.get("studio_empty_hint"),
        );
    }
    card(ui, theme, |ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.name,
            texts.get("settings_profile_name"),
            texts.get("settings_profile_name_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.street,
            texts.get("settings_profile_street"),
            texts.get("settings_profile_street_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.zip_city,
            texts.get("settings_profile_zip_city"),
            texts.get("settings_profile_zip_city_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.country,
            texts.get("settings_profile_country"),
            texts.get("settings_profile_country_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.email,
            texts.get("settings_profile_email"),
            texts.get("settings_profile_email_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.phone,
            texts.get("settings_profile_phone"),
            texts.get("settings_profile_phone_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.tax_id,
            texts.get("settings_profile_tax_id"),
            texts.get("settings_profile_tax_id_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.currency,
            texts.get("settings_profile_currency"),
            texts.get("settings_profile_currency_hint"),
            None,
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("studio_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            *save = true;
        }
    });
    messages(ui, theme, texts, state);
}

/// Data tab: the record counts and the clean-mode action.
fn data_tab(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StudioState,
    ask_reset: &mut bool,
) {
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("studio_counts_title")).strong());
        ui.add_space(6.0);
        count_row(
            ui,
            theme,
            texts.get("studio_count_contacts"),
            state.counts.contacts,
        );
        count_row(
            ui,
            theme,
            texts.get("studio_count_products"),
            state.counts.products,
        );
        count_row(
            ui,
            theme,
            texts.get("studio_count_invoices"),
            state.counts.invoices,
        );
        count_row(
            ui,
            theme,
            texts.get("studio_count_purchases"),
            state.counts.purchase_orders,
        );
        count_row(
            ui,
            theme,
            texts.get("studio_count_receipts"),
            state.counts.pos_orders,
        );
        ui.add_space(4.0);
        ui.separator();
        ui.add_space(4.0);
        count_row(
            ui,
            theme,
            texts.get("studio_count_total"),
            state.counts.total(),
        );
    });
    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("studio_reset_title")).strong());
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("studio_reset_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("studio_reset_button"),
            ButtonVariant::Danger,
        )
        .activated
        {
            *ask_reset = true;
        }
    });
    messages(ui, theme, texts, state);
}

/// Layout tab: letterhead background, token placement and the page preview.
fn layout_tab(
    ctx: &Context,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StudioState,
    save: &mut bool,
) {
    state.refresh_letterhead(ctx);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("studio_layout_title")).strong());
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("studio_layout_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("studio_layout_pagination"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(8.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.layout.letterhead_image,
            texts.get("studio_layout_background"),
            texts.get("studio_layout_background_hint"),
            None,
        );
    });
    ui.add_space(10.0);
    layout_preview(ui, theme, texts, state);
    ui.add_space(10.0);
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("studio_layout_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            *save = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("studio_layout_reset"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.layout = DocumentLayout::default();
            state.layout_image = LetterheadPreview::default();
        }
    });
    ui.add_space(10.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("studio_layout_tokens")).strong());
        for token in &mut state.layout.tokens {
            ui.horizontal(|ui| {
                ui.checkbox(&mut token.enabled, texts.get(token.key.label_key()));
                egui::ComboBox::from_id_source(("layout-align", token.key.as_str()))
                    .selected_text(align_label(texts, token.align))
                    .show_ui(ui, |ui| {
                        for (align, key) in [
                            (TokenAlign::Left, "studio_layout_align_left"),
                            (TokenAlign::Center, "studio_layout_align_center"),
                            (TokenAlign::Right, "studio_layout_align_right"),
                        ] {
                            ui.selectable_value(&mut token.align, align, texts.get(key));
                        }
                    });
            });
            ui.horizontal(|ui| {
                ui.add(
                    egui::DragValue::new(&mut token.x_pct)
                        .speed(0.5)
                        .clamp_range(0.0..=100.0)
                        .prefix("x ")
                        .suffix(" %"),
                )
                .on_hover_text(texts.get("studio_layout_x"));
                ui.add(
                    egui::DragValue::new(&mut token.y_pct)
                        .speed(0.5)
                        .clamp_range(0.0..=100.0)
                        .prefix("y ")
                        .suffix(" %"),
                )
                .on_hover_text(texts.get("studio_layout_y"));
                ui.add(
                    egui::DragValue::new(&mut token.size_pt)
                        .speed(0.2)
                        .clamp_range(5.0..=72.0)
                        .suffix(" pt"),
                )
                .on_hover_text(texts.get("studio_layout_size"));
                ui.checkbox(&mut token.bold, texts.get("studio_layout_bold"));
            });
        }
    });
    messages(ui, theme, texts, state);
}

fn align_label(texts: &UiTexts, align: TokenAlign) -> &str {
    texts.get(match align {
        TokenAlign::Left => "studio_layout_align_left",
        TokenAlign::Center => "studio_layout_align_center",
        TokenAlign::Right => "studio_layout_align_right",
    })
}

/// Page preview with the letterhead and the enabled tokens.
fn layout_preview(ui: &mut Ui, theme: &Theme, texts: &UiTexts, state: &StudioState) {
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("studio_layout_preview")).strong());
        ui.add_space(6.0);
        let width = ui.available_width().min(180.0);
        let height = width * 297.0 / 210.0;
        let (rect, _) = ui.allocate_exact_size(egui::vec2(width, height), egui::Sense::hover());
        let painter = ui.painter();
        painter.rect_filled(rect, 2.0, egui::Color32::WHITE);
        if let Some(texture) = &state.layout_image.texture {
            painter.image(
                texture.id(),
                rect,
                egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
                egui::Color32::WHITE,
            );
        } else {
            painter.text(
                rect.center(),
                Align2::CENTER_CENTER,
                texts.get("studio_layout_no_image"),
                egui::FontId::proportional(FONT_SMALL),
                theme.palette.text_muted,
            );
        }
        painter.rect_stroke(rect, 2.0, Stroke::new(1.0_f32, theme.palette.border));
        let scale = rect.width() / (210.0 * 72.0 / 25.4);
        for token in state.layout.tokens.iter().filter(|token| token.enabled) {
            let text = state
                .layout
                .token_text(token.key, &state.profile, None)
                .unwrap_or_else(|| texts.get(token.key.label_key()).to_string());
            let position = rect.min
                + egui::vec2(
                    rect.width() * token.x_pct as f32 / 100.0,
                    rect.height() * token.y_pct as f32 / 100.0,
                );
            let align = match token.align {
                TokenAlign::Left => Align2::LEFT_TOP,
                TokenAlign::Center => Align2::CENTER_TOP,
                TokenAlign::Right => Align2::RIGHT_TOP,
            };
            painter.text(
                position,
                align,
                text,
                egui::FontId::proportional((token.size_pt as f32 * scale).max(5.0)),
                theme.palette.text,
            );
        }
    });
}

/// Decodes a PNG letterhead into a texture for the preview.
fn load_letterhead(ctx: &Context, path: &str) -> Option<egui::TextureHandle> {
    let file = std::fs::File::open(path).ok()?;
    let decoder = png::Decoder::new(std::io::BufReader::new(file));
    let mut reader = decoder.read_info().ok()?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer).ok()?;
    let samples = &buffer[..info.buffer_size()];
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => samples.to_vec(),
        png::ColorType::Rgb => samples
            .chunks_exact(3)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2], 255])
            .collect(),
        png::ColorType::Grayscale => samples
            .iter()
            .flat_map(|value| [*value, *value, *value, 255])
            .collect(),
        _ => return None,
    };
    let image = egui::ColorImage::from_rgba_unmultiplied(
        [info.width as usize, info.height as usize],
        &rgba,
    );
    Some(ctx.load_texture(
        format!("socdof-letterhead-{path}"),
        image,
        egui::TextureOptions::LINEAR,
    ))
}

/// Decoded letterhead texture of the preview; egui's handle has no `Debug`.
#[derive(Clone, Default)]
struct LetterheadPreview {
    path: String,
    texture: Option<egui::TextureHandle>,
}

impl std::fmt::Debug for LetterheadPreview {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LetterheadPreview")
            .field("path", &self.path)
            .field("loaded", &self.texture.is_some())
            .finish()
    }
}

/// Deterministic layout of the gallery and preview scenes.
pub fn gallery_layout() -> DocumentLayout {
    let mut layout = DocumentLayout {
        letterhead_image: concat!(env!("CARGO_MANIFEST_DIR"), "/assets/letterhead-sample.png")
            .to_string(),
        ..Default::default()
    };
    for token in &mut layout.tokens {
        token.enabled = matches!(
            token.key,
            socdof_core::document_layout::TokenKey::CompanyName
                | socdof_core::document_layout::TokenKey::InvoiceNumber
                | socdof_core::document_layout::TokenKey::InvoiceDate
        );
    }
    layout
}

/// One label/value row of the data tab.
fn count_row(ui: &mut Ui, theme: &Theme, label: &str, value: i64) {
    ui.horizontal(|ui| {
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(value.to_string()).strong());
        });
    });
}

/// Renders the error and success messages of the last action.
fn messages(ui: &mut Ui, theme: &Theme, texts: &UiTexts, state: &StudioState) {
    if let Some(key) = state.error {
        ui.add_space(8.0);
        badge(ui, theme, texts.get(key), Tone::Danger);
    } else if let Some(key) = state.status {
        ui.add_space(8.0);
        badge(ui, theme, texts.get(key), Tone::Success);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use egui::{Pos2, RawInput, Rect, Vec2};
    use socdof_core::domain::contact::{Contact, ContactKind};
    use socdof_core::domain::product::Product;
    use socdof_core::domain::settings::Language;

    fn texts() -> UiTexts {
        UiTexts::embedded(Language::De).expect("catalogue")
    }

    fn profile() -> CompanyProfile {
        CompanyProfile {
            name: "Studio Lindner".to_string(),
            street: "Hauptstraße 4".to_string(),
            zip_city: "10115 Berlin".to_string(),
            ..Default::default()
        }
    }

    fn store_with_records() -> Store {
        let store = Store::open_in_memory().expect("store");
        store.save_company_profile(&profile()).expect("profile");
        let mut contact = Contact::new(ContactKind::Company, 1_000);
        contact.name = Some("AlpenTech".to_string());
        store.insert_contact(&contact).expect("contact");
        let mut product = Product::new("Kaffee", 1_000);
        product.sku = "K-1".to_string();
        store.insert_product(&product).expect("product");
        store
    }

    #[test]
    fn opens_on_the_letterhead_with_counts() {
        let store = store_with_records();
        let mut state = StudioState::new();
        state.open(&store);

        assert!(state.is_open());
        assert_eq!(state.tab(), StudioTab::Company);
        assert_eq!(state.draft().name, "Studio Lindner");
        assert_eq!(state.counts().contacts, 1);
        assert_eq!(state.counts().products, 1);
        assert_eq!(state.counts().total(), 2);
        assert_eq!(state.error(), None);
    }

    #[test]
    fn saves_the_letterhead_through_the_settings_service() {
        let store = Store::open_in_memory().expect("store");
        let mut state = StudioState::new();
        state.open(&store);

        state.draft.name = "Neue Firma GmbH".to_string();
        state.draft.street = "Musterweg 8".to_string();
        assert!(state.save(&store));

        assert_eq!(state.status(), Some("studio_status_saved"));
        let stored = store.company_profile().expect("profile");
        assert_eq!(stored.name, "Neue Firma GmbH");
        assert_eq!(stored.street, "Musterweg 8");
        // The drawer keeps the fields it does not edit.
        assert_eq!(stored.currency, "€");
    }

    #[test]
    fn rejects_a_letterhead_without_a_company_name() {
        let store = store_with_records();
        let mut state = StudioState::new();
        state.open(&store);
        state.draft.name = "   ".to_string();

        assert!(!state.save(&store));

        assert_eq!(state.error(), Some("studio_error_name"));
        assert_eq!(
            store.company_profile().expect("profile").name,
            "Studio Lindner"
        );
    }

    #[test]
    fn clean_mode_removes_records_and_keeps_the_configuration() {
        let store = store_with_records();
        let mut state = StudioState::new();
        state.open(&store);

        state.confirm_reset = true;
        assert!(state.reset(&store));

        assert!(!state.confirm_reset());
        assert_eq!(state.status(), Some("studio_status_cleared"));
        assert_eq!(state.counts().total(), 0);
        assert_eq!(store.contact_count().expect("contacts"), 0);
        assert_eq!(
            store.company_profile().expect("profile").name,
            "Studio Lindner"
        );
    }

    #[test]
    fn renders_the_empty_letterhead_and_the_error_message() {
        let store = Store::open_in_memory().expect("store");
        let mut state = StudioState::new();
        state.open(&store);
        // An empty profile renders the empty state above the fields.
        assert!(!store.company_profile().expect("profile").is_configured());
        // Saving without a name renders the error badge instead of writing.
        assert!(!state.save(&store));
        assert_eq!(state.error(), Some("studio_error_name"));
        let ctx = Context::default();
        let theme = Theme::new(Appearance::Light, "indigo");
        let texts = texts();
        let mut focus = FocusState::default();
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 900.0))),
            time: Some(1.0),
            ..Default::default()
        };
        let mut shapes = 0;
        for _ in 0..2 {
            let output = ctx.run(input.clone(), |ctx| {
                focus.begin_frame(ctx);
                theme.apply(ctx);
                studio_drawer(ctx, &theme, &texts, &mut focus, &mut state, &store);
                focus.finish_frame();
            });
            shapes = output.shapes.len();
        }
        assert!(shapes > 10, "studio drew little");
    }

    #[test]
    fn saves_layout_positions_and_rejects_invalid_values() {
        let store = store_with_records();
        let mut state = StudioState::new();
        state.open(&store);
        state.layout_mut().letterhead_image = "briefpapier.png".to_string();
        state.layout_mut().tokens[0].x_pct = 12.5;
        state.layout_mut().tokens[0].enabled = true;

        assert!(state.save_layout(&store));
        assert_eq!(state.status(), Some("studio_layout_status_saved"));
        let stored = document_layout::load(&store).expect("layout");
        assert_eq!(stored.tokens[0].x_pct, 12.5);
        assert!(stored.tokens[0].enabled);

        state.layout_mut().tokens[0].x_pct = 140.0;
        assert!(!state.save_layout(&store));
        assert_eq!(state.error(), Some("studio_layout_error_invalid"));
        assert_eq!(
            document_layout::load(&store).expect("unchanged").tokens[0].x_pct,
            12.5
        );
    }

    #[test]
    fn renders_both_tabs_in_both_appearances() {
        let store = store_with_records();
        let mut state = StudioState::new();
        state.open(&store);
        for appearance in [Appearance::Light, Appearance::Dark] {
            let theme = Theme::new(appearance, "indigo");
            let texts = texts();
            for tab in [StudioTab::Company, StudioTab::Data, StudioTab::Layout] {
                state.set_tab(tab);
                let ctx = Context::default();
                let mut focus = FocusState::default();
                let input = RawInput {
                    screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 900.0))),
                    time: Some(1.0),
                    ..Default::default()
                };
                let mut shapes = 0;
                for _ in 0..2 {
                    let output = ctx.run(input.clone(), |ctx| {
                        focus.begin_frame(ctx);
                        theme.apply(ctx);
                        studio_drawer(ctx, &theme, &texts, &mut focus, &mut state, &store);
                        focus.finish_frame();
                    });
                    shapes = output.shapes.len();
                }
                assert!(shapes > 10, "studio drew little on {tab:?}");
            }
        }
    }
}
