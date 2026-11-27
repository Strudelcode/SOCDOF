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
    command_palette, onboarding, start_menu, tray_flyout, AccountEntry, PaletteQuickAction,
    ShellAction, ShellState, StartMenuChoice,
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
/// (`DesktopWindowWorkspace.tsx:2914`); the cell itself is 96 points wide. The wrap width uses the
/// whole cell so "Taschenrechner" stays on one line instead of breaking inside the word.
pub const ICON_LABEL_WIDTH: f32 = 94.0;
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
    desktop: Option<String>,
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
            desktop: None,
        }
    }

    /// Files the window on a virtual desktop; `None` shows it on every desktop.
    pub fn on_desktop(mut self, desktop: Option<String>) -> Self {
        self.desktop = desktop;
        self
    }

    /// Virtual desktop the window was filed on.
    pub fn desktop(&self) -> Option<&str> {
        self.desktop.as_deref()
    }

    /// Files the window on another virtual desktop.
    pub fn set_desktop(&mut self, desktop: Option<String>) {
        self.desktop = desktop;
    }

    /// Whether the window is visible on a desktop.
    ///
    /// A window without a desktop, or one filed on `all`, is shown on every desktop, like the
    /// reference workspace.
    pub fn is_on(&self, desktop: &str) -> bool {
        match self.desktop() {
            None => true,
            Some(filed) => {
                filed == socdof_core::settings_service::DESKTOP_ALL_ID || filed == desktop
            }
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
#[derive(Debug, Clone)]
pub struct WindowManager {
    windows: Vec<Window>,
    active: Option<AppId>,
    pending_close: Option<AppId>,
    pending_open: Option<Window>,
    last_closed: Option<(AppId, i64)>,
    current_desktop: String,
}

impl Default for WindowManager {
    fn default() -> Self {
        Self {
            windows: Vec::new(),
            active: None,
            pending_close: None,
            pending_open: None,
            last_closed: None,
            current_desktop: "desktop-1".to_string(),
        }
    }
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

    /// Virtual desktop new windows are filed on.
    pub fn current_desktop(&self) -> &str {
        &self.current_desktop
    }

    /// Points new windows at the active virtual desktop.
    pub fn set_current_desktop(&mut self, desktop: &str) {
        if self.current_desktop != desktop {
            self.current_desktop = desktop.to_owned();
        }
    }

    /// Windows shown on a desktop, back to front, minimized ones included.
    pub fn windows_on(&self, desktop: &str) -> Vec<AppId> {
        self.windows
            .iter()
            .filter(|window| window.is_on(desktop))
            .map(|window| window.app)
            .collect()
    }

    /// Focuses the topmost unminimized window of a desktop, clearing the focus when it is empty.
    ///
    /// Mirrors the reference `handleSelectDesktop`.
    pub fn focus_on(&mut self, desktop: &str) -> Option<AppId> {
        let found = self
            .windows
            .iter()
            .rev()
            .find(|window| window.is_on(desktop) && !window.is_minimized())
            .map(|window| window.app);
        self.active = found;
        found
    }

    /// Moves a window to another virtual desktop; `None` shares it with every desktop.
    pub fn move_to_desktop(&mut self, app: AppId, desktop: Option<String>) -> bool {
        let Some(window) = self.windows.iter_mut().find(|window| window.app == app) else {
            return false;
        };
        window.set_desktop(desktop);
        true
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
        let mut window = window;
        if window.desktop.is_none() {
            window.desktop = Some(self.current_desktop.clone());
        }
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
///
/// This is the reference pitch and the upper bound: [`compact_step_y`] shortens it when the rows
/// would otherwise run into the session chip band at the bottom of the desktop.
pub const COMPACT_STEP_Y: f32 = 114.0;

/// Vertical gap between two compact grid cells.
pub const COMPACT_GAP_Y: f32 = 8.0;

/// Height band at the bottom of the work area that stays free for the session chip.
///
/// The chip is drawn by the browser host eight points above the taskbar; reserving its height here
/// keeps the last icon row — labels included — clear of it at every viewport size.
pub const SESSION_CHIP_BAND: f32 = 60.0;

/// Smallest compact row pitch before cells get too tight to hold a tile and its label.
pub const COMPACT_MIN_STEP_Y: f32 = 96.0;
/// Top inset of the first compact row (`offsetY` starts at 16 in the reference).
///
/// The desktop control bar occupies the top right corner, so the first row starts below it; the
/// reference shell has no such bar and could start at 16.
pub const COMPACT_ORIGIN_Y: f32 = DESKTOP_CONTROL_HEIGHT + 8.0;
/// Side inset the compact columns are distributed inside (`screenW - 24`).
pub const COMPACT_INSET_X: f32 = 12.0;
/// Width of one compact item before the remaining column width is split around it (`itemWidth`).
pub const COMPACT_ITEM_WIDTH: f32 = 80.0;

/// Row pitch of the compact grid for a desktop of this height.
///
/// Six rows with the reference pitch need 16 + 5 × 114 + 108 = 694 points. On a 432 × 768 viewport
/// the work area is 720 points high and the session chip keeps the bottom 60 points free, so the
/// pitch shrinks until the last row ends above it. Wide desktops keep the reference pitch.
pub fn compact_step_y(desktop: Rect) -> f32 {
    let rows = ICON_ROWS as f32;
    let limit = desktop.bottom() - SESSION_CHIP_BAND;
    let usable = limit - desktop.top() - COMPACT_ORIGIN_Y - COMPACT_GAP_Y * (rows - 1.0);
    let pitch = usable / rows + COMPACT_GAP_Y;
    pitch.clamp(COMPACT_MIN_STEP_Y, COMPACT_STEP_Y)
}

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
            let top = desktop.min.y + COMPACT_ORIGIN_Y + row as f32 * compact_step_y(desktop);
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
            let row =
                ((point.y - desktop.min.y - COMPACT_ORIGIN_Y) / compact_step_y(desktop)).floor();
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

    /// Lays every icon out again in reading order, dropping free positions.
    ///
    /// The reference `autoArrange` names every desktop item in one reading order, so the caller
    /// lays the folders out right after the icons with the cell count this returns.
    pub fn arrange(&mut self) -> u32 {
        let mut taken = std::collections::BTreeSet::new();
        for icon in &mut self.icons {
            let mut cell = (0, 0);
            while taken.contains(&cell) {
                cell = Self::next_cell(cell);
            }
            taken.insert(cell);
            icon.cell = cell;
            icon.pos = None;
        }
        self.icons.len() as u32
    }

    /// Snaps every freely placed icon back to the nearest grid cell.
    ///
    /// Returns whether a position changed. Taken cells keep their icon; the moved icon continues to
    /// the next free cell like [`IconGrid::move_to`].
    pub fn snap_to_grid(&mut self, desktop: Rect) -> bool {
        let mut changed = false;
        let placed: Vec<(usize, Pos2)> = self
            .icons
            .iter()
            .enumerate()
            .filter_map(|(index, icon)| icon.pos.map(|pos| (index, pos)))
            .collect();
        let free: Vec<(usize, (u32, u32))> = placed
            .into_iter()
            .map(|(index, pos)| (index, self.cell_at(desktop, pos)))
            .collect();
        for (index, cell) in free {
            let app = self.icons[index].app;
            if self.move_to(app, cell).is_some() {
                self.icons[index].pos = None;
                changed = true;
            }
        }
        changed
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

/// One folder on the desktop that groups app icons, like the reference `DesktopFolder`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopFolder {
    id: String,
    name: String,
    apps: Vec<AppId>,
    cell: (u32, u32),
}

/// Resolves a persisted app slug to a registered desktop app.
///
/// Persisted layouts only hold slugs; unknown slugs (an app removed from the catalogue) are dropped
/// instead of being replaced with a fallback app.
pub fn known_app(slug: &str) -> Option<AppId> {
    crate::chrome::APPS
        .iter()
        .find(|app| app.slug == slug)
        .map(|app| AppId::new(app.slug))
}

impl DesktopFolder {
    /// Builds a folder from persisted data, skipping unknown app slugs.
    pub fn from_persisted(id: &str, name: &str, apps: &[String], cell: (u32, u32)) -> Self {
        Self {
            id: id.to_owned(),
            name: sanitized_name(name),
            apps: apps.iter().filter_map(|slug| known_app(slug)).collect(),
            cell: (cell.0.min(12), cell.1.min(ICON_ROWS - 1)),
        }
    }

    /// Identifier the folder is stored and looked up by.
    pub fn id(&self) -> &str {
        &self.id
    }

    /// Displayed folder name.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Apps inside the folder, in the order they were added.
    pub fn apps(&self) -> &[AppId] {
        &self.apps
    }

    /// Grid cell of the folder tile.
    pub fn cell(&self) -> (u32, u32) {
        self.cell
    }
}

/// Longest folder name the desktop accepts.
pub const FOLDER_NAME_MAX: usize = 64;

/// Desktop folders and their transient interface state.
///
/// The reference desktop keeps folders in `socdof_desktop_folders` and opens one folder at a time in
/// a modal, with right-click menus on the folder tile and on the desktop background. The model is
/// plain data so every operation is tested without a display.
#[derive(Debug, Clone, Default)]
pub struct FolderSet {
    folders: Vec<DesktopFolder>,
    open: Option<String>,
    context: Option<(String, Pos2)>,
    menu: Option<Pos2>,
    rename: Option<String>,
    rename_buffer: String,
    tab: FolderTab,
}

impl FolderSet {
    /// Empty folder set with every overlay closed.
    pub fn new() -> Self {
        Self::default()
    }

    /// Folders in creation order.
    pub fn folders(&self) -> &[DesktopFolder] {
        &self.folders
    }

    /// Number of folders.
    pub fn len(&self) -> usize {
        self.folders.len()
    }

    /// Whether the desktop holds no folder.
    pub fn is_empty(&self) -> bool {
        self.folders.is_empty()
    }

    /// Folder with the given identifier.
    pub fn get(&self, id: &str) -> Option<&DesktopFolder> {
        self.folders.iter().find(|folder| folder.id == id)
    }

    /// Whether an app is held by any folder; such an app has no tile of its own.
    pub fn contains(&self, app: AppId) -> bool {
        self.folders.iter().any(|folder| folder.apps.contains(&app))
    }

    /// Cell of the grid slot that follows the given number of desktop items.
    pub fn slot_cell(slot: u32) -> (u32, u32) {
        let mut cell = (0, 0);
        for _ in 0..slot {
            cell = IconGrid::next_cell(cell);
        }
        cell
    }

    /// First grid cell from `first` on that no folder occupies.
    ///
    /// A dissolved folder frees its cell, so the next folder must skip the cells of the folders
    /// that are still on the desktop instead of reusing a slot by count.
    pub fn free_cell(&self, first: u32) -> (u32, u32) {
        let mut slot = first;
        loop {
            let cell = Self::slot_cell(slot);
            if !self.folders.iter().any(|folder| folder.cell == cell) {
                return cell;
            }
            slot += 1;
        }
    }

    /// Creates a folder with the given apps and returns its identifier.
    ///
    /// The identifier follows the reference `folder_<n>` scheme and never repeats an existing one.
    pub fn create(&mut self, name: &str, apps: Vec<AppId>, cell: (u32, u32)) -> String {
        let mut index = self.folders.len() + 1;
        let mut id = format!("folder-{index}");
        while self.get(&id).is_some() {
            index += 1;
            id = format!("folder-{index}");
        }
        let mut folder = DesktopFolder {
            id: id.clone(),
            name: sanitized_name(name),
            apps: Vec::new(),
            cell: (cell.0.min(12), cell.1.min(ICON_ROWS - 1)),
        };
        for app in apps {
            if !folder.apps.contains(&app) {
                folder.apps.push(app);
            }
        }
        self.folders.push(folder);
        id
    }

    /// Renames a folder; blank names are rejected.
    pub fn rename(&mut self, id: &str, name: &str) -> bool {
        let trimmed = name.trim();
        let Some(folder) = self.folders.iter_mut().find(|folder| folder.id == id) else {
            return false;
        };
        if trimmed.is_empty() {
            return false;
        }
        folder.name = sanitized_name(trimmed);
        true
    }

    /// Adds an app to a folder; an app already in another folder is moved there.
    pub fn add_app(&mut self, id: &str, app: AppId) -> bool {
        if self.get(id).is_none() {
            return false;
        }
        for folder in &mut self.folders {
            folder.apps.retain(|known| *known != app);
        }
        if let Some(folder) = self.folders.iter_mut().find(|folder| folder.id == id) {
            folder.apps.push(app);
            return true;
        }
        false
    }

    /// Removes an app from a folder. A folder without apps dissolves, like the reference.
    pub fn remove_app(&mut self, id: &str, app: AppId) -> bool {
        let Some(folder) = self.folders.iter_mut().find(|folder| folder.id == id) else {
            return false;
        };
        let before = folder.apps.len();
        folder.apps.retain(|known| *known != app);
        if folder.apps.len() == before {
            return false;
        }
        if folder.apps.is_empty() {
            self.dissolve(id);
        }
        true
    }

    /// Removes a folder and puts its apps back on the desktop.
    pub fn dissolve(&mut self, id: &str) -> bool {
        let before = self.folders.len();
        self.folders.retain(|folder| folder.id != id);
        if self.open.as_deref() == Some(id) {
            self.open = None;
        }
        if self.rename.as_deref() == Some(id) {
            self.cancel_rename();
        }
        if self.context.as_ref().map(|(folder, _)| folder.as_str()) == Some(id) {
            self.context = None;
        }
        self.folders.len() != before
    }

    /// Moves a folder tile to a grid cell.
    pub fn move_to(&mut self, id: &str, cell: (u32, u32)) -> bool {
        let Some(folder) = self.folders.iter_mut().find(|folder| folder.id == id) else {
            return false;
        };
        folder.cell = (cell.0.min(12), cell.1.min(ICON_ROWS - 1));
        true
    }

    /// Folder opened in the modal, if any.
    pub fn open_id(&self) -> Option<&str> {
        self.open.as_deref()
    }

    /// Opens one folder in the modal.
    pub fn open(&mut self, id: &str) {
        if self.get(id).is_some() {
            self.open = Some(id.to_owned());
            self.cancel_rename();
            self.context = None;
            self.menu = None;
        }
    }

    /// Closes the folder modal.
    pub fn close(&mut self) {
        self.open = None;
        self.cancel_rename();
    }

    /// Position of the open folder context menu and the folder it belongs to.
    pub fn context(&self) -> Option<(&str, Pos2)> {
        self.context.as_ref().map(|(id, pos)| (id.as_str(), *pos))
    }

    /// Opens the context menu of a folder tile at a screen position.
    pub fn open_context(&mut self, id: &str, pos: Pos2) {
        if self.get(id).is_some() {
            self.context = Some((id.to_owned(), pos));
            self.menu = None;
        }
    }

    /// Closes the folder context menu.
    pub fn close_context(&mut self) {
        self.context = None;
    }

    /// Position of the desktop background menu, if open.
    pub fn menu(&self) -> Option<Pos2> {
        self.menu
    }

    /// Opens the desktop background menu at a screen position.
    pub fn open_menu(&mut self, pos: Pos2) {
        self.menu = Some(pos);
        self.context = None;
    }

    /// Closes the desktop background menu.
    pub fn close_menu(&mut self) {
        self.menu = None;
    }

    /// Whether the folder modal is on screen. The context menus do not block the desktop: a click
    /// next to them closes them, like the reference menus.
    pub fn overlay_open(&self) -> bool {
        self.open.is_some()
    }

    /// List the folder modal shows.
    pub fn tab(&self) -> FolderTab {
        self.tab
    }

    /// Switches the folder modal between the app list and the file list.
    pub fn set_tab(&mut self, tab: FolderTab) {
        self.tab = tab;
    }

    /// Folder whose name is being edited inline.
    pub fn rename_target(&self) -> Option<&str> {
        self.rename.as_deref()
    }

    /// Starts editing the name of a folder.
    pub fn begin_rename(&mut self, id: &str) {
        let Some(folder) = self.get(id) else {
            return;
        };
        self.rename_buffer = folder.name.clone();
        self.rename = Some(id.to_owned());
        self.context = None;
    }

    /// Editable name buffer of the rename field.
    pub fn rename_buffer_mut(&mut self) -> &mut String {
        &mut self.rename_buffer
    }

    /// Stops editing without applying the buffer.
    pub fn cancel_rename(&mut self) {
        self.rename = None;
        self.rename_buffer.clear();
    }

    /// Applies the rename buffer; returns whether a name was stored.
    pub fn commit_rename(&mut self) -> bool {
        let Some(id) = self.rename.clone() else {
            return false;
        };
        let name = self.rename_buffer.clone();
        let renamed = self.rename(&id, &name);
        self.cancel_rename();
        renamed
    }

    /// Folder cells in creation order, ready to be persisted.
    pub fn positions(&self) -> Vec<(String, (u32, u32))> {
        self.folders
            .iter()
            .map(|folder| (folder.id.clone(), folder.cell))
            .collect()
    }

    /// Replaces the folder set from a persisted layout.
    pub fn restore(&mut self, folders: impl IntoIterator<Item = DesktopFolder>) {
        self.folders = folders.into_iter().collect();
        self.open = None;
        self.context = None;
        self.menu = None;
        self.cancel_rename();
    }
}

/// Which list the folder modal shows.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum FolderTab {
    /// Apps and modules filed in the folder.
    #[default]
    Apps,
    /// Files and storage locations filed in the folder.
    Files,
}

/// Category the reference storage assigns from a file extension.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AssetCategory {
    /// Documents such as text files and office documents.
    Document,
    /// Pictures.
    Image,
    /// Spreadsheets and CSV files.
    Spreadsheet,
    /// PDF files.
    Pdf,
    /// Archives.
    Archive,
    /// Audio files.
    Audio,
    /// Video files.
    Video,
    /// Source code and markup.
    Code,
    /// Anything else.
    #[default]
    Other,
}

impl AssetCategory {
    /// Category of a file name, following `determineAssetCategory`.
    pub fn from_name(name: &str) -> Self {
        let extension = name
            .rsplit_once('.')
            .map(|(_, extension)| extension.to_ascii_lowercase())
            .unwrap_or_default();
        match extension.as_str() {
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" | "ico" => Self::Image,
            "pdf" => Self::Pdf,
            "xlsx" | "xls" | "csv" | "ods" => Self::Spreadsheet,
            "doc" | "docx" | "txt" | "rtf" | "odt" | "md" => Self::Document,
            "zip" | "rar" | "7z" | "tar" | "gz" => Self::Archive,
            "mp3" | "wav" | "ogg" | "m4a" | "flac" => Self::Audio,
            "mp4" | "webm" | "mkv" | "mov" | "avi" => Self::Video,
            "js" | "ts" | "jsx" | "tsx" | "html" | "css" | "json" | "py" | "sh" | "bat" | "xml"
            | "sql" => Self::Code,
            _ => Self::Other,
        }
    }

    /// Persisted slug of the category.
    pub fn slug(self) -> &'static str {
        match self {
            Self::Document => "document",
            Self::Image => "image",
            Self::Spreadsheet => "spreadsheet",
            Self::Pdf => "pdf",
            Self::Archive => "archive",
            Self::Audio => "audio",
            Self::Video => "video",
            Self::Code => "code",
            Self::Other => "other",
        }
    }

    /// Reads a persisted slug, falling back to [`AssetCategory::Other`].
    pub fn from_slug(slug: &str) -> Self {
        match slug {
            "document" => Self::Document,
            "image" => Self::Image,
            "spreadsheet" => Self::Spreadsheet,
            "pdf" => Self::Pdf,
            "archive" => Self::Archive,
            "audio" => Self::Audio,
            "video" => Self::Video,
            "code" => Self::Code,
            _ => Self::Other,
        }
    }

    /// Accent color of the category glyph, like the per-category Tailwind colors of the
    /// reference.
    pub fn tint(self) -> Color32 {
        match self {
            Self::Image => Color32::from_rgb(168, 85, 247),
            Self::Pdf => Color32::from_rgb(244, 63, 94),
            Self::Spreadsheet => Color32::from_rgb(16, 185, 129),
            Self::Archive => Color32::from_rgb(245, 158, 11),
            Self::Code => Color32::from_rgb(59, 130, 246),
            Self::Audio | Self::Video => Color32::from_rgb(14, 165, 233),
            Self::Document | Self::Other => Color32::from_rgb(99, 102, 241),
        }
    }

    /// Glyph shown for the category in the file list.
    pub fn icon(self) -> Icon {
        match self {
            Self::Image => Icon::Palette,
            Self::Pdf | Self::Document => Icon::FileText,
            Self::Spreadsheet => Icon::Grid,
            Self::Archive => Icon::Database,
            Self::Code => Icon::PenLine,
            Self::Audio | Self::Video => Icon::Speaker,
            Self::Other => Icon::FileText,
        }
    }

    /// Catalogue key of the category name.
    pub fn title_key(self) -> &'static str {
        match self {
            Self::Document => "storage_category_document",
            Self::Image => "storage_category_image",
            Self::Spreadsheet => "storage_category_spreadsheet",
            Self::Pdf => "storage_category_pdf",
            Self::Archive => "storage_category_archive",
            Self::Audio => "storage_category_audio",
            Self::Video => "storage_category_video",
            Self::Code => "storage_category_code",
            Self::Other => "storage_category_other",
        }
    }
}

/// One file filed on the desktop or in a desktop folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageAsset {
    id: String,
    name: String,
    size: u64,
    category: AssetCategory,
    location: String,
    folder_id: Option<String>,
    created_at: i64,
}

impl StorageAsset {
    /// Builds an asset from a file name, its size and the path it came from.
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        size: u64,
        location: impl Into<String>,
        folder_id: Option<String>,
        created_at: i64,
    ) -> Self {
        let name = name.into();
        let category = AssetCategory::from_name(&name);
        Self {
            id: id.into(),
            name,
            size,
            category,
            location: location.into(),
            folder_id,
            created_at,
        }
    }

    /// Builds an asset from persisted data, keeping the stored category slug.
    #[allow(clippy::too_many_arguments)]
    pub fn from_persisted(
        id: &str,
        name: &str,
        size: u64,
        category: &str,
        location: &str,
        folder_id: Option<String>,
        created_at: i64,
    ) -> Self {
        Self {
            id: id.to_owned(),
            name: name.to_owned(),
            size,
            category: AssetCategory::from_slug(category),
            location: location.to_owned(),
            folder_id,
            created_at,
        }
    }

    /// Identifier of the asset.
    pub fn id(&self) -> &str {
        &self.id
    }

    /// File name.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Size in bytes.
    pub fn size(&self) -> u64 {
        self.size
    }

    /// Category derived from the file name.
    pub fn category(&self) -> AssetCategory {
        self.category
    }

    /// Path the asset was imported from.
    pub fn location(&self) -> &str {
        &self.location
    }

    /// Folder the asset is filed in.
    pub fn folder_id(&self) -> Option<&str> {
        self.folder_id.as_deref()
    }

    /// Creation time in milliseconds since the Unix epoch.
    pub fn created_at(&self) -> i64 {
        self.created_at
    }

    /// Human readable size, like the reference `formatFileSize`.
    pub fn size_label(&self) -> String {
        format_size(self.size)
    }
}

/// Human readable file size with one decimal above one kilobyte.
pub fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "0 B".to_owned();
    }
    let units = ["B", "KB", "MB", "GB"];
    let mut value = bytes as f64;
    let mut index = 0;
    while value >= 1024.0 && index + 1 < units.len() {
        value /= 1024.0;
        index += 1;
    }
    if index == 0 {
        format!("{bytes} B")
    } else {
        format!("{value:.1} {}", units[index])
    }
}

/// Files filed on the desktop, the upload location and the selected file.
#[derive(Debug, Clone, Default)]
pub struct DesktopStorage {
    assets: Vec<StorageAsset>,
    location: String,
    selected: Option<String>,
    popup: crate::controls::PopupState,
}

impl DesktopStorage {
    /// Empty storage without a chosen upload location.
    pub fn new() -> Self {
        Self::default()
    }

    /// Every file, newest first.
    pub fn assets(&self) -> &[StorageAsset] {
        &self.assets
    }

    /// Files filed in a folder, or on the desktop when `folder` is `None`.
    pub fn assets_in(&self, folder: Option<&str>) -> Vec<&StorageAsset> {
        self.assets
            .iter()
            .filter(|asset| asset.folder_id() == folder)
            .collect()
    }

    /// Number of files filed in a folder.
    pub fn count_in(&self, folder: &str) -> usize {
        self.assets
            .iter()
            .filter(|asset| asset.folder_id() == Some(folder))
            .count()
    }

    /// Adds a file at the front of the list, like the reference upload.
    pub fn add(&mut self, asset: StorageAsset) {
        self.assets.retain(|known| known.id != asset.id);
        self.assets.insert(0, asset);
    }

    /// Removes a file; the details pane closes when it showed that file.
    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.assets.len();
        self.assets.retain(|asset| asset.id != id);
        if self.selected.as_deref() == Some(id) {
            self.selected = None;
        }
        self.assets.len() != before
    }

    /// Files a file into a folder, or back onto the desktop with `None`.
    pub fn link(&mut self, id: &str, folder: Option<&str>) -> bool {
        let Some(asset) = self.assets.iter_mut().find(|asset| asset.id == id) else {
            return false;
        };
        asset.folder_id = folder.map(str::to_owned);
        true
    }

    /// Chosen upload location.
    pub fn location(&self) -> &str {
        &self.location
    }

    /// Replaces the upload location.
    pub fn set_location(&mut self, location: impl Into<String>) {
        self.location = location.into();
    }

    /// Editable upload location.
    pub fn location_mut(&mut self) -> &mut String {
        &mut self.location
    }

    /// Popup state of the folder selector in the details pane.
    pub fn popup_mut(&mut self) -> &mut crate::controls::PopupState {
        &mut self.popup
    }

    /// File shown in the details pane.
    pub fn selected(&self) -> Option<&StorageAsset> {
        let id = self.selected.as_deref()?;
        self.assets.iter().find(|asset| asset.id() == id)
    }

    /// Shows one file in the details pane.
    pub fn select(&mut self, id: &str) {
        if self.assets.iter().any(|asset| asset.id() == id) {
            self.selected = Some(id.to_owned());
        }
    }

    /// Closes the details pane.
    pub fn clear_selection(&mut self) {
        self.selected = None;
    }

    /// Replaces the files and the location from a persisted layout.
    pub fn restore(&mut self, assets: impl IntoIterator<Item = StorageAsset>, location: &str) {
        self.assets = assets.into_iter().collect();
        self.location = location.to_owned();
        self.selected = None;
    }
}

/// Imports the files the user picked from the chosen storage location.
///
/// The reference opens the browser picker and copies up to 15 MB per file into the browser storage.
/// The native shell opens the platform dialog in the chosen location and keeps the file in place,
/// so the account settings hold the metadata and the source path instead of the bytes.
/// Returns the number of files that were added.
pub fn import_from_location(
    storage: &mut DesktopStorage,
    target: &UploadTarget,
    now: i64,
) -> usize {
    #[cfg(feature = "dialogs")]
    {
        let mut dialog = rfd::FileDialog::new();
        let location = storage.location().trim().to_owned();
        if !location.is_empty() && std::path::Path::new(&location).is_dir() {
            dialog = dialog.set_directory(&location);
        }
        let Some(paths) = dialog.pick_files() else {
            return 0;
        };
        let folder_id = match target {
            UploadTarget::Desktop => None,
            UploadTarget::Folder(id) => Some(id.clone()),
        };
        let mut added = 0;
        for (index, path) in paths.iter().enumerate() {
            let Some(name) = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
            else {
                continue;
            };
            let size = std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
            let directory = path
                .parent()
                .map(|parent| parent.to_string_lossy().into_owned())
                .unwrap_or_default();
            let id = format!("asset-{now}-{index}");
            storage.add(StorageAsset::new(
                id,
                name,
                size,
                directory,
                folder_id.clone(),
                now,
            ));
            added += 1;
        }
        return added;
    }
    #[cfg(not(feature = "dialogs"))]
    {
        let _ = (storage, target, now);
        0
    }
}

/// Saves a copy of a filed asset to a location the user picks.
///
/// Returns whether a copy was written. Files whose storage location is unknown cannot be copied;
/// the reference falls back to a text placeholder in that case.
pub fn save_asset_copy(asset: &StorageAsset) -> bool {
    #[cfg(feature = "dialogs")]
    {
        let source = std::path::Path::new(asset.location()).join(asset.name());
        if !source.is_file() {
            return false;
        }
        let Some(target) = rfd::FileDialog::new()
            .set_file_name(asset.name())
            .save_file()
        else {
            return false;
        };
        return std::fs::copy(source, target).is_ok();
    }
    #[cfg(not(feature = "dialogs"))]
    {
        let _ = asset;
        false
    }
}

/// Trims a folder name and bounds its length.
fn sanitized_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "Ordner".to_owned();
    }
    trimmed.chars().take(FOLDER_NAME_MAX).collect()
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

/// Where imported files should be filed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UploadTarget {
    /// The desktop itself.
    Desktop,
    /// A desktop folder.
    Folder(String),
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
    /// Create workflow selected in the command palette.
    pub quick_action: Option<PaletteQuickAction>,
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
    /// Whether a desktop folder was created, renamed, dissolved or filled and should be persisted.
    pub folders_changed: bool,
    /// Whether a desktop file was added, removed or refiled and should be persisted.
    pub storage_changed: bool,
    /// Files the user asked to import from a storage location.
    pub upload_assets: Option<UploadTarget>,
    /// Whether window geometry changed and should be persisted.
    pub window_layout_changed: bool,
    /// Whether the virtual desktops, their order or a window's desktop changed.
    pub task_view_changed: bool,
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

/// Clock settings of the company profile that drive the taskbar and the sign-in clocks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClockSettings {
    /// Date format (`DD.MM.YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`).
    pub date_format: String,
    /// Seconds setting; `None` keeps the reference default (tray on, sign-in off).
    pub time_show_seconds: Option<bool>,
    /// IANA time zone of the clocks.
    pub timezone: String,
}

impl Default for ClockSettings {
    fn default() -> Self {
        ClockSettings {
            date_format: "DD.MM.YYYY".to_string(),
            time_show_seconds: None,
            timezone: "Europe/Berlin".to_string(),
        }
    }
}

impl ClockSettings {
    /// Reads the clock settings from the company profile.
    pub fn from_profile(profile: &socdof_core::domain::settings::CompanyProfile) -> Self {
        ClockSettings {
            date_format: if profile.date_format.trim().is_empty() {
                "DD.MM.YYYY".to_string()
            } else {
                profile.date_format.clone()
            },
            time_show_seconds: profile.time_show_seconds,
            timezone: if profile.timezone.trim().is_empty() {
                "Europe/Berlin".to_string()
            } else {
                profile.timezone.clone()
            },
        }
    }

    /// Sign-in clock seconds: the reference shows them only when `time_show_seconds === true`.
    pub fn sign_in_seconds(&self) -> bool {
        self.time_show_seconds == Some(true)
    }

    /// Taskbar clock seconds: the reference keeps them unless `time_show_seconds === false`.
    pub fn taskbar_seconds(&self) -> bool {
        self.time_show_seconds != Some(false)
    }

    /// Twelve hour sign-in clock in the configured zone.
    pub fn sign_in_time(&self, millis: i64) -> String {
        socdof_core::date::format_time(millis, self.sign_in_seconds(), &self.timezone)
    }

    /// Twelve hour sign-in date in the configured format and zone.
    pub fn sign_in_date(&self, millis: i64) -> String {
        socdof_core::date::format_date_style(millis, &self.date_format, &self.timezone)
    }

    /// Twenty-four hour taskbar clock in the configured zone.
    pub fn taskbar_time(&self, millis: i64) -> String {
        socdof_core::date::format_time_24h(millis, self.taskbar_seconds(), &self.timezone)
    }

    /// Taskbar date in the configured format and zone.
    pub fn taskbar_date(&self, millis: i64) -> String {
        socdof_core::date::format_date_style(millis, &self.date_format, &self.timezone)
    }
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

            // The wallpaper is one click target behind the icons: a click dismisses the desktop
            // menus and a right click opens the desktop menu (`DesktopWindowWorkspace.tsx:4816`).
            let background =
                ui.interact(area, Id::new("socdof-desktop-background"), Sense::click());
            if !blocked && background.clicked() {
                shell.folders.close_menu();
                shell.folders.close_context();
            }
            if !blocked && background.secondary_clicked() {
                if let Some(pos) = background.interact_pointer_pos() {
                    shell.folders.open_menu(pos);
                }
            }

            // Apps inside a folder have no tile of their own; the folder tile stands for them.
            let folder_rects: Vec<(String, Rect)> = shell
                .folders
                .folders()
                .iter()
                .map(|folder| {
                    (
                        folder.id().to_owned(),
                        IconGrid::cell_rect(area, folder.cell()),
                    )
                })
                .collect();
            let entries: Vec<(usize, DesktopIcon)> = icons
                .icons()
                .iter()
                .cloned()
                .enumerate()
                .filter(|(_, icon)| !shell.folders.contains(icon.app()))
                .collect();
            let icon_rects: Vec<(AppId, Rect, (u32, u32))> = entries
                .iter()
                .map(|(_, icon)| {
                    let rect = match icon.pos() {
                        Some(pos) => Rect::from_min_size(pos, ICON_CELL),
                        None => IconGrid::cell_rect(area, icon.cell()),
                    };
                    (icon.app(), rect, icon.cell())
                })
                .collect();
            for (index, icon) in entries {
                // Hidden icons keep their grid slot, so selection follows the grid, not the entry.
                let grid_index = icons.index_of(icon.app()).unwrap_or(index);
                let rect = match icon.pos() {
                    Some(pos) => Rect::from_min_size(pos, ICON_CELL),
                    None => IconGrid::cell_rect(area, icon.cell()),
                };
                let id = Id::new(("socdof-desktop-icon", icon.app().as_str()));
                let focused = focus.register(id);
                let response = ui.interact(rect, id, Sense::click_and_drag());
                if !blocked && response.clicked() {
                    icons.select(grid_index);
                    focus.set_focus(Some(id));
                    shell.folders.close_menu();
                    shell.folders.close_context();
                }
                // The reference desktop opens an app on a double click; a single click only selects
                // the icon (the keyboard opens it with Enter/Space).
                let double_clicked = !blocked && response.double_clicked();
                if !blocked && response.drag_stopped() {
                    if let Some(pos) = response.interact_pointer_pos() {
                        // Dropping on a folder files the app there, dropping on another icon merges
                        // both into a new folder, like the reference drag and drop.
                        if let Some((folder, _)) =
                            folder_rects.iter().find(|(_, rect)| rect.contains(pos))
                        {
                            if shell.folders.add_app(folder, icon.app()) {
                                outcome.folders_changed = true;
                            }
                        } else if let Some((_, _, cell)) = icon_rects
                            .iter()
                            .find(|(app, rect, _)| *app != icon.app() && rect.contains(pos))
                        {
                            let name = texts.get("desktop_folder_default_name").to_owned();
                            let target = icon_rects
                                .iter()
                                .find(|(_, rect, _)| rect.contains(pos))
                                .map(|(app, _, _)| *app)
                                .unwrap_or(icon.app());
                            shell.folders.create(&name, vec![target, icon.app()], *cell);
                            outcome.folders_changed = true;
                        } else {
                            let cell = icons.cell_at(area, pos);
                            if icons.move_to(icon.app(), cell).is_some() {
                                outcome.icon_positions_changed = true;
                            }
                        }
                    }
                }
                // The legacy grid only highlights the focused icon; a fresh desktop shows the
                // plain tiles (`DesktopWindowWorkspace.tsx:2886`).
                let selected = icons.selected() == grid_index && focused;
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

            for (folder_id, rect) in &folder_rects {
                let Some(folder) = shell.folders.get(folder_id).cloned() else {
                    continue;
                };
                let folder_ui_id = Id::new(("socdof-desktop-folder", folder_id.as_str()));
                let focused = focus.register(folder_ui_id);
                let response = ui.interact(*rect, folder_ui_id, Sense::click_and_drag());
                let hovered = response.hovered() || focused;
                if !blocked && response.clicked() {
                    shell.folders.open(folder_id);
                    focus.set_focus(Some(folder_ui_id));
                }
                if !blocked && response.secondary_clicked() {
                    if let Some(pos) = response.interact_pointer_pos() {
                        shell.folders.open_context(folder_id, pos);
                    }
                }
                if !blocked && response.drag_stopped() {
                    if let Some(pos) = response.interact_pointer_pos() {
                        let cell = icons.cell_at(area, pos);
                        if shell.folders.move_to(folder_id, cell) {
                            outcome.folders_changed = true;
                        }
                    }
                }
                let painter = ui.painter().clone();
                if hovered {
                    painter.rect(
                        *rect,
                        Rounding::same(RADIUS_CONTROL),
                        with_alpha(theme.palette.text_muted, 8),
                        Stroke::NONE,
                    );
                }
                paint_folder_tile(ctx, &painter, theme, *rect, &folder);
                if focused {
                    focus_ring(ui, theme, *rect);
                }
            }

            // The legacy desktop has no widget layer at all, so the icon grid keeps the whole area
            // and the window controls stay the only element in the top right corner.
        });

    if !shell.folders.overlay_open() {
        let fullscreen = ctx.input(|input| input.viewport().fullscreen.unwrap_or(false));
        if let Some(action) =
            desktop_menus(ctx, theme, texts, focus, &mut shell.folders, fullscreen)
        {
            match action {
                MenuAction::Widgets => {
                    activate_app(icons, windows, AppId::new("widgets"), area, now);
                    outcome.open_app = Some(AppId::new("widgets"));
                }
                MenuAction::StickyNote => shell.widgets.pin_sticky_note(),
                MenuAction::TaskView => shell.task_view.open(),
                MenuAction::Create => {
                    let name = texts.get("desktop_new_folder").to_owned();
                    let cell = shell.folders.free_cell(icons.icons().len() as u32);
                    let id = shell.folders.create(&name, Vec::new(), cell);
                    // The reference opens a freshly created folder right away.
                    shell.folders.open(&id);
                    outcome.folders_changed = true;
                }
                MenuAction::Upload(target) => outcome.upload_assets = Some(target),
                MenuAction::ArrangeIcons => {
                    let occupied = icons.arrange();
                    let folder_ids: Vec<String> = shell
                        .folders
                        .folders()
                        .iter()
                        .map(|folder| folder.id().to_owned())
                        .collect();
                    for (index, id) in folder_ids.into_iter().enumerate() {
                        shell
                            .folders
                            .move_to(&id, FolderSet::slot_cell(occupied + index as u32));
                    }
                    outcome.icon_positions_changed = true;
                    outcome.folders_changed = true;
                }
                MenuAction::SnapGrid => {
                    if icons.snap_to_grid(area) {
                        outcome.icon_positions_changed = true;
                    }
                    let cells: Vec<(String, (u32, u32))> = shell
                        .folders
                        .folders()
                        .iter()
                        .map(|folder| {
                            let rect = IconGrid::cell_rect(area, folder.cell());
                            (folder.id().to_owned(), icons.cell_at(area, rect.min))
                        })
                        .collect();
                    for (id, cell) in cells {
                        shell.folders.move_to(&id, cell);
                    }
                    outcome.folders_changed = true;
                }
                MenuAction::OpenApp(app) => {
                    activate_app(icons, windows, app, area, now);
                    outcome.open_app = Some(app);
                }
                MenuAction::Fullscreen => crate::desktop::toggle_fullscreen(ctx),
                MenuAction::Open(id) => shell.folders.open(&id),
                MenuAction::Rename(id) => shell.folders.begin_rename(&id),
                MenuAction::Dissolve(id) => {
                    if shell.folders.dissolve(&id) {
                        outcome.folders_changed = true;
                    }
                }
            }
        }
    }
    if shell.folders.overlay_open() {
        if let Some(app) = folder_modal(
            ctx,
            theme,
            texts,
            focus,
            &mut shell.folders,
            &mut shell.storage,
            &mut outcome,
        ) {
            activate_app(icons, windows, app, area, now);
            outcome.open_app = Some(app);
        }
    }

    if ctx.input(|input| input.modifiers.command && input.key_pressed(Key::K)) {
        shell.open_palette();
    }

    // Reference workspace shortcuts: `Ctrl+Alt+Arrow` switches desktops, `Ctrl+Shift+D` adds one.
    if ctx.input(|input| input.modifiers.ctrl && input.modifiers.alt) {
        let forward = ctx.input(|input| input.key_pressed(Key::ArrowRight));
        let backward = ctx.input(|input| input.key_pressed(Key::ArrowLeft));
        if forward || backward {
            if let Some(id) = shell.task_view.step(forward) {
                windows.focus_on(&id);
                outcome.task_view_changed = true;
            }
        }
    }
    if ctx.input(|input| {
        input.modifiers.command && input.modifiers.shift && input.key_pressed(Key::D)
    }) && shell.task_view.add().is_some()
    {
        outcome.task_view_changed = true;
    }

    windows.set_current_desktop(shell.task_view.active_id());
    let active_desktop = shell.task_view.active_id().to_owned();

    let visible: Vec<(AppId, Rect, String, bool, bool)> = windows
        .windows()
        .iter()
        .filter(|window| !window.is_minimized() && window.is_on(&active_desktop))
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
        if let Some(action) =
            command_palette(ctx, theme, texts, focus, &mut shell.palette, icons, store)
        {
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
                shell.clock.taskbar_time(now),
                FontId::new(13.0, crate::theme::mono_bold()),
                clock_color,
            );
            let date = painter.layout_no_wrap(
                shell.clock.taskbar_date(now),
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
        let result = task_view_overlay(ctx, texts, &mut shell.task_view, windows, screen);
        if result.changed {
            outcome.task_view_changed = true;
        }
        if let Some(app) = result.focus {
            windows.focus(app);
            outcome.window_layout_changed = true;
            shell.task_view.close();
        }
        if let Some(app) = result.close_window {
            if windows.close(app, now) {
                outcome.window_layout_changed = true;
            }
        }
        if result.close {
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
        ShellAction::QuickAction(action) => {
            let app = action.app();
            shell.close_overlays();
            activate_app(icons, windows, app, area, now);
            outcome.open_app = Some(app);
            outcome.quick_action = Some(action);
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
/// Result of one task-view frame.
#[derive(Default)]
struct TaskViewResult {
    /// The overview should close.
    close: bool,
    /// Window the user picked.
    focus: Option<AppId>,
    /// Window the user closed from the overview.
    close_window: Option<AppId>,
    /// Desktops, the active desktop or a window filing changed.
    changed: bool,
}

/// Action a desktop card reported.
enum TaskViewCardAction {
    /// Nothing happened.
    None,
    /// Make the desktop active.
    Select(String),
    /// Remove the desktop.
    Delete(String),
    /// Start the inline rename.
    Rename(String),
    /// Apply the inline rename.
    CommitRename,
    /// Drop the inline rename.
    CancelRename,
}

/// Action a window card reported.
#[derive(Default)]
struct TaskViewWindowAction {
    /// Focus the window and leave the overview.
    open: bool,
    /// Close the window.
    close: bool,
    /// File the window on this desktop.
    move_to: Option<String>,
}

/// Slate and indigo colours of the reference overview.
///
/// The reference draws the task view on `slate-950/85` in both appearances, so the colours stay dark
/// instead of following the light or dark palette.
#[derive(Clone, Copy)]
struct TaskViewColors {
    backdrop: Color32,
    bar: Color32,
    bar_line: Color32,
    text: Color32,
    text_soft: Color32,
    muted: Color32,
    dim: Color32,
    line: Color32,
    line_soft: Color32,
    panel: Color32,
    panel_hover: Color32,
    inset: Color32,
    accent: Color32,
    accent_soft: Color32,
    accent_light: Color32,
    emerald: Color32,
    danger: Color32,
}

impl TaskViewColors {
    fn reference() -> Self {
        Self {
            backdrop: Color32::from_rgba_unmultiplied(2, 6, 23, 235),
            bar: Color32::from_rgba_unmultiplied(15, 23, 42, 190),
            bar_line: Color32::from_rgba_unmultiplied(30, 41, 59, 204),
            text: Color32::from_rgb(0xe2, 0xe8, 0xf0),
            text_soft: Color32::from_rgb(0xcb, 0xd5, 0xe1),
            muted: Color32::from_rgb(0x94, 0xa3, 0xb8),
            dim: Color32::from_rgb(0x64, 0x74, 0x8b),
            line: Color32::from_rgb(0x33, 0x41, 0x55),
            line_soft: Color32::from_rgb(0x1e, 0x29, 0x3b),
            panel: Color32::from_rgb(0x1e, 0x29, 0x3b),
            panel_hover: Color32::from_rgb(0x1e, 0x29, 0x3b),
            inset: Color32::from_rgb(0x0f, 0x17, 0x2a),
            accent: Color32::from_rgb(0x4f, 0x46, 0xe5),
            accent_soft: Color32::from_rgb(0x81, 0x8c, 0xf8),
            accent_light: Color32::from_rgb(0x63, 0x66, 0xf1),
            emerald: Color32::from_rgb(0x34, 0xd3, 0x99),
            danger: Color32::from_rgb(0xf4, 0x3f, 0x5e),
        }
    }
}

/// Shortens a label with an ellipsis until it fits a width.
fn taskview_fit(painter: &egui::Painter, text: &str, font: &FontId, max_width: f32) -> String {
    let measure = |candidate: &str| {
        painter
            .layout_no_wrap(candidate.to_owned(), font.clone(), Color32::WHITE)
            .size()
            .x
    };
    if measure(text) <= max_width {
        return text.to_owned();
    }
    let mut chars: Vec<char> = text.chars().collect();
    while !chars.is_empty() {
        chars.pop();
        let candidate: String = chars.iter().collect::<String>() + "…";
        if measure(&candidate) <= max_width {
            return candidate;
        }
    }
    String::new()
}

/// Capitalised module name of a window, like the reference `win.module`.
fn taskview_module(app: AppId) -> String {
    let slug = app.as_str().replace('_', " ");
    let mut chars = slug.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => slug,
    }
}

/// Draws the reference task view: the virtual desktop strip and the window overview.
fn task_view_overlay(
    ctx: &Context,
    texts: &UiTexts,
    task_view: &mut crate::shell::TaskView,
    windows: &mut WindowManager,
    screen: Rect,
) -> TaskViewResult {
    let mut result = TaskViewResult::default();
    let colors = TaskViewColors::reference();
    let compact = screen.width() < 720.0;
    let pad = if compact { 16.0 } else { 48.0 };
    let content_w = (screen.width() - pad * 2.0).clamp(280.0, 1280.0);
    let x0 = screen.center().x - content_w * 0.5;
    let bar_h = 223.0;
    let body_top = screen.top() + bar_h;
    let active_id = task_view.active_id().to_owned();
    let can_delete = task_view.desktops().len() > 1;
    let request_rename_focus = task_view.take_rename_focus();

    egui::Area::new(Id::new("socdof-task-view"))
        .order(egui::Order::Tooltip)
        .fixed_pos(screen.min)
        .show(ctx, |ui| {
            ui.set_min_size(screen.size());
            let painter = ui.painter().clone();
            painter.rect_filled(screen, 0.0, colors.backdrop);
            painter.rect_filled(
                Rect::from_min_size(screen.min, Vec2::new(screen.width(), bar_h)),
                0.0,
                colors.bar,
            );
            painter.line_segment(
                [
                    Pos2::new(screen.left(), body_top),
                    Pos2::new(screen.right(), body_top),
                ],
                Stroke::new(1.0_f32, colors.bar_line),
            );

            // Header: the reference layers glyph, the uppercase title and the close button.
            let header_y = screen.top() + 24.0;
            Icon::Grid.draw(
                &painter,
                Rect::from_min_size(Pos2::new(x0, header_y + 2.0), Vec2::splat(16.0)),
                colors.accent_soft,
                1.5,
            );
            painter.text(
                Pos2::new(x0 + 24.0, header_y + 10.0),
                Align2::LEFT_CENTER,
                texts.get("taskview_desktops_title").to_uppercase(),
                FontId::new(12.0, crate::theme::semibold()),
                colors.muted,
            );
            let close_rect = Rect::from_min_size(
                Pos2::new(x0 + content_w - 28.0, header_y - 2.0),
                Vec2::splat(28.0),
            );
            let close = ui
                .interact(close_rect, Id::new("socdof-taskview-close"), Sense::click())
                .on_hover_text(texts.get("taskview_close"));
            painter.rect_filled(
                close_rect,
                Rounding::same(10.0),
                if close.hovered() {
                    Color32::from_rgb(0x33, 0x41, 0x55)
                } else {
                    colors.panel
                },
            );
            Icon::Close.draw(
                &painter,
                Rect::from_center_size(close_rect.center(), Vec2::splat(16.0)),
                if close.hovered() {
                    Color32::WHITE
                } else {
                    colors.text_soft
                },
                1.5,
            );
            if close.clicked() {
                result.close = true;
            }

            if ctx.input(|input| input.key_pressed(Key::Escape))
                && task_view.rename_target().is_none()
            {
                result.close = true;
            }

            // Desktop strip, horizontally scrollable like the reference `overflow-x-auto`.
            let strip_rect =
                Rect::from_min_size(Pos2::new(x0, header_y + 36.0), Vec2::new(content_w, 143.0));
            let mut strip = ui.child_ui(strip_rect, egui::Layout::left_to_right(egui::Align::Min));
            egui::ScrollArea::horizontal()
                .id_source("socdof-taskview-strip")
                .auto_shrink([false, true])
                .show(&mut strip, |ui| {
                    ui.spacing_mut().item_spacing.x = 16.0;
                    let desktops = task_view.desktops().to_vec();
                    for desktop in &desktops {
                        let id = desktop.id().to_owned();
                        let editing = task_view.rename_target() == Some(id.as_str());
                        let count = windows.windows_on(&id).len();
                        let mut buffer = if editing {
                            task_view.rename_buffer_mut().clone()
                        } else {
                            String::new()
                        };
                        let action = desktop_card(
                            ui,
                            &colors,
                            texts,
                            desktop,
                            task_view.is_active(&id),
                            count,
                            can_delete,
                            editing,
                            &mut buffer,
                            request_rename_focus,
                        );
                        if editing {
                            *task_view.rename_buffer_mut() = buffer;
                        }
                        match action {
                            TaskViewCardAction::None => {}
                            TaskViewCardAction::Select(target) => {
                                task_view.select(&target);
                                windows.focus_on(&target);
                                result.changed = true;
                            }
                            TaskViewCardAction::Delete(target) => {
                                if delete_virtual_desktop(task_view, windows, &target) {
                                    result.changed = true;
                                }
                            }
                            TaskViewCardAction::Rename(target) => {
                                task_view.begin_rename(&target);
                            }
                            TaskViewCardAction::CommitRename => {
                                if task_view.commit_rename() {
                                    result.changed = true;
                                }
                            }
                            TaskViewCardAction::CancelRename => task_view.cancel_rename(),
                        }
                    }
                    if add_desktop_card(ui, &colors, texts) {
                        if let Some(id) = task_view.add() {
                            windows.focus_on(&id);
                            result.changed = true;
                        }
                    }
                });

            // Window overview.
            let body_rect = Rect::from_min_max(
                Pos2::new(x0, body_top),
                Pos2::new(x0 + content_w, screen.bottom()),
            );
            let mut body = ui.child_ui(body_rect, egui::Layout::top_down(egui::Align::Min));
            let cards: Vec<(AppId, String, bool, Option<String>)> = windows
                .windows()
                .iter()
                .filter(|window| window.is_on(&active_id))
                .map(|window| {
                    (
                        window.app(),
                        window.title().to_owned(),
                        window.is_minimized(),
                        window.desktop().map(|desktop| desktop.to_owned()),
                    )
                })
                .collect();
            let desktops = task_view.desktops().to_vec();
            egui::ScrollArea::vertical()
                .id_source("socdof-taskview-grid")
                .auto_shrink([false, false])
                .show(&mut body, |ui| {
                    ui.add_space(if compact { 20.0 } else { 36.0 });
                    ui.set_width(content_w);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        ui.label(
                            RichText::new(texts.get("taskview_open_windows"))
                                .size(14.0)
                                .family(crate::theme::semibold())
                                .color(colors.text_soft),
                        );
                        let (pill, _) =
                            ui.allocate_exact_size(Vec2::new(26.0, 18.0), Sense::hover());
                        ui.painter()
                            .rect_filled(pill, Rounding::same(9.0), colors.panel);
                        ui.painter().text(
                            pill.center(),
                            Align2::CENTER_CENTER,
                            cards.len().to_string(),
                            FontId::new(11.0, crate::theme::semibold()),
                            colors.muted,
                        );
                        if !compact {
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        RichText::new(texts.get("taskview_hint_switch"))
                                            .size(12.0)
                                            .color(colors.dim),
                                    );
                                },
                            );
                        }
                    });
                    ui.add_space(16.0);

                    if cards.is_empty() {
                        let (empty, _) =
                            ui.allocate_exact_size(Vec2::new(content_w, 180.0), Sense::hover());
                        Icon::Monitor.draw(
                            ui.painter(),
                            Rect::from_center_size(
                                empty.center() - Vec2::new(0.0, 20.0),
                                Vec2::splat(48.0),
                            ),
                            colors.line,
                            1.2,
                        );
                        ui.painter().text(
                            empty.center() + Vec2::new(0.0, 26.0),
                            Align2::CENTER_CENTER,
                            texts.get("taskview_no_windows"),
                            FontId::proportional(14.0),
                            colors.dim,
                        );
                        return;
                    }

                    let gap = 16.0;
                    let columns = if content_w >= 1024.0 {
                        4
                    } else if content_w >= 768.0 {
                        3
                    } else if content_w >= 600.0 {
                        2
                    } else {
                        1
                    };
                    let card_width = (content_w - gap * (columns as f32 - 1.0)) / columns as f32;
                    let card_height = if desktops.len() > 1 { 222.0 } else { 198.0 };
                    for row in cards.chunks(columns) {
                        ui.horizontal(|ui| {
                            ui.spacing_mut().item_spacing.x = gap;
                            for (app, title, minimized, desktop) in row {
                                let action = window_card(
                                    ui,
                                    &colors,
                                    texts,
                                    *app,
                                    title,
                                    *minimized,
                                    desktop.as_deref(),
                                    &desktops,
                                    card_width,
                                    card_height,
                                );
                                if action.open {
                                    result.focus = Some(*app);
                                }
                                if action.close {
                                    result.close_window = Some(*app);
                                }
                                if let Some(target) = action.move_to {
                                    if windows.move_to_desktop(*app, Some(target)) {
                                        result.changed = true;
                                    }
                                }
                            }
                        });
                        ui.add_space(gap);
                    }
                    ui.add_space(12.0);
                });
        });

    result
}

/// Removes a desktop and refiles its windows on the first remaining one.
///
/// Mirrors the reference `removeVirtualDesktop`: the last card never goes away and the windows of
/// the removed desktop move to the first remaining one.
fn delete_virtual_desktop(
    task_view: &mut crate::shell::TaskView,
    windows: &mut WindowManager,
    id: &str,
) -> bool {
    let Some(fallback) = task_view.remove(id) else {
        return false;
    };
    let apps = windows.windows_on(id);
    for app in apps {
        let filed = windows
            .windows()
            .iter()
            .find(|window| window.app() == app)
            .and_then(|window| window.desktop())
            .map(|desktop| desktop.to_owned());
        if filed.as_deref() == Some(id) {
            windows.move_to_desktop(app, Some(fallback.clone()));
        }
    }
    if task_view.is_active(&fallback) {
        windows.focus_on(&fallback);
    }
    true
}

/// One desktop card of the strip.
#[allow(clippy::too_many_arguments)]
fn desktop_card(
    ui: &mut Ui,
    colors: &TaskViewColors,
    texts: &UiTexts,
    desktop: &crate::shell::VirtualDesktop,
    active: bool,
    count: usize,
    can_delete: bool,
    editing: bool,
    buffer: &mut String,
    request_focus: bool,
) -> TaskViewCardAction {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(170.0, 135.0), Sense::click());
    let hovered = response.hovered();
    let painter = ui.painter().clone();
    let rounding = Rounding::same(16.0);
    let (fill, width, stroke) = if active {
        (with_alpha(colors.accent, 77), 2.0, colors.accent_light)
    } else if hovered {
        (colors.panel_hover, 1.0_f32, colors.line)
    } else {
        (
            with_alpha(colors.panel, 153),
            1.0_f32,
            with_alpha(colors.line_soft, 153),
        )
    };
    painter.rect_filled(rect, rounding, fill);
    painter.rect_stroke(rect, rounding, Stroke::new(width, stroke));

    // Mini desktop preview with the reference indigo glow.
    let preview = Rect::from_min_size(rect.min + Vec2::splat(12.0), Vec2::new(146.0, 80.0));
    painter.rect_filled(preview, Rounding::same(12.0), colors.inset);
    // `from-slate-950 via-slate-900 to-indigo-950/70`: an indigo-950 glow towards the bottom right.
    for step in 0..7 {
        let inset = step as f32 * 6.0;
        let glow = Rect::from_min_max(
            preview.min + Vec2::new(inset * 0.5, inset * 0.9),
            preview.max - Vec2::new(inset * 0.1, inset * 0.6),
        );
        painter.rect_filled(
            glow,
            Rounding::same(10.0),
            Color32::from_rgba_unmultiplied(0x1e, 0x1b, 0x4b, 26 - step * 3),
        );
    }
    painter.rect_stroke(
        preview,
        Rounding::same(12.0),
        Stroke::new(1.0_f32, with_alpha(colors.line, 128)),
    );
    Icon::Monitor.draw(
        &painter,
        Rect::from_center_size(preview.center() - Vec2::new(0.0, 9.0), Vec2::splat(24.0)),
        if active {
            colors.accent_soft
        } else {
            colors.dim
        },
        1.4,
    );
    painter.text(
        preview.center() + Vec2::new(0.0, 15.0),
        Align2::CENTER_CENTER,
        format!("{count} {}", texts.get("taskview_windows")),
        FontId::proportional(10.0),
        colors.muted,
    );
    if active {
        let dot = preview.right_top() + Vec2::new(-8.0, 8.0);
        painter.circle_filled(dot, 6.0, Color32::from_rgb(0x02, 0x2c, 0x22));
        painter.circle_filled(dot, 4.0, colors.emerald);
    }

    if can_delete {
        let delete = Rect::from_min_size(preview.min + Vec2::splat(4.0), Vec2::splat(20.0));
        let response = ui
            .interact(
                delete,
                Id::new(("socdof-taskview-delete", desktop.id())),
                Sense::click(),
            )
            .on_hover_text(texts.get("taskview_delete"));
        if hovered || response.hovered() {
            painter.rect_filled(
                delete,
                Rounding::same(6.0),
                if response.hovered() {
                    Color32::from_rgb(0xe1, 0x1d, 0x48)
                } else {
                    with_alpha(colors.danger, 204)
                },
            );
            Icon::Trash.draw(
                &painter,
                Rect::from_center_size(delete.center(), Vec2::splat(12.0)),
                Color32::WHITE,
                1.3,
            );
        }
        if response.clicked() {
            return TaskViewCardAction::Delete(desktop.id().to_owned());
        }
    }

    let name_rect = Rect::from_min_size(
        Pos2::new(rect.left() + 12.0, rect.bottom() - 27.0),
        Vec2::new(146.0, 20.0),
    );
    if editing {
        let action = ui
            .scope(|ui| {
                ui.visuals_mut().extreme_bg_color = Color32::from_rgb(2, 6, 23);
                ui.visuals_mut().widgets.inactive.bg_stroke = Stroke::new(1.0_f32, colors.accent);
                ui.visuals_mut().selection.bg_fill = colors.accent;
                let edit = egui::TextEdit::singleline(buffer)
                    .id(Id::new(("socdof-taskview-rename", desktop.id())))
                    .font(FontId::new(12.0, crate::theme::semibold()))
                    .horizontal_align(egui::Align::Center)
                    .text_color(Color32::WHITE)
                    .desired_width(140.0);
                let response = ui.put(name_rect, edit);
                if request_focus {
                    response.request_focus();
                }
                if ui.input(|input| input.key_pressed(Key::Escape)) {
                    return Some(TaskViewCardAction::CancelRename);
                }
                if ui.input(|input| input.key_pressed(Key::Enter)) || response.lost_focus() {
                    return Some(TaskViewCardAction::CommitRename);
                }
                None
            })
            .inner;
        return action.unwrap_or(TaskViewCardAction::None);
    }

    let font = FontId::new(12.0, crate::theme::semibold());
    let label = taskview_fit(&painter, desktop.name(), &font, 118.0);
    painter.text(
        name_rect.center() - Vec2::new(5.0, 0.0),
        Align2::CENTER_CENTER,
        label,
        font,
        colors.text,
    );
    let pencil = ui
        .interact(
            Rect::from_center_size(
                Pos2::new(name_rect.right() - 8.0, name_rect.center().y),
                Vec2::splat(16.0),
            ),
            Id::new(("socdof-taskview-rename-btn", desktop.id())),
            Sense::click(),
        )
        .on_hover_text(texts.get("taskview_rename"));
    if hovered || pencil.hovered() {
        Icon::Edit.draw(
            &painter,
            Rect::from_center_size(pencil.rect.center(), Vec2::splat(11.0)),
            if pencil.hovered() {
                Color32::WHITE
            } else {
                colors.muted
            },
            1.3,
        );
    }
    if pencil.clicked() {
        return TaskViewCardAction::Rename(desktop.id().to_owned());
    }
    if response.clicked() {
        return TaskViewCardAction::Select(desktop.id().to_owned());
    }
    TaskViewCardAction::None
}

/// The dashed add card at the end of the strip.
fn add_desktop_card(ui: &mut Ui, colors: &TaskViewColors, texts: &UiTexts) -> bool {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(150.0, 135.0), Sense::click());
    let text = if response.hovered() {
        Color32::WHITE
    } else {
        colors.muted
    };
    let painter = ui.painter().clone();
    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        with_alpha(colors.panel, if response.hovered() { 204 } else { 102 }),
    );
    let line = if response.hovered() {
        colors.accent_soft
    } else {
        colors.line
    };
    let stroke = Stroke::new(1.0_f32, line);
    let corners = [
        rect.left_top(),
        rect.right_top(),
        rect.right_bottom(),
        rect.left_bottom(),
        rect.left_top(),
    ];
    for pair in corners.windows(2) {
        painter.extend(egui::Shape::dashed_line(pair, stroke, 4.0, 4.0));
    }
    let square = Rect::from_center_size(rect.center() - Vec2::new(0.0, 18.0), Vec2::splat(36.0));
    painter.rect_filled(square, Rounding::same(12.0), with_alpha(colors.line, 153));
    Icon::Plus.draw(
        &painter,
        Rect::from_center_size(square.center(), Vec2::splat(20.0)),
        colors.accent_soft,
        1.6,
    );
    painter.text(
        rect.center() + Vec2::new(0.0, 26.0),
        Align2::CENTER_CENTER,
        taskview_fit(
            &painter,
            texts.get("taskview_new_desktop"),
            &FontId::proportional(12.0),
            130.0,
        ),
        FontId::proportional(12.0),
        text,
    );
    response
        .on_hover_text(texts.get("taskview_new_desktop_hint"))
        .clicked()
}

/// One window card of the overview.
#[allow(clippy::too_many_arguments)]
fn window_card(
    ui: &mut Ui,
    colors: &TaskViewColors,
    texts: &UiTexts,
    app: AppId,
    title: &str,
    minimized: bool,
    filed_on: Option<&str>,
    desktops: &[crate::shell::VirtualDesktop],
    width: f32,
    height: f32,
) -> TaskViewWindowAction {
    let mut action = TaskViewWindowAction::default();
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, height), Sense::click());
    let hovered = response.hovered();
    let painter = ui.painter().clone();
    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        if hovered {
            colors.panel
        } else {
            with_alpha(colors.inset, 230)
        },
    );
    painter.rect_stroke(
        rect,
        Rounding::same(16.0),
        Stroke::new(
            1.0_f32,
            if hovered {
                with_alpha(colors.accent_light, 204)
            } else {
                with_alpha(colors.line, 179)
            },
        ),
    );
    if hovered {
        // The reference scales the card by 1.02; a soft indigo halo takes its place because egui
        // cannot scale an allocated card without moving its neighbours.
        painter.rect_stroke(
            rect.expand(1.5),
            Rounding::same(17.0),
            Stroke::new(1.0_f32, with_alpha(colors.accent, 60)),
        );
    }

    // Title bar: initial badge, title and the close cross.
    let badge = Rect::from_min_size(rect.min + Vec2::splat(12.0), Vec2::splat(20.0));
    painter.rect_filled(badge, Rounding::same(8.0), with_alpha(colors.accent, 153));
    painter.text(
        badge.center(),
        Align2::CENTER_CENTER,
        title
            .chars()
            .next()
            .map(|first| first.to_uppercase().to_string())
            .unwrap_or_default(),
        FontId::new(10.0, crate::theme::semibold()),
        Color32::WHITE,
    );
    let title_font = FontId::new(12.0, crate::theme::semibold());
    let title_text = taskview_fit(
        &painter,
        title,
        &title_font,
        width - 12.0 - 20.0 - 8.0 - 32.0,
    );
    painter.text(
        Pos2::new(badge.right() + 8.0, badge.center().y),
        Align2::LEFT_CENTER,
        title_text,
        title_font,
        if hovered {
            Color32::from_rgb(0xa5, 0xb4, 0xfc)
        } else {
            colors.text
        },
    );
    let close_rect = Rect::from_center_size(
        Pos2::new(rect.right() - 22.0, badge.center().y),
        Vec2::splat(20.0),
    );
    let close = ui
        .interact(
            close_rect,
            Id::new(("socdof-taskview-window-close", app.as_str())),
            Sense::click(),
        )
        .on_hover_text(texts.get("taskview_close_window"));
    if close.hovered() {
        painter.rect_filled(
            close_rect,
            Rounding::same(6.0),
            with_alpha(Color32::from_rgb(0xe1, 0x1d, 0x48), 204),
        );
    }
    Icon::Close.draw(
        &painter,
        Rect::from_center_size(close_rect.center(), Vec2::splat(14.0)),
        if close.hovered() {
            Color32::WHITE
        } else {
            colors.muted
        },
        1.3,
    );
    if close.clicked() {
        action.close = true;
        return action;
    }

    // Thumbnail simulation with the reference skeleton lines.
    let thumb = Rect::from_min_size(
        Pos2::new(rect.left() + 12.0, badge.bottom() + 10.0),
        Vec2::new(width - 24.0, 144.0),
    );
    painter.rect_filled(
        thumb,
        Rounding::same(12.0),
        Color32::from_rgba_unmultiplied(2, 6, 23, 204),
    );
    painter.rect_stroke(
        thumb,
        Rounding::same(12.0),
        Stroke::new(
            1.0_f32,
            if hovered {
                colors.line
            } else {
                colors.line_soft
            },
        ),
    );
    let inner = thumb.shrink(12.0);
    painter.rect_filled(
        Rect::from_min_size(inner.min, Vec2::new(inner.width() / 3.0, 8.0)),
        Rounding::same(4.0),
        colors.line,
    );
    for (index, fraction) in [1.0_f32, 0.8, 0.66].into_iter().enumerate() {
        painter.rect_filled(
            Rect::from_min_size(
                Pos2::new(inner.left(), inner.top() + 18.0 + index as f32 * 8.0),
                Vec2::new(inner.width() * fraction, 6.0),
            ),
            Rounding::same(3.0),
            colors.line_soft,
        );
    }
    let footer = Pos2::new(inner.left(), thumb.bottom() - 20.0);
    painter.line_segment(
        [
            Pos2::new(inner.left(), footer.y - 6.0),
            Pos2::new(inner.right(), footer.y - 6.0),
        ],
        Stroke::new(1.0_f32, Color32::from_rgb(0x0b, 0x12, 0x20)),
    );
    painter.text(
        footer + Vec2::new(0.0, 4.0),
        Align2::LEFT_CENTER,
        taskview_fit(
            &painter,
            &taskview_module(app),
            &FontId::proportional(10.0),
            inner.width() * 0.5,
        ),
        FontId::proportional(10.0),
        colors.muted,
    );
    if minimized {
        let badge_rect = Rect::from_min_size(
            Pos2::new(inner.right() - 58.0, footer.y - 6.0),
            Vec2::new(58.0, 16.0),
        );
        painter.rect_filled(
            badge_rect,
            Rounding::same(4.0),
            Color32::from_rgba_unmultiplied(69, 26, 3, 153),
        );
        painter.rect_stroke(
            badge_rect,
            Rounding::same(4.0),
            Stroke::new(1.0_f32, Color32::from_rgba_unmultiplied(146, 64, 14, 102)),
        );
        painter.text(
            badge_rect.center(),
            Align2::CENTER_CENTER,
            texts.get("taskview_minimized"),
            FontId::proportional(9.0),
            Color32::from_rgb(0xfb, 0xbf, 0x24),
        );
    }

    if desktops.len() > 1 {
        let row_y = rect.bottom() - 32.0;
        painter.line_segment(
            [
                Pos2::new(rect.left() + 12.0, row_y - 6.0),
                Pos2::new(rect.right() - 12.0, row_y - 6.0),
            ],
            Stroke::new(1.0_f32, colors.line_soft),
        );
        painter.text(
            Pos2::new(rect.left() + 12.0, row_y + 6.0),
            Align2::LEFT_CENTER,
            texts.get("taskview_move_to"),
            FontId::proportional(11.0),
            colors.muted,
        );
        let mut right = rect.right() - 12.0;
        for desktop in desktops.iter().rev() {
            let label = desktop.short_name();
            let font = FontId::new(10.0, crate::theme::semibold());
            let text_width = painter
                .layout_no_wrap(label.clone(), font.clone(), Color32::WHITE)
                .size()
                .x;
            let button = Rect::from_min_size(
                Pos2::new(right - text_width - 16.0, row_y - 3.0),
                Vec2::new(text_width + 16.0, 18.0),
            );
            let selected = filed_on == Some(desktop.id())
                || (filed_on.is_none() && desktop.id() == "desktop-1");
            let response = ui
                .interact(
                    button,
                    Id::new(("socdof-taskview-move", app.as_str(), desktop.id())),
                    Sense::click(),
                )
                .on_hover_text(
                    texts
                        .get("taskview_move_to_desktop")
                        .replace("{name}", desktop.name()),
                );
            painter.rect_filled(
                button,
                Rounding::same(4.0),
                if selected {
                    colors.accent
                } else if response.hovered() {
                    Color32::from_rgb(0x33, 0x41, 0x55)
                } else {
                    colors.panel
                },
            );
            painter.text(
                button.center(),
                Align2::CENTER_CENTER,
                label,
                font,
                if selected {
                    Color32::WHITE
                } else {
                    colors.text_soft
                },
            );
            if response.clicked() {
                action.move_to = Some(desktop.id().to_owned());
                return action;
            }
            right = button.left() - 4.0;
        }
    }

    if response.clicked() {
        action.open = true;
    }
    action
}

fn activate_app(
    icons: &IconGrid,
    windows: &mut WindowManager,
    app: AppId,
    work_area: Rect,
    now: i64,
) {
    if windows.is_open(app) {
        // A window filed on another virtual desktop comes along instead of being focused while
        // invisible, which is the closest native equivalent of the reference opening the app on the
        // desktop the user is looking at.
        let current = windows.current_desktop().to_owned();
        let elsewhere = windows
            .windows()
            .iter()
            .any(|window| window.app() == app && !window.is_on(&current));
        if elsewhere {
            windows.move_to_desktop(app, Some(current));
        }
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

/// Action a desktop context menu asked for.
#[derive(Debug, Clone, PartialEq, Eq)]
enum MenuAction {
    /// Open the widgets app.
    Widgets,
    /// Pin a fresh sticky note to the desktop.
    StickyNote,
    /// Open the task view with the virtual desktops.
    TaskView,
    /// Create an empty folder and open it.
    Create,
    /// Import files from the chosen storage location.
    Upload(UploadTarget),
    /// Lay the desktop items out in reading order.
    ArrangeIcons,
    /// Snap freely placed items back to the grid.
    SnapGrid,
    /// Launch an app window.
    OpenApp(AppId),
    /// Enter or leave fullscreen.
    Fullscreen,
    /// Open a folder in the modal.
    Open(String),
    /// Start editing a folder name.
    Rename(String),
    /// Dissolve a folder and put its apps back on the desktop.
    Dissolve(String),
}

/// Draws one folder tile: the translucent squircle with a preview of the contained apps.
///
/// The reference shows a folder glyph for an empty folder, one large icon for a single app, two
/// icons side by side, a 2 × 2 grid for three or four, and three icons with a `+n` counter beyond
/// that (`DesktopWindowWorkspace.tsx:3060`).
fn paint_folder_tile(
    ctx: &Context,
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    folder: &DesktopFolder,
) {
    let tile = Rect::from_center_size(
        Pos2::new(rect.center().x, rect.top() + 8.0 + ICON_TILE / 2.0),
        Vec2::splat(ICON_TILE),
    );
    let rounding = 16.0;
    tile_shadow(ctx, painter, tile, rounding);
    painter.rect(
        tile,
        Rounding::same(rounding),
        with_alpha(
            theme.palette.surface,
            if theme.appearance.is_dark() { 214 } else { 235 },
        ),
        Stroke::new(1.0_f32, with_alpha(theme.palette.border, 220)),
    );

    let inner = tile.shrink(9.0);
    let apps = folder.apps();
    match apps.len() {
        0 => Icon::Folder.draw(painter, inner, theme.accent.base, 2.0),
        1 => paint_app_chip(
            painter,
            theme,
            Rect::from_center_size(inner.center(), Vec2::splat(inner.height())),
            apps[0],
        ),
        2 => {
            let size = Vec2::new(inner.width() / 2.0 - 3.0, inner.height() - 6.0);
            for (index, app) in apps.iter().enumerate() {
                let chip = Rect::from_min_size(
                    Pos2::new(
                        inner.left() + index as f32 * (size.x + 6.0),
                        inner.top() + 3.0,
                    ),
                    size,
                );
                paint_app_chip(painter, theme, chip, *app);
            }
        }
        count => {
            let cell = Vec2::new(inner.width() / 2.0 - 2.0, inner.height() / 2.0 - 2.0);
            for (index, app) in apps.iter().enumerate().take(4) {
                let column = index % 2;
                let row = index / 2;
                let chip = Rect::from_min_size(
                    Pos2::new(
                        inner.left() + column as f32 * (cell.x + 4.0),
                        inner.top() + row as f32 * (cell.y + 4.0),
                    ),
                    cell,
                );
                // Beyond four apps the fourth slot counts the rest.
                if count > 4 && index == 3 {
                    painter.rect(chip, Rounding::same(5.0), theme.accent.base, Stroke::NONE);
                    painter.text(
                        chip.center(),
                        Align2::CENTER_CENTER,
                        format!("+{}", count - 3),
                        FontId::new(9.0, crate::theme::semibold()),
                        theme.palette.accent_on,
                    );
                } else {
                    paint_app_chip(painter, theme, chip, *app);
                }
            }
        }
    }

    let caption = if theme.appearance.is_dark() {
        Color32::WHITE
    } else {
        Color32::from_rgb(0x1e, 0x29, 0x3b)
    };
    let galley = painter.layout(
        folder.name().to_owned(),
        FontId::new(12.0, crate::theme::semibold()),
        caption,
        ICON_LABEL_WIDTH,
    );
    painter.galley(
        Pos2::new(rect.center().x - galley.size().x / 2.0, tile.bottom() + 8.0),
        galley,
        caption,
    );
}

/// Draws one small app square inside a folder tile or the folder modal.
fn paint_app_chip(painter: &egui::Painter, _theme: &Theme, rect: Rect, app: AppId) {
    let chrome = crate::chrome::app_chrome(app.as_str());
    crate::tokens::gradient_round_rect(
        painter,
        rect,
        (rect.height() * 0.28).min(10.0),
        &crate::chrome::tint_stops(chrome),
    );
    chrome.icon.draw(
        painter,
        Rect::from_center_size(rect.center(), Vec2::splat(rect.height() * 0.52)),
        Color32::WHITE,
        1.6,
    );
}

/// Draws the small square icon button used in the folder modal and returns whether it was clicked.
fn modal_icon_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
    danger: bool,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(24.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let hovered = response.hovered() || focused;
    if hovered {
        ui.painter().rect(
            rect,
            Rounding::same(RADIUS_CONTROL),
            with_alpha(
                if danger {
                    theme.palette.danger
                } else {
                    theme.palette.text
                },
                16,
            ),
            Stroke::NONE,
        );
    }
    let color = if danger && hovered {
        theme.palette.danger
    } else {
        theme.palette.text_muted
    };
    icon.draw(ui.painter(), rect.shrink(6.0), color, 1.8);
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    response.clicked()
}

/// Draws the desktop background menu and the folder context menu of this frame.
///
/// The reference menus are one vertical list in a translucent card (`DesktopWindowWorkspace.tsx:4836`
/// and `:5039`). Only the folder entries are ported so far; the widget, task view, upload and
/// arrange entries of the background menu stay open work.
fn desktop_menus(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    folders: &mut FolderSet,
    fullscreen: bool,
) -> Option<MenuAction> {
    if ctx.input(|input| input.key_pressed(Key::Escape)) {
        folders.close_menu();
        folders.close_context();
        return None;
    }
    let mut action = None;
    if let Some(pos) = folders.menu() {
        let mut picked = None;
        egui::Area::new(Id::new("socdof-desktop-menu"))
            .order(egui::Order::Tooltip)
            .fixed_pos(pos)
            .show(ctx, |ui| {
                menu_frame(theme).show(ui, |ui| {
                    ui.set_width(248.0);
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Widgets,
                        texts.get("desktop_menu_widgets"),
                        false,
                    ) {
                        picked = Some(MenuAction::Widgets);
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::StickyNote,
                        texts.get("desktop_menu_sticky_note"),
                        false,
                    ) {
                        picked = Some(MenuAction::StickyNote);
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Grid,
                        texts.get("desktop_menu_task_view"),
                        false,
                    ) {
                        picked = Some(MenuAction::TaskView);
                    }
                    menu_separator(ui, theme);
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Folder,
                        texts.get("desktop_new_folder"),
                        false,
                    ) {
                        picked = Some(MenuAction::Create);
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Upload,
                        texts.get("desktop_menu_upload"),
                        false,
                    ) {
                        picked = Some(MenuAction::Upload(UploadTarget::Desktop));
                    }
                    menu_separator(ui, theme);
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Grid,
                        texts.get("desktop_menu_arrange"),
                        false,
                    ) {
                        picked = Some(MenuAction::ArrangeIcons);
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Filter,
                        texts.get("desktop_menu_snap"),
                        false,
                    ) {
                        picked = Some(MenuAction::SnapGrid);
                    }
                    menu_separator(ui, theme);
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Package,
                        texts.get("desktop_menu_appstore"),
                        false,
                    ) {
                        picked = Some(MenuAction::OpenApp(AppId::new("app-store")));
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Settings,
                        texts.get("desktop_menu_settings"),
                        false,
                    ) {
                        picked = Some(MenuAction::OpenApp(AppId::new("settings")));
                    }
                    menu_separator(ui, theme);
                    let fullscreen_label = if fullscreen {
                        texts.get("desktop_exit_fullscreen")
                    } else {
                        texts.get("desktop_enter_fullscreen")
                    };
                    if menu_entry_hint(
                        ui,
                        theme,
                        focus,
                        if fullscreen {
                            Icon::Restore
                        } else {
                            Icon::Maximize
                        },
                        fullscreen_label,
                        false,
                        Some("F11"),
                    ) {
                        picked = Some(MenuAction::Fullscreen);
                    }
                });
            });
        if picked.is_some() {
            folders.close_menu();
            action = picked;
        }
    }
    if let Some((folder_id, pos)) = folders.context().map(|(id, pos)| (id.to_owned(), pos)) {
        let name = folders
            .get(&folder_id)
            .map(|folder| folder.name().to_owned())
            .unwrap_or_default();
        let mut picked = None;
        egui::Area::new(Id::new("socdof-folder-menu"))
            .order(egui::Order::Tooltip)
            .fixed_pos(pos)
            .show(ctx, |ui| {
                menu_frame(theme).show(ui, |ui| {
                    ui.set_width(220.0);
                    ui.label(
                        RichText::new(name)
                            .family(crate::theme::semibold())
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.separator();
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Folder,
                        texts.get("desktop_folder_open"),
                        false,
                    ) {
                        picked = Some(MenuAction::Open(folder_id.clone()));
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Upload,
                        texts.get("desktop_menu_upload"),
                        false,
                    ) {
                        picked = Some(MenuAction::Upload(UploadTarget::Folder(folder_id.clone())));
                    }
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Edit,
                        texts.get("desktop_folder_rename"),
                        false,
                    ) {
                        picked = Some(MenuAction::Rename(folder_id.clone()));
                    }
                    menu_separator(ui, theme);
                    if menu_entry(
                        ui,
                        theme,
                        focus,
                        Icon::Trash,
                        texts.get("desktop_folder_dissolve"),
                        true,
                    ) {
                        picked = Some(MenuAction::Dissolve(folder_id.clone()));
                    }
                });
            });
        if picked.is_some() {
            folders.close_context();
            action = picked;
        }
    }
    action
}

/// Separator line between two groups of context menu entries.
fn menu_separator(ui: &mut Ui, theme: &Theme) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 9.0), Sense::hover());
    let y = rect.center().y;
    ui.painter().line_segment(
        [
            Pos2::new(rect.left() + 6.0, y),
            Pos2::new(rect.right() - 6.0, y),
        ],
        Stroke::new(1.0_f32, theme.palette.border),
    );
}

/// Frame of the reference context menus: translucent surface card with a hairline border.
fn menu_frame(theme: &Theme) -> egui::Frame {
    egui::Frame::none()
        .fill(theme.palette.surface)
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .rounding(Rounding::same(RADIUS_CARD))
        .inner_margin(egui::Margin::same(6.0))
}

/// One full width entry of a context menu.
fn menu_entry(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
    danger: bool,
) -> bool {
    menu_entry_hint(ui, theme, focus, icon, label, danger, None)
}

/// One context menu entry with an optional key hint on the right, like the reference `F11` badge.
fn menu_entry_hint(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
    danger: bool,
    hint: Option<&str>,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let width = ui.available_width().max(120.0);
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 32.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let hovered = response.hovered() || focused;
    if hovered {
        ui.painter().rect(
            rect,
            Rounding::same(RADIUS_CONTROL),
            with_alpha(
                if danger {
                    theme.palette.danger
                } else {
                    theme.accent.base
                },
                18,
            ),
            Stroke::NONE,
        );
    }
    let color = if danger {
        theme.palette.danger
    } else {
        theme.palette.text
    };
    icon.draw(
        ui.painter(),
        Rect::from_center_size(
            Pos2::new(rect.left() + 16.0, rect.center().y),
            Vec2::splat(14.0),
        ),
        color,
        1.8,
    );
    ui.painter().text(
        Pos2::new(rect.left() + 30.0, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        FontId::proportional(FONT_SMALL),
        color,
    );
    if let Some(hint) = hint {
        let galley = ui.painter().layout_no_wrap(
            hint.to_owned(),
            FontId::monospace(10.0),
            theme.palette.text_muted,
        );
        let badge = Rect::from_center_size(
            Pos2::new(rect.right() - galley.size().x / 2.0 - 10.0, rect.center().y),
            galley.size() + Vec2::new(10.0, 4.0),
        );
        ui.painter().rect(
            badge,
            Rounding::same(5.0),
            theme.palette.surface_muted,
            Stroke::new(1.0_f32, theme.palette.border),
        );
        ui.painter()
            .galley(badge.center() - galley.size() / 2.0, galley, color);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    response.clicked()
}

/// Draws the folder modal and returns the app the user launched from it.
///
/// Mirrors the reference `DesktopFolderModal`: two tabs (`Apps & Module` and
/// `Dateien & Speicherorte`) with their counts, the editable folder name as the heading, the app
/// tiles with a launch and a remove control, the upload card with the chosen storage location, the
/// file list and the footer that dissolves the folder or closes the modal. The reference opens the
/// file details in their own modal (`StorageAssetPreviewModal`); the native shell shows the same
/// values in a pane inside this modal so a second window cannot cover the folder on a phone
/// viewport.
fn folder_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    folders: &mut FolderSet,
    storage: &mut DesktopStorage,
    outcome: &mut DesktopOutcome,
) -> Option<AppId> {
    let folder_id = folders.open_id().map(str::to_owned)?;
    let Some(folder) = folders.get(&folder_id).cloned() else {
        folders.close();
        return None;
    };
    let screen = ctx.screen_rect();
    let width = (screen.width() - 32.0).min(560.0);
    let mut launch = None;
    let mut close = false;
    let mut dissolve = false;
    let mut remove_app = None;
    let mut commit_rename = false;
    let mut upload = false;
    let mut delete_asset: Option<String> = None;
    let mut download_asset: Option<String> = None;
    let mut choose_location = false;

    // Dimmed backdrop, like `bg-black/40 backdrop-blur-md` in the reference modal.
    egui::Area::new(Id::new("socdof-folder-backdrop"))
        .order(egui::Order::Tooltip)
        .fixed_pos(screen.min)
        .show(ctx, |ui| {
            let (rect, response) = ui.allocate_exact_size(screen.size(), Sense::click());
            ui.painter().rect(
                rect,
                Rounding::ZERO,
                with_alpha(Color32::BLACK, 96),
                Stroke::NONE,
            );
            if response.clicked() {
                close = true;
            }
        });

    // The body scrolls inside a bounded height, so the modal also fits a phone viewport.
    // A phone sheet keeps more room for the footer, because its file rows and details stack
    // higher than on the desktop viewport.
    let body_height = if width < 460.0 {
        (screen.height() - 260.0).max(180.0)
    } else {
        (screen.height() - 210.0).max(180.0)
    };
    let columns = if width < 460.0 { 3 } else { 4 };
    let rows = folder.apps().len().div_ceil(columns).max(1);
    // Estimated content height, so the modal is centred on the first painted frame too.
    let estimated = match folders.tab() {
        FolderTab::Files => body_height + 185.0,
        FolderTab::Apps => 150.0 + 86.0 * rows as f32,
    };
    let modal_top = ((screen.center().y - estimated / 2.0).max(screen.top() + 12.0))
        .min(screen.bottom() - 60.0);
    egui::Area::new(Id::new("socdof-folder-modal"))
        .order(egui::Order::Tooltip)
        .fixed_pos(Pos2::new(screen.center().x - width / 2.0, modal_top))
        .show(ctx, |ui| {
            menu_frame(theme).show(ui, |ui| {
                ui.set_width(width - 12.0);
                ui.horizontal(|ui| {
                    let (tile, _) = ui.allocate_exact_size(Vec2::splat(44.0), Sense::hover());
                    ui.painter().rect(
                        tile,
                        Rounding::same(14.0),
                        with_alpha(theme.accent.base, 30),
                        Stroke::new(1.0_f32, with_alpha(theme.accent.base, 90)),
                    );
                    Icon::Folder.draw(ui.painter(), tile.shrink(10.0), theme.accent.base, 2.0);
                    ui.add_space(8.0);
                    if folders.rename_target() == Some(folder_id.as_str()) {
                        let buffer = folders.rename_buffer_mut();
                        let field = crate::controls::text_field(
                            ui,
                            theme,
                            focus,
                            buffer,
                            texts.get("desktop_folder_name"),
                            "",
                            None,
                        );
                        if field.response.lost_focus()
                            && ui.input(|input| input.key_pressed(Key::Enter))
                        {
                            commit_rename = true;
                        }
                        if modal_icon_button(
                            ui,
                            theme,
                            focus,
                            Icon::Check,
                            texts.get("desktop_folder_save_name"),
                            false,
                        ) {
                            commit_rename = true;
                        }
                        if modal_icon_button(
                            ui,
                            theme,
                            focus,
                            Icon::Close,
                            texts.get("desktop_folder_cancel_rename"),
                            false,
                        ) {
                            folders.cancel_rename();
                        }
                    } else if folder_name_button(ui, theme, folder.name()) {
                        folders.begin_rename(&folder_id);
                    }
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if modal_icon_button(
                            ui,
                            theme,
                            focus,
                            Icon::Close,
                            texts.get("desktop_folder_close"),
                            false,
                        ) {
                            close = true;
                        }
                    });
                });

                ui.add_space(10.0);
                let file_count = storage.count_in(&folder_id);
                let tab = folder_tabs(
                    ui,
                    theme,
                    focus,
                    texts,
                    folder.apps().len(),
                    file_count,
                    folders.tab(),
                );
                if let Some(picked) = tab {
                    folders.set_tab(picked);
                }

                ui.add_space(10.0);
                egui::ScrollArea::vertical()
                    .id_source(("socdof-folder-body", folder_id.as_str()))
                    .max_height(body_height)
                    .show(ui, |ui| {
                        match folders.tab() {
                            FolderTab::Apps => {
                                if folder.apps().is_empty() {
                                    ui.vertical_centered(|ui| {
                                        ui.add_space(16.0);
                                        ui.label(
                                            RichText::new(texts.get("desktop_folder_empty"))
                                                .size(FONT_SMALL)
                                                .color(theme.palette.text_muted),
                                        );
                                        ui.add_space(2.0);
                                        ui.label(
                                            RichText::new(texts.get("desktop_folder_empty_hint"))
                                                .size(11.0)
                                                .color(theme.palette.text_muted),
                                        );
                                        ui.add_space(16.0);
                                    });
                                } else {
                                    let item_width = ((width - 40.0) / columns as f32).floor();
                                    let apps = folder.apps().to_vec();
                                    egui::ScrollArea::vertical()
                                        .id_source((
                                            "socdof-folder-apps-scroll",
                                            folder_id.as_str(),
                                        ))
                                        .max_height(300.0)
                                        .show(ui, |ui| {
                                            egui::Grid::new((
                                                "socdof-folder-apps",
                                                folder_id.as_str(),
                                            ))
                                            .num_columns(columns)
                                            .spacing([6.0, 8.0])
                                            .show(
                                                ui,
                                                |ui| {
                                                    for (index, app) in apps.iter().enumerate() {
                                                        let app = *app;
                                                        let chrome =
                                                            crate::chrome::app_chrome(app.as_str());
                                                        let (tile, response) = ui
                                                            .allocate_exact_size(
                                                                Vec2::new(item_width - 6.0, 78.0),
                                                                Sense::click(),
                                                            );
                                                        if response.clicked() {
                                                            launch = Some(app);
                                                        }
                                                        let remove_rect = Rect::from_min_size(
                                                            Pos2::new(
                                                                tile.right() - 20.0,
                                                                tile.top(),
                                                            ),
                                                            Vec2::splat(20.0),
                                                        );
                                                        let remove_id = Id::new((
                                                            "socdof-folder-remove",
                                                            folder_id.as_str(),
                                                            app.as_str(),
                                                        ));
                                                        let remove_response = ui.interact(
                                                            remove_rect,
                                                            remove_id,
                                                            Sense::click(),
                                                        );
                                                        let hovered = response.hovered()
                                                            || remove_response.hovered();
                                                        if hovered {
                                                            ui.painter().rect(
                                                                tile,
                                                                Rounding::same(RADIUS_CARD),
                                                                with_alpha(theme.palette.text, 10),
                                                                Stroke::NONE,
                                                            );
                                                        }
                                                        let glyph = Rect::from_center_size(
                                                            Pos2::new(
                                                                tile.center().x,
                                                                tile.top() + 30.0,
                                                            ),
                                                            Vec2::splat(48.0),
                                                        );
                                                        crate::tokens::gradient_round_rect(
                                                            ui.painter(),
                                                            glyph,
                                                            15.0,
                                                            &crate::chrome::tint_stops(chrome),
                                                        );
                                                        chrome.icon.draw(
                                                            ui.painter(),
                                                            Rect::from_center_size(
                                                                glyph.center(),
                                                                Vec2::splat(24.0),
                                                            ),
                                                            Color32::WHITE,
                                                            2.0,
                                                        );
                                                        let label =
                                                            texts.get(chrome.title_key).to_owned();
                                                        let title_galley = ui.painter().layout(
                                                            label.clone(),
                                                            FontId::new(
                                                                11.5,
                                                                crate::theme::semibold(),
                                                            ),
                                                            theme.palette.text,
                                                            tile.width() - 8.0,
                                                        );
                                                        let title_pos = Pos2::new(
                                                            tile.center().x
                                                                - title_galley.size().x / 2.0,
                                                            tile.bottom()
                                                                - title_galley.size().y
                                                                - 8.0,
                                                        );
                                                        ui.painter().galley(
                                                            title_pos,
                                                            title_galley,
                                                            theme.palette.text,
                                                        );
                                                        // Vom Ordner zurück auf den Desktop, wie der
                                                        // group-hover-Knopf der Vorlage.
                                                        if hovered {
                                                            ui.painter().circle_filled(
                                                                remove_rect.center(),
                                                                9.0,
                                                                with_alpha(
                                                                    theme.palette.surface_muted,
                                                                    240,
                                                                ),
                                                            );
                                                            Icon::Close.draw(
                                                                ui.painter(),
                                                                remove_rect.shrink(6.0),
                                                                theme.palette.text_muted,
                                                                1.6,
                                                            );
                                                        }
                                                        if remove_response.clicked() {
                                                            remove_app = Some(app);
                                                        }
                                                        response.widget_info(|| {
                                                            WidgetInfo::labeled(
                                                                WidgetType::Button,
                                                                label.clone(),
                                                            )
                                                        });
                                                        if (index + 1) % columns == 0 {
                                                            ui.end_row();
                                                        }
                                                    }
                                                },
                                            );
                                        });
                                }
                            }
                            FolderTab::Files => {
                                if folder_upload_card(ui, theme, texts) {
                                    upload = true;
                                }

                                ui.add_space(8.0);
                                ui.horizontal(|ui| {
                                    ui.label(
                                        RichText::new(texts.get("folder_files_location"))
                                            .size(FONT_SMALL)
                                            .family(crate::theme::semibold())
                                            .color(theme.palette.text_muted),
                                    );
                                    ui.with_layout(
                                        egui::Layout::right_to_left(egui::Align::Center),
                                        |ui| {
                                            if crate::components::button(
                                                ui,
                                                theme,
                                                focus,
                                                texts.get("folder_files_choose"),
                                                crate::components::ButtonVariant::Secondary,
                                            )
                                            .activated
                                            {
                                                choose_location = true;
                                            }
                                        },
                                    );
                                });
                                let field = crate::controls::text_field(
                                    ui,
                                    theme,
                                    focus,
                                    storage.location_mut(),
                                    "",
                                    texts.get("folder_files_location_hint"),
                                    None,
                                );
                                if field.response.changed() {
                                    outcome.storage_changed = true;
                                }
                                ui.add_space(8.0);
                                let assets: Vec<StorageAsset> = storage
                                    .assets_in(Some(&folder_id))
                                    .into_iter()
                                    .cloned()
                                    .collect();
                                if assets.is_empty() {
                                    ui.label(
                                        RichText::new(texts.get("folder_files_empty"))
                                            .size(FONT_SMALL)
                                            .color(theme.palette.text_muted),
                                    );
                                } else {
                                    for asset in &assets {
                                        let action = asset_row(ui, theme, focus, texts, asset);
                                        if action.details {
                                            storage.select(asset.id());
                                        }
                                        if action.download {
                                            download_asset = Some(asset.id().to_owned());
                                        }
                                        if action.delete {
                                            delete_asset = Some(asset.id().to_owned());
                                        }
                                    }
                                }
                                if let Some(asset) = storage.selected().cloned() {
                                    ui.add_space(8.0);
                                    let names: Vec<(String, usize)> = folders
                                        .folders()
                                        .iter()
                                        .map(|entry| (entry.name().to_owned(), entry.apps().len()))
                                        .collect();
                                    let (action, link) = storage_details(
                                        ui, theme, focus, texts, storage, &asset, &names,
                                    );
                                    if action.close {
                                        storage.clear_selection();
                                    }
                                    if action.delete {
                                        if storage.remove(asset.id()) {
                                            outcome.storage_changed = true;
                                        }
                                        storage.clear_selection();
                                    }
                                    if action.download && save_asset_copy(&asset) {
                                        outcome.storage_changed = true;
                                    }
                                    if let Some(target) = link {
                                        storage.link(asset.id(), target.as_deref());
                                        outcome.storage_changed = true;
                                    }
                                }
                            }
                        }
                    });

                ui.add_space(12.0);
                ui.separator();
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    let hint = match folders.tab() {
                        FolderTab::Apps => texts
                            .get("folder_files_apps_tip")
                            .replace("{count}", &folder.apps().len().to_string()),
                        FolderTab::Files => texts
                            .get("folder_files_footer")
                            .replace("{count}", &file_count.to_string()),
                    };
                    ui.label(
                        RichText::new(hint)
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if crate::components::button(
                            ui,
                            theme,
                            focus,
                            texts.get("desktop_folder_close"),
                            crate::components::ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            close = true;
                        }
                        if crate::components::button(
                            ui,
                            theme,
                            focus,
                            texts.get("desktop_folder_dissolve"),
                            crate::components::ButtonVariant::Danger,
                        )
                        .activated
                        {
                            dissolve = true;
                        }
                    });
                });
            });
        });

    if commit_rename {
        folders.commit_rename();
    }
    if let Some(app) = remove_app {
        folders.remove_app(&folder_id, app);
    }
    if upload {
        outcome.upload_assets = Some(UploadTarget::Folder(folder_id.clone()));
    }
    if choose_location {
        #[cfg(feature = "dialogs")]
        {
            if let Some(path) = rfd::FileDialog::new().pick_folder() {
                storage.set_location(path.display().to_string());
                outcome.storage_changed = true;
            }
        }
    }
    if let Some(id) = delete_asset {
        if storage.remove(&id) {
            outcome.storage_changed = true;
        }
    }
    if let Some(id) = download_asset {
        let target = storage
            .assets()
            .iter()
            .find(|asset| asset.id() == id)
            .cloned();
        if let Some(asset) = target {
            if save_asset_copy(&asset) {
                outcome.storage_changed = true;
            }
        }
    }
    if dissolve {
        // Files of a dissolved folder stay in the storage, filed on the desktop.
        let orphans: Vec<String> = storage
            .assets_in(Some(&folder_id))
            .into_iter()
            .map(|asset| asset.id().to_owned())
            .collect();
        for id in orphans {
            storage.link(&id, None);
        }
        if folders.dissolve(&folder_id) {
            outcome.folders_changed = true;
            outcome.storage_changed = true;
        }
    }
    if close {
        folders.close();
    }
    if launch.is_some() {
        folders.close();
    }
    launch
}

/// Action picked on one row of the folder file list.
#[derive(Debug, Clone, Copy, Default)]
struct AssetRowAction {
    details: bool,
    download: bool,
    delete: bool,
}

/// Folder name in the modal header with the edit affordance of the reference.
///
/// Clicking the name starts the inline rename, like the `Edit3` button next to the title.
fn folder_name_button(ui: &mut Ui, theme: &Theme, name: &str) -> bool {
    let galley = ui.painter().layout_no_wrap(
        name.to_owned(),
        FontId::new(18.0, crate::theme::semibold()),
        theme.palette.text,
    );
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(galley.size().x + 26.0, 26.0), Sense::click());
    if response.hovered() {
        ui.painter().rect(
            Rect::from_min_size(
                Pos2::new(rect.left() - 6.0, rect.top()),
                Vec2::new(rect.width() + 12.0, rect.height()),
            ),
            Rounding::same(8.0),
            with_alpha(theme.palette.text, 8),
            Stroke::NONE,
        );
    }
    ui.painter().galley(
        Pos2::new(rect.left(), rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text,
    );
    let pencil = Rect::from_center_size(
        Pos2::new(rect.right() - 8.0, rect.center().y),
        Vec2::splat(14.0),
    );
    Icon::Edit.draw(
        ui.painter(),
        pencil,
        if response.hovered() {
            theme.accent.base
        } else {
            theme.palette.text_muted
        },
        1.4,
    );
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, name));
    response.clicked()
}

/// The two equal tabs of the folder modal with their counts, like the reference pill row.
///
/// Returns the tab the user picked in this frame.
fn folder_tabs(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    texts: &UiTexts,
    apps: usize,
    files: usize,
    active: FolderTab,
) -> Option<FolderTab> {
    let width = ui.available_width();
    let (track, _) = ui.allocate_exact_size(Vec2::new(width, 34.0), Sense::hover());
    ui.painter().rect(
        track,
        Rounding::same(12.0),
        with_alpha(theme.palette.surface_muted, 200),
        Stroke::NONE,
    );
    let mut picked = None;
    let segment = ((width - 6.0) / 2.0).max(10.0);
    let entries: [(FolderTab, &str, usize, Option<Icon>); 2] = [
        (FolderTab::Apps, "folder_tab_apps", apps, None),
        (
            FolderTab::Files,
            "folder_tab_files",
            files,
            Some(Icon::HardDrive),
        ),
    ];
    for (index, (tab, key, count, icon)) in entries.into_iter().enumerate() {
        let rect = Rect::from_min_size(
            Pos2::new(
                track.left() + 2.0 + index as f32 * (segment + 2.0),
                track.top() + 2.0,
            ),
            Vec2::new(segment, 30.0),
        );
        let id = Id::new(("socdof-folder-tab", index));
        let focused = focus.register(id);
        let response = ui.interact(rect, id, Sense::click());
        let is_active = tab == active;
        let hovered = response.hovered() || focused;
        if is_active || hovered {
            ui.painter().rect(
                rect,
                Rounding::same(10.0),
                if is_active {
                    theme.palette.surface
                } else {
                    with_alpha(theme.palette.surface, 120)
                },
                if is_active {
                    Stroke::new(1.0_f32, with_alpha(theme.palette.border, 200))
                } else {
                    Stroke::NONE
                },
            );
        }
        let color = if is_active {
            theme.accent.base
        } else {
            theme.palette.text_muted
        };
        let label = texts.get(key);
        let badge = count.to_string();
        let label_galley =
            ui.painter()
                .layout_no_wrap(label.to_owned(), FontId::proportional(11.5), color);
        let badge_galley =
            ui.painter()
                .layout_no_wrap(badge.clone(), FontId::proportional(10.0), color);
        let icon_width = if icon.is_some() { 16.0 } else { 0.0 };
        let group = icon_width + label_galley.size().x + 6.0 + badge_galley.size().x + 10.0;
        let mut x = rect.center().x - group / 2.0;
        if let Some(icon) = icon {
            icon.draw(
                ui.painter(),
                Rect::from_center_size(Pos2::new(x + 6.0, rect.center().y), Vec2::splat(13.0)),
                color,
                1.5,
            );
            x += 16.0;
        }
        ui.painter().galley(
            Pos2::new(x, rect.center().y - label_galley.size().y / 2.0),
            label_galley.clone(),
            color,
        );
        x += label_galley.size().x + 6.0;
        let badge_rect = Rect::from_min_size(
            Pos2::new(x, rect.center().y - 8.0),
            Vec2::new(badge_galley.size().x + 10.0, 16.0),
        );
        let badge_color = if is_active {
            theme.accent.base
        } else {
            theme.palette.text
        };
        ui.painter().rect(
            badge_rect,
            Rounding::same(8.0),
            with_alpha(badge_color, if is_active { 34 } else { 22 }),
            Stroke::NONE,
        );
        ui.painter().text(
            badge_rect.center(),
            Align2::CENTER_CENTER,
            badge,
            FontId::proportional(10.0),
            badge_color,
        );
        response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
        if response.clicked() {
            focus.set_focus(Some(id));
            picked = Some(tab);
        }
    }
    picked
}

/// Upload card of the file tab: a dashed drop zone that opens the storage location picker.
///
/// The card grows with its wrapped text, so the hint stays inside the dashed border on a phone
/// viewport as well.
fn folder_upload_card(ui: &mut Ui, theme: &Theme, texts: &UiTexts) -> bool {
    let inner = (ui.available_width() - 24.0).max(80.0);
    let title = ui.painter().layout(
        texts.get("folder_files_upload_title").to_owned(),
        FontId::new(12.0, crate::theme::semibold()),
        theme.palette.text,
        inner,
    );
    let hint = ui.painter().layout(
        texts.get("folder_files_upload_hint").to_owned(),
        FontId::proportional(11.0),
        theme.palette.text_muted,
        inner,
    );
    let height = (56.0 + title.size().y + 2.0 + hint.size().y).max(84.0);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), height), Sense::click());
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        Rounding::same(RADIUS_CARD),
        with_alpha(theme.accent.base, if hovered { 18 } else { 8 }),
        Stroke::new(
            1.5_f32,
            with_alpha(theme.accent.base, if hovered { 160 } else { 70 }),
        ),
    );
    Icon::Upload.draw(
        ui.painter(),
        Rect::from_center_size(
            Pos2::new(rect.center().x, rect.top() + 24.0),
            Vec2::splat(26.0),
        ),
        theme.accent.base,
        1.8,
    );
    let title_top = rect.top() + 42.0;
    ui.painter().galley(
        Pos2::new(rect.center().x - title.size().x / 2.0, title_top),
        title.clone(),
        theme.palette.text,
    );
    ui.painter().galley(
        Pos2::new(
            rect.center().x - hint.size().x / 2.0,
            title_top + title.size().y + 2.0,
        ),
        hint,
        theme.palette.text_muted,
    );
    response.widget_info(|| {
        WidgetInfo::labeled(WidgetType::Button, texts.get("folder_files_upload_title"))
    });
    response.clicked()
}

/// One small square action button of a file row.
struct AssetButton<'a> {
    rect: Rect,
    id: Id,
    icon: Icon,
    label: &'a str,
    danger: bool,
}

/// Small square action button of a file row.
fn asset_action_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    button: AssetButton<'_>,
) -> bool {
    let focused = focus.register(button.id);
    let response = ui.interact(button.rect, button.id, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(button.id));
    }
    let hovered = response.hovered() || focused;
    let highlight = if button.danger {
        theme.palette.danger
    } else {
        theme.accent.base
    };
    if hovered {
        ui.painter().rect(
            button.rect,
            Rounding::same(7.0),
            with_alpha(highlight, 24),
            Stroke::NONE,
        );
    }
    button.icon.draw(
        ui.painter(),
        button.rect.shrink(6.0),
        if hovered {
            highlight
        } else {
            theme.palette.text_muted
        },
        1.6,
    );
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, button.label));
    response.clicked()
}

/// One row of the folder file list with the details, download and delete controls.
fn asset_row(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    texts: &UiTexts,
    asset: &StorageAsset,
) -> AssetRowAction {
    let mut action = AssetRowAction::default();
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 44.0), Sense::hover());
    ui.painter().rect(
        rect,
        Rounding::same(RADIUS_CONTROL),
        with_alpha(theme.palette.surface_muted, 90),
        Stroke::new(1.0_f32, with_alpha(theme.palette.border, 160)),
    );
    let glyph = Rect::from_center_size(
        Pos2::new(rect.left() + 22.0, rect.center().y),
        Vec2::splat(28.0),
    );
    ui.painter().rect(
        glyph,
        Rounding::same(9.0),
        with_alpha(theme.accent.base, 22),
        Stroke::NONE,
    );
    asset
        .category()
        .icon()
        .draw(ui.painter(), glyph.shrink(7.0), theme.accent.base, 1.6);

    // A long name is shortened with an ellipsis, so it stays on one line next to the row
    // actions and above the meta line.
    let name_width = (rect.width() - 160.0).max(60.0);
    let font = FontId::new(12.0, crate::theme::semibold());
    let mut label = asset.name().to_owned();
    let mut galley = ui
        .painter()
        .layout_no_wrap(label.clone(), font.clone(), theme.palette.text);
    while galley.size().x > name_width && label.chars().count() > 4 {
        label.pop();
        galley = ui.painter().layout_no_wrap(
            format!("{}…", label.trim_end()),
            font.clone(),
            theme.palette.text,
        );
    }
    ui.painter().galley(
        Pos2::new(rect.left() + 42.0, rect.top() + 8.0),
        galley,
        theme.palette.text,
    );
    let meta = format!(
        "{} · {}",
        asset.size_label(),
        socdof_core::date::format_date(asset.created_at())
    );
    ui.painter().text(
        Pos2::new(rect.left() + 42.0, rect.bottom() - 11.0),
        Align2::LEFT_CENTER,
        meta,
        FontId::proportional(10.0),
        theme.palette.text_muted,
    );

    let button_top = rect.center().y;
    // Left to right: details, download, delete, like the reference row.
    let first_rect = Rect::from_center_size(
        Pos2::new(rect.right() - 70.0, button_top),
        Vec2::splat(24.0),
    );
    let middle_rect = Rect::from_center_size(
        Pos2::new(rect.right() - 44.0, button_top),
        Vec2::splat(24.0),
    );
    let last_rect = Rect::from_center_size(
        Pos2::new(rect.right() - 18.0, button_top),
        Vec2::splat(24.0),
    );
    action.details = asset_action_button(
        ui,
        theme,
        focus,
        AssetButton {
            rect: first_rect,
            id: Id::new(("socdof-asset-details", asset.id())),
            icon: Icon::Info,
            label: texts.get("folder_files_details"),
            danger: false,
        },
    );
    action.download = asset_action_button(
        ui,
        theme,
        focus,
        AssetButton {
            rect: middle_rect,
            id: Id::new(("socdof-asset-download", asset.id())),
            icon: Icon::Download,
            label: texts.get("folder_files_download"),
            danger: false,
        },
    );
    action.delete = asset_action_button(
        ui,
        theme,
        focus,
        AssetButton {
            rect: last_rect,
            id: Id::new(("socdof-asset-delete", asset.id())),
            icon: Icon::Trash,
            label: texts.get("folder_files_delete"),
            danger: true,
        },
    );

    action
}

/// Actions picked in the file details pane.
#[derive(Debug, Clone, Copy, Default)]
struct DetailsAction {
    close: bool,
    download: bool,
    delete: bool,
}

/// Details of one file, following `StorageAssetPreviewModal`.
///
/// The reference opens the details in a second modal; the native shell keeps the same content in a
/// pane of the folder modal so a phone viewport never stacks two dialogs. The fields, the folder
/// link selector and the download, delete and close actions are the reference ones.
fn storage_details(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    texts: &UiTexts,
    storage: &mut DesktopStorage,
    asset: &StorageAsset,
    folder_names: &[(String, usize)],
) -> (DetailsAction, Option<Option<String>>) {
    let mut action = DetailsAction::default();
    let mut link = None;
    let frame = egui::Frame::none()
        .fill(with_alpha(theme.palette.surface_muted, 120))
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .rounding(Rounding::same(RADIUS_CARD))
        .inner_margin(egui::Margin::same(10.0));
    frame.show(ui, |ui| {
        ui.horizontal(|ui| {
            let (glyph, _) = ui.allocate_exact_size(Vec2::splat(32.0), Sense::hover());
            ui.painter().rect(
                glyph,
                Rounding::same(10.0),
                with_alpha(asset.category().tint(), 30),
                Stroke::NONE,
            );
            asset.category().icon().draw(
                ui.painter(),
                glyph.shrink(8.0),
                asset.category().tint(),
                1.6,
            );
            ui.add_space(6.0);
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(asset.name())
                        .size(12.0)
                        .family(crate::theme::semibold())
                        .color(theme.palette.text),
                );
                ui.label(
                    RichText::new(format!(
                        "{} • {}",
                        asset.size_label(),
                        texts.get(asset.category().title_key()).to_uppercase()
                    ))
                    .size(10.0)
                    .color(theme.palette.text_muted),
                );
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if modal_icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Close,
                    texts.get("folder_files_details_close"),
                    false,
                ) {
                    action.close = true;
                }
                if modal_icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Trash,
                    texts.get("folder_files_delete"),
                    true,
                ) {
                    action.delete = true;
                }
                if modal_icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Download,
                    texts.get("folder_files_download"),
                    false,
                ) {
                    action.download = true;
                }
            });
        });
        ui.add_space(6.0);
        // Storage location and date sit side by side, like the two metadata cards of the
        // reference details modal.
        let width = ui.available_width();
        let column = ((width - 8.0) * 0.5).max(120.0);
        ui.horizontal_top(|ui| {
            for (title, value, mono) in [
                (
                    texts.get("folder_files_details_origin"),
                    if asset.location().is_empty() {
                        texts.get("folder_files_location_default").to_owned()
                    } else {
                        asset.location().to_owned()
                    },
                    true,
                ),
                (
                    texts.get("folder_files_details_added"),
                    socdof_core::date::format_date(asset.created_at()),
                    false,
                ),
            ] {
                ui.allocate_ui_with_layout(
                    Vec2::new(column, 0.0),
                    egui::Layout::top_down(egui::Align::Min),
                    |ui| {
                        ui.set_width(column);
                        ui.label(
                            RichText::new(title)
                                .size(10.0)
                                .family(crate::theme::semibold())
                                .color(theme.palette.text_muted),
                        );
                        let mut text = RichText::new(value).size(10.0);
                        if mono {
                            text = text.monospace();
                        }
                        ui.add(egui::Label::new(text.color(theme.palette.text)).wrap(true));
                    },
                );
            }
        });
        ui.add_space(6.0);
        let link_frame = egui::Frame::none()
            .fill(with_alpha(theme.accent.base, 16))
            .stroke(Stroke::new(1.0_f32, with_alpha(theme.accent.base, 70)))
            .rounding(Rounding::same(RADIUS_CONTROL))
            .inner_margin(egui::Margin::same(8.0));
        link_frame.show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                let (icon_rect, _) = ui.allocate_exact_size(Vec2::splat(14.0), Sense::hover());
                Icon::Folder.draw(ui.painter(), icon_rect, theme.accent.base, 1.5);
                ui.add_space(2.0);
                ui.label(
                    RichText::new(texts.get("folder_files_link_title"))
                        .size(11.0)
                        .family(crate::theme::semibold())
                        .color(theme.palette.text),
                );
            });
            ui.label(
                RichText::new(texts.get("folder_files_link_hint"))
                    .size(10.0)
                    .color(theme.palette.text_muted),
            );
            let mut option_labels: Vec<String> =
                vec![texts.get("folder_files_details_none").to_owned()];
            option_labels.extend(
                folder_names
                    .iter()
                    .map(|(name, apps)| format!("{name} ({apps} Apps)")),
            );
            let label_refs: Vec<&str> = option_labels.iter().map(String::as_str).collect();
            let stored = asset
                .folder_id()
                .and_then(|id| folder_names.iter().position(|(name, _)| name == id))
                .map(|position| position + 1)
                .unwrap_or(0);
            let mut selected = stored;
            let popup = storage.popup_mut();
            if crate::controls::select(
                ui,
                theme,
                focus,
                popup,
                "socdof-asset-folder",
                &mut selected,
                &label_refs,
            ) && selected != stored
            {
                link = Some(if selected == 0 {
                    None
                } else {
                    Some(folder_names[selected - 1].0.clone())
                });
            }
        });
    });
    (action, link)
}

#[cfg(test)]
mod tests {
    #[test]
    fn removing_a_desktop_refiles_its_windows() {
        let mut task_view = crate::shell::TaskView::new();
        task_view.add();
        task_view.select("desktop-2");
        let mut windows = WindowManager::new();
        windows.set_current_desktop("desktop-2");
        let rect = Rect::from_min_size(Pos2::ZERO, Vec2::new(800.0, 600.0));
        windows.open(Window::new(AppId::new("products"), "Produkte", rect), 1_000);
        windows.open(Window::new(AppId::new("calendar"), "Kalender", rect), 1_000);
        assert_eq!(windows.windows_on("desktop-2").len(), 2);

        assert!(delete_virtual_desktop(
            &mut task_view,
            &mut windows,
            "desktop-2"
        ));
        assert_eq!(task_view.desktops().len(), 2);
        assert_eq!(task_view.active_id(), "desktop-1");
        assert!(windows
            .windows_on("desktop-1")
            .contains(&AppId::new("products")));
        assert!(windows
            .windows_on("desktop-1")
            .contains(&AppId::new("calendar")));
        assert_eq!(windows.active(), Some(AppId::new("calendar")));
        // The last desktop stays, so two removals leave the strip with one card.
        assert!(delete_virtual_desktop(
            &mut task_view,
            &mut windows,
            "desktop-1"
        ));
        assert_eq!(task_view.desktops().len(), 1);
        assert!(!delete_virtual_desktop(
            &mut task_view,
            &mut windows,
            "desktop-3"
        ));
    }

    #[test]
    fn windows_stay_on_their_virtual_desktop() {
        let mut windows = WindowManager::new();
        windows.set_current_desktop("desktop-1");
        let rect = Rect::from_min_size(Pos2::ZERO, Vec2::new(800.0, 600.0));
        windows.open(Window::new(AppId::new("contacts"), "Kontakte", rect), 1_000);
        windows.set_current_desktop("desktop-2");
        windows.open(
            Window::new(AppId::new("invoices"), "Rechnungen", rect),
            1_000,
        );
        assert_eq!(
            windows.windows_on("desktop-1"),
            vec![AppId::new("contacts")]
        );
        assert_eq!(
            windows.windows_on("desktop-2"),
            vec![AppId::new("invoices")]
        );

        // Switching desktops focuses the top window of that desktop, or nothing.
        assert_eq!(windows.focus_on("desktop-1"), Some(AppId::new("contacts")));
        assert_eq!(windows.active(), Some(AppId::new("contacts")));
        assert_eq!(windows.focus_on("desktop-3"), None);
        assert_eq!(windows.active(), None);

        // `all` and a missing filing show a window on every desktop.
        assert!(windows.move_to_desktop(AppId::new("contacts"), Some("all".to_string())));
        assert_eq!(
            windows.windows_on("desktop-3"),
            vec![AppId::new("contacts")]
        );
        assert!(windows.move_to_desktop(AppId::new("invoices"), None));
        assert!(windows
            .windows_on("desktop-3")
            .contains(&AppId::new("invoices")));
    }

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
    #[test]
    fn folders_group_apps_and_dissolve_returns_them_to_the_desktop() {
        let mut folders = FolderSet::new();
        let work = folders.create("Arbeit", vec![AppId::new("contacts")], (1, 0));
        assert_eq!(folders.len(), 1);
        assert!(folders.contains(AppId::new("contacts")));
        assert!(folders.add_app(&work, AppId::new("invoices")));
        assert_eq!(folders.get(&work).expect("folder").apps().len(), 2);

        // Adding an app to another folder moves it out of the first one.
        let private = folders.create("Privat", Vec::new(), (2, 0));
        assert!(folders.add_app(&private, AppId::new("invoices")));
        assert_eq!(folders.get(&work).expect("folder").apps().len(), 1);

        // Removing the last app dissolves the folder, like the reference.
        assert!(folders.remove_app(&private, AppId::new("invoices")));
        assert!(folders.get(&private).is_none());

        assert!(folders.dissolve(&work));
        assert!(!folders.contains(AppId::new("contacts")));
        assert!(folders.is_empty());
    }

    #[test]
    fn folder_names_are_trimmed_and_bounded() {
        let mut folders = FolderSet::new();
        let id = folders.create("   ", Vec::new(), (0, 0));
        assert_eq!(folders.get(&id).expect("folder").name(), "Ordner");
        assert!(!folders.rename(&id, "   "));
        assert!(folders.rename(&id, "  Steuer  "));
        assert_eq!(folders.get(&id).expect("folder").name(), "Steuer");
        let long = "x".repeat(120);
        assert!(folders.rename(&id, &long));
        assert_eq!(
            folders.get(&id).expect("folder").name().chars().count(),
            FOLDER_NAME_MAX
        );
    }

    #[test]
    fn folder_rename_flow_commits_and_cancels() {
        let mut folders = FolderSet::new();
        let id = folders.create("Ordner", Vec::new(), (0, 0));
        folders.begin_rename(&id);
        assert_eq!(folders.rename_target(), Some(id.as_str()));
        folders.rename_buffer_mut().push_str(" neu");
        assert!(folders.commit_rename());
        assert_eq!(folders.get(&id).expect("folder").name(), "Ordner neu");
        assert!(folders.rename_target().is_none());

        folders.begin_rename(&id);
        folders.rename_buffer_mut().push_str(" verworfen");
        folders.cancel_rename();
        assert_eq!(folders.get(&id).expect("folder").name(), "Ordner neu");
    }

    #[test]
    fn persisted_folders_skip_unknown_apps_and_keep_their_cell() {
        let folder = DesktopFolder::from_persisted(
            "folder-1",
            "Alt",
            &["contacts".to_string(), "gone".to_string()],
            (1, 5),
        );
        assert_eq!(folder.apps(), &[AppId::new("contacts")]);
        assert_eq!(folder.cell(), (1, 5));
        assert!(known_app("gone").is_none());
        assert_eq!(known_app("contacts"), Some(AppId::new("contacts")));
    }

    #[test]
    fn folder_slots_follow_the_grid_reading_order() {
        assert_eq!(FolderSet::slot_cell(0), (0, 0));
        assert_eq!(FolderSet::slot_cell(1), (0, 1));
        assert_eq!(FolderSet::slot_cell(ICON_ROWS), (1, 0));
    }

    #[test]
    fn a_new_folder_skips_the_cells_of_the_folders_still_on_the_desktop() {
        let mut folders = FolderSet::new();
        folders.create("Erste", Vec::new(), (0, 1));
        folders.create("Zweite", Vec::new(), (0, 2));
        assert_eq!(folders.free_cell(1), (0, 3));
        folders.dissolve("folder-1");
        // The free cell of the dissolved folder is reused once nothing occupies it.
        assert_eq!(folders.free_cell(1), (0, 1));
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
        let step = compact_step_y(desktop);
        let first = IconGrid::cell_rect(desktop, (0, 0));
        assert_eq!((first.left(), first.top()), (40.0, COMPACT_ORIGIN_Y));
        assert_eq!(first.center().x, 88.0, "tile centre of the first column");
        assert_eq!(IconGrid::cell_rect(desktop, (0, 1)).left(), 176.0);
        assert_eq!(IconGrid::cell_rect(desktop, (0, 2)).left(), 312.0);
        let second_row = IconGrid::cell_rect(desktop, (0, 3));
        assert_eq!(second_row.left(), 40.0);
        assert_eq!(second_row.top(), COMPACT_ORIGIN_Y + step);
        let grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("a"), "a", Icon::User),
            DesktopIcon::new(AppId::new("b"), "b", Icon::User),
            DesktopIcon::new(AppId::new("c"), "c", Icon::User),
            DesktopIcon::new(AppId::new("d"), "d", Icon::User),
        ]);
        assert_eq!(grid.cell_at(desktop, first.center()), (0, 0));
        assert_eq!(
            grid.cell_at(desktop, IconGrid::cell_rect(desktop, (0, 1)).center()),
            (0, 1)
        );
        assert_eq!(grid.cell_at(desktop, second_row.center()), (0, 3));
        assert_eq!(IconGrid::columns(desktop), COMPACT_COLUMNS);
    }

    #[test]
    fn the_compact_grid_stays_clear_of_the_control_bar_and_the_session_chip() {
        // The browser viewport at 432 x 768 leaves a 720 point work area above the taskbar.
        let desktop = Rect::from_min_size(Pos2::ZERO, Vec2::new(432.0, 720.0));
        let first = IconGrid::cell_rect(desktop, (0, 0));
        assert!(
            first.top() >= DESKTOP_CONTROL_HEIGHT,
            "the first row starts below the desktop control bar"
        );
        let last = IconGrid::cell_rect(desktop, (2, ICON_ROWS - 1));
        // Tile offset, tile, gap and a two line caption are the lowest painted content of a cell.
        let content_bottom = last.top() + 8.0 + ICON_TILE + 8.0 + 30.0;
        assert!(
            content_bottom <= desktop.bottom() - SESSION_CHIP_BAND,
            "the last row ends above the session chip band ({content_bottom})"
        );
        assert!(
            compact_step_y(desktop) >= COMPACT_MIN_STEP_Y,
            "the compressed pitch still holds a tile and its label"
        );
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

    #[test]
    fn asset_categories_follow_the_file_extension() {
        assert_eq!(AssetCategory::from_name("Beleg.PDF"), AssetCategory::Pdf);
        assert_eq!(AssetCategory::from_name("foto.jpeg"), AssetCategory::Image);
        assert_eq!(
            AssetCategory::from_name("tabelle.xlsx"),
            AssetCategory::Spreadsheet
        );
        assert_eq!(
            AssetCategory::from_name("notiz.md"),
            AssetCategory::Document
        );
        assert_eq!(
            AssetCategory::from_name("archiv.zip"),
            AssetCategory::Archive
        );
        assert_eq!(AssetCategory::from_name("ton.mp3"), AssetCategory::Audio);
        assert_eq!(AssetCategory::from_name("clip.mp4"), AssetCategory::Video);
        assert_eq!(AssetCategory::from_name("main.ts"), AssetCategory::Code);
        assert_eq!(AssetCategory::from_name("main.rs"), AssetCategory::Other);
        assert_eq!(
            AssetCategory::from_name("ohne-endung"),
            AssetCategory::Other
        );
    }

    #[test]
    fn asset_category_slugs_round_trip() {
        for category in [
            AssetCategory::Document,
            AssetCategory::Image,
            AssetCategory::Spreadsheet,
            AssetCategory::Pdf,
            AssetCategory::Archive,
            AssetCategory::Audio,
            AssetCategory::Video,
            AssetCategory::Code,
            AssetCategory::Other,
        ] {
            assert_eq!(AssetCategory::from_slug(category.slug()), category);
        }
        assert_eq!(AssetCategory::from_slug("unknown"), AssetCategory::Other);
    }

    #[test]
    fn file_sizes_use_the_reference_units() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(2048), "2.0 KB");
        assert_eq!(format_size(5 * 1024 * 1024), "5.0 MB");
        assert_eq!(format_size(3 * 1024 * 1024 * 1024), "3.0 GB");
    }

    #[test]
    fn storage_keeps_files_per_folder() {
        let mut storage = DesktopStorage::new();
        assert_eq!(storage.location(), "");
        storage.set_location("/home/belege");
        assert_eq!(storage.location(), "/home/belege");
        storage.add(StorageAsset::new(
            "a",
            "Beleg.pdf",
            2048,
            "/home/belege",
            Some("f1".to_owned()),
            1_700_000_000_000,
        ));
        storage.add(StorageAsset::new(
            "b",
            "Foto.png",
            4096,
            "/home/belege",
            None,
            1_700_000_000_001,
        ));
        assert_eq!(storage.assets().len(), 2);
        assert_eq!(storage.count_in("f1"), 1);
        assert_eq!(storage.assets_in(Some("f1")).len(), 1);
        assert_eq!(storage.assets_in(None).len(), 1);
        let filed = storage
            .assets()
            .iter()
            .find(|asset| asset.id() == "a")
            .expect("filed asset");
        assert_eq!(filed.size_label(), "2.0 KB");
        assert!(storage.link("b", Some("f1")));
        assert_eq!(storage.count_in("f1"), 2);
        assert!(!storage.link("missing", Some("f1")));
        storage.select("a");
        assert_eq!(
            storage.selected().map(StorageAsset::name),
            Some("Beleg.pdf")
        );
        storage.clear_selection();
        assert!(storage.selected().is_none());
        assert!(storage.remove("a"));
        assert!(!storage.remove("a"));
        assert_eq!(storage.assets().len(), 1);
    }

    #[test]
    fn storage_restore_reads_persisted_files() {
        let mut storage = DesktopStorage::new();
        storage.add(StorageAsset::new("old", "alt.pdf", 10, "/tmp", None, 1));
        storage.select("old");
        storage.restore(
            vec![
                StorageAsset::from_persisted(
                    "a",
                    "Beleg.pdf",
                    2048,
                    "pdf",
                    "/home/belege",
                    Some("f1".to_owned()),
                    1_700,
                ),
                StorageAsset::from_persisted(
                    "b",
                    "Foto.png",
                    4096,
                    "image",
                    "/home/fotos",
                    None,
                    1_701,
                ),
            ],
            "/home/belege",
        );
        assert_eq!(storage.assets().len(), 2);
        assert_eq!(storage.location(), "/home/belege");
        assert!(storage.selected().is_none());
        assert_eq!(storage.assets()[0].category(), AssetCategory::Pdf);
        assert_eq!(storage.assets()[1].category(), AssetCategory::Image);
        assert_eq!(storage.assets()[1].folder_id(), None);
    }

    #[test]
    fn arranging_icons_refills_the_left_columns() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("pos"), "Kasse", Icon::User),
            DesktopIcon::new(AppId::new("editor"), "Editor", Icon::User),
        ]);
        assert!(grid.place_at(AppId::new("editor"), Pos2::new(600.0, 300.0)));
        assert_eq!(grid.arrange(), 2);
        assert_eq!(grid.icons()[0].cell(), (0, 0));
        assert_eq!(grid.icons()[1].cell(), (0, 1));
        assert!(grid.icons().iter().all(|icon| icon.pos().is_none()));
    }

    #[test]
    fn snapping_moves_free_icons_into_their_cell() {
        let area = Rect::from_min_size(Pos2::ZERO, Vec2::new(900.0, 760.0));
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("pos"), "Kasse", Icon::User),
            DesktopIcon::new(AppId::new("editor"), "Editor", Icon::User),
        ]);
        let cell = IconGrid::cell_rect(area, (0, 2));
        assert!(grid.place_at(AppId::new("editor"), cell.min + Vec2::new(3.0, 4.0)));
        assert!(grid.snap_to_grid(area));
        assert_eq!(grid.icons()[1].cell(), (0, 2));
        assert!(grid.icons()[1].pos().is_none());
        assert!(!grid.snap_to_grid(area));
    }
}
