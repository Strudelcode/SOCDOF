import { invoke } from "@tauri-apps/api/core";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

interface Ticket {
  id: string;
  contact_id: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: number;
  updated_at: number;
}

interface Contact {
  id: string;
  name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}
interface TimeEntry { id: string; ticket_id: string | null; description: string; minutes: number; started_at: number; }

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
let tickets: Ticket[] = [];
let contacts: Contact[] = [];
let editing: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

function contactName(contact: Contact): string {
  return contact.name || contact.company_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.id;
}

function statusLabel(status: string): string {
  return t(status === "in_progress" ? "supportInProgress" : status === "closed" ? "supportClosed" : status === "waiting" ? "supportWaiting" : "supportOpen");
}

function render(): void {
  const list = byId("support-list");
  list.replaceChildren();
  for (const ticket of tickets) {
    const row = document.createElement("article");
    row.className = "entity-row support-ticket-row";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = ticket.subject;
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = `${statusLabel(ticket.status)} · ${ticket.priority} · ${new Date(ticket.updated_at).toLocaleString(language)}`;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.textContent = t("edit");
    edit.addEventListener("click", () => openEditor(ticket.id));
    row.addEventListener("click", () => { void renderTime(ticket.id); });
    const close = document.createElement("button");
    close.textContent = ticket.status === "closed" ? t("supportReopen") : t("supportClose");
    close.addEventListener("click", () => void setStatus(ticket.id, ticket.status === "closed" ? "open" : "closed"));
    actions.append(edit, close);
    row.append(copy, actions);
    list.append(row);
  }

  async function renderTime(ticketId: string): Promise<void> {
    const target = document.getElementById("support-time");
    if (!target) return;
    const entries = await invoke<TimeEntry[]>("support_time_entries", { ticketId });
    target.innerHTML = `<h3>${t("supportTimeTitle")}</h3><div class="support-time-list">${entries.map((entry) => `<div class="entity-row"><span>${entry.description || t("supportTimeWork")}<small class="hint">${entry.minutes} min · ${new Date(entry.started_at).toLocaleString(language)}</small></span></div>`).join("") || `<p class="hint">${t("supportTimeEmpty")}</p>`}</div><form id="support-time-form" class="toolbar"><input id="support-time-description" placeholder="${t("supportTimeDescription")}"><input id="support-time-minutes" type="number" min="1" value="60"><button class="secondary">${t("supportTimeAdd")}</button></form>`;
    target.querySelector("form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await invoke("save_support_time", { input: { ticket_id: ticketId, description: (target.querySelector("#support-time-description") as HTMLInputElement).value, minutes: Number((target.querySelector("#support-time-minutes") as HTMLInputElement).value), started_at: Date.now() } });
      await renderTime(ticketId);
    });
  }
  if (!tickets.length) list.textContent = t("supportEmpty");
}

function openEditor(id: string | null = null): void {
  editing = id;
  const ticket = tickets.find((item) => item.id === id);
  byId<HTMLElement>("support-editor").hidden = false;
  byId<HTMLInputElement>("support-subject").value = ticket?.subject ?? "";
  byId<HTMLTextAreaElement>("support-description").value = ticket?.description ?? "";
  byId<HTMLSelectElement>("support-status").value = ticket?.status ?? "open";
  byId<HTMLSelectElement>("support-priority").value = ticket?.priority ?? "normal";
  const contact = byId<HTMLSelectElement>("support-contact");
  contact.innerHTML = `<option value="">${t("supportNoContact")}</option>` + contacts.map((item) => `<option value="${item.id}">${contactName(item)}</option>`).join("");
  contact.value = ticket?.contact_id ?? "";
}

async function load(): Promise<void> {
  try {
    [tickets, contacts] = await Promise.all([
      invoke<Ticket[]>("support_tickets", { query: null }),
      invoke<Contact[]>("list_contacts", { query: null }),
    ]);
    render();
  } catch (error) {
    byId("support-message").textContent = String(error);
  }
}

async function setStatus(id: string, status: string): Promise<void> {
  await invoke("set_support_ticket_status", { id, status });
  await load();
}

export function initSupport(): void {
  const view = byId<HTMLElement>("view-support");
  view.innerHTML = `
    <div class="section-head"><div><p class="eyebrow">${t("supportBadge")}</p><h2>${t("supportTitle")}</h2><p class="subtitle">${t("supportSubtitle")}</p></div><button id="support-new" class="primary" type="button">${t("supportNew")}</button></div>
    <p id="support-message" class="message" role="status"></p>
    <div class="grid"><section class="card"><label class="field"><span>${t("supportSearch")}</span><input id="support-search" type="search"></label><div id="support-list" class="entity-list"></div><div id="support-time" class="support-time"></div></section>
    <section id="support-editor" class="card" hidden><h3>${t("supportEditor")}</h3><form id="support-form" class="stack"><label class="field"><span>${t("supportSubject")}</span><input id="support-subject" required></label><label class="field"><span>${t("supportDescription")}</span><textarea id="support-description" rows="5"></textarea></label><label class="field"><span>${t("supportContact")}</span><select id="support-contact"></select></label><div class="grid compact"><label class="field"><span>${t("supportStatus")}</span><select id="support-status"><option value="open">${t("supportOpen")}</option><option value="in_progress">${t("supportInProgress")}</option><option value="waiting">${t("supportWaiting")}</option><option value="closed">${t("supportClosed")}</option></select></label><label class="field"><span>${t("supportPriority")}</span><select id="support-priority"><option value="low">${t("supportLow")}</option><option value="normal">${t("supportNormal")}</option><option value="high">${t("supportHigh")}</option><option value="urgent">${t("supportUrgent")}</option></select></label></div><div class="toolbar"><button class="primary" type="submit">${t("save")}</button><button id="support-cancel" type="button">${t("cancel")}</button></div></form></section></div>`;
  byId("support-new").addEventListener("click", () => openEditor());
  byId("support-cancel").addEventListener("click", () => { byId("support-editor").hidden = true; });
  byId("support-search").addEventListener("input", async (event) => {
    tickets = await invoke<Ticket[]>("support_tickets", { query: (event.target as HTMLInputElement).value || null });
    render();
  });
  byId<HTMLFormElement>("support-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await invoke("save_support_ticket", { input: { id: editing, contact_id: byId<HTMLSelectElement>("support-contact").value || null, subject: byId<HTMLInputElement>("support-subject").value, description: byId<HTMLTextAreaElement>("support-description").value, status: byId<HTMLSelectElement>("support-status").value, priority: byId<HTMLSelectElement>("support-priority").value } });
    byId("support-editor").hidden = true;
    await load();
  });
}

export { load as loadSupport };
