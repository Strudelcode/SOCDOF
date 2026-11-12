//! Purchases webview: purchase orders, lifecycle actions and the goods receipt.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const moneyFormat = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });

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
  const message = byId<HTMLElement>("purchases-message");
  message.textContent = text;
  message.dataset.kind = text ? "error" : "ok";
}

export function initPurchases(): void {
  const view = byId<HTMLElement>("view-purchases");
  view.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">${t("purchasesEyebrow")}</p>
        <h2>${t("purchasesTitle")}</h2>
        <p class="subtitle">${t("purchasesSubtitle")}</p>
      </div>
      <div class="toolbar">
        <button id="purchases-new" class="primary" type="button">${t("purchasesNew")}</button>
      </div>
    </div>
    <div class="kpi-grid" id="purchases-kpis"></div>
    <div class="grid">
      <section class="card">
        <label class="field"><span>${t("purchasesSearch")}</span><input id="purchases-search" type="search"></label>
        <div id="purchases-list" class="entity-list"></div>
      </section>
      <section id="purchases-editor" class="card" hidden>
        <h3 id="purchases-editor-title">${t("purchasesNew")}</h3>
        <form id="purchases-form" class="stack">
          <div class="grid compact">
            <label class="field"><span>${t("purchasesNumber")}</span><input id="purchases-number" required></label>
            <label class="field"><span>${t("purchasesExpected")}</span><input id="purchases-expected" type="date"></label>
          </div>
          <label class="field"><span>${t("purchasesVendor")}</span><select id="purchases-vendor" required></select></label>
          <label class="field"><span>${t("purchasesNote")}</span><input id="purchases-note"></label>
          <div class="section-head-small"><h4>${t("purchasesLines")}</h4><button id="purchases-add-line" type="button">${t("purchasesAddLine")}</button></div>
          <div id="purchases-lines" class="stack"></div>
          <div class="toolbar">
            <button class="primary" type="submit">${t("purchasesSave")}</button>
            <button id="purchases-delete" class="danger" type="button" hidden>${t("purchasesDelete")}</button>
            <button id="purchases-cancel" type="button">${t("cancel")}</button>
            <span id="purchases-message" class="message" role="status"></span>
          </div>
        </form>
      </section>
    </div>`;

  byId("purchases-new").addEventListener("click", () => openEditor());
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
}

export async function loadPurchases(): Promise<void> {
  try {
    [vendors, products] = await Promise.all([
      invoke<ContactView[]>("list_contacts", { query: null }),
      invoke<ProductView[]>("list_products", { query: null }),
    ]);
    vendors = vendors.filter((vendor) => vendor.contact_type === "vendor" || vendor.contact_type === "both");
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
  const open = orders.filter((order) => order.status === "ordered" || order.status === "partially_received");
  const openValue = open.reduce((sum, order) => sum + orderGross(order), 0);
  byId("purchases-kpis").innerHTML = [
    [t("purchasesOpen"), String(open.length)],
    [t("purchasesOpenValue"), formatMoney(openValue)],
    [t("purchasesDraft"), String(orders.filter((order) => order.status === "draft").length)],
    [t("purchasesReceived"), String(orders.filter((order) => order.status === "received").length)],
  ]
    .map(
      ([label, value]) =>
        `<article class="card kpi"><span>${label}</span><strong>${value}</strong></article>`,
    )
    .join("");
}

function renderList(): void {
  const list = byId<HTMLElement>("purchases-list");
  list.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
            <article class="entity-row">
              <div><strong>${escapeHtml(order.number)} · ${escapeHtml(vendorName(order.vendor_id))}</strong>
              <p class="hint">${dateLabel(order.order_date)} · ${statusLabel(order.status)} · ${order.lines.length} ${t("purchasesLines")} · ${formatMoney(orderGross(order))}</p></div>
              <div class="row-actions">
                <button type="button" data-edit="${order.id}">${t("purchasesEdit")}</button>
                ${order.status === "draft" ? `<button type="button" data-status="${order.id}:ordered">${t("purchasesOrder")}</button>` : ""}
                ${order.status === "ordered" || order.status === "partially_received" ? `<button type="button" data-receive="${order.id}">${t("purchasesReceive")}</button>` : ""}
                ${order.status !== "received" && order.status !== "cancelled" ? `<button type="button" data-status="${order.id}:cancelled">${t("purchasesCancel")}</button>` : ""}
              </div>
            </article>`,
        )
        .join("")
    : `<p class="hint">${t("purchasesEmpty")}</p>`;
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-edit]")) {
    button.addEventListener("click", () => openEditor(button.dataset.edit ?? null));
  }
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-status]")) {
    button.addEventListener("click", () => void setStatus(button.dataset.status ?? ""));
  }
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-receive]")) {
    button.addEventListener("click", () => void receive(button.dataset.receive ?? ""));
  }
}

function openEditor(id: string | null = null): void {
  editingId = id;
  const order = orders.find((entry) => entry.id === id);
  byId<HTMLElement>("purchases-editor").hidden = false;
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
}

function closeEditor(): void {
  byId<HTMLElement>("purchases-editor").hidden = true;
  editingId = null;
}

function addLine(line?: PurchaseLineView): void {
  const index = lineCount++;
  const container = byId("purchases-lines");
  const row = document.createElement("div");
  row.className = "stack purchase-line";
  row.dataset.index = String(index);
  row.innerHTML = `
    <div class="grid compact">
      <label class="field"><span>${t("purchasesProduct")}</span>
        <select data-line-product="${index}">
          <option value="">${t("purchasesSelectProduct")}</option>
          ${products.map((product) => `<option value="${product.id}">${escapeHtml(product.sku || product.name)} · ${escapeHtml(product.name)}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>${t("purchasesDescription")}</span><input data-line-description="${index}" value="${escapeHtml(line?.description ?? "")}" required></label>
    </div>
    <div class="grid compact">
      <label class="field"><span>${t("purchasesQuantity")}</span><input data-line-quantity="${index}" inputmode="decimal" value="${line ? milliText(line.quantity_milli) : "1"}" required></label>
      <label class="field"><span>${t("purchasesUnitCost")}</span><input data-line-cost="${index}" inputmode="decimal" value="${line ? centsToInput(line.unit_cost) : ""}" required></label>
      <label class="field"><span>${t("purchasesTaxRate")}</span><input data-line-tax="${index}" type="number" min="0" max="100" step="0.01" value="${line ? line.tax_rate_bp / 100 : 19}"></label>
      <button type="button" class="danger" data-remove-line="${index}">${t("purchasesRemoveLine")}</button>
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

function vendorName(id: string): string {
  return contactLabel(vendors.find((vendor) => vendor.id === id) ?? ({} as ContactView));
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

function formatMoney(cents: number): string {
  return moneyFormat.format(cents / 100);
}

function dateInput(millis: number): string {
  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(millis: number): string {
  return new Date(millis).toLocaleDateString(language);
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
