import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

import "./style.css";
import { applyTranslations, detectLanguage, format, translate, type TranslationKey } from "./i18n";

interface ShellStatus {
  database: string;
  schema_version: number;
  contacts: number;
  products: number;
  invoices: number;
  users: number;
  lock_owner_pid: number | null;
  started_at: number;
}

interface BackupReport {
  path: string;
  bytes: number;
  database_bytes: number;
  schema_version: number;
  created_at: number;
}

interface SmokeReport {
  schema_version: number;
  database: string;
  backup_path: string;
  backup_bytes: number;
}

const language = detectLanguage();
applyTranslations(language);

const statusMessage = byId<HTMLParagraphElement>("status-message");
const backupButton = byId<HTMLButtonElement>("backup-button");
const backupResult = byId<HTMLParagraphElement>("backup-result");
const updateCard = byId<HTMLElement>("update-card");
const updateButton = byId<HTMLButtonElement>("update-button");
const updateResult = byId<HTMLParagraphElement>("update-result");
const numberFormat = new Intl.NumberFormat(language);
const updaterConfigured = import.meta.env.VITE_UPDATER_CONFIGURED === "true";

if (!updaterConfigured) {
  updateCard.hidden = true;
}

let pendingUpdate: Update | null = null;
let updateBusy = false;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setUpdateButton(label: TranslationKey, disabled: boolean): void {
  updateButton.textContent = translate(language, label);
  updateButton.disabled = disabled;
}

function renderStatus(status: ShellStatus): void {
  byId("database").textContent = status.database;
  byId("schema-version").textContent = String(status.schema_version);
  byId("contacts").textContent = numberFormat.format(status.contacts);
  byId("products").textContent = numberFormat.format(status.products);
  byId("invoices").textContent = numberFormat.format(status.invoices);
  byId("users").textContent = numberFormat.format(status.users);
  byId("lock-owner").textContent =
    status.lock_owner_pid === null
      ? translate(language, "noOwner")
      : String(status.lock_owner_pid);
  statusMessage.textContent = "";
}

function renderBackup(report: BackupReport): void {
  backupResult.textContent = format(translate(language, "backupDone"), {
    path: report.path,
    bytes: numberFormat.format(report.bytes),
  });
}

async function refreshStatus(): Promise<void> {
  try {
    renderStatus(await invoke<ShellStatus>("database_status"));
  } catch (error) {
    statusMessage.textContent = format(translate(language, "errorStatus"), {
      message: describe(error),
    });
  }
}

async function checkForUpdates(): Promise<void> {
  if (updateBusy) {
    return;
  }

  updateBusy = true;
  pendingUpdate = null;
  setUpdateButton("updateChecking", true);
  updateResult.textContent = "";

  try {
    const candidate = await check({ timeout: 20_000 });
    if (!candidate) {
      updateResult.textContent = translate(language, "updateNone");
      setUpdateButton("updateAction", false);
      return;
    }

    pendingUpdate = candidate;
    updateResult.textContent = format(translate(language, "updateAvailable"), {
      version: candidate.version,
    });
    setUpdateButton("updateInstall", false);
  } catch (error) {
    updateResult.textContent = format(translate(language, "updateError"), {
      message: describe(error),
    });
    setUpdateButton("updateAction", false);
  } finally {
    updateBusy = false;
  }
}

async function installUpdate(): Promise<void> {
  const update = pendingUpdate;
  if (!update) {
    await checkForUpdates();
    return;
  }
  if (updateBusy) {
    return;
  }

  updateBusy = true;
  setUpdateButton("updateInstalling", true);
  updateResult.textContent = translate(language, "updateInstalling");

  let downloaded = 0;
  let total: number | undefined;

  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength;
        updateResult.textContent = translate(language, "updateInstalling");
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        const percent =
          total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
        updateResult.textContent = format(translate(language, "updateProgress"), {
          percent: String(percent),
        });
      } else {
        updateResult.textContent = translate(language, "updateRestarting");
      }
    });

    updateResult.textContent = translate(language, "updateRestarting");
    await relaunch();
  } catch (error) {
    updateResult.textContent = format(translate(language, "updateError"), {
      message: describe(error),
    });
    setUpdateButton("updateInstall", false);
  } finally {
    updateBusy = false;
  }
}

async function runSmokeIfEnabled(): Promise<boolean> {
  let enabled = false;
  try {
    enabled = await invoke<boolean>("smoke_enabled");
  } catch {
    return false;
  }
  if (!enabled) {
    return false;
  }

  try {
    const status = await invoke<ShellStatus>("database_status");
    renderStatus(status);

    const backup = await invoke<BackupReport>("create_backup");
    renderBackup(backup);

    const report: SmokeReport = {
      schema_version: status.schema_version,
      database: status.database,
      backup_path: backup.path,
      backup_bytes: backup.bytes,
    };
    try {
      await invoke("finish_smoke", { report });
    } catch {
      // The command writes the report and exits; an IPC rejection after that is expected.
    }
  } catch (error) {
    const message = describe(error);
    statusMessage.textContent = message;
    try {
      await invoke("abort_smoke", { message });
    } catch {
      // The CI timeout is the final fallback if even the abort command cannot be delivered.
    }
  }

  return true;
}

backupButton.addEventListener("click", async () => {
  backupButton.disabled = true;
  backupButton.textContent = translate(language, "backupWorking");
  backupResult.textContent = "";

  try {
    const report = await invoke<BackupReport>("create_backup");
    renderBackup(report);
    await refreshStatus();
  } catch (error) {
    backupResult.textContent = format(translate(language, "errorBackup"), {
      message: describe(error),
    });
  } finally {
    backupButton.disabled = false;
    backupButton.textContent = translate(language, "backupAction");
  }
});

updateButton.addEventListener("click", () => {
  void (pendingUpdate ? installUpdate() : checkForUpdates());
});

async function start(): Promise<void> {
  await refreshStatus();
  const smokeMode = await runSmokeIfEnabled();
  if (!smokeMode && updaterConfigured) {
    void checkForUpdates();
  }
}

void start();
