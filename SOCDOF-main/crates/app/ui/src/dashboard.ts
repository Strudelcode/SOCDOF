//! Dashboard webview: period key figures, recent invoices and reorder list.

import { invoke } from "@tauri-apps/api/core";

import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const numberFormat = new Intl.NumberFormat(language);
const moneyFormat = new Intl.NumberFormat(language, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium" });

type Period = "all" | "today" | "month" | "quarter" | "year" | "custom";

interface DashboardSummary {
  contacts: number;
  products: number;
  low_stock: number;
  invoices: number;
  draft_invoices: number;
  open_invoices: number;
  overdue_invoices: number;
  paid_invoices: number;
  gross: number;
  paid: number;
  open: number;
  overdue: number;
  draft: number;
  inventory_cost: number;
  inventory_retail: number;
  pos_sales: number;
  pos_count: number;
  upcoming_appointments: number;
}

interface DashboardInvoice {
  number: string;
  contact: string;
  status: string;
  issued_at: number;
  gross: number;
  currency_symbol: string;
}

interface DashboardLowStock {
  name: string;
  sku: string;
  stock: number;
  reorder_level: number;
  unit: string;
}

interface DashboardView {
  company: string;
  summary: DashboardSummary;
  recent: DashboardInvoice[];
  low_stock: DashboardLowStock[];
}

let period: Period = "all";
let customFrom = "";
let customTo = "";

function dateInputValue(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number, symbol = "€"): string {
  return `${moneyFormat.format(cents / 100)} ${escapeHtml(symbol)}`;
}

function periodRange(): { from: number; to: number; now: number } {
  const now = Date.now();
  if (period === "all") {
    return { from: 0, to: now, now };
  }

  const date = new Date(now);
  const year = date.getFullYear();
  const month = date.getMonth();
  if (period === "custom") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : now;
    const to = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : now;
    return { from, to, now };
  }
  let from: number;
  if (period === "today") {
    from = new Date(year, month, date.getDate()).getTime();
  } else if (period === "month") {
    from = new Date(year, month, 1).getTime();
  } else if (period === "quarter") {
    from = new Date(year, Math.floor(month / 3) * 3, 1).getTime();
  } else {
    from = new Date(year, 0, 1).getTime();
  }
  return { from, to: now, now };
}

function periodLabel(value: Period): string {
  if (value === "today") {
    return t("calendarToday");
  }
  if (value === "custom") {
    return t("dashboardPeriodCustom");
  }
  return t(`dashboardPeriod${value.charAt(0).toUpperCase()}${value.slice(1)}` as TranslationKey);
}

function statusLabel(status: string): string {
  const key = `dashboardStatus${status.charAt(0).toUpperCase()}${status.slice(1)}` as TranslationKey;
  return t(key);
}

const SOCDOF_LOGO = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="socdof-bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#252932"/><stop offset="100%" stop-color="#14171d"/></linearGradient><filter id="socdof-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.4"/></filter></defs><rect x="5" y="5" width="90" height="90" rx="22" ry="22" fill="url(#socdof-bg)" filter="url(#socdof-shadow)"/><path d="M 5 32 C 5 17 17 5 32 5" stroke="#22c55e" stroke-width="5.5" stroke-linecap="round"/><path d="M 68 5 C 83 5 95 17 95 32" stroke="#38bdf8" stroke-width="5.5" stroke-linecap="round"/><path d="M 95 68 C 95 83 83 95 68 95" stroke="#ef4444" stroke-width="5.5" stroke-linecap="round"/><path d="M 32 95 C 17 95 5 83 5 68" stroke="#f59e0b" stroke-width="5.5" stroke-linecap="round"/><rect x="8" y="8" width="84" height="84" rx="19" ry="19" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/><text x="50" y="66.5" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="52" fill="#ffffff" letter-spacing="-1">S</text></svg>`;

function icon(name: string): string {
  const paths: Record<string, string> = {
    revenue: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    inventory: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/>',
    products: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    contact: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    invoice: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    cash: '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
    shoppingBag: '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    arrowLeftRight: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    stock: '<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/>',
  };
  return `<svg class="stat-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.invoice}</svg>`;
}

function kpi(label: string, value: string, hint: string, glyph: string, tone: string): string {
  return `
    <article class="stat-card ${tone}">
      <div class="stat-card-top">
        <span>${escapeHtml(label)}</span>
        <span class="stat-icon">${icon(glyph)}</span>
      </div>
      <div class="stat-value">${value}</div>
      <div class="stat-foot"><span>${hint}</span><span class="stat-arrow">${icon("arrowUpRight")}</span></div>
    </article>`;
}

function render(view: DashboardView): void {
  const summary = view.summary;
  const title = view.company.trim() || "SOCDOF";
  const empty = summary.contacts === 0 && summary.products === 0 && summary.invoices === 0;
  const recent = view.recent.length
    ? view.recent
        .map(
          (invoice) => `
            <tr>
              <td>${escapeHtml(invoice.number)}</td>
              <td>${escapeHtml(invoice.contact)}</td>
              <td><span class="badge status-${escapeHtml(invoice.status)}">${escapeHtml(statusLabel(invoice.status))}</span></td>
              <td>${escapeHtml(dateFormat.format(new Date(invoice.issued_at)))}</td>
              <td class="numeric">${money(invoice.gross, invoice.currency_symbol)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="5">${escapeHtml(t("dashboardNoInvoices"))}</td></tr>`;

  const lowStock = view.low_stock.length
    ? view.low_stock
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.sku || "–")}</td>
              <td class="numeric">${numberFormat.format(row.stock)} ${escapeHtml(row.unit)}</td>
              <td class="numeric">${numberFormat.format(row.reorder_level)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="4">${escapeHtml(t("dashboardNoReorder"))}</td></tr>`;

  byId("dashboard-overview").innerHTML = `
    <section class="page-head dashboard-head">
      <div>
        <h2>${escapeHtml(t("dashboardOverviewTitle"))} &amp; Kennzahlen</h2>
        <p class="subtitle">${escapeHtml(t("dashboardOverviewSubtitle"))}</p>
      </div>
      <div class="period-filter" role="tablist">
        ${(["all", "today", "month", "quarter", "year", "custom"] as Period[])
          .map(
            (value) => `
              <button type="button" role="tab" data-dashboard-period="${value}"
                class="${value === period ? "is-active" : ""}"
                aria-selected="${value === period}">
                ${escapeHtml(periodLabel(value))}
              </button>`,
          )
          .join("")}
        <div class="custom-range" ${period === "custom" ? "" : "hidden"}>
          <input type="date" id="dashboard-from" aria-label="Von" value="${escapeHtml(customFrom || dateInputValue(Date.now()))}">
          <input type="date" id="dashboard-to" aria-label="Bis" value="${escapeHtml(customTo || dateInputValue(Date.now()))}">
        </div>
      </div>
    </section>

    <section class="dash-kpis">
      ${kpi(t("dashboardRevenue"), money(summary.gross), `${icon("circleCheck")} ${money(summary.paid)} ${escapeHtml(t("dashboardStatusPaid").toLowerCase())}`, "revenue", "primary")}
      ${kpi(t("dashboardOpen"), money(summary.open), `${summary.open_invoices} ${escapeHtml(t("dashboardOpenHint"))}`, "receipt", "open")}
      ${kpi(t("dashboardCash"), money(summary.pos_sales), `${icon("shoppingBag")} ${summary.pos_count} ${escapeHtml(t("dashboardCashCount"))}`, "cash", "cash")}
      ${kpi(t("dashboardInventory"), money(summary.inventory_cost), `VK: ${money(summary.inventory_retail)}`, "inventory", "inventory")}
      ${kpi(t("dashboardProducts"), `<span class="stat-value-inline">${numberFormat.format(summary.products)}<span class="stat-unit">${escapeHtml(t("dashboardProductsHint"))}</span></span>`, summary.low_stock > 0 ? `${icon("circleCheck")} ${summary.low_stock} ${escapeHtml(t("dashboardLowStockHint").toLowerCase())}` : `${icon("circleCheck")} ${escapeHtml(t("dashboardNoReorder"))}`, "warning", "products")}
    </section>

    <section class="launchpad">
      <div class="block-heading">
        <h3>Schnell-Startcenter</h3>
        <p>Direkt in Ihre täglichen Workflows springen</p>
      </div>
      <div class="launchpad-grid">
        <button type="button" class="launch-card" data-dashboard-view="invoices">
          <span class="launch-icon primary">${icon("fileText")}</span>
          <span><strong>${escapeHtml(t("dashboardNewInvoice"))}</strong><small>${escapeHtml(t("dashboardQuickInvoiceSub"))}</small></span>
          <span class="launch-arrow">${icon("arrow")}</span>
        </button>
        <button type="button" class="launch-card" data-dashboard-view="restaurant">
          <span class="launch-icon warning">${icon("shoppingBag")}</span>
          <span><strong>${escapeHtml(t("dashboardNewProduct"))}</strong><small>${escapeHtml(t("dashboardQuickCashSub"))}</small></span>
          <span class="launch-arrow">${icon("arrow")}</span>
        </button>
        <button type="button" class="launch-card" data-dashboard-view="contacts">
          <span class="launch-icon primary">${icon("userPlus")}</span>
          <span><strong>${escapeHtml(t("dashboardNewContact"))}</strong><small>${escapeHtml(t("dashboardQuickContactSub"))}</small></span>
          <span class="launch-arrow">${icon("arrow")}</span>
        </button>
        <button type="button" class="launch-card" data-dashboard-view="products">
          <span class="launch-icon warning">${icon("arrowLeftRight")}</span>
          <span><strong>${escapeHtml(t("dashboardOpenSettings"))}</strong><small>${escapeHtml(t("dashboardQuickStockSub"))}</small></span>
          <span class="launch-arrow">${icon("arrow")}</span>
        </button>
      </div>
    </section>

    ${empty ? `
    <section class="welcome-panel">
      <div class="welcome-logo">${SOCDOF_LOGO}</div>
      <h3>Willkommen bei ${escapeHtml(title)}</h3>
      <p>Ihre lokale Datenbank ist betriebsbereit und vollständig auf 0 initialisiert. Legen Sie direkt mit Ihren echten Kunden, Artikeln oder Rechnungen los:</p>
      <div class="welcome-steps">
        <button type="button" data-dashboard-view="contacts"><span class="launch-icon primary">${icon("contact")}</span><strong>1. Ersten Kontakt anlegen</strong><small>Kunden oder Lieferanten mit Adresse und Steuernummer erfassen.</small><span class="welcome-cta">Jetzt anlegen →</span></button>
        <button type="button" data-dashboard-view="products"><span class="launch-icon companion">${icon("products")}</span><strong>2. Artikel &amp; Preise</strong><small>Produkte, Dienstleistungen sowie Einstands- und Verkaufspreise pflegen.</small><span class="welcome-cta">Artikelkatalog öffnen →</span></button>
        <button type="button" data-dashboard-view="invoices"><span class="launch-icon primary">${icon("invoice")}</span><strong>3. Erste Rechnung erstellen</strong><small>Eine professionelle Rechnung nach DIN 5008 schreiben und drucken.</small><span class="welcome-cta">Rechnung schreiben →</span></button>
      </div>
    </section>` : ""}

    <div class="journal-grid">
      <section class="panel">
        <div class="panel-head"><h3>${escapeHtml(t("dashboardRecentInvoices"))}</h3><button type="button" class="text-link" data-dashboard-view="invoices">${escapeHtml(t("dashboardRecentInvoices"))} →</button></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>${escapeHtml(t("dashboardColNumber"))}</th><th>${escapeHtml(t("dashboardColCustomer"))}</th><th>${escapeHtml(t("dashboardColStatus"))}</th><th>${escapeHtml(t("dashboardColDate"))}</th><th class="numeric">${escapeHtml(t("dashboardColTotal"))}</th></tr></thead>
            <tbody>${recent}</tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>${escapeHtml(t("dashboardReorder"))}</h3><button type="button" class="text-link" data-dashboard-view="products">${escapeHtml(t("productsTitle"))} →</button></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>${escapeHtml(t("dashboardColProduct"))}</th><th>${escapeHtml(t("dashboardColSku"))}</th><th class="numeric">${escapeHtml(t("dashboardColStock"))}</th><th class="numeric">${escapeHtml(t("dashboardColReorderLevel"))}</th></tr></thead>
            <tbody>${lowStock}</tbody>
          </table>
        </div>
      </section>
    </div>
    <p class="message" id="dashboard-message" role="status"></p>`;

  for (const button of byId("dashboard-overview").querySelectorAll<HTMLButtonElement>(
    "[data-dashboard-period]",
  )) {
    button.addEventListener("click", () => {
      period = button.dataset.dashboardPeriod as Period;
      if (period === "custom" && !customFrom) {
        const now = Date.now();
        customFrom = dateInputValue(now);
        customTo = dateInputValue(now);
      }
      void loadDashboard();
    });
  }
  const fromInput = document.getElementById("dashboard-from") as HTMLInputElement | null;
  const toInput = document.getElementById("dashboard-to") as HTMLInputElement | null;
  fromInput?.addEventListener("change", () => {
    customFrom = fromInput.value;
    void loadDashboard();
  });
  toInput?.addEventListener("change", () => {
    customTo = toInput.value;
    void loadDashboard();
  });
  for (const button of byId("dashboard-overview").querySelectorAll<HTMLButtonElement>(
    "[data-dashboard-view]",
  )) {
    button.addEventListener("click", () => {
      const target = document.querySelector<HTMLButtonElement>(
        `[data-view="${button.dataset.dashboardView}"]`,
      );
      target?.click();
    });
  }
}

export function initDashboard(): void {
  byId("dashboard-overview").innerHTML = `
    <section class="section-head">
      <div>
        <p class="eyebrow">${escapeHtml(t("dashboardEyebrow"))}</p>
        <h2>${escapeHtml(t("dashboardOverviewTitle"))}</h2>
        <p class="subtitle">${escapeHtml(t("dashboardOverviewSubtitle"))}</p>
      </div>
    </section>
    <p class="message" id="dashboard-message" role="status">${escapeHtml(t("loading"))}</p>`;
}

export async function loadDashboard(): Promise<void> {
  const message = document.getElementById("dashboard-message");
  if (message) {
    message.textContent = t("loading");
    message.dataset.kind = "";
  }
  try {
    const { from, to, now } = periodRange();
    const view = await invoke<DashboardView>("dashboard", { from, to, now });
    render(view);
    const current = document.getElementById("dashboard-message");
    if (current) {
      current.textContent = "";
    }
  } catch (error) {
    const current = document.getElementById("dashboard-message");
    if (current) {
      current.textContent = `${t("dashboardError")}: ${String(error)}`;
      current.dataset.kind = "error";
    }
  }
}
