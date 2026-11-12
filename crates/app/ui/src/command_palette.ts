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

const viewGlyphs: Record<string, string> = {
  dashboard: "◈",
  invoices: "▤",
  accounting: "€",
  contacts: "♧",
  products: "▣",
  stock: "▤",
  pos: "▣",
  calendar: "▦",
  templates: "▥",
  purchases: "▥",
  reports: "▥",
  fleet: "▦",
  projects: "▣",
  restaurant: "▤",
  documents: "▤",
  docs: "?",
  users: "U",
  settings: "⚙",
};

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
    const label = tab?.textContent?.trim() || paletteLabel(language, view);
    if (!label) return [];
    const target = view === "pos" ? "accounting" : view;
    return [
      {
        label,
        subtitle: paletteDescription(language, view),
        group: t("commandApps"),
        icon: viewGlyphs[view] ?? label.slice(0, 1).toUpperCase(),
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
        <span class="command-icon" style="--command-icon-color:${escapeHtml(item.color ?? "#4f46e5")}">${escapeHtml(item.icon)}</span>
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
