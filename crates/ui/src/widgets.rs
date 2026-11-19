//! Desktop widgets layer: clock, date, status, calculator and notes.
//!
//! Widgets are painted directly into the desktop surface, before the floating windows are drawn, so
//! they can never cover a window or change the window z-order. The layer is plain data: the
//! calculator is an integer state machine and the notes are a plain string, so both can be tested
//! and persisted without a display.

use egui::{
    Button, Color32, FontId, Id, Pos2, Rect, RichText, Rounding, Sense, Stroke, TextEdit, Ui, Vec2,
    WidgetInfo, WidgetType,
};

use socdof_core::domain::settings::Language;

use crate::desktop::format_clock;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_SMALL, RADIUS_CARD, RADIUS_CONTROL};

/// Width of the widget card.
pub const WIDGET_WIDTH: f32 = 216.0;
/// Height of the clock, date and status card.
pub const WIDGET_HEIGHT: f32 = 108.0;
/// Height of the calculator card.
pub const CALCULATOR_HEIGHT: f32 = 236.0;
/// Height of the notes card.
pub const NOTES_HEIGHT: f32 = 132.0;

/// Connection state shown by the status widget.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Connection {
    /// Connected to the network.
    #[default]
    Online,
    /// No network connection (a placeholder until the network service exists).
    Offline,
}

impl Connection {
    /// Catalogue key of the status text.
    pub fn label_key(self) -> &'static str {
        match self {
            Connection::Online => "widget_online",
            Connection::Offline => "widget_offline",
        }
    }

    /// Switches between online and offline.
    pub fn toggle(self) -> Self {
        match self {
            Connection::Online => Connection::Offline,
            Connection::Offline => Connection::Online,
        }
    }
}

/// Key of the desktop calculator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalcKey {
    /// A digit from 0 to 9.
    Digit(u8),
    /// The decimal separator.
    Decimal,
    /// Addition.
    Add,
    /// Subtraction.
    Subtract,
    /// Multiplication.
    Multiply,
    /// Division.
    Divide,
    /// Evaluates the pending operation.
    Equals,
    /// Resets the calculator.
    Clear,
    /// Removes the last typed digit (`Delete` key of the legacy pad).
    Backspace,
    /// Turns the visible value into a percentage of the accumulator.
    Percent,
    /// Flips the sign of the visible value.
    Sign,
    /// Clears the memory register (`MC`).
    MemoryClear,
    /// Writes the memory register into the display (`MR`).
    MemoryRecall,
    /// Adds the display to the memory register (`M+`).
    MemoryAdd,
    /// Subtracts the display from the memory register (`M-`).
    MemorySubtract,
    /// Stores the display in the memory register (`MS`).
    MemoryStore,
}

/// Pending arithmetic operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Operator {
    Add,
    Subtract,
    Multiply,
    Divide,
    /// Exponentiation of the scientific pad.
    Pow,
}

/// Desktop calculator working on thousandths, so no binary float ever reaches the display.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Calculator {
    entry: String,
    accumulator: i128,
    pending: Option<Operator>,
    fresh: bool,
    /// Memory register of the Windows style `MC … MS` row.
    memory: i128,
    /// Left side of the pending operation, shown above the result.
    formula: String,
    /// Open parenthesis groups, each with its accumulator and pending operation.
    groups: Vec<(i128, Option<Operator>)>,
}

impl Default for Calculator {
    fn default() -> Self {
        Self::new()
    }
}

impl Calculator {
    /// A cleared calculator.
    pub fn new() -> Self {
        Self {
            entry: String::new(),
            accumulator: 0,
            pending: None,
            fresh: true,
            memory: 0,
            formula: String::new(),
            groups: Vec::new(),
        }
    }

    /// Memory register, in thousandths.
    pub fn memory(&self) -> i128 {
        self.memory
    }

    /// Left side and operator of the pending operation, for the formula line.
    pub fn formula(&self) -> &str {
        &self.formula
    }

    /// Value the display currently shows, in thousandths.
    pub fn value(&self) -> i128 {
        self.current()
    }

    /// Text shown in the display.
    pub fn display(&self) -> String {
        if !self.fresh && !self.entry.is_empty() {
            self.entry.clone()
        } else {
            format_units(self.accumulator)
        }
    }

    /// Value the next operation starts from.
    fn current(&self) -> i128 {
        if self.fresh || self.entry.is_empty() {
            self.accumulator
        } else {
            parse_entry(&self.entry)
        }
    }

    /// Applies one key press.
    pub fn press(&mut self, key: CalcKey) {
        match key {
            CalcKey::Digit(digit) => {
                if self.fresh {
                    self.entry.clear();
                    self.fresh = false;
                }
                if self.entry.len() < 12 {
                    self.entry.push(char::from(b'0' + digit.min(9)));
                }
                if self.entry.starts_with('0') && !self.entry.contains('.') && self.entry.len() > 1
                {
                    self.entry.remove(0);
                }
            }
            CalcKey::Decimal => {
                if self.fresh {
                    self.entry = String::from("0");
                    self.fresh = false;
                }
                if !self.entry.contains('.') && self.entry.len() < 12 {
                    self.entry.push('.');
                }
            }
            CalcKey::Add => self.start(Operator::Add),
            CalcKey::Subtract => self.start(Operator::Subtract),
            CalcKey::Multiply => self.start(Operator::Multiply),
            CalcKey::Divide => self.start(Operator::Divide),
            CalcKey::Equals => {
                let value = self.current();
                if let Some(operator) = self.pending.take() {
                    self.formula = format!(
                        "{} {} {}",
                        format_units(self.accumulator),
                        operator.sign(),
                        format_units(value)
                    );
                    self.accumulator = apply(operator, self.accumulator, value);
                } else {
                    self.accumulator = value;
                }
                self.entry = format_units(self.accumulator);
                self.fresh = true;
            }
            CalcKey::Clear => {
                // All clear keeps the memory register, like the Windows calculator and the
                // reference pad (`MC` is the only key that empties it).
                let memory = self.memory;
                *self = Self::new();
                self.memory = memory;
            }
            CalcKey::Backspace => {
                if self.fresh || self.entry.is_empty() {
                    // The legacy pad clears the last digit of the shown result.
                    let text = format_units(self.accumulator);
                    let digits = text.trim_end_matches(|c: char| !c.is_ascii_digit());
                    if digits.len() > 1 {
                        self.entry = digits[..digits.len() - 1].to_string();
                        self.fresh = false;
                    }
                } else {
                    self.entry.pop();
                }
            }
            CalcKey::Percent => {
                let value = self.current();
                let percent = if self.pending.is_some() {
                    self.accumulator * value / 10_000
                } else {
                    value / 100
                };
                self.entry = format_units(percent);
                self.fresh = false;
            }
            CalcKey::Sign => {
                let value = -self.current();
                self.entry = format_units(value);
                self.fresh = false;
            }
            CalcKey::MemoryClear => self.memory = 0,
            CalcKey::MemoryRecall => {
                // Recalling behaves like a finished result: it replaces the accumulator so the
                // display, the sign key and the backspace key all work on the recalled value.
                self.accumulator = self.memory;
                self.entry = format_units(self.memory);
                self.fresh = true;
            }
            CalcKey::MemoryAdd => self.memory += self.current(),
            CalcKey::MemorySubtract => self.memory -= self.current(),
            CalcKey::MemoryStore => self.memory = self.current(),
        }
    }

    /// Folds the visible value into the accumulator and stores the next operation.
    fn start(&mut self, operator: Operator) {
        let value = self.current();
        self.accumulator = match self.pending.take() {
            Some(pending) => apply(pending, self.accumulator, value),
            None => value,
        };
        self.pending = Some(operator);
        self.formula = format!("{} {}", format_units(self.accumulator), operator.sign());
        self.fresh = true;
        self.entry.clear();
    }
}

impl Operator {
    /// Operator as printed on the formula line.
    fn sign(self) -> &'static str {
        match self {
            Operator::Add => "+",
            Operator::Subtract => "−",
            Operator::Multiply => "×",
            Operator::Divide => "÷",
            Operator::Pow => "^",
        }
    }
}

/// Unary functions of the scientific pad.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    /// Sine.
    Sin,
    /// Cosine.
    Cos,
    /// Tangent.
    Tan,
    /// Inverse sine.
    Asin,
    /// Inverse cosine.
    Acos,
    /// Inverse tangent.
    Atan,
    /// Natural logarithm.
    Ln,
    /// `e` raised to the value.
    Exp,
    /// Decadic logarithm.
    Log10,
    /// Ten raised to the value.
    Exp10,
    /// Square root.
    Sqrt,
    /// Cube root.
    Cbrt,
    /// Square.
    Square,
    /// Cube.
    Cube,
    /// `1 / value`.
    Reciprocal,
    /// Factorial of an integer value.
    Factorial,
}

/// Constants of the scientific pad.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Constant {
    /// Ratio of a circle's circumference to its diameter.
    Pi,
    /// Euler's number.
    E,
}

impl Calculator {
    /// Applies a unary function to the visible value.
    pub fn unary(&mut self, op: UnaryOp, degrees: bool) {
        let value = self.current();
        if op == UnaryOp::Reciprocal && value == 0 {
            return;
        }
        let input = value as f64 / 1000.0;
        let to_radians = |angle: f64| {
            if degrees {
                angle.to_radians()
            } else {
                angle
            }
        };
        let result = match op {
            UnaryOp::Sin => to_radians(input).sin(),
            UnaryOp::Cos => to_radians(input).cos(),
            UnaryOp::Tan => to_radians(input).tan(),
            UnaryOp::Asin => {
                let out = input.clamp(-1.0, 1.0).asin();
                if degrees {
                    out.to_degrees()
                } else {
                    out
                }
            }
            UnaryOp::Acos => {
                let out = input.clamp(-1.0, 1.0).acos();
                if degrees {
                    out.to_degrees()
                } else {
                    out
                }
            }
            UnaryOp::Atan => {
                let out = input.atan();
                if degrees {
                    out.to_degrees()
                } else {
                    out
                }
            }
            UnaryOp::Ln => input.ln(),
            UnaryOp::Exp => input.exp(),
            UnaryOp::Log10 => input.log10(),
            UnaryOp::Exp10 => 10f64.powf(input),
            UnaryOp::Sqrt => input.sqrt(),
            UnaryOp::Cbrt => input.cbrt(),
            UnaryOp::Square => input * input,
            UnaryOp::Cube => input * input * input,
            UnaryOp::Reciprocal => 1.0 / input,
            UnaryOp::Factorial => factorial(input),
        };
        if !result.is_finite() || (result * 1000.0).abs() >= i128::MAX as f64 {
            return;
        }
        let rounded = (result * 1000.0).round() as i128;
        self.accumulator = rounded;
        self.entry = format_units(rounded);
        self.fresh = true;
    }

    /// Writes a constant into the display.
    pub fn constant(&mut self, constant: Constant) {
        let value = match constant {
            Constant::Pi => std::f64::consts::PI,
            Constant::E => std::f64::consts::E,
        };
        let rounded = (value * 1000.0).round() as i128;
        self.accumulator = rounded;
        self.entry = format_units(rounded);
        self.fresh = true;
    }

    /// Raises the accumulator to the visible value (`x^y`).
    pub fn power(&mut self) {
        self.start(Operator::Pow);
    }

    /// Opens a group; the pending operation is evaluated on the closing bracket.
    pub fn open_group(&mut self) {
        self.groups.push((self.accumulator, self.pending));
        self.accumulator = 0;
        self.pending = None;
        self.entry.clear();
        self.fresh = true;
        self.formula.push('(');
    }

    /// Closes a group and folds it into the outer operation.
    pub fn close_group(&mut self) {
        if self.groups.is_empty() {
            return;
        }
        let value = self.current();
        let inner = match self.pending.take() {
            Some(operator) => apply(operator, self.accumulator, value),
            None => value,
        };
        let (outer, outer_pending) = self.groups.pop().unwrap_or((0, None));
        self.accumulator = match outer_pending {
            Some(operator) => apply(operator, outer, inner),
            None => inner,
        };
        self.pending = None;
        self.entry = format_units(self.accumulator);
        self.fresh = true;
        self.formula.push(')');
    }
}

/// Factorial of a non negative integer value, `1` otherwise.
fn factorial(value: f64) -> f64 {
    if value < 0.0 || value.fract() != 0.0 || value > 170.0 {
        return 1.0;
    }
    let mut result = 1.0;
    let mut index = 2.0;
    while index <= value {
        result *= index;
        index += 1.0;
    }
    result
}

/// Applies an operation on thousandths; division by zero keeps the left side.
fn apply(operator: Operator, left: i128, right: i128) -> i128 {
    match operator {
        Operator::Add => left + right,
        Operator::Subtract => left - right,
        Operator::Multiply => left * right / 1000,
        Operator::Pow => {
            ((left as f64 / 1000.0).powf(right as f64 / 1000.0) * 1000.0).round() as i128
        }
        Operator::Divide => {
            if right == 0 {
                left
            } else {
                left * 1000 / right
            }
        }
    }
}

/// Parses a keypad entry into thousandths.
fn parse_entry(entry: &str) -> i128 {
    let (whole, fraction) = entry.split_once('.').unwrap_or((entry, ""));
    let whole: i128 = whole.parse().unwrap_or(0);
    let mut digits = String::from(fraction);
    while digits.len() < 3 {
        digits.push('0');
    }
    digits.truncate(3);
    let fraction: i128 = digits.parse().unwrap_or(0);
    whole * 1000 + fraction
}

/// Formats thousandths without trailing zeros.
pub fn format_units(value: i128) -> String {
    let negative = value < 0;
    let magnitude = value.abs();
    let whole = magnitude / 1000;
    let fraction = magnitude % 1000;
    let mut text = if fraction == 0 {
        whole.to_string()
    } else {
        let mut digits = format!("{fraction:03}");
        while digits.ends_with('0') {
            digits.pop();
        }
        format!("{whole}.{digits}")
    };
    if negative {
        text.insert(0, '-');
    }
    text
}

/// Per widget configuration of the customizer dialog, mirroring the legacy widget options.
#[derive(Debug, Clone, PartialEq)]
pub struct WidgetOptions {
    /// Background mode: 0 solid, 1 transparent, 2 glass, 3 dark.
    pub background: usize,
    /// Font style: 0 sans, 1 mono, 2 serif, 3 display.
    pub font: usize,
    /// Text colour index into `TEXT_COLORS`.
    pub text_color: usize,
    /// Layer: 0 normal, 1 background.
    pub layer: usize,
    /// The widget is locked in place.
    pub locked: bool,
    /// Clock face: 0 digital, 1 analog.
    pub clock_type: usize,
    /// Clock format: 0 24 hours, 1 12 hours.
    pub clock_format: usize,
    /// Indices of the selected quick actions.
    pub quick_actions: Vec<usize>,
    /// Selected sticky note colour, as index into `STICKY_COLORS`.
    pub note_color: usize,
    /// Width of the widget in pixels.
    pub width: f32,
    /// Height of the widget in pixels.
    pub height: f32,
}

impl Default for WidgetOptions {
    fn default() -> Self {
        Self {
            background: 0,
            font: 0,
            text_color: 0,
            layer: 0,
            locked: false,
            clock_type: 0,
            clock_format: 0,
            quick_actions: vec![0, 1, 2, 3],
            note_color: 0,
            width: 320.0,
            height: 220.0,
        }
    }
}

/// Background modes of the customizer.
const BACKGROUND_MODES: [&str; 4] = ["Solid", "Transparent", "Glas", "Dunkel"];
/// Font styles of the customizer.
const FONT_STYLES: [&str; 4] = ["Sans", "Mono", "Serif", "Display"];
/// Text colours of the customizer.
const TEXT_COLORS: [Color32; 7] = [
    Color32::from_rgb(0x1e, 0x29, 0x3b),
    Color32::WHITE,
    Color32::from_rgb(0x34, 0xd3, 0x99),
    Color32::from_rgb(0x81, 0x8c, 0xf8),
    Color32::from_rgb(0xfc, 0xd3, 0x4d),
    Color32::from_rgb(0x38, 0xbd, 0xf8),
    Color32::from_rgb(0xfb, 0x71, 0x85),
];
/// Quick action modules of the customizer, translated by `quick_module_label`.
const QUICK_MODULES: [&str; 8] = [
    "Rechnungen",
    "Kontakte",
    "POS Kasse",
    "Kalender",
    "Lagerbestand",
    "Einkauf",
    "Finanzen",
    "Handbuch",
];

/// Translated name of a quick action module.
fn quick_module_label(labels: &WidgetLabels, index: usize) -> &'static str {
    match index {
        0 => labels.quick_invoices,
        1 => labels.quick_contacts,
        2 => labels.quick_pos,
        3 => labels.quick_calendar,
        other => QUICK_MODULES[other.min(QUICK_MODULES.len() - 1)],
    }
}

/// Fill of a preview box for a background mode.
fn background_fill(theme: &Theme, mode: usize) -> Color32 {
    match mode {
        1 => Color32::TRANSPARENT,
        2 => theme.palette.surface.linear_multiply(0.6),
        3 => Color32::from_rgb(0x0f, 0x17, 0x2a),
        _ => theme.palette.surface_muted,
    }
}

/// Clock label for the configured format.
fn format_clock_option(now: i64, format: usize) -> String {
    if format == 0 {
        return crate::desktop::format_clock_seconds(now);
    }
    let seconds = now.div_euclid(1000);
    let hour = seconds.div_euclid(3600).rem_euclid(24);
    let minute = seconds.div_euclid(60).rem_euclid(60);
    let second = seconds.rem_euclid(60);
    format!("{hour:02}:{minute:02}:{second:02}")
}

/// State of the desktop widgets layer.
#[derive(Debug, Clone, PartialEq)]
pub struct WidgetLayer {
    /// Whether the clock is shown.
    pub clock: bool,
    /// Whether the date is shown.
    pub date: bool,
    /// Battery charge in percent, clamped to 0..=100.
    pub battery_percent: u8,
    /// Network status placeholder.
    pub connection: Connection,
    /// Whether the calculator card is shown.
    pub calculator: bool,
    /// Display and pending operation of the calculator.
    pub calculator_state: Calculator,
    /// Whether the notes card is shown.
    pub notes: bool,
    /// Text of the notes card, persisted by the host.
    pub notes_text: String,
    /// Search query of the widgets manager.
    pub search: String,
    /// Active category filter of the widgets manager.
    pub filter: WidgetFilter,
    /// The filter dropdown is open.
    pub filter_open: bool,
    /// Scroll offset of the catalogue list.
    pub scroll: f32,
    /// Selected sticky note color, as index into the palette.
    pub sticky_color: usize,
    /// Widgets pinned from the manager to the desktop.
    pub pinned: Vec<WidgetKind>,
    /// Saved configuration per widget.
    pub options: Vec<(WidgetKind, WidgetOptions)>,
    /// Open customizer draft: the widget and its edited options.
    pub settings: Option<(WidgetKind, WidgetOptions)>,
}

impl Default for WidgetLayer {
    fn default() -> Self {
        Self::new()
    }
}

impl WidgetLayer {
    /// A widget layer with clock, date, calculator, notes and the default status.
    pub fn new() -> Self {
        Self {
            clock: true,
            date: true,
            battery_percent: 82,
            connection: Connection::Online,
            calculator: true,
            calculator_state: Calculator::new(),
            notes: true,
            notes_text: String::new(),
            search: String::new(),
            filter: WidgetFilter::All,
            filter_open: false,
            scroll: 0.0,
            sticky_color: 0,
            pinned: Vec::new(),
            options: Vec::new(),
            settings: None,
        }
    }

    /// Configuration of a widget, or the defaults.
    pub fn options(&self, kind: WidgetKind) -> WidgetOptions {
        self.options
            .iter()
            .find(|(entry, _)| *entry == kind)
            .map(|(_, options)| options.clone())
            .unwrap_or_default()
    }

    /// Stores the configuration of a widget.
    pub fn set_options(&mut self, kind: WidgetKind, options: WidgetOptions) {
        if let Some(entry) = self.options.iter_mut().find(|(entry, _)| *entry == kind) {
            entry.1 = options;
        } else {
            self.options.push((kind, options));
        }
    }

    /// Sets the battery charge, clamped to a valid percentage.
    pub fn set_battery(&mut self, percent: u8) {
        self.battery_percent = percent.min(100);
    }
}

/// Card rectangle of the widgets layer, stacked below the status card.
fn card_rect(area: Rect, top: f32, height: f32) -> Rect {
    Rect::from_min_size(
        Pos2::new(area.right() - WIDGET_WIDTH - 16.0, area.top() + top),
        Vec2::new(WIDGET_WIDTH, height),
    )
}

/// Paints a widget card and returns its inner rectangle.
fn card(ui: &mut egui::Ui, theme: &Theme, rect: Rect, title: &str) -> Rect {
    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CARD),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    painter.text(
        Pos2::new(rect.left() + 14.0, rect.top() + 10.0),
        egui::Align2::LEFT_TOP,
        title,
        FontId::proportional(FONT_SMALL),
        theme.palette.text_muted,
    );
    Rect::from_min_max(
        Pos2::new(rect.left() + 12.0, rect.top() + 30.0),
        Pos2::new(rect.right() - 12.0, rect.bottom() - 12.0),
    )
}

/// Keys of the calculator pad in reading order.
const PAD: [[&str; 4]; 4] = [
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "−"],
    ["0", ".", "=", "+"],
];

/// Maps a pad label to its key.
fn pad_key(label: &str) -> Option<CalcKey> {
    Some(match label {
        "0" => CalcKey::Digit(0),
        "1" => CalcKey::Digit(1),
        "2" => CalcKey::Digit(2),
        "3" => CalcKey::Digit(3),
        "4" => CalcKey::Digit(4),
        "5" => CalcKey::Digit(5),
        "6" => CalcKey::Digit(6),
        "7" => CalcKey::Digit(7),
        "8" => CalcKey::Digit(8),
        "9" => CalcKey::Digit(9),
        "." => CalcKey::Decimal,
        "÷" => CalcKey::Divide,
        "×" => CalcKey::Multiply,
        "−" => CalcKey::Subtract,
        "+" => CalcKey::Add,
        "=" => CalcKey::Equals,
        _ => return None,
    })
}

/// Paints the widgets layer into the top right corner of `ui`'s area.
pub fn widgets(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    now: i64,
    state: &mut WidgetLayer,
) {
    let area = ui.max_rect();
    let rect = card_rect(area, 16.0, WIDGET_HEIGHT);
    let response = ui.interact(rect, Id::new("socdof-widgets"), Sense::hover());
    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CARD),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let mut top = rect.top() + 12.0;
    if state.clock {
        let galley = painter.layout_no_wrap(
            format_clock(now),
            FontId::proportional(26.0),
            theme.palette.text,
        );
        painter.galley(
            Pos2::new(rect.left() + 14.0, top),
            galley,
            theme.palette.text,
        );
        top += 32.0;
    }
    if state.date {
        let galley = painter.layout_no_wrap(
            socdof_core::date::format_date(now),
            FontId::proportional(FONT_SMALL),
            theme.palette.text_muted,
        );
        painter.galley(
            Pos2::new(rect.left() + 14.0, top),
            galley,
            theme.palette.text_muted,
        );
        top += 24.0;
    }
    let icon_color = theme.palette.text_muted;
    Icon::Battery.draw(
        painter,
        Rect::from_min_size(Pos2::new(rect.left() + 14.0, top + 3.0), Vec2::splat(14.0)),
        icon_color,
        1.4,
    );
    let battery = format!("{} %", state.battery_percent);
    let galley = painter.layout_no_wrap(
        battery,
        FontId::proportional(FONT_SMALL),
        theme.palette.text,
    );
    painter.galley(
        Pos2::new(rect.left() + 34.0, top),
        galley,
        theme.palette.text,
    );
    Icon::Wifi.draw(
        painter,
        Rect::from_min_size(Pos2::new(rect.left() + 108.0, top + 3.0), Vec2::splat(14.0)),
        icon_color,
        1.4,
    );
    let connection = texts.get(state.connection.label_key()).to_owned();
    let galley = painter.layout_no_wrap(
        connection,
        FontId::proportional(FONT_SMALL),
        theme.palette.text,
    );
    painter.galley(
        Pos2::new(rect.left() + 128.0, top),
        galley,
        theme.palette.text,
    );
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Other, texts.get("widgets_title")));

    if state.calculator {
        calculator_card(ui, theme, texts, area, &mut state.calculator_state);
    }
    if state.notes {
        notes_card(ui, theme, texts, area, &mut state.notes_text);
    }
}

/// Draws the calculator card below the status card.
fn calculator_card(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    area: Rect,
    calculator: &mut Calculator,
) {
    let rect = card_rect(area, 16.0 + WIDGET_HEIGHT + 8.0, CALCULATOR_HEIGHT);
    let inner = card(ui, theme, rect, texts.get("widget_calculator"));
    let clear = Rect::from_min_size(
        Pos2::new(rect.right() - 34.0, rect.top() + 6.0),
        Vec2::new(22.0, 20.0),
    );
    let clear_response = ui
        .interact(clear, Id::new("socdof-calc-clear"), Sense::click())
        .on_hover_text(texts.get("widget_calc_clear"));
    let clear_fill = if clear_response.hovered() {
        theme.palette.surface_muted
    } else {
        Color32::TRANSPARENT
    };
    ui.painter()
        .rect_filled(clear, Rounding::same(6.0), clear_fill);
    ui.painter().text(
        clear.center(),
        egui::Align2::CENTER_CENTER,
        "C",
        FontId::proportional(FONT_SMALL),
        theme.palette.text_muted,
    );
    if clear_response.clicked() {
        calculator.press(CalcKey::Clear);
    }
    ui.painter().text(
        Pos2::new(inner.right(), rect.top() + 34.0),
        egui::Align2::RIGHT_TOP,
        calculator.display(),
        FontId::proportional(22.0),
        theme.palette.text,
    );
    let gap = 4.0;
    let column = (inner.width() - gap * 3.0) / 4.0;
    let mut row_top = rect.top() + 70.0;
    let row_height = (inner.bottom() - row_top - gap * 3.0) / 4.0;
    for row in PAD {
        for (column_index, label) in row.iter().enumerate() {
            let key_rect = Rect::from_min_size(
                Pos2::new(inner.left() + column_index as f32 * (column + gap), row_top),
                Vec2::new(column, row_height),
            );
            let fill = if *label == "=" {
                theme.accent.base
            } else {
                theme.palette.surface_muted
            };
            let text_color = if *label == "=" {
                theme.palette.accent_on
            } else {
                theme.palette.text
            };
            let button = Button::new(RichText::new(*label).size(FONT_BODY).color(text_color))
                .fill(fill)
                .rounding(Rounding::same(RADIUS_CONTROL))
                .min_size(key_rect.size());
            if ui.put(key_rect, button).clicked() {
                if let Some(key) = pad_key(label) {
                    calculator.press(key);
                }
            }
        }
        row_top += row_height + gap;
    }
}

/// Draws the notes card below the calculator card.
fn notes_card(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, area: Rect, notes: &mut String) {
    let top = 16.0 + WIDGET_HEIGHT + 8.0;
    let rect = card_rect(area, top + CALCULATOR_HEIGHT + 8.0, NOTES_HEIGHT);
    let inner = card(ui, theme, rect, texts.get("widget_notes"));
    let editor = TextEdit::multiline(notes)
        .hint_text(texts.get("widget_notes_hint"))
        .desired_width(inner.width())
        .desired_rows(3)
        .text_color(theme.palette.text)
        .font(FontId::proportional(FONT_BODY));
    let response = ui.put(inner, editor);
    response.widget_info(|| WidgetInfo::labeled(WidgetType::TextEdit, texts.get("widget_notes")));
}

/// Draws the widgets panel of the desktop app.
///
/// The legacy `WidgetsModule` (`SOCDOF - TS/src/components/shell/WidgetsModule.tsx:120–240`) lists
/// the widgets that can be pinned to the desktop and edits the free sticky note. The native panel
/// offers the three cards the desktop layer paints (clock & date, quick calculator, notes) and the
/// note text itself.
/// One widget of the catalogue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WidgetKind {
    /// Today's revenue and the open invoice count.
    Revenue,
    /// Calendar sheet with the current date.
    Calendar,
    /// Digital clock with the system date.
    Clock,
    /// Low stock warning of the product catalogue.
    Stock,
    /// Four configurable app shortcuts.
    QuickActions,
    /// Free sticky note.
    Notes,
    /// Compact calculator.
    Calculator,
}

/// Category filter of the widgets manager.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WidgetFilter {
    /// Every catalog entry.
    All,
    /// Phone style tiles.
    PhoneWidgets,
    /// Sticky notes.
    StickyNotes,
    /// Clock and calendar entries.
    Time,
    /// Revenue and KPI entries.
    Finance,
    /// Shortcuts and stock entries.
    Actions,
}

impl WidgetFilter {
    /// Filters of the dropdown, in their legacy order.
    const ORDER: [Self; 6] = [
        Self::All,
        Self::PhoneWidgets,
        Self::StickyNotes,
        Self::Time,
        Self::Finance,
        Self::Actions,
    ];

    /// Label of the filter in the active language.
    fn label(self, labels: &WidgetLabels) -> &'static str {
        match self {
            Self::All => labels.filter_all,
            Self::PhoneWidgets => labels.filter_phone,
            Self::StickyNotes => labels.filter_sticky,
            Self::Time => labels.filter_time,
            Self::Finance => labels.filter_finance,
            Self::Actions => labels.filter_actions,
        }
    }

    /// Whether a catalogue entry belongs to this filter.
    fn keeps(self, item: &CatalogItem) -> bool {
        match self {
            Self::All => true,
            Self::PhoneWidgets => item.kind != WidgetKind::Notes,
            Self::StickyNotes => item.kind == WidgetKind::Notes,
            Self::Time => item.category == Self::Time,
            Self::Finance => item.category == Self::Finance,
            Self::Actions => item.category == Self::Actions,
        }
    }
}

/// Catalogue entry of the widgets manager.
struct CatalogItem {
    kind: WidgetKind,
    title: &'static str,
    description: &'static str,
    /// Search terms, including the translated ones of the legacy module.
    tags: &'static str,
    category: WidgetFilter,
    /// Tile color of the card header.
    tile: Color32,
    icon: Icon,
    /// Height of the live preview box.
    preview: f32,
}

/// Widget manager strings in the four catalogue languages.
struct WidgetLabels {
    search: &'static str,
    filter_all: &'static str,
    filter_phone: &'static str,
    filter_sticky: &'static str,
    filter_time: &'static str,
    filter_finance: &'static str,
    filter_actions: &'static str,
    filter_heading: &'static str,
    pin: &'static str,
    unpin: &'static str,
    configure: &'static str,
    no_results: &'static str,
    reset: &'static str,
    revenue: &'static str,
    revenue_desc: &'static str,
    calendar: &'static str,
    calendar_desc: &'static str,
    clock: &'static str,
    clock_desc: &'static str,
    stock: &'static str,
    stock_desc: &'static str,
    quick: &'static str,
    quick_desc: &'static str,
    notes: &'static str,
    notes_desc: &'static str,
    calculator: &'static str,
    calculator_desc: &'static str,
    daily_revenue: &'static str,
    open_invoices: &'static str,
    note_preview: &'static str,
    quick_invoices: &'static str,
    quick_contacts: &'static str,
    quick_pos: &'static str,
    quick_calendar: &'static str,
    stock_ok: &'static str,
    stock_check: &'static str,
}

impl WidgetLabels {
    fn new(language: Language) -> Self {
        match language {
            Language::De => Self {
                search: "Widgets & Notizen durchsuchen...",
                filter_all: "Alle Widgets",
                filter_phone: "Handy-Kacheln",
                filter_sticky: "Haftnotizen",
                filter_time: "Zeit & Kalender",
                filter_finance: "Finanzen & KPI",
                filter_actions: "Aktionen & Lager",
                filter_heading: "Kategorie filtern",
                pin: "Auf Desktop anheften",
                unpin: "Vom Desktop lösen",
                configure: "Anpassen",
                no_results: "Keine Widgets für diese Filterkriterien gefunden",
                reset: "Filter zurücksetzen",
                revenue: "Tagesumsatz & Kassen-KPI",
                revenue_desc: "Echtzeit-Statistik über heutige Einnahmen...",
                calendar: "Tageskalender & Agenda",
                calendar_desc: "Kompaktes Kalenderblatt mit Wochentag, Datum...",
                clock: "Uhrzeit & Zeitzonen",
                clock_desc: "Minimalistische Live-Uhr und Kalenderdatum.",
                stock: "Lagerbestand-Warnung",
                stock_desc: "Überwacht Artikel unter Mindestbestand.",
                quick: "Schnellstarter (Anpassbar)",
                quick_desc: "Individuell konfigurierbare Direktlinks auf 4 Apps.",
                notes: "Haftnotiz (Sticky Note)",
                notes_desc: "Frei verschiebbarer Notizzettel mit Farbauswahl.",
                calculator: "Schnell-Taschenrechner",
                calculator_desc: "Kompakter Rechner für direkte Berechnungen.",
                daily_revenue: "Tagesumsatz",
                open_invoices: "Offene Rechnungen:",
                note_preview: "\"Wichtige Notiz oder To-Do direkt auf dem Desktop...\"",
                quick_invoices: "Faktura",
                quick_contacts: "Kontakt",
                quick_pos: "Kasse",
                quick_calendar: "Kalender",
                stock_ok: "Alle Bestände im Soll",
                stock_check: "Mindestbestand-Prüfung",
            },
            Language::En => Self {
                search: "Search widgets & sticky notes...",
                filter_all: "All widgets",
                filter_phone: "Phone tiles",
                filter_sticky: "Sticky notes",
                filter_time: "Time & calendar",
                filter_finance: "Finance & KPI",
                filter_actions: "Actions & stock",
                filter_heading: "Filter category",
                pin: "Pin to Desktop",
                unpin: "Remove from Desktop",
                configure: "Configure",
                no_results: "No widgets match these filters",
                reset: "Reset filters",
                revenue: "Daily Revenue & Cash KPI",
                revenue_desc: "Real-time statistics on today's revenue...",
                calendar: "Daily Calendar & Agenda",
                calendar_desc: "Compact calendar sheet with weekday, date...",
                clock: "Analog / Digital Clock",
                clock_desc: "Minimalist live clock and calendar date.",
                stock: "Stock Alert",
                stock_desc: "Watches products below the minimum stock level.",
                quick: "Quick Actions",
                quick_desc: "Four configurable shortcut tiles for any app.",
                notes: "Sticky Note",
                notes_desc: "Freely movable note with colors and auto-save.",
                calculator: "Quick Calculator",
                calculator_desc: "Compact calculator for quick sums.",
                daily_revenue: "Daily Revenue",
                open_invoices: "Open invoices:",
                note_preview: "\"Important note or to-do right on the desktop...\"",
                quick_invoices: "Invoice",
                quick_contacts: "Contact",
                quick_pos: "POS",
                quick_calendar: "Calendar",
                stock_ok: "All stock levels are fine",
                stock_check: "Minimum stock check",
            },
            Language::Fr => Self {
                search: "Rechercher des widgets et notes...",
                filter_all: "Tous les widgets",
                filter_phone: "Tuiles téléphone",
                filter_sticky: "Notes autocollantes",
                filter_time: "Temps et agenda",
                filter_finance: "Finance et KPI",
                filter_actions: "Actions et stock",
                filter_heading: "Filtrer par catégorie",
                pin: "Épingler au bureau",
                unpin: "Retirer du bureau",
                configure: "Configurer",
                no_results: "Aucun widget ne correspond à ces filtres",
                reset: "Réinitialiser les filtres",
                revenue: "Chiffre d'affaires et KPI caisse",
                revenue_desc: "Statistiques en temps réel des recettes du jour.",
                calendar: "Calendrier du jour et agenda",
                calendar_desc: "Feuillet compact avec jour de la semaine.",
                clock: "Horloge analogique / numérique",
                clock_desc: "Horloge en direct minimaliste avec la date.",
                stock: "Alerte de stock",
                stock_desc: "Surveille les articles sous le stock minimum.",
                quick: "Accès rapides",
                quick_desc: "Quatre raccourcis configurables vers vos apps.",
                notes: "Note autocollante",
                notes_desc: "Note déplaçable avec couleurs et sauvegarde.",
                calculator: "Calculatrice rapide",
                calculator_desc: "Calculatrice compacte pour les sommes du jour.",
                daily_revenue: "Recettes du jour",
                open_invoices: "Factures ouvertes :",
                note_preview: "\"Note importante ou tâche sur le bureau...\"",
                quick_invoices: "Facture",
                quick_contacts: "Contact",
                quick_pos: "Caisse",
                quick_calendar: "Agenda",
                stock_ok: "Tous les stocks sont corrects",
                stock_check: "Contrôle du stock minimum",
            },
            Language::Es => Self {
                search: "Buscar widgets y notas...",
                filter_all: "Todos los widgets",
                filter_phone: "Mosaicos de móvil",
                filter_sticky: "Notas adhesivas",
                filter_time: "Tiempo y agenda",
                filter_finance: "Finanzas y KPI",
                filter_actions: "Acciones y stock",
                filter_heading: "Filtrar por categoría",
                pin: "Fijar al escritorio",
                unpin: "Quitar del escritorio",
                configure: "Configurar",
                no_results: "Ningún widget coincide con estos filtros",
                reset: "Restablecer filtros",
                revenue: "Ingresos diarios y KPI de caja",
                revenue_desc: "Estadísticas en tiempo real de los ingresos de hoy.",
                calendar: "Calendario diario y agenda",
                calendar_desc: "Hoja compacta con día de la semana.",
                clock: "Reloj analógico / digital",
                clock_desc: "Reloj minimalista en vivo con la fecha.",
                stock: "Aviso de existencias",
                stock_desc: "Vigila los artículos bajo el stock mínimo.",
                quick: "Accesos rápidos",
                quick_desc: "Cuatro accesos configurables a cualquier app.",
                notes: "Nota adhesiva",
                notes_desc: "Nota movible con colores y guardado automático.",
                calculator: "Calculadora rápida",
                calculator_desc: "Calculadora compacta para sumas rápidas.",
                daily_revenue: "Ingresos del día",
                open_invoices: "Facturas abiertas:",
                note_preview: "\"Nota importante o tarea en el escritorio...\"",
                quick_invoices: "Factura",
                quick_contacts: "Contacto",
                quick_pos: "TPV",
                quick_calendar: "Agenda",
                stock_ok: "Todo el stock está correcto",
                stock_check: "Control de stock mínimo",
            },
        }
    }
}

/// Catalogue of the widgets manager, in the order of the legacy module.
fn catalog(labels: &WidgetLabels) -> Vec<CatalogItem> {
    vec![
        CatalogItem {
            kind: WidgetKind::Revenue,
            title: labels.revenue,
            description: labels.revenue_desc,
            tags: "umsatz finanzen kasse kpi revenue facture ingresos",
            category: WidgetFilter::Finance,
            tile: Color32::from_rgb(0x05, 0x96, 0x69),
            icon: Icon::TrendingUp,
            preview: 78.0,
        },
        CatalogItem {
            kind: WidgetKind::Calendar,
            title: labels.calendar,
            description: labels.calendar_desc,
            tags: "kalender datum termine agenda calendar calendrier calendario",
            category: WidgetFilter::Time,
            tile: Color32::from_rgb(0x4f, 0x46, 0xe5),
            icon: Icon::Calendar,
            preview: 64.0,
        },
        CatalogItem {
            kind: WidgetKind::Clock,
            title: labels.clock,
            description: labels.clock_desc,
            tags: "uhr zeit clock time weltzeit analog horloge reloj",
            category: WidgetFilter::Time,
            tile: Color32::from_rgb(0x02, 0x84, 0xc7),
            icon: Icon::Clock,
            preview: 56.0,
        },
        CatalogItem {
            kind: WidgetKind::Stock,
            title: labels.stock,
            description: labels.stock_desc,
            tags: "lager bestand warnung stock inventory inventario",
            category: WidgetFilter::Actions,
            tile: Color32::from_rgb(0xd9, 0x77, 0x06),
            icon: Icon::Warning,
            preview: 56.0,
        },
        CatalogItem {
            kind: WidgetKind::QuickActions,
            title: labels.quick,
            description: labels.quick_desc,
            tags: "aktionen start rechnung pos notiz quick launcher raccourcis accesos",
            category: WidgetFilter::Actions,
            tile: Color32::from_rgb(0x7c, 0x3a, 0xed),
            icon: Icon::Zap,
            preview: 46.0,
        },
        CatalogItem {
            kind: WidgetKind::Notes,
            title: labels.notes,
            description: labels.notes_desc,
            tags: "notiz sticky gedanken to-do notes pense-bete notas",
            category: WidgetFilter::StickyNotes,
            tile: Color32::from_rgb(0xf5, 0x9e, 0x0b),
            icon: Icon::StickyNote,
            preview: 72.0,
        },
        CatalogItem {
            kind: WidgetKind::Calculator,
            title: labels.calculator,
            description: labels.calculator_desc,
            tags: "rechner taschenrechner mathe kalkulation calculator calculatrice calculadora",
            category: WidgetFilter::Actions,
            tile: Color32::from_rgb(0x05, 0x96, 0x69),
            icon: Icon::Calculator,
            preview: 34.0,
        },
    ]
}

/// Colors of the sticky note palette (`STICKY_PALETTE` of the legacy module).
const STICKY_COLORS: [Color32; 7] = [
    Color32::from_rgb(0xfb, 0xbf, 0x24),
    Color32::from_rgb(0x38, 0xbd, 0xf8),
    Color32::from_rgb(0x10, 0xb9, 0x81),
    Color32::from_rgb(0xfb, 0x71, 0x85),
    Color32::from_rgb(0xa8, 0x55, 0xf7),
    Color32::from_rgb(0x0f, 0x17, 0x2a),
    Color32::from_rgb(0xf8, 0xfa, 0xfc),
];

/// Draws the widgets manager: search, category filter and the catalogue cards.
pub fn widgets_app(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    layer: &mut WidgetLayer,
    now: i64,
) {
    let labels = WidgetLabels::new(texts.language());
    let items = catalog(&labels);
    let area = ui.max_rect();
    let painter = ui.painter().clone();
    painter.rect_filled(area, Rounding::same(0.0), theme.palette.background);

    // Measured on the 432x771 reference: the search row starts 6 pt below the window content
    // and is 44 pt tall.
    let search_rect = Rect::from_min_size(
        Pos2::new(area.left() + 24.0, area.top() + 6.0),
        Vec2::new(area.width() - 24.0 - 12.0 - 64.0 - 24.0, 44.0),
    );
    painter.rect(
        search_rect,
        Rounding::same(16.0),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    Icon::Search.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(search_rect.left() + 18.0, search_rect.center().y),
            Vec2::splat(16.0),
        ),
        theme.palette.text_muted,
        1.7,
    );
    let field = Rect::from_min_max(
        Pos2::new(search_rect.left() + 34.0, search_rect.top() + 3.0),
        Pos2::new(search_rect.right() - 30.0, search_rect.bottom() - 3.0),
    );
    let edit = TextEdit::singleline(&mut layer.search)
        .hint_text(labels.search)
        .frame(false)
        .desired_width(field.width())
        .font(FontId::proportional(FONT_SMALL))
        .text_color(theme.palette.text);
    ui.put(field, edit);
    if !layer.search.is_empty() {
        let clear = Rect::from_center_size(
            Pos2::new(search_rect.right() - 18.0, search_rect.center().y),
            Vec2::new(22.0, 22.0),
        );
        if ui
            .interact(clear, Id::new("socdof-widgets-clear"), Sense::click())
            .clicked()
        {
            layer.search.clear();
        }
        Icon::Close.draw(
            &painter,
            Rect::from_center_size(clear.center(), Vec2::splat(12.0)),
            theme.palette.text_muted,
            1.6,
        );
    }

    let filter_rect = Rect::from_min_size(
        Pos2::new(area.right() - 24.0 - 64.0, area.top() + 6.0),
        Vec2::new(64.0, 44.0),
    );
    let filter_active = layer.filter != WidgetFilter::All;
    painter.rect(
        filter_rect,
        Rounding::same(16.0),
        if filter_active {
            theme.accent.base
        } else {
            theme.palette.surface
        },
        Stroke::new(
            1.0_f32,
            if filter_active {
                theme.accent.base
            } else {
                theme.palette.border
            },
        ),
    );
    let filter_fill = if filter_active {
        theme.palette.accent_on
    } else {
        theme.palette.text
    };
    Icon::Filter.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(filter_rect.left() + 22.0, filter_rect.center().y),
            Vec2::splat(14.0),
        ),
        filter_fill,
        1.7,
    );
    Icon::ChevronDown.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(filter_rect.right() - 18.0, filter_rect.center().y),
            Vec2::splat(13.0),
        ),
        filter_fill,
        1.7,
    );
    let filter_id = Id::new("socdof-widgets-filter");
    let _ = focus.register(filter_id);
    if ui
        .interact(filter_rect, filter_id, Sense::click())
        .clicked()
    {
        layer.filter_open = !layer.filter_open;
    }

    let filtered: Vec<&CatalogItem> = items
        .iter()
        .filter(|item| layer.filter.keeps(item))
        .filter(|item| {
            let query = layer.search.trim().to_lowercase();
            query.is_empty()
                || item.title.to_lowercase().contains(&query)
                || item.description.to_lowercase().contains(&query)
                || item.tags.contains(&query)
        })
        .collect();

    let list_top = search_rect.bottom() + 16.0;
    let list_bottom = area.bottom() - 8.0;
    ui.set_clip_rect(Rect::from_min_max(
        Pos2::new(area.left(), list_top),
        Pos2::new(area.right(), list_bottom),
    ));

    if filtered.is_empty() {
        let icon_rect = Rect::from_center_size(
            Pos2::new(area.center().x, list_top + 80.0),
            Vec2::splat(48.0),
        );
        painter.rect(
            icon_rect,
            Rounding::same(16.0),
            theme.palette.surface_muted,
            Stroke::NONE,
        );
        Icon::Search.draw(
            &painter,
            Rect::from_center_size(icon_rect.center(), Vec2::splat(20.0)),
            theme.palette.text_muted,
            1.7,
        );
        painter.text(
            Pos2::new(area.center().x, icon_rect.bottom() + 22.0),
            egui::Align2::CENTER_CENTER,
            labels.no_results,
            FontId::proportional(FONT_SMALL),
            theme.palette.text_muted,
        );
        let reset = Rect::from_center_size(
            Pos2::new(area.center().x, icon_rect.bottom() + 48.0),
            Vec2::new(160.0, 24.0),
        );
        if ui
            .interact(reset, Id::new("socdof-widgets-reset"), Sense::click())
            .clicked()
        {
            layer.search.clear();
            layer.filter = WidgetFilter::All;
        }
        painter.text(
            reset.center(),
            egui::Align2::CENTER_CENTER,
            labels.reset,
            FontId::proportional(FONT_SMALL),
            theme.accent.base,
        );
        return;
    }

    if ui.rect_contains_pointer(area) {
        let wheel = ui.ctx().input(|input| input.raw_scroll_delta.y);
        layer.scroll -= wheel;
    }

    let card_left = area.left() + 26.0;
    let card_width = area.width() - 26.0 - 13.0;
    let mut content_height = 0.0;
    let mut heights = Vec::with_capacity(filtered.len());
    for item in &filtered {
        let height = 20.0 + 40.0 + 12.0 + item.preview + 16.0 + 38.0 + 20.0;
        heights.push(height);
        content_height += height + 20.0;
    }

    let mut top = list_top - layer.scroll;
    for (index, item) in filtered.iter().enumerate() {
        let height = heights[index];
        let card = Rect::from_min_size(Pos2::new(card_left, top), Vec2::new(card_width, height));
        widget_card(ui, &painter, theme, &labels, item, card, layer, now);
        top += height + 20.0;
    }

    // Wheel scrolling of the catalogue list.
    let overflow = (content_height - (list_bottom - list_top)).max(0.0);
    if layer.scroll > overflow {
        layer.scroll = overflow;
    }
    if layer.scroll < 0.0 {
        layer.scroll = 0.0;
    }
    if overflow > 0.0 {
        let track = Rect::from_min_max(
            Pos2::new(area.right() - 6.0, list_top),
            Pos2::new(area.right() - 2.0, list_bottom),
        );
        painter.rect_filled(track, Rounding::same(2.0), theme.palette.surface_muted);
        let visible = (list_bottom - list_top) / content_height;
        let knob_height = (track.height() * visible).max(40.0);
        let knob_top = track.top() + (track.height() - knob_height) * (layer.scroll / overflow);
        painter.rect_filled(
            Rect::from_min_size(
                Pos2::new(track.left(), knob_top),
                Vec2::new(track.width(), knob_height),
            ),
            Rounding::same(2.0),
            theme.palette.text_muted.linear_multiply(0.5),
        );
    }

    widget_settings_modal(ui, theme, &labels, layer, now);

    if layer.filter_open {
        let menu = Rect::from_min_size(
            Pos2::new(filter_rect.right() - 208.0, filter_rect.bottom() + 8.0),
            Vec2::new(208.0, 28.0 + 6.0 * 32.0 + 8.0),
        );
        painter.rect(
            menu,
            Rounding::same(16.0),
            theme.palette.surface,
            Stroke::new(1.0_f32, theme.palette.border),
        );
        painter.text(
            Pos2::new(menu.left() + 14.0, menu.top() + 16.0),
            egui::Align2::LEFT_CENTER,
            labels.filter_heading,
            FontId::new(9.0, crate::theme::heavy()),
            theme.palette.text_muted,
        );
        for (row, option) in WidgetFilter::ORDER.iter().enumerate() {
            let rect = Rect::from_min_size(
                Pos2::new(menu.left() + 6.0, menu.top() + 28.0 + row as f32 * 32.0),
                Vec2::new(menu.width() - 12.0, 28.0),
            );
            let response = ui.interact(
                rect,
                Id::new(("socdof-widgets-filter-option", row)),
                Sense::click(),
            );
            let selected = layer.filter == *option;
            if selected {
                painter.rect(rect, Rounding::same(12.0), theme.accent.light, Stroke::NONE);
            }
            painter.text(
                Pos2::new(rect.left() + 10.0, rect.center().y),
                egui::Align2::LEFT_CENTER,
                option.label(&labels),
                FontId::new(
                    FONT_SMALL,
                    if selected {
                        crate::theme::heavy()
                    } else {
                        crate::theme::semibold()
                    },
                ),
                if selected {
                    theme.accent.base
                } else {
                    theme.palette.text
                },
            );
            let count = items.iter().filter(|item| option.keeps(item)).count();
            if selected {
                Icon::Check.draw(
                    &painter,
                    Rect::from_center_size(
                        Pos2::new(rect.right() - 14.0, rect.center().y),
                        Vec2::splat(12.0),
                    ),
                    theme.accent.base,
                    1.8,
                );
            }
            painter.text(
                Pos2::new(rect.right() - 28.0, rect.center().y),
                egui::Align2::RIGHT_CENTER,
                format!("({count})"),
                FontId::new(10.0, egui::FontFamily::Monospace),
                theme.palette.text_muted,
            );
            if response.clicked() {
                layer.filter = *option;
                layer.filter_open = false;
            }
        }
    }
}

/// Small segmented control, returns the newly picked index.
fn segmented(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    options: &[&str],
    selected: usize,
) -> Option<usize> {
    let mut picked = None;
    let count = options.len().max(1) as f32;
    let cell_width = (rect.width() - 4.0 * (count - 1.0)) / count;
    for (index, label) in options.iter().enumerate() {
        let cell = Rect::from_min_size(
            Pos2::new(rect.left() + index as f32 * (cell_width + 4.0), rect.top()),
            Vec2::new(cell_width, rect.height()),
        );
        let response = ui.interact(
            cell,
            Id::new(("socdof-widgets-seg", rect.top() as i32, index)),
            Sense::click(),
        );
        let active = index == selected;
        painter.rect(
            cell,
            Rounding::same(8.0),
            if active {
                theme.accent.base
            } else if response.hovered() {
                theme.palette.surface_muted
            } else {
                theme.palette.background
            },
            Stroke::new(
                1.0_f32,
                if active {
                    theme.accent.base
                } else {
                    theme.palette.border
                },
            ),
        );
        painter.text(
            cell.center(),
            egui::Align2::CENTER_CENTER,
            *label,
            FontId::new(FONT_SMALL, crate::theme::semibold()),
            if active {
                theme.palette.accent_on
            } else {
                theme.palette.text
            },
        );
        if response.clicked() {
            picked = Some(index);
        }
    }
    picked
}

/// Explicit pill button of the customizer, returns whether it was clicked.
fn modal_button(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    label: &str,
    primary: bool,
) -> bool {
    let id = Id::new((
        "socdof-widgets-modal-button",
        rect.left() as i32,
        rect.top() as i32,
    ));
    let response = ui.interact(rect, id, Sense::click());
    painter.rect(
        rect,
        Rounding::same(12.0),
        if primary {
            if response.hovered() {
                theme.accent.hover
            } else {
                theme.accent.base
            }
        } else {
            theme.palette.surface_muted
        },
        Stroke::NONE,
    );
    painter.text(
        rect.center(),
        egui::Align2::CENTER_CENTER,
        label,
        FontId::new(FONT_SMALL, crate::theme::heavy()),
        if primary {
            theme.palette.accent_on
        } else {
            theme.palette.text
        },
    );
    response.clicked()
}

/// Small uppercase section label of the customizer.
fn row_label(painter: &egui::Painter, theme: &Theme, x: f32, y: f32, title: &str) {
    painter.text(
        Pos2::new(x, y),
        egui::Align2::LEFT_CENTER,
        title,
        FontId::new(9.0, crate::theme::heavy()),
        theme.palette.text_muted,
    );
}

/// Draws the per widget customizer and stores its draft when the user saves it.
fn widget_settings_modal(
    ui: &mut Ui,
    theme: &Theme,
    labels: &WidgetLabels,
    layer: &mut WidgetLayer,
    now: i64,
) {
    let Some((kind, draft)) = layer.settings.clone() else {
        return;
    };
    let mut draft = draft;
    let area = ui.max_rect();
    let painter = ui.painter().clone();
    painter.rect_filled(area, Rounding::same(0.0), Color32::from_black_alpha(150));
    let title = catalog(labels)
        .into_iter()
        .find(|item| item.kind == kind)
        .map(|item| item.title)
        .unwrap_or("Widget");
    let panel = Rect::from_center_size(
        area.center(),
        Vec2::new(316.0, (area.height() - 32.0).min(520.0)),
    );
    painter.rect(
        panel,
        Rounding::same(20.0),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    painter.text(
        Pos2::new(panel.left() + 18.0, panel.top() + 24.0),
        egui::Align2::LEFT_CENTER,
        title,
        FontId::new(14.0, crate::theme::heavy()),
        theme.palette.text,
    );
    painter.text(
        Pos2::new(panel.left() + 18.0, panel.top() + 42.0),
        egui::Align2::LEFT_CENTER,
        labels.configure,
        FontId::new(9.0, crate::theme::semibold()),
        theme.palette.text_muted,
    );
    let close = Rect::from_center_size(
        Pos2::new(panel.right() - 22.0, panel.top() + 26.0),
        Vec2::splat(22.0),
    );
    let close_response = ui.interact(close, Id::new("socdof-widgets-modal-close"), Sense::click());
    Icon::Close.draw(
        &painter,
        Rect::from_center_size(close.center(), Vec2::splat(13.0)),
        if close_response.hovered() {
            theme.palette.text
        } else {
            theme.palette.text_muted
        },
        1.8,
    );
    if close_response.clicked() {
        layer.settings = None;
        return;
    }

    let left = panel.left() + 18.0;
    let right = panel.right() - 18.0;
    let width = right - left;
    let mut y = panel.top() + 64.0;

    row_label(&painter, theme, left, y, "Hintergrund-Modus");
    y += 12.0;
    if let Some(index) = segmented(
        ui,
        &painter,
        theme,
        Rect::from_min_size(Pos2::new(left, y), Vec2::new(width, 26.0)),
        &BACKGROUND_MODES,
        draft.background,
    ) {
        draft.background = index;
    }
    y += 38.0;
    row_label(&painter, theme, left, y, "Schrift-Stil");
    y += 12.0;
    if let Some(index) = segmented(
        ui,
        &painter,
        theme,
        Rect::from_min_size(Pos2::new(left, y), Vec2::new(width, 26.0)),
        &FONT_STYLES,
        draft.font,
    ) {
        draft.font = index;
    }
    y += 38.0;
    row_label(&painter, theme, left, y, "Textfarbe");
    y += 14.0;
    let swatch = 22.0;
    for (index, color) in TEXT_COLORS.iter().enumerate() {
        let center = Pos2::new(left + swatch * 0.5 + index as f32 * (swatch + 8.0), y);
        let id = Id::new(("socdof-widgets-text-color", index));
        if ui
            .interact(
                Rect::from_center_size(center, Vec2::splat(swatch + 6.0)),
                id,
                Sense::click(),
            )
            .clicked()
        {
            draft.text_color = index;
        }
        painter.circle(
            center,
            swatch * 0.5,
            *color,
            if draft.text_color == index {
                Stroke::new(2.0_f32, theme.accent.base)
            } else {
                Stroke::new(1.0_f32, theme.palette.border)
            },
        );
    }
    y += 26.0;
    row_label(&painter, theme, left, y, "Ebene & Sperre");
    y += 12.0;
    let half = (width - 8.0) * 0.5;
    if let Some(index) = segmented(
        ui,
        &painter,
        theme,
        Rect::from_min_size(Pos2::new(left, y), Vec2::new(half, 26.0)),
        &["Normal", "Hintergrund"],
        draft.layer,
    ) {
        draft.layer = index;
    }
    let lock = Rect::from_min_size(Pos2::new(left + half + 8.0, y), Vec2::new(half, 26.0));
    if modal_button(
        ui,
        &painter,
        theme,
        lock,
        if draft.locked { "Gesperrt" } else { "Sperren" },
        draft.locked,
    ) {
        draft.locked = !draft.locked;
    }
    y += 38.0;

    match kind {
        WidgetKind::Clock => {
            row_label(&painter, theme, left, y, "Uhren-Typ");
            y += 12.0;
            if let Some(index) = segmented(
                ui,
                &painter,
                theme,
                Rect::from_min_size(Pos2::new(left, y), Vec2::new(width, 26.0)),
                &["Digital", "Analog"],
                draft.clock_type,
            ) {
                draft.clock_type = index;
            }
            y += 38.0;
            row_label(&painter, theme, left, y, "Zeitformat");
            y += 12.0;
            if let Some(index) = segmented(
                ui,
                &painter,
                theme,
                Rect::from_min_size(Pos2::new(left, y), Vec2::new(width, 26.0)),
                &["24 h", "12 h"],
                draft.clock_format,
            ) {
                draft.clock_format = index;
            }
            y += 38.0;
        }
        WidgetKind::Notes => {
            row_label(&painter, theme, left, y, "Notizfarbe");
            y += 14.0;
            for (index, color) in STICKY_COLORS.iter().enumerate() {
                let center = Pos2::new(left + 11.0 + index as f32 * 30.0, y);
                if ui
                    .interact(
                        Rect::from_center_size(center, Vec2::splat(28.0)),
                        Id::new(("socdof-widgets-note-color", index)),
                        Sense::click(),
                    )
                    .clicked()
                {
                    draft.note_color = index;
                }
                painter.circle(
                    center,
                    11.0,
                    *color,
                    if draft.note_color == index {
                        Stroke::new(2.0_f32, theme.accent.base)
                    } else {
                        Stroke::new(1.0_f32, theme.palette.border)
                    },
                );
            }
            y += 26.0;
        }
        WidgetKind::QuickActions => {
            row_label(&painter, theme, left, y, "Schnellaktionen");
            y += 12.0;
            for index in 0..QUICK_MODULES.len() {
                let module = quick_module_label(labels, index);
                let column = index % 4;
                let line = index / 4;
                let chip = Rect::from_min_size(
                    Pos2::new(
                        left + column as f32 * ((width - 12.0) / 4.0 + 4.0),
                        y + line as f32 * 28.0,
                    ),
                    Vec2::new((width - 12.0) / 4.0, 24.0),
                );
                let active = draft.quick_actions.contains(&index);
                let response = ui.interact(
                    chip,
                    Id::new(("socdof-widgets-quick", index)),
                    Sense::click(),
                );
                painter.rect(
                    chip,
                    Rounding::same(8.0),
                    if active {
                        theme.accent.base.linear_multiply(0.16)
                    } else {
                        theme.palette.background
                    },
                    Stroke::new(
                        1.0_f32,
                        if active {
                            theme.accent.base
                        } else {
                            theme.palette.border
                        },
                    ),
                );
                painter.text(
                    chip.center(),
                    egui::Align2::CENTER_CENTER,
                    module,
                    FontId::new(8.0, crate::theme::semibold()),
                    if active {
                        theme.accent.base
                    } else {
                        theme.palette.text
                    },
                );
                if response.clicked() {
                    if let Some(position) =
                        draft.quick_actions.iter().position(|entry| *entry == index)
                    {
                        if draft.quick_actions.len() > 1 {
                            draft.quick_actions.remove(position);
                        }
                    } else if draft.quick_actions.len() < 4 {
                        draft.quick_actions.push(index);
                    }
                }
            }
            y += 62.0;
        }
        _ => {}
    }

    row_label(&painter, theme, left, y, "Größe");
    y += 14.0;
    for (label, value, minimum, maximum) in [
        ("Breite", draft.width, 220.0_f32, 400.0_f32),
        ("Höhe", draft.height, 160.0_f32, 320.0_f32),
    ] {
        let plus = Rect::from_min_size(Pos2::new(right - 26.0, y - 11.0), Vec2::splat(24.0));
        let minus = Rect::from_min_size(Pos2::new(right - 54.0, y - 11.0), Vec2::splat(24.0));
        if modal_button(ui, &painter, theme, minus, "−", false) {
            if label == "Breite" {
                draft.width = (draft.width - 20.0).max(minimum);
            } else {
                draft.height = (draft.height - 20.0).max(minimum);
            }
        }
        if modal_button(ui, &painter, theme, plus, "+", false) {
            if label == "Breite" {
                draft.width = (draft.width + 20.0).min(maximum);
            } else {
                draft.height = (draft.height + 20.0).min(maximum);
            }
        }
        painter.text(
            Pos2::new(left, y),
            egui::Align2::LEFT_CENTER,
            format!("{label}: {value:.0} px"),
            FontId::new(FONT_SMALL, crate::theme::semibold()),
            theme.palette.text,
        );
        y += 30.0;
    }

    // Live summary of the draft, so the dialog reflects the current pick immediately.
    painter.text(
        Pos2::new(left, panel.bottom() - 66.0),
        egui::Align2::LEFT_CENTER,
        format!(
            "{} · {} · {}",
            BACKGROUND_MODES[draft.background.min(3)],
            FONT_STYLES[draft.font.min(3)],
            format_clock_option(now, draft.clock_format)
        ),
        FontId::new(9.0, crate::theme::semibold()),
        theme.palette.text_muted,
    );

    let footer_y = panel.bottom() - 44.0;
    let cancel = Rect::from_min_size(
        Pos2::new(panel.left() + 18.0, footer_y),
        Vec2::new((width - 8.0) * 0.5, 32.0),
    );
    let save = Rect::from_min_size(
        Pos2::new(cancel.right() + 8.0, footer_y),
        Vec2::new((width - 8.0) * 0.5, 32.0),
    );
    if modal_button(ui, &painter, theme, cancel, "Abbrechen", false) {
        layer.settings = None;
        return;
    }
    if modal_button(ui, &painter, theme, save, "Speichern", true) {
        let note_color = draft.note_color;
        layer.set_options(kind, draft);
        if kind == WidgetKind::Notes {
            layer.sticky_color = note_color;
        }
        layer.settings = None;
    }
}

/// Paints one catalogue card with its live preview and the pin action.
#[allow(clippy::too_many_arguments)]
fn widget_card(
    ui: &mut egui::Ui,
    painter: &egui::Painter,
    theme: &Theme,
    labels: &WidgetLabels,
    item: &CatalogItem,
    rect: Rect,
    layer: &mut WidgetLayer,
    now: i64,
) {
    painter.rect(
        rect,
        Rounding::same(24.0),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let tile = Rect::from_min_size(
        Pos2::new(rect.left() + 20.0, rect.top() + 20.0),
        Vec2::splat(40.0),
    );
    painter.rect(tile, Rounding::same(16.0), item.tile, Stroke::NONE);
    item.icon.draw(
        painter,
        Rect::from_center_size(tile.center(), Vec2::splat(20.0)),
        Color32::WHITE,
        1.8,
    );
    painter.text(
        Pos2::new(tile.right() + 12.0, rect.top() + 28.0),
        egui::Align2::LEFT_CENTER,
        item.title,
        FontId::new(14.0, crate::theme::heavy()),
        theme.palette.text,
    );
    painter.text(
        Pos2::new(tile.right() + 12.0, rect.top() + 46.0),
        egui::Align2::LEFT_CENTER,
        item.description,
        FontId::new(11.0, crate::theme::semibold()),
        theme.palette.text_muted,
    );

    let gear = Rect::from_center_size(
        Pos2::new(rect.right() - 32.0, rect.top() + 36.0),
        Vec2::splat(28.0),
    );
    let gear_response = ui.interact(
        gear,
        Id::new(("socdof-widgets-gear", item.kind as u8)),
        Sense::click(),
    );
    if gear_response.hovered() {
        painter.rect(
            gear,
            Rounding::same(12.0),
            theme.palette.surface_muted,
            Stroke::NONE,
        );
    }
    Icon::Settings.draw(
        painter,
        Rect::from_center_size(gear.center(), Vec2::splat(16.0)),
        if gear_response.hovered() {
            theme.accent.base
        } else {
            theme.palette.text_muted
        },
        1.7,
    );
    gear_response.clone().on_hover_text(labels.configure);

    let configured = layer.options(item.kind);
    let preview = Rect::from_min_size(
        Pos2::new(rect.left() + 20.0, rect.top() + 72.0),
        Vec2::new(
            rect.width() - 40.0,
            item.preview * (configured.height / WidgetOptions::default().height).clamp(0.8, 1.6),
        ),
    );
    painter.rect(
        preview,
        Rounding::same(16.0),
        background_fill(theme, configured.background),
        Stroke::new(1.0_f32, theme.palette.border),
    );
    paint_preview(painter, theme, labels, item, preview, layer, now);

    let footer_top = rect.bottom() - 20.0 - 38.0;
    let configure = Rect::from_min_size(
        Pos2::new(rect.left() + 20.0, footer_top),
        Vec2::new(40.0, 38.0),
    );
    let configure_response = ui.interact(
        configure,
        Id::new(("socdof-widgets-configure", item.kind as u8)),
        Sense::click(),
    );
    painter.rect(
        configure,
        Rounding::same(16.0),
        theme.palette.surface_muted,
        Stroke::NONE,
    );
    Icon::Settings.draw(
        painter,
        Rect::from_center_size(configure.center(), Vec2::splat(14.0)),
        theme.palette.text,
        1.7,
    );
    configure_response.clone().on_hover_text(labels.configure);

    let pinned = layer.pinned.contains(&item.kind);
    let pin = Rect::from_min_max(
        Pos2::new(configure.right() + 8.0, footer_top),
        Pos2::new(rect.right() - 20.0, footer_top + 38.0),
    );
    let pin_response = ui.interact(
        pin,
        Id::new(("socdof-widgets-pin", item.kind as u8)),
        Sense::click(),
    );
    painter.rect(
        pin,
        Rounding::same(16.0),
        if pinned {
            theme.palette.surface_muted
        } else if pin_response.hovered() {
            theme.accent.hover
        } else {
            theme.accent.base
        },
        Stroke::NONE,
    );
    let pin_fill = if pinned {
        theme.palette.text
    } else {
        theme.palette.accent_on
    };
    let label = if pinned { labels.unpin } else { labels.pin };
    let galley = painter.layout_no_wrap(
        label.to_owned(),
        FontId::new(FONT_SMALL, crate::theme::heavy()),
        pin_fill,
    );
    let icon_left = pin.center().x - (galley.size().x + 22.0) * 0.5;
    Icon::Plus.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(icon_left + 8.0, pin.center().y),
            Vec2::splat(14.0),
        ),
        pin_fill,
        1.9,
    );
    painter.galley(
        Pos2::new(icon_left + 22.0, pin.center().y - galley.size().y * 0.5),
        galley,
        pin_fill,
    );

    // The gear and the configure tile open the customizer; only the pin button pins.
    if gear_response.clicked() || configure_response.clicked() {
        layer.settings = Some((item.kind, layer.options(item.kind)));
    }
    if pin_response.clicked() {
        if pinned {
            layer.pinned.retain(|kind| *kind != item.kind);
        } else {
            layer.pinned.push(item.kind);
        }
        match item.kind {
            WidgetKind::Clock => layer.clock = !pinned,
            WidgetKind::Calculator => layer.calculator = !pinned,
            WidgetKind::Notes => layer.notes = !pinned,
            _ => {}
        }
    }
}

/// Live preview of a catalogue card, mirroring the branches of the legacy module.
fn paint_preview(
    painter: &egui::Painter,
    theme: &Theme,
    labels: &WidgetLabels,
    item: &CatalogItem,
    rect: Rect,
    layer: &mut WidgetLayer,
    now: i64,
) {
    let inner = rect.shrink(12.0);
    let options = layer.options(item.kind);
    match item.kind {
        WidgetKind::Revenue => {
            Icon::TrendingUp.draw(
                painter,
                Rect::from_center_size(
                    Pos2::new(inner.left() + 6.0, inner.top() + 8.0),
                    Vec2::splat(11.0),
                ),
                theme.palette.success,
                1.6,
            );
            painter.text(
                Pos2::new(inner.left() + 16.0, inner.top() + 8.0),
                egui::Align2::LEFT_CENTER,
                labels.daily_revenue,
                FontId::new(11.0, crate::theme::heavy()),
                theme.palette.success,
            );
            painter.text(
                Pos2::new(inner.right(), inner.top() + 8.0),
                egui::Align2::RIGHT_CENTER,
                "0,00 €",
                FontId::new(11.0, crate::theme::mono_bold()),
                theme.palette.success,
            );
            painter.hline(
                inner.x_range(),
                inner.top() + 22.0,
                Stroke::new(1.0_f32, theme.palette.border),
            );
            painter.text(
                Pos2::new(inner.left(), inner.top() + 32.0),
                egui::Align2::LEFT_CENTER,
                labels.open_invoices,
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text_muted,
            );
            painter.text(
                Pos2::new(inner.right(), inner.top() + 32.0),
                egui::Align2::RIGHT_CENTER,
                "0",
                FontId::new(10.0, crate::theme::heavy()),
                Color32::from_rgb(0xd9, 0x77, 0x06),
            );
        }
        WidgetKind::Calendar => {
            let chip = Rect::from_min_size(inner.min, Vec2::splat(40.0));
            painter.rect(
                chip,
                Rounding::same(12.0),
                Color32::from_rgb(0x4f, 0x46, 0xe5),
                Stroke::NONE,
            );
            let date = socdof_core::date::format_date(now);
            let day: String = date.chars().take_while(|c| c.is_ascii_digit()).collect();
            painter.text(
                Pos2::new(chip.center().x, chip.top() + 9.0),
                egui::Align2::CENTER_CENTER,
                month_short(now),
                FontId::new(8.0, crate::theme::heavy()),
                Color32::WHITE,
            );
            painter.text(
                Pos2::new(chip.center().x, chip.top() + 26.0),
                egui::Align2::CENTER_CENTER,
                day,
                FontId::new(14.0, crate::theme::heavy()),
                Color32::WHITE,
            );
            painter.text(
                Pos2::new(chip.right() + 12.0, chip.top() + 10.0),
                egui::Align2::LEFT_CENTER,
                weekday_long(now),
                FontId::new(12.0, crate::theme::heavy()),
                theme.palette.text,
            );
            painter.text(
                Pos2::new(chip.right() + 12.0, chip.top() + 28.0),
                egui::Align2::LEFT_CENTER,
                date,
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text_muted,
            );
        }
        WidgetKind::Clock => {
            painter.text(
                Pos2::new(inner.left(), inner.top() + 8.0),
                egui::Align2::LEFT_CENTER,
                format_clock_option(now, options.clock_format),
                FontId::new(16.0, crate::theme::mono_bold()),
                theme.palette.text,
            );
            painter.text(
                Pos2::new(inner.left(), inner.top() + 26.0),
                egui::Align2::LEFT_CENTER,
                socdof_core::date::format_date(now),
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text_muted,
            );
            let tile = Rect::from_min_size(
                Pos2::new(inner.right() - 32.0, inner.top()),
                Vec2::splat(32.0),
            );
            painter.rect(
                tile,
                Rounding::same(12.0),
                Color32::from_rgb(0xe0, 0xf2, 0xfe),
                Stroke::NONE,
            );
            Icon::Clock.draw(
                painter,
                Rect::from_center_size(tile.center(), Vec2::splat(16.0)),
                Color32::from_rgb(0x02, 0x84, 0xc7),
                1.7,
            );
        }
        WidgetKind::Stock => {
            painter.text(
                Pos2::new(inner.left(), inner.top() + 8.0),
                egui::Align2::LEFT_CENTER,
                labels.stock_ok,
                FontId::new(11.0, crate::theme::heavy()),
                theme.palette.text,
            );
            painter.text(
                Pos2::new(inner.left(), inner.top() + 26.0),
                egui::Align2::LEFT_CENTER,
                labels.stock_check,
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text_muted,
            );
            let tile = Rect::from_min_size(
                Pos2::new(inner.right() - 28.0, inner.top()),
                Vec2::splat(28.0),
            );
            painter.rect(
                tile,
                Rounding::same(12.0),
                Color32::from_rgb(0xd1, 0xfa, 0xe5),
                Stroke::NONE,
            );
            Icon::Warning.draw(
                painter,
                Rect::from_center_size(tile.center(), Vec2::splat(14.0)),
                Color32::from_rgb(0x05, 0x96, 0x69),
                1.7,
            );
        }
        WidgetKind::QuickActions => {
            let colors = [
                Color32::from_rgb(0x4f, 0x46, 0xe5),
                Color32::from_rgb(0x0d, 0x94, 0x88),
                Color32::from_rgb(0x7c, 0x3a, 0xed),
                Color32::from_rgb(0x25, 0x63, 0xeb),
            ];
            let chips: Vec<(&str, Color32)> = options
                .quick_actions
                .iter()
                .take(4)
                .enumerate()
                .map(|(slot, module)| (quick_module_label(labels, *module), colors[slot]))
                .collect();
            let width = (inner.width() - 9.0 * (chips.len().saturating_sub(1)) as f32)
                / chips.len().max(1) as f32;
            for (index, (label, color)) in chips.iter().enumerate() {
                let chip = Rect::from_min_size(
                    Pos2::new(
                        inner.left() + index as f32 * (width + 3.0),
                        inner.top() + 2.0,
                    ),
                    Vec2::new(width, 20.0),
                );
                painter.rect(
                    chip,
                    Rounding::same(8.0),
                    color.linear_multiply(0.12),
                    Stroke::NONE,
                );
                painter.text(
                    chip.center(),
                    egui::Align2::CENTER_CENTER,
                    *label,
                    FontId::new(9.0, crate::theme::heavy()),
                    *color,
                );
            }
        }
        WidgetKind::Notes => {
            let color = STICKY_COLORS[options.note_color.min(STICKY_COLORS.len() - 1)];
            let note = Rect::from_min_size(
                Pos2::new(inner.left(), inner.top()),
                Vec2::new(inner.width(), 34.0),
            );
            painter.rect(
                note,
                Rounding::same(12.0),
                color.linear_multiply(0.25),
                Stroke::new(1.0_f32, color.linear_multiply(0.55)),
            );
            painter.text(
                Pos2::new(note.left() + 8.0, note.top() + 10.0),
                egui::Align2::LEFT_CENTER,
                labels.note_preview,
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text,
            );
            let swatch = 18.0;
            for (index, color) in STICKY_COLORS.iter().enumerate() {
                let center = Pos2::new(
                    inner.left() + 9.0 + index as f32 * (swatch + 4.0),
                    note.bottom() + 10.0,
                );
                painter.circle(
                    center,
                    swatch * 0.5,
                    *color,
                    if options.note_color == index {
                        Stroke::new(2.0_f32, theme.accent.base)
                    } else {
                        Stroke::new(1.0_f32, theme.palette.border)
                    },
                );
            }
        }
        WidgetKind::Calculator => {}
    }
}

/// Three letter month of the current date, for the calendar preview chip.
fn month_short(millis: i64) -> &'static str {
    const MONTHS: [&str; 12] = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ];
    MONTHS[(month_index(millis) as usize).min(11)]
}

/// Long weekday of the current date.
fn weekday_long(millis: i64) -> &'static str {
    const DAYS: [&str; 7] = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];
    DAYS[(weekday_index(millis) as usize).min(6)]
}

/// Month index (0 based) of a UTC millisecond timestamp.
fn month_index(millis: i64) -> u32 {
    let (_, month, _) = civil_from_days(millis.div_euclid(86_400_000));
    month.saturating_sub(1)
}

/// Weekday index (0 = Sunday) of a UTC millisecond timestamp.
fn weekday_index(millis: i64) -> u32 {
    (millis.div_euclid(86_400_000) + 4).rem_euclid(7) as u32
}

/// Year, month and day of a day count since 1970, Howard Hinnant's algorithm.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    #[test]
    fn the_default_layer_shows_clock_date_and_status() {
        let layer = WidgetLayer::default();
        assert!(layer.clock);
        assert!(layer.date);
        assert_eq!(layer.battery_percent, 82);
        assert_eq!(layer.connection, Connection::Online);
        assert!(layer.calculator);
        assert!(layer.notes);
        assert_eq!(layer.calculator_state.display(), "0");
    }

    #[test]
    fn battery_is_clamped_and_connection_toggles() {
        let mut layer = WidgetLayer::new();
        layer.set_battery(140);
        assert_eq!(layer.battery_percent, 100);
        assert_eq!(layer.connection, Connection::Online);
        layer.connection = layer.connection.toggle();
        assert_eq!(layer.connection, Connection::Offline);
        assert_eq!(layer.connection.label_key(), "widget_offline");
    }

    #[test]
    fn the_calculator_adds_and_chains_operations() {
        let mut calculator = Calculator::new();
        for key in [
            CalcKey::Digit(1),
            CalcKey::Digit(2),
            CalcKey::Add,
            CalcKey::Digit(3),
            CalcKey::Equals,
        ] {
            calculator.press(key);
        }
        assert_eq!(calculator.display(), "15");
        calculator.press(CalcKey::Add);
        calculator.press(CalcKey::Digit(4));
        calculator.press(CalcKey::Equals);
        assert_eq!(calculator.display(), "19", "the result stays an operand");
    }

    #[test]
    fn the_calculator_keeps_thousandths_without_floats() {
        let mut calculator = Calculator::new();
        for key in [
            CalcKey::Digit(7),
            CalcKey::Divide,
            CalcKey::Digit(2),
            CalcKey::Equals,
        ] {
            calculator.press(key);
        }
        assert_eq!(calculator.display(), "3.5");

        let mut calculator = Calculator::new();
        for key in [
            CalcKey::Digit(2),
            CalcKey::Multiply,
            CalcKey::Digit(3),
            CalcKey::Decimal,
            CalcKey::Digit(2),
            CalcKey::Digit(5),
            CalcKey::Equals,
        ] {
            calculator.press(key);
        }
        assert_eq!(calculator.display(), "6.5");
    }

    #[test]
    fn division_by_zero_keeps_the_left_side_and_clear_resets() {
        let mut calculator = Calculator::new();
        for key in [
            CalcKey::Digit(5),
            CalcKey::Divide,
            CalcKey::Digit(0),
            CalcKey::Equals,
        ] {
            calculator.press(key);
        }
        assert_eq!(calculator.display(), "5");
        calculator.press(CalcKey::Clear);
        assert_eq!(calculator.display(), "0");
    }

    #[test]
    fn the_widgets_panel_paints_and_keeps_its_catalogue() {
        let ctx = crate::theme::headless_context();
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let mut layer = WidgetLayer::new();
        let output = ctx.run(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(520.0, 640.0))),
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    widgets_app(ui, &theme, &texts, &mut focus, &mut layer, 0);
                });
            },
        );
        assert!(output.shapes.len() > 30, "the widgets panel drew little");
        layer.clock = false;
        layer.calculator = false;
        assert!(!layer.clock && !layer.calculator && layer.notes);
    }

    #[test]
    fn widgets_paint_without_a_display() {
        let ctx = crate::theme::headless_context();
        let theme = Theme::new(crate::theme::Appearance::Dark, "indigo");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let mut layer = WidgetLayer::new();
        layer.notes_text.push_str("Notiz");
        let output = ctx.run(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 800.0))),
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    widgets(ui, &theme, &texts, 1_000, &mut layer);
                });
            },
        );
        assert!(output.shapes.len() > 20, "widget cards drew little");
    }

    #[test]
    fn widget_options_round_trip_and_default() {
        let mut layer = WidgetLayer::new();
        let defaults = layer.options(WidgetKind::Clock);
        assert_eq!(defaults.background, 0);
        assert_eq!(defaults.clock_format, 0);
        let changed = WidgetOptions {
            background: 3,
            clock_format: 1,
            width: 360.0,
            ..defaults.clone()
        };
        layer.set_options(WidgetKind::Clock, changed.clone());
        assert_eq!(layer.options(WidgetKind::Clock), changed);
        assert_eq!(layer.options(WidgetKind::Notes), defaults);
    }

    #[test]
    fn the_clock_option_formats_twelve_hours() {
        let noon = 12 * 3600 * 1000;
        assert_eq!(format_clock_option(noon, 1), "12:00:00");
        assert_eq!(
            format_clock_option(noon + 3600 * 1000 + 60 * 1000, 1),
            "13:01:00"
        );
        assert_eq!(format_clock_option(noon, 0), "12:00:00 PM");
    }
}
