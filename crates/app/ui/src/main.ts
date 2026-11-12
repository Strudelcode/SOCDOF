import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

import "./style.css";
import "./screens.css";
import "./parity.css";
import { initTaskbar, initTheme } from "./theme";
import { initRestaurant, loadRestaurant } from "./restaurant";
import { initSettings, loadAppearance, loadSettings } from "./settings";
import { initCommandPalette } from "./command_palette";
import { initWorkspaceTools } from "./workspace_tools";
import { initDocs, loadDocs } from "./docs";
import { initUsers, loadUsers, guardApp } from "./users";
import { openContactDetail, openCustomerPicker } from "./contact_tools";
import { initDashboard, loadDashboard } from "./dashboard";
import { initDocuments, loadDocuments } from "./documents";
import { initCalendar, loadCalendar } from "./calendar";
import { initAccounting, loadAccounting } from "./accounting";
import { initPurchases, loadPurchases } from "./purchases";
import { initReports, loadReports } from "./reports";
import { runRestaurantSmoke } from "./restaurant_smoke";
import { runBackofficeSmoke } from "./backoffice_smoke";
import { applyTranslations, detectLanguage, format, translate, type TranslationKey } from "./i18n";
import { initExternalAssets, loadExternalAssets } from "./external_assets";
import { confirmDialog } from "./dialogs";
import { PARITY_TEXT } from "./parity_text";
import { parseFatturaPa } from "./fattura_import";

interface ShellStatus {
  database: string;
  schema_version: number;
  contacts: number;
  products: number;
  invoices: number;
  users: number;
  lock_owner_pid: number | null;
  started_at: number;
}

interface BackupReport {
  path: string;
  bytes: number;
  database_bytes: number;
  schema_version: number;
  created_at: number;
}

interface ContactPerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
}

interface Contact {
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
  contact_persons: ContactPerson[];
  legacy_id: number | null;
  created_at: number;
  updated_at: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost_price: number;
  tax_rate_bp: number;
  stock: number;
  reorder_level: number;
  target_stock: number;
  barcode: string | null;
  asin: string | null;
  web_link: string | null;
  source_domain: string | null;
  description: string | null;
  image_emoji: string | null;
  active: boolean;
  exclude_from_reorder: boolean;
  legacy_id: number | null;
  created_at: number;
  updated_at: number;
}

interface ContactInput {
  name: string;
  company: string;
  is_company: boolean;
  contact_type: string;
  first_name: string;
  last_name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  tax_id: string;
  notes: string;
}

interface ProductInput {
  name: string;
  sku: string;
  category: string;
  unit: string;
  price_cents: number;
  cost_price_cents: number;
  tax_rate_bp: number;
  stock: number;
  reorder_level: number;
  target_stock: number;
  barcode: string;
  asin: string;
  web_link: string;
  source_domain: string;
  description: string;
  image_emoji: string;
  exclude_from_reorder: boolean;
}

interface SmokeReport {
  schema_version: number;
  database: string;
  backup_path: string;
  backup_bytes: number;
  contact_name: string;
  product_sku: string;
  contact_count: number;
  product_count: number;
}

interface InvoiceItemView {
  description: string;
  quantity_milli: number;
  unit_price_cents: number;
  tax_rate_bp: number;
  net_cents: number;
  tax_cents: number;
  gross_cents: number;
}

interface InvoiceView {
  id: string;
  number: string;
  contact_id: string;
  contact_name: string;
  contact_company: string;
  status: string;
  date: string;
  due_date: string;
  payment_terms: number;
  currency_symbol: string;
  notes: string;
  items: InvoiceItemView[];
  subtotal_cents: number;
  tax_total_cents: number;
  total_cents: number;
  issued_at: number;
  due_at: number;
}

interface InvoiceItemInput {
  description: string;
  quantity_milli: number;
  unit_price_cents: number;
  tax_rate_bp: number;
}

interface InvoiceInput {
  id: string | null;
  number: string;
  contact_id: string;
  status: string;
  date: string;
  due_date: string;
  currency_symbol: string;
  notes: string;
  items: InvoiceItemInput[];
}

interface InvoiceDefaults {
  number: string;
  currency_symbol: string;
  due_days: number;
}

interface InvoicePreviewToken {
  key: string;
  text: string;
  x_pct: number;
  y_pct: number;
  width_pct: number | null;
  font_size: number | null;
  font_weight: string;
  color: string;
  align: string;
}

interface InvoicePreview {
  invoice: InvoiceView;
  template_id: string;
  template_name: string;
  html: string;
  stationery_mode: boolean;
  stationery_source: string;
  tokens: InvoicePreviewToken[];
}

interface InvoiceExportReport {
  format: string;
  path: string;
  bytes: number;
}

interface DialogReply {
  outcome: "chosen" | "cancelled" | "acknowledged" | "error";
  path: string | null;
  error: string | null;
}

interface ProjectTaskView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  estimatedHours: number;
  loggedHours: number;
  dueDate: string;
  billable: boolean;
  createdAt: string;
}

interface ProjectView {
  id: string;
  title: string;
  code: string;
  description: string;
  contactId: string | null;
  clientName: string;
  category: string;
  status: string;
  priority: string;
  budget: number;
  hourlyRate: number;
  startDate: string;
  deadline: string;
  color: string;
  tasks: ProjectTaskView[];
  createdAt: string;
  updatedAt: string;
  progressPct: number;
  loggedHours: number;
  billableValue: number;
  taskCount: number;
  doneTasks: number;
}

interface ProjectContactView {
  id: string;
  name: string;
  city: string;
}

interface ProjectMetricsView {
  activeProjectsCount: number;
  totalBudget: number;
  totalLoggedHours: number;
  totalEstimatedHours: number;
  totalTasksCount: number;
  completedTasksCount: number;
  completionRate: number;
  billableRevenue: number;
}

interface ProjectOverviewView {
  projects: ProjectView[];
  contacts: ProjectContactView[];
  metrics: ProjectMetricsView;
  csvFileName: string;
}

interface ProjectPersistenceView {
  present: boolean;
  tasks: number;
  code: string;
}

type View =
  | "dashboard"
  | "contacts"
  | "products"
  | "stock"
  | "templates"
  | "invoices"
  | "fleet"
  | "projects"
  | "restaurant"
  | "settings"
  | "documents"
  | "calendar"
  | "accounting"
  | "purchases"
  | "reports"
  | "docs"
  | "users";

interface FleetVehicleView {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  type: string;
  fuelType: string;
  vin: string;
  currentOdometer: number;
  assignedDriver: string;
  year: number | null;
  nextInspectionDue: string;
  notes: string;
  status: string;
  createdAt: string;
}

interface FleetTripView {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driver: string;
  date: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  purposeType: string;
  reason: string;
  customerName: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  calculatedCost: number;
  notes: string;
  createdAt: string;
}

interface FleetFuelView {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  date: string;
  odometer: number;
  litersOrKwh: number;
  totalCost: number;
  pricePerUnit: number;
  fuelStation: string;
  notes: string;
  createdAt: string;
}

interface FleetMetrics {
  totalKm: number;
  businessKm: number;
  privateKm: number;
  commuteKm: number;
  businessPct: number;
  privatePct: number;
  commutePct: number;
  fuelCostCents: number;
  taxAllowanceCents: number;
  activeVehicles: number;
}

interface FleetOverviewView {
  vehicles: FleetVehicleView[];
  trips: FleetTripView[];
  fuel: FleetFuelView[];
  metrics: FleetMetrics;
  csvFileName: string;
}

interface ContactMailView {
  contact_id: string;
  recipient: string;
  recipient_name: string;
  subject: string;
  body: string;
  eml: string;
  file_name: string;
  mailto: string;
}

interface FatturaInput {
  documentType: string;
  regimeFiscale: string;
  recipientCode: string;
  pec: string;
  bollo: boolean;
  cup: string;
  cig: string;
}

interface InvoiceFatturaView {
  xml: string;
  file_name: string;
  valid: boolean;
  errors: string[];
  total_cents: number;
}

interface InvoiceDunningView {
  invoice_number: string;
  level: string;
  level_number: number;
  fee_cents: number;
  interest_cents: number;
  days: number;
  deadline: string;
  total_cents: number;
  claim_cents: number;
  subject: string;
  body: string;
  eml: string;
  file_name: string;
}

interface InvoiceMailView {
  invoice_number: string;
  recipient: string;
  subject: string;
  body: string;
  eml: string;
  file_name: string;
  mailto: string;
}

interface InvoicePaymentView {
  invoice_id: string;
  paid_at: number;
  method: string;
  reference: string;
  tse_signature: string | null;
}

const language = detectLanguage();
const pageText = PARITY_TEXT[language];
applyTranslations(language);
initExternalAssets(language);

const statusMessage = byId<HTMLParagraphElement>("status-message");
const backupButton = byId<HTMLButtonElement>("backup-button");
const backupResult = byId<HTMLParagraphElement>("backup-result");
const updateCard = byId<HTMLElement>("update-card");
const updateButton = byId<HTMLButtonElement>("update-button");
const updateResult = byId<HTMLParagraphElement>("update-result");
const contactSearch = byId<HTMLInputElement>("contact-search");
const contactNew = byId<HTMLButtonElement>("contact-new");
const contactBatch = byId<HTMLButtonElement>("contact-batch");
const contactImportFile = byId<HTMLInputElement>("contact-import-file");
const contactExportButton = byId<HTMLButtonElement>("contact-export");
const contactExportMenu = byId<HTMLDivElement>("contact-export-menu");
const contactExportCsv = byId<HTMLButtonElement>("contact-export-csv");
const contactExportVcf = byId<HTMLButtonElement>("contact-export-vcf");
const contactsCount = byId<HTMLParagraphElement>("contacts-count");
const contactsMessage = byId<HTMLParagraphElement>("contacts-message");
const contactsList = byId<HTMLDivElement>("contacts-list");
const productSearch = byId<HTMLInputElement>("product-search");
const productNew = byId<HTMLButtonElement>("product-new");
const productsCount = byId<HTMLParagraphElement>("products-count");
const productsMessage = byId<HTMLParagraphElement>("products-message");
const productsList = byId<HTMLDivElement>("products-list");
const contactDialog = byId<HTMLDialogElement>("contact-dialog");
const contactDialogTitle = byId<HTMLHeadingElement>("contact-dialog-title");
const contactForm = byId<HTMLFormElement>("contact-form");
const contactError = byId<HTMLParagraphElement>("contact-error");
const contactId = byId<HTMLInputElement>("contact-id");
const contactName = byId<HTMLInputElement>("contact-name");
const contactCompany = byId<HTMLInputElement>("contact-company");
const contactIsCompany = byId<HTMLInputElement>("contact-is-company");
const contactType = byId<HTMLSelectElement>("contact-type");
const contactFirstName = byId<HTMLInputElement>("contact-first-name");
const contactLastName = byId<HTMLInputElement>("contact-last-name");
const contactEmail = byId<HTMLInputElement>("contact-email");
const contactPhone = byId<HTMLInputElement>("contact-phone");
const contactStreet = byId<HTMLInputElement>("contact-street");
const contactZip = byId<HTMLInputElement>("contact-zip");
const contactCity = byId<HTMLInputElement>("contact-city");
const contactCountry = byId<HTMLInputElement>("contact-country");
const contactCountrySuggestions = byId<HTMLDivElement>("contact-country-suggestions");
const contactTaxId = byId<HTMLInputElement>("contact-tax-id");
const contactNotes = byId<HTMLTextAreaElement>("contact-notes");
const productDialog = byId<HTMLDialogElement>("product-dialog");
const productDialogTitle = byId<HTMLHeadingElement>("product-dialog-title");
const productForm = byId<HTMLFormElement>("product-form");
const productError = byId<HTMLParagraphElement>("product-error");
const productId = byId<HTMLInputElement>("product-id");
const productName = byId<HTMLInputElement>("product-name");
const productSku = byId<HTMLInputElement>("product-sku");
const productCategory = byId<HTMLInputElement>("product-category");
const productUnit = byId<HTMLInputElement>("product-unit");
const productPrice = byId<HTMLInputElement>("product-price");
const productCostPrice = byId<HTMLInputElement>("product-cost-price");
const productTaxRate = byId<HTMLInputElement>("product-tax-rate");
const productStock = byId<HTMLInputElement>("product-stock");
const productReorder = byId<HTMLInputElement>("product-reorder-level");
const productTargetStock = byId<HTMLInputElement>("product-target-stock");
const productBarcode = byId<HTMLInputElement>("product-barcode");
const productAsin = byId<HTMLInputElement>("product-asin");
const productWebLink = byId<HTMLInputElement>("product-web-link");
const productSourceDomain = byId<HTMLInputElement>("product-source-domain");
const productDescription = byId<HTMLTextAreaElement>("product-description");
const productEmoji = byId<HTMLInputElement>("product-emoji");
const productExcludeReorder = byId<HTMLInputElement>("product-exclude-reorder");
const numberFormat = new Intl.NumberFormat(language);
const updaterConfigured = import.meta.env.VITE_UPDATER_CONFIGURED === "true";

const tabs = document.querySelectorAll<HTMLButtonElement>("[data-view]");
const views: Record<View, HTMLElement> = {
  dashboard: byId<HTMLElement>("view-dashboard"),
  contacts: byId<HTMLElement>("view-contacts"),
  products: byId<HTMLElement>("view-products"),
  stock: byId<HTMLElement>("view-products"),
  templates: byId<HTMLElement>("view-templates"),
  invoices: byId<HTMLElement>("view-invoices"),
  fleet: byId<HTMLElement>("view-fleet"),
  projects: byId<HTMLElement>("view-projects"),
  restaurant: byId<HTMLElement>("view-restaurant"),
  settings: byId<HTMLElement>("view-settings"),
  documents: byId<HTMLElement>("view-documents"),
  calendar: byId<HTMLElement>("view-calendar"),
  accounting: byId<HTMLElement>("view-accounting"),
  purchases: byId<HTMLElement>("view-purchases"),
  reports: byId<HTMLElement>("view-reports"),
  docs: byId<HTMLElement>("view-docs"),
  users: byId<HTMLElement>("view-users"),
};

byId("window-minimize").title = translate(language, "windowMinimize");
byId("window-toggle-maximize").title = translate(language, "windowMaximize");
byId("window-toggle-fullscreen").title = translate(language, "windowFullscreen");
byId("window-minimize").addEventListener("click", () => {
  void invoke("window_minimize");
});
byId("window-toggle-maximize").addEventListener("click", () => {
  void invoke("window_toggle_maximize");
});
byId("window-toggle-fullscreen").addEventListener("click", () => {
  void invoke("window_toggle_fullscreen");
});
byId("window-close").addEventListener("click", () => {
  void invoke("window_close");
});

for (const shortcut of document.querySelectorAll<HTMLButtonElement>("[data-desktop-view]")) {
  shortcut.addEventListener("dblclick", () => {
    const view = shortcut.dataset.desktopView;
    if (view) document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.click();
  });
}

contactSearch.placeholder = pageText.contactSearch;
const setParityText = (id: string, text: string): void => {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
};
setParityText("contacts-new-label", `${translate(language, "contactsNew")}`);
setParityText("contact-batch-label", pageText.contactBatch);
setParityText("contact-import-label", pageText.contactImport);
setParityText("contact-export-label", pageText.contactExportButton);
setParityText("contact-export-options-label", pageText.contactExportOptions);
setParityText("contact-export-all-label", pageText.contactExportAll);
setParityText("contact-export-vcf-label", pageText.contactExportVcf);
productSearch.placeholder = translate(language, "productsSearchPlaceholder");
contactIsCompany.addEventListener("change", () => {
  // The checkbox is enough for the user-facing distinction; no separate field is needed.
});

if (!updaterConfigured) {
  updateCard.hidden = true;
}

let pendingUpdate: Update | null = null;
let updateBusy = false;
let activeView: View = "dashboard";
let contactFilter: "all" | "customer" | "vendor" | "guest" = "all";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setUpdateButton(label: TranslationKey, disabled: boolean): void {
  updateButton.textContent = translate(language, label);
  updateButton.disabled = disabled;
}

function renderStatus(status: ShellStatus): void {
  byId("database").textContent = status.database;
  byId("schema-version").textContent = String(status.schema_version);
  byId("contacts").textContent = numberFormat.format(status.contacts);
  byId("products").textContent = numberFormat.format(status.products);
  byId("invoices").textContent = numberFormat.format(status.invoices);
  byId("users").textContent = numberFormat.format(status.users);
  byId("lock-owner").textContent =
    status.lock_owner_pid === null
      ? translate(language, "noOwner")
      : String(status.lock_owner_pid);
  statusMessage.textContent = "";
}

function renderBackup(report: BackupReport): void {
  backupResult.textContent = format(translate(language, "backupDone"), {
    path: report.path,
    bytes: numberFormat.format(report.bytes),
  });
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function contactDisplayName(contact: Contact): string {
  const name = contact.name?.trim();
  if (name) {
    return name;
  }
  const company = contact.company_name?.trim();
  if (company) {
    return company;
  }
  const person = [contact.first_name, contact.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
  return person || contact.email || "—";
}

function contactTypeLabel(type: Contact["contact_type"]): string {
  const key: TranslationKey =
    type === "vendor"
      ? "typeVendor"
      : type === "both"
        ? "typeBoth"
        : type === "guest"
          ? "typeGuest"
          : "typeCustomer";
  return translate(language, key);
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function addActionButton(
  parent: HTMLElement,
  label: TranslationKey,
  className: string,
  onClick: () => void,
): void {
  const button = makeElement("button", className, translate(language, label));
  button.type = "button";
  button.addEventListener("click", onClick);
  parent.appendChild(button);
}

function renderContacts(contacts: Contact[]): void {
  const counts = {
    all: contacts.length,
    customer: contacts.filter((contact) =>
      contact.contact_type === "customer" || contact.contact_type === "both",
    ).length,
    vendor: contacts.filter((contact) =>
      contact.contact_type === "vendor" || contact.contact_type === "both",
    ).length,
    guest: contacts.filter((contact) => contact.contact_type === "guest").length,
  };
  for (const [name, count] of Object.entries(counts)) {
    const target = document.getElementById(`contacts-count-${name}`);
    if (target) {
      target.textContent = numberFormat.format(count);
    }
  }
  const visible = contacts.filter((contact) => {
    if (contactFilter === "all") {
      return true;
    }
    if (contactFilter === "customer") {
      return contact.contact_type === "customer" || contact.contact_type === "both";
    }
    if (contactFilter === "vendor") {
      return contact.contact_type === "vendor" || contact.contact_type === "both";
    }
    return contact.contact_type === "guest";
  });
  contactsCount.textContent = `${numberFormat.format(contacts.length)} ${pageText.entries} (${translate(
    language,
    "contactsFilterCustomers",
  )} & ${translate(language, "contactsFilterVendors")})`;
  const exportCount = document.getElementById("contact-export-count");
  const exportVcfCount = document.getElementById("contact-export-vcf-count");
  if (exportCount) {
    exportCount.textContent = numberFormat.format(contacts.length);
  }
  if (exportVcfCount) {
    exportVcfCount.textContent = numberFormat.format(contacts.length);
  }
  contactsList.replaceChildren();

  if (visible.length === 0) {
    const empty = makeElement("div", "contacts-empty-state");
    empty.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <p>${pageText.contactsEmpty}</p>
      <button type="button">${pageText.contactsCreateFirst}</button>`;
    empty.querySelector("button")?.addEventListener("click", () => openContactDialog());
    contactsList.appendChild(empty);
    return;
  }

  for (const contact of visible) {
    const card = makeElement("article", "entity-card");
    card.dataset.id = contact.id;

    const head = makeElement("div", "entity-card-head");
    const title = makeElement("div");
    title.appendChild(makeElement("h3", undefined, contactDisplayName(contact)));
    const company = contact.company_name?.trim();
    if (company && company !== contactDisplayName(contact)) {
      title.appendChild(makeElement("p", undefined, company));
    }
    head.appendChild(title);
    head.appendChild(makeElement("span", "tag", contactTypeLabel(contact.contact_type)));
    card.appendChild(head);

    const meta = makeElement("div", "entity-meta");
    if (contact.email) {
      meta.appendChild(makeElement("span", undefined, contact.email));
    }
    if (contact.phone) {
      meta.appendChild(makeElement("span", undefined, contact.phone));
    }
    const place = [contact.zip, contact.city, contact.country]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ");
    if (place) {
      meta.appendChild(makeElement("span", undefined, place));
    }
    // Contact persons of a company: the primary one with its role, as the legacy list shows it.
    const persons = contact.contact_persons ?? [];
    const primary = persons.find((person) => person.is_primary) ?? persons[0];
    if (primary) {
      const fullName = `${primary.first_name} ${primary.last_name}`.trim();
      const role = primary.role.trim();
      const label = role ? `${fullName} (${role})` : fullName;
      if (label) {
        meta.appendChild(makeElement("span", undefined, label));
      }
    }
    // Note is kept in the editor; cards stay compact.
    if (meta.childElementCount > 0) {
      card.appendChild(meta);
    }

    const actions = makeElement("div", "entity-actions");
    addActionButton(actions, "contactDetails", "secondary", () => {
      void openContactDetail(contact);
    });
    addActionButton(actions, "contactEmail", "secondary", () => {
      void openContactEmail(contact).catch((error) => {
        contactsMessage.textContent = describe(error);
      });
    });
    addActionButton(actions, "edit", "secondary", () => openContactDialog(contact));
    addActionButton(actions, "delete", "danger", () => void removeContact(contact));
    card.appendChild(actions);
    contactsList.appendChild(card);
  }
}

function renderProducts(products: Product[]): void {
  productsCount.textContent = format(translate(language, "productsCount"), {
    count: numberFormat.format(products.length),
  });
  productsList.replaceChildren();

  if (products.length === 0) {
    productsList.appendChild(makeElement("p", "empty", translate(language, "productsEmpty")));
    return;
  }

  for (const product of products) {
    const card = makeElement("article", "entity-card");
    card.dataset.id = product.id;

    const head = makeElement("div", "entity-card-head");
    const title = makeElement("div");
    const productNameText = `${product.image_emoji ? `${product.image_emoji} ` : ""}${product.name}`;
    title.appendChild(makeElement("h3", undefined, productNameText));
    if (product.sku) {
      title.appendChild(makeElement("p", undefined, product.sku));
    }
    head.appendChild(title);
    const stockBadge = makeElement(
      "span",
      product.reorder_level > 0 && product.stock <= product.reorder_level ? "tag low" : "tag",
      format(translate(language, "stockCount"), { count: String(product.stock) }),
    );
    head.appendChild(stockBadge);
    card.appendChild(head);

    const meta = makeElement("div", "entity-meta");
    if (product.category) {
      meta.appendChild(makeElement("span", undefined, product.category));
    }
    meta.appendChild(
      makeElement(
        "span",
        undefined,
        format(translate(language, "productPrice"), {
          price: formatMoney(product.price),
        }),
      ),
    );
    if (product.unit) {
      meta.appendChild(makeElement("span", undefined, product.unit));
    }
    card.appendChild(meta);

    const actions = makeElement("div", "entity-actions");
    addActionButton(actions, "labelButton", "secondary", () => void openLabelDialog(product));
    addActionButton(actions, "reorderButton", "secondary", () => void openReorderDialog());
    addActionButton(actions, "edit", "secondary", () => openProductDialog(product));
    addActionButton(actions, "delete", "danger", () => void removeProduct(product));
    card.appendChild(actions);
    productsList.appendChild(card);
  }
}

async function loadContacts(): Promise<void> {
  contactsMessage.textContent = translate(language, "loading");
  try {
    const query = contactSearch.value.trim() || null;
    const contacts = await invoke<Contact[]>("list_contacts", { query });
    renderContacts(contacts);
    contactsMessage.textContent = "";
  } catch (error) {
    contactsMessage.textContent = format(translate(language, "errorLoadContacts"), {
      message: describe(error),
    });
  }
}

async function loadProducts(): Promise<void> {
  productsMessage.textContent = translate(language, "loading");
  try {
    const query = productSearch.value.trim() || null;
    const products = await invoke<Product[]>("list_products", { query });
    renderProducts(products);
    productsMessage.textContent = "";
  } catch (error) {
    productsMessage.textContent = format(translate(language, "errorLoadProducts"), {
      message: describe(error),
    });
  }
}

function updateViewHeader(view: View): void {
  const tab = Array.from(tabs).find((entry) => entry.dataset.view === view);
  const title = document.getElementById("app-title");
  if (title && tab?.textContent) {
    title.textContent = tab.textContent.trim();
  }
  const tag = document.getElementById("app-tag");
  if (tag) {
    tag.textContent = `[${view.toUpperCase()}]`;
  }
}

async function showView(view: View): Promise<void> {
  activeView = view;
  updateViewHeader(view);
  for (const [name, element] of Object.entries(views)) {
    element.hidden = name !== view;
  }
  for (const tab of tabs) {
    const selected = tab.dataset.view === view;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }

  if (view === "contacts") {
    await loadContacts();
  } else if (view === "products" || view === "stock") {
    await loadProducts();
  } else if (view === "templates") {
    await loadTemplates();
  } else if (view === "invoices") {
    await loadInvoiceBanner();
    await loadInvoices();
  } else if (view === "fleet") {
    await loadFleet();
  } else if (view === "projects") {
    await loadProjects();
  } else if (view === "restaurant") {
    await loadRestaurant();
  } else if (view === "settings") {
    await loadSettings();
  } else if (view === "documents") {
    await loadDocuments();
  } else if (view === "calendar") {
    await loadCalendar();
  } else if (view === "accounting") {
    await loadAccounting();
  } else if (view === "purchases") {
    await loadPurchases();
  } else if (view === "reports") {
    await loadReports();
  } else if (view === "docs") {
    loadDocs();
  } else if (view === "users") {
    await loadUsers();
  } else if (view === "dashboard") {
    await Promise.all([refreshStatus(), loadDashboard(), loadAppearance()]);
  } else {
    await refreshStatus();
  }
}

function contactInput(): ContactInput {
  return {
    name: contactName.value,
    company: contactCompany.value,
    is_company: contactIsCompany.checked,
    contact_type: contactType.value,
    first_name: contactFirstName.value,
    last_name: contactLastName.value,
    street: contactStreet.value,
    zip: contactZip.value,
    city: contactCity.value,
    country: contactCountry.value,
    email: contactEmail.value,
    phone: contactPhone.value,
    tax_id: contactTaxId.value,
    notes: contactNotes.value,
  };
}

// Country suggestions of the contact dialog: the core matches them like `searchCountries()`, this
// frontend only renders the returned list and writes the chosen name into the input.
interface CountrySuggestion {
  code: string;
  name: string;
  flag: string;
}

let countrySuggestions: CountrySuggestion[] = [];
let activeCountryIndex = 0;

function closeCountrySuggestions(): void {
  countrySuggestions = [];
  activeCountryIndex = 0;
  contactCountrySuggestions.hidden = true;
  contactCountrySuggestions.replaceChildren();
}

function selectCountry(item: CountrySuggestion): void {
  contactCountry.value = item.name;
  closeCountrySuggestions();
  contactCountry.focus();
}

function renderCountrySuggestions(): void {
  contactCountrySuggestions.replaceChildren();
  if (countrySuggestions.length === 0) {
    contactCountrySuggestions.hidden = true;
    return;
  }

  contactCountrySuggestions.hidden = false;
  const heading = document.createElement("p");
  heading.className = "country-suggestions-title";
  heading.textContent = translate(language, "countrySuggestions");
  contactCountrySuggestions.append(heading);

  countrySuggestions.forEach((item, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = index === activeCountryIndex ? "country-suggestion active" : "country-suggestion";
    option.textContent = `${item.flag} ${item.name}`;
    // Keep the focus in the input so the click still selects the country.
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectCountry(item));
    contactCountrySuggestions.append(option);
  });
}

async function updateCountrySuggestions(): Promise<void> {
  try {
    countrySuggestions = await invoke<CountrySuggestion[]>("search_countries", {
      query: contactCountry.value,
      language,
    });
  } catch {
    countrySuggestions = [];
  }
  activeCountryIndex = 0;
  renderCountrySuggestions();
}

contactCountry.addEventListener("input", () => void updateCountrySuggestions());
contactCountry.addEventListener("focus", () => void updateCountrySuggestions());
contactCountry.addEventListener("keydown", (event) => {
  if (countrySuggestions.length === 0) {
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeCountryIndex = (activeCountryIndex + 1) % countrySuggestions.length;
    renderCountrySuggestions();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeCountryIndex =
      activeCountryIndex > 0 ? activeCountryIndex - 1 : countrySuggestions.length - 1;
    renderCountrySuggestions();
  } else if (event.key === "Enter") {
    const item = countrySuggestions[activeCountryIndex];
    if (item) {
      event.preventDefault();
      selectCountry(item);
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeCountrySuggestions();
  }
});
document.addEventListener("pointerdown", (event) => {
  if (event.target instanceof Node && !contactCountrySuggestions.contains(event.target)) {
    closeCountrySuggestions();
  }
});

function openContactDialog(contact?: Contact): void {
  contactDialogTitle.textContent = translate(
    language,
    contact ? "contactEditTitle" : "contactNewTitle",
  );
  contactError.textContent = "";
  contactId.value = contact?.id ?? "";
  contactName.value = contact?.name ?? contact?.company_name ?? "";
  contactCompany.value = contact?.company_name ?? "";
  contactIsCompany.checked = contact?.kind === "company";
  contactType.value = contact?.contact_type ?? "customer";
  contactFirstName.value = contact?.first_name ?? "";
  contactLastName.value = contact?.last_name ?? "";
  contactEmail.value = contact?.email ?? "";
  contactPhone.value = contact?.phone ?? "";
  contactStreet.value = contact?.street ?? "";
  contactZip.value = contact?.zip ?? "";
  contactCity.value = contact?.city ?? "";
  // The legacy modal opens new contacts with the German default country.
  contactCountry.value = contact?.country ?? "Deutschland";
  closeCountrySuggestions();
  contactTaxId.value = contact?.tax_id ?? "";
  contactNotes.value = contact?.notes ?? "";
  contactDialog.showModal();
  contactName.focus();
}

async function removeContact(contact: Contact): Promise<void> {
  if (!(await confirmDialog(translate(language, "confirmDeleteContact")))) {
    return;
  }
  try {
    await invoke("delete_contact", { id: contact.id });
    await refreshStatus();
    await loadContacts();
  } catch (error) {
    contactsMessage.textContent = format(translate(language, "errorDeleteContact"), {
      message: describe(error),
    });
  }
}

function productInput(): ProductInput {
  const price = Number.parseFloat(productPrice.value || "0");
  const cost = Number.parseFloat(productCostPrice.value || "0");
  const tax = Number.parseFloat(productTaxRate.value || "19");
  return {
    name: productName.value,
    sku: productSku.value,
    category: productCategory.value,
    unit: productUnit.value,
    price_cents: Math.round((Number.isFinite(price) ? price : 0) * 100),
    cost_price_cents: Math.round((Number.isFinite(cost) ? cost : 0) * 100),
    tax_rate_bp: Math.round((Number.isFinite(tax) ? tax : 19) * 100),
    stock: Math.round(Number.parseFloat(productStock.value || "0")),
    reorder_level: Math.round(Number.parseFloat(productReorder.value || "0")),
    target_stock: Math.round(Number.parseFloat(productTargetStock.value || "0")),
    barcode: productBarcode.value,
    asin: productAsin.value,
    web_link: productWebLink.value,
    source_domain: productSourceDomain.value,
    description: productDescription.value,
    image_emoji: productEmoji.value,
    exclude_from_reorder: productExcludeReorder.checked,
  };
}

function openProductDialog(product?: Product): void {
  productDialogTitle.textContent = translate(
    language,
    product ? "productEditTitle" : "productNewTitle",
  );
  productError.textContent = "";
  productId.value = product?.id ?? "";
  productName.value = product?.name ?? "";
  productSku.value = product?.sku ?? "";
  productCategory.value = product?.category ?? "";
  productUnit.value = product?.unit ?? "Stk";
  productPrice.value = product ? (product.price / 100).toFixed(2) : "0.00";
  productCostPrice.value = product ? (product.cost_price / 100).toFixed(2) : "0.00";
  productTaxRate.value = product ? String(product.tax_rate_bp / 100) : "19";
  productStock.value = product ? String(product.stock) : "0";
  productReorder.value = product ? String(product.reorder_level) : "0";
  productTargetStock.value = product ? String(product.target_stock) : "0";
  productBarcode.value = product?.barcode ?? "";
  productAsin.value = product?.asin ?? "";
  productWebLink.value = product?.web_link ?? "";
  productSourceDomain.value = product?.source_domain ?? "";
  productDescription.value = product?.description ?? "";
  productEmoji.value = product?.image_emoji ?? "";
  productExcludeReorder.checked = product?.exclude_from_reorder ?? false;
  productDialog.showModal();
  productName.focus();
}

async function removeProduct(product: Product): Promise<void> {
  if (!(await confirmDialog(translate(language, "confirmDeleteProduct")))) {
    return;
  }
  try {
    await invoke("delete_product", { id: product.id });
    await refreshStatus();
    await loadProducts();
  } catch (error) {
    productsMessage.textContent = format(translate(language, "errorDeleteProduct"), {
      message: describe(error),
    });
  }
}

async function refreshStatus(): Promise<void> {
  try {
    renderStatus(await invoke<ShellStatus>("database_status"));
  } catch (error) {
    statusMessage.textContent = format(translate(language, "errorStatus"), {
      message: describe(error),
    });
  }
}

async function checkForUpdates(): Promise<void> {
  if (updateBusy) {
    return;
  }

  updateBusy = true;
  pendingUpdate = null;
  setUpdateButton("updateChecking", true);
  updateResult.textContent = "";

  try {
    const candidate = await check({ timeout: 20_000 });
    if (!candidate) {
      updateResult.textContent = translate(language, "updateNone");
      setUpdateButton("updateAction", false);
      return;
    }

    pendingUpdate = candidate;
    updateResult.textContent = format(translate(language, "updateAvailable"), {
      version: candidate.version,
    });
    setUpdateButton("updateInstall", false);
  } catch (error) {
    updateResult.textContent = format(translate(language, "updateError"), {
      message: describe(error),
    });
    setUpdateButton("updateAction", false);
  } finally {
    updateBusy = false;
  }
}

async function installUpdate(): Promise<void> {
  const update = pendingUpdate;
  if (!update) {
    await checkForUpdates();
    return;
  }
  if (updateBusy) {
    return;
  }

  updateBusy = true;
  setUpdateButton("updateInstalling", true);
  updateResult.textContent = translate(language, "updateInstalling");

  let downloaded = 0;
  let total: number | undefined;

  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength;
        updateResult.textContent = translate(language, "updateInstalling");
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        const percent =
          total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
        updateResult.textContent = format(translate(language, "updateProgress"), {
          percent: String(percent),
        });
      } else {
        updateResult.textContent = translate(language, "updateRestarting");
      }
    });

    updateResult.textContent = translate(language, "updateRestarting");
    await relaunch();
  } catch (error) {
    updateResult.textContent = format(translate(language, "updateError"), {
      message: describe(error),
    });
    setUpdateButton("updateInstall", false);
  } finally {
    updateBusy = false;
  }
}

function smokeContactInput(city: string, notes: string): ContactInput {
  return {
    name: "GUI Smoke Kontakt",
    company: "Smoke GmbH",
    is_company: true,
    contact_type: "customer",
    first_name: "",
    last_name: "",
    street: "Teststraße 1",
    zip: "10115",
    city,
    country: "Deutschland",
    email: "smoke@example.invalid",
    phone: "+49 30 1234567",
    tax_id: "DE-SMOKE",
    notes,
  };
}

function smokeProductInput(priceCents: number): ProductInput {
  return {
    name: "GUI Smoke Produkt",
    sku: "SMOKE-GUI-001",
    category: "Smoke",
    unit: "Stk",
    price_cents: priceCents,
    cost_price_cents: 500,
    tax_rate_bp: 1900,
    stock: 7,
    reorder_level: 2,
    target_stock: 10,
    barcode: "1234567890123",
    asin: "B08N5WRWNW",
    web_link: "https://www.amazon.de/dp/B08N5WRWNW",
    source_domain: "Amazon (DE)",
    description: "GUI smoke product",
    image_emoji: "🧪",
    exclude_from_reorder: false,
  };
}

interface SmokeOptions {
  tray: boolean;
  dialogs: "chosen" | "cancel" | "";
  quit: boolean;
}

async function runSmokeDialogs(expectation: "chosen" | "cancel"): Promise<void> {
  const expected = expectation === "cancel" ? "cancelled" : "chosen";
  const folder = await invoke<DialogReply>("pick_folder");
  const open = await invoke<DialogReply>("pick_open_file", { extensions: ["json"] });
  const save = await invoke<DialogReply>("pick_save_file", {
    suggestedName: "smoke-export.pdf",
  });
  const message = await invoke<DialogReply>("show_message", {
    text: "SOCDOF smoke dialog",
    title: "SOCDOF",
  });
  if (message.outcome !== "acknowledged") {
    throw new Error(`smoke message dialog returned ${message.outcome}`);
  }
  const confirmation = await invoke<DialogReply>("confirm_message", {
    text: "SOCDOF smoke confirmation",
    title: "SOCDOF",
  });
  const expectedConfirmation = expectation === "cancel" ? "cancelled" : "confirmed";
  if (confirmation.outcome !== expectedConfirmation) {
    throw new Error(
      `smoke confirmation returned ${confirmation.outcome}, expected ${expectedConfirmation}`,
    );
  }
  const externalTemplates = await invoke<{ filename: string }[]>("list_external_templates");
  if (externalTemplates.length === 0) {
    throw new Error("smoke external template folder is empty");
  }
  const externalTemplate = await invoke<{ success: boolean; error: string | null }>(
    "read_external_template",
    { filename: externalTemplates[0].filename },
  );
  if (!externalTemplate.success) {
    throw new Error(`smoke external template read failed: ${externalTemplate.error ?? "unknown"}`);
  }
  for (const [kind, reply] of [
    ["folder", folder],
    ["open", open],
    ["save", save],
  ] as const) {
    if (reply.outcome !== expected) {
      throw new Error(`smoke ${kind} dialog returned ${reply.outcome}, expected ${expected}`);
    }
    if (expected === "chosen" && !reply.path) {
      throw new Error(`smoke ${kind} dialog returned no path`);
    }
  }
}

function waitForSmoke(condition: () => boolean, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - started > 10_000) {
        reject(new Error(message));
      } else {
        setTimeout(tick, 25);
      }
    };
    tick();
  });
}

let invoiceActionId: string | null = null;
let invoiceActionFileName = "Entwurf.eml";

function invoiceActionElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

function showInvoiceActionSection(kind: "dunning" | "email" | "payment"): void {
  const sections: Array<[string, string]> = [
    ["dunning", "invoice-dunning-section"],
    ["email", "invoice-email-section"],
    ["payment", "invoice-payment-section"],
  ];
  for (const [name, id] of sections) {
    const section = document.getElementById(id);
    if (section) {
      section.hidden = name !== kind;
    }
  }
  const titles: Record<string, TranslationKey> = {
    dunning: "invoiceDunning",
    email: "invoiceEmail",
    payment: "invoicePayment",
  };
  invoiceActionElement("invoice-action-title").textContent = translate(language, titles[kind]);
}

function dunningParameters(): { level: string; feeCents: number | null; days: number | null } {
  const level = invoiceActionElement<HTMLSelectElement>("dunning-level").value;
  const feeText = invoiceActionElement<HTMLInputElement>("dunning-fee").value.trim().replace(",", ".");
  const daysText = invoiceActionElement<HTMLInputElement>("dunning-days").value.trim();
  const fee = feeText ? Math.round(Number(feeText) * 100) : Number.NaN;
  const days = daysText ? Number(daysText) : Number.NaN;
  return {
    level,
    feeCents: Number.isFinite(fee) ? fee : null,
    days: Number.isFinite(days) ? days : null,
  };
}

async function refreshDunningPreview(): Promise<void> {
  if (!invoiceActionId) {
    return;
  }
  const parameters = dunningParameters();
  const view = await invoke<InvoiceDunningView>("invoice_dunning", {
    id: invoiceActionId,
    level: parameters.level,
    feeCents: parameters.feeCents,
    days: parameters.days,
  });
  invoiceActionFileName = view.file_name;
  invoiceActionElement<HTMLInputElement>("dunning-fee").value = (view.fee_cents / 100).toFixed(2);
  invoiceActionElement<HTMLInputElement>("dunning-days").value = String(view.days);
  invoiceActionElement<HTMLInputElement>("dunning-subject").value = view.subject;
  invoiceActionElement<HTMLTextAreaElement>("dunning-body").value = view.body;
}

async function openInvoiceAction(
  id: string,
  kind: "dunning" | "email" | "payment",
): Promise<void> {
  invoiceActionId = id;
  invoiceActionElement("invoice-action-message").textContent = "";
  showInvoiceActionSection(kind);
  if (kind === "dunning") {
    invoiceActionElement<HTMLSelectElement>("dunning-level").value = "reminder";
    await refreshDunningPreview();
  } else if (kind === "email") {
    const draft = await invoke<InvoiceMailView>("invoice_mail_draft", { id });
    invoiceActionFileName = draft.file_name;
    invoiceActionElement<HTMLInputElement>("email-recipient").value = draft.recipient;
    invoiceActionElement<HTMLInputElement>("email-subject").value = draft.subject;
    invoiceActionElement<HTMLTextAreaElement>("email-body").value = draft.body;
  } else {
    invoiceActionFileName = "Zahlung.eml";
    invoiceActionElement<HTMLSelectElement>("payment-method").value = "transfer";
    invoiceActionElement<HTMLInputElement>("payment-reference").value = "";
  }
  invoiceActionElement<HTMLDialogElement>("invoice-action-dialog").showModal();
}

async function saveInvoiceActionEml(kind: "dunning" | "invoice"): Promise<void> {
  const message = invoiceActionElement("invoice-action-message");
  if (!invoiceActionId) {
    return;
  }
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: invoiceActionFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      message.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    const parameters = kind === "dunning" ? dunningParameters() : null;
    await invoke("export_invoice_eml", {
      id: invoiceActionId,
      kind,
      level: parameters?.level ?? null,
      feeCents: parameters?.feeCents ?? null,
      days: parameters?.days ?? null,
      path: reply.path,
    });
    message.textContent = format(
      translate(language, kind === "dunning" ? "dunningSaved" : "emailSaved"),
      { path: reply.path },
    );
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function recordInvoiceActionPayment(): Promise<void> {
  const message = invoiceActionElement("invoice-action-message");
  if (!invoiceActionId) {
    return;
  }
  try {
    const reference = invoiceActionElement<HTMLInputElement>("payment-reference").value.trim();
    const method = invoiceActionElement<HTMLSelectElement>("payment-method").value;
    const payment = await invoke<InvoicePaymentView>("record_invoice_payment", {
      id: invoiceActionId,
      method,
      reference: reference || null,
      paidAt: null,
    });
    message.textContent = format(translate(language, "paymentRecorded"), {
      reference: payment.reference,
    });
    await loadInvoices();
  } catch (error) {
    message.textContent = describe(error);
  }
}

let contactEmailId: string | null = null;
let contactEmailFileName = "EML_Entwurf_Kontakt.eml";
let fatturaInvoiceId: string | null = null;
let fatturaFileName = "fattura.xml";

function contactEmailValue<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

async function openContactEmail(contact: Contact): Promise<void> {
  const draft = await invoke<ContactMailView>("contact_mail_draft", { id: contact.id });
  contactEmailId = contact.id;
  contactEmailFileName = draft.file_name;
  contactEmailValue<HTMLInputElement>("contact-email-recipient").value = draft.recipient;
  contactEmailValue<HTMLInputElement>("contact-email-subject").value = draft.subject;
  contactEmailValue<HTMLTextAreaElement>("contact-email-body").value = draft.body;
  contactEmailValue("contact-email-message").textContent = "";
  contactEmailValue<HTMLDialogElement>("contact-email-dialog").showModal();
}

async function saveContactEmail(): Promise<void> {
  if (!contactEmailId) {
    return;
  }
  const message = contactEmailValue("contact-email-message");
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: contactEmailFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      message.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    await invoke("export_contact_eml", {
      id: contactEmailId,
      recipientName: contactEmailValue<HTMLInputElement>("contact-email-recipient").value,
      recipientEmail: contactEmailValue<HTMLInputElement>("contact-email-recipient").value,
      subject: contactEmailValue<HTMLInputElement>("contact-email-subject").value,
      body: contactEmailValue<HTMLTextAreaElement>("contact-email-body").value,
      path: reply.path,
    });
    message.textContent = format(translate(language, "contactEmailSaved"), { path: reply.path });
  } catch (error) {
    message.textContent = describe(error);
  }
}

function fatturaInput(): FatturaInput {
  return {
    documentType: contactEmailValue<HTMLSelectElement>("fattura-document-type").value,
    regimeFiscale: contactEmailValue<HTMLSelectElement>("fattura-regime").value,
    recipientCode: contactEmailValue<HTMLInputElement>("fattura-recipient-code").value,
    pec: contactEmailValue<HTMLInputElement>("fattura-pec").value,
    bollo: contactEmailValue<HTMLInputElement>("fattura-bollo").checked,
    cup: contactEmailValue<HTMLInputElement>("fattura-cup").value,
    cig: contactEmailValue<HTMLInputElement>("fattura-cig").value,
  };
}

async function refreshFattura(): Promise<void> {
  if (!fatturaInvoiceId) {
    return;
  }
  const message = contactEmailValue("fattura-message");
  try {
    const view = await invoke<InvoiceFatturaView>("invoice_fattura", {
      id: fatturaInvoiceId,
      input: fatturaInput(),
    });
    fatturaFileName = view.file_name;
    contactEmailValue<HTMLTextAreaElement>("fattura-xml").value = view.xml;
    message.textContent = view.valid
      ? format(translate(language, "fatturaValid"), { file: view.file_name })
      : view.errors.join(" · ");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function openFattura(id: string): Promise<void> {
  fatturaInvoiceId = id;
  contactEmailValue<HTMLSelectElement>("fattura-document-type").value = "TD01";
  contactEmailValue<HTMLSelectElement>("fattura-regime").value = "RF01";
  contactEmailValue<HTMLInputElement>("fattura-recipient-code").value = "0000000";
  contactEmailValue<HTMLInputElement>("fattura-pec").value = "";
  contactEmailValue<HTMLInputElement>("fattura-bollo").checked = false;
  contactEmailValue<HTMLInputElement>("fattura-cup").value = "";
  contactEmailValue<HTMLInputElement>("fattura-cig").value = "";
  contactEmailValue<HTMLDialogElement>("fattura-dialog").showModal();
  await refreshFattura();
}

async function saveFattura(): Promise<void> {
  if (!fatturaInvoiceId) {
    return;
  }
  const message = contactEmailValue("fattura-message");
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: fatturaFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      message.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    await invoke("export_invoice_fattura", {
      id: fatturaInvoiceId,
      input: fatturaInput(),
      path: reply.path,
    });
    message.textContent = format(translate(language, "fatturaSaved"), { path: reply.path });
  } catch (error) {
    message.textContent = describe(error);
  }
}

let fleet: FleetOverviewView | null = null;
let fleetTab: "logbook" | "vehicles" | "fuel" = "logbook";
let fleetVehicleFilter = "all";
let fleetPurposeFilter = "all";
let fleetSearchQuery = "";
let fleetDateFrom = "";
let fleetDateTo = "";
let fleetVehicleId: string | null = null;
let fleetTripId: string | null = null;
let fleetFuelId: string | null = null;

function fleetElement<T extends HTMLElement>(id: string): T {
  return byId<T>(id);
}

function fleetMoney(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function fleetTrips(): FleetTripView[] {
  const trips = fleet?.trips ?? [];
  return trips.filter((trip) => {
    if (fleetVehicleFilter !== "all" && trip.vehicleId !== fleetVehicleFilter) {
      return false;
    }
    if (fleetPurposeFilter !== "all" && trip.purposeType !== fleetPurposeFilter) {
      return false;
    }
    if (fleetDateFrom && trip.date < fleetDateFrom) {
      return false;
    }
    if (fleetDateTo && trip.date > fleetDateTo) {
      return false;
    }
    const query = fleetSearchQuery.trim().toLowerCase();
    if (query) {
      const haystack = [
        trip.vehiclePlate,
        trip.driver,
        trip.startLocation,
        trip.endLocation,
        trip.reason,
        trip.customerName,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

function fleetPurposeLabel(purpose: string): string {
  if (purpose === "business") {
    return translate(language, "fleetPurposeBusiness");
  }
  if (purpose === "private") {
    return translate(language, "fleetPurposePrivate");
  }
  return translate(language, "fleetPurposeCommute");
}

async function loadFleet(): Promise<void> {
  const message = fleetElement<HTMLParagraphElement>("fleet-message");
  message.textContent = translate(language, "loading");
  try {
    fleet = await invoke<FleetOverviewView>("fleet_overview");
    renderFleet();
    message.textContent = "";
  } catch (error) {
    message.textContent = describe(error);
  }
}

function setFleetTab(tab: "logbook" | "vehicles" | "fuel"): void {
  fleetTab = tab;
  fleetElement<HTMLDivElement>("fleet-logbook").hidden = tab !== "logbook";
  fleetElement<HTMLDivElement>("fleet-vehicles").hidden = tab !== "vehicles";
  fleetElement<HTMLDivElement>("fleet-fuel").hidden = tab !== "fuel";
  fleetElement<HTMLButtonElement>("fleet-tab-logbook").classList.toggle("is-active", tab === "logbook");
  fleetElement<HTMLButtonElement>("fleet-tab-vehicles").classList.toggle("is-active", tab === "vehicles");
  fleetElement<HTMLButtonElement>("fleet-tab-fuel").classList.toggle("is-active", tab === "fuel");
}

function renderFleet(): void {
  if (!fleet) {
    return;
  }
  const metrics = fleet.metrics;
  fleetElement("fleet-kpi-total").textContent = `${numberFormat.format(metrics.totalKm)} km`;
  fleetElement("fleet-kpi-business").textContent = `${numberFormat.format(metrics.businessKm)} km (${metrics.businessPct}%)`;
  fleetElement("fleet-kpi-fuel").textContent = fleetMoney(metrics.fuelCostCents);
  fleetElement("fleet-kpi-vehicles").textContent = `${fleet.vehicles.length} ${translate(language, "fleetVehiclesUnit")}`;
  fleetElement("fleet-tab-logbook").textContent = `${translate(language, "fleetTabLogbook")} (${fleetTrips().length})`;
  fleetElement("fleet-tab-vehicles").textContent = `${translate(language, "fleetTabVehicles")} (${fleet.vehicles.length})`;
  fleetElement("fleet-tab-fuel").textContent = `${translate(language, "fleetTabFuel")} (${fleet.fuel.length})`;

  const select = fleetElement<HTMLSelectElement>("fleet-vehicle-filter");
  const selected = fleetVehicleFilter;
  select.replaceChildren();
  const all = makeElement("option", undefined, translate(language, "fleetFilterVehicleAll"));
  all.value = "all";
  select.appendChild(all);
  for (const vehicle of fleet.vehicles) {
    const option = makeElement(
      "option",
      undefined,
      `${vehicle.licensePlate} (${vehicle.make} ${vehicle.model})`,
    );
    option.value = vehicle.id;
    select.appendChild(option);
  }
  select.value = fleet.vehicles.some((vehicle) => vehicle.id === selected) ? selected : "all";
  fleetVehicleFilter = select.value;

  setFleetTab(fleetTab);
  renderFleetLogbook();
  renderFleetVehicles();
  renderFleetFuel();
}

function renderFleetLogbook(): void {
  const container = fleetElement<HTMLDivElement>("fleet-logbook");
  container.replaceChildren();
  const trips = fleetTrips();
  if (trips.length === 0) {
    container.appendChild(makeElement("p", "message", translate(language, "fleetEmptyTrips")));
    return;
  }
  const table = makeElement("table", "fleet-table");
  const head = makeElement("thead");
  const headRow = makeElement("tr");
  for (const key of [
    "fleetDate",
    "fleetVehicle",
    "fleetRoute",
    "fleetReason",
    "fleetPurpose",
    "fleetStartKm",
    "fleetDistance",
    "fleetActions",
  ] as const) {
    headRow.appendChild(makeElement("th", undefined, translate(language, key)));
  }
  head.appendChild(headRow);
  table.appendChild(head);
  const body = makeElement("tbody");
  for (const trip of trips) {
    const row = makeElement("tr");
    row.appendChild(makeElement("td", undefined, `${trip.date} ${trip.startTime}-${trip.endTime}`));
    row.appendChild(makeElement("td", undefined, `${trip.vehiclePlate} · ${trip.driver}`));
    row.appendChild(makeElement("td", undefined, `${trip.startLocation} → ${trip.endLocation}`));
    row.appendChild(makeElement("td", undefined, trip.reason || trip.customerName || "–"));
    row.appendChild(makeElement("td", undefined, fleetPurposeLabel(trip.purposeType)));
    row.appendChild(makeElement("td", "is-right", `${trip.startKm} → ${trip.endKm}`));
    row.appendChild(
      makeElement("td", "is-right", `+${trip.distanceKm} km · ${trip.calculatedCost.toFixed(2)} €`),
    );
    const actions = makeElement("td");
    const buttons = makeElement("div", "fleet-actions");
    addActionButton(buttons, "edit", "secondary", () => openFleetTripDialog(trip));
    addActionButton(buttons, "delete", "danger", () => void deleteFleetTrip(trip.id));
    actions.appendChild(buttons);
    row.appendChild(actions);
    body.appendChild(row);
  }
  table.appendChild(body);
  container.appendChild(table);
}

function renderFleetVehicles(): void {
  const container = fleetElement<HTMLDivElement>("fleet-vehicles");
  container.replaceChildren();
  const vehicles = fleet?.vehicles ?? [];
  if (vehicles.length === 0) {
    container.appendChild(makeElement("p", "message", translate(language, "fleetEmptyVehicles")));
    return;
  }
  const grid = makeElement("div", "grid");
  for (const vehicle of vehicles) {
    const card = makeElement("article", "entity-card");
    card.appendChild(makeElement("h3", undefined, vehicle.licensePlate));
    card.appendChild(makeElement("p", undefined, `${vehicle.make} ${vehicle.model}`));
    const meta = makeElement("div", "entity-meta");
    meta.appendChild(makeElement("span", undefined, `${numberFormat.format(vehicle.currentOdometer)} km`));
    meta.appendChild(makeElement("span", undefined, `${vehicle.fuelType} · ${vehicle.year ?? "–"}`));
    if (vehicle.assignedDriver) {
      meta.appendChild(makeElement("span", undefined, vehicle.assignedDriver));
    }
    if (vehicle.nextInspectionDue) {
      meta.appendChild(makeElement("span", undefined, `TÜV ${vehicle.nextInspectionDue}`));
    }
    card.appendChild(meta);
    card.appendChild(
      makeElement(
        "span",
        `status-tag status-${vehicle.status}`,
        translate(
          language,
          vehicle.status === "active"
            ? "fleetStatusActive"
            : vehicle.status === "maintenance"
              ? "fleetStatusMaintenance"
              : "fleetStatusRetired",
        ),
      ),
    );
    const actions = makeElement("div", "fleet-card-actions");
    addActionButton(actions, "edit", "secondary", () => openFleetVehicleDialog(vehicle));
    addActionButton(actions, "delete", "danger", () => void deleteFleetVehicle(vehicle.id));
    addActionButton(actions, "fleetShowTrips", "secondary", () => {
      fleetVehicleFilter = vehicle.id;
      renderFleet();
      setFleetTab("logbook");
    });
    card.appendChild(actions);
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderFleetFuel(): void {
  const container = fleetElement<HTMLDivElement>("fleet-fuel");
  container.replaceChildren();
  const entries = fleet?.fuel ?? [];
  if (entries.length === 0) {
    container.appendChild(makeElement("p", "message", translate(language, "fleetEmptyFuel")));
    return;
  }
  const table = makeElement("table", "fleet-table");
  const head = makeElement("thead");
  const headRow = makeElement("tr");
  for (const key of [
    "fleetDate",
    "fleetVehicle",
    "fleetStation",
    "fleetOdometer",
    "fleetUnits",
    "fleetPricePerUnit",
    "fleetTotalCost",
    "fleetActions",
  ] as const) {
    headRow.appendChild(makeElement("th", undefined, translate(language, key)));
  }
  head.appendChild(headRow);
  table.appendChild(head);
  const body = makeElement("tbody");
  for (const entry of entries) {
    const row = makeElement("tr");
    row.appendChild(makeElement("td", undefined, entry.date));
    row.appendChild(makeElement("td", undefined, entry.vehiclePlate));
    row.appendChild(makeElement("td", undefined, entry.fuelStation || "–"));
    row.appendChild(makeElement("td", "is-right", `${numberFormat.format(entry.odometer)} km`));
    row.appendChild(makeElement("td", "is-right", entry.litersOrKwh.toFixed(2)));
    row.appendChild(makeElement("td", "is-right", entry.pricePerUnit.toFixed(3)));
    row.appendChild(makeElement("td", "is-right", fleetMoney(Math.round(entry.totalCost * 100))));
    const actions = makeElement("td");
    const buttons = makeElement("div", "fleet-actions");
    addActionButton(buttons, "edit", "secondary", () => openFleetFuelDialog(entry));
    addActionButton(buttons, "delete", "danger", () => void deleteFleetFuel(entry.id));
    actions.appendChild(buttons);
    row.appendChild(actions);
    body.appendChild(row);
  }
  table.appendChild(body);
  container.appendChild(table);
}

function openFleetVehicleDialog(vehicle?: FleetVehicleView): void {
  fleetVehicleId = vehicle?.id ?? null;
  fleetElement("fleet-vehicle-title").textContent = translate(
    language,
    vehicle ? "fleetVehicleEdit" : "fleetVehicleNew",
  );
  fleetElement<HTMLInputElement>("fleet-vehicle-plate").value = vehicle?.licensePlate ?? "";
  fleetElement<HTMLInputElement>("fleet-vehicle-make").value = vehicle?.make ?? "";
  fleetElement<HTMLInputElement>("fleet-vehicle-model").value = vehicle?.model ?? "";
  fleetElement<HTMLSelectElement>("fleet-vehicle-type").value = vehicle?.type ?? "car";
  fleetElement<HTMLSelectElement>("fleet-vehicle-fuel").value = vehicle?.fuelType ?? "diesel";
  fleetElement<HTMLInputElement>("fleet-vehicle-odometer").value = String(
    vehicle?.currentOdometer ?? 0,
  );
  fleetElement<HTMLInputElement>("fleet-vehicle-driver").value = vehicle?.assignedDriver ?? "";
  fleetElement<HTMLInputElement>("fleet-vehicle-year").value = vehicle?.year ? String(vehicle.year) : "";
  fleetElement<HTMLInputElement>("fleet-vehicle-inspection").value =
    vehicle?.nextInspectionDue ?? "";
  fleetElement<HTMLSelectElement>("fleet-vehicle-status").value = vehicle?.status ?? "active";
  fleetElement<HTMLInputElement>("fleet-vehicle-vin").value = vehicle?.vin ?? "";
  fleetElement<HTMLTextAreaElement>("fleet-vehicle-notes").value = vehicle?.notes ?? "";
  fleetElement("fleet-vehicle-message").textContent = "";
  fleetElement<HTMLDialogElement>("fleet-vehicle-dialog").showModal();
}

function fleetVehicleOptions(selected?: string): void {
  for (const id of ["fleet-trip-vehicle", "fleet-fuel-vehicle"]) {
    const select = fleetElement<HTMLSelectElement>(id);
    select.replaceChildren();
    for (const vehicle of fleet?.vehicles ?? []) {
      const option = makeElement(
        "option",
        undefined,
        `${vehicle.licensePlate} - ${vehicle.make} ${vehicle.model}`,
      );
      option.value = vehicle.id;
      select.appendChild(option);
    }
    if (selected && (fleet?.vehicles ?? []).some((vehicle) => vehicle.id === selected)) {
      select.value = selected;
    }
  }
}

function openFleetTripDialog(trip?: FleetTripView): void {
  fleetTripId = trip?.id ?? null;
  fleetElement("fleet-trip-title").textContent = translate(
    language,
    trip ? "fleetTripEdit" : "fleetTripNew",
  );
  fleetVehicleOptions(trip?.vehicleId);
  const first = fleet?.vehicles[0];
  fleetElement<HTMLInputElement>("fleet-trip-driver").value = trip?.driver ?? first?.assignedDriver ?? "";
  fleetElement<HTMLInputElement>("fleet-trip-date").value = trip?.date ?? new Date().toISOString().slice(0, 10);
  fleetElement<HTMLInputElement>("fleet-trip-start-time").value = trip?.startTime ?? "08:30";
  fleetElement<HTMLInputElement>("fleet-trip-end-time").value = trip?.endTime ?? "09:45";
  fleetElement<HTMLInputElement>("fleet-trip-start-location").value = trip?.startLocation ?? "";
  fleetElement<HTMLInputElement>("fleet-trip-end-location").value = trip?.endLocation ?? "";
  fleetElement<HTMLSelectElement>("fleet-trip-purpose").value = trip?.purposeType ?? "business";
  fleetElement<HTMLInputElement>("fleet-trip-reason").value = trip?.reason ?? "";
  fleetElement<HTMLInputElement>("fleet-trip-customer").value = trip?.customerName ?? "";
  fleetElement<HTMLInputElement>("fleet-trip-start-km").value = String(
    trip?.startKm ?? first?.currentOdometer ?? 0,
  );
  fleetElement<HTMLInputElement>("fleet-trip-end-km").value = String(
    trip?.endKm ?? (first?.currentOdometer ?? 0) + 20,
  );
  fleetElement<HTMLTextAreaElement>("fleet-trip-notes").value = trip?.notes ?? "";
  fleetElement("fleet-trip-message").textContent = "";
  fleetElement<HTMLDialogElement>("fleet-trip-dialog").showModal();
}

function openFleetFuelDialog(entry?: FleetFuelView): void {
  fleetFuelId = entry?.id ?? null;
  fleetElement("fleet-fuel-title").textContent = translate(
    language,
    entry ? "fleetFuelEdit" : "fleetFuelNew",
  );
  fleetVehicleOptions(entry?.vehicleId);
  const first = fleet?.vehicles[0];
  fleetElement<HTMLInputElement>("fleet-fuel-date").value = entry?.date ?? new Date().toISOString().slice(0, 10);
  fleetElement<HTMLInputElement>("fleet-fuel-odometer").value = String(
    entry?.odometer ?? first?.currentOdometer ?? 0,
  );
  fleetElement<HTMLInputElement>("fleet-fuel-units").value = String(entry?.litersOrKwh ?? 45);
  fleetElement<HTMLInputElement>("fleet-fuel-total").value = String(entry?.totalCost ?? 80);
  fleetElement<HTMLInputElement>("fleet-fuel-station").value = entry?.fuelStation ?? "";
  fleetElement<HTMLTextAreaElement>("fleet-fuel-notes").value = entry?.notes ?? "";
  fleetElement("fleet-fuel-message").textContent = "";
  fleetElement<HTMLDialogElement>("fleet-fuel-dialog").showModal();
}

async function saveFleetVehicle(): Promise<void> {
  const message = fleetElement("fleet-vehicle-message");
  try {
    const yearText = fleetElement<HTMLInputElement>("fleet-vehicle-year").value;
    await invoke<FleetVehicleView>("save_fleet_vehicle", {
      input: {
        id: fleetVehicleId,
        licensePlate: fleetElement<HTMLInputElement>("fleet-vehicle-plate").value,
        make: fleetElement<HTMLInputElement>("fleet-vehicle-make").value,
        model: fleetElement<HTMLInputElement>("fleet-vehicle-model").value,
        type: fleetElement<HTMLSelectElement>("fleet-vehicle-type").value,
        fuelType: fleetElement<HTMLSelectElement>("fleet-vehicle-fuel").value,
        vin: fleetElement<HTMLInputElement>("fleet-vehicle-vin").value,
        currentOdometer: Number(fleetElement<HTMLInputElement>("fleet-vehicle-odometer").value) || 0,
        assignedDriver: fleetElement<HTMLInputElement>("fleet-vehicle-driver").value,
        year: yearText ? Number(yearText) : null,
        nextInspectionDue: fleetElement<HTMLInputElement>("fleet-vehicle-inspection").value,
        notes: fleetElement<HTMLTextAreaElement>("fleet-vehicle-notes").value,
        status: fleetElement<HTMLSelectElement>("fleet-vehicle-status").value,
      },
    });
    fleetElement<HTMLDialogElement>("fleet-vehicle-dialog").close();
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetSaved");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function saveFleetTrip(): Promise<void> {
  const message = fleetElement("fleet-trip-message");
  try {
    await invoke<FleetTripView>("save_fleet_trip", {
      input: {
        id: fleetTripId,
        vehicleId: fleetElement<HTMLSelectElement>("fleet-trip-vehicle").value,
        driver: fleetElement<HTMLInputElement>("fleet-trip-driver").value,
        date: fleetElement<HTMLInputElement>("fleet-trip-date").value,
        startTime: fleetElement<HTMLInputElement>("fleet-trip-start-time").value,
        endTime: fleetElement<HTMLInputElement>("fleet-trip-end-time").value,
        startLocation: fleetElement<HTMLInputElement>("fleet-trip-start-location").value,
        endLocation: fleetElement<HTMLInputElement>("fleet-trip-end-location").value,
        purposeType: fleetElement<HTMLSelectElement>("fleet-trip-purpose").value,
        reason: fleetElement<HTMLInputElement>("fleet-trip-reason").value,
        customerName: fleetElement<HTMLInputElement>("fleet-trip-customer").value,
        startKm: Number(fleetElement<HTMLInputElement>("fleet-trip-start-km").value) || 0,
        endKm: Number(fleetElement<HTMLInputElement>("fleet-trip-end-km").value) || 0,
        notes: fleetElement<HTMLTextAreaElement>("fleet-trip-notes").value,
      },
    });
    fleetElement<HTMLDialogElement>("fleet-trip-dialog").close();
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetSaved");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function saveFleetFuel(): Promise<void> {
  const message = fleetElement("fleet-fuel-message");
  try {
    await invoke<FleetFuelView>("save_fleet_fuel", {
      input: {
        id: fleetFuelId,
        vehicleId: fleetElement<HTMLSelectElement>("fleet-fuel-vehicle").value,
        date: fleetElement<HTMLInputElement>("fleet-fuel-date").value,
        odometer: Number(fleetElement<HTMLInputElement>("fleet-fuel-odometer").value) || 0,
        litersOrKwh: Number(fleetElement<HTMLInputElement>("fleet-fuel-units").value) || 0,
        totalCost: Number(fleetElement<HTMLInputElement>("fleet-fuel-total").value) || 0,
        fuelStation: fleetElement<HTMLInputElement>("fleet-fuel-station").value,
        notes: fleetElement<HTMLTextAreaElement>("fleet-fuel-notes").value,
      },
    });
    fleetElement<HTMLDialogElement>("fleet-fuel-dialog").close();
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetSaved");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function deleteFleetVehicle(id: string): Promise<void> {
  try {
    await invoke("delete_fleet_vehicle", { id });
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetDeleted");
  } catch (error) {
    fleetElement("fleet-message").textContent = describe(error);
  }
}

async function deleteFleetTrip(id: string): Promise<void> {
  try {
    await invoke("delete_fleet_trip", { id });
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetDeleted");
  } catch (error) {
    fleetElement("fleet-message").textContent = describe(error);
  }
}

async function deleteFleetFuel(id: string): Promise<void> {
  try {
    await invoke("delete_fleet_fuel", { id });
    await loadFleet();
    fleetElement("fleet-message").textContent = translate(language, "fleetDeleted");
  } catch (error) {
    fleetElement("fleet-message").textContent = describe(error);
  }
}

async function exportFleetCsv(): Promise<void> {
  if (!fleet) {
    return;
  }
  const message = fleetElement("fleet-message");
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: fleet.csvFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      message.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    await invoke("export_fleet_csv", { path: reply.path });
    message.textContent = format(translate(language, "fleetCsvSaved"), { path: reply.path });
  } catch (error) {
    message.textContent = describe(error);
  }
}


// ---------------------------------------------------------------------------
// Projects: portfolio, Kanban, KPIs, CSV and billing (ported from ProjectsModule.tsx)
// ---------------------------------------------------------------------------

let projectsState: ProjectOverviewView | null = null;
let projectTab: "portfolio" | "kanban" = "portfolio";
let projectStatusFilter = "all";
let projectCategoryFilter = "all";
let projectSearchQuery = "";
let projectSelectedId: string | null = null;
let projectEditingId: string | null = null;
let projectTaskEditingId: string | null = null;
let projectTaskProjectId: string | null = null;

function projectElement<T extends HTMLElement>(id: string): T {
  return byId<T>(id);
}

function projectMoney(value: number): string {
  return `${value.toFixed(2)} €`;
}

function projectStatusKey(status: string): TranslationKey {
  switch (status) {
    case "planning":
      return "projectStatusPlanning";
    case "review":
      return "projectStatusReview";
    case "completed":
      return "projectStatusCompleted";
    case "on_hold":
      return "projectStatusOnHold";
    case "cancelled":
      return "projectStatusCancelled";
    default:
      return "projectStatusActive";
  }
}

function projectCategoryKey(category: string): TranslationKey {
  switch (category) {
    case "internal":
      return "projectCategoryInternal";
    case "maintenance":
      return "projectCategoryMaintenance";
    case "development":
      return "projectCategoryDevelopment";
    case "marketing":
      return "projectCategoryMarketing";
    default:
      return "projectCategoryClient";
  }
}

function projectPriorityKey(priority: string): TranslationKey {
  switch (priority) {
    case "low":
      return "projectPriorityLow";
    case "high":
      return "projectPriorityHigh";
    case "urgent":
      return "projectPriorityUrgent";
    default:
      return "projectPriorityMedium";
  }
}

function projectTaskStatusKey(status: string): TranslationKey {
  switch (status) {
    case "in_progress":
      return "projectTaskStatusInProgress";
    case "review":
      return "projectTaskStatusReview";
    case "done":
      return "projectTaskStatusDone";
    default:
      return "projectTaskStatusTodo";
  }
}

function projectFilteredProjects(): ProjectView[] {
  const projects = projectsState?.projects ?? [];
  const query = projectSearchQuery.trim().toLowerCase();
  return projects.filter((project) => {
    if (projectStatusFilter !== "all" && project.status !== projectStatusFilter) {
      return false;
    }
    if (projectCategoryFilter !== "all" && project.category !== projectCategoryFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [project.title, project.code, project.clientName, project.description]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

async function loadProjects(): Promise<void> {
  const message = projectElement<HTMLParagraphElement>("project-message");
  message.textContent = translate(language, "loading");
  try {
    projectsState = await invoke<ProjectOverviewView>("project_overview");
    renderProjects();
    message.textContent = "";
  } catch (error) {
    message.textContent = describe(error);
  }
}

function setProjectTab(tab: "portfolio" | "kanban"): void {
  projectTab = tab;
  projectElement<HTMLDivElement>("project-portfolio").hidden = tab !== "portfolio";
  projectElement<HTMLDivElement>("project-kanban").hidden = tab !== "kanban";
  projectElement<HTMLButtonElement>("project-tab-portfolio").classList.toggle(
    "is-active",
    tab === "portfolio",
  );
  projectElement<HTMLButtonElement>("project-tab-kanban").classList.toggle(
    "is-active",
    tab === "kanban",
  );
}

function renderProjects(): void {
  if (!projectsState) {
    return;
  }
  const filtered = projectFilteredProjects();
  const metrics = projectsState.metrics;
  projectElement("project-kpi-active").textContent =
    `${metrics.activeProjectsCount} / ${projectsState.projects.length}`;
  projectElement("project-kpi-progress").textContent =
    `${metrics.completionRate}% (${metrics.completedTasksCount}/${metrics.totalTasksCount})`;
  projectElement("project-kpi-hours").textContent = `${metrics.totalLoggedHours.toFixed(1)} h`;
  projectElement("project-kpi-revenue").textContent = projectMoney(metrics.billableRevenue);
  projectElement("project-tab-portfolio").textContent =
    `${translate(language, "projectTabPortfolio")} (${filtered.length})`;
  projectElement("project-tab-kanban").textContent =
    `${translate(language, "projectTabKanban")} (${projectsState.projects.length})`;
  setProjectTab(projectTab);
  renderProjectPortfolio();
  renderProjectKanban();
}

function renderProjectPortfolio(): void {
  const container = projectElement<HTMLDivElement>("project-portfolio");
  container.replaceChildren();
  const projects = projectFilteredProjects();
  if (projects.length === 0) {
    const empty = makeElement("div", "empty");
    empty.appendChild(makeElement("p", undefined, translate(language, "projectNoProjects")));
    empty.appendChild(makeElement("p", "hint", translate(language, "projectNoProjectsHint")));
    const create = makeElement("button", undefined, translate(language, "projectFirstProject"));
    create.type = "button";
    create.addEventListener("click", () => openProjectDialog());
    empty.appendChild(create);
    container.appendChild(empty);
    return;
  }
  const grid = makeElement("div", "project-grid");
  for (const project of projects) {
    const card = makeElement("article", "project-card");
    const head = makeElement("div", "project-card-head");
    head.appendChild(makeElement("span", "project-code", project.code));
    head.appendChild(
      makeElement(
        "span",
        `project-status status-${project.status}`,
        translate(language, projectStatusKey(project.status)),
      ),
    );
    card.appendChild(head);
    card.appendChild(makeElement("h3", undefined, project.title));
    if (project.clientName) {
      card.appendChild(makeElement("p", "hint", project.clientName));
    }
    card.appendChild(
      makeElement(
        "div",
        "project-meta",
        `${translate(language, "projectTasksLabel")} ${project.doneTasks}/${project.taskCount} · ${project.progressPct}%`,
      ),
    );
    const progress = makeElement("div", "project-progress");
    const bar = makeElement("span");
    bar.style.width = `${project.progressPct}%`;
    progress.appendChild(bar);
    card.appendChild(progress);
    const meta = makeElement("div", "project-meta");
    meta.appendChild(
      makeElement(
        "span",
        undefined,
        `${translate(language, "projectBudgetLabel")}: ${project.budget ? projectMoney(project.budget) : "–"}`,
      ),
    );
    meta.appendChild(
      makeElement("span", undefined, translate(language, projectCategoryKey(project.category))),
    );
    meta.appendChild(
      makeElement(
        "span",
        undefined,
        `${translate(language, "projectLoggedLabel")}: ${project.loggedHours.toFixed(1)} h (${projectMoney(project.billableValue)})`,
      ),
    );
    card.appendChild(meta);
    const actions = makeElement("div", "project-actions");
    addActionButton(actions, "projectBoardOpen", "secondary", () => {
      projectSelectedId = project.id;
      setProjectTab("kanban");
      renderProjectKanban();
    });
    addActionButton(actions, "projectBill", "secondary", () => void billProject(project));
    addActionButton(actions, "edit", "secondary", () => openProjectDialog(project));
    addActionButton(actions, "delete", "danger", () => void deleteProject(project.id));
    card.appendChild(actions);
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderProjectKanban(): void {
  const select = projectElement<HTMLSelectElement>("project-kanban-select");
  const projects = projectsState?.projects ?? [];
  select.replaceChildren();
  for (const project of projects) {
    const option = makeElement("option", undefined, `${project.code} - ${project.title}`);
    option.value = project.id;
    select.appendChild(option);
  }
  const active =
    projects.find((project) => project.id === projectSelectedId) ?? projects[0] ?? null;
  if (active) {
    select.value = active.id;
    projectSelectedId = active.id;
  }
  const board = projectElement<HTMLDivElement>("project-board");
  board.replaceChildren();
  if (!active) {
    board.appendChild(makeElement("p", "message", translate(language, "projectNoProjects")));
    return;
  }
  const columns: { status: string; label: TranslationKey }[] = [
    { status: "todo", label: "projectTaskStatusTodo" },
    { status: "in_progress", label: "projectTaskStatusInProgress" },
    { status: "review", label: "projectTaskStatusReview" },
    { status: "done", label: "projectTaskStatusDone" },
  ];
  for (const column of columns) {
    const box = makeElement("section", "project-column");
    const head = makeElement("div", "project-column-head");
    head.appendChild(makeElement("span", undefined, translate(language, column.label)));
    const tasks = active.tasks.filter((task) => task.status === column.status);
    head.appendChild(makeElement("span", "badge", String(tasks.length)));
    box.appendChild(head);
    if (tasks.length === 0) {
      box.appendChild(makeElement("p", "hint", translate(language, "projectNoTasks")));
    }
    for (const task of tasks) {
      const card = makeElement("article", "project-task");
      const titleRow = makeElement("div", "project-card-head");
      titleRow.appendChild(makeElement("strong", undefined, task.title));
      titleRow.appendChild(
        makeElement(
          "span",
          `project-tag priority-${task.priority}`,
          translate(language, projectPriorityKey(task.priority)),
        ),
      );
      card.appendChild(titleRow);
      if (task.description) {
        card.appendChild(makeElement("p", "hint", task.description));
      }
      const meta = makeElement("div", "project-task-meta");
      meta.appendChild(
        makeElement(
          "span",
          undefined,
          `${task.loggedHours.toFixed(1)} / ${task.estimatedHours.toFixed(1)} h`,
        ),
      );
      if (task.assignee) {
        meta.appendChild(makeElement("span", undefined, task.assignee));
      }
      meta.appendChild(
        makeElement("span", undefined, translate(language, projectTaskStatusKey(task.status))),
      );
      card.appendChild(meta);
      const actions = makeElement("div", "project-task-actions");
      const previous =
        column.status === "done"
          ? "review"
          : column.status === "review"
            ? "in_progress"
            : column.status === "in_progress"
              ? "todo"
              : null;
      const next =
        column.status === "todo"
          ? "in_progress"
          : column.status === "in_progress"
            ? "review"
            : column.status === "review"
              ? "done"
              : null;
      if (previous) {
        addActionButton(actions, "projectTaskBack", "secondary", () => {
          void moveProjectTask(active.id, task.id, previous);
        });
      }
      if (next) {
        addActionButton(actions, "projectTaskNext", "secondary", () => {
          void moveProjectTask(active.id, task.id, next);
        });
      }
      addActionButton(actions, "edit", "secondary", () => openProjectTaskDialog(task));
      addActionButton(actions, "delete", "danger", () =>
        void deleteProjectTask(active.id, task.id),
      );
      card.appendChild(actions);
      box.appendChild(card);
    }
    board.appendChild(box);
  }
}


function fillProjectContacts(selected?: string | null): void {
  const select = projectElement<HTMLSelectElement>("project-contact");
  select.replaceChildren();
  const none = makeElement("option", undefined, translate(language, "projectNoCustomer"));
  none.value = "";
  select.appendChild(none);
  for (const contact of projectsState?.contacts ?? []) {
    const option = makeElement(
      "option",
      undefined,
      `${contact.name}${contact.city ? ` (${contact.city})` : ""}`,
    );
    option.value = contact.id;
    select.appendChild(option);
  }
  if (selected && (projectsState?.contacts ?? []).some((contact) => contact.id === selected)) {
    select.value = selected;
  }
}

function fillProjectTaskProjects(selected?: string | null): void {
  const select = projectElement<HTMLSelectElement>("project-task-project");
  select.replaceChildren();
  for (const project of projectsState?.projects ?? []) {
    const option = makeElement("option", undefined, `${project.code} - ${project.title}`);
    option.value = project.id;
    select.appendChild(option);
  }
  if (selected && (projectsState?.projects ?? []).some((project) => project.id === selected)) {
    select.value = selected;
  }
}

function openProjectDialog(project?: ProjectView): void {
  projectEditingId = project?.id ?? null;
  projectElement("project-dialog-title").textContent = translate(
    language,
    project ? "projectEdit" : "projectNewTitle",
  );
  fillProjectContacts(project?.contactId ?? projectsState?.contacts[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const nextCode = `PRJ-${new Date().getFullYear()}-${String(
    (projectsState?.projects.length ?? 0) + 1,
  ).padStart(2, "0")}`;
  projectElement<HTMLInputElement>("project-title").value = project?.title ?? "";
  projectElement<HTMLInputElement>("project-code").value = project?.code ?? nextCode;
  projectElement<HTMLSelectElement>("project-category").value =
    project?.category ?? "client_work";
  projectElement<HTMLSelectElement>("project-status").value = project?.status ?? "active";
  projectElement<HTMLSelectElement>("project-priority").value = project?.priority ?? "medium";
  projectElement<HTMLInputElement>("project-budget").value = String(project?.budget ?? 2500);
  projectElement<HTMLInputElement>("project-rate").value = String(project?.hourlyRate ?? 95);
  projectElement<HTMLInputElement>("project-start").value = project?.startDate || today;
  projectElement<HTMLInputElement>("project-deadline").value = project?.deadline ?? "";
  projectElement<HTMLInputElement>("project-color").value = project?.color || "#4f46e5";
  projectElement<HTMLTextAreaElement>("project-description").value = project?.description ?? "";
  projectElement("project-form-message").textContent = "";
  projectElement<HTMLDialogElement>("project-dialog").showModal();
}

function openProjectTaskDialog(task?: ProjectTaskView): void {
  projectTaskEditingId = task?.id ?? null;
  projectTaskProjectId =
    task?.projectId ?? projectSelectedId ?? projectsState?.projects[0]?.id ?? null;
  projectElement("project-task-dialog-title").textContent = translate(
    language,
    task ? "projectTaskEdit" : "projectTaskNewTitle",
  );
  fillProjectTaskProjects(projectTaskProjectId);
  projectElement<HTMLInputElement>("project-task-title").value = task?.title ?? "";
  projectElement<HTMLSelectElement>("project-task-status").value = task?.status ?? "todo";
  projectElement<HTMLSelectElement>("project-task-priority").value = task?.priority ?? "medium";
  projectElement<HTMLInputElement>("project-task-assignee").value = task?.assignee ?? "";
  projectElement<HTMLInputElement>("project-task-due").value = task?.dueDate ?? "";
  projectElement<HTMLInputElement>("project-task-estimated").value = String(
    task?.estimatedHours ?? 2,
  );
  projectElement<HTMLInputElement>("project-task-logged").value = String(task?.loggedHours ?? 0);
  projectElement<HTMLInputElement>("project-task-billable").checked = task?.billable ?? true;
  projectElement<HTMLTextAreaElement>("project-task-description").value = task?.description ?? "";
  projectElement("project-task-message").textContent = "";
  projectElement<HTMLDialogElement>("project-task-dialog").showModal();
}

async function saveProject(): Promise<void> {
  const message = projectElement("project-form-message");
  try {
    await invoke<ProjectView>("save_project", {
      input: {
        id: projectEditingId,
        title: projectElement<HTMLInputElement>("project-title").value,
        code: projectElement<HTMLInputElement>("project-code").value,
        description: projectElement<HTMLTextAreaElement>("project-description").value,
        contactId: projectElement<HTMLSelectElement>("project-contact").value || null,
        category: projectElement<HTMLSelectElement>("project-category").value,
        status: projectElement<HTMLSelectElement>("project-status").value,
        priority: projectElement<HTMLSelectElement>("project-priority").value,
        budget: Number(projectElement<HTMLInputElement>("project-budget").value) || 0,
        hourlyRate: Number(projectElement<HTMLInputElement>("project-rate").value) || 0,
        startDate: projectElement<HTMLInputElement>("project-start").value,
        deadline: projectElement<HTMLInputElement>("project-deadline").value,
        color: projectElement<HTMLInputElement>("project-color").value,
      },
    });
    projectElement<HTMLDialogElement>("project-dialog").close();
    await loadProjects();
    projectElement("project-message").textContent = translate(language, "projectSaved");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function saveProjectTask(): Promise<void> {
  const message = projectElement("project-task-message");
  try {
    await invoke<ProjectTaskView>("save_project_task", {
      input: {
        id: projectTaskEditingId,
        projectId: projectElement<HTMLSelectElement>("project-task-project").value,
        title: projectElement<HTMLInputElement>("project-task-title").value,
        description: projectElement<HTMLTextAreaElement>("project-task-description").value,
        status: projectElement<HTMLSelectElement>("project-task-status").value,
        priority: projectElement<HTMLSelectElement>("project-task-priority").value,
        assignee: projectElement<HTMLInputElement>("project-task-assignee").value,
        estimatedHours:
          Number(projectElement<HTMLInputElement>("project-task-estimated").value) || 0,
        loggedHours: Number(projectElement<HTMLInputElement>("project-task-logged").value) || 0,
        dueDate: projectElement<HTMLInputElement>("project-task-due").value,
        billable: projectElement<HTMLInputElement>("project-task-billable").checked,
      },
    });
    projectElement<HTMLDialogElement>("project-task-dialog").close();
    await loadProjects();
    projectElement("project-message").textContent = translate(language, "projectTaskSaved");
  } catch (error) {
    message.textContent = describe(error);
  }
}

async function moveProjectTask(
  projectId: string,
  taskId: string,
  status: string,
): Promise<void> {
  try {
    await invoke("set_project_task_status", { projectId, taskId, status });
    await loadProjects();
  } catch (error) {
    projectElement("project-message").textContent = describe(error);
  }
}

async function deleteProject(id: string): Promise<void> {
  try {
    await invoke("delete_project", { id });
    if (projectSelectedId === id) {
      projectSelectedId = null;
    }
    await loadProjects();
    projectElement("project-message").textContent = translate(language, "projectDeleted");
  } catch (error) {
    projectElement("project-message").textContent = describe(error);
  }
}

async function deleteProjectTask(projectId: string, taskId: string): Promise<void> {
  try {
    await invoke("delete_project_task", { projectId, taskId });
    await loadProjects();
    projectElement("project-message").textContent = translate(language, "projectTaskDeleted");
  } catch (error) {
    projectElement("project-message").textContent = describe(error);
  }
}

async function billProject(project: ProjectView): Promise<void> {
  try {
    const invoice = await invoke<InvoiceView>("create_project_invoice", { id: project.id });
    projectElement("project-message").textContent = `${translate(
      language,
      "projectBillDone",
    )} ${invoice.number}`;
  } catch (error) {
    projectElement("project-message").textContent = describe(error);
  }
}

async function exportProjectsCsv(): Promise<void> {
  if (!projectsState) {
    return;
  }
  const message = projectElement("project-message");
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: projectsState.csvFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      message.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    await invoke("export_projects_csv", { path: reply.path });
    message.textContent = format(translate(language, "projectCsvSaved"), { path: reply.path });
  } catch (error) {
    message.textContent = describe(error);
  }
}

projectElement<HTMLInputElement>("project-search").placeholder = translate(
  language,
  "projectSearchPlaceholder",
);
projectElement<HTMLInputElement>("project-search").addEventListener("input", () => {
  projectSearchQuery = projectElement<HTMLInputElement>("project-search").value;
  renderProjects();
});
projectElement<HTMLSelectElement>("project-status-filter").addEventListener("change", () => {
  projectStatusFilter = projectElement<HTMLSelectElement>("project-status-filter").value;
  renderProjects();
});
projectElement<HTMLSelectElement>("project-category-filter").addEventListener("change", () => {
  projectCategoryFilter = projectElement<HTMLSelectElement>("project-category-filter").value;
  renderProjects();
});
projectElement("project-tab-portfolio").addEventListener("click", () => setProjectTab("portfolio"));
projectElement("project-tab-kanban").addEventListener("click", () => setProjectTab("kanban"));
projectElement("project-new").addEventListener("click", () => openProjectDialog());
projectElement("project-add-task").addEventListener("click", () => openProjectTaskDialog());
projectElement("project-export-csv").addEventListener("click", () => {
  void exportProjectsCsv();
});
projectElement("project-kanban-select").addEventListener("change", () => {
  projectSelectedId = projectElement<HTMLSelectElement>("project-kanban-select").value;
  renderProjectKanban();
});
projectElement<HTMLFormElement>("project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveProject();
});
projectElement<HTMLFormElement>("project-task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveProjectTask();
});

async function runSmokeIfEnabled(): Promise<boolean> {
  let enabled = false;
  try {
    enabled = await invoke<boolean>("smoke_enabled");
  } catch {
    return false;
  }
  if (!enabled) {
    return false;
  }

  if (await invoke<boolean>("smoke_idle")) {
    return false;
  }

  try {
    const status = await invoke<ShellStatus>("database_status");
    renderStatus(status);

    const backup = await invoke<BackupReport>("create_backup");
    renderBackup(backup);

    const contact = await invoke<Contact>("create_contact", {
      input: smokeContactInput("Berlin", "GUI smoke contact"),
    });
    await invoke<Contact>("update_contact", {
      id: contact.id,
      input: smokeContactInput("Potsdam", "GUI smoke contact updated"),
    });

    const product = await invoke<Product>("create_product", {
      input: smokeProductInput(1234),
    });
    await invoke<Product>("update_product", {
      id: product.id,
      input: smokeProductInput(1299),
    });

    contactSearch.value = "GUI Smoke";
    await showView("contacts");
    if (!contactsList.textContent?.includes("GUI Smoke Kontakt")) {
      throw new Error("contacts screen did not render the smoke contact");
    }

    productSearch.value = "SMOKE-GUI-001";
    await showView("products");
    if (!productsList.textContent?.includes("SMOKE-GUI-001")) {
      throw new Error("products screen did not render the smoke product");
    }

    // The template bridge is exercised through the real invoke path: load, change, store, reload.
    const smokeTemplates = await invoke<InvoiceTemplateBook>("invoice_templates");
    if (smokeTemplates.templates.length === 0) {
      throw new Error("template command returned no templates");
    }
    smokeTemplates.templates[0].description = "GUI smoke template";
    await invoke("save_invoice_templates", { book: smokeTemplates });
    await showView("templates");
    if (!templatesList.textContent?.includes("GUI smoke template")) {
      throw new Error("templates screen did not render the stored template");
    }

    // Invoice workflow through the real commands: list -> detail -> change -> save -> preview ->
    // export. The invoices screen renders the same data through the same invoke calls.
    const smokeContacts = await invoke<Contact[]>("list_contacts", { query: "GUI Smoke" });
    const smokeInvoiceContact = smokeContacts[0];
    if (!smokeInvoiceContact) {
      throw new Error("smoke contact missing for the invoice workflow");
    }
    const invoiceDefaults = await invoke<InvoiceDefaults>("invoice_defaults");
    const smokeInvoiceInput: InvoiceInput = {
      id: null,
      number: invoiceDefaults.number,
      contact_id: smokeInvoiceContact.id,
      status: "draft",
      date: "2026-11-01",
      due_date: "2026-11-15",
      currency_symbol: invoiceDefaults.currency_symbol,
      notes: "GUI smoke invoice",
      items: [
        {
          description: "GUI smoke line",
          quantity_milli: 2_000,
          unit_price_cents: 5_000,
          tax_rate_bp: 1_900,
        },
      ],
    };
    const createdInvoice = await invoke<InvoiceView>("save_invoice", {
      input: smokeInvoiceInput,
    });
    if (createdInvoice.total_cents !== 11_900) {
      throw new Error(`unexpected smoke invoice total ${createdInvoice.total_cents}`);
    }
    invoiceSearch.value = createdInvoice.number;
    await showView("invoices");
    if (!invoicesList.textContent?.includes(createdInvoice.number)) {
      throw new Error("invoices screen did not render the smoke invoice");
    }

    const invoiceDetail = await invoke<InvoiceView>("invoice_detail", { id: createdInvoice.id });
    if (invoiceDetail.items.length !== 1 || invoiceDetail.total_cents !== 11_900) {
      throw new Error(
        `unexpected smoke invoice detail ${invoiceDetail.items.length}/${invoiceDetail.total_cents}`,
      );
    }

    // Edit through the real editor UI: card action -> dialog -> form fields -> submit.
    const smokeCard = invoicesList.querySelector<HTMLElement>(
      `tr[data-id="${createdInvoice.id}"]`,
    );
    if (!smokeCard) {
      throw new Error("invoices screen has no row for the smoke invoice");
    }
    const editAction = smokeCard.querySelector<HTMLButtonElement>(
      `button[title="${translate(language, "edit")}"]`,
    );
    if (!editAction) {
      throw new Error("invoice row has no edit action");
    }
    editAction.click();
    await waitForSmoke(() => invoiceDialog.open, "invoice editor did not open");
    if (invoiceNumberInput.value !== createdInvoice.number) {
      throw new Error("invoice editor did not load the smoke invoice");
    }
    invoiceStatusInput.value = "sent";
    invoiceNoteInput.value = "GUI smoke invoice updated";
    const smokeLine = invoiceLinesList.querySelectorAll<HTMLElement>(".invoice-line")[1];
    const smokeLineInputs = smokeLine?.querySelectorAll("input");
    if (!smokeLineInputs || smokeLineInputs.length < 4) {
      throw new Error("invoice editor did not render the smoke line");
    }
    const fillSmokeField = (index: number, value: string) => {
      const input = smokeLineInputs[index];
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    fillSmokeField(1, "3");
    fillSmokeField(2, "60.00");
    invoiceForm.requestSubmit();
    await waitForSmoke(() => !invoiceDialog.open, "invoice editor did not save the change");
    const changedInvoice = await invoke<InvoiceView>("invoice_detail", { id: createdInvoice.id });
    if (changedInvoice.total_cents !== 21_420 || changedInvoice.status !== "sent") {
      throw new Error(
        `unexpected changed smoke invoice ${changedInvoice.total_cents}/${changedInvoice.status}`,
      );
    }
    await showView("invoices");
    if (!invoicesList.textContent?.includes(createdInvoice.number)) {
      throw new Error("invoices screen lost the changed invoice");
    }

    const smokeInvoiceBook = await invoke<InvoiceTemplateBook>("invoice_templates");
    const smokePreview = await invoke<InvoicePreview>("invoice_preview", {
      id: changedInvoice.id,
      templateId: smokeInvoiceBook.activeId,
    });
    for (const needle of [changedInvoice.number, "GUI smoke line", "GUI smoke invoice updated"]) {
      if (!smokePreview.html.includes(needle)) {
        throw new Error(`invoice preview misses ${needle}`);
      }
    }
    await openInvoicePreview(changedInvoice.id);
    if (!invoicePreviewBody.textContent?.includes("GUI smoke line")) {
      throw new Error("preview dialog did not render the invoice");
    }
    invoicePreviewDialog.close();

    const pdfReport = await invoke<InvoiceExportReport>("export_invoice", {
      id: changedInvoice.id,
      templateId: smokeInvoiceBook.activeId,
      format: "pdf",
      path: null,
    });
    const docxReport = await invoke<InvoiceExportReport>("export_invoice", {
      id: changedInvoice.id,
      templateId: smokeInvoiceBook.activeId,
      format: "docx",
      path: null,
    });
    if (pdfReport.bytes <= 0 || docxReport.bytes <= 0) {
      throw new Error("invoice exports are empty");
    }
    const paidInvoice = await invoke<InvoiceView>("set_invoice_status", {
      id: changedInvoice.id,
      status: "paid",
    });
    if (paidInvoice.status !== "paid") {
      throw new Error("invoice status was not stored");
    }

    const smokeOptions = await invoke<SmokeOptions>("smoke_options");
    if (smokeOptions.dialogs) {
      await runSmokeDialogs(smokeOptions.dialogs);
    }
    if (smokeOptions.tray) {
      try {
        await invoke<string[]>("smoke_tray_run", { includeQuit: smokeOptions.quit });
      } catch {
        // The quit entry ends the process while the command is still in flight.
        if (!smokeOptions.quit) {
          throw new Error("tray smoke actions failed");
        }
      }
    }

    // FatturaPA import through the real UI path: File -> change event -> parser ->
    // vendor create/reuse -> draft invoice. The second document must reuse the
    // vendor created by the first one.
    const fatturaXml = (number: string) => `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fornitore Smoke S.r.l.</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via Roma 1</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Nazione>IT</Nazione></Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici><Anagrafica><Denominazione>Cliente Smoke</Denominazione></Anagrafica></DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>TD01</TipoDocumento><Numero>${number}</Numero><Data>2026-11-05</Data>
      <ImportoTotaleDocumento>122.00</ImportoTotaleDocumento><Causale>Smoke import</Causale>
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi><DettaglioLinee>
      <Descrizione>Smoke position</Descrizione><Quantita>1</Quantita>
      <PrezzoUnitario>100.00</PrezzoUnitario><PrezzoTotale>100.00</PrezzoTotale>
      <AliquotaIVA>22.00</AliquotaIVA>
    </DettaglioLinee></DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
    const importFattura = async (number: string): Promise<void> => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([fatturaXml(number)], `${number}.xml`, { type: "application/xml" }));
      invoiceImportFile.files = transfer.files;
      invoiceImportFile.dispatchEvent(new Event("change"));
      await waitForSmoke(
        () => invoicesMessage.textContent?.includes(number) ?? false,
        `FatturaPA import did not create ${number}: ${invoicesMessage.textContent ?? ""}`,
      );
    };
    await showView("invoices");
    await importFattura("SMOKE-PA-9001");
    await importFattura("SMOKE-PA-9002");
    const fatturaVendors = await invoke<Contact[]>("list_contacts", {
      query: "Fornitore Smoke S.r.l.",
    });
    if (fatturaVendors.length !== 1) {
      throw new Error(`FatturaPA vendor was not reused: ${fatturaVendors.length}`);
    }
    const importedInvoices = await invoke<InvoiceView[]>("list_invoices", {
      query: "SMOKE-PA-900",
      status: null,
    });
    if (
      importedInvoices.length !== 2 ||
      importedInvoices.some(
        (invoice) => invoice.status !== "draft" || invoice.contact_id !== fatturaVendors[0].id,
      )
    ) {
      throw new Error(`FatturaPA drafts are incomplete: ${importedInvoices.length}`);
    }
    for (const invoice of importedInvoices) {
      await invoke("delete_invoice", { id: invoice.id });
    }
    await invoke("delete_contact", { id: fatturaVendors[0].id });

    // Contact batch capture through the real dialog: "+ Mehrere anlegen" keeps
    // the dialog open, resets the form and stores each contact immediately.
    contactBatch.click();
    await waitForSmoke(() => contactDialog.open, "batch contact dialog did not open");
    for (let index = 1; index <= 2; index += 1) {
      contactName.value = `GUI Batch ${index}`;
      contactEmail.value = `batch${index}@example.test`;
      contactCountry.value = "Deutschland";
      contactForm.requestSubmit();
      await waitForSmoke(
        () => contactError.textContent?.includes(`${index} Kontakt(e) angelegt`) ?? false,
        `batch contact ${index} was not stored: ${contactError.textContent ?? ""}`,
      );
      if (!contactDialog.open) {
        throw new Error("batch mode closed the contact dialog");
      }
    }
    contactDialog.close();
    const batchContacts = await invoke<Contact[]>("list_contacts", { query: "GUI Batch" });
    if (batchContacts.length !== 2) {
      throw new Error(`batch contacts are incomplete: ${batchContacts.length}`);
    }
    for (const batchContact of batchContacts) {
      await invoke("delete_contact", { id: batchContact.id });
    }

    const contacts = await invoke<Contact[]>("list_contacts", { query: null });
    const products = await invoke<Product[]>("list_products", { query: null });
    const report: SmokeReport = {
      schema_version: status.schema_version,
      database: status.database,
      backup_path: backup.path,
      backup_bytes: backup.bytes,
      contact_name: "GUI Smoke Kontakt",
      product_sku: "SMOKE-GUI-001",
      contact_count: contacts.length,
      product_count: products.length,
    };

    try {
    const smokeDirectory = backup.path.slice(0, backup.path.lastIndexOf("/"));
    // Fleet workflow through the real commands: create, edit, list, export, delete.
    const fleetVehicle = await invoke<FleetVehicleView>("save_fleet_vehicle", {
      input: {
        id: null,
        licensePlate: "SMOKE-GUI 1",
        make: "VW",
        model: "ID.4",
        type: "electric",
        fuelType: "electric",
        vin: "WVWZZZ1JZXW000001",
        currentOdometer: 12_000,
        assignedDriver: "GUI Smoke",
        year: 2024,
        nextInspectionDue: "2027-06-01",
        notes: "GUI smoke vehicle",
        status: "active",
      },
    });
    const fleetVehicleEdited = await invoke<FleetVehicleView>("save_fleet_vehicle", {
      input: {
        id: fleetVehicle.id,
        licensePlate: "SMOKE-GUI 1",
        make: "VW",
        model: "ID.4",
        type: "electric",
        fuelType: "electric",
        vin: "WVWZZZ1JZXW000001",
        currentOdometer: 12_345,
        assignedDriver: "GUI Smoke",
        year: 2024,
        nextInspectionDue: "2027-06-01",
        notes: "GUI smoke vehicle updated",
        status: "maintenance",
      },
    });
    const fleetTrip = await invoke<FleetTripView>("save_fleet_trip", {
      input: {
        id: null,
        vehicleId: fleetVehicleEdited.id,
        driver: "GUI Smoke",
        date: "2026-11-11",
        startTime: "08:30",
        endTime: "09:30",
        startLocation: "Berlin",
        endLocation: "Potsdam",
        purposeType: "business",
        reason: "GUI smoke trip",
        customerName: "Beispiel GmbH",
        startKm: 12_345,
        endKm: 12_375,
        notes: "",
      },
    });
    if (fleetTrip.distanceKm !== 30 || Math.abs(fleetTrip.calculatedCost - 9) > 0.001) {
      throw new Error(`unexpected fleet trip ${fleetTrip.distanceKm} / ${fleetTrip.calculatedCost}`);
    }
    const fleetFuel = await invoke<FleetFuelView>("save_fleet_fuel", {
      input: {
        id: null,
        vehicleId: fleetVehicleEdited.id,
        date: "2026-11-11",
        odometer: 12_375,
        litersOrKwh: 40,
        totalCost: 80,
        fuelStation: "Smoke Tank",
        notes: "",
      },
    });
    if (fleetFuel.pricePerUnit !== 2) {
      throw new Error(`unexpected fuel price ${fleetFuel.pricePerUnit}`);
    }
    const fleetList = await invoke<FleetOverviewView>("fleet_overview");
    const fleetListed = fleetList.vehicles.find((vehicle) => vehicle.id === fleetVehicle.id);
    if (!fleetListed || fleetListed.currentOdometer !== 12_375 || fleetListed.status !== "maintenance") {
      throw new Error("fleet list did not persist the edited vehicle and odometer");
    }
    if (!fleetList.trips.some((trip) => trip.id === fleetTrip.id)) {
      throw new Error("fleet list did not persist the trip");
    }
    if (!fleetList.fuel.some((entry) => entry.id === fleetFuel.id)) {
      throw new Error("fleet list did not persist the fuel receipt");
    }
    await invoke("export_fleet_csv", { path: `${smokeDirectory}/smoke-fleet.csv` });
    await invoke("delete_fleet_trip", { id: fleetTrip.id });
    await invoke("delete_fleet_fuel", { id: fleetFuel.id });
    await invoke("delete_fleet_vehicle", { id: fleetVehicle.id });
    const fleetAfter = await invoke<FleetOverviewView>("fleet_overview");
    if (fleetAfter.vehicles.some((vehicle) => vehicle.id === fleetVehicle.id)) {
      throw new Error("deleted fleet vehicle is still listed");
    }
    if (
      fleetAfter.trips.some((trip) => trip.id === fleetTrip.id) ||
      fleetAfter.fuel.some((entry) => entry.id === fleetFuel.id)
    ) {
      throw new Error("deleted fleet rows are still listed");
    }

    // Project portfolio, Kanban task, persistence, CSV and billing through the real commands.
    const projectItem = await invoke<ProjectView>("save_project", {
      input: {
        id: null,
        title: "SMOKE-GUI Projekt",
        code: "SMK-PRJ-2026",
        description: "GUI smoke project",
        contactId: contact.id,
        category: "development",
        status: "active",
        priority: "high",
        budget: 5000,
        hourlyRate: 95,
        startDate: "2026-11-11",
        deadline: "2026-12-31",
        color: "#4f46e5",
      },
    });
    const projectEdited = await invoke<ProjectView>("save_project", {
      input: {
        id: projectItem.id,
        title: "SMOKE-GUI Projekt",
        code: "SMK-PRJ-2026",
        description: "GUI smoke project updated",
        contactId: contact.id,
        category: "development",
        status: "review",
        priority: "high",
        budget: 6000,
        hourlyRate: 95,
        startDate: "2026-11-11",
        deadline: "2026-12-31",
        color: "#4f46e5",
      },
    });
    if (projectEdited.status !== "review" || projectEdited.budget !== 6000) {
      throw new Error("project edit did not persist the status and budget");
    }
    const projectTask = await invoke<ProjectTaskView>("save_project_task", {
      input: {
        id: null,
        projectId: projectItem.id,
        title: "SMOKE-GUI Aufgabe",
        description: "GUI smoke task",
        status: "in_progress",
        priority: "high",
        assignee: "GUI Smoke",
        estimatedHours: 4,
        loggedHours: 2.5,
        dueDate: "2026-12-15",
        billable: true,
      },
    });
    const projectTaskEdited = await invoke<ProjectTaskView>("save_project_task", {
      input: {
        id: projectTask.id,
        projectId: projectItem.id,
        title: "SMOKE-GUI Aufgabe",
        description: "GUI smoke task updated",
        status: "in_progress",
        priority: "high",
        assignee: "GUI Smoke",
        estimatedHours: 4,
        loggedHours: 3,
        dueDate: "2026-12-15",
        billable: true,
      },
    });
    if (projectTaskEdited.loggedHours !== 3) {
      throw new Error("project task edit did not persist the logged hours");
    }
    await invoke<ProjectTaskView>("set_project_task_status", {
      projectId: projectItem.id,
      taskId: projectTask.id,
      status: "review",
    });
    const projectList = await invoke<ProjectOverviewView>("project_overview");
    const projectListed = projectList.projects.find((project) => project.id === projectItem.id);
    if (!projectListed || projectListed.status !== "review" || projectListed.taskCount !== 1) {
      throw new Error("project list did not persist the edited project and task");
    }
    if (projectListed.tasks[0]?.status !== "review" || projectListed.tasks[0]?.loggedHours !== 3) {
      throw new Error("project list did not persist the task status and hours");
    }
    if (projectList.metrics.billableRevenue !== 285) {
      throw new Error(`unexpected project revenue ${projectList.metrics.billableRevenue}`);
    }
    const projectPersisted = await invoke<ProjectPersistenceView>("project_persistence", {
      id: projectItem.id,
    });
    if (!projectPersisted.present || projectPersisted.tasks !== 1) {
      throw new Error("project persistence check failed");
    }
    await invoke("export_projects_csv", { path: `${smokeDirectory}/smoke-projects.csv` });
    const projectInvoice = await invoke<InvoiceView>("create_project_invoice", {
      id: projectItem.id,
    });
    if (projectInvoice.items.length !== 1 || projectInvoice.total_cents <= 0) {
      throw new Error("project billing did not create the invoice position");
    }
    await invoke("delete_invoice", { id: projectInvoice.id });
    await invoke("delete_project_task", {
      projectId: projectItem.id,
      taskId: projectTask.id,
    });
    await invoke("delete_project", { id: projectItem.id });
    const projectsAfter = await invoke<ProjectOverviewView>("project_overview");
    if (projectsAfter.projects.some((project) => project.id === projectItem.id)) {
      throw new Error("deleted project is still listed");
    }

    await runRestaurantSmoke(smokeDirectory, () => showView("restaurant"));

    // Contact mail draft and FatturaPA XML through the real commands.
    const contactMail = await invoke<ContactMailView>("contact_mail_draft", { id: contact.id });
    if (!contactMail.eml.includes("X-Unsent: 1") || !contactMail.file_name.endsWith(".eml")) {
      throw new Error("contact mail draft is incomplete");
    }
    await invoke("export_contact_eml", {
      id: contact.id,
      recipientName: contactMail.recipient_name,
      recipientEmail: contactMail.recipient,
      subject: contactMail.subject,
      body: contactMail.body,
      path: `${smokeDirectory}/smoke-contact.eml`,
    });
    const fattura = await invoke<InvoiceFatturaView>("invoice_fattura", {
      id: createdInvoice.id,
      input: {
        documentType: "TD01",
        regimeFiscale: "RF01",
        recipientCode: "0000000",
        pec: "",
        bollo: false,
        cup: "",
        cig: "",
      },
    });
    if (!fattura.valid || !fattura.xml.includes("<p:FatturaElettronica")) {
      throw new Error(`fattura is invalid: ${fattura.errors.join(", ")}`);
    }
    await invoke("export_invoice_fattura", {
      id: createdInvoice.id,
      input: {
        documentType: "TD01",
        regimeFiscale: "RF01",
        recipientCode: "0000000",
        pec: "",
        bollo: false,
        cup: "",
        cig: "",
      },
      path: `${smokeDirectory}/smoke-fattura.xml`,
    });

    // Dunning letter, invoice mail draft and payment capture through the real commands.
    const smokeMail = await invoke<InvoiceMailView>("invoice_mail_draft", {
      id: createdInvoice.id,
    });
    if (!smokeMail.eml.includes(createdInvoice.number) || !smokeMail.file_name.endsWith(".eml")) {
      throw new Error("invoice mail draft is incomplete");
    }
    const smokeDunning = await invoke<InvoiceDunningView>("invoice_dunning", {
      id: createdInvoice.id,
      level: "first",
      feeCents: null,
      days: null,
    });
    if (smokeDunning.level_number !== 2 || smokeDunning.fee_cents <= 0) {
      throw new Error(`unexpected dunning letter ${smokeDunning.level} ${smokeDunning.fee_cents}`);
    }
    if (!smokeDunning.eml.includes(createdInvoice.number)) {
      throw new Error("dunning letter does not name the invoice");
    }
    const dunningExport = await invoke<{ path: string; bytes: number }>("export_invoice_eml", {
      id: createdInvoice.id,
      kind: "dunning",
      level: "last",
      feeCents: null,
      days: null,
      path: `${smokeDirectory}/smoke-dunning.eml`,
    });
    if (dunningExport.bytes === 0) {
      throw new Error("dunning eml export is empty");
    }
    const mailExport = await invoke<{ path: string; bytes: number }>("export_invoice_eml", {
      id: createdInvoice.id,
      kind: "invoice",
      level: null,
      feeCents: null,
      days: null,
      path: `${smokeDirectory}/smoke-invoice.eml`,
    });
    if (mailExport.bytes === 0) {
      throw new Error("invoice eml export is empty");
    }
    await invoke<InvoicePaymentView>("record_invoice_payment", {
      id: createdInvoice.id,
      method: "transfer",
      reference: "GUI smoke payment",
      paidAt: null,
    });
    const smokePaid = await invoke<InvoiceView>("invoice_detail", { id: createdInvoice.id });
    if (smokePaid.status !== "paid") {
      throw new Error(`payment did not mark the invoice paid: ${smokePaid.status}`);
    }

    await runBackofficeSmoke(
      createdInvoice.number,
      smokeOptions.dialogs === "chosen",
    );

    await invoke("finish_smoke", { report });
    } catch {
      // The command writes the report and exits; an IPC rejection after that is expected.
    }
  } catch (error) {
    const message = describe(error);
    statusMessage.textContent = message;
    try {
      await invoke("abort_smoke", { message });
    } catch {
      // The CI timeout is the final fallback if even the abort command cannot be delivered.
    }
  }

  return true;
}

backupButton.addEventListener("click", async () => {
  backupButton.disabled = true;
  backupButton.textContent = translate(language, "backupWorking");
  backupResult.textContent = "";

  try {
    const report = await invoke<BackupReport>("create_backup");
    renderBackup(report);
    await refreshStatus();
  } catch (error) {
    backupResult.textContent = format(translate(language, "errorBackup"), {
      message: describe(error),
    });
  } finally {
    backupButton.disabled = false;
    backupButton.textContent = translate(language, "backupAction");
  }
});

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view as View | undefined;
    if (view) {
      void showView(view);
    }
  });
}

contactNew.addEventListener("click", () => openContactDialog());

interface ContactImportReport {
  imported: number;
  skipped: number;
  errors: string[];
}

async function exportContacts(kind: "csv" | "vcf"): Promise<void> {
  contactExportMenu.hidden = true;
  try {
    const suggestedName = kind === "csv" ? "kontakte.csv" : "kontakte.vcf";
    const reply = await invoke<DialogReply>("pick_save_file", { suggestedName });
    if (reply.outcome !== "chosen" || !reply.path) {
      if (reply.outcome === "error" && reply.error) {
        contactsMessage.textContent = reply.error;
      }
      return;
    }
    const command = kind === "csv" ? "export_contacts_csv" : "export_contacts_vcf";
    const count = await invoke<number>(command, { path: reply.path });
    contactsMessage.textContent = `${count} ${pageText.entries} → ${reply.path}`;
  } catch (error) {
    contactsMessage.textContent = describe(error);
  }
}

async function importContacts(): Promise<void> {
  try {
    const reply = await invoke<DialogReply>("pick_open_file", { extensions: ["csv"] });
    if (reply.outcome !== "chosen" || !reply.path) {
      if (reply.outcome === "error" && reply.error) {
        contactsMessage.textContent = reply.error;
      }
      return;
    }
    const report = await invoke<ContactImportReport>("import_contacts_csv", {
      path: reply.path,
    });
    await refreshStatus();
    await loadContacts();
    contactsMessage.textContent = `${report.imported} ${pageText.entries}, ${report.skipped} ${translate(
      language,
      "invoiceStatusDraft",
    ).toLowerCase()}`;
  } catch (error) {
    contactsMessage.textContent = describe(error);
  }
}

let contactBatchMode = false;
let contactBatchCount = 0;
contactBatch.addEventListener("click", () => {
  contactBatchMode = true;
  contactBatchCount = 0;
  openContactDialog();
  contactError.textContent = "Serienerfassung: Speichern legt den Kontakt an und öffnet den nächsten.";
});
contactDialog.addEventListener("close", () => {
  contactBatchMode = false;
});
contactExportButton.addEventListener("click", (event) => {
  event.stopPropagation();
  contactExportMenu.hidden = !contactExportMenu.hidden;
});
contactExportCsv.addEventListener("click", () => void exportContacts("csv"));
contactExportVcf.addEventListener("click", () => void exportContacts("vcf"));
contactImportFile.addEventListener("change", () => void importContacts());
document.addEventListener("click", (event) => {
  if (!contactExportMenu.hidden && !contactExportMenu.contains(event.target as Node)) {
    contactExportMenu.hidden = true;
  }
});

productNew.addEventListener("click", () => openProductDialog());
contactSearch.addEventListener("input", () => void loadContacts());
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-contact-filter]")) {
  button.addEventListener("click", () => {
    contactFilter = (button.dataset.contactFilter ?? "all") as typeof contactFilter;
    for (const entry of document.querySelectorAll<HTMLButtonElement>("[data-contact-filter]")) {
      const active = entry === button;
      entry.classList.toggle("is-active", active);
      entry.setAttribute("aria-selected", String(active));
    }
    void loadContacts();
  });
}
productSearch.addEventListener("input", () => void loadProducts());

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  contactError.textContent = "";
  const input = contactInput();
  try {
    if (contactId.value) {
      await invoke<Contact>("update_contact", { id: contactId.value, input });
    } else {
      await invoke<Contact>("create_contact", { input });
    }
    await refreshStatus();
    await loadContacts();
    if (contactBatchMode) {
      contactBatchCount += 1;
      contactForm.reset();
      contactId.value = "";
      contactCountry.value = "Deutschland";
      contactDialogTitle.textContent = translate(language, "contactNewTitle");
      contactName.focus();
      contactError.textContent = `${contactBatchCount} Kontakt(e) angelegt – nächster Datensatz.`;
      return;
    }
    contactDialog.close();
  } catch (error) {
    contactError.textContent = format(translate(language, "errorSaveContact"), {
      message: describe(error),
    });
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  productError.textContent = "";
  const input = productInput();
  try {
    if (productId.value) {
      await invoke<Product>("update_product", { id: productId.value, input });
    } else {
      await invoke<Product>("create_product", { input });
    }
    productDialog.close();
    await refreshStatus();
    await loadProducts();
  } catch (error) {
    productError.textContent = format(translate(language, "errorSaveProduct"), {
      message: describe(error),
    });
  }
});

document.getElementById("dunning-level")?.addEventListener("change", () => {
  void refreshDunningPreview().catch(() => undefined);
});
document.getElementById("dunning-fee")?.addEventListener("change", () => {
  void refreshDunningPreview().catch(() => undefined);
});
document.getElementById("dunning-days")?.addEventListener("change", () => {
  void refreshDunningPreview().catch(() => undefined);
});
document.getElementById("dunning-save")?.addEventListener("click", () => {
  void saveInvoiceActionEml("dunning");
});
document.getElementById("email-save")?.addEventListener("click", () => {
  void saveInvoiceActionEml("invoice");
});
document.getElementById("payment-record")?.addEventListener("click", () => {
  void recordInvoiceActionPayment();
});

document.getElementById("contact-email-save")?.addEventListener("click", () => {
  void saveContactEmail();
});
document.getElementById("fattura-save")?.addEventListener("click", () => {
  void saveFattura();
});
for (const id of [
  "fattura-document-type",
  "fattura-regime",
  "fattura-recipient-code",
  "fattura-pec",
  "fattura-bollo",
  "fattura-cup",
  "fattura-cig",
]) {
  document.getElementById(id)?.addEventListener("change", () => {
    void refreshFattura();
  });
}
fleetElement<HTMLInputElement>("fleet-search").placeholder = translate(language, "fleetSearchPlaceholder");
fleetElement<HTMLInputElement>("fleet-search").addEventListener("input", () => {
  fleetSearchQuery = fleetElement<HTMLInputElement>("fleet-search").value;
  renderFleet();
});
fleetElement<HTMLSelectElement>("fleet-vehicle-filter").addEventListener("change", () => {
  fleetVehicleFilter = fleetElement<HTMLSelectElement>("fleet-vehicle-filter").value;
  renderFleet();
});
fleetElement<HTMLSelectElement>("fleet-purpose-filter").addEventListener("change", () => {
  fleetPurposeFilter = fleetElement<HTMLSelectElement>("fleet-purpose-filter").value;
  renderFleet();
});
fleetElement<HTMLInputElement>("fleet-date-from").addEventListener("change", () => {
  fleetDateFrom = fleetElement<HTMLInputElement>("fleet-date-from").value;
  renderFleet();
});
fleetElement<HTMLInputElement>("fleet-date-to").addEventListener("change", () => {
  fleetDateTo = fleetElement<HTMLInputElement>("fleet-date-to").value;
  renderFleet();
});
fleetElement("fleet-tab-logbook").addEventListener("click", () => setFleetTab("logbook"));
fleetElement("fleet-tab-vehicles").addEventListener("click", () => setFleetTab("vehicles"));
fleetElement("fleet-tab-fuel").addEventListener("click", () => setFleetTab("fuel"));
fleetElement("fleet-add-vehicle").addEventListener("click", () => openFleetVehicleDialog());
fleetElement("fleet-add-trip").addEventListener("click", () => openFleetTripDialog());
fleetElement("fleet-add-fuel").addEventListener("click", () => openFleetFuelDialog());
fleetElement("fleet-export-csv").addEventListener("click", () => {
  void exportFleetCsv();
});
fleetElement<HTMLFormElement>("fleet-vehicle-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveFleetVehicle();
});
fleetElement<HTMLFormElement>("fleet-trip-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveFleetTrip();
});
fleetElement<HTMLFormElement>("fleet-fuel-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveFleetFuel();
});
fleetElement<HTMLSelectElement>("fleet-trip-vehicle").addEventListener("change", () => {
  const id = fleetElement<HTMLSelectElement>("fleet-trip-vehicle").value;
  const vehicle = fleet?.vehicles.find((entry) => entry.id === id);
  if (vehicle) {
    fleetElement<HTMLInputElement>("fleet-trip-start-km").value = String(vehicle.currentOdometer);
    fleetElement<HTMLInputElement>("fleet-trip-end-km").value = String(vehicle.currentOdometer + 20);
    if (vehicle.assignedDriver) {
      fleetElement<HTMLInputElement>("fleet-trip-driver").value = vehicle.assignedDriver;
    }
  }
});

for (const closeButton of document.querySelectorAll<HTMLElement>("[data-close]")) {
  closeButton.addEventListener("click", () => {
    const dialog = byId<HTMLDialogElement>(closeButton.dataset.close ?? "");
    dialog.close();
  });
}

updateButton.addEventListener("click", () => {
  void (pendingUpdate ? installUpdate() : checkForUpdates());
});

async function start(): Promise<void> {
  await guardApp();
  updateViewHeader(activeView);
  await Promise.all([refreshStatus(), loadDashboard(), loadAppearance()]);
  if (activeView === "dashboard") {
    for (const tab of tabs) {
      tab.setAttribute("aria-selected", String(tab.dataset.view === "dashboard"));
    }
  }
  const smokeMode = await runSmokeIfEnabled();
  if (!smokeMode && updaterConfigured) {
    void checkForUpdates();
  }
}

interface ShortcutReply {
  outcome: "action" | "ignored";
  action?: string;
  reason?: string;
}

function installShortcutDispatch(): void {
  window.addEventListener("keydown", (event) => {
    const isFunctionKey = event.key === "F11";
    if (isFunctionKey) {
      event.preventDefault();
    }
    void invoke<ShortcutReply>("dispatch_shortcut", {
      event: {
        key: event.key,
        control: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
        repeat: event.repeat,
      },
    }).catch(() => {
      /* the window keeps working without the shortcut layer */
    });
  });
}

installShortcutDispatch();

// ---------------------------------------------------------------------------
// Barcode/QR label and smart reorder assistant (ported from the TypeScript modals)
// ---------------------------------------------------------------------------

interface LabelFormatView {
  id: string;
  label_key: string;
  width: number;
}

interface ProductLabelView {
  name: string;
  sku: string;
  asin: string | null;
  category: string;
  unit: string;
  price_text: string;
  payload: string;
  formats: LabelFormatView[];
  qr: string[];
}

interface ReorderAdjustment {
  product_id: string;
  quantity?: number;
  included?: boolean;
}

interface ReorderLineView {
  product_id: string;
  name: string;
  sku: string;
  asin: string | null;
  quantity: number;
  included: boolean;
  excluded: boolean;
  stock: number;
  unit_cost_cents: number;
}

interface ReorderStatsView {
  low_stock_count: number;
  total_units: number;
  estimated_cost_cents: number;
  excluded_count: number;
  asin_ready_count: number;
  missing_asin_count: number;
}

interface ReorderView {
  lines: ReorderLineView[];
  stats: ReorderStatsView;
  cart_url: string;
  search_url: string;
}

const labelDialog = byId<HTMLDialogElement>("label-dialog");
const labelFormats = byId<HTMLDivElement>("label-formats");
const labelCategory = byId<HTMLSpanElement>("label-category");
const labelName = byId<HTMLElement>("label-name");
const labelSku = byId<HTMLSpanElement>("label-sku");
const labelAsin = byId<HTMLSpanElement>("label-asin");
const labelPrice = byId<HTMLSpanElement>("label-price");
const labelUnit = byId<HTMLSpanElement>("label-unit");
const labelQr = byId<HTMLCanvasElement>("label-qr");
const reorderDialog = byId<HTMLDialogElement>("reorder-dialog");
const reorderModeIndividual = byId<HTMLButtonElement>("reorder-mode-individual");
const reorderModeFixed = byId<HTMLButtonElement>("reorder-mode-fixed");
const reorderFixedInput = byId<HTMLInputElement>("reorder-fixed");
const reorderDomainSelect = byId<HTMLSelectElement>("reorder-domain");
const reorderSearchInput = byId<HTMLInputElement>("reorder-search");
const reorderExcludedInput = byId<HTMLInputElement>("reorder-excluded");
const reorderStats = byId<HTMLDivElement>("reorder-stats");
const reorderLines = byId<HTMLDivElement>("reorder-lines");
const reorderCart = byId<HTMLAnchorElement>("reorder-cart");
const reorderCopyButton = byId<HTMLButtonElement>("reorder-copy");
const reorderDraftButton = byId<HTMLButtonElement>("reorder-draft");
const reorderMessage = byId<HTMLParagraphElement>("reorder-message");

let labelView: ProductLabelView | null = null;
let labelFormat = "standard";
const reorderAdjustments = new Map<string, ReorderAdjustment>();
let reorderView: ReorderView | null = null;
let reorderThresholdMode: "individual" | "fixed" = "individual";
let reorderBusy = false;

function formatCents(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

async function openLabelDialog(product: Product): Promise<void> {
  try {
    labelView = await invoke<ProductLabelView>("product_label", { id: product.id });
  } catch (error) {
    productsMessage.textContent = format(translate(language, "errorLoadProducts"), {
      message: describe(error),
    });
    return;
  }
  labelFormat = "standard";
  renderLabel();
  labelDialog.showModal();
}

function renderLabel(): void {
  if (!labelView) {
    return;
  }
  labelCategory.textContent = labelView.category;
  labelName.textContent = labelView.name;
  labelSku.textContent = `SKU: ${labelView.sku}`;
  labelAsin.textContent = labelView.asin ? `ASIN: ${labelView.asin}` : "";
  labelPrice.textContent = labelView.price_text;
  labelUnit.textContent = labelView.unit;

  labelFormats.replaceChildren();
  for (const format of labelView.formats) {
    const button = makeElement("button", format.id === labelFormat ? undefined : "secondary");
    button.type = "button";
    button.textContent = translate(language, format.label_key as TranslationKey);
    if (format.id === labelFormat) {
      labelQr.style.width = `${format.width}px`;
    }
    button.addEventListener("click", () => {
      labelFormat = format.id;
      renderLabel();
    });
    labelFormats.appendChild(button);
  }
  drawQr(labelQr, labelView.qr);
}

function drawQr(canvas: HTMLCanvasElement, rows: string[]): void {
  const context = canvas.getContext("2d");
  if (!context || rows.length === 0) {
    return;
  }
  const modules = rows.length;
  const scale = Math.max(1, Math.floor(canvas.width / modules));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0f172a";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === "1") {
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  });
}

async function openReorderDialog(): Promise<void> {
  reorderAdjustments.clear();
  reorderThresholdMode = "individual";
  reorderSearchInput.value = "";
  reorderExcludedInput.checked = false;
  reorderMessage.textContent = "";
  await refreshReorder();
  reorderDialog.showModal();
}

async function refreshReorder(): Promise<void> {
  if (reorderBusy) {
    return;
  }
  reorderBusy = true;
  try {
    const request = {
      threshold: reorderThresholdMode,
      fixed: Number.parseInt(reorderFixedInput.value || "5", 10) || 5,
      domain: reorderDomainSelect.value,
      query: reorderSearchInput.value,
      excluded_only: reorderExcludedInput.checked,
      adjustments: [...reorderAdjustments.values()],
    };
    reorderView = await invoke<ReorderView>("reorder_plan", { request });
    renderReorder();
  } catch (error) {
    reorderMessage.textContent = format(translate(language, "errorLoadProducts"), {
      message: describe(error),
    });
  } finally {
    reorderBusy = false;
  }
}

function renderReorder(): void {
  if (!reorderView) {
    return;
  }
  const stats = reorderView.stats;
  reorderStats.replaceChildren(
    makeElement("span", "badge", `${stats.low_stock_count} ${translate(language, "reorderLowStock")}`),
    makeElement("span", "badge", `${stats.total_units} ${translate(language, "reorderUnits")}`),
    makeElement("span", "badge", `${stats.asin_ready_count} ${translate(language, "reorderAsinReady")}`),
    makeElement("span", "badge", formatCents(stats.estimated_cost_cents)),
  );

  reorderModeIndividual.className =
    reorderThresholdMode === "individual" ? "" : "secondary";
  reorderModeFixed.className = reorderThresholdMode === "fixed" ? "" : "secondary";

  reorderLines.replaceChildren();
  if (reorderView.lines.length === 0) {
    reorderLines.appendChild(
      makeElement("p", "hint", translate(language, "reorderEmpty")),
    );
  }
  for (const line of reorderView.lines) {
    const row = makeElement("div", "reorder-row");
    row.appendChild(makeElement("strong", undefined, line.name));
    row.appendChild(makeElement("span", "hint", line.sku));

    const minus = makeElement("button", "secondary", "−");
    minus.type = "button";
    minus.addEventListener("click", () => void adjustReorder(line.product_id, line.quantity - 1));
    row.appendChild(minus);
    row.appendChild(makeElement("span", undefined, String(line.quantity)));
    const plus = makeElement("button", "secondary", "+");
    plus.type = "button";
    plus.addEventListener("click", () => void adjustReorder(line.product_id, line.quantity + 1));
    row.appendChild(plus);

    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = line.included;
    include.title = translate(language, "reorderInclude");
    include.addEventListener("change", () => {
      reorderAdjustments.set(line.product_id, {
        ...reorderAdjustments.get(line.product_id),
        product_id: line.product_id,
        quantity: line.quantity,
        included: include.checked,
      });
      void refreshReorder();
    });
    row.appendChild(include);

    const exclude = makeElement(
      "button",
      line.excluded ? "danger" : "secondary",
      translate(language, "reorderExclude"),
    );
    exclude.type = "button";
    exclude.addEventListener("click", () => void toggleExclusion(line));
    row.appendChild(exclude);
    reorderLines.appendChild(row);
  }

  if (reorderView.cart_url) {
    reorderCart.textContent = reorderView.cart_url;
    reorderCart.href = reorderView.cart_url;
  } else {
    reorderCart.removeAttribute("href");
    reorderCart.textContent = translate(language, "reorderCartEmpty");
  }
}

async function adjustReorder(productId: string, quantity: number): Promise<void> {
  const line = reorderView?.lines.find((entry) => entry.product_id === productId);
  reorderAdjustments.set(productId, {
    product_id: productId,
    quantity: Math.max(1, quantity),
    included: line?.included,
  });
  await refreshReorder();
}

async function toggleExclusion(line: ReorderLineView): Promise<void> {
  try {
    await invoke("set_product_reorder_exclusion", {
      id: line.product_id,
      excluded: !line.excluded,
    });
    await loadProducts();
    await refreshReorder();
  } catch (error) {
    reorderMessage.textContent = describe(error);
  }
}

function reorderRequestPayload() {
  return {
    threshold: reorderThresholdMode,
    fixed: Number.parseInt(reorderFixedInput.value || "5", 10) || 5,
    domain: reorderDomainSelect.value,
    query: reorderSearchInput.value,
    excluded_only: reorderExcludedInput.checked,
    adjustments: [...reorderAdjustments.values()],
  };
}

reorderModeIndividual.addEventListener("click", () => {
  reorderThresholdMode = "individual";
  void refreshReorder();
});
reorderModeFixed.addEventListener("click", () => {
  reorderThresholdMode = "fixed";
  void refreshReorder();
});
reorderFixedInput.addEventListener("change", () => void refreshReorder());
reorderDomainSelect.addEventListener("change", () => void refreshReorder());
reorderSearchInput.addEventListener("input", () => void refreshReorder());
reorderExcludedInput.addEventListener("change", () => void refreshReorder());

reorderCopyButton.addEventListener("click", async () => {
  const text = [
    translate(language, "reorderTitle"),
    ...((reorderView?.lines ?? []).map(
      (line) => `${line.name} | ${line.sku} | ${line.quantity}`,
    )),
  ].join("\n");
  await navigator.clipboard.writeText(text);
  reorderMessage.textContent = translate(language, "reorderCopied");
});

reorderDraftButton.addEventListener("click", async () => {
  try {
    const number = await invoke<string>("create_reorder_draft", {
      request: reorderRequestPayload(),
    });
    reorderMessage.textContent = `${translate(language, "reorderDraftCreated")} ${number}`;
  } catch (error) {
    const message = describe(error);
    reorderMessage.textContent =
      message.includes("no_vendor")
        ? translate(language, "reorderNoVendor")
        : message;
  }
});

// ---------------------------------------------------------------------------
// Invoice print templates (ported from the TypeScript template manager)
// ---------------------------------------------------------------------------

// The wire format of `socdof_app::template_bridge`: the TypeScript names exactly, with the same
// defaults the TypeScript editor writes. No field is optional here, so a load/save round trip can
// never drop one.
interface StationeryToken {
  id: string;
  tokenKey: string;
  xPct: number;
  yPct: number;
  widthPct: number | null;
  fontSize: number | null;
  fontWeight: string;
  color: string;
  align: string;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  presetType: string;
  isDefault: boolean;
  logoUrl: string;
  showLogo: boolean;
  logoPosition: string;
  companyName: string;
  companySubtitle: string;
  companyOwner: string;
  companyAddress: string;
  companyZipCity: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyTaxId: string;
  companyVatId: string;
  companyBankName: string;
  companyIban: string;
  companyBic: string;
  companyCommercialRegister: string;
  primaryColor: string;
  fontFamily: string;
  headerTitle: string;
  headerText: string;
  footerText: string;
  taxNote: string;
  dueDays: number;
  useCustomLayout: boolean;
  customBodyTemplate: string;
  showFoldMarks: boolean;
  stationeryMode: boolean;
  stationeryPdfUrl: string;
  stationeryImageUrl: string;
  stationeryTokens: StationeryToken[];
  createdAt: string;
}

interface InvoiceTemplateBook {
  templates: InvoiceTemplate[];
  activeId: string;
}

const TEMPLATE_POSITIONS = ["left", "center", "right"];
const TEMPLATE_WEIGHTS = ["normal", "bold"];
const TEMPLATE_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
const TEMPLATE_STATIONERY_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const MAX_TEMPLATE_LOGO_BYTES = 2 * 1024 * 1024;

const templateNewButton = byId<HTMLButtonElement>("template-new");
const templatesCount = byId<HTMLParagraphElement>("templates-count");
const templatesMessage = byId<HTMLParagraphElement>("templates-message");
const templatesList = byId<HTMLDivElement>("templates-list");
const templateDialog = byId<HTMLDialogElement>("template-dialog");
const templateDialogTitle = byId<HTMLHeadingElement>("template-dialog-title");
const templateForm = byId<HTMLFormElement>("template-form");
const templateError = byId<HTMLParagraphElement>("template-error");
const templateName = byId<HTMLInputElement>("template-name");
const templateDescription = byId<HTMLInputElement>("template-description");
const templatePreset = byId<HTMLSelectElement>("template-preset");
const templateFont = byId<HTMLSelectElement>("template-font");
const templateHeaderTitle = byId<HTMLInputElement>("template-header-title");
const templatePrimaryColor = byId<HTMLInputElement>("template-primary-color");
const templateHeaderText = byId<HTMLTextAreaElement>("template-header-text");
const templateFooterText = byId<HTMLTextAreaElement>("template-footer-text");
const templateTaxNote = byId<HTMLTextAreaElement>("template-tax-note");
const templateDueDays = byId<HTMLInputElement>("template-due-days");
const templateShowFoldMarks = byId<HTMLInputElement>("template-show-fold-marks");
const templateShowLogo = byId<HTMLInputElement>("template-show-logo");
const templateLogoPosition = byId<HTMLSelectElement>("template-logo-position");
const templateLogo = byId<HTMLInputElement>("template-logo");
const templateLogoFile = byId<HTMLInputElement>("template-logo-file");
const templateCompanyName = byId<HTMLInputElement>("template-company-name");
const templateCompanySubtitle = byId<HTMLInputElement>("template-company-subtitle");
const templateCompanyOwner = byId<HTMLInputElement>("template-company-owner");
const templateCompanyAddress = byId<HTMLInputElement>("template-company-address");
const templateCompanyZipCity = byId<HTMLInputElement>("template-company-zip-city");
const templateCompanyPhone = byId<HTMLInputElement>("template-company-phone");
const templateCompanyEmail = byId<HTMLInputElement>("template-company-email");
const templateCompanyWebsite = byId<HTMLInputElement>("template-company-website");
const templateCompanyTaxId = byId<HTMLInputElement>("template-company-tax-id");
const templateCompanyVatId = byId<HTMLInputElement>("template-company-vat-id");
const templateCompanyBankName = byId<HTMLInputElement>("template-company-bank-name");
const templateCompanyIban = byId<HTMLInputElement>("template-company-iban");
const templateCompanyBic = byId<HTMLInputElement>("template-company-bic");
const templateCompanyRegister = byId<HTMLInputElement>("template-company-commercial-register");
const templateUseCustom = byId<HTMLInputElement>("template-use-custom");
const templateCustomBody = byId<HTMLTextAreaElement>("template-custom-body");
const templateStationeryMode = byId<HTMLInputElement>("template-stationery-mode");
const templateStationeryImage = byId<HTMLInputElement>("template-stationery-image");
const templateStationeryImageFile = byId<HTMLInputElement>("template-stationery-image-file");
const templateStationeryPdf = byId<HTMLInputElement>("template-stationery-pdf");
const templateStationeryPdfFile = byId<HTMLInputElement>("template-stationery-pdf-file");
const templateTokensList = byId<HTMLDivElement>("template-tokens");
const templateTokenAdd = byId<HTMLButtonElement>("template-token-add");
const templateTokenDefaults = byId<HTMLButtonElement>("template-token-defaults");

const invoiceSearch = byId<HTMLInputElement>("invoice-search");
const invoiceStatusFilter = byId<HTMLSelectElement>("invoice-status-filter");
const invoiceNewButton = byId<HTMLButtonElement>("invoice-new");
const invoiceTemplatesButton = byId<HTMLButtonElement>("invoice-templates");
const invoiceImportFile = byId<HTMLInputElement>("invoice-import-file");
const invoicesCount = byId<HTMLElement>("invoices-count");
const invoicesMessage = byId<HTMLParagraphElement>("invoices-message");
const invoicesList = byId<HTMLTableSectionElement>("invoices-list");
const invoiceDialog = byId<HTMLDialogElement>("invoice-dialog");
const invoiceDialogTitle = byId<HTMLHeadingElement>("invoice-dialog-title");
const invoiceForm = byId<HTMLFormElement>("invoice-form");
const invoiceError = byId<HTMLParagraphElement>("invoice-error");
const invoiceIdInput = byId<HTMLInputElement>("invoice-id");
const invoiceNumberInput = byId<HTMLInputElement>("invoice-number");
const invoiceStatusInput = byId<HTMLSelectElement>("invoice-status");
const invoiceContact = byId<HTMLSelectElement>("invoice-contact");
const invoiceIssuedDate = byId<HTMLInputElement>("invoice-issued-date");
const invoiceDueDate = byId<HTMLInputElement>("invoice-due-date");
const invoicePaymentTermsInput = byId<HTMLInputElement>("invoice-payment-terms");
const invoiceCurrencyInput = byId<HTMLInputElement>("invoice-currency");
const invoiceNoteInput = byId<HTMLTextAreaElement>("invoice-note");
const invoiceLinesList = byId<HTMLDivElement>("invoice-lines");
const invoiceLineAdd = byId<HTMLButtonElement>("invoice-line-add");
const invoiceTotalNet = byId<HTMLElement>("invoice-total-net");
const invoiceTotalTax = byId<HTMLElement>("invoice-total-tax");
const invoiceTotalGross = byId<HTMLElement>("invoice-total-gross");
const invoicePreviewDialog = byId<HTMLDialogElement>("invoice-preview-dialog");
const invoicePreviewTitle = byId<HTMLHeadingElement>("invoice-preview-title");
const invoicePreviewTemplate = byId<HTMLSelectElement>("invoice-preview-template");
const invoicePreviewMessage = byId<HTMLParagraphElement>("invoice-preview-message");
const invoicePreviewBody = byId<HTMLDivElement>("invoice-preview-body");
const invoicePreviewStationery = byId<HTMLElement>("invoice-preview-stationery");
const invoicePreviewStationeryHint = byId<HTMLParagraphElement>("invoice-preview-stationery-hint");
const invoicePreviewPage = byId<HTMLDivElement>("invoice-preview-page");
const invoicePreviewTokens = byId<HTMLDivElement>("invoice-preview-tokens");
const invoiceExportPdfButton = byId<HTMLButtonElement>("invoice-export-pdf");
const invoiceExportDocxButton = byId<HTMLButtonElement>("invoice-export-docx");

let templateBook: InvoiceTemplateBook | null = null;
let templateDraft: InvoiceTemplate | null = null;
let templateTokensState: StationeryToken[] = [];
let templateTokenKeys: string[] = [];

function newTemplateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function cloneTemplate(template: InvoiceTemplate): InvoiceTemplate {
  return {
    ...template,
    stationeryTokens: template.stationeryTokens.map((token) => ({ ...token })),
  };
}

function cloneTemplateBook(book: InvoiceTemplateBook): InvoiceTemplateBook {
  return { activeId: book.activeId, templates: book.templates.map(cloneTemplate) };
}

function activeTemplate(): InvoiceTemplate | null {
  if (!templateBook) {
    return null;
  }
  return (
    templateBook.templates.find((template) => template.id === templateBook?.activeId) ??
    templateBook.templates[0] ??
    null
  );
}

async function loadTemplates(): Promise<void> {
  templatesMessage.textContent = translate(language, "loading");
  try {
    templateBook = await invoke<InvoiceTemplateBook>("invoice_templates");
    if (templateTokenKeys.length === 0) {
      templateTokenKeys = await invoke<string[]>("template_token_keys");
    }
    renderTemplates();
    templatesMessage.textContent = "";
  } catch (error) {
    templatesMessage.textContent = format(translate(language, "errorLoadTemplates"), {
      message: describe(error),
    });
  }
  await loadExternalAssets(language);
}


async function persistTemplates(book: InvoiceTemplateBook): Promise<boolean> {
  try {
    await invoke("save_invoice_templates", { book });
    templateBook = book;
    renderTemplates();
    templatesMessage.textContent = translate(language, "templatesSaved");
    return true;
  } catch (error) {
    templatesMessage.textContent = format(translate(language, "errorSaveTemplates"), {
      message: describe(error),
    });
    return false;
  }
}

function renderTemplates(): void {
  templatesList.replaceChildren();
  if (!templateBook) {
    return;
  }
  templatesCount.textContent = format(translate(language, "templatesCount"), {
    count: numberFormat.format(templateBook.templates.length),
  });
  if (templateBook.templates.length === 0) {
    templatesList.appendChild(makeElement("p", "empty", translate(language, "templatesEmpty")));
    return;
  }

  for (const template of templateBook.templates) {
    const card = makeElement("article", "entity-card");
    card.dataset.id = template.id;
    const head = makeElement("div", "entity-card-head");
    const title = makeElement("div");
    title.appendChild(makeElement("h3", undefined, template.name));
    title.appendChild(
      makeElement("p", undefined, `${template.headerTitle} · ${template.presetType}`),
    );
    head.appendChild(title);
    const tags = makeElement("div", "template-tags");
    if (template.id === templateBook.activeId) {
      tags.appendChild(makeElement("span", "tag", translate(language, "templateActiveTag")));
    }
    tags.appendChild(makeElement("span", "tag", template.fontFamily));
    head.appendChild(tags);
    card.appendChild(head);

    if (template.description.trim()) {
      card.appendChild(
        makeElement("p", "template-description", template.description.trim()),
      );
    }

    const actions = makeElement("div", "entity-actions");
    addActionButton(actions, "edit", "secondary", () => openTemplateDialog(template));
    if (template.id !== templateBook?.activeId) {
      addActionButton(actions, "templateActivate", "secondary", () => {
        void activateTemplate(template);
      });
    }
    addActionButton(actions, "templateDuplicate", "secondary", () => {
      void duplicateTemplate(template);
    });
    addActionButton(actions, "delete", "danger", () => {
      void removeTemplate(template);
    });
    card.appendChild(actions);
    templatesList.appendChild(card);
  }
}

async function activateTemplate(template: InvoiceTemplate): Promise<void> {
  if (!templateBook) {
    return;
  }
  const book = cloneTemplateBook(templateBook);
  book.activeId = template.id;
  if (await persistTemplates(book)) {
    await loadTemplates();
  }
}

async function duplicateTemplate(template: InvoiceTemplate): Promise<void> {
  if (!templateBook) {
    return;
  }
  const book = cloneTemplateBook(templateBook);
  const copy = cloneTemplate(template);
  copy.id = newTemplateId("template");
  copy.name = `${template.name} (Kopie)`;
  copy.isDefault = false;
  copy.createdAt = new Date().toISOString();
  copy.stationeryTokens = copy.stationeryTokens.map((token) => ({
    ...token,
    id: newTemplateId("tok"),
  }));
  book.templates.push(copy);
  if (await persistTemplates(book)) {
    await loadTemplates();
  }
}

async function removeTemplate(template: InvoiceTemplate): Promise<void> {
  if (!templateBook) {
    return;
  }
  if (templateBook.templates.length <= 1) {
    templatesMessage.textContent = translate(language, "templateDeleteLast");
    return;
  }
  if (!(await confirmDialog(translate(language, "confirmDeleteTemplate")))) {
    return;
  }
  const book = cloneTemplateBook(templateBook);
  book.templates = book.templates.filter((entry) => entry.id !== template.id);
  if (book.activeId === template.id) {
    book.activeId = book.templates[0].id;
  }
  if (await persistTemplates(book)) {
    await loadTemplates();
  }
}

function fillTemplateForm(template: InvoiceTemplate): void {
  templateName.value = template.name;
  templateDescription.value = template.description;
  templatePreset.value = template.presetType;
  templateFont.value = template.fontFamily;
  templateHeaderTitle.value = template.headerTitle;
  templatePrimaryColor.value = template.primaryColor;
  templateHeaderText.value = template.headerText;
  templateFooterText.value = template.footerText;
  templateTaxNote.value = template.taxNote;
  templateDueDays.value = String(template.dueDays);
  templateShowFoldMarks.checked = template.showFoldMarks;
  templateShowLogo.checked = template.showLogo;
  templateLogoPosition.value = template.logoPosition;
  templateLogo.value = template.logoUrl;
  templateCompanyName.value = template.companyName;
  templateCompanySubtitle.value = template.companySubtitle;
  templateCompanyOwner.value = template.companyOwner;
  templateCompanyAddress.value = template.companyAddress;
  templateCompanyZipCity.value = template.companyZipCity;
  templateCompanyPhone.value = template.companyPhone;
  templateCompanyEmail.value = template.companyEmail;
  templateCompanyWebsite.value = template.companyWebsite;
  templateCompanyTaxId.value = template.companyTaxId;
  templateCompanyVatId.value = template.companyVatId;
  templateCompanyBankName.value = template.companyBankName;
  templateCompanyIban.value = template.companyIban;
  templateCompanyBic.value = template.companyBic;
  templateCompanyRegister.value = template.companyCommercialRegister;
  templateUseCustom.checked = template.useCustomLayout;
  templateCustomBody.value = template.customBodyTemplate;
  templateStationeryMode.checked = template.stationeryMode;
  templateStationeryImage.value = template.stationeryImageUrl;
  templateStationeryPdf.value = template.stationeryPdfUrl;
  templateTokensState = template.stationeryTokens.map((token) => ({ ...token }));
  renderTemplateTokens();
}

function openTemplateDialog(template: InvoiceTemplate): void {
  templateDraft = cloneTemplate(template);
  templateDialogTitle.textContent = translate(language, "templateEditTitle");
  templateError.textContent = "";
  fillTemplateForm(templateDraft);
  templateDialog.showModal();
  templateName.focus();
}

function templateFromForm(base: InvoiceTemplate): InvoiceTemplate {
  const dueDays = Number.parseInt(templateDueDays.value, 10);
  return {
    ...base,
    name: templateName.value.trim(),
    description: templateDescription.value.trim(),
    presetType: templatePreset.value,
    logoUrl: templateLogo.value.trim(),
    showLogo: templateShowLogo.checked,
    logoPosition: templateLogoPosition.value,
    companyName: templateCompanyName.value.trim(),
    companySubtitle: templateCompanySubtitle.value.trim(),
    companyOwner: templateCompanyOwner.value.trim(),
    companyAddress: templateCompanyAddress.value.trim(),
    companyZipCity: templateCompanyZipCity.value.trim(),
    companyPhone: templateCompanyPhone.value.trim(),
    companyEmail: templateCompanyEmail.value.trim(),
    companyWebsite: templateCompanyWebsite.value.trim(),
    companyTaxId: templateCompanyTaxId.value.trim(),
    companyVatId: templateCompanyVatId.value.trim(),
    companyBankName: templateCompanyBankName.value.trim(),
    companyIban: templateCompanyIban.value.trim(),
    companyBic: templateCompanyBic.value.trim(),
    companyCommercialRegister: templateCompanyRegister.value.trim(),
    primaryColor: templatePrimaryColor.value.trim(),
    fontFamily: templateFont.value,
    headerTitle: templateHeaderTitle.value.trim(),
    headerText: templateHeaderText.value,
    footerText: templateFooterText.value,
    taxNote: templateTaxNote.value,
    dueDays: Number.isFinite(dueDays) ? dueDays : base.dueDays,
    useCustomLayout: templateUseCustom.checked,
    customBodyTemplate: templateCustomBody.value,
    showFoldMarks: templateShowFoldMarks.checked,
    stationeryMode: templateStationeryMode.checked,
    stationeryImageUrl: templateStationeryImage.value.trim(),
    stationeryPdfUrl: templateStationeryPdf.value.trim(),
    stationeryTokens: templateTokensState.map((token) => ({ ...token })),
  };
}

function tokenSelect(
  values: string[],
  current: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = makeElement("select");
  for (const value of values) {
    const option = makeElement("option", undefined, value);
    option.value = value;
    select.appendChild(option);
  }
  if (current && !values.includes(current)) {
    const option = makeElement("option", undefined, current);
    option.value = current;
    select.appendChild(option);
  }
  select.value = current;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function tokenNumber(
  value: number | null,
  step: string,
  onChange: (value: number | null) => void,
): HTMLInputElement {
  const input = makeElement("input");
  input.type = "number";
  input.step = step;
  input.value = value === null ? "" : String(value);
  input.addEventListener("change", () => {
    const parsed = Number.parseFloat(input.value);
    onChange(Number.isFinite(parsed) ? parsed : null);
  });
  return input;
}

function renderTemplateTokens(): void {
  templateTokensList.replaceChildren();
  if (templateTokensState.length === 0) {
    templateTokensList.appendChild(makeElement("p", "hint", translate(language, "tokensEmpty")));
    return;
  }

  const head = makeElement("div", "token-row token-head");
  for (const key of [
    "tokenKey",
    "tokenX",
    "tokenY",
    "tokenWidth",
    "tokenSize",
    "tokenWeight",
    "tokenAlign",
    "tokenColor",
    "tokenRemove",
  ] as const) {
    head.appendChild(makeElement("span", undefined, translate(language, key)));
  }
  templateTokensList.appendChild(head);

  templateTokensState.forEach((token, index) => {
    const row = makeElement("div", "token-row");
    const keys = templateTokenKeys.includes(token.tokenKey)
      ? templateTokenKeys
      : [...templateTokenKeys, token.tokenKey];
    row.appendChild(
      tokenSelect(keys, token.tokenKey, (value) => {
        token.tokenKey = value;
      }),
    );
    row.appendChild(
      tokenNumber(token.xPct, "0.1", (value) => {
        token.xPct = value ?? 0;
      }),
    );
    row.appendChild(
      tokenNumber(token.yPct, "0.1", (value) => {
        token.yPct = value ?? 0;
      }),
    );
    row.appendChild(
      tokenNumber(token.widthPct, "0.1", (value) => {
        token.widthPct = value;
      }),
    );
    row.appendChild(
      tokenNumber(token.fontSize, "1", (value) => {
        token.fontSize = value;
      }),
    );
    row.appendChild(
      tokenSelect(TEMPLATE_WEIGHTS, token.fontWeight || "normal", (value) => {
        token.fontWeight = value;
      }),
    );
    row.appendChild(
      tokenSelect(TEMPLATE_POSITIONS, token.align || "left", (value) => {
        token.align = value;
      }),
    );
    const color = makeElement("input");
    color.type = "text";
    color.placeholder = "#0f172a";
    color.value = token.color;
    color.addEventListener("change", () => {
      token.color = color.value.trim();
    });
    row.appendChild(color);
    const remove = makeElement("button", "danger", "×");
    remove.type = "button";
    remove.title = translate(language, "tokenRemove");
    remove.addEventListener("click", () => {
      templateTokensState.splice(index, 1);
      renderTemplateTokens();
    });
    row.appendChild(remove);
    templateTokensList.appendChild(row);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// The same extension filters and 2 MB logo limit as the TypeScript file inputs.
async function applyTemplateAsset(
  file: File | undefined,
  kind: "logo" | "stationery-image" | "stationery-pdf",
): Promise<void> {
  if (!file) {
    return;
  }
  const extension = fileExtension(file.name);
  const allowed =
    kind === "logo"
      ? TEMPLATE_LOGO_EXTENSIONS
      : kind === "stationery-pdf"
        ? ["pdf"]
        : TEMPLATE_STATIONERY_IMAGE_EXTENSIONS;
  if (!allowed.includes(extension) || (kind === "logo" && file.size > MAX_TEMPLATE_LOGO_BYTES)) {
    templateError.textContent = translate(language, "templateFileRejected");
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (kind === "logo") {
      templateLogo.value = dataUrl;
      templateShowLogo.checked = true;
    } else if (kind === "stationery-image") {
      templateStationeryImage.value = dataUrl;
      templateStationeryMode.checked = true;
    } else {
      templateStationeryPdf.value = dataUrl;
      templateStationeryMode.checked = true;
    }
    templateError.textContent = "";
  } catch (error) {
    templateError.textContent = describe(error);
  }
}

templateNewButton.addEventListener("click", () => {
  const source = activeTemplate();
  if (!source) {
    return;
  }
  const draft = cloneTemplate(source);
  draft.id = newTemplateId("template");
  draft.name = `${source.name} (Kopie)`;
  draft.isDefault = false;
  draft.createdAt = new Date().toISOString();
  draft.stationeryTokens = draft.stationeryTokens.map((token) => ({
    ...token,
    id: newTemplateId("tok"),
  }));
  templateDraft = draft;
  templateDialogTitle.textContent = translate(language, "templateNewTitle");
  templateError.textContent = "";
  fillTemplateForm(draft);
  templateDialog.showModal();
  templateName.focus();
});

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  templateError.textContent = "";
  if (!templateBook || !templateDraft) {
    return;
  }
  const merged = templateFromForm(templateDraft);
  const book = cloneTemplateBook(templateBook);
  const index = book.templates.findIndex((entry) => entry.id === merged.id);
  if (index >= 0) {
    book.templates[index] = merged;
  } else {
    book.templates.push(merged);
  }
  if (!(await persistTemplates(book))) {
    templateError.textContent = templatesMessage.textContent;
    return;
  }
  templateDialog.close();
  await loadTemplates();
});

templateTokenAdd.addEventListener("click", () => {
  templateTokensState.push({
    id: newTemplateId("tok"),
    tokenKey: templateTokenKeys[0] ?? "{Rechnungsnummer}",
    xPct: 15,
    yPct: 35,
    widthPct: null,
    fontSize: 13,
    fontWeight: "normal",
    color: "",
    align: "left",
  });
  renderTemplateTokens();
});

templateTokenDefaults.addEventListener("click", async () => {
  try {
    const tokens = await invoke<StationeryToken[]>("template_default_stationery_tokens");
    templateTokensState = tokens.map((token) => ({ ...token }));
    renderTemplateTokens();
  } catch (error) {
    templateError.textContent = describe(error);
  }
});

templateLogoFile.addEventListener("change", () => {
  void applyTemplateAsset(templateLogoFile.files?.[0], "logo");
});
templateStationeryImageFile.addEventListener("change", () => {
  void applyTemplateAsset(templateStationeryImageFile.files?.[0], "stationery-image");
});
templateStationeryPdfFile.addEventListener("change", () => {
  void applyTemplateAsset(templateStationeryPdfFile.files?.[0], "stationery-pdf");
});

// ---------------------------------------------------------------------------
// Invoices: list, editor, preview and export (ported from InvoicesModule.tsx and
// InvoicePrintModal.tsx). All reads and writes go through the real Tauri commands.
// ---------------------------------------------------------------------------

interface InvoiceLineDraft {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
}

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];
const INVOICE_STATUS_KEYS: Record<string, TranslationKey> = {
  draft: "invoiceStatusDraft",
  sent: "invoiceStatusSent",
  paid: "invoiceStatusPaid",
  overdue: "invoiceStatusOverdue",
  cancelled: "invoiceStatusCancelled",
};
const invoiceDecimalFormat = new Intl.NumberFormat(language, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let invoiceList: InvoiceView[] = [];
let invoiceLineDrafts: InvoiceLineDraft[] = [];
let invoicePreviewState: InvoicePreview | null = null;
let invoicePreviewId: string | null = null;

function invoiceStatusLabel(status: string): string {
  return translate(language, INVOICE_STATUS_KEYS[status] ?? "invoiceStatusDraft");
}

function invoiceMoney(cents: number, symbol: string): string {
  return `${invoiceDecimalFormat.format(cents / 100)} ${symbol.trim() || "€"}`;
}

function parseDecimal(value: string): number {
  const compact = value.trim().replace(/\s/g, "");
  if (!compact) {
    return 0;
  }
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCents(value: string): number {
  return Math.round(parseDecimal(value) * 100);
}

function parseMilli(value: string): number {
  return Math.round(parseDecimal(value) * 1000);
}

function parseBasisPoints(value: string): number {
  return Math.round(parseDecimal(value) * 100);
}

function quantityText(milli: number): string {
  if (milli % 1000 === 0) {
    return String(milli / 1000);
  }
  return (milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function taxText(basisPoints: number): string {
  if (basisPoints % 100 === 0) {
    return String(basisPoints / 100);
  }
  return (basisPoints / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) {
    return date;
  }
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function lineNetCents(draft: InvoiceLineDraft): number {
  return Math.round((parseCents(draft.unit_price) * parseMilli(draft.quantity)) / 1000);
}

function lineTaxCents(draft: InvoiceLineDraft): number {
  return Math.round((lineNetCents(draft) * parseBasisPoints(draft.tax_rate)) / 10_000);
}

function fillInvoiceStatusOptions(): void {
  invoiceStatusInput.replaceChildren();
  for (const status of INVOICE_STATUSES) {
    const option = makeElement("option", undefined, invoiceStatusLabel(status));
    option.value = status;
    invoiceStatusInput.appendChild(option);
  }
  invoiceStatusInput.value = "draft";
}

function fillInvoiceStatusFilter(): void {
  invoiceStatusFilter.replaceChildren();
  const all = makeElement("option", undefined, translate(language, "invoicesFilterAll"));
  all.value = "all";
  invoiceStatusFilter.appendChild(all);
  for (const status of INVOICE_STATUSES) {
    const option = makeElement("option", undefined, invoiceStatusLabel(status));
    option.value = status;
    invoiceStatusFilter.appendChild(option);
  }
  invoiceStatusFilter.value = "all";
}

function updateInvoiceTotals(): void {
  let net = 0;
  let tax = 0;
  for (const draft of invoiceLineDrafts) {
    net += lineNetCents(draft);
    tax += lineTaxCents(draft);
  }
  const symbol = invoiceCurrencyInput.value;
  invoiceTotalNet.textContent = invoiceMoney(net, symbol);
  invoiceTotalTax.textContent = invoiceMoney(tax, symbol);
  invoiceTotalGross.textContent = invoiceMoney(net + tax, symbol);
}

function renderInvoiceLines(): void {
  invoiceLinesList.replaceChildren();
  const head = makeElement("div", "invoice-line invoice-line-head");
  for (const key of [
    "invoiceItemDescription",
    "invoiceItemQuantity",
    "invoiceItemPrice",
    "invoiceItemTax",
    "invoiceItemNet",
    "invoiceItemRemove",
  ] as const) {
    head.appendChild(makeElement("span", undefined, translate(language, key)));
  }
  invoiceLinesList.appendChild(head);

  invoiceLineDrafts.forEach((draft, index) => {
    const row = makeElement("div", "invoice-line");
    const description = makeElement("input");
    description.type = "text";
    description.value = draft.description;
    description.addEventListener("input", () => {
      draft.description = description.value;
    });

    const quantity = makeElement("input");
    quantity.type = "text";
    quantity.inputMode = "decimal";
    quantity.value = draft.quantity;

    const price = makeElement("input");
    price.type = "text";
    price.inputMode = "decimal";
    price.value = draft.unit_price;

    const tax = makeElement("input");
    tax.type = "text";
    tax.inputMode = "decimal";
    tax.value = draft.tax_rate;

    const net = makeElement(
      "span",
      "invoice-line-net",
      invoiceMoney(lineNetCents(draft), invoiceCurrencyInput.value),
    );
    const refresh = () => {
      net.textContent = invoiceMoney(lineNetCents(draft), invoiceCurrencyInput.value);
      updateInvoiceTotals();
    };
    quantity.addEventListener("input", () => {
      draft.quantity = quantity.value;
      refresh();
    });
    price.addEventListener("input", () => {
      draft.unit_price = price.value;
      refresh();
    });
    tax.addEventListener("input", () => {
      draft.tax_rate = tax.value;
      refresh();
    });

    const remove = makeElement("button", "danger", "×");
    remove.type = "button";
    remove.title = translate(language, "invoiceItemRemove");
    remove.disabled = invoiceLineDrafts.length <= 1;
    remove.addEventListener("click", () => {
      invoiceLineDrafts.splice(index, 1);
      renderInvoiceLines();
    });

    row.append(description, quantity, price, tax, net, remove);
    invoiceLinesList.appendChild(row);
  });

  updateInvoiceTotals();
}

function emptyInvoiceLine(): InvoiceLineDraft {
  return { description: "", quantity: "1", unit_price: "", tax_rate: "19" };
}

function invoiceInputFromForm(): InvoiceInput {
  return {
    id: invoiceIdInput.value || null,
    number: invoiceNumberInput.value.trim(),
    contact_id: invoiceContact.value,
    status: invoiceStatusInput.value,
    date: invoiceIssuedDate.value,
    due_date: invoiceDueDate.value,
    currency_symbol: invoiceCurrencyInput.value.trim(),
    notes: invoiceNoteInput.value,
    items: invoiceLineDrafts.map((draft) => ({
      description: draft.description.trim(),
      quantity_milli: parseMilli(draft.quantity),
      unit_price_cents: parseCents(draft.unit_price),
      tax_rate_bp: parseBasisPoints(draft.tax_rate),
    })),
  };
}

function invoiceBucket(status: string): "all" | "draft" | "sent" | "paid" {
  if (status === "draft") {
    return "draft";
  }
  if (status === "paid") {
    return "paid";
  }
  return "sent";
}

function invoiceDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function invoiceStatusText(status: string): string {
  if (status === "draft") {
    return translate(language, "invoiceStatusDraft");
  }
  if (status === "paid") {
    return translate(language, "invoiceStatusPaid");
  }
  return translate(language, "invoiceStatusSent");
}

function invoiceStatusBadge(status: string): string {
  const bucket = invoiceBucket(status);
  return `<span class="invoice-status invoice-status-${bucket}">${invoiceStatusText(status)}</span>`;
}

function visibleInvoices(): InvoiceView[] {
  const bucket = (invoiceStatusFilter.value || "all") as "all" | "draft" | "sent" | "paid";
  const query = invoiceSearch.value.trim().toLowerCase();
  return invoiceList.filter((invoice) => {
    if (bucket !== "all" && invoiceBucket(invoice.status) !== bucket) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${invoice.number} ${invoice.contact_name} ${invoice.contact_company}`
      .toLowerCase()
      .includes(query);
  });
}

function renderInvoices(): void {
  const all = invoiceList.length;
  const counts = {
    all,
    draft: invoiceList.filter((invoice) => invoiceBucket(invoice.status) === "draft").length,
    sent: invoiceList.filter((invoice) => invoiceBucket(invoice.status) === "sent").length,
    paid: invoiceList.filter((invoice) => invoiceBucket(invoice.status) === "paid").length,
  };
  for (const [name, count] of Object.entries(counts)) {
    const target = document.getElementById(`invoice-count-${name}`);
    if (target) {
      target.textContent = numberFormat.format(count);
    }
  }
  const visible = visibleInvoices();
  invoicesCount.textContent = numberFormat.format(visible.length);
  invoicesList.replaceChildren();

  if (visible.length === 0) {
    const row = document.createElement("tr");
    row.className = "invoice-empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 7;
    const empty = makeElement("div", "invoice-empty-state");
    empty.appendChild(makeElement("p", undefined, pageText.invoiceEmpty));
    const action = makeElement("button", "invoice-empty-action", pageText.invoiceNew);
    action.type = "button";
    action.addEventListener("click", () => void openInvoiceDialog());
    empty.appendChild(action);
    cell.appendChild(empty);
    row.appendChild(cell);
    invoicesList.appendChild(row);
    return;
  }

  const sorted = [...visible].sort(
    (left, right) => right.issued_at - left.issued_at || right.number.localeCompare(left.number),
  );
  for (const invoice of sorted) {
    const row = document.createElement("tr");
    row.dataset.id = invoice.id;

    const number = document.createElement("td");
    number.className = "invoice-number-cell";
    number.textContent = invoice.number;
    row.appendChild(number);

    const contact = document.createElement("td");
    const contactName = makeElement(
      "strong",
      undefined,
      invoice.contact_company || invoice.contact_name,
    );
    contact.appendChild(contactName);
    if (invoice.contact_company) {
      contact.appendChild(makeElement("small", undefined, invoice.contact_name));
    }
    row.appendChild(contact);

    const date = document.createElement("td");
    date.className = "invoice-date-cell";
    date.textContent = invoiceDateLabel(invoice.date);
    row.appendChild(date);

    const due = document.createElement("td");
    due.className = "invoice-date-cell";
    due.textContent = invoiceDateLabel(invoice.due_date);
    row.appendChild(due);

    const status = document.createElement("td");
    status.className = "center";
    status.innerHTML = invoiceStatusBadge(invoice.status);
    row.appendChild(status);

    const total = document.createElement("td");
    total.className = "right invoice-total-cell";
    total.textContent = invoiceMoney(invoice.total_cents, invoice.currency_symbol);
    row.appendChild(total);

    const actions = document.createElement("td");
    actions.className = "right invoice-row-actions";
    const actionWrap = makeElement("div", "invoice-row-action-wrap");
    const preview = makeElement("button", "icon-action", "▤");
    preview.type = "button";
    preview.title = translate(language, "invoicePreview");
    preview.addEventListener("click", () => {
      void openInvoicePreview(invoice.id).catch((error) => {
        invoicesMessage.textContent = format(translate(language, "invoicesErrorPreview"), {
          message: describe(error),
        });
      });
    });
    actionWrap.appendChild(preview);
    const fattura = makeElement("button", "icon-action", "◧");
    fattura.type = "button";
    fattura.title = translate(language, "invoiceFattura");
    fattura.addEventListener("click", () => {
      void openFattura(invoice.id).catch((error) => {
        invoicesMessage.textContent = describe(error);
      });
    });
    actionWrap.appendChild(fattura);
    const mail = makeElement("button", "icon-action", "✉");
    mail.type = "button";
    mail.title = translate(language, "invoiceEmail");
    mail.addEventListener("click", () => {
      void openInvoiceAction(invoice.id, "email").catch((error) => {
        invoicesMessage.textContent = describe(error);
      });
    });
    actionWrap.appendChild(mail);
    const payment = makeElement("button", "icon-action", "€");
    payment.type = "button";
    payment.title = translate(language, "invoicePayment");
    payment.addEventListener("click", () => {
      void openInvoiceAction(invoice.id, "payment").catch((error) => {
        invoicesMessage.textContent = describe(error);
      });
    });
    actionWrap.appendChild(payment);
    if (invoice.status === "draft") {
      const send = makeElement("button", "icon-action", "→");
      send.type = "button";
      send.title = translate(language, "invoiceMarkSent");
      send.addEventListener("click", () => void changeInvoiceStatus(invoice.id, "sent"));
      actionWrap.appendChild(send);
    } else if (invoice.status !== "paid") {
      const paid = makeElement("button", "icon-action", "✓");
      paid.type = "button";
      paid.title = translate(language, "invoiceMarkPaid");
      paid.addEventListener("click", () => void changeInvoiceStatus(invoice.id, "paid"));
      actionWrap.appendChild(paid);
    }
    const edit = makeElement("button", "icon-action", "✎");
    edit.type = "button";
    edit.title = translate(language, "edit");
    edit.addEventListener("click", () => void openInvoiceDialog(invoice));
    actionWrap.appendChild(edit);
    const remove = makeElement("button", "icon-action danger", "🗑");
    remove.type = "button";
    remove.title = translate(language, "invoiceDelete");
    remove.addEventListener("click", () => void removeInvoice(invoice));
    actionWrap.appendChild(remove);
    actions.appendChild(actionWrap);
    row.appendChild(actions);

    invoicesList.appendChild(row);
  }
}

async function loadInvoiceBanner(): Promise<void> {
  const banner = document.getElementById("invoice-incomplete-banner");
  if (!banner) {
    return;
  }
  try {
    const profile = await invoke<Record<string, unknown>>("company_profile");
    const required = ["name", "street", "zip_city", "country", "email", "tax_id", "iban"];
    banner.hidden = required.every((key) => String(profile[key] ?? "").trim().length > 0);
  } catch {
    banner.hidden = false;
  }
}

async function loadInvoices(): Promise<void> {
  invoicesMessage.textContent = translate(language, "loading");
  try {
    invoiceList = await invoke<InvoiceView[]>("list_invoices", {
      query: null,
      status: "all",
    });
    renderInvoices();
    invoicesMessage.textContent = "";
  } catch (error) {
    invoicesMessage.textContent = format(translate(language, "invoicesErrorLoad"), {
      message: describe(error),
    });
  }
}

async function loadInvoiceContacts(selected?: string): Promise<void> {
  const contacts = await invoke<Contact[]>("list_contacts", { query: null });
  invoiceContact.replaceChildren();
  for (const contact of contacts) {
    const display = contactDisplayName(contact);
    const company = contact.company_name?.trim();
    const option = makeElement(
      "option",
      undefined,
      company && company !== display ? `${display} · ${company}` : display,
    );
    option.value = contact.id;
    invoiceContact.appendChild(option);
  }
  if (selected && contacts.some((contact) => contact.id === selected)) {
    invoiceContact.value = selected;
  }
}

async function openInvoiceDialog(invoice?: InvoiceView): Promise<void> {
  invoiceError.textContent = "";
  invoiceDialogTitle.textContent = translate(
    language,
    invoice ? "invoiceEditTitle" : "invoiceNewTitle",
  );
  try {
    await loadInvoiceContacts(invoice?.contact_id);
  } catch (error) {
    invoiceError.textContent = format(translate(language, "invoicesErrorLoad"), {
      message: describe(error),
    });
  }

  if (invoice) {
    invoiceIdInput.value = invoice.id;
    invoiceNumberInput.value = invoice.number;
    invoiceStatusInput.value = invoice.status;
    invoiceIssuedDate.value = invoice.date;
    invoiceDueDate.value = invoice.due_date;
    invoicePaymentTermsInput.value = String(invoice.payment_terms);
    invoiceCurrencyInput.value = invoice.currency_symbol;
    invoiceNoteInput.value = invoice.notes;
    invoiceLineDrafts = invoice.items.map((item) => ({
      description: item.description,
      quantity: quantityText(item.quantity_milli),
      unit_price: (item.unit_price_cents / 100).toFixed(2),
      tax_rate: taxText(item.tax_rate_bp),
    }));
  } else {
    invoiceIdInput.value = "";
    invoiceStatusInput.value = "draft";
    invoiceCurrencyInput.value = "€";
    const today = new Date().toISOString().slice(0, 10);
    invoiceIssuedDate.value = today;
    invoiceDueDate.value = today;
    invoicePaymentTermsInput.value = "14";
    invoiceNoteInput.value = "";
    invoiceLineDrafts = [emptyInvoiceLine()];
    try {
      const defaults = await invoke<InvoiceDefaults>("invoice_defaults");
      invoiceNumberInput.value = defaults.number;
      invoiceCurrencyInput.value = defaults.currency_symbol;
      invoicePaymentTermsInput.value = String(defaults.due_days);
      invoiceDueDate.value = addDays(today, defaults.due_days);
    } catch (error) {
      invoiceError.textContent = format(translate(language, "invoicesErrorLoad"), {
        message: describe(error),
      });
    }
  }

  if (invoiceLineDrafts.length === 0) {
    invoiceLineDrafts = [emptyInvoiceLine()];
  }
  renderInvoiceLines();
  invoiceDialog.showModal();
  invoiceNumberInput.focus();
}

async function changeInvoiceStatus(id: string, status: string): Promise<void> {
  try {
    await invoke<InvoiceView>("set_invoice_status", { id, status });
    await loadInvoices();
    invoicesMessage.textContent = translate(language, "invoicesStatusSaved");
  } catch (error) {
    invoicesMessage.textContent = format(translate(language, "invoicesErrorSave"), {
      message: describe(error),
    });
  }
}

async function removeInvoice(invoice: InvoiceView): Promise<void> {
  const question = `${translate(language, "invoiceDeleteTitle")}\n${translate(
    language,
    "invoiceDeleteBody",
  )}`;
  if (!(await confirmDialog(question))) {
    return;
  }
  try {
    await invoke("delete_invoice", { id: invoice.id });
    await loadInvoices();
    invoicesMessage.textContent = translate(language, "invoicesDeleted");
  } catch (error) {
    invoicesMessage.textContent = format(translate(language, "invoicesErrorDelete"), {
      message: describe(error),
    });
  }
}

async function openInvoicePreview(id: string): Promise<void> {
  const book = await invoke<InvoiceTemplateBook>("invoice_templates");
  invoicePreviewTemplate.replaceChildren();
  for (const template of book.templates) {
    const option = makeElement("option", undefined, template.name);
    option.value = template.id;
    invoicePreviewTemplate.appendChild(option);
  }
  invoicePreviewTemplate.value = book.activeId;
  invoicePreviewId = id;
  await refreshInvoicePreview(book.activeId);
  invoicePreviewMessage.textContent = "";
  invoicePreviewDialog.showModal();
}

async function refreshInvoicePreview(templateId: string): Promise<void> {
  if (!invoicePreviewId) {
    return;
  }
  invoicePreviewMessage.textContent = translate(language, "loading");
  const preview = await invoke<InvoicePreview>("invoice_preview", {
    id: invoicePreviewId,
    templateId,
  });
  invoicePreviewState = preview;
  invoicePreviewTitle.textContent = `${translate(language, "invoicePreviewTitle")} · ${
    preview.invoice.number
  }`;
  invoicePreviewBody.innerHTML = preview.html;

  const source = preview.stationery_source.trim();
  const image = source.startsWith("data:image") ? source : "";
  invoicePreviewStationery.hidden = !preview.stationery_mode;
  invoicePreviewPage.style.backgroundImage = image ? `url("${image}")` : "none";
  invoicePreviewStationeryHint.textContent =
    preview.stationery_mode && !image && !source.startsWith("data:") ? source : "";
  invoicePreviewTokens.replaceChildren();
  for (const token of preview.tokens) {
    const element = makeElement("span", "invoice-preview-token", token.text);
    element.style.left = `${token.x_pct}%`;
    element.style.top = `${token.y_pct}%`;
    if (token.width_pct !== null) {
      element.style.width = `${token.width_pct}%`;
    }
    if (token.font_size !== null) {
      element.style.fontSize = `${token.font_size}px`;
    }
    element.style.fontWeight = token.font_weight.trim() || "normal";
    if (token.color.trim()) {
      element.style.color = token.color.trim();
    }
    element.style.textAlign = token.align.trim() || "left";
    element.title = token.key;
    invoicePreviewTokens.appendChild(element);
  }
  invoicePreviewMessage.textContent = "";
}

async function exportInvoice(kind: "pdf" | "docx"): Promise<void> {
  if (!invoicePreviewState) {
    return;
  }
  const suggested = `${invoicePreviewState.invoice.number}.${kind}`;
  try {
    const reply = await invoke<DialogReply>("pick_save_file", { suggestedName: suggested });
    if (reply.outcome === "cancelled") {
      invoicePreviewMessage.textContent = translate(language, "invoiceFileDialogCancelled");
      return;
    }
    if (reply.outcome !== "chosen" || !reply.path) {
      invoicePreviewMessage.textContent = format(translate(language, "invoicesErrorExport"), {
        message: reply.error ?? reply.outcome,
      });
      return;
    }
    const report = await invoke<InvoiceExportReport>("export_invoice", {
      id: invoicePreviewState.invoice.id,
      templateId: invoicePreviewState.template_id,
      format: kind,
      path: reply.path,
    });
    invoicePreviewMessage.textContent = format(translate(language, "invoiceExportSaved"), {
      path: report.path,
      bytes: String(report.bytes),
    });
  } catch (error) {
    invoicePreviewMessage.textContent = format(translate(language, "invoicesErrorExport"), {
      message: describe(error),
    });
  }
}

invoiceSearch.placeholder = pageText.invoiceSearch;
setParityText("invoice-th-number", pageText.invoiceNumber);
setParityText("invoice-th-contact", pageText.invoiceContact);
setParityText("invoice-th-date", pageText.invoiceDate);
setParityText("invoice-th-due", pageText.invoiceDue);
setParityText("invoice-th-status", pageText.invoiceStatus);
setParityText("invoice-th-total", pageText.invoiceTotal);
setParityText("invoice-th-actions", pageText.invoiceActions);
setParityText("invoice-journal-label", pageText.invoiceJournal);
setParityText("invoice-entries-label", pageText.entries);
setParityText("invoice-templates-label", pageText.invoiceTemplates);
setParityText("invoice-import-label", pageText.invoiceImport);
fillInvoiceStatusOptions();
fillInvoiceStatusFilter();

invoiceSearch.addEventListener("input", () => {
  renderInvoices();
});
invoiceStatusFilter.addEventListener("change", () => {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-invoice-filter]")) {
    const active = button.dataset.invoiceFilter === invoiceStatusFilter.value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  renderInvoices();
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-invoice-filter]")) {
  button.addEventListener("click", () => {
    invoiceStatusFilter.value = button.dataset.invoiceFilter ?? "all";
    invoiceStatusFilter.dispatchEvent(new Event("change"));
  });
}
document.getElementById("invoice-complete-data")?.addEventListener("click", () => {
  void showView("settings").then(() => {
    document.getElementById("settings-card-profile")?.scrollIntoView({ block: "start" });
  });
});
invoiceNewButton.addEventListener("click", () => {
  void openInvoiceDialog();
});
invoiceTemplatesButton.addEventListener("click", () => {
  void showView("templates");
});
invoiceImportFile.addEventListener("change", () => {
  void importFatturaFile();
});

async function importFatturaFile(): Promise<void> {
  const file = invoiceImportFile.files?.[0];
  if (!file) return;
  invoicesMessage.textContent = pageText.invoiceImport;
  try {
    const parsed = parseFatturaPa(await file.text());
    const matches = await invoke<Contact[]>("list_contacts", { query: parsed.seller.name });
    let contact =
      matches.find((entry) => (entry.company_name ?? entry.name ?? "").trim().toLowerCase() === parsed.seller.name.trim().toLowerCase()) ??
      null;
    if (!contact) {
      contact = await invoke<Contact>("create_contact", {
        input: {
          name: parsed.seller.name,
          company: parsed.seller.name,
          is_company: true,
          contact_type: "vendor",
          first_name: "",
          last_name: "",
          street: parsed.seller.street,
          zip: parsed.seller.zip,
          city: parsed.seller.city,
          country: parsed.seller.country,
          email: parsed.seller.pec,
          phone: "",
          tax_id: parsed.seller.taxId,
          notes: `Importiert aus FatturaPA XML (${parsed.documentType})`,
          contact_persons: [],
        },
      });
    }
    const extra = [
      parsed.paymentIban ? `IBAN: ${parsed.paymentIban}` : "",
      parsed.paymentBank,
      parsed.cup ? `CUP: ${parsed.cup}` : "",
      parsed.cig ? `CIG: ${parsed.cig}` : "",
      parsed.bollo ? `Bollo: ${parsed.bolloAmount.toFixed(2)} EUR` : "",
    ].filter(Boolean);
    await invoke<InvoiceView>("save_invoice", {
      input: {
        id: null,
        number: parsed.invoiceNumber,
        contact_id: contact.id,
        status: "draft",
        date: parsed.invoiceDate,
        due_date: parsed.dueDate,
        currency_symbol: "€",
        notes: [`Importiert aus FatturaPA XML (${parsed.documentType})`, parsed.subject, ...extra]
          .filter(Boolean)
          .join(" · "),
        items: parsed.lines.map((line) => ({
          description: line.description,
          quantity_milli: Math.max(1, Math.round(line.quantity * 1000)),
          unit_price_cents: Math.round(line.unitPrice * 100),
          tax_rate_bp: Math.round(line.taxRate * 100),
        })),
      },
    });
    await refreshStatus();
    await loadInvoices();
    invoicesMessage.textContent = `FatturaPA ${parsed.invoiceNumber} aus ${file.name} importiert.`;
  } catch (error) {
    invoicesMessage.textContent = `FatturaPA-Import fehlgeschlagen: ${describe(error)}`;
  } finally {
    invoiceImportFile.value = "";
  }
}
invoiceLineAdd.addEventListener("click", () => {
  invoiceLineDrafts.push(emptyInvoiceLine());
  renderInvoiceLines();
});
invoiceCurrencyInput.addEventListener("input", updateInvoiceTotals);
invoiceIssuedDate.addEventListener("change", () => {
  if (!invoiceIssuedDate.value) {
    return;
  }
  const days = Math.max(0, Math.round(Number.parseFloat(invoicePaymentTermsInput.value || "0")));
  invoiceDueDate.value = addDays(invoiceIssuedDate.value, days);
});
invoicePaymentTermsInput.addEventListener("change", () => {
  if (!invoiceIssuedDate.value) {
    return;
  }
  const days = Math.max(0, Math.round(Number.parseFloat(invoicePaymentTermsInput.value || "0")));
  invoicePaymentTermsInput.value = String(days);
  invoiceDueDate.value = addDays(invoiceIssuedDate.value, days);
});
invoiceDueDate.addEventListener("change", () => {
  if (invoiceIssuedDate.value && invoiceDueDate.value) {
    invoicePaymentTermsInput.value = String(
      daysBetween(invoiceIssuedDate.value, invoiceDueDate.value),
    );
  }
});
invoiceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  invoiceError.textContent = "";
  if (!invoiceContact.value) {
    invoiceError.textContent = translate(language, "invoiceContactRequired");
    return;
  }
  if (invoiceLineDrafts.length === 0) {
    invoiceError.textContent = translate(language, "invoiceItemEmpty");
    return;
  }
  try {
    await invoke<InvoiceView>("save_invoice", { input: invoiceInputFromForm() });
    invoiceDialog.close();
    await loadInvoices();
    invoicesMessage.textContent = translate(language, "invoicesSaved");
  } catch (error) {
    invoiceError.textContent = format(translate(language, "invoicesErrorSave"), {
      message: describe(error),
    });
  }
});
invoicePreviewTemplate.addEventListener("change", () => {
  void refreshInvoicePreview(invoicePreviewTemplate.value).catch((error) => {
    invoicePreviewMessage.textContent = format(translate(language, "invoicesErrorPreview"), {
      message: describe(error),
    });
  });
});
invoiceExportPdfButton.addEventListener("click", () => {
  void exportInvoice("pdf");
});
invoiceExportDocxButton.addEventListener("click", () => {
  void exportInvoice("docx");
});

window.addEventListener("socdof:open-invoice", (event) => {
  const id = (event as CustomEvent<string>).detail;
  void (async () => {
    await showView("invoices");
    if (id) {
      await openInvoicePreview(id);
    }
  })().catch((error) => {
    invoicesMessage.textContent = String(error);
  });
});

window.addEventListener("socdof:new-contact", () => openContactDialog());
window.addEventListener("socdof:edit-contact", (event) => {
  const contact = (event as CustomEvent<Contact>).detail;
  if (contact) openContactDialog(contact);
});
window.addEventListener("socdof:contacts-changed", () => {
  void loadContacts();
  void refreshStatus();
});
window.addEventListener("socdof:new-invoice-for", (event) => {
  const contactId = String((event as CustomEvent<string>).detail);
  void (async () => {
    await showView("invoices");
    await openInvoiceDialog();
    if (contactId) invoiceContact.value = contactId;
  })();
});
byId("invoice-contact-pick").addEventListener("click", () => {
  void openCustomerPicker(invoiceContact.value).then((contact) => {
    if (contact) invoiceContact.value = contact.id;
  });
});

initTheme();
initTaskbar();
initRestaurant();
initDashboard();
initSettings();
initDocs();
initUsers();
initCommandPalette();
initWorkspaceTools();
initDocuments();
initCalendar();
initAccounting();
initPurchases();
initReports();
void start();
