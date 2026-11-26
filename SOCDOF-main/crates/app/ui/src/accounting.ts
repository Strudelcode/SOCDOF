//! Accounting webview: journal, cash book, BWA and CSV export.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const moneyFormat = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });

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

interface BwaRowView {
  account: string;
  revenue: number;
  expense: number;
}

interface JournalSummaryView {
  rows: BwaRowView[];
  revenue_net: number;
  expense_net: number;
  tax_collected: number;
  tax_paid: number;
}

interface CashBookRowView {
  entry: JournalEntryView;
  balance: number;
}

interface DialogReply {
  outcome: "chosen" | "cancelled" | "acknowledged" | "error";
  path: string | null;
  error: string | null;
}

let tab: "journal" | "cash" | "bwa" = "journal";
let entries: JournalEntryView[] = [];
let summary: JournalSummaryView | null = null;
let cashBook: CashBookRowView[] = [];
let query = "";
let editingId: string | null = null;

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

function setValue(id: string, value: string): void {
  byId<HTMLInputElement>(id).value = value;
}

function showMessage(text: string): void {
  const message = byId<HTMLElement>("accounting-message");
  message.textContent = text;
  message.dataset.kind = text ? "error" : "ok";
}

export function initAccounting(): void {
  const view = byId<HTMLElement>("view-accounting");
  view.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">${t("accountingEyebrow")}</p>
        <h2>${t("accountingTitle")}</h2>
        <p class="subtitle">${t("accountingSubtitle")}</p>
      </div>
      <div class="toolbar">
        <button id="accounting-new" class="primary" type="button">${t("accountingNew")}</button>
        <button id="accounting-export" type="button">${t("accountingExport")}</button>
      </div>
    </div>
    <div class="tabs sub-tabs" role="tablist">
      <button class="tab is-active" type="button" data-accounting-tab="journal">${t("accountingTabJournal")}</button>
      <button class="tab" type="button" data-accounting-tab="cash">${t("accountingTabCash")}</button>
      <button class="tab" type="button" data-accounting-tab="bwa">${t("accountingTabBwa")}</button>
    </div>
    <div class="kpi-grid" id="accounting-kpis"></div>
    <div class="grid">
      <section class="card">
        <div class="toolbar">
          <label class="field grow"><span>${t("accountingSearch")}</span><input id="accounting-search" type="search"></label>
        </div>
        <div id="accounting-list" class="entity-list"></div>
      </section>
      <section id="accounting-editor" class="card" hidden>
        <h3 id="accounting-editor-title">${t("accountingNew")}</h3>
        <form id="accounting-form" class="stack">
          <label class="field"><span>${t("accountingDescription")}</span><input id="accounting-description" required></label>
          <div class="grid compact">
            <label class="field"><span>${t("accountingAccount")}</span><input id="accounting-account" required></label>
            <label class="field"><span>${t("accountingCounterAccount")}</span><input id="accounting-counter" required></label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("accountingAmount")}</span><input id="accounting-amount" inputmode="decimal" required></label>
            <label class="field"><span>${t("accountingTaxRate")}</span><input id="accounting-tax" type="number" min="0" max="100" step="0.01" value="19"></label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("accountingKind")}</span>
              <select id="accounting-kind">
                <option value="income">${t("accountingIncome")}</option>
                <option value="expense">${t("accountingExpense")}</option>
              </select>
            </label>
            <label class="field"><span>${t("accountingChannel")}</span>
              <select id="accounting-channel">
                <option value="bank">${t("accountingBank")}</option>
                <option value="cash">${t("accountingCash")}</option>
              </select>
            </label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("accountingDate")}</span><input id="accounting-date" type="date" required></label>
            <label class="field"><span>${t("accountingReference")}</span><input id="accounting-reference"></label>
          </div>
          <div class="toolbar">
            <button class="primary" type="submit">${t("accountingSave")}</button>
            <button id="accounting-delete" class="danger" type="button" hidden>${t("accountingDelete")}</button>
            <button id="accounting-cancel" type="button">${t("cancel")}</button>
            <span id="accounting-message" class="message" role="status"></span>
          </div>
        </form>
      </section>
    </div>`;

  for (const button of view.querySelectorAll<HTMLButtonElement>("[data-accounting-tab]")) {
    button.addEventListener("click", () => {
      tab = (button.dataset.accountingTab as typeof tab) ?? "journal";
      for (const item of view.querySelectorAll<HTMLButtonElement>("[data-accounting-tab]")) {
        item.classList.toggle("is-active", item === button);
      }
      renderList();
    });
  }
  byId("accounting-new").addEventListener("click", () => openEditor());
  byId("accounting-export").addEventListener("click", () => void exportCsv());
  byId("accounting-cancel").addEventListener("click", closeEditor);
  byId("accounting-delete").addEventListener("click", () => void deleteEntry());
  byId<HTMLFormElement>("accounting-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveEntry();
  });
  byId("accounting-search").addEventListener("input", () => {
    query = inputValue("accounting-search");
    void loadEntries();
  });
}

export async function loadAccounting(): Promise<void> {
  try {
    [summary, cashBook] = await Promise.all([
      invoke<JournalSummaryView>("journal_summary"),
      invoke<CashBookRowView[]>("journal_cash_book"),
    ]);
    await loadEntries();
  } catch (error) {
    showMessage(String(error));
  }
}

async function loadEntries(): Promise<void> {
  try {
    entries = await invoke<JournalEntryView[]>("journal_entries", { query: query || null });
    renderKpis();
    renderList();
  } catch (error) {
    showMessage(String(error));
  }
}

function renderKpis(): void {
  if (!summary) {
    return;
  }
  const result = summary.revenue_net - summary.expense_net;
  const tax = summary.tax_collected - summary.tax_paid;
  byId("accounting-kpis").innerHTML = [
    [t("accountingRevenue"), summary.revenue_net],
    [t("accountingExpenses"), summary.expense_net],
    [t("accountingResult"), result],
    [t("accountingTaxBalance"), tax],
  ]
    .map(
      ([label, value]) =>
        `<article class="card kpi"><span>${label}</span><strong>${formatMoney(Number(value))}</strong></article>`,
    )
    .join("");
}

function renderList(): void {
  const list = byId<HTMLElement>("accounting-list");
  if (tab === "bwa") {
    const rows = summary?.rows ?? [];
    list.innerHTML = rows.length
      ? rows
          .map(
            (row) => `
              <article class="entity-row">
                <div><strong>${escapeHtml(row.account)}</strong>
                <p class="hint">${t("accountingRevenue")}: ${formatMoney(row.revenue)} · ${t("accountingExpenses")}: ${formatMoney(row.expense)}</p></div>
                <strong>${formatMoney(row.revenue - row.expense)}</strong>
              </article>`,
          )
          .join("")
      : `<p class="hint">${t("accountingEmpty")}</p>`;
    return;
  }
  if (tab === "cash") {
    list.innerHTML = cashBook.length
      ? cashBook
          .map(
            (row) => `
              <article class="entity-row">
                <div><strong>${escapeHtml(row.entry.description)}</strong>
                <p class="hint">${dateLabel(row.entry.booked_at)} · ${escapeHtml(row.entry.account)} · ${formatMoney(signed(row.entry))}</p></div>
                <strong>${formatMoney(row.balance)}</strong>
              </article>`,
          )
          .join("")
      : `<p class="hint">${t("accountingEmpty")}</p>`;
    return;
  }
  list.innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="entity-row">
              <div><strong>${escapeHtml(entry.description)}</strong>
              <p class="hint">${dateLabel(entry.booked_at)} · ${escapeHtml(entry.account)} / ${escapeHtml(entry.counter_account)} · ${entry.kind === "income" ? t("accountingIncome") : t("accountingExpense")} · ${entry.channel === "cash" ? t("accountingCash") : t("accountingBank")}</p></div>
              <div class="row-actions"><strong>${formatMoney(signed(entry))}</strong>
              <button type="button" data-edit="${entry.id}">${t("accountingEdit")}</button></div>
            </article>`,
        )
        .join("")
    : `<p class="hint">${t("accountingEmpty")}</p>`;
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-edit]")) {
    button.addEventListener("click", () => openEditor(button.dataset.edit ?? null));
  }
}

function openEditor(id: string | null = null): void {
  editingId = id;
  const entry = entries.find((row) => row.id === id);
  byId<HTMLElement>("accounting-editor").hidden = false;
  byId<HTMLElement>("accounting-editor-title").textContent = id ? t("accountingEdit") : t("accountingNew");
  byId<HTMLButtonElement>("accounting-delete").hidden = !id;
  setValue("accounting-description", entry?.description ?? "");
  setValue("accounting-account", entry?.account ?? "");
  setValue("accounting-counter", entry?.counter_account ?? "");
  setValue("accounting-amount", entry ? centsToInput(entry.amount) : "");
  setValue("accounting-tax", entry ? (entry.tax_rate_bp / 100).toFixed(2) : "19");
  byId<HTMLSelectElement>("accounting-kind").value = entry?.kind ?? "income";
  byId<HTMLSelectElement>("accounting-channel").value = entry?.channel ?? "bank";
  setValue("accounting-date", entry ? dateInput(entry.booked_at) : dateInput(Date.now()));
  setValue("accounting-reference", entry?.reference ?? "");
  showMessage("");
}

function closeEditor(): void {
  byId<HTMLElement>("accounting-editor").hidden = true;
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

async function exportCsv(): Promise<void> {
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: `journal-${dateInput(Date.now())}.csv`,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      return;
    }
    const bytes = await invoke<number>("export_journal_csv", { path: reply.path });
    showMessage(`${t("accountingExported")} ${bytes}`);
  } catch (error) {
    showMessage(String(error));
  }
}

function signed(entry: JournalEntryView): number {
  return entry.kind === "expense" ? -entry.amount : entry.amount;
}

function formatMoney(cents: number): string {
  return moneyFormat.format(cents / 100);
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

function dateLabel(millis: number): string {
  return new Date(millis).toLocaleDateString(language);
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
