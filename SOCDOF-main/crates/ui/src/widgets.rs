//! Desktop widgets layer: clock, date, status, calculator and notes.
//!
//! Widgets are painted directly into the desktop surface, before the floating windows are drawn, so
//! they can never cover a window or change the window z-order. The layer is plain data: the
//! calculator is an integer state machine and the notes are a plain string, so both can be tested
//! and persisted without a display.

use egui::{
    Button, Color32, FontId, Id, Pos2, Rect, RichText, Rounding, Sense, Stroke, TextEdit, Vec2,
    WidgetInfo, WidgetType,
};

use crate::desktop::format_clock;
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
}

/// Pending arithmetic operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Operator {
    Add,
    Subtract,
    Multiply,
    Divide,
}

/// Desktop calculator working on thousandths, so no binary float ever reaches the display.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Calculator {
    entry: String,
    accumulator: i128,
    pending: Option<Operator>,
    fresh: bool,
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
        }
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
                    self.accumulator = apply(operator, self.accumulator, value);
                } else {
                    self.accumulator = value;
                }
                self.entry = format_units(self.accumulator);
                self.fresh = true;
            }
            CalcKey::Clear => *self = Self::new(),
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
        self.fresh = true;
        self.entry.clear();
    }
}

/// Applies an operation on thousandths; division by zero keeps the left side.
fn apply(operator: Operator, left: i128, right: i128) -> i128 {
    match operator {
        Operator::Add => left + right,
        Operator::Subtract => left - right,
        Operator::Multiply => left * right / 1000,
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
fn format_units(value: i128) -> String {
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

/// State of the desktop widgets layer.
#[derive(Debug, Clone, PartialEq, Eq)]
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
}
