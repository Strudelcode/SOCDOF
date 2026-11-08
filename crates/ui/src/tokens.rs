//! Design tokens ported one to one from the legacy stylesheet and accent presets.
//!
//! The values mirror `SOCDOF - TS/src/index.css` and `SOCDOF - TS/src/lib/accent.ts`, so a Rust
//! screen and the legacy screen pick the same colors. The legacy folder is reference only; nothing
//! here imports or executes TypeScript.

use egui::Color32;

/// Base spacing unit. The legacy layout uses an eight pixel rhythm.
pub const SPACING_UNIT: f32 = 8.0;
/// Corner radius of cards and panels.
pub const RADIUS_CARD: f32 = 16.0;
/// Corner radius of buttons, inputs and badges.
pub const RADIUS_CONTROL: f32 = 10.0;
/// Height of a standard control.
pub const CONTROL_HEIGHT: f32 = 36.0;
/// Font size of body text.
pub const FONT_BODY: f32 = 14.0;
/// Font size of secondary text.
pub const FONT_SMALL: f32 = 12.0;
/// Font size of section headings.
pub const FONT_HEADING: f32 = 18.0;
/// Font size of a screen title.
pub const FONT_TITLE: f32 = 24.0;
/// Inner padding of a card.
pub const CARD_PADDING: f32 = 16.0;

/// Built-in accent presets: id, label, base, hover, border, dark-mode text, light alpha percent.
const PRESETS: [(&str, &str, u32, u32, u32, u32, u8); 9] = [
    (
        "indigo",
        "Windows Indigo",
        0x4f46e5,
        0x4338ca,
        0x6366f1,
        0x818cf8,
        12,
    ),
    (
        "purple",
        "SOCDOF Aubergine",
        0x714b67,
        0x5a3b52,
        0x8e5f82,
        0xc084fc,
        14,
    ),
    (
        "blue",
        "Cyber Blue",
        0x2563eb,
        0x1d4ed8,
        0x3b82f6,
        0x60a5fa,
        12,
    ),
    (
        "emerald",
        "Emerald Green",
        0x059669,
        0x047857,
        0x10b981,
        0x34d399,
        12,
    ),
    (
        "sky",
        "Vibrant Sky",
        0x0284c7,
        0x0369a1,
        0x0ea5e9,
        0x38bdf8,
        12,
    ),
    (
        "amber",
        "Sunset Gold",
        0xd97706,
        0xb45309,
        0xf59e0b,
        0xfbbf24,
        12,
    ),
    (
        "rose",
        "Berry Rose",
        0xe11d48,
        0xbe123c,
        0xf43f5e,
        0xfb7185,
        12,
    ),
    (
        "teal",
        "Nordic Teal",
        0x0d9488,
        0x0f766e,
        0x14b8a6,
        0x2dd4bf,
        12,
    ),
    (
        "violet",
        "Neon Violet",
        0x7c3aed,
        0x6d28d9,
        0x8b5cf6,
        0xa78bfa,
        12,
    ),
];

/// One resolved accent color with the shades the legacy stylesheet derived from it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccentPreset {
    /// Stable id, `indigo`, `purple`, … or `custom_<hex>` for a user defined color.
    pub id: String,
    /// Human readable name shown in the settings screen.
    pub label: String,
    /// Base color used for filled primary controls.
    pub base: Color32,
    /// Darker shade for hovered primary controls.
    pub hover: Color32,
    /// Slightly lighter shade for borders and focus rings.
    pub border: Color32,
    /// Lighter shade used for text on dark surfaces.
    pub dark_text: Color32,
    /// Base color at low alpha, used for tinted surfaces.
    pub light: Color32,
    /// Base color at focus-ring alpha.
    pub ring: Color32,
}

impl AccentPreset {
    /// Resolves a preset by id or by hex value, falling back to indigo.
    ///
    /// Accepts `indigo`, `#4f46e5`, `4f46e5` and the three digit short form.
    pub fn resolve(id_or_hex: &str) -> Self {
        let value = id_or_hex.trim().to_lowercase();
        if let Some(preset) = PRESETS.iter().find(|preset| preset.0 == value) {
            return builtin(preset);
        }

        match parse_hex(&value) {
            Some(color) => match PRESETS.iter().find(|preset| from_hex(preset.2) == color) {
                Some(preset) => builtin(preset),
                None => Self::custom(color),
            },
            None => builtin(&PRESETS[0]),
        }
    }

    /// Derives a preset from a user defined color, matching the legacy brightness steps.
    pub fn custom(base: Color32) -> Self {
        Self {
            id: format!("custom_{}", hex(base).trim_start_matches('#')),
            label: "Color Picasso".to_string(),
            base,
            hover: adjust(base, -25),
            border: adjust(base, 20),
            dark_text: adjust(base, 45),
            light: with_alpha(base, 14),
            ring: with_alpha(base, 35),
        }
    }

    /// Harmonic companion color for charts and dual indicators.
    pub fn companion(&self) -> CompanionColor {
        companion_for(self.base)
    }
}

/// A second color that stays distinguishable from the accent.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CompanionColor {
    /// Base color of the companion.
    pub base: Color32,
    /// Darker shade for hover states.
    pub hover: Color32,
    /// Lighter shade for borders.
    pub border: Color32,
    /// Base color at eighteen percent alpha.
    pub light: Color32,
}

/// All built-in accent ids in display order.
pub fn preset_ids() -> impl Iterator<Item = &'static str> {
    PRESETS.iter().map(|preset| preset.0)
}

/// Formats a color as `#rrggbb`.
pub fn hex(color: Color32) -> String {
    format!("#{:02x}{:02x}{:02x}", color.r(), color.g(), color.b())
}

/// Parses `#rgb`, `#rrggbb`, `rgb` or `rrggbb`, ignoring surrounding whitespace.
pub fn parse_hex(text: &str) -> Option<Color32> {
    let mut clean: String = text.trim().trim_start_matches('#').to_lowercase();
    if !clean.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    if clean.len() == 3 {
        clean = clean.chars().flat_map(|c| [c, c]).collect();
    }
    if clean.len() < 6 {
        return None;
    }
    let channel = |range: std::ops::Range<usize>| u8::from_str_radix(&clean[range], 16).ok();
    Some(Color32::from_rgb(
        channel(0..2)?,
        channel(2..4)?,
        channel(4..6)?,
    ))
}

/// Applies the same brightness step the legacy `adjustHex` helper used.
pub fn adjust(color: Color32, amount: i32) -> Color32 {
    let shift = |value: u8| (i32::from(value) + amount).clamp(0, 255) as u8;
    Color32::from_rgb(shift(color.r()), shift(color.g()), shift(color.b()))
}

/// Sets the alpha channel of a color, keeping the RGB values.
pub fn with_alpha(color: Color32, alpha_percent: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(
        color.r(),
        color.g(),
        color.b(),
        (u32::from(alpha_percent.min(100)) * 255 / 100) as u8,
    )
}

/// Hue of a color in degrees, rounded like the legacy helper.
pub fn hue(color: Color32) -> u16 {
    let r = f32::from(color.r()) / 255.0;
    let g = f32::from(color.g()) / 255.0;
    let b = f32::from(color.b()) / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let raw = if (max - min).abs() < f32::EPSILON {
        0.0
    } else if max == r {
        ((g - b) / (max - min) + if g < b { 6.0 } else { 0.0 }) * 60.0
    } else if max == g {
        ((b - r) / (max - min) + 2.0) * 60.0
    } else {
        ((r - g) / (max - min) + 4.0) * 60.0
    };
    raw.round() as u16 % 360
}

/// Picks a companion color that never clashes with green or cyan accents.
pub fn companion_for(color: Color32) -> CompanionColor {
    let companion = match hue(color) {
        65..=185 => Color32::from_rgb(0x63, 0x66, 0xf1),
        186..=325 => Color32::from_rgb(0xf5, 0x9e, 0x0b),
        _ => Color32::from_rgb(0x63, 0x66, 0xf1),
    };
    CompanionColor {
        base: companion,
        hover: adjust(companion, -20),
        border: adjust(companion, 20),
        light: with_alpha(companion, 18),
    }
}

fn builtin(preset: &(&str, &str, u32, u32, u32, u32, u8)) -> AccentPreset {
    AccentPreset {
        id: preset.0.to_string(),
        label: preset.1.to_string(),
        base: from_hex(preset.2),
        hover: from_hex(preset.3),
        border: from_hex(preset.4),
        dark_text: from_hex(preset.5),
        light: with_alpha(from_hex(preset.2), preset.6),
        ring: with_alpha(from_hex(preset.2), 35),
    }
}

fn from_hex(value: u32) -> Color32 {
    Color32::from_rgb(
        ((value >> 16) & 0xff) as u8,
        ((value >> 8) & 0xff) as u8,
        (value & 0xff) as u8,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_match_the_legacy_values() {
        let indigo = AccentPreset::resolve("indigo");
        assert_eq!(hex(indigo.base), "#4f46e5");
        assert_eq!(hex(indigo.hover), "#4338ca");
        assert_eq!(hex(indigo.border), "#6366f1");
        assert_eq!(hex(indigo.dark_text), "#818cf8");
        assert_eq!(indigo.light.a(), 30);

        let purple = AccentPreset::resolve("#714B67");
        assert_eq!(purple.id, "purple");
        assert_eq!(hex(purple.base), "#714b67");
        assert_eq!(purple.light.a(), 35);

        assert_eq!(AccentPreset::resolve("unknown").id, "indigo");
        assert_eq!(preset_ids().count(), 9);
    }

    #[test]
    fn custom_accent_derives_the_legacy_shades() {
        let custom = AccentPreset::resolve("#123456");
        assert_eq!(custom.id, "custom_123456");
        assert_eq!(hex(custom.hover), "#001b3d");
        assert_eq!(hex(custom.border), "#26486a");
        assert_eq!(hex(custom.dark_text), "#3f6183");
        assert_eq!(custom.light.a(), 35);
        assert_eq!(custom.label, "Color Picasso");
    }

    #[test]
    fn parses_short_and_long_hex_values() {
        assert_eq!(hex(parse_hex("#4f4").expect("hex")), "#44ff44");
        assert_eq!(hex(parse_hex("4f46e5").expect("hex")), "#4f46e5");
        assert!(parse_hex("#zzzzzz").is_none());
        assert!(parse_hex("12").is_none());
    }

    #[test]
    fn companion_avoids_green_clashes() {
        // Green and teal accents get indigo so chart series stay distinguishable.
        assert_eq!(
            hex(companion_for(parse_hex("#059669").expect("hex")).base),
            "#6366f1"
        );
        // Blue and purple accents get warm amber.
        assert_eq!(
            hex(companion_for(parse_hex("#2563eb").expect("hex")).base),
            "#f59e0b"
        );
        assert_eq!(
            hex(companion_for(parse_hex("#7c3aed").expect("hex")).base),
            "#f59e0b"
        );
        // Warm accents get indigo back.
        assert_eq!(
            hex(companion_for(parse_hex("#e11d48").expect("hex")).base),
            "#6366f1"
        );
    }

    #[test]
    fn hue_matches_the_legacy_reference() {
        assert_eq!(hue(parse_hex("#4f46e5").expect("hex")), 243);
        assert_eq!(hue(parse_hex("#059669").expect("hex")), 161);
        assert_eq!(hue(parse_hex("#e11d48").expect("hex")), 347);
    }
}
