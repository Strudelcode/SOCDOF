//! Desktop widgets layer: clock, date and status.
//!
//! Widgets are painted directly into the desktop surface, before the floating windows are drawn, so
//! they can never cover a window or change the window z-order. The layer is plain data and can be
//! shown, hidden and changed without any screen state.

use egui::{FontId, Id, Pos2, Rect, Rounding, Sense, Stroke, Vec2, WidgetInfo, WidgetType};

use crate::desktop::format_clock;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, RADIUS_CARD};

/// Width of the widget card.
pub const WIDGET_WIDTH: f32 = 216.0;
/// Height of the widget card.
pub const WIDGET_HEIGHT: f32 = 108.0;

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
}

impl Default for WidgetLayer {
    fn default() -> Self {
        Self::new()
    }
}

impl WidgetLayer {
    /// A widget layer with clock, date and the default status.
    pub fn new() -> Self {
        Self {
            clock: true,
            date: true,
            battery_percent: 82,
            connection: Connection::Online,
        }
    }

    /// Sets the battery charge, clamped to a valid percentage.
    pub fn set_battery(&mut self, percent: u8) {
        self.battery_percent = percent.min(100);
    }
}

/// Paints the widgets layer into the top right corner of `ui`'s area.
pub fn widgets(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, now: i64, state: &WidgetLayer) {
    let area = ui.max_rect();
    let rect = Rect::from_min_size(
        Pos2::new(area.right() - WIDGET_WIDTH - 16.0, area.top() + 16.0),
        Vec2::new(WIDGET_WIDTH, WIDGET_HEIGHT),
    );
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::Context;
    use socdof_core::domain::settings::Language;

    #[test]
    fn the_default_layer_shows_clock_date_and_status() {
        let layer = WidgetLayer::default();
        assert!(layer.clock);
        assert!(layer.date);
        assert_eq!(layer.battery_percent, 82);
        assert_eq!(layer.connection, Connection::Online);
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
    fn widgets_paint_without_a_display() {
        let ctx = Context::default();
        let theme = Theme::new(crate::theme::Appearance::Dark, "indigo");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let layer = WidgetLayer::new();
        let output = ctx.run(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 800.0))),
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    widgets(ui, &theme, &texts, 1_000, &layer);
                });
            },
        );
        assert!(output.shapes.len() > 5, "widget card drew little");
    }
}
