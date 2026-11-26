//! Native dialog requests and their validated results.
//!
//! The window layer opens the platform picker; what counts as a usable answer is decided here, so
//! folder picker, open dialog, save dialog and message box share one validation path that runs
//! without any GUI.

use std::path::{Path, PathBuf};

/// Which platform dialog is requested.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DialogKind {
    /// Folder picker, for a backup target or an export directory.
    Folder,
    /// Open dialog, optionally restricted to file extensions.
    OpenFile {
        /// Allowed extensions without the dot; empty means any file.
        extensions: Vec<String>,
    },
    /// Save dialog with a proposed file name.
    SaveFile {
        /// Name the dialog proposes.
        suggested_name: String,
    },
    /// Message box with a single acknowledgement.
    Message,
}

impl DialogKind {
    /// Stable name used in the `SOCDOF_DIALOG` smoke markers.
    pub fn as_str(&self) -> &'static str {
        match self {
            DialogKind::Folder => "folder",
            DialogKind::OpenFile { .. } => "open_file",
            DialogKind::SaveFile { .. } => "save_file",
            DialogKind::Message => "message",
        }
    }

    /// Proposed file name of a save dialog.
    pub fn suggested_name(&self) -> Option<&str> {
        match self {
            DialogKind::SaveFile { suggested_name } => Some(suggested_name),
            _ => None,
        }
    }

    /// Allowed extensions of an open dialog.
    pub fn extensions(&self) -> &[String] {
        match self {
            DialogKind::OpenFile { extensions } => extensions,
            _ => &[],
        }
    }
}

/// What the caller acts on after the dialog closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DialogOutcome {
    /// A path was chosen and passed validation.
    Path(PathBuf),
    /// The message box was closed.
    Acknowledged,
    /// The user cancelled or closed the dialog.
    Cancelled,
    /// A yes/no confirmation was accepted.
    Confirmed,
    /// A yes/no confirmation was declined.
    Declined,
}

/// Why a selection cannot be used.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DialogError {
    /// The chosen path does not exist.
    Missing,
    /// The dialog returned an empty path.
    EmptyPath,
    /// A folder was expected, but the path is a file.
    NotADirectory,
    /// A file was expected, but the path is a directory.
    NotAFile,
    /// The extension is not in the allowed list.
    ExtensionNotAllowed {
        /// Extensions the dialog allowed.
        allowed: Vec<String>,
    },
    /// The parent folder of a save target does not exist.
    ParentMissing,
}

impl DialogError {
    /// Stable code for the marker and for the translated UI text.
    pub fn as_str(&self) -> &'static str {
        match self {
            DialogError::Missing => "missing",
            DialogError::EmptyPath => "empty_path",
            DialogError::NotADirectory => "not_a_directory",
            DialogError::NotAFile => "not_a_file",
            DialogError::ExtensionNotAllowed { .. } => "extension_not_allowed",
            DialogError::ParentMissing => "parent_missing",
        }
    }
}

/// Whether `path` carries one of `extensions` (case-insensitive).
fn extension_allowed(path: &Path, extensions: &[String]) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return extensions.is_empty();
    };
    extensions
        .iter()
        .any(|allowed| allowed.eq_ignore_ascii_case(extension))
}

/// Validates the dialog result.
///
/// `None` means the user cancelled; a message box never returns a path. Everything else is checked
/// against the requested kind, so a caller never has to test the path itself.
pub fn resolve(
    kind: &DialogKind,
    selection: Option<PathBuf>,
) -> Result<DialogOutcome, DialogError> {
    if matches!(kind, DialogKind::Message) {
        return Ok(DialogOutcome::Acknowledged);
    }
    let Some(path) = selection else {
        return Ok(DialogOutcome::Cancelled);
    };
    if path.as_os_str().is_empty() {
        return Err(DialogError::EmptyPath);
    }
    match kind {
        DialogKind::Message => Ok(DialogOutcome::Acknowledged),
        DialogKind::Folder => {
            if path.is_dir() {
                Ok(DialogOutcome::Path(path))
            } else if path.exists() {
                Err(DialogError::NotADirectory)
            } else {
                Err(DialogError::Missing)
            }
        }
        DialogKind::OpenFile { extensions } => {
            if !path.exists() {
                Err(DialogError::Missing)
            } else if !path.is_file() {
                Err(DialogError::NotAFile)
            } else if !extension_allowed(&path, extensions) {
                Err(DialogError::ExtensionNotAllowed {
                    allowed: extensions.clone(),
                })
            } else {
                Ok(DialogOutcome::Path(path))
            }
        }
        DialogKind::SaveFile { .. } => match path.parent() {
            None => Err(DialogError::ParentMissing),
            Some(parent) if parent.as_os_str().is_empty() => Ok(DialogOutcome::Path(path)),
            Some(parent) if parent.is_dir() => Ok(DialogOutcome::Path(path)),
            Some(_) => Err(DialogError::ParentMissing),
        },
    }
}

/// Resolves the answer of a native yes/no confirmation.
///
/// `None` means the box was closed without an answer; `Some(true)` is the yes button. This is the
/// only decision the caller sees, exactly like `confirm()` in the TypeScript webview.
pub fn resolve_confirm(answer: Option<bool>) -> DialogOutcome {
    match answer {
        Some(true) => DialogOutcome::Confirmed,
        Some(false) => DialogOutcome::Declined,
        None => DialogOutcome::Cancelled,
    }
}

/// Smoke marker for a dialog result, e.g.
/// `SOCDOF_DIALOG kind=folder outcome=chosen path=/tmp/x`.
pub fn marker(kind: &DialogKind, outcome: &Result<DialogOutcome, DialogError>) -> String {
    match outcome {
        Ok(DialogOutcome::Path(path)) => format!(
            "SOCDOF_DIALOG kind={} outcome=chosen path={}",
            kind.as_str(),
            path.display()
        ),
        Ok(DialogOutcome::Acknowledged) => {
            format!("SOCDOF_DIALOG kind={} outcome=acknowledged", kind.as_str())
        }
        Ok(DialogOutcome::Cancelled) => {
            format!("SOCDOF_DIALOG kind={} outcome=cancelled", kind.as_str())
        }
        Ok(DialogOutcome::Confirmed) => {
            format!("SOCDOF_DIALOG kind={} outcome=confirmed", kind.as_str())
        }
        Ok(DialogOutcome::Declined) => {
            format!("SOCDOF_DIALOG kind={} outcome=declined", kind.as_str())
        }
        Err(error) => format!(
            "SOCDOF_DIALOG kind={} outcome=error reason={}",
            kind.as_str(),
            error.as_str()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-dialogs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    #[test]
    fn an_existing_folder_is_accepted() {
        let dir = scratch();
        let outcome = resolve(&DialogKind::Folder, Some(dir.clone()));
        assert_eq!(outcome, Ok(DialogOutcome::Path(dir.clone())));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn cancelling_returns_cancelled_for_every_dialog() {
        assert_eq!(
            resolve(&DialogKind::Folder, None),
            Ok(DialogOutcome::Cancelled)
        );
        assert_eq!(
            resolve(
                &DialogKind::OpenFile {
                    extensions: vec!["json".to_string()]
                },
                None
            ),
            Ok(DialogOutcome::Cancelled)
        );
        assert_eq!(
            resolve(
                &DialogKind::SaveFile {
                    suggested_name: "backup.socdofbak".to_string()
                },
                None
            ),
            Ok(DialogOutcome::Cancelled)
        );
    }

    #[test]
    fn a_file_is_rejected_by_the_folder_picker() {
        let dir = scratch();
        let file = dir.join("notes.txt");
        std::fs::write(&file, "x").expect("write");
        assert_eq!(
            resolve(&DialogKind::Folder, Some(file)),
            Err(DialogError::NotADirectory)
        );
        assert_eq!(
            resolve(&DialogKind::Folder, Some(dir.join("gone"))),
            Err(DialogError::Missing)
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_open_dialog_enforces_its_extensions() {
        let dir = scratch();
        let good = dir.join("backup.json");
        let bad = dir.join("backup.txt");
        std::fs::write(&good, "{}").expect("write");
        std::fs::write(&bad, "x").expect("write");
        let kind = DialogKind::OpenFile {
            extensions: vec!["JSON".to_string()],
        };
        assert_eq!(
            resolve(&kind, Some(good.clone())),
            Ok(DialogOutcome::Path(good))
        );
        assert_eq!(
            resolve(&kind, Some(bad)),
            Err(DialogError::ExtensionNotAllowed {
                allowed: vec!["JSON".to_string()]
            })
        );
        assert_eq!(
            resolve(&kind, Some(dir.clone())),
            Err(DialogError::NotAFile)
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_save_dialog_accepts_a_new_name_in_an_existing_folder() {
        let dir = scratch();
        let target = dir.join("backup.socdofbak");
        let kind = DialogKind::SaveFile {
            suggested_name: "backup.socdofbak".to_string(),
        };
        assert_eq!(
            resolve(&kind, Some(target.clone())),
            Ok(DialogOutcome::Path(target))
        );
        assert_eq!(
            resolve(&kind, Some(dir.join("missing").join("backup.socdofbak"))),
            Err(DialogError::ParentMissing)
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_confirmation_returns_yes_no_or_cancelled() {
        assert_eq!(resolve_confirm(Some(true)), DialogOutcome::Confirmed);
        assert_eq!(resolve_confirm(Some(false)), DialogOutcome::Declined);
        assert_eq!(resolve_confirm(None), DialogOutcome::Cancelled);
    }

    #[test]
    fn a_message_box_has_no_path_and_markers_are_stable() {
        assert_eq!(
            resolve(&DialogKind::Message, Some(PathBuf::from("/ignored"))),
            Ok(DialogOutcome::Acknowledged)
        );
        let chosen = resolve(&DialogKind::Folder, Some(PathBuf::from("/tmp")));
        assert_eq!(
            marker(&DialogKind::Folder, &chosen),
            "SOCDOF_DIALOG kind=folder outcome=chosen path=/tmp"
        );
        let cancelled = resolve(&DialogKind::Folder, None);
        assert_eq!(
            marker(&DialogKind::Folder, &cancelled),
            "SOCDOF_DIALOG kind=folder outcome=cancelled"
        );
        assert_eq!(DialogKind::Message.suggested_name(), None);
        assert_eq!(DialogKind::Message.extensions(), [] as [String; 0]);
    }
}
