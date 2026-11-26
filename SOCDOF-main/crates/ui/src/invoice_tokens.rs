//! Interactive stationery token editor of the invoice template dialog.
//!
//! The canvas is an A4 sheet drawn to scale: the stationery image fills the page, every token is
//! painted with the same percentage position, CSS-pixel font size, weight, colour and alignment
//! that the PDF export uses. Dragging a field writes the same `xPct`/`yPct` percentages into the
//! template, so what the dialog shows is what the exports contain.

use egui::{
    Align2, Color32, ColorImage, Context, FontId, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2,
};

use socdof_core::invoice_template::{
    self, html_to_text, layout_stationery_token, StationeryTextLayout,
};
use socdof_core::pdf::writer::mm;

use crate::components::{button, ButtonVariant};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::invoice_templates::{InvoiceTemplatesState, TemplatePreview};
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Cached stationery texture of the preview canvas.
///
/// The texture is an editor detail: it never belongs to the template and must not influence the
/// dirty comparison, so equality ignores it.
#[derive(Clone, Default)]
pub(crate) struct PreviewTexture(pub(crate) Option<egui::TextureHandle>);

impl std::fmt::Debug for PreviewTexture {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("PreviewTexture")
    }
}

impl PartialEq for PreviewTexture {
    fn eq(&self, _other: &Self) -> bool {
        true
    }
}

/// Draws the stationery placement studio: field toolbar, A4 canvas and property inspector.
pub(crate) fn stationery_editor(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
    preview: TemplatePreview<'_>,
) {
    ui.add_space(6.0);
    ui.label(RichText::new(texts.get("invoices_template_token_title")).strong());
    ui.label(
        RichText::new(texts.get("invoices_template_token_hint"))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    ui.add_space(4.0);

    ui.horizontal_wrapped(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_template_token_defaults"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            state.apply_default_stationery_tokens();
        }
        egui::ComboBox::from_id_source("stationery-new-token-key")
            .width(170.0)
            .selected_text(state.new_token_key.clone())
            .show_ui(ui, |ui| {
                for key in invoice_template::STATIONERY_TOKEN_KEYS {
                    ui.selectable_value(&mut state.new_token_key, (*key).to_string(), *key);
                }
            });
        if button(
            ui,
            theme,
            focus,
            texts.get("invoices_template_token_add"),
            ButtonVariant::Primary,
        )
        .activated
        {
            let key = state.new_token_key.clone();
            state.add_stationery_token(&key);
        }
    });

    ui.add_space(4.0);
    ui.horizontal_top(|ui| {
        token_canvas(ui, theme, texts, state, &preview);
        ui.add_space(8.0);
        token_inspector(ui, theme, texts, focus, state);
    });
}

fn token_canvas(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &mut InvoiceTemplatesState,
    preview: &TemplatePreview<'_>,
) {
    refresh_texture(ui.ctx(), state);
    let values = token_values(state, preview);
    let width = 280.0_f32;
    let height = width * 297.0 / 210.0;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width, height), Sense::click_and_drag());
    let painter = ui.painter_at(rect);
    painter.rect_filled(rect, 3.0, Color32::WHITE);

    if let Some(texture) = &state.stationery_texture.0 {
        painter.image(
            texture.id(),
            rect,
            Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
            Color32::WHITE,
        );
    } else {
        painter.text(
            rect.center(),
            Align2::CENTER_CENTER,
            texts.get("invoices_template_token_no_stationery"),
            FontId::proportional(11.0),
            theme.palette.text_muted,
        );
    }

    let accent = {
        let [red, green, blue] = state.draft.color();
        Color32::from_rgb(
            (red * 255.0).round() as u8,
            (green * 255.0).round() as u8,
            (blue * 255.0).round() as u8,
        )
    };
    let mut frames: Vec<(String, Rect)> = Vec::new();

    for (index, token) in state.draft.stationery_tokens.iter().enumerate() {
        let text = match values.get(index).and_then(Option::as_deref) {
            Some(text) if !text.trim().is_empty() => text,
            _ => continue,
        };
        let [red, green, blue] = token.color_rgb();
        let color = Color32::from_rgb(
            (red * 255.0).round() as u8,
            (green * 255.0).round() as u8,
            (blue * 255.0).round() as u8,
        );
        let layout = layout_stationery_token(token, text);
        let lines = preview_lines(rect, &layout);
        if lines.iter().all(|line| line.text.is_empty()) {
            continue;
        }
        let font_size = (layout.font_size_pt / mm(210.0)) as f32 * rect.width();
        let line_height = (layout.line_height_mm / 297.0) as f32 * rect.height();
        let field_width = layout
            .field_width_pt
            .map(|width| (width / mm(210.0)) as f32 * rect.width());
        let box_x = rect.left() + (layout.anchor_pt / mm(210.0)) as f32 * rect.width();
        let box_width =
            field_width.unwrap_or_else(|| lines.iter().map(|line| line.width).fold(0.0, f32::max));
        let box_top = lines.first().map(|line| line.top).unwrap_or(rect.top());
        let selected = state.selected_token.as_deref() == Some(token.id.as_str());
        let stroke = if selected {
            Stroke::new(1.5_f32, accent)
        } else {
            Stroke::new(1.0_f32, theme.palette.border)
        };
        let box_rect = Rect::from_min_size(
            Pos2::new(box_x, box_top),
            Vec2::new(
                box_width.max(1.0),
                (line_height * lines.len() as f32).max(1.0),
            ),
        )
        .expand(2.0);
        painter.rect_stroke(box_rect, 2.0, stroke);
        for line in &lines {
            if line.text.is_empty() {
                continue;
            }
            let position = Pos2::new(line.x, line.top);
            painter.text(
                position,
                Align2::LEFT_TOP,
                &line.text,
                FontId::proportional(font_size),
                color,
            );
            if token.bold() {
                // egui ships no bold face; a half-pixel second pass reads as bold in the preview.
                painter.text(
                    position + Vec2::new(0.5, 0.0),
                    Align2::LEFT_TOP,
                    &line.text,
                    FontId::proportional(font_size),
                    color,
                );
            }
        }
        frames.push((token.id.clone(), box_rect));
    }

    if response.clicked() {
        if let Some(position) = response.interact_pointer_pos() {
            if let Some((id, _)) = frames.iter().find(|(_, frame)| frame.contains(position)) {
                state.selected_token = Some(id.clone());
            } else if let Some(id) = state.selected_token.clone() {
                state.move_stationery_token(
                    &id,
                    percent_x(rect, position),
                    percent_y(rect, position),
                );
            }
        }
    }
    if response.drag_started() {
        if let Some(position) = response.interact_pointer_pos() {
            if let Some((id, _)) = frames.iter().find(|(_, frame)| frame.contains(position)) {
                state.selected_token = Some(id.clone());
                state.dragging_token = Some(id.clone());
            }
        }
    }
    if response.dragged() {
        if let (Some(id), Some(position)) = (
            state.dragging_token.clone(),
            response.interact_pointer_pos(),
        ) {
            state.move_stationery_token(&id, percent_x(rect, position), percent_y(rect, position));
        }
    }
    if response.drag_stopped() {
        state.dragging_token = None;
    }
}

fn token_inspector(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
) {
    ui.vertical(|ui| {
        ui.set_min_width(236.0);
        ui.label(RichText::new(texts.get("invoices_template_token_title")).strong());
        ui.add_space(2.0);

        if let Some(index) = selected_index(state) {
            token_properties(ui, theme, texts, focus, state, index);
        } else {
            ui.label(
                RichText::new(texts.get("invoices_template_token_select"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }

        ui.add_space(6.0);
        ui.separator();
        ui.label(
            RichText::new(format!(
                "{} ({})",
                texts.get("invoices_template_token_count"),
                state.draft.stationery_tokens.len()
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        ui.add_space(2.0);
        let mut choose = None;
        for token in &state.draft.stationery_tokens {
            let label = format!(
                "{} · X {:.1}% · Y {:.1}%",
                token.token_key,
                token.x_percent(),
                token.y_percent()
            );
            let variant = if state.selected_token.as_deref() == Some(token.id.as_str()) {
                ButtonVariant::Secondary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, &label, variant).activated {
                choose = Some(token.id.clone());
            }
        }
        if let Some(id) = choose {
            state.selected_token = Some(id);
        }
        if state.draft.stationery_tokens.is_empty() {
            ui.label(
                RichText::new(texts.get("invoices_template_token_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }

        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("invoices_template_token_canvas_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
}

fn token_properties(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut InvoiceTemplatesState,
    index: usize,
) {
    let before = state.draft.stationery_tokens[index].clone();
    let mut delete = None;
    {
        let token = &mut state.draft.stationery_tokens[index];
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("invoices_template_token_key"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            if button(
                ui,
                theme,
                focus,
                texts.get("invoices_template_token_delete"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                delete = Some(token.id.clone());
            }
        });
        egui::ComboBox::from_id_source(("stationery-token-key", &token.id))
            .width(210.0)
            .selected_text(token.token_key.clone())
            .show_ui(ui, |ui| {
                for key in invoice_template::STATIONERY_TOKEN_KEYS {
                    ui.selectable_value(&mut token.token_key, (*key).to_string(), *key);
                }
            });

        ui.add_space(2.0);
        ui.label(
            RichText::new(format!(
                "{}: {:.1}%",
                texts.get("invoices_template_token_x"),
                token.x_pct
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        ui.add(
            egui::Slider::new(&mut token.x_pct, 0.0..=95.0)
                .step_by(0.5)
                .show_value(false),
        );
        ui.label(
            RichText::new(format!(
                "{}: {:.1}%",
                texts.get("invoices_template_token_y"),
                token.y_pct
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        ui.add(
            egui::Slider::new(&mut token.y_pct, 0.0..=95.0)
                .step_by(0.5)
                .show_value(false),
        );

        let width_label = token
            .width_pct
            .map(|width| format!("{width:.0}%"))
            .unwrap_or_else(|| texts.get("invoices_template_token_auto").to_string());
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(format!(
                    "{}: {width_label}",
                    texts.get("invoices_template_token_width")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            if token.width_pct.is_some()
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("invoices_template_token_auto"),
                    ButtonVariant::Ghost,
                )
                .activated
            {
                token.width_pct = None;
            }
        });
        let mut width = token.width_pct.unwrap_or(30.0);
        if ui
            .add(egui::Slider::new(&mut width, 10.0..=90.0).show_value(false))
            .changed()
        {
            token.width_pct = Some(width.round());
        }

        ui.label(
            RichText::new(format!(
                "{}: {:.0} px",
                texts.get("invoices_template_token_size"),
                token.font_size.unwrap_or(13.0)
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
        let mut size = token.font_size.unwrap_or(13.0);
        if ui
            .add(egui::Slider::new(&mut size, 8.0..=28.0).show_value(false))
            .changed()
        {
            token.font_size = Some(size.round());
        }

        ui.add_space(2.0);
        ui.label(
            RichText::new(texts.get("invoices_template_token_weight"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.horizontal(|ui| {
            let normal = if token.bold() {
                ButtonVariant::Ghost
            } else {
                ButtonVariant::Primary
            };
            if button(
                ui,
                theme,
                focus,
                texts.get("invoices_template_token_normal"),
                normal,
            )
            .activated
            {
                token.font_weight = "normal".to_string();
            }
            let bold = if token.bold() {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(
                ui,
                theme,
                focus,
                texts.get("invoices_template_token_bold"),
                bold,
            )
            .activated
            {
                token.font_weight = "bold".to_string();
            }
        });

        ui.label(
            RichText::new(texts.get("invoices_template_token_align"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.horizontal(|ui| {
            for (value, key) in [
                ("left", "invoices_template_left"),
                ("center", "invoices_template_center"),
                ("right", "invoices_template_right"),
            ] {
                let variant = if token.alignment() == value {
                    ButtonVariant::Primary
                } else {
                    ButtonVariant::Ghost
                };
                if button(ui, theme, focus, texts.get(key), variant).activated {
                    token.align = value.to_string();
                }
            }
        });

        let mut color = token.color.clone();
        crate::controls::text_field(
            ui,
            theme,
            focus,
            &mut color,
            texts.get("invoices_template_color"),
            "#0f172a",
            None,
        );
        if color != token.color {
            token.color = color;
        }
    }

    if let Some(id) = delete {
        state.remove_stationery_token(&id);
        return;
    }
    if state
        .draft
        .stationery_tokens
        .get(index)
        .map(|token| *token != before)
        .unwrap_or(false)
    {
        state.mark_dirty();
    }
}

fn selected_index(state: &InvoiceTemplatesState) -> Option<usize> {
    let id = state.selected_token.as_deref()?;
    state
        .draft
        .stationery_tokens
        .iter()
        .position(|token| token.id == id)
}

fn token_values(
    state: &InvoiceTemplatesState,
    preview: &TemplatePreview<'_>,
) -> Vec<Option<String>> {
    match (preview.invoice, preview.contact) {
        (Some(invoice), Some(contact)) => {
            let variables =
                state
                    .draft
                    .variables(invoice, contact, preview.company, preview.currency);
            state
                .draft
                .stationery_tokens
                .iter()
                .map(|token| {
                    let raw = variables
                        .get(token.token_key.trim())
                        .cloned()
                        .unwrap_or_else(|| token.token_key.clone());
                    let text = html_to_text(&raw);
                    if text.trim().is_empty() {
                        None
                    } else {
                        Some(text)
                    }
                })
                .collect()
        }
        _ => state
            .draft
            .stationery_tokens
            .iter()
            .map(|token| Some(token.token_key.clone()))
            .collect(),
    }
}

fn refresh_texture(ctx: &Context, state: &mut InvoiceTemplatesState) {
    let key = texture_key(&state.draft.stationery_source);
    if state.stationery_texture_key == key {
        return;
    }
    state.stationery_texture_key = key;
    let texture = state.draft.stationery_image().map(|image| {
        let pixels =
            ColorImage::from_rgb([image.width as usize, image.height as usize], &image.rgb);
        ctx.load_texture(
            "socdof-stationery-preview",
            pixels,
            egui::TextureOptions::LINEAR,
        )
    });
    state.stationery_texture = PreviewTexture(texture);
}

pub(crate) fn texture_key(source: &str) -> String {
    // Cheap fingerprint: data URLs can be tens of megabytes, and this runs every frame.
    let head: String = source.chars().take(48).collect();
    let tail: String = source.chars().rev().take(24).collect();
    format!("{}:{head}:{tail}", source.len())
}

/// One export line positioned in canvas pixels.
#[derive(Debug)]
struct PreviewLine {
    text: String,
    x: f32,
    top: f32,
    width: f32,
}

fn preview_lines(canvas: Rect, layout: &StationeryTextLayout) -> Vec<PreviewLine> {
    let page_width_pt = mm(210.0);
    layout
        .lines
        .iter()
        .map(|line| PreviewLine {
            text: line.text.clone(),
            x: canvas.left() + (line.x_pt / page_width_pt) as f32 * canvas.width(),
            top: canvas.top() + (line.top_mm / 297.0) as f32 * canvas.height(),
            width: (line.width_pt / page_width_pt) as f32 * canvas.width(),
        })
        .collect()
}

fn percent_x(canvas: Rect, position: Pos2) -> f64 {
    (((position.x - canvas.left()) / canvas.width()) * 100.0).clamp(0.0, 95.0) as f64
}

fn percent_y(canvas: Rect, position: Pos2) -> f64 {
    (((position.y - canvas.top()) / canvas.height()) * 100.0).clamp(0.0, 95.0) as f64
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{pos2, vec2};

    fn a4_points() -> Rect {
        Rect::from_min_size(pos2(0.0, 0.0), vec2(mm(210.0) as f32, mm(297.0) as f32))
    }

    #[test]
    fn preview_geometry_uses_the_pdf_percentages_and_points() {
        let canvas = a4_points();
        let mut token = invoice_template::new_stationery_token("tok", "{Status}");
        token.x_pct = 65.0;
        token.y_pct = 22.0;
        token.width_pct = Some(30.0);
        token.align = "right".to_string();

        let layout = layout_stationery_token(&token, "Offen");
        assert!((layout.anchor_pt - 0.65 * mm(210.0)).abs() < 0.01);
        assert!((layout.lines[0].top_mm - 0.22 * 297.0).abs() < 0.01);
        // 13 CSS px at the A4 point width are exactly the 9.75 pt of the PDF export.
        assert!((layout.font_size_pt - 9.75).abs() < 0.01);
        let field = layout.field_width_pt.expect("field width");
        let line = &layout.lines[0];
        assert!((line.x_pt - (layout.anchor_pt + field - line.width_pt)).abs() < 1e-9);

        let preview = preview_lines(canvas, &layout);
        assert!((preview[0].x - line.x_pt as f32).abs() < 0.01);
        assert!((preview[0].top - mm(line.top_mm) as f32).abs() < 0.01);
    }

    #[test]
    fn long_token_text_matches_the_shared_export_layout() {
        let canvas = a4_points();
        let mut token = invoice_template::new_stationery_token("tok", "{Firma_Website}");
        token.x_pct = 10.0;
        token.y_pct = 40.0;
        token.width_pct = Some(30.0);
        token.font_size = Some(11.0);
        token.align = "right".to_string();
        let text = "This is a very long stationery text that must wrap across several lines while keeping exactly the same line offsets in the preview and the exported document";
        let layout = layout_stationery_token(&token, text);
        assert!(layout.lines.len() >= 4);
        let preview = preview_lines(canvas, &layout);
        assert_eq!(preview.len(), layout.lines.len());
        for (line, preview) in layout.lines.iter().zip(preview) {
            assert_eq!(preview.text, line.text);
            assert!((preview.x - line.x_pt as f32).abs() < 0.01);
            assert!((preview.top - mm(line.top_mm) as f32).abs() < 0.01);
        }

        token.width_pct = None;
        let layout = layout_stationery_token(&token, "Zeile eins\nZeile zwei\nZeile drei");
        assert_eq!(layout.lines.len(), 3);
        assert!(layout
            .lines
            .iter()
            .all(|line| (line.x_pt - layout.anchor_pt).abs() < 1e-9));
        let preview = preview_lines(canvas, &layout);
        assert_eq!(preview.len(), 3);
        for (line, preview) in layout.lines.iter().zip(preview) {
            assert!((preview.top - mm(line.top_mm) as f32).abs() < 0.01);
        }
    }

    #[test]
    fn texture_key_changes_with_the_stationery_source() {
        assert_eq!(
            texture_key("data:image/png;base64,AAAA"),
            texture_key("data:image/png;base64,AAAA")
        );
        assert_ne!(
            texture_key("data:image/png;base64,AAAA"),
            texture_key("data:image/png;base64,AAAB")
        );
    }

    #[test]
    fn dragging_clamps_to_the_page_and_rounds_to_tenths() {
        let canvas = Rect::from_min_size(pos2(10.0, 20.0), vec2(400.0, 565.7));
        assert!((percent_x(canvas, pos2(-50.0, 0.0)) - 0.0).abs() < f64::EPSILON);
        assert!((percent_y(canvas, pos2(0.0, -50.0)) - 0.0).abs() < f64::EPSILON);
        assert!((percent_x(canvas, pos2(1_000.0, 0.0)) - 95.0).abs() < f64::EPSILON);
        assert!((percent_y(canvas, pos2(0.0, 1_000.0)) - 95.0).abs() < f64::EPSILON);
    }
}
