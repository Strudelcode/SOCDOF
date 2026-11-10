//! Release feed checks and the update channel with rollback.
//!
//! `check` compares the running version against a release document (the GitHub release shape or the
//! smaller `latest.json`), `Channel` keeps the staged artifacts of the update channel and can return
//! to the previous version. Both are UI-free so the desktop shell and `socdof-cli` share them.

use std::cmp::Ordering;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};

/// One release as published in the feed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReleaseInfo {
    /// Version without the `v` prefix, e.g. `0.31.0`.
    pub version: String,
    /// Release page or download URL.
    pub url: String,
    /// Release notes, empty when the feed carries none.
    pub notes: String,
    /// Publication timestamp as the feed reports it, empty when absent.
    pub published_at: String,
}

/// Outcome of comparing the running version against the feed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateCheck {
    /// Version that is running.
    pub current: String,
    /// Newest release in the feed.
    pub latest: ReleaseInfo,
    /// Whether `latest` is newer than `current`.
    pub update_available: bool,
}

/// Reads the release document of a GitHub release or of the updater manifest.
pub fn parse_feed(json: &str) -> CoreResult<ReleaseInfo> {
    let value: serde_json::Value = serde_json::from_str(json)
        .map_err(|_| CoreError::Validation("update_feed_invalid".to_string()))?;

    let version = value
        .get("version")
        .or_else(|| value.get("tag_name"))
        .and_then(|item| item.as_str())
        .map(|text| text.trim().trim_start_matches(['v', 'V']).to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| CoreError::Validation("update_feed_missing_version".to_string()))?;

    let url = value
        .get("html_url")
        .or_else(|| value.get("url"))
        .and_then(|item| item.as_str())
        .map(str::to_string)
        .or_else(|| {
            // The updater manifest nests the download under `platforms.<target>.url`.
            value
                .get("platforms")
                .and_then(|platforms| platforms.as_object())
                .and_then(|platforms| platforms.values().next())
                .and_then(|platform| platform.get("url"))
                .and_then(|item| item.as_str())
                .map(str::to_string)
        })
        .unwrap_or_default();

    let notes = value
        .get("body")
        .or_else(|| value.get("notes"))
        .and_then(|item| item.as_str())
        .unwrap_or_default()
        .to_string();

    let published_at = value
        .get("published_at")
        .or_else(|| value.get("pub_date"))
        .and_then(|item| item.as_str())
        .unwrap_or_default()
        .to_string();

    Ok(ReleaseInfo {
        version,
        url,
        notes,
        published_at,
    })
}

/// Compares the running version against a feed document.
pub fn check(current: &str, feed_json: &str) -> CoreResult<UpdateCheck> {
    let current = current.trim().trim_start_matches(['v', 'V']).to_string();
    let latest = parse_feed(feed_json)?;
    let update_available = compare_versions(&latest.version, &current) == Ordering::Greater;
    Ok(UpdateCheck {
        current,
        latest,
        update_available,
    })
}

/// Compares two versions by their numeric parts; a release sorts above its pre-release.
pub fn compare_versions(left: &str, right: &str) -> Ordering {
    fn split(value: &str) -> (Vec<u64>, bool) {
        let trimmed = value.trim().trim_start_matches(['v', 'V']);
        let (numbers, pre_release) = match trimmed.split_once('-') {
            Some((numbers, suffix)) => (numbers, !suffix.is_empty()),
            None => (trimmed, false),
        };
        let parts = numbers
            .split('.')
            .map(|part| {
                part.chars()
                    .take_while(char::is_ascii_digit)
                    .collect::<String>()
                    .parse::<u64>()
                    .unwrap_or(0)
            })
            .collect();
        (parts, pre_release)
    }

    let (left_parts, left_pre) = split(left);
    let (right_parts, right_pre) = split(right);
    for index in 0..left_parts.len().max(right_parts.len()) {
        let a = left_parts.get(index).copied().unwrap_or(0);
        let b = right_parts.get(index).copied().unwrap_or(0);
        if a != b {
            return a.cmp(&b);
        }
    }
    match (left_pre, right_pre) {
        (false, true) => Ordering::Greater,
        (true, false) => Ordering::Less,
        _ => Ordering::Equal,
    }
}

/// Serialises any of the results above for the CLI.
pub fn to_json<T: Serialize>(value: &T) -> CoreResult<String> {
    Ok(serde_json::to_string_pretty(value)?)
}

/// A staged artifact of the update channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Staged {
    /// Version the artifact belongs to.
    pub version: String,
    /// Stored copy of the artifact.
    pub artifact: PathBuf,
    /// When it was staged, in milliseconds since the Unix epoch.
    pub staged_at: i64,
    /// Size of the stored artifact in bytes.
    pub size: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Journal {
    staged: Vec<Staged>,
}

/// Update channel directory: staged artifacts plus the journal that makes a rollback possible.
#[derive(Debug, Clone)]
pub struct Channel {
    dir: PathBuf,
}

impl Channel {
    /// Uses `dir` as the channel directory; created on the first write.
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Channel { dir: dir.into() }
    }

    fn journal_path(&self) -> PathBuf {
        self.dir.join("channel.json")
    }

    fn read(&self) -> CoreResult<Journal> {
        match std::fs::read_to_string(self.journal_path()) {
            Ok(text) => serde_json::from_str(&text)
                .map_err(|_| CoreError::Validation("update_channel_corrupt".to_string())),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Journal::default()),
            Err(error) => Err(CoreError::Io(error)),
        }
    }

    fn write(&self, journal: &Journal) -> CoreResult<()> {
        std::fs::create_dir_all(&self.dir)?;
        let text = serde_json::to_string_pretty(journal)?;
        let temporary = self.journal_path().with_extension("json.tmp");
        std::fs::write(&temporary, text)?;
        std::fs::rename(&temporary, self.journal_path())?;
        Ok(())
    }

    /// Copies `artifact` into the channel and makes it the installed version.
    ///
    /// An empty or missing artifact is rejected and leaves the channel untouched, which is how an
    /// interrupted download is handled.
    pub fn stage(&self, version: &str, artifact: &Path, now: i64) -> CoreResult<Staged> {
        let version = version.trim().trim_start_matches(['v', 'V']).to_string();
        if version.is_empty() {
            return Err(CoreError::Validation("update_version_missing".to_string()));
        }
        let size = match std::fs::metadata(artifact) {
            Ok(metadata) => metadata.len(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(CoreError::Validation("update_artifact_missing".to_string()))
            }
            Err(error) => return Err(CoreError::Io(error)),
        };
        if size == 0 {
            return Err(CoreError::Validation("update_artifact_empty".to_string()));
        }

        let name = artifact
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .ok_or_else(|| CoreError::Validation("update_artifact_missing".to_string()))?;
        let store = self.dir.join("artifacts");
        std::fs::create_dir_all(&store)?;
        let target = store.join(format!("{version}-{name}"));
        std::fs::copy(artifact, &target)?;

        let mut journal = self.read()?;
        journal.staged.retain(|entry| entry.version != version);
        let staged = Staged {
            version,
            artifact: target,
            staged_at: now,
            size,
        };
        journal.staged.push(staged.clone());
        self.write(&journal)?;
        Ok(staged)
    }

    /// Installed version, `None` for an empty channel.
    pub fn current(&self) -> CoreResult<Option<Staged>> {
        Ok(self.read()?.staged.last().cloned())
    }

    /// Staged versions, newest first.
    pub fn history(&self) -> CoreResult<Vec<Staged>> {
        Ok(self.read()?.staged.iter().rev().cloned().collect())
    }

    /// Returns to the previously staged version and makes it current again.
    pub fn rollback(&self) -> CoreResult<Staged> {
        let mut journal = self.read()?;
        if journal.staged.len() < 2 {
            return Err(CoreError::Validation("update_no_previous".to_string()));
        }
        let previous = journal.staged[journal.staged.len() - 2].clone();
        if !previous.artifact.exists() {
            return Err(CoreError::Validation("update_artifact_missing".to_string()));
        }
        journal.staged.truncate(journal.staged.len() - 1);
        self.write(&journal)?;
        Ok(previous)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-updates-{tag}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn reads_a_github_release_document() {
        let json = r#"{"tag_name":"v0.31.0","html_url":"https://example.invalid/r","body":"notes","published_at":"2026-11-10T00:00:00Z"}"#;
        let release = parse_feed(json).expect("feed");
        assert_eq!(release.version, "0.31.0");
        assert_eq!(release.url, "https://example.invalid/r");
        assert_eq!(release.notes, "notes");
        assert_eq!(release.published_at, "2026-11-10T00:00:00Z");
    }

    #[test]
    fn reads_the_updater_manifest_shape() {
        let json = r#"{"version":"0.31.0","platforms":{"linux-x86_64":{"url":"https://example.invalid/a.AppImage"}}}"#;
        let release = parse_feed(json).expect("manifest");
        assert_eq!(release.version, "0.31.0");
        assert_eq!(release.url, "https://example.invalid/a.AppImage");
    }

    #[test]
    fn rejects_a_feed_without_a_version() {
        let error =
            parse_feed(r#"{"html_url":"https://example.invalid"}"#).expect_err("no version");
        assert!(
            matches!(error, CoreError::Validation(code) if code == "update_feed_missing_version")
        );
        let error = parse_feed("not json").expect_err("broken");
        assert!(matches!(error, CoreError::Validation(code) if code == "update_feed_invalid"));
    }

    #[test]
    fn compares_versions_by_number_and_pre_release() {
        assert_eq!(compare_versions("0.31.0", "0.30.0"), Ordering::Greater);
        assert_eq!(compare_versions("v0.31.0", "0.31"), Ordering::Equal);
        assert_eq!(compare_versions("0.30.9", "0.31.0"), Ordering::Less);
        assert_eq!(compare_versions("1.0.0", "0.99.99"), Ordering::Greater);
        assert_eq!(compare_versions("0.31.0-beta.1", "0.31.0"), Ordering::Less);
        assert_eq!(
            compare_versions("0.31.0", "0.31.0-beta.1"),
            Ordering::Greater
        );
    }

    #[test]
    fn reports_an_available_update_and_a_current_build() {
        let json = r#"{"tag_name":"v0.31.0","html_url":"https://example.invalid"}"#;
        let available = check("0.30.0", json).expect("check");
        assert!(available.update_available);
        assert_eq!(available.current, "0.30.0");
        assert_eq!(available.latest.version, "0.31.0");

        let up_to_date = check("0.31.0", json).expect("check");
        assert!(!up_to_date.update_available);
        assert!(to_json(&up_to_date)
            .expect("json")
            .contains("\"update_available\": false"));
    }

    #[test]
    fn stages_updates_and_rolls_back_to_the_previous_version() {
        let dir = temp_dir("channel");
        let channel = Channel::new(dir.join("channel"));
        std::fs::write(dir.join("a.bin"), vec![1u8; 32]).expect("artifact a");
        std::fs::write(dir.join("b.bin"), vec![2u8; 64]).expect("artifact b");

        assert_eq!(channel.current().expect("empty"), None);
        channel
            .stage("0.30.0", &dir.join("a.bin"), 1_000)
            .expect("stage a");
        channel
            .stage("0.31.0", &dir.join("b.bin"), 2_000)
            .expect("stage b");

        let current = channel.current().expect("current").expect("some");
        assert_eq!(current.version, "0.31.0");
        assert_eq!(current.size, 64);
        assert_eq!(channel.history().expect("history").len(), 2);

        let rolled_back = channel.rollback().expect("rollback");
        assert_eq!(rolled_back.version, "0.30.0");
        assert_eq!(
            channel.current().expect("current").expect("some").version,
            "0.30.0"
        );
        assert_eq!(channel.history().expect("history").len(), 1);

        // A second rollback has nothing left to go back to and must not change the state.
        let error = channel.rollback().expect_err("no previous");
        assert!(matches!(error, CoreError::Validation(code) if code == "update_no_previous"));
        assert_eq!(
            channel.current().expect("current").expect("some").version,
            "0.30.0"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_an_empty_artifact_without_touching_the_channel() {
        let dir = temp_dir("interrupted");
        let channel = Channel::new(dir.join("channel"));
        std::fs::write(dir.join("a.bin"), vec![1u8; 16]).expect("artifact a");
        channel
            .stage("0.30.0", &dir.join("a.bin"), 1_000)
            .expect("stage a");

        std::fs::write(dir.join("broken.bin"), b"").expect("empty artifact");
        let error = channel
            .stage("0.31.0", &dir.join("broken.bin"), 2_000)
            .expect_err("empty");
        assert!(matches!(error, CoreError::Validation(code) if code == "update_artifact_empty"));
        assert_eq!(
            channel.current().expect("current").expect("some").version,
            "0.30.0"
        );

        let error = channel
            .stage("0.31.0", &dir.join("missing.bin"), 2_000)
            .expect_err("missing");
        assert!(matches!(error, CoreError::Validation(code) if code == "update_artifact_missing"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rollback_fails_when_the_previous_artifact_is_gone() {
        let dir = temp_dir("lost");
        let channel = Channel::new(dir.join("channel"));
        std::fs::write(dir.join("a.bin"), vec![1u8; 16]).expect("artifact a");
        std::fs::write(dir.join("b.bin"), vec![2u8; 16]).expect("artifact b");
        let a = channel
            .stage("0.30.0", &dir.join("a.bin"), 1_000)
            .expect("stage a");
        channel
            .stage("0.31.0", &dir.join("b.bin"), 2_000)
            .expect("stage b");

        std::fs::remove_file(&a.artifact).expect("remove previous artifact");
        let error = channel.rollback().expect_err("missing artifact");
        assert!(matches!(error, CoreError::Validation(code) if code == "update_artifact_missing"));
        assert_eq!(
            channel.current().expect("current").expect("some").version,
            "0.31.0",
            "a failed rollback keeps the installed version"
        );

        let _ = std::fs::remove_dir_all(dir);
    }
}
