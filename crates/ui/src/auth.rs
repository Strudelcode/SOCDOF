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

use egui::{Align, Context, Key, Layout, Pos2, RichText, Vec2};
use socdof_core::domain::session::{LoginOutcome, Session, LOCKOUT_MS, MAX_FAILED_ATTEMPTS};
use socdof_core::domain::user::{User, UserRole};
use socdof_core::security::{hash_password, MIN_PASSWORD_LENGTH};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::auth_kit as kit;
use crate::components::{badge, button, card, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Inactivity after which the session is locked automatically.
pub const DEFAULT_IDLE_TIMEOUT_MS: i64 = 5 * 60 * 1000;

/// Number of steps in the first-run wizard.
pub const SETUP_STEPS: usize = 6;

/// Minimum time the sign-in loading screen stays visible.
///
/// The legacy form awaits an asynchronous store call; the native call returns at once, so the
/// loading screen keeps the feedback the user expects instead of flashing for a single frame.
pub const SIGN_IN_LOADING_MS: i64 = 450;

/// Question the wizard stores for password recovery.
///
/// The TypeScript wizard offers the catalogue questions, a free custom question and an explicit
/// "no question" choice; the same three cases are modelled here.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum RecoveryChoice {
    /// One of the eight catalogue questions.
    #[default]
    Preset,
    /// A question typed by the user.
    Custom,
    /// No recovery question, so the password cannot be recovered.
    None,
}

/// Catalogue keys of the wizard steps, in order.
/// Account type selected during first-run setup.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum SetupAccountType {
    /// Personal workspace without business-only modules.
    #[default]
    Personal,
    /// Business workspace with accounting and commerce modules.
    Business,
}

impl SetupAccountType {
    /// Stable storage value shared with the TypeScript account model.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Personal => "personal",
            Self::Business => "business",
        }
    }
}

/// Desktop layout a first-run account can start with.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum SetupTemplate {
    /// Personal workspace.
    #[default]
    Personal,
    /// General business workspace.
    Business,
    /// Practice and therapy workspace.
    Practice,
    /// Retail and point-of-sale workspace.
    Retail,
    /// Every installed app.
    All,
}

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
    /// Password recovery using the account's configured security answers.
    Recover,
    /// Mandatory password and recovery-answer setup after an administrator reset.
    ChangePassword,
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
    /// End of the sign-in loading screen, zero when no sign-in is running.
    pub signing_in_until: i64,
    /// Whether the close button of the sign-in screen asks before quitting.
    pub quit_confirm: bool,
    /// Whether the sign-in form is in the "other user" mode of the legacy screen.
    pub other_user: bool,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last status message.
    pub status: Option<&'static str>,
    /// Set when the back button or Escape left the login/setup screen.
    pub back: bool,
    /// Whether the gallery demo may leave the login/setup screen.
    pub allow_exit: bool,
    /// Current step of the first-run wizard.
    pub setup_step: usize,
    /// Language chosen in the wizard; the host applies it after setup.
    pub language_choice: Option<socdof_core::domain::settings::Language>,
    /// Appearance chosen in the wizard; the host applies it after setup.
    pub appearance_choice: Option<crate::theme::Appearance>,
    /// Accent chosen in the wizard; the host applies it after setup.
    pub accent_choice: Option<String>,
    /// Account type chosen in the wizard.
    pub account_type: SetupAccountType,
    /// Desktop layout chosen in the wizard.
    pub template_choice: SetupTemplate,
    /// Whether the lock screen shows the password recovery hint.
    pub forgot_hint: bool,
    /// Account being recovered, resolved from the login name.
    pub recovery_target: Option<Uuid>,
    /// First configured recovery answer.
    pub recovery_answer_one: String,
    /// Second configured recovery answer.
    pub recovery_answer_two: String,
    /// Question choice of the wizard.
    pub recovery_choice: RecoveryChoice,
    /// Index of the catalogue question chosen in the wizard (0-based).
    pub recovery_preset: usize,
    /// Free text of the custom question chosen in the wizard.
    pub recovery_custom_question: String,
    /// Questions configured for the account being recovered, as catalogue ids or free text.
    pub recovery_questions: Vec<String>,
    /// Whether the wizard skips the appearance and apps steps.
    pub setup_skip_extras: bool,
    /// New password during recovery.
    pub recovery_new_password: String,
    /// Confirmation of the new recovery password.
    pub recovery_confirm_password: String,
    /// Wallpaper chosen in the wizard; the host applies it after setup.
    pub wallpaper_choice: Option<crate::wallpaper::Wallpaper>,
    /// Whether the wizard finished and the host still has to apply its choices.
    pub wizard_completed: bool,
    /// Import step of the assistant: legacy backup, counts and errors.
    pub migration: crate::migration::MigrationState,
    /// The user asked to run the import; the host executes it and clears the flag.
    pub import_pending: bool,
    /// PNG dropped onto the wizard, applied as wallpaper after setup.
    pub wallpaper_custom: Option<crate::wallpaper::CustomWallpaper>,
    /// Whether the wizard holds a chosen wallpaper and therefore offers the remove action.
    ///
    /// The host consumes `wallpaper_choice` and `wallpaper_custom` on the next frame, so the
    /// wizard keeps its own flag for the thumbnail row of the appearance step.
    pub wallpaper_picked: bool,
    /// Company name captured for a business account.
    pub company_name: String,
    /// Company street and house number captured for a business account.
    pub company_street: String,
    /// Company postal code and city captured for a business account.
    pub company_zip_city: String,
    /// Company email captured for a business account.
    pub company_email: String,
    /// Company tax number captured for a business account.
    pub company_tax_id: String,
    /// Currency symbol captured for a business account.
    pub company_currency: String,
    /// Whether the wizard was allowed to skip the company details.
    pub setup_business_skipped: bool,
    /// Desktop apps chosen in the wizard, as module slugs.
    pub setup_apps: Vec<String>,
    /// Appearance mode chosen in the wizard.
    pub theme_mode_choice: Option<socdof_core::domain::settings::ThemeMode>,
    /// Whether the password fields show their text.
    pub password_visible: bool,
    /// Profile picture chosen in the wizard.
    pub avatar: Option<crate::wallpaper::CustomWallpaper>,
    /// Clock settings of the sign-in and lock screen, from the company profile.
    pub clock: crate::desktop::ClockSettings,
    /// Decoded account pictures of the account strips, loaded once per account.
    pub account_avatars: std::collections::HashMap<Uuid, Option<crate::wallpaper::CustomWallpaper>>,
    token: Option<String>,
}

impl AuthState {
    /// Loads the starting screen: setup when no account exists, login otherwise.
    ///
    /// A database with exactly one active account signs in automatically when the reference
    /// security switch `autoLoginSingleUser` is on.
    pub fn new(store: &Store, now: i64) -> socdof_core::CoreResult<Self> {
        let users = store.user_count()?;
        let clock = crate::desktop::ClockSettings::from_profile(&store.company_profile()?);
        let mut state = Self {
            view: if users == 0 {
                AuthView::Setup
            } else {
                AuthView::Login
            },
            idle_timeout_ms: DEFAULT_IDLE_TIMEOUT_MS,
            last_activity_ms: now,
            company_currency: "€".to_string(),
            clock,
            ..Self::default()
        };
        if users > 0 {
            if let Some(LoginOutcome::Success {
                user,
                session,
                token,
            }) = store.auto_login_single_user(now)?
            {
                state.apply_sign_in(*user, session, token, now);
            }
        }
        Ok(state)
    }

    /// Applies a successful sign-in of the password, quick-switch or auto-login path.
    fn apply_sign_in(&mut self, user: User, session: Session, token: String, now: i64) {
        self.username = user.username.clone();
        let must_change = user.must_change_password;
        self.user = Some(user);
        self.session = Some(session);
        self.token = Some(token);
        self.password.clear();
        self.password_confirm.clear();
        self.error = None;
        self.status = Some("auth_welcome");
        self.failed_unlocks = 0;
        self.locked_until = None;
        self.last_activity_ms = now;
        self.view = if must_change {
            AuthView::ChangePassword
        } else {
            AuthView::Unlocked
        };
    }

    /// Runs the reference single-user auto login on demand (the login card and the start).
    pub fn auto_login(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        if let Some(LoginOutcome::Success {
            user,
            session,
            token,
        }) = store.auto_login_single_user(now)?
        {
            self.apply_sign_in(*user, session, token, now);
        }
        Ok(())
    }

    /// Signs a passwordless account in directly, the reference quick user switch.
    pub fn quick_switch_to(
        &mut self,
        store: &Store,
        user_id: Uuid,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        match store.quick_switch(user_id, now)? {
            LoginOutcome::Success {
                user,
                session,
                token,
            } => self.apply_sign_in(*user, session, token, now),
            LoginOutcome::Locked { until } => {
                self.locked_until = Some(until);
                self.error = Some("auth_error_locked");
            }
            LoginOutcome::Invalid => self.error = Some("auth_error_invalid"),
        }
        Ok(())
    }

    /// Stored profile picture of an account, decoded once and cached for the account strips.
    pub fn avatar_for(
        &mut self,
        store: &Store,
        user_id: Uuid,
    ) -> Option<crate::wallpaper::CustomWallpaper> {
        if let Some(cached) = self.account_avatars.get(&user_id) {
            return cached.clone();
        }
        let avatar = socdof_core::settings_service::user_avatar(store, user_id)
            .ok()
            .flatten()
            .and_then(|data_url| socdof_core::settings_service::decode_data_url_rgba(&data_url))
            .map(
                |(width, height, pixels)| crate::wallpaper::CustomWallpaper {
                    width,
                    height,
                    pixels: std::sync::Arc::new(pixels),
                    // Unique and stable per account so the texture cache never mixes two pictures.
                    revision: (user_id.as_u128() as u64) | 1,
                },
            );
        self.account_avatars.insert(user_id, avatar.clone());
        avatar
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
        self.forgot_hint = false;
        self.password.clear();
        self.password_confirm.clear();
        self.recovery_target = None;
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.recovery_new_password.clear();
        self.recovery_confirm_password.clear();
        self.error = None;
        self.status = None;
        self.back = false;
        self.signing_in_until = 0;
        self.quit_confirm = false;
        self.other_user = false;
    }

    /// Shows the first-run setup form.
    pub fn show_setup(&mut self) {
        self.view = AuthView::Setup;
        self.setup_step = 0;
        self.forgot_hint = false;
        self.wizard_completed = false;
        self.username.clear();
        self.display_name.clear();
        self.password.clear();
        self.password_confirm.clear();
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.recovery_new_password.clear();
        self.recovery_confirm_password.clear();
        self.recovery_target = None;
        self.recovery_choice = RecoveryChoice::Preset;
        self.recovery_preset = 0;
        self.recovery_custom_question.clear();
        self.recovery_questions.clear();
        self.setup_skip_extras = false;
        self.wallpaper_picked = false;
        self.signing_in_until = 0;
        self.quit_confirm = false;
        self.other_user = false;
        self.avatar = None;
        self.setup_apps.clear();
        self.setup_business_skipped = false;
        self.theme_mode_choice = None;
        self.password_visible = false;
        self.company_name.clear();
        self.company_street.clear();
        self.company_zip_city.clear();
        self.company_email.clear();
        self.company_tax_id.clear();
        self.company_currency = "€".to_string();
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

        match store.login(&username, &self.password, now)? {
            LoginOutcome::Success {
                user,
                session,
                token,
            } => self.apply_sign_in(*user, session, token, now),
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

    /// Completes the mandatory first-login password change and configures recovery answers.
    ///
    /// This mirrors the TypeScript forced-password screen: an administrator-reset account cannot
    /// reach the desktop until the user chooses a new password and saves both recovery answers.
    pub fn complete_forced_password_change(
        &mut self,
        store: &Store,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        if self.view != AuthView::ChangePassword {
            return Ok(());
        }
        let Some(user) = self.user.as_ref() else {
            self.show_login();
            return Ok(());
        };
        if self.recovery_new_password.chars().count() < MIN_PASSWORD_LENGTH {
            self.error = Some("auth_error_password_short");
            return Ok(());
        }
        if self.recovery_new_password != self.recovery_confirm_password {
            self.error = Some("auth_error_password_mismatch");
            return Ok(());
        }
        if self.recovery_answer_one.trim().chars().count() < 2
            || self.recovery_answer_two.trim().chars().count() < 2
        {
            self.error = Some("auth_force_password_answers_required");
            return Ok(());
        }

        let password_hash = hash_password(&self.recovery_new_password)
            .map_err(|_| socdof_core::CoreError::Validation("auth_password_hash".to_string()))?;
        socdof_core::security_questions::save_security_answers(
            store,
            user.id,
            &[
                self.recovery_answer_one.trim().to_owned(),
                self.recovery_answer_two.trim().to_owned(),
            ],
        )?;
        // A first-login password change is performed by the authenticated user. Unlike an
        // administrator reset or recovery, it must preserve this active session, matching the
        // TypeScript changePassword flow.
        let mut updated_user = user.clone();
        updated_user.password_hash = password_hash;
        updated_user.must_change_password = false;
        updated_user.updated_at = now;
        let session_id = self
            .session
            .as_ref()
            .map(|session| session.id)
            .ok_or_else(|| {
                socdof_core::CoreError::Validation("auth_session_required".to_string())
            })?;
        store.update_user_preserving_session(&updated_user, session_id, now)?;
        self.user = Some(updated_user);
        self.recovery_new_password.clear();
        self.recovery_confirm_password.clear();
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.error = None;
        self.status = Some("auth_password_changed");
        self.last_activity_ms = now;
        self.view = AuthView::Unlocked;
        Ok(())
    }

    /// Creates the first administrator when the database has no accounts.
    pub fn create_first_admin(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
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
        // The wizard asks for one question (catalogue, custom or none) and one answer, like the
        // TypeScript setup screen. "No question" is a valid choice and stores nothing.
        let answer = self.recovery_answer_one.trim().to_string();
        let question = match self.recovery_choice {
            RecoveryChoice::None => None,
            RecoveryChoice::Custom => {
                let custom = self.recovery_custom_question.trim().to_string();
                if custom.is_empty() {
                    self.error = Some("setup_recovery_question_required");
                    return Ok(());
                }
                if answer.chars().count() < 2 {
                    self.error = Some("setup_recovery_answer_required");
                    return Ok(());
                }
                Some(custom)
            }
            RecoveryChoice::Preset => {
                if answer.chars().count() < 2 {
                    self.error = Some("setup_recovery_answer_required");
                    return Ok(());
                }
                Some(format!("setup_recovery_q{}", self.recovery_preset + 1))
            }
        };
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
            passwordless: false,
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
        let account_type_key = format!("account_type:{}", user.id);
        store.put_setting(
            &account_type_key,
            &serde_json::Value::String(self.account_type.as_str().to_owned()),
        )?;
        if let Some(question) = &question {
            socdof_core::security_questions::save_security_question(
                store, user.id, question, &answer,
            )?;
        }
        if store.insert_first_admin(&user).is_err() {
            if question.is_some() {
                let _ = socdof_core::security_questions::delete_security_answers(store, user.id);
                let _ = store.remove_setting(&account_type_key);
            }
            self.error = Some(if store.user_count().unwrap_or(0) > 0 {
                "auth_error_setup_exists"
            } else {
                "auth_error_storage"
            });
            return Ok(());
        }

        // The profile picture chosen in the wizard belongs to the account and feeds the sign-in
        // and lock-screen account strips.
        if let Some(avatar) = self.avatar.as_ref() {
            if let Ok(data_url) = socdof_core::settings_service::encode_png_data_url(
                avatar.width as u32,
                avatar.height as u32,
                avatar.pixels.as_slice(),
            ) {
                let _ = socdof_core::settings_service::save_user_avatar(
                    store,
                    user.id,
                    Some(&data_url),
                );
            }
        }

        if self.account_type == SetupAccountType::Business {
            let mut profile =
                socdof_core::settings_service::company_profile(store).unwrap_or_default();
            if !self.setup_business_skipped {
                let assign = |target: &mut String, value: &str| {
                    if !value.trim().is_empty() {
                        *target = value.trim().to_string();
                    }
                };
                assign(&mut profile.name, &self.company_name);
                assign(&mut profile.street, &self.company_street);
                assign(&mut profile.zip_city, &self.company_zip_city);
                assign(&mut profile.email, &self.company_email);
                assign(&mut profile.tax_id, &self.company_tax_id);
                assign(&mut profile.currency, &self.company_currency);
            }
            if let Some(language) = self.language_choice {
                profile.language = language;
            }
            if let Some(accent) = &self.accent_choice {
                profile.accent_color = accent.clone();
            }
            if let Some(mode) = self.theme_mode_choice {
                profile.theme_mode = mode;
            }
            let _ = socdof_core::settings_service::save_company_profile(store, &profile);
        }

        self.username = user.username;
        self.password = password;
        self.password_confirm.clear();
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.recovery_custom_question.clear();
        self.login(store, now)?;
        if self.view == AuthView::Unlocked {
            self.status = Some("auth_setup_done");
        }
        Ok(())
    }

    /// Switches the sign-in form to another account without a password.
    ///
    /// The user still has to prove the account with its own password, so a switch never hands out a
    /// session on its own.
    pub fn begin_switch(&mut self, username: &str) {
        self.view = AuthView::Login;
        self.username = username.to_owned();
        self.password.clear();
        self.error = None;
        self.status = None;
        self.forgot_hint = false;
        self.recovery_target = None;
    }

    /// Starts recovery only for an active account with configured security answers.
    pub fn begin_recovery(&mut self, store: &Store) {
        let user = match store.find_user_by_username(self.username.trim()) {
            Ok(Some(user)) if user.active => user,
            _ => {
                self.error = Some("auth_recovery_unavailable");
                return;
            }
        };
        // One configured question is enough: the wizard stores a single one, and the recovery form
        // checks the answer against every stored question.
        let configured = socdof_core::security_questions::security_answers(store, user.id)
            .map(|answers| answers.is_configured())
            .unwrap_or(false);
        if !configured {
            self.error = Some("auth_recovery_unavailable");
            return;
        }
        self.recovery_questions =
            socdof_core::security_questions::questions_of(store, user.id).unwrap_or_default();
        self.username = user.username;
        self.password.clear();
        self.recovery_target = Some(user.id);
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.recovery_new_password.clear();
        self.recovery_confirm_password.clear();
        self.error = None;
        self.status = None;
        self.view = AuthView::Recover;
    }

    /// Verifies both configured answers and replaces the password, revoking old sessions.
    pub fn reset_password_with_recovery(
        &mut self,
        store: &Store,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let Some(user_id) = self.recovery_target else {
            self.error = Some("auth_recovery_unavailable");
            return Ok(());
        };
        if self.recovery_new_password.chars().count() < MIN_PASSWORD_LENGTH {
            self.error = Some("auth_error_password_short");
            return Ok(());
        }
        if self.recovery_new_password != self.recovery_confirm_password {
            self.error = Some("auth_error_password_mismatch");
            return Ok(());
        }
        if !socdof_core::security_questions::verify_any_answer(
            store,
            user_id,
            &self.recovery_answer_one,
        )? {
            self.error = Some("auth_recovery_invalid");
            return Ok(());
        }
        let hash = hash_password(&self.recovery_new_password)
            .map_err(|_| socdof_core::CoreError::Validation("auth_password_hash".to_string()))?;
        store.set_password(user_id, &hash)?;
        // The core revokes every persisted session during a password reset. Clear the in-memory
        // session too, including when recovery was started from the locked screen.
        self.user = None;
        self.session = None;
        self.token = None;
        self.last_activity_ms = now;
        self.password.clear();
        self.password_confirm.clear();
        self.recovery_target = None;
        self.recovery_questions.clear();
        self.recovery_answer_one.clear();
        self.recovery_answer_two.clear();
        self.recovery_new_password.clear();
        self.recovery_confirm_password.clear();
        self.view = AuthView::Login;
        self.error = None;
        self.status = Some("auth_recovery_done");
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
        self.tick_with_store(store, now)?;
        if self.view != AuthView::Locked {
            return Ok(());
        }
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
    /// Checks the persisted session as well as its local expiry. This catches revocation from
    /// another desktop, password reset, account deactivation or permission change.
    pub fn tick_with_store(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        if matches!(
            self.view,
            AuthView::Unlocked | AuthView::Locked | AuthView::ChangePassword
        ) {
            let active = match self.token.as_deref() {
                Some(token) => match store.session_for_token(token, now) {
                    Ok(session) => session.is_some(),
                    Err(error) => {
                        // Fail closed if the database cannot confirm the session.
                        self.session = None;
                        self.token = None;
                        self.user = None;
                        self.password.clear();
                        self.password_confirm.clear();
                        self.view = AuthView::Login;
                        self.error = None;
                        self.status = Some("auth_session_expired");
                        return Err(error);
                    }
                },
                None => false,
            };
            if !active {
                self.session = None;
                self.token = None;
                self.user = None;
                self.password.clear();
                self.password_confirm.clear();
                self.view = AuthView::Login;
                self.error = None;
                self.status = Some("auth_session_expired");
                return Ok(());
            }
        }
        self.tick(now);
        Ok(())
    }

    /// Advances session expiry and idle-lock state for the supplied timestamp.
    pub fn tick(&mut self, now: i64) {
        if !matches!(self.view, AuthView::Unlocked | AuthView::Locked) {
            return;
        }

        // A locked screen must not be able to revive an expired session by checking the password
        // again. Expiry therefore applies to both the unlocked desktop and the lock screen.
        let session_valid = self
            .session
            .as_ref()
            .is_some_and(|session| session.revoked_at.is_none() && session.expires_at > now);
        if !session_valid {
            self.session = None;
            self.token = None;
            self.user = None;
            self.password.clear();
            self.password_confirm.clear();
            self.view = AuthView::Login;
            self.error = None;
            self.status = None;
            return;
        }

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

    /// Remaining lockout in whole seconds, zero when no lockout is running.
    pub fn lockout_seconds(&self, now: i64) -> i64 {
        self.locked_until
            .map(|until| ((until - now).max(0) + 999) / 1000)
            .unwrap_or(0)
    }

    /// Starts the sign-in with its loading screen.
    ///
    /// The TypeScript form awaits the store call and paints [`AuthLoadingScreen`] meanwhile. The
    /// native store call is synchronous, so the screen runs for [`SIGN_IN_LOADING_MS`] and
    /// [`AuthState::tick_sign_in`] performs the login afterwards; missing credentials still fail
    /// immediately with the usual form error.
    pub fn begin_sign_in(&mut self, now: i64) {
        if self.view != AuthView::Login {
            return;
        }
        if self.username.trim().is_empty() || self.password.is_empty() {
            self.error = Some("auth_error_required");
            return;
        }
        self.error = None;
        self.signing_in_until = now + SIGN_IN_LOADING_MS;
    }

    /// Finishes a started sign-in once the loading screen elapsed.
    pub fn tick_sign_in(&mut self, store: &Store, now: i64) {
        if self.signing_in_until != 0 && now >= self.signing_in_until {
            self.signing_in_until = 0;
            let _ = self.login(store, now);
        }
    }

    /// Whether the sign-in loading screen is on screen.
    pub fn signing_in(&self, now: i64) -> bool {
        self.signing_in_until > now
    }
}

/// Theme one auth view paints with.
///
/// The legacy sign-in and lock screens always sit on the dark backdrop, independent of the
/// appearance chosen for the desktop; the wizard and the forms follow the chosen appearance.
pub fn screen_theme(theme: &Theme, view: AuthView) -> Theme {
    match view {
        AuthView::Login | AuthView::Locked => {
            Theme::new(crate::theme::Appearance::Dark, theme.accent.id.clone())
        }
        _ => theme.clone(),
    }
}

impl AuthState {
    /// Whether the current account is an administrator.
    pub fn is_admin(&self) -> bool {
        self.user.as_ref().is_some_and(User::is_admin)
    }

    /// Reports whether the wizard just finished, clearing the flag.
    pub fn take_wizard_completed(&mut self) -> bool {
        std::mem::take(&mut self.wizard_completed)
    }

    /// Runs the import the wizard asked for in the previous frame.
    pub fn run_pending_import(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.import_pending {
            return Ok(());
        }
        self.import_pending = false;
        self.migration.import(store)
    }
}

/// A foreign instance on the shared database, shown before the login screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LockConflict {
    /// Owner reported by the lock file.
    pub owner: Option<socdof_core::lock::LockInfo>,
    /// The user confirmed the takeover.
    pub take_over: bool,
    /// The user dismissed the dialog.
    pub cancelled: bool,
}

impl LockConflict {
    /// Builds the dialog state from the lock owner.
    pub fn new(owner: socdof_core::lock::LockInfo) -> Self {
        Self {
            owner: Some(owner),
            ..Self::default()
        }
    }

    /// `host / user (pid 4711)` of the owning instance.
    pub fn owner_label(&self) -> String {
        match &self.owner {
            Some(owner) => format!("{} / {} (pid {})", owner.machine, owner.user, owner.pid),
            None => String::new(),
        }
    }

    /// Sentence shown in the dialog, with the owner inserted.
    pub fn hint(&self, texts: &UiTexts) -> String {
        texts
            .get("lock_conflict_hint")
            .replace("{owner}", &self.owner_label())
    }

    /// The user takes the lock over.
    pub fn accept(&mut self) {
        self.take_over = true;
        self.cancelled = false;
    }

    /// The user keeps the other instance and stops this start.
    pub fn cancel(&mut self) {
        self.cancelled = true;
        self.take_over = false;
    }
}

/// Draws the takeover dialog and reports the button the user pressed.
pub fn lock_conflict(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &mut LockConflict,
) -> bool {
    let mut decided = false;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("lock_conflict_title"))
                .size(20.0)
                .strong(),
        );
        ui.label(
            RichText::new(state.hint(texts))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(10.0);
        ui.horizontal(|ui| {
            if ui.button(texts.get("lock_conflict_take_over")).clicked() {
                state.accept();
                decided = true;
            }
            if ui.button(texts.get("lock_conflict_cancel")).clicked() {
                state.cancel();
                decided = true;
            }
        });
    });
    decided
}

/// Draws the lock and status messages of a screen. `show_error` is false on the wizard body,
/// whose error is painted in the band above the footer so a rejected click is always readable.
pub(crate) fn messages(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &AuthState,
    now: i64,
    show_error: bool,
) {
    if show_error {
        if let Some(key) = state.error {
            ui.label(
                RichText::new(texts.get(key))
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
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
        if state.quit_confirm {
            state.quit_confirm = false;
        } else {
            match state.view {
                AuthView::Login | AuthView::Setup if state.allow_exit => state.back = true,
                AuthView::Login | AuthView::Setup => {}
                AuthView::Recover => {
                    if state.session.is_some() {
                        let _ = state.sign_out(store, now);
                    } else {
                        state.show_login();
                    }
                }
                AuthView::ChangePassword => {}
                AuthView::Unlocked => state.lock(now),
                AuthView::Locked => {}
            }
        }
    }
    let submit = ctx.input(|input| input.key_pressed(Key::Enter));

    // A started sign-in runs on the next frame, so the loading screen of the legacy form is
    // actually painted instead of flashing for a single frame.
    if state.view == AuthView::Login {
        state.tick_sign_in(store, now);
    }

    let screen_theme = screen_theme(theme, state.view);
    let theme = &screen_theme;

    let view = state.view;
    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(theme.palette.background))
        .show(ctx, |ui| {
            crate::auth_kit::backdrop(ui, theme);
            egui::ScrollArea::vertical()
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    match view {
                        AuthView::Login if state.signing_in(now) => {
                            signing_in_screen(ui, theme, texts, state, now)
                        }
                        AuthView::Login => crate::auth_screens::login(
                            ui, theme, texts, focus, state, store, now, submit,
                        ),
                        AuthView::Setup => crate::auth_screens::setup(
                            ui, theme, texts, focus, state, store, now, submit,
                        ),
                        AuthView::Locked
                        | AuthView::Unlocked
                        | AuthView::Recover
                        | AuthView::ChangePassword => {
                            // The card views are shorter than the viewport, so keep them vertically
                            // centered instead of glued to the top of the scroll area. The lock
                            // screen is a full screen and lays out its own clock spacing.
                            let top = if view == AuthView::Locked {
                                0.0
                            } else {
                                ((ui.available_height() - 520.0) * 0.5).clamp(24.0, 200.0)
                            };
                            ui.add_space(top);
                            let card_width = if view == AuthView::Locked {
                                520.0
                            } else {
                                460.0
                            };
                            crate::auth_kit::centered(ui, card_width, |ui| match view {
                                AuthView::Locked => lock_screen(
                                    ui,
                                    theme,
                                    texts,
                                    focus,
                                    state,
                                    CardInput { store, now, submit },
                                ),
                                AuthView::Unlocked => {
                                    unlocked_screen(ui, theme, texts, focus, state, store, now)
                                }
                                AuthView::Recover => recovery_form(
                                    ui, theme, texts, focus, state, store, now, submit,
                                ),
                                _ => forced_password_form(
                                    ui, theme, texts, focus, state, store, now, submit,
                                ),
                            });
                        }
                    }
                    if state.allow_exit && state.view != AuthView::Locked {
                        ui.add_space(10.0);
                        ui.vertical_centered(|ui| {
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
                        });
                    }
                });
        });
}

#[allow(clippy::too_many_arguments)]
fn recovery_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let mut reset = false;
    let mut cancel = false;
    pwd_card(ui, theme, |ui| {
        kit::heading(ui, theme, texts.get("auth_recovery_title"));
        ui.add_space(2.0);
        kit::muted(ui, theme, texts.get("auth_recovery_subtitle"));
        ui.add_space(12.0);
        recovery_answer_field(ui, theme, texts, focus, state);
        ui.add_space(10.0);
        kit::field_label(ui, theme, texts.get("auth_recovery_new_password"), true);
        ui.add_space(4.0);
        kit::password_input(
            ui,
            theme,
            focus,
            &mut state.recovery_new_password,
            texts.get("auth_password_hint"),
            texts.get("auth_recovery_new_password"),
            kit::PasswordField::default(),
        );
        ui.add_space(10.0);
        kit::field_label(ui, theme, texts.get("auth_recovery_confirm"), true);
        ui.add_space(4.0);
        kit::password_input(
            ui,
            theme,
            focus,
            &mut state.recovery_confirm_password,
            texts.get("auth_password_hint"),
            texts.get("auth_recovery_confirm"),
            kit::PasswordField::default(),
        );
        messages(ui, theme, texts, state, now, true);
        ui.add_space(12.0);
        // Two full-width buttons in one row push the second one out of the card; both halves share
        // the row like the wizard footer.
        let gap = 8.0;
        let width = ((ui.available_width() - gap) * 0.5).max(80.0);
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            if kit::secondary_button_sized(
                ui,
                theme,
                focus,
                texts.get("auth_recovery_cancel"),
                width,
            ) {
                cancel = true;
            }
            if kit::primary_button_sized(ui, theme, focus, texts.get("auth_recovery_reset"), width)
            {
                reset = true;
            }
        });
    });
    if cancel {
        if state.session.is_some() {
            let _ = state.sign_out(store, now);
        } else {
            state.show_login();
        }
    } else if reset || submit {
        let _ = state.reset_password_with_recovery(store, now);
    }
}

#[allow(clippy::too_many_arguments)]
fn forced_password_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    store: &Store,
    now: i64,
    submit: bool,
) {
    let mut save = false;
    pwd_card(ui, theme, |ui| {
        kit::heading(ui, theme, texts.get("auth_force_password_title"));
        ui.add_space(2.0);
        kit::muted(ui, theme, texts.get("auth_force_password_subtitle"));
        ui.add_space(12.0);
        kit::field_label(ui, theme, texts.get("auth_recovery_new_password"), true);
        ui.add_space(4.0);
        kit::password_input(
            ui,
            theme,
            focus,
            &mut state.recovery_new_password,
            texts.get("auth_password_hint"),
            texts.get("auth_recovery_new_password"),
            kit::PasswordField::default(),
        );
        ui.add_space(10.0);
        kit::field_label(ui, theme, texts.get("auth_recovery_confirm"), true);
        ui.add_space(4.0);
        kit::password_input(
            ui,
            theme,
            focus,
            &mut state.recovery_confirm_password,
            texts.get("auth_password_hint"),
            texts.get("auth_recovery_confirm"),
            kit::PasswordField::default(),
        );
        ui.add_space(10.0);
        answer_fields(ui, theme, texts, focus, state);
        messages(ui, theme, texts, state, now, true);
        ui.add_space(12.0);
        if kit::primary_button(ui, theme, focus, texts.get("auth_recovery_reset")) {
            save = true;
        }
    });
    if save || submit {
        let _ = state.complete_forced_password_change(store, now);
    }
}

/// Draws the card surface the sign-in and recovery forms share.
///
/// The recovery and forced-password forms used the compact component card with plain text edits,
/// while the sign-in screen and the wizard paint the auth kit card with its icon tile and bordered
/// fields. Both forms use the kit now, so all auth screens look the same.
fn pwd_card(ui: &mut egui::Ui, theme: &Theme, add: impl FnOnce(&mut egui::Ui)) {
    kit::card(ui, theme, 460.0, kit::card_padding(ui), |ui| {
        kit::icon_tile(ui, Icon::Shield, 44.0, theme.accent.base);
        ui.add_space(10.0);
        add(ui);
    });
}

/// Draws the configured questions and one answer field, like the TypeScript recovery form.
///
/// The account keeps its questions as catalogue ids (or as the free text of a custom question), so
/// the label is localized here instead of being baked into the stored answer.
fn recovery_answer_field(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    let labels: Vec<String> = if state.recovery_questions.is_empty() {
        socdof_core::security_questions::DEFAULT_QUESTIONS
            .iter()
            .map(|id| texts.get(id).to_string())
            .collect()
    } else {
        state
            .recovery_questions
            .iter()
            .map(|question| crate::auth_screens::recovery_question_label(texts, question))
            .collect()
    };
    // The joined questions form one wrapping paragraph, like `text-sm text-slate-500` of the
    // TypeScript recovery form; a horizontal label would grow the card past a 360 px panel.
    ui.label(
        RichText::new(labels.join(" · "))
            .size(12.0)
            .color(theme.palette.text_muted),
    );
    ui.add_space(4.0);
    kit::input(
        ui,
        theme,
        focus,
        &mut state.recovery_answer_one,
        texts.get("auth_recovery_answer_one"),
        texts.get("auth_recovery_answer_one"),
    );
}

/// Draws the two security questions of the forced-password form.
fn answer_fields(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
) {
    kit::field_label(ui, theme, texts.get("auth_recovery_question_one"), true);
    ui.add_space(4.0);
    kit::input(
        ui,
        theme,
        focus,
        &mut state.recovery_answer_one,
        texts.get("auth_recovery_answer_one"),
        texts.get("auth_recovery_question_one"),
    );
    ui.add_space(10.0);
    kit::field_label(ui, theme, texts.get("auth_recovery_question_two"), true);
    ui.add_space(4.0);
    kit::input(
        ui,
        theme,
        focus,
        &mut state.recovery_answer_two,
        texts.get("auth_recovery_answer_two"),
        texts.get("auth_recovery_question_two"),
    );
}

/// Native name of a language, the same in every interface language.
pub(crate) fn language_label(language: socdof_core::domain::settings::Language) -> &'static str {
    match language.as_str() {
        "de" => "Deutsch",
        "fr" => "Français",
        "es" => "Español",
        _ => "English",
    }
}

/// Inputs the lock screen shares with the other card screens.
struct CardInput<'a> {
    store: &'a Store,
    now: i64,
    submit: bool,
}

/// Draws the sign-in loading screen of the legacy form.
///
/// The avatar and the "sign in" label with its animated dots stay on the dark backdrop while the
/// store call runs.
fn signing_in_screen(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    state: &AuthState,
    now: i64,
) {
    let screen = ui.ctx().screen_rect();
    let initials = state
        .user
        .as_ref()
        .map(|user| kit::initials(&user.display_name))
        .unwrap_or_default();
    ui.allocate_ui_with_layout(screen.size(), Layout::top_down(Align::Center), |ui| {
        ui.add_space((screen.height() * 0.38).max(40.0));
        kit::avatar(ui, theme, None, &initials, 80.0);
        ui.add_space(18.0);
        let step = (now / 350).rem_euclid(4) as usize;
        ui.label(
            RichText::new(format!("{}{}", texts.get("auth_sign_in"), ".".repeat(step)))
                .size(20.0)
                .family(crate::theme::light())
                .color(theme.palette.text),
        );
        ui.add_space(10.0);
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            // `ui.horizontal` starts at the left edge, so centre the four dots by hand.
            ui.add_space((ui.available_width() - 42.0).max(0.0) * 0.5);
            for index in 0..4 {
                let (rect, _) = ui.allocate_exact_size(Vec2::splat(6.0), egui::Sense::hover());
                let alpha = if index == step { 230 } else { 110 };
                ui.painter().circle_filled(
                    rect.center(),
                    3.0,
                    crate::tokens::with_alpha(theme.palette.text, alpha),
                );
            }
        });
    });
}

/// Draws the lock screen: clock, the signed-in account and one password field on the dark
/// backdrop, plus the account strip along the bottom, like the legacy lock screen.
fn lock_screen(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut AuthState,
    input: CardInput<'_>,
) {
    let CardInput { store, now, submit } = input;
    let users: Vec<User> = store
        .list_users()
        .unwrap_or_default()
        .into_iter()
        .filter(|user| user.active)
        .collect();
    let mut unlock = false;
    let mut switch_user = false;
    let mut quick_switch: Option<Uuid> = None;
    let quick_switch_allowed = socdof_core::auth_security::load(store)
        .map(|settings| settings.allow_quick_user_switch)
        .unwrap_or(true);
    let account_avatars: Vec<(Uuid, Option<crate::wallpaper::CustomWallpaper>)> = users
        .iter()
        .map(|user| (user.id, state.avatar_for(store, user.id)))
        .collect();
    let current_avatar = state.user.as_ref().and_then(|current| {
        account_avatars
            .iter()
            .find(|(id, _)| *id == current.id)
            .and_then(|(_, avatar)| avatar.clone())
    });
    let current_passwordless = state.user.as_ref().is_some_and(|user| user.passwordless);
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
            let (name, initials) = match state.user.as_ref() {
                Some(user) => (user.display_name.clone(), kit::initials(&user.display_name)),
                None => (String::new(), String::new()),
            };
            kit::avatar(ui, theme, current_avatar.as_ref(), &initials, 80.0);
            ui.add_space(14.0);
            ui.label(
                RichText::new(&name)
                    .size(20.0)
                    .family(crate::theme::semibold())
                    .color(theme.palette.text),
            );
            ui.label(
                RichText::new(texts.get("auth_locked_title"))
                    .size(12.0)
                    .color(crate::tokens::with_alpha(theme.palette.text, 166)),
            );
            ui.add_space(14.0);
            kit::centered(ui, 324.0, |ui| {
                if current_passwordless {
                    // A locked passwordless account continues without a password.
                    if kit::primary_button(
                        ui,
                        theme,
                        focus,
                        &texts.get("auth_continue_as").replace(
                            "{name}",
                            state
                                .user
                                .as_ref()
                                .map(|user| user.display_name.as_str())
                                .unwrap_or_default(),
                        ),
                    ) {
                        unlock = true;
                    }
                    return;
                }
                let field = kit::password_input(
                    ui,
                    theme,
                    focus,
                    &mut state.password,
                    texts.get("auth_password"),
                    texts.get("auth_unlock_password"),
                    kit::PasswordField {
                        autofocus: true,
                        ..Default::default()
                    },
                );
                let frame = field.rect.expand2(Vec2::new(12.0, 11.0));
                let arrow = egui::Rect::from_center_size(
                    Pos2::new(frame.right() - 24.0, frame.center().y),
                    Vec2::splat(34.0),
                );
                if kit::overlay_circle_button(
                    ui,
                    theme,
                    focus,
                    arrow,
                    Icon::ChevronRight,
                    texts.get("auth_unlock"),
                ) {
                    unlock = true;
                }
            });
            ui.add_space(8.0);
            messages(ui, theme, texts, state, now, true);
        });
    });

    // Window controls and the language selector share the top right corner, like the legacy lock
    // screen; it has no close button because the session stays alive.
    let screen = ui.ctx().screen_rect();
    egui::Area::new(egui::Id::new("socdof-lock-language"))
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
                crate::auth_screens::language_selector(ui, theme, texts, state);
            });
        });

    // Bottom account strip: every active account and the "switch user" tile. Selecting another
    // account keeps the session and only changes which password the form unlocks.
    let total = users.len() as f32 * 94.0 + 110.0;
    let left = if screen.width() < kit::COMPACT_WIDTH {
        screen.left() + ((screen.width() - total) * 0.5).max(0.0)
    } else {
        screen.left() + 28.0
    };
    egui::Area::new(egui::Id::new("socdof-lock-accounts"))
        .fixed_pos(Pos2::new(left, screen.bottom() - 32.0 - 86.0))
        .order(egui::Order::Foreground)
        .show(ui.ctx(), |ui| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 18.0;
                for user in &users {
                    let selected = state
                        .user
                        .as_ref()
                        .is_some_and(|current| current.id == user.id);
                    let (rect, response) =
                        ui.allocate_exact_size(Vec2::new(76.0, 86.0), egui::Sense::click());
                    if selected || response.hovered() {
                        ui.painter().rect(
                            rect.shrink(2.0),
                            egui::Rounding::same(12.0),
                            crate::tokens::with_alpha(
                                theme.palette.text,
                                if selected { 20 } else { 10 },
                            ),
                            egui::Stroke::new(1.0_f32, kit::hairline_color(theme)),
                        );
                    }
                    let avatar_rect = egui::Rect::from_min_size(
                        Pos2::new(rect.center().x - 22.0, rect.top() + 4.0),
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
                        if user.passwordless && quick_switch_allowed {
                            quick_switch = Some(user.id);
                        } else {
                            state.user = Some(user.clone());
                            state.password.clear();
                            state.error = None;
                            focus.set_focus(None);
                        }
                    }
                }
                let (rect, response) =
                    ui.allocate_exact_size(Vec2::new(110.0, 86.0), egui::Sense::click());
                let tile = egui::Rect::from_min_size(
                    Pos2::new(rect.center().x - 22.0, rect.top() + 4.0),
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
                let galley = ui.painter().layout(
                    texts.get("auth_switch_user").to_owned(),
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
                    switch_user = true;
                }
            });
        });

    if let Some(user_id) = quick_switch {
        let _ = state.quick_switch_to(store, user_id, now);
        return;
    }
    if unlock || submit {
        match state.user.as_ref().filter(|user| user.passwordless) {
            Some(user) => {
                let _ = state.quick_switch_to(store, user.id, now);
            }
            None => {
                let _ = state.unlock(store, now);
            }
        }
    }
    if switch_user {
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
        messages(ui, theme, texts, state, now, true);
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
        passwordless: false,
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
    fn externally_revoked_session_returns_to_login_on_next_validation() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        let user_id = state.user.as_ref().expect("user").id;
        store.sign_out_all(user_id, NOW + 1).expect("revoke all");

        state
            .tick_with_store(&store, NOW + 2)
            .expect("validate session");

        assert_eq!(state.view, AuthView::Login);
        assert!(state.user.is_none());
        assert!(state.session.is_none());
        assert!(state.token.is_none());
    }

    #[test]
    fn expired_session_cannot_be_resumed_from_the_lock_screen() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        state.session.as_mut().expect("session").expires_at = NOW + 100;
        state.lock(NOW);

        state.tick(NOW + 100);

        assert_eq!(state.view, AuthView::Login);
        assert!(state.user.is_none());
        assert!(state.session.is_none());
        assert!(state.token.is_none());
    }

    #[test]
    fn disabled_and_unknown_accounts_return_the_same_login_error() {
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
            passwordless: false,
            created_at: NOW,
            updated_at: NOW,
        };
        store.insert_user(&disabled).unwrap();
        let mut state = AuthState::new(&store, NOW).unwrap();

        state.username = "jonas".to_string();
        state.password = "Socdof2026!".to_string();
        state.login(&store, NOW).unwrap();
        assert_eq!(state.error, Some("auth_error_invalid"));
        assert_ne!(state.view, AuthView::Unlocked);

        state.username = "niemand".to_string();
        state.password = "egal-egal".to_string();
        state.login(&store, NOW).unwrap();
        assert_eq!(state.error, Some("auth_error_invalid"));
    }

    #[test]
    fn administrator_password_reset_requires_new_password_and_recovery_answers_before_desktop() {
        let store = Store::open_in_memory().expect("store");
        let mut user = seed_auth_user(&store, NOW).expect("admin");
        user.must_change_password = true;
        store.update_user(&user).expect("require password change");

        let mut state = AuthState::new(&store, NOW).expect("auth");
        state.username = user.username.clone();
        state.password = "Socdof2026!".to_string();
        state.login(&store, NOW).expect("login");
        assert_eq!(state.view, AuthView::ChangePassword);
        assert!(state.session.is_some());

        state.recovery_new_password = "A-new-strong-password-2026!".to_string();
        state.recovery_confirm_password = state.recovery_new_password.clone();
        state.recovery_answer_one = "First pet".to_string();
        state.recovery_answer_two.clear();
        state
            .complete_forced_password_change(&store, NOW + 1)
            .expect("validate forced password change");
        assert_eq!(state.view, AuthView::ChangePassword);
        assert_eq!(state.error, Some("auth_force_password_answers_required"));
        assert!(store
            .authenticate(&user.username, "Socdof2026!")
            .expect("old password remains")
            .is_some());

        state.recovery_answer_two = "Birth city".to_string();
        state
            .complete_forced_password_change(&store, NOW + 2)
            .expect("complete forced password change");

        assert_eq!(state.view, AuthView::Unlocked);
        assert_eq!(state.status, Some("auth_password_changed"));
        assert!(!state.user.as_ref().expect("user").must_change_password);
        assert!(socdof_core::security_questions::verify_security_answer(
            &store,
            user.id,
            0,
            "FIRST PET"
        )
        .expect("answer verification"));
        let stored = store
            .find_user_by_username(&user.username)
            .expect("find")
            .expect("user");
        assert!(!stored.must_change_password);
        assert!(store
            .session_for_token(state.token.as_deref().expect("active token"), NOW + 3)
            .expect("session remains valid")
            .is_some());
        assert!(socdof_core::security::verify_password(
            "A-new-strong-password-2026!",
            &stored.password_hash
        ));
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
        // The wizard defaults to the first recovery question and requires an answer; the shortest
        // valid path is the explicit "no question" choice of the TypeScript setup.
        state.recovery_choice = RecoveryChoice::None;
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
    fn first_admin_setup_persists_optional_recovery_answers() {
        let store = Store::open_in_memory().expect("store");
        let mut state = AuthState::new(&store, now_millis()).expect("setup state");
        state.display_name = "First Admin".to_string();
        state.username = "first-admin".to_string();
        state.password = "FirstAdminPassword2026!".to_string();
        state.password_confirm = state.password.clone();
        state.recovery_answer_one = "First pet".to_string();
        state.recovery_answer_two = "Childhood city".to_string();

        state
            .create_first_admin(&store, now_millis())
            .expect("create first admin");

        let user = store
            .find_user_by_username("first-admin")
            .expect("find account")
            .expect("account created");
        let answers = socdof_core::security_questions::security_answers(&store, user.id)
            .expect("recovery answers");
        assert!(answers.is_configured());
        let account_type_key = format!("account_type:{}", user.id);
        assert_eq!(
            store
                .get_setting(&account_type_key)
                .expect("account type")
                .and_then(|value| value.as_str().map(str::to_owned))
                .as_deref(),
            Some("personal")
        );
        assert!(socdof_core::security_questions::verify_security_answer(
            &store,
            user.id,
            0,
            "FIRST PET"
        )
        .expect("verify first answer"));
    }

    #[test]
    fn first_admin_setup_stores_a_custom_or_no_recovery_question() {
        // A custom question is stored as free text, together with its hashed answer.
        let store = Store::open_in_memory().expect("store");
        let mut state = AuthState::new(&store, now_millis()).expect("setup state");
        state.display_name = "Custom Admin".to_string();
        state.username = "custom-admin".to_string();
        state.password = "CustomAdmin2026!".to_string();
        state.password_confirm = state.password.clone();
        state.recovery_choice = RecoveryChoice::Custom;
        state.recovery_custom_question = "Wie hieß mein Hund?".to_string();
        state.recovery_answer_one = "Bella".to_string();
        state
            .create_first_admin(&store, now_millis())
            .expect("create with custom question");
        let user = store
            .find_user_by_username("custom-admin")
            .expect("find")
            .expect("created");
        assert_eq!(
            socdof_core::security_questions::questions_of(&store, user.id).expect("questions"),
            ["Wie hieß mein Hund?"]
        );
        assert!(
            socdof_core::security_questions::verify_any_answer(&store, user.id, "BELLA")
                .expect("verify")
        );

        // "No question" is valid and stores nothing, so recovery stays unavailable.
        let store = Store::open_in_memory().expect("store");
        let mut state = AuthState::new(&store, now_millis()).expect("setup state");
        state.display_name = "Plain Admin".to_string();
        state.username = "plain-admin".to_string();
        state.password = "PlainAdmin2026!".to_string();
        state.password_confirm = state.password.clone();
        state.recovery_choice = RecoveryChoice::None;
        state
            .create_first_admin(&store, now_millis())
            .expect("create without question");
        let user = store
            .find_user_by_username("plain-admin")
            .expect("find")
            .expect("created");
        assert!(
            !socdof_core::security_questions::security_answers(&store, user.id)
                .expect("answers")
                .is_configured()
        );

        // A missing answer is rejected before the account is written.
        let store = Store::open_in_memory().expect("store");
        let mut state = AuthState::new(&store, now_millis()).expect("setup state");
        state.display_name = "Late Admin".to_string();
        state.username = "late-admin".to_string();
        state.password = "LateAdmin2026!".to_string();
        state.password_confirm = state.password.clone();
        state.recovery_choice = RecoveryChoice::Preset;
        state.recovery_preset = 2;
        state
            .create_first_admin(&store, now_millis())
            .expect("missing answer is a form error");
        assert_eq!(state.error, Some("setup_recovery_answer_required"));
        assert_eq!(store.user_count().expect("count"), 0);
    }

    #[test]
    fn one_configured_question_recovers_the_account() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        let user_id = state.user.as_ref().expect("signed-in user").id;
        socdof_core::security_questions::save_security_question(
            &store,
            user_id,
            "setup_recovery_q5",
            "Bolzano",
        )
        .expect("save single question");

        state.show_login();
        state.username = "admin".to_string();
        state.begin_recovery(&store);
        assert_eq!(state.view, AuthView::Recover);
        assert_eq!(state.recovery_questions, ["setup_recovery_q5"]);

        state.recovery_answer_one = "bolzano".to_string();
        state.recovery_answer_two.clear();
        state.recovery_new_password = "recovered-password-2026".to_string();
        state.recovery_confirm_password = state.recovery_new_password.clone();
        state
            .reset_password_with_recovery(&store, now_millis())
            .expect("password reset");
        assert_eq!(state.view, AuthView::Login);
        assert!(store
            .authenticate("admin", "recovered-password-2026")
            .expect("new password")
            .is_some());
    }

    #[test]
    fn the_sign_in_loading_screen_runs_before_the_login_completes() {
        let store = store_with_admin();
        let mut state = AuthState::new(&store, NOW).expect("state");
        state.username = "admin".to_string();
        state.password = "Socdof2026!".to_string();
        state.begin_sign_in(NOW);
        assert!(state.signing_in(NOW));
        assert_eq!(state.view, AuthView::Login);

        state.tick_sign_in(&store, NOW + SIGN_IN_LOADING_MS / 2);
        assert_eq!(
            state.view,
            AuthView::Login,
            "the screen stays until its delay elapsed"
        );
        state.tick_sign_in(&store, NOW + SIGN_IN_LOADING_MS);
        assert_eq!(state.view, AuthView::Unlocked);
        assert!(!state.signing_in(NOW + SIGN_IN_LOADING_MS));
    }

    #[test]
    fn missing_credentials_stay_a_form_error_instead_of_a_loading_screen() {
        let store = store_with_admin();
        let mut state = AuthState::new(&store, NOW).expect("state");
        state.username = "admin".to_string();
        state.begin_sign_in(NOW);
        assert_eq!(state.error, Some("auth_error_required"));
        assert!(!state.signing_in(NOW));
        assert_eq!(state.view, AuthView::Login);
    }

    #[test]
    fn the_lockout_counts_down_in_seconds_like_the_legacy_form() {
        let store = store_with_admin();
        let mut state = AuthState::new(&store, NOW).expect("state");
        state.locked_until = Some(NOW + 4_500);
        assert_eq!(state.lockout_seconds(NOW), 5);
        assert_eq!(state.lockout_seconds(NOW + 4_000), 1);
        assert_eq!(state.lockout_seconds(NOW + 4_500), 0);
        state.locked_until = None;
        assert_eq!(state.lockout_seconds(NOW), 0);
    }

    #[test]
    fn security_answers_recover_an_account_and_reset_its_password() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        let user_id = state.user.as_ref().expect("signed-in user").id;
        socdof_core::security_questions::save_security_answers(
            &store,
            user_id,
            &["Fluffy".to_string(), "Bolzano".to_string()],
        )
        .expect("save recovery answers");

        state.show_login();
        state.username = "admin".to_string();
        state.begin_recovery(&store);
        assert_eq!(state.view, AuthView::Recover);

        state.recovery_answer_one = "wrong".to_string();
        state.recovery_answer_two = "bolzano".to_string();
        state.recovery_new_password = "recovered-password-2026".to_string();
        state.recovery_confirm_password = state.recovery_new_password.clone();
        state
            .reset_password_with_recovery(&store, now_millis())
            .expect("wrong answer check");
        assert_eq!(state.error, Some("auth_recovery_invalid"));
        assert!(store
            .authenticate("admin", "Socdof2026!")
            .expect("old password")
            .is_some());

        state.recovery_answer_one = "FLUFFY".to_string();
        state
            .reset_password_with_recovery(&store, now_millis())
            .expect("password reset");
        assert_eq!(state.view, AuthView::Login);
        assert_eq!(state.status, Some("auth_recovery_done"));
        assert!(state.user.is_none());
        assert!(state.session.is_none());
        assert!(store
            .authenticate("admin", "recovered-password-2026")
            .expect("new password")
            .is_some());
    }

    #[test]
    fn renders_all_six_views_in_every_language_and_theme() {
        let store = store_with_admin();
        let mut state = signed_in(&store);
        let user_id = state.user.as_ref().expect("admin").id;
        socdof_core::security_questions::save_security_answers(
            &store,
            user_id,
            &["first pet".to_string(), "childhood city".to_string()],
        )
        .expect("recovery answers");
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
                    AuthView::Recover,
                    AuthView::ChangePassword,
                ] {
                    match view {
                        AuthView::Login => state.show_login(),
                        AuthView::Locked => state.lock(now_millis()),
                        AuthView::Setup => state.show_setup(),
                        AuthView::Unlocked => state.show_unlocked(),
                        AuthView::Recover => {
                            state.username = "admin".to_string();
                            state.begin_recovery(&store);
                        }
                        AuthView::ChangePassword => {
                            state.user = Some(
                                store
                                    .find_user_by_username("admin")
                                    .unwrap()
                                    .expect("admin"),
                            );
                            state.view = AuthView::ChangePassword;
                            state.recovery_new_password = "temporary-password".to_string();
                            state.recovery_confirm_password = state.recovery_new_password.clone();
                            state.recovery_answer_one = "first pet".to_string();
                            state.recovery_answer_two = "childhood city".to_string();
                        }
                    }
                    let ctx = crate::theme::headless_context();
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

#[cfg(test)]
mod lock_conflict_tests {
    use super::*;
    use socdof_core::lock::LockInfo;

    fn owner() -> LockInfo {
        LockInfo {
            pid: 4711,
            user: "anna".to_string(),
            machine: "share-pc".to_string(),
            started_at: 1_000,
            heartbeat_at: 2_000,
            request_quit: false,
        }
    }

    #[test]
    fn names_the_owner_and_keeps_the_takeover_explicit() {
        let mut conflict = LockConflict::new(owner());
        assert_eq!(conflict.owner_label(), "share-pc / anna (pid 4711)");
        assert!(!conflict.take_over);
        assert!(!conflict.cancelled);

        conflict.accept();
        assert!(conflict.take_over);
        assert!(!conflict.cancelled);
    }

    #[test]
    fn cancelling_withdraws_a_previous_takeover() {
        let mut conflict = LockConflict::new(owner());
        conflict.accept();
        conflict.cancel();
        assert!(conflict.cancelled);
        assert!(
            !conflict.take_over,
            "a cancelled dialog must not take the lock"
        );
    }

    #[test]
    fn a_missing_owner_renders_an_empty_label() {
        let conflict = LockConflict::default();
        assert_eq!(conflict.owner_label(), "");
        assert_eq!(conflict.owner, None);
    }
}

#[cfg(test)]
mod auth_flow_tests {
    use super::*;

    fn empty_store() -> Store {
        Store::open_in_memory().expect("in-memory store")
    }

    fn configure_first_admin(auth: &mut AuthState) {
        auth.username = "owner".to_string();
        auth.display_name = "SOCDOF Owner".to_string();
        auth.password = "correct horse battery".to_string();
        auth.password_confirm = auth.password.clone();
        auth.recovery_answer_one = "Rex".to_string();
    }

    #[test]
    fn first_run_creates_the_first_admin_and_opens_a_real_session() {
        let store = empty_store();
        let mut auth = AuthState::new(&store, 1_000).expect("initial auth state");
        assert_eq!(auth.view, AuthView::Setup);

        configure_first_admin(&mut auth);
        auth.create_first_admin(&store, 1_000)
            .expect("create first administrator");

        assert_eq!(store.user_count().expect("user count"), 1);
        assert_eq!(auth.view, AuthView::Unlocked);
        assert_eq!(
            auth.user.as_ref().expect("signed-in user").role,
            UserRole::Admin
        );
        assert!(auth.session.is_some());
        assert!(auth.token.is_some());
        assert_ne!(
            store
                .find_user_by_username("owner")
                .expect("find owner")
                .expect("stored owner")
                .password_hash,
            "correct horse battery"
        );

        let next_start = AuthState::new(&store, 2_000).expect("next startup");
        assert_eq!(next_start.view, AuthView::Login);
    }

    #[test]
    fn concurrent_first_run_forms_cannot_create_two_administrators() {
        let store = empty_store();
        let mut first = AuthState::new(&store, 1_000).expect("first setup");
        let mut stale = AuthState::new(&store, 1_000).expect("stale setup");
        configure_first_admin(&mut first);
        configure_first_admin(&mut stale);
        stale.username = "second-owner".to_string();

        first
            .create_first_admin(&store, 1_000)
            .expect("first administrator");
        stale
            .create_first_admin(&store, 1_001)
            .expect("stale setup is rejected as a handled validation state");

        assert_eq!(store.user_count().expect("user count"), 1);
        assert_eq!(stale.error, Some("auth_error_setup_exists"));
    }

    #[test]
    fn login_lockout_expires_and_the_correct_password_then_succeeds() {
        let store = empty_store();
        let mut setup = AuthState::new(&store, 1_000).expect("initial setup");
        configure_first_admin(&mut setup);
        setup
            .create_first_admin(&store, 1_000)
            .expect("create administrator");

        let mut login = AuthState::new(&store, 2_000).expect("login state");
        login.username = "owner".to_string();
        login.password = "incorrect password".to_string();
        for attempt in 0..MAX_FAILED_ATTEMPTS {
            // AuthState clears the password after every submission, just like the real form.
            // Re-enter it so each loop iteration represents a distinct failed sign-in attempt.
            login.password = "incorrect password".to_string();
            login
                .login(&store, 2_000 + attempt * 1_000)
                .expect("failed login is a handled outcome");
        }

        let locked_until = login.locked_until.expect("persistent lockout");
        assert_eq!(login.error, Some("auth_error_locked"));
        assert_eq!(login.view, AuthView::Login);

        // Recreate the auth state to model closing and relaunching the application.
        // The next login must still be rejected by the SQLite-backed lockout record.
        let mut restarted = AuthState::new(&store, locked_until - 1).expect("restarted auth state");
        restarted.username = "owner".to_string();
        restarted.password = "correct horse battery".to_string();
        restarted
            .login(&store, locked_until - 1)
            .expect("locked login is a handled outcome");
        assert_eq!(restarted.locked_until, Some(locked_until));
        assert_eq!(restarted.error, Some("auth_error_locked"));

        restarted.password = "correct horse battery".to_string();
        restarted
            .login(&store, locked_until + 1)
            .expect("login after lockout");
        assert_eq!(restarted.view, AuthView::Unlocked);
        assert_eq!(
            restarted.user.as_ref().expect("signed-in user").username,
            "owner"
        );
        assert!(restarted.session.is_some());
    }
}
