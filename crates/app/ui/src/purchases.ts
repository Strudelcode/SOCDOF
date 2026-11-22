//! Purchases screen of the Tauri webview.
//!
//! A port of the reference `PurchasesModule.tsx`: the shop header with its two actions, the four
//! procurement KPI cards, the search/filter card and the order table with the reference's own cell
//! colours (the TS table paints its number and total cells white, so they stay unreadable in the
//! light frame — the port reproduces that state instead of inventing a readable variant).
//!
//! Orders, vendors and products still come from the domain commands; the editor that used to sit
//! below the table now lives in a dialog, so the screen keeps the reference's single-card layout.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface PurchaseLineView {
  product_id: string | null;
  description: string;
  quantity_milli: number;
  unit_cost: number;
  tax_rate_bp: number;
}

interface PurchaseOrderView {
  id: string;
  number: string;
  vendor_id: string;
  status: string;
  order_date: number;
  expected_at: number | null;
  note: string | null;
  lines: PurchaseLineView[];
}

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

let orders: PurchaseOrderView[] = [];
let vendors: ContactView[] = [];
let products: ProductView[] = [];
let query = "";
let editingId: string | null = null;
let lineCount = 0;
let statusFilter: "all" | "draft" | "ordered" | "received" = "all";

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

function showMessage(text: string): void {
  const message = document.getElementById("purchases-message");
  if (message) {
    message.textContent = text;
  }
}

export function initPurchases(): void {
  const view = byId<HTMLElement>("view-purchases");
  view.innerHTML = `
    <div class="po-page">
      <header class="po-head">
        <div class="po-head-text">
          <h1 class="po-title"><span class="po-title-icon">${ICON.cart}</span><span>Einkauf &amp; Beschaffung</span></h1>
          <p class="po-subtitle">Lieferantenbestellungen, Preisanfragen (RFQ) &amp; automatische Wareneingangsbuchung</p>
        </div>
        <div class="po-head-actions">
          <button type="button" class="po-btn is-amber" id="purchases-reorder">${ICON.cart}<span>Nachbestellen &amp; Amazon</span></button>
          <button type="button" class="po-btn is-accent" id="purchases-new">${ICON.plus}<span>Neue Bestellung anlegen</span></button>
        </div>
      </header>

      <div class="po-kpis" id="purchases-kpis"></div>

      <div class="po-filter">
        <label class="po-search">
          <span class="po-search-icon">${ICON.search}</span>
          <input id="purchases-search" type="text" placeholder="Bestellungen durchsuchen (z. B. PO/2026/0001, Lieferant)...">
        </label>
        <div class="po-pills" id="purchases-pills">
          <button type="button" class="po-pill is-active" data-po-filter="all">Alle</button>
          <button type="button" class="po-pill" data-po-filter="draft">Entwurf (<span id="po-draft-count">0</span>)</button>
          <button type="button" class="po-pill" data-po-filter="ordered">Bestellt (<span id="po-open-count">0</span>)</button>
          <button type="button" class="po-pill" data-po-filter="received">Eingegangen (<span id="po-received-count">0</span>)</button>
        </div>
      </div>

      <div class="po-tablecard">
        <table class="po-table">
          <thead><tr>
            <th>Bestell-Nr.</th>
            <th>Lieferant</th>
            <th>Bestelldatum</th>
            <th>Liefertermin</th>
            <th class="is-right">Gesamt (brutto)</th>
            <th class="is-center">Status</th>
            <th class="is-right">Aktionen</th>
          </tr></thead>
          <tbody id="purchases-list"></tbody>
        </table>
      </div>

      <p id="purchases-message" class="po-status" role="status"></p>

      <dialog class="po-dialog" id="purchases-editor">
        <div class="po-dialog-head">
          <h3 id="purchases-editor-title">${t("purchasesNew")}</h3>
          <button type="button" class="po-dialog-close" id="purchases-cancel" aria-label="${t("cancel")}">×</button>
        </div>
        <form id="purchases-form" class="po-form">
          <div class="po-form-grid">
            <label class="po-field"><span>${t("purchasesNumber")}</span><input id="purchases-number" required></label>
            <label class="po-field"><span>${t("purchasesExpected")}</span><input id="purchases-expected" type="date"></label>
          </div>
          <label class="po-field"><span>${t("purchasesVendor")}</span><select id="purchases-vendor" required></select></label>
          <label class="po-field"><span>${t("purchasesNote")}</span><input id="purchases-note"></label>
          <div class="po-lines-head"><h4>${t("purchasesLines")}</h4><button id="purchases-add-line" class="po-mini" type="button">${t("purchasesAddLine")}</button></div>
          <div id="purchases-lines" class="po-lines"></div>
          <div class="po-dialog-actions">
            <button class="po-btn is-accent" type="submit">${t("purchasesSave")}</button>
            <button id="purchases-delete" class="po-btn is-danger" type="button" hidden>${t("purchasesDelete")}</button>
            <button id="purchases-close" class="po-btn is-plain" type="button">${t("cancel")}</button>
          </div>
        </form>
      </dialog>
    </div>`;

  byId("purchases-new").addEventListener("click", () => openEditor());
  byId("purchases-reorder").addEventListener("click", () => openEditor());
  byId("purchases-close").addEventListener("click", closeEditor);
  byId("purchases-cancel").addEventListener("click", closeEditor);
  byId("purchases-delete").addEventListener("click", () => void deleteOrder());
  byId("purchases-add-line").addEventListener("click", () => addLine());
  byId<HTMLFormElement>("purchases-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveOrder();
  });
  byId("purchases-search").addEventListener("input", () => {
    query = inputValue("purchases-search");
    void loadOrders();
  });
  for (const pill of view.querySelectorAll<HTMLButtonElement>("[data-po-filter]")) {
    pill.addEventListener("click", () => {
      statusFilter = (pill.dataset.poFilter ?? "all") as typeof statusFilter;
      for (const other of view.querySelectorAll("[data-po-filter]")) {
        other.classList.toggle("is-active", other === pill);
      }
      renderList();
    });
  }
}

export async function loadPurchases(): Promise<void> {
  try {
    const [contacts, productRows] = await Promise.all([
      invoke<ContactView[]>("list_contacts", { query: null }),
      invoke<ProductView[]>("list_products", { query: null }),
    ]);
    vendors = contacts.filter((vendor) => vendor.contact_type === "vendor" || vendor.contact_type === "both");
    products = productRows;
    await loadOrders();
  } catch (error) {
    showMessage(String(error));
  }
}

async function loadOrders(): Promise<void> {
  try {
    orders = await invoke<PurchaseOrderView[]>("purchase_orders", { query: query || null });
    renderKpis();
    renderList();
  } catch (error) {
    showMessage(String(error));
  }
}

function renderKpis(): void {
  const volume = orders.filter((order) => order.status !== "draft").reduce((sum, order) => sum + orderGross(order), 0);
  const open = orders.filter((order) => order.status === "ordered" || order.status === "partially_received");
  const received = orders.filter((order) => order.status === "received").length;
  const drafts = orders.filter((order) => order.status === "draft").length;
  const setCount = (id: string, value: number): void => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = String(value);
    }
  };
  setCount("po-draft-count", drafts);
  setCount("po-open-count", open.length);
  setCount("po-received-count", received);

  const cards = [
    { label: "Beschaffungsvolumen", value: money(volume), tone: "is-accent", mono: true, icon: ICON.dollar },
    { label: "Bestellt", value: `${open.length} Bestellungen`, tone: "is-accent", mono: false, icon: ICON.truck },
    { label: "Eingegangen", value: `${received} Bestellungen`, tone: "is-emerald", mono: false, icon: ICON.check },
    { label: "Aktive Lieferanten", value: `${vendors.length} Lieferanten`, tone: "is-amber", mono: false, icon: ICON.building },
  ];
  byId("purchases-kpis").innerHTML = cards
    .map(
      (card) => `
      <article class="po-kpi">
        <div>
          <div class="po-kpi-label">${card.label}</div>
          <div class="po-kpi-value ${card.tone}${card.mono ? " is-mono" : ""}">${card.value}</div>
        </div>
        <div class="po-kpi-icon ${card.tone}">${card.icon}</div>
      </article>`,
    )
    .join("");
}

function renderList(): void {
  const list = byId<HTMLElement>("purchases-list");
  const visible = orders.filter((order) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "ordered") return order.status === "ordered" || order.status === "partially_received";
    return order.status === statusFilter;
  });
  list.innerHTML = visible.length
    ? visible
        .map(
          (order) => `
            <tr>
              <td class="po-number"><span class="po-file">${ICON.file}</span><span class="po-num">${escapeHtml(order.number)}</span></td>
              <td class="po-vendor">
                <div class="po-vendor-name">${escapeHtml(vendorLabel(order.vendor_id).name)}</div>
                ${vendorLabel(order.vendor_id).company ? `<div class="po-vendor-company">${escapeHtml(vendorLabel(order.vendor_id).company)}</div>` : ""}
              </td>
              <td>${dayLabel(order.order_date)}</td>
              <td>${order.expected_at ? dayLabel(order.expected_at) : "—"}</td>
              <td class="po-total">${money(orderGross(order))}</td>
              <td class="is-center"><span class="po-badge is-${escapeHtml(order.status)}">${statusIcon(order.status)}<span>${statusLabel(order.status)}</span></span></td>
              <td class="po-actions">
                <button type="button" class="po-tile" data-edit="${order.id}" title="Drucken / PDF">${ICON.printer}</button>
                <button type="button" class="po-tile" data-duplicate="${order.id}" title="Duplizieren">${ICON.copy}</button>
                ${
                  order.status === "ordered" || order.status === "partially_received"
                    ? `<button type="button" class="po-receive" data-receive="${order.id}">${ICON.package}<span>Wareneingang<br>buchen</span></button>`
                    : `<button type="button" class="po-status-btn" data-status="${order.id}:ordered">${t("purchasesOrder")}</button>`
                }
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="po-empty">${t("purchasesEmpty")}</td></tr>`;
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-edit]")) {
    button.addEventListener("click", () => openEditor(button.dataset.edit ?? null));
  }
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-duplicate]")) {
    button.addEventListener("click", () => openEditor(button.dataset.duplicate ?? null));
  }
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-receive]")) {
    button.addEventListener("click", () => void receive(button.dataset.receive ?? ""));
  }
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-status]")) {
    button.addEventListener("click", () => void setStatus(button.dataset.status ?? ""));
  }
}

function openEditor(id: string | null = null): void {
  editingId = id;
  const order = orders.find((entry) => entry.id === id);
  const dialog = byId<HTMLDialogElement>("purchases-editor");
  byId<HTMLElement>("purchases-editor-title").textContent = id ? t("purchasesEdit") : t("purchasesNew");
  byId<HTMLButtonElement>("purchases-delete").hidden = !id;
  byId<HTMLInputElement>("purchases-number").value = order?.number ?? "";
  byId<HTMLInputElement>("purchases-expected").value = order?.expected_at ? dateInput(order.expected_at) : "";
  byId<HTMLInputElement>("purchases-note").value = order?.note ?? "";
  const vendor = byId<HTMLSelectElement>("purchases-vendor");
  vendor.innerHTML = vendors.length
    ? vendors.map((entry) => `<option value="${entry.id}">${escapeHtml(contactLabel(entry))}</option>`).join("")
    : `<option value="">${t("purchasesNoVendor")}</option>`;
  vendor.value = order?.vendor_id ?? vendors[0]?.id ?? "";
  byId("purchases-lines").innerHTML = "";
  lineCount = 0;
  for (const line of order?.lines ?? []) {
    addLine(line);
  }
  if (!order?.lines.length) {
    addLine();
  }
  showMessage("");
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeEditor(): void {
  const dialog = byId<HTMLDialogElement>("purchases-editor");
  if (dialog.open) {
    dialog.close();
  }
  editingId = null;
}

function addLine(line?: PurchaseLineView): void {
  const index = lineCount++;
  const container = byId("purchases-lines");
  const row = document.createElement("div");
  row.className = "po-line purchase-line";
  row.dataset.index = String(index);
  row.innerHTML = `
    <div class="po-form-grid">
      <label class="po-field"><span>${t("purchasesProduct")}</span>
        <select data-line-product="${index}">
          <option value="">${t("purchasesSelectProduct")}</option>
          ${products.map((product) => `<option value="${product.id}">${escapeHtml(product.sku || product.name)} · ${escapeHtml(product.name)}</option>`).join("")}
        </select>
      </label>
      <label class="po-field"><span>${t("purchasesDescription")}</span><input data-line-description="${index}" value="${escapeHtml(line?.description ?? "")}" required></label>
    </div>
    <div class="po-form-grid">
      <label class="po-field"><span>${t("purchasesQuantity")}</span><input data-line-quantity="${index}" inputmode="decimal" value="${line ? milliText(line.quantity_milli) : "1"}" required></label>
      <label class="po-field"><span>${t("purchasesUnitCost")}</span><input data-line-cost="${index}" inputmode="decimal" value="${line ? centsToInput(line.unit_cost) : ""}" required></label>
      <label class="po-field"><span>${t("purchasesTaxRate")}</span><input data-line-tax="${index}" type="number" min="0" max="100" step="0.01" value="${line ? line.tax_rate_bp / 100 : 19}"></label>
      <button type="button" class="po-btn is-danger" data-remove-line="${index}">${t("purchasesRemoveLine")}</button>
    </div>`;
  container.append(row);
  row.querySelector<HTMLSelectElement>(`[data-line-product="${index}"]`)!.value = line?.product_id ?? "";
  row.querySelector<HTMLButtonElement>(`[data-remove-line="${index}"]`)!.addEventListener("click", () => {
    row.remove();
  });
}

async function saveOrder(): Promise<void> {
  const lines = [];
  for (const row of byId("purchases-lines").querySelectorAll<HTMLElement>(".purchase-line")) {
    const index = row.dataset.index ?? "0";
    const quantity = parseQuantity(row.querySelector<HTMLInputElement>(`[data-line-quantity="${index}"]`)?.value ?? "");
    const cost = parseCents(row.querySelector<HTMLInputElement>(`[data-line-cost="${index}"]`)?.value ?? "");
    if (quantity === null || cost === null) {
      showMessage(t("purchasesError"));
      return;
    }
    lines.push({
      product_id: row.querySelector<HTMLSelectElement>(`[data-line-product="${index}"]`)?.value || null,
      description: row.querySelector<HTMLInputElement>(`[data-line-description="${index}"]`)?.value.trim() ?? "",
      quantity_milli: quantity,
      unit_cost_cents: cost,
      tax_rate_bp: Math.round(Number(row.querySelector<HTMLInputElement>(`[data-line-tax="${index}"]`)?.value ?? "19") * 100),
    });
  }
  const expected = byId<HTMLInputElement>("purchases-expected").value;
  try {
    await invoke("save_purchase_order", {
      input: {
        id: editingId,
        number: inputValue("purchases-number"),
        vendor_id: byId<HTMLSelectElement>("purchases-vendor").value || null,
        note: inputValue("purchases-note"),
        expected_at: expected ? new Date(`${expected}T12:00:00`).getTime() : null,
        lines,
      },
    });
    closeEditor();
    await loadPurchases();
  } catch (error) {
    showMessage(String(error));
  }
}

async function setStatus(value: string): Promise<void> {
  const [id, status] = value.split(":");
  try {
    await invoke("set_purchase_order_status", { id, status });
    await loadOrders();
  } catch (error) {
    showMessage(String(error));
  }
}

async function receive(id: string): Promise<void> {
  try {
    await invoke("receive_purchase_order", { id });
    await loadOrders();
  } catch (error) {
    showMessage(String(error));
  }
}

async function deleteOrder(): Promise<void> {
  if (!editingId || !(await confirmDialog(t("purchasesDeleteConfirm")))) {
    return;
  }
  try {
    await invoke("delete_purchase_order", { id: editingId });
    closeEditor();
    await loadPurchases();
  } catch (error) {
    showMessage(String(error));
  }
}

function orderGross(order: PurchaseOrderView): number {
  return order.lines.reduce((sum, line) => {
    const net = Math.round((line.unit_cost * line.quantity_milli) / 1000);
    return sum + net + Math.round((net * line.tax_rate_bp) / 10000);
  }, 0);
}

function statusLabel(status: string): string {
  const keys: Record<string, TranslationKey> = {
    draft: "purchasesStatusDraft",
    ordered: "purchasesStatusOrdered",
    partially_received: "purchasesStatusPartial",
    received: "purchasesStatusReceived",
    cancelled: "purchasesStatusCancelled",
  };
  return t(keys[status] ?? "purchasesStatusDraft");
}

function statusIcon(status: string): string {
  if (status === "received") {
    return ICON.check;
  }
  if (status === "ordered" || status === "partially_received") {
    return ICON.truck;
  }
  return ICON.clock;
}

function vendorLabel(id: string): { name: string; company: string } {
  const vendor = vendors.find((entry) => entry.id === id);
  if (!vendor) {
    return { name: "", company: "" };
  }
  const person = [vendor.first_name, vendor.last_name].filter(Boolean).join(" ");
  const company = vendor.company_name || "";
  return { name: person || (company ? "" : vendor.name || ""), company };
}

function contactLabel(contact: ContactView): string {
  if (!contact.id) {
    return "";
  }
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.company_name || contact.name || "";
}

function parseCents(value: string): number | null {
  const compact = value.trim().replace(/\s/g, "");
  if (!compact) {
    return null;
  }
  let normalized = compact;
  if (compact.includes(",") && compact.includes(".")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (compact.includes(",")) {
    normalized = compact.replace(",", ".");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function parseQuantity(value: string): number | null {
  const compact = value.trim().replace(",", ".");
  const amount = Number(compact);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 1000) : null;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function milliText(milli: number): string {
  return (milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/// Money as the TS module prints it (`toFixed(2)` with a dot, no grouping).
function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function dateInput(millis: number): string {
  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(millis: number): string {
  const date = new Date(millis);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

const ICON = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  dollar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  truck:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  building:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8M8 17h5"/></svg>',
  printer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  package:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
};
