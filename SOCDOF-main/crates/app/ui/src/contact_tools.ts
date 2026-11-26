//! Contact detail and address-book picker dialogs.

import { invoke } from "@tauri-apps/api/core";

import { confirmDialog } from "./dialogs";
import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);
const money = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });

export interface ContactLike {
  id: string;
  kind: "person" | "company";
  contact_type: "customer" | "vendor" | "both" | "guest";
  name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  notes: string | null;
  contact_persons?: { first_name: string; last_name: string; email: string; phone: string; role: string; is_primary: boolean }[];
}

interface InvoiceLike {
  id: string;
  number: string;
  contact_id: string;
  status: string;
  date: string;
  due_date: string;
  total_cents: number;
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayName(contact: ContactLike): string {
  return (
    contact.name?.trim() ||
    contact.company_name?.trim() ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    t("contactDetailUnknown")
  );
}

function typeLabel(contact: ContactLike): string {
  const key = (
    contact.contact_type === "vendor"
      ? "typeVendor"
      : contact.contact_type === "both"
        ? "typeBoth"
        : contact.contact_type === "guest"
          ? "typeGuest"
          : "typeCustomer"
  ) as TranslationKey;
  return t(key);
}

function ensureDialog(id: string, className: string): HTMLDialogElement {
  const existing = document.getElementById(id);
  if (existing) {
    return existing as HTMLDialogElement;
  }
  const dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = className;
  document.body.appendChild(dialog);
  return dialog;
}

export async function openContactDetail(contact: ContactLike): Promise<void> {
  const dialog = ensureDialog("contact-detail-dialog", "editor contact-detail-dialog");
  let invoices: InvoiceLike[] = [];
  try {
    invoices = await invoke<InvoiceLike[]>("list_invoices", { query: null, status: null });
  } catch {
    invoices = [];
  }
  const own = invoices.filter((invoice) => invoice.contact_id === contact.id);
  const paid = own.filter((invoice) => invoice.status === "paid");
  const open = own.filter((invoice) => invoice.status === "sent" || invoice.status === "overdue");
  const revenue = paid.reduce((sum, invoice) => sum + invoice.total_cents, 0);
  const receivables = open.reduce((sum, invoice) => sum + invoice.total_cents, 0);
  const persons = (contact.contact_persons ?? [])
    .map(
      (person) =>
        `<li><strong>${escapeHtml(`${person.first_name} ${person.last_name}`.trim())}</strong>` +
        `${person.role ? ` · ${escapeHtml(person.role)}` : ""}` +
        `${person.email ? `<br><span class="muted">${escapeHtml(person.email)}</span>` : ""}</li>`,
    )
    .join("");
  const invoiceRows = own.length
    ? own
        .map(
          (invoice) =>
            `<tr><td>${escapeHtml(invoice.number)}</td><td>${escapeHtml(invoice.date)}</td>` +
            `<td><span class="badge status-${escapeHtml(invoice.status)}">${escapeHtml(invoice.status)}</span></td>` +
            `<td class="numeric">${money.format(invoice.total_cents / 100)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">${escapeHtml(t("contactDetailNoInvoices"))}</td></tr>`;

  dialog.innerHTML = `
    <div class="editor-head">
      <div class="detail-heading">
        <span class="detail-avatar">${escapeHtml(displayName(contact).slice(0, 2).toUpperCase())}</span>
        <div>
          <h2>${escapeHtml(displayName(contact))}</h2>
          <p class="hint">${escapeHtml(contact.company_name && contact.company_name !== displayName(contact) ? contact.company_name : "")}</p>
        </div>
        <span class="tag">${escapeHtml(typeLabel(contact))}</span>
      </div>
      <button class="icon-button" type="button" data-detail-close aria-label="${escapeHtml(t("close"))}">×</button>
    </div>
    <div class="detail-kpis">
      <div><span>${escapeHtml(t("contactDetailRevenue"))}</span><strong>${money.format(revenue / 100)}</strong></div>
      <div><span>${escapeHtml(t("contactDetailOpen"))}</span><strong>${money.format(receivables / 100)}</strong></div>
      <div><span>${escapeHtml(t("contactDetailInvoices"))}</span><strong>${own.length}</strong></div>
    </div>
    <div class="detail-tabs" role="tablist">
      <button type="button" class="is-active" data-detail-tab="info">${escapeHtml(t("contactDetailInfo"))}</button>
      <button type="button" data-detail-tab="invoices">${escapeHtml(t("contactDetailInvoices"))}</button>
      <button type="button" data-detail-tab="notes">${escapeHtml(t("contactDetailNotes"))}</button>
    </div>
    <div class="detail-panel" data-detail-panel="info">
      <dl class="detail-grid">
        <div><dt>${escapeHtml(t("fieldEmail"))}</dt><dd>${escapeHtml(contact.email) || "–"}</dd></div>
        <div><dt>${escapeHtml(t("fieldPhone"))}</dt><dd>${escapeHtml(contact.phone) || "–"}</dd></div>
        <div><dt>${escapeHtml(t("fieldStreet"))}</dt><dd>${escapeHtml([contact.street, contact.zip, contact.city].filter(Boolean).join(", ")) || "–"}</dd></div>
        <div><dt>${escapeHtml(t("fieldCountry"))}</dt><dd>${escapeHtml(contact.country) || "–"}</dd></div>
        <div><dt>${escapeHtml(t("fieldTaxId"))}</dt><dd>${escapeHtml(contact.tax_id) || "–"}</dd></div>
      </dl>
      ${persons ? `<h3>${escapeHtml(t("contactDetailPersons"))}</h3><ul class="detail-persons">${persons}</ul>` : ""}
    </div>
    <div class="detail-panel" data-detail-panel="invoices" hidden>
      <table><thead><tr><th>${escapeHtml(t("dashboardColNumber"))}</th><th>${escapeHtml(t("dashboardColDate"))}</th><th>${escapeHtml(t("dashboardColStatus"))}</th><th class="numeric">${escapeHtml(t("dashboardColTotal"))}</th></tr></thead><tbody>${invoiceRows}</tbody></table>
    </div>
    <div class="detail-panel" data-detail-panel="notes" hidden>
      <p class="detail-notes">${escapeHtml(contact.notes) || escapeHtml(t("contactDetailNoNotes"))}</p>
    </div>
    <div class="editor-actions">
      <button type="button" class="secondary" data-detail-edit>${escapeHtml(t("edit"))}</button>
      <button type="button" class="secondary" data-detail-invoice>${escapeHtml(t("contactDetailNewInvoice"))}</button>
      <button type="button" class="danger" data-detail-delete>${escapeHtml(t("delete"))}</button>
    </div>`;

  dialog.querySelector<HTMLButtonElement>("[data-detail-close]")?.addEventListener("click", () => dialog.close());
  for (const tab of dialog.querySelectorAll<HTMLButtonElement>("[data-detail-tab]")) {
    tab.addEventListener("click", () => {
      for (const other of dialog.querySelectorAll<HTMLButtonElement>("[data-detail-tab]")) {
        other.classList.toggle("is-active", other === tab);
      }
      for (const panel of dialog.querySelectorAll<HTMLElement>("[data-detail-panel]")) {
        panel.hidden = panel.dataset.detailPanel !== tab.dataset.detailTab;
      }
    });
  }
  dialog.querySelector<HTMLButtonElement>("[data-detail-edit]")?.addEventListener("click", () => {
    dialog.close();
    window.dispatchEvent(new CustomEvent("socdof:edit-contact", { detail: contact }));
  });
  dialog.querySelector<HTMLButtonElement>("[data-detail-invoice]")?.addEventListener("click", () => {
    dialog.close();
    window.dispatchEvent(new CustomEvent("socdof:new-invoice-for", { detail: contact.id }));
  });
  dialog.querySelector<HTMLButtonElement>("[data-detail-delete]")?.addEventListener("click", () => {
    void (async () => {
      if (!(await confirmDialog(t("confirmDeleteContact")))) {
        return;
      }
      try {
        await invoke("delete_contact", { id: contact.id });
        dialog.close();
        window.dispatchEvent(new CustomEvent("socdof:contacts-changed"));
      } catch (error) {
        window.alert(String(error));
      }
    })();
  });
  dialog.showModal();
}

export function openCustomerPicker(selectedId?: string): Promise<ContactLike | null> {
  const dialog = ensureDialog("customer-picker-dialog", "editor customer-picker-dialog");
  return new Promise((resolve) => {
    let contacts: ContactLike[] = [];
    let type = "all";
    let query = "";
    let finished = false;
    const finish = (contact: ContactLike | null) => {
      if (finished) {
        return;
      }
      finished = true;
      dialog.close();
      resolve(contact);
    };

    const render = () => {
      const filtered = contacts.filter((contact) => {
        if (type === "customer" && contact.contact_type !== "customer" && contact.contact_type !== "both") {
          return false;
        }
        if (type === "vendor" && contact.contact_type !== "vendor" && contact.contact_type !== "both") {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = [
          displayName(contact),
          contact.company_name,
          contact.email,
          contact.phone,
          contact.city,
          contact.street,
          contact.tax_id,
          ...(contact.contact_persons ?? []).flatMap((person) => [person.first_name, person.last_name, person.email, person.phone, person.role]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
      const list = dialog.querySelector<HTMLElement>("[data-picker-list]");
      if (!list) {
        return;
      }
      list.innerHTML = filtered.length
        ? filtered
            .map(
              (contact) => `
                <button type="button" class="picker-row ${contact.id === selectedId ? "is-selected" : ""}" data-picker-id="${escapeHtml(contact.id)}">
                  <span class="picker-avatar">${escapeHtml(displayName(contact).slice(0, 2).toUpperCase())}</span>
                  <span class="picker-copy"><strong>${escapeHtml(displayName(contact))}</strong><small>${escapeHtml([contact.email, contact.city].filter(Boolean).join(" · "))}</small></span>
                  <span class="tag">${escapeHtml(typeLabel(contact))}</span>
                </button>`,
            )
            .join("")
        : `<p class="empty">${escapeHtml(t("customerPickerEmpty"))}</p>`;
      for (const button of list.querySelectorAll<HTMLButtonElement>("[data-picker-id]")) {
        button.addEventListener("click", () => {
          const contact = contacts.find((entry) => entry.id === button.dataset.pickerId) ?? null;
          finish(contact);
        });
      }
    };

    dialog.innerHTML = `
      <div class="editor-head">
        <div><h2>${escapeHtml(t("customerPickerTitle"))}</h2><p class="hint">${escapeHtml(t("customerPickerHint"))}</p></div>
        <button class="icon-button" type="button" data-picker-close aria-label="${escapeHtml(t("close"))}">×</button>
      </div>
      <div class="picker-search">
        <input type="search" data-picker-search placeholder="${escapeHtml(t("customerPickerSearch"))}" autofocus>
        <select data-picker-type>
          <option value="all">${escapeHtml(t("customerPickerAll"))}</option>
          <option value="customer">${escapeHtml(t("customerPickerCustomers"))}</option>
          <option value="vendor">${escapeHtml(t("customerPickerSuppliers"))}</option>
        </select>
        <button type="button" data-picker-new>${escapeHtml(t("customerPickerNew"))}</button>
      </div>
      <div class="picker-list" data-picker-list><p class="empty">${escapeHtml(t("loading"))}</p></div>`;

    dialog.querySelector("[data-picker-close]")?.addEventListener("click", () => finish(null));
    dialog.querySelector("[data-picker-new]")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("socdof:new-contact"));
      finish(null);
    });
    dialog.querySelector<HTMLInputElement>("[data-picker-search]")?.addEventListener("input", (event) => {
      query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      render();
    });
    dialog.querySelector<HTMLSelectElement>("[data-picker-type]")?.addEventListener("change", (event) => {
      type = (event.target as HTMLSelectElement).value;
      render();
    });
    dialog.addEventListener("close", () => finish(null), { once: true });

    void invoke<ContactLike[]>("list_contacts", { query: null })
      .then((loaded) => {
        contacts = loaded;
        render();
      })
      .catch((error) => {
        const list = dialog.querySelector<HTMLElement>("[data-picker-list]");
        if (list) {
          list.innerHTML = `<p class="empty">${escapeHtml(String(error))}</p>`;
        }
      });
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("[data-picker-search]")?.focus();
  });
}
