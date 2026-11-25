//! Phone-width layout of the six module entry forms.
//!
//! The list, detail and form screens are covered by the module unit tests at desktop widths. These
//! tests open the *entry forms* at 432 × 768 — the narrow viewport the desktop shell is designed for —
//! and require every painted primitive to stay inside the panel. A squeezing row (fields side by side
//! that do not fit) paints past the panel edge and fails here instead of only in a screenshot.

use egui::{Context, Pos2, RawInput, Rect, Vec2};
use socdof_core::domain::pos::{PaymentMethod, PosOrder, PosOrderLine};
use socdof_core::domain::settings::Language;
use socdof_core::money::Money;
use socdof_core::store::Store;
use socdof_ui::accounting::{self, AccountingState};
use socdof_ui::contacts::{self, ContactsState};
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::pos::{self, PosState};
use socdof_ui::purchases::{self, PurchasesState};
use socdof_ui::snapshot::signature;
use socdof_ui::theme::{Appearance, Theme};
use socdof_ui::therapie::{self, TherapieState};
use socdof_ui::users::{self, UsersState};
use uuid::Uuid;

/// Width of the phone viewport the forms have to fit.
const PHONE_WIDTH: f32 = 432.0;
/// Height of the phone viewport.
const PHONE_HEIGHT: f32 = 768.0;
/// Right edge of the phone panel; painted primitives may not cross it.
const PANEL_RIGHT: f32 = 432.5;

/// Renders two frames at `width` — the second one is the settled layout — and returns the signature.
fn render(width: f32, mut draw: impl FnMut(&Context)) -> Vec<String> {
    let ctx = socdof_ui::theme::headless_context();
    let mut output = None;
    for _ in 0..2 {
        let input = RawInput {
            screen_rect: Some(Rect::from_min_size(
                Pos2::ZERO,
                Vec2::new(width, PHONE_HEIGHT),
            )),
            time: Some(1.0),
            ..Default::default()
        };
        output = Some(ctx.run(input, |ctx| draw(ctx)));
    }
    signature(&output.expect("frame"))
}

/// Widest painted right edge with the shape that carries it, ignoring clip rectangles.
fn widest_right(lines: &[String]) -> (f32, String) {
    let mut widest: f32 = 0.0;
    let mut shape = String::new();
    for line in lines {
        let Some(rest) = line.split("rect(").nth(1) else {
            continue;
        };
        let values: Vec<f32> = rest
            .split(',')
            .take(4)
            .filter_map(|value| value.trim().parse().ok())
            .collect();
        // The panel background covers the whole viewport and grows with the content; only the
        // shapes on top of it say what actually runs out of the panel.
        let background = values[0] <= 0.01 && values[1] <= 0.01 && values[3] >= PHONE_HEIGHT - 0.5;
        if values.len() == 4 && !background && values[2] > widest {
            widest = values[2];
            shape = line.clone();
        }
    }
    (widest, shape)
}

/// Asserts the form was painted and that nothing runs past the phone panel.
fn assert_inside(name: &str, lines: &[String], form_title: &str) {
    assert!(
        lines.iter().any(|line| line.contains(form_title)),
        "{name}: the entry form is not on screen"
    );
    let (widest, shape) = widest_right(lines);
    assert!(
        widest <= PANEL_RIGHT,
        "{name}: a painted element reaches {widest} px, the panel ends at {PANEL_RIGHT} px\n{shape}"
    );
}

fn theme() -> Theme {
    Theme::new(Appearance::Light, "indigo")
}

#[test]
fn the_contact_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    contacts::seed_sample(&store, &texts).expect("seed");
    let mut state = ContactsState::new();
    state.refresh(&store).expect("refresh");
    state.start_new();
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let lines = render(PHONE_WIDTH, |ctx| {
        contacts::contacts(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("contacts form", &lines, texts.get("contacts_new_title"));
}

#[test]
fn the_purchase_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    purchases::seed_purchases(&store, &texts).expect("seed");
    let mut state = PurchasesState::new();
    state.refresh(&store).expect("refresh");
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    state.start_new(now);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(PHONE_WIDTH, |ctx| {
        purchases::purchases(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("purchases form", &lines, texts.get("purchases_new_title"));
}

#[test]
fn the_receipt_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    pos::seed_pos(&store, &texts).expect("seed");
    let mut state = PosState::new();
    state.refresh(&store).expect("refresh");
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    state.start_new(now);
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(PHONE_WIDTH, |ctx| {
        pos::pos(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("pos form", &lines, texts.get("pos_new_title"));
}

#[test]
fn the_discard_dialog_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    pos::seed_pos(&store, &texts).expect("seed");
    let mut state = PosState::new();
    state.refresh(&store).expect("refresh");
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    state.start_new(now);
    state.confirm_cancel = true;
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(PHONE_WIDTH, |ctx| {
        pos::pos(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("pos discard dialog", &lines, texts.get("pos_cancel_title"));
}

#[test]
fn the_booking_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    accounting::seed_accounting(&store, &texts).expect("seed");
    let mut state = AccountingState::new();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    state.refresh(&store, now).expect("refresh");
    state.start_new();
    let mut focus = FocusState::default();
    let theme = theme();
    let lines = render(PHONE_WIDTH, |ctx| {
        accounting::accounting(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("accounting form", &lines, texts.get("accounting_new_title"));
}

#[test]
fn the_user_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    users::seed_users(&store).expect("seed");
    let mut state = UsersState::new();
    state.refresh(&store).expect("refresh");
    state.start_new();
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let lines = render(PHONE_WIDTH, |ctx| {
        users::users(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("users form", &lines, texts.get("users_new_title"));
}

#[test]
fn the_client_form_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    therapie::seed_sample(&store, &texts).expect("seed");
    let mut state = TherapieState::new();
    state.refresh(&store).expect("refresh");
    state.start_new();
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let lines = render(PHONE_WIDTH, |ctx| {
        therapie::therapie(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("therapy form", &lines, texts.get("therapie_new_title"));
}

#[test]
fn the_receipt_detail_fits_the_phone_panel() {
    let store = Store::open_in_memory().expect("store");
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    pos::seed_pos(&store, &texts).expect("seed");
    // Six columns of five-digit amounts: the grid form of the position table ran over the panel
    // edge with a receipt like this one.
    let order = PosOrder {
        id: Uuid::new_v4(),
        receipt_number: "BON-2026-0099".to_string(),
        contact_id: None,
        payment_method: PaymentMethod::Cash,
        paid_at: socdof_ui::dashboard::SAMPLE_NOW_MS,
        currency_symbol: "€".to_string(),
        note: None,
        tax_total_override_cents: None,
        cash_given: Some(Money::from_cents(2_000_000)),
        lines: vec![PosOrderLine {
            product_id: None,
            description: "Test article".to_string(),
            quantity_milli: 110_000,
            unit_price: Money::from_cents(11_000),
            tax_rate_bp: 1900,
        }],
        legacy_id: None,
    };
    store.insert_pos_order(&order, &[]).expect("order");
    let mut state = PosState::new();
    state.refresh(&store).expect("refresh");
    state.select(order.id);
    let mut focus = FocusState::default();
    let theme = theme();
    let now = socdof_ui::dashboard::SAMPLE_NOW_MS;
    let lines = render(PHONE_WIDTH, |ctx| {
        pos::pos(ctx, &theme, &texts, &mut focus, &mut state, &store, now);
    });
    assert_inside("pos detail", &lines, texts.get("pos_detail_title"));
}
