//! App launcher: one card per module so every screen is reachable, including the
//! modules whose navigation tabs are intentionally hidden in the desktop rail.
//!
//! The layout mirrors the reference launcher (`SOCDOF - TS/src/components/shell/AppLauncher.tsx`):
//! brand header with live clock, search field, four-column card grid with category,
//! title, description and an "open" affordance, plus the local-storage footer notice.
//! The launcher only navigates; each module owns its own data and commands.

import { detectLanguage, translate, type TranslationKey } from "./i18n";
import { settingsIcon } from "./settings_icons";

interface LauncherEntry {
  view: string;
  label: TranslationKey;
  description: TranslationKey;
  category: TranslationKey;
  icon: string;
  tone: string;
}

const entries: LauncherEntry[] = [
  { view: "dashboard", label: "navDashboard", description: "dashboardOverviewSubtitle", category: "launcherCatAnalytics", icon: "monitor", tone: "indigo" },
  { view: "invoices", label: "navInvoices", description: "invoicesSubtitle", category: "launcherCatFinance", icon: "file-text", tone: "violet" },
  { view: "accounting", label: "navAccounting", description: "accountingSubtitle", category: "launcherCatFinance", icon: "credit-card", tone: "emerald" },
  { view: "contacts", label: "navContacts", description: "launcherDescContacts", category: "launcherCatCrm", icon: "circle-user", tone: "sky" },
  { view: "products", label: "navProducts", description: "launcherDescProducts", category: "launcherCatInventory", icon: "hard-drive", tone: "amber" },
  { view: "stock", label: "navStock", description: "launcherDescStock", category: "launcherCatInventory", icon: "hard-drive", tone: "orange" },
  { view: "purchases", label: "navPurchases", description: "purchasesSubtitle", category: "launcherCatFinance", icon: "credit-card", tone: "rose" },
  { view: "pos", label: "navPos", description: "posSubtitle", category: "launcherCatSales", icon: "credit-card", tone: "emerald" },
  { view: "restaurant", label: "navRestaurant", description: "restaurantSubtitle", category: "launcherCatSales", icon: "sparkles", tone: "amber" },
  { view: "calendar", label: "navCalendar", description: "calendarSubtitle", category: "launcherCatPlanning", icon: "calendar", tone: "sky" },
  { view: "projects", label: "navProjects", description: "launcherDescProjects", category: "launcherCatService", icon: "sliders", tone: "violet" },
  { view: "fleet", label: "navFleet", description: "fleetSubtitle", category: "launcherCatService", icon: "globe", tone: "indigo" },
  { view: "support", label: "navSupport", description: "supportSubtitle", category: "launcherCatService", icon: "shield-alert", tone: "rose" },
  { view: "therapy", label: "navTherapy", description: "therapySubtitle", category: "launcherCatService", icon: "circle-user", tone: "emerald" },
  { view: "documents", label: "navDocuments", description: "documentsSubtitle", category: "launcherCatOffice", icon: "file-text", tone: "sky" },
  { view: "templates", label: "navTemplates", description: "templateFormHint", category: "launcherCatOffice", icon: "palette", tone: "amber" },
  { view: "reports", label: "navReports", description: "reportsSubtitle", category: "launcherCatFinance", icon: "download", tone: "violet" },
  { view: "users", label: "navUsers", description: "usersSubtitle", category: "launcherCatSystem", icon: "circle-user", tone: "indigo" },
  { view: "docs", label: "navDocs", description: "docsSubtitle", category: "launcherCatHelp", icon: "file-text", tone: "orange" },
  { view: "settings", label: "navSettings", description: "settingsSubtitle", category: "launcherCatSystem", icon: "settings", tone: "slate" },
];

const language = detectLanguage();
let clockTimer: number | undefined;

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function navigate(view: string): void {
  document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.click();
}

function stopClock(): void {
  if (clockTimer !== undefined) {
    window.clearInterval(clockTimer);
    clockTimer = undefined;
  }
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString(language === "de" ? "de-DE" : language === "fr" ? "fr-FR" : language === "es" ? "es-ES" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function renderLauncher(): void {
  const view = document.getElementById("view-appstore");
  if (!view) {
    return;
  }
  stopClock();
  const cards = entries
    .map(
      (entry) => `
        <button class="launcher-card" type="button" data-view="${entry.view}">
          <span class="launcher-icon ${entry.tone}">${settingsIcon(entry.icon)}</span>
          <span class="launcher-cat">${escapeHtml(translate(language, entry.category))}</span>
          <strong class="launcher-title">${escapeHtml(translate(language, entry.label))}</strong>
          <span class="launcher-desc">${escapeHtml(translate(language, entry.description))}</span>
          <span class="launcher-open">${escapeHtml(translate(language, "launcherOpen"))}${settingsIcon("chevron-right", "settings-icon launcher-arrow")}</span>
        </button>`,
    )
    .join("");
  view.innerHTML = `
    <div class="launcher-shell">
      <header class="launcher-head">
        <div class="launcher-brand">
          <span class="launcher-logo">SOC</span>
          <div class="launcher-heading">
            <h2>${escapeHtml(translate(language, "launcherTitle"))}<span class="launcher-badge">SOCDOF</span></h2>
            <p class="subtitle">${escapeHtml(translate(language, "launcherHint"))}</p>
          </div>
        </div>
        <p class="launcher-clock">${settingsIcon("clock", "settings-icon")}<time id="launcher-time">${formatTime()}</time><span class="launcher-live">${escapeHtml(translate(language, "launcherRealtime"))}</span></p>
      </header>
      <label class="field launcher-search"><span>${escapeHtml(translate(language, "launcherSearch"))}</span><input id="launcher-search" type="search"></label>
      <div id="launcher-grid" class="launcher-grid">${cards}</div>
      <p id="launcher-empty" class="hint" hidden>${escapeHtml(translate(language, "launcherEmpty"))}</p>
      <footer class="launcher-footer">${settingsIcon("shield-check", "settings-icon")}<span>${escapeHtml(translate(language, "launcherFooter"))}</span></footer>
    </div>`;
  const time = view.querySelector<HTMLElement>("#launcher-time");
  clockTimer = window.setInterval(() => {
    if (time) {
      time.textContent = formatTime();
    }
  }, 1000);
  const search = view.querySelector<HTMLInputElement>("#launcher-search");
  const grid = view.querySelector<HTMLElement>("#launcher-grid");
  const empty = view.querySelector<HTMLElement>("#launcher-empty");
  search?.addEventListener("input", () => {
    const needle = (search.value ?? "").trim().toLowerCase();
    let visible = 0;
    for (const card of grid?.querySelectorAll<HTMLElement>(".launcher-card") ?? []) {
      const match = !needle || (card.textContent ?? "").toLowerCase().includes(needle);
      card.hidden = !match;
      if (match) {
        visible += 1;
      }
    }
    if (empty) {
      empty.hidden = visible > 0;
    }
  });
  for (const card of view.querySelectorAll<HTMLButtonElement>(".launcher-card")) {
    card.addEventListener("click", () => navigate(card.dataset.view ?? ""));
  }
}
