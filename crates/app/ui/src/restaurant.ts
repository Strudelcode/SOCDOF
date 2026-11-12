import { invoke } from "@tauri-apps/api/core";

import { applyTranslations, detectLanguage, format, translate, type TranslationKey } from "./i18n";
import { confirmDialog } from "./dialogs";
import { sounds } from "./sound";

interface MenuItemView {
  id: string;
  name: string;
  category: string;
  price: number;
  taxRate: number;
  ingredients: string;
  allergens: string[];
  emoji: string;
  prepTimeMinutes: number;
  isAvailable: boolean;
}

interface TableOrderItemView {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  taxRate: number;
  qty: number;
  category: string;
  emoji: string;
  notes: string;
  lineTotal: number;
}

interface TableOrderView {
  id: string;
  tableNumber: string;
  serverName: string;
  status: string;
  items: TableOrderItemView[];
  subtotal: number;
  taxTotal: number;
  total: number;
  tip: number;
  totalWithTip: number;
  paymentMethod: string | null;
  openedAt: string;
  paidAt: string | null;
  cashTendered: number | null;
  cashChange: number | null;
  isHospitalityReceipt: boolean;
  hospitalityHost: string;
  hospitalityOccasion: string;
  hospitalityGuests: string;
  receiptNumber: string | null;
  invoiceId: string | null;
}

interface RestaurantTableView {
  id: string;
  name: string;
  area: string;
  seats: number;
  status: string;
  orderId: string | null;
  itemCount: number;
  total: number;
}

interface RestaurantMetricsView {
  openTables: number;
  inKitchen: number;
  menuCount: number;
  todayOrders: number;
  todayRevenue: number;
  cashSales: number;
  cardSales: number;
  taxTotal: number;
}

interface RestaurantCompanyView {
  name: string;
  street: string;
  zipCity: string;
  taxId: string;
  currency: string;
}

interface RestaurantOverviewView {
  company: RestaurantCompanyView;
  menu: MenuItemView[];
  tables: RestaurantTableView[];
  orders: TableOrderView[];
  metrics: RestaurantMetricsView;
  csvFileName: string;
}

interface RestaurantOrderMutationView {
  order: TableOrderView | null;
  created: boolean;
}

interface RestaurantCheckoutView {
  order: TableOrderView;
  invoiceId: string;
  invoiceNumber: string;
  totalWithTip: number;
  change: number;
  splitCount: number;
  totalPerPerson: number;
}

interface DialogReply {
  outcome: "chosen" | "cancelled";
  path: string | null;
}

const language = detectLanguage();
const money = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" });

let state: RestaurantOverviewView | null = null;
let tab: "tables" | "kitchen" | "menu" | "history" = "tables";
let area = "all";
let search = "";
let category = "all";
let catalogSearch = "";
let catalogCategory = "all";
let selectedTable = "";
let billingOrder: TableOrderView | null = null;

function t(key: TranslationKey): string {
  return translate(language, key);
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`Missing element #${id}`);
  }
  return found as T;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  if (className) {
    created.className = className;
  }
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

function button(label: string, className: string, action: () => void): HTMLButtonElement {
  const created = node("button", className, label);
  created.type = "button";
  created.addEventListener("click", action);
  return created;
}

function moneyText(value: number): string {
  return money.format(value);
}

function timeText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
}

function dateText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(language);
}

function categoryKey(value: string): TranslationKey {
  switch (value) {
    case "starters":
      return "restaurantCategoryStarters";
    case "pizza":
      return "restaurantCategoryPizza";
    case "burgers":
      return "restaurantCategoryBurgers";
    case "desserts":
      return "restaurantCategoryDesserts";
    case "drinks":
      return "restaurantCategoryDrinks";
    default:
      return "restaurantCategoryMains";
  }
}

function statusKey(value: string): TranslationKey {
  switch (value) {
    case "preparing":
      return "restaurantStatusPreparing";
    case "ready":
      return "restaurantStatusReady";
    case "served":
      return "restaurantStatusServed";
    case "paid":
      return "restaurantPaid";
    default:
      return "restaurantStatusOrdered";
  }
}

function statusText(value: string): string {
  return value === "free" ? t("restaurantFree") : t(statusKey(value));
}

function activeOrder(table: string): TableOrderView | undefined {
  return state?.orders.find((order) => order.tableNumber === table && order.status !== "paid");
}

function setMessage(value: string): void {
  element<HTMLParagraphElement>("restaurant-message").textContent = value;
}

function filteredMenu(): MenuItemView[] {
  const query = search.trim().toLowerCase();
  return (state?.menu ?? []).filter((dish) => {
    if (category !== "all" && dish.category !== category) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${dish.name} ${dish.ingredients}`.toLowerCase().includes(query);
  });
}

function filteredCatalog(): MenuItemView[] {
  const query = catalogSearch.trim().toLowerCase();
  return (state?.menu ?? []).filter((dish) => {
    if (catalogCategory !== "all" && dish.category !== catalogCategory) {
      return false;
    }
    return !query || `${dish.name} ${dish.ingredients}`.toLowerCase().includes(query);
  });
}

async function loadRestaurant(): Promise<void> {
  setMessage(t("loading"));
  try {
    state = await invoke<RestaurantOverviewView>("restaurant_overview");
    if (!selectedTable || !state.tables.some((table) => table.name === selectedTable)) {
      selectedTable = state.tables[0]?.name ?? "";
    }
    renderRestaurant();
    setMessage("");
  } catch (error) {
    setMessage(String(error));
  }
}

function renderRestaurant(): void {
  if (!state) {
    return;
  }
  renderMetrics();
  renderTabs();
  renderTables();
  renderOrder();
  renderKitchen();
  renderCatalog();
  renderHistory();
}

function renderMetrics(): void {
  if (!state) {
    return;
  }
  element("restaurant-kpi-open").textContent = String(state.metrics.openTables);
  element("restaurant-kpi-kitchen").textContent = String(state.metrics.inKitchen);
  element("restaurant-kpi-revenue").textContent = moneyText(state.metrics.todayRevenue);
  element("restaurant-kpi-menu").textContent = String(state.metrics.menuCount);
}

function renderTabs(): void {
  if (!state) {
    return;
  }
  element("restaurant-tab-tables").textContent =
    `${t("restaurantTabTables")} (${state.metrics.openTables})`;
  element("restaurant-tab-kitchen").textContent =
    `${t("restaurantTabKitchen")} (${state.metrics.inKitchen})`;
  element("restaurant-tab-menu").textContent =
    `${t("restaurantTabMenu")} (${state.menu.length})`;
  element("restaurant-tab-history").textContent =
    `${t("restaurantTabHistory")} (${state.orders.filter((order) => order.status === "paid").length})`;
  for (const name of ["tables", "kitchen", "menu", "history"] as const) {
    const pane = element(`restaurant-pane-${name}`);
    pane.hidden = tab !== name;
    element(`restaurant-tab-${name}`).classList.toggle("is-active", tab === name);
  }
}

function renderTables(): void {
  const grid = element<HTMLDivElement>("restaurant-table-grid");
  grid.replaceChildren();
  const tables = (state?.tables ?? []).filter((table) => area === "all" || table.area === area);
  for (const table of tables) {
    const card = button("", "restaurant-table", () => {
      selectedTable = table.name;
      renderTables();
      renderOrder();
    });
    card.dataset.id = table.id;
    card.classList.toggle("is-selected", table.name === selectedTable);
    card.classList.toggle("is-open", table.status !== "free");
    card.classList.toggle("is-kitchen", table.status === "preparing");

    const head = node("div", "restaurant-table-head");
    const names = node("div");
    names.appendChild(node("strong", undefined, table.name));
    names.appendChild(
      node(
        "span",
        "hint",
        table.seats > 0 ? `${table.seats} ${t("restaurantSeats")}` : t("restaurantTakeaway"),
      ),
    );
    head.appendChild(names);
    const dot = node("span", `restaurant-dot status-${table.status}`);
    dot.title = statusText(table.status);
    head.appendChild(dot);
    card.appendChild(head);

    const foot = node("div", "restaurant-table-foot");
    if (table.orderId) {
      foot.appendChild(node("strong", undefined, moneyText(table.total)));
      foot.appendChild(node("span", "hint", `${table.itemCount} ${t("restaurantItems")}`));
    } else {
      foot.appendChild(node("span", "restaurant-free", `✓ ${t("restaurantFree")}`));
    }
    card.appendChild(foot);
    grid.appendChild(card);
  }
  if (tables.length === 0) {
    grid.appendChild(node("p", "empty", t("restaurantNoTables")));
  }

  const picker = element<HTMLDivElement>("restaurant-dish-picker");
  picker.replaceChildren();
  for (const dish of filteredMenu()) {
    const card = button("", "restaurant-picker-card", () => {
      void addDish(dish);
    });
    card.disabled = !dish.isAvailable;
    const text = node("div");
    text.appendChild(node("strong", undefined, `${dish.emoji} ${dish.name}`));
    text.appendChild(node("span", "hint", dish.ingredients || t("restaurantNoIngredients")));
    text.appendChild(
      node(
        "span",
        "restaurant-picker-price",
        `${moneyText(dish.price)} · ${dish.taxRate}%`,
      ),
    );
    card.appendChild(text);
    card.appendChild(node("span", "restaurant-add", "+"));
    picker.appendChild(card);
  }
  if (filteredMenu().length === 0) {
    picker.appendChild(node("p", "empty", t("restaurantNoDishes")));
  }
}

function renderOrder(): void {
  const order = activeOrder(selectedTable);
  element("restaurant-order-title").textContent = `${t("restaurantReceiptFor")} ${selectedTable}`;
  element("restaurant-order-status").textContent = statusText(order?.status ?? "free");
  element<HTMLButtonElement>("restaurant-cancel-order").hidden = !order;
  element<HTMLButtonElement>("restaurant-send-kitchen").disabled = !order;
  element<HTMLButtonElement>("restaurant-bill").disabled = !order;
  element<HTMLInputElement>("restaurant-server").value = order?.serverName ?? "";
  element<HTMLInputElement>("restaurant-server").disabled = !order;

  const lines = element<HTMLDivElement>("restaurant-order-lines");
  lines.replaceChildren();
  if (!order) {
    const empty = node("div", "empty");
    empty.appendChild(node("p", undefined, `${t("restaurantNoOrder")} ${selectedTable}.`));
    empty.appendChild(node("p", "hint", t("restaurantNoOrderHint")));
    lines.appendChild(empty);
    element("restaurant-order-subtotal").textContent = moneyText(0);
    element("restaurant-order-tax").textContent = moneyText(0);
    element("restaurant-order-total").textContent = moneyText(0);
    return;
  }

  for (const item of order.items) {
    const row = node("article", "restaurant-order-line");
    const head = node("div", "restaurant-order-line-head");
    const title = node("div");
    title.appendChild(node("strong", undefined, `${item.emoji} ${item.name}`));
    title.appendChild(
      node(
        "span",
        "hint",
        `${moneyText(item.price)} · ${t("restaurantTax")} ${item.taxRate}%`,
      ),
    );
    head.appendChild(title);

    const stepper = node("div", "restaurant-stepper");
    stepper.appendChild(
      button("−", "secondary", () => void changeQty(order.id, item.id, item.qty - 1)),
    );
    stepper.appendChild(node("strong", undefined, String(item.qty)));
    stepper.appendChild(
      button("+", "secondary", () => void changeQty(order.id, item.id, item.qty + 1)),
    );
    head.appendChild(stepper);
    head.appendChild(node("strong", undefined, moneyText(item.price * item.qty)));
    row.appendChild(head);

    const notes = node("input");
    notes.type = "text";
    notes.value = item.notes;
    notes.placeholder = t("restaurantNotePlaceholder");
    notes.addEventListener("change", () => {
      void saveNotes(order.id, item.id, notes.value);
    });
    row.appendChild(notes);
    lines.appendChild(row);
  }

  element("restaurant-order-subtotal").textContent = moneyText(order.subtotal);
  element("restaurant-order-tax").textContent = moneyText(order.taxTotal);
  element("restaurant-order-total").textContent = moneyText(order.total);
}

function renderKitchen(): void {
  const grid = element<HTMLDivElement>("restaurant-kitchen-grid");
  grid.replaceChildren();
  const orders = (state?.orders ?? [])
    .filter((order) => order.status !== "paid")
    .sort((left, right) => left.openedAt.localeCompare(right.openedAt));
  for (const order of orders) {
    const card = node("article", "restaurant-kds-card");
    const head = node("div", "restaurant-kds-head");
    const title = node("div");
    title.appendChild(node("strong", undefined, order.tableNumber));
    title.appendChild(node("span", "hint", timeText(order.openedAt)));
    head.appendChild(title);
    head.appendChild(
      node("span", `restaurant-status status-${order.status}`, statusText(order.status)),
    );
    card.appendChild(head);

    const items = node("div", "restaurant-kds-items");
    for (const item of order.items) {
      const row = node("div", "restaurant-kds-item");
      row.appendChild(node("strong", undefined, `${item.qty}×`));
      const detail = node("div");
      detail.appendChild(node("span", undefined, item.name));
      if (item.notes) {
        detail.appendChild(node("span", "restaurant-note", `⚡ ${item.notes}`));
      }
      row.appendChild(detail);
      items.appendChild(row);
    }
    card.appendChild(items);

    const actions = node("div", "restaurant-kds-actions");
    if (order.status !== "ordered") {
      actions.appendChild(
        button(t("restaurantBack"), "secondary", () => void setStatus(order.id, "ordered")),
      );
    }
    if (order.status === "ordered" || order.status === "preparing") {
      actions.appendChild(
        button(t("restaurantReady"), "", () => void setStatus(order.id, "ready")),
      );
    } else if (order.status === "ready") {
      actions.appendChild(
        button(t("restaurantServed"), "", () => void setStatus(order.id, "served")),
      );
    }
    card.appendChild(actions);
    grid.appendChild(card);
  }
  if (orders.length === 0) {
    const empty = node("div", "empty");
    empty.appendChild(node("h4", undefined, t("restaurantKdsEmpty")));
    empty.appendChild(node("p", "hint", t("restaurantKdsEmptyHint")));
    grid.appendChild(empty);
  }
}

function renderCatalog(): void {
  const list = element<HTMLDivElement>("restaurant-catalog-list");
  list.replaceChildren();
  for (const dish of filteredCatalog()) {
    const row = node("article", "restaurant-catalog-row");
    row.dataset.id = dish.id;
    const title = node("div", "restaurant-catalog-title");
    title.appendChild(node("span", "restaurant-catalog-emoji", dish.emoji));
    const detail = node("div");
    const name = node("strong", undefined, dish.name);
    detail.appendChild(name);
    detail.appendChild(
      node(
        "span",
        "hint",
        `${t(categoryKey(dish.category))} · ${dish.ingredients || t("restaurantNoIngredients")}`,
      ),
    );
    if (dish.allergens.length > 0) {
      detail.appendChild(
        node("span", "hint", `${t("restaurantDishAllergens")}: ${dish.allergens.join(", ")}`),
      );
    }
    title.appendChild(detail);
    row.appendChild(title);

    const side = node("div", "restaurant-catalog-side");
    side.appendChild(
      node("div", "restaurant-price", `${moneyText(dish.price)}\n${dish.taxRate}% · ${dish.prepTimeMinutes} min`),
    );
    side.appendChild(
      button(
        dish.isAvailable ? t("restaurantAvailable") : t("restaurantUnavailable"),
        dish.isAvailable ? "secondary" : "danger",
        () => void toggleDish(dish),
      ),
    );
    side.appendChild(button(t("edit"), "secondary", () => openDishDialog(dish)));
    side.appendChild(button(t("delete"), "danger", () => void removeDish(dish)));
    row.appendChild(side);
    list.appendChild(row);
  }
  if (filteredCatalog().length === 0) {
    list.appendChild(node("p", "empty", t("restaurantNoDishes")));
  }
}

function renderHistory(): void {
  const list = element<HTMLDivElement>("restaurant-history-list");
  list.replaceChildren();
  const paid = (state?.orders ?? [])
    .filter((order) => order.status === "paid")
    .sort((left, right) => (right.paidAt ?? right.openedAt).localeCompare(left.paidAt ?? left.openedAt));
  for (const order of paid) {
    const row = node("article", "restaurant-history-row");
    row.dataset.id = order.id;
    const detail = node("div");
    const title = node("strong", undefined, order.tableNumber);
    detail.appendChild(title);
    detail.appendChild(
      node(
        "span",
        "hint",
        `${order.paidAt ? dateText(order.paidAt) : dateText(order.openedAt)} · ${order.items.length} ${t("restaurantPositions")} · ${order.receiptNumber ?? "—"}`,
      ),
    );
    detail.appendChild(
      node(
        "span",
        "hint",
        `${t("restaurantPaymentMethod")}: ${paymentLabel(order.paymentMethod ?? "cash")}${order.tip > 0 ? ` · ${t("restaurantTip")}: ${moneyText(order.tip)}` : ""}`,
      ),
    );
    row.appendChild(detail);
    const side = node("div", "restaurant-history-side");
    side.appendChild(node("strong", undefined, moneyText(order.totalWithTip)));
    side.appendChild(button(t("restaurantViewReceipt"), "secondary", () => showReceipt(order)));
    side.appendChild(
      button(t("restaurantDeleteReceipt"), "danger", () => void removeOrder(order.id)),
    );
    row.appendChild(side);
    list.appendChild(row);
  }
  if (paid.length === 0) {
    list.appendChild(node("p", "empty", t("restaurantHistoryEmpty")));
  }
}

function paymentLabel(method: string): string {
  switch (method) {
    case "card":
      return t("restaurantCard");
    case "nfc":
      return t("restaurantNfc");
    default:
      return t("restaurantCash");
  }
}

async function addDish(dish: MenuItemView): Promise<void> {
  sounds.playClick();
  try {
    const result = await invoke<RestaurantOrderMutationView>("add_restaurant_item", {
      tableNumber: selectedTable,
      menuItemId: dish.id,
    });
    await loadRestaurant();
    setMessage(
      `${dish.name} · ${selectedTable}${result.created ? ` · ${t("restaurantOrderSaved")}` : ""}`,
    );
  } catch (error) {
    setMessage(String(error));
  }
}

async function changeQty(orderId: string, itemId: string, qty: number): Promise<void> {
  sounds.playClick();
  try {
    await invoke<RestaurantOrderMutationView>("set_restaurant_order_item_qty", {
      orderId,
      itemId,
      qty,
    });
    await loadRestaurant();
  } catch (error) {
    setMessage(String(error));
  }
}

async function saveNotes(orderId: string, itemId: string, notes: string): Promise<void> {
  try {
    await invoke("set_restaurant_order_item_notes", { orderId, itemId, notes });
    await loadRestaurant();
  } catch (error) {
    setMessage(String(error));
  }
}

async function saveServer(orderId: string, serverName: string): Promise<void> {
  try {
    await invoke("set_restaurant_order_server", { orderId, serverName });
    await loadRestaurant();
  } catch (error) {
    setMessage(String(error));
  }
}

async function setStatus(orderId: string, status: string): Promise<void> {
  sounds.playNotification();
  try {
    await invoke("set_restaurant_order_status", { orderId, status });
    await loadRestaurant();
  } catch (error) {
    setMessage(String(error));
  }
}

async function removeOrder(orderId: string, ask = true): Promise<void> {
  if (ask && !(await confirmDialog(t("restaurantDeleteReceiptConfirm"), "SOCDOF"))) {
    return;
  }
  try {
    await invoke("delete_restaurant_order", { id: orderId });
    await loadRestaurant();
    setMessage(t("restaurantOrderDeleted"));
  } catch (error) {
    setMessage(String(error));
  }
}

async function cancelOrder(): Promise<void> {
  const order = activeOrder(selectedTable);
  if (!order || !(await confirmDialog(`${t("restaurantCancelOrder")} ${selectedTable}?`, "SOCDOF"))) {
    return;
  }
  await removeOrder(order.id, false);
}

async function toggleDish(dish: MenuItemView): Promise<void> {
  await saveDishInput({
    id: dish.id,
    name: dish.name,
    category: dish.category,
    price: dish.price,
    taxRate: dish.taxRate,
    ingredients: dish.ingredients,
    allergens: dish.allergens,
    emoji: dish.emoji,
    prepTimeMinutes: dish.prepTimeMinutes,
    isAvailable: !dish.isAvailable,
  });
}

async function removeDish(dish: MenuItemView): Promise<void> {
  if (!(await confirmDialog(`${t("restaurantDeleteDish")} ${dish.name}?`, "SOCDOF"))) {
    return;
  }
  try {
    await invoke("delete_restaurant_menu_item", { id: dish.id });
    await loadRestaurant();
    setMessage(t("restaurantDishDeleted"));
  } catch (error) {
    setMessage(String(error));
  }
}

function openDishDialog(dish?: MenuItemView): void {
  const dialog = element<HTMLDialogElement>("restaurant-dish-dialog");
  element("restaurant-dish-title").textContent = dish
    ? t("restaurantEditDishTitle")
    : t("restaurantDishDialogNew");
  element<HTMLInputElement>("restaurant-dish-id").value = dish?.id ?? "";
  element<HTMLInputElement>("restaurant-dish-name").value = dish?.name ?? "";
  element<HTMLSelectElement>("restaurant-dish-category").value = dish?.category ?? "mains";
  element<HTMLInputElement>("restaurant-dish-price").value = String(dish?.price ?? 12.5);
  element<HTMLSelectElement>("restaurant-dish-tax").value = String(dish?.taxRate ?? 7);
  element<HTMLTextAreaElement>("restaurant-dish-ingredients").value = dish?.ingredients ?? "";
  element<HTMLInputElement>("restaurant-dish-allergens").value = dish?.allergens.join(", ") ?? "";
  element<HTMLInputElement>("restaurant-dish-emoji").value = dish?.emoji ?? "🍽️";
  element<HTMLInputElement>("restaurant-dish-prep").value = String(dish?.prepTimeMinutes ?? 15);
  element<HTMLInputElement>("restaurant-dish-available").checked = dish?.isAvailable ?? true;
  element("restaurant-dish-message").textContent = "";
  if (!dialog.open) {
    dialog.showModal();
  }
}

async function saveDishInput(input: Record<string, unknown>): Promise<void> {
  try {
    await invoke("save_restaurant_menu_item", { input });
    sounds.playSuccess();
    await loadRestaurant();
    setMessage(t("restaurantDishSaved"));
  } catch (error) {
    setMessage(String(error));
  }
}

async function saveDish(): Promise<void> {
  const message = element("restaurant-dish-message");
  const id = element<HTMLInputElement>("restaurant-dish-id").value || null;
  const input = {
    id,
    name: element<HTMLInputElement>("restaurant-dish-name").value,
    category: element<HTMLSelectElement>("restaurant-dish-category").value,
    price: Number(element<HTMLInputElement>("restaurant-dish-price").value) || 0,
    taxRate: Number(element<HTMLSelectElement>("restaurant-dish-tax").value) || 7,
    ingredients: element<HTMLTextAreaElement>("restaurant-dish-ingredients").value,
    allergens: element<HTMLInputElement>("restaurant-dish-allergens")
      .value.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    emoji: element<HTMLInputElement>("restaurant-dish-emoji").value,
    prepTimeMinutes: Number(element<HTMLInputElement>("restaurant-dish-prep").value) || 0,
    isAvailable: element<HTMLInputElement>("restaurant-dish-available").checked,
  };
  try {
    await invoke("save_restaurant_menu_item", { input });
    element<HTMLDialogElement>("restaurant-dish-dialog").close();
    await loadRestaurant();
    setMessage(t("restaurantDishSaved"));
  } catch (error) {
    message.textContent = String(error);
  }
}

function openBilling(order: TableOrderView): void {
  sounds.playClick();
  billingOrder = order;
  element<HTMLInputElement>("restaurant-billing-order").value = order.id;
  element<HTMLSelectElement>("restaurant-billing-method").value = "cash";
  element<HTMLInputElement>("restaurant-billing-tip").value = "0";
  element<HTMLInputElement>("restaurant-billing-cash").value = order.total.toFixed(2);
  element<HTMLInputElement>("restaurant-billing-split").value = "1";
  element<HTMLInputElement>("restaurant-billing-hospitality").checked = false;
  element<HTMLInputElement>("restaurant-billing-host").value = "";
  element<HTMLInputElement>("restaurant-billing-occasion").value = "";
  element<HTMLInputElement>("restaurant-billing-guests").value = "";
  element("restaurant-billing-message").textContent = "";
  updateBilling();
  const dialog = element<HTMLDialogElement>("restaurant-billing-dialog");
  if (!dialog.open) {
    dialog.showModal();
  }
}

function updateBilling(): void {
  if (!billingOrder) {
    return;
  }
  const tip = Number(element<HTMLInputElement>("restaurant-billing-tip").value) || 0;
  const split = Math.max(1, Number(element<HTMLInputElement>("restaurant-billing-split").value) || 1);
  const total = billingOrder.total + tip;
  const method = element<HTMLSelectElement>("restaurant-billing-method").value;
  const cash = Number(element<HTMLInputElement>("restaurant-billing-cash").value) || 0;
  element("restaurant-billing-total").textContent = moneyText(total);
  element("restaurant-billing-split-info").textContent =
    split > 1 ? `${split} × ${moneyText(total / split)}` : "";
  element("restaurant-billing-change").textContent = moneyText(
    method === "cash" ? Math.max(0, cash - total) : 0,
  );
  element<HTMLElement>("restaurant-billing-cash-row").hidden = method !== "cash";
  element<HTMLElement>("restaurant-billing-hospitality-fields").hidden =
    !element<HTMLInputElement>("restaurant-billing-hospitality").checked;
}

async function finalizeBilling(): Promise<void> {
  if (!billingOrder) {
    return;
  }
  const message = element("restaurant-billing-message");
  const method = element<HTMLSelectElement>("restaurant-billing-method").value;
  const tip = Number(element<HTMLInputElement>("restaurant-billing-tip").value) || 0;
  const split = Math.max(1, Number(element<HTMLInputElement>("restaurant-billing-split").value) || 1);
  const cash = Number(element<HTMLInputElement>("restaurant-billing-cash").value) || 0;
  try {
    const result = await invoke<RestaurantCheckoutView>("restaurant_checkout", {
      input: {
        orderId: billingOrder.id,
        paymentMethod: method,
        tip,
        cashGiven: method === "cash" ? cash : null,
        splitCount: split,
        isHospitalityReceipt:
          element<HTMLInputElement>("restaurant-billing-hospitality").checked,
        hospitalityHost: element<HTMLInputElement>("restaurant-billing-host").value,
        hospitalityOccasion: element<HTMLInputElement>("restaurant-billing-occasion").value,
        hospitalityGuests: element<HTMLInputElement>("restaurant-billing-guests").value,
      },
    });
    element<HTMLDialogElement>("restaurant-billing-dialog").close();
    billingOrder = null;
    sounds.playKaching();
    await loadRestaurant();
    showReceipt(result.order, result.invoiceNumber, result.change);
    setMessage(`${t("restaurantCheckoutSaved")} ${result.invoiceNumber}`);
  } catch (error) {
    message.textContent = String(error);
  }
}

function renderReceiptLines(parent: HTMLElement, order: TableOrderView): void {
  for (const item of order.items) {
    const row = node("div", "restaurant-receipt-line");
    row.appendChild(node("span", undefined, `${item.qty}× ${item.name}`));
    row.appendChild(node("span", undefined, moneyText(item.price * item.qty)));
    parent.appendChild(row);
  }
}

function showReceipt(order: TableOrderView, invoiceNumber?: string, change?: number): void {
  const content = element<HTMLDivElement>("restaurant-receipt-content");
  content.replaceChildren();
  const head = node("div", "restaurant-receipt-head");
  const company = state?.company;
  head.appendChild(node("strong", undefined, company?.name || "SOCDOF Gastronomie"));
  if (company) {
    if (company.street) {
      head.appendChild(node("span", "hint", company.street));
    }
    if (company.zipCity) {
      head.appendChild(node("span", "hint", company.zipCity));
    }
    if (company.taxId) {
      head.appendChild(node("span", "hint", `${t("restaurantTaxId")}: ${company.taxId}`));
    }
  }
  head.appendChild(node("span", undefined, t("restaurantReceiptTitle")));
  head.appendChild(
    node("span", "hint", `${t("restaurantReceiptNumber")}: ${invoiceNumber ?? order.receiptNumber ?? "—"}`),
  );
  content.appendChild(head);

  const meta = node("div", "restaurant-receipt-meta");
  meta.appendChild(node("span", undefined, order.tableNumber));
  meta.appendChild(node("span", undefined, dateText(order.paidAt ?? order.openedAt)));
  content.appendChild(meta);

  const lines = node("div", "restaurant-receipt-items");
  renderReceiptLines(lines, order);
  content.appendChild(lines);

  const totals = node("div", "restaurant-receipt-totals");
  const add = (label: string, value: string, strong = false) => {
    const row = node("div", strong ? "restaurant-receipt-total-line strong" : undefined);
    row.appendChild(node("span", undefined, label));
    row.appendChild(node("span", undefined, value));
    totals.appendChild(row);
  };
  add(t("restaurantNet"), moneyText(order.subtotal));
  add(t("restaurantTax"), moneyText(order.taxTotal));
  add(t("restaurantTotal"), moneyText(order.total), true);
  if (order.tip > 0) {
    add(t("restaurantTip"), moneyText(order.tip));
    add(t("restaurantTotalWithTip"), moneyText(order.totalWithTip), true);
  }
  add(t("restaurantPaymentMethod"), paymentLabel(order.paymentMethod ?? "cash"));
  if (change !== undefined) {
    add(t("restaurantChange"), moneyText(change));
  }
  if (order.cashTendered !== null) {
    add(t("restaurantCashGiven"), moneyText(order.cashTendered));
  }
  content.appendChild(totals);

  if (order.isHospitalityReceipt) {
    const hospitality = node("div", "restaurant-receipt-hospitality");
    const companyName = state?.company.name || "SOCDOF Gastronomie";
    hospitality.appendChild(node("strong", undefined, t("restaurantHospitalitySection")));
    hospitality.appendChild(
      node("span", undefined, `${t("restaurantHost")}: ${order.hospitalityHost || companyName}`),
    );
    hospitality.appendChild(
      node(
        "span",
        undefined,
        `${t("restaurantOccasion")}: ${order.hospitalityOccasion || t("restaurantBusinessMeeting")}`,
      ),
    );
    hospitality.appendChild(
      node(
        "span",
        undefined,
        `${t("restaurantGuests")}: ${order.hospitalityGuests || t("restaurantGuestsDefault")}`,
      ),
    );
    hospitality.appendChild(node("span", undefined, t("restaurantSignature")));
    content.appendChild(hospitality);
  }

  content.appendChild(node("p", "restaurant-receipt-thanks", t("restaurantThanks")));
  if (order.invoiceId) {
    const invoice = node("button", "secondary", t("restaurantViewInvoice")) as HTMLButtonElement;
    invoice.type = "button";
    invoice.addEventListener("click", () => {
      const id = order.invoiceId;
      element<HTMLDialogElement>("restaurant-receipt-dialog").close();
      if (id) {
        window.dispatchEvent(new CustomEvent("socdof:open-invoice", { detail: id }));
      }
    });
    content.appendChild(invoice);
  }
  const dialog = element<HTMLDialogElement>("restaurant-receipt-dialog");
  if (!dialog.open) {
    dialog.showModal();
  }
}

function showZReport(): void {
  if (!state) {
    return;
  }
  const metrics = state.metrics;
  const content = element<HTMLDivElement>("restaurant-z-content");
  content.replaceChildren();
  const add = (label: string, value: string, strong = false) => {
    const row = node("div", strong ? "restaurant-receipt-total-line strong" : "restaurant-z-line");
    row.appendChild(node("span", undefined, label));
    row.appendChild(node("span", undefined, value));
    content.appendChild(row);
  };
  add(t("restaurantZCount"), String(metrics.todayOrders));
  add(t("restaurantZCash"), moneyText(metrics.cashSales));
  add(t("restaurantZCard"), moneyText(metrics.cardSales));
  add(t("restaurantZTax"), moneyText(metrics.taxTotal));
  add(t("restaurantZTotal"), moneyText(metrics.todayRevenue), true);
  const dialog = element<HTMLDialogElement>("restaurant-z-dialog");
  if (!dialog.open) {
    dialog.showModal();
  }
}

async function exportCsv(): Promise<void> {
  if (!state) {
    return;
  }
  try {
    const reply = await invoke<DialogReply>("pick_save_file", {
      suggestedName: state.csvFileName,
    });
    if (reply.outcome !== "chosen" || !reply.path) {
      setMessage(t("restaurantCsvCancelled"));
      return;
    }
    await invoke("export_restaurant_csv", { path: reply.path });
    setMessage(format(t("restaurantCsvSaved"), { path: reply.path }));
  } catch (error) {
    setMessage(String(error));
  }
}

function setTab(next: typeof tab): void {
  sounds.playClick();
  tab = next;
  renderTabs();
}

export function initRestaurant(): void {
  const view = element<HTMLElement>("view-restaurant");
  view.innerHTML = `
    <div class="section-head restaurant-head">
      <div>
        <p class="eyebrow" data-i18n="restaurantBadge"></p>
        <h2 data-i18n="restaurantTitle"></h2>
        <p class="subtitle" data-i18n="restaurantSubtitle"></p>
      </div>
      <div class="toolbar">
        <button id="restaurant-sound-toggle" type="button" class="secondary"></button>
        <button id="restaurant-open-z" type="button" class="secondary" data-i18n="restaurantZReport"></button>
        <button id="restaurant-open-dish" type="button" data-i18n="restaurantNewDish"></button>
        <button id="restaurant-export-csv" type="button" class="secondary" data-i18n="restaurantExportCsv"></button>
      </div>
    </div>
    <div class="grid restaurant-kpis">
      <section class="card"><h3 data-i18n="restaurantKpiOpen"></h3><p id="restaurant-kpi-open" class="fleet-kpi-value">–</p></section>
      <section class="card"><h3 data-i18n="restaurantKpiKitchen"></h3><p id="restaurant-kpi-kitchen" class="fleet-kpi-value">–</p></section>
      <section class="card"><h3 data-i18n="restaurantKpiRevenue"></h3><p id="restaurant-kpi-revenue" class="fleet-kpi-value">–</p></section>
      <section class="card"><h3 data-i18n="restaurantKpiMenu"></h3><p id="restaurant-kpi-menu" class="fleet-kpi-value">–</p></section>
    </div>
    <div class="toolbar restaurant-tabs">
      <button id="restaurant-tab-tables" type="button" data-i18n="restaurantTabTables"></button>
      <button id="restaurant-tab-kitchen" type="button" class="secondary" data-i18n="restaurantTabKitchen"></button>
      <button id="restaurant-tab-menu" type="button" class="secondary" data-i18n="restaurantTabMenu"></button>
      <button id="restaurant-tab-history" type="button" class="secondary" data-i18n="restaurantTabHistory"></button>
    </div>
    <p id="restaurant-message" class="message" role="status"></p>

    <section id="restaurant-pane-tables" class="restaurant-tables-pane">
      <div class="restaurant-layout">
        <div class="restaurant-main-column">
          <div class="toolbar restaurant-area-filter">
            <button type="button" data-restaurant-area="all" data-i18n="restaurantAreaAll"></button>
            <button type="button" data-restaurant-area="indoor" class="secondary" data-i18n="restaurantAreaIndoor"></button>
            <button type="button" data-restaurant-area="terrace" class="secondary" data-i18n="restaurantAreaTerrace"></button>
            <button type="button" data-restaurant-area="bar" class="secondary" data-i18n="restaurantAreaBar"></button>
            <button type="button" data-restaurant-area="togo" class="secondary" data-i18n="restaurantAreaTogo"></button>
          </div>
          <div id="restaurant-table-grid" class="restaurant-table-grid"></div>
          <section class="card restaurant-picker">
            <div class="toolbar">
              <h3 id="restaurant-picker-title" data-i18n="restaurantQuickPick"></h3>
              <input id="restaurant-menu-search" type="search" data-i18n-placeholder="restaurantSearchDish">
              <select id="restaurant-menu-category">
                <option value="all" data-i18n="restaurantAll"></option>
                <option value="starters" data-i18n="restaurantCategoryStarters"></option>
                <option value="pizza" data-i18n="restaurantCategoryPizza"></option>
                <option value="mains" data-i18n="restaurantCategoryMains"></option>
                <option value="burgers" data-i18n="restaurantCategoryBurgers"></option>
                <option value="desserts" data-i18n="restaurantCategoryDesserts"></option>
                <option value="drinks" data-i18n="restaurantCategoryDrinks"></option>
              </select>
            </div>
            <div id="restaurant-dish-picker" class="restaurant-picker-grid"></div>
          </section>
        </div>
        <aside class="card restaurant-order">
          <div class="restaurant-order-head">
            <div>
              <h3 id="restaurant-order-title"></h3>
              <p id="restaurant-order-status" class="hint"></p>
            </div>
            <button id="restaurant-cancel-order" type="button" class="danger" data-i18n="restaurantCancelOrder"></button>
          </div>
          <label class="field field-inline"><span data-i18n="restaurantServer"></span><input id="restaurant-server" type="text"></label>
          <div id="restaurant-order-lines" class="restaurant-order-lines"></div>
          <div class="restaurant-totals">
            <div><span data-i18n="restaurantNet"></span><span id="restaurant-order-subtotal">0,00 €</span></div>
            <div><span data-i18n="restaurantTax"></span><span id="restaurant-order-tax">0,00 €</span></div>
            <div class="strong"><span data-i18n="restaurantTotal"></span><span id="restaurant-order-total">0,00 €</span></div>
          </div>
          <div class="restaurant-order-actions">
            <button id="restaurant-send-kitchen" type="button" class="secondary" data-i18n="restaurantSendKitchen"></button>
            <button id="restaurant-bill" type="button" data-i18n="restaurantBill"></button>
          </div>
        </aside>
      </div>
    </section>

    <section id="restaurant-pane-kitchen" hidden>
      <div class="section-head"><div><h3 data-i18n="restaurantKdsTitle"></h3><p class="subtitle" data-i18n="restaurantKdsHint"></p></div></div>
      <div id="restaurant-kitchen-grid" class="restaurant-kds-grid"></div>
    </section>

    <section id="restaurant-pane-menu" hidden>
      <section class="card">
        <div class="toolbar">
          <h3 data-i18n="restaurantCatalogTitle"></h3>
          <input id="restaurant-catalog-search" type="search" data-i18n-placeholder="restaurantSearchDish">
          <select id="restaurant-catalog-category">
            <option value="all" data-i18n="restaurantAll"></option>
            <option value="starters" data-i18n="restaurantCategoryStarters"></option>
            <option value="pizza" data-i18n="restaurantCategoryPizza"></option>
            <option value="mains" data-i18n="restaurantCategoryMains"></option>
            <option value="burgers" data-i18n="restaurantCategoryBurgers"></option>
            <option value="desserts" data-i18n="restaurantCategoryDesserts"></option>
            <option value="drinks" data-i18n="restaurantCategoryDrinks"></option>
          </select>
          <button id="restaurant-catalog-add" type="button" data-i18n="restaurantDishAdd"></button>
        </div>
        <p class="hint" data-i18n="restaurantCatalogHint"></p>
        <div id="restaurant-catalog-list" class="restaurant-catalog"></div>
      </section>
    </section>

    <section id="restaurant-pane-history" hidden>
      <section class="card">
        <div class="toolbar">
          <div><h3 data-i18n="restaurantHistoryTitle"></h3><p class="hint" data-i18n="restaurantHistoryHint"></p></div>
          <button id="restaurant-history-z" type="button" class="secondary" data-i18n="restaurantZReport"></button>
          <button id="restaurant-history-export" type="button" data-i18n="restaurantExportCsv"></button>
        </div>
        <div id="restaurant-history-list" class="restaurant-history"></div>
      </section>
    </section>
  `;

  element("restaurant-dish-dialog").innerHTML = `
    <form id="restaurant-dish-form">
      <div class="editor-head">
        <h2 id="restaurant-dish-title"></h2>
        <button id="restaurant-dish-close" class="icon-button" type="button" aria-label="Close">×</button>
      </div>
      <p id="restaurant-dish-message" class="message" role="status"></p>
      <input id="restaurant-dish-id" type="hidden">
      <div class="editor-grid">
        <label class="field"><span data-i18n="restaurantDishName"></span><input id="restaurant-dish-name" required></label>
        <label class="field"><span data-i18n="restaurantDishCategory"></span>
          <select id="restaurant-dish-category">
            <option value="starters" data-i18n="restaurantCategoryStarters"></option>
            <option value="pizza" data-i18n="restaurantCategoryPizza"></option>
            <option value="mains" data-i18n="restaurantCategoryMains"></option>
            <option value="burgers" data-i18n="restaurantCategoryBurgers"></option>
            <option value="desserts" data-i18n="restaurantCategoryDesserts"></option>
            <option value="drinks" data-i18n="restaurantCategoryDrinks"></option>
          </select>
        </label>
      </div>
      <div class="editor-grid">
        <label class="field"><span data-i18n="restaurantDishPrice"></span><input id="restaurant-dish-price" type="number" min="0" step="0.10" required></label>
        <label class="field"><span data-i18n="restaurantDishTax"></span>
          <select id="restaurant-dish-tax"><option value="7">7%</option><option value="19">19%</option></select>
        </label>
        <label class="field"><span data-i18n="restaurantDishPrep"></span><input id="restaurant-dish-prep" type="number" min="0" step="1"></label>
      </div>
      <label class="field"><span data-i18n="restaurantDishIngredients"></span><textarea id="restaurant-dish-ingredients" rows="3"></textarea></label>
      <div class="editor-grid">
        <label class="field"><span data-i18n="restaurantDishAllergens"></span><input id="restaurant-dish-allergens"></label>
        <label class="field"><span data-i18n="restaurantDishEmoji"></span><input id="restaurant-dish-emoji" maxlength="8"></label>
      </div>
      <p class="hint" data-i18n="restaurantDishAllergensHint"></p>
      <label class="checkbox"><input id="restaurant-dish-available" type="checkbox"><span data-i18n="restaurantDishAvailable"></span></label>
      <div class="editor-actions">
        <button id="restaurant-dish-cancel" class="secondary" type="button" data-i18n="cancel"></button>
        <button type="submit" data-i18n="restaurantDishSave"></button>
      </div>
    </form>
  `;

  element("restaurant-billing-dialog").innerHTML = `
    <form id="restaurant-billing-form">
      <div class="editor-head">
        <h2 id="restaurant-billing-title" data-i18n="restaurantBillingTitle"></h2>
        <button id="restaurant-billing-close" class="icon-button" type="button" aria-label="Close">×</button>
      </div>
      <p id="restaurant-billing-message" class="message" role="status"></p>
      <input id="restaurant-billing-order" type="hidden">
      <div class="restaurant-billing-total">
        <span data-i18n="restaurantBillingGross"></span>
        <strong id="restaurant-billing-total">0,00 €</strong>
        <span id="restaurant-billing-split-info" class="hint"></span>
      </div>
      <div class="editor-grid">
        <label class="field"><span data-i18n="restaurantPaymentMethod"></span>
          <select id="restaurant-billing-method">
            <option value="cash" data-i18n="restaurantCash"></option>
            <option value="card" data-i18n="restaurantCard"></option>
            <option value="nfc" data-i18n="restaurantNfc"></option>
          </select>
        </label>
        <label class="field"><span data-i18n="restaurantTip"></span><input id="restaurant-billing-tip" type="number" min="0" step="0.01"></label>
        <label class="field"><span data-i18n="restaurantSplit"></span><input id="restaurant-billing-split" type="number" min="1" step="1"></label>
      </div>
      <div class="toolbar restaurant-tip-presets">
        <button type="button" class="secondary" data-tip="0" data-i18n="restaurantNoTip"></button>
        <button type="button" class="secondary" data-tip="2">+2 €</button>
        <button type="button" class="secondary" data-tip="5">+5 €</button>
        <button type="button" class="secondary" data-tip="10">+10 €</button>
      </div>
      <div id="restaurant-billing-cash-row">
        <div class="editor-grid">
          <label class="field"><span data-i18n="restaurantCashGiven"></span><input id="restaurant-billing-cash" type="number" min="0" step="0.50"></label>
          <div class="field"><span data-i18n="restaurantChange"></span><strong id="restaurant-billing-change">0,00 €</strong></div>
        </div>
        <div class="toolbar restaurant-tip-presets">
          <button type="button" class="secondary" data-cash="exact" data-i18n="restaurantExact"></button>
          <button type="button" class="secondary" data-cash="20">20 €</button>
          <button type="button" class="secondary" data-cash="50">50 €</button>
          <button type="button" class="secondary" data-cash="100">100 €</button>
        </div>
      </div>
      <label class="checkbox"><input id="restaurant-billing-hospitality" type="checkbox"><span data-i18n="restaurantHospitality"></span></label>
      <div id="restaurant-billing-hospitality-fields" hidden>
        <label class="field"><span data-i18n="restaurantHost"></span><input id="restaurant-billing-host"></label>
        <label class="field"><span data-i18n="restaurantOccasion"></span><input id="restaurant-billing-occasion"></label>
        <label class="field"><span data-i18n="restaurantGuests"></span><input id="restaurant-billing-guests"></label>
      </div>
      <div class="editor-actions">
        <button id="restaurant-billing-cancel" class="secondary" type="button" data-i18n="cancel"></button>
        <button type="submit" data-i18n="restaurantFinalize"></button>
      </div>
    </form>
  `;

  element("restaurant-receipt-dialog").innerHTML = `
    <div class="editor-head">
      <h2 data-i18n="restaurantReceiptTitle"></h2>
      <button id="restaurant-receipt-close" class="icon-button" type="button" aria-label="Close">×</button>
    </div>
    <div id="restaurant-receipt-content"></div>
    <div class="editor-actions">
      <button id="restaurant-receipt-print" class="secondary" type="button" data-i18n="restaurantPrint"></button>
      <button id="restaurant-receipt-done" type="button" data-i18n="close"></button>
    </div>
  `;

  element("restaurant-z-dialog").innerHTML = `
    <div class="editor-head">
      <h2 data-i18n="restaurantZTitle"></h2>
      <button id="restaurant-z-close" class="icon-button" type="button" aria-label="Close">×</button>
    </div>
    <p class="hint" data-i18n="restaurantZHint"></p>
    <div id="restaurant-z-content" class="restaurant-z-content"></div>
    <div class="editor-actions">
      <button id="restaurant-z-print" class="secondary" type="button" data-i18n="restaurantZPrint"></button>
      <button id="restaurant-z-done" type="button" data-i18n="close"></button>
    </div>
  `;

  applyTranslations(language);
  for (const placeholder of document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]")) {
    const key = placeholder.dataset.i18nPlaceholder as TranslationKey | undefined;
    if (key) {
      placeholder.setAttribute("placeholder", translate(language, key));
    }
  }

  const syncSoundButton = () => {
    element("restaurant-sound-toggle").textContent = sounds.isMuted()
      ? t("restaurantSoundOn")
      : t("restaurantSoundOff");
  };
  syncSoundButton();
  element("restaurant-sound-toggle").addEventListener("click", () => {
    sounds.toggleMute();
    syncSoundButton();
  });
  element("restaurant-tab-tables").addEventListener("click", () => setTab("tables"));
  element("restaurant-tab-kitchen").addEventListener("click", () => setTab("kitchen"));
  element("restaurant-tab-menu").addEventListener("click", () => setTab("menu"));
  element("restaurant-tab-history").addEventListener("click", () => setTab("history"));
  element("restaurant-open-z").addEventListener("click", () => {
    sounds.playClick();
    showZReport();
  });
  element("restaurant-open-dish").addEventListener("click", () => {
    sounds.playClick();
    openDishDialog();
  });
  element("restaurant-catalog-add").addEventListener("click", () => {
    sounds.playClick();
    openDishDialog();
  });
  element("restaurant-export-csv").addEventListener("click", () => void exportCsv());
  element("restaurant-history-export").addEventListener("click", () => void exportCsv());
  element("restaurant-history-z").addEventListener("click", () => {
    sounds.playClick();
    showZReport();
  });
  element("restaurant-send-kitchen").addEventListener("click", () => {
    const order = activeOrder(selectedTable);
    if (order) {
      void setStatus(order.id, "preparing");
    }
  });
  element("restaurant-bill").addEventListener("click", () => {
    sounds.playClick();
    const order = activeOrder(selectedTable);
    if (order) {
      openBilling(order);
    }
  });
  element("restaurant-cancel-order").addEventListener("click", () => void cancelOrder());
  element<HTMLInputElement>("restaurant-server").addEventListener("change", () => {
    const order = activeOrder(selectedTable);
    if (order) {
      void saveServer(order.id, element<HTMLInputElement>("restaurant-server").value);
    }
  });
  element<HTMLInputElement>("restaurant-menu-search").addEventListener("input", () => {
    search = element<HTMLInputElement>("restaurant-menu-search").value;
    renderTables();
  });
  element<HTMLSelectElement>("restaurant-menu-category").addEventListener("change", () => {
    category = element<HTMLSelectElement>("restaurant-menu-category").value;
    renderTables();
  });
  element<HTMLInputElement>("restaurant-catalog-search").addEventListener("input", () => {
    catalogSearch = element<HTMLInputElement>("restaurant-catalog-search").value;
    renderCatalog();
  });
  element<HTMLSelectElement>("restaurant-catalog-category").addEventListener("change", () => {
    catalogCategory = element<HTMLSelectElement>("restaurant-catalog-category").value;
    renderCatalog();
  });
  for (const areaButton of document.querySelectorAll<HTMLButtonElement>("[data-restaurant-area]")) {
    areaButton.addEventListener("click", () => {
      area = areaButton.dataset.restaurantArea ?? "all";
      for (const other of document.querySelectorAll<HTMLButtonElement>("[data-restaurant-area]")) {
        other.classList.toggle("is-active", other === areaButton);
        other.classList.toggle("secondary", other !== areaButton);
      }
      renderTables();
    });
  }
  element<HTMLFormElement>("restaurant-dish-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveDish();
  });
  element("restaurant-dish-close").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-dish-dialog").close();
  });
  element("restaurant-dish-cancel").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-dish-dialog").close();
  });
  element("restaurant-billing-close").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-billing-dialog").close();
    billingOrder = null;
  });
  element("restaurant-billing-cancel").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-billing-dialog").close();
    billingOrder = null;
  });
  element<HTMLFormElement>("restaurant-billing-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void finalizeBilling();
  });
  for (const id of [
    "restaurant-billing-method",
    "restaurant-billing-tip",
    "restaurant-billing-cash",
    "restaurant-billing-split",
    "restaurant-billing-hospitality",
  ]) {
    element(id).addEventListener("input", updateBilling);
    element(id).addEventListener("change", updateBilling);
  }
  for (const tipButton of document.querySelectorAll<HTMLButtonElement>("[data-tip]")) {
    tipButton.addEventListener("click", () => {
      element<HTMLInputElement>("restaurant-billing-tip").value = tipButton.dataset.tip ?? "0";
      updateBilling();
    });
  }
  for (const cashButton of document.querySelectorAll<HTMLButtonElement>("[data-cash]")) {
    cashButton.addEventListener("click", () => {
      const value = cashButton.dataset.cash;
      if (value === "exact") {
        const tip = Number(element<HTMLInputElement>("restaurant-billing-tip").value) || 0;
        element<HTMLInputElement>("restaurant-billing-cash").value = (
          (billingOrder?.total ?? 0) + tip
        ).toFixed(2);
      } else {
        element<HTMLInputElement>("restaurant-billing-cash").value = value ?? "0";
      }
      updateBilling();
    });
  }
  element("restaurant-receipt-close").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-receipt-dialog").close();
  });
  element("restaurant-receipt-done").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-receipt-dialog").close();
  });
  element("restaurant-receipt-print").addEventListener("click", () => window.print());
  element("restaurant-z-close").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-z-dialog").close();
  });
  element("restaurant-z-done").addEventListener("click", () => {
    element<HTMLDialogElement>("restaurant-z-dialog").close();
  });
  element("restaurant-z-print").addEventListener("click", () => window.print());
}

export { loadRestaurant };
