//! First-run wizard and sign-in screens.
//!
//! The layout follows the TypeScript edition screen by screen: the compact language card, the
//! five wizard steps inside the large card (welcome, account, appearance, apps, finish) and the
//! clock/avatar sign-in screen. State and core calls stay in [`crate::auth`]; this module paints and
//! reports what the user asked for.

use egui::{Align, FontFamily, FontId, Layout, Pos2, Rect, RichText, Ui, Vec2};
use socdof_core::domain::settings::{Language, ThemeMode};
use socdof_core::domain::user::User;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::auth::{
    language_label, messages, AuthState, RecoveryChoice, SetupAccountType, SetupTemplate,
    SETUP_STEPS,
};
use crate::auth_kit as kit;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::with_alpha;

/// Built-in languages of the first-run screen: language, three letter badge, subtitle key.
/// Space between the band's border and its message.
const ERROR_BAND_PADDING: f32 = 8.0;
/// Clear space between the scrolled body and the band: a row that is cut off at the body edge keeps
/// this distance, so no line ever sits on the band's border.
const ERROR_BAND_GAP: f32 = 16.0;

/// Catalogue ids of the eight recovery questions offered by the wizard, in the order of the
/// TypeScript `RECOVERY_QUESTIONS` list.
pub const RECOVERY_QUESTION_IDS: [&str; 8] = [
    "setup_recovery_q1",
    "setup_recovery_q2",
    "setup_recovery_q3",
    "setup_recovery_q4",
    "setup_recovery_q5",
    "setup_recovery_q6",
    "setup_recovery_q7",
    "setup_recovery_q8",
];

/// Modules the TypeScript setup hides for a personal account.
pub const BUSINESS_ONLY_MODULES: [&str; 5] =
    ["invoices", "accounting", "purchases", "pos", "support"];

const LANGUAGES: [(Language, &str, &str); 4] = [
    (Language::De, "DE", "setup_lang_de_subtitle"),
    (Language::En, "US", "setup_lang_en_subtitle"),
    (Language::Fr, "FR", "setup_lang_fr_subtitle"),
    (Language::Es, "ES", "setup_lang_es_subtitle"),
];

/// The four app templates of the wizard: template, icon, title key, description key, tint.
const TEMPLATES: [(SetupTemplate, Icon, &str, &str, u32); 4] = [
    (
        SetupTemplate::Personal,
        Icon::User,
        "setup_account_type_personal",
        "setup_template_personal_desc",
        0x6366f1,
    ),
    (
        SetupTemplate::Business,
        Icon::Building,
        "setup_account_type_business",
        "setup_template_business_desc",
        0x7c3aed,
    ),
    (
        SetupTemplate::Practice,
        Icon::Shield,
        "setup_template_practice",
        "setup_template_practice_desc",
        0xe11d48,
    ),
    (
        SetupTemplate::Retail,
        Icon::Bag,
        "setup_template_retail",
        "setup_template_retail_desc",
        0xf59e0b,
    ),
];

/// Whether the setup shows a module for the chosen account type.
///
/// The TypeScript wizard hides invoices, accounting, purchases, POS and support services while the
/// account is personal (`SETUP_BUSINESS_ONLY_MODULES`).
pub fn module_visible_for(account_type: SetupAccountType, slug: &str) -> bool {
    account_type == SetupAccountType::Business || !BUSINESS_ONLY_MODULES.contains(&slug)
}

/// Desktop apps of a template for the chosen account type.
pub fn template_apps_for(
    template: SetupTemplate,
    account_type: SetupAccountType,
) -> Vec<&'static str> {
    template_apps(template)
        .into_iter()
        .filter(|slug| module_visible_for(account_type, slug))
        .collect()
}

/// Catalogue label of a stored recovery question, localized at paint time.
///
/// Custom questions are stored as their free text and come back unchanged.
pub fn recovery_question_label(texts: &UiTexts, question: &str) -> String {
    if RECOVERY_QUESTION_IDS.contains(&question) {
        texts.get(question).to_owned()
    } else {
        question.to_owned()
    }
}

/// Catalogue key of the wizard step chip, `None` for the language card.
fn wizard_step_key(step: usize) -> Option<&'static str> {
    match step {
        1 => Some("setup_step_welcome"),
        2 => Some("setup_step_account"),
        3 => Some("setup_step_appearance"),
        4 => Some("setup_step_apps"),
        5 => Some("setup_step_finish"),
        _ => None,
    }
}

/// Next step, skipping the appearance and apps steps when the user turned setup off.
pub fn next_step(state: &AuthState) -> usize {
    match state.setup_step {
        2..=4 if state.setup_skip_extras => SETUP_STEPS - 1,
        step => (step + 1).min(SETUP_STEPS - 1),
    }
}

/// Previous step, skipping the appearance and apps steps when setup is turned off.
pub fn previous_step(state: &AuthState) -> usize {
    match state.setup_step {
        5 if state.setup_skip_extras => 2,
        step => step.saturating_sub(1),
    }
}

/// Desktop apps of a template, in reading order.
pub fn template_apps(template: SetupTemplate) -> Vec<&'static str> {
    match template {
        SetupTemplate::Personal => vec![
            "dashboard",
            "contacts",
            "calendar",
            "documentation",
            "settings",
        ],
        SetupTemplate::Business => vec![
            "dashboard",
            "invoices",
            "accounting",
            "contacts",
            "products",
            "purchases",
            "calendar",
            "reports",
            "settings",
        ],
        SetupTemplate::Practice => vec![
            "dashboard",
            "therapy",
            "contacts",
            "calendar",
            "invoices",
            "accounting",
            "settings",
        ],
        SetupTemplate::Retail => vec![
            "dashboard",
            "pos",
            "products",
            "purchases",
            "accounting",
            "contacts",
            "invoices",
            "settings",
        ],
        SetupTemplate::All => Vec::new(),
    }
}

fn tint(value: u32) -> egui::Color32 {
    egui::Color32::from_rgb(
        (value >> 16) as u8,
        ((value >> 8) & 0xff) as u8,
        (value & 0xff) as u8,
    )
}

/// Draws the sign-in screen and reports the chosen action through the state.
#[allow(clippy::too_many_arguments)]
pub fn login(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let users = store.list_users().unwrap_or_default();
    let active: Vec<User> = users.into_iter().filter(|user| user.active).collect();
    // The legacy form preselects the first account unless the user opened the "other user" mode.
    if state.username.is_empty() && !state.other_user {
        if let Some(first) = active.first() {
            state.username = first.username.clone();
        }
    }
    let selected = if state.other_user {
        None
    } else {
        active
            .iter()
            .find(|user| user.username == state.username)
            .cloned()
    };
    let mut sign_in = false;
    let mut recover = false;
    let mut switch_to: Option<String> = None;
    let mut clear_user = false;
    let mut quick_desktop = false;
    let security = socdof_core::auth_security::load(store).unwrap_or_default();
    // The reference shows the auto-login notice while exactly one account exists.
    let auto_login_card = security.auto_login_single_user && active.len() == 1 && !state.other_user;
    let account_avatars: Vec<(Uuid, Option<crate::wallpaper::CustomWallpaper>)> = active
        .iter()
        .map(|user| (user.id, state.avatar_for(store, user.id)))
        .collect();
    let selected_avatar = selected.as_ref().and_then(|user| {
        account_avatars
            .iter()
            .find(|(id, _)| *id == user.id)
            .and_then(|(_, avatar)| avatar.clone())
    });
    let continue_label = selected
        .as_ref()
        .filter(|user| user.passwordless)
        .map(|user| {
            texts
                .get("auth_continue_as")
                .replace("{name}", &user.display_name)
        });
    // The legacy form disables the field and shows a per-second countdown while the store lockout
    // is running.
    let remaining = state.lockout_seconds(now);

    let top = ((ui.available_height() - 560.0) * 0.22).max(8.0);
    ui.add_space(top);
    kit::centered(ui, 520.0, |ui| {
        ui.vertical_centered(|ui| {
            ui.label(
                RichText::new(state.clock.sign_in_time(now))
                    .size(36.0)
                    .family(crate::theme::light())
                    .color(theme.palette.text),
            );
            ui.label(
                RichText::new(state.clock.sign_in_date(now))
                    .size(12.0)
                    .family(crate::theme::semibold())
                    .color(crate::tokens::with_alpha(theme.palette.text, 217)),
            );
            // The legacy screen centres the account block in the space below the clock.
            ui.add_space((ui.available_height() * 0.22).max(28.0));
            let (name, initials) = match &selected {
                Some(user) => (user.display_name.clone(), kit::initials(&user.display_name)),
                None => (texts.get("auth_other_user").to_string(), String::new()),
            };
            kit::avatar(
                ui,
                theme,
                selected_avatar.as_ref().or(state.avatar.as_ref()),
                &initials,
                80.0,
            );
            ui.add_space(14.0);
            ui.label(
                RichText::new(&name)
                    .size(20.0)
                    .family(crate::theme::semibold())
                    .color(theme.palette.text),
            );
            if selected.is_none() {
                ui.label(
                    RichText::new(texts.get("auth_other_user_desc"))
                        .size(12.0)
                        .color(with_alpha(theme.palette.text, 166)),
                );
            }
            ui.add_space(14.0);
            if auto_login_card {
                // `auth.autologin_active_notice` card with the "Direkt zum Desktop" shortcut.
                egui::Frame::none()
                    .fill(egui::Color32::from_white_alpha(38))
                    .rounding(egui::Rounding::same(16.0))
                    .inner_margin(egui::Margin::symmetric(10.0, 8.0))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(texts.get("auth_autologin_notice"))
                                    .size(11.0)
                                    .color(theme.palette.text),
                            );
                            let button = egui::Button::new(
                                RichText::new(format!(
                                    "{} \u{2192}",
                                    texts.get("auth_autologin_quick_enter")
                                ))
                                .size(11.0)
                                .strong()
                                .color(theme.palette.text),
                            )
                            .fill(egui::Color32::from_white_alpha(56))
                            .rounding(egui::Rounding::same(10.0));
                            if ui.add(button).clicked() {
                                quick_desktop = true;
                            }
                        });
                    });
                ui.add_space(8.0);
            }
            kit::centered(ui, 324.0, |ui| {
                if state.other_user {
                    kit::input(
                        ui,
                        theme,
                        focus,
                        &mut state.username,
                        texts.get("auth_username"),
                        texts.get("auth_username"),
                    );
                    ui.add_space(8.0);
                }
                if let Some(label) = continue_label.as_deref() {
                    // A passwordless account has no password field; the reference shows a single
                    // "continue as" button instead.
                    if kit::primary_button(ui, theme, focus, label) {
                        sign_in = true;
                    }
                    return;
                }
                let field = kit::password_input(
                    ui,
                    theme,
                    focus,
                    &mut state.password,
                    texts.get("auth_password"),
                    texts.get("auth_password_hint"),
                    kit::PasswordField {
                        autofocus: true,
                        enabled: remaining == 0,
                        ..Default::default()
                    },
                );
                let frame = field.rect.expand2(Vec2::new(12.0, 11.0));
                let arrow = egui::Rect::from_center_size(
                    Pos2::new(frame.right() - 24.0, frame.center().y),
                    Vec2::splat(34.0),
                );
                if remaining == 0 {
                    if kit::overlay_circle_button(
                        ui,
                        theme,
                        focus,
                        arrow,
                        Icon::ChevronRight,
                        texts.get("auth_sign_in"),
                    ) {
                        sign_in = true;
                    }
                } else {
                    // `disabled:opacity-30` of the legacy submit button.
                    ui.painter().circle_filled(
                        arrow.center(),
                        17.0,
                        egui::Color32::from_white_alpha(40),
                    );
                    Icon::ChevronRight.draw(
                        ui.painter(),
                        egui::Rect::from_center_size(arrow.center(), Vec2::splat(18.0)),
                        egui::Color32::from_white_alpha(90),
                        1.6,
                    );
                }
            });
            // Fixed-height slot: the countdown or error appears here without moving the link.
            ui.add_space(6.0);
            ui.allocate_ui_with_layout(
                Vec2::new(ui.available_width(), 22.0),
                Layout::top_down(Align::Center),
                |ui| {
                    if remaining > 0 {
                        ui.label(
                            RichText::new(format!("{} {}s", texts.get("auth_retry"), remaining))
                                .size(12.0)
                                .color(theme.palette.warning),
                        );
                    } else {
                        messages(ui, theme, texts, state, now, true);
                    }
                },
            );
            ui.add_space(2.0);
            let link_color = if crate::auth_kit::dark(theme) {
                with_alpha(theme.palette.text, 75)
            } else {
                theme.accent_text()
            };
            if kit::link_colored(
                ui,
                theme,
                focus,
                texts.get("auth_forgot_password"),
                link_color,
            ) {
                recover = true;
            }
        });
    });

    // Account strip along the bottom, like the legacy sign-in screen: left aligned on the desktop
    // and centred on a narrow window.
    let screen = ui.ctx().screen_rect();
    let strip_width = active.len() as f32 * 94.0 + 100.0;
    let strip_left = if screen.width() < kit::COMPACT_WIDTH {
        screen.left() + ((screen.width() - strip_width) * 0.5).max(0.0)
    } else {
        screen.left() + 28.0
    };
    {
        egui::Area::new(egui::Id::new("socdof-login-accounts"))
            .fixed_pos(Pos2::new(strip_left, screen.bottom() - 32.0 - 86.0))
            .order(egui::Order::Foreground)
            .show(ui.ctx(), |ui| {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 18.0;
                    for user in &active {
                        let (rect, response) =
                            ui.allocate_exact_size(Vec2::new(76.0, 86.0), egui::Sense::click());
                        let avatar_rect = egui::Rect::from_min_size(
                            Pos2::new(rect.center().x - 22.0, rect.top()),
                            Vec2::splat(44.0),
                        );
                        let avatar = account_avatars
                            .iter()
                            .find(|(id, _)| *id == user.id)
                            .and_then(|(_, avatar)| avatar.as_ref());
                        kit::draw_avatar(
                            ui,
                            theme,
                            avatar_rect,
                            avatar,
                            &kit::initials(&user.display_name),
                        );
                        if response.hovered() {
                            ui.painter().rect(
                                rect.shrink(2.0),
                                egui::Rounding::same(12.0),
                                crate::tokens::with_alpha(theme.palette.text_muted, 10),
                                egui::Stroke::new(1.0_f32, kit::hairline_color(theme)),
                            );
                        }
                        let galley = ui.painter().layout(
                            user.display_name
                                .split_whitespace()
                                .next()
                                .unwrap_or_default()
                                .to_owned(),
                            egui::FontId::proportional(11.0),
                            theme.palette.text,
                            140.0,
                        );
                        let caption = egui::Rect::from_min_size(
                            Pos2::new(rect.center().x - 37.0, avatar_rect.bottom() + 6.0),
                            Vec2::new(74.0, 14.0),
                        );
                        ui.painter().with_clip_rect(caption).galley(
                            Pos2::new(rect.center().x - galley.size().x * 0.5, caption.top()),
                            galley,
                            theme.palette.text,
                        );
                        if response.clicked() {
                            switch_to = Some(user.username.clone());
                        }
                    }
                    let (rect, response) =
                        ui.allocate_exact_size(Vec2::new(86.0, 86.0), egui::Sense::click());
                    let tile = egui::Rect::from_min_size(
                        Pos2::new(rect.center().x - 22.0, rect.top()),
                        Vec2::splat(44.0),
                    );
                    ui.painter().circle(
                        tile.center(),
                        22.0,
                        egui::Color32::TRANSPARENT,
                        egui::Stroke::new(1.4_f32, kit::hairline_color(theme)),
                    );
                    Icon::User.draw(
                        ui.painter(),
                        egui::Rect::from_center_size(tile.center(), Vec2::splat(20.0)),
                        theme.palette.text_muted,
                        1.5,
                    );
                    // The caption wraps inside the tile: the label is longer than the 86 point
                    // column, and a single line was clipped at the tile edge.
                    let galley = ui.painter().layout(
                        texts.get("auth_other_user").to_owned(),
                        egui::FontId::proportional(11.0),
                        theme.palette.text_muted,
                        110.0,
                    );
                    let caption = egui::Rect::from_min_size(
                        Pos2::new(rect.center().x - 55.0, tile.bottom() + 6.0),
                        Vec2::new(110.0, 30.0),
                    );
                    ui.painter().with_clip_rect(caption).galley(
                        Pos2::new(rect.center().x - galley.size().x * 0.5, caption.top()),
                        galley,
                        theme.palette.text_muted,
                    );
                    if response.clicked() {
                        clear_user = true;
                    }
                });
            });
    }

    // Window controls and the language selector share the top right corner, like the legacy
    // sign-in screen, which keeps "minimise", "fullscreen" and the language picker in one bar.
    egui::Area::new(egui::Id::new("socdof-login-language"))
        .fixed_pos(Pos2::new(screen.right() - 256.0, screen.top() + 16.0))
        .order(egui::Order::Foreground)
        .show(ui.ctx(), |ui| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;
                if crate::components::icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Minimize,
                    texts.get("desktop_minimize_app"),
                )
                .activated
                {
                    ui.ctx()
                        .send_viewport_cmd(egui::ViewportCommand::Minimized(true));
                }
                if crate::components::icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Maximize,
                    texts.get("desktop_enter_fullscreen"),
                )
                .activated
                {
                    crate::desktop::toggle_fullscreen(ui.ctx());
                }
                // The legacy sign-in bar keeps a close button next to fullscreen and asks the host
                // to quit instead of leaving a running session behind.
                if crate::components::icon_button(
                    ui,
                    theme,
                    focus,
                    Icon::Close,
                    texts.get("desktop_close_app"),
                )
                .activated
                {
                    // The legacy sign-in screen asks before it closes the application.
                    state.quit_confirm = true;
                }
                language_selector(ui, theme, texts, state);
            });
        });

    if state.status.is_some() {
        egui::Area::new(egui::Id::new("socdof-login-toast"))
            .fixed_pos(Pos2::new(screen.right() - 356.0, screen.bottom() - 108.0))
            .order(egui::Order::Foreground)
            .show(ui.ctx(), |ui| {
                kit::toast(
                    ui,
                    theme,
                    texts.get("setup_toast_created_title"),
                    texts.get("setup_toast_created_body"),
                );
            });
    }

    if quick_desktop {
        let _ = state.auto_login(store, now);
    }
    if let Some(username) = switch_to {
        state.other_user = false;
        state.begin_switch(&username);
    }
    if clear_user {
        state.other_user = true;
        state.username.clear();
        state.password.clear();
        state.error = None;
    }
    if sign_in || submit {
        match selected.as_ref().filter(|user| user.passwordless) {
            Some(user) => {
                let _ = state.quick_switch_to(store, user.id, now);
            }
            None => state.begin_sign_in(now),
        }
    }
    if recover {
        state.begin_recovery(store);
    }
    quit_confirmation(ui, theme, texts, focus, state);
}

/// Asks before the close button of the sign-in screen ends the application.
fn quit_confirmation(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    if !state.quit_confirm {
        return;
    }
    let screen = ui.ctx().screen_rect();
    egui::Area::new(egui::Id::new("socdof-quit-confirm"))
        .fixed_pos(screen.min)
        .order(egui::Order::Foreground)
        .show(ui.ctx(), |ui| {
            ui.allocate_ui_with_layout(
                Vec2::new(screen.width(), 0.0),
                Layout::top_down(Align::Min),
                |ui| {
                    ui.painter().rect_filled(
                        screen,
                        egui::Rounding::ZERO,
                        egui::Color32::from_black_alpha(140),
                    );
                    ui.vertical_centered(|ui| {
                        ui.add_space((screen.height() * 0.36).max(40.0));
                        kit::card(ui, theme, 340.0, 18.0, |ui| {
                            ui.label(
                                RichText::new(texts.get("desktop_quit_confirm_title"))
                                    .size(14.0)
                                    .family(crate::theme::semibold())
                                    .color(theme.palette.text),
                            );
                            ui.add_space(12.0);
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if kit::small_button(
                                    ui,
                                    theme,
                                    focus,
                                    Icon::Close,
                                    texts.get("desktop_quit_confirm_yes"),
                                ) {
                                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
                                }
                                if kit::link(ui, theme, focus, texts.get("desktop_quit_confirm_no"))
                                {
                                    state.quit_confirm = false;
                                }
                            });
                        });
                    });
                },
            );
        });
}

/// Draws the first-run wizard and reports what the user asked for through the state.
#[allow(clippy::too_many_arguments)]
pub fn setup(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    if state.language_choice.is_none() {
        state.language_choice = Some(texts.language());
    }
    if state.setup_step == 0 {
        language_step(ui, theme, texts, focus, state);
        return;
    }

    let mut next = false;
    let mut back = false;
    let mut create = false;
    // The legacy card keeps its height inside the viewport (`h-[610px]` for the language card,
    // `max-h-[calc(100vh-1.5rem)] overflow-y-auto` for the wizard), scrolls its body and keeps the
    // action row at the bottom, so the footer never slips below the fold.
    let cap = (ui.ctx().screen_rect().height() - 8.0).max(320.0);
    let height = if state.setup_step == 1 {
        cap.min(440.0)
    } else {
        cap
    };
    let top = ((ui.available_height() - height) * 0.5).max(4.0);
    let page_width = kit::page_width(ui);
    // A short window gets the compact rhythm of the reference's `sm:` breakpoint, so the longest
    // step keeps its fields and its footer visible instead of scrolling the last one away.
    let dense = ui.ctx().screen_rect().height() < 1000.0;
    ui.add_space(top);
    kit::card_sized(
        ui,
        theme,
        kit::WIZARD_CARD_WIDTH,
        if dense { 20.0 } else { kit::card_padding(ui) },
        height,
        |ui| {
            // The legacy wizard header carries the step chip on the left and the language selector
            // on the right (`auth.wizardStep.N` and the compact select).
            ui.horizontal(|ui| {
                if let Some(step_key) = wizard_step_key(state.setup_step) {
                    kit::chip(ui, theme, texts.get(step_key));
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    language_selector(ui, theme, texts, state);
                });
            });
            ui.add_space(if dense { 6.0 } else { 10.0 });
            kit::icon_tile(
                ui,
                Icon::Shield,
                if dense { 36.0 } else { 44.0 },
                theme.accent.base,
            );
            ui.add_space(if dense { 6.0 } else { 10.0 });
            kit::heading(ui, theme, texts.get("setup_wizard_welcome_title"));
            ui.add_space(2.0);
            // `flex items-center justify-between`: the step line takes the space that is left once
            // the required-fields notice on the right is reserved, so the two never overlap.
            // Only the account step marks mandatory fields with an asterisk, so only that step
            // carries the legend; the other steps have no required field to explain.
            // The reference marks the required fields on every wizard step, not only on the
            // account step that carries the asterisks.
            let notice = texts.get("setup_required_notice");
            // The step chip above names the current step; the line under the title keeps the
            // constant `auth.accountSetup · auth.stepAccount` pairing of the legacy wizard.
            let step = format!(
                "{} · {}",
                texts.get("setup_account_heading"),
                texts.get("setup_chip_account")
            );
            let notice_galley = ui.painter().layout_no_wrap(
                notice.to_owned(),
                egui::FontId::new(12.0, crate::theme::semibold()),
                theme.palette.danger,
            );
            let left_width = (ui.available_width() - notice_galley.size().x - 8.0).max(80.0);
            let step_galley = ui.painter().layout(
                step,
                egui::FontId::proportional(12.0),
                theme.palette.text_muted,
                left_width,
            );
            let row_height = step_galley.size().y.max(notice_galley.size().y);
            let (row, _) = ui.allocate_exact_size(
                Vec2::new(ui.available_width(), row_height),
                egui::Sense::hover(),
            );
            let painter = ui.painter();
            painter.galley(row.min, step_galley, theme.palette.text_muted);
            painter.galley(
                Pos2::new(
                    row.right() - notice_galley.size().x,
                    row.center().y - notice_galley.size().y / 2.0,
                ),
                notice_galley,
                theme.palette.danger,
            );
            ui.add_space(if dense { 8.0 } else { 10.0 });

            // Body and footer get disjoint rectangles instead of an arithmetic reservation: the
            // scroll area then cannot paint past the band the footer keeps, which is what made the
            // last row overlap the buttons and swallow their clicks.
            let full = ui.available_rect_before_wrap();
            let footer_height = 44.0;
            let footer_top = (full.bottom() - footer_height).max(full.top());
            let mut body_bottom = (footer_top - 10.0).max(full.top());
            // A rejected "Continue" has to be readable without scrolling. The message owns a band
            // between the scrolling body and the footer instead of trailing the scrolled fields,
            // where a full form pushed it below the fold and the click looked like nothing.
            let mut error_band = None;
            if let Some(key) = state.error {
                let galley = ui.painter().layout(
                    texts.get(key).to_owned(),
                    egui::FontId::proportional(crate::tokens::FONT_SMALL),
                    theme.palette.danger,
                    (full.width() - 28.0).max(80.0),
                );
                let band = (galley.size().y + ERROR_BAND_PADDING * 2.0)
                    .min((body_bottom - full.top()).max(0.0));
                let top = body_bottom - band;
                error_band = Some((
                    Rect::from_min_max(
                        Pos2::new(full.left(), top),
                        Pos2::new(full.right(), body_bottom),
                    ),
                    galley,
                ));
                body_bottom = (top - ERROR_BAND_GAP).max(full.top());
            }
            let body_rect = Rect::from_min_max(full.min, Pos2::new(full.right(), body_bottom));
            let footer_rect = Rect::from_min_max(Pos2::new(full.left(), footer_top), full.max);
            if let Some((rect, galley)) = error_band {
                let painter = ui.painter();
                painter.rect(
                    rect,
                    egui::Rounding::same(10.0),
                    with_alpha(theme.palette.danger, 12),
                    egui::Stroke::new(1.0_f32, with_alpha(theme.palette.danger, 45)),
                );
                painter.galley(
                    Pos2::new(
                        rect.left() + 14.0,
                        rect.top()
                            + ERROR_BAND_PADDING.max((rect.height() - galley.size().y) * 0.5),
                    ),
                    galley,
                    theme.palette.danger,
                );
            }
            ui.allocate_ui_at_rect(body_rect, |ui| {
                egui::ScrollArea::vertical()
                    .max_height(body_rect.height())
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        // `space-y-3.5` of the legacy form; egui would add its own 8 point gap.
                        ui.spacing_mut().item_spacing.y = 0.0;
                        match state.setup_step {
                            1 => {
                                kit::muted(ui, theme, texts.get("setup_wizard_welcome_body"));
                            }
                            2 => account_step(ui, theme, texts, focus, state),
                            3 => appearance_step(ui, theme, texts, focus, state),
                            4 => apps_step(ui, theme, texts, focus, state, store),
                            5 => finish_step(ui, theme, texts, focus, state),
                            _ => {}
                        }
                        ui.add_space(10.0);
                        messages(ui, theme, texts, state, now, false);
                    });
            });

            ui.allocate_ui_at_rect(footer_rect, |ui| {
                if state.setup_step == 1 {
                    if kit::primary_button(ui, theme, focus, texts.get("setup_next")) {
                        next = true;
                    }
                } else {
                    // `flex items-center gap-2` with two `flex-1` buttons: both halves share the row,
                    // so each one is drawn at its computed width instead of the full row width.
                    let gap = 8.0;
                    // The card body is wider than its visible frame here, so derive the half width from
                    // the card geometry instead of the parent's available width.
                    let inner = (kit::WIZARD_CARD_WIDTH.min(page_width)
                        - kit::card_padding(ui) * 2.0)
                        .max(160.0);
                    let width = ((inner - gap) * 0.5).max(80.0);
                    let last = state.setup_step + 1 == SETUP_STEPS;
                    let label = if last {
                        texts.get("auth_create_admin")
                    } else {
                        texts.get("setup_next")
                    };
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = gap;
                        if kit::secondary_button_sized(
                            ui,
                            theme,
                            focus,
                            texts.get("setup_step_back"),
                            width,
                        ) {
                            back = true;
                        }
                        if kit::primary_button_sized(ui, theme, focus, label, width) {
                            if last {
                                create = true;
                            } else {
                                next = true;
                            }
                        }
                    });
                }
            });
        },
    );

    if back && state.setup_step > 0 {
        state.setup_step = previous_step(state);
        state.error = None;
    }
    if next && state.setup_step + 1 < SETUP_STEPS {
        if state.setup_step == 2 {
            if let Some(problem) = validate_account(state) {
                state.error = Some(problem);
                return;
            }
        }
        state.setup_step = next_step(state);
        state.error = None;
    }
    if create || (submit && state.setup_step + 1 == SETUP_STEPS) {
        let _ = state.create_first_admin(store, now);
        if state.error.is_some() {
            state.setup_step = 2;
        } else {
            state.wizard_completed = true;
        }
    }
}

/// Checks the account step before the wizard moves on, mirroring the legacy validation order.
fn validate_account(state: &AuthState) -> Option<&'static str> {
    use socdof_core::security::MIN_PASSWORD_LENGTH;
    if state.display_name.trim().is_empty() {
        return Some("auth_error_display_name");
    }
    if state.username.trim().chars().count() < 3 {
        return Some("auth_error_username_short");
    }
    if state.password.chars().count() < MIN_PASSWORD_LENGTH {
        return Some("auth_error_password_short");
    }
    if state.password != state.password_confirm {
        return Some("auth_error_password_mismatch");
    }
    if state.account_type == SetupAccountType::Business
        && !state.setup_business_skipped
        && state.company_name.trim().is_empty()
    {
        return Some("setup_error_company_required");
    }
    None
}

/// Step 0: the compact language card of the very first start.
fn language_step(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    let selected = state.language_choice.unwrap_or_else(|| texts.language());
    // The legacy card keeps a fixed `h-[610px]` so header and footer stay put while the language
    // list scrolls between them.
    let height = (ui.ctx().screen_rect().height() - 32.0).min(610.0);
    let top = ((ui.available_height() - height) * 0.5).max(4.0);
    ui.add_space(top);
    kit::card_sized(
        ui,
        theme,
        kit::LANGUAGE_CARD_WIDTH,
        kit::language_card_padding(ui),
        height,
        |ui| {
            ui.horizontal(|ui| {
                kit::icon_tile(ui, Icon::Languages, 48.0, theme.accent.base);
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    kit::chip(ui, theme, texts.get("setup_chip_language"));
                });
            });
            ui.add_space(14.0);
            // `text-2xl font-bold tracking-tight`: the language card titles at 24 even on the
            // compact layout, unlike the wizard card, which uses `text-xl`.
            ui.label(
                RichText::new(texts.get("setup_language_title"))
                    .size(24.0)
                    .family(crate::theme::semibold())
                    .color(theme.palette.text),
            );
            ui.add_space(4.0);
            kit::muted(ui, theme, texts.get("setup_language_subtitle"));
            ui.add_space(12.0);
            // Disjoint bands, as in the wizard card: the list scrolls above, the button keeps its
            // own strip, so the last row can never overlap the button.
            let full = ui.available_rect_before_wrap();
            let footer_top = (full.bottom() - 44.0).max(full.top());
            let list_rect = Rect::from_min_max(
                full.min,
                Pos2::new(full.right(), (footer_top - 6.0).max(full.top())),
            );
            let footer_rect = Rect::from_min_max(Pos2::new(full.left(), footer_top), full.max);
            ui.allocate_ui_at_rect(list_rect, |ui| {
                // The comment above describes a scrolling list; without the scroll area the rows
                // below the band were cut off in a short window and the wheel moved nothing.
                egui::ScrollArea::vertical()
                    .max_height(list_rect.height())
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        for (language, badge, subtitle_key) in LANGUAGES {
                            if kit::language_row(
                                ui,
                                theme,
                                focus,
                                badge,
                                language_label(language),
                                texts.get(subtitle_key),
                                selected == language,
                                texts.get("setup_current_selection"),
                            ) {
                                state.language_choice = Some(language);
                            }
                            ui.add_space(10.0);
                        }
                    });
            });
            ui.allocate_ui_at_rect(footer_rect, |ui| {
                if kit::primary_button(ui, theme, focus, texts.get("setup_next")) {
                    state.setup_step = 1;
                }
            });
        },
    );
}

/// Step 2: account, profile picture, business header, password and recovery.
fn account_step(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    kit::field_label(ui, theme, texts.get("auth_display_name"), true);
    ui.add_space(4.0);
    kit::input(
        ui,
        theme,
        focus,
        &mut state.display_name,
        texts.get("auth_display_name"),
        texts.get("auth_display_name_hint"),
    );
    ui.add_space(10.0);
    kit::field_label(ui, theme, texts.get("auth_username"), true);
    ui.add_space(4.0);
    kit::input(
        ui,
        theme,
        focus,
        &mut state.username,
        texts.get("auth_username"),
        texts.get("auth_username_hint"),
    );
    ui.add_space(12.0);
    kit::field_label(ui, theme, texts.get("setup_account_type"), false);
    ui.add_space(6.0);
    kit::columns(ui, 10.0, 2, |ui, index, _| {
        let kind = if index == 0 {
            SetupAccountType::Personal
        } else {
            SetupAccountType::Business
        };
        let label = if index == 0 {
            texts.get("setup_account_type_personal")
        } else {
            texts.get("setup_account_type_business")
        };
        if kit::choice(
            ui,
            theme,
            focus,
            &format!("account-type-{index}"),
            label,
            state.account_type == kind,
        ) {
            // The legacy form resets the app selection to the template of the clicked type, so a
            // personal account cannot keep business modules from an earlier click.
            state.account_type = kind;
            state.template_choice = if kind == SetupAccountType::Personal {
                SetupTemplate::Personal
            } else {
                SetupTemplate::Business
            };
            state.setup_apps = template_apps_for(state.template_choice, kind)
                .iter()
                .map(|slug| (*slug).to_owned())
                .collect();
        }
    });

    ui.add_space(10.0);
    kit::field_label(ui, theme, texts.get("setup_profile_picture"), false);
    ui.add_space(6.0);
    kit::panel(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 14.0;
            kit::avatar(
                ui,
                theme,
                state.avatar.as_ref(),
                &kit::initials(&state.display_name),
                if ui.ctx().screen_rect().height() < 1000.0 {
                    48.0
                } else {
                    56.0
                },
            );
            ui.vertical(|ui| {
                if kit::small_button(
                    ui,
                    theme,
                    focus,
                    Icon::Upload,
                    texts.get("setup_upload_image"),
                ) {
                    if let Some(data) = pick_png() {
                        apply_avatar(state, &data);
                    }
                }
                // The legacy form offers a remove action next to the upload button while a
                // picture is set, so an accidental upload can be undone without reopening the
                // file picker.
                if state.avatar.is_some()
                    && kit::small_button(
                        ui,
                        theme,
                        focus,
                        Icon::Trash,
                        texts.get("setup_remove_image"),
                    )
                {
                    state.avatar = None;
                }
                ui.add_space(4.0);
                kit::hint(ui, theme, texts.get("setup_profile_picture_hint"));
            });
        });
    });
    for file in ui.ctx().input(|input| input.raw.dropped_files.clone()) {
        if let Some(bytes) = dropped_bytes(&file) {
            apply_avatar(state, &bytes);
        }
    }

    if state.account_type == SetupAccountType::Business {
        ui.add_space(12.0);
        business_panel(ui, theme, texts, focus, state);
    }

    ui.add_space(10.0);
    kit::field_label(ui, theme, texts.get("auth_password"), true);
    ui.add_space(4.0);
    kit::password_input(
        ui,
        theme,
        focus,
        &mut state.password,
        texts.get("auth_password_hint"),
        texts.get("auth_password"),
        kit::PasswordField {
            reveal: Some(&mut state.password_visible),
            ..Default::default()
        },
    );
    password_strength(ui, theme, texts, &state.password);
    ui.add_space(10.0);
    kit::field_label(ui, theme, texts.get("auth_password_confirm"), true);
    ui.add_space(4.0);
    kit::password_input(
        ui,
        theme,
        focus,
        &mut state.password_confirm,
        texts.get("auth_password_hint"),
        texts.get("auth_password_confirm"),
        kit::PasswordField {
            reveal: Some(&mut state.password_visible),
            ..Default::default()
        },
    );
    // The legacy form reports a difference while the user is still typing the confirmation
    // instead of waiting for the next click on "Continue".
    if !state.password_confirm.is_empty() && state.password != state.password_confirm {
        ui.add_space(3.0);
        ui.label(
            RichText::new(texts.get("auth_error_password_mismatch"))
                .size(11.0)
                .color(theme.palette.warning),
        );
    }

    ui.add_space(12.0);
    warning(ui, theme, texts.get("setup_password_warning"));

    // `auth.offlineNotice`: the reference explains the missing server right above the security
    // question, because that is where the recovery decision is taken.
    ui.add_space(12.0);
    warning(ui, theme, texts.get("setup_offline_notice"));

    // `auth.securityQuestionsTitle` + one select + answer of the legacy setup form.
    ui.add_space(12.0);
    kit::field_label(ui, theme, texts.get("setup_recovery_title"), false);
    ui.add_space(4.0);
    recovery_choice_selector(ui, theme, texts, state);
    if state.recovery_choice == RecoveryChoice::Custom {
        ui.add_space(8.0);
        kit::input(
            ui,
            theme,
            focus,
            &mut state.recovery_custom_question,
            texts.get("setup_recovery_custom"),
            texts.get("setup_recovery_custom"),
        );
    }
    if state.recovery_choice != RecoveryChoice::None {
        ui.add_space(8.0);
        kit::input(
            ui,
            theme,
            focus,
            &mut state.recovery_answer_one,
            texts.get("setup_answer"),
            texts.get("setup_answer"),
        );
    }
}

/// Compact select of the recovery question: the eight catalogue questions, a custom question and
/// the explicit "no question" choice of the TypeScript setup.
fn recovery_choice_selector(ui: &mut Ui, theme: &Theme, texts: &UiTexts, state: &mut AuthState) {
    let presets: Vec<&str> = RECOVERY_QUESTION_IDS
        .iter()
        .map(|id| texts.get(id))
        .collect();
    let labels: Vec<&str> = presets
        .iter()
        .copied()
        .chain([
            texts.get("setup_recovery_custom"),
            texts.get("setup_recovery_none"),
        ])
        .collect();
    let custom_index = RECOVERY_QUESTION_IDS.len();
    let selected = match state.recovery_choice {
        RecoveryChoice::Preset => state.recovery_preset.min(custom_index - 1),
        RecoveryChoice::Custom => custom_index,
        RecoveryChoice::None => custom_index + 1,
    };
    let rounding = egui::Rounding::same(12.0);
    let width = ui.available_width();
    ui.scope(|ui| {
        let style = ui.style_mut();
        style.spacing.interact_size.y = 34.0;
        style.spacing.button_padding = Vec2::new(10.0, 6.0);
        style.text_styles.insert(
            egui::TextStyle::Button,
            egui::FontId::new(12.5, crate::theme::semibold()),
        );
        for widget in [
            &mut style.visuals.widgets.inactive,
            &mut style.visuals.widgets.hovered,
            &mut style.visuals.widgets.active,
            &mut style.visuals.widgets.open,
        ] {
            widget.rounding = rounding;
            widget.expansion = 0.0;
            widget.bg_fill = theme.palette.surface;
            widget.bg_stroke = egui::Stroke::new(1.0_f32, kit::hairline_color(theme));
            widget.fg_stroke.color = theme.palette.text;
        }
        style.visuals.widgets.hovered.bg_fill = theme.palette.surface_muted;
        style.visuals.widgets.active.bg_fill = theme.palette.surface_muted;
        egui::ComboBox::from_id_source("socdof-setup-recovery")
            .selected_text(labels[selected])
            .width(width - 8.0)
            .show_ui(ui, |ui| {
                for (index, label) in labels.iter().enumerate() {
                    if ui.selectable_label(selected == index, *label).clicked() {
                        if index < custom_index {
                            state.recovery_choice = RecoveryChoice::Preset;
                            state.recovery_preset = index;
                        } else if index == custom_index {
                            state.recovery_choice = RecoveryChoice::Custom;
                        } else {
                            state.recovery_choice = RecoveryChoice::None;
                        }
                    }
                }
            });
    });
}

/// Strength row of the setup password: label, five-step bar and the tips line.
///
/// The scoring follows the TypeScript wizard ([`computePasswordStrength`] in `AuthGate.tsx`):
/// length 8, length 12, mixed case, digits and symbols are the five points that move the label.
fn password_strength(ui: &mut Ui, theme: &Theme, texts: &UiTexts, password: &str) {
    let length = password.chars().count();
    let mut points = 0;
    if length >= 8 {
        points += 1;
    }
    if length >= 12 {
        points += 1;
    }
    if password.chars().any(char::is_lowercase) && password.chars().any(char::is_uppercase) {
        points += 1;
    }
    if password.chars().any(|c| c.is_ascii_digit()) {
        points += 1;
    }
    if password.chars().any(|c| !c.is_alphanumeric()) {
        points += 1;
    }
    let (key, color, percent) = if length == 0 {
        return;
    } else if length < 6 {
        ("setup_strength_very_weak", tint(0xf43f5e), 20.0)
    } else if points <= 2 {
        ("setup_strength_weak", tint(0xf59e0b), 40.0)
    } else if points == 3 {
        ("setup_strength_ok", tint(0xeab308), 65.0)
    } else if points == 4 {
        ("setup_strength_strong", tint(0x10b981), 85.0)
    } else {
        ("setup_strength_very_strong", tint(0x059669), 100.0)
    };

    ui.add_space(6.0);
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 0.0;
        ui.label(
            RichText::new(format!("{}: ", texts.get("setup_strength_label")))
                .size(11.0)
                .color(theme.palette.text_muted),
        );
        ui.label(
            RichText::new(texts.get(key))
                .size(11.0)
                .family(crate::theme::semibold())
                .color(color),
        );
    });
    ui.add_space(4.0);
    let (track, _) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 6.0), egui::Sense::hover());
    ui.painter().rect(
        track,
        egui::Rounding::same(3.0),
        kit::inset_fill(theme),
        egui::Stroke::NONE,
    );
    let filled = Rect::from_min_size(
        track.min,
        Vec2::new(track.width() * percent / 100.0, track.height()),
    );
    ui.painter()
        .rect(filled, egui::Rounding::same(3.0), color, egui::Stroke::NONE);
    ui.add_space(4.0);
    kit::hint(ui, theme, texts.get("setup_password_tips"));
}

/// Amber note of the legacy account form (`bg-amber-50 border-amber-200`).
fn warning(ui: &mut Ui, theme: &Theme, text: &str) {
    let fill = if kit::dark(theme) {
        egui::Color32::from_rgba_unmultiplied(120, 53, 15, 40)
    } else {
        egui::Color32::from_rgb(0xff, 0xfb, 0xeb)
    };
    egui::Frame::none()
        .fill(fill)
        .stroke(egui::Stroke::new(
            1.0_f32,
            crate::tokens::with_alpha(theme.palette.warning, 55),
        ))
        .rounding(egui::Rounding::same(12.0))
        .inner_margin(egui::Margin::same(12.0))
        .show(ui, |ui| {
            // A label inside a horizontal row sees an unbounded width and does not wrap, so the
            // warning ran out of the card in a narrow window. The text gets its own column, which
            // wraps at the width the icon leaves over.
            let text_width = (ui.available_width() - 16.0 - 8.0).max(40.0);
            ui.horizontal_top(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;
                let (rect, _) = ui.allocate_exact_size(Vec2::splat(16.0), egui::Sense::hover());
                Icon::Info.draw(ui.painter(), rect, theme.palette.warning, 1.5);
                ui.allocate_ui_with_layout(
                    Vec2::new(text_width, 0.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                        ui.add(
                            egui::Label::new(RichText::new(text).size(12.0).color(
                                if kit::dark(theme) {
                                    theme.palette.warning
                                } else {
                                    egui::Color32::from_rgb(0x92, 0x40, 0x0e)
                                },
                            ))
                            .wrap(true),
                        );
                    },
                );
            });
        });
}

/// Company header panel of the business account type.
fn business_panel(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    kit::panel(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 12.0;
            kit::icon_tile(ui, Icon::Building, 36.0, theme.accent.base);
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(texts.get("setup_company_panel_title"))
                        .size(14.5)
                        .family(crate::theme::semibold())
                        .color(theme.palette.text),
                );
                kit::hint(ui, theme, texts.get("setup_company_panel_subtitle"));
            });
            ui.with_layout(Layout::right_to_left(Align::Min), |ui| {
                if kit::link(ui, theme, focus, texts.get("setup_company_fill_later")) {
                    state.setup_business_skipped = !state.setup_business_skipped;
                }
            });
        });
        if state.setup_business_skipped {
            return;
        }
        ui.add_space(12.0);
        kit::field_label(ui, theme, texts.get("setup_company_name"), true);
        ui.add_space(4.0);
        kit::input(
            ui,
            theme,
            focus,
            &mut state.company_name,
            texts.get("setup_company_name_hint"),
            texts.get("setup_company_name"),
        );
        ui.add_space(3.0);
        kit::hint(ui, theme, texts.get("setup_company_name_note"));
        ui.add_space(10.0);
        kit::columns(ui, 10.0, 2, |ui, index, _| {
            if index == 0 {
                kit::field_label(ui, theme, texts.get("setup_company_street"), false);
                ui.add_space(4.0);
                kit::input(
                    ui,
                    theme,
                    focus,
                    &mut state.company_street,
                    texts.get("setup_company_street_hint"),
                    texts.get("setup_company_street"),
                );
            } else {
                kit::field_label(ui, theme, texts.get("setup_company_zip"), false);
                ui.add_space(4.0);
                kit::input(
                    ui,
                    theme,
                    focus,
                    &mut state.company_zip_city,
                    texts.get("setup_company_zip_hint"),
                    texts.get("setup_company_zip"),
                );
            }
        });
        ui.add_space(10.0);
        kit::field_label(ui, theme, texts.get("setup_company_currency"), false);
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 8.0;
            for symbol in ["€", "$", "CHF", "£"] {
                if kit::currency_choice(ui, theme, focus, symbol, state.company_currency == symbol)
                {
                    state.company_currency = symbol.to_string();
                }
            }
        });
        ui.add_space(10.0);
        kit::columns(ui, 10.0, 2, |ui, index, _| {
            if index == 0 {
                kit::field_label(ui, theme, texts.get("setup_company_email"), false);
                ui.add_space(4.0);
                kit::input(
                    ui,
                    theme,
                    focus,
                    &mut state.company_email,
                    texts.get("setup_company_email_hint"),
                    texts.get("setup_company_email"),
                );
            } else {
                kit::field_label(ui, theme, texts.get("setup_company_tax"), false);
                ui.add_space(4.0);
                kit::input(
                    ui,
                    theme,
                    focus,
                    &mut state.company_tax_id,
                    texts.get("setup_company_tax_hint"),
                    texts.get("setup_company_tax"),
                );
            }
        });
    });
}

/// Step 3: accent, appearance and desktop background.
fn appearance_step(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    // `p-3.5 sm:p-4 space-y-3.5` panel: `p-2 rounded-xl` accent tile, title block and skip link.
    kit::panel(ui, theme, |ui| {
        // `space-y-3.5` of the legacy panel is expressed with the explicit gaps below; egui's own
        // vertical item spacing would add roughly 8 points on top of every gap.
        ui.spacing_mut().item_spacing.y = 0.0;
        let width = ui.available_width();
        let link_width = 84.0;
        let text_width = (width - 32.0 - 10.0 - link_width).max(120.0);
        // `flex items-start`: the skip link sits on the title's first line, not in the middle of
        // the whole text block.
        ui.with_layout(Layout::left_to_right(Align::Min), |ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            let (tile, _) = ui.allocate_exact_size(Vec2::splat(32.0), egui::Sense::hover());
            ui.painter().rect(
                tile,
                egui::Rounding::same(12.0),
                theme.accent.base,
                egui::Stroke::NONE,
            );
            Icon::Palette.draw(
                ui.painter(),
                egui::Rect::from_center_size(tile.center(), Vec2::splat(16.0)),
                egui::Color32::WHITE,
                1.6,
            );
            ui.add_space(8.0);
            ui.allocate_ui_with_layout(
                Vec2::new(text_width, 0.0),
                Layout::top_down(Align::Min),
                |ui| {
                    ui.set_width(text_width);
                    ui.label(
                        RichText::new(texts.get("setup_workspace_panel_title"))
                            .size(14.0)
                            .family(crate::theme::semibold())
                            .color(theme.palette.text),
                    );
                    ui.label(
                        RichText::new(texts.get("setup_workspace_panel_subtitle"))
                            .size(11.0)
                            .color(theme.palette.text_muted),
                    );
                },
            );
            // `auth.setupSkip` turns the whole optional block off: appearance and apps are left
            // out and the wizard continues on the finish step.
            if kit::link(ui, theme, focus, texts.get("setup_skip_extras")) {
                state.setup_skip_extras = true;
                state.setup_step = SETUP_STEPS - 1;
            }
        });

        ui.add_space(6.0);
        section_label(ui, theme, Icon::Palette, texts.get("accent_title"));
        ui.add_space(2.0);

        // `grid grid-cols-5 sm:grid-cols-9 gap-2`, every swatch `h-9 rounded-xl border-2`.
        let current = state
            .accent_choice
            .clone()
            .unwrap_or_else(|| theme.accent.id.clone());
        let columns: usize = if kit::compact(ui) { 5 } else { 9 };
        let gap = 8.0;
        let cell = ((width - gap * (columns - 1) as f32) / columns as f32).max(26.0);
        let ids: Vec<&str> = crate::tokens::preset_ids().collect();
        let mut rows_left = ids.len().div_ceil(columns);
        for row in ids.chunks(columns) {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = gap;
                for id in row {
                    let preset = crate::tokens::AccentPreset::resolve(id);
                    let selected = current == *id;
                    let (rect, response) =
                        ui.allocate_exact_size(Vec2::new(cell, 36.0), egui::Sense::click());
                    if response.clicked() {
                        state.accent_choice = Some((*id).to_string());
                    }
                    if selected {
                        ui.painter().rect(
                            rect.expand(2.0),
                            egui::Rounding::same(14.0),
                            egui::Color32::TRANSPARENT,
                            egui::Stroke::new(1.6_f32, theme.accent.base),
                        );
                    }
                    ui.painter().rect(
                        rect,
                        egui::Rounding::same(10.0),
                        preset.base,
                        egui::Stroke::new(2.0_f32, egui::Color32::WHITE),
                    );
                    if selected {
                        Icon::Check.draw(
                            ui.painter(),
                            egui::Rect::from_center_size(rect.center(), Vec2::splat(16.0)),
                            egui::Color32::WHITE,
                            2.0,
                        );
                    }
                }
            });
            rows_left -= 1;
            if rows_left > 0 {
                ui.add_space(4.0);
            }
        }

        ui.add_space(6.0);
        section_label(ui, theme, Icon::Sun, texts.get("setup_display_mode"));
        ui.add_space(2.0);
        let mode = state
            .theme_mode_choice
            .unwrap_or(if theme.appearance.is_dark() {
                ThemeMode::Dark
            } else {
                ThemeMode::Light
            });
        let selected = match mode {
            ThemeMode::Light => 0,
            ThemeMode::Dark => 1,
            ThemeMode::System => 2,
        };
        ui.allocate_ui_with_layout(Vec2::new(width, 0.0), Layout::top_down(Align::Min), |ui| {
            ui.set_width(width);
            if let Some(index) = kit::segmented(
                ui,
                theme,
                focus,
                "setup-mode",
                &[
                    (Icon::Sun, texts.get("setup_appearance_light")),
                    (Icon::Moon, texts.get("setup_appearance_dark")),
                    (Icon::Monitor, texts.get("setup_appearance_system")),
                ],
                selected,
            ) {
                state.theme_mode_choice = Some(match index {
                    0 => ThemeMode::Light,
                    1 => ThemeMode::Dark,
                    _ => ThemeMode::System,
                });
            }
        });

        ui.add_space(6.0);
        section_label(ui, theme, Icon::Monitor, texts.get("wallpaper_title"));
        ui.add_space(2.0);
        // `p-2.5` row with a `h-12 w-20` preview thumbnail.
        egui::Frame::none()
            .fill(kit::inset_fill(theme))
            .stroke(egui::Stroke::new(1.0_f32, kit::hairline_color(theme)))
            .rounding(egui::Rounding::same(12.0))
            .inner_margin(egui::Margin::same(10.0))
            .show(ui, |ui| {
                let width = ui.available_width();
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 12.0;
                    let (thumb, _) =
                        ui.allocate_exact_size(Vec2::new(80.0, 48.0), egui::Sense::hover());
                    // `border border-dashed`: the empty preview is a dashed drop target, not a box.
                    let dash = egui::Stroke::new(1.0_f32, kit::hairline_color(theme));
                    let corners = [
                        thumb.left_top(),
                        thumb.right_top(),
                        thumb.right_bottom(),
                        thumb.left_bottom(),
                        thumb.left_top(),
                    ];
                    for pair in corners.windows(2) {
                        ui.painter().add(egui::Shape::dashed_line(
                            &[pair[0], pair[1]],
                            dash,
                            4.0,
                            3.0,
                        ));
                    }
                    Icon::Grid.draw(
                        ui.painter(),
                        egui::Rect::from_center_size(thumb.center(), Vec2::splat(18.0)),
                        theme.palette.text_muted,
                        1.5,
                    );
                    let text_width = (width - 80.0 - 12.0).max(120.0);
                    ui.allocate_ui_with_layout(
                        Vec2::new(text_width, 0.0),
                        Layout::top_down(Align::Min),
                        |ui| {
                            ui.set_width(text_width);
                            ui.label(
                                RichText::new(texts.get("setup_wallpaper_hint"))
                                    .size(11.0)
                                    .color(theme.palette.text_muted),
                            );
                            ui.add_space(2.0);
                            ui.horizontal(|ui| {
                                ui.spacing_mut().item_spacing.x = 12.0;
                                if kit::link(ui, theme, focus, texts.get("setup_wallpaper_choose"))
                                {
                                    if let Some(data) = pick_png() {
                                        apply_wallpaper(state, &data);
                                    }
                                }
                                // `auth.setupWallpaperRemove`: resets the choice to the plain
                                // gradient, which the host applies as the persistent wallpaper.
                                if state.wallpaper_picked
                                    && kit::link(ui, theme, focus, texts.get("setup_remove_image"))
                                {
                                    state.wallpaper_custom = None;
                                    state.wallpaper_picked = false;
                                    state.wallpaper_choice =
                                        Some(crate::wallpaper::Wallpaper::Plain);
                                }
                            });
                        },
                    );
                });
            });
        for file in ui.ctx().input(|input| input.raw.dropped_files.clone()) {
            if let Some(bytes) = dropped_bytes(&file) {
                apply_wallpaper(state, &bytes);
            }
        }
    });
}

/// Step 4: template cards and the individual app selection.
fn apps_step(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
) {
    if state.setup_apps.is_empty() {
        state.setup_apps = template_apps_for(state.template_choice, state.account_type)
            .iter()
            .map(|slug| (*slug).to_owned())
            .collect();
    }
    section_row(ui, theme, texts.get("setup_apps_panel_title"), None);
    ui.add_space(6.0);
    if kit::link(ui, theme, focus, texts.get("setup_skip_extras")) {
        state.setup_skip_extras = true;
        state.setup_step = SETUP_STEPS - 1;
    }
    ui.add_space(8.0);
    // The legacy cards hide business and retail for a personal account.
    let templates: Vec<_> = TEMPLATES
        .iter()
        .filter(|(template, ..)| {
            state.account_type == SetupAccountType::Business
                || matches!(template, SetupTemplate::Personal | SetupTemplate::Practice)
        })
        .collect();
    for row in templates.chunks(2) {
        kit::columns(ui, 10.0, 2, |ui, index, _| {
            if let Some((template, icon, title_key, description_key, color)) =
                row.get(index).copied()
            {
                if kit::app_tile(
                    ui,
                    theme,
                    focus,
                    &format!("template-{:?}", template),
                    *icon,
                    tint(*color),
                    texts.get(title_key),
                    texts.get(description_key),
                    state.template_choice == *template,
                ) {
                    state.template_choice = *template;
                    state.setup_apps = template_apps_for(*template, state.account_type)
                        .iter()
                        .map(|slug| (*slug).to_owned())
                        .collect();
                }
            }
        });
        ui.add_space(10.0);
    }
    ui.add_space(2.0);
    section_row(
        ui,
        theme,
        texts.get("setup_apps_select"),
        Some(texts.get("setup_apps_hint")),
    );
    ui.add_space(8.0);
    let modules = socdof_core::app_store::modules(store).unwrap_or_default();
    let rows: Vec<_> = modules
        .iter()
        .filter(|module| module.license != socdof_core::app_store::ModuleLicense::Locked)
        .filter(|module| module_visible_for(state.account_type, module.module.as_str()))
        .collect();
    for row in rows.chunks(2) {
        kit::columns(ui, 10.0, 2, |ui, index, _| {
            if let Some(module) = row.get(index) {
                let slug = module.module.as_str();
                let chrome = crate::chrome::app_chrome(slug);
                let selected = state.setup_apps.iter().any(|item| item == slug);
                if kit::app_tile(
                    ui,
                    theme,
                    focus,
                    slug,
                    chrome.icon,
                    crate::chrome::tint(chrome),
                    texts.get(module.name_key),
                    texts.get(module.description_key),
                    selected,
                ) {
                    if selected {
                        state.setup_apps.retain(|item| item != slug);
                    } else {
                        state.setup_apps.push(slug.to_string());
                    }
                }
            }
        });
        ui.add_space(10.0);
    }
}

/// Paints a section heading with an optional hint.
///
/// The hint sits on the right of the same row while both texts and a 24 point gap fit into the
/// panel; on a phone it moves below the heading instead of being painted over it.
fn section_row(ui: &mut Ui, theme: &Theme, label: &str, hint: Option<&str>) {
    let label_width = ui
        .painter()
        .layout_no_wrap(
            label.to_owned(),
            FontId::new(13.0, crate::theme::semibold()),
            theme.palette.text,
        )
        .size()
        .x;
    let side_by_side = hint.is_some_and(|hint| {
        let hint_width = ui
            .painter()
            .layout_no_wrap(
                hint.to_owned(),
                FontId::new(12.0, FontFamily::Proportional),
                theme.palette.text_muted,
            )
            .size()
            .x;
        label_width + hint_width + 24.0 <= ui.available_width()
    });
    if let (true, Some(hint)) = (side_by_side, hint) {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(label)
                    .size(13.0)
                    .family(crate::theme::semibold())
                    .color(theme.palette.text),
            );
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                kit::hint(ui, theme, hint);
            });
        });
    } else {
        ui.label(
            RichText::new(label)
                .size(13.0)
                .family(crate::theme::semibold())
                .color(theme.palette.text),
        );
        if let Some(hint) = hint {
            kit::hint(ui, theme, hint);
        }
    }
}

/// Step 5: summary before the account is created.
fn finish_step(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    kit::muted(ui, theme, texts.get("setup_wizard_finish_body"));
    if state.setup_skip_extras {
        ui.add_space(10.0);
        kit::panel(ui, theme, |ui| {
            ui.horizontal_top(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;
                let (rect, _) = ui.allocate_exact_size(Vec2::splat(16.0), egui::Sense::hover());
                Icon::Info.draw(ui.painter(), rect, theme.palette.text_muted, 1.5);
                ui.allocate_ui_with_layout(
                    Vec2::new((ui.available_width() - 4.0).max(80.0), 0.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                        ui.label(
                            RichText::new(texts.get("setup_skip_notice"))
                                .size(11.5)
                                .color(theme.palette.text_muted),
                        );
                        if kit::link(ui, theme, focus, texts.get("setup_enable_extras")) {
                            state.setup_skip_extras = false;
                            state.setup_step = 3;
                        }
                    },
                );
            });
        });
    }
    ui.add_space(10.0);
    kit::panel(ui, theme, |ui| {
        let rows = [
            (texts.get("auth_display_name"), state.display_name.clone()),
            (texts.get("auth_username"), state.username.clone()),
            (
                texts.get("setup_template_label"),
                texts
                    .get(match state.template_choice {
                        SetupTemplate::Personal => "setup_template_personal",
                        SetupTemplate::Business => "setup_template_business",
                        SetupTemplate::Practice => "setup_template_practice",
                        SetupTemplate::Retail => "setup_template_retail",
                        SetupTemplate::All => "setup_template_all",
                    })
                    .to_string(),
            ),
            (
                texts.get("setup_step_apps"),
                format!("{}", state.setup_apps.len()),
            ),
        ];
        for (label, value) in rows {
            ui.horizontal(|ui| {
                kit::hint(ui, theme, label);
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    ui.label(
                        RichText::new(value)
                            .size(12.5)
                            .family(crate::theme::semibold())
                            .color(theme.palette.text),
                    );
                });
            });
        }
    });
}

/// Small icon and label heading inside a panel.
fn section_label(ui: &mut Ui, theme: &Theme, icon: Icon, label: &str) {
    // `text-xs font-semibold` with a 14 point icon on a single 16 point line.
    let (rect, _) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 16.0), egui::Sense::hover());
    icon.draw(
        ui.painter(),
        egui::Rect::from_min_size(Pos2::new(rect.left(), rect.top() + 1.0), Vec2::splat(14.0)),
        theme.palette.text_muted,
        1.4,
    );
    let galley = ui.painter().layout_no_wrap(
        label.to_owned(),
        egui::FontId::new(12.0, crate::theme::semibold()),
        theme.palette.text,
    );
    ui.painter().galley(
        Pos2::new(rect.left() + 20.0, rect.center().y - galley.size().y * 0.5),
        galley,
        theme.palette.text,
    );
}

/// Compact language dropdown of the wizard header.
pub(crate) fn language_selector(
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &mut AuthState,
) {
    let current = state.language_choice.unwrap_or_else(|| texts.language());
    let mut selected = current;
    // The legacy header uses a compact `text-xs` select (`rounded-xl border px-2.5 py-1`), so the
    // scoped style shrinks egui's default combo box to the same 28 point row.
    let rounding = egui::Rounding::same(12.0);
    ui.scope(|ui| {
        let style = ui.style_mut();
        style.spacing.interact_size.y = 28.0;
        style.spacing.button_padding = Vec2::new(10.0, 4.0);
        style.text_styles.insert(
            egui::TextStyle::Button,
            egui::FontId::new(12.0, crate::theme::semibold()),
        );
        for widget in [
            &mut style.visuals.widgets.inactive,
            &mut style.visuals.widgets.hovered,
            &mut style.visuals.widgets.active,
            &mut style.visuals.widgets.open,
        ] {
            widget.rounding = rounding;
            widget.expansion = 0.0;
            widget.bg_fill = theme.palette.surface;
            widget.bg_stroke = egui::Stroke::new(1.0_f32, crate::auth_kit::hairline_color(theme));
            widget.fg_stroke.color = theme.palette.text;
        }
        style.visuals.widgets.hovered.bg_fill = theme.palette.surface_muted;
        style.visuals.widgets.active.bg_fill = theme.palette.surface_muted;
        egui::ComboBox::from_id_source("socdof-setup-language")
            .selected_text(language_label(current))
            .width(96.0)
            .show_ui(ui, |ui| {
                for language in socdof_core::i18n::EMBEDDED_LANGUAGES {
                    if ui
                        .selectable_label(current == language, language_label(language))
                        .clicked()
                    {
                        selected = language;
                    }
                }
            });
    });
    if selected != current {
        state.language_choice = Some(selected);
    }
}

fn dropped_bytes(file: &egui::DroppedFile) -> Option<Vec<u8>> {
    match (&file.bytes, &file.path) {
        (Some(bytes), _) => Some(bytes.to_vec()),
        (None, Some(path)) => std::fs::read(path).ok(),
        _ => None,
    }
}

/// Decodes a PNG and masks it into a circle so the avatar needs no clip path.
fn avatar_image(data: &[u8], revision: u64) -> Option<crate::wallpaper::CustomWallpaper> {
    let (width, height, mut rgba) = crate::wallpaper::decode_png(data).ok()?;
    let center_x = width as f32 * 0.5;
    let center_y = height as f32 * 0.5;
    let radius = center_x.min(center_y);
    for y in 0..height {
        for x in 0..width {
            let dx = x as f32 + 0.5 - center_x;
            let dy = y as f32 + 0.5 - center_y;
            let distance = (dx * dx + dy * dy).sqrt();
            if distance > radius {
                rgba[(y * width + x) * 4 + 3] = 0;
            } else if distance > radius - 1.5 {
                let alpha = ((radius - distance) / 1.5).clamp(0.0, 1.0);
                rgba[(y * width + x) * 4 + 3] =
                    (rgba[(y * width + x) * 4 + 3] as f32 * alpha) as u8;
            }
        }
    }
    Some(crate::wallpaper::CustomWallpaper {
        width,
        height,
        pixels: std::sync::Arc::new(rgba),
        revision,
    })
}

fn apply_avatar(state: &mut AuthState, data: &[u8]) {
    match avatar_image(data, 1) {
        Some(image) => state.avatar = Some(image),
        None => state.error = Some("setup_wallpaper_invalid"),
    }
}

fn apply_wallpaper(state: &mut AuthState, data: &[u8]) {
    match crate::wallpaper::decode_png(data) {
        Ok((width, height, rgba)) => {
            state.wallpaper_custom = Some(crate::wallpaper::CustomWallpaper {
                width,
                height,
                pixels: std::sync::Arc::new(rgba),
                revision: 0,
            });
            state.wallpaper_picked = true;
        }
        Err(_) => state.error = Some("setup_wallpaper_invalid"),
    }
}

#[cfg(feature = "dialogs")]
fn pick_png() -> Option<Vec<u8>> {
    rfd::FileDialog::new()
        .add_filter("PNG", &["png"])
        .pick_file()
        .and_then(|path| std::fs::read(path).ok())
}

#[cfg(not(feature = "dialogs"))]
fn pick_png() -> Option<Vec<u8>> {
    None
}
