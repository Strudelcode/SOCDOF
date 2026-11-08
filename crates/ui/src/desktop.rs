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
    Align2, Color32, Context, FontId, Id, Key, Pos2, Rect, Rounding, Sense, Stroke, Vec2,
    WidgetInfo, WidgetType,
};
use socdof_core::store::Store as SocdofStore;

use crate::components::{button, icon_button, modal, ButtonVariant};
use crate::focus::{focus_ring, FocusState};
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::shell::{command_palette, onboarding, start_menu, tray_flyout, ShellAction, ShellState};
use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_SMALL, RADIUS_CARD, RADIUS_CONTROL};
use crate::wallpaper::paint as paint_wallpaper;
use crate::widgets::widgets;

/// Height of the taskbar at the bottom of the screen.
pub const TASKBAR_HEIGHT: f32 = 48.0;
/// Height of a window title bar.
pub const TITLE_BAR_HEIGHT: f32 = 36.0;
/// Smallest width a window can be resized to.
pub const WINDOW_MIN_WIDTH: f32 = 320.0;
/// Smallest height a window can be resized to.
pub const WINDOW_MIN_HEIGHT: f32 = 220.0;
/// Edge length of the resize grip in the bottom right corner of a window.
pub const RESIZE_GRIP: f32 = 16.0;
/// How long reopening an app after closing it needs a confirmation.
pub const CLOSE_COOLDOWN_MS: i64 = 3_000;
/// Size of one icon cell, including the gap to the next cell.
pub const ICON_CELL: Vec2 = Vec2::new(108.0, 92.0);
/// Number of columns of the icon grid.
pub const ICON_COLUMNS: u32 = 6;
/// Distance between the desktop edge and the first icon cell.
pub const DESKTOP_MARGIN: f32 = 16.0;

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
}

impl DesktopIcon {
    /// Creates an icon; [`IconGrid::new`] assigns its cell in reading order.
    pub fn new(app: AppId, label: impl Into<String>, icon: Icon) -> Self {
        Self {
            app,
            label: label.into(),
            icon,
            cell: (0, 0),
        }
    }

    /// Places the icon on a specific grid cell.
    pub fn at(mut self, cell: (u32, u32)) -> Self {
        self.cell = cell;
        self
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

impl IconGrid {
    /// Builds a grid and assigns every icon a free cell in reading order.
    pub fn new(icons: Vec<DesktopIcon>) -> Self {
        let mut grid = Self { icons, selected: 0 };
        let mut taken = std::collections::BTreeSet::new();
        for icon in &mut grid.icons {
            let mut cell = (icon.cell.0.min(ICON_COLUMNS - 1), icon.cell.1);
            while taken.contains(&cell) {
                cell = Self::next_cell(cell);
            }
            taken.insert(cell);
            icon.cell = cell;
        }
        grid
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
            (_, 0) => (current + dx).rem_euclid(count),
            (0, _) => (current + dy * ICON_COLUMNS as i32).rem_euclid(count),
            _ => current,
        };
        self.selected = next as usize;
    }

    /// Cell that follows the given one in reading order, wrapping after the last column.
    pub fn next_cell(cell: (u32, u32)) -> (u32, u32) {
        if cell.0 + 1 >= ICON_COLUMNS {
            (0, cell.1 + 1)
        } else {
            (cell.0 + 1, cell.1)
        }
    }

    /// Rectangle of a grid cell inside a desktop rectangle.
    pub fn cell_rect(desktop: Rect, cell: (u32, u32)) -> Rect {
        let min = Pos2::new(
            desktop.min.x + DESKTOP_MARGIN + cell.0 as f32 * ICON_CELL.x,
            desktop.min.y + DESKTOP_MARGIN + cell.1 as f32 * ICON_CELL.y,
        );
        Rect::from_min_size(
            min,
            Vec2::new(ICON_CELL.x - DESKTOP_MARGIN, ICON_CELL.y - DESKTOP_MARGIN),
        )
    }

    /// Cell under a screen point, clamped to the grid columns.
    pub fn cell_at(&self, desktop: Rect, point: Pos2) -> (u32, u32) {
        let column = ((point.x - desktop.min.x - DESKTOP_MARGIN) / ICON_CELL.x).round();
        let row = ((point.y - desktop.min.y - DESKTOP_MARGIN) / ICON_CELL.y).round();
        (
            (column.max(0.0) as u32).min(ICON_COLUMNS - 1),
            row.max(0.0) as u32,
        )
    }

    /// Moves an icon to a cell; a taken cell moves it to the next free one.
    pub fn move_to(&mut self, app: AppId, cell: (u32, u32)) -> Option<(u32, u32)> {
        let index = self.index_of(app)?;
        let mut target = (cell.0.min(ICON_COLUMNS - 1), cell.1);
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
            if let Some(index) = self.index_of(*app) {
                self.icons[index].cell = *cell;
            }
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
}

/// What the desktop asks the host to do after a frame.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
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

/// Draws the desktop shell and reports what the host should do next.
///
/// The caller owns the grid, the window manager and the shell, so window positions, open windows,
/// icon positions, wallpaper and widget state survive a language or theme switch.
pub fn desktop(
    ctx: &Context,
    frame: DesktopFrame<'_>,
    focus: &mut FocusState,
    icons: &mut IconGrid,
    windows: &mut WindowManager,
    now: i64,
) -> DesktopOutcome {
    let DesktopFrame {
        theme,
        texts,
        shell,
        store,
    } = frame;
    let screen = ctx.screen_rect();
    let area = work_area(screen);
    let mut outcome = DesktopOutcome::default();

    crate::studio::studio_drawer(ctx, theme, texts, focus, &mut shell.studio, store);

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(theme.palette.background))
        .show(ctx, |ui| {
            ui.set_min_size(area.size());
            paint_wallpaper(ctx, ui, area, &shell.wallpaper);
            let blocked = windows.dialog_open() || shell.overlay_open() || shell.studio.is_open();

            if !blocked {
                let (left, right, up, down) = ui.input(|input| {
                    (
                        input.key_pressed(Key::ArrowLeft),
                        input.key_pressed(Key::ArrowRight),
                        input.key_pressed(Key::ArrowUp),
                        input.key_pressed(Key::ArrowDown),
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
                let rect = IconGrid::cell_rect(area, icon.cell());
                let id = Id::new(("socdof-desktop-icon", icon.app().as_str()));
                let focused = focus.register(id);
                let response = ui.interact(rect, id, Sense::click_and_drag());
                if !blocked && response.clicked() {
                    icons.select(index);
                    focus.set_focus(Some(id));
                }
                if !blocked && response.drag_stopped() {
                    if let Some(pos) = response.interact_pointer_pos() {
                        let cell = icons.cell_at(area, pos);
                        icons.move_to(icon.app(), cell);
                    }
                }
                let selected = icons.selected() == index;
                let tile = Rect::from_center_size(
                    Pos2::new(rect.center().x, rect.top() + 34.0),
                    Vec2::splat(56.0),
                );
                let painter = ui.painter().clone();
                let app = crate::chrome::app_chrome(icon.app().as_str());
                let tint = crate::chrome::tint(app);
                painter.rect(
                    tile,
                    Rounding::same(RADIUS_CARD),
                    tint,
                    Stroke::new(
                        1.0_f32,
                        if selected || focused {
                            theme.accent.base
                        } else {
                            crate::tokens::adjust(tint, 22)
                        },
                    ),
                );
                icon.icon().draw(
                    &painter,
                    Rect::from_center_size(tile.center(), Vec2::splat(26.0)),
                    Color32::WHITE,
                    1.6,
                );
                let galley = painter.layout(
                    icon.label().to_owned(),
                    FontId::proportional(FONT_SMALL),
                    theme.palette.text,
                    rect.width(),
                );
                painter.galley(
                    Pos2::new(rect.center().x - galley.size().x / 2.0, tile.bottom() + 6.0),
                    galley,
                    theme.palette.text,
                );
                if focused {
                    focus_ring(ui, theme, tile);
                }
                if !blocked && focus.activate(id) {
                    if windows.is_open(icon.app()) {
                        windows.focus(icon.app());
                    } else {
                        activate_app(icons, windows, icon.app(), area, now);
                    }
                    outcome.open_app = Some(icon.app());
                }
            }

            widgets(ui, theme, texts, now, &shell.widgets);
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

        egui::Area::new(Id::new(("socdof-window", app.as_str())))
            .order(egui::Order::Middle)
            .fixed_pos(rect.min)
            .show(ctx, |ui| {
                let (frame, _) = ui.allocate_exact_size(rect.size(), Sense::hover());
                let bar =
                    Rect::from_min_size(frame.min, Vec2::new(frame.width(), TITLE_BAR_HEIGHT));
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
                painter.rect(
                    frame,
                    Rounding::same(RADIUS_CONTROL),
                    theme.palette.surface,
                    Stroke::new(1.0_f32, theme.palette.border),
                );
                painter.rect(
                    bar,
                    Rounding::same(RADIUS_CONTROL),
                    if is_active {
                        theme.accent.light
                    } else {
                        theme.palette.surface_muted
                    },
                    Stroke::NONE,
                );
                let title_galley = painter.layout_no_wrap(
                    title.clone(),
                    FontId::proportional(FONT_BODY),
                    theme.palette.text,
                );
                painter.galley(
                    Pos2::new(
                        bar.left() + 12.0,
                        bar.center().y - title_galley.size().y / 2.0,
                    ),
                    title_galley,
                    theme.palette.text,
                );
                let hint = painter.layout_no_wrap(
                    texts.get("desktop_hint").to_owned(),
                    FontId::proportional(FONT_SMALL),
                    theme.palette.text_muted,
                );
                painter.galley(
                    Pos2::new(frame.left() + 16.0, frame.top() + TITLE_BAR_HEIGHT + 16.0),
                    hint,
                    theme.palette.text_muted,
                );

                let mut right = bar.right() - 8.0;
                let close_rect = Rect::from_center_size(
                    Pos2::new(right - 14.0, bar.center().y),
                    Vec2::splat(28.0),
                );
                right -= 32.0;
                let max_rect = Rect::from_center_size(
                    Pos2::new(right - 14.0, bar.center().y),
                    Vec2::splat(28.0),
                );
                right -= 32.0;
                let min_rect = Rect::from_center_size(
                    Pos2::new(right - 14.0, bar.center().y),
                    Vec2::splat(28.0),
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

        if close {
            windows.request_close(app);
        }
        if minimize {
            windows.minimize(app);
        }
        if toggle {
            windows.toggle_maximize(app, area);
        }
        if raise {
            windows.focus(app);
        }
        if drag != Vec2::ZERO {
            windows.move_by(app, drag, area);
        }
        if resize != Vec2::ZERO {
            windows.resize_by(app, resize, area);
        }
    }

    if shell.onboarding.is_open() {
        onboarding(ctx, theme, texts, focus, &mut shell.onboarding);
    } else if shell.palette.is_open() {
        if let Some(action) = command_palette(ctx, theme, texts, focus, &mut shell.palette) {
            apply_action(action, shell, icons, windows, area, now, &mut outcome);
        }
    } else if shell.start.is_open() {
        if let Some(app) = start_menu(ctx, theme, texts, focus, &mut shell.start, icons) {
            activate_app(icons, windows, app, area, now);
            outcome.open_app = Some(app);
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

    let apps: Vec<(AppId, String, Icon)> = icons
        .icons()
        .iter()
        .map(|icon| (icon.app(), icon.label().to_owned(), icon.icon()))
        .collect();
    let mut launched: Option<AppId> = None;
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
                theme.palette.surface,
                Stroke::new(1.0_f32, theme.palette.border),
            );
            painter.text(
                Pos2::new(bar.right() - 16.0, bar.center().y),
                Align2::RIGHT_CENTER,
                format_clock(now),
                FontId::proportional(FONT_SMALL),
                theme.palette.text_muted,
            );

            let start_rect = Rect::from_min_size(
                Pos2::new(bar.left() + 12.0, bar.top() + 6.0),
                Vec2::new(44.0, TASKBAR_HEIGHT - 12.0),
            );
            if taskbar_button(
                ui,
                theme,
                focus,
                TaskbarButton {
                    id: Id::new("socdof-taskbar-start"),
                    rect: start_rect,
                    icon: Icon::Grid,
                    label: texts.get("start_title"),
                    active: shell.start.is_open(),
                },
            ) {
                shell.toggle_start();
            }

            let mut x = start_rect.right() + 8.0;
            for (app, label, icon) in &apps {
                let rect = Rect::from_min_size(
                    Pos2::new(x, bar.top() + 6.0),
                    Vec2::new(56.0, TASKBAR_HEIGHT - 12.0),
                );
                x += 60.0;
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
                icon.draw(
                    &painter,
                    Rect::from_center_size(
                        Pos2::new(rect.center().x, rect.center().y - 2.0),
                        Vec2::splat(20.0),
                    ),
                    if active {
                        theme.accent_text()
                    } else {
                        theme.palette.text
                    },
                    1.5,
                );
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

            let studio_rect = Rect::from_min_size(
                Pos2::new(bar.right() - 148.0, bar.top() + 6.0),
                Vec2::new(44.0, TASKBAR_HEIGHT - 12.0),
            );
            if taskbar_button(
                ui,
                theme,
                focus,
                TaskbarButton {
                    id: Id::new("socdof-taskbar-studio"),
                    rect: studio_rect,
                    icon: Icon::Settings,
                    label: texts.get("studio_title"),
                    active: shell.studio.is_open(),
                },
            ) {
                shell.studio.toggle(store);
            }

            let tray_rect = Rect::from_min_size(
                Pos2::new(bar.right() - 96.0, bar.top() + 6.0),
                Vec2::new(44.0, TASKBAR_HEIGHT - 12.0),
            );
            if taskbar_button(
                ui,
                theme,
                focus,
                TaskbarButton {
                    id: Id::new("socdof-taskbar-tray"),
                    rect: tray_rect,
                    icon: Icon::Bell,
                    label: texts.get("tray_title"),
                    active: shell.tray.is_open(),
                },
            ) {
                shell.toggle_tray();
            }
        });
    if let Some(app) = launched {
        outcome.open_app = Some(app);
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
            windows.confirm_close(now);
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

    if outcome.open_studio {
        outcome.open_studio = false;
        shell.studio.open(store);
    }
    if let Some(tab) = outcome.studio_tab.take() {
        shell.studio.set_tab(tab);
    }

    egui::Area::new(Id::new("socdof-desktop-back"))
        .order(egui::Order::Foreground)
        .anchor(Align2::RIGHT_TOP, Vec2::new(-12.0, 12.0))
        .show(ctx, |ui| {
            if icon_button(ui, theme, focus, Icon::Close, texts.get("desktop_back")).activated {
                outcome.back = true;
            }
        });

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

/// Geometry and label of one taskbar button.
struct TaskbarButton<'a> {
    id: Id,
    rect: Rect,
    icon: Icon,
    label: &'a str,
    active: bool,
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
        assert_eq!(grid.icons()[1].cell(), (1, 0));
        assert_eq!(grid.icons()[2].cell(), (2, 0));
    }

    #[test]
    fn dropping_an_icon_never_stacks_it_on_another() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
        ]);
        let target = grid.move_to(AppId::new("products"), (0, 0));
        assert_eq!(target, Some((1, 0)));
        assert_ne!(grid.icons()[0].cell(), grid.icons()[1].cell());

        grid.restore_positions(&[(AppId::new("contacts"), (3, 2))]);
        assert_eq!(grid.icons()[0].cell(), (3, 2));
        assert_eq!(
            grid.positions(),
            vec![
                (AppId::new("contacts"), (3, 2)),
                (AppId::new("products"), (1, 0))
            ]
        );
    }

    #[test]
    fn arrow_navigation_wraps_around_the_grid() {
        let mut grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("a"), "a", Icon::User),
            DesktopIcon::new(AppId::new("b"), "b", Icon::User),
            DesktopIcon::new(AppId::new("c"), "c", Icon::User),
        ]);
        grid.step(-1, 0);
        assert_eq!(grid.selected(), 2);
        grid.step(0, 1);
        assert_eq!(grid.selected(), 2);
        grid.step(1, 0);
        assert_eq!(grid.selected(), 0);
        grid.select(99);
        assert_eq!(grid.selected(), 2);
    }

    #[test]
    fn cell_hit_testing_maps_a_pointer_to_the_nearest_cell() {
        let grid = IconGrid::new(vec![
            DesktopIcon::new(AppId::new("contacts"), "Kontakte", Icon::User),
            DesktopIcon::new(AppId::new("products"), "Produkte", Icon::Folder),
        ]);
        assert_eq!(grid.cell_at(area(), Pos2::new(40.0, 40.0)), (0, 0));
        assert_eq!(grid.cell_at(area(), Pos2::new(150.0, 40.0)), (1, 0));
        assert_eq!(
            grid.cell_at(area(), Pos2::new(5_000.0, 5_000.0)).0,
            ICON_COLUMNS - 1
        );
    }

    #[test]
    fn the_clock_is_a_stable_utc_label() {
        assert_eq!(format_clock(0), "00:00");
        assert_eq!(format_clock(1_000_000_000), "13:46");
        assert_eq!(format_clock(86_399_000), "23:59");
    }

    #[test]
    fn the_desktop_draws_without_a_display() {
        let ctx = Context::default();
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
        let output = ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            theme.apply(ctx);
            let outcome = desktop(
                ctx,
                DesktopFrame {
                    theme: &theme,
                    texts: &texts,
                    shell: &mut shell,
                    store: &store,
                },
                &mut focus,
                &mut icons,
                &mut windows,
                1_000,
            );
            assert!(!outcome.back);
            focus.finish_frame();
        });
        assert!(output.shapes.len() > 40, "desktop drew little");
    }
}
