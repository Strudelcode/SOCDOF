//! Application window chrome of the SOCDOF desktop applications.
//!
//! The legacy application opens every module in a Windows 11 style window: an accent frame, a title
//! bar with the application icon, the translated name, the module slug in brackets and the window
//! buttons. This module draws exactly that chrome in Rust, so a module screen looks the same inside
//! the desktop and in the browser preview.
//!
//! The title bar is a top panel, which means the module screen below it keeps its own
//! [`egui::CentralPanel`] and needs no layout changes. [`app_frame`] adds the accent border and the
//! accent line of the active window on top of the painted panels.

use egui::{
    Context, Id, Pos2, Rect, RichText, Rounding, Sense, Stroke, Ui, Vec2, WidgetInfo, WidgetType,
};

use crate::components::{badge, button, card, ButtonVariant, Tone};
use crate::focus::{focus_ring, FocusState};
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{with_alpha, FONT_BODY, FONT_SMALL};

/// Height of the application title bar, matching the 40 pixel bar of the legacy windows.
pub const APP_TITLE_BAR_HEIGHT: f32 = 40.0;

/// Identity of one SOCDOF application: slug, catalogue key of its name and its icon.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppChrome {
    /// Stable slug shared with the desktop, the taskbar and the persistence keys.
    pub slug: &'static str,
    /// Catalogue key of the translated application name.
    pub title_key: &'static str,
    /// Glyph painted into the application tile.
    pub icon: Icon,
    /// Tile color of the app on the desktop, as `0xrrggbb`.
    pub tint: u32,
}

/// Tile color of an app on the desktop, matching the legacy app launcher.
pub fn tint(app: AppChrome) -> egui::Color32 {
    egui::Color32::from_rgb(
        (app.tint >> 16) as u8,
        ((app.tint >> 8) & 0xff) as u8,
        (app.tint & 0xff) as u8,
    )
}

/// Every application of the suite, in the order of the legacy app launcher.
pub const APPS: [AppChrome; 16] = [
    AppChrome {
        slug: "dashboard",
        title_key: "app_dashboard",
        icon: Icon::Chart,
        tint: 0x4f46e5,
    },
    AppChrome {
        slug: "contacts",
        title_key: "app_contacts",
        icon: Icon::User,
        tint: 0x0d9488,
    },
    AppChrome {
        slug: "products",
        title_key: "app_products",
        icon: Icon::Folder,
        tint: 0xd97706,
    },
    AppChrome {
        slug: "invoices",
        title_key: "app_invoices",
        icon: Icon::Receipt,
        tint: 0x7c3aed,
    },
    AppChrome {
        slug: "accounting",
        title_key: "app_accounting",
        icon: Icon::Chart,
        tint: 0x059669,
    },
    AppChrome {
        slug: "purchases",
        title_key: "app_purchases",
        icon: Icon::Cart,
        tint: 0xc2410c,
    },
    AppChrome {
        slug: "pos",
        title_key: "app_pos",
        icon: Icon::Bag,
        tint: 0xe11d48,
    },
    AppChrome {
        slug: "calendar",
        title_key: "app_calendar",
        icon: Icon::Calendar,
        tint: 0x0284c7,
    },
    AppChrome {
        slug: "support",
        title_key: "app_support",
        icon: Icon::Bell,
        tint: 0x0891b2,
    },
    AppChrome {
        slug: "reports",
        title_key: "app_reports",
        icon: Icon::Chart,
        tint: 0x7e22ce,
    },
    AppChrome {
        slug: "therapy",
        title_key: "app_therapy",
        icon: Icon::Sun,
        tint: 0xdb2777,
    },
    AppChrome {
        slug: "users",
        title_key: "app_users",
        icon: Icon::Shield,
        tint: 0x6d28d9,
    },
    AppChrome {
        slug: "settings",
        title_key: "app_settings",
        icon: Icon::Settings,
        tint: 0x475569,
    },
    AppChrome {
        slug: "editor",
        title_key: "app_editor",
        icon: Icon::Book,
        tint: 0x2563eb,
    },
    AppChrome {
        slug: "app-store",
        title_key: "app_app_store",
        icon: Icon::Grid,
        tint: 0x714b67,
    },
    AppChrome {
        slug: "projects",
        title_key: "app_projects",
        icon: Icon::Folder,
        tint: 0x7c3aed,
    },
];

/// Chrome of the given app slug, falling back to the settings app for unknown slugs.
pub fn app_chrome(slug: &str) -> AppChrome {
    APPS.iter()
        .copied()
        .find(|app| app.slug == slug)
        .unwrap_or_else(|| {
            *APPS
                .iter()
                .find(|app| app.slug == "settings")
                .unwrap_or(&APPS[0])
        })
}

/// Translated name of an application.
pub fn app_title(texts: &UiTexts, app: AppChrome) -> String {
    texts.get(app.title_key).to_string()
}

/// What the user asked the window to do in this frame.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WindowAction {
    /// The close button was pressed, the caller should leave the screen.
    pub close: bool,
    /// The minimize button was pressed, the caller should return to the desktop.
    pub minimize: bool,
    /// The maximize button was pressed. Screens already fill the window, so this is informational.
    pub maximize: bool,
}

/// Draws the application title bar and reports the window button that was pressed.
///
/// The bar is drawn as a top panel, so the module screen that follows it can keep using its own
/// central panel and fills exactly the remaining area.
pub fn app_title_bar(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    app: AppChrome,
) -> WindowAction {
    let mut action = WindowAction::default();
    let bar_frame = egui::Frame::none()
        .fill(theme.palette.surface)
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .inner_margin(egui::Margin::symmetric(12.0, 0.0));

    egui::TopBottomPanel::top(Id::new(("socdof-app-title-bar", app.slug)))
        .exact_height(APP_TITLE_BAR_HEIGHT)
        .frame(bar_frame)
        .show(ctx, |ui| {
            let rect = ui.max_rect();
            ui.horizontal_centered(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(22.0), Sense::hover());
                ui.painter()
                    .rect(tile, Rounding::same(7.0), theme.accent.base, Stroke::NONE);
                app.icon.draw(
                    ui.painter(),
                    Rect::from_center_size(tile.center(), Vec2::splat(13.0)),
                    theme.palette.accent_on,
                    1.6,
                );
                ui.add_space(2.0);
                ui.label(
                    RichText::new(app_title(texts, app))
                        .size(FONT_BODY)
                        .strong()
                        .color(theme.palette.text),
                );
                ui.label(
                    RichText::new(format!("[{}]", app.slug.to_uppercase()))
                        .size(10.0)
                        .monospace()
                        .color(theme.palette.text_muted),
                );
            });

            let mut right = rect.right();
            let close = title_button(
                ui,
                theme,
                focus,
                TitleButton {
                    id: Id::new(("socdof-app-close", app.slug)),
                    center: Pos2::new(right - 14.0, rect.center().y),
                    icon: Icon::Close,
                    label: texts.get("window_close"),
                    hover_fill: Some(theme.palette.danger),
                },
            );
            right -= 30.0;
            let maximize = title_button(
                ui,
                theme,
                focus,
                TitleButton {
                    id: Id::new(("socdof-app-maximize", app.slug)),
                    center: Pos2::new(right - 14.0, rect.center().y),
                    icon: Icon::Maximize,
                    label: texts.get("window_maximize"),
                    hover_fill: None,
                },
            );
            right -= 30.0;
            let minimize = title_button(
                ui,
                theme,
                focus,
                TitleButton {
                    id: Id::new(("socdof-app-minimize", app.slug)),
                    center: Pos2::new(right - 14.0, rect.center().y),
                    icon: Icon::Minimize,
                    label: texts.get("window_minimize"),
                    hover_fill: None,
                },
            );

            action.close = close;
            action.minimize = minimize;
            action.maximize = maximize;
        });

    action
}

/// Paints the accent border and the active accent line of the window around the screen.
///
/// Call this after the module screen has been drawn, so the frame sits above the content.
pub fn app_frame(ctx: &Context, theme: &Theme) {
    let screen = ctx.screen_rect();
    let painter = ctx.layer_painter(egui::LayerId::new(
        egui::Order::Foreground,
        Id::new("socdof-app-frame"),
    ));
    painter.rect_stroke(
        screen.shrink(0.5),
        Rounding::same(0.0),
        Stroke::new(1.0_f32, theme.accent.base),
    );
    painter.rect_filled(
        Rect::from_min_size(screen.min, Vec2::new(screen.width(), 2.0)),
        Rounding::same(0.0),
        theme.accent.base,
    );
}

/// Draws the title bar, the module screen and the window frame in one call.
///
/// Returns the requested window action so the caller can leave the screen when it was closed or
/// minimized. The screen itself is drawn by `body`, which keeps its own central panel.
pub fn app_window(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    app: AppChrome,
    body: impl FnOnce(&mut FocusState),
) -> WindowAction {
    let action = app_title_bar(ctx, theme, texts, focus, app);
    body(focus);
    app_frame(ctx, theme);
    action
}

/// Title, subtitle, icon and optional status chip of a module header.
#[derive(Debug, Clone, Copy)]
pub struct ModuleHeader<'a> {
    /// Application the header belongs to, which supplies the icon.
    pub app: AppChrome,
    /// Translated screen title.
    pub title: &'a str,
    /// Translated one line description.
    pub subtitle: &'a str,
    /// Optional status chip next to the title.
    pub status: Option<(&'a str, Tone)>,
}

/// Draws the header card that every module screen shows above its content.
///
/// It carries the accent icon tile, the translated title, an optional status badge, the subtitle
/// and the back button, which is the same layout the legacy toolbars use.
pub fn module_header(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    header: ModuleHeader<'_>,
    back: &mut bool,
) -> bool {
    let ModuleHeader {
        app,
        title,
        subtitle,
        status,
    } = header;
    let mut clicked_back = false;
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            let (tile, _) = ui.allocate_exact_size(Vec2::splat(44.0), Sense::hover());
            ui.painter().rect(
                tile,
                Rounding::same(14.0),
                theme.accent.light,
                Stroke::new(1.0_f32, with_alpha(theme.accent.base, 40)),
            );
            app.icon.draw(
                ui.painter(),
                Rect::from_center_size(tile.center(), Vec2::splat(22.0)),
                theme.accent_text(),
                1.7,
            );
            ui.add_space(4.0);
            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(title)
                            .size(22.0)
                            .strong()
                            .color(theme.palette.text),
                    );
                    if let Some((label, tone)) = status {
                        badge(ui, theme, label, tone);
                    }
                });
                ui.label(
                    RichText::new(subtitle)
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("module_back"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    clicked_back = true;
                }
            });
        });
    });
    if clicked_back {
        *back = true;
    }
    clicked_back
}

/// Draws one window button of the title bar at a fixed position.
/// One window button of the title bar.
struct TitleButton<'a> {
    id: Id,
    center: Pos2,
    icon: Icon,
    label: &'a str,
    hover_fill: Option<egui::Color32>,
}

fn title_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    button: TitleButton<'_>,
) -> bool {
    let TitleButton {
        id,
        center,
        icon,
        label,
        hover_fill,
    } = button;
    let rect = Rect::from_center_size(center, Vec2::splat(26.0));
    let focused = focus.register(id);
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    let hovered = response.hovered() || focused;
    if hovered || activated {
        ui.painter().rect(
            rect,
            Rounding::same(7.0),
            hover_fill.unwrap_or(theme.accent.light),
            Stroke::NONE,
        );
    }
    let color = if hovered && hover_fill.is_some() {
        theme.palette.accent_on
    } else if hovered {
        theme.accent_text()
    } else {
        theme.palette.text_muted
    };
    icon.draw(
        ui.painter(),
        Rect::from_center_size(rect.center(), Vec2::splat(13.0)),
        color,
        1.5,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_app_has_a_title_key_and_a_slug() {
        for app in APPS {
            assert!(!app.slug.is_empty());
            assert!(app.title_key.starts_with("app_"));
        }
    }

    #[test]
    fn unknown_slugs_fall_back_to_settings() {
        assert_eq!(app_chrome("no-such-app").slug, "settings");
        assert_eq!(app_chrome("pos").icon, Icon::Bag);
    }
}
