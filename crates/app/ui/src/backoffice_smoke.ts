//! Headless webview scenario for the backoffice tabs.
//!
//! The scenario deliberately uses the navigation tabs and the rendered forms instead of setting the
//! view state directly. DOM assertions prove that the commands' results reached the visible lists.

import { invoke } from "@tauri-apps/api/core";

import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface ContactView {
  id: string;
  contact_type: string;
  name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ProductView {
  id: string;
  sku: string;
  name: string;
}

interface JournalEntryView {
  id: string;
  description: string;
}

interface PurchaseOrderView {
  id: string;
  number: string;
}

interface BackupMetadataView {
  schema_version: number;
}

type BackofficeView = "accounting" | "purchases" | "reports" | "settings";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing smoke element ${id}`);
  }
  return element as T;
}

function waitFor(predicate: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = (): void => {
      try {
        if (predicate()) {
          resolve();
          return;
        }
      } catch {
        // The view may still be between two renders; retry until the deadline.
      }
      if (Date.now() >= deadline) {
        reject(new Error(`smoke timeout: ${label}`));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

async function navigate(view: BackofficeView): Promise<void> {
  const tab = document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`);
  if (!tab) {
    throw new Error(`missing navigation tab ${view}`);
  }
  tab.click();
  await waitFor(
    () => tab.getAttribute("aria-selected") === "true" && !byId(`view-${view}`).hidden,
    `navigation to ${view}`,
  );
}

async function marker(text: string): Promise<void> {
  await invoke("smoke_ui_marker", { marker: text });
}

function setValue(id: string, value: string): void {
  byId<HTMLInputElement | HTMLSelectElement>(id).value = value;
}

function submitForm(id: string): void {
  byId<HTMLFormElement>(id).requestSubmit();
}

async function ensureVendor(): Promise<ContactView> {
  const query = "SMOKE-GUI Lieferant";
  const matches = await invoke<ContactView[]>("list_contacts", { query });
  const existing = matches.find(
    (contact) => contact.contact_type === "vendor" || contact.contact_type === "both",
  );
  if (existing) {
    return existing;
  }
  return invoke<ContactView>("create_contact", {
    input: {
      name: query,
      company: query,
      is_company: true,
      contact_type: "vendor",
      first_name: "",
      last_name: "",
      street: "Lieferweg 1",
      zip: "10115",
      city: "Berlin",
      country: "Deutschland",
      email: "lieferant@example.invalid",
      phone: "",
      tax_id: "DE-SMOKE-VENDOR",
      notes: "GUI smoke vendor",
    },
  });
}

async function createAccountingEntry(stamp: string): Promise<void> {
  const description = `SMOKE-GUI Buchung ${stamp}`;
  await navigate("accounting");
  byId<HTMLButtonElement>("accounting-new").click();
  setValue("accounting-description", description);
  setValue("accounting-account", "1200 Bank");
  setValue("accounting-counter", "8400 Erlöse");
  setValue("accounting-amount", "125,00");
  setValue("accounting-kind", "income");
  setValue("accounting-channel", "bank");
  submitForm("accounting-form");
  await waitFor(
    () => byId("accounting-list").textContent?.includes(description) ?? false,
    "accounting list to render the created entry",
  );
  const entries = await invoke<JournalEntryView[]>("journal_entries", { query: description });
  if (!entries.some((entry) => entry.description === description)) {
    throw new Error("accounting smoke entry is missing from journal_entries");
  }
  await marker(`backoffice.accounting.create_list entries=${entries.length}`);
}

async function createPurchaseOrder(stamp: string): Promise<void> {
  await marker("backoffice.purchases.ensure_vendor");
  const vendor = await ensureVendor();
  await marker(`backoffice.purchases.vendor id=${vendor.id}`);
  const products = await invoke<ProductView[]>("list_products", { query: "SMOKE-GUI-001" });
  const product = products[0];
  const number = `SMOKE-GUI-BE-${stamp}`;
  await marker("backoffice.purchases.navigate");
  await navigate("purchases");
  await marker("backoffice.purchases.open_editor");
  byId<HTMLButtonElement>("purchases-new").click();
  setValue("purchases-number", number);
  await marker("backoffice.purchases.form_open");
  await waitFor(
    () =>
      Array.from(byId<HTMLSelectElement>("purchases-vendor").options).some(
        (option) => option.value === vendor.id,
      ),
    "purchase vendor list",
  );
  await marker("backoffice.purchases.vendor_option");
  setValue("purchases-vendor", vendor.id);
  setValue("purchases-note", "GUI smoke purchase");
  const row = byId<HTMLElement>("purchases-lines").querySelector<HTMLElement>(".purchase-line");
  if (!row) {
    throw new Error("purchase editor did not create a line");
  }
  const index = row.dataset.index ?? "0";
  row.querySelector<HTMLInputElement>(`[data-line-description="${index}"]`)!.value =
    "GUI Smoke Einkauf";
  row.querySelector<HTMLInputElement>(`[data-line-quantity="${index}"]`)!.value = "2";
  row.querySelector<HTMLInputElement>(`[data-line-cost="${index}"]`)!.value = "5,00";
  const productSelect = row.querySelector<HTMLSelectElement>(`[data-line-product="${index}"]`)!;
  if (product && Array.from(productSelect.options).some((option) => option.value === product.id)) {
    productSelect.value = product.id;
  }
  await marker("backoffice.purchases.submit");
  submitForm("purchases-form");
  await waitFor(
    () => byId("purchases-list").textContent?.includes(number) ?? false,
    "purchases list to render the created order",
  );
  await marker("backoffice.purchases.rendered");
  const orders = await invoke<PurchaseOrderView[]>("purchase_orders", { query: number });
  if (!orders.some((order) => order.number === number)) {
    throw new Error("purchase smoke order is missing from purchase_orders");
  }
  await marker(`backoffice.purchases.create_list orders=${orders.length}`);
}

async function checkReports(invoiceNumber: string): Promise<void> {
  await navigate("reports");
  await waitFor(
    () => byId("reports-table").textContent?.includes(invoiceNumber) ?? false,
    "reports table to render the smoke invoice",
  );
  const kpis = byId("reports-kpis").textContent ?? "";
  if (!kpis.trim()) {
    throw new Error("reports KPIs are empty");
  }
  await marker(`backoffice.reports.create_list invoice=${invoiceNumber}`);
}

async function toggleAppStore(): Promise<void> {
  await navigate("settings");
  await waitFor(
    () =>
      byId("settings-app-store-list").querySelector<HTMLButtonElement>("[data-module]") !== null,
    "AppStore catalogue",
  );
  const list = byId("settings-app-store-list");
  const moduleButton = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-module]")).find(
    (button) => !button.disabled,
  );
  if (!moduleButton) {
    throw new Error("AppStore has no toggleable module");
  }
  const id = moduleButton.dataset.module ?? "";
  const before = moduleButton.dataset.active;
  moduleButton.click();
  await waitFor(
    () => {
      const current = Array.from(
        byId("settings-app-store-list").querySelectorAll<HTMLButtonElement>("[data-module]"),
      ).find((button) => button.dataset.module === id);
      return current?.dataset.active !== before;
    },
    "AppStore switch to persist",
  );
  await marker(`settings.app_store.toggle id=${id} active=${before}`);
}

async function verifyAndRestore(expectRestore: boolean): Promise<void> {
  byId<HTMLButtonElement>("settings-create-backup").click();
  await marker("settings.backup.after_create_click");
  await waitFor(
    () => byId("settings-restore-path").textContent?.trim().endsWith(".socdofbak") ?? false,
    "fresh backup path",
  );
  await marker("settings.backup.path_ready");
  const path = byId("settings-restore-path").textContent?.trim() ?? "";
  if (!path.endsWith(".socdofbak")) {
    throw new Error(`restore path is not a native archive: ${path}`);
  }
  byId<HTMLButtonElement>("settings-restore-verify").click();
  await marker("settings.restore.after_verify_click");
  await waitFor(
    () => byId("settings-restore-message").textContent?.includes(t("settingsRestoreVerified")) ?? false,
    "backup verification",
  );
  const metadata = await invoke<BackupMetadataView>("verify_backup", { path });
  await marker(`settings.restore.verify schema=${metadata.schema_version}`);
  if (!expectRestore) {
    return;
  }
  byId<HTMLButtonElement>("settings-restore-run").click();
  await waitFor(
    () => byId("settings-restore-message").textContent?.includes(t("settingsRestoreDone")) ?? false,
    "backup restore",
  );
  await marker(`settings.restore.done schema=${metadata.schema_version}`);
}

/// Creates and lists one journal entry and one purchase order, renders the report with the paid
/// smoke invoice, toggles an AppStore module and verifies/restores a native archive.
export async function runBackofficeSmoke(
  invoiceNumber: string,
  expectRestore: boolean,
): Promise<void> {
  const stamp = Date.now().toString(36);
  await createAccountingEntry(stamp);
  await createPurchaseOrder(stamp);
  await checkReports(invoiceNumber);
  await toggleAppStore();
  await verifyAndRestore(expectRestore);
}
