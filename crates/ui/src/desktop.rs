//! Desktop shell and window manager.
//!
//! Phase 5 starts with the window manager. The model keeps no egui state, so move, resize, snap,
//! maximize, minimize, z-order, the close cooldown and the focus trap are plain data and tested
//! without a display. [`desktop`] draws that model: the bundled wallpaper, the widgets layer, the
//! icon grid with drag and drop, floating windows with their chrome, the taskbar with start menu and
//! tray button, and the shell overlays (start menu, command palette, tray flyout, onboarding).
//!
//! Windows are never drawn with egui's own window widget. Each one is an [`egui::Area`] painted
//! from the design tokens, which keeps the chrome identical in both appearances and keyboard
//! reachable through the same [`FocusState`] as every other control.

use egui::{
    Align2, Color32, ColorImage, Context, FontId, Id, Key, Pos2, Rect, RichText, Rounding, Sense,
    Stroke, TextureHandle, TextureOptions, Ui, Vec2, WidgetInfo, WidgetType,
};
use socdof_core::store::Store as SocdofStore;

use crate::components::{button, modal, ButtonVariant};
use crate::focus::{focus_ring, FocusState};
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::shell::{
    command_palette, onboarding, start_menu, tray_flyout, AccountEntry, ShellAction, ShellState,
    StartMenuChoice,
};
use crate::theme::Theme;
use crate::tokens::{
    with_alpha, FONT_BODY, FONT_SMALL, RADIUS_CARD, RADIUS_CONTROL, RADIUS_DIALOG,
};
use crate::wallpaper::paint as paint_wallpaper;

type DesktopWindowRenderer<'a> = dyn FnMut(
        AppId,
        bool,
        &mut Ui,
        &Context,
        &Theme,
        &UiTexts,
        &mut FocusState,
        &SocdofStore,
        i64,
    ) -> bool
    + 'a;

/// Height of the taskbar at the bottom of the screen.
pub const TASKBAR_HEIGHT: f32 = 48.0;
/// Height of a window title bar, matching the legacy window chrome.
pub const TITLE_BAR_HEIGHT: f32 = 40.0;

/// Content offset below the title bar of the windows matched against the reference. The
/// measured reference chrome is 40 pt tall; the calculator and the widgets workspace start
/// 20 pt below it, the editor ribbon starts 12 pt below it. Every other window keeps the
/// shared 12 pt offset.
const COMPACT_CONTENT_OFFSET: f32 = 20.0;
const EDITOR_CONTENT_OFFSET: f32 = 12.0;
const CONTENT_OFFSET: f32 = 12.0;

/// Whether a window uses the measured reference content origin and badge.
pub fn compact_chrome(app: &str) -> bool {
    matches!(app, "calculator" | "widgets" | "editor")
}

/// Content offset below the title bar, scoped by app.
pub fn content_offset(app: &str) -> f32 {
    match app {
        "editor" => EDITOR_CONTENT_OFFSET,
        _ if compact_chrome(app) => COMPACT_CONTENT_OFFSET,
        _ => CONTENT_OFFSET,
    }
}

/// Accent tile of the compact windows, mirroring the module badges of the reference.
fn compact_badge(app: &str) -> Option<(Icon, Color32)> {
    match app {
        "calculator" => Some((Icon::Calculator, Color32::from_rgb(0x05, 0x96, 0x69))),
        "widgets" => Some((Icon::Widgets, Color32::from_rgb(0x7c, 0x3a, 0xed))),
        "editor" => Some((Icon::PenLine, Color32::from_rgb(0x4f, 0x46, 0xe5))),
        _ => None,
    }
}
/// Smallest width a window can be resized to.
pub const WINDOW_MIN_WIDTH: f32 = 320.0;
/// Smallest height a window can be resized to.
pub const WINDOW_MIN_HEIGHT: f32 = 220.0;
/// Edge length of the resize grip in the bottom right corner of a window.
pub const RESIZE_GRIP: f32 = 16.0;
/// How long reopening an app after closing it needs a confirmation.
pub const CLOSE_COOLDOWN_MS: i64 = 3_000;
/// Size of one icon cell: a 48 pixel tile plus its wrapped label (`w-24 min-h-[96px]`).
pub const ICON_CELL: Vec2 = Vec2::new(96.0, 108.0);
/// Horizontal distance between two icon columns, from the legacy desktop grid.
pub const ICON_STEP_X: f32 = 104.0;
/// Vertical distance between two icon rows, from the legacy desktop grid.
pub const ICON_STEP_Y: f32 = 116.0;
/// Icons per column before the grid continues in the next column, like Windows.
pub const ICON_ROWS: u32 = 6;
/// Edge length of an app tile on the desktop (`w-12 h-12`).
pub const ICON_TILE: f32 = 48.0;
/// Edge length of the glyph inside a desktop tile (`w-6 h-6`).
pub const ICON_GLYPH: f32 = 24.0;
/// Wrap width of the icon captions.
///
/// The legacy caption is `text-xs font-semibold ... max-w-[90px]`
/// (`DesktopWindowWorkspace.tsx:2914`), so "Taschenrechner" breaks into two lines while shorter
/// names stay on one.
pub const ICON_LABEL_WIDTH: f32 = 86.0;
/// Distance between the desktop edge and the first icon cell.
pub const DESKTOP_MARGIN: f32 = 24.0;
/// Height of the desktop window control bar in the top right corner (`h-8`).
pub const DESKTOP_CONTROL_HEIGHT: f32 = 32.0;
/// Width of one desktop window control (`w-10`).
pub const DESKTOP_CONTROL_WIDTH: f32 = 40.0;
/// Taskbar width from which the search pill is shown.
pub const TASKBAR_SEARCH_MIN_WIDTH: f32 = 640.0;
/// Module buttons the legacy taskbar shows next to the start button on narrow screens; the rest
/// moves behind the overflow button so the bar keeps the reference silhouette.
pub const TASKBAR_COMPACT_APPS: usize = 4;
/// Taskbar width from which the version pill is shown.
pub const TASKBAR_STATUS_MIN_WIDTH: f32 = 700.0;

/// Stable app identifier shared by desktop icons, windows and taskbar entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct AppId(&'static str);

impl AppId {
    /// Creates an id from a stable slug such as `contacts`.
    pub const fn new(slug: &'static str) -> Self {
        Self(slug)
    }

    /// Slug of the app, used for widget ids and persistence keys.
    pub const fn as_str(self) -> &'static str {
        self.0
    }
}

/// Result of asking the window manager to open an app.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenOutcome {
    /// The window is open and has the focus.
    Opened,
    /// The app was closed moments ago, so the caller has to ask before reopening it.
    ConfirmReopen {
        /// Milliseconds left in the close cooldown.
        remaining_ms: i64,
    },
}

/// Screen edge a window snaps to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapEdge {
    /// Left half of the work area.
    Left,
    /// Right half of the work area.
    Right,
}

/// One open window of the window manager.
#[derive(Debug, Clone, PartialEq)]
pub struct Window {
    app: AppId,
    title: String,
    rect: Rect,
    restore_rect: Option<Rect>,
    minimized: bool,
}

impl Window {
    /// Creates a window with its app id, translated title and initial rectangle.
    pub fn new(app: AppId, title: impl Into<String>, rect: Rect) -> Self {
        Self {
            app,
            title: title.into(),
            rect,
            restore_rect: None,
            minimized: false,
        }
    }

    /// App that owns the window.
    pub fn app(&self) -> AppId {
        self.app
    }

    /// Translated window title.
    pub fn title(&self) -> &str {
        &self.title
    }

    /// Current outer rectangle in screen coordinates.
    pub fn rect(&self) -> Rect {
        self.rect
    }

    /// Rectangle used when restoring a maximized window.
    pub fn normal_rect(&self) -> Rect {
        self.restore_rect.unwrap_or(self.rect)
    }

    /// Whether the window is currently minimized.
    pub fn is_minimized(&self) -> bool {
        self.minimized
    }

    /// Whether the window fills the work area and remembers a restore rectangle.
    pub fn is_maximized(&self) -> bool {
        self.restore_rect.is_some()
    }
}

/// Z-order, focus and window state of the desktop.
#[derive(Debug, Clone, Default)]
pub struct WindowManager {
    windows: Vec<Window>,
    active: Option<AppId>,
    pending_close: Option<AppId>,
    pending_open: Option<Window>,
    last_closed: Option<(AppId, i64)>,
}

impl WindowManager {
    /// Builds an empty window manager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Windows from back to front; the last one is drawn on top.
    pub fn windows(&self) -> &[Window] {
        &self.windows
    }

    /// The window of an app, if it is open.
    pub fn window(&self, app: AppId) -> Option<&Window> {
        self.windows.iter().find(|window| window.app == app)
    }

    /// App whose window has the focus.
    pub fn active(&self) -> Option<AppId> {
        self.active
    }

    /// Whether an app has an open window.
    pub fn is_open(&self, app: AppId) -> bool {
        self.window(app).is_some()
    }

    /// Whether a confirmation dialog currently traps the focus.
    pub fn dialog_open(&self) -> bool {
        self.pending_close.is_some() || self.pending_open.is_some()
    }

    /// App waiting for a close confirmation.
    pub fn pending_close(&self) -> Option<AppId> {
        self.pending_close
    }

    /// App waiting for a reopen confirmation.
    pub fn pending_open(&self) -> Option<AppId> {
        self.pending_open.as_ref().map(|window| window.app)
    }

    /// Title of the window waiting for a reopen confirmation.
    pub fn pending_open_title(&self) -> Option<&str> {
        self.pending_open
            .as_ref()
            .map(|window| window.title.as_str())
    }

    /// Whether an app can be opened without a confirmation at `now`.
    pub fn can_reopen(&self, app: AppId, now: i64) -> bool {
        match self.last_closed {
            Some((closed, at)) if closed == app => now.saturating_sub(at) >= CLOSE_COOLDOWN_MS,
            _ => true,
        }
    }

    /// Opens a window, raises an existing one, or asks before reopening a just closed app.
    pub fn open(&mut self, window: Window, now: i64) -> OpenOutcome {
        let app = window.app;
        if let Some(index) = self.windows.iter().position(|open| open.app == app) {
            let mut raised = self.windows.remove(index);
            raised.minimized = false;
            self.windows.push(raised);
            self.active = Some(app);
            return OpenOutcome::Opened;
        }
        if !self.can_reopen(app, now) {
            let remaining_ms = self
                .last_closed
                .map(|(_, at)| (CLOSE_COOLDOWN_MS - now.saturating_sub(at)).max(0))
                .unwrap_or(0);
            self.pending_open = Some(window);
            return OpenOutcome::ConfirmReopen { remaining_ms };
        }
        self.windows.push(window);
        self.active = Some(app);
        OpenOutcome::Opened
    }

    /// Confirms the reopen prompt and opens the window despite the cooldown.
    pub fn confirm_open(&mut self) -> bool {
        match self.pending_open.take() {
            Some(window) => {
                let app = window.app;
                self.windows.push(window);
                self.active = Some(app);
                self.last_closed = None;
                true
            }
            None => false,
        }
    }

    /// Drops the reopen prompt without opening anything.
    pub fn cancel_open(&mut self) {
        self.pending_open = None;
    }

    /// Raises a window and gives it the focus; refused while a dialog traps the focus.
    pub fn focus(&mut self, app: AppId) -> bool {
        if self.dialog_open() {
            return false;
        }
        let Some(index) = self.windows.iter().position(|window| window.app == app) else {
            return false;
        };
        let mut window = self.windows.remove(index);
        window.minimized = false;
        self.windows.push(window);
        self.active = Some(app);
        true
    }

    /// Cycles focus to the next visible window, skipping minimized windows.
    ///
    /// The current topmost window is focused after wrapping around the z-order.
    pub fn focus_next(&mut self) -> Option<AppId> {
        if self.dialog_open() {
            return None;
        }
        let visible: Vec<AppId> = self
            .windows
            .iter()
            .filter(|window| !window.minimized)
            .map(|window| window.app)
            .collect();
        if visible.is_empty() {
            self.active = None;
            return None;
        }
        let next = self
            .active
            .and_then(|active| visible.iter().position(|app| *app == active))
            .map(|index| (index + 1) % visible.len())
            .unwrap_or(0);
        let app = visible[next];
        self.focus(app);
        Some(app)
    }

    /// Asks for a confirmation before closing a window.
    pub fn request_close(&mut self, app: AppId) -> bool {
        if !self.is_open(app) {
            return false;
        }
        self.pending_close = Some(app);
        true
    }

    /// Drops the close prompt and keeps the window open.
    pub fn cancel_close(&mut self) {
        self.pending_close = None;
    }

    /// Confirms the close prompt, closes the window and starts its cooldown.
    pub fn confirm_close(&mut self, now: i64) -> Option<AppId> {
        let app = self.pending_close.take()?;
        self.close(app, now);
        Some(app)
    }

    /// Closes a window immediately and remembers when it happened.
    pub fn close(&mut self, app: AppId, now: i64) -> bool {
        let Some(index) = self.windows.iter().position(|window| window.app == app) else {
            return false;
        };
        self.windows.remove(index);
        self.last_closed = Some((app, now));
        if self.active == Some(app) {
            self.active = self.topmost_visible();
        }
        true
    }

    /// Hides a window and hands the focus to the next visible one.
    pub fn minimize(&mut self, app: AppId) -> bool {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return false;
        };
        window.minimized = true;
        if self.active == Some(app) {
            self.active = self.topmost_visible();
        }
        true
    }

    /// Restores a minimized window and raises it.
    pub fn restore(&mut self, app: AppId) -> bool {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return false;
        };
        window.minimized = false;
        let app = window.app;
        self.focus(app)
    }

    /// Maximizes a window to the work area or restores its previous rectangle.
    pub fn toggle_maximize(&mut self, app: AppId, work_area: Rect) {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return;
        };
        match window.restore_rect.take() {
            Some(rect) => window.rect = rect,
            None => {
                window.restore_rect = Some(window.rect);
                window.rect = work_area;
            }
        }
    }

    /// Snaps a window to the left or right half of the work area.
    pub fn snap(&mut self, app: AppId, edge: SnapEdge, work_area: Rect) {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return;
        };
        let half = work_area.width() / 2.0;
        window.restore_rect = None;
        window.rect = match edge {
            SnapEdge::Left => {
                Rect::from_min_size(work_area.min, Vec2::new(half, work_area.height()))
            }
            SnapEdge::Right => Rect::from_min_size(
                Pos2::new(work_area.center().x, work_area.min.y),
                Vec2::new(half, work_area.height()),
            ),
        };
    }

    /// Moves a window, keeping it inside the work area.
    pub fn move_by(&mut self, app: AppId, delta: Vec2, work_area: Rect) {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return;
        };
        window.rect = clamp_rect(window.rect.translate(delta), work_area);
    }

    /// Resizes a window from its bottom right corner, respecting the minimum size.
    pub fn resize_by(&mut self, app: AppId, delta: Vec2, work_area: Rect) {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return;
        };
        if window.is_maximized() {
            return;
        }
        let size = Vec2::new(
            (window.rect.width() + delta.x).clamp(WINDOW_MIN_WIDTH, work_area.width()),
            (window.rect.height() + delta.y).clamp(WINDOW_MIN_HEIGHT, work_area.height()),
        );
        window.rect = clamp_rect(Rect::from_min_size(window.rect.min, size), work_area);
    }

    /// Restores a previously saved normal rectangle and maximize state.
    ///
    /// Coordinates are clamped to the current work area so a window saved on a larger or
    /// differently positioned monitor remains reachable after a display change.
    pub fn restore_geometry(
        &mut self,
        app: AppId,
        normal_rect: Rect,
        maximized: bool,
        work_area: Rect,
    ) {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return;
        };
        let rect = clamp_rect(normal_rect, work_area);
        if maximized {
            window.restore_rect = Some(rect);
            window.rect = work_area;
        } else {
            window.restore_rect = None;
            window.rect = rect;
        }
    }

    /// Updates translated titles after a language switch.
    pub fn relabel_titles(&mut self, label: impl Fn(AppId) -> String) {
        for window in &mut self.windows {
            window.title = label(window.app);
        }
        if let Some(pending) = &mut self.pending_open {
            pending.title = label(pending.app);
        }
    }

    fn topmost_visible(&self) -> Option<AppId> {
        self.windows
            .iter()
            .rev()
            .find(|window| !window.minimized)
            .map(|window| window.app)
    }
}

/// One app icon on the desktop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopIcon {
    app: AppId,
    label: String,
    icon: Icon,
    cell: (u32, u32),
    pos: Option<Pos2>,
}

impl DesktopIcon {
    /// Creates an icon; [`IconGrid::new`] assigns its cell in reading order.
    pub fn new(app: AppId, label: impl Into<String>, icon: Icon) -> Self {
        Self {
            app,
            label: label.into(),
            icon,
            cell: (0, 0),
            pos: None,
        }
    }

    /// Places the icon on a specific grid cell.
    pub fn at(mut self, cell: (u32, u32)) -> Self {
        self.cell = cell;
        self.pos = None;
        self
    }

    /// Free position on the desktop, if the icon was dragged away from the grid.
    pub fn pos(&self) -> Option<Pos2> {
        self.pos
    }

    /// Moves the icon to an absolute desktop position.
    pub fn place(&mut self, min: Pos2) {
        self.pos = Some(min);
    }

    /// App of the icon.
    pub fn app(&self) -> AppId {
        self.app
    }

    /// Translated icon label.
    pub fn label(&self) -> &str {
        &self.label
    }

    /// Glyph of the icon.
    pub fn icon(&self) -> Icon {
        self.icon
    }

    /// Grid cell, column then row.
    pub fn cell(&self) -> (u32, u32) {
        self.cell
    }
}

/// Cell assignment, selection and drag and drop state of the desktop icons.
#[derive(Debug, Clone, Default)]
pub struct IconGrid {
    icons: Vec<DesktopIcon>,
    selected: usize,
}

/// Breakpoint below which the desktop switches to the compact icon grid (`grid-cols-3`).
pub const COMPACT_DESKTOP_WIDTH: f32 = 640.0;
/// Columns of the compact grid.
pub const COMPACT_COLUMNS: u32 = 3;
/// Row pitch of the compact grid (`const offsetY = 16 + row * 114`, `DesktopWindowWorkspace.tsx:893`).
pub const COMPACT_STEP_Y: f32 = 114.0;
/// Top inset of the first compact row, measured to the icon button (`offsetY` starts at 16).
pub const COMPACT_ORIGIN_Y: f32 = 16.0;
/// Side inset the compact columns are distributed inside (`screenW - 24`).
pub const COMPACT_INSET_X: f32 = 12.0;
/// Width of one compact item before the remaining column width is split around it (`itemWidth`).
pub const COMPACT_ITEM_WIDTH: f32 = 80.0;

/// Reports whether a desktop is narrow enough for the compact icon grid.
pub fn compact(desktop: Rect) -> bool {
    desktop.width() < COMPACT_DESKTOP_WIDTH
}

impl IconGrid {
    /// Builds a grid and assigns every icon a free cell in reading order.
    pub fn new(icons: Vec<DesktopIcon>) -> Self {
        let mut grid = Self { icons, selected: 0 };
        let mut taken = std::collections::BTreeSet::new();
        for icon in &mut grid.icons {
            let mut cell = (icon.cell.0, icon.cell.1.min(ICON_ROWS - 1));
            while taken.contains(&cell) {
                cell = Self::next_cell(cell);
            }
            taken.insert(cell);
            icon.cell = cell;
        }
        grid
    }

    /// Grid of the given apps only, in that order, with fresh cells.
    ///
    /// The legacy desktop draws `pinnedDesktop` (`DesktopWindowWorkspace.tsx:2780`), not every
    /// installed module; this view keeps the full grid for the start menu and window titles.
    pub fn pinned(&self, apps: &'static [&'static str]) -> Self {
        let icons = apps
            .iter()
            .filter_map(|slug| {
                let app = AppId::new(slug);
                self.icons.iter().find(|icon| icon.app == app).cloned()
            })
            .map(|mut icon| {
                icon.cell = (0, 0);
                icon.pos = None;
                icon
            })
            .collect();
        Self::new(icons)
    }

    /// Icons in reading order.
    pub fn icons(&self) -> &[DesktopIcon] {
        &self.icons
    }

    /// Index of the selected icon.
    pub fn selected(&self) -> usize {
        self.selected
    }

    /// Selects an icon by index.
    pub fn select(&mut self, index: usize) {
        if !self.icons.is_empty() {
            self.selected = index.min(self.icons.len() - 1);
        }
    }

    /// Index of an app, if it has an icon.
    pub fn index_of(&self, app: AppId) -> Option<usize> {
        self.icons.iter().position(|icon| icon.app == app)
    }

    /// Translated label of an app.
    pub fn label_of(&self, app: AppId) -> Option<&str> {
        self.icons
            .iter()
            .find(|icon| icon.app == app)
            .map(|icon| icon.label.as_str())
    }

    /// Moves the selection through the grid in reading order and wraps at the ends.
    pub fn step(&mut self, dx: i32, dy: i32) {
        let count = self.icons.len() as i32;
        if count == 0 {
            return;
        }
        let current = self.selected as i32;
        let next = match (dx, dy) {
            (0, 0) => current,
            (_, 0) => {
                let columns = count.min(ICON_ROWS as i32).max(1);
                (current + dx * columns).rem_euclid(count)
            }
            (0, _) => (current + dy).rem_euclid(count),
            _ => current,
        };
        self.selected = next as usize;
    }

    /// Cell that follows the given one: down the column first, then the next column.
    pub fn next_cell(cell: (u32, u32)) -> (u32, u32) {
        if cell.1 + 1 < ICON_ROWS {
            (cell.0, cell.1 + 1)
        } else {
            (cell.0 + 1, 0)
        }
    }

    /// Icon columns that fit on a desktop of this width.
    pub fn columns(desktop: Rect) -> u32 {
        if compact(desktop) {
            return COMPACT_COLUMNS;
        }
        (((desktop.width() - 2.0 * DESKTOP_MARGIN) / ICON_STEP_X).floor() as u32).max(1)
    }

    /// Rectangle of a grid cell inside a desktop rectangle.
    ///
    /// The legacy desktop keeps a fixed 104 × 116 point pitch from a 24 point origin and fills six
    /// rows per column before it starts the next column, so the icons stay in a left-aligned column
    /// block instead of spreading over the whole width.
    pub fn cell_rect(desktop: Rect, cell: (u32, u32)) -> Rect {
        if compact(desktop) {
            // Narrow desktops use the responsive branch of the legacy shell
            // (`DesktopWindowWorkspace.tsx:884–894`): three columns of `(width - 24) / 3` points,
            // each item centred in its column, filled row by row from a 16 point top inset.
            let index = cell.1 + cell.0 * ICON_ROWS;
            let column = index % COMPACT_COLUMNS;
            let row = index / COMPACT_COLUMNS;
            let column_width = ((desktop.width() - 2.0 * COMPACT_INSET_X) / COMPACT_COLUMNS as f32)
                .floor()
                .max(ICON_CELL.x);
            let left = desktop.min.x
                + COMPACT_INSET_X
                + column_width * column as f32
                + ((column_width - COMPACT_ITEM_WIDTH) * 0.5).floor().max(0.0);
            let top = desktop.min.y + COMPACT_ORIGIN_Y + row as f32 * COMPACT_STEP_Y;
            return Rect::from_min_size(Pos2::new(left, top), ICON_CELL);
        }
        let left = desktop.min.x + DESKTOP_MARGIN + cell.0 as f32 * ICON_STEP_X;
        let top = desktop.min.y + DESKTOP_MARGIN + cell.1 as f32 * ICON_STEP_Y;
        Rect::from_min_size(Pos2::new(left, top), ICON_CELL)
    }

    /// Cell under a screen point, clamped to the visible grid.
    pub fn cell_at(&self, desktop: Rect, point: Pos2) -> (u32, u32) {
        if compact(desktop) {
            let column_width = ((desktop.width() - 2.0 * COMPACT_INSET_X) / COMPACT_COLUMNS as f32)
                .floor()
                .max(ICON_CELL.x);
            let inset = ((column_width - COMPACT_ITEM_WIDTH) * 0.5).floor().max(0.0);
            let column =
                ((point.x - desktop.min.x - COMPACT_INSET_X - inset) / column_width).floor();
            let row = ((point.y - desktop.min.y - COMPACT_ORIGIN_Y) / COMPACT_STEP_Y).floor();
            let column = (column.max(0.0) as u32).min(COMPACT_COLUMNS - 1);
            let row = (row.max(0.0) as u32).min(ICON_ROWS - 1);
            let index = row * COMPACT_COLUMNS + column;
            return (index / ICON_ROWS, index % ICON_ROWS);
        }
        let column = ((point.x - desktop.min.x - DESKTOP_MARGIN) / ICON_STEP_X).floor();
        let row = ((point.y - desktop.min.y - DESKTOP_MARGIN) / ICON_STEP_Y).floor();
        (
            (column.max(0.0) as u32).min(Self::columns(desktop).saturating_sub(1)),
            (row.max(0.0) as u32).min(ICON_ROWS - 1),
        )
    }

    /// Moves an icon to a cell; a taken cell moves it to the next free one.
    pub fn move_to(&mut self, app: AppId, cell: (u32, u32)) -> Option<(u32, u32)> {
        let index = self.index_of(app)?;
        let mut target = (cell.0, cell.1.min(ICON_ROWS - 1));
        let mut guard = 0;
        while self
            .icons
            .iter()
            .enumerate()
            .any(|(other, icon)| other != index && icon.cell == target)
        {
            target = Self::next_cell(target);
            guard += 1;
            if guard > 128 {
                break;
            }
        }
        self.icons[index].cell = target;
        Some(target)
    }

    /// Places an icon at an absolute desktop position, free of the grid.
    pub fn place_at(&mut self, app: AppId, min: Pos2) -> bool {
        match self.index_of(app) {
            Some(index) => {
                self.icons[index].place(min);
                true
            }
            None => false,
        }
    }

    /// Keeps only the given apps and lays the rest out again in reading order.
    pub fn retain_apps(&mut self, apps: &[&str]) {
        let mut icons = std::mem::take(&mut self.icons);
        icons.retain(|icon| apps.contains(&icon.app.as_str()));
        for (index, icon) in icons.iter_mut().enumerate() {
            icon.cell = (index as u32 / ICON_ROWS, index as u32 % ICON_ROWS);
            icon.pos = None;
        }
        *self = Self::new(icons);
    }

    /// Cell positions in reading order, ready to be persisted.
    pub fn positions(&self) -> Vec<(AppId, (u32, u32))> {
        self.icons
            .iter()
            .map(|icon| (icon.app, icon.cell))
            .collect()
    }

    /// Applies persisted cell positions; unknown apps are ignored.
    pub fn restore_positions(&mut self, positions: &[(AppId, (u32, u32))]) {
        for (app, cell) in positions {
            let safe_cell = (cell.0.min(12), cell.1.min(ICON_ROWS - 1));
            let _ = self.move_to(*app, safe_cell);
        }
    }

    /// Updates translated labels after a language switch.
    pub fn relabel(&mut self, label: impl Fn(AppId) -> String) {
        for icon in &mut self.icons {
            icon.label = label(icon.app);
        }
    }
}

/// Borrowed inputs of one desktop frame.
pub struct DesktopFrame<'a> {
    /// Resolved theme of the frame.
    pub theme: &'a Theme,
    /// Translated labels.
    pub texts: &'a UiTexts,
    /// Shell overlays, wallpaper and widgets.
    pub shell: &'a mut ShellState,
    /// Store the Studio drawer reads and writes.
    pub store: &'a SocdofStore,
    /// Signed-in account, marked in the start menu's user switcher.
    pub current_user: Option<uuid::Uuid>,
}

/// What the desktop asks the host to do after a frame.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DesktopOutcome {
    /// Leave the desktop and return to the gallery.
    pub back: bool,
    /// Switch the application appearance.
    pub toggle_theme: bool,
    /// Application the user launched from an icon, the start menu or the taskbar.
    pub open_app: Option<AppId>,
    /// Open the Studio drawer.
    pub open_studio: bool,
    /// Tab the Studio drawer opens on; `None` keeps the current tab.
    pub studio_tab: Option<crate::studio::StudioTab>,
    /// Lock the session without revoking it.
    pub lock: bool,
    /// Sign out and revoke the session.
    pub sign_out: bool,
    /// Account the user picked in the start menu; the host prefills its sign-in name.
    pub switch_account: Option<String>,
    /// Whether a desktop icon was moved and its layout should be persisted.
    pub icon_positions_changed: bool,
    /// Whether window geometry changed and should be persisted.
    pub window_layout_changed: bool,
}

/// Desktop rectangle without the taskbar.
pub fn work_area(screen: Rect) -> Rect {
    Rect::from_min_max(
        screen.min,
        Pos2::new(
            screen.max.x,
            (screen.max.y - TASKBAR_HEIGHT).max(screen.min.y),
        ),
    )
}

/// Rectangle of the desktop window control bar in the top right corner.
///
/// The reference desktop keeps one control cluster for the whole desktop instead of per app window
/// chrome: minimize, fullscreen and close, tucked into the corner with a rounded bottom left edge.
pub fn controls_rect(screen: Rect) -> Rect {
    let size = Vec2::new(DESKTOP_CONTROL_WIDTH * 3.0, DESKTOP_CONTROL_HEIGHT);
    Rect::from_min_size(Pos2::new(screen.right() - size.x, screen.top()), size)
}

/// Switches the native window between fullscreen and windowed, like the F11 shortcut.
pub fn toggle_fullscreen(ctx: &Context) {
    let current = ctx.input(|input| input.viewport().fullscreen.unwrap_or(false));
    ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(!current));
}

/// What the desktop window controls asked for in one frame.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct ControlAction {
    fullscreen: bool,
    minimize: bool,
    close: bool,
}

/// Draws the desktop window controls and reports which one was activated.
fn desktop_controls(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    screen: Rect,
) -> ControlAction {
    let mut action = ControlAction::default();
    let bar = controls_rect(screen);
    let fullscreen = ctx.input(|input| input.viewport().fullscreen.unwrap_or(false));
    let entries = [
        (
            Icon::Minimize,
            texts.get("desktop_minimize_app").to_owned(),
            false,
        ),
        (
            if fullscreen {
                Icon::Restore
            } else {
                Icon::Maximize
            },
            if fullscreen {
                texts.get("desktop_exit_fullscreen").to_owned()
            } else {
                texts.get("desktop_enter_fullscreen").to_owned()
            },
            false,
        ),
        (Icon::Close, texts.get("desktop_close_app").to_owned(), true),
    ];
    egui::Area::new(Id::new("socdof-desktop-controls"))
        .order(egui::Order::Foreground)
        .fixed_pos(bar.min)
        .show(ctx, |ui| {
            let (rect, _) = ui.allocate_exact_size(bar.size(), Sense::hover());
            let painter = ui.painter().clone();
            painter.rect(
                rect,
                Rounding {
                    nw: 0.0,
                    ne: 0.0,
                    sw: 16.0,
                    se: 0.0,
                },
                with_alpha(theme.palette.surface, 190),
                Stroke::new(1.0_f32, theme.palette.border),
            );
            for (index, (icon, label, danger)) in entries.into_iter().enumerate() {
                let button = Rect::from_min_size(
                    Pos2::new(
                        rect.left() + index as f32 * DESKTOP_CONTROL_WIDTH,
                        rect.top(),
                    ),
                    Vec2::new(DESKTOP_CONTROL_WIDTH, rect.height()),
                );
                let id = Id::new(("socdof-desktop-control", index));
                let focused = focus.register(id);
                let response = ui.interact(button, id, Sense::click());
                if response.clicked() {
                    focus.set_focus(Some(id));
                }
                let hovered = response.hovered() || focused;
                let close_hover = danger && hovered;
                let fill = if close_hover {
                    theme.palette.danger
                } else if hovered {
                    with_alpha(theme.palette.text, 12)
                } else {
                    Color32::TRANSPARENT
                };
                if fill != Color32::TRANSPARENT {
                    painter.rect(button, Rounding::ZERO, fill, Stroke::NONE);
                }
                let color = if close_hover {
                    theme.palette.accent_on
                } else if hovered {
                    theme.palette.text
                } else {
                    theme.palette.text_muted
                };
                icon.draw(
                    &painter,
                    Rect::from_center_size(button.center(), Vec2::splat(14.0)),
                    color,
                    1.4,
                );
                if focused {
                    focus_ring(ui, theme, button.shrink(2.0));
                }
                response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label.as_str()));
                let clicked = response.on_hover_text(label.clone()).clicked() || focus.activate(id);
                if clicked {
                    match index {
                        0 => action.minimize = true,
                        1 => action.fullscreen = true,
                        _ => action.close = true,
                    }
                }
            }
        });
    action
}

/// Apps pinned to the taskbar, in legacy order.
///
/// The shell shows the persisted taskbar pins (`pinnedTaskbar`,
/// `SOCDOF - TS/src/components/shell/DesktopWindowWorkspace.tsx:178–180`, `:4143`), not every desktop
/// icon; the personal setup installs only the first three of the default list.
pub const PINNED_TASKBAR: [&str; 3] = ["dashboard", "contacts", "calendar"];

/// Default rectangle of the `index`th window opened on a work area.
pub fn default_window_rect(work_area: Rect, index: usize) -> Rect {
    let size = Vec2::new(
        (work_area.width() * 0.62).clamp(WINDOW_MIN_WIDTH, 680.0),
        (work_area.height() * 0.62).clamp(WINDOW_MIN_HEIGHT, 460.0),
    );
    let offset = 28.0 * index as f32;
    let min = Pos2::new(
        work_area.min.x + 40.0 + offset,
        work_area.min.y + 32.0 + offset,
    );
    clamp_rect(Rect::from_min_size(min, size), work_area)
}

/// Formats a millisecond timestamp as an `HH:MM` clock label (UTC, so snapshots stay stable).
pub fn format_clock(millis: i64) -> String {
    let total_minutes = millis.div_euclid(60_000);
    let hours = total_minutes.div_euclid(60).rem_euclid(24);
    let minutes = total_minutes.rem_euclid(60);
    format!("{hours:02}:{minutes:02}")
}

/// Formats a millisecond timestamp the way the legacy runtime prints the clock.
///
/// `formatSystemTime` (`SOCDOF - TS/src/lib/i18n.ts:13020`) calls
/// `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })`, so the
/// runtime locale decides between 12 and 24 hours; the reference desktop shows the 12 hour form
/// with a leading zero hour and an uppercase meridiem (`03:43:05 PM`). `seconds` adds the seconds,
/// which the taskbar keeps on (`time_show_seconds !== false`) while the sign-in clock leaves them
/// off (`time_show_seconds === true`).
fn clock_label(millis: i64, seconds: bool) -> String {
    let total_seconds = millis.div_euclid(1_000);
    let hour = total_seconds.div_euclid(3_600).rem_euclid(24);
    let minute = total_seconds.div_euclid(60).rem_euclid(60);
    let second = total_seconds.rem_euclid(60);
    let meridiem = if hour < 12 { "AM" } else { "PM" };
    let hour = match hour % 12 {
        0 => 12,
        other => other,
    };
    if seconds {
        format!("{hour:02}:{minute:02}:{second:02} {meridiem}")
    } else {
        format!("{hour:02}:{minute:02} {meridiem}")
    }
}

/// Twelve hour clock label without seconds, for the sign-in screen (`03:41 PM`).
pub fn format_clock_12h(millis: i64) -> String {
    clock_label(millis, false)
}

/// Twelve hour clock label with seconds, for the taskbar (`03:43:05 PM`).
pub fn format_clock_seconds(millis: i64) -> String {
    clock_label(millis, true)
}

/// Short weekday of the desktop clock, in the English form the legacy tile shows
/// (`toLocaleDateString(undefined, { weekday: 'short' })` on an English system).
fn weekday_short(millis: i64) -> &'static str {
    const NAMES: [&str; 7] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    let days = millis.div_euclid(86_400_000);
    NAMES[(days + 4).rem_euclid(7) as usize]
}

/// Day of the month of the desktop clock, from the same epoch the clock label uses.
fn day_of_month(millis: i64) -> u32 {
    // Civil date from days since the epoch (Howard Hinnant's `civil_from_days`).
    let z = millis.div_euclid(86_400_000) + 719_468;
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    (day_of_year - (153 * month_index + 2) / 5 + 1) as u32
}

/// Width of the locale pill in the taskbar tray.
const LANGUAGE_PILL_WIDTH: f32 = 40.0;

/// 24 hour clock label with seconds, as the reference taskbar prints it (`12:36:11`).
fn taskbar_clock(millis: i64) -> String {
    let total_seconds = millis.div_euclid(1_000);
    let hour = total_seconds.div_euclid(3_600).rem_euclid(24);
    let minute = total_seconds.div_euclid(60).rem_euclid(60);
    let second = total_seconds.rem_euclid(60);
    format!("{hour:02}:{minute:02}:{second:02}")
}

/// `DD.MM.YYYY` date under the taskbar clock.
fn taskbar_date(millis: i64) -> String {
    let (year, month, day) = civil_date(millis);
    format!("{day:02}.{month:02}.{year:04}")
}

/// Civil date of a millisecond timestamp (Howard Hinnant's `civil_from_days`).
fn civil_date(millis: i64) -> (i32, u32, u32) {
    let z = millis.div_euclid(86_400_000) + 719_468;
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + (z - day_of_era) / 146_097 * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_index + 2) / 5 + 1) as u32;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    } as u32;
    (year as i32, month, day)
}

/// Paints the German locale pill of the reference tray in front of the clock.
fn language_pill(painter: &egui::Painter, theme: &Theme, bar: Rect, right: f32) {
    let rect = Rect::from_min_size(
        Pos2::new(right - LANGUAGE_PILL_WIDTH, bar.center().y - 11.0),
        Vec2::new(LANGUAGE_PILL_WIDTH, 22.0),
    );
    painter.rect(
        rect,
        Rounding::same(11.0),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let flag = Rect::from_min_size(
        Pos2::new(rect.left() + 6.0, rect.center().y - 5.0),
        Vec2::new(16.0, 10.0),
    );
    let stripe = flag.height() / 3.0;
    for (index, color) in [
        Color32::from_rgb(0x1f, 0x29, 0x37),
        Color32::from_rgb(0xdd, 0x00, 0x00),
        Color32::from_rgb(0xff, 0xce, 0x00),
    ]
    .into_iter()
    .enumerate()
    {
        painter.rect(
            Rect::from_min_size(
                Pos2::new(flag.left(), flag.top() + stripe * index as f32),
                Vec2::new(flag.width(), stripe),
            ),
            Rounding::ZERO,
            color,
            Stroke::NONE,
        );
    }
    painter.text(
        Pos2::new(rect.right() - 7.0, rect.center().y),
        Align2::RIGHT_CENTER,
        "DE",
        FontId::new(10.0, crate::theme::semibold()),
        theme.palette.text,
    );
}

/// Paints the live calendar tile of the legacy desktop (`DynamicCalendarIcon.tsx`).
///
/// The tile is a white card with a blue weekday band, the day number in a heavy face and a small
/// accent dot at the bottom; the taskbar uses it at 24 points, the desktop at 48.
fn calendar_tile(painter: &egui::Painter, rect: Rect, theme: &Theme, millis: i64, compact: bool) {
    // `sm` is `rounded-lg` (8 points), `lg` is `rounded-2xl` (16 points).
    let rounding = if compact { 8.0 } else { 16.0 };
    let card = if theme.appearance.is_dark() {
        Color32::from_rgb(0x0f, 0x17, 0x2a)
    } else {
        Color32::WHITE
    };
    painter.rect(
        rect,
        Rounding::same(rounding),
        card,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let band_height = if compact { rect.height() * 0.34 } else { 14.0 };
    painter.rect(
        Rect::from_min_size(rect.min, Vec2::new(rect.width(), band_height)),
        Rounding {
            nw: rounding,
            ne: rounding,
            sw: 0.0,
            se: 0.0,
        },
        Color32::from_rgb(0x25, 0x63, 0xeb),
        Stroke::NONE,
    );
    painter.text(
        band(rect, band_height).center(),
        Align2::CENTER_CENTER,
        weekday_short(millis),
        FontId::new(if compact { 6.0 } else { 8.5 }, crate::theme::heavy()),
        Color32::WHITE,
    );
    painter.text(
        Pos2::new(
            rect.center().x,
            rect.top() + band_height + (rect.height() - band_height) * 0.42,
        ),
        Align2::CENTER_CENTER,
        day_of_month(millis).to_string(),
        FontId::new(if compact { 10.0 } else { 20.0 }, crate::theme::heavy()),
        theme.palette.text,
    );
    painter.rect(
        Rect::from_center_size(
            Pos2::new(rect.center().x, rect.bottom() - 3.0),
            Vec2::new(8.0, 2.0),
        ),
        Rounding::same(1.0),
        crate::tokens::with_alpha(Color32::from_rgb(0x3b, 0x82, 0xf6), 40),
        Stroke::NONE,
    );
}

/// Rectangle of the weekday band of a calendar tile.
fn band(rect: Rect, height: f32) -> Rect {
    Rect::from_min_size(rect.min, Vec2::new(rect.width(), height))
}

/// Soft `shadow-lg` below a desktop tile.
///
/// The legacy tile drops `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`
/// (`DesktopWindowWorkspace.tsx:2913`): a black halo that sits below the tile. Stacking a few
/// rounded rectangles with small alpha reproduces it without a blur pass.
///
/// Stacking translucent rings leaves visible steps at 48 points, so the shadow is rasterized once
/// into a texture whose edge follows the gaussian the CSS blur describes, and then reused for every
/// tile.
fn tile_shadow(ctx: &Context, painter: &egui::Painter, tile: Rect, rounding: f32) {
    const PAD_LEFT: f32 = 24.0;
    const PAD_TOP: f32 = 24.0;
    const PAD_BOTTOM: f32 = 40.0;
    let size = Vec2::new(
        tile.width() + PAD_LEFT * 2.0,
        tile.height() + PAD_TOP + PAD_BOTTOM,
    );
    let key = Id::new((
        "socdof-tile-shadow",
        tile.width().to_bits(),
        tile.height().to_bits(),
        rounding.to_bits(),
    ));
    let texture = ctx
        .data(|data| data.get_temp::<TextureHandle>(key))
        .unwrap_or_else(|| {
            let image = shadow_image(tile.size(), rounding, PAD_LEFT, PAD_TOP, size);
            let handle = ctx.load_texture("socdof-tile-shadow", image, TextureOptions::LINEAR);
            ctx.data_mut(|data| data.insert_temp(key, handle.clone()));
            handle
        });
    painter.image(
        texture.id(),
        Rect::from_min_size(
            Pos2::new(tile.left() - PAD_LEFT, tile.top() - PAD_TOP),
            size,
        ),
        Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
        Color32::WHITE,
    );
}

/// Rasterizes the two layers of the legacy `shadow-lg` into one premultiplied transparent image.
fn shadow_image(tile: Vec2, rounding: f32, pad_left: f32, pad_top: f32, size: Vec2) -> ColorImage {
    let width = size.x.round().max(1.0) as usize;
    let height = size.y.round().max(1.0) as usize;
    let mut pixels = vec![Color32::TRANSPARENT; width * height];
    // The layer functions are centred on the tile, so the sampling offset includes half the tile.
    let center = Vec2::new(pad_left + tile.x * 0.5, pad_top + tile.y * 0.5);
    for y in 0..height {
        for x in 0..width {
            let px = x as f32 + 0.5 - center.x;
            let py = y as f32 + 0.5 - center.y;
            let wide = shadow_layer(px, py, tile, rounding, 3.0, 10.0, 7.5) * 0.1;
            let tight = shadow_layer(px, py, tile, rounding, 4.0, 4.0, 3.0) * 0.1;
            let alpha = (wide + tight * (1.0 - wide)).clamp(0.0, 1.0);
            pixels[y * width + x] =
                Color32::from_rgba_unmultiplied(0, 0, 0, (alpha * 255.0).round() as u8);
        }
    }
    ColorImage {
        size: [width, height],
        pixels,
    }
}

/// Coverage of one blurred, offset rounded rectangle at a point of the tile coordinate system.
fn shadow_layer(
    x: f32,
    y: f32,
    tile: Vec2,
    rounding: f32,
    spread: f32,
    offset_y: f32,
    sigma: f32,
) -> f32 {
    let half = Vec2::new(
        (tile.x * 0.5 - spread).max(0.0),
        (tile.y * 0.5 - spread).max(0.0),
    );
    let radius = (rounding - spread).max(0.0);
    let qx = x.abs() - (half.x - radius);
    let qy = (y - offset_y).abs() - (half.y - radius);
    let distance = qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius;
    // Gaussian blur of a straight edge: 0.5 * erfc(d / (sigma * sqrt 2)).
    0.5 * erfc(distance / (sigma * std::f32::consts::SQRT_2))
}

/// Complementary error function, Abramowitz and Stegun 7.1.26 (maximum error 1.5e-7).
fn erfc(x: f32) -> f32 {
    let z = x.abs();
    let t = 1.0 / (1.0 + 0.327_591_1 * z);
    let poly = t
        * (0.254_829_6
            + t * (-0.284_496_74 + t * (1.421_413_7 + t * (-1.453_152 + t * 1.061_405_4))));
    let erf = 1.0 - poly * (-z * z).exp();
    if x >= 0.0 {
        1.0 - erf
    } else {
        1.0 + erf
    }
}

/// Draws the desktop shell and reports what the host should do next.
///
/// The caller owns the grid, the window manager and the shell, so window positions, open windows,
/// icon positions, wallpaper and widget state survive a language or theme switch.
///
/// Draws the desktop shell without embedding application content in its windows.
pub fn desktop(
    ctx: &Context,
    frame: DesktopFrame<'_>,
    focus: &mut FocusState,
    icons: &mut IconGrid,
    windows: &mut WindowManager,
    now: i64,
) -> DesktopOutcome {
    desktop_impl(ctx, frame, focus, icons, windows, now, None)
}

/// Draws the desktop and renders each open app inside its corresponding native window.
pub fn desktop_with_content(
    ctx: &Context,
    frame: DesktopFrame<'_>,
    focus: &mut FocusState,
    icons: &mut IconGrid,
    windows: &mut WindowManager,
    now: i64,
    mut render_window: impl FnMut(
        AppId,
        bool,
        &mut Ui,
        &Context,
        &Theme,
        &UiTexts,
        &mut FocusState,
        &SocdofStore,
        i64,
    ) -> bool,
) -> DesktopOutcome {
    desktop_impl(
        ctx,
        frame,
        focus,
        icons,
        windows,
        now,
        Some(&mut render_window),
    )
}

fn desktop_impl(
    ctx: &Context,
    frame: DesktopFrame<'_>,
    focus: &mut FocusState,
    icons: &mut IconGrid,
    windows: &mut WindowManager,
    now: i64,
    mut render_window: Option<&mut DesktopWindowRenderer<'_>>,
) -> DesktopOutcome {
    let DesktopFrame {
        theme,
        texts,
        shell,
        store,
        current_user,
    } = frame;
    let screen = ctx.screen_rect();
    let area = work_area(screen);
    let mut outcome = DesktopOutcome::default();
    if shell.start.is_open() && shell.start.accounts().is_empty() {
        if let Ok(users) = store.list_users() {
            let accounts = users
                .into_iter()
                .map(|user| AccountEntry {
                    id: user.id,
                    username: user.username.clone(),
                    name: user.display_name.clone(),
                    current: current_user == Some(user.id),
                })
                .collect();
            shell.start.set_accounts(accounts);
        }
    }
    // Minute precision keeps the desktop responsive without forcing a full UI redraw every second.
    // The native host still checks idle locking and refreshes its instance heartbeat periodically.
    ctx.request_repaint_after(std::time::Duration::from_secs(15));

    crate::studio::studio_drawer(ctx, theme, texts, focus, &mut shell.studio, store);

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(theme.palette.background))
        .show(ctx, |ui| {
            ui.set_min_size(area.size());
            paint_wallpaper(
                ctx,
                ui,
                area,
                &shell.wallpaper,
                theme.accent.base,
                theme.appearance.is_dark(),
            );
            let mut blocked =
                windows.dialog_open() || shell.overlay_open() || shell.studio.is_open();

            if !blocked {
                let (cycle_windows, close_active, snap_left, snap_right, maximize_active) = ui
                    .input(|input| {
                        (
                            input.modifiers.command && input.key_pressed(Key::Tab),
                            input.modifiers.command && input.key_pressed(Key::W),
                            input.modifiers.command && input.key_pressed(Key::ArrowLeft),
                            input.modifiers.command && input.key_pressed(Key::ArrowRight),
                            input.key_pressed(Key::F11),
                        )
                    });
                if cycle_windows && windows.focus_next().is_some() {
                    // Ctrl+Tab changes which window is on top; persist the new stacking order.
                    outcome.window_layout_changed = true;
                }
                if let Some(active) = windows.active() {
                    if close_active {
                        windows.request_close(active);
                    }
                    if snap_left {
                        windows.snap(active, SnapEdge::Left, area);
                        outcome.window_layout_changed = true;
                    }
                    if snap_right {
                        windows.snap(active, SnapEdge::Right, area);
                        outcome.window_layout_changed = true;
                    }
                    if maximize_active {
                        windows.toggle_maximize(active, area);
                        outcome.window_layout_changed = true;
                    }
                }
                // A keyboard shortcut can open a modal confirmation. Recompute this before
                // processing desktop icons so the same key event cannot activate background UI.
                blocked = windows.dialog_open() || shell.overlay_open() || shell.studio.is_open();
            }

            if !blocked {
                let (left, right, up, down) = ui.input(|input| {
                    let plain_keys = !input.modifiers.any();
                    (
                        plain_keys && input.key_pressed(Key::ArrowLeft),
                        plain_keys && input.key_pressed(Key::ArrowRight),
                        plain_keys && input.key_pressed(Key::ArrowUp),
                        plain_keys && input.key_pressed(Key::ArrowDown),
                    )
                });
                if left {
                    icons.step(-1, 0);
                }
                if right {
                    icons.step(1, 0);
                }
                if up {
                    icons.step(0, -1);
                }
                if down {
                    icons.step(0, 1);
                }
            }

            let entries: Vec<(usize, DesktopIcon)> =
                icons.icons().iter().cloned().enumerate().collect();
            for (index, icon) in entries {
                let rect = match icon.pos() {
                    Some(pos) => Rect::from_min_size(pos, ICON_CELL),
                    None => IconGrid::cell_rect(area, icon.cell()),
                };
                let id = Id::new(("socdof-desktop-icon", icon.app().as_str()));
                let focused = focus.register(id);
                let response = ui.interact(rect, id, Sense::click_and_drag());
                if !blocked && response.clicked() {
                    icons.select(index);
                    focus.set_focus(Some(id));
                }
                // The reference desktop opens an app on a double click; a single click only selects
                // the icon (the keyboard opens it with Enter/Space).
                let double_clicked = !blocked && response.double_clicked();
                if !blocked && response.drag_stopped() {
                    if let Some(pos) = response.interact_pointer_pos() {
                        let cell = icons.cell_at(area, pos);
                        if icons.move_to(icon.app(), cell).is_some() {
                            outcome.icon_positions_changed = true;
                        }
                    }
                }
                // The legacy grid only highlights the focused icon; a fresh desktop shows the
                // plain tiles (`DesktopWindowWorkspace.tsx:2886`).
                let selected = icons.selected() == index && focused;
                let hovered = response.hovered() || focused;
                let open = windows.is_open(icon.app());
                let painter = ui.painter().clone();
                if selected || hovered {
                    painter.rect(
                        rect.shrink(2.0),
                        Rounding::same(RADIUS_CONTROL),
                        if selected {
                            theme.accent.light
                        } else {
                            with_alpha(theme.palette.text_muted, 8)
                        },
                        Stroke::new(
                            1.0_f32,
                            if selected {
                                theme.accent.border
                            } else {
                                Color32::TRANSPARENT
                            },
                        ),
                    );
                }
                let tile = Rect::from_center_size(
                    Pos2::new(rect.center().x, rect.top() + 8.0 + ICON_TILE / 2.0),
                    Vec2::splat(ICON_TILE),
                );
                let tile_rounding = 16.0;
                tile_shadow(ctx, &painter, tile, tile_rounding);
                if icon.app().as_str() == "calendar" {
                    // The calendar shortcut is a live date tile, not an app gradient
                    // (`DesktopWindowWorkspace.tsx:2901`).
                    calendar_tile(&painter, tile, theme, now, false);
                } else {
                    let app = crate::chrome::app_chrome(icon.app().as_str());
                    crate::tokens::gradient_round_rect(
                        &painter,
                        tile,
                        tile_rounding,
                        &crate::chrome::tint_stops(app),
                    );
                    icon.icon().draw(
                        &painter,
                        Rect::from_center_size(tile.center(), Vec2::splat(ICON_GLYPH)),
                        Color32::WHITE,
                        2.0,
                    );
                }
                if open {
                    painter.rect(
                        Rect::from_min_size(
                            Pos2::new(tile.center().x - 10.0, tile.bottom() + 3.0),
                            Vec2::new(20.0, 3.0),
                        ),
                        Rounding::same(2.0),
                        theme.accent.base,
                        Stroke::NONE,
                    );
                }
                // `text-slate-800 dark:text-white` on the legacy caption
                // (`DesktopWindowWorkspace.tsx:2914`).
                let caption = if theme.appearance.is_dark() {
                    Color32::WHITE
                } else {
                    Color32::from_rgb(0x1e, 0x29, 0x3b)
                };
                let galley = painter.layout(
                    icon.label().to_owned(),
                    FontId::new(12.0, crate::theme::semibold()),
                    caption,
                    ICON_LABEL_WIDTH,
                );
                painter.galley(
                    Pos2::new(rect.center().x - galley.size().x / 2.0, tile.bottom() + 8.0),
                    galley,
                    caption,
                );
                if focused {
                    focus_ring(ui, theme, tile);
                }
                if double_clicked || focus.activate(id) {
                    if windows.is_open(icon.app()) {
                        windows.focus(icon.app());
                    } else {
                        activate_app(icons, windows, icon.app(), area, now);
                    }
                    outcome.open_app = Some(icon.app());
                }
            }

            // The legacy desktop has no widget layer at all, so the icon grid keeps the whole area
            // and the window controls stay the only element in the top right corner.
        });

    if ctx.input(|input| input.modifiers.command && input.key_pressed(Key::K)) {
        shell.open_palette();
    }

    let visible: Vec<(AppId, Rect, String, bool, bool)> = windows
        .windows()
        .iter()
        .filter(|window| !window.is_minimized())
        .map(|window| {
            (
                window.app(),
                window.rect(),
                window.title().to_owned(),
                window.is_maximized(),
                windows.active() == Some(window.app()),
            )
        })
        .collect();

    for (app, rect, title, maximized, is_active) in visible {
        let mut drag = Vec2::ZERO;
        let mut resize = Vec2::ZERO;
        let mut raise = false;
        let mut minimize = false;
        let mut toggle = false;
        let mut close = false;
        let mut app_back = false;

        egui::Area::new(Id::new(("socdof-window", app.as_str())))
            .order(egui::Order::Foreground)
            .fixed_pos(rect.min)
            .show(ctx, |ui| {
                let (frame, _) = ui.allocate_exact_size(rect.size(), Sense::hover());
                let bar_height = TITLE_BAR_HEIGHT;
                let compact = compact_chrome(app.as_str());
                let bar = Rect::from_min_size(frame.min, Vec2::new(frame.width(), bar_height));
                let bar_response = ui.interact(
                    bar,
                    Id::new(("socdof-window-bar", app.as_str())),
                    Sense::click_and_drag(),
                );
                if bar_response.clicked() {
                    raise = true;
                }
                if bar_response.dragged() {
                    drag = bar_response.drag_delta();
                }

                let painter = ui.painter().clone();
                crate::components::shadow(
                    &painter,
                    theme,
                    frame,
                    RADIUS_DIALOG,
                    crate::tokens::ShadowStrength::Dialog,
                );
                painter.rect(
                    frame,
                    Rounding::same(RADIUS_DIALOG),
                    theme.palette.surface,
                    Stroke::new(1.0_f32, theme.palette.border),
                );
                painter.rect(
                    bar,
                    Rounding {
                        nw: RADIUS_DIALOG,
                        ne: RADIUS_DIALOG,
                        sw: 0.0,
                        se: 0.0,
                    },
                    // The reference keeps the title bar dark in the dark theme and only tints it
                    // in the light theme, where an active window shows the accent wash.
                    if is_active && theme.appearance == crate::theme::Appearance::Light {
                        theme.accent.light
                    } else {
                        theme.palette.surface_muted
                    },
                    Stroke::NONE,
                );
                let mut title_left = bar.left() + 12.0;
                if let Some((icon, badge)) = compact_badge(app.as_str()) {
                    let tile = Rect::from_center_size(
                        Pos2::new(title_left + 9.0, bar.center().y),
                        Vec2::splat(18.0),
                    );
                    painter.rect(tile, Rounding::same(5.0), badge, Stroke::NONE);
                    icon.draw(
                        &painter,
                        Rect::from_center_size(tile.center(), Vec2::splat(11.0)),
                        Color32::WHITE,
                        1.7,
                    );
                    title_left += 26.0;
                }
                let title_galley = painter.layout_no_wrap(
                    title.clone(),
                    FontId::new(
                        if compact { 12.5 } else { FONT_BODY },
                        if compact {
                            crate::theme::semibold()
                        } else {
                            egui::FontFamily::Proportional
                        },
                    ),
                    theme.palette.text,
                );
                painter.galley(
                    Pos2::new(title_left, bar.center().y - title_galley.size().y / 2.0),
                    title_galley,
                    theme.palette.text,
                );
                if let Some(render_window) = render_window.as_deref_mut() {
                    // Both chromes keep the content at the same origin: 40 + 12 == 32 + 20.
                    let content_rect = Rect::from_min_max(
                        Pos2::new(
                            frame.left() + 12.0,
                            frame.top() + bar_height + content_offset(app.as_str()),
                        ),
                        Pos2::new(frame.right() - 12.0, frame.bottom() - 12.0),
                    );
                    ui.allocate_ui_at_rect(content_rect, |ui| {
                        app_back =
                            render_window(app, is_active, ui, ctx, theme, texts, focus, store, now);
                    });
                } else {
                    let hint = painter.layout_no_wrap(
                        texts.get("desktop_hint").to_owned(),
                        FontId::proportional(FONT_SMALL),
                        theme.palette.text_muted,
                    );
                    painter.galley(
                        Pos2::new(frame.left() + 16.0, frame.top() + bar_height + 16.0),
                        hint,
                        theme.palette.text_muted,
                    );
                }

                // The compact chrome uses the smaller reference controls, spaced tighter.
                let (control, step) = if compact { (24.0, 28.0) } else { (32.0, 36.0) };
                let mut right = bar.right() - if compact { 6.0 } else { 8.0 };
                let close_rect = Rect::from_center_size(
                    Pos2::new(right - control * 0.5, bar.center().y),
                    Vec2::splat(control),
                );
                right -= step;
                let max_rect = Rect::from_center_size(
                    Pos2::new(right - control * 0.5, bar.center().y),
                    Vec2::splat(control),
                );
                right -= step;
                let min_rect = Rect::from_center_size(
                    Pos2::new(right - control * 0.5, bar.center().y),
                    Vec2::splat(control),
                );
                if chrome_button(
                    ui,
                    theme,
                    focus,
                    Id::new(("socdof-window-close", app.as_str())),
                    close_rect,
                    Icon::Close,
                    texts.get("window_close"),
                ) {
                    close = true;
                }
                let (max_icon, max_label) = if maximized {
                    (Icon::Restore, texts.get("window_restore"))
                } else {
                    (Icon::Maximize, texts.get("window_maximize"))
                };
                if chrome_button(
                    ui,
                    theme,
                    focus,
                    Id::new(("socdof-window-maximize", app.as_str())),
                    max_rect,
                    max_icon,
                    max_label,
                ) {
                    toggle = true;
                }
                if chrome_button(
                    ui,
                    theme,
                    focus,
                    Id::new(("socdof-window-minimize", app.as_str())),
                    min_rect,
                    Icon::Minimize,
                    texts.get("window_minimize"),
                ) {
                    minimize = true;
                }

                if !maximized {
                    let grip = Rect::from_min_max(frame.max - Vec2::splat(RESIZE_GRIP), frame.max);
                    let grip_response = ui.interact(
                        grip,
                        Id::new(("socdof-window-grip", app.as_str())),
                        Sense::drag(),
                    );
                    if grip_response.dragged() {
                        resize = grip_response.drag_delta();
                    }
                    for step in 0..3 {
                        let offset = 4.0 + step as f32 * 4.0;
                        painter.line_segment(
                            [
                                Pos2::new(grip.right() - offset, grip.bottom() - 2.0),
                                Pos2::new(grip.right() - 2.0, grip.bottom() - offset),
                            ],
                            Stroke::new(1.0_f32, theme.palette.text_muted),
                        );
                    }
                }
            });

        if app_back {
            windows.close(app, now);
            outcome.window_layout_changed = true;
        } else if close {
            windows.request_close(app);
        }
        if minimize && windows.minimize(app) {
            outcome.window_layout_changed = true;
        }
        if toggle {
            windows.toggle_maximize(app, area);
            outcome.window_layout_changed = true;
        }
        if raise && windows.focus(app) {
            // Clicking a window title bar raises it above its siblings.
            outcome.window_layout_changed = true;
        }
        if drag != Vec2::ZERO {
            windows.move_by(app, drag, area);
            outcome.window_layout_changed = true;
        }
        if resize != Vec2::ZERO {
            windows.resize_by(app, resize, area);
            outcome.window_layout_changed = true;
        }
    }

    if shell.onboarding.is_open() {
        onboarding(ctx, theme, texts, focus, &mut shell.onboarding);
    } else if shell.palette.is_open() {
        if let Some(action) = command_palette(ctx, theme, texts, focus, &mut shell.palette) {
            apply_action(action, shell, icons, windows, area, now, &mut outcome);
        }
    } else if shell.start.is_open() {
        if let Some(choice) = start_menu(ctx, theme, texts, focus, &mut shell.start, icons) {
            match choice {
                StartMenuChoice::App(app) => {
                    activate_app(icons, windows, app, area, now);
                    outcome.open_app = Some(app);
                }
                StartMenuChoice::Power(action) => {
                    apply_action(
                        action.action(),
                        shell,
                        icons,
                        windows,
                        area,
                        now,
                        &mut outcome,
                    );
                }
                StartMenuChoice::Switch(username) => {
                    shell.close_overlays();
                    outcome.switch_account = Some(username);
                }
            }
        }
    } else if shell.tray.is_open() {
        if let Some(action) = tray_flyout(ctx, theme, texts, focus, &mut shell.tray) {
            apply_action(
                action.into(),
                shell,
                icons,
                windows,
                area,
                now,
                &mut outcome,
            );
        }
    }

    // The taskbar lists the pinned taskbar apps, not every desktop icon
    // (`SOCDOF - TS/src/components/shell/DesktopWindowWorkspace.tsx:178–180`, `:4143`).
    let apps: Vec<(AppId, String, Icon)> = PINNED_TASKBAR
        .iter()
        .filter_map(|slug| {
            icons
                .icons()
                .iter()
                .find(|icon| icon.app().as_str() == *slug)
                .map(|icon| (icon.app(), icon.label().to_owned(), icon.icon()))
        })
        .collect();
    let mut hidden: Vec<(AppId, String)> = Vec::new();
    let mut launched: Option<AppId> = None;
    // The legacy taskbar follows the appearance: `bg-slate-900/90` in the dark theme,
    // `bg-white/90` with slate text in the light one.
    egui::Area::new(Id::new("socdof-taskbar"))
        .order(egui::Order::Foreground)
        .anchor(Align2::LEFT_BOTTOM, Vec2::ZERO)
        .show(ctx, |ui| {
            let (bar, _) =
                ui.allocate_exact_size(Vec2::new(screen.width(), TASKBAR_HEIGHT), Sense::hover());
            let painter = ui.painter().clone();
            painter.rect(
                bar,
                Rounding::same(0.0),
                with_alpha(theme.palette.surface, 84),
                Stroke::new(1.0_f32, theme.palette.border),
            );
            // The reference tray prints the 24 hour clock with seconds over the date in bold
            // monospace (`text-[13px] font-mono font-bold` with `time_show_date`), right aligned.
            let clock_color = if theme.appearance.is_dark() {
                Color32::from_rgb(0xe2, 0xe8, 0xf0)
            } else {
                Color32::from_rgb(0x1e, 0x29, 0x3b)
            };
            let date_color = if theme.appearance.is_dark() {
                Color32::from_rgb(0x94, 0xa3, 0xb8)
            } else {
                Color32::from_rgb(0x64, 0x74, 0x8b)
            };
            let clock = painter.layout_no_wrap(
                taskbar_clock(now),
                FontId::new(13.0, crate::theme::mono_bold()),
                clock_color,
            );
            let date = painter.layout_no_wrap(
                taskbar_date(now),
                FontId::new(10.0, crate::theme::mono_bold()),
                date_color,
            );
            let clock_right = bar.right() - 14.0;
            let clock_left = clock_right - clock.size().x.max(date.size().x);
            let clock_height = clock.size().y;
            painter.galley(Pos2::new(clock_left, bar.top() + 8.0), clock, clock_color);
            painter.galley(
                Pos2::new(clock_left, bar.top() + 8.0 + clock_height + 1.0),
                date,
                date_color,
            );
            // The locale pill of the reference tray sits directly in front of the clock.
            language_pill(&painter, theme, bar, clock_left - 10.0);

            let start_rect = Rect::from_min_size(
                Pos2::new(bar.left() + 12.0, bar.top() + 6.0),
                Vec2::splat(crate::tokens::TASKBAR_BUTTON),
            );
            if taskbar_button(
                ui,
                theme,
                focus,
                TaskbarButton {
                    id: Id::new("socdof-taskbar-start"),
                    rect: start_rect,
                    icon: Icon::Grid,
                    logo: true,
                    label: texts.get("start_title"),
                    active: shell.start.is_open(),
                },
            ) {
                shell.toggle_start();
            }

            // The legacy bar puts the task view right behind the logo and paints it there
            // (`DesktopWindowWorkspace.tsx:4090`), before the app buttons.
            let mut x = start_rect.right() + 4.0;
            let task_view_rect = Rect::from_min_size(
                Pos2::new(x, bar.top() + 6.0),
                Vec2::splat(crate::tokens::TASKBAR_BUTTON),
            );
            x += crate::tokens::TASKBAR_BUTTON + 4.0;
            if bar.width() >= TASKBAR_SEARCH_MIN_WIDTH {
                let search_rect = Rect::from_min_size(
                    Pos2::new(x, bar.top() + 6.0),
                    Vec2::new(132.0, crate::tokens::TASKBAR_BUTTON),
                );
                if search_pill(ui, theme, focus, search_rect, texts.get("taskbar_search")) {
                    shell.open_palette();
                }
                x += 136.0;
            }
            // The right cluster is laid out from the clock inwards, exactly like the legacy bar:
            // the tray and task view always stay, the Studio button and the version pill only from
            // the search breakpoint up, and the overflow button only while apps are hidden. App
            // buttons that no longer fit are dropped instead of pushing the clock off the bar.
            let wide = bar.width() >= TASKBAR_SEARCH_MIN_WIDTH;
            let mut reserve = crate::tokens::TASKBAR_BUTTON + 4.0; // tray
            reserve += LANGUAGE_PILL_WIDTH + 8.0; // locale pill
            if wide {
                reserve += crate::tokens::TASKBAR_BUTTON + 4.0; // Studio
            }
            if bar.width() >= TASKBAR_STATUS_MIN_WIDTH {
                reserve += 90.0; // version pill
            }
            // The legacy bar always keeps the more button below the search breakpoint, where the
            // tray cluster collapses into the quick settings menu (`DesktopWindowWorkspace.tsx:4369`).
            if !wide || apps.len() > TASKBAR_COMPACT_APPS {
                reserve += 28.0 + 4.0; // overflow
            }
            let right_limit = clock_left - 10.0 - reserve;
            let max_apps = if wide {
                apps.len()
            } else {
                TASKBAR_COMPACT_APPS
            };
            for (index, (app, label, icon)) in apps.iter().enumerate() {
                if index >= max_apps || x + crate::tokens::TASKBAR_BUTTON > right_limit {
                    hidden.push((*app, label.clone()));
                    continue;
                }
                let rect = Rect::from_min_size(
                    Pos2::new(x, bar.top() + 6.0),
                    Vec2::splat(crate::tokens::TASKBAR_BUTTON),
                );
                x += crate::tokens::TASKBAR_BUTTON + 4.0;
                let id = Id::new(("socdof-taskbar-app", app.as_str()));
                let focused = focus.register(id);
                let response = ui.interact(rect, id, Sense::click());
                if response.clicked() {
                    focus.set_focus(Some(id));
                }
                let open = windows.is_open(*app);
                let active = windows.active() == Some(*app);
                painter.rect(
                    rect,
                    Rounding::same(RADIUS_CONTROL),
                    if active {
                        theme.accent.light
                    } else if response.hovered() || focused {
                        theme.palette.surface_muted
                    } else {
                        theme.palette.surface
                    },
                    Stroke::NONE,
                );
                if app.as_str() == "calendar" {
                    // `DynamicCalendarIcon size="sm"` in the legacy taskbar
                    // (`DesktopWindowWorkspace.tsx:4252`).
                    calendar_tile(
                        &painter,
                        Rect::from_center_size(
                            Pos2::new(rect.center().x, rect.center().y - 2.0),
                            Vec2::splat(24.0),
                        ),
                        theme,
                        now,
                        true,
                    );
                } else {
                    icon.draw(
                        &painter,
                        Rect::from_center_size(
                            Pos2::new(rect.center().x, rect.center().y - 2.0),
                            Vec2::splat(16.0),
                        ),
                        if active {
                            theme.accent_text()
                        } else {
                            theme.palette.text_muted
                        },
                        1.8,
                    );
                }
                if open {
                    painter.rect(
                        Rect::from_min_size(
                            Pos2::new(rect.center().x - 8.0, rect.bottom() - 6.0),
                            Vec2::new(16.0, 2.0),
                        ),
                        Rounding::same(1.0),
                        theme.accent.base,
                        Stroke::NONE,
                    );
                }
                if focused {
                    focus_ring(ui, theme, rect);
                }
                response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label.as_str()));
                if response.clicked() || focus.activate(id) {
                    if open {
                        windows.focus(*app);
                    } else {
                        activate_app(icons, windows, *app, area, now);
                    }
                    launched = Some(*app);
                }
            }

            let mut cursor = clock_left - 10.0 - (LANGUAGE_PILL_WIDTH + 8.0);
            let tray_rect = taskbar_slot(&mut cursor, crate::tokens::TASKBAR_BUTTON, bar);
            let overflow_rect = if !hidden.is_empty() || !wide {
                Some(taskbar_slot(&mut cursor, 28.0, bar))
            } else {
                None
            };
            if wide
                && taskbar_button(
                    ui,
                    theme,
                    focus,
                    TaskbarButton {
                        id: Id::new("socdof-taskbar-tray"),
                        rect: tray_rect,
                        icon: Icon::Bell,
                        logo: false,
                        label: texts.get("tray_title"),
                        active: shell.tray.is_open(),
                    },
                )
            {
                shell.toggle_tray();
            }

            if let Some(overflow_rect) = overflow_rect {
                let overflow_id = Id::new("socdof-taskbar-overflow");
                let overflow_focused = focus.register(overflow_id);
                let overflow_response = ui.interact(overflow_rect, overflow_id, Sense::click());
                painter.rect(
                    overflow_rect,
                    Rounding::same(RADIUS_CONTROL),
                    if shell.overflow.is_open() {
                        theme.accent.light
                    } else if overflow_response.hovered() || overflow_focused {
                        theme.palette.surface_muted
                    } else {
                        Color32::TRANSPARENT
                    },
                    Stroke::NONE,
                );
                for step in 0..3 {
                    painter.circle_filled(
                        Pos2::new(
                            overflow_rect.center().x - 5.0 + step as f32 * 5.0,
                            overflow_rect.center().y,
                        ),
                        1.7,
                        theme.palette.text_muted,
                    );
                }
                if overflow_focused {
                    focus_ring(ui, theme, overflow_rect);
                }
                overflow_response.widget_info(|| {
                    WidgetInfo::labeled(WidgetType::Button, texts.get("taskbar_more"))
                });
                let overflow_response = overflow_response.on_hover_text(texts.get("taskbar_more"));
                if overflow_response.clicked() || focus.activate(overflow_id) {
                    if hidden.is_empty() {
                        // Nothing is hidden, so the button stands for the collapsed tray cluster.
                        shell.toggle_tray();
                    } else {
                        shell.toggle_overflow();
                    }
                }
            }

            if bar.width() >= TASKBAR_STATUS_MIN_WIDTH {
                // The reference tray shows the notification bell and the brightness control in the
                // strip where this bar used to print its version pill.
                let slot = Rect::from_min_size(
                    Pos2::new(right_limit + 3.0, bar.top() + 6.0),
                    Vec2::new(84.0, crate::tokens::TASKBAR_BUTTON),
                );
                // The tray already carries the notification bell, so this strip only adds the
                // brightness control the reference bar shows next to it.
                for (index, (icon, id)) in [(Icon::Sun, "socdof-taskbar-brightness")]
                    .into_iter()
                    .enumerate()
                {
                    let rect = Rect::from_min_size(
                        Pos2::new(
                            slot.left() + index as f32 * (slot.width() * 0.5),
                            slot.top(),
                        ),
                        Vec2::new(slot.width() * 0.5, slot.height()),
                    );
                    let id = Id::new(id);
                    let focused = focus.register(id);
                    let response = ui.interact(rect, id, Sense::click());
                    if response.hovered() || focused {
                        painter.rect(
                            rect.shrink(2.0),
                            Rounding::same(RADIUS_CONTROL),
                            theme.palette.surface_muted,
                            Stroke::NONE,
                        );
                    }
                    if focused {
                        focus_ring(ui, theme, rect);
                    }
                    icon.draw(
                        &painter,
                        Rect::from_center_size(rect.center(), Vec2::splat(16.0)),
                        theme.palette.text_muted,
                        1.8,
                    );
                    response.on_hover_text(texts.get("taskbar_status"));
                }
            }

            let task_view_id = Id::new("socdof-taskbar-taskview");
            let task_view_focused = focus.register(task_view_id);
            let task_view_response = ui.interact(task_view_rect, task_view_id, Sense::click());
            let task_view_active = shell.task_view.is_open();
            painter.rect(
                task_view_rect,
                Rounding::same(RADIUS_CONTROL),
                if task_view_active {
                    theme.accent.light
                } else if task_view_response.hovered() || task_view_focused {
                    theme.palette.surface_muted
                } else {
                    Color32::TRANSPARENT
                },
                Stroke::NONE,
            );
            // Two 12 point squares in a 16 point box, exactly the overlapping rectangles of the
            // legacy task view icon (`DesktopWindowWorkspace.tsx:4120`): translucent back, solid
            // front.
            let glyph = Rect::from_center_size(task_view_rect.center(), Vec2::splat(16.0));
            let (back_stroke, back_fill, front_stroke, front_fill) = if task_view_active {
                (
                    theme.accent_text(),
                    Color32::TRANSPARENT,
                    theme.accent_text(),
                    Color32::TRANSPARENT,
                )
            } else if theme.appearance.is_dark() {
                (
                    Color32::from_white_alpha(128),
                    Color32::from_white_alpha(26),
                    Color32::WHITE,
                    Color32::from_rgb(0x1e, 0x29, 0x3b),
                )
            } else {
                (
                    Color32::from_rgb(0x64, 0x74, 0x8b).linear_multiply(0.7),
                    Color32::from_rgb(0x94, 0xa3, 0xb8).linear_multiply(0.2),
                    Color32::from_rgb(0x1e, 0x29, 0x3b),
                    Color32::from_rgb(0xe2, 0xe8, 0xf0).linear_multiply(0.9),
                )
            };
            painter.rect(
                Rect::from_min_size(glyph.min, Vec2::splat(12.0)),
                Rounding::same(3.0),
                back_fill,
                Stroke::new(1.5_f32, back_stroke),
            );
            painter.rect(
                Rect::from_min_size(glyph.min + Vec2::splat(4.0), Vec2::splat(12.0)),
                Rounding::same(3.0),
                front_fill,
                Stroke::new(1.5_f32, front_stroke),
            );
            if task_view_focused {
                focus_ring(ui, theme, task_view_rect);
            }
            task_view_response.widget_info(|| {
                WidgetInfo::labeled(WidgetType::Button, texts.get("taskbar_task_view"))
            });
            if task_view_response.clicked() || focus.activate(task_view_id) {
                shell.task_view.toggle();
            }
        });
    if let Some(app) = launched {
        outcome.open_app = Some(app);
    }

    if shell.overflow.is_open() {
        if ctx.input(|input| input.key_pressed(Key::Escape)) {
            shell.overflow.close();
        }
        let mut launch: Option<AppId> = None;
        let mut close = false;
        egui::Area::new(Id::new("socdof-taskbar-overflow-menu"))
            .order(egui::Order::Foreground)
            .anchor(
                Align2::RIGHT_BOTTOM,
                Vec2::new(-12.0, -(TASKBAR_HEIGHT + 8.0)),
            )
            .show(ctx, |ui| {
                egui::Frame::none()
                    .fill(with_alpha(theme.palette.surface, 96))
                    .stroke(Stroke::new(1.0_f32, theme.palette.border))
                    .rounding(Rounding::same(RADIUS_CARD))
                    .inner_margin(egui::Margin::same(12.0))
                    .show(ui, |ui| {
                        ui.set_width(200.0);
                        ui.label(
                            RichText::new(texts.get("taskbar_more"))
                                .size(FONT_SMALL)
                                .family(crate::theme::semibold())
                                .color(theme.palette.text_muted),
                        );
                        ui.add_space(6.0);
                        ui.vertical(|ui| {
                            for (app, label) in &hidden {
                                if button(ui, theme, focus, label, ButtonVariant::Ghost).activated {
                                    launch = Some(*app);
                                }
                            }
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("window_close_cancel"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                close = true;
                            }
                        });
                    });
            });
        if close {
            shell.overflow.close();
        }
        if let Some(app) = launch {
            if windows.is_open(app) {
                windows.focus(app);
            } else {
                activate_app(icons, windows, app, area, now);
            }
            outcome.open_app = Some(app);
            shell.overflow.close();
        }
    }

    if shell.task_view.is_open() {
        if ctx.input(|input| input.key_pressed(Key::Escape)) {
            shell.task_view.close();
        }
        let mut focus_app: Option<AppId> = None;
        let mut close = false;
        egui::Area::new(Id::new("socdof-task-view"))
            .order(egui::Order::Foreground)
            .anchor(Align2::CENTER_CENTER, Vec2::ZERO)
            .show(ctx, |ui| {
                egui::Frame::none()
                    .fill(with_alpha(theme.palette.surface, 96))
                    .stroke(Stroke::new(1.0_f32, theme.palette.border))
                    .rounding(Rounding::same(RADIUS_DIALOG))
                    .inner_margin(egui::Margin::same(16.0))
                    .show(ui, |ui| {
                        ui.set_width(320.0);
                        ui.label(
                            RichText::new(texts.get("task_view_title"))
                                .size(16.0)
                                .strong(),
                        );
                        ui.add_space(8.0);
                        let open: Vec<(AppId, String)> = windows
                            .windows()
                            .iter()
                            .filter(|window| !window.is_minimized())
                            .map(|window| (window.app(), window.title().to_owned()))
                            .collect();
                        if open.is_empty() {
                            ui.label(
                                RichText::new(texts.get("task_view_empty"))
                                    .size(FONT_SMALL)
                                    .color(theme.palette.text_muted),
                            );
                        }
                        for (app, title) in open {
                            if button(ui, theme, focus, &title, ButtonVariant::Secondary).activated
                            {
                                focus_app = Some(app);
                            }
                        }
                        ui.add_space(8.0);
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("window_close_cancel"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            close = true;
                        }
                    });
            });
        if close {
            shell.task_view.close();
        }
        if let Some(app) = focus_app {
            if windows.focus(app) {
                // The task view can reorder windows without opening a new app.
                outcome.window_layout_changed = true;
            }
            shell.task_view.close();
        }
    }

    if !shell.overlay_open() && !shell.studio.is_open() && !windows.dialog_open() {
        // The reference desktop owns one window control cluster for the whole screen: minimizing
        // reduces the focused module window, fullscreen toggles the native window and closing locks
        // the session, which is the reference's standby state.
        let control = desktop_controls(ctx, theme, texts, focus, screen);
        if control.fullscreen {
            toggle_fullscreen(ctx);
        }
        if control.minimize {
            let fullscreen = ctx.input(|input| input.viewport().fullscreen.unwrap_or(false));
            if fullscreen {
                ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(false));
            } else if let Some(active) = windows.active() {
                if windows.minimize(active) {
                    outcome.window_layout_changed = true;
                }
            } else {
                ctx.send_viewport_cmd(egui::ViewportCommand::Minimized(true));
            }
        }
        if control.close {
            outcome.lock = true;
        }
    }

    let mut dialog = false;
    if let Some(app) = windows.pending_close() {
        dialog = true;
        if !focus.is_overlay_open() {
            focus.open_overlay_for(
                Id::new("socdof-desktop-close-dialog"),
                Id::new("socdof-taskbar"),
            );
        }
        let title = windows
            .window(app)
            .map(|window| window.title().to_owned())
            .unwrap_or_default();
        let body = format!("{} {}", texts.get("window_close_body"), title);
        let mut visible = true;
        let mut confirm = false;
        let mut cancel = false;
        focus.collecting(true);
        modal(
            ctx,
            theme,
            &mut visible,
            texts.get("window_close_title"),
            |ui| {
                ui.label(body);
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("window_close_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("window_close_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        cancel = true;
                    }
                });
                confirm || cancel
            },
        );
        focus.collecting(false);
        if confirm {
            if windows.confirm_close(now).is_some() {
                outcome.window_layout_changed = true;
            }
        } else if cancel || focus.escape() || !visible {
            windows.cancel_close();
        }
        focus.close_overlay();
        focus.set_focus(None);
    } else if windows.pending_open().is_some() {
        dialog = true;
        if !focus.is_overlay_open() {
            focus.open_overlay_for(
                Id::new("socdof-desktop-reopen-dialog"),
                Id::new("socdof-taskbar"),
            );
        }
        let title = windows.pending_open_title().unwrap_or_default().to_owned();
        let body = format!("{} {}", texts.get("window_reopen_body"), title);
        let mut visible = true;
        let mut confirm = false;
        let mut cancel = false;
        focus.collecting(true);
        modal(
            ctx,
            theme,
            &mut visible,
            texts.get("window_reopen_title"),
            |ui| {
                ui.label(body);
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("window_reopen_confirm"),
                        ButtonVariant::Primary,
                    )
                    .activated
                    {
                        confirm = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("window_reopen_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        cancel = true;
                    }
                });
                confirm || cancel
            },
        );
        focus.collecting(false);
        if confirm {
            windows.confirm_open();
        } else if cancel || focus.escape() || !visible {
            windows.cancel_open();
        }
        focus.close_overlay();
        focus.set_focus(None);
    }

    // Reapply a user's last window geometry after the window manager creates or focuses it.
    // This happens after input handling so both desktop icons and taskbar/overflow launches use
    // the same restore path.
    if let (Some(app), Some(user_id)) = (outcome.open_app, current_user) {
        if let Ok(layout) = socdof_core::settings_service::desktop_layout(store, user_id) {
            if let Some(saved) = layout.window_states.get(app.as_str()) {
                let rect = Rect::from_min_size(
                    Pos2::new(saved.x as f32, saved.y as f32),
                    Vec2::new(saved.width as f32, saved.height as f32),
                );
                windows.restore_geometry(app, rect, saved.maximized, area);
            }
        }
    }
    if outcome.open_app.is_some() {
        // Opening or focusing a window must persist its open state, even before it is moved.
        outcome.window_layout_changed = true;
    }

    if outcome.open_studio {
        outcome.open_studio = false;
        shell.studio.open(store);
    }
    if let Some(tab) = outcome.studio_tab.take() {
        shell.studio.set_tab(tab);
    }

    // The legacy desktop has no floating back button: Escape and the start menu's "close desktop"
    // entry leave the desktop, and the top right corner belongs to the window controls.
    if !dialog && !shell.overlay_open() && focus.escape() {
        outcome.back = true;
    }
    outcome
}

/// Applies a shell command to the desktop state.
fn apply_action(
    action: ShellAction,
    shell: &mut ShellState,
    icons: &IconGrid,
    windows: &mut WindowManager,
    area: Rect,
    now: i64,
    outcome: &mut DesktopOutcome,
) {
    match action {
        ShellAction::OpenApp(app) => {
            shell.close_overlays();
            activate_app(icons, windows, app, area, now);
            outcome.open_app = Some(app);
        }
        ShellAction::ToggleTheme => {
            shell.close_overlays();
            outcome.toggle_theme = true;
        }
        ShellAction::NextWallpaper => {
            shell.wallpaper.next();
            shell.close_overlays();
        }
        ShellAction::ShowOnboarding => {
            shell.close_overlays();
            shell.onboarding.restart();
        }
        ShellAction::CloseDesktop => {
            shell.close_overlays();
            outcome.back = true;
        }
        ShellAction::OpenStudio => {
            shell.close_overlays();
            outcome.open_studio = true;
        }
        ShellAction::OpenLayout => {
            shell.close_overlays();
            outcome.open_studio = true;
            outcome.studio_tab = Some(crate::studio::StudioTab::Layout);
        }
        ShellAction::Lock => {
            shell.close_overlays();
            outcome.lock = true;
        }
        ShellAction::SignOut => {
            shell.close_overlays();
            outcome.sign_out = true;
        }
    }
}

/// Opens the window of an app or raises it; the grid label becomes the title.
fn activate_app(
    icons: &IconGrid,
    windows: &mut WindowManager,
    app: AppId,
    work_area: Rect,
    now: i64,
) {
    if windows.is_open(app) {
        windows.focus(app);
        return;
    }
    let title = icons
        .label_of(app)
        .unwrap_or_else(|| app.as_str())
        .to_owned();
    let rect = default_window_rect(work_area, windows.windows().len());
    windows.open(Window::new(app, title, rect), now);
}

/// Draws the taskbar search pill and reports whether it was activated.
fn search_pill(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    rect: Rect,
    label: &str,
) -> bool {
    let id = Id::new("socdof-taskbar-search");
    let focused = focus.register(id);
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    let painter = ui.painter().clone();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CONTROL),
        if response.hovered() || focused {
            theme.palette.surface_muted
        } else {
            with_alpha(theme.palette.surface_muted, 70)
        },
        Stroke::new(1.0_f32, theme.palette.border),
    );
    Icon::Search.draw(
        &painter,
        Rect::from_center_size(
            Pos2::new(rect.left() + 16.0, rect.center().y),
            Vec2::splat(16.0),
        ),
        theme.accent_text(),
        1.5,
    );
    let galley = painter.layout_no_wrap(
        label.to_owned(),
        FontId::proportional(FONT_SMALL),
        theme.palette.text_muted,
    );
    painter.galley(
        Pos2::new(rect.left() + 30.0, rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text_muted,
    );
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.clicked() || keyboard
}

/// Geometry and label of one taskbar button.
struct TaskbarButton<'a> {
    id: Id,
    rect: Rect,
    icon: Icon,
    /// Draws the SOCDOF mark instead of `icon`, like the start button of the legacy taskbar.
    logo: bool,
    label: &'a str,
    active: bool,
}

/// Reserves one button of the right taskbar cluster, laying the cluster out from right to left.
///
/// The legacy bar anchors tray, task view and clock to the right edge and lets the app row shrink,
/// so the buttons are reserved from the clock inwards instead of using fixed offsets.
fn taskbar_slot(cursor: &mut f32, width: f32, bar: Rect) -> Rect {
    let rect = Rect::from_min_size(
        Pos2::new(*cursor - width, bar.top() + 6.0),
        Vec2::new(width, crate::tokens::TASKBAR_BUTTON),
    );
    *cursor = rect.left() - 4.0;
    rect
}

/// Draws one taskbar button (start menu, tray) and reports whether it was activated.
fn taskbar_button(
    ui: &mut egui::Ui,
    theme: &Theme,
    focus: &mut FocusState,
    button: TaskbarButton<'_>,
) -> bool {
    let TaskbarButton {
        id,
        rect,
        icon,
        logo,
        label,
        active,
    } = button;
    let focused = focus.register(id);
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    ui.painter().rect(
        rect,
        Rounding::same(RADIUS_CONTROL),
        if active {
            theme.accent.light
        } else if response.hovered() || focused {
            theme.palette.surface_muted
        } else {
            theme.palette.surface
        },
        Stroke::NONE,
    );
    if logo {
        crate::icons::draw_logo(
            ui.painter(),
            Rect::from_center_size(rect.center(), Vec2::splat(28.0)),
        );
    } else {
        icon.draw(
            ui.painter(),
            Rect::from_center_size(rect.center(), Vec2::splat(20.0)),
            if active {
                theme.accent_text()
            } else {
                theme.palette.text
            },
            1.5,
        );
    }
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Draws one window chrome button and reports whether it was activated.
fn chrome_button(
    ui: &mut egui::Ui,
    theme: &Theme,
    focus: &mut FocusState,
    id: Id,
    rect: Rect,
    icon: Icon,
    label: &str,
) -> bool {
    let focused = focus.register(id);
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    if response.hovered() || focused || activated {
        ui.painter()
            .rect(rect, Rounding::same(6.0), theme.accent.light, Stroke::NONE);
    }
    let color = if response.hovered() || focused {
        theme.accent_text()
    } else {
        theme.palette.text
    };
    icon.draw(
        ui.painter(),
        Rect::from_center_size(rect.center(), Vec2::splat(14.0)),
        color,
        1.5,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    activated
}

/// Moves a rectangle inside a work area, shrinking it if it is larger than the area.
fn clamp_rect(rect: Rect, area: Rect) -> Rect {
    let size = Vec2::new(
        rect.width().min(area.width()).max(0.0),
        rect.height().min(area.height()).max(0.0),
    );
    let x = rect.min.x.min(area.max.x - size.x).max(area.min.x);
    let y = rect.min.y.min(area.max.y - size.y).max(area.min.y);
    Rect::from_min_size(Pos2::new(x, y), size)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_positions_override_the_grid() {
        let mut grid = IconGrid::new(vec![DesktopIcon::new(
            AppId::new("contacts"),
            "Kontakte",
            Icon::User,
        )]);
        assert!(grid.icons()[0].pos().is_none());
        assert!(grid.place_at(AppId::new("contacts"), Pos2::new(300.0, 240.0)));
        assert_eq!(grid.icons()[0].pos(), Some(Pos2::new(300.0, 240.0)));
        assert!(!grid.place_at(AppId::new("missing"), Pos2::new(0.0, 0.0)));
    }

    #[test]
    fn layout_templates_keep_only_their_apps() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("pos"), "Kasse", Icon::User),
            DesktopIcon::new(AppId::new("editor"), "Texteditor", Icon::User),
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
        ]);
        grid.retain_apps(&["pos", "contacts"]);
        let apps: Vec<&str> = grid
            .icons()
            .iter()
            .map(|icon| icon.app().as_str())
            .collect();
        assert_eq!(apps, vec!["pos", "contacts"]);
        assert_eq!(grid.icons()[0].cell(), (0, 0));
        assert_eq!(grid.icons()[1].cell(), (0, 1));
    }
    use crate::shell::Onboarding;
    use socdof_core::domain::settings::Language;

    fn area() -> Rect {
        Rect::from_min_size(Pos2::ZERO, Vec2::new(1440.0, 852.0))
    }

    fn window(app: &'static str, index: usize) -> Window {
        Window::new(AppId::new(app), app, default_window_rect(area(), index))
    }

    #[test]
    fn opening_and_focusing_raises_the_window() {
        let mut manager = WindowManager::new();
        assert_eq!(
            manager.open(window("contacts", 0), 1_000),
            OpenOutcome::Opened
        );
        assert_eq!(
            manager.open(window("invoices", 1), 1_000),
            OpenOutcome::Opened
        );
        assert_eq!(manager.active(), Some(AppId::new("invoices")));

        assert!(manager.focus(AppId::new("contacts")));
        let order: Vec<AppId> = manager.windows().iter().map(|w| w.app()).collect();
        assert_eq!(order, vec![AppId::new("invoices"), AppId::new("contacts")]);
        assert_eq!(manager.active(), Some(AppId::new("contacts")));
    }

    #[test]
    fn minimizing_hands_the_focus_to_the_next_visible_window() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.open(window("invoices", 1), 1_000);
        manager.minimize(AppId::new("invoices"));

        assert!(manager
            .window(AppId::new("invoices"))
            .expect("window")
            .is_minimized());
        assert_eq!(manager.active(), Some(AppId::new("contacts")));
        assert!(manager.restore(AppId::new("invoices")));
        assert!(!manager
            .window(AppId::new("invoices"))
            .expect("window")
            .is_minimized());
        assert_eq!(manager.active(), Some(AppId::new("invoices")));
    }

    #[test]
    fn restoring_saved_geometry_preserves_maximize_restore_rectangle() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        let saved = Rect::from_min_size(Pos2::new(120.0, 90.0), Vec2::new(920.0, 640.0));

        manager.restore_geometry(AppId::new("contacts"), saved, true, area());
        let restored = manager.window(AppId::new("contacts")).expect("window");
        assert_eq!(restored.rect(), area());
        assert!(restored.is_maximized());
        assert_eq!(restored.normal_rect(), saved);

        manager.toggle_maximize(AppId::new("contacts"), area());
        assert_eq!(
            manager
                .window(AppId::new("contacts"))
                .expect("window")
                .rect(),
            saved
        );
    }

    #[test]
    fn restored_window_geometry_is_clamped_to_the_current_work_area() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        let offscreen = Rect::from_min_size(Pos2::new(-500.0, -400.0), Vec2::new(2_000.0, 1_500.0));

        manager.restore_geometry(AppId::new("contacts"), offscreen, false, area());
        assert_eq!(
            manager
                .window(AppId::new("contacts"))
                .expect("window")
                .rect(),
            area()
        );
    }

    #[test]
    fn focus_next_cycles_visible_windows_and_skips_minimized_windows() {
        let mut manager = WindowManager::new();
        let contacts = AppId::new("contacts");
        let invoices = AppId::new("invoices");
        let settings = AppId::new("settings");
        manager.open(window("contacts", 0), 1_000);
        manager.open(window("invoices", 0), 1_000);
        manager.open(window("settings", 0), 1_000);
        manager.minimize(invoices);

        assert_eq!(manager.focus_next(), Some(contacts));
        assert_eq!(manager.active(), Some(contacts));
        assert_eq!(manager.focus_next(), Some(settings));
        assert_eq!(manager.active(), Some(settings));
        assert_eq!(manager.focus_next(), Some(contacts));
    }

    #[test]
    fn focus_next_does_not_escape_a_modal_window_confirmation() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.open(window("invoices", 0), 1_000);
        manager.request_close(AppId::new("invoices"));

        assert_eq!(manager.focus_next(), None);
        assert_eq!(manager.active(), Some(AppId::new("invoices")));
        assert!(manager.dialog_open());
    }

    #[test]
    fn maximize_remembers_and_restores_the_rectangle() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        let original = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        manager.toggle_maximize(AppId::new("contacts"), area());
        let maximized = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert_eq!(maximized, area());
        assert!(manager
            .window(AppId::new("contacts"))
            .expect("window")
            .is_maximized());

        manager.toggle_maximize(AppId::new("contacts"), area());
        assert_eq!(
            manager
                .window(AppId::new("contacts"))
                .expect("window")
                .rect(),
            original
        );
        assert!(!manager
            .window(AppId::new("contacts"))
            .expect("window")
            .is_maximized());
    }

    #[test]
    fn snapping_fills_each_half_of_the_work_area() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.snap(AppId::new("contacts"), SnapEdge::Left, area());
        let left = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert_eq!(left.width(), area().width() / 2.0);
        assert_eq!(left.min, area().min);

        manager.snap(AppId::new("contacts"), SnapEdge::Right, area());
        let right = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert_eq!(right.max, area().max);
    }

    #[test]
    fn moving_and_resizing_stays_inside_the_work_area() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.move_by(
            AppId::new("contacts"),
            Vec2::new(-10_000.0, -10_000.0),
            area(),
        );
        let moved = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert_eq!(moved.min, area().min);

        manager.move_by(
            AppId::new("contacts"),
            Vec2::new(10_000.0, 10_000.0),
            area(),
        );
        let far = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert!(area().contains_rect(far));

        manager.resize_by(
            AppId::new("contacts"),
            Vec2::new(-10_000.0, -10_000.0),
            area(),
        );
        let small = manager
            .window(AppId::new("contacts"))
            .expect("window")
            .rect();
        assert_eq!(small.width(), WINDOW_MIN_WIDTH);
        assert_eq!(small.height(), WINDOW_MIN_HEIGHT);
    }

    #[test]
    fn closing_asks_again_within_the_cooldown() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.close(AppId::new("contacts"), 1_000);
        assert!(!manager.is_open(AppId::new("contacts")));

        assert!(!manager.can_reopen(AppId::new("contacts"), 2_000));
        assert_eq!(
            manager.open(window("contacts", 0), 2_000),
            OpenOutcome::ConfirmReopen {
                remaining_ms: 2_000
            }
        );
        assert!(!manager.is_open(AppId::new("contacts")));
        assert_eq!(manager.pending_open(), Some(AppId::new("contacts")));

        assert!(manager.confirm_open());
        assert!(manager.is_open(AppId::new("contacts")));
        assert!(manager.can_reopen(AppId::new("contacts"), 4_000));
    }

    #[test]
    fn a_close_prompt_traps_the_focus() {
        let mut manager = WindowManager::new();
        manager.open(window("contacts", 0), 1_000);
        manager.open(window("invoices", 1), 1_000);
        assert!(manager.request_close(AppId::new("contacts")));
        assert!(manager.dialog_open());

        assert!(!manager.focus(AppId::new("invoices")));
        assert_eq!(manager.active(), Some(AppId::new("invoices")));

        manager.cancel_close();
        assert!(!manager.dialog_open());
        assert!(manager.focus(AppId::new("invoices")));

        manager.request_close(AppId::new("contacts"));
        assert_eq!(manager.confirm_close(2_000), Some(AppId::new("contacts")));
        assert!(!manager.is_open(AppId::new("contacts")));
        assert!(!manager.dialog_open());
    }

    #[test]
    fn icon_grid_assigns_cells_in_reading_order() {
        let grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
            DesktopIcon::new(AppId::new("invoices"), "Rechnungen", Icon::Calendar),
        ]);
        assert_eq!(grid.icons()[0].cell(), (0, 0));
        assert_eq!(grid.icons()[1].cell(), (0, 1));
        assert_eq!(grid.icons()[2].cell(), (0, 2));
    }

    #[test]
    fn dropping_an_icon_never_stacks_it_on_another() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
        ]);
        let target = grid.move_to(AppId::new("products"), (0, 0));
        assert_eq!(target, Some((0, 1)));
        assert_ne!(grid.icons()[0].cell(), grid.icons()[1].cell());

        grid.restore_positions(&[(AppId::new("contacts"), (3, 2))]);
        assert_eq!(grid.icons()[0].cell(), (3, 2));
        assert_eq!(
            grid.positions(),
            vec![
                (AppId::new("contacts"), (3, 2)),
                (AppId::new("products"), (0, 1))
            ]
        );
    }

    #[test]
    fn restoring_untrusted_icon_positions_clamps_and_avoids_collisions() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
        ]);
        grid.restore_positions(&[
            (AppId::new("contacts"), (99, 999)),
            (AppId::new("products"), (5, 255)),
        ]);

        assert_eq!(grid.icons()[0].cell(), (12, 5));
        assert_eq!(grid.icons()[1].cell(), (5, 5));
        assert_ne!(grid.icons()[0].cell(), grid.icons()[1].cell());
    }

    #[test]
    fn arrow_navigation_wraps_around_the_grid() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("a"), "a", Icon::User),
            DesktopIcon::new(AppId::new("b"), "b", Icon::User),
            DesktopIcon::new(AppId::new("c"), "c", Icon::User),
            DesktopIcon::new(AppId::new("d"), "d", Icon::User),
            DesktopIcon::new(AppId::new("e"), "e", Icon::User),
            DesktopIcon::new(AppId::new("f"), "f", Icon::User),
            DesktopIcon::new(AppId::new("g"), "g", Icon::User),
            DesktopIcon::new(AppId::new("h"), "h", Icon::User),
        ]);
        // Down moves to the next row, right to the same row of the next column.
        grid.step(0, 1);
        assert_eq!(grid.selected(), 1);
        grid.step(1, 0);
        assert_eq!(grid.selected(), 7);
        grid.step(0, -1);
        assert_eq!(grid.selected(), 6);
        grid.step(-1, 0);
        assert_eq!(grid.selected(), 0);
        grid.step(0, -1);
        assert_eq!(grid.selected(), 7);
        grid.select(99);
        assert_eq!(grid.selected(), 7);
    }

    #[test]
    fn the_compact_grid_matches_the_legacy_phone_layout() {
        let desktop = Rect::from_min_size(Pos2::ZERO, Vec2::new(432.0, 723.0));
        let first = IconGrid::cell_rect(desktop, (0, 0));
        assert_eq!((first.left(), first.top()), (40.0, 16.0));
        assert_eq!(first.center().x, 88.0, "tile centre of the first column");
        assert_eq!(IconGrid::cell_rect(desktop, (0, 1)).left(), 176.0);
        assert_eq!(IconGrid::cell_rect(desktop, (0, 2)).left(), 312.0);
        let second_row = IconGrid::cell_rect(desktop, (0, 3));
        assert_eq!((second_row.left(), second_row.top()), (40.0, 130.0));
        let grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("a"), "a", Icon::User),
            DesktopIcon::new(AppId::new("b"), "b", Icon::User),
            DesktopIcon::new(AppId::new("c"), "c", Icon::User),
            DesktopIcon::new(AppId::new("d"), "d", Icon::User),
        ]);
        assert_eq!(grid.cell_at(desktop, Pos2::new(88.0, 40.0)), (0, 0));
        assert_eq!(grid.cell_at(desktop, Pos2::new(224.0, 40.0)), (0, 1));
        assert_eq!(grid.cell_at(desktop, Pos2::new(88.0, 154.0)), (0, 3));
        assert_eq!(IconGrid::columns(desktop), COMPACT_COLUMNS);
    }

    #[test]
    fn the_calendar_tile_shows_the_legacy_date() {
        // 2026-11-19T15:00:00Z, the Thursday the reference tile shows as "THU 19".
        let millis = 1_795_100_400_000;
        assert_eq!(day_of_month(millis), 19);
        assert_eq!(weekday_short(millis), "THU");
        assert_eq!(day_of_month(0), 1, "the epoch is a first of the month");
        assert_eq!(weekday_short(0), "THU");
    }

    #[test]
    fn cell_hit_testing_maps_a_pointer_to_the_nearest_cell() {
        let grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
        ]);
        for cell in [(0, 0), (1, 0), (2, 1), (3, 2)] {
            let center = IconGrid::cell_rect(area(), cell).center();
            assert_eq!(grid.cell_at(area(), center), cell);
        }
        let columns = IconGrid::columns(area());
        assert!(columns >= 2);
        assert_eq!(
            grid.cell_at(area(), Pos2::new(5_000.0, 5_000.0)).0,
            columns - 1
        );
    }

    #[test]
    fn a_legacy_row_first_layout_restores_into_the_column_grid() {
        use socdof_core::settings_service::{self, DESKTOP_LAYOUT_PREFIX};
        let store = SocdofStore::open_in_memory().expect("store");
        let user = uuid::Uuid::new_v4();
        let legacy = serde_json::json!({
            "icon_positions": {
                "contacts": [0, 0],
                "products": [1, 0],
                "invoices": [2, 0],
                "settings": [0, 1]
            }
        });
        store
            .put_setting(&format!("{DESKTOP_LAYOUT_PREFIX}{user}"), &legacy)
            .expect("legacy layout stored");
        let layout = settings_service::desktop_layout(&store, user).expect("layout");
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
            DesktopIcon::new(AppId::new("invoices"), "Rechnungen", Icon::Calendar),
            DesktopIcon::new(AppId::new("settings"), "Einstellungen", Icon::Settings),
        ]);
        let positions = grid
            .icons()
            .iter()
            .filter_map(|icon| {
                layout
                    .icon_positions
                    .get(icon.app().as_str())
                    .map(|cell| (icon.app(), *cell))
            })
            .collect::<Vec<_>>();
        grid.restore_positions(&positions);
        // Row-first cells transpose into the column-first grid: the reading order survives and no
        // icon ends up outside the six row column block.
        assert_eq!(grid.icons()[0].cell(), (0, 0));
        assert_eq!(grid.icons()[1].cell(), (0, 1));
        assert_eq!(grid.icons()[2].cell(), (0, 2));
        assert_eq!(grid.icons()[3].cell(), (1, 0));
        for icon in grid.icons() {
            assert!(icon.cell().1 < ICON_ROWS);
        }
    }

    #[test]
    fn the_window_controls_sit_in_the_top_right_corner() {
        let screen = Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0));
        let bar = controls_rect(screen);
        assert_eq!(bar.right(), screen.right());
        assert_eq!(bar.top(), screen.top());
        assert_eq!(bar.width(), DESKTOP_CONTROL_WIDTH * 3.0);
        assert_eq!(bar.height(), DESKTOP_CONTROL_HEIGHT);
        assert!(bar.max.y <= TASKBAR_HEIGHT.max(bar.max.y));
    }

    #[test]
    fn the_clock_is_a_stable_utc_label() {
        assert_eq!(format_clock(0), "00:00");
        assert_eq!(format_clock(1_000_000_000), "13:46");
        assert_eq!(format_clock(86_399_000), "23:59");
        assert_eq!(format_clock_12h(0), "12:00 AM");
        assert_eq!(format_clock_12h(1_000_000_000), "01:46 PM");
        assert_eq!(format_clock_12h(86_399_000), "11:59 PM");
        assert_eq!(format_clock_seconds(0), "12:00:00 AM");
        assert_eq!(format_clock_seconds(1_000_000_000), "01:46:40 PM");
        assert_eq!(format_clock_seconds(13_200_000), "03:40:00 AM");
    }

    #[test]
    fn the_desktop_draws_without_a_display() {
        let ctx = crate::theme::headless_context();
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let mut focus = FocusState::default();
        let mut icons = IconGrid::new(vec![
            DesktopIcon::new(
                AppId::new("contacts"),
                texts.get("app_contacts"),
                Icon::User,
            ),
            DesktopIcon::new(
                AppId::new("products"),
                texts.get("app_products"),
                Icon::Folder,
            ),
        ]);
        let mut windows = WindowManager::new();
        windows.open(window("contacts", 0), 1_000);
        windows.open(window("invoices", 1), 1_000);
        let mut shell = ShellState::new();
        shell.onboarding = Onboarding::restore(true);
        let store = SocdofStore::open_in_memory().expect("store");
        let input = egui::RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280.0, 800.0))),
            time: Some(1.0),
            ..Default::default()
        };
        let mut rendered_apps = Vec::new();
        let output = ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            theme.apply(ctx);
            let outcome = desktop_with_content(
                ctx,
                DesktopFrame {
                    theme: &theme,
                    texts: &texts,
                    shell: &mut shell,
                    store: &store,
                    current_user: None,
                },
                &mut focus,
                &mut icons,
                &mut windows,
                1_000,
                |app, _is_active, ui, _ctx, _theme, _texts, _focus, _store, _now| {
                    rendered_apps.push(app.as_str());
                    ui.label(format!("native content: {}", app.as_str()));
                    app.as_str() == "contacts"
                },
            );
            assert!(!outcome.back);
            focus.finish_frame();
        });
        assert!(output.shapes.len() > 40, "desktop drew little");
        assert!(rendered_apps.contains(&"contacts"));
        assert!(rendered_apps.contains(&"invoices"));
        assert!(!windows.is_open(AppId::new("contacts")));
        assert!(windows.is_open(AppId::new("invoices")));
    }
}
