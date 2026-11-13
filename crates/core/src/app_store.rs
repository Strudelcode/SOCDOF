//! App Store: module catalogue, licence state and persisted activation.
//!
//! The catalogue is defined here once, next to [`AppModule`], so the UI never keeps its own module
//! list. Activation is stored as a single settings value; a missing value means every licensed
//! module is active. System modules cannot be disabled, and locked modules can never be activated.
//!
//! All read and write operations go through [`Store`], so a restart keeps the selection and the
//! desktop shell, dashboard and future navigation all resolve the same state.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::domain::permission::{AppModule, ALL_MODULES};
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// Settings key of the persisted activation state.
pub const APP_STORE_SETTINGS_KEY: &str = "app_store_activation";

/// Licence under which a module is available.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleLicense {
    /// Part of the product and permanently licensed.
    Included,
    /// Licensed for evaluation and can be activated like an included module.
    Trial,
    /// No licence; activation is rejected until a licence is installed.
    Locked,
}

/// One catalogue entry. The metadata is compile-time data, while `active` is resolved from the
/// persisted activation state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreModule {
    /// Stable module identifier.
    pub module: AppModule,
    /// Catalogue key of the module name.
    pub name_key: &'static str,
    /// Catalogue key of the module description.
    pub description_key: &'static str,
    /// Installed application version.
    pub version: &'static str,
    /// Licence state reported by the core.
    pub license: ModuleLicense,
    /// Whether the module is required by the application and cannot be disabled.
    pub required: bool,
    /// Whether the module is currently usable.
    pub active: bool,
}

impl StoreModule {
    /// Whether the activation switch can be changed.
    pub fn can_toggle(&self) -> bool {
        !self.required && self.license != ModuleLicense::Locked
    }

    /// Catalogue key of the current activation badge.
    pub fn state_key(&self) -> &'static str {
        if self.license == ModuleLicense::Locked {
            "app_store_state_locked"
        } else if self.active {
            "app_store_state_active"
        } else {
            "app_store_state_inactive"
        }
    }

    /// Catalogue key of the licence badge.
    pub fn license_key(&self) -> &'static str {
        match self.license {
            ModuleLicense::Included => "app_store_license_included",
            ModuleLicense::Trial => "app_store_license_trial",
            ModuleLicense::Locked => "app_store_license_locked",
        }
    }
}

/// One static catalogue definition.
#[derive(Debug, Clone, Copy)]
struct ModuleDefinition {
    module: AppModule,
    name_key: &'static str,
    description_key: &'static str,
    license: ModuleLicense,
    required: bool,
}

const fn definition(
    module: AppModule,
    name_key: &'static str,
    description_key: &'static str,
    license: ModuleLicense,
    required: bool,
) -> ModuleDefinition {
    ModuleDefinition {
        module,
        name_key,
        description_key,
        license,
        required,
    }
}

/// The catalogue, in the same order as the permission matrix.
const MODULES: [ModuleDefinition; 16] = [
    definition(
        AppModule::Dashboard,
        "settings_module_dashboard",
        "app_store_desc_dashboard",
        ModuleLicense::Included,
        true,
    ),
    definition(
        AppModule::Contacts,
        "settings_module_contacts",
        "app_store_desc_contacts",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Products,
        "settings_module_products",
        "app_store_desc_products",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Invoices,
        "settings_module_invoices",
        "app_store_desc_invoices",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Accounting,
        "settings_module_accounting",
        "app_store_desc_accounting",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Purchases,
        "settings_module_purchases",
        "app_store_desc_purchases",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Pos,
        "settings_module_pos",
        "app_store_desc_pos",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Calendar,
        "settings_module_calendar",
        "app_store_desc_calendar",
        ModuleLicense::Included,
        false,
    ),
    definition(
        AppModule::Settings,
        "settings_module_settings",
        "app_store_desc_settings",
        ModuleLicense::Included,
        true,
    ),
    definition(
        AppModule::Users,
        "settings_module_users",
        "app_store_desc_users",
        ModuleLicense::Included,
        true,
    ),
    definition(
        AppModule::Reports,
        "settings_module_reports",
        "app_store_desc_reports",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Support,
        "settings_module_support",
        "app_store_desc_support",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Therapy,
        "settings_module_therapy",
        "app_store_desc_therapy",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Editor,
        "settings_module_editor",
        "app_store_desc_editor",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Documentation,
        "settings_module_documentation",
        "app_store_desc_documentation",
        ModuleLicense::Trial,
        false,
    ),
    definition(
        AppModule::Projects,
        "settings_module_projects",
        "app_store_desc_projects",
        ModuleLicense::Trial,
        false,
    ),
];

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct Activation {
    disabled: BTreeSet<String>,
}

fn load(store: &Store) -> CoreResult<Activation> {
    match store.get_setting(APP_STORE_SETTINGS_KEY)? {
        Some(value) => Ok(serde_json::from_value(value)?),
        None => Ok(Activation::default()),
    }
}

fn save(store: &Store, activation: &Activation) -> CoreResult<()> {
    store.put_setting(APP_STORE_SETTINGS_KEY, &serde_json::to_value(activation)?)
}

fn module_definition(module: AppModule) -> &'static ModuleDefinition {
    MODULES
        .iter()
        .find(|definition| definition.module == module)
        .expect("every AppModule has an app-store definition")
}

fn resolved_active(definition: &ModuleDefinition, activation: &Activation) -> bool {
    definition.required
        || (definition.license != ModuleLicense::Locked
            && !activation.disabled.contains(definition.module.as_str()))
}

/// Loads the complete catalogue with the persisted activation state.
pub fn modules(store: &Store) -> CoreResult<Vec<StoreModule>> {
    let activation = load(store)?;
    Ok(MODULES
        .iter()
        .map(|definition| StoreModule {
            module: definition.module,
            name_key: definition.name_key,
            description_key: definition.description_key,
            version: env!("CARGO_PKG_VERSION"),
            license: definition.license,
            required: definition.required,
            active: resolved_active(definition, &activation),
        })
        .collect())
}

/// Modules that are currently usable, in catalogue order.
pub fn active_modules(store: &Store) -> CoreResult<Vec<AppModule>> {
    Ok(modules(store)?
        .into_iter()
        .filter(|module| module.active)
        .map(|module| module.module)
        .collect())
}

/// Whether one module is currently usable.
pub fn is_active(store: &Store, module: AppModule) -> CoreResult<bool> {
    Ok(modules(store)?
        .iter()
        .any(|entry| entry.module == module && entry.active))
}

/// Activates or deactivates a module and persists the decision.
///
/// Unknown identifiers, repeat requests, required system modules and locked modules are rejected
/// with a stable validation code that the UI translates.
pub fn set_active(store: &Store, id: &str, active: bool) -> CoreResult<()> {
    let module = AppModule::from_storage(id).ok_or(CoreError::NotFound(id.to_string()))?;
    let definition = module_definition(module);
    let mut activation = load(store)?;
    let current = resolved_active(definition, &activation);
    if current == active {
        return Err(CoreError::Validation(
            if active {
                "app_module_already_active"
            } else {
                "app_module_already_inactive"
            }
            .to_string(),
        ));
    }
    if active && definition.license == ModuleLicense::Locked {
        return Err(CoreError::Validation("app_module_not_licensed".to_string()));
    }
    if !active && definition.required {
        return Err(CoreError::Validation("app_module_required".to_string()));
    }

    if active {
        activation.disabled.remove(module.as_str());
    } else {
        activation.disabled.insert(module.as_str().to_string());
    }
    save(store, &activation)
}

/// Catalogue definitions are kept in sync with the permission matrix.
pub fn catalogue_modules() -> [AppModule; 16] {
    ALL_MODULES
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> Store {
        Store::open_in_memory().expect("store")
    }

    #[test]
    fn catalogue_covers_every_permission_module() {
        assert_eq!(
            MODULES.iter().map(|entry| entry.module).collect::<Vec<_>>(),
            ALL_MODULES
        );
        assert!(MODULES
            .iter()
            .all(|entry| !entry.description_key.is_empty()));
        assert!(MODULES
            .iter()
            .all(|entry| entry.name_key.starts_with("settings_module_")));
    }

    #[test]
    fn defaults_include_licensed_modules_and_hide_locked_ones() {
        let store = store();
        let modules = modules(&store).expect("catalogue");
        assert_eq!(modules.len(), ALL_MODULES.len());
        assert!(modules
            .iter()
            .filter(|module| module.license == ModuleLicense::Locked)
            .all(|module| !module.active));
        assert!(modules
            .iter()
            .filter(|module| module.license != ModuleLicense::Locked)
            .all(|module| module.active));
        assert!(modules
            .iter()
            .filter(|module| module.required)
            .all(|module| module.active && !module.can_toggle()));
    }

    #[test]
    fn activation_is_persisted_and_resolved_for_navigation() {
        let store = store();
        set_active(&store, "contacts", false).expect("deactivate");
        assert!(!is_active(&store, AppModule::Contacts).expect("state"));
        assert!(!active_modules(&store)
            .expect("active")
            .contains(&AppModule::Contacts));
        let contacts = modules(&store)
            .expect("catalogue")
            .into_iter()
            .find(|module| module.module == AppModule::Contacts)
            .expect("contacts");
        assert!(!contacts.active);
        assert_eq!(contacts.state_key(), "app_store_state_inactive");

        set_active(&store, "contacts", true).expect("activate");
        assert!(is_active(&store, AppModule::Contacts).expect("state"));
        assert!(active_modules(&store)
            .expect("active")
            .contains(&AppModule::Contacts));
    }

    #[test]
    fn rejects_repeat_required_and_unknown_modules() {
        let store = store();
        assert!(matches!(
            set_active(&store, "contacts", true),
            Err(CoreError::Validation(code)) if code == "app_module_already_active"
        ));
        assert!(matches!(
            set_active(&store, "dashboard", false),
            Err(CoreError::Validation(code)) if code == "app_module_required"
        ));
        assert!(is_active(&store, AppModule::Therapy).expect("state"));
        assert!(matches!(
            set_active(&store, "unknown", true),
            Err(CoreError::NotFound(id)) if id == "unknown"
        ));
    }
}
