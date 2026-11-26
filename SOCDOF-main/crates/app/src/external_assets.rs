//! External invoice templates, language packs and flag images.
//!
//! The TypeScript shell keeps these files outside the application bundle so users can add a
//! template or a translation without rebuilding the app. This module resolves the same folders,
//! seeds them once, and exposes the list/read operations the window commands need. Everything here
//! is filesystem-only, so the behaviour is testable without a window.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use socdof_core::date::format_iso8601;
use socdof_core::error::{CoreError, CoreResult};

/// Environment variable overriding the template folder.
pub const TEMPLATES_ENV: &str = "SOCDOF_TEMPLATES_DIR";
/// Environment variable overriding the language folder.
pub const LANGUAGES_ENV: &str = "SOCDOF_LANGUAGES_DIR";
/// Environment variable overriding the flag folder.
pub const FLAGS_ENV: &str = "SOCDOF_FLAGS_DIR";
/// Directory names created inside the application data folder.
pub const TEMPLATES_DIR_NAME: &str = "templates";
/// Language directory name inside the application data folder.
pub const LANGUAGES_DIR_NAME: &str = "languages";
/// Flag directory name inside the application data folder.
pub const FLAGS_DIR_NAME: &str = "flags";

const MAX_TEMPLATE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_LANGUAGE_BYTES: u64 = 1024 * 1024;
const MAX_FLAG_BYTES: u64 = 1024 * 1024;
const TEMPLATE_EXTENSIONS: &[&str] = &["docx", "doc", "pdf", "json", "html", "htm"];
const FLAG_EXTENSIONS: &[&str] = &["svg", "png", "jpg", "jpeg", "webp", "gif"];

const TEMPLATES_README: &str = "\
SOCDOF – externe Rechnungsvorlagen

Lege hier .docx-, .doc-, .pdf-, .json-, .html- oder .htm-Dateien ab.
Die Anwendung listen sie alphabetisch und liest sie als Base64 für den Import.
";

const LANGUAGES_README: &str = "\
SOCDOF – externe Sprachpakete

Lege hier JSON-Dateien ab. Entweder flach (\"action.save\": \"Speichern\") oder
unter \"translations\" mit optionalem \"_metadata\"-Objekt:

{
  \"_metadata\": { \"code\": \"it\", \"name\": \"Italiano\" },
  \"translations\": { \"action.save\": \"Salva\" }
}

Die Sprachcode-Datei (z. B. it.json) überschreibt die eingebauten Pakete.
";

const FLAGS_README: &str = "\
SOCDOF – Sprachflaggen

Lege hier SVG-, PNG-, JPG-, WEBP- oder GIF-Dateien ab, benannt nach dem
Sprachcode (de.svg, en.png, …). Die Sprachliste liefert sie als Data-URL.
";

/// One external template file as the template manager sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalTemplate {
    /// File name including its extension, used as the stable id.
    pub filename: String,
    /// Absolute path of the file.
    pub path: String,
    /// Lower-case extension without the dot.
    pub format: String,
    /// File size in bytes.
    pub size: u64,
    /// Last modification time formatted as ISO-8601 UTC.
    pub updated_at: String,
}

/// A template file read for import, encoded as Base64 like the TypeScript bridge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalTemplateContent {
    /// Whether reading succeeded.
    pub success: bool,
    /// File name that was requested.
    pub filename: String,
    /// Absolute path of the file.
    pub path: String,
    /// Size in bytes, zero on failure.
    pub size: u64,
    /// Lower-case extension without the dot.
    pub format: String,
    /// Base64 payload, empty on failure.
    pub base64: String,
    /// Human readable reason when `success` is false.
    pub error: Option<String>,
}

/// A flag image discovered in the flag folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalFlag {
    /// Lower-case file stem, i.e. the language code.
    pub name: String,
    /// Data URL ready for an `<img src>`.
    pub image: String,
}

/// A language pack discovered in the language folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalLanguage {
    /// Language code derived from `_metadata.code` or the file stem.
    pub code: String,
    /// Display name derived from `_metadata.name` or the code.
    pub name: String,
    /// File name including its extension.
    pub filename: String,
    /// Absolute path of the file.
    pub path: String,
    /// Translations found in the file, without metadata keys.
    pub translations: BTreeMap<String, String>,
    /// Data URL of a matching flag image, if the flag folder has one.
    pub flag_image: Option<String>,
}

/// Lists the template files in `data_dir`.
///
/// The folder is created when missing. Unsupported extensions and directories are skipped, so the
/// result is always safe to show in the manager.
pub fn list_templates(data_dir: &Path) -> CoreResult<Vec<ExternalTemplate>> {
    let dir = templates_dir(data_dir);
    ensure_seed(&dir, TEMPLATES_README)?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(format) = template_extension(&path) else {
            continue;
        };
        let metadata = entry.metadata()?;
        let updated_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|time| format_iso8601(time.as_millis() as i64))
            .unwrap_or_default();
        entries.push(ExternalTemplate {
            filename: file_name(&path)?,
            path: path.to_string_lossy().into_owned(),
            format,
            size: metadata.len(),
            updated_at,
        });
    }
    entries.sort_by(|left, right| {
        left.filename
            .to_lowercase()
            .cmp(&right.filename.to_lowercase())
    });
    Ok(entries)
}

/// Reads one template file as Base64 for the import command.
pub fn read_template(data_dir: &Path, filename: &str) -> ExternalTemplateContent {
    let failure = |error: String| ExternalTemplateContent {
        success: false,
        filename: filename.to_string(),
        path: String::new(),
        size: 0,
        format: String::new(),
        base64: String::new(),
        error: Some(error),
    };
    let Some(path) = safe_child(&templates_dir(data_dir), filename) else {
        return failure("invalid template filename".to_string());
    };
    let Some(format) = template_extension(&path) else {
        return failure("unsupported template format".to_string());
    };
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) => return failure(error.to_string()),
    };
    if !metadata.is_file() {
        return failure("template is not a file".to_string());
    }
    if metadata.len() > MAX_TEMPLATE_BYTES {
        return failure(format!(
            "template is too large ({} bytes, maximum {MAX_TEMPLATE_BYTES})",
            metadata.len()
        ));
    }
    match fs::read(&path) {
        Ok(bytes) => ExternalTemplateContent {
            success: true,
            filename: filename.to_string(),
            path: path.to_string_lossy().into_owned(),
            size: metadata.len(),
            format,
            base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            error: None,
        },
        Err(error) => failure(error.to_string()),
    }
}

/// Lists language packs in the language folder, including their flag images.
pub fn list_languages(data_dir: &Path) -> CoreResult<Vec<ExternalLanguage>> {
    let dir = languages_dir(data_dir);
    ensure_seed(&dir, LANGUAGES_README)?;
    let flags = flag_images(data_dir)?;
    let mut languages = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || !has_extension(&path, "json") {
            continue;
        }
        let metadata = entry.metadata()?;
        if metadata.len() > MAX_LANGUAGE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
            continue;
        };
        let Some((code, name, translations)) = parse_language(&value) else {
            continue;
        };
        let filename = file_name(&path)?;
        let flag_image = flags
            .get(&code.to_lowercase())
            .or_else(|| flags.get(&filename.to_lowercase()))
            .cloned();
        languages.push(ExternalLanguage {
            code,
            name,
            filename,
            path: path.to_string_lossy().into_owned(),
            translations,
            flag_image,
        });
    }
    languages.sort_by(|left, right| left.code.cmp(&right.code));
    Ok(languages)
}

/// Lists every flag image in the flag folder.
pub fn list_flags(data_dir: &Path) -> CoreResult<Vec<ExternalFlag>> {
    let flags = flag_images(data_dir)?;
    let mut result: Vec<ExternalFlag> = Vec::new();
    for (name, image) in flags {
        if name.contains('.') {
            continue;
        }
        result.push(ExternalFlag { name, image });
    }
    result.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(result)
}

/// Writes a language pack file supplied by the user.
///
/// `content` may be a JSON object or a JSON-encoded string containing an object, matching what the
/// TypeScript import accepts. The file is parsed before writing so a broken pack never lands in the
/// folder.
pub fn save_language(
    data_dir: &Path,
    filename: &str,
    content: &str,
) -> CoreResult<ExternalLanguage> {
    let dir = languages_dir(data_dir);
    ensure_seed(&dir, LANGUAGES_README)?;
    let Some(path) = safe_child(&dir, filename) else {
        return Err(CoreError::Validation(
            "invalid language filename".to_string(),
        ));
    };
    if !has_extension(&path, "json") {
        return Err(CoreError::Validation(
            "language file must use the .json extension".to_string(),
        ));
    }
    let value: serde_json::Value = match serde_json::from_str(content) {
        Ok(value) => value,
        Err(_) => serde_json::from_str(content.trim_matches('"'))?,
    };
    let Some((code, name, translations)) = parse_language(&value) else {
        return Err(CoreError::Validation(
            "language file has no translations".to_string(),
        ));
    };
    fs::write(&path, serde_json::to_vec_pretty(&value)?)?;
    Ok(ExternalLanguage {
        code,
        name,
        filename: file_name(&path)?,
        path: path.to_string_lossy().into_owned(),
        translations,
        flag_image: None,
    })
}

/// Opens a folder in the platform file manager.
///
/// Smoke runs set `SOCDOF_SMOKE_NO_OPEN` so the check never launches a desktop process; the
/// returned path is still validated and reported.
pub fn open_folder(path: &Path) -> CoreResult<()> {
    if !path.is_dir() {
        return Err(CoreError::NotFound(path.to_string_lossy().into_owned()));
    }
    if std::env::var_os("SOCDOF_SMOKE_NO_OPEN").is_some() {
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("explorer");
        command.arg(path);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = std::process::Command::new("open");
        command.arg(path);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(path);
        command
    };
    command.spawn()?;
    Ok(())
}

/// Resolves the template folder: explicit environment override, portable folder next to the
/// executable, then the application data directory.
pub fn templates_dir(data_dir: &Path) -> PathBuf {
    resolve_dir(data_dir, TEMPLATES_ENV, TEMPLATES_DIR_NAME)
}

/// Resolves the language folder with the same precedence as [`templates_dir`].
pub fn languages_dir(data_dir: &Path) -> PathBuf {
    resolve_dir(data_dir, LANGUAGES_ENV, LANGUAGES_DIR_NAME)
}

/// Resolves the flag folder with the same precedence as [`templates_dir`].
pub fn flags_dir(data_dir: &Path) -> PathBuf {
    resolve_dir(data_dir, FLAGS_ENV, FLAGS_DIR_NAME)
}

/// Creates all three external folders and their readme files.
pub fn ensure_external_folders(data_dir: &Path) -> CoreResult<()> {
    ensure_seed(&templates_dir(data_dir), TEMPLATES_README)?;
    ensure_seed(&languages_dir(data_dir), LANGUAGES_README)?;
    ensure_seed(&flags_dir(data_dir), FLAGS_README)?;
    Ok(())
}

fn resolve_dir(data_dir: &Path, env_key: &str, name: &str) -> PathBuf {
    if let Some(value) = std::env::var_os(env_key) {
        let path = PathBuf::from(value);
        if path.is_dir() {
            return path;
        }
    }
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            let portable = parent.join(name);
            if portable.is_dir() {
                return portable;
            }
        }
    }
    data_dir.join(name)
}

fn ensure_seed(dir: &Path, readme: &str) -> CoreResult<()> {
    fs::create_dir_all(dir)?;
    let readme_path = dir.join("README.txt");
    if !readme_path.exists() {
        fs::write(readme_path, readme)?;
    }
    Ok(())
}

fn flag_images(data_dir: &Path) -> CoreResult<BTreeMap<String, String>> {
    let dir = flags_dir(data_dir);
    ensure_seed(&dir, FLAGS_README)?;
    let mut flags = BTreeMap::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(extension) = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
        else {
            continue;
        };
        if !FLAG_EXTENSIONS.contains(&extension.as_str()) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.len() > MAX_FLAG_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        let mime = match extension.as_str() {
            "svg" => "image/svg+xml",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            _ => continue,
        };
        flags.insert(
            stem.to_lowercase(),
            format!(
                "data:{mime};base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            ),
        );
        flags.insert(
            file_name(&path)?.to_lowercase(),
            flags[&stem.to_lowercase()].clone(),
        );
    }
    Ok(flags)
}

fn parse_language(value: &serde_json::Value) -> Option<(String, String, BTreeMap<String, String>)> {
    let object = value.as_object()?;
    let metadata = object.get("_metadata").and_then(|value| value.as_object());
    let translations_object = object
        .get("translations")
        .and_then(|value| value.as_object())
        .unwrap_or(object);
    let mut translations = BTreeMap::new();
    for (key, value) in translations_object {
        if key.starts_with('_') || key == "translations" {
            continue;
        }
        if let Some(text) = value.as_str() {
            translations.insert(key.clone(), text.to_string());
        }
    }
    if translations.is_empty() {
        return None;
    }
    let code = metadata
        .and_then(|metadata| metadata.get("code"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let name = metadata
        .and_then(|metadata| metadata.get("name"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let code = if code.is_empty() {
        "custom".to_string()
    } else {
        code
    };
    let name = if name.is_empty() { code.clone() } else { name };
    Some((code, name, translations))
}

fn safe_child(dir: &Path, filename: &str) -> Option<PathBuf> {
    if filename.is_empty()
        || filename.contains('/')
        || filename.contains('\\')
        || filename == "."
        || filename == ".."
    {
        return None;
    }
    Some(dir.join(filename))
}

fn template_extension(path: &Path) -> Option<String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();
    TEMPLATE_EXTENSIONS
        .contains(&extension.as_str())
        .then_some(extension)
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

fn file_name(path: &Path) -> CoreResult<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .ok_or_else(|| CoreError::Validation("path has no file name".to_string()))
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU32, Ordering};

    use super::*;

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "socdof-external-{tag}-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn external_folders_seed_list_and_read_templates() {
        let dir = temp_dir("templates");
        ensure_external_folders(&dir).expect("folders are seeded");
        assert!(templates_dir(&dir).join("README.txt").is_file());
        assert!(languages_dir(&dir).join("README.txt").is_file());
        assert!(flags_dir(&dir).join("README.txt").is_file());

        fs::write(templates_dir(&dir).join("rechnung.docx"), b"PK\x03\x04").expect("write");
        fs::write(templates_dir(&dir).join("brief.html"), b"<p>Hallo</p>").expect("write");
        fs::write(templates_dir(&dir).join("ignored.exe"), b"no").expect("write");

        let templates = list_templates(&dir).expect("templates");
        assert_eq!(
            templates
                .iter()
                .map(|template| template.filename.as_str())
                .collect::<Vec<_>>(),
            vec!["brief.html", "rechnung.docx"]
        );
        assert_eq!(templates[1].format, "docx");
        assert!(!templates[1].updated_at.is_empty());

        let content = read_template(&dir, "rechnung.docx");
        assert!(content.success);
        assert_eq!(content.base64, "UEsDBA==");
        assert_eq!(content.size, 4);
        assert!(content.error.is_none());

        let missing = read_template(&dir, "missing.docx");
        assert!(!missing.success);
        assert!(missing.error.is_some());
        assert!(read_template(&dir, "../secret.docx").error.is_some());
        assert!(read_template(&dir, "ignored.exe").error.is_some());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn external_languages_parse_flat_and_nested_packs_with_flags() {
        let dir = temp_dir("languages");
        ensure_external_folders(&dir).expect("folders are seeded");

        fs::write(
            languages_dir(&dir).join("it.json"),
            r#"{"_metadata":{"code":"it","name":"Italiano"},"translations":{"action.save":"Salva","action.cancel":"Annulla"}}"#,
        )
        .expect("write");
        fs::write(
            languages_dir(&dir).join("flat.json"),
            r#"{"_metadata":{"code":"nl"},"action.save":"Opslaan"}"#,
        )
        .expect("write");
        fs::write(languages_dir(&dir).join("broken.json"), "{nope").expect("write");
        fs::write(flags_dir(&dir).join("it.svg"), "<svg/>").expect("write");

        let languages = list_languages(&dir).expect("languages");
        assert_eq!(languages.len(), 2);
        assert_eq!(languages[0].code, "it");
        assert_eq!(languages[0].name, "Italiano");
        assert_eq!(
            languages[0]
                .translations
                .get("action.save")
                .map(String::as_str),
            Some("Salva")
        );
        assert!(languages[0]
            .flag_image
            .as_deref()
            .is_some_and(|value| value.starts_with("data:image/svg+xml;base64,")));
        assert_eq!(languages[1].code, "nl");
        assert_eq!(languages[1].name, "nl");
        let flags = list_flags(&dir).expect("flags");
        assert_eq!(flags.len(), 1);
        assert_eq!(flags[0].name, "it");
        assert!(flags[0].image.starts_with("data:image/svg+xml;base64,"));

        let saved = save_language(
            &dir,
            "fr.json",
            r#"{"_metadata":{"code":"fr","name":"Français"},"action.save":"Enregistrer"}"#,
        )
        .expect("language is saved");
        assert_eq!(saved.code, "fr");
        assert!(languages_dir(&dir).join("fr.json").is_file());
        assert!(save_language(&dir, "../evil.json", "{}").is_err());
        assert!(save_language(&dir, "bad.json", "{}").is_err());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn external_assets_validate_open_folder_and_path_overrides() {
        let dir = temp_dir("paths");
        ensure_external_folders(&dir).expect("folders are seeded");
        std::env::set_var("SOCDOF_SMOKE_NO_OPEN", "1");
        assert!(open_folder(&templates_dir(&dir)).is_ok());
        std::env::remove_var("SOCDOF_SMOKE_NO_OPEN");
        assert!(open_folder(&dir.join("missing")).is_err());
        assert_eq!(templates_dir(&dir), dir.join("templates"));
        assert_eq!(languages_dir(&dir), dir.join("languages"));
        assert_eq!(flags_dir(&dir), dir.join("flags"));
        let _ = fs::remove_dir_all(dir);
    }
}
