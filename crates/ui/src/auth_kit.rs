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

use crate::focus::{focus_ring, FocusState};
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
    let width = width.min(ui.available_width());
    let side = ((ui.available_width() - width) * 0.5).max(0.0);
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
    (ui.available_width() - PAGE_MARGIN * 2.0).max(160.0)
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
                ui.set_width((width - padding * 2.0).max(120.0));
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
                ui.set_width((width - padding * 2.0).max(120.0));
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
    let inner = egui::Frame::none()
        .fill(field_fill(theme))
        .stroke(Stroke::new(1.0_f32, hairline(theme)))
        .rounding(Rounding::same(12.0))
        .inner_margin(Margin::symmetric(16.0, 11.0))
        .show(ui, |ui| {
            ui.add(
                egui::TextEdit::singleline(value)
                    .hint_text(hint_text)
                    .frame(false)
                    .desired_width(f32::INFINITY)
                    .text_color(theme.palette.text)
                    .font(FontId::new(14.0, egui::FontFamily::Proportional))
                    .margin(Margin::ZERO),
            )
        });
    let response = inner.inner;
    register_field(ui, theme, focus, &response, label, true);
    response
}

/// Options of a password field: the optional eye toggle and whether the screen focuses it.
#[derive(Default)]
pub struct PasswordField<'a> {
    /// Reveals the typed password through the eye toggle, `None` keeps the field masked only.
    pub reveal: Option<&'a mut bool>,
    /// Requests the focus on the first frame, like the `autoFocus` of the legacy sign-in field.
    pub autofocus: bool,
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
    } = options;
    let mut masked = reveal.is_none();
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
        .inner_margin(Margin::symmetric(16.0, padding))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 6.0;
                let eye = if reveal.is_some() { 26.0 } else { 0.0 };
                let width = (ui.available_width() - eye).max(80.0);
                let response = ui.add(
                    egui::TextEdit::singleline(value)
                        .password(masked)
                        .hint_text(hint_text)
                        .frame(false)
                        .desired_width(width)
                        .text_color(theme.palette.text)
                        .font(FontId::new(14.0, egui::FontFamily::Proportional))
                        .margin(Margin::ZERO),
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
    if focused {
        ui.memory_mut(|memory| memory.request_focus(response.id));
        if accent_ring {
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
    if focused {
        focus_ring(ui, theme, rect);
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
    if focused {
        focus_ring(ui, theme, rect);
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
        false,
    )
}

/// Lays out `text` on one line, shortening it with an ellipsis when it does not fit.
fn one_line(
    painter: &egui::Painter,
    text: &str,
    font: FontId,
    color: Color32,
    max_width: f32,
) -> std::sync::Arc<egui::Galley> {
    let full = painter.layout_no_wrap(text.to_owned(), font.clone(), color);
    if full.size().x <= max_width {
        return full;
    }
    let mut characters: Vec<char> = text.chars().collect();
    while !characters.is_empty() {
        characters.pop();
        let candidate = format!("{}…", characters.iter().collect::<String>());
        let galley = painter.layout_no_wrap(candidate, font.clone(), color);
        if galley.size().x <= max_width {
            return galley;
        }
    }
    painter.layout_no_wrap("…".to_owned(), font, color)
}

/// Draws one template card of the app-template grid and reports activation.
#[allow(clippy::too_many_arguments)]
pub fn template_tile(
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
        true,
    )
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
    template: bool,
) -> bool {
    let id = ui.make_persistent_id(("socdof-tile", salt));
    let focused = focus.register(id);
    let height = if template { 104.0 } else { 88.0 };
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

    let tile_size = if template { 40.0 } else { 38.0 };
    let icon_rect = Rect::from_min_size(
        Pos2::new(rect.left() + 14.0, rect.top() + 14.0),
        Vec2::splat(tile_size),
    );
    paint_tile(ui.painter(), icon_rect, tint, icon, tile_size * 0.44);

    let text_x = icon_rect.right() + 12.0;
    let check_size = 20.0;
    let text_width = (rect.right() - check_size - 22.0 - text_x).max(80.0);
    // The reference truncates tile titles to one line (`truncate`), so the description always
    // starts on the same row and never collides with a wrapped title.
    let title_font = FontId::new(if template { 14.5 } else { 13.5 }, semibold());
    let title_galley = one_line(
        ui.painter(),
        title,
        title_font.clone(),
        theme.palette.text,
        text_width,
    );
    let title_height = title_font.size;
    ui.painter().galley(
        Pos2::new(text_x, rect.top() + 13.0),
        title_galley,
        theme.palette.text,
    );
    let description_top = rect.top() + 13.0 + title_height + 3.0;
    let description_galley = ui.painter().layout(
        description.to_owned(),
        FontId::proportional(11.5),
        theme.palette.text_muted,
        text_width,
    );
    let rows = description_galley.rows.len().min(2);
    let description_height = if rows == 0 {
        0.0
    } else {
        description_galley.rows[rows - 1].rect.bottom()
    };
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
        let texture = ui.ctx().load_texture(
            format!("socdof-avatar-{}", image.revision),
            color_image,
            egui::TextureOptions::LINEAR,
        );
        ui.painter().image(
            texture.id(),
            rect,
            Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
            Color32::WHITE,
        );
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
    fn card_widths_match_the_legacy_max_widths() {
        // `max-w-md` and `max-w-lg` at the default Tailwind scale.
        assert_eq!(LANGUAGE_CARD_WIDTH, 448.0);
        assert_eq!(WIZARD_CARD_WIDTH, 512.0);
    }
}
