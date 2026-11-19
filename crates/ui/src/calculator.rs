//! Standalone calculator window: display, keypad and keyboard input.
//!
//! The window mirrors the legacy `CalculatorModule`
//! (`SOCDOF - TS/src/components/apps/CalculatorModule.tsx`): a permanent slate surface, the mode
//! selector with its history, sound and settings controls, the glass display card with the formula
//! and result lines, the Windows style memory row and the four by five keypad. The key state
//! machine of the desktop card ([`Calculator`]) is reused, extended by memory, percent, sign and
//! backspace.

use egui::{Color32, Context, Event, Id, Key, Pos2, Rect, Rounding, Sense, Stroke, Ui, Vec2};

use crate::focus::{focus_ring, FocusState};
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::widgets::{CalcKey, Calculator, Constant, UnaryOp};

/// Colors of the calculator surface.
///
/// The legacy module paints itself with the fixed slate palette in both appearances
/// (`bg-slate-950`, `bg-slate-900/90`, `bg-slate-800/80`), so the window looks the same in the
/// light and the dark theme.
mod slate {
    use egui::Color32;

    pub const SURFACE: Color32 = Color32::from_rgb(0x02, 0x06, 0x18);
    pub const CARD: Color32 = Color32::from_rgb(0x0e, 0x16, 0x29);
    pub const HEADER: Color32 = Color32::from_rgb(0x0d, 0x15, 0x29);
    /// Digit keys: `slate-800/80` over the surface.
    pub const KEY_DIGIT: Color32 = Color32::from_rgb(0x18, 0x22, 0x36);
    /// Operator column keys: `slate-700/60` over the surface.
    pub const KEY_OPERATOR: Color32 = Color32::from_rgb(0x1d, 0x29, 0x3d);
    /// Mode selector: `slate-800` over the header band.
    pub const KEY: Color32 = Color32::from_rgb(0x1a, 0x25, 0x39);
    /// Function keys of the scientific pad: `slate-900/90` over the surface.
    pub const KEY_SCIENTIFIC: Color32 = Color32::from_rgb(0x0d, 0x15, 0x29);
    pub const KEY_BORDER: Color32 = Color32::from_rgb(0x1e, 0x29, 0x3b);
    pub const BORDER: Color32 = Color32::from_rgb(0x1e, 0x29, 0x3b);
    pub const TEXT: Color32 = Color32::from_rgb(0xf8, 0xfa, 0xfc);
    /// `slate-300`, the percent and sign keys.
    pub const TEXT_SOFT: Color32 = Color32::from_rgb(0xcb, 0xd5, 0xe1);
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(0x94, 0xa3, 0xb8);
    pub const TEXT_DIM: Color32 = Color32::from_rgb(0x47, 0x55, 0x69);
    pub const FORMULA: Color32 = Color32::from_rgb(0x64, 0x74, 0x8b);
    pub const INDIGO: Color32 = Color32::from_rgb(0xa5, 0xb4, 0xfc);
    pub const ROSE_DARK: Color32 = Color32::from_rgb(0x20, 0x06, 0x18);
    pub const ROSE_BORDER: Color32 = Color32::from_rgb(0x4f, 0x26, 0x38);
    pub const ROSE_TEXT: Color32 = Color32::from_rgb(0xfd, 0xa4, 0xaf);
    pub const EMERALD: Color32 = Color32::from_rgb(0x05, 0x96, 0x69);
    pub const EMERALD_TEXT: Color32 = Color32::from_rgb(0x34, 0xd3, 0x99);
    pub const CYAN: Color32 = Color32::from_rgb(0x22, 0xd3, 0xee);
    pub const AMBER: Color32 = Color32::from_rgb(0xfc, 0xd3, 0x4d);
}

/// Labels of the calculator window in the four catalogue languages.
///
/// The legacy module reads them from the catalogue (`calc.*`); the Rust catalogue is generated
/// from the module keys, so the calculator keeps its own table instead of growing the locale
/// files.
struct Labels {
    mode_simple: &'static str,
    mode_simple_desc: &'static str,
    mode_scientific: &'static str,
    mode_scientific_desc: &'static str,
    history: &'static str,
    history_empty: &'static str,
    history_clear: &'static str,
    settings: &'static str,
    sound: &'static str,
    on: &'static str,
    off: &'static str,
    angle: &'static str,
    degrees: &'static str,
    radians: &'static str,
    copied: &'static str,
}

impl Labels {
    fn new(language: socdof_core::domain::settings::Language) -> Self {
        use socdof_core::domain::settings::Language;
        match language {
            Language::De => Self {
                mode_simple: "Einfach / Standard",
                mode_simple_desc: "Grundrechenarten (+, −, ×, ÷), Prozent und Vorzeichen. Ideal für den schnellen Alltag.",
                mode_scientific: "Wissenschaftlich (Schule)",
                mode_scientific_desc: "Trigonometrie, Logarithmen, Potenzen, Wurzeln, Fakultäten und Klammern.",
                history: "Rechenverlauf",
                history_empty: "Noch keine Berechnungen",
                history_clear: "Leeren",
                settings: "Einstellungen & Modus",
                sound: "Ton",
                on: "An",
                off: "Aus",
                angle: "Winkel",
                degrees: "Grad",
                radians: "Bogenmaß",
                copied: "Kopiert!",
            },
            Language::En => Self {
                mode_simple: "Basic / Simple",
                mode_simple_desc: "Basic arithmetic (+, −, ×, ÷), percentages, and signs. Ideal for quick everyday tasks.",
                mode_scientific: "Scientific",
                mode_scientific_desc: "Trigonometry (sin/cos/tan), logarithms, powers, roots, factorials, and parentheses for STEM & education.",
                history: "History",
                history_empty: "No calculations yet",
                history_clear: "Clear",
                settings: "Settings & mode",
                sound: "Sound",
                on: "On",
                off: "Off",
                angle: "Angle",
                degrees: "Degrees",
                radians: "Radians",
                copied: "Copied!",
            },
            Language::Fr => Self {
                mode_simple: "Standard",
                mode_simple_desc: "Calculs de base et quotidien",
                mode_scientific: "Scientifique",
                mode_scientific_desc: "Trigonométrie, puissances, racines",
                history: "Historique",
                history_empty: "Aucun calcul",
                history_clear: "Effacer",
                settings: "Réglages et mode",
                sound: "Son",
                on: "Activé",
                off: "Désactivé",
                angle: "Angle",
                degrees: "Degrés",
                radians: "Radians",
                copied: "Copié !",
            },
            Language::Es => Self {
                mode_simple: "Estándar",
                mode_simple_desc: "Operaciones básicas y día a día",
                mode_scientific: "Científica",
                mode_scientific_desc: "Trigonometría, potencias, raíces",
                history: "Historial",
                history_empty: "Sin cálculos todavía",
                history_clear: "Borrar",
                settings: "Ajustes y modo",
                sound: "Sonido",
                on: "Activado",
                off: "Desactivado",
                angle: "Ángulo",
                degrees: "Grados",
                radians: "Radianes",
                copied: "¡Copiado!",
            },
        }
    }
}

/// Mode of the calculator (`calc.mode_simple` / `calc.mode_scientific`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalcMode {
    /// Four basic operations, percent and sign.
    Simple,
    /// Adds trigonometry, logarithms, powers, constants and parentheses.
    Scientific,
}

/// One entry of the calculation history.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryEntry {
    /// Expression as it was evaluated, for example `12 + 3 =`.
    pub expression: String,
    /// Formatted result.
    pub result: String,
}

/// State of the calculator window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalculatorWindow {
    /// Key state machine of the pad.
    pub engine: Calculator,
    /// Simple or scientific pad.
    pub mode: CalcMode,
    /// The mode popover is open.
    pub mode_menu: bool,
    /// The history panel is open.
    pub history_open: bool,
    /// The settings panel is open.
    pub settings_open: bool,
    /// Whether key presses play the click sound.
    pub sound: bool,
    /// `true` for degrees, `false` for radians.
    pub degrees: bool,
    /// Significant digits kept by the scientific functions.
    pub precision: u8,
    /// Finished calculations, newest first.
    pub history: Vec<HistoryEntry>,
    /// The last result was copied to the clipboard, shows `Kopiert!`.
    pub copied: bool,
    /// `2nd` is armed, so the scientific keys show their inverse functions.
    pub second: bool,
}

impl Default for CalculatorWindow {
    fn default() -> Self {
        Self::new()
    }
}

impl CalculatorWindow {
    /// A cleared calculator in simple mode.
    pub fn new() -> Self {
        Self {
            engine: Calculator::new(),
            mode: CalcMode::Simple,
            mode_menu: false,
            history_open: false,
            settings_open: false,
            sound: true,
            degrees: true,
            precision: 6,
            history: Vec::new(),
            copied: false,
            second: false,
        }
    }

    /// Display text of the result line.
    pub fn display(&self) -> String {
        self.engine.display()
    }

    /// Presses one key and records finished calculations in the history.
    pub fn press(&mut self, key: CalcKey) {
        let before = self.engine.formula().to_owned();
        let was_pending = key == CalcKey::Equals;
        self.engine.press(key);
        self.copied = false;
        if was_pending {
            let expression = if before.trim().is_empty() {
                format!("{} =", self.engine.display())
            } else {
                format!("{} {} =", before, self.engine.display())
            };
            self.history.insert(
                0,
                HistoryEntry {
                    expression: expression.trim().to_owned(),
                    result: self.engine.display(),
                },
            );
            self.history.truncate(50);
        }
    }
}

/// One key of the simple pad.
struct PadKey {
    label: &'static str,
    key: CalcKey,
    column: u32,
    row: u32,
    style: KeyStyle,
}

/// Visual weight of a keypad button.
#[derive(Clone, Copy, PartialEq, Eq)]
enum KeyStyle {
    /// Digits and the decimal separator.
    Digit,
    /// `+ − × ÷`, light indigo.
    Operator,
    /// `AC`, rose.
    Clear,
    /// `=`, emerald fill.
    Equals,
    /// Percent, sign and backspace, muted.
    Utility,
}

/// Simple keypad in reading order (`CalculatorModule.tsx:840`).
const SIMPLE_PAD: &[PadKey] = &[
    PadKey {
        label: "AC",
        key: CalcKey::Clear,
        column: 0,
        row: 0,
        style: KeyStyle::Clear,
    },
    PadKey {
        label: "",
        key: CalcKey::Backspace,
        column: 1,
        row: 0,
        style: KeyStyle::Utility,
    },
    PadKey {
        label: "%",
        key: CalcKey::Percent,
        column: 2,
        row: 0,
        style: KeyStyle::Utility,
    },
    PadKey {
        label: "÷",
        key: CalcKey::Divide,
        column: 3,
        row: 0,
        style: KeyStyle::Operator,
    },
    PadKey {
        label: "7",
        key: CalcKey::Digit(7),
        column: 0,
        row: 1,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "8",
        key: CalcKey::Digit(8),
        column: 1,
        row: 1,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "9",
        key: CalcKey::Digit(9),
        column: 2,
        row: 1,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "×",
        key: CalcKey::Multiply,
        column: 3,
        row: 1,
        style: KeyStyle::Operator,
    },
    PadKey {
        label: "4",
        key: CalcKey::Digit(4),
        column: 0,
        row: 2,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "5",
        key: CalcKey::Digit(5),
        column: 1,
        row: 2,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "6",
        key: CalcKey::Digit(6),
        column: 2,
        row: 2,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "−",
        key: CalcKey::Subtract,
        column: 3,
        row: 2,
        style: KeyStyle::Operator,
    },
    PadKey {
        label: "1",
        key: CalcKey::Digit(1),
        column: 0,
        row: 3,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "2",
        key: CalcKey::Digit(2),
        column: 1,
        row: 3,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "3",
        key: CalcKey::Digit(3),
        column: 2,
        row: 3,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "+",
        key: CalcKey::Add,
        column: 3,
        row: 3,
        style: KeyStyle::Operator,
    },
    PadKey {
        label: "±",
        key: CalcKey::Sign,
        column: 0,
        row: 4,
        style: KeyStyle::Utility,
    },
    PadKey {
        label: "0",
        key: CalcKey::Digit(0),
        column: 1,
        row: 4,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: ".",
        key: CalcKey::Decimal,
        column: 2,
        row: 4,
        style: KeyStyle::Digit,
    },
    PadKey {
        label: "=",
        key: CalcKey::Equals,
        column: 3,
        row: 4,
        style: KeyStyle::Equals,
    },
];

/// Draws the calculator inside its native desktop window.
pub fn calculator_window(
    ctx: &Context,
    active: bool,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut CalculatorWindow,
) {
    let labels = Labels::new(texts.language());
    if active {
        for event in ctx.input(|input| input.events.clone()) {
            match event {
                Event::Text(text) => {
                    for character in text.chars() {
                        if let Some(key) = key_for_char(character) {
                            state.press(key);
                        }
                    }
                }
                Event::Key {
                    key: Key::Enter,
                    pressed: true,
                    ..
                } => state.press(CalcKey::Equals),
                Event::Key {
                    key: Key::Escape,
                    pressed: true,
                    ..
                } => state.press(CalcKey::Clear),
                Event::Key {
                    key: Key::Backspace,
                    pressed: true,
                    ..
                } => state.press(CalcKey::Backspace),
                Event::Key {
                    key: Key::Delete,
                    pressed: true,
                    ..
                } => state.press(CalcKey::Clear),
                _ => {}
            }
        }
    }

    let area = ui.max_rect();
    let painter = ui.painter().clone();
    // The window chrome already keeps the 12 point white frame of the reference, so the dark
    // surface fills the content rectangle and only rounds its own corners.
    let surface = area;
    painter.rect(surface, Rounding::same(12.0), slate::SURFACE, Stroke::NONE);
    painter.rect(
        Rect::from_min_size(surface.min, Vec2::new(surface.width(), 41.0)),
        Rounding::same(12.0),
        slate::HEADER,
        Stroke::NONE,
    );

    // Header: the mode selector and the three actions on one 30 point row.
    let header = Rect::from_min_size(
        Pos2::new(surface.left(), surface.top() + 6.0),
        Vec2::new(surface.width(), 30.0),
    );
    let mode_rect = Rect::from_min_size(
        Pos2::new(header.left() + 15.0, header.top()),
        Vec2::new(140.0, 30.0),
    );
    let mode_response = ui.interact(mode_rect, Id::new("socdof-calc-mode"), Sense::click());
    painter.rect(
        mode_rect,
        Rounding::same(8.0),
        slate::KEY,
        Stroke::new(1.0_f32, slate::KEY_BORDER),
    );
    Icon::Calculator.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(mode_rect.left() + 18.0, mode_rect.center().y),
            Vec2::splat(16.0),
        ),
        if state.mode == CalcMode::Scientific {
            slate::CYAN
        } else {
            slate::EMERALD_TEXT
        },
        1.8,
    );
    painter.text(
        Pos2::new(mode_rect.left() + 32.0, mode_rect.center().y),
        egui::Align2::LEFT_CENTER,
        if state.mode == CalcMode::Scientific {
            labels.mode_scientific
        } else {
            labels.mode_simple
        },
        egui::FontId::new(13.0, crate::theme::semibold()),
        slate::TEXT,
    );
    Icon::ChevronDown.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(mode_rect.right() - 16.0, mode_rect.center().y),
            Vec2::splat(14.0),
        ),
        slate::TEXT_MUTED,
        1.8,
    );
    if mode_response.clicked() {
        state.mode_menu = !state.mode_menu;
        state.history_open = false;
        state.settings_open = false;
    }

    let action = |painter: &egui::Painter,
                  ui: &mut Ui,
                  theme: &Theme,
                  focus: &mut FocusState,
                  right: f32,
                  icon: Icon,
                  color: Color32,
                  id: &'static str| {
        let rect = Rect::from_center_size(
            Pos2::new(right - 16.0, header.center().y),
            Vec2::splat(28.0),
        );
        let focused = focus.register(Id::new(("socdof-calc-action", id)));
        let response = ui.interact(rect, Id::new(("socdof-calc-action", id)), Sense::click());
        icon.draw(
            painter,
            Rect::from_center_size(rect.center(), Vec2::splat(16.0)),
            color,
            1.8,
        );
        if focused {
            focus_ring(ui, theme, rect);
        }
        response.clicked() || focus.activate(Id::new(("socdof-calc-action", id)))
    };

    let mut action_right = header.right() - 8.0;
    if action(
        &painter,
        ui,
        theme,
        focus,
        action_right,
        Icon::Settings,
        slate::TEXT_MUTED,
        "settings",
    ) {
        state.settings_open = !state.settings_open;
        state.history_open = false;
        state.mode_menu = false;
    }
    action_right -= 26.0;
    if action(
        &painter,
        ui,
        theme,
        focus,
        action_right,
        if state.sound {
            Icon::Speaker
        } else {
            Icon::SpeakerOff
        },
        if state.sound {
            slate::EMERALD_TEXT
        } else {
            slate::TEXT_DIM
        },
        "sound",
    ) {
        state.sound = !state.sound;
    }
    action_right -= 26.0;
    if action(
        &painter,
        ui,
        theme,
        focus,
        action_right,
        Icon::History,
        if state.history_open {
            slate::EMERALD_TEXT
        } else {
            slate::TEXT_MUTED
        },
        "history",
    ) {
        state.history_open = !state.history_open;
        state.settings_open = false;
        state.mode_menu = false;
    }

    // Workspace: 8 points of padding, the display card, the memory row and the keypad.
    let body = Rect::from_min_max(
        Pos2::new(surface.left() + 8.0, surface.top() + 51.0),
        Pos2::new(surface.right() - 8.0, surface.bottom() - 2.0),
    );
    let display = Rect::from_min_size(
        Pos2::new(body.left(), body.top()),
        Vec2::new(body.width(), 110.0),
    );
    paint_display(&painter, display, state);

    let copy_rect = Rect::from_center_size(
        Pos2::new(display.right() - 24.0, display.top() + 16.0),
        Vec2::splat(24.0),
    );
    let copy_id = Id::new("socdof-calc-copy");
    let copy_response = ui.interact(copy_rect, copy_id, Sense::click());
    if state.copied {
        painter.text(
            Pos2::new(copy_rect.center().x - 6.0, copy_rect.center().y),
            egui::Align2::RIGHT_CENTER,
            labels.copied,
            egui::FontId::new(10.0, crate::theme::semibold()),
            slate::EMERALD_TEXT,
        );
    } else {
        Icon::Copy.draw(
            &painter,
            Rect::from_center_size(copy_rect.center(), Vec2::splat(16.0)),
            slate::TEXT_MUTED,
            1.7,
        );
    }
    if copy_response.clicked() {
        ui.output_mut(|output| output.copied_text = state.display());
        state.copied = true;
    }

    // Memory row (`MC MR M+ M- MS`), light text buttons like Windows 11.
    let memory = Rect::from_min_size(
        Pos2::new(body.left(), display.bottom() + 9.0),
        Vec2::new(body.width(), 26.0),
    );
    let memory_keys = [
        ("MC", CalcKey::MemoryClear),
        ("MR", CalcKey::MemoryRecall),
        ("M+", CalcKey::MemoryAdd),
        ("M-", CalcKey::MemorySubtract),
        ("MS", CalcKey::MemoryStore),
    ];
    let step = (surface.width() - 64.0) / 4.0;
    for (index, (label, key)) in memory_keys.iter().enumerate() {
        let center = Pos2::new(
            surface.left() + 32.0 + step * index as f32,
            memory.center().y,
        );
        let rect = Rect::from_center_size(center, Vec2::new(48.0, 24.0));
        let id = Id::new(("socdof-calc-memory", *label));
        let enabled = state.engine.memory() != 0
            || matches!(
                key,
                CalcKey::MemoryAdd | CalcKey::MemorySubtract | CalcKey::MemoryStore
            );
        let response = ui.interact(rect, id, Sense::click());
        let highlight = *key == CalcKey::MemoryRecall && state.engine.memory() != 0;
        painter.text(
            center,
            egui::Align2::CENTER_CENTER,
            *label,
            egui::FontId::new(13.0, crate::theme::semibold()),
            if !enabled {
                slate::TEXT_DIM.linear_multiply(0.6)
            } else if highlight {
                slate::AMBER
            } else {
                slate::TEXT_MUTED
            },
        );
        if enabled && response.clicked() {
            state.press(*key);
        }
    }

    let pad_top = memory.bottom() + 7.0;
    let keypad_area = Rect::from_min_size(
        Pos2::new(body.left() + 1.0, pad_top),
        Vec2::new(body.width() - 2.0, (body.bottom() - pad_top).max(120.0)),
    );
    if state.mode == CalcMode::Simple {
        paint_numeric_pad(ui, &painter, keypad_area, state);
    } else {
        let sci_height = (keypad_area.height() * 0.42).min(152.0);
        let sci = Rect::from_min_size(keypad_area.min, Vec2::new(keypad_area.width(), sci_height));
        paint_scientific_pad(ui, &painter, sci, state);
        let rest = Rect::from_min_size(
            Pos2::new(keypad_area.left(), sci.bottom() + 8.0),
            Vec2::new(
                keypad_area.width(),
                (keypad_area.bottom() - sci.bottom() - 8.0).max(120.0),
            ),
        );
        paint_numeric_pad(ui, &painter, rest, state);
    }

    // Mode popover, history drawer and settings card.
    if state.mode_menu {
        let popover = Rect::from_min_size(
            Pos2::new(mode_rect.left(), mode_rect.bottom() + 6.0),
            Vec2::new(224.0, 108.0),
        );
        painter.rect(
            popover,
            Rounding::same(12.0),
            slate::CARD,
            Stroke::new(1.0_f32, slate::KEY_BORDER),
        );
        for (index, (mode, title, subtitle)) in [
            (
                CalcMode::Simple,
                labels.mode_simple,
                labels.mode_simple_desc,
            ),
            (
                CalcMode::Scientific,
                labels.mode_scientific,
                labels.mode_scientific_desc,
            ),
        ]
        .iter()
        .enumerate()
        {
            let rect = Rect::from_min_size(
                Pos2::new(
                    popover.left() + 6.0,
                    popover.top() + 6.0 + index as f32 * 50.0,
                ),
                Vec2::new(popover.width() - 12.0, 46.0),
            );
            let id = Id::new(("socdof-calc-mode-choice", index));
            let response = ui.interact(rect, id, Sense::click());
            if state.mode == *mode {
                painter.rect(
                    rect,
                    Rounding::same(8.0),
                    slate::EMERALD.linear_multiply(0.25),
                    Stroke::new(1.0_f32, slate::EMERALD_TEXT.linear_multiply(0.4)),
                );
            }
            painter.text(
                Pos2::new(rect.left() + 10.0, rect.top() + 12.0),
                egui::Align2::LEFT_CENTER,
                *title,
                egui::FontId::new(12.0, crate::theme::semibold()),
                if state.mode == *mode {
                    slate::EMERALD_TEXT
                } else {
                    slate::TEXT
                },
            );
            painter.text(
                Pos2::new(rect.left() + 10.0, rect.top() + 30.0),
                egui::Align2::LEFT_CENTER,
                *subtitle,
                egui::FontId::new(10.0, egui::FontFamily::Proportional),
                slate::TEXT_DIM,
            );
            if response.clicked() {
                state.mode = *mode;
                state.mode_menu = false;
            }
        }
    }

    if state.history_open {
        let panel = Rect::from_min_size(
            Pos2::new(body.left(), pad_top),
            Vec2::new(body.width(), (body.bottom() - pad_top).max(160.0)),
        );
        painter.rect(
            panel,
            Rounding::same(16.0),
            slate::CARD,
            Stroke::new(1.0_f32, slate::BORDER),
        );
        painter.text(
            Pos2::new(panel.left() + 14.0, panel.top() + 16.0),
            egui::Align2::LEFT_CENTER,
            labels.history,
            egui::FontId::new(13.0, crate::theme::semibold()),
            slate::TEXT,
        );
        if state.history.is_empty() {
            painter.text(
                panel.center(),
                egui::Align2::CENTER_CENTER,
                labels.history_empty,
                egui::FontId::new(12.0, egui::FontFamily::Proportional),
                slate::TEXT_DIM,
            );
        }
        for (index, entry) in state.history.iter().take(8).enumerate() {
            let y = panel.top() + 40.0 + index as f32 * 34.0;
            if y + 28.0 > panel.bottom() {
                break;
            }
            painter.text(
                Pos2::new(panel.left() + 14.0, y + 8.0),
                egui::Align2::LEFT_CENTER,
                &entry.expression,
                egui::FontId::new(11.0, egui::FontFamily::Monospace),
                slate::TEXT_DIM,
            );
            painter.text(
                Pos2::new(panel.right() - 14.0, y + 20.0),
                egui::Align2::RIGHT_CENTER,
                &entry.result,
                egui::FontId::new(15.0, crate::theme::mono_bold()),
                slate::TEXT,
            );
        }
        let clear = Rect::from_min_size(
            Pos2::new(panel.right() - 90.0, panel.top() + 6.0),
            Vec2::new(78.0, 22.0),
        );
        let id = Id::new("socdof-calc-history-clear");
        if ui.interact(clear, id, Sense::click()).clicked() {
            state.history.clear();
        }
        painter.text(
            clear.center(),
            egui::Align2::CENTER_CENTER,
            labels.history_clear,
            egui::FontId::new(10.0, crate::theme::semibold()),
            slate::TEXT_MUTED,
        );
    }

    if state.settings_open {
        let panel = Rect::from_min_size(
            Pos2::new(body.left(), pad_top),
            Vec2::new(body.width(), (body.bottom() - pad_top).max(160.0)),
        );
        painter.rect(
            panel,
            Rounding::same(16.0),
            slate::CARD,
            Stroke::new(1.0_f32, slate::BORDER),
        );
        painter.text(
            Pos2::new(panel.left() + 14.0, panel.top() + 16.0),
            egui::Align2::LEFT_CENTER,
            labels.settings,
            egui::FontId::new(13.0, crate::theme::semibold()),
            slate::TEXT,
        );
        let rows = [
            (
                labels.sound,
                if state.sound { labels.on } else { labels.off },
            ),
            (
                labels.angle,
                if state.degrees {
                    labels.degrees
                } else {
                    labels.radians
                },
            ),
        ];
        for (index, (label, value)) in rows.iter().enumerate() {
            let rect = Rect::from_min_size(
                Pos2::new(
                    panel.left() + 10.0,
                    panel.top() + 36.0 + index as f32 * 32.0,
                ),
                Vec2::new(panel.width() - 20.0, 28.0),
            );
            let id = Id::new(("socdof-calc-setting", index));
            let response = ui.interact(rect, id, Sense::click());
            painter.rect(
                rect,
                Rounding::same(8.0),
                slate::KEY,
                Stroke::new(1.0_f32, slate::KEY_BORDER),
            );
            painter.text(
                Pos2::new(rect.left() + 10.0, rect.center().y),
                egui::Align2::LEFT_CENTER,
                *label,
                egui::FontId::new(11.0, crate::theme::semibold()),
                slate::TEXT_MUTED,
            );
            painter.text(
                Pos2::new(rect.right() - 10.0, rect.center().y),
                egui::Align2::RIGHT_CENTER,
                *value,
                egui::FontId::new(11.0, crate::theme::semibold()),
                slate::EMERALD_TEXT,
            );
            if response.clicked() {
                if index == 0 {
                    state.sound = !state.sound;
                } else {
                    state.degrees = !state.degrees;
                }
            }
        }
    }
}

/// Draws the five by three function pad of the scientific mode.
fn paint_scientific_pad(
    ui: &mut Ui,
    painter: &egui::Painter,
    rect: Rect,
    state: &mut CalculatorWindow,
) {
    const LABELS: [[(&str, &str); 5]; 3] = [
        [
            ("2nd", "2nd"),
            ("sin", "sin⁻¹"),
            ("cos", "cos⁻¹"),
            ("tan", "tan⁻¹"),
            ("ln", "eˣ"),
        ],
        [
            ("log", "10ˣ"),
            ("√", "∛"),
            ("x²", "x³"),
            ("xʸ", "xʸ"),
            ("1/x", "1/x"),
        ],
        [("(", "("), (")", ")"), ("π", "π"), ("e", "e"), ("n!", "n!")],
    ];
    let gap = 7.0;
    let key_width = (rect.width() - gap * 4.0) / 5.0;
    let key_height = (rect.height() - gap * 2.0) / 3.0;
    for (row, keys) in LABELS.iter().enumerate() {
        for (column, (label, second_label)) in keys.iter().enumerate() {
            let key_rect = Rect::from_min_size(
                Pos2::new(
                    rect.left() + column as f32 * (key_width + gap),
                    rect.top() + row as f32 * (key_height + gap),
                ),
                Vec2::new(key_width, key_height),
            );
            let id = Id::new(("socdof-calc-sci", row, column));
            let response = ui.interact(key_rect, id, Sense::click());
            let active = row == 0 && column == 0 && state.second;
            let fill = if active {
                slate::EMERALD.linear_multiply(0.35)
            } else if response.hovered() {
                slate::KEY_SCIENTIFIC.linear_multiply(1.5)
            } else {
                slate::KEY_SCIENTIFIC
            };
            painter.rect(
                key_rect,
                Rounding::same(12.0),
                fill,
                Stroke::new(
                    1.0_f32,
                    if active {
                        slate::EMERALD_TEXT.linear_multiply(0.5)
                    } else {
                        slate::KEY_BORDER
                    },
                ),
            );
            painter.text(
                key_rect.center(),
                egui::Align2::CENTER_CENTER,
                if state.second && !(row == 0 && column == 0) {
                    *second_label
                } else {
                    *label
                },
                egui::FontId::new(
                    if label.chars().count() > 3 {
                        11.0
                    } else {
                        12.5
                    },
                    egui::FontFamily::Monospace,
                ),
                if active {
                    slate::EMERALD_TEXT
                } else {
                    slate::TEXT_SOFT
                },
            );
            if !response.clicked() {
                continue;
            }
            let second = state.second;
            match (row, column) {
                (0, 0) => state.second = !state.second,
                (0, 1) => state.engine.unary(
                    if second { UnaryOp::Asin } else { UnaryOp::Sin },
                    state.degrees,
                ),
                (0, 2) => state.engine.unary(
                    if second { UnaryOp::Acos } else { UnaryOp::Cos },
                    state.degrees,
                ),
                (0, 3) => state.engine.unary(
                    if second { UnaryOp::Atan } else { UnaryOp::Tan },
                    state.degrees,
                ),
                (0, 4) => state.engine.unary(
                    if second { UnaryOp::Exp } else { UnaryOp::Ln },
                    state.degrees,
                ),
                (1, 0) => state.engine.unary(
                    if second {
                        UnaryOp::Exp10
                    } else {
                        UnaryOp::Log10
                    },
                    state.degrees,
                ),
                (1, 1) => state.engine.unary(
                    if second { UnaryOp::Cbrt } else { UnaryOp::Sqrt },
                    state.degrees,
                ),
                (1, 2) => state.engine.unary(
                    if second {
                        UnaryOp::Cube
                    } else {
                        UnaryOp::Square
                    },
                    state.degrees,
                ),
                (1, 3) => state.engine.power(),
                (1, 4) => state.engine.unary(UnaryOp::Reciprocal, state.degrees),
                (2, 0) => state.engine.open_group(),
                (2, 1) => state.engine.close_group(),
                (2, 2) => state.engine.constant(Constant::Pi),
                (2, 3) => state.engine.constant(Constant::E),
                _ => state.engine.unary(UnaryOp::Factorial, state.degrees),
            }
        }
    }
}

/// Draws the four by five numeric pad into `keypad`.
fn paint_numeric_pad(
    ui: &mut Ui,
    painter: &egui::Painter,
    keypad: Rect,
    state: &mut CalculatorWindow,
) {
    let painter = painter.clone();
    let gap = 7.0;
    let key_width = (keypad.width() - gap * 3.0) / 4.0;
    let key_height = (keypad.height() - 8.0 * 4.0) / 5.0;
    for key in SIMPLE_PAD {
        let rect = Rect::from_min_size(
            Pos2::new(
                keypad.left() + key.column as f32 * (key_width + gap),
                keypad.top() + key.row as f32 * (key_height + 8.0),
            ),
            Vec2::new(key_width, key_height),
        );
        let id = Id::new(("socdof-calc-key", key.label, key.column, key.row));
        let response = ui.interact(rect, id, Sense::click());
        let (fill, border, color) = match key.style {
            KeyStyle::Equals => (slate::EMERALD, slate::EMERALD, slate::TEXT),
            KeyStyle::Clear => (slate::ROSE_DARK, slate::ROSE_BORDER, slate::ROSE_TEXT),
            KeyStyle::Operator => (slate::KEY_OPERATOR, slate::KEY_BORDER, slate::INDIGO),
            KeyStyle::Digit => (slate::KEY_DIGIT, slate::KEY_BORDER, slate::TEXT),
            KeyStyle::Utility => (slate::KEY_DIGIT, slate::KEY_BORDER, slate::TEXT_SOFT),
        };
        painter.rect(
            rect,
            Rounding::same(12.0),
            if response.hovered() {
                fill.linear_multiply(1.15)
            } else {
                fill
            },
            Stroke::new(1.0_f32, border),
        );
        if key.key == CalcKey::Backspace {
            Icon::Backspace.draw(
                &painter,
                Rect::from_center_size(rect.center(), Vec2::splat(22.0)),
                color,
                1.8,
            );
        } else {
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                key.label,
                egui::FontId::new(
                    if key.style == KeyStyle::Equals {
                        34.0
                    } else {
                        30.0
                    },
                    if key.style == KeyStyle::Digit
                        || key.style == KeyStyle::Operator
                        || key.style == KeyStyle::Clear
                    {
                        crate::theme::heavy()
                    } else {
                        crate::theme::semibold()
                    },
                ),
                color,
            );
        }
        if response.clicked() {
            state.press(key.key);
        }
    }
}

/// Paints the display card: the formula line above the right aligned result.
fn paint_display(painter: &egui::Painter, rect: Rect, state: &CalculatorWindow) {
    painter.rect(
        rect,
        Rounding::same(16.0),
        slate::CARD,
        Stroke::new(1.0_f32, slate::BORDER),
    );
    let formula = state.engine.formula();
    if !formula.is_empty() {
        painter.text(
            Pos2::new(rect.right() - 16.0, rect.top() + 26.0),
            egui::Align2::RIGHT_CENTER,
            formula,
            egui::FontId::new(12.0, egui::FontFamily::Monospace),
            slate::FORMULA,
        );
    }
    let text = state.display();
    let mut size = 48.0;
    while size > 20.0 {
        let galley = painter.layout_no_wrap(
            text.clone(),
            egui::FontId::new(size, crate::theme::mono_bold()),
            slate::TEXT,
        );
        if galley.size().x <= rect.width() - 32.0 {
            break;
        }
        size -= 4.0;
    }
    painter.text(
        Pos2::new(rect.right() - 14.0, rect.bottom() - 30.0),
        egui::Align2::RIGHT_CENTER,
        text,
        egui::FontId::new(size, crate::theme::mono_bold()),
        slate::TEXT,
    );
}

/// Maps a typed character to a calculator key.
fn key_for_char(character: char) -> Option<CalcKey> {
    Some(match character {
        '0'..='9' => CalcKey::Digit(character as u8 - b'0'),
        '.' | ',' => CalcKey::Decimal,
        '+' => CalcKey::Add,
        '-' => CalcKey::Subtract,
        '*' | 'x' | 'X' => CalcKey::Multiply,
        '/' | ':' => CalcKey::Divide,
        '=' => CalcKey::Equals,
        'c' | 'C' => CalcKey::Clear,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pad_covers_every_basic_operation() {
        let keys: Vec<CalcKey> = SIMPLE_PAD.iter().map(|key| key.key).collect();
        for expected in [
            CalcKey::Add,
            CalcKey::Subtract,
            CalcKey::Multiply,
            CalcKey::Divide,
            CalcKey::Equals,
            CalcKey::Clear,
            CalcKey::Percent,
            CalcKey::Sign,
            CalcKey::Backspace,
        ] {
            assert!(keys.contains(&expected), "key {expected:?} missing");
        }
        for digit in 0..=9 {
            assert!(
                keys.contains(&CalcKey::Digit(digit)),
                "digit {digit} missing"
            );
        }
    }

    #[test]
    fn typed_characters_drive_the_engine() {
        let mut window = CalculatorWindow::new();
        for character in "12+3=".chars() {
            if let Some(key) = key_for_char(character) {
                window.press(key);
            }
        }
        assert_eq!(window.display(), "15");
        assert_eq!(window.history.len(), 1);
        assert_eq!(window.history[0].result, "15");
    }

    #[test]
    fn memory_percent_sign_and_backspace_follow_the_legacy_pad() {
        let mut window = CalculatorWindow::new();
        for key in [
            CalcKey::Digit(5),
            CalcKey::Digit(0),
            CalcKey::MemoryStore,
            CalcKey::Clear,
            CalcKey::MemoryRecall,
        ] {
            window.press(key);
        }
        assert_eq!(window.display(), "50");
        window.press(CalcKey::Sign);
        assert_eq!(window.display(), "-50");
        window.press(CalcKey::Backspace);
        assert_eq!(window.display(), "-5");
        window.press(CalcKey::Clear);
        for key in [
            CalcKey::Digit(2),
            CalcKey::Digit(0),
            CalcKey::Digit(0),
            CalcKey::Percent,
        ] {
            window.press(key);
        }
        assert_eq!(window.display(), "2");
    }

    #[test]
    fn the_scientific_pad_computes_reference_results() {
        let mut window = CalculatorWindow::new();
        window.mode = CalcMode::Scientific;
        window.press(CalcKey::Digit(9));
        window.engine.unary(UnaryOp::Sqrt, true);
        assert_eq!(window.display(), "3");

        window.press(CalcKey::Clear);
        window.press(CalcKey::Digit(2));
        window.engine.power();
        window.press(CalcKey::Digit(1));
        window.press(CalcKey::Digit(0));
        window.press(CalcKey::Equals);
        assert_eq!(window.display(), "1024");

        window.press(CalcKey::Clear);
        window.press(CalcKey::Digit(3));
        window.press(CalcKey::Digit(0));
        window.engine.unary(UnaryOp::Sin, true);
        assert_eq!(window.display(), "0.5");

        window.press(CalcKey::Clear);
        window.press(CalcKey::Digit(5));
        window.engine.unary(UnaryOp::Factorial, true);
        assert_eq!(window.display(), "120");
    }

    #[test]
    fn the_scientific_groups_fold_like_the_reference() {
        let mut window = CalculatorWindow::new();
        window.mode = CalcMode::Scientific;
        window.engine.open_group();
        window.press(CalcKey::Digit(2));
        window.press(CalcKey::Add);
        window.press(CalcKey::Digit(3));
        window.engine.close_group();
        window.press(CalcKey::Multiply);
        window.press(CalcKey::Digit(4));
        window.press(CalcKey::Equals);
        assert_eq!(window.display(), "20");

        window.press(CalcKey::Clear);
        window.engine.constant(Constant::Pi);
        assert_eq!(window.display(), "3.142");
    }

    #[test]
    fn the_window_paints_without_a_display() {
        let ctx = crate::theme::headless_context();
        let theme = Theme::new(crate::theme::Appearance::Dark, "indigo");
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let mut state = CalculatorWindow::new();
        let output = ctx.run(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(420.0, 560.0))),
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    calculator_window(ctx, true, ui, &theme, &texts, &mut focus, &mut state);
                });
            },
        );
        assert!(output.shapes.len() > 20, "the calculator drew little");
    }
}
