//! Reports webview: invoice revenue, payments and tracked time per period.

import { invoke } from "@tauri-apps/api/core";

import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const moneyFormat = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });
const DAY_MS = 86_400_000;

interface ReportRowView {
  number: string;
  contact: string;
  status: string;
  issued_at: number;
  net: number;
  tax: number;
  gross: number;
}

interface ReportSummaryView {
  invoices: number;
  net: number;
  tax: number;
  gross: number;
  paid: number;
  open: number;
  minutes: number;
}

interface ReportView {
  from: number;
  to: number;
  rows: ReportRowView[];
  summary: ReportSummaryView;
  status_totals: number[];
}

const PERIODS: Array<{ days: number; key: TranslationKey }> = [
  { days: 7, key: "reportsPeriod7" },
  { days: 30, key: "reportsPeriod30" },
  { days: 90, key: "reportsPeriod90" },
  { days: 365, key: "reportsPeriod365" },
];

let period = 1;
let report: ReportView | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

export function initReports(): void {
  const view = byId<HTMLElement>("view-reports");
  view.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">${t("reportsEyebrow")}</p>
        <h2>${t("reportsTitle")}</h2>
        <p class="subtitle">${t("reportsSubtitle")}</p>
      </div>
      <div id="reports-periods" class="toolbar"></div>
    </div>
    <div id="reports-kpis" class="kpi-grid"></div>
    <div class="grid">
      <section class="card">
        <h3>${t("reportsStatus")}</h3>
        <div id="reports-status" class="entity-list"></div>
      </section>
      <section class="card">
        <h3>${t("reportsTableTitle")}</h3>
        <div id="reports-table" class="entity-list"></div>
      </section>
    </div>`;
  renderPeriods();
  void loadReports();
}

export async function loadReports(): Promise<void> {
  const selected = PERIODS[period];
  const now = Date.now();
  try {
    report = await invoke<ReportView>("report", { from: now - selected.days * DAY_MS, to: now + 1 });
    render();
  } catch (error) {
    byId("reports-kpis").innerHTML = `<p class="message" data-kind="error">${escapeHtml(String(error))}</p>`;
  }
}

function renderPeriods(): void {
  const container = byId("reports-periods");
  container.innerHTML = PERIODS.map(
    (entry, index) =>
      `<button type="button" class="${index === period ? "primary" : ""}" data-period="${index}">${t(entry.key)}</button>`,
  ).join("");
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-period]")) {
    button.addEventListener("click", () => {
      period = Number(button.dataset.period ?? "1");
      renderPeriods();
      void loadReports();
    });
  }
}

function render(): void {
  if (!report) {
    return;
  }
  const summary = report.summary;
  byId("reports-kpis").innerHTML = [
    [t("reportsInvoices"), String(summary.invoices)],
    [t("reportsNet"), formatMoney(summary.net)],
    [t("reportsGross"), formatMoney(summary.gross)],
    [t("reportsPaid"), formatMoney(summary.paid)],
    [t("reportsOpen"), formatMoney(summary.open)],
    [t("reportsMinutes"), String(summary.minutes)],
  ]
    .map(
      ([label, value]) =>
        `<article class="card kpi"><span>${label}</span><strong>${value}</strong></article>`,
    )
    .join("");

  const statuses: Array<[string, TranslationKey]> = [
    ["draft", "reportsStatusDraft"],
    ["sent", "reportsStatusSent"],
    ["paid", "reportsStatusPaid"],
    ["overdue", "reportsStatusOverdue"],
    ["cancelled", "reportsStatusCancelled"],
  ];
  byId("reports-status").innerHTML = statuses
    .map(
      ([, key], index) =>
        `<article class="entity-row"><span>${t(key)}</span><strong>${formatMoney(report?.status_totals[index] ?? 0)}</strong></article>`,
    )
    .join("");

  byId("reports-table").innerHTML = report.rows.length
    ? report.rows
        .map(
          (row) => `
            <article class="entity-row">
              <div><strong>${escapeHtml(row.number)} · ${escapeHtml(row.contact)}</strong>
              <p class="hint">${dateLabel(row.issued_at)} · ${statusLabel(row.status)}</p></div>
              <div class="row-actions"><span>${formatMoney(row.net)}</span><strong>${formatMoney(row.gross)}</strong></div>
            </article>`,
        )
        .join("")
    : `<p class="hint">${t("reportsEmpty")}</p>`;
}

function statusLabel(status: string): string {
  const keys: Record<string, TranslationKey> = {
    draft: "reportsStatusDraft",
    sent: "reportsStatusSent",
    paid: "reportsStatusPaid",
    overdue: "reportsStatusOverdue",
    cancelled: "reportsStatusCancelled",
  };
  return t(keys[status] ?? "reportsStatusDraft");
}

function formatMoney(cents: number): string {
  return moneyFormat.format(cents / 100);
}

function dateLabel(millis: number): string {
  return new Date(millis).toLocaleDateString(language);
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
