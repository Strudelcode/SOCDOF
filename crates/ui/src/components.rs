//! Component kit for the Rust UI.
//!
//! Every control is drawn from the design tokens instead of the egui defaults, so the Rust screens
//! and the legacy screens share one visual language. The kit is deliberately free of business
//! logic: labels and values come from the caller.
//!
//! All interactive controls take a [`FocusState`], register themselves in reading order and draw
//! their focus ring from the accent tokens. Mouse and keyboard share one activation path: pressing
//! Enter or Space on a focused control reports the same activation as a click.

use egui::{
    Align2, Color32, Context, FontId, Id, InnerResponse, Pos2, Rect, Response, RichText, Rounding,
    Sense, Stroke, TextEdit, Ui, Vec2, WidgetInfo, WidgetType,
};

use crate::focus::{focus_ring, FocusState};
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{
    adjust, shadow_layers, with_alpha, ShadowStrength, CARD_PADDING, CONTROL_HEIGHT, FONT_BODY,
    FONT_SMALL, RADIUS_CARD, RADIUS_CONTROL, RADIUS_DIALOG,
};

/// Visual weight of a button.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonVariant {
    /// Filled with the accent color. One per screen area.
    Primary,
    /// Surface with a hairline border.
    Secondary,
    /// Text only until hovered.
    Ghost,
    /// Filled with the destructive color.
    Danger,
}

/// Semantic color of a badge or toast.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tone {
    /// Draft, disabled or informational.
    Neutral,
    /// Completed or paid.
    Success,
    /// Open or due soon.
    Warning,
    /// Overdue or destructive.
    Danger,
    /// New or highlighted.
    Accent,
}

impl Tone {
    /// Foreground color of the tone in the given theme.
    pub fn color(self, theme: &Theme) -> Color32 {
        match self {
            Tone::Neutral => theme.palette.text_muted,
            Tone::Success => theme.palette.success,
            Tone::Warning => theme.palette.warning,
            Tone::Danger => theme.palette.danger,
            Tone::Accent => theme.accent_text(),
        }
    }
}

/// Result of a control: the egui response plus whether it was activated by mouse or keyboard.
#[derive(Debug)]
pub struct Activated {
    /// Raw egui response, for hover text and layout.
    pub response: Response,
    /// Whether the control was clicked or activated with Enter/Space.
    pub activated: bool,
}

impl Activated {
    /// Adds a tooltip without losing the activation state.
    pub fn on_hover_text(mut self, text: impl Into<egui::WidgetText>) -> Self {
        self.response = self.response.on_hover_text(text);
        self
    }
}

/// Draws a button and returns its response.
pub fn button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    variant: ButtonVariant,
) -> Activated {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (fill, stroke, text) = match variant {
        ButtonVariant::Primary => (theme.accent.base, Stroke::NONE, theme.palette.accent_on),
        ButtonVariant::Danger => (theme.palette.danger, Stroke::NONE, theme.palette.accent_on),
        ButtonVariant::Secondary => (
            theme.palette.surface,
            Stroke::new(1.0_f32, theme.palette.border),
            theme.palette.text,
        ),
        ButtonVariant::Ghost => (Color32::TRANSPARENT, Stroke::NONE, theme.palette.text),
    };

    let galley =
        ui.painter()
            .layout_no_wrap(label.to_owned(), FontId::proportional(FONT_BODY), text);
    let size = Vec2::new(galley.size().x + 28.0, CONTROL_HEIGHT);
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    let activated = response.clicked() || keyboard;

    let (fill, stroke) = if !ui.is_enabled() {
        (with_alpha(theme.palette.text_muted, 12), Stroke::NONE)
    } else if activated {
        match variant {
            ButtonVariant::Primary => (theme.accent.hover, stroke),
            ButtonVariant::Danger => (adjust(theme.palette.danger, -20), stroke),
            ButtonVariant::Secondary => {
                (theme.accent.light, Stroke::new(1.0_f32, theme.accent.base))
            }
            ButtonVariant::Ghost => (theme.accent.light, stroke),
        }
    } else if response.hovered() || focused {
        match variant {
            ButtonVariant::Primary => (theme.accent.hover, stroke),
            ButtonVariant::Danger => (adjust(theme.palette.danger, -20), stroke),
            ButtonVariant::Secondary => (
                theme.accent.light,
                Stroke::new(1.0_f32, theme.accent.border),
            ),
            ButtonVariant::Ghost => (theme.accent.light, stroke),
        }
    } else {
        (fill, stroke)
    };

    let painter = ui.painter();
    painter.rect(rect, Rounding::same(RADIUS_CONTROL), fill, stroke);
    painter.galley(rect.center() - galley.size() / 2.0, galley, text);
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    Activated {
        response,
        activated,
    }
}

/// Draws an icon-only button with a tooltip and an accessible label.
pub fn icon_button(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    icon: Icon,
    label: &str,
) -> Activated {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(CONTROL_HEIGHT), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    let activated = response.clicked() || keyboard;
    if response.hovered() || focused || activated {
        ui.painter().rect(
            rect,
            Rounding::same(RADIUS_CONTROL),
            theme.accent.light,
            Stroke::NONE,
        );
    }
    let icon_rect = Rect::from_center_size(rect.center(), Vec2::splat(18.0));
    let color = if response.hovered() || focused {
        theme.accent_text()
    } else {
        theme.palette.text
    };
    icon.draw(ui.painter(), icon_rect, color, 1.6);
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));
    let result = Activated {
        response,
        activated,
    };
    if label.is_empty() {
        result
    } else {
        result.on_hover_text(label)
    }
}

/// Paints the soft drop shadow of a surface below it, widest layer first.
pub fn shadow(
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    rounding: f32,
    strength: ShadowStrength,
) {
    for layer in shadow_layers(rect, rounding, strength, theme.accent.base) {
        painter.rect_filled(layer.rect, Rounding::same(layer.rounding), layer.color);
    }
}

/// Draws a card with the shared surface, border, padding and soft shadow.
pub fn card<R>(
    ui: &mut Ui,
    theme: &Theme,
    add_contents: impl FnOnce(&mut Ui) -> R,
) -> InnerResponse<R> {
    // The shadow belongs below the frame, but its rectangle is only known once the frame was laid
    // out. Reserve a paint slot first and fill it when the card size is final.
    let slot = ui.painter().add(egui::Shape::Noop);
    let response = egui::Frame::none()
        .fill(theme.palette.surface)
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .rounding(Rounding::same(RADIUS_CARD))
        .inner_margin(egui::Margin::same(CARD_PADDING))
        .show(ui, add_contents);
    // A neutral shadow keeps the card edge calm; an accent coloured one turns every card into a
    // violet halo, which the reference design does not have.
    let shapes: Vec<egui::Shape> = shadow_layers(
        response.response.rect,
        RADIUS_CARD,
        ShadowStrength::Card,
        Color32::BLACK,
    )
    .into_iter()
    .map(|layer| egui::Shape::rect_filled(layer.rect, Rounding::same(layer.rounding), layer.color))
    .collect();
    ui.painter().set(slot, egui::Shape::Vec(shapes));
    response
}

/// Draws KPI cards in explicit, width-aware rows (four columns on wide windows, two below 900 px).
///
/// A plain wrapped row hands the last card whatever strip is left over and squeezes its label into
/// a single-character column at narrow widths, so the rows are laid out explicitly.
pub fn kpi_cards(ui: &mut Ui, theme: &Theme, entries: &[(String, String)]) {
    // German KPI labels are single compound words ("Kilometerpauschale") that cannot wrap, so a
    // two-column row needs more than the phone panel offers. Below the stacking width each card
    // takes a full row and its label stays readable.
    let columns = if ui.available_width() >= 900.0 {
        4
    } else if ui.available_width() >= FORM_STACK_WIDTH {
        2
    } else {
        1
    };
    // `horizontal` already inserts `item_spacing` between the cards; counting it twice made the row
    // wider than the panel (four cards + three gaps overflowed by 24 px at 1000 px).
    //
    // The slot is the width a card occupies in the row. The card frame adds `CARD_PADDING` on both
    // sides on top of the content width, so the content has to be that much narrower — otherwise
    // the two phone columns plus their frames grew the panel from 432 to 448 px.
    let gap = ui.spacing().item_spacing.x;
    let slot_width =
        ((ui.available_width() - gap * (columns as f32 - 1.0)) / columns as f32).max(120.0);
    let card_width = (slot_width - 2.0 * CARD_PADDING).max(96.0);
    for row in entries.chunks(columns) {
        ui.horizontal(|ui| {
            for (label, value) in row {
                ui.scope(|ui| {
                    // The frame paints around its content, so the content itself has to carry the
                    // minimum width; a minimum on the outer scope only pads the row afterwards and
                    // left cards of different widths that still grew past the panel.
                    card(ui, theme, |ui| {
                        ui.set_min_width(card_width);
                        ui.set_max_width(card_width);
                        ui.label(
                            RichText::new(label)
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                        ui.heading(value);
                    });
                });
            }
        });
        ui.add_space(gap);
    }
}

/// Height of one row of a virtualised table, including its padding.
pub const TABLE_ROW_HEIGHT: f32 = 36.0;

/// Splits `total` into the given fractions, keeping `gap` pixels between the columns.
pub fn table_columns(total: f32, fractions: &[f32], gap: f32) -> Vec<f32> {
    let gaps = gap * fractions.len().saturating_sub(1) as f32;
    let usable = (total - gaps).max(0.0);
    fractions
        .iter()
        .map(|fraction| (usable * fraction).max(48.0))
        .collect()
}

/// Lays out one fixed-size cell of a virtualised table row.
pub fn table_cell<R>(ui: &mut Ui, width: f32, add: impl FnOnce(&mut Ui) -> R) -> R {
    // A plain `allocate_ui_with_layout` shrinks to the content, which would let every row find its
    // own column positions. The explicit rect keeps header and rows on the same grid.
    let (rect, _) =
        ui.allocate_exact_size(egui::vec2(width, TABLE_ROW_HEIGHT), egui::Sense::hover());
    let mut cell = ui.child_ui(rect, egui::Layout::left_to_right(egui::Align::Center));
    add(&mut cell)
}

/// Draws a compact status badge.
pub fn badge(ui: &mut Ui, theme: &Theme, label: &str, tone: Tone) -> Response {
    let color = tone.color(theme);
    // Long messages (validation errors, import summaries) used to grow the pill past the panel:
    // the text wraps at the width that is left, and the pill grows in height instead.
    let text_width = (ui.available_width() - 20.0).max(24.0);
    let font = FontId::proportional(FONT_SMALL);
    let single = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), color);
    // Short badges keep their single-line pill; only a label that does not fit wraps, so wide
    // layouts and every existing golden stay byte-identical.
    let narrow = ui.ctx().screen_rect().width() < FORM_STACK_WIDTH;
    let wrapped = narrow && single.size().x > text_width;
    let galley = if wrapped {
        ui.painter()
            .layout(label.to_owned(), font, color, text_width)
    } else {
        single
    };
    let height = if wrapped {
        (galley.size().y + 12.0).max(22.0)
    } else {
        22.0
    };
    let size = Vec2::new(galley.size().x + 20.0, height);
    let (rect, response) = ui.allocate_exact_size(size, Sense::hover());

    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(11.0),
        with_alpha(color, 14),
        Stroke::NONE,
    );
    painter.galley(rect.center() - galley.size() / 2.0, galley, color);
    response
}

/// Draws a segmented tab bar and reports whether the selection changed.
pub fn tabs(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    labels: &[&str],
    selected: &mut usize,
) -> bool {
    let mut changed = false;
    // A tab row that cannot fit keeps the remaining tabs on a second line instead of pushing
    // them past the right edge of the window.
    ui.horizontal_wrapped(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;
        for (index, label) in labels.iter().enumerate() {
            let variant = if index == *selected {
                ButtonVariant::Secondary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, label, variant).activated && index != *selected {
                *selected = index;
                changed = true;
            }
        }
    });
    changed
}

/// Draws a single line search field that fills the available width.
pub fn search_field(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    hint: &str,
) -> Activated {
    search_field_reserved(ui, theme, focus, value, hint, 0.0)
}

/// Panel width below which a module toolbar splits into a search line and an action line.
///
/// A single row only fits while the search field keeps a usable width next to the actions; the
/// narrowest supported panel (432 points) leaves about 384 points, so the two-row layout applies
/// there and every action keeps its full label.
pub const TOOLBAR_STACK_WIDTH: f32 = 560.0;

/// Width below which a form row stacks its fields instead of placing them side by side.
///
/// The labelled text fields of the entry forms grow to the available width, so a row of quantity,
/// price, tax and the remove button only fits while all four have room. Below this width each field
/// takes its own row instead of squeezing the price and tax columns out of the panel.
pub const FORM_STACK_WIDTH: f32 = 560.0;

/// Narrowest usable column of a horizontal form row.
pub const MIN_FORM_COLUMN_WIDTH: f32 = 120.0;

/// Widths of the field columns of a horizontal form row.
///
/// A labelled text field fills whatever width it is given, so a row of fields needs explicit widths:
/// the trailing action keeps its room and every column keeps at least [`MIN_FORM_COLUMN_WIDTH`].
pub fn form_column_widths(
    available: f32,
    spacing: f32,
    columns: usize,
    action_width: f32,
) -> Vec<f32> {
    // Twelve points of slack: field borders and rounding otherwise push the last column of the row
    // onto the next line, which staggers the labels.
    let room = available - action_width - spacing * columns as f32 - 12.0;
    let width = (room / columns as f32).max(MIN_FORM_COLUMN_WIDTH);
    vec![width; columns]
}

/// Widths of the field columns of a horizontal form row, measured in `ui`.
pub fn form_columns(ui: &egui::Ui, columns: usize, action_width: f32) -> Vec<f32> {
    form_column_widths(
        ui.available_width(),
        ui.spacing().item_spacing.x,
        columns,
        action_width,
    )
}

/// Draws a module toolbar: the search field and the actions next to it.
///
/// On a wide panel the search field shares the row with the actions (`reserve` points stay free for
/// them, exactly like before). On a narrow panel the field takes its own line and the actions wrap
/// below it, so no control or label is pushed out of the panel.
pub fn toolbar<R>(
    ui: &mut Ui,
    focus: &mut FocusState,
    reserve: f32,
    search: impl FnOnce(&mut Ui, &mut FocusState, f32),
    actions: impl FnOnce(&mut Ui, &mut FocusState) -> R,
) -> R {
    if ui.available_width() < TOOLBAR_STACK_WIDTH {
        search(ui, focus, 0.0);
        ui.add_space(8.0);
        ui.horizontal_wrapped(|ui| actions(ui, focus)).inner
    } else {
        let mut result = None;
        ui.horizontal_wrapped(|ui| {
            search(ui, focus, reserve);
            result = Some(actions(ui, focus));
        });
        result.expect("toolbar actions ran")
    }
}

/// Draws a single line search field that leaves `reserve` points for the controls next to it.
///
/// Module toolbars place a primary action to the right of the search field; without the reservation
/// the infinite width of the field pushes that action out of the window.
pub fn search_field_reserved(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    hint: &str,
    reserve: f32,
) -> Activated {
    let width = (ui.available_width() - reserve).max(160.0);
    let response = ui.add(
        TextEdit::singleline(value)
            .hint_text(hint)
            .desired_width(width)
            .text_color(theme.palette.text),
    );
    focus_text_edit(ui, theme, focus, &response, hint);
    Activated {
        response,
        activated: false,
    }
}

/// Registers a text edit with the focus system and forwards the egui focus while it is active.
fn focus_text_edit(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    response: &Response,
    label: &str,
) {
    let focused = focus.register(response.id);
    if response.clicked() {
        focus.set_focus(Some(response.id));
    }
    if focused {
        ui.memory_mut(|memory| memory.request_focus(response.id));
    } else {
        ui.memory_mut(|memory| memory.surrender_focus(response.id));
    }
    if focused {
        focus_ring(ui, theme, response.rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::TextEdit, label));
}

/// Draws a centered empty state.
pub fn empty_state(ui: &mut Ui, theme: &Theme, title: &str, hint: &str) {
    // A toolbar row that is wider than the panel (see the open toolbar decision in
    // NEXT_STEPS_AI.md) grows the parent's minimum width. Without the clamp the card would then be
    // painted wider than the viewport and the hint would be cut off at the right edge.
    // `clip_rect` is the viewport, so subtract the current left inset (frame padding included) and
    // the right padding of the card to stay inside the panel.
    let limit = ui.clip_rect().right() - ui.cursor().min.x - 2.0 * CARD_PADDING;
    ui.set_max_width(ui.available_width().min(limit.max(160.0)));
    ui.vertical_centered(|ui| {
        ui.add_space(12.0);
        ui.label(
            RichText::new("∅")
                .size(28.0)
                .color(with_alpha(theme.palette.text_muted, 60)),
        );
        ui.label(RichText::new(title).strong());
        ui.label(
            RichText::new(hint)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(12.0);
    });
}

/// Sort state of a table, kept by the caller.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SortState {
    /// Sorted column index, `None` for insertion order.
    pub column: Option<usize>,
    /// Whether the sort is ascending.
    pub ascending: bool,
}

impl Default for SortState {
    fn default() -> Self {
        Self {
            column: None,
            ascending: true,
        }
    }
}

impl SortState {
    /// Sorts by a column: the first click sorts ascending, the next click flips the direction.
    pub fn toggle(&mut self, column: usize) {
        if self.column == Some(column) {
            self.ascending = !self.ascending;
        } else {
            self.column = Some(column);
            self.ascending = true;
        }
    }

    /// Arrow shown in a sortable header.
    pub fn indicator(&self, column: usize) -> &'static str {
        match self.column {
            Some(active) if active == column => {
                if self.ascending {
                    "▲"
                } else {
                    "▼"
                }
            }
            _ => "",
        }
    }
}

/// Draws a clickable table header cell.
pub fn sort_header(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    label: &str,
    column: usize,
    sort: &mut SortState,
) -> Response {
    let text = if sort.column == Some(column) {
        format!("{label} {}", sort.indicator(column))
    } else {
        label.to_string()
    };
    let variant = if sort.column == Some(column) {
        ButtonVariant::Secondary
    } else {
        ButtonVariant::Ghost
    };
    let hit = button(ui, theme, focus, &text, variant);
    if hit.activated {
        sort.toggle(column);
    }
    hit.response
}

/// Draws a modal dialog while `open` is true.
///
/// The window close button clears `open`. The content closure returns `true` when it wants the
/// dialog to close, for example after a confirm button was clicked. The function returns whether
/// the dialog is still open and writes that back to `open`.
pub fn modal(
    ctx: &Context,
    theme: &Theme,
    open: &mut bool,
    title: &str,
    add_contents: impl FnOnce(&mut Ui) -> bool,
) -> bool {
    let mut visible = *open;
    let response = egui::Window::new(title)
        .open(&mut visible)
        .collapsible(false)
        .resizable(false)
        // Confirmation bodies are one long sentence; without a limit the auto-sized window grew
        // to 363 px on a 360 px screen and its left edge left the panel.
        .max_width((ctx.screen_rect().width() - 24.0).max(240.0))
        .anchor(Align2::CENTER_CENTER, Vec2::ZERO)
        .frame(
            egui::Frame::none()
                .fill(theme.palette.surface)
                .stroke(Stroke::new(1.0_f32, theme.palette.border))
                .rounding(Rounding::same(RADIUS_DIALOG))
                .inner_margin(egui::Margin::same(CARD_PADDING)),
        )
        .show(ctx, |ui| {
            if ctx.screen_rect().width() < FORM_STACK_WIDTH {
                // The window's own auto-size ignored `max_width` for a long confirmation body; a
                // constrained content width makes the label wrap inside the frame instead.
                ui.set_max_width((ctx.screen_rect().width() - 48.0).max(240.0));
            }
            add_contents(ui)
        });
    let close_requested = response.and_then(|inner| inner.inner).unwrap_or(false);
    let still_open = visible && !close_requested;
    *open = still_open;
    still_open
}

/// Width of a toast card, matching the legacy bottom left card.
pub const TOAST_WIDTH: f32 = 320.0;

/// One transient message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Toast {
    /// Stable id, used by the close button.
    pub id: u64,
    /// Semantic color of the message.
    pub tone: Tone,
    /// Short uppercase title; empty when the message has none.
    pub title: String,
    /// Already translated text.
    pub text: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

/// Collection of transient messages with a time based retention.
#[derive(Debug, Clone, Default)]
pub struct Toasts {
    items: Vec<Toast>,
    next_id: u64,
}

impl Toasts {
    /// Adds a message without a title.
    pub fn push(&mut self, tone: Tone, text: impl Into<String>, now: i64) {
        self.push_titled(tone, "", text, now);
    }

    /// Adds a message with a short title above the body.
    pub fn push_titled(
        &mut self,
        tone: Tone,
        title: impl Into<String>,
        text: impl Into<String>,
        now: i64,
    ) {
        self.next_id += 1;
        let id = self.next_id;
        self.items.push(Toast {
            id,
            tone,
            title: title.into(),
            text: text.into(),
            created_at: now,
        });
    }

    /// Removes one message by id.
    pub fn dismiss(&mut self, id: u64) {
        self.items.retain(|toast| toast.id != id);
    }

    /// Drops messages older than `ttl_ms`.
    pub fn prune(&mut self, now: i64, ttl_ms: i64) {
        self.items
            .retain(|toast| now.saturating_sub(toast.created_at) < ttl_ms);
    }

    /// Messages that are still visible at `now`.
    pub fn visible(&self, now: i64, ttl_ms: i64) -> impl Iterator<Item = &Toast> {
        self.items
            .iter()
            .filter(move |toast| now.saturating_sub(toast.created_at) < ttl_ms)
    }

    /// Number of stored messages.
    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// Whether no message is stored.
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

/// Draws the visible messages as the legacy glass cards in the bottom left corner.
///
/// The cards stack upwards, carry the tone icon tile, an uppercase title, the body text and a close
/// button. Returns whether a card was dismissed this frame, so the host can repaint.
pub fn toast_stack(
    ctx: &Context,
    theme: &Theme,
    toasts: &mut Toasts,
    now: i64,
    ttl_ms: i64,
    bottom_offset: f32,
) -> bool {
    let visible: Vec<Toast> = toasts.visible(now, ttl_ms).cloned().collect();
    if visible.is_empty() {
        return false;
    }
    let body_width = TOAST_WIDTH - 24.0 - 32.0 - 10.0;
    let mut dismissed = None;
    egui::Area::new(Id::new("socdof-toasts"))
        .order(egui::Order::Foreground)
        .anchor(Align2::LEFT_BOTTOM, Vec2::new(16.0, -bottom_offset))
        .show(ctx, |ui| {
            ui.vertical(|ui| {
                for toast in &visible {
                    let body = ui.painter().layout(
                        toast.text.clone(),
                        FontId::proportional(13.0),
                        theme.palette.text,
                        body_width,
                    );
                    let title_height = if toast.title.is_empty() { 0.0 } else { 15.0 };
                    let height = (12.0 + title_height + body.size().y + 12.0).max(56.0);
                    let (rect, _) =
                        ui.allocate_exact_size(Vec2::new(TOAST_WIDTH, height), Sense::hover());
                    let painter = ui.painter().clone();
                    for layer in
                        shadow_layers(rect, RADIUS_CARD, ShadowStrength::Hover, theme.accent.base)
                    {
                        painter.rect(
                            layer.rect,
                            Rounding::same(layer.rounding),
                            layer.color,
                            Stroke::NONE,
                        );
                    }
                    painter.rect(
                        rect,
                        Rounding::same(RADIUS_CARD),
                        with_alpha(theme.palette.surface, 96),
                        Stroke::new(1.0_f32, theme.palette.border),
                    );
                    let icon = Rect::from_min_size(
                        Pos2::new(rect.min.x + 12.0, rect.min.y + 12.0),
                        Vec2::splat(32.0),
                    );
                    painter.rect(
                        icon,
                        Rounding::same(10.0),
                        with_alpha(toast.tone.color(theme), 18),
                        Stroke::NONE,
                    );
                    painter.circle_filled(icon.center(), 5.0, toast.tone.color(theme));
                    let text_x = icon.right() + 10.0;
                    let mut y = rect.min.y + 12.0;
                    if !toast.title.is_empty() {
                        painter.text(
                            Pos2::new(text_x, y),
                            Align2::LEFT_TOP,
                            toast.title.to_uppercase(),
                            FontId::proportional(11.0),
                            theme.palette.text_muted,
                        );
                        y += title_height;
                    }
                    painter.galley(Pos2::new(text_x, y), body, theme.palette.text);
                    let close = Rect::from_min_size(
                        Pos2::new(rect.right() - 30.0, rect.top() + 8.0),
                        Vec2::splat(22.0),
                    );
                    let response = ui.interact(
                        close,
                        Id::new(("socdof-toast-close", toast.id)),
                        Sense::click(),
                    );
                    painter.text(
                        close.center(),
                        Align2::CENTER_CENTER,
                        "×",
                        FontId::proportional(14.0),
                        theme.palette.text_muted,
                    );
                    if response.clicked() {
                        dismissed = Some(toast.id);
                    }
                    ui.add_space(8.0);
                }
            });
        });
    match dismissed {
        Some(id) => {
            toasts.dismiss(id);
            true
        }
        None => false,
    }
}

/// Focus id used by tests that need to point at a control without a response.
pub fn control_id(ui: &Ui, source: &str) -> Id {
    ui.make_persistent_id(source)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_state_toggles_direction_then_column() {
        let mut sort = SortState::default();
        assert_eq!(sort.indicator(0), "");
        sort.toggle(0);
        assert_eq!((sort.column, sort.ascending), (Some(0), true));
        assert_eq!(sort.indicator(0), "▲");
        sort.toggle(0);
        assert_eq!((sort.column, sort.ascending), (Some(0), false));
        assert_eq!(sort.indicator(0), "▼");
        sort.toggle(2);
        assert_eq!((sort.column, sort.ascending), (Some(2), true));
        assert_eq!(sort.indicator(0), "");
    }

    #[test]
    fn form_columns_keep_a_usable_width() {
        // Desktop: three columns share the row and the remove button keeps its room.
        let wide = form_column_widths(1400.0, 10.0, 3, 110.0);
        assert_eq!(wide.len(), 3);
        assert!(wide[0] > 400.0, "desktop column width {}", wide[0]);
        assert!(wide[0] * 3.0 + 110.0 + 30.0 <= 1400.0);
        // A row that is too narrow never collapses below the minimum column width.
        let narrow = form_column_widths(380.0, 10.0, 3, 110.0);
        assert!(narrow.iter().all(|width| *width >= MIN_FORM_COLUMN_WIDTH));
    }

    #[test]
    fn toasts_expire_after_the_ttl() {
        let mut toasts = Toasts::default();
        assert!(toasts.is_empty());
        toasts.push(Tone::Success, "saved", 1_000);
        toasts.push(Tone::Danger, "failed", 1_500);
        assert_eq!(toasts.len(), 2);
        assert_eq!(toasts.visible(1_600, 1_000).count(), 2);

        toasts.prune(2_100, 1_000);
        assert_eq!(toasts.len(), 1);
        assert_eq!(toasts.visible(2_100, 1_000).count(), 1);
        assert_eq!(toasts.visible(2_100, 2_000).count(), 1);

        toasts.prune(2_600, 1_000);
        assert!(toasts.is_empty());
    }
}
