//! Calendar screen of the Tauri webview.
//!
//! The month grid and the agenda load their range through the core appointment store. Create,
//! update and delete go through `save_appointment`/`delete_appointment`; the command layer rejects
//! overlapping open slots and invalid ranges, so the screen only maps the returned codes.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const DAY_MS = 24 * 60 * 60 * 1000;

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
    <div class="section-head">
      <div>
        <p class="eyebrow">${t("calendarEyebrow")}</p>
        <h2>${t("calendarTitle")}</h2>
        <p class="subtitle">${t("calendarSubtitle")}</p>
      </div>
      <div class="toolbar">
        <button id="calendar-new" class="primary" type="button">${t("calendarNew")}</button>
      </div>
    </div>
    <div class="calendar-toolbar">
      <button id="calendar-previous" type="button" aria-label="${t("calendarMonthPrevious")}">‹</button>
      <strong id="calendar-month"></strong>
      <button id="calendar-next" type="button" aria-label="${t("calendarMonthNext")}">›</button>
      <button id="calendar-today" type="button">${t("calendarToday")}</button>
    </div>
    <div id="calendar-weekdays" class="calendar-weekdays"></div>
    <div id="calendar-grid" class="calendar-grid"></div>
    <div class="grid calendar-lower">
      <section class="card">
        <h3 id="calendar-agenda-title">${t("calendarAgenda")}</h3>
        <div id="calendar-agenda" class="entity-list"></div>
      </section>
      <section id="calendar-editor" class="card" hidden>
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
  const weekdayFormatter = new Intl.DateTimeFormat(language, { weekday: "short" });
  const monday = new Date(2024, 0, 1);
  byId<HTMLElement>("calendar-weekdays").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return `<span>${weekdayFormatter.format(day)}</span>`;
  }).join("");

  const today = dateKey(Date.now());
  const grid = byId<HTMLElement>("calendar-grid");
  const gridStart = startOfWeek(cursor);
  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const millis = gridStart + index * DAY_MS;
    const day = new Date(millis);
    const key = dateKey(millis);
    const entries = appointments.filter((entry) => dateKey(entry.starts_at) === key);
    const classes = [
      "calendar-day",
      day.getMonth() !== cursor.getMonth() ? "is-other-month" : "",
      key === today ? "is-today" : "",
      key === selected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <div class="${classes}" data-date="${key}">
        <button type="button" class="calendar-day-number">${day.getDate()}</button>
        <div class="calendar-entries">
          ${entries
            .map(
              (entry) =>
                `<button type="button" class="calendar-entry status-${entry.status}" data-appointment="${entry.id}">${formatTime(entry.starts_at)} ${escapeHtml(entry.title)}</button>`,
            )
            .join("")}
        </div>
      </div>`;
  }).join("");

  for (const cell of grid.querySelectorAll<HTMLElement>(".calendar-day")) {
    const key = cell.dataset.date ?? "";
    cell.querySelector<HTMLButtonElement>(".calendar-day-number")?.addEventListener("click", () => {
      selected = key;
      render();
    });
    for (const entry of cell.querySelectorAll<HTMLButtonElement>("[data-appointment]")) {
      entry.addEventListener("click", () => openEditor(entry.dataset.appointment ?? null));
    }
  }
  renderAgenda();
}

function renderAgenda(): void {
  const title = byId<HTMLElement>("calendar-agenda-title");
  title.textContent = `${t("calendarAgenda")} · ${new Date(selected).toLocaleDateString(language)}`;
  const list = byId<HTMLElement>("calendar-agenda");
  const entries = appointments
    .filter((entry) => dateKey(entry.starts_at) === selected)
    .sort((left, right) => left.starts_at - right.starts_at);
  if (entries.length === 0) {
    list.innerHTML = `<p class="hint">${t("calendarEmpty")}</p>`;
    return;
  }
  list.innerHTML = entries
    .map(
      (entry) => `
        <article class="entity-row">
          <div>
            <strong>${formatTime(entry.starts_at)}–${formatTime(entry.ends_at)} · ${escapeHtml(entry.title)}</strong>
            <p class="hint">${statusLabel(entry.status)}${entry.location ? ` · ${escapeHtml(entry.location)}` : ""}${entry.notes ? ` · ${escapeHtml(entry.notes)}` : ""}</p>
          </div>
          <button type="button" data-edit="${entry.id}">${t("calendarEdit")}</button>
        </article>`,
    )
    .join("");
  for (const button of list.querySelectorAll<HTMLButtonElement>("[data-edit]")) {
    button.addEventListener("click", () => openEditor(button.dataset.edit ?? null));
  }
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

function statusLabel(status: string): string {
  const keys: Record<string, TranslationKey> = {
    scheduled: "calendarStatusScheduled",
    confirmed: "calendarStatusConfirmed",
    completed: "calendarStatusCompleted",
    cancelled: "calendarStatusCancelled",
    no_show: "calendarStatusNoShow",
  };
  return t(keys[status] ?? "calendarStatusScheduled");
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
