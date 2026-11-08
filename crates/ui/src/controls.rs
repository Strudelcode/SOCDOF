//! Input controls: select, checkbox, switch, text field, date picker, menu, drawer and file drop.
//!
//! Like the rest of the kit these controls are drawn from the design tokens, so they carry the
//! legacy look in both appearances. Labels arrive already translated; the controls never invent
//! text. Every control registers with the [`FocusState`], draws the token focus ring and accepts
//! Enter/Space; dropdowns and menus also move with the arrow keys, Home and End, and Escape closes
//! them and returns the focus to their trigger.

use egui::{
    Color32, FontId, Id, Key, Pos2, Rect, Response, RichText, Rounding, Sense, Stroke, TextEdit,
    Ui, Vec2, WidgetInfo, WidgetType,
};

use crate::calendar::{days_in_month, month_grid, CalendarState};
use crate::components::{icon_button, Activated};
use crate::focus::{focus_ring, FocusState};
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{
    CARD_PADDING, CONTROL_HEIGHT, FONT_BODY, FONT_HEADING, FONT_SMALL, RADIUS_CARD, RADIUS_CONTROL,
};

/// Open state of a dropdown or menu: `None` is closed, `Some(index)` is the highlighted entry.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PopupState {
    /// Highlighted entry while the popup is open.
    pub open: Option<usize>,
}

/// Translated labels the calendar needs.
#[derive(Debug, Clone, Copy)]
pub struct CalendarLabels<'a> {
    /// Seven weekday names, Monday first.
    pub weekdays: [&'a str; 7],
    /// Twelve month names, January first.
    pub months: [&'a str; 12],
    /// Accessible label of the previous-month button.
    pub previous: &'a str,
    /// Accessible label of the next-month button.
    pub next: &'a str,
}

/// Draws a dropdown and returns whether the selection changed.
pub fn select(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    popup: &mut PopupState,
    id_source: &str,
    selected: &mut usize,
    labels: &[&str],
) -> bool {
    let id = ui.make_persistent_id(("socdof-select", id_source));
    let focused = focus.register(id);
    let current = labels.get(*selected).copied().unwrap_or_default();
    let width = 220.0;
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, CONTROL_HEIGHT), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }

    let was_open = popup.open.is_some();
    let mut open = popup.open;
    let mut highlight = popup.open.unwrap_or(*selected);
    let mut changed = false;
    let mut release_focus = false;

    if !was_open && focused {
        let arrow =
            ui.input(|input| input.key_pressed(Key::ArrowDown) || input.key_pressed(Key::ArrowUp));
        if response.clicked() || focus.activate(id) || arrow {
            open = Some(*selected);
            highlight = *selected;
            focus.open_overlay(id);
        }
    }

    let hovered = response.hovered() || focused;
    let fill = if hovered {
        theme.accent.light
    } else {
        theme.palette.surface
    };
    let border = if hovered {
        theme.accent.border
    } else {
        theme.palette.border
    };
    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CONTROL),
        fill,
        Stroke::new(1.0_f32, border),
    );
    let galley = painter.layout_no_wrap(
        current.to_owned(),
        FontId::proportional(FONT_BODY),
        theme.palette.text,
    );
    painter.galley(
        Pos2::new(rect.left() + 12.0, rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text,
    );
    Icon::ChevronDown.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(rect.right() - 18.0, rect.center().y),
            Vec2::splat(14.0),
        ),
        theme.palette.text_muted,
        1.5,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::ComboBox, current));

    if open.is_some() {
        if was_open {
            ui.input(|input| {
                let count = labels.len().max(1);
                if input.key_pressed(Key::ArrowDown) {
                    highlight = (highlight + 1) % count;
                }
                if input.key_pressed(Key::ArrowUp) {
                    highlight = (highlight + count - 1) % count;
                }
                if input.key_pressed(Key::Home) {
                    highlight = 0;
                }
                if input.key_pressed(Key::End) {
                    highlight = labels.len().saturating_sub(1);
                }
            });
        }
        focus.collecting(true);
        egui::Area::new(id.with("options"))
            .order(egui::Order::Foreground)
            .fixed_pos(rect.left_bottom() + Vec2::new(0.0, 4.0))
            .show(ui.ctx(), |ui| {
                egui::Frame::none()
                    .fill(theme.palette.surface)
                    .stroke(Stroke::new(1.0_f32, theme.palette.border))
                    .rounding(Rounding::same(RADIUS_CONTROL))
                    .inner_margin(egui::Margin::same(4.0))
                    .show(ui, |ui| {
                        ui.set_min_width(width);
                        for (index, label) in labels.iter().enumerate() {
                            let row_id = id.with(("option", index));
                            if index == highlight {
                                focus.set_focus(Some(row_id));
                            }
                            let row = popup_row(
                                ui,
                                theme,
                                focus,
                                PopupRow {
                                    id: row_id,
                                    label,
                                    width,
                                    active: index == highlight || index == *selected,
                                    suppress_activation: !was_open,
                                },
                            );
                            if row.activated {
                                if index != *selected {
                                    changed = true;
                                }
                                *selected = index;
                                open = None;
                                release_focus = true;
                            }
                        }
                    });
            });
        focus.collecting(false);
        if was_open && open.is_some() {
            let commit =
                ui.input(|input| input.key_pressed(Key::Enter) || input.key_pressed(Key::Space));
            let cancel = focus.escape();
            if commit {
                if highlight != *selected {
                    *selected = highlight;
                    changed = true;
                }
                open = None;
                release_focus = true;
            } else if cancel {
                open = None;
                release_focus = true;
            }
        }
    }

    popup.open = open.map(|_| highlight);
    if release_focus && focus.is_overlay_open() {
        focus.close_overlay();
    }
    changed
}

/// Draws a menu button and returns the index of the chosen entry.
pub fn menu(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    popup: &mut PopupState,
    label: &str,
    items: &[&str],
) -> Option<usize> {
    let id = ui.make_persistent_id(("socdof-menu", label));
    let focused = focus.register(id);
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::proportional(FONT_BODY),
        theme.palette.text,
    );
    let width = galley.size().x + 44.0;
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, CONTROL_HEIGHT), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }

    let was_open = popup.open.is_some();
    let mut open = popup.open;
    let mut highlight = popup.open.unwrap_or(0);
    let mut chosen = None;
    let mut release_focus = false;

    if !was_open && focused {
        let arrow =
            ui.input(|input| input.key_pressed(Key::ArrowDown) || input.key_pressed(Key::ArrowUp));
        if response.clicked() || focus.activate(id) || arrow {
            open = Some(0);
            highlight = 0;
            focus.open_overlay(id);
        }
    }

    let hovered = response.hovered() || focused;
    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CONTROL),
        if hovered {
            theme.accent.light
        } else {
            theme.palette.surface
        },
        Stroke::new(
            1.0_f32,
            if hovered {
                theme.accent.border
            } else {
                theme.palette.border
            },
        ),
    );
    painter.galley(
        Pos2::new(rect.left() + 12.0, rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text,
    );
    Icon::ChevronDown.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(rect.right() - 16.0, rect.center().y),
            Vec2::splat(14.0),
        ),
        theme.palette.text_muted,
        1.5,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, label));

    if open.is_some() {
        if was_open {
            ui.input(|input| {
                let count = items.len().max(1);
                if input.key_pressed(Key::ArrowDown) {
                    highlight = (highlight + 1) % count;
                }
                if input.key_pressed(Key::ArrowUp) {
                    highlight = (highlight + count - 1) % count;
                }
                if input.key_pressed(Key::Home) {
                    highlight = 0;
                }
                if input.key_pressed(Key::End) {
                    highlight = items.len().saturating_sub(1);
                }
            });
        }
        focus.collecting(true);
        egui::Area::new(id.with("items"))
            .order(egui::Order::Foreground)
            .fixed_pos(rect.left_bottom() + Vec2::new(0.0, 4.0))
            .show(ui.ctx(), |ui| {
                egui::Frame::none()
                    .fill(theme.palette.surface)
                    .stroke(Stroke::new(1.0_f32, theme.palette.border))
                    .rounding(Rounding::same(RADIUS_CONTROL))
                    .inner_margin(egui::Margin::same(4.0))
                    .show(ui, |ui| {
                        ui.set_min_width(width.max(160.0));
                        for (index, item) in items.iter().enumerate() {
                            let row_id = id.with(("item", index));
                            if index == highlight {
                                focus.set_focus(Some(row_id));
                            }
                            let row = popup_row(
                                ui,
                                theme,
                                focus,
                                PopupRow {
                                    id: row_id,
                                    label: item,
                                    width: width.max(160.0),
                                    active: index == highlight,
                                    suppress_activation: !was_open,
                                },
                            );
                            if row.activated {
                                chosen = Some(index);
                                open = None;
                                release_focus = true;
                            }
                        }
                    });
            });
        focus.collecting(false);
        if was_open && open.is_some() {
            let commit =
                ui.input(|input| input.key_pressed(Key::Enter) || input.key_pressed(Key::Space));
            if commit {
                chosen = Some(highlight);
                open = None;
                release_focus = true;
            } else if focus.escape() {
                open = None;
                release_focus = true;
            }
        }
    }

    popup.open = open.map(|_| highlight);
    if release_focus && focus.is_overlay_open() {
        focus.close_overlay();
    }
    chosen
}

/// Draws a checkbox with a label.
pub fn checkbox(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    checked: &mut bool,
    label: &str,
) -> Activated {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::proportional(FONT_BODY),
        theme.palette.text,
    );
    let size = Vec2::new(18.0 + 8.0 + galley.size().x, CONTROL_HEIGHT);
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    if response.clicked() || keyboard {
        *checked = !*checked;
    }

    let box_rect = Rect::from_min_size(
        Pos2::new(rect.left(), rect.center().y - 9.0),
        Vec2::splat(18.0),
    );
    let fill = if *checked {
        theme.accent.base
    } else if response.hovered() || focused {
        theme.accent.light
    } else {
        theme.palette.surface
    };
    let border = if *checked {
        theme.accent.base
    } else {
        theme.palette.border
    };
    let painter = ui.painter();
    painter.rect(
        box_rect,
        Rounding::same(4.0),
        fill,
        Stroke::new(1.0_f32, border),
    );
    if *checked {
        let mark = Stroke::new(1.8_f32, theme.palette.accent_on);
        painter.line_segment(
            [
                Pos2::new(box_rect.left() + 4.5, box_rect.center().y),
                Pos2::new(box_rect.left() + 7.5, box_rect.bottom() - 5.0),
            ],
            mark,
        );
        painter.line_segment(
            [
                Pos2::new(box_rect.left() + 7.5, box_rect.bottom() - 5.0),
                Pos2::new(box_rect.right() - 4.0, box_rect.top() + 5.5),
            ],
            mark,
        );
    }
    painter.galley(
        Pos2::new(
            box_rect.right() + 8.0,
            rect.center().y - galley.size().y / 2.0,
        ),
        galley,
        theme.palette.text,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::selected(WidgetType::Checkbox, *checked, label));
    let activated = response.clicked() || keyboard;
    Activated {
        response,
        activated,
    }
}

/// Draws an on/off switch with a label.
pub fn switch(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    on: &mut bool,
    label: &str,
) -> Activated {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        FontId::proportional(FONT_BODY),
        theme.palette.text,
    );
    let size = Vec2::new(40.0 + 8.0 + galley.size().x, CONTROL_HEIGHT);
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    if response.clicked() || keyboard {
        *on = !*on;
    }

    let track = Rect::from_min_size(
        Pos2::new(rect.left(), rect.center().y - 11.0),
        Vec2::new(40.0, 22.0),
    );
    let fill = if *on {
        theme.accent.base
    } else if response.hovered() || focused {
        blend(theme.palette.surface, theme.accent.border)
    } else {
        blend(theme.palette.surface_muted, theme.palette.border)
    };
    let painter = ui.painter();
    painter.rect(track, Rounding::same(11.0), fill, Stroke::NONE);
    let knob_x = if *on {
        track.right() - 11.0
    } else {
        track.left() + 11.0
    };
    painter.circle_filled(
        Pos2::new(knob_x, track.center().y),
        8.0,
        if *on {
            theme.palette.accent_on
        } else {
            theme.palette.surface
        },
    );
    painter.galley(
        Pos2::new(track.right() + 8.0, rect.center().y - galley.size().y / 2.0),
        galley,
        theme.palette.text,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::selected(WidgetType::Checkbox, *on, label));
    let activated = response.clicked() || keyboard;
    Activated {
        response,
        activated,
    }
}

/// Draws a labelled single line text field with an optional error message.
pub fn text_field(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    label: &str,
    hint: &str,
    error: Option<&str>,
) -> Activated {
    ui.vertical(|ui| {
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(2.0);
        let response = ui.add(
            TextEdit::singleline(value)
                .hint_text(hint)
                .desired_width(f32::INFINITY)
                .text_color(theme.palette.text),
        );
        let focused = focus.register(response.id);
        if response.clicked() {
            focus.set_focus(Some(response.id));
        }
        if focused {
            ui.memory_mut(|memory| memory.request_focus(response.id));
            focus_ring(ui, theme, response.rect);
        } else {
            ui.memory_mut(|memory| memory.surrender_focus(response.id));
        }
        response.widget_info(|| WidgetInfo::labeled(WidgetType::TextEdit, label));
        if let Some(message) = error {
            ui.label(
                RichText::new(message)
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
        Activated {
            response,
            activated: false,
        }
    })
    .inner
}

/// Draws a labelled single line password field with masked input.
pub fn password_field(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    value: &mut String,
    label: &str,
    hint: &str,
    error: Option<&str>,
) -> Activated {
    ui.vertical(|ui| {
        ui.label(
            RichText::new(label)
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(2.0);
        let response = ui.add(
            TextEdit::singleline(value)
                .password(true)
                .hint_text(hint)
                .desired_width(f32::INFINITY)
                .text_color(theme.palette.text),
        );
        let focused = focus.register(response.id);
        if response.clicked() {
            focus.set_focus(Some(response.id));
        }
        if focused {
            ui.memory_mut(|memory| memory.request_focus(response.id));
            focus_ring(ui, theme, response.rect);
        } else {
            ui.memory_mut(|memory| memory.surrender_focus(response.id));
        }
        response.widget_info(|| WidgetInfo::labeled(WidgetType::TextEdit, label));
        if let Some(message) = error {
            ui.label(
                RichText::new(message)
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
        Activated {
            response,
            activated: false,
        }
    })
    .inner
}

/// Draws a month calendar and returns whether the selection changed.
pub fn calendar(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    state: &mut CalendarState,
    labels: &CalendarLabels<'_>,
) -> bool {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let mut changed = false;

    if focused {
        let last = days_in_month(state.year, state.month);
        let mut day = state.day.clamp(1, last);
        ui.input(|input| {
            if input.key_pressed(Key::ArrowLeft) {
                day = day.saturating_sub(1).max(1);
            }
            if input.key_pressed(Key::ArrowRight) {
                day = (day + 1).min(last);
            }
            if input.key_pressed(Key::ArrowUp) {
                day = day.saturating_sub(7).max(1);
            }
            if input.key_pressed(Key::ArrowDown) {
                day = (day + 7).min(last);
            }
            if input.key_pressed(Key::Home) {
                day = 1;
            }
            if input.key_pressed(Key::End) {
                day = last;
            }
        });
        if ui.input(|input| input.key_pressed(Key::PageUp)) {
            state.previous_month();
        }
        if ui.input(|input| input.key_pressed(Key::PageDown)) {
            state.next_month();
        }
        if state.day != day {
            state.day = day.min(days_in_month(state.year, state.month)).max(1);
            changed = true;
        }
    }

    let inner = egui::Frame::none()
        .fill(theme.palette.surface)
        .stroke(Stroke::new(1.0_f32, theme.palette.border))
        .rounding(Rounding::same(RADIUS_CARD))
        .inner_margin(egui::Margin::same(CARD_PADDING))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                if icon_button(ui, theme, focus, Icon::ChevronLeft, labels.previous).activated {
                    state.previous_month();
                    changed = true;
                }
                ui.label(
                    RichText::new(format!(
                        "{} {}",
                        labels.months[(state.month.saturating_sub(1) as usize).min(11)],
                        state.year
                    ))
                    .strong(),
                );
                if icon_button(ui, theme, focus, Icon::ChevronRight, labels.next).activated {
                    state.next_month();
                    changed = true;
                }
            });
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 2.0;
                for name in &labels.weekdays {
                    ui.add_sized(
                        [32.0, 18.0],
                        egui::Label::new(
                            RichText::new(*name)
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        ),
                    );
                }
            });
            let cells = month_grid(state.year, state.month);
            for row in cells.chunks(7) {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 2.0;
                    for cell in row {
                        let (rect, response) =
                            ui.allocate_exact_size(Vec2::new(32.0, 30.0), Sense::click());
                        let Some(day) = *cell else { continue };
                        let selected = day == state.day;
                        let painter = ui.painter();
                        if selected {
                            painter.rect(
                                rect,
                                Rounding::same(8.0),
                                theme.accent.base,
                                Stroke::NONE,
                            );
                        } else if response.hovered() {
                            painter.rect(
                                rect,
                                Rounding::same(8.0),
                                theme.accent.light,
                                Stroke::NONE,
                            );
                        }
                        let color = if selected {
                            theme.palette.accent_on
                        } else {
                            theme.palette.text
                        };
                        let galley = painter.layout_no_wrap(
                            day.to_string(),
                            FontId::proportional(FONT_BODY),
                            color,
                        );
                        painter.galley(rect.center() - galley.size() / 2.0, galley, color);
                        if response.clicked() {
                            state.day = day;
                            focus.set_focus(Some(id));
                            changed = true;
                        }
                    }
                });
            }
        });
    if focused {
        focus_ring(ui, theme, inner.response.rect);
    }
    inner
        .response
        .widget_info(|| WidgetInfo::labeled(WidgetType::Other, "calendar"));
    changed
}

/// Translated labels of the drawer header.
#[derive(Debug, Clone, Copy)]
pub struct DrawerLabels<'a> {
    /// Drawer title.
    pub title: &'a str,
    /// Accessible label of the close button.
    pub close: &'a str,
}

/// Draws a right side drawer while `open` is true and reports whether it stays open.
///
/// The content closure returns `true` when it wants the drawer closed. Escape closes the drawer and
/// returns the focus to `trigger`.
pub fn drawer(
    ctx: &egui::Context,
    theme: &Theme,
    focus: &mut FocusState,
    open: &mut bool,
    trigger: Id,
    labels: DrawerLabels<'_>,
    add_contents: impl FnOnce(&mut Ui, &mut FocusState) -> bool,
) -> bool {
    if !*open {
        return false;
    }
    if focus.escape() {
        *open = false;
        if focus.is_overlay_open() {
            focus.close_overlay();
        }
        return false;
    }
    if !focus.is_overlay_open() {
        focus.open_overlay(trigger);
    }
    focus.collecting(true);
    let mut close_requested = false;
    egui::SidePanel::right("socdof-drawer")
        .resizable(false)
        .exact_width(360.0)
        .frame(
            egui::Frame::none()
                .fill(theme.palette.surface)
                .stroke(Stroke::new(1.0_f32, theme.palette.border))
                .inner_margin(egui::Margin::same(CARD_PADDING)),
        )
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label(RichText::new(labels.title).size(FONT_HEADING).strong());
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if icon_button(ui, theme, focus, Icon::Close, labels.close).activated {
                        close_requested = true;
                    }
                });
            });
            ui.add_space(8.0);
            if add_contents(ui, focus) {
                close_requested = true;
            }
        });
    focus.collecting(false);
    if close_requested {
        *open = false;
        if focus.is_overlay_open() {
            focus.close_overlay();
        }
    }
    *open
}

/// Draws the file drop area; `hovering` reflects whether files are currently dragged over it.
pub fn drop_zone(
    ui: &mut Ui,
    theme: &Theme,
    focus: &mut FocusState,
    hint: &str,
    hovering: bool,
) -> Activated {
    let id = ui.next_auto_id();
    let focused = focus.register(id);
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 96.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = focus.activate(id);
    let fill = if hovering || response.hovered() {
        theme.accent.light
    } else {
        theme.palette.surface_muted
    };
    let border = if hovering || focused {
        theme.accent.base
    } else {
        theme.palette.border
    };
    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(RADIUS_CARD),
        fill,
        Stroke::new(1.0_f32, border),
    );
    let icon_rect = Rect::from_center_size(rect.center() - Vec2::new(0.0, 12.0), Vec2::splat(24.0));
    Icon::Upload.draw(painter, icon_rect, theme.palette.text_muted, 1.6);
    let galley = painter.layout_no_wrap(
        hint.to_owned(),
        FontId::proportional(FONT_SMALL),
        theme.palette.text_muted,
    );
    painter.galley(
        Pos2::new(
            rect.center().x - galley.size().x / 2.0,
            rect.center().y + 12.0,
        ),
        galley,
        theme.palette.text_muted,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, hint));
    let activated = response.clicked() || keyboard;
    Activated {
        response,
        activated,
    }
}

/// Geometry and state of one row inside a select or menu popup.
struct PopupRow<'a> {
    id: Id,
    label: &'a str,
    width: f32,
    active: bool,
    suppress_activation: bool,
}

fn popup_row(ui: &mut Ui, theme: &Theme, focus: &mut FocusState, row: PopupRow<'_>) -> Activated {
    let PopupRow {
        id,
        label,
        width,
        active,
        suppress_activation,
    } = row;
    let focused = focus.register(id);
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 30.0), Sense::click());
    if response.clicked() {
        focus.set_focus(Some(id));
    }
    let keyboard = !suppress_activation && focus.activate(id);
    let activated = response.clicked() || keyboard;
    let color = if focused || active {
        theme.accent_text()
    } else {
        theme.palette.text
    };
    let painter = ui.painter();
    if active || focused || response.hovered() {
        painter.rect(rect, Rounding::same(6.0), theme.accent.light, Stroke::NONE);
    }
    let galley = painter.layout_no_wrap(label.to_owned(), FontId::proportional(FONT_BODY), color);
    painter.galley(
        Pos2::new(rect.left() + 10.0, rect.center().y - galley.size().y / 2.0),
        galley,
        color,
    );
    if focused {
        focus_ring(ui, theme, rect);
    }
    response.widget_info(|| WidgetInfo::labeled(WidgetType::SelectableLabel, label));
    Activated {
        response,
        activated,
    }
}

/// Mixes a border tone into a fill, so a strokeless track still shows its hover state.
fn blend(fill: Color32, border: Color32) -> Color32 {
    let channel = |a: u8, b: u8| ((u16::from(a) * 3 + u16::from(b)) / 4) as u8;
    Color32::from_rgb(
        channel(fill.r(), border.r()),
        channel(fill.g(), border.g()),
        channel(fill.b(), border.b()),
    )
}

/// Convenience alias so tests can name the response type.
pub type ControlResponse = Response;

/// Convenience alias for the rectangle helper used by tests.
pub type ControlRect = Rect;
