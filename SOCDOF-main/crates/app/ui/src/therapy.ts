import { invoke } from "@tauri-apps/api/core";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

interface Client { id: string; name: string; email: string; phone: string; hourly_rate: number; kilometer_rate: number; active: boolean; }
interface Session { id: string; client_id: string; started_at: number; minutes: number; kilometers_milli: number; notes: string; invoice_id: string | null; }
const lang = detectLanguage();
const t = (key: TranslationKey) => translate(lang, key);
const money = new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" });
let clients: Client[] = [];

function el<T extends HTMLElement>(id: string): T { const found = document.getElementById(id); if (!found) throw new Error(id); return found as T; }
export function initTherapy(): void {
  el("view-therapy").innerHTML = `<div class="section-head"><div><p class="eyebrow">${t("therapyBadge")}</p><h2>${t("therapyTitle")}</h2><p class="subtitle">${t("therapySubtitle")}</p></div><button id="therapy-new" class="primary">${t("therapyNew")}</button></div><p id="therapy-message" class="message"></p><div class="grid"><section class="card"><h3>${t("therapyClients")}</h3><div id="therapy-clients" class="entity-list"></div></section><section id="therapy-editor" class="card" hidden><h3>${t("therapyEdit")}</h3><form id="therapy-form" class="stack"><input id="therapy-id" type="hidden"><label class="field"><span>${t("therapyName")}</span><input id="therapy-name" required></label><div class="grid compact"><label class="field"><span>${t("therapyHourly")}</span><input id="therapy-hourly" type="number" min="0" step="0.01"></label><label class="field"><span>${t("therapyKilometer")}</span><input id="therapy-kilometer" type="number" min="0" step="0.01"></label></div><label class="field"><span>${t("therapyEmail")}</span><input id="therapy-email" type="email"></label><label class="field"><span>${t("therapyPhone")}</span><input id="therapy-phone"></label><div class="toolbar"><button class="primary">${t("save")}</button><button id="therapy-cancel" type="button">${t("cancel")}</button></div></form></section></div>`;
  el("therapy-new").addEventListener("click", () => openClient(null));
  el("therapy-cancel").addEventListener("click", () => { el("therapy-editor").hidden = true; });
  el<HTMLFormElement>("therapy-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await invoke("save_therapy_client", { input: { id: el<HTMLInputElement>("therapy-id").value || null, name: el<HTMLInputElement>("therapy-name").value, email: el<HTMLInputElement>("therapy-email").value, phone: el<HTMLInputElement>("therapy-phone").value, hourly_rate_cents: Math.round(Number(el<HTMLInputElement>("therapy-hourly").value || 0) * 100), kilometer_rate_cents: Math.round(Number(el<HTMLInputElement>("therapy-kilometer").value || 0) * 100), notes: "", active: true } });
    el("therapy-editor").hidden = true;
    await loadTherapy();
  });
}
function openClient(id: string | null): void {
  const client = clients.find((item) => item.id === id);
  el("therapy-editor").hidden = false;
  el<HTMLInputElement>("therapy-id").value = client?.id ?? "";
  el<HTMLInputElement>("therapy-name").value = client?.name ?? "";
  el<HTMLInputElement>("therapy-email").value = client?.email ?? "";
  el<HTMLInputElement>("therapy-phone").value = client?.phone ?? "";
  el<HTMLInputElement>("therapy-hourly").value = client ? String(client.hourly_rate / 100) : "";
  el<HTMLInputElement>("therapy-kilometer").value = client ? String(client.kilometer_rate / 100) : "";
}
export async function loadTherapy(): Promise<void> {
  try {
    clients = await invoke<Client[]>("therapy_clients");
    const list = el("therapy-clients");
    list.replaceChildren();
    for (const client of clients) {
      const row = document.createElement("article");
      row.className = "entity-row";
      row.innerHTML = `<div><strong>${client.name}</strong><p class="hint">${client.email || client.phone || ""} · ${money.format(client.hourly_rate / 100)}/h</p><div class="therapy-sessions" id="therapy-sessions-${client.id}"></div></div>`;
      const edit = document.createElement("button");
      edit.textContent = t("edit");
      edit.addEventListener("click", () => openClient(client.id));
      row.append(edit);
      const remove = document.createElement("button");
      remove.textContent = t("delete");
      remove.className = "danger";
      remove.addEventListener("click", async () => { await invoke("delete_therapy_client", { id: client.id }); await loadTherapy(); });
      row.append(remove);
      const sessions = document.createElement("button");
      sessions.textContent = t("therapySessions");
      sessions.className = "secondary";
      sessions.addEventListener("click", () => void renderSessions(client));
      row.append(sessions);
      list.append(row);
    }

    async function renderSessions(client: Client): Promise<void> {
      const target = document.getElementById(`therapy-sessions-${client.id}`);
      if (!target) return;
      const sessions = await invoke<Session[]>("therapy_sessions", { clientId: client.id });
      target.innerHTML = `<div class="therapy-session-list">${sessions.map((session) => `<p class="hint">${new Date(session.started_at).toLocaleDateString(lang)} · ${session.minutes} min · ${(session.kilometers_milli / 1000).toFixed(1)} km${session.invoice_id ? ` · ${t("therapyBilled")}` : ""}<button class="danger therapy-session-delete" data-id="${session.id}">${t("delete")}</button></p>`).join("") || `<span class="hint">${t("therapyNoSessions")}</span>`}</div><form class="toolbar therapy-session-form"><input name="minutes" type="number" min="1" placeholder="${t("therapyMinutes")}" required><input name="kilometers" type="number" min="0" step="0.1" placeholder="${t("therapyKilometers")}" value="0"><input name="notes" placeholder="${t("therapyNotes")}"><button class="secondary">${t("therapyAddSession")}</button></form>`;
      target.querySelectorAll<HTMLButtonElement>(".therapy-session-delete").forEach((button) => button.addEventListener("click", async () => { await invoke("delete_therapy_session", { id: button.dataset.id }); await renderSessions(client); }));
      target.querySelector("form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        await invoke("save_therapy_session", { input: { client_id: client.id, started_at: Date.now(), minutes: Number(data.get("minutes")), kilometers_milli: Math.round(Number(data.get("kilometers") || 0) * 1000), notes: String(data.get("notes") || "") } });
        await renderSessions(client);
      });
    }
    if (!clients.length) list.textContent = t("therapyEmpty");
  } catch (error) { el("therapy-message").textContent = String(error); }
}
