//! Settings service: company profile and per-user preferences.
//!
//! The store keeps the profile as one JSON value and every user's preferences under its own key.
//! This module is the only place that validates and normalises those values, so the UI, the CLI and
//! later the mobile companion all get the same rules.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

use crate::domain::settings::{CompanyProfile, Language, ThemeMode};
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// Prefix of the per-user preference keys in the settings table.
pub const PREFERENCES_PREFIX: &str = "user_preferences:";

/// Prefix of per-user desktop layout records.
pub const DESKTOP_LAYOUT_PREFIX: &str = "user_desktop_layout:";

/// Prefix of per-user avatar data URLs.
pub const USER_AVATAR_PREFIX: &str = "avatar:";

/// Global desktop/login wallpaper setting key.
pub const DESKTOP_WALLPAPER_KEY: &str = "desktop_wallpaper";

/// Prefix of per-user desktop wallpaper settings.
pub const USER_WALLPAPER_PREFIX: &str = "wallpaper:";

/// Key of the update policy.
pub const UPDATE_SETTINGS_KEY: &str = "update_settings";

/// Key of the portable-mode configuration.
pub const PORTABLE_SETTINGS_KEY: &str = "portable_settings";

/// Release channel the update policy watches.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    /// Stable releases only.
    #[default]
    Stable,
    /// Stable and beta releases.
    Beta,
}

/// Persisted update policy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct UpdateSettings {
    /// Release channel.
    pub channel: UpdateChannel,
    /// Whether the application checks for updates on start.
    pub check_on_start: bool,
    /// Whether a found update is downloaded automatically.
    pub automatic_download: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        UpdateSettings {
            channel: UpdateChannel::Stable,
            check_on_start: true,
            automatic_download: false,
        }
    }
}

impl UpdateSettings {
    /// Validates the policy; automatic downloads require a start-up check.
    pub fn validate(&self) -> Result<(), String> {
        if self.automatic_download && !self.check_on_start {
            return Err("update_check_required".to_string());
        }
        Ok(())
    }
}

/// Persisted portable-mode configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
#[derive(Default)]
pub struct PortableSettings {
    /// Whether portable mode is enabled.
    pub enabled: bool,
    /// Folder that holds database and backups in portable mode.
    pub data_folder: String,
}

impl PortableSettings {
    /// Validates the configuration; an enabled mode needs a data folder.
    pub fn validate(&self) -> Result<(), String> {
        if self.enabled && self.data_folder.trim().is_empty() {
            return Err("portable_folder_required".to_string());
        }
        Ok(())
    }
}

/// Master volume of the interface sounds of a fresh account.
///
/// The reference sound engine ships with `volume = 0.8` and `muted = true`.
pub const DEFAULT_SOUND_VOLUME_PERCENT: u8 = 80;

/// Personal appearance and start-up preferences of one user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Preferences {
    /// Interface language.
    pub language: Language,
    /// Light, dark or system.
    pub theme_mode: ThemeMode,
    /// Accent color identifier or hex value.
    pub accent_color: String,
    /// Whether the sidebar is collapsed.
    pub sidebar_collapsed: bool,
    /// Module shown after sign-in, empty for the dashboard.
    pub startup_module: String,
    /// Whether interface sounds play; the reference starts muted.
    pub sound_enabled: bool,
    /// Master volume of the interface sounds in percent (`0`–`100`).
    pub sound_volume_percent: u8,
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences {
            language: Language::default(),
            theme_mode: ThemeMode::default(),
            accent_color: "indigo".to_string(),
            sidebar_collapsed: false,
            startup_module: String::new(),
            sound_enabled: false,
            sound_volume_percent: DEFAULT_SOUND_VOLUME_PERCENT,
        }
    }
}

impl Preferences {
    /// Defaults taken from the company profile, used before a user changed anything.
    pub fn from_profile(profile: &CompanyProfile) -> Self {
        Preferences {
            language: profile.language,
            theme_mode: profile.theme_mode,
            accent_color: profile.accent_color.clone(),
            ..Preferences::default()
        }
    }

    /// Validates the preference values.
    pub fn validate(&self) -> Result<(), String> {
        if self.accent_color.trim().is_empty() {
            return Err("accent_required".to_string());
        }
        if self.startup_module.chars().any(char::is_whitespace) {
            return Err("startup_module_invalid".to_string());
        }
        Ok(())
    }
}

fn preferences_key(user_id: Uuid) -> String {
    format!("{PREFERENCES_PREFIX}{user_id}")
}

/// Version of the desktop icon grid the persisted cells belong to.
///
/// Version 1 filled rows first: six columns, the next icon started the next row, so a cell read
/// `(column, row)` in reading order. Version 2 follows the legacy desktop and fills columns first:
/// six rows per column and the next icon starts a new column. Records written by an older build are
/// converted once when they are loaded, so saved layouts keep their reading order instead of
/// jumping across the desktop.
pub const DESKTOP_GRID_VERSION: u32 = 2;

/// Icons per column before the grid continues in the next column.
pub const DESKTOP_GRID_ROWS: u32 = 6;

/// Widest icon grid a saved layout may address.
pub const DESKTOP_GRID_MAX_COLUMNS: u32 = 16;

/// Persisted desktop icon layout for one account.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopLayout {
    /// Grid version the icon cells were written with; see [`DESKTOP_GRID_VERSION`].
    pub grid_version: u32,
    /// Stable app slug to grid cell (column, row).
    pub icon_positions: BTreeMap<String, (u32, u32)>,
    /// Last normal window rectangle and maximize state, keyed by app slug.
    pub window_states: BTreeMap<String, DesktopWindowLayout>,
    /// Folders that group desktop apps, in creation order.
    pub folders: Vec<DesktopFolderLayout>,
    /// Directory the desktop storage uploads from, as chosen by the account.
    pub storage_location: String,
    /// Files filed on the desktop and in its folders.
    pub assets: Vec<StorageAssetLayout>,
    /// Virtual desktops of the task view, in strip order.
    pub virtual_desktops: Vec<VirtualDesktopLayout>,
    /// Identifier of the virtual desktop the user was on.
    pub active_desktop_id: String,
}

/// One virtual desktop of the task view.
///
/// The reference keeps the list in the browser storage (`socdof_virtual_desktops`); the native shell
/// keeps it in the account layout so it survives a restart and travels with the backup.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct VirtualDesktopLayout {
    /// Stable identifier, `desktop-<n>` like the reference.
    pub id: String,
    /// Name shown on the strip card.
    pub name: String,
}

/// Most virtual desktops the task view keeps per account.
pub const DESKTOP_MAX_VIRTUAL_DESKTOPS: usize = 12;

/// Longest virtual desktop name kept.
pub const VIRTUAL_DESKTOP_NAME_MAX: usize = 40;

/// Desktop id that shows a window on every virtual desktop.
pub const DESKTOP_ALL_ID: &str = "all";

/// Default number of virtual desktops of a fresh account, like the reference.
pub const DESKTOP_DEFAULT_VIRTUAL_DESKTOPS: usize = 2;

/// Default virtual desktops of an account without a saved list.
pub fn default_virtual_desktops() -> Vec<VirtualDesktopLayout> {
    (1..=DESKTOP_DEFAULT_VIRTUAL_DESKTOPS)
        .map(|index| VirtualDesktopLayout {
            id: format!("desktop-{index}"),
            name: format!("Desktop {index}"),
        })
        .collect()
}

/// Most files the desktop storage keeps per account.
pub const DESKTOP_MAX_ASSETS: usize = 200;

/// Longest file name the desktop storage keeps.
pub const DESKTOP_ASSET_NAME_MAX: usize = 120;

/// Longest storage location path the desktop keeps.
pub const DESKTOP_LOCATION_MAX: usize = 400;

/// File categories the reference storage assigns from the file extension.
pub const STORAGE_CATEGORIES: [&str; 9] = [
    "document",
    "image",
    "spreadsheet",
    "pdf",
    "archive",
    "audio",
    "video",
    "code",
    "other",
];

/// One file filed on the desktop or in a desktop folder.
///
/// The reference keeps `StorageAsset` records in the browser storage and copies up to 15 MB of the
/// file as a data URL for offline previews. The native shell keeps the record and the source path
/// instead of duplicating the bytes into the account settings.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct StorageAssetLayout {
    /// Identifier the asset is stored and looked up by.
    pub id: String,
    /// File name without a directory.
    pub name: String,
    /// Size in bytes.
    pub size: u64,
    /// Category slug, one of [`STORAGE_CATEGORIES`].
    pub category: String,
    /// Directory or file path the asset was imported from.
    pub location: String,
    /// Folder the asset is filed in; `None` files it on the desktop.
    pub folder_id: Option<String>,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

/// Most desktop folders one account may keep.
pub const DESKTOP_MAX_FOLDERS: usize = 32;

/// Longest folder name the desktop stores.
pub const DESKTOP_FOLDER_NAME_MAX: usize = 64;

/// One persisted desktop folder and the apps it holds.
///
/// The reference desktop keeps folders in `socdof_desktop_folders` per account; the native shell
/// stores the same data in the account's desktop layout so it travels with the backups.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopFolderLayout {
    /// Identifier the folder is persisted and looked up by.
    pub id: String,
    /// Displayed name of the folder.
    pub name: String,
    /// App slugs inside the folder, in the order they were added.
    pub modules: Vec<String>,
    /// Grid cell of the folder tile, column then row.
    pub cell: (u32, u32),
}

/// Geometry restored when an application window is opened again.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopWindowLayout {
    /// Horizontal position in desktop points.
    pub x: i32,
    /// Vertical position in desktop points.
    pub y: i32,
    /// Normal window width in desktop points.
    pub width: u32,
    /// Normal window height in desktop points.
    pub height: u32,
    /// Whether the window was maximized.
    pub maximized: bool,
    /// Whether this window was open when the user last left the desktop.
    ///
    /// Missing values in older layout records default to false.
    pub open: bool,
    /// Whether this open window was minimized.
    pub minimized: bool,
    /// Stacking order from back (zero) to front (larger values).
    ///
    /// Missing values in older layout records default to zero.
    pub z_order: u32,
    /// Virtual desktop the window was shown on; `None` (or `all`) shows it everywhere.
    ///
    /// Missing values in older layout records default to `None`.
    pub desktop_id: Option<String>,
}

fn desktop_layout_key(user_id: Uuid) -> String {
    format!("{DESKTOP_LAYOUT_PREFIX}{user_id}")
}

/// Loads an account's desktop layout. Unknown or older records safely fall back to defaults.
///
/// Layouts from before [`DESKTOP_GRID_VERSION`] are migrated in place, so a user who arranged icons
/// on the row-first grid finds them in the same reading order on the column-first grid.
pub fn desktop_layout(store: &Store, user_id: Uuid) -> CoreResult<DesktopLayout> {
    let mut layout = match store.get_setting(&desktop_layout_key(user_id))? {
        Some(value) => serde_json::from_value(value).unwrap_or_default(),
        None => DesktopLayout::default(),
    };
    migrate_icon_positions(&mut layout);
    Ok(layout)
}

/// Converts row-first icon cells of version 1 into the column-first grid of version 2.
///
/// Both grids hold six cells per line, so the old row becomes the new column and the old column
/// the new row: the icons keep their reading order without any cell leaving the grid.
fn migrate_icon_positions(layout: &mut DesktopLayout) {
    if layout.grid_version >= DESKTOP_GRID_VERSION {
        return;
    }
    for cell in layout.icon_positions.values_mut() {
        *cell = (
            cell.1.min(DESKTOP_GRID_MAX_COLUMNS - 1),
            cell.0.min(DESKTOP_GRID_ROWS - 1),
        );
    }
    layout.grid_version = DESKTOP_GRID_VERSION;
}

/// Saves a normalized desktop layout, ignoring malformed app slugs and excessive grid rows.
pub fn save_desktop_layout(store: &Store, user_id: Uuid, layout: &DesktopLayout) -> CoreResult<()> {
    let desktops = normalize_virtual_desktops(&layout.virtual_desktops, &layout.active_desktop_id);
    let normalized = DesktopLayout {
        grid_version: DESKTOP_GRID_VERSION,
        icon_positions: layout
            .icon_positions
            .iter()
            .filter(|(slug, (column, row))| {
                !slug.trim().is_empty()
                    && slug.len() <= 64
                    && *column < DESKTOP_GRID_MAX_COLUMNS
                    && *row < DESKTOP_GRID_ROWS
            })
            .map(|(slug, cell)| (slug.clone(), *cell))
            .collect(),
        window_states: layout
            .window_states
            .iter()
            .filter(|(slug, window)| {
                !slug.trim().is_empty()
                    && slug.len() <= 64
                    && (-32_768..=32_768).contains(&window.x)
                    && (-32_768..=32_768).contains(&window.y)
                    && (320..=16_384).contains(&window.width)
                    && (220..=16_384).contains(&window.height)
            })
            .map(|(slug, window)| (slug.clone(), window.clone()))
            .collect(),
        folders: normalize_folders(&layout.folders),
        storage_location: layout
            .storage_location
            .trim()
            .chars()
            .take(DESKTOP_LOCATION_MAX)
            .collect(),
        assets: normalize_assets(&layout.assets),
        virtual_desktops: desktops.0.clone(),
        active_desktop_id: desktops.1,
    };
    let normalized = DesktopLayout {
        window_states: normalized
            .window_states
            .into_iter()
            .map(|(slug, mut window)| {
                window.desktop_id = normalize_window_desktop(
                    window.desktop_id,
                    &normalized_desktop_ids(&desktops.0),
                );
                (slug, window)
            })
            .collect(),
        ..normalized
    };
    store.put_setting(
        &desktop_layout_key(user_id),
        &serde_json::to_value(normalized)?,
    )
}

/// Ids of the desktops a window may be filed on, plus the shared `all` id.
fn normalized_desktop_ids(desktops: &[VirtualDesktopLayout]) -> Vec<String> {
    let mut ids: Vec<String> = desktops.iter().map(|desktop| desktop.id.clone()).collect();
    ids.push(DESKTOP_ALL_ID.to_string());
    ids
}

/// Keeps a window's desktop id only when the desktop still exists.
fn normalize_window_desktop(value: Option<String>, known: &[String]) -> Option<String> {
    let id = value?;
    let id = id.trim();
    if id.is_empty() || !known.iter().any(|known| known == id) {
        return None;
    }
    Some(id.to_owned())
}

/// Drops blank or duplicate desktops, bounds the names and repairs the active id.
fn normalize_virtual_desktops(
    desktops: &[VirtualDesktopLayout],
    active: &str,
) -> (Vec<VirtualDesktopLayout>, String) {
    let mut seen = std::collections::BTreeSet::new();
    let mut normalized: Vec<VirtualDesktopLayout> = Vec::new();
    for desktop in desktops {
        let id = desktop.id.trim();
        let name = desktop.name.trim();
        if id.is_empty() || id.len() > 64 || !seen.insert(id.to_owned()) {
            continue;
        }
        if normalized.len() >= DESKTOP_MAX_VIRTUAL_DESKTOPS {
            break;
        }
        let index = normalized.len() + 1;
        normalized.push(VirtualDesktopLayout {
            id: id.to_owned(),
            name: if name.is_empty() {
                format!("Desktop {index}")
            } else {
                name.chars().take(VIRTUAL_DESKTOP_NAME_MAX).collect()
            },
        });
    }
    if normalized.is_empty() {
        normalized = default_virtual_desktops();
    }
    let active = active.trim();
    let active = if normalized.iter().any(|desktop| desktop.id == active) {
        active.to_owned()
    } else {
        normalized[0].id.clone()
    };
    (normalized, active)
}

/// Normalizes persisted desktop folders: valid identifiers and names, unique app slugs, and grid
/// cells inside the saved grid. Malformed folders are dropped instead of being rewritten.
fn normalize_folders(folders: &[DesktopFolderLayout]) -> Vec<DesktopFolderLayout> {
    let mut seen = std::collections::BTreeSet::new();
    folders
        .iter()
        .filter(|folder| {
            !folder.id.trim().is_empty()
                && folder.id.len() <= 64
                && !folder.name.trim().is_empty()
                && seen.insert(folder.id.clone())
        })
        .take(DESKTOP_MAX_FOLDERS)
        .map(|folder| {
            let mut modules: Vec<String> = Vec::new();
            for module in &folder.modules {
                let slug = module.trim();
                if slug.is_empty() || slug.len() > 64 || modules.iter().any(|known| known == slug) {
                    continue;
                }
                modules.push(slug.to_owned());
            }
            DesktopFolderLayout {
                id: folder.id.trim().to_owned(),
                name: folder
                    .name
                    .trim()
                    .chars()
                    .take(DESKTOP_FOLDER_NAME_MAX)
                    .collect(),
                modules,
                cell: (
                    folder.cell.0.min(DESKTOP_GRID_MAX_COLUMNS - 1),
                    folder.cell.1.min(DESKTOP_GRID_ROWS - 1),
                ),
            }
        })
        .collect()
}

/// Normalizes persisted storage assets: unique identifiers, bounded names and paths, a known
/// category slug and a folder reference of a saved folder or `None`.
fn normalize_assets(assets: &[StorageAssetLayout]) -> Vec<StorageAssetLayout> {
    let mut seen = std::collections::BTreeSet::new();
    assets
        .iter()
        .filter(|asset| {
            !asset.id.trim().is_empty() && asset.id.len() <= 64 && seen.insert(asset.id.clone())
        })
        .take(DESKTOP_MAX_ASSETS)
        .map(|asset| {
            let name: String = asset
                .name
                .trim()
                .chars()
                .take(DESKTOP_ASSET_NAME_MAX)
                .collect();
            StorageAssetLayout {
                id: asset.id.trim().to_owned(),
                name: if name.is_empty() {
                    "Datei".to_owned()
                } else {
                    name
                },
                size: asset.size.min(64 * 1024 * 1024 * 1024),
                category: if STORAGE_CATEGORIES.contains(&asset.category.as_str()) {
                    asset.category.clone()
                } else {
                    "other".to_owned()
                },
                location: asset
                    .location
                    .trim()
                    .chars()
                    .take(DESKTOP_LOCATION_MAX)
                    .collect(),
                folder_id: asset
                    .folder_id
                    .as_ref()
                    .map(|id| id.trim().to_owned())
                    .filter(|id| !id.is_empty() && id.len() <= 64),
                created_at: asset.created_at,
            }
        })
        .collect()
}

/// Removes a user's desktop layout when their account is deleted.
pub fn delete_desktop_layout(store: &Store, user_id: Uuid) -> CoreResult<()> {
    store.remove_setting(&desktop_layout_key(user_id))
}

/// Loads the company profile (defaults when nothing was saved yet).
pub fn company_profile(store: &Store) -> CoreResult<CompanyProfile> {
    store.company_profile()
}

/// Normalises and validates a company profile, then stores it.
pub fn save_company_profile(store: &Store, profile: &CompanyProfile) -> CoreResult<()> {
    let mut normalized = profile.clone();
    normalize_profile(&mut normalized);
    normalized.validate().map_err(CoreError::Validation)?;
    store.save_company_profile(&normalized)
}

/// Trims the text fields of a profile so stored values compare cleanly.
pub fn normalize_profile(profile: &mut CompanyProfile) {
    for value in [
        &mut profile.name,
        &mut profile.street,
        &mut profile.zip_city,
        &mut profile.country,
        &mut profile.email,
        &mut profile.phone,
        &mut profile.tax_id,
        &mut profile.backup_folder_path,
    ] {
        *value = value.trim().to_string();
    }

    if profile.currency.trim().is_empty() {
        profile.currency = "€".to_string();
    }

    if profile.accent_color.trim().is_empty() {
        profile.accent_color = "indigo".to_string();
    }

    if !crate::date::DATE_FORMATS.contains(&profile.date_format.as_str()) {
        profile.date_format = "DD.MM.YYYY".to_string();
    }

    if !crate::date::TIMEZONES.contains(&profile.timezone.as_str()) {
        profile.timezone = "Europe/Berlin".to_string();
    }
}

/// Preferences of a user, defaulting to the company profile values.
pub fn preferences(store: &Store, user_id: Uuid) -> CoreResult<Preferences> {
    match store.get_setting(&preferences_key(user_id))? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(Preferences::from_profile(&company_profile(store)?)),
    }
}

/// Validates and stores the preferences of a user.
pub fn save_preferences(store: &Store, user_id: Uuid, preferences: &Preferences) -> CoreResult<()> {
    preferences.validate().map_err(CoreError::Validation)?;
    // The volume slider of the reference is a `0..1` input with 1 % steps; the stored percent is
    // clamped here so a hand-edited settings record cannot leave the range.
    let mut normalized = preferences.clone();
    normalized.sound_volume_percent = preferences.sound_volume_percent.min(100);
    store.put_setting(
        &preferences_key(user_id),
        &serde_json::to_value(normalized)?,
    )
}

/// Language that applies to a user: their own preference, otherwise the company profile.
pub fn resolve_language(store: &Store, user_id: Option<Uuid>) -> CoreResult<Language> {
    match user_id {
        Some(user_id) => Ok(preferences(store, user_id)?.language),
        None => Ok(company_profile(store)?.language),
    }
}

/// Removes the preferences of a user, for example when the account is deleted.
pub fn delete_preferences(store: &Store, user_id: Uuid) -> CoreResult<()> {
    store.remove_setting(&preferences_key(user_id))?;
    delete_desktop_layout(store, user_id)
}

/// Loads the update policy (defaults before the first save).
pub fn update_settings(store: &Store) -> CoreResult<UpdateSettings> {
    match store.get_setting(UPDATE_SETTINGS_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(UpdateSettings::default()),
    }
}

/// Validates and stores the update policy.
pub fn save_update_settings(store: &Store, settings: &UpdateSettings) -> CoreResult<()> {
    settings.validate().map_err(CoreError::Validation)?;
    store.put_setting(UPDATE_SETTINGS_KEY, &serde_json::to_value(settings)?)
}

/// Loads the portable-mode configuration (defaults before the first save).
pub fn portable_settings(store: &Store) -> CoreResult<PortableSettings> {
    match store.get_setting(PORTABLE_SETTINGS_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(PortableSettings::default()),
    }
}

/// Normalises and stores the portable-mode configuration.
pub fn save_portable_settings(store: &Store, settings: &PortableSettings) -> CoreResult<()> {
    let mut normalized = settings.clone();
    normalized.data_folder = normalized.data_folder.trim().to_string();
    normalized.validate().map_err(CoreError::Validation)?;
    store.put_setting(PORTABLE_SETTINGS_KEY, &serde_json::to_value(normalized)?)
}

/// Persisted wallpaper choice for the login backdrop and user desktop.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct WallpaperPreference {
    /// Built-in identifier (`plain`, `aurora`, `dusk`, or `custom`).
    pub kind: String,
    /// Fit mode (`cover` or `tile`).
    pub fit: String,
    /// Optional PNG/image data URL when `kind == "custom"`.
    pub custom_image: Option<String>,
}

impl Default for WallpaperPreference {
    fn default() -> Self {
        Self {
            kind: "plain".to_string(),
            fit: "cover".to_string(),
            custom_image: None,
        }
    }
}

fn user_avatar_key(user_id: Uuid) -> String {
    format!("{USER_AVATAR_PREFIX}{user_id}")
}

fn user_wallpaper_key(user_id: Uuid) -> String {
    format!("{USER_WALLPAPER_PREFIX}{user_id}")
}

/// Loads a user's persisted avatar data URL, if set.
pub fn user_avatar(store: &Store, user_id: Uuid) -> CoreResult<Option<String>> {
    match store.get_setting(&user_avatar_key(user_id))? {
        Some(serde_json::Value::String(value)) if !value.trim().is_empty() => Ok(Some(value)),
        _ => Ok(None),
    }
}

/// Stores or clears a user's avatar data URL (`data:image/png;base64,...`).
pub fn save_user_avatar(store: &Store, user_id: Uuid, data_url: Option<&str>) -> CoreResult<()> {
    match data_url.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => store.put_setting(
            &user_avatar_key(user_id),
            &serde_json::Value::String(value.to_string()),
        ),
        None => store.remove_setting(&user_avatar_key(user_id)),
    }
}

/// Loads the desktop/login wallpaper setting, defaulting to `plain` when unset.
pub fn desktop_wallpaper(store: &Store) -> CoreResult<WallpaperPreference> {
    match store.get_setting(DESKTOP_WALLPAPER_KEY)? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => Ok(WallpaperPreference::default()),
    }
}

/// Loads a user's desktop wallpaper, falling back to the global desktop wallpaper.
pub fn user_wallpaper(store: &Store, user_id: Uuid) -> CoreResult<WallpaperPreference> {
    match store.get_setting(&user_wallpaper_key(user_id))? {
        Some(value) => Ok(serde_json::from_value(value).unwrap_or_default()),
        None => desktop_wallpaper(store),
    }
}

/// Persists the desktop/login wallpaper setting globally or for one user.
pub fn save_wallpaper(
    store: &Store,
    user_id: Option<Uuid>,
    wallpaper: &WallpaperPreference,
) -> CoreResult<()> {
    let serialized = serde_json::to_value(wallpaper)?;
    if let Some(id) = user_id {
        store.put_setting(&user_wallpaper_key(id), &serialized)?;
    }
    store.put_setting(DESKTOP_WALLPAPER_KEY, &serialized)
}

/// Decodes an uploaded PNG, JPEG, GIF, WebP, BMP, or ICO image into 8-bit RGBA pixels.
pub fn decode_image_rgba(bytes: &[u8]) -> CoreResult<(u32, u32, Vec<u8>)> {
    let image = image::load_from_memory(bytes)
        .map_err(|_| CoreError::Validation("image_decode_failed".to_string()))?;
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    if width == 0 || height == 0 {
        return Err(CoreError::Validation("image_empty".to_string()));
    }
    Ok((width, height, rgba.into_raw()))
}

/// Encodes 8-bit RGBA pixels as a `data:image/png;base64,...` URL for SQLite storage.
pub fn encode_png_data_url(width: u32, height: u32, rgba: &[u8]) -> CoreResult<String> {
    let expected = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| CoreError::Validation("image_dimensions_invalid".to_string()))?;
    if rgba.len() != expected || width == 0 || height == 0 {
        return Err(CoreError::Validation("image_buffer_invalid".to_string()));
    }
    let mut png_bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|_| CoreError::Validation("image_encode_failed".to_string()))?;
        writer
            .write_image_data(rgba)
            .map_err(|_| CoreError::Validation("image_encode_failed".to_string()))?;
    }
    Ok(format!(
        "data:image/png;base64,{}",
        base64_encode_bytes(&png_bytes)
    ))
}

/// Decodes a stored image data URL (`data:image/...;base64,...`) into RGBA pixels.
pub fn decode_data_url_rgba(data_url: &str) -> Option<(usize, usize, Vec<u8>)> {
    let encoded = data_url
        .trim()
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(','))
        .map(|(_, payload)| payload)?;
    let bytes = base64_decode_bytes(encoded)?;
    let (width, height, rgba) = decode_image_rgba(&bytes).ok()?;
    Some((width as usize, height as usize, rgba))
}

fn base64_encode_bytes(bytes: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as u32;
        let b = chunk.get(1).copied().unwrap_or(0) as u32;
        let c = chunk.get(2).copied().unwrap_or(0) as u32;
        let value = (a << 16) | (b << 8) | c;
        out.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        out.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((value >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(value & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

fn base64_decode_bytes(value: &str) -> Option<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for byte in value.bytes() {
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\n' | b'\r' | b' ' => continue,
            _ => return None,
        } as u32;
        buffer = (buffer << 6) | digit;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }
    Some(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::settings::ThemeMode;

    #[test]
    fn preferences_start_from_the_profile() {
        let store = Store::open_in_memory().expect("store");
        let profile = CompanyProfile {
            language: Language::Fr,
            theme_mode: ThemeMode::Dark,
            accent_color: "emerald".to_string(),
            ..CompanyProfile::default()
        };
        store.save_company_profile(&profile).expect("profile");

        let user_id = Uuid::new_v4();
        let loaded = preferences(&store, user_id).expect("preferences");
        assert_eq!(loaded.language, Language::Fr);
        assert_eq!(loaded.theme_mode, ThemeMode::Dark);
        assert_eq!(loaded.accent_color, "emerald");
        assert_eq!(
            resolve_language(&store, Some(user_id)).expect("language"),
            Language::Fr
        );
    }

    #[test]
    fn saves_and_validates_preferences_per_user() {
        let store = Store::open_in_memory().expect("store");
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        let custom = Preferences {
            language: Language::Es,
            theme_mode: ThemeMode::Light,
            accent_color: "rose".to_string(),
            sidebar_collapsed: true,
            startup_module: "invoices".to_string(),
            ..Preferences::default()
        };
        save_preferences(&store, first, &custom).expect("saved");

        assert_eq!(preferences(&store, first).expect("loaded"), custom);
        assert_eq!(
            preferences(&store, second).expect("loaded").language,
            Language::De
        );

        let invalid = Preferences {
            accent_color: " ".to_string(),
            ..Preferences::default()
        };
        assert!(save_preferences(&store, first, &invalid).is_err());

        delete_preferences(&store, first).expect("deleted");
        assert_eq!(
            preferences(&store, first).expect("loaded").language,
            Language::De
        );
    }

    #[test]
    fn legacy_window_layouts_default_to_closed_and_open_state_round_trips() {
        let legacy: DesktopWindowLayout = serde_json::from_value(serde_json::json!({
            "x": 24,
            "y": 36,
            "width": 900,
            "height": 640,
            "maximized": false
        }))
        .expect("legacy layout");
        assert!(!legacy.open);
        assert!(!legacy.minimized);
        assert_eq!(legacy.z_order, 0);

        let store = Store::open_in_memory().expect("store");
        let user_id = Uuid::new_v4();
        let layout = DesktopLayout {
            window_states: [(
                "contacts".to_string(),
                DesktopWindowLayout {
                    x: 24,
                    y: 36,
                    width: 900,
                    height: 640,
                    maximized: true,
                    open: true,
                    minimized: false,
                    z_order: 1,
                    desktop_id: None,
                },
            )]
            .into_iter()
            .collect(),
            ..DesktopLayout::default()
        };
        save_desktop_layout(&store, user_id, &layout).expect("save layout");
        assert_eq!(
            desktop_layout(&store, user_id)
                .expect("load layout")
                .window_states
                .get("contacts"),
            layout.window_states.get("contacts")
        );
    }

    #[test]
    fn sound_preferences_round_trip_and_are_clamped() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let defaults = preferences(&store, user).expect("defaults");
        // The reference sound engine starts muted at 80 %.
        assert!(!defaults.sound_enabled);
        assert_eq!(defaults.sound_volume_percent, DEFAULT_SOUND_VOLUME_PERCENT);

        let custom = Preferences {
            sound_enabled: true,
            sound_volume_percent: 35,
            ..Preferences::default()
        };
        save_preferences(&store, user, &custom).expect("saved");
        let loaded = preferences(&store, user).expect("loaded");
        assert!(loaded.sound_enabled);
        assert_eq!(loaded.sound_volume_percent, 35);

        let out_of_range = Preferences {
            sound_volume_percent: 250,
            ..Preferences::default()
        };
        save_preferences(&store, user, &out_of_range).expect("saved");
        assert_eq!(
            preferences(&store, user)
                .expect("loaded")
                .sound_volume_percent,
            100
        );

        // A record written before the sound fields existed keeps the reference defaults.
        let legacy = serde_json::json!({
            "language": "Deutsch",
            "theme_mode": "System",
            "accent_color": "indigo",
            "sidebar_collapsed": false,
            "startup_module": "",
        });
        store
            .put_setting(&preferences_key(user), &legacy)
            .expect("legacy record");
        let loaded = preferences(&store, user).expect("legacy loaded");
        assert!(!loaded.sound_enabled);
        assert_eq!(loaded.sound_volume_percent, DEFAULT_SOUND_VOLUME_PERCENT);
    }

    #[test]
    fn desktop_layout_is_scoped_to_user_and_sanitized() {
        let store = Store::open_in_memory().expect("store");
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let layout = DesktopLayout {
            icon_positions: [
                ("contacts".to_string(), (2, 1)),
                ("settings".to_string(), (0, 3)),
                ("".to_string(), (1, 1)),
                ("invalid-column".to_string(), (DESKTOP_GRID_MAX_COLUMNS, 0)),
                ("invalid-row".to_string(), (0, DESKTOP_GRID_ROWS)),
            ]
            .into_iter()
            .collect(),
            ..DesktopLayout::default()
        };

        save_desktop_layout(&store, first, &layout).expect("saved");
        save_preferences(&store, first, &Preferences::default()).expect("preferences saved");
        let loaded = desktop_layout(&store, first).expect("loaded");
        assert_eq!(loaded.icon_positions.len(), 2);
        assert_eq!(loaded.icon_positions.get("contacts"), Some(&(2, 1)));
        assert_eq!(
            desktop_layout(&store, second)
                .expect("other user")
                .icon_positions,
            BTreeMap::new()
        );

        delete_preferences(&store, first).expect("account preferences deleted");
        assert_eq!(
            preferences(&store, first)
                .expect("default preferences")
                .accent_color,
            "indigo"
        );
        assert!(desktop_layout(&store, first)
            .expect("defaults")
            .icon_positions
            .is_empty());
    }

    #[test]
    fn virtual_desktops_round_trip_and_are_normalized() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let mut window_states = std::collections::BTreeMap::new();
        window_states.insert(
            "contacts".to_string(),
            DesktopWindowLayout {
                x: 24,
                y: 36,
                width: 900,
                height: 640,
                maximized: false,
                open: true,
                minimized: false,
                z_order: 1,
                desktop_id: Some("desktop-2".to_string()),
            },
        );
        window_states.insert(
            "invoices".to_string(),
            DesktopWindowLayout {
                x: 40,
                y: 60,
                width: 820,
                height: 560,
                maximized: true,
                open: true,
                minimized: false,
                z_order: 2,
                desktop_id: Some("deleted-desktop".to_string()),
            },
        );
        let layout = DesktopLayout {
            virtual_desktops: vec![
                VirtualDesktopLayout {
                    id: "desktop-1".to_string(),
                    name: "  Büro  ".to_string(),
                },
                // Duplicate ids collapse to the first card.
                VirtualDesktopLayout {
                    id: "desktop-1".to_string(),
                    name: "Doppelt".to_string(),
                },
                // A blank name falls back to the numbered reference name.
                VirtualDesktopLayout {
                    id: "desktop-2".to_string(),
                    name: "   ".to_string(),
                },
                VirtualDesktopLayout {
                    id: "  ".to_string(),
                    name: "Ohne Id".to_string(),
                },
                VirtualDesktopLayout {
                    id: "desktop-3".to_string(),
                    name: "x".repeat(VIRTUAL_DESKTOP_NAME_MAX + 20),
                },
            ],
            active_desktop_id: "desktop-2".to_string(),
            window_states,
            ..DesktopLayout::default()
        };

        save_desktop_layout(&store, user, &layout).expect("saved");
        let loaded = desktop_layout(&store, user).expect("loaded");
        assert_eq!(loaded.virtual_desktops.len(), 3);
        assert_eq!(loaded.virtual_desktops[0].name, "Büro");
        assert_eq!(loaded.virtual_desktops[1].id, "desktop-2");
        assert_eq!(loaded.virtual_desktops[1].name, "Desktop 2");
        assert_eq!(
            loaded.virtual_desktops[2].name.chars().count(),
            VIRTUAL_DESKTOP_NAME_MAX
        );
        assert_eq!(loaded.active_desktop_id, "desktop-2");
        assert_eq!(
            loaded
                .window_states
                .get("contacts")
                .and_then(|window| window.desktop_id.as_deref()),
            Some("desktop-2")
        );
        // A window filed on a desktop that no longer exists is shared, not hidden.
        assert_eq!(
            loaded
                .window_states
                .get("invoices")
                .and_then(|window| window.desktop_id.as_deref()),
            None
        );
    }

    #[test]
    fn layouts_without_desktops_get_the_reference_defaults() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let mut window_states = std::collections::BTreeMap::new();
        window_states.insert(
            "calendar".to_string(),
            DesktopWindowLayout {
                x: 0,
                y: 0,
                width: 900,
                height: 640,
                maximized: false,
                open: true,
                minimized: false,
                z_order: 0,
                desktop_id: Some(DESKTOP_ALL_ID.to_string()),
            },
        );
        let layout = DesktopLayout {
            window_states,
            ..DesktopLayout::default()
        };
        save_desktop_layout(&store, user, &layout).expect("saved");
        let loaded = desktop_layout(&store, user).expect("loaded");
        assert_eq!(loaded.virtual_desktops, default_virtual_desktops());
        assert_eq!(loaded.virtual_desktops[0].name, "Desktop 1");
        assert_eq!(loaded.active_desktop_id, "desktop-1");
        assert_eq!(
            loaded
                .window_states
                .get("calendar")
                .and_then(|window| window.desktop_id.as_deref()),
            Some(DESKTOP_ALL_ID)
        );

        // An unknown active desktop falls back to the first card.
        let layout = DesktopLayout {
            active_desktop_id: "ghost".to_string(),
            ..DesktopLayout::default()
        };
        save_desktop_layout(&store, user, &layout).expect("saved");
        assert_eq!(
            desktop_layout(&store, user)
                .expect("loaded")
                .active_desktop_id,
            "desktop-1"
        );
    }

    #[test]
    fn desktop_folders_round_trip_and_are_normalized() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let layout = DesktopLayout {
            folders: vec![
                DesktopFolderLayout {
                    id: "folder-1".to_string(),
                    name: "  Arbeit  ".to_string(),
                    modules: vec![
                        "contacts".to_string(),
                        "contacts".to_string(),
                        " ".to_string(),
                        "invoices".to_string(),
                    ],
                    cell: (1, 2),
                },
                DesktopFolderLayout {
                    id: "folder-1".to_string(),
                    name: "Duplicate".to_string(),
                    modules: Vec::new(),
                    cell: (0, 0),
                },
                DesktopFolderLayout {
                    id: "folder-2".to_string(),
                    name: "Out of grid".to_string(),
                    modules: vec!["pos".to_string()],
                    cell: (DESKTOP_GRID_MAX_COLUMNS + 3, DESKTOP_GRID_ROWS + 3),
                },
            ],
            ..DesktopLayout::default()
        };

        save_desktop_layout(&store, user, &layout).expect("saved");
        let loaded = desktop_layout(&store, user).expect("loaded");
        assert_eq!(loaded.folders.len(), 2);
        let first = &loaded.folders[0];
        assert_eq!(first.id, "folder-1");
        assert_eq!(first.name, "Arbeit");
        assert_eq!(
            first.modules,
            vec!["contacts".to_string(), "invoices".to_string()]
        );
        assert_eq!(first.cell, (1, 2));
        // A cell outside the grid is clamped instead of dropping the folder.
        assert_eq!(
            loaded.folders[1].cell,
            (DESKTOP_GRID_MAX_COLUMNS - 1, DESKTOP_GRID_ROWS - 1)
        );
    }

    #[test]
    fn desktop_storage_round_trips_and_is_normalized() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let layout = DesktopLayout {
            folders: vec![DesktopFolderLayout {
                id: "folder-1".to_string(),
                name: "Arbeit".to_string(),
                modules: vec!["contacts".to_string()],
                cell: (0, 0),
            }],
            storage_location: "  /home/anna/Belege  ".to_string(),
            assets: vec![
                StorageAssetLayout {
                    id: "asset-1".to_string(),
                    name: "  Rechnung.pdf  ".to_string(),
                    size: 2048,
                    category: "pdf".to_string(),
                    location: "/home/anna/Belege/Rechnung.pdf".to_string(),
                    folder_id: Some("folder-1".to_string()),
                    created_at: 1_700_000_000_000,
                },
                StorageAssetLayout {
                    id: "asset-1".to_string(),
                    name: "Duplicate".to_string(),
                    ..StorageAssetLayout::default()
                },
                StorageAssetLayout {
                    id: "asset-2".to_string(),
                    name: "   ".to_string(),
                    size: u64::MAX,
                    category: "nonsense".to_string(),
                    location: "".to_string(),
                    folder_id: Some("   ".to_string()),
                    created_at: 0,
                },
            ],
            ..DesktopLayout::default()
        };

        save_desktop_layout(&store, user, &layout).expect("saved");
        let loaded = desktop_layout(&store, user).expect("loaded");
        assert_eq!(loaded.storage_location, "/home/anna/Belege");
        assert_eq!(loaded.assets.len(), 2);
        assert_eq!(loaded.assets[0].name, "Rechnung.pdf");
        assert_eq!(loaded.assets[0].folder_id.as_deref(), Some("folder-1"));
        assert_eq!(loaded.assets[1].name, "Datei");
        assert_eq!(loaded.assets[1].category, "other");
        assert_eq!(loaded.assets[1].size, 64 * 1024 * 1024 * 1024);
        assert_eq!(loaded.assets[1].folder_id, None);
    }

    #[test]
    fn layouts_without_storage_load_with_empty_defaults() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let legacy = serde_json::json!({
            "grid_version": 2,
            "icon_positions": { "contacts": [0, 0] }
        });
        store
            .put_setting(&desktop_layout_key(user), &legacy)
            .expect("legacy layout stored");
        let loaded = desktop_layout(&store, user).expect("loaded");
        assert_eq!(loaded.storage_location, "");
        assert!(loaded.assets.is_empty());
        assert!(loaded.folders.is_empty());
    }

    #[test]
    fn older_icon_positions_are_migrated_into_the_column_first_grid() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let legacy = serde_json::json!({
            "icon_positions": {
                "contacts": [0, 0],
                "settings": [1, 0],
                "invoices": [0, 1],
                "products": [5, 0]
            }
        });
        store
            .put_setting(&desktop_layout_key(user), &legacy)
            .expect("legacy layout stored");
        let layout = desktop_layout(&store, user).expect("migrated layout");
        assert_eq!(layout.grid_version, DESKTOP_GRID_VERSION);
        // Row-first cells transpose into the column-first grid and keep the reading order.
        assert_eq!(layout.icon_positions.get("contacts"), Some(&(0, 0)));
        assert_eq!(layout.icon_positions.get("settings"), Some(&(0, 1)));
        assert_eq!(layout.icon_positions.get("invoices"), Some(&(1, 0)));
        assert_eq!(layout.icon_positions.get("products"), Some(&(0, 5)));
        assert!(layout
            .icon_positions
            .values()
            .all(|(column, row)| *column < DESKTOP_GRID_MAX_COLUMNS && *row < DESKTOP_GRID_ROWS));
    }

    #[test]
    fn older_desktop_layout_records_default_missing_window_states() {
        let legacy = serde_json::json!({
            "icon_positions": {
                "contacts": [2, 1]
            }
        });
        let layout: DesktopLayout =
            serde_json::from_value(legacy).expect("legacy layout remains readable");
        assert_eq!(layout.icon_positions.get("contacts"), Some(&(2, 1)));
        assert!(layout.window_states.is_empty());
    }

    #[test]
    fn desktop_window_geometry_is_persisted_per_user_and_sanitized() {
        let store = Store::open_in_memory().expect("store");
        let user = Uuid::new_v4();
        let layout = DesktopLayout {
            window_states: [
                (
                    "contacts".to_string(),
                    DesktopWindowLayout {
                        x: 120,
                        y: 80,
                        width: 900,
                        height: 640,
                        maximized: true,
                        open: true,
                        minimized: false,
                        z_order: 1,
                        desktop_id: None,
                    },
                ),
                (
                    "invalid".to_string(),
                    DesktopWindowLayout {
                        width: 120,
                        height: 100,
                        ..DesktopWindowLayout::default()
                    },
                ),
            ]
            .into_iter()
            .collect(),
            ..DesktopLayout::default()
        };

        save_desktop_layout(&store, user, &layout).expect("save");
        let saved = desktop_layout(&store, user).expect("load");
        assert_eq!(saved.window_states.len(), 1);
        assert_eq!(
            saved.window_states.get("contacts"),
            layout.window_states.get("contacts")
        );
    }

    #[test]
    fn roundtrips_update_and_portable_settings() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(
            update_settings(&store).expect("defaults"),
            UpdateSettings::default()
        );

        let update = UpdateSettings {
            channel: UpdateChannel::Beta,
            check_on_start: true,
            automatic_download: true,
        };
        save_update_settings(&store, &update).expect("saved");
        assert_eq!(update_settings(&store).expect("loaded"), update);

        let invalid = UpdateSettings {
            check_on_start: false,
            automatic_download: true,
            ..UpdateSettings::default()
        };
        assert!(save_update_settings(&store, &invalid).is_err());

        let portable = PortableSettings {
            enabled: true,
            data_folder: "  /media/usb/socdof  ".to_string(),
        };
        save_portable_settings(&store, &portable).expect("saved");
        assert_eq!(
            portable_settings(&store).expect("loaded").data_folder,
            "/media/usb/socdof"
        );

        let invalid = PortableSettings {
            enabled: true,
            data_folder: " ".to_string(),
        };
        assert!(save_portable_settings(&store, &invalid).is_err());
    }

    #[test]
    fn validates_and_normalizes_the_profile() {
        let store = Store::open_in_memory().expect("store");
        let profile = CompanyProfile {
            name: "  Strudelcode  ".to_string(),
            backup_folder_path: "  ".to_string(),
            ..CompanyProfile::default()
        };
        save_company_profile(&store, &profile).expect("saved");

        let loaded = company_profile(&store).expect("profile");
        assert_eq!(loaded.name, "Strudelcode");
        assert_eq!(loaded.backup_folder_path, "");

        let invalid = CompanyProfile {
            name: " ".to_string(),
            ..CompanyProfile::default()
        };
        assert!(save_company_profile(&store, &invalid).is_err());
    }

    #[test]
    fn roundtrips_user_avatar_wallpaper_and_png_data_url() {
        let store = Store::open_in_memory().expect("store");
        let user_id = Uuid::new_v4();
        let rgba = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
        ];
        let data_url = encode_png_data_url(2, 2, &rgba).expect("encode png");
        assert!(data_url.starts_with("data:image/png;base64,"));
        let (width, height, decoded) = decode_data_url_rgba(&data_url).expect("decode png");
        assert_eq!((width, height), (2, 2));
        assert_eq!(decoded, rgba);

        save_user_avatar(&store, user_id, Some(&data_url)).expect("save avatar");
        assert_eq!(
            user_avatar(&store, user_id)
                .expect("load avatar")
                .as_deref(),
            Some(data_url.as_str())
        );

        let wallpaper = WallpaperPreference {
            kind: "custom".to_string(),
            fit: "tile".to_string(),
            custom_image: Some(data_url.clone()),
        };
        save_wallpaper(&store, Some(user_id), &wallpaper).expect("save wallpaper");
        assert_eq!(
            user_wallpaper(&store, user_id).expect("user wallpaper"),
            wallpaper
        );
        assert_eq!(
            desktop_wallpaper(&store).expect("desktop wallpaper"),
            wallpaper
        );

        save_user_avatar(&store, user_id, None).expect("clear avatar");
        assert_eq!(user_avatar(&store, user_id).expect("cleared"), None);
    }
}
