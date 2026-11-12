import { invoke } from "@tauri-apps/api/core";

interface Dish {
  id: string;
  name: string;
  price: number;
}

interface Order {
  id: string;
  tableNumber: string;
  status: string;
  items: { id: string; name: string; qty: number }[];
  total: number;
}

interface Overview {
  menu: Dish[];
  tables: { name: string; status: string; orderId: string | null }[];
  orders: Order[];
}

interface Mutation {
  order: Order | null;
  created: boolean;
}

interface Persistence {
  present: boolean;
  items: number;
  menu: number;
  status: string;
  receiptNumber: string | null;
}

interface Checkout {
  order: Order;
  invoiceId: string;
  invoiceNumber: string;
  totalWithTip: number;
  change: number;
}

/// Exercises dish CRUD, a table order, the kitchen status, checkout, CSV and deletion.
export async function runRestaurantSmoke(
  directory: string,
  showRestaurant: () => Promise<void>,
): Promise<void> {
  const restaurant = await invoke<Overview>("restaurant_overview");
  if (restaurant.menu.length < 11 || restaurant.tables.length !== 13) {
    throw new Error("restaurant overview is incomplete");
  }
  const table = restaurant.tables.find((entry) => !entry.orderId);
  if (!table) {
    throw new Error("restaurant has no free table for the smoke order");
  }
  const dish = await invoke<Dish>("save_restaurant_menu_item", {
    input: {
      id: null,
      name: "SMOKE-GUI Restaurantgericht",
      category: "mains",
      price: 12.5,
      taxRate: 7,
      ingredients: "GUI smoke restaurant dish",
      allergens: ["A (Gluten)"],
      emoji: "🍝",
      prepTimeMinutes: 10,
      isAvailable: true,
    },
  });
  const edited = await invoke<Dish>("save_restaurant_menu_item", {
    input: {
      id: dish.id,
      name: "SMOKE-GUI Restaurantgericht",
      category: "mains",
      price: 13,
      taxRate: 7,
      ingredients: "GUI smoke restaurant dish updated",
      allergens: ["G (Milch)"],
      emoji: "🍝",
      prepTimeMinutes: 9,
      isAvailable: true,
    },
  });
  if (edited.price !== 13) {
    throw new Error("restaurant dish edit did not persist the price");
  }
  const added = await invoke<Mutation>("add_restaurant_item", {
    tableNumber: table.name,
    menuItemId: dish.id,
  });
  const order = added.order;
  if (!added.created || !order) {
    throw new Error("restaurant smoke order was not created");
  }
  const item = order.items[0];
  const qty = await invoke<Mutation>("set_restaurant_order_item_qty", {
    orderId: order.id,
    itemId: item.id,
    qty: 2,
  });
  if (!qty.order || qty.order.items[0].qty !== 2) {
    throw new Error("restaurant quantity edit did not persist");
  }
  await invoke("set_restaurant_order_item_notes", {
    orderId: order.id,
    itemId: item.id,
    notes: "GUI smoke note",
  });
  await invoke("set_restaurant_order_server", {
    orderId: order.id,
    serverName: "GUI Smoke",
  });
  await invoke("set_restaurant_order_status", {
    orderId: order.id,
    status: "preparing",
  });
  const listed = await invoke<Overview>("restaurant_overview");
  const listedOrder = listed.orders.find((entry) => entry.id === order.id);
  if (!listedOrder || listedOrder.status !== "preparing") {
    throw new Error("restaurant list did not persist the kitchen status");
  }
  if (!listed.menu.some((entry) => entry.id === dish.id)) {
    throw new Error("restaurant list did not persist the edited dish");
  }
  await showRestaurant();
  if (!document.getElementById("restaurant-table-grid")?.textContent?.includes(table.name)) {
    throw new Error("restaurant screen did not render the table plan");
  }
  if (!document.getElementById("restaurant-dish-picker")?.textContent?.includes(dish.name)) {
    throw new Error("restaurant screen did not render the dish picker");
  }
  const before = await invoke<Persistence>("restaurant_persistence", { id: order.id });
  if (!before.present || before.status !== "preparing") {
    throw new Error("restaurant persistence check failed before checkout");
  }
  const checkout = await invoke<Checkout>("restaurant_checkout", {
    input: {
      orderId: order.id,
      paymentMethod: "cash",
      tip: 2,
      cashGiven: 40,
      splitCount: 2,
      isHospitalityReceipt: true,
      hospitalityHost: "SOCDOF GmbH",
      hospitalityOccasion: "GUI smoke",
      hospitalityGuests: "GUI Smoke",
    },
  });
  if (!checkout.invoiceNumber.startsWith("GASTRO/")) {
    throw new Error("restaurant checkout did not create the receipt number");
  }
  const after = await invoke<Persistence>("restaurant_persistence", { id: order.id });
  if (!after.present || after.status !== "paid") {
    throw new Error("restaurant persistence check failed after checkout");
  }
  await invoke("export_restaurant_csv", {
    path: `${directory}/smoke-restaurant.csv`,
  });
  await invoke("delete_invoice", { id: checkout.invoiceId });
  await invoke("delete_restaurant_order", { id: order.id });
  await invoke("delete_restaurant_menu_item", { id: dish.id });
  const empty = await invoke<Overview>("restaurant_overview");
  if (
    empty.orders.some((entry) => entry.id === order.id) ||
    empty.menu.some((entry) => entry.id === dish.id)
  ) {
    throw new Error("deleted restaurant rows are still listed");
  }
}
