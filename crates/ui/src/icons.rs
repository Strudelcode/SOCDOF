//! Vector icons drawn by Rust.
//!
//! The legacy interface used `lucide-react`. The Rust UI cannot ship JavaScript, so every glyph is
//! drawn from line segments, circles and polygons here. Glyphs are defined in a normalized 0..1 box
//! and scaled by the caller, which keeps them crisp at any size and identical in both appearances.

use egui::{Color32, Painter, Pos2, Rect, Stroke, Vec2};

/// Paints the SOCDOF logo: dark squircle, four coloured corner arcs and the white "S".
///
/// The legacy app draws it as an inline SVG (`SocdofLogo.tsx`, 100 x 100 view box): a squircle with
/// a `#252932` to `#14171d` gradient, four rounded accent arcs on a 27 unit radius and a bold white
/// lettermark. The geometry here is that view box scaled to `rect`, so the taskbar start button and
/// any other surface show the same mark as the TypeScript edition.
pub fn draw_logo(painter: &Painter, rect: Rect) {
    let side = rect.width().min(rect.height());
    let box_rect = Rect::from_center_size(rect.center(), Vec2::splat(side));
    let squircle = box_rect.shrink(side * 0.05);
    crate::tokens::gradient_round_rect(
        painter,
        squircle,
        squircle.width() * 0.244,
        &[
            Color32::from_rgb(0x25, 0x29, 0x32),
            Color32::from_rgb(0x14, 0x17, 0x1d),
        ],
    );
    let radius = side * 0.27;
    let stroke = side * 0.055;
    let corners = [
        (
            Vec2::new(-0.18, -0.18),
            180.0_f32,
            Color32::from_rgb(0x22, 0xc5, 0x5e),
        ),
        (
            Vec2::new(0.18, -0.18),
            270.0,
            Color32::from_rgb(0x38, 0xbd, 0xf8),
        ),
        (
            Vec2::new(0.18, 0.18),
            0.0,
            Color32::from_rgb(0xef, 0x44, 0x44),
        ),
        (
            Vec2::new(-0.18, 0.18),
            90.0,
            Color32::from_rgb(0xf5, 0x9e, 0x0b),
        ),
    ];
    // The SVG draws each corner as a quarter arc with rounded caps; stamping a disc along the arc
    // keeps that look at any tile size without a path tessellator.
    for (offset, start, color) in corners {
        let center = box_rect.center() + offset * side;
        for step in 0..=12 {
            let angle = (start + 90.0 * step as f32 / 12.0).to_radians();
            painter.circle_filled(
                Pos2::new(
                    center.x + radius * angle.cos(),
                    center.y + radius * angle.sin(),
                ),
                stroke / 2.0,
                color,
            );
        }
    }
    painter.text(
        box_rect.center() + Vec2::new(0.0, side * 0.09),
        egui::Align2::CENTER_CENTER,
        "S",
        egui::FontId::new(side * 0.52, crate::theme::semibold()),
        Color32::WHITE,
    );
}

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
    /// Four-panel dashboard.
    Dashboard,
    /// Shipping box.
    Package,
    /// Pocket calculator.
    Calculator,
    /// Widget tiles.
    Widgets,
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
    /// Open book, the handbook module.
    BookOpen,
    /// Pencil over a baseline, the text editor module.
    PenLine,
    /// Shield outline, the user management module.
    Shield,
    /// Shopping bag, the point of sale module.
    Bag,
    /// Car silhouette, the fleet module.
    Car,
    /// Office building, company profile.
    Building,
    /// Payment card and chip.
    CreditCard,
    /// Language globe and meridians.
    Languages,
    /// Color palette with paint wells.
    Palette,
    /// Security key.
    Key,
    /// Database cylinder.
    Database,
    /// Multiple user accounts.
    Users,
    /// Download arrow.
    Download,
    /// Local storage drive.
    HardDrive,
    /// Keyboard keycaps.
    Keyboard,
    /// Desktop monitor with stand.
    Monitor,
    /// Document page with folded corner and text lines.
    FileText,
    /// Backspace key with the delete cross, calculator pad.
    Backspace,
    /// Clock with a backwards arrow, calculation history.
    History,
    /// Speaker with sound waves, sound enabled.
    Speaker,
    /// Speaker with a cross, sound muted.
    SpeakerOff,
    /// Wrench, maintenance and tools.
    Wrench,
    /// Two stacked sheets, copy to clipboard.
    Copy,
    /// Clock face, time and history cards.
    Clock,
    /// Lightning bolt, quick actions.
    Zap,
    /// Note sheet with a folded corner, sticky notes.
    StickyNote,
    /// Rising line with an arrow, revenue KPI.
    TrendingUp,
}

/// Every icon of the set, used by the gallery and the tests.
pub const ALL_ICONS: [Icon; 59] = [
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
    Icon::BookOpen,
    Icon::PenLine,
    Icon::Shield,
    Icon::Bag,
    Icon::Car,
    Icon::Building,
    Icon::CreditCard,
    Icon::Languages,
    Icon::Palette,
    Icon::Key,
    Icon::Database,
    Icon::Users,
    Icon::Download,
    Icon::HardDrive,
    Icon::Keyboard,
    Icon::Monitor,
    Icon::FileText,
    Icon::Backspace,
    Icon::History,
    Icon::Speaker,
    Icon::SpeakerOff,
    Icon::Wrench,
    Icon::Copy,
    Icon::Clock,
    Icon::Zap,
    Icon::StickyNote,
    Icon::TrendingUp,
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
            // lucide `settings`: an eight tooth cog whose teeth are part of the outline, with a
            // hollow hub in the middle (`DesktopWindowWorkspace.tsx:1969`).
            Icon::Settings => {
                // The reference cog has eight square-ish teeth: the contour follows a cosine and
                // clamps it, so the tooth crests and the valleys stay flat like the inline SVG.
                let mut outline = Vec::with_capacity(97);
                for step in 0..97 {
                    let angle = step as f32 * std::f32::consts::TAU / 96.0;
                    let lobe = ((8.0 * angle).cos() * 2.1).clamp(-1.0, 1.0);
                    let reach = radius * (0.66 + 0.27 * (lobe + 1.0) * 0.5);
                    outline.push(Pos2::new(
                        center.x + angle.cos() * reach,
                        center.y + angle.sin() * reach,
                    ));
                }
                painter.add(egui::Shape::closed_line(outline, stroke));
                painter.circle_stroke(center, radius * 0.16, stroke);
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
            // The legacy dashboard icon is lucide `boxes`
            // (`DesktopWindowWorkspace.tsx:1960`): one cube on top between two cubes below, each
            // with a lid diamond and a seam down the middle. The view box geometry of the SVG is
            // `M7.97 4.42 … 12 13.5 … 17 10.5` for the top cube and the mirrored pair below.
            Icon::Dashboard => {
                let cube = |x0: f32, y0: f32, x1: f32, y1: f32| {
                    let (cx, height) = ((x0 + x1) * 0.5, y1 - y0);
                    let lid = y0 + height * 0.335;
                    let corner = y0 + height * 0.72;
                    let inner = y0 + height * 0.5;
                    let inset = (x1 - x0) * 0.025;
                    polygon(vec![
                        p(x0, lid),
                        p(cx, y0),
                        p(x1, lid),
                        p(x1, corner),
                        p(cx, y1),
                        p(x0, corner),
                    ]);
                    polyline(vec![p(x0 + inset, y0 + height * 0.25), p(cx, inner)]);
                    polyline(vec![p(x1 - inset, y0 + height * 0.25), p(cx, inner)]);
                    polyline(vec![p(cx, inner), p(cx, y1)]);
                };
                cube(0.292, 0.10, 0.708, 0.5625);
                cube(0.083, 0.4375, 0.5, 0.917);
                cube(0.5, 0.4375, 0.917, 0.917);
            }
            // lucide `package`: the shipping box of the App Store tile, including the tape seam
            // across the left face (`m7.5 4.27 9 5.15`).
            Icon::Package => {
                polygon(vec![
                    p(0.5, 0.09),
                    p(0.885, 0.315),
                    p(0.885, 0.685),
                    p(0.5, 0.91),
                    p(0.115, 0.685),
                    p(0.115, 0.315),
                ]);
                painter.line_segment([p(0.1375, 0.292), p(0.5, 0.5)], stroke);
                painter.line_segment([p(0.8625, 0.292), p(0.5, 0.5)], stroke);
                painter.line_segment([p(0.5, 0.5), p(0.5, 0.91)], stroke);
                painter.line_segment([p(0.3125, 0.178), p(0.6875, 0.393)], stroke);
            }
            // lucide `calculator`: 16 x 20 body with a display bar, eight keys and the tall key.
            Icon::Calculator => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.167, 0.083), p(0.833, 0.917)),
                    egui::Rounding::same(rect.width() * 0.083),
                    stroke,
                );
                painter.line_segment([p(0.333, 0.25), p(0.667, 0.25)], stroke);
                for (x, y) in [
                    (0.333, 0.417),
                    (0.5, 0.417),
                    (0.667, 0.417),
                    (0.333, 0.583),
                    (0.5, 0.583),
                    (0.333, 0.75),
                    (0.5, 0.75),
                    (0.667, 0.75),
                ] {
                    dot(x, y, width / rect.width() * 0.5);
                }
                painter.line_segment([p(0.667, 0.583), p(0.667, 0.75)], stroke);
            }
            // The legacy widgets glyph is three outlined tiles with an outlined circle in the
            // fourth slot (`WidgetsIcon.tsx`: rects of 7 units at `3,3`, `14,3`, `3,14` and a
            // circle at `17.5,17.5` with radius 3.5).
            Icon::Widgets => {
                let cell = 7.0 / 24.0;
                for (x, y) in [(3.0, 3.0), (14.0, 3.0), (3.0, 14.0)] {
                    painter.rect_stroke(
                        Rect::from_min_max(
                            p(x / 24.0, y / 24.0),
                            p(x / 24.0 + cell, y / 24.0 + cell),
                        ),
                        egui::Rounding::same(rect.width() * 1.5 / 24.0),
                        stroke,
                    );
                }
                painter.circle_stroke(
                    p(17.5 / 24.0, 17.5 / 24.0),
                    rect.width() * 3.5 / 24.0,
                    stroke,
                );
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
            Icon::Car => {
                polyline(vec![
                    p(0.1, 0.62),
                    p(0.2, 0.43),
                    p(0.3, 0.25),
                    p(0.7, 0.25),
                    p(0.82, 0.43),
                    p(0.92, 0.62),
                    p(0.92, 0.78),
                    p(0.08, 0.78),
                    p(0.1, 0.62),
                ]);
                polyline(vec![
                    p(0.3, 0.27),
                    p(0.27, 0.58),
                    p(0.73, 0.58),
                    p(0.7, 0.27),
                ]);
                painter.circle_stroke(p(0.27, 0.78), rect.width() * 0.09, stroke);
                painter.circle_stroke(p(0.73, 0.78), rect.width() * 0.09, stroke);
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
            Icon::Building => {
                polygon(vec![
                    p(0.16, 0.86),
                    p(0.16, 0.34),
                    p(0.5, 0.14),
                    p(0.84, 0.34),
                    p(0.84, 0.86),
                ]);
                for (x, y) in [(0.34, 0.42), (0.66, 0.42), (0.34, 0.62), (0.66, 0.62)] {
                    painter.rect_stroke(
                        Rect::from_center_size(p(x, y), Vec2::splat(rect.width() * 0.12)),
                        egui::Rounding::same(1.0),
                        stroke,
                    );
                }
                polyline(vec![
                    p(0.44, 0.86),
                    p(0.44, 0.68),
                    p(0.56, 0.68),
                    p(0.56, 0.86),
                ]);
            }
            Icon::CreditCard => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.1, 0.22), p(0.9, 0.78)),
                    egui::Rounding::same(rect.width() * 0.08),
                    stroke,
                );
                polyline(vec![p(0.1, 0.42), p(0.9, 0.42)]);
                polyline(vec![p(0.22, 0.62), p(0.46, 0.62)]);
            }
            Icon::Languages => {
                painter.circle_stroke(p(0.5, 0.5), rect.width() * 0.38, stroke);
                polyline(vec![p(0.12, 0.5), p(0.88, 0.5)]);
                polyline(vec![
                    p(0.5, 0.12),
                    p(0.38, 0.32),
                    p(0.34, 0.5),
                    p(0.38, 0.68),
                    p(0.5, 0.88),
                ]);
                polyline(vec![
                    p(0.5, 0.12),
                    p(0.62, 0.32),
                    p(0.66, 0.5),
                    p(0.62, 0.68),
                    p(0.5, 0.88),
                ]);
            }
            Icon::Palette => {
                painter.circle_stroke(p(0.5, 0.5), rect.width() * 0.38, stroke);
                dot(0.34, 0.34, 0.045);
                dot(0.58, 0.28, 0.045);
                dot(0.72, 0.48, 0.045);
                dot(0.42, 0.68, 0.045);
            }
            Icon::Key => {
                painter.circle_stroke(p(0.32, 0.42), rect.width() * 0.2, stroke);
                polyline(vec![p(0.48, 0.56), p(0.84, 0.86)]);
                polyline(vec![p(0.68, 0.7), p(0.78, 0.6)]);
                polyline(vec![p(0.76, 0.78), p(0.86, 0.68)]);
            }
            Icon::Database => {
                painter.circle_stroke(p(0.5, 0.24), rect.width() * 0.34, stroke);
                polyline(vec![p(0.16, 0.24), p(0.16, 0.72)]);
                polyline(vec![p(0.84, 0.24), p(0.84, 0.72)]);
                polyline(vec![
                    p(0.16, 0.48),
                    p(0.24, 0.56),
                    p(0.5, 0.6),
                    p(0.76, 0.56),
                    p(0.84, 0.48),
                ]);
                polyline(vec![
                    p(0.16, 0.72),
                    p(0.24, 0.8),
                    p(0.5, 0.84),
                    p(0.76, 0.8),
                    p(0.84, 0.72),
                ]);
            }
            // lucide `users`: a large person on the left, a smaller one cut off on the right.
            // Both bodies are 4 unit corner arcs (`M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2`).
            Icon::Users => {
                let arc = |cx: f32, cy: f32, r: f32, from: f32, to: f32, points: usize| {
                    (0..=points)
                        .map(|step| {
                            let angle = from + (to - from) * step as f32 / points as f32;
                            p(cx + angle.cos() * r, cy + angle.sin() * r)
                        })
                        .collect::<Vec<_>>()
                };
                let quarter = std::f32::consts::FRAC_PI_2;
                painter.circle_stroke(p(0.375, 0.292), rect.width() * 0.167, stroke);
                polyline(vec![p(0.667, 0.875), p(0.667, 0.792)]);
                let mut body = arc(0.5, 0.792, 0.167, 0.0, -quarter, 6);
                body.push(p(0.25, 0.625));
                body.extend(arc(0.25, 0.792, 0.167, -quarter, -quarter * 2.0, 6));
                body.push(p(0.083, 0.875));
                polyline(body);
                // The second person of the reference path `M16 3.13a4 4 0 0 1 0 7.75` is a
                // four unit arc around `(19, 7)`, so its centre sits at 0.792, not at the middle.
                polyline(arc(
                    0.792,
                    0.292,
                    0.167,
                    quarter * 1.42,
                    -quarter * 1.42,
                    14,
                ));
                polyline(vec![p(0.917, 0.875), p(0.917, 0.792)]);
                // `M22 21v-2a4 4 0 0 0-3-3.87`: a four unit shoulder arc around `(18, 19)` that
                // reaches the vertical stub exactly.
                polyline(arc(0.75, 0.792, 0.167, 0.0, -1.825, 12));
            }
            // lucide `book-open`: two pages meeting at a spine, the handbook shortcut.
            Icon::BookOpen => {
                polyline(vec![p(0.5, 0.292), p(0.5, 0.875)]);
                polyline(vec![
                    p(0.083, 0.75),
                    p(0.083, 0.125),
                    p(0.292, 0.125),
                    p(0.37, 0.14),
                    p(0.44, 0.2),
                    p(0.5, 0.292),
                    p(0.56, 0.2),
                    p(0.63, 0.14),
                    p(0.708, 0.125),
                    p(0.917, 0.125),
                    p(0.917, 0.75),
                    p(0.708, 0.75),
                    p(0.63, 0.78),
                    p(0.56, 0.84),
                    p(0.5, 0.875),
                    p(0.44, 0.84),
                    p(0.37, 0.78),
                    p(0.292, 0.75),
                    p(0.083, 0.75),
                ]);
            }
            // lucide `pen-line`: the text editor tile.
            Icon::PenLine => {
                polygon(vec![
                    p(0.167, 0.833),
                    p(0.222, 0.615),
                    p(0.723, 0.115),
                    p(0.885, 0.278),
                    p(0.385, 0.778),
                ]);
                polyline(vec![p(0.5, 0.875), p(0.875, 0.875)]);
            }
            Icon::Download => {
                polyline(vec![p(0.5, 0.12), p(0.5, 0.66)]);
                polyline(vec![p(0.28, 0.46), p(0.5, 0.68), p(0.72, 0.46)]);
                polyline(vec![
                    p(0.16, 0.74),
                    p(0.16, 0.88),
                    p(0.84, 0.88),
                    p(0.84, 0.74),
                ]);
            }
            Icon::HardDrive => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.12, 0.22), p(0.88, 0.78)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                polyline(vec![p(0.12, 0.62), p(0.88, 0.62)]);
                dot(0.72, 0.43, 0.035);
                dot(0.82, 0.43, 0.035);
            }
            Icon::Keyboard => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.08, 0.24), p(0.92, 0.76)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                for y in [0.4, 0.56] {
                    for x in [0.22, 0.38, 0.54, 0.7, 0.84] {
                        dot(x, y, 0.025);
                    }
                }
                polyline(vec![p(0.3, 0.66), p(0.7, 0.66)]);
            }
            Icon::Monitor => {
                painter.rect_stroke(
                    Rect::from_min_max(p(0.1, 0.14), p(0.9, 0.68)),
                    egui::Rounding::same(rect.width() * 0.06),
                    stroke,
                );
                polyline(vec![p(0.5, 0.68), p(0.5, 0.84)]);
                polyline(vec![p(0.3, 0.86), p(0.7, 0.86)]);
            }
            // lucide `trending-up`: the rising line with its head.
            Icon::TrendingUp => {
                polyline(vec![
                    p(0.12, 0.74),
                    p(0.4, 0.44),
                    p(0.58, 0.62),
                    p(0.88, 0.26),
                ]);
                polyline(vec![p(0.68, 0.26), p(0.88, 0.26), p(0.88, 0.46)]);
            }
            // lucide `clock`: the face and the two hands.
            Icon::Clock => {
                painter.circle_stroke(center, radius * 0.78, stroke);
                polyline(vec![p(0.5, 0.26), p(0.5, 0.5), p(0.68, 0.62)]);
            }
            // lucide `zap`: the lightning bolt.
            Icon::Zap => polygon(vec![
                p(0.58, 0.1),
                p(0.24, 0.56),
                p(0.46, 0.56),
                p(0.4, 0.9),
                p(0.76, 0.44),
                p(0.54, 0.44),
            ]),
            // lucide `sticky-note`: a sheet with the folded lower right corner.
            Icon::StickyNote => {
                polygon(vec![
                    p(0.2, 0.16),
                    p(0.8, 0.16),
                    p(0.8, 0.58),
                    p(0.58, 0.8),
                    p(0.2, 0.8),
                ]);
                polyline(vec![p(0.8, 0.58), p(0.58, 0.58), p(0.58, 0.8)]);
            }
            // lucide `copy`: two rounded sheets.
            Icon::Copy => {
                let sheet = |left: f32, top: f32, right: f32, bottom: f32, r: f32| {
                    let r = r.min((right - left) * 0.5).min((bottom - top) * 0.5);
                    vec![
                        p(left + r, top),
                        p(right - r, top),
                        p(right, top + r),
                        p(right, bottom - r),
                        p(right - r, bottom),
                        p(left + r, bottom),
                        p(left, bottom - r),
                        p(left, top + r),
                    ]
                };
                polygon(sheet(0.36, 0.12, 0.88, 0.64, 0.1));
                polygon(sheet(0.12, 0.36, 0.64, 0.88, 0.1));
            }
            // lucide `delete`: the backspace key of the calculator pad.
            Icon::Backspace => {
                polygon(vec![
                    p(0.34, 0.2),
                    p(0.86, 0.2),
                    p(0.86, 0.8),
                    p(0.34, 0.8),
                    p(0.12, 0.5),
                ]);
                polyline(vec![p(0.48, 0.38), p(0.7, 0.62)]);
                polyline(vec![p(0.7, 0.38), p(0.48, 0.62)]);
            }
            // lucide `history`: a clock with a counter clockwise arrow.
            Icon::History => {
                let mut arc = Vec::new();
                for step in 0..=20 {
                    let angle = -0.5 + step as f32 * (std::f32::consts::TAU * 0.85 / 20.0);
                    arc.push(Pos2::new(
                        center.x + angle.cos() * radius * 0.34,
                        center.y + angle.sin() * radius * 0.34,
                    ));
                }
                polyline(arc);
                polyline(vec![p(0.2, 0.22), p(0.2, 0.44), p(0.42, 0.44)]);
                polyline(vec![p(0.5, 0.34), p(0.5, 0.52), p(0.64, 0.6)]);
            }
            // lucide `volume-2`: speaker plus two sound waves.
            Icon::Speaker => {
                polygon(vec![
                    p(0.12, 0.4),
                    p(0.3, 0.4),
                    p(0.52, 0.22),
                    p(0.52, 0.78),
                    p(0.3, 0.6),
                    p(0.12, 0.6),
                ]);
                let mut inner = Vec::new();
                for step in 0..=8 {
                    let angle = -0.75 + step as f32 * 1.5 / 8.0;
                    inner.push(Pos2::new(
                        center.x + 0.28 * rect.width() + angle.cos() * radius * 0.24,
                        center.y + angle.sin() * radius * 0.24,
                    ));
                }
                polyline(inner);
                let mut outer = Vec::new();
                for step in 0..=8 {
                    let angle = -0.75 + step as f32 * 1.5 / 8.0;
                    outer.push(Pos2::new(
                        center.x + 0.28 * rect.width() + angle.cos() * radius * 0.44,
                        center.y + angle.sin() * radius * 0.44,
                    ));
                }
                polyline(outer);
            }
            // lucide `volume-x`: the muted speaker.
            Icon::SpeakerOff => {
                polygon(vec![
                    p(0.12, 0.4),
                    p(0.3, 0.4),
                    p(0.52, 0.22),
                    p(0.52, 0.78),
                    p(0.3, 0.6),
                    p(0.12, 0.6),
                ]);
                polyline(vec![p(0.66, 0.38), p(0.86, 0.62)]);
                polyline(vec![p(0.86, 0.38), p(0.66, 0.62)]);
            }
            // lucide `wrench`: the Studio and maintenance control.
            Icon::Wrench => {
                polyline(vec![
                    p(0.62, 0.16),
                    p(0.78, 0.32),
                    p(0.62, 0.48),
                    p(0.46, 0.32),
                ]);
                polyline(vec![
                    p(0.72, 0.42),
                    p(0.34, 0.8),
                    p(0.2, 0.66),
                    p(0.58, 0.28),
                ]);
            }
            Icon::FileText => {
                polyline(vec![
                    p(0.24, 0.12),
                    p(0.62, 0.12),
                    p(0.78, 0.28),
                    p(0.78, 0.88),
                    p(0.24, 0.88),
                    p(0.24, 0.12),
                ]);
                polyline(vec![p(0.62, 0.12), p(0.62, 0.3), p(0.78, 0.3)]);
                for y in [0.48, 0.62, 0.76] {
                    polyline(vec![p(0.36, y), p(0.66, y)]);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{Sense, Vec2};

    #[test]
    fn every_icon_draws_shapes() {
        let ctx = crate::theme::headless_context();
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
