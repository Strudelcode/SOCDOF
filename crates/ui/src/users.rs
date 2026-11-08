//! User management screen: accounts, roles, password resets, sessions and recovery questions.
//!
//! This is the Phase 6 surface for local access management. It reads and writes through
//! [`Store::list_users`], [`Store::insert_user`], [`Store::update_user`] and
//! [`Store::delete_user`], hashes passwords with [`socdof_core::security::hash_password`], revokes
//! sessions with [`Store::sign_out_all`] and stores recovery answers as Argon2id hashes through
//! [`socdof_core::security_questions`]. The last active administrator is protected by the core
//! store; the screen maps that rejection to a catalogue message.

use egui::{Context, RichText};
use socdof_core::domain::permission::Role;
use socdof_core::domain::user::{User, UserRole};
use socdof_core::security::{hash_password, MIN_PASSWORD_LENGTH};
use socdof_core::security_questions;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::{select, switch, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the deterministic gallery data.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// View currently shown by the user management screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum UsersView {
    /// Searchable account list.
    #[default]
    List,
    /// Account detail with password, session and recovery actions.
    Detail,
    /// Create or edit form.
    Form,
}

/// Editable account values.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserDraft {
    /// Existing account, `None` while creating.
    pub id: Option<Uuid>,
    /// Login name.
    pub username: String,
    /// Name shown in the interface.
    pub display_name: String,
    /// New password; empty keeps the current one while editing.
    pub password: String,
    /// Repeated password.
    pub password_confirm: String,
    /// Whether the account may sign in.
    pub active: bool,
    /// Force a password change after the next sign-in.
    pub must_change_password: bool,
    /// Index into the role choices: 0 admin, 1 user, 2+ custom roles.
    pub role_choice: usize,
}

impl Default for UserDraft {
    fn default() -> Self {
        Self {
            id: None,
            username: String::new(),
            display_name: String::new(),
            password: String::new(),
            password_confirm: String::new(),
            active: true,
            must_change_password: true,
            role_choice: 1,
        }
    }
}

impl UserDraft {
    /// Fills the draft from a stored account.
    pub fn from_user(user: &User, roles: &[Role]) -> Self {
        Self {
            id: Some(user.id),
            username: user.username.clone(),
            display_name: user.display_name.clone(),
            password: String::new(),
            password_confirm: String::new(),
            active: user.active,
            must_change_password: user.must_change_password,
            role_choice: role_choice_for(user, roles),
        }
    }

    /// Builds the account to store. The password is hashed only when one was entered.
    fn build(&self, base: Option<&User>, roles: &[Role], now: i64) -> Result<User, &'static str> {
        if !self.password.is_empty() && self.password != self.password_confirm {
            return Err("users_error_password_mismatch");
        }

        let mut user = match base {
            Some(user) => user.clone(),
            None => User {
                id: Uuid::new_v4(),
                username: String::new(),
                display_name: String::new(),
                role: UserRole::User,
                role_id: None,
                active: true,
                password_hash: String::new(),
                must_change_password: true,
                created_at: now,
                updated_at: now,
            },
        };

        user.username = self.username.trim().to_string();
        user.display_name = self.display_name.trim().to_string();
        user.active = self.active;
        user.must_change_password = self.must_change_password;
        user.updated_at = now;
        match self.role_choice {
            0 => {
                user.role = UserRole::Admin;
                user.role_id = None;
            }
            1 => {
                user.role = UserRole::User;
                user.role_id = None;
            }
            index => {
                let role = roles
                    .get(index.saturating_sub(2))
                    .ok_or("users_error_role")?;
                user.role = UserRole::User;
                user.role_id = Some(role.id.to_string());
            }
        }

        if base.is_none() || !self.password.is_empty() {
            if self.password.chars().count() < MIN_PASSWORD_LENGTH {
                return Err("users_error_password_short");
            }
            user.password_hash =
                hash_password(&self.password).map_err(|_| "users_error_password_short")?;
        }

        Ok(user)
    }
}

/// State of the user management screen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UsersState {
    /// Search text.
    pub query: String,
    /// Accounts matching the last refresh.
    pub users: Vec<User>,
    /// Available roles.
    pub roles: Vec<Role>,
    /// Selected account.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: UsersView,
    /// Values of the form.
    pub draft: UserDraft,
    /// Role dropdown.
    pub role_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// New password in the detail view.
    pub reset_password: String,
    /// Repeated new password.
    pub reset_confirm: String,
    /// First recovery answer.
    pub answer_one: String,
    /// Second recovery answer.
    pub answer_two: String,
    /// Number of active sessions of the selected account.
    pub sessions: i64,
    /// Whether the selected account has recovery answers.
    pub security_configured: bool,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button or Escape on the list was used.
    pub back: bool,
    loaded: bool,
    loaded_selected: Option<Uuid>,
}

impl UsersState {
    /// Creates an unloaded screen; the first [`UsersState::refresh`] loads the store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads accounts and roles.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if self.loaded {
            return Ok(());
        }
        self.users = store.list_users()?;
        self.roles = store.list_roles()?;
        self.selected = self
            .selected
            .filter(|id| self.users.iter().any(|user| user.id == *id))
            .or_else(|| self.users.first().map(|user| user.id));
        self.loaded = true;
        Ok(())
    }

    /// Reloads the selected account's session count and recovery state.
    pub fn refresh_selected(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            self.sessions = 0;
            self.security_configured = false;
            self.loaded_selected = None;
            return Ok(());
        };
        if self.loaded_selected == Some(id) {
            return Ok(());
        }
        self.sessions = store.active_session_count(id, now)?;
        self.security_configured = security_questions::security_answers(store, id)?.is_configured();
        self.loaded_selected = Some(id);
        Ok(())
    }

    /// Accounts matching the search text.
    pub fn filtered(&self) -> Vec<&User> {
        let query = self.query.trim().to_lowercase();
        self.users
            .iter()
            .filter(|user| {
                query.is_empty()
                    || user.username.to_lowercase().contains(&query)
                    || user.display_name.to_lowercase().contains(&query)
            })
            .collect()
    }

    /// Selected account.
    pub fn current(&self) -> Option<&User> {
        self.selected
            .and_then(|id| self.users.iter().find(|user| user.id == id))
    }

    /// Opens the detail view.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.loaded_selected = None;
        self.reset_password.clear();
        self.reset_confirm.clear();
        self.answer_one.clear();
        self.answer_two.clear();
        self.error = None;
        self.status = None;
        self.view = UsersView::Detail;
    }

    /// Opens the empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = UserDraft::default();
        self.error = None;
        self.status = None;
        self.view = UsersView::Form;
    }

    /// Opens the form with the selected account.
    pub fn start_edit(&mut self) {
        let Some(user) = self.current() else {
            return;
        };
        self.draft = UserDraft::from_user(user, &self.roles);
        self.error = None;
        self.status = None;
        self.view = UsersView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            UsersView::Detail
        } else {
            UsersView::List
        };
    }

    /// Validates and stores the draft.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let user = match self.draft.build(base.as_ref(), &self.roles, now) {
            Ok(user) => user,
            Err(key) => {
                self.error = Some(key);
                return Ok(());
            }
        };
        if let Err(code) = user.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        let result = if base.is_some() {
            store.update_user(&user)
        } else {
            store.insert_user(&user)
        };
        if let Err(error) = result {
            self.error = Some(storage_key(&error));
            self.status = None;
            return Ok(());
        }

        self.selected = Some(user.id);
        self.loaded_selected = None;
        self.view = UsersView::Detail;
        self.error = None;
        self.status = Some("users_saved");
        self.loaded = false;
        self.refresh(store)?;
        self.refresh_selected(store, now)?;
        Ok(())
    }

    /// Deletes the selected account after confirmation.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };
        if let Err(error) = store.delete_user(id) {
            self.error = Some(storage_key(&error));
            self.confirm_delete = false;
            return Ok(());
        }
        self.selected = None;
        self.view = UsersView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("users_deleted");
        self.loaded = false;
        self.refresh(store)?;
        Ok(())
    }

    /// Resets the selected account's password and revokes its sessions.
    pub fn reset_selected_password(
        &mut self,
        store: &Store,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };
        if self.reset_password != self.reset_confirm {
            self.error = Some("users_error_password_mismatch");
            return Ok(());
        }
        let hash = match hash_password(&self.reset_password) {
            Ok(hash) => hash,
            Err(_) => {
                self.error = Some("users_error_password_short");
                return Ok(());
            }
        };
        if store.set_password(id, &hash).is_err() {
            self.error = Some("users_error_password");
            return Ok(());
        }
        store.sign_out_all(id, now)?;
        self.reset_password.clear();
        self.reset_confirm.clear();
        self.loaded_selected = None;
        self.error = None;
        self.status = Some("users_password_reset");
        self.refresh_selected(store, now)?;
        Ok(())
    }

    /// Revokes every session of the selected account.
    pub fn revoke_sessions(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };
        store.sign_out_all(id, now)?;
        self.loaded_selected = None;
        self.error = None;
        self.status = Some("users_sessions_revoked");
        self.refresh_selected(store, now)?;
        Ok(())
    }

    /// Stores both recovery answers as hashes.
    pub fn save_security(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };
        let answers = [self.answer_one.clone(), self.answer_two.clone()];
        if let Err(_error) = security_questions::save_security_answers(store, id, &answers) {
            self.error = Some("users_error_security_answers");
            return Ok(());
        }
        self.answer_one.clear();
        self.answer_two.clear();
        self.security_configured = true;
        self.error = None;
        self.status = Some("users_security_saved");
        Ok(())
    }

    /// Creates three deterministic accounts for the gallery.
    pub fn seed(store: &Store) -> socdof_core::CoreResult<()> {
        if !store.list_users()?.is_empty() {
            return Ok(());
        }
        let now = SAMPLE_NOW_MS;
        let hash = hash_password("Socdof2026!")?;
        for (username, display, role, active, must_change) in [
            ("admin", "Alex Administrator", UserRole::Admin, true, false),
            ("mira", "Mira Berger", UserRole::User, true, true),
            ("jonas", "Jonas Weber", UserRole::User, false, false),
        ] {
            let user = User {
                id: Uuid::new_v4(),
                username: username.to_string(),
                display_name: display.to_string(),
                role,
                role_id: None,
                active,
                password_hash: hash.clone(),
                must_change_password: must_change,
                created_at: now,
                updated_at: now,
            };
            store.insert_user(&user)?;
        }
        Ok(())
    }
}

/// Seeds the gallery accounts. It is a no-op when accounts already exist.
pub fn seed_users(store: &Store) -> socdof_core::CoreResult<()> {
    UsersState::seed(store)
}

fn role_choice_for(user: &User, roles: &[Role]) -> usize {
    if let Some(id) = user.role_id.as_deref() {
        if let Some(index) = roles.iter().position(|role| role.id.to_string() == id) {
            return index + 2;
        }
    }
    match user.role {
        UserRole::Admin => 0,
        UserRole::User => 1,
    }
}

fn role_name<'a>(user: &'a User, roles: &'a [Role], texts: &'a UiTexts) -> &'a str {
    if let Some(id) = user.role_id.as_deref() {
        if let Some(role) = roles.iter().find(|role| role.id.to_string() == id) {
            return role.name.as_str();
        }
    }
    match user.role {
        UserRole::Admin => texts.get("users_role_admin"),
        UserRole::User => texts.get("users_role_user"),
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "username_too_short" => "users_error_username_short",
        "username_invalid_characters" => "users_error_username_invalid",
        "display_name_required" => "users_error_display_name",
        "password_hash_required" => "users_error_password_short",
        _ => "users_error_validation",
    }
}

fn storage_key(error: &socdof_core::CoreError) -> &'static str {
    match error {
        socdof_core::CoreError::Validation(code) if code == "last_admin" => {
            "users_error_last_admin"
        }
        _ => "users_error_storage",
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &UsersState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut UsersState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("users"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

/// Renders the user management screen into the context.
pub fn users(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut UsersState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            UsersView::List => state.back = true,
            UsersView::Detail => state.view = UsersView::List,
            UsersView::Form => state.cancel_edit(),
        }
    }
    if state.refresh(store).is_err() {
        state.error = Some("users_error_load");
    }
    if state.refresh_selected(store, now).is_err() {
        state.error = Some("users_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                UsersView::List => list_view(ui, theme, texts, focus, state),
                UsersView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
                UsersView::Form => form_view(ui, theme, texts, focus, state, store, now),
            });
        });

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("users_delete_title"),
            |ui| {
                ui.label(texts.get("users_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("users_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("users_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        close = true;
                    }
                });
                close
            },
        );
    }
    state.confirm_delete = open;
    if confirm && state.delete_selected(store).is_err() {
        state.error = Some("users_error_delete");
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut UsersState,
) {
    let subtitle = format!("{} · {}", state.users.len(), texts.get("users_subtitle"));
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("users_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("users_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("users_search"),
            150.0,
        );
    });
    if create {
        state.start_new();
        return;
    }

    ui.add_space(12.0);
    let filtered: Vec<Uuid> = state.filtered().into_iter().map(|user| user.id).collect();
    if filtered.is_empty() {
        card(ui, theme, |ui| {
            empty_state(
                ui,
                theme,
                texts.get("users_empty_title"),
                texts.get("users_empty_hint"),
            );
        });
        return;
    }

    let mut chosen = None;
    let roles = state.roles.clone();
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-users-table")
            .num_columns(5)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "users_col_name",
                    "users_col_username",
                    "users_col_role",
                    "users_col_status",
                    "users_col_flags",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for id in filtered {
                    let user = state
                        .users
                        .iter()
                        .find(|user| user.id == id)
                        .expect("filtered user");
                    if button(ui, theme, focus, &user.display_name, ButtonVariant::Ghost).activated
                    {
                        chosen = Some(user.id);
                    }
                    ui.label(&user.username);
                    ui.label(role_name(user, &roles, texts));
                    badge(
                        ui,
                        theme,
                        if user.active {
                            texts.get("users_active")
                        } else {
                            texts.get("users_inactive")
                        },
                        if user.active {
                            Tone::Success
                        } else {
                            Tone::Neutral
                        },
                    );
                    ui.horizontal(|ui| {
                        if user.is_admin() {
                            badge(ui, theme, texts.get("users_admin_badge"), Tone::Accent);
                        }
                        if user.must_change_password {
                            badge(ui, theme, texts.get("users_must_change"), Tone::Warning);
                        }
                        if user.role_id.is_some() {
                            badge(ui, theme, texts.get("users_custom_role"), Tone::Neutral);
                        }
                    });
                    ui.end_row();
                }
            });
    });
    if let Some(id) = chosen {
        state.select(id);
    }
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut UsersState,
    store: &Store,
    now: i64,
) {
    let Some(user) = state.current().cloned() else {
        state.view = UsersView::List;
        return;
    };
    let roles = state.roles.clone();
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("users_detail_title"),
        &format!("@{}", user.username),
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&user.display_name).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                if user.active {
                    texts.get("users_active")
                } else {
                    texts.get("users_inactive")
                },
                if user.active {
                    Tone::Success
                } else {
                    Tone::Neutral
                },
            );
            if user.is_admin() {
                badge(ui, theme, texts.get("users_admin_badge"), Tone::Accent);
            }
        });
        ui.add_space(8.0);
        egui::Grid::new("socdof-user-detail")
            .num_columns(2)
            .spacing(egui::vec2(18.0, 6.0))
            .show(ui, |ui| {
                for (label, value) in [
                    ("users_col_username", user.username.clone()),
                    (
                        "users_col_role",
                        role_name(&user, &roles, texts).to_string(),
                    ),
                    ("users_sessions", format!("{}", state.sessions)),
                    (
                        "users_must_change_label",
                        if user.must_change_password {
                            texts.get("users_yes").to_string()
                        } else {
                            texts.get("users_no").to_string()
                        },
                    ),
                    (
                        "users_security_status",
                        if state.security_configured {
                            texts.get("users_security_configured").to_string()
                        } else {
                            texts.get("users_security_missing").to_string()
                        },
                    ),
                ] {
                    ui.label(
                        RichText::new(texts.get(label))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(value);
                    ui.end_row();
                }
            });
        ui.add_space(10.0);
        let mut edit = false;
        let mut delete = false;
        let mut revoke = false;
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("users_edit"),
                ButtonVariant::Primary,
            )
            .activated
            {
                edit = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("users_revoke_sessions"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                revoke = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("users_delete"),
                ButtonVariant::Danger,
            )
            .activated
            {
                delete = true;
            }
        });
        if edit {
            state.start_edit();
        }
        if revoke {
            let _ = state.revoke_sessions(store, now);
        }
        if delete {
            state.confirm_delete = true;
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("users_password_title")).strong());
        ui.label(
            RichText::new(texts.get("users_password_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        ui.columns(2, |columns| {
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.reset_password,
                texts.get("users_new_password"),
                texts.get("users_password_placeholder"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.reset_confirm,
                texts.get("users_password_confirm"),
                texts.get("users_password_placeholder"),
                None,
            );
        });
        ui.add_space(6.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("users_reset_password"),
            ButtonVariant::Primary,
        )
        .activated
        {
            let _ = state.reset_selected_password(store, now);
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("users_security_title")).strong());
        ui.label(
            RichText::new(texts.get("users_security_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.answer_one,
            texts.get("users_security_question_one"),
            texts.get("users_security_answer_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.answer_two,
            texts.get("users_security_question_two"),
            texts.get("users_security_answer_hint"),
            None,
        );
        ui.add_space(6.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("users_security_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            let _ = state.save_security(store);
        }
    });
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut UsersState,
    store: &Store,
    now: i64,
) {
    let editing = state.draft.id.is_some();
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        if editing {
            texts.get("users_edit_title")
        } else {
            texts.get("users_new_title")
        },
        texts.get("users_subtitle"),
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let choices = role_choices(&state.roles, texts);
    let labels: Vec<&str> = choices.iter().map(String::as_str).collect();
    let mut save = false;
    let mut cancel = false;
    card(ui, theme, |ui| {
        ui.columns(2, |columns| {
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.draft.display_name,
                texts.get("users_col_name"),
                texts.get("users_name_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.draft.username,
                texts.get("users_col_username"),
                texts.get("users_username_hint"),
                None,
            );
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.draft.password,
                texts.get("users_new_password"),
                texts.get("users_password_placeholder"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.draft.password_confirm,
                texts.get("users_password_confirm"),
                texts.get("users_password_placeholder"),
                None,
            );
        });
        ui.add_space(6.0);
        select(
            ui,
            theme,
            focus,
            &mut state.role_popup,
            "users-role",
            &mut state.draft.role_choice,
            &labels,
        );
        ui.add_space(6.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.draft.active,
            texts.get("users_active_label"),
        );
        switch(
            ui,
            theme,
            focus,
            &mut state.draft.must_change_password,
            texts.get("users_must_change_label"),
        );
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("users_save"),
                ButtonVariant::Primary,
            )
            .activated
            {
                save = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("users_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save {
        let _ = state.save(store, now);
    }
    if cancel {
        state.cancel_edit();
    }
}

fn role_choices(roles: &[Role], texts: &UiTexts) -> Vec<String> {
    let mut choices = vec![
        texts.get("users_role_admin").to_string(),
        texts.get("users_role_user").to_string(),
    ];
    choices.extend(
        roles
            .iter()
            .filter(|role| !role.is_builtin)
            .map(|role| role.name.clone()),
    );
    choices
}

#[cfg(test)]
mod tests {
    use super::*;
    use socdof_core::domain::settings::Language;

    fn state() -> UsersState {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");
        state
    }

    #[test]
    fn lists_and_filters_accounts() {
        let mut state = state();
        assert_eq!(state.users.len(), 3);
        state.query = "mira".to_string();
        assert_eq!(state.filtered().len(), 1);
        state.query = "admin".to_string();
        assert_eq!(state.filtered().len(), 1);
    }

    #[test]
    fn creates_and_edits_an_account() {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");

        state.start_new();
        state.draft.username = "lena".to_string();
        state.draft.display_name = "Lena Klein".to_string();
        state.draft.password = "SicheresPasswort1!".to_string();
        state.draft.password_confirm = "SicheresPasswort1!".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("save");
        assert_eq!(state.error, None);
        assert_eq!(state.users.len(), 4);

        state.start_edit();
        state.draft.display_name = "Lena Groß".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("save edit");
        assert!(state
            .users
            .iter()
            .any(|user| user.display_name == "Lena Groß"));
    }

    #[test]
    fn rejects_short_password_and_mismatch() {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");
        state.start_new();
        state.draft.username = "lena".to_string();
        state.draft.display_name = "Lena".to_string();
        state.draft.password = "kurz".to_string();
        state.draft.password_confirm = "anders".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("save");
        assert_eq!(state.error, Some("users_error_password_mismatch"));
        state.draft.password_confirm = "kurz".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("save");
        assert_eq!(state.error, Some("users_error_password_short"));
    }

    #[test]
    fn protects_the_last_administrator() {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");
        let admin = state
            .users
            .iter()
            .find(|user| user.is_admin())
            .expect("admin")
            .id;
        state.select(admin);
        state.confirm_delete = true;
        state.delete_selected(&store).expect("delete");
        assert_eq!(state.error, Some("users_error_last_admin"));
        assert!(state.users.iter().any(|user| user.id == admin));
    }

    #[test]
    fn resets_password_revokes_sessions_and_saves_answers() {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");
        let user = state.users[1].id;
        state.select(user);
        state.reset_password = "NochEinPasswort1!".to_string();
        state.reset_confirm = "NochEinPasswort1!".to_string();
        state
            .reset_selected_password(&store, SAMPLE_NOW_MS)
            .expect("reset");
        assert_eq!(state.status, Some("users_password_reset"));

        state.answer_one = "Rex".to_string();
        state.answer_two = "Berlin".to_string();
        state.save_security(&store).expect("answers");
        assert!(state.security_configured);
        assert_eq!(state.error, None);
    }

    #[test]
    fn renders_in_every_language_and_both_themes() {
        let store = Store::open_in_memory().expect("store");
        UsersState::seed(&store).expect("seed");
        let mut state = UsersState::new();
        state.refresh(&store).expect("refresh");
        for language in [Language::De, Language::En, Language::Fr, Language::Es] {
            let texts = UiTexts::embedded(language).expect("texts");
            for appearance in [
                crate::theme::Appearance::Light,
                crate::theme::Appearance::Dark,
            ] {
                let ctx = Context::default();
                let theme = Theme::new(appearance, "indigo");
                let output = ctx.run(egui::RawInput::default(), |ctx| {
                    users(
                        ctx,
                        &theme,
                        &texts,
                        &mut FocusState::default(),
                        &mut state,
                        &store,
                        SAMPLE_NOW_MS,
                    );
                });
                assert!(output.shapes.len() > 20);
            }
        }
    }
}
