//! Keyboard, focus and accessibility behaviour of the primitives.
//!
//! These tests drive the real widgets with synthetic egui input: Tab and Shift+Tab move the focus,
//! Enter and Space activate, arrows move inside dropdowns and the calendar, Escape closes overlays
//! and returns the focus, typing reaches the text field and a pointer click focuses a control.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use egui::{Context, Event, Id, Key, Modifiers, PointerButton, Pos2, RawInput, Rect, Ui, Vec2};
use socdof_core::domain::settings::Language;
use socdof_ui::calendar::CalendarState;
use socdof_ui::components::{button, ButtonVariant};
use socdof_ui::controls::{
    calendar, checkbox, drawer, menu, select, switch, text_field, CalendarLabels, DrawerLabels,
    PopupState,
};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::theme::{Appearance, Theme};

/// Weekday keys, Monday first.
const WEEKDAY_KEYS: [&str; 7] = [
    "weekday_1",
    "weekday_2",
    "weekday_3",
    "weekday_4",
    "weekday_5",
    "weekday_6",
    "weekday_7",
];

/// Month keys in calendar order.
const MONTH_KEYS: [&str; 12] = [
    "month_1", "month_2", "month_3", "month_4", "month_5", "month_6", "month_7", "month_8",
    "month_9", "month_10", "month_11", "month_12",
];

fn press(key: Key) -> Event {
    Event::Key {
        key,
        physical_key: None,
        pressed: true,
        repeat: false,
        modifiers: Modifiers::NONE,
    }
}

fn shift_tab() -> Event {
    Event::Key {
        key: Key::Tab,
        physical_key: None,
        pressed: true,
        repeat: false,
        modifiers: Modifiers::SHIFT,
    }
}

struct Harness {
    ctx: Context,
    focus: FocusState,
    theme: Theme,
}

impl Harness {
    fn new() -> Self {
        Self {
            ctx: socdof_ui::theme::headless_context(),
            focus: FocusState::default(),
            theme: Theme::new(Appearance::Light, "indigo"),
        }
    }

    fn input(&self, events: Vec<Event>) -> RawInput {
        RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000.0, 900.0))),
            events,
            time: Some(1.0),
            ..Default::default()
        }
    }

    fn frame(&mut self, events: Vec<Event>, mut draw: impl FnMut(&mut Ui, &mut FocusState)) {
        let input = self.input(events);
        let focus = &mut self.focus;
        let _ = self.ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            egui::CentralPanel::default().show(ctx, |ui| draw(ui, focus));
            focus.finish_frame();
        });
    }

    fn frame_ctx(&mut self, events: Vec<Event>, mut draw: impl FnMut(&Context, &mut FocusState)) {
        let input = self.input(events);
        let focus = &mut self.focus;
        let _ = self.ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            draw(ctx, focus);
            focus.finish_frame();
        });
    }
}

#[test]
fn tab_moves_through_controls_in_reading_order_and_wraps() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let ids = Rc::new(RefCell::new(Vec::new()));
    let labels = ["eins", "zwei", "drei"];

    let ids_in = Rc::clone(&ids);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut list = ids_in.borrow_mut();
        list.clear();
        for label in labels {
            list.push(
                button(ui, &theme, focus, label, ButtonVariant::Secondary)
                    .response
                    .id,
            );
        }
    };

    harness.frame(Vec::new(), &mut draw);
    assert_eq!(ids.borrow().len(), 3);

    let order = ids.borrow().clone();
    harness.frame(vec![press(Key::Tab)], &mut draw);
    assert_eq!(harness.focus.focused(), Some(order[0]));
    harness.frame(vec![press(Key::Tab)], &mut draw);
    assert_eq!(harness.focus.focused(), Some(order[1]));
    harness.frame(vec![press(Key::Tab)], &mut draw);
    assert_eq!(harness.focus.focused(), Some(order[2]));
    harness.frame(vec![press(Key::Tab)], &mut draw);
    assert_eq!(harness.focus.focused(), Some(order[0]));
    harness.frame(vec![shift_tab()], &mut draw);
    assert_eq!(harness.focus.focused(), Some(order[2]));
}

#[test]
fn enter_activates_a_focused_button() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let activated = Rc::new(Cell::new(false));

    let activated_in = Rc::clone(&activated);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        activated_in.set(button(ui, &theme, focus, "Speichern", ButtonVariant::Primary).activated);
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    assert!(!activated.get(), "activation must not fire on focus alone");
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert!(activated.get(), "Enter did not activate the focused button");
}

#[test]
fn space_toggles_checkbox_and_switch() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let checked = Rc::new(Cell::new(false));
    let switched = Rc::new(Cell::new(false));

    let checked_in = Rc::clone(&checked);
    let switched_in = Rc::clone(&switched);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut value = checked_in.get();
        if checkbox(ui, &theme, focus, &mut value, "Entwurf").activated {
            checked_in.set(value);
        }
        let mut on = switched_in.get();
        if switch(ui, &theme, focus, &mut on, "Sicherung").activated {
            switched_in.set(on);
        }
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Space)], &mut draw);
    assert!(checked.get(), "Space did not toggle the checkbox");

    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert!(switched.get(), "Enter did not toggle the switch");
}

#[test]
fn select_opens_with_enter_and_commits_with_arrows() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let popup = Rc::new(RefCell::new(PopupState::default()));
    let selected = Rc::new(Cell::new(0usize));
    let labels = ["7 Tage", "14 Tage", "30 Tage"];

    let popup_in = Rc::clone(&popup);
    let selected_in = Rc::clone(&selected);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut selected = selected_in.get();
        let mut state = *popup_in.borrow();
        select(
            ui,
            &theme,
            focus,
            &mut state,
            "test-term",
            &mut selected,
            &labels,
        );
        *popup_in.borrow_mut() = state;
        selected_in.set(selected);
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert!(
        popup.borrow().open.is_some(),
        "Enter did not open the dropdown"
    );

    harness.frame(vec![press(Key::ArrowDown)], &mut draw);
    assert_eq!(popup.borrow().open, Some(1));
    harness.frame(vec![press(Key::End)], &mut draw);
    assert_eq!(popup.borrow().open, Some(2));
    harness.frame(vec![press(Key::Home)], &mut draw);
    assert_eq!(popup.borrow().open, Some(0));

    harness.frame(vec![press(Key::ArrowDown)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert_eq!(
        selected.get(),
        1,
        "Enter did not commit the highlighted entry"
    );
    assert_eq!(popup.borrow().open, None);
    assert!(!harness.focus.is_overlay_open());
}

#[test]
fn escape_closes_the_dropdown_and_returns_the_focus() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let popup = Rc::new(RefCell::new(PopupState::default()));
    let selected = Rc::new(Cell::new(2usize));
    let labels = ["a", "b", "c"];

    let popup_in = Rc::clone(&popup);
    let selected_in = Rc::clone(&selected);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        button(ui, &theme, focus, "trigger", ButtonVariant::Secondary);
        let mut selected = selected_in.get();
        let mut state = *popup_in.borrow();
        select(
            ui,
            &theme,
            focus,
            &mut state,
            "escape-term",
            &mut selected,
            &labels,
        );
        *popup_in.borrow_mut() = state;
        selected_in.set(selected);
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert!(popup.borrow().open.is_some());

    harness.frame(vec![press(Key::Escape)], &mut draw);
    assert_eq!(popup.borrow().open, None);
    assert!(!harness.focus.is_overlay_open());
}

#[test]
fn menu_moves_with_arrows_and_returns_a_choice() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let popup = Rc::new(RefCell::new(PopupState::default()));
    let chosen = Rc::new(RefCell::new(None));
    let items = ["Öffnen", "Duplizieren", "Löschen"];

    let popup_in = Rc::clone(&popup);
    let chosen_in = Rc::clone(&chosen);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut state = *popup_in.borrow();
        if let Some(choice) = menu(ui, &theme, focus, &mut state, "Aktionen", &items) {
            *chosen_in.borrow_mut() = Some(choice);
        }
        *popup_in.borrow_mut() = state;
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert!(popup.borrow().open.is_some());
    harness.frame(vec![press(Key::ArrowDown)], &mut draw);
    harness.frame(vec![press(Key::Enter)], &mut draw);
    assert_eq!(*chosen.borrow(), Some(1));
    assert_eq!(popup.borrow().open, None);
}

#[test]
fn text_field_receives_typing_and_backspace() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let value = Rc::new(RefCell::new(String::new()));

    let value_in = Rc::clone(&value);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut text = value_in.borrow().clone();
        text_field(ui, &theme, focus, &mut text, "Firma", "Muster AG", None);
        *value_in.borrow_mut() = text;
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![Event::Text("Max".to_string())], &mut draw);
    assert_eq!(*value.borrow(), "Max", "typing did not reach the field");
    harness.frame(vec![press(Key::Backspace)], &mut draw);
    assert_eq!(*value.borrow(), "Ma");
    harness.frame(vec![press(Key::Home)], &mut draw);
    harness.frame(vec![Event::Text("X".to_string())], &mut draw);
    assert_eq!(*value.borrow(), "XMa");
}

#[test]
fn calendar_moves_with_arrows_and_home_end() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    let state = Rc::new(RefCell::new(CalendarState::new(2026, 11, 10)));
    let weekdays: [&str; 7] = std::array::from_fn(|index| texts.get(WEEKDAY_KEYS[index]));
    let months: [&str; 12] = std::array::from_fn(|index| texts.get(MONTH_KEYS[index]));
    let labels = CalendarLabels {
        weekdays,
        months,
        previous: texts.get("calendar_previous"),
        next: texts.get("calendar_next"),
    };

    let state_in = Rc::clone(&state);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        calendar(ui, &theme, focus, &mut state_in.borrow_mut(), &labels);
    };

    harness.frame(Vec::new(), &mut draw);
    harness.frame(vec![press(Key::Tab)], &mut draw);
    harness.frame(vec![press(Key::ArrowLeft)], &mut draw);
    assert_eq!(state.borrow().day, 9);
    harness.frame(vec![press(Key::ArrowDown)], &mut draw);
    assert_eq!(state.borrow().day, 16);
    harness.frame(vec![press(Key::Home)], &mut draw);
    assert_eq!(state.borrow().day, 1);
    harness.frame(vec![press(Key::End)], &mut draw);
    assert_eq!(state.borrow().day, 30);
    harness.frame(vec![press(Key::PageUp)], &mut draw);
    assert_eq!(state.borrow().month, 10);
}

#[test]
fn escape_closes_the_drawer_and_restores_the_trigger() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let trigger = Id::new("drawer-trigger");
    let open = Rc::new(Cell::new(true));
    let labels = DrawerLabels {
        title: "Details",
        close: "Schließen",
    };

    let open_in = Rc::clone(&open);
    let mut draw = move |ctx: &Context, focus: &mut FocusState| {
        let mut is_open = open_in.get();
        drawer(
            ctx,
            &theme,
            focus,
            &mut is_open,
            trigger,
            labels,
            |ui, _focus| {
                ui.label("Inhalt");
                false
            },
        );
        open_in.set(is_open);
    };

    harness.frame_ctx(Vec::new(), &mut draw);
    assert!(
        harness.focus.is_overlay_open(),
        "drawer did not trap the focus"
    );
    harness.frame_ctx(vec![press(Key::Escape)], &mut draw);
    assert!(!open.get(), "Escape did not close the drawer");
    assert_eq!(harness.focus.focused(), Some(trigger));
    assert!(!harness.focus.is_overlay_open());
}

#[test]
fn pointer_click_focuses_a_control() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let rect = Rc::new(Cell::new(Rect::ZERO));
    let id = Rc::new(RefCell::new(Id::new("none")));

    let rect_in = Rc::clone(&rect);
    let id_in = Rc::clone(&id);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let hit = button(ui, &theme, focus, "Klick", ButtonVariant::Primary);
        rect_in.set(hit.response.rect);
        *id_in.borrow_mut() = hit.response.id;
    };

    harness.frame(Vec::new(), &mut draw);
    let pos = rect.get().center();
    assert!(pos.x > 0.0);
    harness.frame(
        vec![
            Event::PointerMoved(pos),
            Event::PointerButton {
                pos,
                button: PointerButton::Primary,
                pressed: true,
                modifiers: Modifiers::NONE,
            },
        ],
        &mut draw,
    );
    harness.frame(
        vec![
            Event::PointerMoved(pos),
            Event::PointerButton {
                pos,
                button: PointerButton::Primary,
                pressed: false,
                modifiers: Modifiers::NONE,
            },
        ],
        &mut draw,
    );
    assert_eq!(harness.focus.focused(), Some(*id.borrow()));
}
