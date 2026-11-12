//! Textwerk screen of the Tauri webview.
//!
//! Documents are plain text and persist through `list_documents`, `save_document` and
//! `delete_document`. The native open/save dialogs are exposed as separate commands for the editor
//! actions that need a file on disk.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface DocumentView {
  id: string;
  name: string;
  body: string;
  created_at: number;
  updated_at: number;
}

let documents: DocumentView[] = [];
let activeId: string | null = null;
let search = "";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

export function initDocuments(): void {
  const view = byId<HTMLElement>("view-documents");
  view.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">${t("documentsEyebrow")}</p>
        <h2>${t("documentsTitle")}</h2>
        <p class="subtitle">${t("documentsSubtitle")}</p>
      </div>
      <div class="toolbar">
        <button id="documents-new" class="primary" type="button">${t("documentsNew")}</button>
      </div>
    </div>
    <div class="documents-layout">
      <aside class="card documents-sidebar">
        <label class="field"><span>${t("documentsSearch")}</span><input id="documents-search" type="search"></label>
        <p id="documents-count" class="hint"></p>
        <div id="documents-list" class="entity-list"></div>
      </aside>
      <section class="card documents-editor" id="documents-editor" hidden>
        <label class="field"><span>${t("documentsName")}</span><input id="documents-name" maxlength="120"></label>
        <label class="field"><span>${t("documentsBody")}</span><textarea id="documents-body" rows="18"></textarea></label>
        <div class="toolbar">
          <button id="documents-save" class="primary" type="button">${t("documentsSave")}</button>
          <button id="documents-delete" class="danger" type="button">${t("documentsDelete")}</button>
          <span id="documents-message" class="message" role="status"></span>
        </div>
        <p id="documents-stats" class="hint"></p>
      </section>
      <section class="card documents-empty" id="documents-empty">
        <p>${t("documentsSelect")}</p>
      </section>
    </div>`;

  byId("documents-new").addEventListener("click", () => newDocument());
  byId("documents-search").addEventListener("input", () => {
    search = byId<HTMLInputElement>("documents-search").value.trim().toLowerCase();
    renderList();
  });
  byId("documents-save").addEventListener("click", () => void saveDocument());
  byId("documents-delete").addEventListener("click", () => void deleteDocument());
  byId<HTMLTextAreaElement>("documents-body").addEventListener("input", updateStats);
}

export async function loadDocuments(): Promise<void> {
  try {
    documents = await invoke<DocumentView[]>("list_documents");
    renderList();
    if (activeId && documents.some((document) => document.id === activeId)) {
      openDocument(activeId);
    } else if (activeId) {
      newDocument();
    }
  } catch (error) {
    setMessage(String(error), "error");
  }
}

function renderList(): void {
  const list = byId<HTMLElement>("documents-list");
  const filtered = documents.filter(
    (document) =>
      !search ||
      document.name.toLowerCase().includes(search) ||
      document.body.toLowerCase().includes(search),
  );
  byId<HTMLElement>("documents-count").textContent = `${filtered.length} / ${documents.length}`;
  if (filtered.length === 0) {
    list.innerHTML = `<p class="hint">${t("documentsEmpty")}</p>`;
    return;
  }
  list.innerHTML = filtered
    .map(
      (document) => `
        <button type="button" class="document-row${document.id === activeId ? " active" : ""}" data-id="${document.id}">
          <strong>${escapeHtml(document.name)}</strong>
          <span class="hint">${formatDate(document.updated_at)}</span>
        </button>`,
    )
    .join("");
  for (const row of list.querySelectorAll<HTMLButtonElement>(".document-row")) {
    row.addEventListener("click", () => openDocument(row.dataset.id ?? ""));
  }
}

function openDocument(id: string): void {
  const document = documents.find((entry) => entry.id === id);
  if (!document) {
    return;
  }
  activeId = document.id;
  byId<HTMLElement>("documents-editor").hidden = false;
  byId<HTMLElement>("documents-empty").hidden = true;
  byId<HTMLInputElement>("documents-name").value = document.name;
  byId<HTMLTextAreaElement>("documents-body").value = document.body;
  setMessage("");
  updateStats();
  renderList();
}

function newDocument(): void {
  activeId = null;
  byId<HTMLElement>("documents-editor").hidden = false;
  byId<HTMLElement>("documents-empty").hidden = true;
  byId<HTMLInputElement>("documents-name").value = "";
  byId<HTMLTextAreaElement>("documents-body").value = "";
  setMessage("");
  updateStats();
  renderList();
}

async function saveDocument(): Promise<void> {
  const name = byId<HTMLInputElement>("documents-name").value.trim();
  const body = byId<HTMLTextAreaElement>("documents-body").value;
  if (!name) {
    setMessage(t("documentsNameRequired"), "error");
    return;
  }
  try {
    const saved = await invoke<DocumentView>("save_document", {
      input: { id: activeId, name, body },
    });
    activeId = saved.id;
    setMessage(t("documentsSaved"));
    await loadDocuments();
  } catch (error) {
    setMessage(String(error), "error");
  }
}

async function deleteDocument(): Promise<void> {
  if (!activeId) {
    return;
  }
  const confirmed = await confirmDialog(t("documentsDeleteConfirm"));
  if (!confirmed) {
    return;
  }
  try {
    await invoke("delete_document", { id: activeId });
    newDocument();
    await loadDocuments();
    setMessage(t("documentsDeleted"));
  } catch (error) {
    setMessage(String(error), "error");
  }
}

function updateStats(): void {
  const body = byId<HTMLTextAreaElement>("documents-body").value;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  byId<HTMLElement>("documents-stats").textContent =
    `${words} ${t("documentsWords")} · ${body.length} ${t("documentsCharacters")}`;
}

function setMessage(text: string, kind: "ok" | "error" = "ok"): void {
  const message = byId<HTMLElement>("documents-message");
  message.textContent = text;
  message.dataset.kind = kind;
}

function formatDate(millis: number): string {
  return millis ? new Date(millis).toLocaleString(language) : "—";
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
