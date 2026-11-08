//! Shell overlays: start menu, command palette, tray flyout and onboarding.
//!
//! Each overlay is a small, testable state machine. The models decide open/close, filtering,
//! selection and the seen flag of the onboarding; the render functions only paint the models from
//! the design tokens and translate key presses into model calls. Overlays trap the keyboard focus
//! through [`FocusState`], close on Escape and (except the onboarding, which is a modal) on a click
//! outside their panel.

use egui::{
    Align2, Context, FontId, Id, Key, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2, WidgetInfo,
    WidgetType,
};

use crate::components::{button, search_field, ButtonVariant};
use crate::desktop::{AppId, IconGrid, TASKBAR_HEIGHT};
use crate::focus::{focus_ring, FocusState};
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_HEADING, FONT_SMALL, RADIUS_CARD};
use crate::wallpaper::{Wallpaper, WallpaperState};
use crate::widgets::WidgetLayer;

/// Number of onboarding pages.
pub const ONBOARDING_STEPS: usize = 4;

/// Catalogue keys of the onboarding pages.
const ONBOARDING_STEP_KEYS: [&str; ONBOARDING_STEPS] = [
    "onboarding_step_1",
    "onboarding_step_2",
    "onboarding_step_3",
    "onboarding_step_4",
];

/// Action a shell command performs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellAction {
    /// Opens an app window.
    OpenApp(AppId),
    /// Switches between light and dark appearance.
    ToggleTheme,
    /// Selects the next bundled wallpaper.
    NextWallpaper,
    /// Shows the onboarding again.
    ShowOnboarding,
    /// Leaves the desktop and returns to the gallery.
    CloseDesktop,
}

/// One entry of the command palette.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Command {
    /// Action executed when the command is chosen.
    pub action: ShellAction,
    /// Catalogue key of the visible label.
    pub label_key: &'static str,
}

/// Commands offered by the palette, in display order.
pub const COMMANDS: [Command; 7] = [
    Command {
        action: ShellAction::OpenApp(AppId::new("contacts")),
        label_key: "app_contacts",
    },
    Command {
        action: ShellAction::OpenApp(AppId::new("products")),
        label_key: "app_products",
    },
    Command {
        action: ShellAction::OpenApp(AppId::new("invoices")),
        label_key: "app_invoices",
    },
    Command {
        action: ShellAction::ToggleTheme,
        label_key: "command_theme",
    },
    Command {
        action: ShellAction::NextWallpaper,
        label_key: "command_wallpaper",
    },
    Command {
        action: ShellAction::ShowOnboarding,
        label_key: "command_onboarding",
    },
    Command {
        action: ShellAction::CloseDesktop,
        label_key: "command_close",
    },
];

/// State of the start menu.
#[derive(Debug, Clone, Default)]
pub struct StartMenu {
    open: bool,
    query: String,
    selected: usize,
}

impl StartMenu {
    /// Builds a closed start menu.
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether the menu is visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Opens the menu with an empty query and the first entry selected.
    pub fn open(&mut self) {
        self.open = true;
        self.query.clear();
        self.selected = 0;
    }

    /// Closes the menu.
    pub fn close(&mut self) {
        self.open = false;
    }

    /// Toggles the menu.
    pub fn toggle(&mut self) {
        if self.open {
            self.close();
        } else {
            self.open();
        }
    }

    /// Search text typed by the user.
    pub fn query(&self) -> &str {
        &self.query
    }

    /// Replaces the search text and resets the selection.
    pub fn set_query(&mut self, query: impl Into<String>) {
        self.query = query.into();
        self.selected = 0;
    }

    /// Index of the selected result.
    pub fn selected(&self) -> usize {
        self.selected
    }

    /// Selects a result by index, clamped to the current list.
    pub fn select(&mut self, index: usize) {
        self.selected = index;
    }

    /// Icon indices that match the query, in reading order.
    pub fn results(&self, icons: &IconGrid) -> Vec<usize> {
        let needle = self.query.trim().to_lowercase();
        icons
            .icons()
            .iter()
            .enumerate()
            .filter(|(_, icon)| {
                needle.is_empty()
                    || icon.label().to_lowercase().contains(&needle)
                    || icon.app().as_str().contains(&needle)
            })
            .map(|(index, _)| index)
            .collect()
    }

    /// Moves the selection through the results with wrap-around.
    pub fn move_selection(&mut self, delta: i32, total: usize) {
        if total == 0 {
            self.selected = 0;
            return;
        }
        let current = self.selected.min(total - 1) as i32;
        self.selected = (current + delta).rem_euclid(total as i32) as usize;
    }
}

/// State of the command palette.
#[derive(Debug, Clone, Default)]
pub struct CommandPalette {
    open: bool,
    query: String,
    selected: usize,
}

impl CommandPalette {
    /// Builds a closed palette.
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether the palette is visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Opens the palette with an empty query.
    pub fn open(&mut self) {
        self.open = true;
        self.query.clear();
        self.selected = 0;
    }

    /// Closes the palette.
    pub fn close(&mut self) {
        self.open = false;
    }

    /// Search text typed by the user.
    pub fn query(&self) -> &str {
        &self.query
    }

    /// Replaces the search text and resets the selection.
    pub fn set_query(&mut self, query: impl Into<String>) {
        self.query = query.into();
        self.selected = 0;
    }

    /// Index of the selected command.
    pub fn selected(&self) -> usize {
        self.selected
    }

    /// Selects a command by index.
    pub fn select(&mut self, index: usize) {
        self.selected = index;
    }

    /// Command indices that match the query, best match first.
    pub fn results(&self, texts: &UiTexts) -> Vec<usize> {
        let mut ranked: Vec<(u32, usize)> = COMMANDS
            .iter()
            .enumerate()
            .filter_map(|(index, command)| {
                fuzzy_score(self.query(), texts.get(command.label_key)).map(|score| (score, index))
            })
            .collect();
        ranked.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
        ranked.into_iter().map(|(_, index)| index).collect()
    }

    /// Moves the selection through the results with wrap-around.
    pub fn move_selection(&mut self, delta: i32, total: usize) {
        if total == 0 {
            self.selected = 0;
            return;
        }
        let current = self.selected.min(total - 1) as i32;
        self.selected = (current + delta).rem_euclid(total as i32) as usize;
    }

    /// Action of the selected command, `None` when nothing matches.
    pub fn selected_action(&self, texts: &UiTexts) -> Option<ShellAction> {
        let results = self.results(texts);
        results
            .get(self.selected.min(results.len().saturating_sub(1)))
            .map(|index| COMMANDS[*index].action)
    }
}

/// Scores a label against a query: prefix beats substring, substring beats subsequence.
pub fn fuzzy_score(query: &str, label: &str) -> Option<u32> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Some(0);
    }
    let haystack = label.to_lowercase();
    if haystack.starts_with(&needle) {
        return Some(3);
    }
    if haystack.contains(&needle) {
        return Some(2);
    }
    let mut chars = haystack.chars();
    for wanted in needle.chars() {
        if !chars.any(|candidate| candidate == wanted) {
            return None;
        }
    }
    Some(1)
}

/// State of the tray flyout.
#[derive(Debug, Clone, Default)]
pub struct Tray {
    open: bool,
}

impl Tray {
    /// Builds a closed tray flyout.
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether the flyout is visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Opens the flyout.
    pub fn open(&mut self) {
        self.open = true;
    }

    /// Closes the flyout.
    pub fn close(&mut self) {
        self.open = false;
    }

    /// Toggles the flyout.
    pub fn toggle(&mut self) {
        self.open = !self.open;
    }
}

/// Quick action of the tray flyout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    /// Switches the appearance.
    ToggleTheme,
    /// Selects the next wallpaper.
    NextWallpaper,
    /// Shows the onboarding again.
    ShowOnboarding,
    /// Leaves the desktop.
    CloseDesktop,
}

impl From<TrayAction> for ShellAction {
    fn from(action: TrayAction) -> Self {
        match action {
            TrayAction::ToggleTheme => ShellAction::ToggleTheme,
            TrayAction::NextWallpaper => ShellAction::NextWallpaper,
            TrayAction::ShowOnboarding => ShellAction::ShowOnboarding,
            TrayAction::CloseDesktop => ShellAction::CloseDesktop,
        }
    }
}

/// Multi-page first-run flow.
#[derive(Debug, Clone, Default)]
pub struct Onboarding {
    step: usize,
    seen: bool,
}

impl Onboarding {
    /// Builds an unseen onboarding that starts on the first page.
    pub fn new() -> Self {
        Self::default()
    }

    /// Restores the seen flag, for example from the window host's storage.
    pub fn restore(seen: bool) -> Self {
        Self { step: 0, seen }
    }

    /// Whether the flow still has to be shown.
    pub fn is_open(&self) -> bool {
        !self.seen
    }

    /// Current page, counted from zero.
    pub fn step(&self) -> usize {
        self.step
    }

    /// Whether the flow was completed or skipped before.
    pub fn seen(&self) -> bool {
        self.seen
    }

    /// One-based page and total pages.
    pub fn progress(&self) -> (usize, usize) {
        (self.step + 1, ONBOARDING_STEPS)
    }

    /// Goes to the next page; the last page finishes the flow.
    pub fn next(&mut self) {
        if self.step + 1 >= ONBOARDING_STEPS {
            self.finish();
        } else {
            self.step += 1;
        }
    }

    /// Goes back one page.
    pub fn back(&mut self) {
        self.step = self.step.saturating_sub(1);
    }

    /// Marks the flow as seen and hides it.
    pub fn finish(&mut self) {
        self.seen = true;
        self.step = 0;
    }

    /// Shows the flow again from the first page.
    pub fn restart(&mut self) {
        self.seen = false;
        self.step = 0;
    }
}

/// Shell overlays, wallpaper and widgets of the desktop.
#[derive(Debug, Clone, Default)]
pub struct ShellState {
    /// Start menu.
    pub start: StartMenu,
    /// Command palette.
    pub palette: CommandPalette,
    /// Tray flyout.
    pub tray: Tray,
    /// First-run flow.
    pub onboarding: Onboarding,
    /// Wallpaper selection.
    pub wallpaper: WallpaperState,
    /// Widgets layer.
    pub widgets: WidgetLayer,
}

impl ShellState {
    /// Builds the default shell: closed overlays, aurora wallpaper, widgets on.
    pub fn new() -> Self {
        Self {
            start: StartMenu::new(),
            palette: CommandPalette::new(),
            tray: Tray::new(),
            onboarding: Onboarding::new(),
            wallpaper: WallpaperState::default(),
            widgets: WidgetLayer::new(),
        }
    }

    /// Closes start menu, palette and tray flyout.
    pub fn close_overlays(&mut self) {
        self.start.close();
        self.palette.close();
        self.tray.close();
    }

    /// Whether any overlay is visible.
    pub fn overlay_open(&self) -> bool {
        self.onboarding.is_open()
            || self.start.is_open()
            || self.palette.is_open()
            || self.tray.is_open()
    }

    /// Opens the start menu and closes the other overlays.
    pub fn open_start(&mut self) {
        self.close_overlays();
        self.start.open();
    }

    /// Toggles the start menu.
    pub fn toggle_start(&mut self) {
        if self.start.is_open() {
            self.close_overlays();
        } else {
            self.open_start();
        }
    }

    /// Opens the command palette and closes the other overlays.
    pub fn open_palette(&mut self) {
        self.close_overlays();
        self.palette.open();
    }

    /// Toggles the tray flyout.
    pub fn toggle_tray(&mut self) {
        if self.tray.is_open() {
            self.close_overlays();
        } else {
            self.close_overlays();
            self.tray.open();
        }
    }
}

/// Focus key of an overlay, so switching overlays re-seats the focus.
fn overlay_key(name: &str) -> Id {
    Id::new(("socdof-shell-overlay", name))
}

/// Opens or keeps the focus trap of an overlay.
fn begin_overlay(focus: &mut FocusState, key: Id, trigger: Id) {
    if focus.overlay_key() != Some(key) {
        focus.open_overlay_for(key, trigger);
    }
    focus.collecting(true);
}

/// Releases the focus trap and drops the focus back to the screen.
fn end_overlay(focus: &mut FocusState) {
    focus.collecting(false);
    focus.close_overlay();
    focus.set_focus(None);
}

/// Whether the pointer clicked outside `rect`.
fn pointer_clicked_outside(ctx: &Context, rect: Rect) -> bool {
    ctx.input(|input| {
        input.pointer.any_click()
            && input
                .pointer
                .interact_pos()
                .is_some_and(|pos| !rect.contains(pos))
    })
}

/// Panel frame of every overlay.
fn panel_frame(theme: &Theme) -> egui::Frame {
    egui::Frame::none()
        .fill(theme.palette.surface)
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .rounding(egui::Rounding::same(RADIUS_CARD))
        .inner_margin(egui::Margin::same(12.0))
}

/// Draws one selectable overlay row and reports whether it was activated.
fn shell_row(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    id: Id,
    icon: Option<Icon>,
    label: &str,
    active: bool,
) -> bool {
    let focused = focus.register(id);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 32.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let activated = response.clicked() || focus.activate(id);
    if active || response.hovered() || focused {
        ui.painter().rect(
            rect,
            egui::Rounding::same(6.0),
            theme.accent.light,
            Stroke::NONE,
        );
    }
    let mut left = rect.left() + 8.0;
    if let Some(icon) = icon {
        icon.draw(
            ui.painter(),
            Rect::from_center_size(Pos2::new(left + 8.0, rect.center().y), Vec2::splat(14.0)),
            if active || focused {
                theme.accent_text()
            } else {
                theme.palette.text
            },
            1.4,
        );
        left += 26.0;
    }
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::proportional(FONT_BODY),
        theme.palette.text,
    );
    ui.painter().galley(
        Pos2::new(left, rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::SelectableLabel, label));
    activated
}

/// Draws the start menu and returns the app the user chose.
pub fn start_menu(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StartMenu,
    icons: &IconGrid,
) -> Option<AppId> {
    if !state.is_open() {
        return None;
    }
    if focus.escape() {
        state.close();
        end_overlay(focus);
        return None;
    }
    let key = overlay_key("start");
    begin_overlay(focus, key, Id::new("socdof-taskbar-start"));
    let mut chosen = None;
    let panel = egui::Area::new(key.with("panel"))
        .order(egui::Order::Foreground)
        .anchor(
            Align2::LEFT_BOTTOM,
            Vec2::new(12.0, -(TASKBAR_HEIGHT + 8.0)),
        )
        .show(ctx, |ui| {
            panel_frame(theme).show(ui, |ui| {
                ui.set_width(320.0);
                ui.label(
                    RichText::new(texts.get("start_title"))
                        .size(FONT_HEADING)
                        .strong(),
                );
                ui.add_space(6.0);
                search_field(
                    ui,
                    theme,
                    focus,
                    &mut state.query,
                    texts.get("start_search"),
                );
                ui.add_space(4.0);
                let results = state.results(icons);
                if results.is_empty() {
                    ui.label(
                        RichText::new(texts.get("start_empty"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    return;
                }
                let (down, up) = ui.input(|input| {
                    (
                        input.key_pressed(Key::ArrowDown),
                        input.key_pressed(Key::ArrowUp),
                    )
                });
                let mut navigated = false;
                if down {
                    state.move_selection(1, results.len());
                    navigated = true;
                }
                if up {
                    state.move_selection(-1, results.len());
                    navigated = true;
                }
                let selected = state.selected().min(results.len() - 1);
                state.select(selected);
                for (position, index) in results.iter().enumerate() {
                    let icon = &icons.icons()[*index];
                    let row_id = Id::new(("socdof-start-item", icon.app().as_str()));
                    if navigated && position == selected {
                        focus.set_focus(Some(row_id));
                    }
                    if shell_row(
                        ui,
                        theme,
                        focus,
                        row_id,
                        Some(icon.icon()),
                        icon.label(),
                        position == selected,
                    ) {
                        chosen = Some(icon.app());
                    }
                }
                if ui.input(|input| input.key_pressed(Key::Enter)) && chosen.is_none() {
                    chosen = results
                        .get(selected)
                        .map(|index| icons.icons()[*index].app());
                }
            });
        });
    focus.collecting(false);
    if state.is_open() && pointer_clicked_outside(ctx, panel.response.rect) {
        state.close();
    }
    if chosen.is_some() || !state.is_open() {
        end_overlay(focus);
    }
    chosen
}

/// Draws the command palette and returns the chosen command.
pub fn command_palette(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut CommandPalette,
) -> Option<ShellAction> {
    if !state.is_open() {
        return None;
    }
    if focus.escape() {
        state.close();
        end_overlay(focus);
        return None;
    }
    let key = overlay_key("palette");
    begin_overlay(focus, key, Id::new("socdof-palette"));
    let mut chosen = None;
    let panel = egui::Area::new(key.with("panel"))
        .order(egui::Order::Foreground)
        .anchor(Align2::CENTER_TOP, Vec2::new(0.0, 96.0))
        .show(ctx, |ui| {
            panel_frame(theme).show(ui, |ui| {
                ui.set_width(420.0);
                ui.label(
                    RichText::new(texts.get("palette_title"))
                        .size(FONT_HEADING)
                        .strong(),
                );
                ui.add_space(6.0);
                search_field(
                    ui,
                    theme,
                    focus,
                    &mut state.query,
                    texts.get("palette_placeholder"),
                );
                ui.add_space(4.0);
                let results = state.results(texts);
                if results.is_empty() {
                    ui.label(
                        RichText::new(texts.get("palette_empty"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    return;
                }
                let (down, up) = ui.input(|input| {
                    (
                        input.key_pressed(Key::ArrowDown),
                        input.key_pressed(Key::ArrowUp),
                    )
                });
                let mut navigated = false;
                if down {
                    state.move_selection(1, results.len());
                    navigated = true;
                }
                if up {
                    state.move_selection(-1, results.len());
                    navigated = true;
                }
                let selected = state.selected().min(results.len() - 1);
                state.select(selected);
                for (position, index) in results.iter().enumerate() {
                    let command = COMMANDS[*index];
                    let row_id = Id::new(("socdof-palette-item", command.label_key));
                    if navigated && position == selected {
                        focus.set_focus(Some(row_id));
                    }
                    if shell_row(
                        ui,
                        theme,
                        focus,
                        row_id,
                        Some(command_icon(command.action)),
                        texts.get(command.label_key),
                        position == selected,
                    ) {
                        chosen = Some(command.action);
                    }
                }
                if ui.input(|input| input.key_pressed(Key::Enter)) && chosen.is_none() {
                    chosen = state.selected_action(texts);
                }
                ui.add_space(4.0);
                ui.label(
                    RichText::new(texts.get("palette_hint"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            });
        });
    focus.collecting(false);
    if state.is_open() && pointer_clicked_outside(ctx, panel.response.rect) {
        state.close();
    }
    if chosen.is_some() || !state.is_open() {
        end_overlay(focus);
    }
    chosen
}

/// Icon of a command.
fn command_icon(action: ShellAction) -> Icon {
    match action {
        ShellAction::OpenApp(_) => Icon::Folder,
        ShellAction::ToggleTheme => Icon::Sun,
        ShellAction::NextWallpaper => Icon::Refresh,
        ShellAction::ShowOnboarding => Icon::Info,
        ShellAction::CloseDesktop => Icon::Close,
    }
}

/// Draws the tray flyout and returns the chosen quick action.
pub fn tray_flyout(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut Tray,
) -> Option<TrayAction> {
    if !state.is_open() {
        return None;
    }
    if focus.escape() {
        state.close();
        end_overlay(focus);
        return None;
    }
    let key = overlay_key("tray");
    begin_overlay(focus, key, Id::new("socdof-taskbar-tray"));
    let mut chosen = None;
    let actions = [
        (TrayAction::ToggleTheme, "tray_theme", Icon::Sun),
        (TrayAction::NextWallpaper, "tray_wallpaper", Icon::Refresh),
        (TrayAction::ShowOnboarding, "tray_onboarding", Icon::Info),
        (TrayAction::CloseDesktop, "tray_close", Icon::Close),
    ];
    let panel = egui::Area::new(key.with("panel"))
        .order(egui::Order::Foreground)
        .anchor(
            Align2::RIGHT_BOTTOM,
            Vec2::new(-12.0, -(TASKBAR_HEIGHT + 8.0)),
        )
        .show(ctx, |ui| {
            panel_frame(theme).show(ui, |ui| {
                ui.set_width(264.0);
                ui.label(
                    RichText::new(texts.get("tray_title"))
                        .size(FONT_HEADING)
                        .strong(),
                );
                ui.add_space(6.0);
                for (action, key, icon) in actions {
                    let row_id = Id::new(("socdof-tray-item", key));
                    if shell_row(ui, theme, focus, row_id, Some(icon), texts.get(key), false) {
                        chosen = Some(action);
                    }
                }
            });
        });
    focus.collecting(false);
    if state.is_open() && pointer_clicked_outside(ctx, panel.response.rect) {
        state.close();
    }
    if chosen.is_some() || !state.is_open() {
        end_overlay(focus);
    }
    chosen
}

/// Draws the onboarding modal.
pub fn onboarding(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut Onboarding,
) {
    if !state.is_open() {
        return;
    }
    if focus.escape() {
        state.finish();
        end_overlay(focus);
        return;
    }
    let key = overlay_key("onboarding");
    begin_overlay(focus, key, Id::new("socdof-onboarding"));
    let mut next = false;
    let mut back = false;
    let mut skip = false;
    let step = state.step().min(ONBOARDING_STEPS - 1);
    egui::Area::new(key.with("panel"))
        .order(egui::Order::Foreground)
        .anchor(Align2::CENTER_CENTER, Vec2::ZERO)
        .show(ctx, |ui| {
            panel_frame(theme).show(ui, |ui| {
                ui.set_width(440.0);
                ui.label(
                    RichText::new(texts.get("onboarding_title"))
                        .size(FONT_HEADING)
                        .strong(),
                );
                ui.label(
                    RichText::new(format!(
                        "{} {} / {}",
                        texts.get("onboarding_progress"),
                        state.progress().0,
                        state.progress().1
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                ui.add_space(10.0);
                ui.label(texts.get(ONBOARDING_STEP_KEYS[step]));
                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if step > 0
                        && button(
                            ui,
                            theme,
                            focus,
                            texts.get("onboarding_back"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                    {
                        back = true;
                    }
                    let finish = step + 1 >= ONBOARDING_STEPS;
                    let label = if finish {
                        texts.get("onboarding_finish")
                    } else {
                        texts.get("onboarding_next")
                    };
                    if button(ui, theme, focus, label, ButtonVariant::Primary).activated {
                        next = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("onboarding_skip"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        skip = true;
                    }
                });
            });
        });
    focus.collecting(false);
    if back {
        state.back();
    }
    if next {
        state.next();
    }
    if skip {
        state.finish();
    }
    if state.seen() {
        end_overlay(focus);
    }
}

/// Button of the wallpaper switch, used by the tray and the onboarding.
pub fn wallpaper_label(wallpaper: Wallpaper) -> &'static str {
    wallpaper.label_key()
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{Context, Pos2, RawInput};
    use socdof_core::domain::settings::Language;

    use crate::desktop::DesktopIcon;
    use crate::theme::Appearance;

    fn icons(texts: &UiTexts) -> IconGrid {
        IconGrid::new(vec![
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
            DesktopIcon::new(
                AppId::new("invoices"),
                texts.get("app_invoices"),
                Icon::Calendar,
            ),
        ])
    }

    #[test]
    fn start_menu_filters_apps_by_label_and_slug() {
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let grid = icons(&texts);
        let mut menu = StartMenu::new();
        menu.open();
        assert_eq!(menu.results(&grid).len(), 3);
        menu.set_query("kont");
        assert_eq!(menu.results(&grid), vec![0]);
        menu.set_query("rech");
        assert_eq!(menu.results(&grid), vec![2]);
        menu.set_query("invoice");
        assert_eq!(menu.results(&grid), vec![2]);
        menu.set_query("gibtesnicht");
        assert!(menu.results(&grid).is_empty());
    }

    #[test]
    fn start_menu_navigation_wraps_and_resets_on_open() {
        let mut menu = StartMenu::new();
        assert!(!menu.is_open());
        menu.open();
        assert!(menu.is_open());
        menu.move_selection(1, 3);
        assert_eq!(menu.selected(), 1);
        menu.move_selection(-2, 3);
        assert_eq!(menu.selected(), 2);
        menu.move_selection(1, 3);
        assert_eq!(menu.selected(), 0);
        menu.set_query("x");
        assert_eq!(menu.selected(), 0);
        menu.close();
        assert!(!menu.is_open());
    }

    #[test]
    fn fuzzy_scores_prefix_over_substring_over_subsequence() {
        assert_eq!(fuzzy_score("kon", "Kontakte"), Some(3));
        assert_eq!(fuzzy_score("akt", "Kontakte"), Some(2));
        assert_eq!(fuzzy_score("kt", "Kontakte"), Some(2));
        assert_eq!(fuzzy_score("knt", "Kontakte"), Some(1));
        assert_eq!(fuzzy_score("", "Kontakte"), Some(0));
        assert_eq!(fuzzy_score("zz", "Kontakte"), None);
    }

    #[test]
    fn palette_ranks_and_executes_the_selected_command() {
        let texts = UiTexts::embedded(Language::En).expect("catalogue");
        let mut palette = CommandPalette::new();
        palette.open();
        assert_eq!(palette.results(&texts).len(), COMMANDS.len());
        palette.set_query("switch");
        let results = palette.results(&texts);
        assert_eq!(results.len(), 1);
        assert_eq!(
            palette.selected_action(&texts),
            Some(ShellAction::ToggleTheme)
        );

        palette.set_query("contacts");
        assert_eq!(
            palette.selected_action(&texts),
            Some(ShellAction::OpenApp(AppId::new("contacts")))
        );

        palette.set_query("zzz");
        assert!(palette.results(&texts).is_empty());
        assert_eq!(palette.selected_action(&texts), None);

        palette.set_query("");
        palette.select(0);
        assert_eq!(
            palette.selected_action(&texts),
            Some(ShellAction::OpenApp(AppId::new("contacts")))
        );
    }

    #[test]
    fn tray_and_onboarding_state_machines() {
        let mut tray = Tray::new();
        assert!(!tray.is_open());
        tray.toggle();
        assert!(tray.is_open());
        tray.close();
        assert!(!tray.is_open());

        let mut onboarding = Onboarding::new();
        assert!(onboarding.is_open());
        assert_eq!(onboarding.progress(), (1, ONBOARDING_STEPS));
        onboarding.next();
        assert_eq!(onboarding.step(), 1);
        onboarding.back();
        assert_eq!(onboarding.step(), 0);
        for _ in 0..ONBOARDING_STEPS {
            onboarding.next();
        }
        assert!(onboarding.seen());
        assert!(!onboarding.is_open());
        onboarding.restart();
        assert!(onboarding.is_open());
        assert!(Onboarding::restore(true).seen());
    }

    #[test]
    fn shell_overlays_are_mutually_exclusive() {
        let mut shell = ShellState::new();
        shell.open_start();
        assert!(shell.start.is_open());
        shell.open_palette();
        assert!(shell.palette.is_open());
        assert!(!shell.start.is_open());
        shell.toggle_tray();
        assert!(shell.tray.is_open());
        assert!(!shell.palette.is_open());
        shell.toggle_tray();
        assert!(!shell.tray.is_open());
        shell.onboarding.restart();
        assert!(shell.overlay_open());
    }

    #[test]
    fn overlays_paint_without_a_display() {
        let ctx = Context::default();
        let theme = Theme::new(Appearance::Light, "indigo");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let grid = icons(&texts);
        let input = || RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 800.0))),
            time: Some(1.0),
            ..Default::default()
        };

        // egui keeps a freshly created Area invisible for its first frame, so every overlay is
        // rendered twice and only the second frame is inspected.
        let mut focus = FocusState::default();
        let mut start = StartMenu::new();
        start.open();
        let mut render = || {
            ctx.run(input(), |ctx| {
                focus.begin_frame(ctx);
                theme.apply(ctx);
                start_menu(ctx, &theme, &texts, &mut focus, &mut start, &grid);
                focus.finish_frame();
            })
        };
        let _ = render();
        let output = render();
        assert!(output.shapes.len() > 8, "start menu drew little");

        let mut focus = FocusState::default();
        let mut palette = CommandPalette::new();
        palette.open();
        let mut render = || {
            ctx.run(input(), |ctx| {
                focus.begin_frame(ctx);
                theme.apply(ctx);
                command_palette(ctx, &theme, &texts, &mut focus, &mut palette);
                focus.finish_frame();
            })
        };
        let _ = render();
        let output = render();
        assert!(output.shapes.len() > 8, "palette drew little");

        let mut focus = FocusState::default();
        let mut tray = Tray::new();
        tray.open();
        let mut render = || {
            ctx.run(input(), |ctx| {
                focus.begin_frame(ctx);
                theme.apply(ctx);
                tray_flyout(ctx, &theme, &texts, &mut focus, &mut tray);
                focus.finish_frame();
            })
        };
        let _ = render();
        let output = render();
        assert!(output.shapes.len() > 8, "tray drew little");

        let mut focus = FocusState::default();
        let mut first_run = Onboarding::new();
        let mut render = || {
            ctx.run(input(), |ctx| {
                focus.begin_frame(ctx);
                theme.apply(ctx);
                onboarding(ctx, &theme, &texts, &mut focus, &mut first_run);
                focus.finish_frame();
            })
        };
        let _ = render();
        let output = render();
        assert!(
            output.shapes.len() > 8,
            "onboarding drew little: {} shapes, open={}",
            output.shapes.len(),
            first_run.is_open()
        );
    }

    #[test]
    fn wallpaper_label_resolves_from_the_catalogue() {
        let texts = UiTexts::embedded(Language::Fr).expect("catalogue");
        for wallpaper in Wallpaper::ALL {
            assert_ne!(texts.get(wallpaper_label(wallpaper)), wallpaper.label_key());
        }
    }
}
