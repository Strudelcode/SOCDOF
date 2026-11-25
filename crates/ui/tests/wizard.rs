//! The first-run wizard: validation feedback and field focus.
//!
//! Both checks run against the real widgets with synthetic egui input, so they cover the two
//! complaints of `NEXT_STEPS_AI.md` without a browser: a rejected "Continue" has to be readable
//! above the footer instead of scrolling out of the body, and a click on the padding of a field has
//! to move the caret into that field.

use std::cell::RefCell;
use std::rc::Rc;

use egui::{Context, Event, Modifiers, PointerButton, Pos2, RawInput, Rect, Ui, Vec2};
use socdof_core::domain::settings::Language;
use socdof_core::store::Store;
use socdof_ui::auth::{auth, AuthState};
use socdof_ui::auth_kit::{input, password_input, PasswordField};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::snapshot::signature;
use socdof_ui::theme::{Appearance, Theme};

fn input_frame(width: f32, height: f32) -> RawInput {
    RawInput {
        screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(width, height))),
        time: Some(1.0),
        ..Default::default()
    }
}

/// Y coordinate of the first painted `text(...)` shape that carries `needle`.
fn text_y(lines: &[String], needle: &str) -> Option<f32> {
    let line = lines.iter().find(|line| line.contains(needle))?;
    let start = line.find("text(")? + "text(".len();
    line[start..].split(',').nth(1)?.trim().parse().ok()
}

/// Position of the last painted `text(...)` shape that carries `needle`.
///
/// The step heading also names the step chip at the top of the card, so the same string is painted
/// twice; the row under test is the later one.
fn text_pos(lines: &[String], needle: &str) -> Option<(f32, f32)> {
    let line = lines.iter().rev().find(|line| line.contains(needle))?;
    let start = line.find("text(")? + "text(".len();
    let mut parts = line[start..].split(',');
    let x = parts.next()?.trim().parse().ok()?;
    let y = parts.next()?.trim().parse().ok()?;
    Some((x, y))
}

/// The apps step paints "Choose individual apps" on the left and "Selected apps appear on your
/// desktop." on the right of one row. On a phone both do not fit next to each other, and the
/// right-to-left hint used to be drawn over the heading.
#[test]
fn the_apps_step_keeps_the_hint_below_the_heading_on_a_phone() {
    let texts = UiTexts::embedded(Language::De).expect("embedded catalogue");
    let label = texts.get("setup_apps_select");
    let hint = texts.get("setup_apps_hint");

    let offsets = [432.0_f32, 1512.0]
        .into_iter()
        .map(|width| {
            let ctx = socdof_ui::theme::headless_context();
            let theme = Theme::new(Appearance::Light, "indigo");
            let store = Store::open_in_memory().expect("in-memory store");
            let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
            let mut focus = FocusState::default();
            let mut state = AuthState::new(&store, now).expect("setup state");
            state.show_setup();
            state.setup_step = 4;
            let mut output = None;
            for _ in 0..2 {
                output = Some(ctx.run(input_frame(width, 982.0), |ctx| {
                    auth(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
                }));
            }
            let lines = signature(&output.expect("wizard frame"));
            let heading = text_pos(&lines, label).expect("heading painted");
            let helper = text_pos(&lines, hint).expect("hint painted");
            (width, helper.1 - heading.1)
        })
        .collect::<Vec<_>>();

    let (_, phone) = offsets[0];
    assert!(
        phone >= 12.0,
        "at 432 px the hint must start below the heading, measured {phone} px"
    );
    let (_, wide) = offsets[1];
    assert!(
        wide.abs() < 2.0,
        "at 1512 px the hint stays on the heading row, measured {wide} px"
    );
}

#[test]
fn a_rejected_continue_shows_the_error_above_the_footer() {
    let ctx = socdof_ui::theme::headless_context();
    let theme = Theme::new(Appearance::Light, "indigo");
    let texts = UiTexts::embedded(Language::De).expect("embedded catalogue");
    let store = Store::open_in_memory().expect("in-memory store");
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let mut focus = FocusState::default();
    let mut state = AuthState::new(&store, now).expect("setup state");
    state.show_setup();
    state.setup_step = 2;
    state.error = Some("auth_error_password_mismatch");

    let mut output = None;
    for _ in 0..2 {
        output = Some(ctx.run(input_frame(1512.0, 982.0), |ctx| {
            auth(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
        }));
    }
    let lines = signature(&output.expect("auth frame"));

    let expected = format!("{:?}", texts.get("auth_error_password_mismatch"));
    let painted = lines.iter().filter(|line| line.contains(&expected)).count();
    assert_eq!(
        painted, 1,
        "the error must be painted once, outside the scrolled body"
    );
    let y = text_y(&lines, &expected).expect("error text position");
    // At 1512 × 982 the wizard footer buttons sit at y 873..925; the error band is directly above
    // them. A message trailing the scrolled fields would be clipped at the body viewport (y 890).
    assert!(
        y > 780.0 && y < 982.0,
        "error painted at y={y}, expected the band above the footer"
    );
}

/// Minimal egui harness that keeps the kit focus state between frames.
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

    fn frame(&mut self, events: Vec<Event>, mut draw: impl FnMut(&mut Ui, &mut FocusState)) {
        let focus = &mut self.focus;
        let input = RawInput {
            events,
            ..input_frame(600.0, 400.0)
        };
        let _ = self.ctx.run(input, |ctx| {
            focus.begin_frame(ctx);
            egui::CentralPanel::default().show(ctx, |ui| draw(ui, focus));
            focus.finish_frame();
        });
    }
}

#[test]
fn typing_reaches_a_clicked_password_field() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let value = Rc::new(RefCell::new(String::new()));
    let rect = Rc::new(RefCell::new(Rect::ZERO));

    let value_in = Rc::clone(&value);
    let rect_in = Rc::clone(&rect);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        let mut visible = false;
        let response = password_input(
            ui,
            &theme,
            focus,
            &mut value_in.borrow_mut(),
            "Passwort",
            "Passwort",
            PasswordField {
                reveal: Some(&mut visible),
                ..Default::default()
            },
        );
        *rect_in.borrow_mut() = response.rect;
    };

    harness.frame(Vec::new(), &mut draw);
    let field = *rect.borrow();
    assert!(field.width() > 100.0, "the password field was not painted");
    // A click on the text area, then typing.
    let pos = Pos2::new(field.left() + field.width() * 0.5, field.center().y);
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
    harness.frame(vec![Event::Text("abc".to_owned())], &mut draw);
    assert_eq!(value.borrow().as_str(), "abc");
}

#[test]
fn clicking_a_field_padding_focuses_that_field() {
    let mut harness = Harness::new();
    let theme = harness.theme.clone();
    let first = Rc::new(RefCell::new(String::new()));
    let second = Rc::new(RefCell::new(String::new()));
    let second_rect = Rc::new(RefCell::new(Rect::ZERO));

    let first_in = Rc::clone(&first);
    let second_in = Rc::clone(&second);
    let rect_in = Rc::clone(&second_rect);
    let mut draw = move |ui: &mut Ui, focus: &mut FocusState| {
        input(
            ui,
            &theme,
            focus,
            &mut first_in.borrow_mut(),
            "Anzeigename",
            "Anzeigename",
        );
        ui.add_space(10.0);
        let response = input(
            ui,
            &theme,
            focus,
            &mut second_in.borrow_mut(),
            "Benutzername",
            "Benutzername",
        );
        *rect_in.borrow_mut() = response.rect;
    };

    harness.frame(Vec::new(), &mut draw);
    let rect = *second_rect.borrow();
    assert!(rect.width() > 0.0, "the second field was not painted");
    // Aim at the 16 point left padding inside the border box, not the glyph run.
    let pos = Pos2::new(rect.left() + 4.0, rect.center().y);
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
    harness.frame(vec![Event::Text("b".to_owned())], &mut draw);

    assert_eq!(
        second.borrow().as_str(),
        "b",
        "typing after a padding click must reach the clicked field"
    );
    assert!(first.borrow().is_empty(), "the first field kept the caret");
}

/// The rejected step 2 paints its message in a band between the scrolled body and the footer.
///
/// A row that is cut off at the body edge used to end flush on the band's border, so at 432 px the
/// "recovery question" label looked as if the message covered it. The band now reserves a clear gap
/// (`ERROR_BAND_GAP`); this test measures the body viewport and every painted line against it.
#[test]
fn the_error_band_stays_clear_of_the_form_rows_on_a_phone() {
    let ctx = socdof_ui::theme::headless_context();
    let theme = Theme::new(Appearance::Light, "indigo");
    let texts = UiTexts::embedded(Language::De).expect("embedded catalogue");
    let store = Store::open_in_memory().expect("in-memory store");
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let mut focus = FocusState::default();
    let mut state = AuthState::new(&store, now).expect("setup state");
    state.show_setup();
    state.setup_step = 2;
    state.error = Some("auth_error_password_mismatch");

    let mut output = None;
    for _ in 0..2 {
        output = Some(ctx.run(input_frame(432.0, 768.0), |ctx| {
            auth(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
        }));
    }
    let lines = signature(&output.expect("auth frame"));

    let message = format!("{:?}", texts.get("auth_error_password_mismatch"));
    assert_eq!(
        lines.iter().filter(|line| line.contains(&message)).count(),
        1,
        "the error must be painted exactly once"
    );
    let error_y = text_y(&lines, &message).expect("error position");
    // The band's padding above the message (`auth_screens::ERROR_BAND_PADDING`).
    let band_top = error_y - 8.0;

    // Nothing but the message itself may reach into the band. A text is painted from its top down,
    // so a line starting above the band and ending below its top would be covered by it.
    for line in &lines {
        if line.contains(&message) || !line.contains("text(") {
            continue;
        }
        let Some(y) = text_y_in(line) else {
            continue;
        };
        let clipped = !line.contains("clip(0.0,0.0,432.0,768.0)");
        if !clipped {
            continue; // The band and the footer are painted without the body's clip.
        }
        assert!(
            y + 15.0 <= band_top,
            "a body row is painted into the error band: y={y}, band top={band_top}\n{line}"
        );
    }

    // The scrolled body keeps a clear gap to the band instead of ending on its border.
    let body_bottom = lines
        .iter()
        .filter(|line| line.contains("text(") && !line.contains(&message))
        .filter_map(|line| clip_bottom(line))
        .filter(|bottom| *bottom < 768.0)
        .fold(0.0_f32, f32::max);
    assert!(
        body_bottom > 0.0,
        "the account step is expected to scroll at 432 px"
    );
    assert!(
        band_top - body_bottom >= 12.0,
        "the body ends {:.1} px above the error band, expected at least 12 px",
        band_top - body_bottom
    );
}

/// Y coordinate of the `text(...)` shape in one signature line.
fn text_y_in(line: &str) -> Option<f32> {
    let start = line.find("text(")? + "text(".len();
    line[start..].split(',').nth(1)?.trim().parse().ok()
}

/// Bottom edge of the clip rectangle a signature line was painted with.
fn clip_bottom(line: &str) -> Option<f32> {
    let rest = line.strip_prefix("clip(")?;
    let end = rest.find(')')?;
    rest[..end].split(',').nth(3)?.trim().parse().ok()
}
