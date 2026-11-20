//! Global command palette with navigation, actions and data search.

import { invoke } from "@tauri-apps/api/core";

import { detectLanguage, translate, type TranslationKey } from "./i18n";
import { PALETTE_COLORS, paletteDescription, paletteLabel } from "./command_text";
import {
  openCalculator,
  openLanguageModal,
  openTaskView,
  openWidgets,
} from "./workspace_tools";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface ContactLike {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
}

interface ProductLike {
  id: string;
  name: string;
  sku: string;
}

interface InvoiceLike {
  id: string;
  number: string;
  contact_name: string;
}

interface PaletteItem {
  label: string;
  subtitle: string;
  group: string;
  icon: string;
  iconSvg?: string;
  color?: string;
  badge?: string;
  shortcut?: string;
  run: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function navigate(view: string): void {
  document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.click();
}

let contacts: ContactLike[] = [];
let products: ProductLike[] = [];
let invoices: InvoiceLike[] = [];
let selected = 0;
let filteredItems: PaletteItem[] = [];

const viewIcons: Record<string, string> = {
  dashboard: `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`,
  invoices: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>`,
  accounting: `<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>`,
  contacts: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>`,
  products: `<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>`,
  stock: `<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>`,
  purchases: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
  pos: `<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>`,
  calendar: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
};

function paletteIcon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${viewIcons[name] ?? ""}</svg>`;
}

function navigationItems(): PaletteItem[] {
  const buttons = new Map(
    Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view]")).map((tab) => [
      tab.dataset.view ?? "",
      tab,
    ]),
  );
  // Spotlight order measured from the TypeScript reference. `stock` and `pos`
  // have no own tab in this webview; they open the screens that own their data.
  const order = [
    "dashboard",
    "invoices",
    "accounting",
    "contacts",
    "products",
    "stock",
    "purchases",
    "pos",
    "calendar",
  ];
  return order.flatMap((view) => {
    const tab = buttons.get(view);
    const label = paletteLabel(language, view) || tab?.textContent?.trim() || "";
    if (!label) return [];
    const target = view === "pos" ? "accounting" : view;
    return [
      {
        label,
        subtitle: paletteDescription(language, view),
        group: t("commandApps"),
        icon: view,
        iconSvg: paletteIcon(view),
        color: PALETTE_COLORS[view],
        run: () => navigate(target),
      },
    ];
  });
}

function actionItems(): PaletteItem[] {
  return [
    {
      label: t("commandNewContact"),
      subtitle: paletteDescription(language, "contacts"),
      group: t("commandActions"),
      icon: "+",
      color: "#4f46e5",
      run: () => {
        navigate("contacts");
        window.setTimeout(() => document.getElementById("contact-new")?.click(), 60);
      },
    },
    {
      label: t("commandNewProduct"),
      subtitle: paletteDescription(language, "products"),
      group: t("commandActions"),
      icon: "+",
      color: "#2563eb",
      run: () => {
        navigate("products");
        window.setTimeout(() => document.getElementById("product-new")?.click(), 60);
      },
    },
    {
      label: t("commandNewInvoice"),
      subtitle: paletteDescription(language, "invoices"),
      group: t("commandActions"),
      icon: "+",
      color: "#4f46e5",
      run: () => {
        navigate("invoices");
        window.setTimeout(() => document.getElementById("invoice-new")?.click(), 60);
      },
    },
    {
      label: t("commandCalculator"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "=",
      color: "#059669",
      run: openCalculator,
    },
    {
      label: t("commandWidgets"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "▦",
      color: "#7c3aed",
      run: openWidgets,
    },
    {
      label: t("commandTaskview"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "▣",
      color: "#aa8c1e",
      run: openTaskView,
    },
    {
      label: t("commandLanguage"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "A",
      color: "#0d9488",
      run: openLanguageModal,
    },
    {
      label: t("commandTheme"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "◐",
      color: "#d97706",
      run: () => {
        const dark = document.documentElement.dataset.theme === "dark";
        document.documentElement.dataset.theme = dark ? "light" : "dark";
      },
    },
    {
      label: t("navDocs"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "?",
      color: "#0284c7",
      run: () => navigate("docs"),
    },
    {
      label: t("navUsers"),
      subtitle: t("commandActions"),
      group: t("commandActions"),
      icon: "U",
      run: () => navigate("users"),
    },
  ];
}

function dataItems(query: string): PaletteItem[] {
  if (!query.trim()) {
    return [];
  }
  const needle = query.trim().toLowerCase();
  const items: PaletteItem[] = [];
  for (const contact of contacts) {
    const label = contact.name || contact.company_name || contact.email || "";
    if (`${label} ${contact.email ?? ""}`.toLowerCase().includes(needle)) {
      items.push({
        label,
        subtitle: contact.email ?? t("navContacts"),
        group: t("commandData"),
        icon: label.slice(0, 1).toUpperCase(),
        run: () => {
          navigate("contacts");
          const search = document.getElementById("contact-search") as HTMLInputElement | null;
          if (search) {
            search.value = label;
            search.dispatchEvent(new Event("input"));
          }
        },
      });
    }
    if (items.length >= 4) break;
  }
  for (const product of products) {
    if (`${product.name} ${product.sku}`.toLowerCase().includes(needle)) {
      items.push({
        label: product.name,
        subtitle: product.sku || t("navProducts"),
        group: t("commandData"),
        icon: product.name.slice(0, 1).toUpperCase(),
        run: () => {
          navigate("products");
          const search = document.getElementById("product-search") as HTMLInputElement | null;
          if (search) {
            search.value = product.name;
            search.dispatchEvent(new Event("input"));
          }
        },
      });
    }
    if (items.length >= 8) break;
  }
  for (const invoice of invoices) {
    if (`${invoice.number} ${invoice.contact_name}`.toLowerCase().includes(needle)) {
      items.push({
        label: invoice.number,
        subtitle: invoice.contact_name || t("navInvoices"),
        group: t("commandData"),
        icon: "#",
        run: () => {
          navigate("invoices");
          const search = document.getElementById("invoice-search") as HTMLInputElement | null;
          if (search) {
            search.value = invoice.number;
            search.dispatchEvent(new Event("input"));
          }
        },
      });
    }
    if (items.length >= 12) break;
  }
  return items;
}

function render(query: string): void {
  const allItems = [...navigationItems(), ...actionItems(), ...dataItems(query)];
  filteredItems = allItems.filter((item) =>
    `${item.label} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  selected = Math.min(selected, Math.max(0, filteredItems.length - 1));
  const results = document.getElementById("command-results");
  if (!results) return;
  if (!filteredItems.length) {
    results.innerHTML = `<p class="empty">${escapeHtml(t("commandEmpty"))}</p>`;
    return;
  }
  results.innerHTML = filteredItems
    .map((item, index) => {
      return `<button type="button" class="command-row ${index === selected ? "is-selected" : ""}" data-command-index="${index}">
        <span class="command-icon" style="--command-icon-color:${escapeHtml(item.color ?? "#4f46e5")}">${item.iconSvg ?? escapeHtml(item.icon)}</span>
        <span class="command-copy"><span class="command-title"><strong>${escapeHtml(item.label)}</strong>${item.badge ? `<span class="command-badge">${escapeHtml(item.badge)}</span>` : ""}</span><small>${escapeHtml(item.subtitle)}</small></span>
        ${item.shortcut ? `<span class="command-shortcut">${escapeHtml(item.shortcut)}</span>` : ""}
        ${index === selected ? "<b class='command-enter'>↵</b>" : ""}
      </button>`;
    })
    .join("");
  for (const button of results.querySelectorAll<HTMLButtonElement>("[data-command-index]")) {
    button.addEventListener("click", () => {
      const item = filteredItems[Number(button.dataset.commandIndex)];
      if (item) run(item);
    });
  }
  results.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
}

function run(item: PaletteItem): void {
  closeCommandPalette();
  window.setTimeout(item.run, 20);
}

function closeCommandPalette(): void {
  const overlay = document.getElementById("command-overlay");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("palette-desktop");
}

async function loadData(): Promise<void> {
  const [contactList, productList, invoiceList] = await Promise.allSettled([
    invoke<ContactLike[]>("list_contacts", { query: null }),
    invoke<ProductLike[]>("list_products", { query: null }),
    invoke<InvoiceLike[]>("list_invoices", { query: null, status: null }),
  ]);
  contacts = contactList.status === "fulfilled" ? contactList.value : [];
  products = productList.status === "fulfilled" ? productList.value : [];
  invoices = invoiceList.status === "fulfilled" ? invoiceList.value : [];
}

export function openCommandPalette(): void {
  let overlay = document.getElementById("command-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "command-overlay";
    overlay.className = "command-overlay";
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <section class="command-window" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("commandTitle"))}">
      <div class="command-search">
        <span>⌕</span>
        <input type="search" id="command-input" placeholder="${escapeHtml(t("commandPlaceholder"))}" autocomplete="off">
        <span class="command-kbd">⌘ K</span>
      </div>
      <div id="command-results" class="command-results"></div>
      <div class="command-footer">
        <span>↑↓ ${escapeHtml(t("commandNavigate"))}</span>
        <span>Enter ${escapeHtml(t("commandSelect"))}</span>
        <span>Esc ${escapeHtml(t("commandClose"))}</span>
        <b>SOCDOF Spotlight</b>
      </div>
    </section>`;
  const input = document.getElementById("command-input") as HTMLInputElement;
  input.addEventListener("input", () => {
    selected = 0;
    render(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selected = Math.min(selected + 1, Math.max(0, filteredItems.length - 1));
      render(input.value);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      render(input.value);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredItems[selected];
      if (item) run(item);
    } else if (event.key === "Escape") {
      closeCommandPalette();
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeCommandPalette();
  });
  document.body.classList.add("palette-desktop");
  overlay.hidden = false;
  input.value = "";
  selected = 0;
  render("");
  input.focus();
  void loadData().then(() => render(input.value));
}

export function initCommandPalette(): void {
  document.getElementById("command-open")?.addEventListener("click", () => openCommandPalette());
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }
    if (event.key === "Escape") {
      closeCommandPalette();
    }
  });
}
