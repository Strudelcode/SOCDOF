import { invoke } from "@tauri-apps/api/core";

import "./style.css";
import { applyTranslations, detectLanguage, format, translate } from "./i18n";

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
const numberFormat = new Intl.NumberFormat(language);

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

async function runSmokeIfEnabled(): Promise<void> {
  let enabled = false;
  try {
    enabled = await invoke<boolean>("smoke_enabled");
  } catch {
    return;
  }
  if (!enabled) {
    return;
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

async function start(): Promise<void> {
  await refreshStatus();
  await runSmokeIfEnabled();
}

void start();
