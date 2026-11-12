//! Settings screen of the Tauri webview.
//!
//! The screen edits the active [`CompanyProfile`] and manages the backup folder through the same
//! Tauri commands as the desktop shell. No business validation is duplicated here; the core rejects
//! invalid values and the command error is shown verbatim.

import { settingsIcon } from "./settings_icons";
import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";
import { applyTheme, setTaskbarCompany } from "./theme";
import { SETTINGS_TEXT } from "./settings_text";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const settingsText = SETTINGS_TEXT[language];

interface DialogReply {
  outcome: "chosen" | "cancelled" | "acknowledged" | "error";
  path: string | null;
  error: string | null;
}

interface BackupReport {
  path: string;
  bytes: number;
  database_bytes: number;
  schema_version: number;
  created_at: number;
}

interface BackupFileView {
  path: string;
  created_at: number;
  schema_version: number;
  bytes: number;
}

interface BackupMetadataView {
  format_version: number;
  created_at: number;
  schema_version: number;
  app_version: string;
}

interface RestoreReportView {
  kind: string;
  created_at: number;
  schema_version: number;
  imported_records: number | null;
}

interface StorageInspectorView {
  database: string;
  database_bytes: number;
  schema_version: number;
  backup_folder: string;
  counts: { name: string; rows: number }[];
}

interface AppStoreModuleView {
  id: string;
  name_key: string;
  description_key: string;
  version: string;
  license: "included" | "trial" | "locked";
  required: boolean;
  active: boolean;
  can_toggle: boolean;
}

type ProfileRecord = Record<string, unknown>;

let currentProfile: ProfileRecord | null = null;
let restorePath = "";
let appStoreModules: AppStoreModuleView[] = [];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

function inputValue(id: string): string {
  return byId<HTMLInputElement>(id).value.trim();
}

function setValue(id: string, value: unknown): void {
  byId<HTMLInputElement>(id).value = typeof value === "string" ? value : "";
}

function setMessage(text: string, kind: "ok" | "error" = "ok"): void {
  const message = byId<HTMLElement>("settings-message");
  message.textContent = text;
  message.dataset.kind = kind;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} ${t("settingsByteUnit")}`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} ${t("settingsKilobyteUnit")}`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("settingsMegabyteUnit")}`;
}

function formatDate(millis: number): string {
  if (!millis) {
    return t("settingsNotAvailable");
  }
  return new Date(millis).toLocaleString(language);
}

export function initSettings(): void {
  const view = byId<HTMLElement>("view-settings");
  view.innerHTML = `
    <div class="settings-topbar">
      <div class="settings-breadcrumb">
        <span class="page-badge settings" aria-hidden="true">⚙</span>
        <span>SOCDOF ${t("settingsTitle")}</span>
        <span class="settings-breadcrumb-sep">/</span>
        <strong>${t("settingsNavHome")}</strong>
      </div>
      <label class="settings-search">
        <span aria-hidden="true">⌕</span>
        <input id="settings-search" type="search" placeholder="${t("settingsSearch")}">
      </label>
    </div>
    <div class="settings-shell">
      <aside class="settings-sidebar">
        <button type="button" class="settings-nav is-active" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("settings")}</span><span>${settingsText.home}</span></button>
        <p class="settings-nav-label">${settingsText.displayGroup}</p>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("monitor")}</span><span>${settingsText.screens}</span></button>
        <p class="settings-nav-label">${settingsText.companyGroup}</p>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("building-2")}</span><span>${settingsText.general}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("credit-card")}</span><span>${settingsText.payments}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("file-text")}</span><span>${settingsText.letterhead}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("link-2")}</span><span>${settingsText.connections}</span></button>
        <p class="settings-nav-label">${settingsText.systemGroup}</p>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("palette")}</span><span>${settingsText.personalization}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("globe")}</span><span>${settingsText.language}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("keyboard")}</span><span>${settingsText.shortcuts}</span></button>
        <button type="button" class="settings-nav" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("volume-2")}</span><span>${settingsText.sound}</span></button>
        <p class="settings-nav-label">${settingsText.accountsGroup}</p>
        <button type="button" class="settings-nav settings-nav-account" data-settings-target="settings-card-profile"><span class="settings-nav-icon">${settingsIcon("circle-user")}</span><span>${settingsText.account}</span><span class="settings-nav-badge">${settingsText.admin}</span></button>
      </aside>
      <div class="settings-content">
        <section class="settings-hero">
          <div class="settings-avatar" id="settings-avatar">S</div>
          <div class="settings-hero-copy">
            <p class="settings-kicker">${t("settingsOverviewLabel")}</p>
            <h2 id="settings-hero-name">${t("settingsTitle")}</h2>
            <p id="settings-hero-email"></p>
            <div class="settings-badges">
              <span class="settings-badge success">● ${t("settingsOfflineBadge")}</span>
              <span class="settings-badge">${t("settingsDinBadge")}</span>
            </div>
          </div>
          <button type="button" class="settings-hero-action" data-settings-target="settings-card-profile">${settingsIcon("sliders")} ${t("settingsAdjustProfile")} ${settingsIcon("chevron-right")}</button>
        </section>
        <section class="settings-quick">
          <h3>${settingsIcon("sparkles")} <span>${t("settingsQuickTitle")}</span></h3>
          <p>${t("settingsQuickHint")}</p>
          <div class="settings-quick-grid">
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-profile"><span class="quick-icon violet">${settingsIcon("palette")}</span><span><strong>${t("settingsQuickTheme")}</strong><small>${settingsText.quickPersonalization}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-profile"><span class="quick-icon amber">${settingsIcon("keyboard")}</span><span><strong>${t("settingsQuickShortcuts")}</strong><small>${settingsText.quickShortcuts}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-profile"><span class="quick-icon blue">${settingsIcon("globe")}</span><span><strong>${t("settingsQuickLanguage")}</strong><small>${settingsText.quickLanguage}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-storage"><span class="quick-icon amber">${settingsIcon("calendar")}</span><span><strong>${t("settingsQuickCalendar")}</strong><small>${settingsText.quickCalendar}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-profile"><span class="quick-icon violet">${settingsIcon("file-text")}</span><span><strong>${t("settingsQuickLetterhead")}</strong><small>${settingsText.quickLetterhead}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
            <button type="button" class="settings-quick-card" data-settings-target="settings-card-profile"><span class="quick-icon amber">${settingsIcon("credit-card")}</span><span><strong>${t("settingsQuickBank")}</strong><small>${settingsText.quickBank}</small></span><span class="settings-quick-chevron">${settingsIcon("chevron-right")}</span></button>
          </div>
        </section>
        <div class="grid settings-grid">
      <section class="card" id="settings-card-profile">
        <h3>${t("settingsProfile")}</h3>
        <form id="settings-profile-form" class="stack">
          <label class="field"><span>${t("settingsCompanyName")}</span><input id="settings-name" required></label>
          <div class="grid compact">
            <label class="field"><span>${t("settingsStreet")}</span><input id="settings-street"></label>
            <label class="field"><span>${t("settingsZipCity")}</span><input id="settings-zip-city"></label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("settingsCountry")}</span><input id="settings-country"></label>
            <label class="field"><span>${t("settingsCurrency")}</span><input id="settings-currency" maxlength="3"></label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("settingsEmail")}</span><input id="settings-email" type="email"></label>
            <label class="field"><span>${t("settingsPhone")}</span><input id="settings-phone"></label>
          </div>
          <label class="field"><span>${t("settingsTaxId")}</span><input id="settings-tax-id"></label>
          <fieldset class="display-settings">
            <legend>${t("settingsDisplay")}</legend>
            <p class="hint">${t("settingsDisplayHint")}</p>
            <div class="grid compact">
              <label class="field"><span>${t("settingsDisplayLanguage")}</span>
                <select id="settings-language">
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
              </label>
              <label class="field"><span>${t("settingsDisplayTheme")}</span>
                <select id="settings-theme">
                  <option value="system">${t("settingsDisplayThemeSystem")}</option>
                  <option value="light">${t("settingsDisplayThemeLight")}</option>
                  <option value="dark">${t("settingsDisplayThemeDark")}</option>
                </select>
              </label>
            </div>
            <label class="field"><span>${t("settingsDisplayAccent")}</span>
              <input id="settings-accent" type="color" value="#4f46e5">
            </label>
          </fieldset>
          <div class="toolbar">
            <button class="primary" type="submit">${t("settingsSave")}</button>
            <span id="settings-message" class="message" role="status"></span>
          </div>
        </form>
      </section>
      <section class="card" id="settings-card-backup">
        <h3>${t("settingsBackupTitle")}</h3>
        <p class="hint">${t("settingsBackupHint")}</p>
        <label class="field"><span>${t("settingsBackupFolder")}</span><input id="settings-backup-path"></label>
        <div class="toolbar">
          <button id="settings-choose-folder" type="button">${t("settingsChooseFolder")}</button>
          <button id="settings-save-folder" type="button">${t("settingsSave")}</button>
          <button id="settings-open-folder" type="button">${t("settingsBackupOpen")}</button>
        </div>
        <div class="toolbar">
          <button id="settings-create-backup" class="primary" type="button">${t("settingsBackupCreate")}</button>
          <button id="settings-save-backup-as" type="button">${t("settingsBackupSaveAs")}</button>
        </div>
        <div id="settings-backup-list" class="entity-list"></div>
      </section>
      <section class="card" id="settings-card-restore">
        <h3>${t("settingsRestoreTitle")}</h3>
        <p class="hint">${t("settingsRestoreHint")}</p>
        <div class="toolbar">
          <button id="settings-restore-choose" type="button">${t("settingsRestoreChoose")}</button>
          <button id="settings-restore-verify" type="button">${t("settingsRestoreVerify")}</button>
          <button id="settings-restore-run" class="danger" type="button">${t("settingsRestoreRun")}</button>
        </div>
        <p id="settings-restore-path" class="hint"></p>
        <p id="settings-restore-message" class="message" role="status"></p>
      </section>
      <section class="card" id="settings-card-storage">
        <h3>${t("storageTitle")}</h3>
        <p class="hint">${t("storageHint")}</p>
        <div id="settings-storage" class="storage-inspector"><p class="hint">${t("loading")}</p></div>
        <div class="toolbar"><button id="settings-storage-refresh" type="button">${t("storageRefresh")}</button></div>
      </section>
      <section class="card" id="settings-card-appstore">
        <h3>${t("settingsAppStoreTitle")}</h3>
        <p class="hint">${t("settingsAppStoreHint")}</p>
        <label class="field"><span>${t("settingsAppStoreSearch")}</span><input id="settings-app-store-search" type="search"></label>
        <p id="settings-app-store-count" class="hint"></p>
        <div id="settings-app-store-list" class="entity-list"></div>
      </section>
        </div>
      </div>
    </div>`;

  byId<HTMLFormElement>("settings-profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveProfile();
  });
  byId("settings-choose-folder").addEventListener("click", () => void chooseFolder());
  byId("settings-save-folder").addEventListener("click", () => void saveProfile());
  byId("settings-open-folder").addEventListener("click", () => void openFolder());
  byId("settings-create-backup").addEventListener("click", () => void createBackup());
  byId("settings-save-backup-as").addEventListener("click", () => void saveBackupAs());
  byId("settings-restore-choose").addEventListener("click", () => void chooseRestore());
  byId("settings-restore-verify").addEventListener("click", () => void verifyRestore());
  byId("settings-restore-run").addEventListener("click", () => void runRestore());
  byId("settings-app-store-search").addEventListener("input", renderAppStore);
  byId("settings-storage-refresh").addEventListener("click", () => void loadStorage());
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-settings-target]")) {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.settingsTarget ?? "");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (button.classList.contains("settings-nav")) {
        for (const entry of document.querySelectorAll(".settings-nav")) {
          entry.classList.toggle("is-active", entry === button);
        }
      }
    });
  }
  document.getElementById("settings-search")?.addEventListener("input", (event) => {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    for (const card of document.querySelectorAll<HTMLElement>(".settings-grid .card")) {
      card.hidden = query.length > 0 && !(card.textContent ?? "").toLowerCase().includes(query);
    }
  });
}

async function loadStorage(): Promise<void> {
  const target = document.getElementById("settings-storage");
  if (!target) return;
  try {
    const view = await invoke<StorageInspectorView>("storage_inspector");
    target.innerHTML = `
      <dl class="facts">
        <div class="fact"><dt>${t("storageDatabase")}</dt><dd class="path">${view.database}</dd></div>
        <div class="fact"><dt>${t("storageSize")}</dt><dd>${formatBytes(view.database_bytes)}</dd></div>
        <div class="fact"><dt>${t("storageSchema")}</dt><dd>${view.schema_version}</dd></div>
        <div class="fact"><dt>${t("storageBackupFolder")}</dt><dd class="path">${view.backup_folder}</dd></div>
      </dl>
      <h4>${t("storageTable")}</h4>
      <table><thead><tr><th>${t("storageTable")}</th><th class="numeric">${t("storageRows")}</th></tr></thead><tbody>
        ${view.counts.map((row) => `<tr><td>${row.name}</td><td class="numeric">${row.rows}</td></tr>`).join("")}
      </tbody></table>`;
  } catch (error) {
    target.textContent = String(error);
  }
}

function loadSettingsData(): Promise<void> {
  return Promise.all([loadProfile(), loadBackups(), loadAppStore(), loadStorage()]).then(() => undefined);
}

export async function loadSettings(): Promise<void> {
  await loadSettingsData();
}

/// Applies the persisted accent before the first screen paints. The theme itself is owned by
/// `theme.ts` and survives restarts through `socdof.ui.theme`.
export async function loadAppearance(): Promise<void> {
  try {
    const profile = await invoke<ProfileRecord>("company_profile");
    const accent = typeof profile.accent_color === "string" ? profile.accent_color : "#4f46e5";
    applyAccent(accent);
    const company = String(profile.name ?? "").trim();
    if (company) setTaskbarCompany(company);
  } catch {
    // A missing profile must not block the start screen; the default theme stays active.
  }
}

function readProfile(): ProfileRecord {
  return {
    ...(currentProfile ?? {}),
    name: inputValue("settings-name"),
    street: inputValue("settings-street"),
    zip_city: inputValue("settings-zip-city"),
    country: inputValue("settings-country"),
    currency: inputValue("settings-currency").toUpperCase(),
    email: inputValue("settings-email"),
    phone: inputValue("settings-phone"),
    tax_id: inputValue("settings-tax-id"),
    language: byId<HTMLSelectElement>("settings-language").value,
    theme_mode: byId<HTMLSelectElement>("settings-theme").value,
    accent_color: inputValue("settings-accent"),
    backup_folder_path: inputValue("settings-backup-path"),
  };
}

const ACCENT_COLORS: Record<string, string> = {
  indigo: "#4f46e5",
  emerald: "#059669",
  teal: "#0d9488",
  blue: "#2563eb",
  violet: "#7c3aed",
  rose: "#e11d48",
  amber: "#d97706",
};

function applyAccent(accent: string): void {
  const root = document.documentElement;
  const color = ACCENT_COLORS[accent.toLowerCase()] ?? accent;
  if (accent.toLowerCase() === "indigo" || !/^#[0-9a-f]{6}$/i.test(color)) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-strong");
    return;
  }
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-strong", color);
}

function applyAppearance(theme: string, accent: string): void {
  if (theme === "light" || theme === "dark") {
    applyTheme(theme);
  } else {
    applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  applyAccent(accent);
}

async function loadProfile(): Promise<void> {
  try {
    currentProfile = await invoke<ProfileRecord>("company_profile");
    setValue("settings-name", currentProfile.name);
    setValue("settings-street", currentProfile.street);
    setValue("settings-zip-city", currentProfile.zip_city);
    setValue("settings-country", currentProfile.country);
    setValue("settings-currency", currentProfile.currency);
    setValue("settings-email", currentProfile.email);
    setValue("settings-phone", currentProfile.phone);
    setValue("settings-tax-id", currentProfile.tax_id);
    setValue("settings-backup-path", currentProfile.backup_folder_path);
    const languageSelect = byId<HTMLSelectElement>("settings-language");
    const themeSelect = byId<HTMLSelectElement>("settings-theme");
    languageSelect.value = typeof currentProfile.language === "string"
      ? currentProfile.language
      : language;
    themeSelect.value = typeof currentProfile.theme_mode === "string"
      ? currentProfile.theme_mode
      : "system";
    setValue(
      "settings-accent",
      typeof currentProfile.accent_color === "string" &&
        /^#[0-9a-f]{6}$/i.test(currentProfile.accent_color)
        ? currentProfile.accent_color
        : ACCENT_COLORS[String(currentProfile.accent_color ?? "indigo").toLowerCase()] ?? "#4f46e5",
    );
    applyAccent(inputValue("settings-accent"));
    setTaskbarCompany(String(currentProfile.name ?? ""));
    const name = String(currentProfile.name ?? "").trim() || "SOCDOF";
    const heroName = document.getElementById("settings-hero-name");
    const heroEmail = document.getElementById("settings-hero-email");
    const avatar = document.getElementById("settings-avatar");
    if (heroName) heroName.textContent = name;
    if (heroEmail) heroEmail.textContent = String(currentProfile.email ?? "");
    if (avatar) {
      avatar.textContent = name.slice(0, 2).toUpperCase();
    }
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function saveProfile(): Promise<void> {
  const profile = readProfile();
  try {
    await invoke("save_company_profile", { profile });
    currentProfile = profile;
    applyAppearance(String(profile.theme_mode), String(profile.accent_color));
    const nextLanguage = String(profile.language);
    localStorage.setItem("socdof.language", nextLanguage);
    setMessage(t("settingsSaved"));
    if (nextLanguage !== language) {
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }
    await loadBackups();
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function chooseFolder(): Promise<void> {
  try {
    const reply = await invoke<DialogReply>("select_backup_folder");
    if (reply.outcome !== "chosen" || !reply.path) {
      return;
    }
    setValue("settings-backup-path", reply.path);
    await saveProfile();
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function openFolder(): Promise<void> {
  const path = inputValue("settings-backup-path");
  if (!path) {
    setMessage(t("settingsBackupFolderMissing"), "error");
    return;
  }
  try {
    await invoke("open_backup_folder", { path });
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function createBackup(): Promise<void> {
  try {
    const report = await invoke<BackupReport>("create_backup");
    restorePath = report.path;
    byId<HTMLElement>("settings-restore-path").textContent = restorePath;
    restoreMessage("");
    setMessage(`${t("settingsBackupCreated")} ${report.path}`);
    await loadBackups();
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function saveBackupAs(): Promise<void> {
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: `socdof-${new Date().toISOString().slice(0, 10)}.socdofbak`,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      return;
    }
    await invoke<BackupReport>("save_backup_to_disk", { path: reply.path });
    setMessage(t("settingsBackupSaved"));
    await loadBackups();
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function loadBackups(): Promise<void> {
  const list = byId<HTMLElement>("settings-backup-list");
  try {
    const files = await invoke<BackupFileView[]>("backup_files");
    if (files.length === 0) {
      list.innerHTML = `<p class="hint">${t("settingsBackupEmpty")}</p>`;
      return;
    }
    list.innerHTML = files
      .slice()
      .reverse()
      .map(
        (file) => `
          <article class="entity-row">
            <div>
              <strong>${escapeHtml(file.path)}</strong>
              <p class="hint">${formatDate(file.created_at)} · ${formatBytes(file.bytes)} · ${t("settingsBackupSchema")} ${file.schema_version}</p>
            </div>
            <div class="row-actions"><button type="button" data-restore="${escapeHtml(file.path)}">${t("settingsRestoreChoose")}</button></div>
          </article>`,
      )
      .join("");
    for (const button of list.querySelectorAll<HTMLButtonElement>("[data-restore]")) {
      button.addEventListener("click", () => {
        restorePath = button.dataset.restore ?? "";
        byId<HTMLElement>("settings-restore-path").textContent = restorePath;
        restoreMessage("");
      });
    }
  } catch (error) {
    list.innerHTML = `<p class="message" data-kind="error">${escapeHtml(String(error))}</p>`;
  }
}

function restoreMessage(text: string, kind: "ok" | "error" = "ok"): void {
  const message = byId<HTMLElement>("settings-restore-message");
  message.textContent = text;
  message.dataset.kind = kind;
}

async function chooseRestore(): Promise<void> {
  try {
    const reply = await invoke<DialogReply>("pick_open_file", {
      extensions: ["socdofbak"],
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      return;
    }
    restorePath = reply.path;
    byId<HTMLElement>("settings-restore-path").textContent = restorePath;
    restoreMessage("");
  } catch (error) {
    restoreMessage(String(error), "error");
  }
}

async function verifyRestore(): Promise<void> {
  if (!restorePath) {
    restoreMessage(t("settingsRestoreNoFile"), "error");
    return;
  }
  try {
    const metadata = await invoke<BackupMetadataView>("verify_backup", { path: restorePath });
    restoreMessage(
      `${t("settingsRestoreVerified")} · ${t("settingsBackupSchema")} ${metadata.schema_version} · ${formatDate(metadata.created_at)} · ${metadata.app_version}`,
    );
  } catch (error) {
    restoreMessage(String(error), "error");
  }
}

async function runRestore(): Promise<void> {
  if (!restorePath) {
    restoreMessage(t("settingsRestoreNoFile"), "error");
    return;
  }
  if (!(await confirmDialog(t("settingsRestoreConfirm")))) {
    return;
  }
  try {
    const result = await invoke<RestoreReportView>("restore_backup", { path: restorePath });
    restoreMessage(
      `${t("settingsRestoreDone")} · ${t("settingsBackupSchema")} ${result.schema_version}`,
    );
    await loadSettingsData();
  } catch (error) {
    restoreMessage(String(error), "error");
  }
}

async function loadAppStore(): Promise<void> {
  try {
    appStoreModules = await invoke<AppStoreModuleView[]>("app_store_modules");
    renderAppStore();
  } catch (error) {
    byId<HTMLElement>("settings-app-store-list").innerHTML =
      `<p class="message" data-kind="error">${escapeHtml(String(error))}</p>`;
  }
}

function renderAppStore(): void {
  const needle = byId<HTMLInputElement>("settings-app-store-search").value.trim().toLowerCase();
  const list = byId<HTMLElement>("settings-app-store-list");
  const visible = appStoreModules.filter(
    (module) =>
      !needle ||
      module.id.includes(needle) ||
      moduleName(module).toLowerCase().includes(needle) ||
      moduleDescription(module).toLowerCase().includes(needle),
  );
  const active = appStoreModules.filter((module) => module.active).length;
  byId<HTMLElement>("settings-app-store-count").textContent =
    `${active} / ${appStoreModules.length} ${t("settingsAppStoreActiveCount")}`;
  list.innerHTML = visible.length
    ? visible
        .map(
          (module) => `
            <article class="entity-row">
              <div>
                <strong>${escapeHtml(moduleName(module))}</strong>
                <p class="hint">${escapeHtml(moduleDescription(module))} · ${licenseLabel(module.license)}${module.required ? ` · ${t("settingsAppStoreRequired")}` : ""}</p>
              </div>
              <div class="row-actions">
                <span class="badge">${module.active ? t("settingsAppStoreActive") : t("settingsAppStoreInactive")}</span>
                <button type="button" data-module="${module.id}" data-active="${String(module.active)}" ${module.can_toggle ? "" : "disabled"}>${module.active ? t("settingsAppStoreDeactivate") : t("settingsAppStoreActivate")}</button>
              </div>
            </article>`,
        )
        .join("")
    : `<p class="hint">${t("settingsAppStoreEmpty")}</p>`;
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-module]")) {
    button.addEventListener("click", () => {
      void toggleModule(button.dataset.module ?? "", button.dataset.active === "true");
    });
  }
}

async function toggleModule(id: string, active: boolean): Promise<void> {
  try {
    await invoke("app_store_set_active", { id, active: !active });
    await loadAppStore();
  } catch (error) {
    byId<HTMLElement>("settings-app-store-count").textContent = String(error);
  }
}

function moduleName(module: AppStoreModuleView): string {
  return translate(language, module.name_key as TranslationKey);
}

function moduleDescription(module: AppStoreModuleView): string {
  return translate(language, module.description_key as TranslationKey);
}

function licenseLabel(license: AppStoreModuleView["license"]): string {
  if (license === "trial") {
    return t("settingsAppStoreTrial");
  }
  if (license === "locked") {
    return t("settingsAppStoreLocked");
  }
  return t("settingsAppStoreIncluded");
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
