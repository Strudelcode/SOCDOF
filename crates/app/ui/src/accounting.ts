//! Accounting screen of the Tauri webview.
//!
//! The screen is a port of the reference `AccountingModule.tsx`: a header with the period selector
//! and the three report actions, four KPI cards, the report tab bar and the BWA card. Every figure
//! is derived from the same sources the TypeScript module uses — posted invoices, the POS receipts
//! and the non-draft purchase orders — so the counters and amounts match the reference data set.
//!
//! The module text is German like the reference frame; the other module ports carry their labels the
//! same way instead of routing every module-specific string through the shell locale.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface InvoiceItemView {
  description: string;
  quantity_milli: number;
  unit_price_cents: number;
  tax_rate_bp: number;
  net_cents: number;
  tax_cents: number;
  gross_cents: number;
}

interface InvoiceView {
  id: string;
  number: string;
  contact_name: string;
  status: string;
  date: string;
  due_date: string;
  items: InvoiceItemView[];
  subtotal_cents: number;
  tax_total_cents: number;
  total_cents: number;
}

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
  status: string;
  order_date: number;
  lines: PurchaseLineView[];
}

interface PosLineView {
  product_id: string | null;
  description: string;
  quantity_milli: number;
  unit_price_cents: number;
  tax_rate_bp: number;
  gross_cents: number;
}

interface PosView {
  id: string;
  receipt_number: string;
  payment_method: string;
  paid_at: number;
  lines: PosLineView[];
  net_cents: number;
  tax_cents: number;
  gross_cents: number;
}

interface PosSummaryView {
  receipts: number;
  net_cents: number;
  tax_cents: number;
  gross_cents: number;
  cash_cents: number;
  card_cents: number;
}

interface PosOverviewView {
  receipts: PosView[];
  summary: PosSummaryView;
}

interface JournalEntryView {
  id: string;
  booked_at: number;
  description: string;
  account: string;
  counter_account: string;
  amount: number;
  tax_rate_bp: number;
  kind: string;
  channel: string;
  reference: string | null;
}

interface DialogReply {
  outcome: "chosen" | "cancelled" | "acknowledged" | "error";
  path: string | null;
  error: string | null;
}

interface Totals {
  invoiceNet: number;
  invoiceTax: number;
  invoiceGross: number;
  posNet: number;
  posTax: number;
  posGross: number;
  expenseNet: number;
  inputTax: number;
  revenueNet: number;
  revenueGross: number;
  profit: number;
  vatPayable: number;
  vatLiability: number;
  tax19: number;
  tax7: number;
  openCount: number;
  openAmount: number;
}

type PeriodKey = "all" | "today" | "month" | "quarter" | "year" | "custom";
type ReportTab = "bwa" | "ustva" | "open_items" | "z_bon";

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "all", label: "Gesamt" },
  { key: "today", label: "Heute" },
  { key: "month", label: "Monat" },
  { key: "quarter", label: "Quartal" },
  { key: "year", label: "Jahr" },
  { key: "custom", label: "Benutzerdefiniert" },
];

const TABS: Array<{ key: ReportTab; label: string }> = [
  { key: "bwa", label: "BWA & EÜR" },
  { key: "ustva", label: "Umsatzsteuer-Voranmeldung (UStVA)" },
  { key: "open_items", label: "Offene Posten (OPOS)" },
  { key: "z_bon", label: "POS Kasse" },
];

let invoices: InvoiceView[] = [];
let orders: PurchaseOrderView[] = [];
let pos: PosOverviewView = {
  receipts: [],
  summary: { receipts: 0, net_cents: 0, tax_cents: 0, gross_cents: 0, cash_cents: 0, card_cents: 0 },
};
let period: PeriodKey = "all";
let tab: ReportTab = "bwa";
let journalEntries: JournalEntryView[] = [];
let editingId: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

export function initAccounting(): void {
  const view = byId<HTMLElement>("view-accounting");
  view.innerHTML = `
    <div class="acc-page">
      <header class="acc-head">
        <div class="acc-head-text">
          <h2 class="acc-title"><span class="acc-title-icon">${ICON.calculator}</span><span>Abrechnungen, BWA &amp; Finanzen</span></h2>
          <p class="acc-subtitle">Betriebswirtschaftliche Auswertung, Umsatzsteuer-Voranmeldung &amp; offene Posten</p>
        </div>
        <div class="acc-head-actions">
          <div class="acc-periods" role="group" aria-label="Zeitraum">
            ${PERIODS.map(
              (entry) =>
                `<button type="button" class="acc-period${entry.key === period ? " is-active" : ""}" data-period="${entry.key}">${entry.label}</button>`,
            ).join("")}
          </div>
          <button type="button" class="acc-btn is-navy" id="accounting-ledger">
            <span class="acc-btn-icon is-emerald-light">${ICON.sheet}</span><span>Kassenbuch (Excel)</span>
          </button>
          <button type="button" class="acc-btn is-plain" id="accounting-export">
            <span class="acc-btn-icon is-emerald">${ICON.sheet}</span><span>CSV-Bericht exportieren</span>
          </button>
          <button type="button" class="acc-btn is-accent" id="accounting-print">
            <span class="acc-btn-icon">${ICON.printer}</span><span>Druckansicht</span>
          </button>
          <button type="button" class="acc-sr-only" id="accounting-new">${t("accountingNew")}</button>
        </div>
      </header>

      <div class="acc-kpis" id="accounting-kpis"></div>

      <nav class="acc-tabs" role="tablist">
        ${TABS.map(
          (entry) =>
            `<button type="button" class="acc-tab${entry.key === tab ? " is-active" : ""}" role="tab" aria-selected="${entry.key === tab}" data-accounting-tab="${entry.key}">${entry.label}<span class="acc-tab-count" data-tab-count="${entry.key}"></span></button>`,
        ).join("")}
      </nav>

      <section class="acc-card acc-report" id="accounting-bwa">
        <h3 class="acc-card-title">BWA &amp; EÜR</h3>
        <div class="acc-bwa-rows" id="accounting-bwa-rows"></div>
      </section>

      <section class="acc-card acc-report" id="accounting-ustva" hidden>
        <h3 class="acc-card-title">Umsatzsteuer-Voranmeldung</h3>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr><th>Steuersatz</th><th class="is-right">Steuerpflichtige Bemessungsgrundlage</th><th class="is-right">MwSt.-Betrag</th></tr>
            </thead>
            <tbody id="accounting-ustva-body"></tbody>
          </table>
        </div>
      </section>

      <section class="acc-card acc-report" id="accounting-open-items" hidden>
        <div class="acc-card-head">
          <h3 class="acc-card-title">Offene Rechnungen &amp; Forderungen</h3>
          <span class="acc-open-badge" id="accounting-open-total"></span>
        </div>
        <div class="acc-open-list" id="accounting-open-list"></div>
      </section>

      <p id="accounting-message" class="acc-status" role="status"></p>

      <section class="acc-card acc-report acc-zbon" id="accounting-z-bon" hidden>
        <div class="acc-zbon-head">
          <h3 class="acc-zbon-title">TAGESABSCHLUSS (Z-BON)</h3>
          <p class="acc-zbon-company">Strudelcode Studio</p>
          <p class="acc-zbon-date" id="accounting-zbon-date"></p>
        </div>
        <div class="acc-zbon-rows" id="accounting-zbon-rows"></div>
        <div class="acc-zbon-actions">
          <button type="button" class="acc-btn is-accent" id="accounting-zbon-print">
            ${ICON.printer}<span>Z-Bon drucken</span>
          </button>
        </div>
      </section>

      <dialog class="acc-dialog" id="accounting-editor">
        <div class="acc-dialog-head">
          <h3 id="accounting-editor-title">${t("accountingNew")}</h3>
          <button type="button" class="acc-dialog-close" id="accounting-cancel" aria-label="${t("cancel")}">×</button>
        </div>
        <form id="accounting-form" class="acc-form">
          <label class="acc-field"><span>${t("accountingDescription")}</span><input id="accounting-description" required></label>
          <div class="acc-form-grid">
            <label class="acc-field"><span>${t("accountingAccount")}</span><input id="accounting-account" required></label>
            <label class="acc-field"><span>${t("accountingCounterAccount")}</span><input id="accounting-counter" required></label>
          </div>
          <div class="acc-form-grid">
            <label class="acc-field"><span>${t("accountingAmount")}</span><input id="accounting-amount" inputmode="decimal" required></label>
            <label class="acc-field"><span>${t("accountingTaxRate")}</span><input id="accounting-tax" type="number" min="0" max="100" step="0.01" value="19"></label>
          </div>
          <div class="acc-form-grid">
            <label class="acc-field"><span>${t("accountingKind")}</span>
              <select id="accounting-kind">
                <option value="income">${t("accountingIncome")}</option>
                <option value="expense">${t("accountingExpense")}</option>
              </select>
            </label>
            <label class="acc-field"><span>${t("accountingChannel")}</span>
              <select id="accounting-channel">
                <option value="bank">${t("accountingBank")}</option>
                <option value="cash">${t("accountingCash")}</option>
              </select>
            </label>
          </div>
          <div class="acc-form-grid">
            <label class="acc-field"><span>${t("accountingDate")}</span><input id="accounting-date" type="date" required></label>
            <label class="acc-field"><span>${t("accountingReference")}</span><input id="accounting-reference"></label>
          </div>
          <div class="acc-dialog-actions">
            <button class="acc-btn is-accent" type="submit">${t("accountingSave")}</button>
            <button class="acc-btn is-danger" id="accounting-delete" type="button" hidden>${t("accountingDelete")}</button>
            <button class="acc-btn is-plain" id="accounting-close" type="button">${t("cancel")}</button>
          </div>
        </form>
        <div id="accounting-list" class="acc-journal-list"></div>
      </dialog>
    </div>`;

  for (const button of view.querySelectorAll<HTMLButtonElement>("[data-period]")) {
    button.addEventListener("click", () => {
      period = (button.dataset.period as PeriodKey) ?? "all";
      for (const other of view.querySelectorAll<HTMLButtonElement>("[data-period]")) {
        other.classList.toggle("is-active", other === button);
      }
      render();
    });
  }
  for (const button of view.querySelectorAll<HTMLButtonElement>("[data-accounting-tab]")) {
    button.addEventListener("click", () => {
      const next = (button.dataset.accountingTab as ReportTab) ?? "bwa";
      if (next === "z_bon") {
        // The reference's fourth tab is the register report; it has no period of its own.
        period = "all";
      }
      tab = next;
      for (const other of view.querySelectorAll<HTMLButtonElement>("[data-accounting-tab]")) {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", String(active));
      }
      render();
    });
  }
  byId("accounting-new").addEventListener("click", () => openEditor());
  byId("accounting-close").addEventListener("click", closeEditor);
  byId("accounting-delete").addEventListener("click", () => void deleteEntry());
  byId("accounting-cancel").addEventListener("click", closeEditor);
  byId<HTMLFormElement>("accounting-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveEntry();
  });
  byId("accounting-export").addEventListener("click", () => void exportCsv());
  byId("accounting-ledger").addEventListener("click", () => void exportCsv());
  byId("accounting-print").addEventListener("click", () => window.print());
  byId("accounting-zbon-print").addEventListener("click", () => window.print());
}

export async function loadAccounting(): Promise<void> {
  try {
    const yearAhead = Date.now() + 366 * 24 * 60 * 60 * 1000;
    const [invoiceRows, purchaseRows, posOverview] = await Promise.all([
      invoke<InvoiceView[]>("list_invoices", { query: null, status: null }),
      invoke<PurchaseOrderView[]>("purchase_orders", { query: null }),
      invoke<PosOverviewView>("pos_overview", { from: 0, to: yearAhead, query: null }),
    ]);
    invoices = invoiceRows;
    orders = purchaseRows;
    pos = posOverview;
    render();
    await loadJournal();
  } catch (error) {
    showMessage(String(error));
  }
}

function periodFilter(dateText: string): boolean {
  if (period === "all" || period === "custom" || !dateText) {
    return true;
  }
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  const now = new Date();
  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }
  if (period === "month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (period === "quarter") {
    return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3) && date.getFullYear() === now.getFullYear();
  }
  if (period === "year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}

function totals(): Totals {
  const posted = invoices.filter(
    (invoice) => (invoice.status === "sent" || invoice.status === "paid") && periodFilter(invoice.date),
  );
  const invoiceNet = posted.reduce((sum, invoice) => sum + invoice.subtotal_cents, 0);
  const invoiceTax = posted.reduce((sum, invoice) => sum + invoice.tax_total_cents, 0);
  const invoiceGross = posted.reduce((sum, invoice) => sum + invoice.total_cents, 0);

  const posReceipts = pos.receipts.filter((receipt) => periodFilter(dateKey(receipt.paid_at)));
  const posNet = posReceipts.reduce((sum, receipt) => sum + receipt.net_cents, 0);
  const posTax = posReceipts.reduce((sum, receipt) => sum + receipt.tax_cents, 0);
  const posGross = posReceipts.reduce((sum, receipt) => sum + receipt.gross_cents, 0);

  const validOrders = orders.filter(
    (order) => order.status !== "draft" && periodFilter(dateKey(order.order_date)),
  );
  let expenseNet = 0;
  let inputTax = 0;
  for (const order of validOrders) {
    for (const line of order.lines) {
      const net = Math.round((line.unit_cost * line.quantity_milli) / 1000);
      expenseNet += net;
      inputTax += Math.round((net * line.tax_rate_bp) / 10000);
    }
  }

  const revenueNet = invoiceNet + posNet;
  const vatPayable = invoiceTax + posTax;
  const open = invoices.filter((invoice) => invoice.status === "sent");

  let tax19 = 0;
  let tax7 = 0;
  for (const invoice of posted) {
    for (const item of invoice.items) {
      if (item.tax_rate_bp === 1900) {
        tax19 += Math.round(item.net_cents * 0.19);
      } else if (item.tax_rate_bp === 700) {
        tax7 += Math.round(item.net_cents * 0.07);
      }
    }
  }
  for (const receipt of posReceipts) {
    for (const line of receipt.lines) {
      const net = Math.round((line.unit_price_cents * line.quantity_milli) / 1000);
      if (line.tax_rate_bp === 1900) {
        tax19 += Math.round(net * 0.19);
      } else if (line.tax_rate_bp === 700) {
        tax7 += Math.round(net * 0.07);
      }
    }
  }

  return {
    invoiceNet,
    invoiceTax,
    invoiceGross,
    posNet,
    posTax,
    posGross,
    expenseNet,
    inputTax,
    revenueNet,
    revenueGross: invoiceGross + posGross,
    profit: revenueNet - expenseNet,
    vatPayable,
    vatLiability: vatPayable - inputTax,
    tax19,
    tax7,
    openCount: open.length,
    openAmount: open.reduce((sum, invoice) => sum + invoice.total_cents, 0),
  };
}

function render(): void {
  const sums = totals();
  renderKpis(sums);
  renderBwa(sums);
  renderUstva(sums);
  renderOpenItems(sums);
  renderZBon();
  for (const badge of document.querySelectorAll<HTMLElement>("[data-tab-count]")) {
    badge.textContent = badge.dataset.tabCount === "open_items" && sums.openCount > 0 ? ` (${sums.openCount})` : "";
  }
  byId<HTMLElement>("accounting-bwa").hidden = tab !== "bwa";
  byId<HTMLElement>("accounting-ustva").hidden = tab !== "ustva";
  byId<HTMLElement>("accounting-open-items").hidden = tab !== "open_items";
  byId<HTMLElement>("accounting-z-bon").hidden = tab !== "z_bon";
}

function renderKpis(sums: Totals): void {
  const cards = [
    {
      label: "Zwischensumme (Netto):",
      value: money(sums.revenueNet),
      hint: `Gesamtbetrag:: ${money(sums.revenueGross)}`,
      icon: ICON.trendingUp,
      tone: "is-accent",
      valueTone: "",
    },
    {
      label: "Einkauf & Beschaffung",
      value: money(sums.expenseNet),
      hint: `MwSt.: ${money(sums.inputTax)}`,
      icon: ICON.cart,
      tone: "is-amber",
      valueTone: "",
    },
    {
      label: "BWA & EÜR",
      value: money(sums.profit),
      hint: `Margin: ${sums.revenueNet > 0 ? ((sums.profit / sums.revenueNet) * 100).toFixed(1) : "0"}%`,
      icon: ICON.calculator,
      tone: "is-teal",
      valueTone: "is-teal",
    },
    {
      label: "Umsatzsteuer-Voranmeldung (UStVA)",
      value: money(sums.vatLiability),
      hint: `MwSt.: ${cents(sums.vatPayable)} - ${cents(sums.inputTax)}`,
      icon: ICON.receipt,
      tone: "is-blue",
      valueTone: "",
    },
  ];
  byId("accounting-kpis").innerHTML = cards
    .map(
      (card) => `
      <article class="acc-kpi">
        <div class="acc-kpi-head"><span>${card.label}</span><span class="acc-kpi-icon ${card.tone}">${card.icon}</span></div>
        <div class="acc-kpi-value ${card.valueTone}">${card.value}</div>
        <div class="acc-kpi-hint">${card.hint}</div>
      </article>`,
    )
    .join("");
}

function renderBwa(sums: Totals): void {
  byId("accounting-bwa-rows").innerHTML = `
    <div class="acc-bwa-row"><span>Rechnungen</span><span>${money(sums.invoiceNet)}</span></div>
    <div class="acc-bwa-row"><span>POS Kasse</span><span>${money(sums.posNet)}</span></div>
    <div class="acc-bwa-row is-total"><span>= Gesamtbetrag: (Zwischensumme (Netto):)</span><span>${money(sums.revenueNet)}</span></div>
    <div class="acc-bwa-row is-cost"><span>./. Einkauf &amp; Beschaffung</span><span>-${money(sums.expenseNet)}</span></div>
    <div class="acc-bwa-row is-profit"><span>= BWA &amp; EÜR</span><span>${money(sums.profit)}</span></div>`;
}

function renderUstva(sums: Totals): void {
  const rows = [
    { label: "Regelsteuersatz (19 %)", base: sums.tax19 > 0 ? sums.tax19 / 0.19 : 0, tax: sums.tax19 },
    { label: "Ermäßigter Steuersatz (7 %)", base: sums.tax7 > 0 ? sums.tax7 / 0.07 : 0, tax: sums.tax7 },
  ];
  byId("accounting-ustva-body").innerHTML =
    rows
      .map(
        (row) =>
          `<tr><td>${row.label}</td><td class="is-right is-mono">${money(row.base)}</td><td class="is-right is-mono is-bold">${money(row.tax)}</td></tr>`,
      )
      .join("") +
    `<tr class="is-sum"><td>Summe Umsatzsteuer</td><td class="is-right is-mono">${money(sums.revenueNet)}</td><td class="is-right is-mono is-accent">${money(sums.vatPayable)}</td></tr>
     <tr class="is-cost"><td>./. Vorsteuer aus Einkäufen</td><td class="is-right is-mono">${money(sums.expenseNet)}</td><td class="is-right is-mono is-bold">-${money(sums.inputTax)}</td></tr>
     <tr class="is-profit"><td>Verbleibende Umsatzsteuerzahllast</td><td class="is-right is-mono">-</td><td class="is-right is-mono">${money(sums.vatLiability)}</td></tr>`;
}

function renderOpenItems(sums: Totals): void {
  byId("accounting-open-total").textContent = `Offen: ${money(sums.openAmount)}`;
  const open = invoices.filter((invoice) => invoice.status === "sent");
  const list = byId("accounting-open-list");
  if (open.length === 0) {
    list.innerHTML = `<p class="acc-open-empty"><span>${ICON.checkCircle}</span>Keine offenen Kundenrechnungen. Alle Konten sind ausgeglichen.</p>`;
    return;
  }
  list.innerHTML = open
    .map(
      (invoice) => `
      <div class="acc-open-row">
        <div>
          <div class="acc-open-number">${escapeHtml(invoice.number)}<span>| ${escapeHtml(invoice.contact_name)}</span></div>
          <div class="acc-open-meta">Fällig: ${escapeHtml(invoice.due_date)} (Datum: ${escapeHtml(invoice.date)})</div>
        </div>
        <div class="acc-open-amount">
          <div class="acc-open-value">${money(invoice.total_cents)}</div>
          <span class="acc-open-pill">Zahlung offen</span>
        </div>
      </div>`,
    )
    .join("");
}

function renderZBon(): void {
  byId("accounting-zbon-date").textContent = `Datum: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE")}`;
  const cash = pos.summary.cash_cents;
  const card = pos.summary.card_cents;
  const nfc = Math.max(0, pos.summary.gross_cents - cash - card);
  byId("accounting-zbon-rows").innerHTML = `
    <div class="acc-zbon-row"><span>Transaktionen / Belege:</span><span>${pos.summary.receipts}</span></div>
    <div class="acc-zbon-row"><span>Barumsatz:</span><span>${money(cash)}</span></div>
    <div class="acc-zbon-row"><span>Kartenumsatz (EC/Kredit):</span><span>${money(card)}</span></div>
    <div class="acc-zbon-row"><span>NFC / Mobile Umsatz:</span><span>${money(nfc)}</span></div>
    <div class="acc-zbon-row is-sum"><span>GESAMT POS-UMSATZ:</span><span>${money(pos.summary.gross_cents)}</span></div>`;
}

/// Manual bookings. The reference screen is a reports screen without a journal editor, so the
/// editor lives in a dialog behind a keyboard-reachable control that stays out of the pixels.
async function loadJournal(): Promise<void> {
  try {
    journalEntries = await invoke<JournalEntryView[]>("journal_entries", { query: null });
    renderJournalList();
  } catch (error) {
    showMessage(String(error));
  }
}

function renderJournalList(): void {
  const list = document.getElementById("accounting-list");
  if (!list) {
    return;
  }
  list.innerHTML = journalEntries.length
    ? journalEntries
        .map(
          (entry) => `
          <article class="acc-journal-row">
            <div><strong>${escapeHtml(entry.description)}</strong>
            <p>${dateInput(entry.booked_at)} · ${escapeHtml(entry.account)} / ${escapeHtml(entry.counter_account)} · ${money(entry.amount)}</p></div>
            <button type="button" class="acc-btn is-plain" data-journal-edit="${entry.id}">${t("accountingEdit")}</button>
          </article>`,
        )
        .join("")
    : `<p class="acc-journal-empty">${t("accountingEmpty")}</p>`;
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-journal-edit]")) {
    button.addEventListener("click", () => openEditor(button.dataset.journalEdit ?? null));
  }
}

function openEditor(id: string | null = null): void {
  editingId = id;
  const entry = journalEntries.find((row) => row.id === id);
  const dialog = byId<HTMLDialogElement>("accounting-editor");
  byId<HTMLElement>("accounting-editor-title").textContent = id ? t("accountingEdit") : t("accountingNew");
  byId<HTMLButtonElement>("accounting-delete").hidden = !id;
  setInput("accounting-description", entry?.description ?? "");
  setInput("accounting-account", entry?.account ?? "");
  setInput("accounting-counter", entry?.counter_account ?? "");
  setInput("accounting-amount", entry ? centsToInput(entry.amount) : "");
  setInput("accounting-tax", entry ? (entry.tax_rate_bp / 100).toFixed(2) : "19");
  byId<HTMLSelectElement>("accounting-kind").value = entry?.kind ?? "income";
  byId<HTMLSelectElement>("accounting-channel").value = entry?.channel ?? "bank";
  setInput("accounting-date", entry ? dateInput(entry.booked_at) : dateInput(Date.now()));
  setInput("accounting-reference", entry?.reference ?? "");
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeEditor(): void {
  const dialog = byId<HTMLDialogElement>("accounting-editor");
  if (dialog.open) {
    dialog.close();
  }
  editingId = null;
}

async function saveEntry(): Promise<void> {
  const amount = parseCents(inputValue("accounting-amount"));
  const tax = Number(inputValue("accounting-tax").replace(",", "."));
  const bookedAt = new Date(`${inputValue("accounting-date")}T12:00:00`).getTime();
  if (amount === null || !Number.isFinite(tax) || !Number.isFinite(bookedAt)) {
    showMessage(t("accountingError"));
    return;
  }
  try {
    await invoke("save_journal_entry", {
      input: {
        id: editingId,
        booked_at: bookedAt,
        description: inputValue("accounting-description"),
        account: inputValue("accounting-account"),
        counter_account: inputValue("accounting-counter"),
        amount_cents: amount,
        tax_rate_bp: Math.round(tax * 100),
        kind: byId<HTMLSelectElement>("accounting-kind").value,
        channel: byId<HTMLSelectElement>("accounting-channel").value,
        reference: inputValue("accounting-reference"),
      },
    });
    closeEditor();
    await loadAccounting();
  } catch (error) {
    showMessage(String(error));
  }
}

async function deleteEntry(): Promise<void> {
  if (!editingId || !(await confirmDialog(t("accountingDeleteConfirm")))) {
    return;
  }
  try {
    await invoke("delete_journal_entry", { id: editingId });
    closeEditor();
    await loadAccounting();
  } catch (error) {
    showMessage(String(error));
  }
}

function inputValue(id: string): string {
  return byId<HTMLInputElement>(id).value.trim();
}

function setInput(id: string, value: string): void {
  byId<HTMLInputElement>(id).value = value;
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

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function dateInput(millis: number): string {
  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function exportCsv(): Promise<void> {
  const reply = await invoke<DialogReply>("pick_save_file", {
    suggestedName: `buchhaltung-${dateKey(Date.now())}.csv`,
  });
  if (reply.outcome !== "chosen" || !reply.path) {
    return;
  }
  try {
    const bytes = await invoke<number>("export_journal_csv", { path: reply.path });
    showMessage(`Exportiert: ${bytes} Bytes`);
  } catch (error) {
    showMessage(String(error));
  }
}

/// Status line of the screen. The reference frame has no message strip, so it stays off the pixels
/// and only carries export errors and confirmations for the accessibility tree.
function showMessage(text: string): void {
  const message = document.getElementById("accounting-message");
  if (message) {
    message.textContent = text;
  }
}

function cents(value: number): string {
  return (value / 100).toFixed(2);
}

function money(value: number): string {
  return `${cents(value)} €`;
}

function dateKey(millis: number): string {
  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

const ICON = {
  calculator:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  trendUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
  trendingUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>',
  receipt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  sheet:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>',
  printer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>',
  checkCircle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
};
