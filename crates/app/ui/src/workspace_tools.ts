//! Calculator, widgets, task view and the language selection dialog.

import { invoke } from "@tauri-apps/api/core";

import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const numberFormat = new Intl.NumberFormat(language);
const moneyFormat = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });

interface DashboardSummary {
  gross: number;
  open: number;
  contacts: number;
  products: number;
}

interface DashboardPayload {
  summary: DashboardSummary;
}

interface Desktop {
  id: string;
  name: string;
}

interface WindowEntry {
  id: string;
  title: string;
}

const DESKTOPS_KEY = "socdof.desktops";
const WIDGET_KEY = "socdof.widgets";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function backdrop(id: string, className: string): HTMLElement {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement("div");
    element.id = id;
    element.className = className;
    element.hidden = true;
    document.body.appendChild(element);
  }
  return element;
}

function hide(element: HTMLElement): void {
  element.hidden = true;
}

function show(element: HTMLElement): void {
  element.hidden = false;
}

/* ---------------------------------------------------------------- calculator */

interface CalculatorState {
  display: string;
  expression: string;
  previous: number | null;
  operator: string | null;
  waiting: boolean;
  history: { expression: string; result: string }[];
}

const calculator: CalculatorState = {
  display: "0",
  expression: "",
  previous: null,
  operator: null,
  waiting: false,
  history: [],
};

try {
  const stored = localStorage.getItem("socdof.calc.history");
  if (stored) {
    calculator.history = JSON.parse(stored) as { expression: string; result: string }[];
  }
} catch {
  calculator.history = [];
}

function calcResult(value: number): string {
  if (!Number.isFinite(value)) {
    return t("calcError");
  }
  return String(Math.round(value * 1e12) / 1e12);
}

function calcApply(): void {
  if (calculator.previous === null || !calculator.operator) {
    return;
  }
  const current = Number(calculator.display.replace(",", "."));
  const previous = calculator.previous;
  let result = current;
  switch (calculator.operator) {
    case "+":
      result = previous + current;
      break;
    case "-":
      result = previous - current;
      break;
    case "*":
      result = previous * current;
      break;
    case "/":
      result = current === 0 ? Number.POSITIVE_INFINITY : previous / current;
      break;
    case "%":
      result = previous * (current / 100);
      break;
    default:
      break;
  }
  const expression = `${calcResult(previous)} ${calculator.operator} ${calcResult(current)}`;
  const formatted = calcResult(result);
  calculator.history.unshift({ expression, result: formatted });
  calculator.history = calculator.history.slice(0, 30);
  localStorage.setItem("socdof.calc.history", JSON.stringify(calculator.history));
  calculator.display = formatted;
  calculator.expression = `${expression} =`;
  calculator.previous = null;
  calculator.operator = null;
  calculator.waiting = true;
  renderCalculator();
}

function calcInput(value: string): void {
  if (calculator.waiting) {
    calculator.display = value === "." ? "0." : value;
    calculator.expression = "";
    calculator.waiting = false;
    return;
  }
  if (value === "." && calculator.display.includes(".")) {
    return;
  }
  calculator.display = calculator.display === "0" && value !== "." ? value : calculator.display + value;
}

function calcOperator(operator: string): void {
  if (calculator.previous !== null && calculator.operator && !calculator.waiting) {
    calcApply();
  }
  calculator.previous = Number(calculator.display.replace(",", "."));
  calculator.operator = operator;
  calculator.expression = `${calcResult(calculator.previous)} ${operator}`;
  calculator.waiting = true;
}

function calcUnary(kind: "sqrt" | "square" | "inverse" | "negate" | "pi"): void {
  const value = Number(calculator.display.replace(",", "."));
  let result = value;
  if (kind === "sqrt") result = Math.sqrt(value);
  if (kind === "square") result = value * value;
  if (kind === "inverse") result = value === 0 ? Number.POSITIVE_INFINITY : 1 / value;
  if (kind === "negate") result = -value;
  if (kind === "pi") result = Math.PI;
  calculator.display = calcResult(result);
  calculator.waiting = true;
}

function renderCalculator(): void {
  const overlay = backdrop("calculator-overlay", "tool-overlay");
  overlay.innerHTML = `
    <section class="tool-window calculator-window" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("calcTitle"))}">
      <header class="tool-head">
        <div><p class="eyebrow">${escapeHtml(t("calcEyebrow"))}</p><h2>${escapeHtml(t("calcTitle"))}</h2></div>
        <button type="button" class="icon-button" data-calc-close aria-label="${escapeHtml(t("close"))}">×</button>
      </header>
      <div class="calc-layout">
        <div class="calc-main">
          <div class="calc-screen"><p class="calc-expression">${escapeHtml(calculator.expression || " ")}</p><p class="calc-display">${escapeHtml(calculator.display)}</p></div>
          <div class="calc-keypad">
            ${[
              ["C", "clear"], ["⌫", "back"], ["±", "negate"], ["÷", "op:/"],
              ["7", "7"], ["8", "8"], ["9", "9"], ["×", "op:*"],
              ["4", "4"], ["5", "5"], ["6", "6"], ["−", "op:-"],
              ["1", "1"], ["2", "2"], ["3", "3"], ["+", "op:+"],
              ["√", "sqrt"], ["0", "0"], [".", "."], ["=", "equals"],
            ]
              .map(([label, action]) => `<button type="button" data-calc-action="${escapeHtml(action)}" class="${action === "equals" ? "primary" : ""}">${escapeHtml(label)}</button>`)
              .join("")}
          </div>
          <div class="calc-extra">
            <button type="button" data-calc-action="square">x²</button>
            <button type="button" data-calc-action="inverse">1/x</button>
            <button type="button" data-calc-action="pi">π</button>
            <button type="button" data-calc-action="op:%">%</button>
          </div>
        </div>
        <aside class="calc-history">
          <h3>${escapeHtml(t("calcHistory"))}</h3>
          ${calculator.history.length
            ? calculator.history.map((entry) => `<button type="button" class="calc-history-row" data-calc-history="${escapeHtml(entry.result)}"><small>${escapeHtml(entry.expression)}</small><strong>${escapeHtml(entry.result)}</strong></button>`).join("")
            : `<p class="hint">${escapeHtml(t("calcEmptyHistory"))}</p>`}
          ${calculator.history.length ? `<button type="button" class="secondary" data-calc-clear-history>${escapeHtml(t("calcClearHistory"))}</button>` : ""}
        </aside>
      </div>
    </section>`;

  overlay.querySelector("[data-calc-close]")?.addEventListener("click", () => hide(overlay));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide(overlay);
  });
  for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-calc-action]")) {
    button.addEventListener("click", () => {
      const action = button.dataset.calcAction ?? "";
      if (action === "clear") {
        calculator.display = "0";
        calculator.expression = "";
        calculator.previous = null;
        calculator.operator = null;
        calculator.waiting = false;
      } else if (action === "back") {
        calculator.display = calculator.display.length > 1 ? calculator.display.slice(0, -1) : "0";
      } else if (action === "negate" || action === "sqrt" || action === "square" || action === "inverse" || action === "pi") {
        calcUnary(action);
      } else if (action === "equals") {
        calcApply();
      } else if (action.startsWith("op:")) {
        calcOperator(action.slice(3));
      } else {
        calcInput(action);
      }
      renderCalculator();
    });
  }
  for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-calc-history]")) {
    button.addEventListener("click", () => {
      calculator.display = button.dataset.calcHistory ?? "0";
      calculator.waiting = true;
      renderCalculator();
    });
  }
  overlay.querySelector("[data-calc-clear-history]")?.addEventListener("click", () => {
    calculator.history = [];
    localStorage.removeItem("socdof.calc.history");
    renderCalculator();
  });
  show(overlay);
}

export function openCalculator(): void {
  renderCalculator();
}

/* ------------------------------------------------------------------ widgets */

let widgetTimer: number | null = null;

export function openWidgets(): void {
  const overlay = backdrop("widgets-overlay", "tool-overlay widgets-overlay");
  const visible = (() => {
    try {
      return JSON.parse(localStorage.getItem(WIDGET_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  })();
  const state = { clock: true, date: true, notes: true, kpis: true, ...visible };
  overlay.innerHTML = `
    <section class="tool-window widgets-window" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("widgetsTitle"))}">
      <header class="tool-head">
        <div><p class="eyebrow">${escapeHtml(t("widgetsEyebrow"))}</p><h2>${escapeHtml(t("widgetsTitle"))}</h2><p class="hint">${escapeHtml(t("widgetsHint"))}</p></div>
        <button type="button" class="icon-button" data-widgets-close aria-label="${escapeHtml(t("close"))}">×</button>
      </header>
      <div class="widget-toggles">
        ${(["clock", "date", "notes", "kpis"] as const)
          .map((key) => `<label><input type="checkbox" data-widget-toggle="${key}" ${state[key] ? "checked" : ""}> ${escapeHtml(t(`widgets${key.charAt(0).toUpperCase()}${key.slice(1)}` as TranslationKey))}</label>`)
          .join("")}
      </div>
      <div class="widget-grid">
        <article class="widget clock-widget" data-widget="clock"><span data-widget-time>--:--</span><small data-widget-day></small></article>
        <article class="widget date-widget" data-widget="date"><strong data-widget-date></strong><small>${escapeHtml(t("widgetsDate"))}</small></article>
        <article class="widget notes-widget" data-widget="notes"><h3>${escapeHtml(t("widgetsNotes"))}</h3><textarea data-widget-note placeholder="${escapeHtml(t("widgetsNotePlaceholder"))}">${escapeHtml(localStorage.getItem("socdof.widgets.note") ?? "")}</textarea></article>
        <article class="widget kpi-widget" data-widget="kpis"><h3>${escapeHtml(t("widgetsKpis"))}</h3><div data-widget-kpis class="widget-kpis"><span>${escapeHtml(t("loading"))}</span></div></article>
      </div>
    </section>`;

  const renderVisibility = () => {
    for (const card of overlay.querySelectorAll<HTMLElement>("[data-widget]")) {
      card.hidden = !state[card.dataset.widget as keyof typeof state];
    }
    localStorage.setItem(WIDGET_KEY, JSON.stringify(state));
  };
  const updateClock = () => {
    const now = new Date();
    const time = overlay.querySelector("[data-widget-time]");
    const day = overlay.querySelector("[data-widget-day]");
    const date = overlay.querySelector("[data-widget-date]");
    if (time) time.textContent = now.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    if (day) day.textContent = now.toLocaleDateString(language, { weekday: "long" });
    if (date) date.textContent = now.toLocaleDateString(language, { day: "2-digit", month: "long", year: "numeric" });
  };
  updateClock();
  widgetTimer = window.setInterval(updateClock, 1000);

  for (const checkbox of overlay.querySelectorAll<HTMLInputElement>("[data-widget-toggle]")) {
    checkbox.addEventListener("change", () => {
      state[checkbox.dataset.widgetToggle as keyof typeof state] = checkbox.checked;
      renderVisibility();
    });
  }
  const note = overlay.querySelector<HTMLTextAreaElement>("[data-widget-note]");
  note?.addEventListener("input", () => localStorage.setItem("socdof.widgets.note", note.value));
  overlay.querySelector("[data-widgets-close]")?.addEventListener("click", () => closeWidgets());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeWidgets();
  });
  renderVisibility();
  show(overlay);

  void invoke<DashboardPayload>("dashboard", { from: 0, to: Date.now(), now: Date.now() })
    .then((payload) => {
      const target = overlay.querySelector("[data-widget-kpis]");
      if (target) {
        target.innerHTML = `<div><span>${escapeHtml(t("dashboardRevenue"))}</span><strong>${moneyFormat.format(payload.summary.gross / 100)}</strong></div>` +
          `<div><span>${escapeHtml(t("dashboardOpen"))}</span><strong>${moneyFormat.format(payload.summary.open / 100)}</strong></div>` +
          `<div><span>${escapeHtml(t("dashboardContacts"))}</span><strong>${numberFormat.format(payload.summary.contacts)}</strong></div>` +
          `<div><span>${escapeHtml(t("dashboardProducts"))}</span><strong>${numberFormat.format(payload.summary.products)}</strong></div>`;
      }
    })
    .catch((error) => {
      const target = overlay.querySelector("[data-widget-kpis]");
      if (target) target.textContent = String(error);
    });
}

function closeWidgets(): void {
  if (widgetTimer !== null) {
    window.clearInterval(widgetTimer);
    widgetTimer = null;
  }
  const overlay = document.getElementById("widgets-overlay");
  if (overlay) hide(overlay);
}

/* ----------------------------------------------------------------- task view */

function loadDesktops(): Desktop[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DESKTOPS_KEY) ?? "null") as Desktop[] | null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // fall through to the defaults
  }
  return [
    { id: "desktop-1", name: "Desktop 1" },
    { id: "desktop-2", name: "Desktop 2" },
  ];
}

export function openTaskView(): void {
  const overlay = backdrop("taskview-overlay", "tool-overlay taskview-overlay");
  const desktops = loadDesktops();
  let active = localStorage.getItem("socdof.desktop.active") ?? desktops[0].id;
  const windows: WindowEntry[] = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view]"))
    .map((tab) => ({ id: tab.dataset.view ?? "", title: tab.textContent?.trim() || tab.dataset.view || "" }))
    .filter((entry) => entry.id);

  const render = () => {
    overlay.innerHTML = `
      <section class="tool-window taskview-window" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("taskviewTitle"))}">
        <header class="tool-head">
          <div><p class="eyebrow">${escapeHtml(t("taskviewEyebrow"))}</p><h2>${escapeHtml(t("taskviewTitle"))}</h2><p class="hint">${escapeHtml(t("taskviewHint"))}</p></div>
          <button type="button" class="icon-button" data-taskview-close aria-label="${escapeHtml(t("close"))}">×</button>
        </header>
        <div class="desktop-strip">
          ${desktops
            .map(
              (desktop) => `<button type="button" class="desktop-card ${desktop.id === active ? "is-active" : ""}" data-desktop="${escapeHtml(desktop.id)}">
                <span class="desktop-preview">${escapeHtml(String(desktop.name.charAt(0)))}</span>
                <strong>${escapeHtml(desktop.name)}</strong>
                ${desktops.length > 1 ? `<span class="desktop-remove" data-desktop-remove="${escapeHtml(desktop.id)}">×</span>` : ""}
              </button>`,
            )
            .join("")}
          <button type="button" class="desktop-card desktop-add" data-desktop-add><span class="desktop-preview">+</span><strong>${escapeHtml(t("taskviewNewDesktop"))}</strong></button>
        </div>
        <div class="task-window-grid">
          ${windows
            .map(
              (window) => `<button type="button" class="task-window-card" data-task-window="${escapeHtml(window.id)}">
                <span class="task-window-icon">${escapeHtml(window.title.charAt(0))}</span>
                <strong>${escapeHtml(window.title)}</strong>
                <small>${escapeHtml(t("taskviewOpenWindow"))}</small>
              </button>`,
            )
            .join("")}
        </div>
      </section>`;

    overlay.querySelector("[data-taskview-close]")?.addEventListener("click", () => hide(overlay));
    for (const card of overlay.querySelectorAll<HTMLButtonElement>("[data-desktop]")) {
      card.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).dataset.desktopRemove) return;
        active = card.dataset.desktop ?? active;
        localStorage.setItem("socdof.desktop.active", active);
        render();
      });
    }
    for (const remove of overlay.querySelectorAll<HTMLElement>("[data-desktop-remove]")) {
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = remove.dataset.desktopRemove;
        const index = desktops.findIndex((desktop) => desktop.id === id);
        if (index >= 0) desktops.splice(index, 1);
        if (active === id) active = desktops[0]?.id ?? "desktop-1";
        localStorage.setItem(DESKTOPS_KEY, JSON.stringify(desktops));
        render();
      });
    }
    overlay.querySelector("[data-desktop-add]")?.addEventListener("click", () => {
      desktops.push({ id: `desktop-${Date.now()}`, name: `${t("taskviewDesktop")} ${desktops.length + 1}` });
      localStorage.setItem(DESKTOPS_KEY, JSON.stringify(desktops));
      render();
    });
    for (const card of overlay.querySelectorAll<HTMLButtonElement>("[data-task-window]")) {
      card.addEventListener("click", () => {
        hide(overlay);
        document.querySelector<HTMLButtonElement>(`[data-view="${card.dataset.taskWindow}"]`)?.click();
      });
    }
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) hide(overlay);
    });
  };
  render();
  show(overlay);
}

/* ------------------------------------------------------------------ language */

export function openLanguageModal(): void {
  const overlay = backdrop("language-overlay", "tool-overlay");
  const current = detectLanguage();
  const options = [
    ["de", "Deutsch", "Deutsch"],
    ["en", "English", "English"],
    ["fr", "Français", "Français"],
    ["es", "Español", "Español"],
  ];
  overlay.innerHTML = `
    <section class="tool-window language-window" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("languageTitle"))}">
      <header class="tool-head">
        <div><p class="eyebrow">${escapeHtml(t("languageEyebrow"))}</p><h2>${escapeHtml(t("languageTitle"))}</h2><p class="hint">${escapeHtml(t("languageHint"))}</p></div>
        <button type="button" class="icon-button" data-language-close aria-label="${escapeHtml(t("close"))}">×</button>
      </header>
      <div class="language-grid">
        ${options
          .map(
            ([code, name, native]) => `<button type="button" class="language-card ${code === current ? "is-active" : ""}" data-language="${code}">
              <span class="language-code">${code.toUpperCase()}</span><strong>${escapeHtml(native)}</strong><small>${escapeHtml(name)}</small>
            </button>`,
          )
          .join("")}
      </div>
    </section>`;
  overlay.querySelector("[data-language-close]")?.addEventListener("click", () => hide(overlay));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide(overlay);
  });
  for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-language]")) {
    button.addEventListener("click", () => {
      localStorage.setItem("socdof.language", button.dataset.language ?? "de");
      window.location.reload();
    });
  }
  show(overlay);
}

export function initWorkspaceTools(): void {
  document.getElementById("calculator-open")?.addEventListener("click", () => openCalculator());
  document.getElementById("widgets-open")?.addEventListener("click", () => openWidgets());
  document.getElementById("taskview-open")?.addEventListener("click", () => openTaskView());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      for (const id of ["calculator-overlay", "widgets-overlay", "taskview-overlay", "language-overlay"]) {
        const overlay = document.getElementById(id);
        if (overlay && !overlay.hidden) hide(overlay);
      }
      if (widgetTimer !== null) closeWidgets();
    }
  });
}
