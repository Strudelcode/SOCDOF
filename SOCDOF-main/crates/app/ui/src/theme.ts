//! Shared light/dark theme and desktop taskbar behaviour.
//!
//! The palette lives in `parity.css` under `:root` and `:root[data-theme="dark"]`.
//! This module only selects the mode, persists it, and keeps the toggle and clock in sync.

export type UiTheme = "light" | "dark";

const STORAGE_KEY = "socdof.ui.theme";

function systemTheme(): UiTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): UiTheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  const attribute = document.documentElement.dataset.theme;
  return attribute === "dark" ? "dark" : systemTheme();
}

export function applyTheme(theme: UiTheme, persist = true): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (persist) {
    localStorage.setItem(STORAGE_KEY, theme);
  }
  syncThemeControls(theme);
}

export function toggleTheme(): UiTheme {
  const next: UiTheme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

function syncThemeControls(theme: UiTheme): void {
  const button = document.getElementById("theme-toggle");
  if (!button) {
    return;
  }
  const light = theme === "dark";
  button.textContent = light ? "☀" : "☾";
  button.title = light ? "Hellmodus" : "Dunkelmodus";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(light));
  button.classList.toggle("is-dark", light);
}

function updateClock(): void {
  const time = document.getElementById("taskbar-time");
  const date = document.getElementById("taskbar-date");
  if (!time || !date) {
    return;
  }
  const now = new Date();
  time.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  date.textContent = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function initTheme(): void {
  applyTheme(currentTheme(), localStorage.getItem(STORAGE_KEY) !== null);
  const button = document.getElementById("theme-toggle");
  button?.addEventListener("click", () => {
    toggleTheme();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(systemTheme(), false);
    }
  });
}

export function initTaskbar(): void {
  updateClock();
  window.setInterval(updateClock, 30_000);

  document.getElementById("taskbar-search")?.addEventListener("click", () => {
    document.getElementById("command-open")?.click();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-taskbar-view]")) {
    button.addEventListener("click", () => {
      const view = button.dataset.taskbarView;
      document.querySelector<HTMLButtonElement>(`.tab[data-view="${view}"]`)?.click();
    });
  }
}

export function setTaskbarCompany(name: string): void {
  const target = document.getElementById("taskbar-company");
  if (target) {
    target.textContent = name.trim() || "SOCDOF";
  }
}
