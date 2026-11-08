//! Login, first-run setup and the lock screen.
//!
//! The screen drives the real session path in the core: [`Store::login`] counts failed attempts and
//! honours the persistent lockout, [`Store::authenticate`] verifies the password on unlock,
//! [`Store::touch_session`] records activity and [`Store::sign_out`] revokes the session. First-run
//! setup creates the first administrator through [`Store::insert_user`] with an Argon2id hash.
//!
//! Inactivity is tracked in the screen state: after [`DEFAULT_IDLE_TIMEOUT_MS`] without input the
//! session is locked and only the account password opens it again. Locking never destroys the
//! session, so unlocking keeps the user in the app; signing out revokes it.

use egui::{Context, Key, RichText};
use socdof_core::domain::session::{LoginOutcome, Session, LOCKOUT_MS, MAX_FAILED_ATTEMPTS};
use socdof_core::domain::user::{User, UserRole};
use socdof_core::security::{hash_password, MIN_PASSWORD_LENGTH};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{badge, button, card, ButtonVariant, Tone};
use crate::controls::{password_field, text_field};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Inactivity after which the session is locked automatically.
pub const DEFAULT_IDLE_TIMEOUT_MS: i64 = 5 * 60 * 1000;

/// Screen currently shown by the authentication flow.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AuthView {
    /// Sign-in form.
    #[default]
    Login,
    /// First-run form that creates the first administrator.
    Setup,
    /// Session locked; only the password opens it.
    Locked,
    /// Signed-in overview with manual lock and sign-out.
    Unlocked,
}

/// State of the login and lock screens.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AuthState {
    /// Current screen.
    pub view: AuthView,
    /// Login name.
    pub username: String,
    /// Display name used by first-run setup.
    pub display_name: String,
    /// Entered password.
    pub password: String,
    /// Repeated password used by first-run setup.
    pub password_confirm: String,
    /// Signed-in account.
    pub user: Option<User>,
    /// Active session.
    pub session: Option<Session>,
    /// Idle timeout in milliseconds; zero disables the automatic lock.
    pub idle_timeout_ms: i64,
    /// Last recorded input.
    pub last_activity_ms: i64,
    /// Failed unlock attempts since the last successful unlock.
    pub failed_unlocks: u32,
    /// End of the unlock lockout, if one is running.
    pub locked_until: Option<i64>,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last status message.
    pub status: Option<&'static str>,
    /// Set when the back button or Escape left the login/setup screen.
    pub back: bool,
    /// Whether the gallery demo may leave the login/setup screen.
    pub allow_exit: bool,
    token: Option<String>,
}

impl AuthState {
    /// Loads the starting screen: setup when no account exists, login otherwise.
    pub fn new(store: &Store, now: i64) -> socdof_core::CoreResult<Self> {
        let users = store.user_count()?;
        Ok(Self {
            view: if users == 0 {
                AuthView::Setup
            } else {
                AuthView::Login
            },
            idle_timeout_ms: DEFAULT_IDLE_TIMEOUT_MS,
            last_activity_ms: now,
            ..Self::default()
        })
    }

    /// Creates a signed-in state through the real login path. Used by the gallery fixtures.
    pub fn signed_in(
        store: &Store,
        username: &str,
        password: &str,
        now: i64,
    ) -> socdof_core::CoreResult<Self> {
        let mut state = Self::new(store, now)?;
        state.username = username.to_string();
        state.password = password.to_string();
        state.login(store, now)?;
        Ok(state)
    }

    /// Shows the login form.
    pub fn show_login(&mut self) {
        self.view = AuthView::Login;
        self.password.clear();
        self.password_confirm.clear();
        self.error = None;
        self.status = None;
        self.back = false;
    }

    /// Shows the first-run setup form.
    pub fn show_setup(&mut self) {
        self.view = AuthView::Setup;
        self.username.clear();
        self.display_name.clear();
        self.password.clear();
        self.password_confirm.clear();
        self.error = None;
        self.status = None;
        self.back = false;
    }

    /// Shows the signed-in overview when an account is present.
    pub fn show_unlocked(&mut self) {
        if self.user.is_some() {
            self.view = AuthView::Unlocked;
            self.error = None;
        }
    }

    /// Signs in with the entered credentials.
    pub fn login(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let username = self.username.trim().to_string();
        if username.is_empty() || self.password.is_empty() {
            self.error = Some("auth_error_required");
            return Ok(());
        }

        if let Some(user) = store.find_user_by_username(&username)? {
            if !user.active {
                self.password.clear();
                self.error = Some("auth_error_disabled");
                return Ok(());
            }
        }

        match store.login(&username, &self.password, now)? {
            LoginOutcome::Success {
                user,
                session,
                token,
            } => {
                self.username = user.username.clone();
                self.user = Some(*user);
                self.session = Some(session);
                self.token = Some(token);
                self.password.clear();
                self.password_confirm.clear();
                self.error = None;
                self.status = Some("auth_welcome");
                self.failed_unlocks = 0;
                self.locked_until = None;
                self.last_activity_ms = now;
                self.view = AuthView::Unlocked;
            }
            LoginOutcome::Locked { until } => {
                self.password.clear();
                self.locked_until = Some(until);
                self.error = Some("auth_error_locked");
            }
            LoginOutcome::Invalid => {
                self.password.clear();
                self.error = Some("auth_error_invalid");
            }
        }
        Ok(())
    }

    /// Creates the first administrator when the database has no accounts.
    pub fn create_first_admin(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        if store.user_count()? > 0 {
            self.error = Some("auth_error_setup_exists");
            return Ok(());
        }
        if self.username.trim().chars().count() < 3 {
            self.error = Some("auth_error_username_short");
            return Ok(());
        }
        if self.display_name.trim().is_empty() {
            self.error = Some("auth_error_display_name");
            return Ok(());
        }
        if self.password != self.password_confirm {
            self.error = Some("auth_error_password_mismatch");
            return Ok(());
        }
        if self.password.chars().count() < MIN_PASSWORD_LENGTH {
            self.error = Some("auth_error_password_short");
            return Ok(());
        }
        let password = self.password.clone();
        let user = User {
            id: Uuid::new_v4(),
            username: self.username.trim().to_string(),
            display_name: self.display_name.trim().to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: hash_password(&password).map_err(|_| {
                socdof_core::CoreError::Validation("auth_password_hash".to_string())
            })?,
            must_change_password: false,
            created_at: now,
            updated_at: now,
        };
        if let Err(code) = user.validate() {
            self.error = Some(match code.as_str() {
                "username_too_short" => "auth_error_username_short",
                "username_invalid_characters" => "auth_error_username_invalid",
                "display_name_required" => "auth_error_display_name",
                _ => "auth_error_storage",
            });
            return Ok(());
        }
        if store.insert_user(&user).is_err() {
            self.error = Some("auth_error_storage");
            return Ok(());
        }

        self.username = user.username;
        self.password = password;
        self.password_confirm.clear();
        self.login(store, now)?;
        if self.view == AuthView::Unlocked {
            self.status = Some("auth_setup_done");
        }
        Ok(())
    }

    /// Locks the current session without revoking it.
    pub fn lock(&mut self, now: i64) {
        if self.user.is_some() && self.session.is_some() {
            self.view = AuthView::Locked;
            self.password.clear();
            self.password_confirm.clear();
            self.error = None;
            self.status = None;
            self.locked_until = None;
            self.failed_unlocks = 0;
            self.last_activity_ms = now;
        }
    }

    /// Opens the locked session with the account password.
    pub fn unlock(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(user) = self.user.clone() else {
            self.show_login();
            return Ok(());
        };
        if let Some(until) = self.locked_until.filter(|until| *until > now) {
            self.locked_until = Some(until);
            self.error = Some("auth_error_locked");
            return Ok(());
        }
        if self.password.is_empty() {
            self.error = Some("auth_error_required");
            return Ok(());
        }

        let authenticated = store.authenticate(&user.username, &self.password)?;
        let valid = authenticated
            .as_ref()
            .is_some_and(|candidate| candidate.id == user.id && candidate.active);
        self.password.clear();
        if valid {
            if let Some(session) = self.session.as_ref() {
                store.touch_session(session.id, now)?;
            }
            self.failed_unlocks = 0;
            self.locked_until = None;
            self.error = None;
            self.status = Some("auth_unlocked");
            self.last_activity_ms = now;
            self.view = AuthView::Unlocked;
        } else {
            self.failed_unlocks = self.failed_unlocks.saturating_add(1);
            if self.failed_unlocks >= MAX_FAILED_ATTEMPTS as u32 {
                self.locked_until = Some(now + LOCKOUT_MS);
                self.failed_unlocks = 0;
                self.error = Some("auth_error_locked");
            } else {
                self.error = Some("auth_error_unlock");
            }
        }
        Ok(())
    }

    /// Signs out and revokes the active session.
    pub fn sign_out(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        if let Some(session) = self.session.take() {
            store.sign_out(session.id, now)?;
        }
        self.token = None;
        self.user = None;
        self.password.clear();
        self.password_confirm.clear();
        self.failed_unlocks = 0;
        self.locked_until = None;
        self.view = AuthView::Login;
        self.error = None;
        self.status = Some("auth_signed_out");
        Ok(())
    }

    /// Records user input so inactivity is measured from real activity.
    pub fn note_activity(&mut self, now: i64) {
        self.last_activity_ms = now;
    }

    /// Locks an unlocked session after the configured idle time.
    pub fn tick(&mut self, now: i64) {
        if self.view != AuthView::Unlocked || self.idle_timeout_ms <= 0 {
            return;
        }
        if now.saturating_sub(self.last_activity_ms) >= self.idle_timeout_ms {
            self.lock(now);
            self.status = Some("auth_auto_locked");
        }
    }

    /// Remaining lockout in whole minutes, at least one.
    pub fn lockout_minutes(&self, now: i64) -> i64 {
        self.locked_until
            .map(|until| ((until - now).max(0) + 59_999) / 60_000)
            .unwrap_or(0)
            .max(1)
    }

    /// Whether the current account is an administrator.
    pub fn is_admin(&self) -> bool {
        self.user.as_ref().is_some_and(User::is_admin)
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &AuthState, now: i64) {
    if let Some(key) = state.error {
        ui.label(
            RichText::new(texts.get(key))
                .size(FONT_SMALL)
                .color(theme.palette.danger),
        );
    }
    if state
        .locked_until
        .is_some_and(|until| until > now && state.view != AuthView::Locked)
    {
        ui.label(
            RichText::new(format!(
                "{}: {} {}",
                texts.get("auth_locked_for"),
                state.lockout_minutes(now),
                texts.get("auth_minutes")
            ))
            .size(FONT_SMALL)
            .color(theme.palette.warning),
        );
    }
    if state.view == AuthView::Locked && state.locked_until.is_some_and(|until| until > now) {
        ui.label(
            RichText::new(format!(
                "{}: {} {}",
                texts.get("auth_locked_for"),
                state.lockout_minutes(now),
                texts.get("auth_minutes")
            ))
            .size(FONT_SMALL)
            .color(theme.palette.warning),
        );
    }
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
}

/// Renders the login, setup, locked or unlocked screen into the context.
pub fn auth(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
) {
    if state.view == AuthView::Unlocked
        && ctx.input(|input| input.modifiers.command && input.key_pressed(Key::L))
    {
        state.lock(now);
    }
    state.tick(now);
    let interacting = ctx.input(|input| input.pointer.any_down() || !input.events.is_empty());
    if interacting && state.view == AuthView::Unlocked {
        state.note_activity(now);
    }
    if ctx.input(|input| input.key_pressed(Key::Escape)) {
        match state.view {
            AuthView::Login | AuthView::Setup if state.allow_exit => state.back = true,
            AuthView::Login | AuthView::Setup => {}
            AuthView::Unlocked => state.lock(now),
            AuthView::Locked => {}
        }
    }
    let submit = ctx.input(|input| input.key_pressed(Key::Enter));

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(58.0);
                ui.scope(|ui| {
                    ui.set_width(430.0);
                    ui.vertical_centered(|ui| {
                        ui.label(
                            RichText::new(texts.get("auth_brand"))
                                .size(FONT_TITLE + 8.0)
                                .strong()
                                .color(theme.accent_text()),
                        );
                        ui.label(
                            RichText::new(texts.get("auth_brand_subtitle"))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    });
                    ui.add_space(18.0);
                    match state.view {
                        AuthView::Login => {
                            login_form(ui, theme, texts, focus, state, store, now, submit)
                        }
                        AuthView::Setup => {
                            setup_form(ui, theme, texts, focus, state, store, now, submit)
                        }
                        AuthView::Locked => {
                            lock_screen(ui, theme, texts, focus, state, store, now, submit)
                        }
                        AuthView::Unlocked => {
                            unlocked_screen(ui, theme, texts, focus, state, store, now)
                        }
                    }
                    ui.add_space(10.0);
                    ui.vertical_centered(|ui| {
                        ui.label(
                            RichText::new(texts.get("auth_footer"))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                        if state.allow_exit && state.view != AuthView::Locked {
                            ui.add_space(6.0);
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("auth_back"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                state.back = true;
                            }
                        }
                    });
                });
            });
        });
}

#[allow(clippy::too_many_arguments)]
fn login_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let mut sign_in = false;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("auth_login_title"))
                .size(22.0)
                .strong(),
        );
        ui.label(
            RichText::new(texts.get("auth_login_subtitle"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(10.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.username,
            texts.get("auth_username"),
            texts.get("auth_username_hint"),
            None,
        );
        password_field(
            ui,
            theme,
            focus,
            &mut state.password,
            texts.get("auth_password"),
            texts.get("auth_password_hint"),
            None,
        );
        messages(ui, theme, texts, state, now);
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("auth_sign_in"),
            ButtonVariant::Primary,
        )
        .activated
        {
            sign_in = true;
        }
        ui.add_space(8.0);
        ui.label(
            RichText::new(texts.get("auth_login_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
    if sign_in || submit {
        let _ = state.login(store, now);
    }
}

#[allow(clippy::too_many_arguments)]
fn setup_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let mut create = false;
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("auth_setup_title"))
                    .size(22.0)
                    .strong(),
            );
            badge(ui, theme, texts.get("auth_setup_badge"), Tone::Accent);
        });
        ui.label(
            RichText::new(texts.get("auth_setup_subtitle"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(10.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.display_name,
            texts.get("auth_display_name"),
            texts.get("auth_display_name_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.username,
            texts.get("auth_username"),
            texts.get("auth_username_hint"),
            None,
        );
        password_field(
            ui,
            theme,
            focus,
            &mut state.password,
            texts.get("auth_password"),
            texts.get("auth_password_hint"),
            None,
        );
        password_field(
            ui,
            theme,
            focus,
            &mut state.password_confirm,
            texts.get("auth_password_confirm"),
            texts.get("auth_password_hint"),
            None,
        );
        messages(ui, theme, texts, state, now);
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("auth_create_admin"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
        ui.add_space(8.0);
        ui.label(
            RichText::new(texts.get("auth_setup_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
    if create || submit {
        let _ = state.create_first_admin(store, now);
    }
}

#[allow(clippy::too_many_arguments)]
fn lock_screen(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let mut unlock = false;
    let mut sign_out = false;
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("auth_lock_title"))
                    .size(22.0)
                    .strong(),
            );
            badge(ui, theme, texts.get("auth_locked_badge"), Tone::Warning);
        });
        ui.label(
            RichText::new(texts.get("auth_lock_subtitle"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(10.0);
        if let Some(user) = state.user.as_ref() {
            ui.horizontal(|ui| {
                let initial = user
                    .display_name
                    .chars()
                    .next()
                    .map(|character| character.to_uppercase().to_string())
                    .unwrap_or_default();
                badge(ui, theme, &initial, Tone::Accent);
                ui.vertical(|ui| {
                    ui.label(RichText::new(&user.display_name).strong());
                    ui.label(
                        RichText::new(format!("@{}", user.username))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                });
            });
        }
        ui.add_space(8.0);
        password_field(
            ui,
            theme,
            focus,
            &mut state.password,
            texts.get("auth_unlock_password"),
            texts.get("auth_password_hint"),
            None,
        );
        messages(ui, theme, texts, state, now);
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("auth_unlock"),
                ButtonVariant::Primary,
            )
            .activated
            {
                unlock = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("auth_sign_out"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                sign_out = true;
            }
        });
        ui.add_space(8.0);
        ui.label(
            RichText::new(texts.get("auth_lock_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
    if unlock || submit {
        let _ = state.unlock(store, now);
    }
    if sign_out {
        let _ = state.sign_out(store, now);
    }
}

fn unlocked_screen(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
) {
    let mut lock = false;
    let mut sign_out = false;
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("auth_unlocked_title"))
                    .size(22.0)
                    .strong(),
            );
            badge(ui, theme, texts.get("auth_unlocked_badge"), Tone::Success);
        });
        if let Some(user) = state.user.as_ref() {
            ui.add_space(4.0);
            ui.label(RichText::new(&user.display_name).size(FONT_TITLE).strong());
            ui.label(
                RichText::new(format!("@{}", user.username))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            ui.add_space(8.0);
            egui::Grid::new("socdof-auth-session")
                .num_columns(2)
                .spacing(egui::vec2(18.0, 6.0))
                .show(ui, |ui| {
                    ui.label(
                        RichText::new(texts.get("auth_role"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(if user.is_admin() {
                        texts.get("auth_role_admin")
                    } else {
                        texts.get("auth_role_user")
                    });
                    ui.end_row();
                    ui.label(
                        RichText::new(texts.get("auth_idle_timeout"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(format!(
                        "{} {}",
                        if state.idle_timeout_ms > 0 {
                            state.idle_timeout_ms / 60_000
                        } else {
                            0
                        },
                        texts.get("auth_minutes")
                    ));
                    ui.end_row();
                });
        }
        messages(ui, theme, texts, state, now);
        ui.add_space(10.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("auth_lock_now"),
                ButtonVariant::Primary,
            )
            .activated
            {
                lock = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("auth_sign_out"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                sign_out = true;
            }
        });
        ui.add_space(8.0);
        ui.label(
            RichText::new(texts.get("auth_unlocked_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
    });
    if lock {
        state.lock(now);
    }
    if sign_out {
        let _ = state.sign_out(store, now);
    }
}

/// Seeds a deterministic administrator for authentication screens.
pub fn seed_auth_user(store: &Store, now: i64) -> socdof_core::CoreResult<User> {
    if let Some(user) = store.find_user_by_username("admin")? {
        return Ok(user);
    }
    let user = User {
        id: Uuid::new_v4(),
        username: "admin".to_string(),
        display_name: "Alex Administrator".to_string(),
        role: UserRole::Admin,
        role_id: None,
        active: true,
        password_hash: hash_password("Socdof2026!")?,
        must_change_password: false,
        created_at: now,
        updated_at: now,
    };
    store.insert_user(&user)?;
    Ok(user)
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;
    use socdof_core::now_millis;

    const NOW: i64 = crate::dashboard::SAMPLE_NOW_MS;

    fn store_with_admin() -> Store {
        let store = Store::open_in_memory().expect("store");
        seed_auth_user(&store, NOW).expect("admin");
        store
    }

    fn signed_in(store: &Store) -> AuthState {
        AuthState::signed_in(store, "admin", "Socdof2026!", NOW).expect("signed in")
    }

    #[test]
    fn login_lock_unlock_and_sign_out_use_the_session_path() {
        let store = store_with_admin();
        let admin = store.find_user_by_username("admin").unwrap().unwrap();
        let mut state = AuthState::new(&store, NOW).expect("state");
        assert_eq!(state.view, AuthView::Login);
        state.username = "admin".to_string();
        state.password = "Socdof2026!".to_string();
        state.login(&store, NOW).expect("login");
        assert_eq!(state.view, AuthView::Unlocked);
        assert_eq!(state.user.as_ref().map(|user| user.id), Some(admin.id));
        assert_eq!(store.active_session_count(admin.id, NOW).unwrap(), 1);

        state.lock(NOW);
        assert_eq!(state.view, AuthView::Locked);
        state.password = "wrong".to_string();
        state.unlock(&store, NOW).expect("wrong unlock");
        assert_eq!(state.error, Some("auth_error_unlock"));
        state.password = "Socdof2026!".to_string();
        state.unlock(&store, NOW).expect("unlock");
        assert_eq!(state.view, AuthView::Unlocked);
        assert_eq!(state.error, None);

        state.sign_out(&store, NOW).expect("sign out");
        assert_eq!(state.view, AuthView::Login);
        assert!(state.user.is_none());
        assert_eq!(store.active_session_count(admin.id, NOW).unwrap(), 0);
    }

    #[test]
    fn inactivity_locks_and_manual_activity_postpones_it() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        state.idle_timeout_ms = 1_000;
        state.last_activity_ms = NOW;
        state.tick(NOW + 999);
        assert_eq!(state.view, AuthView::Unlocked);
        state.note_activity(NOW + 900);
        state.tick(NOW + 1_800);
        assert_eq!(state.view, AuthView::Unlocked);
        state.tick(NOW + 1_900);
        assert_eq!(state.view, AuthView::Locked);
        assert_eq!(state.status, Some("auth_auto_locked"));
    }

    #[test]
    fn disabled_and_unknown_accounts_report_distinct_errors() {
        let store = store_with_admin();
        let disabled = User {
            id: Uuid::new_v4(),
            username: "jonas".to_string(),
            display_name: "Jonas Weber".to_string(),
            role: UserRole::User,
            role_id: None,
            active: false,
            password_hash: hash_password("Socdof2026!").unwrap(),
            must_change_password: false,
            created_at: NOW,
            updated_at: NOW,
        };
        store.insert_user(&disabled).unwrap();
        let mut state = AuthState::new(&store, NOW).unwrap();

        state.username = "jonas".to_string();
        state.password = "Socdof2026!".to_string();
        state.login(&store, NOW).unwrap();
        assert_eq!(state.error, Some("auth_error_disabled"));
        assert_ne!(state.view, AuthView::Unlocked);

        state.username = "niemand".to_string();
        state.password = "egal-egal".to_string();
        state.login(&store, NOW).unwrap();
        assert_eq!(state.error, Some("auth_error_invalid"));
    }

    #[test]
    fn repeated_failures_trigger_the_persistent_lockout() {
        let store = store_with_admin();
        let mut state = AuthState::new(&store, NOW).unwrap();
        state.username = "admin".to_string();
        for _ in 0..MAX_FAILED_ATTEMPTS {
            state.password = "falsch".to_string();
            state.login(&store, NOW).unwrap();
        }
        assert_eq!(state.error, Some("auth_error_locked"));
        assert!(state.locked_until.is_some());
        assert_eq!(state.view, AuthView::Login);
    }

    #[test]
    fn failed_unlocks_lock_the_screen_temporarily() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        state.lock(NOW);
        for _ in 0..MAX_FAILED_ATTEMPTS {
            state.password = "falsch".to_string();
            state.unlock(&store, NOW).unwrap();
        }
        assert_eq!(state.error, Some("auth_error_locked"));
        assert!(state.locked_until.is_some());
        state.password = "Socdof2026!".to_string();
        state.unlock(&store, NOW).unwrap();
        assert_eq!(state.view, AuthView::Locked);
        assert_eq!(state.error, Some("auth_error_locked"));
    }

    #[test]
    fn empty_database_starts_in_setup_and_creates_the_first_admin() {
        let store = Store::open_in_memory().unwrap();
        let mut state = AuthState::new(&store, NOW).unwrap();
        assert_eq!(state.view, AuthView::Setup);
        state.display_name = "Alex Administrator".to_string();
        state.username = "admin".to_string();
        state.password = "Socdof2026!".to_string();
        state.password_confirm = "anders".to_string();
        state.create_first_admin(&store, NOW).unwrap();
        assert_eq!(state.error, Some("auth_error_password_mismatch"));

        state.password_confirm = "Socdof2026!".to_string();
        state.create_first_admin(&store, NOW).unwrap();
        assert_eq!(state.view, AuthView::Unlocked);
        assert_eq!(state.status, Some("auth_setup_done"));
        assert_eq!(store.user_count().unwrap(), 1);
        assert!(store
            .authenticate("admin", "Socdof2026!")
            .unwrap()
            .unwrap()
            .is_admin());
    }

    #[test]
    fn renders_all_four_views_in_every_language_and_theme() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        for language in [Language::De, Language::En, Language::Fr, Language::Es] {
            let texts = UiTexts::embedded(language).unwrap();
            for appearance in [
                crate::theme::Appearance::Light,
                crate::theme::Appearance::Dark,
            ] {
                let theme = Theme::new(appearance, "indigo");
                for view in [
                    AuthView::Login,
                    AuthView::Locked,
                    AuthView::Setup,
                    AuthView::Unlocked,
                ] {
                    match view {
                        AuthView::Login => state.show_login(),
                        AuthView::Locked => state.lock(now_millis()),
                        AuthView::Setup => state.show_setup(),
                        AuthView::Unlocked => state.show_unlocked(),
                    }
                    let ctx = Context::default();
                    let mut focus = FocusState::default();
                    let mut output = None;
                    for _ in 0..2 {
                        let input = egui::RawInput {
                            screen_rect: Some(egui::Rect::from_min_size(
                                egui::Pos2::ZERO,
                                egui::Vec2::new(900.0, 820.0),
                            )),
                            time: Some(1.0),
                            ..Default::default()
                        };
                        output = Some(ctx.run(input, |ctx| {
                            auth(
                                ctx,
                                &theme,
                                &texts,
                                &mut focus,
                                &mut state,
                                &store,
                                now_millis(),
                            );
                        }));
                    }
                    assert!(
                        output.expect("auth frame").shapes.len() > 10,
                        "{view:?} drew too little"
                    );
                }
            }
        }
    }
}
