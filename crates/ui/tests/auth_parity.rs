//! Sign-in parity tests: passwordless accounts, single-user auto login, quick switch, clock
//! settings and stored account pictures.
//!
//! The reference implementation lives in `SOCDOF - TS/src/lib/auth.ts`
//! (`quickSwitchUser`, `tryAutoLoginSingleUser`) and `SOCDOF - TS/src/lib/i18n.ts`
//! (`formatSystemTime`, `formatSystemDate`). Every behaviour is rendered at the desktop width and
//! at a phone width so the account strip and the clock row keep fitting.

use egui::{Pos2, RawInput, Rect, Vec2};
use socdof_core::auth_security::AuthSecuritySettings;
use socdof_core::domain::settings::{CompanyProfile, Language};
use socdof_core::domain::user::{User, UserRole};
use socdof_core::security::hash_password;
use socdof_core::settings_service;
use socdof_core::store::Store;
use socdof_ui::auth::{auth, AuthState, AuthView};
use socdof_ui::desktop::ClockSettings;
use socdof_ui::focus::FocusState;
use socdof_ui::i18n::UiTexts;
use socdof_ui::snapshot::signature;
use socdof_ui::theme::{Appearance, Theme};
use uuid::Uuid;

const NOW: i64 = socdof_ui::dashboard::SAMPLE_NOW_MS;

fn account(store: &Store, username: &str, display_name: &str, passwordless: bool) -> User {
    let user = User {
        id: Uuid::new_v4(),
        username: username.to_string(),
        display_name: display_name.to_string(),
        role: if passwordless {
            UserRole::User
        } else {
            UserRole::Admin
        },
        role_id: None,
        active: true,
        password_hash: hash_password("Socdof2026!").expect("hash"),
        must_change_password: false,
        passwordless,
        created_at: NOW,
        updated_at: NOW,
    };
    store.insert_user(&user).expect("insert user");
    user
}

fn input(width: f32, height: f32) -> RawInput {
    RawInput {
        screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(width, height))),
        time: Some(1.0),
        ..Default::default()
    }
}

fn render_auth(state: &mut AuthState, store: &Store, width: f32, height: f32) -> Vec<String> {
    let ctx = socdof_ui::theme::headless_context();
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    let theme = Theme::new(Appearance::Light, "indigo");
    let mut focus = FocusState::default();
    let mut output = None;
    for _ in 0..2 {
        output = Some(ctx.run(input(width, height), |ctx| {
            auth(ctx, &theme, &texts, &mut focus, state, store, NOW);
        }));
    }
    signature(&output.expect("auth frame"))
}

fn painted(lines: &[String], text: &str) -> bool {
    let needle = format!("{:?}", text);
    lines.iter().any(|line| line.contains(&needle))
}

/// A passwordless account shows one "continue as" button, no password field, and signs in
/// directly on both viewports.
#[test]
fn passwordless_accounts_sign_in_without_a_password_field() {
    let store = Store::open_in_memory().expect("store");
    let guest = account(&store, "gast", "Gast Nutzer", true);
    let mut state = AuthState::new(&store, NOW).expect("auth state");
    state.username = guest.username.clone();

    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    let continue_label = texts
        .get("auth_continue_as")
        .replace("{name}", "Gast Nutzer");
    for (width, height) in [(900.0, 700.0), (360.0, 760.0)] {
        let lines = render_auth(&mut state, &store, width, height);
        assert!(
            painted(&lines, &continue_label),
            "the continue button must be painted at {width}px"
        );
        assert!(
            !painted(&lines, texts.get("auth_password_hint")),
            "a passwordless account must not show a password field at {width}px"
        );
    }

    state
        .quick_switch_to(&store, guest.id, NOW)
        .expect("quick switch");
    assert_eq!(state.view, AuthView::Unlocked);
    assert_eq!(state.user.as_ref().map(|user| user.id), Some(guest.id));
}

/// The reference `tryAutoLoginSingleUser`: only with the switch, exactly one account and no
/// lockout.
#[test]
fn single_user_auto_login_follows_the_security_switch() {
    let store = Store::open_in_memory().expect("store");
    let admin = account(&store, "admin", "Administrator", false);

    let state = AuthState::new(&store, NOW).expect("auth state");
    assert_eq!(state.view, AuthView::Login);

    socdof_core::auth_security::save(
        &store,
        &AuthSecuritySettings {
            auto_login_single_user: true,
            allow_quick_user_switch: true,
        },
    )
    .expect("save security settings");
    let state = AuthState::new(&store, NOW).expect("auth state");
    assert_eq!(state.view, AuthView::Unlocked);
    assert_eq!(state.user.as_ref().map(|user| user.id), Some(admin.id));

    // After an explicit sign-out the login screen shows the reference auto-login card.
    let mut state = AuthState::new(&store, NOW).expect("auth state");
    state.sign_out(&store, NOW).expect("sign out");
    assert_eq!(state.view, AuthView::Login);
    let texts = UiTexts::embedded(Language::De).expect("catalogue");
    let lines = render_auth(&mut state, &store, 360.0, 760.0);
    assert!(
        painted(&lines, texts.get("auth_autologin_notice")),
        "the single-user auto-login card must be painted"
    );
    state.auto_login(&store, NOW).expect("auto login");
    assert_eq!(state.view, AuthView::Unlocked);

    // A second account stops the automatic sign-in.
    account(&store, "gast", "Gast Nutzer", true);
    let state = AuthState::new(&store, NOW).expect("auth state");
    assert_eq!(state.view, AuthView::Login);
}

/// Clock settings of the company profile drive the sign-in and lock clock and both date rows.
#[test]
fn clock_settings_drive_the_sign_in_and_lock_clock() {
    let store = Store::open_in_memory().expect("store");
    account(&store, "admin", "Administrator", false);
    let profile = CompanyProfile {
        name: "Strudelcode GmbH".to_string(),
        date_format: "MM/DD/YYYY".to_string(),
        time_show_seconds: Some(true),
        timezone: "UTC".to_string(),
        ..CompanyProfile::default()
    };
    settings_service::save_company_profile(&store, &profile).expect("profile");

    let mut state = AuthState::new(&store, NOW).expect("auth state");
    let clock = socdof_core::date::format_time(NOW, true, "UTC");
    let date = socdof_core::date::format_date_style(NOW, "MM/DD/YYYY", "UTC");
    for (width, height) in [(900.0, 700.0), (360.0, 760.0)] {
        let lines = render_auth(&mut state, &store, width, height);
        assert!(painted(&lines, &clock), "login clock at {width}px");
        assert!(painted(&lines, &date), "login date at {width}px");
    }

    state.username = "admin".to_string();
    state.password = "Socdof2026!".to_string();
    state.login(&store, NOW).expect("password login");
    state.lock(NOW);
    assert_eq!(state.view, AuthView::Locked);
    let lines = render_auth(&mut state, &store, 900.0, 700.0);
    assert!(painted(&lines, &clock), "lock screen clock");
    assert!(painted(&lines, &date), "lock screen date");

    // The taskbar follows the reference switches: seconds off only for `Some(false)`, and the
    // selected date format and zone always apply.
    let taskbar = ClockSettings::from_profile(&CompanyProfile {
        name: "Strudelcode GmbH".to_string(),
        date_format: "YYYY-MM-DD".to_string(),
        time_show_seconds: Some(false),
        timezone: "America/New_York".to_string(),
        ..CompanyProfile::default()
    });
    assert_eq!(
        taskbar.taskbar_time(NOW),
        socdof_core::date::format_time_24h(NOW, false, "America/New_York")
    );
    assert_eq!(
        taskbar.taskbar_date(NOW),
        socdof_core::date::format_date_style(NOW, "YYYY-MM-DD", "America/New_York")
    );
    assert!(!ClockSettings::default().sign_in_seconds());
    assert!(ClockSettings::default().taskbar_seconds());
}

/// The account strips draw the stored profile picture and fall back to initials only when the
/// account has none.
#[test]
fn account_strips_use_stored_profile_pictures() {
    let store = Store::open_in_memory().expect("store");
    let guest = account(&store, "gast", "Gast Nutzer", true);
    let admin = account(&store, "admin", "Administrator", false);
    let png = settings_service::encode_png_data_url(1, 1, &[220, 40, 40, 255]).expect("png");
    settings_service::save_user_avatar(&store, admin.id, Some(&png)).expect("avatar");

    let mut state = AuthState::new(&store, NOW).expect("auth state");
    let picture = state
        .avatar_for(&store, admin.id)
        .expect("stored profile picture");
    assert_eq!((picture.width, picture.height), (1, 1));
    assert!(
        state.avatar_for(&store, guest.id).is_none(),
        "an account without a picture falls back to initials"
    );

    // Rendering the strips with a decoded picture must work on the phone width too.
    let lines = render_auth(&mut state, &store, 360.0, 760.0);
    assert!(painted(&lines, "Administrator"));
    assert!(painted(&lines, "Gast"));
}
