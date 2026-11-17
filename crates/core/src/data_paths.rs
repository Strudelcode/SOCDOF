//! Shared application data-path policy for every SOCDOF host.
//!
//! Desktop, portable and transitional hosts resolve the same database path so upgrades and
//! switching between supported frontends do not create separate, confusing data stores.

use std::ffi::OsString;
use std::io;
use std::path::{Path, PathBuf};

/// Stable folder name shared by all SOCDOF desktop distributions.
pub const DATA_DIRECTORY_NAME: &str = "SOCDOF";
/// Stable SQLite file name shared by all SOCDOF desktop distributions.
pub const DATABASE_FILE_NAME: &str = "SOCDOF.db";
/// Environment variable used by portable deployments and administrators.
pub const DATA_DIRECTORY_ENV: &str = "SOCDOF_DATA_DIR";

/// Resolved paths for one SOCDOF installation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataPaths {
    /// Directory containing the database, lock, backups and desktop state.
    pub data_dir: PathBuf,
    /// Absolute or caller-relative SQLite database path.
    pub database: PathBuf,
    /// Whether the path was explicitly selected rather than using the platform default.
    pub custom: bool,
}

impl DataPaths {
    /// Resolves --database, --data-dir, the environment override and the platform default.
    ///
    /// An explicit database path has highest priority, followed by --data-dir, then
    /// SOCDOF_DATA_DIR, and finally the platform's standard application-data directory.
    /// Unknown host arguments are ignored so Tauri and other launchers can pass their own flags.
    pub fn resolve<I>(
        args: I,
        default_root: PathBuf,
        environment_dir: Option<PathBuf>,
    ) -> io::Result<Self>
    where
        I: IntoIterator<Item = OsString>,
    {
        let mut args = args.into_iter();
        let mut explicit_database = None;
        let mut explicit_directory = None;
        while let Some(argument) = args.next() {
            if argument == "--database" {
                explicit_database = Some(PathBuf::from(next_value(&mut args, "--database")?));
            } else if argument == "--data-dir" {
                explicit_directory = Some(PathBuf::from(next_value(&mut args, "--data-dir")?));
            }
        }

        if let Some(database) = explicit_database {
            let data_dir = database
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."));
            return Ok(Self {
                data_dir,
                database,
                custom: true,
            });
        }

        if let Some(data_dir) = explicit_directory.or(environment_dir) {
            return Ok(Self {
                database: data_dir.join(DATABASE_FILE_NAME),
                data_dir,
                custom: true,
            });
        }

        let data_dir = default_root.join(DATA_DIRECTORY_NAME);
        Ok(Self {
            database: data_dir.join(DATABASE_FILE_NAME),
            data_dir,
            custom: false,
        })
    }
}

fn next_value<I>(args: &mut I, flag: &str) -> io::Result<OsString>
where
    I: Iterator<Item = OsString>,
{
    args.next().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{flag} requires a path"),
        )
    })
}

/// Returns the platform's writable per-user application-data root.
pub fn default_data_root() -> io::Result<PathBuf> {
    #[cfg(target_os = "windows")]
    let root = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?);

    #[cfg(target_os = "macos")]
    let root = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?)
        .join("Library")
        .join("Application Support");

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let root = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .map(PathBuf::from)
                .map(|home| home.join(".local").join("share"))
        })
        .unwrap_or(std::env::current_dir()?);

    Ok(root)
}

/// Resolves the current process paths using its command-line arguments and environment.
pub fn current_process() -> io::Result<DataPaths> {
    DataPaths::resolve(
        std::env::args_os().skip(1),
        default_data_root()?,
        std::env::var_os(DATA_DIRECTORY_ENV).map(PathBuf::from),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn defaults_to_one_clear_cross_platform_data_directory() {
        let paths = DataPaths::resolve(args(&[]), PathBuf::from("appdata"), None).unwrap();
        assert_eq!(paths.data_dir, PathBuf::from("appdata/SOCDOF"));
        assert_eq!(paths.database, PathBuf::from("appdata/SOCDOF/SOCDOF.db"));
        assert!(!paths.custom);
    }

    #[test]
    fn explicit_data_directory_overrides_environment() {
        let paths = DataPaths::resolve(
            args(&["--data-dir", "D:/portable/data"]),
            PathBuf::from("unused"),
            Some(PathBuf::from("C:/profile/SOCDOF")),
        )
        .unwrap();
        assert_eq!(paths.database, PathBuf::from("D:/portable/data/SOCDOF.db"));
        assert!(paths.custom);
    }

    #[test]
    fn environment_directory_is_used_without_a_cli_override() {
        let paths = DataPaths::resolve(
            args(&[]),
            PathBuf::from("unused"),
            Some(PathBuf::from("E:/shared/SOCDOF")),
        )
        .unwrap();
        assert_eq!(paths.database, PathBuf::from("E:/shared/SOCDOF/SOCDOF.db"));
    }

    #[test]
    fn explicit_database_wins_over_data_directory_and_environment() {
        let paths = DataPaths::resolve(
            args(&["--data-dir", "D:/portable", "--database", "E:/custom/main.db"]),
            PathBuf::from("unused"),
            Some(PathBuf::from("C:/profile/SOCDOF")),
        )
        .unwrap();
        assert_eq!(paths.database, PathBuf::from("E:/custom/main.db"));
        assert_eq!(paths.data_dir, PathBuf::from("E:/custom"));
    }

    #[test]
    fn missing_path_value_is_a_clear_error() {
        let error = DataPaths::resolve(args(&["--data-dir"]), PathBuf::from("unused"), None)
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn launcher_specific_arguments_are_ignored() {
        let paths = DataPaths::resolve(
            args(&["--some-tauri-flag", "value", "--data-dir", "D:/data"]),
            PathBuf::from("unused"),
            None,
        )
        .unwrap();
        assert_eq!(paths.database, PathBuf::from("D:/data/SOCDOF.db"));
    }
}
