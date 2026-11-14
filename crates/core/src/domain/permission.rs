//! Roles and the per-module permission matrix.
//!
//! The legacy app grants access per module and per action level. The rewrite keeps the same shape:
//! every role carries one [`PermissionLevel`] per [`AppModule`], and the UI asks
//! [`Role::allows`] before it renders a module or an action button.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Modules that can be granted independently.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AppModule {
    /// Start screen with key figures.
    Dashboard,
    /// Address book.
    Contacts,
    /// Products and stock.
    Products,
    /// Invoices.
    Invoices,
    /// Accounting, journal and cash book.
    Accounting,
    /// Purchase orders and goods receipt.
    Purchases,
    /// Point of sale.
    Pos,
    /// Calendar and appointments.
    Calendar,
    /// Application settings.
    Settings,
    /// User and role management.
    Users,
    /// Reports.
    Reports,
    /// Support tickets and time tracking.
    Support,
    /// Therapy practice.
    Therapy,
    /// Text editor.
    Editor,
    /// Documentation and changelog.
    Documentation,
    /// Project portfolio and task management.
    Projects,
    /// Vehicle fleet, digital logbook and fuel records.
    Fleet,
    /// Restaurant floor plan, kitchen and hospitality checkout.
    Restaurant,
}

/// All modules, in the order they are shown in the permission editor.
pub const ALL_MODULES: [AppModule; 18] = [
    AppModule::Dashboard,
    AppModule::Contacts,
    AppModule::Products,
    AppModule::Invoices,
    AppModule::Accounting,
    AppModule::Purchases,
    AppModule::Pos,
    AppModule::Calendar,
    AppModule::Settings,
    AppModule::Users,
    AppModule::Reports,
    AppModule::Support,
    AppModule::Therapy,
    AppModule::Editor,
    AppModule::Documentation,
    AppModule::Projects,
    AppModule::Fleet,
    AppModule::Restaurant,
];

impl AppModule {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            AppModule::Dashboard => "dashboard",
            AppModule::Contacts => "contacts",
            AppModule::Products => "products",
            AppModule::Invoices => "invoices",
            AppModule::Accounting => "accounting",
            AppModule::Purchases => "purchases",
            AppModule::Pos => "pos",
            AppModule::Calendar => "calendar",
            AppModule::Settings => "settings",
            AppModule::Users => "users",
            AppModule::Reports => "reports",
            AppModule::Support => "support",
            AppModule::Therapy => "therapy",
            AppModule::Editor => "editor",
            AppModule::Documentation => "documentation",
            AppModule::Projects => "projects",
            AppModule::Fleet => "fleet",
            AppModule::Restaurant => "restaurant",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        ALL_MODULES
            .into_iter()
            .find(|module| module.as_str() == value)
    }
}

/// Access level for one module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionLevel {
    /// No access, the module is hidden.
    None,
    /// Read only.
    View,
    /// Create and edit records.
    Edit,
    /// Also delete records and change module settings.
    Manage,
}

impl PermissionLevel {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            PermissionLevel::None => "none",
            PermissionLevel::View => "view",
            PermissionLevel::Edit => "edit",
            PermissionLevel::Manage => "manage",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "none" => Some(PermissionLevel::None),
            "view" => Some(PermissionLevel::View),
            "edit" => Some(PermissionLevel::Edit),
            "manage" => Some(PermissionLevel::Manage),
            _ => None,
        }
    }
}

/// One module grant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppPermission {
    /// Granted module.
    pub module: AppModule,
    /// Granted level.
    pub level: PermissionLevel,
}

/// A named set of module grants.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Role {
    /// Stable identifier.
    pub id: Uuid,
    /// Name shown in the user management.
    pub name: String,
    /// Description shown in the role editor.
    pub description: String,
    /// Built-in roles cannot be deleted or renamed.
    pub is_builtin: bool,
    /// One grant per module. Missing modules count as [`PermissionLevel::None`].
    pub permissions: Vec<AppPermission>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

/// Identifier of the built-in administrator role.
pub const ADMIN_ROLE_ID: Uuid = Uuid::from_u128(0x0000_0000_0000_4000_8000_0000_0000_0001);

/// Identifier of the built-in standard user role.
pub const USER_ROLE_ID: Uuid = Uuid::from_u128(0x0000_0000_0000_4000_8000_0000_0000_0002);

impl Role {
    /// Creates an empty, custom role.
    pub fn new(name: impl Into<String>, now: i64) -> Self {
        Role {
            id: Uuid::new_v4(),
            name: name.into(),
            description: String::new(),
            is_builtin: false,
            permissions: ALL_MODULES
                .into_iter()
                .map(|module| AppPermission {
                    module,
                    level: PermissionLevel::None,
                })
                .collect(),
            created_at: now,
            updated_at: now,
        }
    }

    /// The built-in administrator role: full access to every module.
    pub fn administrator(now: i64) -> Self {
        Role {
            id: ADMIN_ROLE_ID,
            name: "Administrator".to_string(),
            description: "Full access to every module.".to_string(),
            is_builtin: true,
            permissions: ALL_MODULES
                .into_iter()
                .map(|module| AppPermission {
                    module,
                    level: PermissionLevel::Manage,
                })
                .collect(),
            created_at: now,
            updated_at: now,
        }
    }

    /// The built-in standard role: day-to-day work without settings or user management.
    pub fn standard_user(now: i64) -> Self {
        let grants = [
            (AppModule::Dashboard, PermissionLevel::View),
            (AppModule::Contacts, PermissionLevel::Edit),
            (AppModule::Products, PermissionLevel::Edit),
            (AppModule::Invoices, PermissionLevel::Edit),
            (AppModule::Accounting, PermissionLevel::View),
            (AppModule::Purchases, PermissionLevel::Edit),
            (AppModule::Pos, PermissionLevel::Edit),
            (AppModule::Calendar, PermissionLevel::Edit),
            (AppModule::Settings, PermissionLevel::None),
            (AppModule::Users, PermissionLevel::None),
            (AppModule::Reports, PermissionLevel::View),
            (AppModule::Support, PermissionLevel::Edit),
            (AppModule::Therapy, PermissionLevel::Edit),
            (AppModule::Editor, PermissionLevel::Edit),
            (AppModule::Documentation, PermissionLevel::View),
            (AppModule::Projects, PermissionLevel::Edit),
            (AppModule::Fleet, PermissionLevel::Edit),
            (AppModule::Restaurant, PermissionLevel::Edit),
        ];

        Role {
            id: USER_ROLE_ID,
            name: "User".to_string(),
            description: "Daily work without settings or user management.".to_string(),
            is_builtin: true,
            permissions: grants
                .into_iter()
                .map(|(module, level)| AppPermission { module, level })
                .collect(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Highest level granted for `module`.
    pub fn level(&self, module: AppModule) -> PermissionLevel {
        self.permissions
            .iter()
            .filter(|grant| grant.module == module)
            .map(|grant| grant.level)
            .max()
            .unwrap_or(PermissionLevel::None)
    }

    /// Sets the level of `module`, replacing an existing grant.
    pub fn set(&mut self, module: AppModule, level: PermissionLevel) {
        match self
            .permissions
            .iter_mut()
            .find(|grant| grant.module == module)
        {
            Some(grant) => grant.level = level,
            None => self.permissions.push(AppPermission { module, level }),
        }
    }

    /// Whether the role grants at least `required` on `module`.
    pub fn allows(&self, module: AppModule, required: PermissionLevel) -> bool {
        required != PermissionLevel::None && self.level(module) >= required
    }

    /// Validates the role before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("role_name_required".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn administrator_manages_every_module() {
        let role = Role::administrator(0);
        for module in ALL_MODULES {
            assert_eq!(role.level(module), PermissionLevel::Manage);
            assert!(role.allows(module, PermissionLevel::Manage));
        }
    }

    #[test]
    fn standard_user_cannot_manage_users_or_settings() {
        let role = Role::standard_user(0);
        assert!(!role.allows(AppModule::Users, PermissionLevel::View));
        assert!(!role.allows(AppModule::Settings, PermissionLevel::Edit));
        assert!(role.allows(AppModule::Invoices, PermissionLevel::Edit));
        assert!(!role.allows(AppModule::Invoices, PermissionLevel::Manage));
        assert!(role.allows(AppModule::Reports, PermissionLevel::View));
        assert!(role.allows(AppModule::Projects, PermissionLevel::Edit));
        assert!(role.allows(AppModule::Fleet, PermissionLevel::Edit));
        assert!(role.allows(AppModule::Restaurant, PermissionLevel::Edit));
    }

    #[test]
    fn sets_and_reads_module_levels() {
        let mut role = Role::new("Buchhaltung", 0);
        assert_eq!(role.level(AppModule::Invoices), PermissionLevel::None);

        role.set(AppModule::Invoices, PermissionLevel::Edit);
        role.set(AppModule::Invoices, PermissionLevel::Manage);
        assert_eq!(role.level(AppModule::Invoices), PermissionLevel::Manage);
        assert!(role.allows(AppModule::Invoices, PermissionLevel::Edit));
        assert!(!role.allows(AppModule::Invoices, PermissionLevel::None));
        assert_eq!(role.permissions.len(), ALL_MODULES.len());
    }

    #[test]
    fn validates_roles_and_module_strings() {
        let mut role = Role::new("  ", 0);
        assert_eq!(role.validate(), Err("role_name_required".to_string()));
        role.name = "Support".to_string();
        assert_eq!(role.validate(), Ok(()));

        for module in ALL_MODULES {
            assert_eq!(AppModule::from_storage(module.as_str()), Some(module));
        }
        assert_eq!(AppModule::from_storage("warehouse"), None);

        for level in [
            PermissionLevel::None,
            PermissionLevel::View,
            PermissionLevel::Edit,
            PermissionLevel::Manage,
        ] {
            assert_eq!(PermissionLevel::from_storage(level.as_str()), Some(level));
        }
        assert!(PermissionLevel::Manage > PermissionLevel::Edit);
        assert!(PermissionLevel::Edit > PermissionLevel::View);
    }
}
