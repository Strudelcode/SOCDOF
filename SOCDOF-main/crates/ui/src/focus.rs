//! Keyboard focus for the Rust UI.
//!
//! egui is immediate mode: there is no widget tree that could own focus, so the kit keeps its own.
//! Every interactive control registers itself in draw order, which is exactly reading order. The
//! state then answers three questions: whether a control is focused, whether it was activated by the
//! keyboard, and where Tab goes next.
//!
//! Tab and Shift+Tab are handled here and removed from the input queue, so egui's own widget
//! navigation cannot move focus behind the kit's back. Overlays (menus, dropdowns, drawers) trap the
//! focus: when one opens, the next registered control inside it becomes focused, and Escape gives
//! the focus back to the trigger that opened it.

use egui::{Context, Event, Id, Key, Modifiers, Rect, Rounding, Stroke, Ui};

use crate::theme::Theme;
use crate::tokens::RADIUS_CONTROL;

/// One open overlay that traps the focus.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Overlay {
    /// Stable key of the overlay, so switching overlays re-seats the focus.
    key: Id,
    /// Control that had (or opened) the focus before the overlay appeared.
    return_to: Id,
    /// Controls registered inside the overlay this frame.
    order: Vec<Id>,
}

/// Keyboard focus and focus order of one screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FocusState {
    order: Vec<Id>,
    previous: Vec<Id>,
    focused: Option<Id>,
    overlay: Option<Overlay>,
    collecting_overlay: bool,
    press: bool,
    escape: bool,
}

impl FocusState {
    /// Builds an empty focus state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Starts a frame: reads the keyboard, moves the focus for Tab and clears the order.
    ///
    /// Call once per frame before any control is drawn.
    pub fn begin_frame(&mut self, ctx: &Context) {
        self.order.clear();
        self.collecting_overlay = false;
        if let Some(overlay) = &mut self.overlay {
            overlay.order.clear();
        }
        self.press =
            ctx.input(|input| input.key_pressed(Key::Enter) || input.key_pressed(Key::Space));
        self.escape = ctx.input(|input| input.key_pressed(Key::Escape));

        let mut shift = None;
        ctx.input_mut(|input| {
            input.events.retain(|event| {
                if let Event::Key {
                    key: Key::Tab,
                    pressed: true,
                    modifiers,
                    ..
                } = event
                {
                    shift = Some(modifiers.shift);
                    false
                } else {
                    true
                }
            });
        });
        if let Some(backwards) = shift {
            self.move_focus(backwards);
            ctx.request_repaint();
        }
    }

    /// Finishes a frame and remembers the order for the next Tab press.
    pub fn finish_frame(&mut self) {
        let active = match &self.overlay {
            Some(overlay) if !overlay.order.is_empty() => overlay.order.clone(),
            _ => self.order.clone(),
        };
        self.previous = active;
    }

    /// Registers a control in draw order and reports whether it now has the focus.
    pub fn register(&mut self, id: Id) -> bool {
        if self.collecting_overlay {
            if let Some(overlay) = &mut self.overlay {
                overlay.order.push(id);
                if self.focused.is_none() {
                    self.focused = Some(id);
                }
            }
        } else {
            self.order.push(id);
        }
        self.focused == Some(id)
    }

    /// Whether the control with this id is focused.
    pub fn is_focused(&self, id: Id) -> bool {
        self.focused == Some(id)
    }

    /// Focused control, if any.
    pub fn focused(&self) -> Option<Id> {
        self.focused
    }

    /// Moves the focus, for example after a click on a control.
    pub fn set_focus(&mut self, id: Option<Id>) {
        self.focused = id;
    }

    /// Focuses the first control of the last frame, used by the snapshot capture.
    pub fn focus_first(&mut self) {
        let list = if self.previous.is_empty() {
            self.order.clone()
        } else {
            self.previous.clone()
        };
        self.focused = list.first().copied();
    }

    /// Whether Enter or Space was pressed this frame.
    pub fn press(&self) -> bool {
        self.press
    }

    /// Whether Escape was pressed this frame.
    pub fn escape(&self) -> bool {
        self.escape
    }

    /// Whether this control was activated with Enter or Space.
    pub fn activate(&self, id: Id) -> bool {
        self.focused == Some(id) && self.press
    }

    /// Opens an overlay and moves the focus into it.
    pub fn open_overlay(&mut self, return_to: Id) {
        self.open_overlay_for(return_to, return_to);
    }

    /// Opens an overlay under a stable key and moves the focus into it.
    ///
    /// Use this when several overlays can take turns on one screen: the key tells the caller
    /// whether the focus trap already belongs to the overlay it is about to draw.
    pub fn open_overlay_for(&mut self, key: Id, return_to: Id) {
        self.overlay = Some(Overlay {
            key,
            return_to,
            order: Vec::new(),
        });
        self.focused = None;
        self.collecting_overlay = true;
    }

    /// Key of the open overlay, if one traps the focus.
    pub fn overlay_key(&self) -> Option<Id> {
        self.overlay.as_ref().map(|overlay| overlay.key)
    }

    /// Closes the overlay and hands the focus back to its trigger.
    pub fn close_overlay(&mut self) {
        self.collecting_overlay = false;
        if let Some(overlay) = self.overlay.take() {
            self.focused = Some(overlay.return_to);
        }
    }

    /// Whether an overlay currently traps the focus.
    pub fn is_overlay_open(&self) -> bool {
        self.overlay.is_some()
    }

    /// Marks whether the controls drawn next belong to the open overlay.
    pub fn collecting(&mut self, collecting: bool) {
        self.collecting_overlay = collecting;
    }

    fn move_focus(&mut self, backwards: bool) {
        let list = if self.previous.is_empty() {
            self.order.clone()
        } else {
            self.previous.clone()
        };
        if list.is_empty() {
            return;
        }
        let current = self
            .focused
            .and_then(|focused| list.iter().position(|id| *id == focused));
        let index = match (current, backwards) {
            (Some(index), false) => (index + 1) % list.len(),
            (Some(index), true) => (index + list.len() - 1) % list.len(),
            (None, false) => 0,
            (None, true) => list.len() - 1,
        };
        self.focused = Some(list[index]);
    }
}

/// Paints the focus ring from the accent tokens around a control.
pub fn focus_ring(ui: &Ui, theme: &Theme, rect: Rect) {
    ui.painter().rect_stroke(
        rect.expand(2.0),
        Rounding::same(RADIUS_CONTROL + 2.0),
        Stroke::new(2.0_f32, theme.accent.ring),
    );
    ui.painter().rect_stroke(
        rect.expand(2.0),
        Rounding::same(RADIUS_CONTROL + 2.0),
        Stroke::new(1.0_f32, theme.accent.border),
    );
}

/// A key event with the given modifiers.
pub fn key_event(key: Key, modifiers: Modifiers) -> Event {
    Event::Key {
        key,
        physical_key: None,
        pressed: true,
        repeat: false,
        modifiers,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::{CentralPanel, RawInput, Vec2};

    fn frame(ctx: &Context, focus: &mut FocusState, events: Vec<Event>, ids: &[Id]) {
        let input = RawInput {
            events,
            ..Default::default()
        };
        let _ = ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            CentralPanel::default().show(ctx, |ui| {
                for id in ids {
                    focus.register(*id);
                    let _ = ui.allocate_space(Vec2::splat(10.0));
                }
            });
            focus.finish_frame();
        });
    }

    #[test]
    fn tab_cycles_in_reading_order_and_wraps() {
        let ctx = crate::theme::headless_context();
        let mut focus = FocusState::default();
        let ids = [Id::new("a"), Id::new("b"), Id::new("c")];
        frame(&ctx, &mut focus, Vec::new(), &ids);

        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Tab, Modifiers::NONE)],
            &ids,
        );
        assert_eq!(focus.focused(), Some(ids[0]));
        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Tab, Modifiers::NONE)],
            &ids,
        );
        assert_eq!(focus.focused(), Some(ids[1]));
        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Tab, Modifiers::NONE)],
            &ids,
        );
        assert_eq!(focus.focused(), Some(ids[2]));
        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Tab, Modifiers::NONE)],
            &ids,
        );
        assert_eq!(focus.focused(), Some(ids[0]));

        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Tab, Modifiers::SHIFT)],
            &ids,
        );
        assert_eq!(focus.focused(), Some(ids[2]));
    }

    #[test]
    fn tab_is_removed_from_the_input_queue() {
        let ctx = crate::theme::headless_context();
        let mut focus = FocusState::default();
        let ids = [Id::new("a")];
        frame(&ctx, &mut focus, Vec::new(), &ids);
        let input = RawInput {
            events: vec![key_event(Key::Tab, Modifiers::NONE)],
            ..Default::default()
        };
        let output = ctx.run(input, |ctx| focus.begin_frame(ctx));
        assert_eq!(output.shapes.len(), 0);
        assert!(ctx.input(|input| !input.key_pressed(Key::Tab)));
    }

    #[test]
    fn overlays_trap_and_release_the_focus() {
        let ctx = crate::theme::headless_context();
        let mut focus = FocusState::default();
        let trigger = Id::new("trigger");
        let inner = Id::new("inner");
        frame(&ctx, &mut focus, Vec::new(), &[trigger]);
        focus.set_focus(Some(trigger));

        focus.open_overlay(trigger);
        assert!(focus.register(inner));
        assert_eq!(focus.focused(), Some(inner));
        assert!(focus.is_overlay_open());

        focus.close_overlay();
        assert_eq!(focus.focused(), Some(trigger));
        assert!(!focus.is_overlay_open());
    }

    #[test]
    fn focus_first_uses_the_last_frame() {
        let ctx = crate::theme::headless_context();
        let mut focus = FocusState::default();
        frame(&ctx, &mut focus, Vec::new(), &[Id::new("x"), Id::new("y")]);
        focus.focus_first();
        assert_eq!(focus.focused(), Some(Id::new("x")));
    }

    #[test]
    fn activation_needs_focus_and_enter() {
        let ctx = crate::theme::headless_context();
        let mut focus = FocusState::default();
        let id = Id::new("activate");
        frame(&ctx, &mut focus, Vec::new(), &[id]);
        assert!(!focus.press());

        focus.set_focus(Some(id));
        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Enter, Modifiers::NONE)],
            &[id],
        );
        assert!(focus.press());
        assert!(focus.activate(id));

        frame(&ctx, &mut focus, Vec::new(), &[id]);
        assert!(!focus.activate(id));

        let other = Id::new("other");
        focus.set_focus(Some(other));
        frame(
            &ctx,
            &mut focus,
            vec![key_event(Key::Enter, Modifiers::NONE)],
            &[other],
        );
        assert!(focus.activate(other));
        assert!(!focus.activate(id));
    }
}
