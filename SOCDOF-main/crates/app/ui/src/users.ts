//! Login gate and local account management.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";
import { openLanguageModal } from "./workspace_tools";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface UserView {
  id: string;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
  must_change_password: boolean;
  created_at: number;
  updated_at: number;
}

interface UserInput {
  id: string | null;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
  password: string;
}

interface SessionUser {
  id: string;
  display_name: string;
  role: string;
}

const SESSION_KEY = "socdof.session";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function session(): SessionUser | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as SessionUser | null;
  } catch {
    return null;
  }
}

function setSession(user: UserView): void {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ id: user.id, display_name: user.display_name, role: user.role }),
  );
}

function roleLabel(role: string): string {
  return role === "admin" ? t("usersAdmin") : t("usersUser");
}

export async function loadUsers(): Promise<void> {
  const list = document.getElementById("users-list");
  const message = document.getElementById("users-message");
  if (!list) return;
  try {
    const users = await invoke<UserView[]>("users");
    const current = session();
    const currentLabel = document.getElementById("users-current");
    if (currentLabel) {
      currentLabel.textContent = current
        ? `${t("usersCurrent")}: ${current.display_name} (${roleLabel(current.role)})`
        : t("usersNoSession");
    }
    list.innerHTML = users.length
      ? users
          .map(
            (user) => `<article class="entity-card user-card">
              <div class="entity-card-head"><div><h3>${escapeHtml(user.display_name)}</h3><p>${escapeHtml(user.username)}</p></div><span class="tag">${escapeHtml(roleLabel(user.role))}</span></div>
              <div class="entity-meta"><span>${user.active ? escapeHtml(t("usersActive")) : escapeHtml(t("usersInactive"))}</span><span>${new Date(user.created_at).toLocaleDateString(language)}</span></div>
              <div class="entity-actions"><button type="button" class="secondary" data-user-edit="${escapeHtml(user.id)}">${escapeHtml(t("edit"))}</button><button type="button" class="danger" data-user-delete="${escapeHtml(user.id)}">${escapeHtml(t("delete"))}</button></div>
            </article>`,
          )
          .join("")
      : `<p class="empty">${escapeHtml(t("usersEmpty"))}</p>`;
    for (const button of list.querySelectorAll<HTMLButtonElement>("[data-user-edit]")) {
      button.addEventListener("click", () => {
        const user = users.find((entry) => entry.id === button.dataset.userEdit);
        if (user) openUserDialog(user);
      });
    }
    for (const button of list.querySelectorAll<HTMLButtonElement>("[data-user-delete]")) {
      button.addEventListener("click", () => {
        const user = users.find((entry) => entry.id === button.dataset.userDelete);
        if (user) void deleteUser(user);
      });
    }
    if (message) message.textContent = "";
  } catch (error) {
    if (message) message.textContent = String(error);
  }
}

function openUserDialog(user?: UserView): void {
  let dialog = document.getElementById("user-dialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "user-dialog";
    dialog.className = "editor";
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `
    <form id="user-form" novalidate>
      <div class="editor-head"><h2>${escapeHtml(user ? t("usersEdit") : t("usersNew"))}</h2><button class="icon-button" type="button" data-user-close aria-label="${escapeHtml(t("close"))}">×</button></div>
      <input type="hidden" id="user-id" value="${escapeHtml(user?.id ?? "")}">
      <div class="form-grid">
        <label class="field"><span>${escapeHtml(t("usersUsername"))}</span><input id="user-username" required value="${escapeHtml(user?.username ?? "")}"></label>
        <label class="field"><span>${escapeHtml(t("usersDisplayName"))}</span><input id="user-display-name" required value="${escapeHtml(user?.display_name ?? "")}"></label>
        <label class="field"><span>${escapeHtml(t("usersRole"))}</span><select id="user-role"><option value="user" ${user?.role === "user" ? "selected" : ""}>${escapeHtml(t("usersUser"))}</option><option value="admin" ${user?.role === "admin" ? "selected" : ""}>${escapeHtml(t("usersAdmin"))}</option></select></label>
        <label class="field"><span>${escapeHtml(t("usersPassword"))}</span><input id="user-password" type="password" autocomplete="new-password" placeholder="${escapeHtml(t("usersPasswordHint"))}"></label>
        <label class="field checkbox-field field-wide"><input id="user-active" type="checkbox" ${user?.active !== false ? "checked" : ""}><span>${escapeHtml(t("usersActive"))}</span></label>
      </div>
      <p id="user-error" class="message" role="alert"></p>
      <div class="editor-actions"><button type="button" class="secondary" data-user-close>${escapeHtml(t("cancel"))}</button><button type="submit">${escapeHtml(t("save"))}</button></div>
    </form>`;
  for (const close of dialog.querySelectorAll<HTMLElement>("[data-user-close]")) {
    close.addEventListener("click", () => dialog?.close());
  }
  dialog.querySelector<HTMLFormElement>("#user-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const error = document.getElementById("user-error");
      const input: UserInput = {
        id: (document.getElementById("user-id") as HTMLInputElement).value || null,
        username: (document.getElementById("user-username") as HTMLInputElement).value,
        display_name: (document.getElementById("user-display-name") as HTMLInputElement).value,
        role: (document.getElementById("user-role") as HTMLSelectElement).value,
        active: (document.getElementById("user-active") as HTMLInputElement).checked,
        password: (document.getElementById("user-password") as HTMLInputElement).value,
      };
      try {
        await invoke("save_user", { input });
        dialog?.close();
        await loadUsers();
      } catch (reason) {
        if (error) error.textContent = String(reason);
      }
    })();
  });
  dialog.showModal();
  (dialog.querySelector("#user-username") as HTMLInputElement | null)?.focus();
}

async function deleteUser(user: UserView): Promise<void> {
  if (!(await confirmDialog(t("usersDeleteConfirm")))) return;
  const message = document.getElementById("users-message");
  try {
    await invoke("delete_user", { id: user.id });
    await loadUsers();
  } catch (error) {
    if (message) message.textContent = String(error);
  }
}

function showGate(): void {
  const gate = document.createElement("div");
  gate.id = "auth-gate";
  gate.className = "auth-gate";
  gate.innerHTML = `
    <form id="auth-form" class="auth-card">
      <p class="eyebrow">SOCDOF</p>
      <h1>${escapeHtml(t("usersLoginTitle"))}</h1>
      <p class="subtitle">${escapeHtml(t("usersLoginHint"))}</p>
      <label class="field"><span>${escapeHtml(t("usersUsername"))}</span><input id="auth-username" autocomplete="username" required></label>
      <label class="field"><span>${escapeHtml(t("usersPassword"))}</span><input id="auth-password" type="password" autocomplete="current-password" required></label>
      <p id="auth-error" class="message" role="alert"></p>
      <button type="submit" class="primary">${escapeHtml(t("usersLogin"))}</button>
      <div class="auth-languages">${(["de", "en", "fr", "es"] as const).map((code) => `<button type="button" data-auth-language="${code}" class="${code === language ? "is-active" : ""}">${code.toUpperCase()}</button>`).join("")}</div>
    </form>`;
  document.body.appendChild(gate);
  for (const button of gate.querySelectorAll<HTMLButtonElement>("[data-auth-language]")) {
    button.addEventListener("click", () => {
      localStorage.setItem("socdof.language", button.dataset.authLanguage ?? "de");
      window.location.reload();
    });
  }
  gate.querySelector<HTMLFormElement>("#auth-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const error = document.getElementById("auth-error");
      try {
        const user = await invoke<UserView>("login_user", {
          username: (document.getElementById("auth-username") as HTMLInputElement).value,
          password: (document.getElementById("auth-password") as HTMLInputElement).value,
        });
        setSession(user);
        gate.remove();
        await loadUsers();
      } catch (reason) {
        if (error) error.textContent = `${t("usersLoginError")}: ${String(reason)}`;
      }
    })();
  });
  (gate.querySelector("#auth-username") as HTMLInputElement | null)?.focus();
}

export async function guardApp(): Promise<void> {
  try {
    const users = await invoke<UserView[]>("users");
    if (users.length > 0 && !session()) {
      showGate();
    }
  } catch {
    // An older database without the users command must not block the app.
  }
}

export function initUsers(): void {
  const view = document.getElementById("view-users");
  if (!view) return;
  view.innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">${escapeHtml(t("usersEyebrow"))}</p><h2>${escapeHtml(t("usersTitle"))}</h2><p class="subtitle">${escapeHtml(t("usersSubtitle"))}</p></div>
      <div class="toolbar"><button type="button" id="users-language">${escapeHtml(t("usersLanguage"))}</button><button type="button" id="users-logout">${escapeHtml(t("usersLogout"))}</button><button type="button" class="primary" id="users-new">${escapeHtml(t("usersNew"))}</button></div>
    </div>
    <p id="users-current" class="hint"></p>
    <p id="users-message" class="message" role="status"></p>
    <div id="users-list" class="entity-list"></div>`;
  document.getElementById("users-new")?.addEventListener("click", () => openUserDialog());
  document.getElementById("users-language")?.addEventListener("click", () => openLanguageModal());
  document.getElementById("users-logout")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  });
  void loadUsers();
}
