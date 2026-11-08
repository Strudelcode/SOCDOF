//! Vector icons drawn by Rust.
//!
//! The legacy interface used `lucide-react`. The Rust UI cannot ship JavaScript, so every glyph is
//! drawn from line segments, circles and polygons here. Glyphs are defined in a normalized 0..1 box
//! and scaled by the caller, which keeps them crisp at any size and identical in both appearances.

use egui::{Color32, Painter, Pos2, Rect, Stroke};

/// Glyphs the kit can draw.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Icon {
    /// Magnifier.
    Search,
    /// Plus sign.
    Plus,
    /// Pencil.
    Edit,
    /// Waste bin.
    Trash,
    /// Cross.
    Close,
    /// Downward chevron.
    ChevronDown,
    /// Left chevron.
    ChevronLeft,
    /// Right chevron.
    ChevronRight,
    /// Check mark.
    Check,
    /// Arrow up out of a tray.
    Upload,
    /// Calendar sheet.
    Calendar,
    /// Three dots.
    More,
    /// Funnel.
    Filter,
    /// Cog.
    Settings,
    /// Bell.
    Bell,
    /// Person.
    User,
    /// Folder.
    Folder,
    /// Circular arrow.
    Refresh,
    /// Sun.
    Sun,
    /// Crescent moon.
    Moon,
    /// Circled i.
    Info,
    /// Warning triangle.
    Warning,
    /// Horizontal bar, window minimize.
    Minimize,
    /// Square outline, window maximize.
    Maximize,
    /// Two offset squares, restore a maximized window.
    Restore,
    /// Four squares, the start menu.
    Grid,
    /// Battery outline with a charge level.
    Battery,
    /// Wi-Fi arcs.
    Wifi,
    /// Receipt with two text lines, the invoices module.
    Receipt,
    /// Shopping cart, the purchases module.
    Cart,
    /// Three rising bars, the accounting module.
    Chart,
    /// Closed book, the text editor module.
    Book,
    /// Shield outline, the user management module.
    Shield,
    /// Shopping bag, the point of sale module.
    Bag,
}

/// Every icon of the set, used by the gallery and the tests.
pub const ALL_ICONS: [Icon; 34] = [
    Icon::Search,
    Icon::Plus,
    Icon::Edit,
    Icon::Trash,
    Icon::Close,
    Icon::ChevronDown,
    Icon::ChevronLeft,
    Icon::ChevronRight,
    Icon::Check,
    Icon::Upload,
    Icon::Calendar,
    Icon::More,
    Icon::Filter,
    Icon::Settings,
    Icon::Bell,
    Icon::User,
    Icon::Folder,
    Icon::Refresh,
    Icon::Sun,
    Icon::Moon,
    Icon::Info,
    Icon::Warning,
    Icon::Minimize,
    Icon::Maximize,
    Icon::Restore,
    Icon::Grid,
    Icon::Battery,
    Icon::Wifi,
    Icon::Receipt,
    Icon::Cart,
    Icon::Chart,
    Icon::Book,
    Icon::Shield,
    Icon::Bag,
];

impl Icon {
    /// Paints the glyph into `rect` in `color`.
    ///
    /// The rect must be square for undistorted glyphs; `width` is the stroke width in points.
    pub fn draw(self, painter: &Painter, rect: Rect, color: Color32, width: f32) {
        let stroke = Stroke::new(width, color);
        let p = |x: f32, y: f32| {
            Pos2::new(
                rect.left() + x * rect.width(),
                rect.top() + y * rect.height(),
            )
        };
        let polyline = |points: Vec<Pos2>| {
            painter.add(egui::Shape::line(points, stroke));
        };
        let polygon = |points: Vec<Pos2>| {
            painter.add(egui::Shape::closed_line(points, stroke));
        };
        let center = rect.center();
        let radius = rect.width() * 0.5;
        let dot = |x: f32, y: f32, r: f32| {
            painter.circle_filled(p(x, y), r * rect.width(), color);
        };

        match self {
            Icon::Search => {
                painter.circle_stroke(p(0.42, 0.42), rect.width() * 0.27, stroke);
                polyline(vec![p(0.62, 0.62), p(0.87, 0.87)]);
            }
            Icon::Plus => {
                polyline(vec![p(0.5, 0.16), p(0.5, 0.84)]);
                polyline(vec![p(0.16, 0.5), p(0.84, 0.5)]);
            }
            Icon::Edit => polygon(vec![
                p(0.18, 0.82),
                p(0.23, 0.62),
                p(0.66, 0.17),
                p(0.83, 0.34),
                p(0.38, 0.77),
            ]),
            Icon::Trash => {
                polyline(vec![p(0.16, 0.28), p(0.84, 0.28)]);
                polyline(vec![
                    p(0.38, 0.28),
                    p(0.41, 0.14),
                    p(0.59, 0.14),
                    p(0.62, 0.28),
                ]);
                polygon(vec![
                    p(0.26, 0.28),
                    p(0.3, 0.87),
                    p(0.7, 0.87),
                    p(0.74, 0.28),
                ]);
            }
            Icon::Close => {
                polyline(vec![p(0.22, 0.22), p(0.78, 0.78)]);
                polyline(vec![p(0.78, 0.22), p(0.22, 0.78)]);
            }
            Icon::ChevronDown => polyline(vec![p(0.24, 0.4), p(0.5, 0.66), p(0.76, 0.4)]),
            Icon::ChevronLeft => polyline(vec![p(0.62, 0.2), p(0.36, 0.5), p(0.62, 0.8)]),
            Icon::ChevronRight => polyline(vec![p(0.38, 0.2), p(0.64, 0.5), p(0.38, 0.8)]),
            Icon::Check => polyline(vec![p(0.18, 0.52), p(0.42, 0.76), p(0.82, 0.28)]),
            Icon::Upload => {
                polyline(vec![p(0.5, 0.72), p(0.5, 0.16)]);
                polyline(vec![p(0.3, 0.36), p(0.5, 0.16), p(0.7, 0.36)]);
                polyline(vec![
                    p(0.18, 0.72),
                    p(0.18, 0.86),
                    p(0.82, 0.86),
                    p(0.82, 0.72),
                ]);
            }
            Icon::Calendar => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.14, 0.24), p(0.86, 0.86)),
                    egui::Rounding::same(rect.width() * 0.08),
                    stroke,
                );
                polyline(vec![p(0.14, 0.4), p(0.86, 0.4)]);
                polyline(vec![p(0.32, 0.14), p(0.32, 0.3)]);
                polyline(vec![p(0.68, 0.14), p(0.68, 0.3)]);
            }
            Icon::More => {
                dot(0.22, 0.5, 0.07);
                dot(0.5, 0.5, 0.07);
                dot(0.78, 0.5, 0.07);
            }
            Icon::Filter => {
                polyline(vec![p(0.14, 0.22), p(0.86, 0.22)]);
                polyline(vec![p(0.3, 0.5), p(0.7, 0.5)]);
                polyline(vec![p(0.42, 0.78), p(0.58, 0.78)]);
            }
            Icon::Settings => {
                painter.circle_stroke(center, radius * 0.3, stroke);
                painter.circle_stroke(center, radius * 0.58, stroke);
                for step in 0..6 {
                    let angle = step as f32 * std::f32::consts::TAU / 6.0;
                    let inner = radius * 0.58;
                    let outer = radius * 0.82;
                    polyline(vec![
                        Pos2::new(
                            center.x + angle.cos() * inner,
                            center.y + angle.sin() * inner,
                        ),
                        Pos2::new(
                            center.x + angle.cos() * outer,
                            center.y + angle.sin() * outer,
                        ),
                    ]);
                }
            }
            Icon::Bell => {
                polygon(vec![
                    p(0.28, 0.74),
                    p(0.35, 0.62),
                    p(0.35, 0.44),
                    p(0.5, 0.24),
                    p(0.65, 0.44),
                    p(0.65, 0.62),
                    p(0.72, 0.74),
                ]);
                polyline(vec![p(0.2, 0.74), p(0.8, 0.74)]);
                polyline(vec![p(0.44, 0.86), p(0.56, 0.86)]);
            }
            Icon::User => {
                painter.circle_stroke(p(0.5, 0.32), rect.width() * 0.17, stroke);
                polyline(vec![
                    p(0.2, 0.86),
                    p(0.29, 0.64),
                    p(0.5, 0.57),
                    p(0.71, 0.64),
                    p(0.8, 0.86),
                ]);
            }
            Icon::Folder => polygon(vec![
                p(0.14, 0.76),
                p(0.14, 0.28),
                p(0.42, 0.28),
                p(0.5, 0.4),
                p(0.86, 0.4),
                p(0.86, 0.76),
            ]),
            Icon::Refresh => {
                let mut points = Vec::new();
                for step in 0..=16 {
                    let angle = -0.7 + step as f32 * (std::f32::consts::TAU * 0.72 / 16.0);
                    points.push(Pos2::new(
                        center.x + angle.cos() * radius * 0.34,
                        center.y + angle.sin() * radius * 0.34,
                    ));
                }
                polyline(points);
                polyline(vec![p(0.72, 0.12), p(0.86, 0.3), p(0.64, 0.34)]);
            }
            Icon::Sun => {
                painter.circle_stroke(center, radius * 0.24, stroke);
                for step in 0..8 {
                    let angle = step as f32 * std::f32::consts::TAU / 8.0;
                    let (sin, cos) = angle.sin_cos();
                    polyline(vec![
                        Pos2::new(
                            center.x + cos * radius * 0.46,
                            center.y + sin * radius * 0.46,
                        ),
                        Pos2::new(
                            center.x + cos * radius * 0.78,
                            center.y + sin * radius * 0.78,
                        ),
                    ]);
                }
            }
            Icon::Moon => {
                let mut points = Vec::new();
                for step in 0..=14 {
                    let angle = 0.9 + step as f32 * (std::f32::consts::TAU * 0.62 / 14.0);
                    points.push(Pos2::new(
                        center.x + angle.cos() * radius * 0.4,
                        center.y + angle.sin() * radius * 0.4,
                    ));
                }
                for step in 0..=14 {
                    let angle = 2.6 - step as f32 * (std::f32::consts::TAU * 0.54 / 14.0);
                    points.push(Pos2::new(
                        center.x + angle.cos() * radius * 0.22 + radius * 0.16,
                        center.y + angle.sin() * radius * 0.22,
                    ));
                }
                polyline(points);
            }
            Icon::Info => {
                painter.circle_stroke(center, radius * 0.72, stroke);
                dot(0.5, 0.3, 0.06);
                polyline(vec![p(0.5, 0.46), p(0.5, 0.74)]);
            }
            Icon::Warning => {
                polygon(vec![p(0.5, 0.14), p(0.9, 0.84), p(0.1, 0.84)]);
                polyline(vec![p(0.5, 0.42), p(0.5, 0.62)]);
                dot(0.5, 0.72, 0.05);
            }
            Icon::Minimize => polyline(vec![p(0.22, 0.62), p(0.78, 0.62)]),
            Icon::Maximize => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.22, 0.22), p(0.78, 0.78)),
                    egui::Rounding::same(rect.width() * 0.04),
                    stroke,
                );
            }
            Icon::Restore => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.18, 0.3), p(0.7, 0.82)),
                    egui::Rounding::same(rect.width() * 0.04),
                    stroke,
                );
                polyline(vec![
                    p(0.3, 0.3),
                    p(0.3, 0.18),
                    p(0.82, 0.18),
                    p(0.82, 0.7),
                    p(0.7, 0.7),
                ]);
            }
            Icon::Grid => {
                for (x, y) in [(0.16, 0.16), (0.56, 0.16), (0.16, 0.56), (0.56, 0.56)] {
                    painter.rect_stroke(
                        Rect::from_min_max(p(x, y), p(x + 0.28, y + 0.28)),
                        egui::Rounding::same(rect.width() * 0.04),
                        stroke,
                    );
                }
            }
            Icon::Battery => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.1, 0.32), p(0.8, 0.68)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                polyline(vec![p(0.86, 0.44), p(0.86, 0.56)]);
                painter.rect_filled(
                    Rect::from_min_max(p(0.18, 0.4), p(0.58, 0.6)),
                    egui::Rounding::same(rect.width() * 0.03),
                    color,
                );
            }
            Icon::Receipt => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.2, 0.12), p(0.8, 0.88)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                polyline(vec![p(0.34, 0.36), p(0.66, 0.36)]);
                polyline(vec![p(0.34, 0.54), p(0.66, 0.54)]);
                polyline(vec![p(0.34, 0.72), p(0.54, 0.72)]);
            }
            Icon::Cart => {
                polyline(vec![
                    p(0.1, 0.2),
                    p(0.26, 0.2),
                    p(0.38, 0.66),
                    p(0.76, 0.66),
                ]);
                polyline(vec![
                    p(0.3, 0.36),
                    p(0.82, 0.36),
                    p(0.76, 0.6),
                    p(0.36, 0.6),
                ]);
                dot(0.42, 0.82, 0.06);
                dot(0.7, 0.82, 0.06);
            }
            Icon::Chart => {
                polyline(vec![p(0.14, 0.86), p(0.14, 0.14)]);
                polyline(vec![p(0.14, 0.86), p(0.88, 0.86)]);
                for (x, top) in [(0.3, 0.6), (0.5, 0.42), (0.7, 0.24)] {
                    polyline(vec![p(x, 0.82), p(x, top)]);
                }
            }
            Icon::Book => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.18, 0.14), p(0.82, 0.86)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                polyline(vec![p(0.34, 0.14), p(0.34, 0.86)]);
                polyline(vec![p(0.46, 0.34), p(0.72, 0.34)]);
                polyline(vec![p(0.46, 0.48), p(0.72, 0.48)]);
            }
            Icon::Shield => {
                polygon(vec![
                    p(0.5, 0.12),
                    p(0.82, 0.26),
                    p(0.82, 0.54),
                    p(0.5, 0.86),
                    p(0.18, 0.54),
                    p(0.18, 0.26),
                ]);
                polyline(vec![p(0.36, 0.5), p(0.48, 0.62), p(0.66, 0.38)]);
            }
            Icon::Bag => {
                polygon(vec![
                    p(0.2, 0.32),
                    p(0.8, 0.32),
                    p(0.74, 0.88),
                    p(0.26, 0.88),
                ]);
                polyline(vec![
                    p(0.36, 0.32),
                    p(0.36, 0.22),
                    p(0.5, 0.12),
                    p(0.64, 0.22),
                    p(0.64, 0.32),
                ]);
            }
            Icon::Wifi => {
                for (spread, radius) in [(0.55, 0.44), (0.8, 0.3)] {
                    let mut points = Vec::new();
                    for step in 0..=10 {
                        let angle = (std::f32::consts::PI * (1.0 - spread))
                            + step as f32 * (std::f32::consts::PI * (spread * 2.0 - 1.0) / 10.0);
                        points.push(Pos2::new(
                            center.x + angle.cos() * radius * rect.width(),
                            center.y + 0.22 * rect.height() + angle.sin() * radius * rect.width(),
                        ));
                    }
                    polyline(points);
                }
                dot(0.5, 0.8, 0.06);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{Context, Sense, Vec2};

    #[test]
    fn every_icon_draws_shapes() {
        let ctx = Context::default();
        for icon in ALL_ICONS {
            let output = ctx.run(egui::RawInput::default(), |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    let (rect, _) = ui.allocate_exact_size(Vec2::splat(24.0), Sense::hover());
                    icon.draw(ui.painter(), rect, Color32::BLACK, 1.5);
                });
            });
            assert!(!output.shapes.is_empty(), "{icon:?} drew no shapes");
        }
    }
}
