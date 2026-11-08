//! Appearance resolution and the egui style built from the design tokens.
//!
//! The theme is applied once per frame before the first widget is drawn, so the window never
//! flashes the wrong appearance while starting.

use egui::{Color32, Context, FontFamily, FontId, Rounding, Stroke, TextStyle, Vec2};
use socdof_core::domain::settings::ThemeMode;

use crate::tokens::{
    AccentPreset, CONTROL_HEIGHT, FONT_BODY, FONT_HEADING, FONT_SMALL, RADIUS_CONTROL, SPACING_UNIT,
};

/// Concrete appearance after `ThemeMode::System` has been resolved against the operating system.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Appearance {
    /// Light surfaces.
    Light,
    /// Dark surfaces.
    Dark,
}

impl Appearance {
    /// Resolves the stored mode against the operating system preference.
    pub fn resolve(mode: ThemeMode, system_dark: bool) -> Self {
        match mode {
            ThemeMode::Light => Self::Light,
            ThemeMode::Dark => Self::Dark,
            ThemeMode::System => {
                if system_dark {
                    Self::Dark
                } else {
                    Self::Light
                }
            }
        }
    }

    /// Whether this appearance is dark.
    pub fn is_dark(self) -> bool {
        matches!(self, Self::Dark)
    }
}

/// Surfaces, text and status colors of one appearance.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Palette {
    /// Window background behind panels.
    pub background: Color32,
    /// Card and dialog surface.
    pub surface: Color32,
    /// Recessed surface, table stripes and input backgrounds.
    pub surface_muted: Color32,
    /// Hairline borders.
    pub border: Color32,
    /// Primary text.
    pub text: Color32,
    /// Secondary and hint text.
    pub text_muted: Color32,
    /// Success status.
    pub success: Color32,
    /// Warning status.
    pub warning: Color32,
    /// Destructive status.
    pub danger: Color32,
    /// Text drawn on top of a filled accent control.
    pub accent_on: Color32,
}

impl Palette {
    /// Palette of an appearance, using the legacy surface and text values.
    pub fn of(appearance: Appearance) -> Self {
        match appearance {
            Appearance::Light => Self {
                background: Color32::from_rgb(0xf6, 0xf8, 0xfb),
                surface: Color32::from_rgb(0xff, 0xff, 0xff),
                surface_muted: Color32::from_rgb(0xf1, 0xf5, 0xf9),
                border: Color32::from_rgb(0xe2, 0xe8, 0xf0),
                text: Color32::from_rgb(0x0f, 0x17, 0x2a),
                text_muted: Color32::from_rgb(0x64, 0x74, 0x8b),
                success: Color32::from_rgb(0x05, 0x96, 0x69),
                warning: Color32::from_rgb(0xd9, 0x77, 0x06),
                danger: Color32::from_rgb(0xe1, 0x1d, 0x48),
                accent_on: Color32::WHITE,
            },
            Appearance::Dark => Self {
                background: Color32::from_rgb(0x02, 0x06, 0x17),
                surface: Color32::from_rgb(0x0f, 0x17, 0x2a),
                surface_muted: Color32::from_rgb(0x1e, 0x29, 0x3b),
                border: Color32::from_rgb(0x33, 0x41, 0x55),
                text: Color32::from_rgb(0xf8, 0xfa, 0xfc),
                text_muted: Color32::from_rgb(0x94, 0xa3, 0xb8),
                success: Color32::from_rgb(0x34, 0xd3, 0x99),
                warning: Color32::from_rgb(0xfb, 0xbf, 0x24),
                danger: Color32::from_rgb(0xfb, 0x71, 0x85),
                accent_on: Color32::WHITE,
            },
        }
    }
}

/// Resolved appearance, palette and accent of one screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Theme {
    /// Resolved light or dark appearance.
    pub appearance: Appearance,
    /// Colors of that appearance.
    pub palette: Palette,
    /// Selected accent.
    pub accent: AccentPreset,
}

impl Theme {
    /// Builds a theme from an appearance and an accent id or hex value.
    pub fn new(appearance: Appearance, accent: impl AsRef<str>) -> Self {
        Self {
            appearance,
            palette: Palette::of(appearance),
            accent: AccentPreset::resolve(accent.as_ref()),
        }
    }

    /// Text color of accent-colored labels, lightened on dark surfaces.
    pub fn accent_text(&self) -> Color32 {
        if self.appearance.is_dark() {
            self.accent.dark_text
        } else {
            self.accent.base
        }
    }

    /// Applies spacing, rounding and colors to the egui context.
    pub fn apply(&self, ctx: &Context) {
        let mut visuals = match self.appearance {
            Appearance::Light => egui::Visuals::light(),
            Appearance::Dark => egui::Visuals::dark(),
        };
        visuals.panel_fill = self.palette.background;
        visuals.window_fill = self.palette.surface;
        visuals.extreme_bg_color = self.palette.surface_muted;
        visuals.faint_bg_color = self.palette.surface_muted;
        visuals.override_text_color = Some(self.palette.text);
        visuals.hyperlink_color = self.accent_text();
        visuals.selection.bg_fill = self.accent.light;
        visuals.selection.stroke = Stroke::new(1.0_f32, self.accent.base);

        let widgets = &mut visuals.widgets;
        widgets.noninteractive.bg_fill = self.palette.surface;
        widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, self.palette.border);
        widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, self.palette.text);
        widgets.inactive.weak_bg_fill = self.palette.surface_muted;
        widgets.inactive.bg_fill = self.palette.surface_muted;
        widgets.inactive.bg_stroke = Stroke::new(1.0_f32, self.palette.border);
        widgets.inactive.fg_stroke = Stroke::new(1.0_f32, self.palette.text);
        widgets.hovered.weak_bg_fill = self.accent.light;
        widgets.hovered.bg_fill = self.palette.surface;
        widgets.hovered.bg_stroke = Stroke::new(1.0_f32, self.accent.border);
        widgets.hovered.fg_stroke = Stroke::new(1.0_f32, self.palette.text);
        widgets.active.weak_bg_fill = self.accent.light;
        widgets.active.bg_fill = self.palette.surface;
        widgets.active.bg_stroke = Stroke::new(1.0_f32, self.accent.base);
        widgets.active.fg_stroke = Stroke::new(1.0_f32, self.palette.text);
        for widget in [
            &mut widgets.noninteractive,
            &mut widgets.inactive,
            &mut widgets.hovered,
            &mut widgets.active,
            &mut widgets.open,
        ] {
            widget.rounding = Rounding::same(RADIUS_CONTROL);
        }

        ctx.set_visuals(visuals);
        ctx.style_mut(|style| {
            style.spacing.item_spacing = Vec2::splat(SPACING_UNIT);
            style.spacing.button_padding = Vec2::new(14.0, 8.0);
            style.spacing.interact_size = Vec2::new(0.0, CONTROL_HEIGHT);
            // The legacy app styles scrollbars at six pixels with a translucent thumb.
            let mut scroll = style.spacing.scroll;
            scroll.bar_width = 6.0;
            scroll.floating_width = 6.0;
            scroll.handle_min_length = 12.0;
            style.spacing.scroll = scroll;
            style.text_styles = [
                (
                    TextStyle::Body,
                    FontId::new(FONT_BODY, FontFamily::Proportional),
                ),
                (
                    TextStyle::Button,
                    FontId::new(FONT_BODY, FontFamily::Proportional),
                ),
                (
                    TextStyle::Small,
                    FontId::new(FONT_SMALL, FontFamily::Proportional),
                ),
                (
                    TextStyle::Heading,
                    FontId::new(FONT_HEADING, FontFamily::Proportional),
                ),
                (
                    TextStyle::Monospace,
                    FontId::new(FONT_BODY, FontFamily::Monospace),
                ),
            ]
            .into();
            style.visuals.override_text_color = Some(self.palette.text);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_system_mode_against_the_operating_system() {
        assert_eq!(
            Appearance::resolve(ThemeMode::System, true),
            Appearance::Dark
        );
        assert_eq!(
            Appearance::resolve(ThemeMode::System, false),
            Appearance::Light
        );
        assert_eq!(
            Appearance::resolve(ThemeMode::Light, true),
            Appearance::Light
        );
        assert_eq!(
            Appearance::resolve(ThemeMode::Dark, false),
            Appearance::Dark
        );
    }

    #[test]
    fn applies_palette_and_accent_to_the_context() {
        let ctx = Context::default();
        let theme = Theme::new(Appearance::Dark, "indigo");
        theme.apply(&ctx);

        assert_eq!(ctx.style().visuals.panel_fill, theme.palette.background);
        assert_eq!(ctx.style().visuals.window_fill, theme.palette.surface);
        assert_eq!(
            ctx.style().visuals.override_text_color,
            Some(theme.palette.text)
        );
        assert_eq!(theme.accent_text(), theme.accent.dark_text);

        let light = Theme::new(Appearance::Light, "#0d9488");
        assert_eq!(light.accent_text(), light.accent.base);
        assert_eq!(
            light.palette.background,
            Color32::from_rgb(0xf6, 0xf8, 0xfb)
        );
    }
}
