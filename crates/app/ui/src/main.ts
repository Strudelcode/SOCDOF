import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

import "./style.css";
import "./screens.css";
import { applyTranslations, detectLanguage, format, translate, type TranslationKey } from "./i18n";

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

type View = "dashboard" | "contacts" | "products";

const language = detectLanguage();
applyTranslations(language);

const statusMessage = byId<HTMLParagraphElement>("status-message");
const backupButton = byId<HTMLButtonElement>("backup-button");
const backupResult = byId<HTMLParagraphElement>("backup-result");
const updateCard = byId<HTMLElement>("update-card");
const updateButton = byId<HTMLButtonElement>("update-button");
const updateResult = byId<HTMLParagraphElement>("update-result");
const contactSearch = byId<HTMLInputElement>("contact-search");
const contactNew = byId<HTMLButtonElement>("contact-new");
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
};

contactSearch.placeholder = translate(language, "contactsSearchPlaceholder");
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
  contactsCount.textContent = format(translate(language, "contactsCount"), {
    count: numberFormat.format(contacts.length),
  });
  contactsList.replaceChildren();

  if (contacts.length === 0) {
    contactsList.appendChild(makeElement("p", "empty", translate(language, "contactsEmpty")));
    return;
  }

  for (const contact of contacts) {
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

async function showView(view: View): Promise<void> {
  activeView = view;
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
  } else if (view === "products") {
    await loadProducts();
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
  if (!window.confirm(translate(language, "confirmDeleteContact"))) {
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
  if (!window.confirm(translate(language, "confirmDeleteProduct"))) {
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
productNew.addEventListener("click", () => openProductDialog());
contactSearch.addEventListener("input", () => void loadContacts());
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
    contactDialog.close();
    await refreshStatus();
    await loadContacts();
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
  await refreshStatus();
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

void start();

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
