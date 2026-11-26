//! Visual kit for the first-run wizard and the sign-in surface.
//!
//! The TypeScript edition draws these screens from one Tailwind vocabulary: a diagonal page
//! gradient, a 24 point card surface with a hairline border and a large soft shadow, 68 point
//! option rows, accent filled primary buttons, inset panels and colour swatches. This module ports
//! that vocabulary to egui so the two editions share one layout instead of two interpretations of
//! it. Every value is taken from the legacy markup (`AuthGate.tsx`, `index.css`).
//!
//! The kit only paints and reports activation; the screens in [`crate::auth`] keep the state and
//! the core calls.

use egui::{
    Color32, FontId, Margin, Pos2, Rect, Response, RichText, Rounding, Sense, Shape, Stroke, Ui,
    Vec2, WidgetInfo, WidgetType,
};

use crate::focus::{focus_ring, focus_ring_round, FocusState};
use crate::icons::Icon;
use crate::theme::{semibold, Theme};
use crate::tokens::{adjust, shadow_layers, with_alpha, ShadowStrength};

/// Width of the compact first-run language card (`max-w-md`).
pub const LANGUAGE_CARD_WIDTH: f32 = 448.0;
/// Width of the setup wizard and the sign-in column (`max-w-lg`).
pub const WIZARD_CARD_WIDTH: f32 = 512.0;
/// Corner radius of a card (`rounded-3xl`).
pub const CARD_RADIUS: f32 = 24.0;
/// Corner radius of an option row, panel or primary button (`rounded-2xl`).
pub const ROW_RADIUS: f32 = 16.0;
/// Height of one language or option row (`h-[68px]`).
pub const ROW_HEIGHT: f32 = 68.0;

/// Whether the theme paints dark surfaces.
pub fn dark(theme: &Theme) -> bool {
    theme.appearance.is_dark()
}

/// Background of a card: translucent white or slate-900 over the page gradient.
fn card_fill(theme: &Theme) -> Color32 {
    if dark(theme) {
        Color32::from_rgba_unmultiplied(17, 26, 43, 250)
    } else {
        Color32::from_rgba_unmultiplied(255, 255, 255, 244)
    }
}

/// Hairline border of a card, row or panel (`border-slate-200/80` / `border-white/10`).
pub fn hairline_color(theme: &Theme) -> Color32 {
    hairline(theme)
}

/// Colour the browser shows for `overlay` at `alpha` composited over the card surface.
///
/// egui blends translucent shapes in linear light, which makes small alphas look far stronger than
/// the browser does, so the kit pre-composites the Tailwind alpha values and paints opaque colours.
fn over_card(theme: &Theme, overlay: Color32, alpha: f32) -> Color32 {
    crate::wallpaper::blend(card_fill(theme), overlay, alpha)
}

/// Hairline border of a card, row or panel (`border-slate-200/80` / `border-white/10`).
fn hairline(theme: &Theme) -> Color32 {
    if dark(theme) {
        over_card(theme, Color32::WHITE, 0.10)
    } else {
        Color32::from_rgb(0xe2, 0xe8, 0xf0)
    }
}

/// Recessed surface of an inset panel or a code badge (`bg-slate-50` / `bg-white/5`).
pub fn inset_fill(theme: &Theme) -> Color32 {
    if dark(theme) {
        over_card(theme, Color32::WHITE, 0.05)
    } else {
        Color32::from_rgb(0xf8, 0xfa, 0xfc)
    }
}

/// Background of a text field inside a card (`bg-white/80` / `bg-slate-900/70`).
fn field_fill(theme: &Theme) -> Color32 {
    if dark(theme) {
        Color32::from_rgb(0x0f, 0x17, 0x2a)
    } else {
        Color32::WHITE
    }
}

/// Paints the diagonal page gradient (`from-slate-100 via-slate-50 to-indigo-50/70`).
pub fn backdrop(ui: &mut Ui, theme: &Theme) {
    let rect = ui.max_rect();
    let (top_left, top_right, bottom_right, bottom_left) = if dark(theme) {
        (
            Color32::from_rgb(0x02, 0x06, 0x17),
            Color32::from_rgb(0x08, 0x0f, 0x20),
            Color32::from_rgb(0x1e, 0x1b, 0x4b),
            Color32::from_rgb(0x06, 0x0c, 0x1c),
        )
    } else {
        (
            Color32::from_rgb(0xf1, 0xf5, 0xf9),
            Color32::from_rgb(0xf8, 0xfa, 0xfc),
            Color32::from_rgb(0xee, 0xf2, 0xff),
            Color32::from_rgb(0xf5, 0xf7, 0xfb),
        )
    };
    ui.painter().add(crate::wallpaper::gradient_mesh(
        rect,
        top_left,
        top_right,
        bottom_right,
        bottom_left,
    ));
}

/// Centers a fixed-width column in the available width.
pub fn centered<R>(ui: &mut Ui, width: f32, add: impl FnOnce(&mut Ui) -> R) -> R {
    // A form wider than the window would otherwise inflate the available width of the scroll area
    // (immediate mode reports the content width), which dragged the card to the right and clipped
    // it. Centering therefore never uses more than the screen.
    let available = ui.available_width().min(ui.ctx().screen_rect().width());
    let width = width.min(available);
    let side = ((available - width) * 0.5).max(0.0);
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = 0.0;
        ui.add_space(side);
        ui.vertical(|ui| {
            ui.set_width(width);
            add(ui)
        })
        .inner
    })
    .inner
}

/// Page margin around a card below the `sm` breakpoint (`p-4`).
pub const PAGE_MARGIN: f32 = 24.0;
/// Breakpoint of the Tailwind `sm` prefix.
pub const COMPACT_WIDTH: f32 = 640.0;

/// Reports whether the window is narrower than `sm`, where the legacy screens switch to their
/// compact metrics (`text-xl` headings, `rounded-2xl` cards, `p-5` padding).
pub fn compact(ui: &Ui) -> bool {
    ui.ctx().screen_rect().width() < COMPACT_WIDTH
}

/// Horizontal space a card may occupy once the page margin is taken off.
pub fn page_width(ui: &Ui) -> f32 {
    let available = ui.available_width().min(ui.ctx().screen_rect().width());
    (available - PAGE_MARGIN * 2.0).max(160.0)
}

/// Card padding of the wizard card (`p-5` compact, `p-7` on wider windows).
pub fn card_padding(ui: &Ui) -> f32 {
    if compact(ui) {
        20.0
    } else {
        28.0
    }
}

/// Card padding of the language card, which uses `p-6` on narrow windows (`p-7` from `sm`).
pub fn language_card_padding(ui: &Ui) -> f32 {
    if compact(ui) {
        24.0
    } else {
        28.0
    }
}

/// Card corner radius (`rounded-2xl` compact, `rounded-3xl` on wider windows).
pub fn card_radius(ui: &Ui) -> f32 {
    if compact(ui) {
        16.0
    } else {
        24.0
    }
}

/// Paints the large dialog shadow behind a card.
fn card_shadow(ui: &Ui, rect: Rect, radius: f32, slot: egui::layers::ShapeIdx) {
    let shapes = shadow_layers(
        rect,
        radius,
        ShadowStrength::Dialog,
        Color32::from_rgb(2, 6, 23),
    )
    .into_iter()
    .map(|layer| Shape::rect_filled(layer.rect, Rounding::same(layer.rounding), layer.color))
    .collect::<Vec<_>>();
    ui.painter().set(slot, Shape::Vec(shapes));
}

/// Draws the card frame of a fixed total height (`h-[610px]`), so the footer keeps its place and
/// the content scrolls inside.
pub fn card_sized<R>(
    ui: &mut Ui,
    theme: &Theme,
    width: f32,
    padding: f32,
    height: f32,
    add: impl FnOnce(&mut Ui) -> R,
) -> R {
    let width = width.min(page_width(ui));
    let radius = card_radius(ui);
    let slot = ui.painter().add(Shape::Noop);
    centered(ui, width, |ui| {
        let response = egui::Frame::none()
            .fill(card_fill(theme))
            .stroke(Stroke::new(1.0_f32, hairline(theme)))
            .rounding(Rounding::same(radius))
            .inner_margin(Margin::same(padding))
            .show(ui, |ui| {
                let inner = (height - padding * 2.0).max(120.0);
                let inner_width = (width - padding * 2.0).max(120.0);
                ui.set_width(inner_width);
                // `set_width` only sets the minimum: paragraphs inside the card then saw an
                // unbounded width, did not wrap and were cut at the card's right edge.
                ui.set_max_width(inner_width);
                ui.set_height(inner);
                // `set_height` only grows the minimum height; clamping the maximum keeps the content
                // inside the card instead of letting it push the frame past `h-[610px]`.
                ui.set_max_height(inner);
                add(ui)
            });
        card_shadow(ui, response.response.rect, radius, slot);
        response.inner
    })
}

/// Draws the card surface (`rounded-2xl`/`rounded-3xl`, translucent fill, hairline border, shadow).
pub fn card<R>(
    ui: &mut Ui,
    theme: &Theme,
    width: f32,
    padding: f32,
    add: impl FnOnce(&mut Ui) -> R,
) -> R {
    // The card never grows past the page margin, otherwise it would be clipped on narrow windows
    // (`max-w-md` plus `p-4` in the legacy modal).
    let width = width.min(page_width(ui));
    let radius = card_radius(ui);
    let slot = ui.painter().add(Shape::Noop);
    centered(ui, width, |ui| {
        let response = egui::Frame::none()
            .fill(card_fill(theme))
            .stroke(Stroke::new(1.0_f32, hairline(theme)))
            .rounding(Rounding::same(radius))
            .inner_margin(Margin::same(padding))
            .show(ui, |ui| {
                let inner_width = (width - padding * 2.0).max(120.0);
                ui.set_width(inner_width);
                // Without the maximum the labels of a card never wrap (see `card_sized`).
                ui.set_max_width(inner_width);
                add(ui)
            });
        card_shadow(ui, response.response.rect, radius, slot);
        response.inner
    })
}

/// Draws the step chip (`rounded-full`, accent tint and border).
pub fn chip(ui: &mut Ui, theme: &Theme, label: &str) {
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::new(12.0, semibold()),
        theme.accent_text(),
    );
    let (rect, _) = ui.allocate_exact_size(Vec2::new(galley.size().x + 22.0, 26.0), Sense::hover());
    ui.painter().rect(
        rect,
        Rounding::same(13.0),
        over_card(theme, theme.accent.base, 0.10),
        Stroke::new(1.0_f32, over_card(theme, theme.accent.base, 0.24)),
    );
    ui.painter().galley(
        rect.center() - galley.size() * 0.5,
        galley,
        theme.accent_text(),
    );
}

/// Draws a screen title (`text-2xl font-bold tracking-tight`).
pub fn heading(ui: &mut Ui, theme: &Theme, text: &str) {
    ui.label(
        RichText::new(text)
            .size(if compact(ui) { 20.0 } else { 24.0 })
            .family(semibold())
            .color(theme.palette.text),
    );
}

/// Draws secondary body text (`text-sm text-slate-500`).
pub fn muted(ui: &mut Ui, theme: &Theme, text: &str) {
    ui.label(
        RichText::new(text)
            .size(14.0)
            .color(theme.palette.text_muted),
    );
}

/// Draws a small hint (`text-xs`).
pub fn hint(ui: &mut Ui, theme: &Theme, text: &str) {
    ui.label(
        RichText::new(text)
            .size(12.0)
            .color(theme.palette.text_muted),
    );
}

/// Draws a field label with the required marker (`text-xs font-semibold`, rose asterisk).
pub fn field_label(ui: &mut Ui, theme: &Theme, label: &str, required: bool) {
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 3.0;
        ui.label(
            RichText::new(label)
                .size(12.0)
                .family(semibold())
                .color(theme.palette.text),
        );
        if required {
            ui.label(
                RichText::new("*")
                    .size(12.0)
                    .family(semibold())
                    .color(theme.palette.danger),
            );
        }
    });
}

/// Draws a one point divider line.
pub fn divider(ui: &mut Ui, theme: &Theme) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 1.0), Sense::hover());
    ui.painter()
        .rect_filled(rect, Rounding::ZERO, hairline(theme));
}

/// Draws an accent text link and reports activation (`text-xs font-semibold`).
pub fn link(ui: &mut Ui, theme: &Theme, focus: &mut FocusState, label: &str) -> bool {
    link_colored(ui, theme, focus, label, theme.accent_text())
}

/// Draws a text link in the given colour, used for the `text-white/75` link of the sign-in screen.
pub fn link_colored(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    color: Color32,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let galley =
        ui.painter()
            .layout_no_wrap(label.to_owned(), FontId::new(12.0, semibold()), color);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(galley.size().x + 6.0, 22.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let color = if response.hovered() || focused {
        adjust(color, 16)
    } else {
        color
    };
    ui.painter().galley(
        Pos2::new(
            rect.center().x - galley.size().x * 0.5,
            rect.center().y - galley.size().y * 0.5,
        ),
        galley,
        color,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Paints an icon tile: accent gradient, hairline highlight and the white glyph.
pub fn paint_tile(painter: &egui::Painter, rect: Rect, color: Color32, icon: Icon, glyph: f32) {
    for layer in shadow_layers(rect, ROW_RADIUS, ShadowStrength::Card, color) {
        // The legacy tile shadow is `shadow-lg` at 20 percent, so halve the stacked card layers.
        let soft = Color32::from_rgba_unmultiplied(
            layer.color.r(),
            layer.color.g(),
            layer.color.b(),
            layer.color.a() / 2,
        );
        painter.rect_filled(layer.rect, Rounding::same(layer.rounding), soft);
    }
    painter.rect_filled(rect, Rounding::same(rect.width() * 0.34), color);
    painter.rect(
        rect,
        Rounding::same(rect.width() * 0.34),
        Color32::TRANSPARENT,
        Stroke::new(1.0_f32, adjust(color, 26)),
    );
    icon.draw(
        painter,
        Rect::from_center_size(rect.center(), Vec2::splat(glyph)),
        Color32::WHITE,
        1.7,
    );
}

/// Draws an icon tile of the given edge length and returns its rectangle.
pub fn icon_tile(ui: &mut Ui, icon: Icon, size: f32, color: Color32) -> Rect {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(size), Sense::hover());
    paint_tile(ui.painter(), rect, color, icon, size * 0.45);
    rect
}

/// Draws an inset panel (`rounded-2xl bg-slate-50 border border-slate-200`).
pub fn panel<R>(ui: &mut Ui, theme: &Theme, add: impl FnOnce(&mut Ui) -> R) -> R {
    egui::Frame::none()
        .fill(inset_fill(theme))
        .stroke(Stroke::new(1.0_f32, hairline(theme)))
        .rounding(Rounding::same(ROW_RADIUS))
        .inner_margin(Margin::same(14.0))
        .show(ui, add)
        .inner
}

/// Draws an inset panel that sits on the card with the title row of the legacy wizard panels.
pub fn section<R>(
    ui: &mut Ui,
    theme: &Theme,
    icon: Icon,
    title: &str,
    subtitle: &str,
    add: impl FnOnce(&mut Ui) -> R,
) -> R {
    panel(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 12.0;
            let (rect, _) = ui.allocate_exact_size(Vec2::splat(36.0), Sense::hover());
            paint_tile(ui.painter(), rect, theme.accent.base, icon, 18.0);
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(title)
                        .size(15.0)
                        .family(semibold())
                        .color(theme.palette.text),
                );
                ui.label(
                    RichText::new(subtitle)
                        .size(12.0)
                        .color(theme.palette.text_muted),
                );
            });
        });
        ui.add_space(10.0);
        add(ui)
    })
}

/// Draws a single line text field and returns the edit response.
pub fn input(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    hint_text: &str,
    label: &str,
) -> Response {
    // The 16/11 padding lives in the editor's own margin, so its hit box covers the whole field.
    // With the padding on the frame instead, egui only reported clicks on the glyph run and a click
    // on the padding left the caret in the previously focused field.
    let inner = egui::Frame::none()
        .fill(field_fill(theme))
        .stroke(Stroke::new(1.0_f32, hairline(theme)))
        .rounding(Rounding::same(12.0))
        .show(ui, |ui| {
            ui.add(
                egui::TextEdit::singleline(value)
                    // A stable id per field: auto ids can repeat inside the frames of one form, and a
                    // shared id made the focus jump between two fields while typing.
                    .id(egui::Id::new(("socdof-field", label)))
                    .hint_text(hint_text)
                    .frame(false)
                    .desired_width(f32::INFINITY)
                    .text_color(theme.palette.text)
                    .font(FontId::new(14.0, egui::FontFamily::Proportional))
                    .margin(Margin::symmetric(16.0, 11.0)),
            )
        });
    let response = inner.inner;
    register_field(ui, theme, focus, &response, label, true);
    response
}

/// Options of a password field: the optional eye toggle and whether the screen focuses it.
pub struct PasswordField<'a> {
    /// Reveals the typed password through the eye toggle, `None` keeps the field masked only.
    pub reveal: Option<&'a mut bool>,
    /// Requests the focus on the first frame, like the `autoFocus` of the legacy sign-in field.
    pub autofocus: bool,
    /// Disables typing and the eye toggle, like the sign-in field during a running lockout.
    pub enabled: bool,
}

impl Default for PasswordField<'_> {
    fn default() -> Self {
        Self {
            reveal: None,
            autofocus: false,
            // A field is typeable unless a screen disables it on purpose.
            enabled: true,
        }
    }
}

/// Draws a masked field with the eye toggle of the legacy password fields.
pub fn password_input(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    hint_text: &str,
    label: &str,
    options: PasswordField<'_>,
) -> Response {
    let PasswordField {
        mut reveal,
        autofocus,
        enabled,
    } = options;
    // `reveal: None` is always masked; `reveal: Some(flag)` follows the eye toggle, so a false
    // flag has to keep the text masked instead of showing the password in clear text.
    let mut masked = match reveal.as_deref() {
        Some(visible) => !*visible,
        None => true,
    };
    // On the dark sign-in backdrop the legacy field is `rounded-2xl border border-white/20
    // bg-black/30 py-3 focus:ring-2 focus:ring-white/40`: a translucent black pill with a 16 point
    // radius and a white focus ring that sits on the border box (ring offset 0).
    let on_backdrop = dark(theme);
    let (fill, border, radius, padding) = if on_backdrop {
        (
            Color32::from_black_alpha(77),
            Stroke::new(1.0_f32, Color32::from_white_alpha(51)),
            16.0,
            12.0,
        )
    } else {
        (
            field_fill(theme),
            Stroke::new(1.0_f32, hairline(theme)),
            12.0,
            11.0,
        )
    };
    let inner = egui::Frame::none()
        .fill(fill)
        .stroke(border)
        .rounding(Rounding::same(radius))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 6.0;
                let eye = if reveal.is_some() { 26.0 } else { 0.0 };
                // The field padding (16 left, 12 right) belongs to the editor's hit box: with it on
                // the frame, a click on the padding left the caret in the previously focused field.
                let width = (ui.available_width() - eye - 6.0 - 12.0 - 16.0 - 12.0).max(80.0);
                let response = ui.add_enabled(
                    enabled,
                    egui::TextEdit::singleline(value)
                        .id(egui::Id::new(("socdof-field", label)))
                        .password(masked)
                        .hint_text(hint_text)
                        .frame(false)
                        .desired_width(width)
                        .text_color(theme.palette.text)
                        .font(FontId::new(14.0, egui::FontFamily::Proportional))
                        .margin(Margin {
                            left: 16.0,
                            right: 12.0,
                            top: padding,
                            bottom: padding,
                        }),
                );
                if let Some(reveal) = reveal.as_mut() {
                    let (rect, toggle) = ui.allocate_exact_size(Vec2::splat(22.0), Sense::click());
                    let color = if toggle.hovered() {
                        theme.accent_text()
                    } else {
                        theme.palette.text_muted
                    };
                    draw_eye(ui.painter(), rect.shrink(2.0), color, **reveal);
                    if toggle.clicked() {
                        **reveal = !**reveal;
                        masked = !**reveal;
                    }
                }
                ui.add_space(12.0);
                response
            })
            .inner
        });
    let response = inner.inner;
    if autofocus {
        // The legacy field carries `autoFocus`, so the sign-in screen opens with the caret in the
        // password field and its focus ring visible. The request is repeated only while the field
        // has not been focused by the screen before.
        let key = egui::Id::new(("socdof-autofocus", response.id));
        if !ui.data(|data| data.get_temp::<bool>(key).unwrap_or(false)) && focus.focused().is_none()
        {
            focus.set_focus(Some(response.id));
            ui.memory_mut(|memory| memory.request_focus(response.id));
            ui.data_mut(|data| data.insert_temp(key, true));
        }
    }
    register_field(ui, theme, focus, &response, label, !on_backdrop);
    if on_backdrop && focus.is_focused(response.id) {
        // Two points of white at 40 percent, no offset, so the ring hugs the 16 point border box.
        ui.painter().rect_stroke(
            inner.response.rect.expand(1.0),
            Rounding::same(radius + 1.0),
            Stroke::new(2.0_f32, Color32::from_white_alpha(102)),
        );
    }
    response
}

/// Registers a field with the focus system and draws its ring while it is active.
///
/// `accent_ring` draws the accent ring of the card fields; the dark sign-in field passes `false`
/// because it paints its own white ring on the border box.
fn register_field(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    response: &Response,
    label: &str,
    accent_ring: bool,
) {
    let focused = focus.register(response.id);
    if response.clicked() {
        focus.set_focus(Some(response.id));
    }
    if focused || response.clicked() {
        // A click moves both focus owners at once: egui's TextEdit requested the focus itself while
        // handling the click, and surrendering it here would hand the caret back to the field that
        // was focused before, so the following keystrokes kept landing in the old field.
        ui.memory_mut(|memory| memory.request_focus(response.id));
        if accent_ring && focused {
            focus_ring(ui, theme, response.rect.expand(11.0));
        }
    } else {
        ui.memory_mut(|memory| memory.surrender_focus(response.id));
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::TextEdit, label));
}

/// Paints an eye glyph; a closed eye draws the strike-through of the legacy toggle.
fn draw_eye(painter: &egui::Painter, rect: Rect, color: Color32, open: bool) {
    let center = rect.center();
    let half_width = rect.width() * 0.5;
    let height = rect.height() * 0.30;
    let mut points = Vec::new();
    for step in 0..=12 {
        let t = step as f32 / 12.0;
        let x = center.x - half_width + 2.0 * half_width * t;
        let y = center.y - height * (std::f32::consts::PI * t).sin();
        points.push(Pos2::new(x, y));
    }
    for step in (0..=12).rev() {
        let t = step as f32 / 12.0;
        let x = center.x - half_width + 2.0 * half_width * t;
        let y = center.y + height * (std::f32::consts::PI * t).sin();
        points.push(Pos2::new(x, y));
    }
    painter.add(Shape::line(points, Stroke::new(1.3_f32, color)));
    painter.circle_filled(center, 2.6, color);
    if !open {
        painter.line_segment(
            [
                Pos2::new(center.x - half_width, center.y + height * 1.4),
                Pos2::new(center.x + half_width, center.y - height * 1.4),
            ],
            Stroke::new(1.3_f32, color),
        );
    }
}

/// Draws the wide primary button of the wizard footer (`h-12 rounded-2xl font-bold`).
pub fn primary_button(ui: &mut Ui, theme: &Theme, focus: &mut FocusState, label: &str) -> bool {
    wide_button(ui, theme, focus, label, true)
}

/// Draws the primary footer button with an explicit width, so two of them fit side by side.
pub fn primary_button_sized(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    width: f32,
) -> bool {
    wide_button_sized(ui, theme, focus, label, true, width)
}

/// Draws the outlined footer button with an explicit width (`flex-1` in the legacy form).
pub fn secondary_button_sized(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    width: f32,
) -> bool {
    wide_button_sized(ui, theme, focus, label, false, width)
}

/// Draws the wide outlined button of the wizard footer (`Zurück`).
pub fn secondary_button(ui: &mut Ui, theme: &Theme, focus: &mut FocusState, label: &str) -> bool {
    wide_button(ui, theme, focus, label, false)
}

fn wide_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    primary: bool,
) -> bool {
    let width = ui.available_width();
    wide_button_sized(ui, theme, focus, label, primary, width)
}

fn wide_button_sized(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    primary: bool,
    width: f32,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 44.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    let pressed = response.is_pointer_button_down_on();
    let text_color = if primary {
        theme.palette.accent_on
    } else {
        theme.palette.text
    };
    if primary {
        let fill = if pressed {
            adjust(theme.accent.hover, -8)
        } else if hovered {
            theme.accent.hover
        } else {
            theme.accent.base
        };
        for layer in shadow_layers(rect, ROW_RADIUS, ShadowStrength::Card, theme.accent.base) {
            // `shadow-lg shadow-indigo-600/25` needs far less alpha than the stacked card layers.
            let soft = Color32::from_rgba_unmultiplied(
                layer.color.r(),
                layer.color.g(),
                layer.color.b(),
                layer.color.a() / 2,
            );
            ui.painter()
                .rect_filled(layer.rect, Rounding::same(layer.rounding), soft);
        }
        ui.painter()
            .rect_filled(rect, Rounding::same(ROW_RADIUS), fill);
        ui.painter().rect(
            rect,
            Rounding::same(ROW_RADIUS),
            Color32::TRANSPARENT,
            Stroke::new(1.0_f32, adjust(fill, 24)),
        );
    } else {
        let fill = if hovered {
            inset_fill(theme)
        } else {
            Color32::TRANSPARENT
        };
        ui.painter().rect(
            rect,
            Rounding::same(ROW_RADIUS),
            fill,
            Stroke::new(
                1.0_f32,
                if hovered {
                    theme.accent.border
                } else {
                    hairline(theme)
                },
            ),
        );
    }
    let galley =
        ui.painter()
            .layout_no_wrap(label.to_owned(), FontId::new(15.0, semibold()), text_color);
    ui.painter()
        .galley(rect.center() - galley.size() * 0.5, galley, text_color);
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Lays out `count` equal width columns with the given gap.
pub fn columns(ui: &mut Ui, gap: f32, count: usize, mut add: impl FnMut(&mut Ui, usize, f32)) {
    if count == 0 {
        return;
    }
    let width = ((ui.available_width() - gap * (count - 1) as f32) / count as f32).max(80.0);
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = gap;
        for index in 0..count {
            ui.allocate_ui_with_layout(
                Vec2::new(width, 0.0),
                egui::Layout::top_down(egui::Align::Min),
                |ui| {
                    ui.set_width(width);
                    add(ui, index, width);
                },
            );
        }
    });
}

/// Draws one language row of the first-run screen and reports activation.
#[allow(clippy::too_many_arguments)]
pub fn language_row(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    code: &str,
    name: &str,
    subtitle: &str,
    selected: bool,
    selection_badge: &str,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), ROW_HEIGHT), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    let border = if selected {
        theme.accent.base
    } else if hovered {
        over_card(theme, theme.palette.text_muted, 0.45)
    } else {
        hairline(theme)
    };
    let fill = if selected {
        over_card(theme, theme.accent.base, 0.10)
    } else if hovered {
        inset_fill(theme)
    } else {
        Color32::TRANSPARENT
    };
    ui.painter().rect(
        rect,
        Rounding::same(ROW_RADIUS),
        fill,
        Stroke::new(if selected { 1.6_f32 } else { 1.0_f32 }, border),
    );

    let badge_rect = Rect::from_min_size(
        Pos2::new(rect.left() + 14.0, rect.center().y - 22.0),
        Vec2::new(48.0, 44.0),
    );
    ui.painter().rect(
        badge_rect,
        Rounding::same(12.0),
        inset_fill(theme),
        Stroke::new(1.0_f32, hairline(theme)),
    );
    let code_galley = ui.painter().layout_no_wrap(
        code.to_owned(),
        FontId::new(13.0, semibold()),
        theme.palette.text,
    );
    ui.painter().galley(
        badge_rect.center() - code_galley.size() * 0.5,
        code_galley,
        theme.palette.text,
    );

    let name_x = badge_rect.right() + 14.0;
    let name_galley = ui.painter().layout_no_wrap(
        name.to_owned(),
        FontId::new(16.0, semibold()),
        theme.palette.text,
    );
    ui.painter().galley(
        Pos2::new(name_x, rect.center().y - name_galley.size().y - 2.0),
        name_galley,
        theme.palette.text,
    );
    let subtitle_galley = ui.painter().layout_no_wrap(
        subtitle.to_owned(),
        FontId::proportional(12.0),
        theme.palette.text_muted,
    );
    ui.painter().galley(
        Pos2::new(name_x, rect.center().y + 3.0),
        subtitle_galley,
        theme.palette.text_muted,
    );

    if selected {
        let badge_galley = ui.painter().layout_no_wrap(
            selection_badge.to_owned(),
            FontId::new(11.5, semibold()),
            Color32::WHITE,
        );
        let size = Vec2::new(badge_galley.size().x + 20.0, 24.0);
        let pill = Rect::from_center_size(
            Pos2::new(rect.right() - 14.0 - size.x * 0.5, rect.center().y),
            size,
        );
        ui.painter()
            .rect_filled(pill, Rounding::same(12.0), theme.accent.base);
        ui.painter().galley(
            pill.center() - badge_galley.size() * 0.5,
            badge_galley,
            Color32::WHITE,
        );
    }
    // The selected row already carries the accent border; a second accent outline around it read
    // as a doubled frame. Keyboard focus on the selected row is shown by the button badge instead.
    if focused && !selected {
        focus_ring_round(ui, theme, rect, ROW_RADIUS);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, name));
    activated
}

/// Draws one currency chip of the company panel and reports activation.
pub fn currency_choice(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    symbol: &str,
    selected: bool,
) -> bool {
    let id = ui.make_persistent_id(("socdof-currency", symbol));
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::new(46.0, 40.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    let fill = if selected {
        over_card(
            theme,
            theme.accent.base,
            if dark(theme) { 0.15 } else { 0.06 },
        )
    } else if hovered {
        inset_fill(theme)
    } else {
        Color32::TRANSPARENT
    };
    ui.painter().rect(
        rect,
        Rounding::same(10.0),
        fill,
        Stroke::new(
            if selected { 1.6_f32 } else { 1.0_f32 },
            if selected {
                theme.accent.base
            } else {
                hairline(theme)
            },
        ),
    );
    let color = if selected {
        theme.accent_text()
    } else {
        theme.palette.text
    };
    let galley =
        ui.painter()
            .layout_no_wrap(symbol.to_owned(), FontId::new(13.5, semibold()), color);
    ui.painter()
        .galley(rect.center() - galley.size() * 0.5, galley, color);
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, symbol));
    activated
}

/// Draws a text choice box (account type, currency) and reports activation.
pub fn choice(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    salt: &str,
    label: &str,
    selected: bool,
) -> bool {
    let id = ui.make_persistent_id(("socdof-choice", salt));
    let focused = focus.register(id);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 44.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    let fill = if selected {
        over_card(
            theme,
            theme.accent.base,
            if dark(theme) { 0.15 } else { 0.06 },
        )
    } else if hovered {
        inset_fill(theme)
    } else {
        Color32::TRANSPARENT
    };
    ui.painter().rect(
        rect,
        Rounding::same(12.0),
        fill,
        Stroke::new(
            if selected { 1.6_f32 } else { 1.0_f32 },
            if selected {
                theme.accent.base
            } else {
                hairline(theme)
            },
        ),
    );
    let color = if selected {
        theme.accent_text()
    } else {
        theme.palette.text
    };
    // `p-2.5 text-left text-sm font-medium`: the label of an account-type choice sits left.
    let galley =
        ui.painter()
            .layout_no_wrap(label.to_owned(), FontId::new(14.0, semibold()), color);
    ui.painter().galley(
        Pos2::new(rect.left() + 10.0, rect.center().y - galley.size().y / 2.0),
        galley,
        color,
    );
    if focused && !selected {
        focus_ring_round(ui, theme, rect, 12.0);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Draws a compact icon and label button (upload, choose picture).
pub fn small_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::new(12.5, semibold()),
        theme.palette.text,
    );
    let size = Vec2::new(galley.size().x + 46.0, 32.0);
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    ui.painter().rect(
        rect,
        Rounding::same(10.0),
        if hovered {
            theme.accent.light
        } else {
            inset_fill(theme)
        },
        Stroke::new(1.0_f32, hairline(theme)),
    );
    icon.draw(
        ui.painter(),
        Rect::from_min_size(
            Pos2::new(rect.left() + 12.0, rect.center().y - 7.0),
            Vec2::splat(14.0),
        ),
        theme.palette.text,
        1.5,
    );
    ui.painter().galley(
        Pos2::new(rect.left() + 32.0, rect.center().y - galley.size().y * 0.5),
        galley,
        theme.palette.text,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Draws a circular icon button (the sign-in arrow) and reports activation.
pub fn circle_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
    size: f32,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    ui.painter().circle(
        rect.center(),
        size * 0.5,
        if hovered {
            theme.accent.base
        } else {
            inset_fill(theme)
        },
        Stroke::new(1.0_f32, hairline(theme)),
    );
    icon.draw(
        ui.painter(),
        Rect::from_center_size(rect.center(), Vec2::splat(size * 0.42)),
        if hovered {
            theme.palette.accent_on
        } else {
            theme.palette.text
        },
        1.7,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Draws a circular icon button into an explicit rectangle (used inside the sign-in field).
pub fn overlay_circle_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    rect: Rect,
    icon: Icon,
    label: &str,
) -> bool {
    let id = ui.make_persistent_id(("socdof-overlay-button", label));
    let focused = focus.register(id);
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    ui.painter().circle(
        rect.center(),
        rect.width() * 0.5,
        if hovered {
            theme.accent.base
        } else {
            with_alpha(theme.palette.text_muted, 16)
        },
        Stroke::new(1.0_f32, hairline(theme)),
    );
    icon.draw(
        ui.painter(),
        Rect::from_center_size(rect.center(), Vec2::splat(rect.width() * 0.42)),
        if hovered {
            theme.palette.accent_on
        } else {
            theme.palette.text
        },
        1.7,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Draws one accent swatch of the appearance step and reports activation.
pub fn swatch(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    salt: &str,
    color: Color32,
    selected: bool,
) -> bool {
    let id = ui.make_persistent_id(("socdof-swatch", salt));
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(42.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    if selected || focused {
        ui.painter().rect(
            rect,
            Rounding::same(14.0),
            Color32::TRANSPARENT,
            Stroke::new(
                2.0_f32,
                if selected {
                    color
                } else {
                    theme.palette.border
                },
            ),
        );
        let inner = rect.shrink(3.0);
        ui.painter().rect_filled(inner, Rounding::same(11.0), color);
        if selected {
            Icon::Check.draw(
                ui.painter(),
                Rect::from_center_size(inner.center(), Vec2::splat(16.0)),
                Color32::WHITE,
                2.0,
            );
        }
    } else {
        let inner = rect.shrink(2.0);
        ui.painter().rect_filled(inner, Rounding::same(11.0), color);
    }
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, salt));
    activated
}

/// Draws a segmented choice (Hell / Dunkel / System) and returns the new index when it changed.
pub fn segmented(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    id_source: &str,
    options: &[(Icon, &str)],
    selected: usize,
) -> Option<usize> {
    if options.is_empty() {
        return None;
    }
    let gap = 8.0;
    let width = ((ui.available_width() - gap * (options.len() - 1) as f32) / options.len() as f32)
        .max(80.0);
    let mut picked = None;
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = gap;
        for (index, (icon, label)) in options.iter().enumerate() {
            let id = ui.make_persistent_id(("socdof-segment", id_source, index));
            let focused = focus.register(id);
            let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 40.0), Sense::click());
            if response.clicked() {
                focus.set_focus(Some(id));
            }
            let activated = response.clicked() || focus.activate(id);
            let active = index == selected;
            let hovered = response.hovered() || focused;
            let fill = if active {
                over_card(
                    theme,
                    theme.accent.base,
                    if dark(theme) { 0.15 } else { 0.06 },
                )
            } else if hovered {
                inset_fill(theme)
            } else {
                Color32::TRANSPARENT
            };
            ui.painter().rect(
                rect,
                Rounding::same(12.0),
                fill,
                Stroke::new(
                    if active { 1.6_f32 } else { 1.0_f32 },
                    if active {
                        theme.accent.base
                    } else {
                        hairline(theme)
                    },
                ),
            );
            let color = if active {
                theme.accent_text()
            } else {
                theme.palette.text
            };
            let galley = ui.painter().layout_no_wrap(
                (*label).to_owned(),
                FontId::new(13.0, semibold()),
                color,
            );
            let icon_size = 16.0;
            let total = icon_size + 6.0 + galley.size().x;
            let start = rect.center().x - total * 0.5;
            icon.draw(
                ui.painter(),
                Rect::from_min_size(
                    Pos2::new(start, rect.center().y - icon_size * 0.5),
                    Vec2::splat(icon_size),
                ),
                color,
                1.5,
            );
            ui.painter().galley(
                Pos2::new(
                    start + icon_size + 6.0,
                    rect.center().y - galley.size().y * 0.5,
                ),
                galley,
                color,
            );
            if focused {
                focus_ring(ui, theme, rect);
            }
            response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, *label));
            if activated && !active {
                picked = Some(index);
            }
        }
    });
    picked
}

/// Draws one selectable app tile and reports activation.
#[allow(clippy::too_many_arguments)]
pub fn app_tile(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    salt: &str,
    icon: Icon,
    tint: Color32,
    title: &str,
    description: &str,
    selected: bool,
) -> bool {
    tile(
        ui,
        theme,
        focus,
        salt,
        icon,
        tint,
        title,
        description,
        selected,
    )
}

/// Width below which a wizard tile stacks its icon row and its copy.
///
/// Next to a 40 point icon and the 20 point check mark a phone tile only keeps a narrow text column,
/// and the title used to wrap under the badge. Below this width the title and description move to
/// their own rows, above it they stay beside the icon like the reference.
pub const TILE_STACK_WIDTH: f32 = 210.0;

/// Whether a tile of the given width stacks the copy below the icon row.
pub fn tile_stacks(width: f32) -> bool {
    width < TILE_STACK_WIDTH
}

#[allow(clippy::too_many_arguments)]
fn tile(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    salt: &str,
    icon: Icon,
    tint: Color32,
    title: &str,
    description: &str,
    selected: bool,
) -> bool {
    let id = ui.make_persistent_id(("socdof-tile", salt));
    let focused = focus.register(id);
    // Two title rows and up to three description rows are what the copy needs; the tile is tall
    // enough to show them all, so no label is cut mid word.
    const TITLE_ROWS: usize = 2;
    const DESCRIPTION_ROWS: usize = 5;
    // The two column grid leaves little room next to the icon and the check mark, so a full
    // description needs four to five lines; every tile is sized for that instead of clipping.
    let height = 136.0;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), height), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    let panel = inset_fill(theme);
    let fill = if selected {
        crate::wallpaper::blend(panel, theme.accent.base, 0.10)
    } else if hovered {
        crate::wallpaper::blend(panel, Color32::WHITE, if dark(theme) { 0.04 } else { 0.0 })
    } else {
        panel
    };
    ui.painter().rect(
        rect,
        Rounding::same(ROW_RADIUS),
        fill,
        Stroke::new(
            if selected { 1.6_f32 } else { 1.0_f32 },
            if selected {
                theme.accent.base
            } else {
                hairline(theme)
            },
        ),
    );

    // One tile style for every selection grid of the wizard: same icon size, same title size and
    // the same check marker, whether it picks a template or an app.
    let tile_size = 40.0;
    // Next to the icon the tile only keeps a narrow column once the check mark has its space, and a
    // title there would be painted underneath the badge. Narrow tiles therefore stack the copy
    // below the icon row and use the full width; wide tiles keep the reference side-by-side layout.
    let stacked = tile_stacks(rect.width());
    let icon_size = if stacked { 34.0 } else { tile_size };
    let icon_rect = Rect::from_min_size(
        Pos2::new(rect.left() + 14.0, rect.top() + 14.0),
        Vec2::splat(icon_size),
    );
    paint_tile(ui.painter(), icon_rect, tint, icon, icon_size * 0.44);

    let check_size = 20.0;
    let (text_x, text_width, title_top) = if stacked {
        (
            rect.left() + 14.0,
            (rect.width() - 28.0).max(40.0),
            icon_rect.bottom() + 8.0,
        )
    } else {
        let text_x = icon_rect.right() + 12.0;
        (
            text_x,
            (rect.right() - check_size - 22.0 - text_x).max(40.0),
            rect.top() + 13.0,
        )
    };
    // The reference keeps titles on one line, which cuts long module names in half at this tile
    // width; wrapping to two lines shows the whole name and the description follows underneath.
    let title_font = FontId::new(14.0, semibold());
    let title_galley =
        ui.painter()
            .layout(title.to_owned(), title_font, theme.palette.text, text_width);
    let title_height = title_galley
        .rows
        .get(TITLE_ROWS.saturating_sub(1))
        .map_or(title_galley.size().y, |row| row.rect.bottom())
        .min(title_galley.size().y);
    ui.painter()
        .with_clip_rect(Rect::from_min_size(
            Pos2::new(text_x, title_top),
            Vec2::new(text_width, title_height),
        ))
        .galley(
            Pos2::new(text_x, title_top),
            title_galley,
            theme.palette.text,
        );
    let description_top = title_top + title_height + 3.0;
    let description_galley = ui.painter().layout(
        description.to_owned(),
        FontId::proportional(11.5),
        theme.palette.text_muted,
        text_width,
    );
    // Clip to the rows that fit between the title and the tile edge, not to a fixed count.
    let room = (rect.bottom() - 10.0 - description_top).max(14.0);
    let rows = description_galley
        .rows
        .iter()
        .take(DESCRIPTION_ROWS)
        .filter(|row| row.rect.bottom() <= room)
        .count()
        .max(1)
        .min(description_galley.rows.len().max(1));
    let description_height = description_galley
        .rows
        .get(rows - 1)
        .map_or(0.0, |row| row.rect.bottom());
    let description_clip = Rect::from_min_size(
        Pos2::new(text_x, description_top),
        Vec2::new(text_width, description_height),
    );
    ui.painter().with_clip_rect(description_clip).galley(
        Pos2::new(text_x, description_top),
        description_galley,
        theme.palette.text_muted,
    );

    let circle = Rect::from_center_size(
        Pos2::new(
            rect.right() - 16.0 - check_size * 0.5,
            rect.top() + 14.0 + check_size * 0.5,
        ),
        Vec2::splat(check_size),
    );
    if selected {
        ui.painter()
            .circle_filled(circle.center(), check_size * 0.5, theme.accent.base);
        Icon::Check.draw(
            ui.painter(),
            Rect::from_center_size(circle.center(), Vec2::splat(12.0)),
            Color32::WHITE,
            2.0,
        );
    } else {
        ui.painter().circle_stroke(
            circle.center(),
            check_size * 0.5,
            Stroke::new(1.2_f32, hairline(theme)),
        );
    }
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, title));
    activated
}

/// Circular avatar with accent gradient, initials fallback and an optional image.
pub fn avatar(
    ui: &mut Ui,
    theme: &Theme,
    image: Option<&crate::wallpaper::CustomWallpaper>,
    initials: &str,
    size: f32,
) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(size), Sense::hover());
    draw_avatar(ui, theme, rect, image, initials);
}

/// Paints an avatar into an existing rectangle.
pub fn draw_avatar(
    ui: &mut Ui,
    theme: &Theme,
    rect: Rect,
    image: Option<&crate::wallpaper::CustomWallpaper>,
    initials: &str,
) {
    let center = rect.center();
    let radius = rect.width() * 0.5;
    if let Some(image) = image {
        let color_image = egui::ColorImage::from_rgba_unmultiplied(
            [image.width, image.height],
            image.pixels.as_slice(),
        );
        // The revision identifies the decoded picture, so two accounts never share a texture.
        let texture = ui.ctx().load_texture(
            format!("socdof-avatar-{:x}", image.revision),
            color_image,
            egui::TextureOptions::LINEAR,
        );
        // Draw the picture as a textured circle: a plain image rectangle would show its corners.
        let mut mesh = egui::Mesh::with_texture(texture.id());
        mesh.vertices.push(egui::epaint::Vertex {
            pos: center,
            uv: Pos2::new(0.5, 0.5),
            color: Color32::WHITE,
        });
        const SEGMENTS: usize = 48;
        for index in 0..=SEGMENTS {
            let angle = index as f32 / SEGMENTS as f32 * std::f32::consts::TAU;
            let (sin, cos) = angle.sin_cos();
            mesh.vertices.push(egui::epaint::Vertex {
                pos: center + Vec2::new(cos, sin) * radius,
                uv: Pos2::new(0.5 + cos * 0.5, 0.5 + sin * 0.5),
                color: Color32::WHITE,
            });
        }
        for index in 1..=SEGMENTS as u32 {
            mesh.indices.extend_from_slice(&[0, index, index + 1]);
        }
        ui.painter().add(egui::Shape::mesh(mesh));
        ui.painter()
            .circle_stroke(center, radius - 0.5, Stroke::new(1.0_f32, hairline(theme)));
        return;
    }
    if initials.is_empty() {
        ui.painter().circle_filled(
            center,
            radius,
            if dark(theme) {
                Color32::from_rgba_unmultiplied(255, 255, 255, 9)
            } else {
                Color32::from_rgb(0xe2, 0xe8, 0xf0)
            },
        );
        Icon::User.draw(
            ui.painter(),
            Rect::from_center_size(center, Vec2::splat(radius * 0.95)),
            theme.palette.text_muted,
            1.6,
        );
        return;
    }
    for layer in shadow_layers(
        rect,
        radius,
        ShadowStrength::Card,
        Color32::from_rgb(2, 6, 23),
    ) {
        ui.painter()
            .circle_filled(layer.rect.center(), layer.rect.width() * 0.5, layer.color);
    }
    ui.painter()
        .circle_filled(center, radius, theme.accent.base);
    ui.painter().circle_stroke(
        center,
        radius - 0.5,
        Stroke::new(1.0_f32, adjust(theme.accent.base, 28)),
    );
    let galley = ui.painter().layout_no_wrap(
        initials.to_owned(),
        FontId::new(radius * 0.72, semibold()),
        theme.palette.accent_on,
    );
    ui.painter().galley(
        center - galley.size() * 0.5,
        galley,
        theme.palette.accent_on,
    );
}

/// Draws the success toast of the sign-in screen (green card, check, two lines).
pub fn toast(ui: &mut Ui, theme: &Theme, title: &str, body: &str) {
    let width = 324.0;
    let response = egui::Frame::none()
        .fill(if dark(theme) {
            theme.palette.surface
        } else {
            Color32::WHITE
        })
        .stroke(Stroke::new(1.0_f32, with_alpha(theme.palette.success, 55)))
        .rounding(Rounding::same(14.0))
        .inner_margin(Margin::symmetric(14.0, 12.0))
        .show(ui, |ui| {
            ui.set_width(width);
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 12.0;
                let (rect, _) = ui.allocate_exact_size(Vec2::splat(28.0), Sense::hover());
                ui.painter().circle_stroke(
                    rect.center(),
                    12.0,
                    Stroke::new(1.4_f32, theme.palette.success),
                );
                Icon::Check.draw(
                    ui.painter(),
                    Rect::from_center_size(rect.center(), Vec2::splat(12.0)),
                    theme.palette.success,
                    1.8,
                );
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(title)
                            .size(11.0)
                            .family(semibold())
                            .color(theme.palette.success),
                    );
                    ui.label(RichText::new(body).size(12.5).color(theme.palette.text));
                });
            });
        });
    let _ = response;
}

/// Initials of a display name, at most two letters.
pub fn initials(name: &str) -> String {
    let mut letters = name
        .split_whitespace()
        .filter_map(|word| word.chars().next())
        .take(2)
        .collect::<String>();
    if letters.is_empty() {
        letters = name.trim().chars().take(2).collect();
    }
    letters.to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initials_take_the_first_two_words() {
        assert_eq!(initials("Alex Administrator"), "AA");
        assert_eq!(initials("Test"), "T");
        assert_eq!(initials("  "), "");
        assert_eq!(initials("anna maria weber"), "AM");
    }

    #[test]
    fn narrow_tiles_stack_their_copy_below_the_icon() {
        // The two column grid of the wizard on a 432 point phone leaves roughly 150 points per
        // tile; the card full width leaves the reference layout room.
        assert!(tile_stacks(154.0));
        assert!(!tile_stacks(260.0));
        assert!(!tile_stacks(TILE_STACK_WIDTH + 1.0));
    }

    #[test]
    fn card_widths_match_the_legacy_max_widths() {
        // `max-w-md` and `max-w-lg` at the default Tailwind scale.
        assert_eq!(LANGUAGE_CARD_WIDTH, 448.0);
        assert_eq!(WIZARD_CARD_WIDTH, 512.0);
    }
}
