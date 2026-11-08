//! Settings screen with the eight tabs: general, appearance, security, backup, users, roles,
//! updates and portable mode.
//!
//! The screen is a thin presentation layer over the core services. The company profile is read and
//! written through [`socdof_core::settings_service`], appearance through the per-user
//! [`Preferences`], users through [`Store::insert_user`]/[`Store::update_user`]/[`Store::delete_user`],
//! roles through the role accessors, passwords through [`socdof_core::security::hash_password`] and
//! [`Store::set_password`], sessions through [`Store::sign_out_all`], backups through
//! [`socdof_core::backup`], and the update/portable policies through the settings service.
//!
//! Every visible string comes from the catalogue, every control registers in the shared
//! [`FocusState`] and all painting uses the design tokens.

use std::path::{Path, PathBuf};

use egui::{Context, RichText};
use socdof_core::backup::{self, BackupFile, BackupInfo, BackupMetadata};
use socdof_core::date;
use socdof_core::domain::permission::{
    AppModule, PermissionLevel, Role, ADMIN_ROLE_ID, ALL_MODULES, USER_ROLE_ID,
};
use socdof_core::domain::session::{LOCKOUT_MS, MAX_FAILED_ATTEMPTS, SESSION_TTL_MS};
use socdof_core::domain::settings::{CompanyProfile, Language, ThemeMode};
use socdof_core::domain::user::{User, UserRole};
use socdof_core::security::{hash_password, MIN_PASSWORD_LENGTH};
use socdof_core::settings_service::{
    self, PortableSettings, Preferences, UpdateChannel, UpdateSettings,
};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field, tabs, ButtonVariant, Tone,
};
use crate::controls::{select, switch, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{preset_ids, FONT_SMALL, FONT_TITLE};

/// Fixed timestamp used by the deterministic gallery data.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Settings tab.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum SettingsTab {
    /// Company profile.
    #[default]
    General,
    /// Language, theme, accent and start module.
    Appearance,
    /// Passwords and sessions.
    Security,
    /// Backup policy, archives and restore.
    Backup,
    /// User accounts.
    Users,
    /// Roles and permissions.
    Roles,
    /// Update policy and installed version.
    Updates,
    /// Portable data folder.
    Portable,
}

impl SettingsTab {
    /// Every tab in display order.
    pub const ALL: [SettingsTab; 8] = [
        SettingsTab::General,
        SettingsTab::Appearance,
        SettingsTab::Security,
        SettingsTab::Backup,
        SettingsTab::Users,
        SettingsTab::Roles,
        SettingsTab::Updates,
        SettingsTab::Portable,
    ];

    /// Position in the tab bar.
    pub fn index(self) -> usize {
        match self {
            SettingsTab::General => 0,
            SettingsTab::Appearance => 1,
            SettingsTab::Security => 2,
            SettingsTab::Backup => 3,
            SettingsTab::Users => 4,
            SettingsTab::Roles => 5,
            SettingsTab::Updates => 6,
            SettingsTab::Portable => 7,
        }
    }

    /// Tab from a bar position, falling back to the general tab.
    pub fn from_index(index: usize) -> Self {
        SettingsTab::ALL.get(index).copied().unwrap_or_default()
    }

    /// Catalogue key of the tab label.
    pub fn label_key(self) -> &'static str {
        match self {
            SettingsTab::General => "settings_tab_general",
            SettingsTab::Appearance => "settings_tab_appearance",
            SettingsTab::Security => "settings_tab_security",
            SettingsTab::Backup => "settings_tab_backup",
            SettingsTab::Users => "settings_tab_users",
            SettingsTab::Roles => "settings_tab_roles",
            SettingsTab::Updates => "settings_tab_updates",
            SettingsTab::Portable => "settings_tab_portable",
        }
    }
}

/// Editable company profile and backup policy.
#[derive(Debug, Clone, PartialEq, Eq)]
struct ProfileDraft {
    name: String,
    street: String,
    zip_city: String,
    country: String,
    email: String,
    phone: String,
    tax_id: String,
    currency: String,
    backup_folder_path: String,
    auto_backup_enabled: bool,
    backup_interval_minutes: String,
    backup_max_keep_count: String,
}

impl Default for ProfileDraft {
    fn default() -> Self {
        Self::from_profile(&CompanyProfile::default())
    }
}

impl ProfileDraft {
    fn from_profile(profile: &CompanyProfile) -> Self {
        Self {
            name: profile.name.clone(),
            street: profile.street.clone(),
            zip_city: profile.zip_city.clone(),
            country: profile.country.clone(),
            email: profile.email.clone(),
            phone: profile.phone.clone(),
            tax_id: profile.tax_id.clone(),
            currency: profile.currency.clone(),
            backup_folder_path: profile.backup_folder_path.clone(),
            auto_backup_enabled: profile.auto_backup_enabled,
            backup_interval_minutes: profile.backup_interval_minutes.to_string(),
            backup_max_keep_count: profile.backup_max_keep_count.to_string(),
        }
    }

    fn to_profile(&self) -> Result<CompanyProfile, &'static str> {
        let backup_interval_minutes = self
            .backup_interval_minutes
            .trim()
            .parse()
            .map_err(|_| "settings_error_backup_interval")?;
        let backup_max_keep_count = self
            .backup_max_keep_count
            .trim()
            .parse()
            .map_err(|_| "settings_error_backup_keep")?;
        Ok(CompanyProfile {
            name: self.name.clone(),
            street: self.street.clone(),
            zip_city: self.zip_city.clone(),
            country: self.country.clone(),
            email: self.email.clone(),
            phone: self.phone.clone(),
            tax_id: self.tax_id.clone(),
            currency: self.currency.clone(),
            backup_folder_path: self.backup_folder_path.clone(),
            auto_backup_enabled: self.auto_backup_enabled,
            backup_interval_minutes,
            backup_max_keep_count,
            ..CompanyProfile::default()
        })
    }
}

/// Editable per-user appearance preferences.
#[derive(Debug, Clone, PartialEq, Eq)]
struct AppearanceDraft {
    language: usize,
    theme: usize,
    accent: String,
    sidebar_collapsed: bool,
    startup_module: usize,
}

impl Default for AppearanceDraft {
    fn default() -> Self {
        Self::from_preferences(&Preferences::default())
    }
}

impl AppearanceDraft {
    fn from_preferences(preferences: &Preferences) -> Self {
        Self {
            language: language_index(preferences.language),
            theme: theme_index(preferences.theme_mode),
            accent: preferences.accent_color.clone(),
            sidebar_collapsed: preferences.sidebar_collapsed,
            startup_module: startup_index(&preferences.startup_module),
        }
    }

    fn to_preferences(&self) -> Preferences {
        Preferences {
            language: language_at(self.language),
            theme_mode: theme_at(self.theme),
            accent_color: self.accent.clone(),
            sidebar_collapsed: self.sidebar_collapsed,
            startup_module: startup_module_at(self.startup_module).to_string(),
        }
    }
}

/// Editable user account.
#[derive(Debug, Clone, PartialEq, Eq)]
struct UserDraft {
    id: Option<Uuid>,
    username: String,
    display_name: String,
    password: String,
    password_confirm: String,
    active: bool,
    must_change_password: bool,
    role_choice: usize,
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
    fn from_user(user: &User, roles: &[Role]) -> Self {
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

    fn build(&self, base: Option<&User>, roles: &[Role], now: i64) -> Result<User, &'static str> {
        if !self.password.is_empty() && self.password != self.password_confirm {
            return Err("settings_error_password_mismatch");
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
                    .ok_or("settings_error_role")?;
                user.role = UserRole::User;
                user.role_id = Some(role.id.to_string());
            }
        }

        if base.is_none() || !self.password.is_empty() {
            if self.password.chars().count() < MIN_PASSWORD_LENGTH {
                return Err("settings_error_password_short");
            }
            user.password_hash =
                hash_password(&self.password).map_err(|_| "settings_error_password_short")?;
        }

        Ok(user)
    }
}

/// Editable role and its permission matrix.
#[derive(Debug, Clone, PartialEq, Eq)]
struct RoleDraft {
    id: Option<Uuid>,
    name: String,
    description: String,
    builtin: bool,
    levels: Vec<PermissionLevel>,
}

impl RoleDraft {
    fn from_role(role: &Role) -> Self {
        Self {
            id: Some(role.id),
            name: role.name.clone(),
            description: role.description.clone(),
            builtin: role.is_builtin,
            levels: ALL_MODULES
                .iter()
                .map(|module| role.level(*module))
                .collect(),
        }
    }

    fn empty() -> Self {
        Self {
            id: None,
            name: String::new(),
            description: String::new(),
            builtin: false,
            levels: vec![PermissionLevel::None; ALL_MODULES.len()],
        }
    }

    fn to_role(&self, now: i64) -> Role {
        let mut role = match self.id {
            Some(_) => Role {
                id: self.id.unwrap_or_else(Uuid::new_v4),
                name: self.name.clone(),
                description: self.description.clone(),
                is_builtin: self.builtin,
                permissions: Vec::new(),
                created_at: now,
                updated_at: now,
            },
            None => Role::new(self.name.clone(), now),
        };
        role.name = self.name.trim().to_string();
        role.description = self.description.trim().to_string();
        role.updated_at = now;
        for (index, module) in ALL_MODULES.iter().enumerate() {
            let level = self
                .levels
                .get(index)
                .copied()
                .unwrap_or(PermissionLevel::None);
            role.set(*module, level);
        }
        role
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DeleteTarget {
    User(Uuid),
    Role(Uuid),
}

/// State of the settings screen.
#[derive(Debug, Clone)]
pub struct SettingsState {
    tab: SettingsTab,
    profile: ProfileDraft,
    appearance: AppearanceDraft,
    users: Vec<User>,
    roles: Vec<Role>,
    active_user: Option<Uuid>,
    security_user: Option<Uuid>,
    security_password: String,
    security_confirm: String,
    update_settings: UpdateSettings,
    portable_settings: PortableSettings,
    user_editor: Option<UserDraft>,
    role_editor: Option<RoleDraft>,
    delete_target: Option<DeleteTarget>,
    query: String,
    backups: Vec<BackupFile>,
    backup_loaded_folder: String,
    backup_last: Option<BackupInfo>,
    restore_archive: String,
    restore_target: String,
    restore_metadata: Option<BackupMetadata>,
    restore_confirm: bool,
    language_popup: PopupState,
    theme_popup: PopupState,
    accent_popup: PopupState,
    startup_popup: PopupState,
    security_user_popup: PopupState,
    user_role_popup: PopupState,
    update_channel_popup: PopupState,
    role_level_popups: Vec<PopupState>,
    error: Option<&'static str>,
    status: Option<&'static str>,
    /// Set when the back button or Escape on a top-level view was used.
    pub back: bool,
    loaded: bool,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            tab: SettingsTab::General,
            profile: ProfileDraft::default(),
            appearance: AppearanceDraft::default(),
            users: Vec::new(),
            roles: Vec::new(),
            active_user: None,
            security_user: None,
            security_password: String::new(),
            security_confirm: String::new(),
            update_settings: UpdateSettings::default(),
            portable_settings: PortableSettings::default(),
            user_editor: None,
            role_editor: None,
            delete_target: None,
            query: String::new(),
            backups: Vec::new(),
            backup_loaded_folder: String::new(),
            backup_last: None,
            restore_archive: String::new(),
            restore_target: String::new(),
            restore_metadata: None,
            restore_confirm: false,
            language_popup: PopupState::default(),
            theme_popup: PopupState::default(),
            accent_popup: PopupState::default(),
            startup_popup: PopupState::default(),
            security_user_popup: PopupState::default(),
            user_role_popup: PopupState::default(),
            update_channel_popup: PopupState::default(),
            role_level_popups: vec![PopupState::default(); ALL_MODULES.len()],
            error: None,
            status: None,
            back: false,
            loaded: false,
        }
    }
}

impl SettingsState {
    /// Creates an unloaded screen; the first [`SettingsState::refresh`] loads the store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Current tab.
    pub fn tab(&self) -> SettingsTab {
        self.tab
    }

    /// Switches tab and clears the transient editor.
    pub fn set_tab(&mut self, tab: SettingsTab) {
        self.tab = tab;
        self.user_editor = None;
        self.role_editor = None;
        self.error = None;
        self.status = None;
    }

    /// Resets the screen for opening from the dashboard or the gallery.
    pub fn reset_for_open(&mut self) {
        self.set_tab(SettingsTab::General);
        self.back = false;
    }

    /// Loads profile, users, roles and the persisted policies.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if self.loaded {
            return Ok(());
        }

        self.profile = ProfileDraft::from_profile(&store.company_profile()?);
        self.users = store.list_users()?;
        self.roles = store.list_roles()?;
        self.active_user = self
            .active_user
            .filter(|id| self.users.iter().any(|user| user.id == *id))
            .or_else(|| {
                self.users
                    .iter()
                    .find(|user| user.is_admin())
                    .map(|user| user.id)
            })
            .or_else(|| self.users.first().map(|user| user.id));
        self.security_user = self
            .security_user
            .filter(|id| self.users.iter().any(|user| user.id == *id))
            .or(self.active_user);

        let preferences = match self.active_user {
            Some(id) => settings_service::preferences(store, id)?,
            None => Preferences::default(),
        };
        self.appearance = AppearanceDraft::from_preferences(&preferences);
        self.update_settings = settings_service::update_settings(store)?;
        self.portable_settings = settings_service::portable_settings(store)?;
        self.restore_target = if self.portable_settings.enabled {
            Path::new(&self.portable_settings.data_folder)
                .join("restored-socdof.db")
                .to_string_lossy()
                .to_string()
        } else {
            String::new()
        };
        self.backups.clear();
        self.backup_loaded_folder.clear();
        self.loaded = true;
        Ok(())
    }

    fn reload(&mut self) {
        self.loaded = false;
    }

    fn save_profile(&mut self, store: &Store) -> bool {
        let profile = match self.profile.to_profile() {
            Ok(profile) => profile,
            Err(key) => {
                self.error = Some(key);
                return false;
            }
        };
        match settings_service::save_company_profile(store, &profile) {
            Ok(()) => {
                self.error = None;
                self.status = Some("settings_saved");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_profile");
                false
            }
        }
    }

    fn save_appearance(&mut self, store: &Store) -> bool {
        let Some(user_id) = self.active_user else {
            self.error = Some("settings_error_no_user");
            return false;
        };
        let preferences = self.appearance.to_preferences();
        match settings_service::save_preferences(store, user_id, &preferences) {
            Ok(()) => {
                self.error = None;
                self.status = Some("settings_saved");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_preferences");
                false
            }
        }
    }

    fn save_security(&mut self, store: &Store) -> bool {
        if self.security_password != self.security_confirm {
            self.error = Some("settings_error_password_mismatch");
            return false;
        }
        let Some(user_id) = self.security_user else {
            self.error = Some("settings_error_no_user");
            return false;
        };
        let hash = match hash_password(&self.security_password) {
            Ok(hash) => hash,
            Err(_) => {
                self.error = Some("settings_error_password_short");
                return false;
            }
        };
        match store.set_password(user_id, &hash) {
            Ok(()) => {
                self.security_password.clear();
                self.security_confirm.clear();
                self.error = None;
                self.status = Some("settings_password_saved");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_password");
                false
            }
        }
    }

    fn sign_out_security_user(&mut self, store: &Store, now: i64) -> bool {
        let Some(user_id) = self.security_user else {
            self.error = Some("settings_error_no_user");
            return false;
        };
        match store.sign_out_all(user_id, now) {
            Ok(_) => {
                self.error = None;
                self.status = Some("settings_sessions_revoked");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_sessions");
                false
            }
        }
    }

    fn start_new_user(&mut self) {
        self.user_editor = Some(UserDraft::default());
        self.error = None;
        self.status = None;
    }

    fn edit_user(&mut self, id: Uuid) {
        if let Some(user) = self.users.iter().find(|user| user.id == id) {
            self.user_editor = Some(UserDraft::from_user(user, &self.roles));
            self.error = None;
            self.status = None;
        }
    }

    fn save_user(&mut self, store: &Store, now: i64) -> bool {
        let Some(draft) = self.user_editor.clone() else {
            return false;
        };
        let base = draft
            .id
            .and_then(|id| self.users.iter().find(|user| user.id == id));
        let user = match draft.build(base, &self.roles, now) {
            Ok(user) => user,
            Err(key) => {
                self.error = Some(key);
                return false;
            }
        };

        let result = if base.is_some() {
            store.update_user(&user)
        } else {
            store.insert_user(&user)
        };
        if result.is_err() {
            self.error = Some("settings_error_user_save");
            return false;
        }
        if base.is_some()
            && !draft.password.is_empty()
            && store.set_password(user.id, &user.password_hash).is_err()
        {
            self.error = Some("settings_error_password");
            return false;
        }

        self.user_editor = None;
        self.active_user.get_or_insert(user.id);
        self.error = None;
        self.status = Some("settings_user_saved");
        self.reload();
        true
    }

    fn start_new_role(&mut self) {
        self.role_editor = Some(RoleDraft::empty());
        self.error = None;
        self.status = None;
    }

    fn edit_role(&mut self, id: Uuid) {
        if let Some(role) = self.roles.iter().find(|role| role.id == id) {
            self.role_editor = Some(RoleDraft::from_role(role));
            self.role_level_popups = vec![PopupState::default(); ALL_MODULES.len()];
            self.error = None;
            self.status = None;
        }
    }

    fn save_role(&mut self, store: &Store, now: i64) -> bool {
        let Some(draft) = self.role_editor.clone() else {
            return false;
        };
        let role = draft.to_role(now);
        let result = if draft.id.is_some() {
            store.update_role(&role)
        } else {
            store.insert_role(&role)
        };
        match result {
            Ok(()) => {
                self.role_editor = None;
                self.error = None;
                self.status = Some("settings_role_saved");
                self.reload();
                true
            }
            Err(_) => {
                self.error = Some("settings_error_role_save");
                false
            }
        }
    }

    fn delete_confirmed(&mut self, store: &Store) -> bool {
        let Some(target) = self.delete_target.take() else {
            return false;
        };
        let result = match target {
            DeleteTarget::User(id) => {
                let result = store.delete_user(id);
                if result.is_ok() {
                    let _ = settings_service::delete_preferences(store, id);
                }
                result
            }
            DeleteTarget::Role(id) => store.delete_role(id),
        };
        match result {
            Ok(()) => {
                self.error = None;
                self.status = Some(match target {
                    DeleteTarget::User(_) => "settings_user_deleted",
                    DeleteTarget::Role(_) => "settings_role_deleted",
                });
                self.user_editor = None;
                self.role_editor = None;
                self.reload();
                true
            }
            Err(_) => {
                self.error = Some(match target {
                    DeleteTarget::User(_) => "settings_error_user_delete",
                    DeleteTarget::Role(_) => "settings_error_role_delete",
                });
                false
            }
        }
    }

    fn save_update_settings(&mut self, store: &Store) -> bool {
        match settings_service::save_update_settings(store, &self.update_settings) {
            Ok(()) => {
                self.error = None;
                self.status = Some("settings_saved");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_updates");
                false
            }
        }
    }

    fn save_portable_settings(&mut self, store: &Store) -> bool {
        match settings_service::save_portable_settings(store, &self.portable_settings) {
            Ok(()) => {
                self.error = None;
                self.status = Some("settings_saved");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_portable");
                false
            }
        }
    }

    fn refresh_backups(&mut self, store: &Store) {
        let folder = self.profile.backup_folder_path.trim().to_string();
        if folder == self.backup_loaded_folder {
            return;
        }
        let path = Path::new(&folder);
        self.backups = if folder.is_empty() {
            Vec::new()
        } else {
            backup::list_backups(path).unwrap_or_default()
        };
        self.backup_loaded_folder = folder;
        let _ = store;
    }

    fn create_backup(&mut self, store: &Store, now: i64) -> bool {
        let folder = self.profile.backup_folder_path.trim();
        if folder.is_empty() {
            self.error = Some("settings_error_backup_folder");
            return false;
        }
        let (year, month, day) = date::civil_from_millis(now);
        let minutes = (now.rem_euclid(86_400_000)) / 60_000;
        let name = format!(
            "socdof-{year:04}-{month:02}-{day:02}-{:02}{:02}.socdofbak",
            minutes / 60,
            minutes % 60
        );
        let path = Path::new(folder).join(name);
        match backup::create_backup(store, &path, env!("CARGO_PKG_VERSION"), now) {
            Ok(info) => {
                self.backup_last = Some(info);
                self.error = None;
                self.status = Some("settings_backup_created");
                self.backup_loaded_folder.clear();
                true
            }
            Err(_) => {
                self.error = Some("settings_error_backup_create");
                false
            }
        }
    }

    fn verify_backup(&mut self, path: &Path) {
        match backup::read_backup(path) {
            Ok(backup) => {
                self.restore_archive = path.to_string_lossy().to_string();
                self.restore_metadata = Some(backup.metadata);
                self.error = None;
                self.status = Some("settings_backup_valid");
            }
            Err(_) => {
                self.error = Some("settings_error_backup_invalid");
                self.restore_metadata = None;
            }
        }
    }

    fn restore_backup(&mut self) -> bool {
        let archive = PathBuf::from(self.restore_archive.trim());
        let target = PathBuf::from(self.restore_target.trim());
        if archive.as_os_str().is_empty() || target.as_os_str().is_empty() {
            self.error = Some("settings_error_restore_path");
            return false;
        }
        match backup::restore_backup(&archive, &target) {
            Ok(metadata) => {
                self.restore_metadata = Some(metadata);
                self.error = None;
                self.status = Some("settings_backup_restored");
                true
            }
            Err(_) => {
                self.error = Some("settings_error_restore");
                false
            }
        }
    }

    fn current_user(&self) -> Option<&User> {
        self.active_user
            .and_then(|id| self.users.iter().find(|user| user.id == id))
    }

    fn filtered_users(&self) -> Vec<&User> {
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

    fn filtered_roles(&self) -> Vec<&Role> {
        let query = self.query.trim().to_lowercase();
        self.roles
            .iter()
            .filter(|role| query.is_empty() || role.name.to_lowercase().contains(&query))
            .collect()
    }
}

/// Seeds a deterministic profile, two accounts and their preferences through the core services.
///
/// It is a no-op when accounts already exist, so it never overwrites real data.
pub fn seed_settings(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.user_count()? == 0 {
        let now = SAMPLE_NOW_MS;
        let admin = User {
            id: Uuid::new_v4(),
            username: "admin".to_string(),
            display_name: texts.get("settings_sample_admin").to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: hash_password("socdof-admin")?,
            must_change_password: false,
            created_at: now,
            updated_at: now,
        };
        let colleague = User {
            id: Uuid::new_v4(),
            username: "mara".to_string(),
            display_name: texts.get("settings_sample_user").to_string(),
            role: UserRole::User,
            role_id: None,
            active: true,
            password_hash: hash_password("socdof-user")?,
            must_change_password: true,
            created_at: now,
            updated_at: now,
        };
        store.insert_user(&admin)?;
        store.insert_user(&colleague)?;

        for user in [admin, colleague] {
            settings_service::save_preferences(store, user.id, &Preferences::default())?;
        }
    }

    if store.company_profile()?.name.trim().is_empty() {
        settings_service::save_company_profile(
            store,
            &CompanyProfile {
                name: "Strudelcode GmbH".to_string(),
                street: "Musterstraße 1".to_string(),
                zip_city: "39100 Bozen".to_string(),
                country: "IT".to_string(),
                email: "hallo@strudelcode.example".to_string(),
                phone: "+39 0471 000000".to_string(),
                tax_id: "IT01234567890".to_string(),
                currency: "€".to_string(),
                language: Language::De,
                theme_mode: ThemeMode::System,
                accent_color: "indigo".to_string(),
                backup_folder_path: "backups".to_string(),
                auto_backup_enabled: false,
                backup_interval_minutes: 120,
                backup_max_keep_count: 10,
            },
        )?;
    }

    Ok(())
}

fn language_index(language: Language) -> usize {
    match language {
        Language::De => 0,
        Language::En => 1,
        Language::Fr => 2,
        Language::Es => 3,
    }
}

fn language_at(index: usize) -> Language {
    [Language::De, Language::En, Language::Fr, Language::Es]
        .get(index)
        .copied()
        .unwrap_or(Language::De)
}

fn theme_index(theme: ThemeMode) -> usize {
    match theme {
        ThemeMode::Light => 0,
        ThemeMode::Dark => 1,
        ThemeMode::System => 2,
    }
}

fn theme_at(index: usize) -> ThemeMode {
    [ThemeMode::Light, ThemeMode::Dark, ThemeMode::System]
        .get(index)
        .copied()
        .unwrap_or(ThemeMode::System)
}

const STARTUP_MODULES: [AppModule; 8] = [
    AppModule::Dashboard,
    AppModule::Contacts,
    AppModule::Products,
    AppModule::Invoices,
    AppModule::Accounting,
    AppModule::Purchases,
    AppModule::Pos,
    AppModule::Calendar,
];

fn startup_index(value: &str) -> usize {
    if value.is_empty() {
        return 0;
    }
    STARTUP_MODULES
        .iter()
        .position(|module| module.as_str() == value)
        .unwrap_or(0)
}

fn startup_module_at(index: usize) -> &'static str {
    if index == 0 {
        ""
    } else {
        STARTUP_MODULES
            .get(index)
            .copied()
            .unwrap_or(AppModule::Dashboard)
            .as_str()
    }
}

fn module_label_key(module: AppModule) -> &'static str {
    match module {
        AppModule::Dashboard => "settings_module_dashboard",
        AppModule::Contacts => "settings_module_contacts",
        AppModule::Products => "settings_module_products",
        AppModule::Invoices => "settings_module_invoices",
        AppModule::Accounting => "settings_module_accounting",
        AppModule::Purchases => "settings_module_purchases",
        AppModule::Pos => "settings_module_pos",
        AppModule::Calendar => "settings_module_calendar",
        AppModule::Settings => "settings_module_settings",
        AppModule::Users => "settings_module_users",
        AppModule::Reports => "settings_module_reports",
        AppModule::Support => "settings_module_support",
        AppModule::Therapy => "settings_module_therapy",
        AppModule::Editor => "settings_module_editor",
        AppModule::Documentation => "settings_module_documentation",
    }
}

fn level_index(level: PermissionLevel) -> usize {
    match level {
        PermissionLevel::None => 0,
        PermissionLevel::View => 1,
        PermissionLevel::Edit => 2,
        PermissionLevel::Manage => 3,
    }
}

fn level_at(index: usize) -> PermissionLevel {
    [
        PermissionLevel::None,
        PermissionLevel::View,
        PermissionLevel::Edit,
        PermissionLevel::Manage,
    ]
    .get(index)
    .copied()
    .unwrap_or(PermissionLevel::None)
}

fn role_name(role: &Role, texts: &UiTexts) -> String {
    if role.id == ADMIN_ROLE_ID {
        texts.get("settings_role_admin").to_string()
    } else if role.id == USER_ROLE_ID {
        texts.get("settings_role_user").to_string()
    } else {
        role.name.clone()
    }
}

fn user_role_name(user: &User, roles: &[Role], texts: &UiTexts) -> String {
    if user.is_admin() {
        return texts.get("settings_role_admin").to_string();
    }
    if let Some(role_id) = user.role_id.as_deref() {
        if let Some(role) = roles.iter().find(|role| role.id.to_string() == role_id) {
            return role_name(role, texts);
        }
    }
    texts.get("settings_role_user").to_string()
}

fn role_choice_for(user: &User, roles: &[Role]) -> usize {
    if user.is_admin() {
        return 0;
    }
    user.role_id
        .as_deref()
        .and_then(|id| {
            custom_roles(roles)
                .iter()
                .position(|role| role.id.to_string() == id)
        })
        .map(|index| index + 2)
        .unwrap_or(1)
}

fn role_choices(roles: &[Role], texts: &UiTexts) -> Vec<String> {
    let mut labels = vec![
        texts.get("settings_role_admin").to_string(),
        texts.get("settings_role_user").to_string(),
    ];
    labels.extend(custom_roles(roles).iter().map(|role| role.name.clone()));
    labels
}

fn custom_roles(roles: &[Role]) -> Vec<&Role> {
    roles.iter().filter(|role| !role.is_builtin).collect()
}

fn format_date(ms: i64) -> String {
    date::format_date(ms)
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1_024 {
        format!("{:.1} KB", bytes as f64 / 1_024.0)
    } else {
        format!("{bytes} B")
    }
}

fn header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
) {
    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            ui.label(
                RichText::new(texts.get("settings_title"))
                    .size(FONT_TITLE)
                    .strong(),
            );
            ui.label(
                RichText::new(texts.get("settings_subtitle"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("settings_back"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                state.back = true;
            }
        });
    });
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &SettingsState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the settings screen.
pub fn settings(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        if state.restore_confirm {
            state.restore_confirm = false;
        } else if state.delete_target.is_some() {
            state.delete_target = None;
        } else if state.user_editor.is_some() {
            state.user_editor = None;
        } else if state.role_editor.is_some() {
            state.role_editor = None;
        } else {
            state.back = true;
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("settings_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                header(ui, theme, texts, focus, state);
                ui.add_space(8.0);
                messages(ui, theme, texts, state);
                ui.add_space(6.0);

                let mut selected = state.tab.index();
                let labels: Vec<&str> = SettingsTab::ALL
                    .iter()
                    .map(|tab| texts.get(tab.label_key()))
                    .collect();
                if tabs(ui, theme, focus, &labels, &mut selected) {
                    state.set_tab(SettingsTab::from_index(selected));
                }
                ui.add_space(10.0);

                match state.tab {
                    SettingsTab::General => general_tab(ui, theme, texts, focus, state, store),
                    SettingsTab::Appearance => {
                        appearance_tab(ui, theme, texts, focus, state, store)
                    }
                    SettingsTab::Security => {
                        security_tab(ui, theme, texts, focus, state, store, now)
                    }
                    SettingsTab::Backup => backup_tab(ui, theme, texts, focus, state, store, now),
                    SettingsTab::Users => users_tab(ui, theme, texts, focus, state, store, now),
                    SettingsTab::Roles => roles_tab(ui, theme, texts, focus, state, store, now),
                    SettingsTab::Updates => updates_tab(ui, theme, texts, focus, state, store),
                    SettingsTab::Portable => portable_tab(ui, theme, texts, focus, state, store),
                }
            });
        });

    delete_modal(ctx, theme, texts, focus, state, store);
    restore_modal(ctx, theme, texts, focus, state);
}

fn general_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
) {
    let mut save = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_profile_title")).strong());
        ui.add_space(6.0);
        ui.columns(2, |columns| {
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.profile.name,
                texts.get("settings_profile_name"),
                texts.get("settings_profile_name_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.profile.currency,
                texts.get("settings_profile_currency"),
                texts.get("settings_profile_currency_hint"),
                None,
            );
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.profile.street,
                texts.get("settings_profile_street"),
                texts.get("settings_profile_street_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.profile.zip_city,
                texts.get("settings_profile_zip_city"),
                texts.get("settings_profile_zip_city_hint"),
                None,
            );
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.profile.country,
                texts.get("settings_profile_country"),
                texts.get("settings_profile_country_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.profile.tax_id,
                texts.get("settings_profile_tax_id"),
                texts.get("settings_profile_tax_id_hint"),
                None,
            );
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.profile.email,
                texts.get("settings_profile_email"),
                texts.get("settings_profile_email_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.profile.phone,
                texts.get("settings_profile_phone"),
                texts.get("settings_profile_phone_hint"),
                None,
            );
        });
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save = true;
        }
    });
    if save {
        state.save_profile(store);
    }
}

fn appearance_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
) {
    let active = state
        .current_user()
        .map(|user| user.display_name.clone())
        .unwrap_or_default();
    let mut save = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_appearance_title")).strong());
        ui.add_space(4.0);
        ui.label(
            RichText::new(format!("{}: {active}", texts.get("settings_active_user")))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(8.0);
        if state.active_user.is_none() {
            empty_state(
                ui,
                theme,
                texts.get("settings_error_no_user"),
                texts.get("settings_users_empty_hint"),
            );
            return;
        }
        ui.columns(2, |columns| {
            let languages: Vec<&str> = [
                texts.get("language_de"),
                texts.get("language_en"),
                texts.get("language_fr"),
                texts.get("language_es"),
            ]
            .to_vec();
            columns[0].label(
                RichText::new(texts.get("settings_language"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                &mut columns[0],
                theme,
                focus,
                &mut state.language_popup,
                "settings-language",
                &mut state.appearance.language,
                &languages,
            );

            let themes = [
                texts.get("settings_theme_light"),
                texts.get("settings_theme_dark"),
                texts.get("settings_theme_system"),
            ];
            columns[1].label(
                RichText::new(texts.get("settings_theme"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                &mut columns[1],
                theme,
                focus,
                &mut state.theme_popup,
                "settings-theme",
                &mut state.appearance.theme,
                &themes,
            );

            let accents: Vec<&str> = preset_ids().collect();
            let accent_index = accents
                .iter()
                .position(|id| *id == state.appearance.accent)
                .unwrap_or(0);
            let mut selected_accent = accent_index;
            columns[0].label(
                RichText::new(texts.get("settings_accent"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            if select(
                &mut columns[0],
                theme,
                focus,
                &mut state.accent_popup,
                "settings-accent",
                &mut selected_accent,
                &accents,
            ) {
                state.appearance.accent = accents[selected_accent].to_string();
            }

            let startup: Vec<&str> = std::iter::once(texts.get("settings_startup_dashboard"))
                .chain(
                    STARTUP_MODULES
                        .iter()
                        .skip(1)
                        .map(|module| texts.get(module_label_key(*module))),
                )
                .collect();
            columns[1].label(
                RichText::new(texts.get("settings_startup"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                &mut columns[1],
                theme,
                focus,
                &mut state.startup_popup,
                "settings-startup",
                &mut state.appearance.startup_module,
                &startup,
            );
        });
        ui.add_space(8.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.appearance.sidebar_collapsed,
            texts.get("settings_sidebar_collapsed"),
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save = true;
        }
    });
    if save {
        state.save_appearance(store);
    }
}

fn security_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    let mut save_password = false;
    let mut revoke = false;
    let mut selected_user = state.security_user;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_security_title")).strong());
        ui.add_space(6.0);
        if state.users.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("settings_users_empty"),
                texts.get("settings_users_empty_hint"),
            );
            return;
        }

        let names: Vec<String> = state
            .users
            .iter()
            .map(|user| format!("{} ({})", user.display_name, user.username))
            .collect();
        let labels: Vec<&str> = names.iter().map(String::as_str).collect();
        let mut index = selected_user
            .and_then(|id| state.users.iter().position(|user| user.id == id))
            .unwrap_or(0);
        columns_select(
            ui,
            theme,
            focus,
            &mut state.security_user_popup,
            "settings-security-user",
            &mut index,
            &labels,
        );
        selected_user = state.users.get(index).map(|user| user.id);

        let role = selected_user
            .and_then(|id| state.users.iter().find(|user| user.id == id))
            .map(|user| user_role_name(user, &state.roles, texts))
            .unwrap_or_default();
        ui.label(
            RichText::new(format!("{}: {role}", texts.get("settings_security_role")))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        ui.columns(2, |columns| {
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.security_password,
                texts.get("settings_new_password"),
                texts.get("settings_password_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.security_confirm,
                texts.get("settings_password_confirm"),
                texts.get("settings_password_hint"),
                None,
            );
        });
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_password_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save_password = true;
        }
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_sessions_revoke"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            revoke = true;
        }
    });

    ui.add_space(12.0);
    let minutes = LOCKOUT_MS / 60_000;
    let hours = SESSION_TTL_MS / 3_600_000;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_policy_title")).strong());
        ui.add_space(4.0);
        ui.label(format!(
            "{}: {}",
            texts.get("settings_min_password"),
            MIN_PASSWORD_LENGTH
        ));
        ui.label(format!(
            "{}: {}",
            texts.get("settings_max_attempts"),
            MAX_FAILED_ATTEMPTS
        ));
        ui.label(format!(
            "{}: {minutes}",
            texts.get("settings_lockout_minutes")
        ));
        ui.label(format!("{}: {hours}", texts.get("settings_session_hours")));
    });

    state.security_user = selected_user;
    if save_password {
        state.save_security(store);
    }
    if revoke {
        state.sign_out_security_user(store, now);
    }
}

fn backup_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    state.refresh_backups(store);
    let mut save = false;
    let mut create = false;
    let mut verify = None;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_backup_title")).strong());
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.profile.backup_folder_path,
            texts.get("settings_backup_folder"),
            texts.get("settings_backup_folder_hint"),
            None,
        );
        ui.add_space(4.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.profile.auto_backup_enabled,
            texts.get("settings_auto_backup"),
        );
        ui.columns(2, |columns| {
            text_field(
                &mut columns[0],
                theme,
                focus,
                &mut state.profile.backup_interval_minutes,
                texts.get("settings_backup_interval"),
                texts.get("settings_backup_interval_hint"),
                None,
            );
            text_field(
                &mut columns[1],
                theme,
                focus,
                &mut state.profile.backup_max_keep_count,
                texts.get("settings_backup_keep"),
                texts.get("settings_backup_keep_hint"),
                None,
            );
        });
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("settings_save"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                save = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("settings_backup_create"),
                ButtonVariant::Primary,
            )
            .activated
            {
                create = true;
            }
        });
        if let Some(last) = &state.backup_last {
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{} · {} · {}",
                    format_date(last.metadata.created_at),
                    format_bytes(last.archive_bytes),
                    last.metadata.app_version
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_backup_list")).strong());
        ui.add_space(6.0);
        if state.backups.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("settings_backup_empty"),
                texts.get("settings_backup_empty_hint"),
            );
        } else {
            egui::Grid::new("socdof-settings-backups")
                .num_columns(4)
                .spacing(egui::vec2(14.0, 8.0))
                .show(ui, |ui| {
                    for key in [
                        "settings_backup_col_file",
                        "settings_backup_col_date",
                        "settings_backup_col_size",
                        "settings_backup_col_action",
                    ] {
                        ui.label(
                            RichText::new(texts.get(key))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for entry in &state.backups {
                        let name = entry
                            .path
                            .file_name()
                            .map(|value| value.to_string_lossy().to_string())
                            .unwrap_or_default();
                        ui.label(name);
                        ui.label(format_date(entry.metadata.created_at));
                        ui.label(format_bytes(entry.archive_bytes));
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("settings_backup_verify"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            verify = Some(entry.path.clone());
                        }
                        ui.end_row();
                    }
                });
        }
    });

    ui.add_space(12.0);
    let mut restore = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_restore_title")).strong());
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("settings_restore_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.restore_archive,
            texts.get("settings_restore_archive"),
            texts.get("settings_restore_archive_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.restore_target,
            texts.get("settings_restore_target"),
            texts.get("settings_restore_target_hint"),
            None,
        );
        if let Some(metadata) = &state.restore_metadata {
            ui.label(
                RichText::new(format!(
                    "{} · {} · {}",
                    format_date(metadata.created_at),
                    metadata.app_version,
                    metadata.schema_version
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
        }
        ui.add_space(6.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_restore_button"),
            ButtonVariant::Danger,
        )
        .activated
        {
            restore = true;
        }
    });

    if save {
        state.save_profile(store);
        state.backup_loaded_folder.clear();
    }
    if create {
        state.create_backup(store, now);
    }
    if let Some(path) = verify {
        state.verify_backup(&path);
    }
    if restore {
        if state.restore_archive.trim().is_empty() || state.restore_target.trim().is_empty() {
            state.error = Some("settings_error_restore_path");
        } else {
            state.restore_confirm = true;
        }
    }
}

fn users_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    if state.user_editor.is_some() {
        user_form(ui, theme, texts, focus, state, store, now);
        return;
    }

    let mut new_user = false;
    let mut edit = None;
    let mut delete = None;
    ui.horizontal(|ui| {
        search_field(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("settings_users_search"),
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_user_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            new_user = true;
        }
    });
    ui.add_space(8.0);

    card(ui, theme, |ui| {
        let users = state.filtered_users();
        if users.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("settings_users_empty"),
                texts.get("settings_users_empty_hint"),
            );
        } else {
            egui::Grid::new("socdof-settings-users")
                .num_columns(5)
                .spacing(egui::vec2(14.0, 8.0))
                .show(ui, |ui| {
                    for key in [
                        "settings_users_col_name",
                        "settings_users_col_username",
                        "settings_users_col_role",
                        "settings_users_col_active",
                        "settings_users_col_action",
                    ] {
                        ui.label(
                            RichText::new(texts.get(key))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for user in users {
                        ui.label(&user.display_name);
                        ui.label(&user.username);
                        ui.label(user_role_name(user, &state.roles, texts));
                        badge(
                            ui,
                            theme,
                            if user.active {
                                texts.get("settings_active")
                            } else {
                                texts.get("settings_inactive")
                            },
                            if user.active {
                                Tone::Success
                            } else {
                                Tone::Neutral
                            },
                        );
                        ui.horizontal(|ui| {
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("settings_edit"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                edit = Some(user.id);
                            }
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("settings_delete"),
                                ButtonVariant::Ghost,
                            )
                            .activated
                            {
                                delete = Some(user.id);
                            }
                        });
                        ui.end_row();
                    }
                });
        }
    });

    if new_user {
        state.start_new_user();
    }
    if let Some(id) = edit {
        state.edit_user(id);
    }
    if let Some(id) = delete {
        state.delete_target = Some(DeleteTarget::User(id));
    }
}

fn user_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    let Some(draft) = state.user_editor.clone() else {
        return;
    };
    let editing = draft.id.is_some();
    let mut save = false;
    let mut cancel = false;
    let mut delete = false;
    let roles = role_choices(&state.roles, texts);
    let role_labels: Vec<&str> = roles.iter().map(String::as_str).collect();
    let role_popup_id = "settings-user-role";
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(if editing {
                texts.get("settings_user_edit_title")
            } else {
                texts.get("settings_user_new_title")
            })
            .strong(),
        );
        ui.add_space(6.0);
        if let Some(draft) = state.user_editor.as_mut() {
            ui.columns(2, |columns| {
                text_field(
                    &mut columns[0],
                    theme,
                    focus,
                    &mut draft.display_name,
                    texts.get("settings_users_col_name"),
                    texts.get("settings_user_name_hint"),
                    None,
                );
                text_field(
                    &mut columns[1],
                    theme,
                    focus,
                    &mut draft.username,
                    texts.get("settings_users_col_username"),
                    texts.get("settings_user_username_hint"),
                    None,
                );
                text_field(
                    &mut columns[0],
                    theme,
                    focus,
                    &mut draft.password,
                    texts.get("settings_new_password"),
                    texts.get("settings_password_hint"),
                    None,
                );
                text_field(
                    &mut columns[1],
                    theme,
                    focus,
                    &mut draft.password_confirm,
                    texts.get("settings_password_confirm"),
                    texts.get("settings_password_hint"),
                    None,
                );
            });
            ui.add_space(6.0);
            columns_select(
                ui,
                theme,
                focus,
                &mut state.user_role_popup,
                role_popup_id,
                &mut draft.role_choice,
                &role_labels,
            );
            ui.add_space(6.0);
            switch(
                ui,
                theme,
                focus,
                &mut draft.active,
                texts.get("settings_user_active"),
            );
            switch(
                ui,
                theme,
                focus,
                &mut draft.must_change_password,
                texts.get("settings_user_must_change"),
            );
            if editing {
                delete = button(
                    ui,
                    theme,
                    focus,
                    texts.get("settings_delete"),
                    ButtonVariant::Danger,
                )
                .activated;
            }
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("settings_save"),
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
                texts.get("settings_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save {
        state.save_user(store, now);
    }
    if cancel {
        state.user_editor = None;
    }
    if delete {
        if let Some(id) = draft.id {
            state.delete_target = Some(DeleteTarget::User(id));
        }
    }
}

fn roles_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    if state.role_editor.is_some() {
        role_form(ui, theme, texts, focus, state, store, now);
        return;
    }

    let mut new_role = false;
    let mut edit = None;
    let mut delete = None;
    ui.horizontal(|ui| {
        search_field(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("settings_roles_search"),
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_role_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            new_role = true;
        }
    });
    ui.add_space(8.0);

    card(ui, theme, |ui| {
        let roles = state.filtered_roles();
        if roles.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("settings_roles_empty"),
                texts.get("settings_roles_empty_hint"),
            );
        } else {
            egui::Grid::new("socdof-settings-roles")
                .num_columns(5)
                .spacing(egui::vec2(14.0, 8.0))
                .show(ui, |ui| {
                    for key in [
                        "settings_roles_col_name",
                        "settings_roles_col_description",
                        "settings_roles_col_type",
                        "settings_roles_col_action",
                        "settings_roles_col_delete",
                    ] {
                        ui.label(
                            RichText::new(texts.get(key))
                                .size(FONT_SMALL)
                                .strong()
                                .color(theme.palette.text_muted),
                        );
                    }
                    ui.end_row();
                    for role in roles {
                        ui.label(role_name(role, texts));
                        ui.label(&role.description);
                        badge(
                            ui,
                            theme,
                            if role.is_builtin {
                                texts.get("settings_role_builtin")
                            } else {
                                texts.get("settings_role_custom")
                            },
                            if role.is_builtin {
                                Tone::Neutral
                            } else {
                                Tone::Accent
                            },
                        );
                        if button(
                            ui,
                            theme,
                            focus,
                            if role.is_builtin {
                                texts.get("settings_roles_view")
                            } else {
                                texts.get("settings_edit")
                            },
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            edit = Some(role.id);
                        }
                        if role.is_builtin {
                            ui.label("—");
                        } else if button(
                            ui,
                            theme,
                            focus,
                            texts.get("settings_delete"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            delete = Some(role.id);
                        }
                        ui.end_row();
                    }
                });
        }
    });

    if new_role {
        state.start_new_role();
    }
    if let Some(id) = edit {
        state.edit_role(id);
    }
    if let Some(id) = delete {
        state.delete_target = Some(DeleteTarget::Role(id));
    }
}

fn role_form(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
    now: i64,
) {
    let Some(draft) = state.role_editor.clone() else {
        return;
    };
    let readonly = draft.builtin;
    let mut save = false;
    let mut cancel = false;
    let mut delete = false;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(if readonly {
                texts.get("settings_role_view_title")
            } else if draft.id.is_some() {
                texts.get("settings_role_edit_title")
            } else {
                texts.get("settings_role_new_title")
            })
            .strong(),
        );
        ui.add_space(6.0);
        if let Some(draft) = state.role_editor.as_mut() {
            ui.columns(2, |columns| {
                text_field(
                    &mut columns[0],
                    theme,
                    focus,
                    &mut draft.name,
                    texts.get("settings_roles_col_name"),
                    texts.get("settings_role_name_hint"),
                    None,
                );
                text_field(
                    &mut columns[1],
                    theme,
                    focus,
                    &mut draft.description,
                    texts.get("settings_roles_col_description"),
                    texts.get("settings_role_description_hint"),
                    None,
                );
            });
            ui.add_space(8.0);
            for (index, module) in ALL_MODULES.iter().enumerate() {
                ui.horizontal(|ui| {
                    ui.add_sized(
                        [220.0, 22.0],
                        egui::Label::new(texts.get(module_label_key(*module))),
                    );
                    let mut current = level_index(
                        draft
                            .levels
                            .get(index)
                            .copied()
                            .unwrap_or(PermissionLevel::None),
                    );
                    let labels = [
                        texts.get("settings_level_none"),
                        texts.get("settings_level_view"),
                        texts.get("settings_level_edit"),
                        texts.get("settings_level_manage"),
                    ];
                    if !readonly {
                        let changed = select(
                            ui,
                            theme,
                            focus,
                            &mut state.role_level_popups[index],
                            &format!("settings-role-level-{index}"),
                            &mut current,
                            &labels,
                        );
                        if changed {
                            draft.levels[index] = level_at(current);
                        }
                    } else {
                        ui.label(labels[current]);
                    }
                });
            }
            if !readonly && draft.id.is_some() {
                delete = button(
                    ui,
                    theme,
                    focus,
                    texts.get("settings_delete"),
                    ButtonVariant::Danger,
                )
                .activated;
            }
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if !readonly
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("settings_save"),
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
                texts.get("settings_back"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save {
        state.save_role(store, now);
    }
    if cancel {
        state.role_editor = None;
    }
    if delete {
        if let Some(id) = draft.id {
            state.delete_target = Some(DeleteTarget::Role(id));
        }
    }
}

fn updates_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
) {
    let schema = store.schema_version().unwrap_or_default();
    let mut save = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_updates_title")).strong());
        ui.add_space(6.0);
        ui.label(format!(
            "{}: {}",
            texts.get("settings_installed_version"),
            env!("CARGO_PKG_VERSION")
        ));
        ui.label(format!(
            "{}: v{schema}",
            texts.get("settings_schema_version")
        ));
        ui.add_space(8.0);
        let channels = [
            texts.get("settings_channel_stable"),
            texts.get("settings_channel_beta"),
        ];
        ui.label(
            RichText::new(texts.get("settings_update_channel"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        let mut channel = match state.update_settings.channel {
            UpdateChannel::Stable => 0,
            UpdateChannel::Beta => 1,
        };
        if select(
            ui,
            theme,
            focus,
            &mut state.update_channel_popup,
            "settings-update-channel",
            &mut channel,
            &channels,
        ) {
            state.update_settings.channel = if channel == 0 {
                UpdateChannel::Stable
            } else {
                UpdateChannel::Beta
            };
        }
        ui.add_space(6.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.update_settings.check_on_start,
            texts.get("settings_check_on_start"),
        );
        switch(
            ui,
            theme,
            focus,
            &mut state.update_settings.automatic_download,
            texts.get("settings_auto_download"),
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save = true;
        }
    });
    if save {
        state.save_update_settings(store);
    }
}

fn portable_tab(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
) {
    let mut save = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("settings_portable_title")).strong());
        ui.add_space(4.0);
        ui.label(
            RichText::new(texts.get("settings_portable_hint"))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.portable_settings.enabled,
            texts.get("settings_portable_enabled"),
        );
        text_field(
            ui,
            theme,
            focus,
            &mut state.portable_settings.data_folder,
            texts.get("settings_portable_folder"),
            texts.get("settings_portable_folder_hint"),
            None,
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("settings_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save = true;
        }
    });
    if save {
        state.save_portable_settings(store);
    }
}

fn columns_select(
    ui: &mut egui::Ui,
    theme: &Theme,
    focus: &mut FocusState,
    popup: &mut PopupState,
    id: &str,
    selected: &mut usize,
    labels: &[&str],
) {
    ui.label(
        RichText::new(labels.get(*selected).copied().unwrap_or_default())
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
    );
    select(ui, theme, focus, popup, id, selected, labels);
}

fn delete_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
    store: &Store,
) {
    if state.delete_target.is_none() {
        return;
    }
    let mut open = true;
    let mut confirm = false;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("settings_delete_title"),
        |ui| {
            ui.label(texts.get("settings_delete_body"));
            ui.add_space(12.0);
            let mut close = false;
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("settings_delete_confirm"),
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
                    texts.get("settings_cancel"),
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
    if !open {
        state.delete_target = None;
    }
    if confirm {
        state.delete_confirmed(store);
    }
}

fn restore_modal(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut SettingsState,
) {
    if !state.restore_confirm {
        return;
    }
    let mut open = true;
    let mut confirm = false;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("settings_restore_title"),
        |ui| {
            ui.label(texts.get("settings_restore_warning"));
            ui.add_space(6.0);
            ui.label(&state.restore_archive);
            ui.label(&state.restore_target);
            ui.add_space(12.0);
            let mut close = false;
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("settings_restore_confirm"),
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
                    texts.get("settings_cancel"),
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
    if !open {
        state.restore_confirm = false;
    }
    if confirm {
        state.restore_backup();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;

    fn seeded() -> (Store, SettingsState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_settings(&store, &texts).expect("seed");
        let mut state = SettingsState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut SettingsState, store: &Store) -> String {
        let ctx = Context::default();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1100.0, 2400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                settings(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("settings frame")).join("\n")
    }

    #[test]
    fn saves_the_profile_and_appearance_through_the_core() {
        let (store, mut state, _texts) = seeded();
        state.profile.name = "Neue Firma".to_string();
        assert!(state.save_profile(&store));
        assert_eq!(store.company_profile().expect("profile").name, "Neue Firma");

        state.appearance.language = 3;
        state.appearance.theme = 1;
        assert!(state.save_appearance(&store));
        let prefs = settings_service::preferences(&store, state.active_user.expect("active user"))
            .expect("prefs");
        assert_eq!(prefs.language, Language::Es);
        assert_eq!(prefs.theme_mode, ThemeMode::Dark);
    }

    #[test]
    fn creates_edits_and_deletes_users() {
        let (store, mut state, _texts) = seeded();
        state.start_new_user();
        if let Some(draft) = state.user_editor.as_mut() {
            draft.username = "neu".to_string();
            draft.display_name = "Neue Person".to_string();
            draft.password = "sicheres-passwort".to_string();
            draft.password_confirm = "sicheres-passwort".to_string();
        }
        assert!(state.save_user(&store, SAMPLE_NOW_MS));
        state.refresh(&store).expect("refresh");
        let created = store
            .find_user_by_username("neu")
            .expect("find")
            .expect("present");
        state.edit_user(created.id);
        if let Some(draft) = state.user_editor.as_mut() {
            draft.display_name = "Umbenannt".to_string();
        }
        assert!(state.save_user(&store, SAMPLE_NOW_MS));
        assert_eq!(
            store
                .find_user_by_username("neu")
                .expect("find")
                .unwrap()
                .display_name,
            "Umbenannt"
        );
        state.delete_target = Some(DeleteTarget::User(created.id));
        assert!(state.delete_confirmed(&store));
        assert!(store.find_user_by_username("neu").expect("find").is_none());
    }

    #[test]
    fn resets_passwords_and_revokes_sessions() {
        let (store, mut state, _texts) = seeded();
        let admin = state.active_user.expect("admin");
        state.security_user = Some(admin);
        state.security_password = "neues-passwort".to_string();
        state.security_confirm = "neues-passwort".to_string();
        assert!(state.save_security(&store));
        assert!(store
            .authenticate("admin", "neues-passwort")
            .expect("auth")
            .is_some());
        assert!(state.sign_out_security_user(&store, SAMPLE_NOW_MS));
    }

    #[test]
    fn creates_and_updates_custom_roles() {
        let (store, mut state, _texts) = seeded();
        state.start_new_role();
        if let Some(draft) = state.role_editor.as_mut() {
            draft.name = "Buchhaltung".to_string();
            draft.description = "Nur Rechnungen".to_string();
            draft.levels[3] = PermissionLevel::Edit;
        }
        assert!(state.save_role(&store, SAMPLE_NOW_MS));
        state.refresh(&store).expect("refresh");
        let role = store
            .list_roles()
            .expect("roles")
            .into_iter()
            .find(|role| role.name == "Buchhaltung")
            .expect("created");
        assert_eq!(role.level(AppModule::Invoices), PermissionLevel::Edit);

        state.delete_target = Some(DeleteTarget::Role(role.id));
        assert!(state.delete_confirmed(&store));
        assert!(!store
            .list_roles()
            .expect("roles")
            .iter()
            .any(|stored| stored.id == role.id));
    }

    #[test]
    fn creates_lists_and_restores_backups() {
        let dir = std::env::temp_dir().join(format!("socdof-settings-{}", Uuid::new_v4()));
        let (store, mut state, _texts) = seeded();
        state.profile.backup_folder_path = dir.to_string_lossy().to_string();
        assert!(state.save_profile(&store));
        assert!(state.create_backup(&store, SAMPLE_NOW_MS));
        state.refresh_backups(&store);
        assert_eq!(state.backups.len(), 1);

        let target = dir.join("restored.db");
        state.restore_archive = state.backups[0].path.to_string_lossy().to_string();
        state.restore_target = target.to_string_lossy().to_string();
        assert!(state.restore_backup());
        let restored = Store::open(&target).expect("restored store");
        assert_eq!(restored.user_count().expect("users"), 2);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn persists_update_and_portable_settings() {
        let (store, mut state, _texts) = seeded();
        state.update_settings.channel = UpdateChannel::Beta;
        assert!(state.save_update_settings(&store));
        assert_eq!(
            settings_service::update_settings(&store)
                .expect("updates")
                .channel,
            UpdateChannel::Beta
        );

        state.portable_settings = PortableSettings {
            enabled: true,
            data_folder: "  /tmp/portable  ".to_string(),
        };
        assert!(state.save_portable_settings(&store));
        assert_eq!(
            settings_service::portable_settings(&store)
                .expect("portable")
                .data_folder,
            "/tmp/portable"
        );
    }

    #[test]
    fn renders_every_tab() {
        let (store, mut state, texts) = seeded();
        for tab in SettingsTab::ALL {
            state.set_tab(tab);
            let painted = render(&mut state, &store);
            assert!(painted.contains(texts.get(tab.label_key())));
        }
        assert!(render(&mut state, &store).contains("Einstellungen"));
    }
}
