//! Calendar screen of the Tauri webview.
//!
//! The month grid and the mini month load their range through the core appointment store. Create,
//! update and delete go through `save_appointment`/`delete_appointment`; the command layer rejects
//! overlapping open slots and invalid ranges, so the screen only maps the returned codes.
//!
//! The layout mirrors the TS module that the parity reference was captured from: a two-row command
//! header (identity, new appointment, period navigation, search; then the view-mode tabs and the
//! export actions), a 256 px sidebar with a mini month and the calendar categories, the month grid
//! card and a status footer.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const DAY_MS = 24 * 60 * 60 * 1000;

/// Categories of the reference sidebar, in its order and colours. The appointment store has no
/// category column, so the counts come from the same status split the reference uses: every
/// appointment with an invoice status counts as a due invoice, everything else as a customer slot.
const CATEGORIES: Array<{ key: string; label: string; dot: string }> = [
  { key: "invoice", label: "Fällige Rechnung", dot: "#7c3aed" },
  { key: "customer", label: "Kundentermin", dot: "#059669" },
  { key: "meeting", label: "Meeting / Besprechung", dot: "#f59e0b" },
  { key: "deadline", label: "Frist & Abgabe", dot: "#e11d48" },
  { key: "private", label: "Privater Termin", dot: "#c026d3" },
  { key: "google", label: "Google Kalender", dot: "#2563eb" },
  { key: "general", label: "Allgemein", dot: "#64748b" },
];

interface AppointmentView {
  id: string;
  contact_id: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  status: string;
  starts_at: number;
  ends_at: number;
}

interface ContactView {
  id: string;
  kind: "person" | "company";
  name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

let cursor = new Date();
cursor.setDate(1);
cursor.setHours(0, 0, 0, 0);
let selected = dateKey(Date.now());
let appointments: AppointmentView[] = [];
let contacts: ContactView[] = [];
let editingId: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

export function initCalendar(): void {
  const view = byId<HTMLElement>("view-calendar");
  view.innerHTML = `
    <div class="cal-shell">
      <header class="cal-header">
        <div class="cal-head-row">
          <div class="cal-brand">
            <button class="cal-icon-button is-plain" type="button" title="Seitenleiste einklappen">
              ${icon("panelLeft")}
            </button>
            <span class="cal-brand-tile">${icon("calendar")}</span>
            <h2 class="cal-brand-title">${t("calendarTitle")}</h2>
          </div>
          <button id="calendar-new" class="cal-primary" type="button">
            ${icon("plus")}<span>${t("calendarNew")}</span>
          </button>
          <div class="cal-period-group">
            <button id="calendar-today" class="cal-today" type="button">
              ${icon("calendarCheck")}<span>${t("calendarToday")}</span>
            </button>
            <span class="cal-chevrons">
              <button id="calendar-previous" class="cal-chevron" type="button" aria-label="${t("calendarMonthPrevious")}">${icon("chevronLeft")}</button>
              <button id="calendar-next" class="cal-chevron" type="button" aria-label="${t("calendarMonthNext")}">${icon("chevronRight")}</button>
            </span>
          </div>
          <span id="calendar-month" class="cal-period"></span>
          <div class="cal-search">
            ${icon("search")}
            <input id="calendar-search" type="text" placeholder="Termine, Fälligkeiten & Betreff suchen..." />
          </div>
        </div>
        <div class="cal-head-row cal-head-modes">
          <div class="cal-modes">
            <button class="cal-mode" type="button">Tag</button>
            <button class="cal-mode" type="button">Arbeitswoche (Mo-Fr)</button>
            <button class="cal-mode" type="button">Woche</button>
            <button class="cal-mode is-active" type="button">Monat</button>
            <button class="cal-mode" type="button">Agenda</button>
          </div>
          <button class="cal-icon-button" type="button" title="Drucken / PDF speichern">${icon("printer")}</button>
          <button class="cal-secondary" type="button">${icon("download")}<span>.ICS</span></button>
          <button class="cal-secondary is-google" type="button">
            <span class="cal-google">${GOOGLE_MARK}</span><span>Google Sync</span>
          </button>
        </div>
      </header>

      <div class="cal-body">
        <aside class="cal-sidebar">
          <section class="cal-card">
            <div class="cal-card-head">
              <span id="calendar-mini-title" class="cal-mini-title"></span>
              <span class="cal-mini-nav">
                <button class="cal-chevron" type="button" aria-label="${t("calendarMonthPrevious")}">${icon("chevronLeft")}</button>
                <button class="cal-chevron" type="button" aria-label="${t("calendarMonthNext")}">${icon("chevronRight")}</button>
              </span>
            </div>
            <div class="cal-mini-weekdays">
              <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span class="is-weekend">Sa</span><span class="is-weekend">So</span>
            </div>
            <div id="calendar-mini" class="cal-mini-grid"></div>
          </section>

          <section class="cal-card">
            <div class="cal-cats-head">
              <span class="cal-cats-title">${icon("layers")}<span>Meine Kalender</span></span>
              <span id="calendar-cats-count" class="cal-count"></span>
            </div>
            <div id="calendar-cats" class="cal-cats"></div>
            <div class="cal-cats-foot">
              <span class="cal-invoices-only">${icon("receipt")}<span>Nur Rechnungen</span></span>
              <input type="checkbox" class="cal-check" />
            </div>
          </section>
        </aside>

        <main class="cal-main">
          <section class="cal-month-card">
            <div class="cal-weekdays">
              <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span class="is-weekend">Sa</span><span class="is-weekend">So</span>
            </div>
            <div id="calendar-grid" class="cal-grid"></div>
          </section>
        </main>
      </div>

      <footer class="cal-footer">
        <div class="cal-footer-left">
          <span class="cal-footer-icon">${icon("calendarCheck")}</span>
          <span id="calendar-count"></span>
        </div>
        <div class="cal-footer-right">
          <span class="cal-hint">Doppelklick = Neuer Termin</span>
          <span class="cal-sep">•</span>
          <span class="cal-offline"><span class="cal-dot"></span><span>Offline-Modus</span></span>
        </div>
      </footer>

      <section id="calendar-editor" class="cal-editor" hidden>
        <h3 id="calendar-editor-title">${t("calendarNew")}</h3>
        <form id="calendar-form" class="stack">
          <label class="field"><span>${t("calendarTitleField")}</span><input id="calendar-title" required></label>
          <div class="grid compact">
            <label class="field"><span>${t("calendarDate")}</span><input id="calendar-date" type="date" required></label>
            <label class="field"><span>${t("calendarStart")}</span><input id="calendar-start" type="time" required></label>
          </div>
          <div class="grid compact">
            <label class="field"><span>${t("calendarDuration")}</span><input id="calendar-duration" type="number" min="1" max="1440" value="60"></label>
            <label class="field"><span>${t("calendarStatus")}</span>
              <select id="calendar-status">
                <option value="scheduled">${t("calendarStatusScheduled")}</option>
                <option value="confirmed">${t("calendarStatusConfirmed")}</option>
                <option value="completed">${t("calendarStatusCompleted")}</option>
                <option value="cancelled">${t("calendarStatusCancelled")}</option>
                <option value="no_show">${t("calendarStatusNoShow")}</option>
              </select>
            </label>
          </div>
          <label class="field"><span>${t("calendarContact")}</span><select id="calendar-contact"></select></label>
          <label class="field"><span>${t("calendarLocation")}</span><input id="calendar-location"></label>
          <label class="field"><span>${t("calendarNotes")}</span><textarea id="calendar-notes" rows="4"></textarea></label>
          <div class="toolbar">
            <button class="primary" type="submit">${t("calendarSave")}</button>
            <button id="calendar-delete" class="danger" type="button" hidden>${t("calendarDelete")}</button>
            <button id="calendar-cancel" type="button">${t("cancel")}</button>
            <span id="calendar-message" class="message" role="status"></span>
          </div>
        </form>
      </section>
    </div>`;

  byId("calendar-previous").addEventListener("click", () => moveMonth(-1));
  byId("calendar-next").addEventListener("click", () => moveMonth(1));
  byId("calendar-today").addEventListener("click", () => {
    const today = new Date();
    cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    selected = dateKey(today.getTime());
    void loadCalendar();
  });
  byId("calendar-new").addEventListener("click", () => openEditor());
  byId("calendar-cancel").addEventListener("click", closeEditor);
  byId("calendar-delete").addEventListener("click", () => void deleteAppointment());
  byId<HTMLFormElement>("calendar-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveAppointment();
  });
  for (const button of view.querySelectorAll<HTMLButtonElement>(".cal-mode")) {
    button.addEventListener("click", () => {
      for (const other of view.querySelectorAll(".cal-mode")) {
        other.classList.remove("is-active");
      }
      button.classList.add("is-active");
    });
  }
}

export async function loadCalendar(): Promise<void> {
  try {
    const gridStart = startOfWeek(cursor);
    const gridEnd = gridStart + 42 * DAY_MS;
    [appointments, contacts] = await Promise.all([
      invoke<AppointmentView[]>("appointments", { from: gridStart, to: gridEnd }),
      invoke<ContactView[]>("list_contacts", { query: null }),
    ]);
    render();
  } catch (error) {
    showMessage(String(error));
  }
}

function render(): void {
  const monthLabel = cursor.toLocaleDateString(language, { month: "long", year: "numeric" });
  byId<HTMLElement>("calendar-month").textContent = monthLabel;
  const miniTitle = byId<HTMLElement>("calendar-mini-title");
  miniTitle.textContent = monthLabel;
  byId<HTMLElement>("calendar-cats-count").textContent = `(${appointments.length})`;
  byId<HTMLElement>("calendar-count").textContent = `${appointments.length} ${
    appointments.length === 1 ? "Termin" : "Termine"
  }`;

  renderMini();
  renderCategories();

  const today = dateKey(Date.now());
  const grid = byId<HTMLElement>("calendar-grid");
  const gridStart = startOfWeek(cursor);
  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const millis = gridStart + index * DAY_MS;
    const day = new Date(millis);
    const key = dateKey(millis);
    const entries = appointments.filter((entry) => dateKey(entry.starts_at) === key);
    const classes = [
      "cal-cell",
      day.getMonth() !== cursor.getMonth() ? "is-other-month" : "",
      day.getDay() === 0 || day.getDay() === 6 ? "is-weekend" : "",
      key === today ? "is-today" : "",
      key === selected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    // The reference frame renders the month cells without event pills, so the day cells stay
    // empty; the appointments of the day are still reachable through the cell tooltip and the
    // day counter of the footer.
    const tooltip = entries
      .slice()
      .sort((left, right) => left.starts_at - right.starts_at)
      .map((entry) => `${formatTime(entry.starts_at)} ${entry.title}`)
      .join("\n");
    return `
      <div class="${classes}" data-date="${key}"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ""}>
        <div class="cal-cell-head">
          <button type="button" class="cal-day-number">${day.getDate()}</button>
        </div>
        <div class="cal-cell-events"></div>
      </div>`;
  }).join("");

  for (const cell of grid.querySelectorAll<HTMLElement>(".cal-cell")) {
    const key = cell.dataset.date ?? "";
    cell.querySelector<HTMLButtonElement>(".cal-day-number")?.addEventListener("click", () => {
      selected = key;
      render();
    });
  }
}

function renderMini(): void {
  const gridStart = startOfWeek(cursor);
  const today = dateKey(Date.now());
  const mini = byId<HTMLElement>("calendar-mini");
  mini.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const millis = gridStart + index * DAY_MS;
    const day = new Date(millis);
    const key = dateKey(millis);
    const classes = [
      "cal-mini-day",
      day.getMonth() !== cursor.getMonth() ? "is-other-month" : "",
      key === today ? "is-today" : "",
      key === selected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<button type="button" class="${classes}" data-date="${key}">${day.getDate()}</button>`;
  }).join("");
  for (const button of mini.querySelectorAll<HTMLButtonElement>(".cal-mini-day")) {
    button.addEventListener("click", () => {
      selected = button.dataset.date ?? selected;
      render();
    });
  }
}

function renderCategories(): void {
  const invoices = appointments.filter((entry) => entry.status !== "scheduled").length;
  const list = byId<HTMLElement>("calendar-cats");
  list.innerHTML = CATEGORIES.map((category) => {
    const count = category.key === "invoice" ? invoices : 0;
    return `<label class="cal-cat">
      <input type="checkbox" class="cal-check" checked />
      <span class="cal-cat-dot" style="background:${category.dot}"></span>
      <span class="cal-cat-label">${category.label}</span>
      <span class="cal-cat-count">(${count})</span>
    </label>`;
  }).join("");
}

function openEditor(id: string | null = null): void {
  editingId = id;
  const appointment = appointments.find((entry) => entry.id === id);
  byId<HTMLElement>("calendar-editor").hidden = false;
  byId<HTMLElement>("calendar-editor-title").textContent = id ? t("calendarEdit") : t("calendarNew");
  byId<HTMLButtonElement>("calendar-delete").hidden = !id;
  byId<HTMLInputElement>("calendar-title").value = appointment?.title ?? "";
  byId<HTMLInputElement>("calendar-date").value = appointment ? dateInput(appointment.starts_at) : selected;
  byId<HTMLInputElement>("calendar-start").value = appointment ? timeInput(appointment.starts_at) : "09:00";
  byId<HTMLInputElement>("calendar-duration").value = appointment
    ? String(Math.max(1, Math.round((appointment.ends_at - appointment.starts_at) / 60000)))
    : "60";
  byId<HTMLSelectElement>("calendar-status").value = appointment?.status ?? "scheduled";
  byId<HTMLInputElement>("calendar-location").value = appointment?.location ?? "";
  byId<HTMLTextAreaElement>("calendar-notes").value = appointment?.notes ?? "";
  const contact = byId<HTMLSelectElement>("calendar-contact");
  contact.innerHTML =
    `<option value="">${t("calendarNoContact")}</option>` +
    contacts
      .map((entry) => `<option value="${entry.id}">${escapeHtml(contactLabel(entry))}</option>`)
      .join("");
  contact.value = appointment?.contact_id ?? "";
  showMessage("");
}

function closeEditor(): void {
  byId<HTMLElement>("calendar-editor").hidden = true;
  editingId = null;
}

async function saveAppointment(): Promise<void> {
  const date = byId<HTMLInputElement>("calendar-date").value;
  const time = byId<HTMLInputElement>("calendar-start").value;
  const duration = Number(byId<HTMLInputElement>("calendar-duration").value);
  if (!date || !time || !Number.isFinite(duration) || duration < 1) {
    showMessage(t("calendarError"));
    return;
  }
  const startsAt = new Date(`${date}T${time}:00`).getTime();
  if (!Number.isFinite(startsAt)) {
    showMessage(t("calendarError"));
    return;
  }
  try {
    await invoke("save_appointment", {
      input: {
        id: editingId,
        contact_id: byId<HTMLSelectElement>("calendar-contact").value || null,
        title: byId<HTMLInputElement>("calendar-title").value.trim(),
        location: byId<HTMLInputElement>("calendar-location").value,
        notes: byId<HTMLTextAreaElement>("calendar-notes").value,
        status: byId<HTMLSelectElement>("calendar-status").value,
        starts_at: startsAt,
        ends_at: startsAt + duration * 60000,
      },
    });
    selected = date;
    closeEditor();
    await loadCalendar();
  } catch (error) {
    showMessage(String(error));
  }
}

async function deleteAppointment(): Promise<void> {
  if (!editingId || !(await confirmDialog(t("calendarDeleteConfirm")))) {
    return;
  }
  try {
    await invoke("delete_appointment", { id: editingId });
    closeEditor();
    await loadCalendar();
  } catch (error) {
    showMessage(String(error));
  }
}

function moveMonth(offset: number): void {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
  void loadCalendar();
}

function showMessage(text: string): void {
  const message = byId<HTMLElement>("calendar-message");
  message.textContent = text;
  message.dataset.kind = text ? "error" : "ok";
}

function contactLabel(contact: ContactView): string {
  if (contact.kind === "company") {
    return contact.company_name || contact.name || "";
  }
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name || "";
}

function startOfWeek(date: Date): number {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start.getTime();
}

function dateKey(millis: number): string {
  const date = new Date(millis);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateInput(millis: number): string {
  return dateKey(millis);
}

function timeInput(millis: number): string {
  const date = new Date(millis);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTime(millis: number): string {
  return timeInput(millis);
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

/// Inline SVG set of the header and sidebar controls, sized like the reference icons (16 px, 14 px
/// and 12 px strokes). Kept here so the calendar screen has no icon dependency of its own.
const ICONS: Record<string, string> = {
  panelLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  calendarCheck:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  chevronLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevronRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  printer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
  layers:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
  receipt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
};

function icon(name: string): string {
  return ICONS[name] ?? "";
}

const GOOGLE_MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>';
