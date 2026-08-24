import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  Plus, 
  Search, 
  ChefHat, 
  Clock, 
  Check, 
  Trash2, 
  Receipt, 
  Printer, 
  CreditCard, 
  DollarSign, 
  Coffee, 
  Pizza, 
  Layers, 
  Sparkles, 
  Tag, 
  SlidersHorizontal,
  Flame,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  ShoppingBag,
  BellRing
} from 'lucide-react';
import { MenuItem, TableOrder, TableOrderItem, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';

interface RestaurantModuleProps {
  company: CompanyProfile;
  onNavigateToInvoice?: (invoiceId?: number) => void;
}

const DEFAULT_MENU: MenuItem[] = [
  // Vorspeisen
  {
    id: 'm-1',
    name: 'Bruschetta Classico',
    category: 'starters',
    price: 7.50,
    taxRate: 7,
    ingredients: 'Geröstetes Ciabatta, Strauchtomaten, Basilikum, Knoblauch, natives Olivenöl',
    allergens: ['A (Gluten)'],
    emoji: '🥖',
    prepTimeMinutes: 8,
    isAvailable: true
  },
  {
    id: 'm-2',
    name: 'Carpaccio di Manzo',
    category: 'starters',
    price: 14.20,
    taxRate: 7,
    ingredients: 'Hauchdünnes Rinderfilet, Rucola, gehobelter Parmesan, Trüffel-Vinaigrette',
    allergens: ['G (Milch)'],
    emoji: '🥩',
    prepTimeMinutes: 10,
    isAvailable: true
  },
  // Pizzen
  {
    id: 'm-3',
    name: 'Pizza Margherita DOC',
    category: 'pizza',
    price: 10.50,
    taxRate: 7,
    ingredients: 'San Marzano Tomatensugo, Fior di Latte Mozzarella, frisches Basilikum',
    allergens: ['A (Gluten)', 'G (Milch)'],
    emoji: '🍕',
    prepTimeMinutes: 12,
    isAvailable: true
  },
  {
    id: 'm-4',
    name: 'Pizza Diavola Piccante',
    category: 'pizza',
    price: 13.80,
    taxRate: 7,
    ingredients: 'Scharfe kalabrische Salami, Peperoni, rote Zwiebeln, Mozzarella',
    allergens: ['A (Gluten)', 'G (Milch)'],
    emoji: '🍕',
    prepTimeMinutes: 12,
    isAvailable: true
  },
  {
    id: 'm-5',
    name: 'Pizza Quattro Formaggi & Tartufo',
    category: 'pizza',
    price: 15.50,
    taxRate: 7,
    ingredients: 'Mozzarella, Gorgonzola, Taleggio, Ricotta, schwarze Trüffelcreme',
    allergens: ['A (Gluten)', 'G (Milch)'],
    emoji: '🧀',
    prepTimeMinutes: 14,
    isAvailable: true
  },
  // Burger & Hauptgerichte
  {
    id: 'm-6',
    name: 'Dry-Aged Angus Burger Deluxe',
    category: 'burgers',
    price: 16.90,
    taxRate: 7,
    ingredients: '200g Black Angus Patty, Brioche Bun, Cheddar, Bacon-Jam, Trüffel-Mayo & Pommes',
    allergens: ['A (Gluten)', 'C (Ei)', 'G (Milch)'],
    emoji: '🍔',
    prepTimeMinutes: 15,
    isAvailable: true
  },
  {
    id: 'm-7',
    name: 'Tagliolini al Tartufo Fresco',
    category: 'mains',
    price: 18.50,
    taxRate: 7,
    ingredients: 'Frische Eierpasta im Parmesanlaib geschwenkt mit frischem Sommertrüffel',
    allergens: ['A (Gluten)', 'C (Ei)', 'G (Milch)'],
    emoji: '🍝',
    prepTimeMinutes: 12,
    isAvailable: true
  },
  // Desserts
  {
    id: 'm-8',
    name: 'Tiramisù Tradizionale',
    category: 'desserts',
    price: 6.80,
    taxRate: 7,
    ingredients: 'Löffelbiskuits, Espresso, Mascarponecreme, feinstes Kakaopulver',
    allergens: ['A (Gluten)', 'C (Ei)', 'G (Milch)'],
    emoji: '🍰',
    prepTimeMinutes: 5,
    isAvailable: true
  },
  // Getränke
  {
    id: 'm-9',
    name: 'San Pellegrino Mineralwasser (0.75l)',
    category: 'drinks',
    price: 6.20,
    taxRate: 19,
    ingredients: 'Natürliches Mineralwasser aus den italienischen Alpen',
    allergens: [],
    emoji: '💧',
    prepTimeMinutes: 2,
    isAvailable: true
  },
  {
    id: 'm-10',
    name: 'Aperol Spritz Veneziano (0.25l)',
    category: 'drinks',
    price: 7.90,
    taxRate: 19,
    ingredients: 'Aperol, Valdobbiadene Prosecco DOCG, Soda, frische Orangenscheibe',
    allergens: ['O (Sulfite)'],
    emoji: '🍹',
    prepTimeMinutes: 3,
    isAvailable: true
  },
  {
    id: 'm-11',
    name: 'Espresso Barista Arabica',
    category: 'drinks',
    price: 2.80,
    taxRate: 19,
    ingredients: '100% Arabica Siebträger-Espresso',
    allergens: [],
    emoji: '☕',
    prepTimeMinutes: 2,
    isAvailable: true
  }
];

const TABLES = [
  'Tisch 1 (Fenster)',
  'Tisch 2',
  'Tisch 3 (Ecke)',
  'Tisch 4',
  'Tisch 5 (Lounge)',
  'Tisch 6',
  'Tisch 7 (Terrasse)',
  'Tisch 8 (Terrasse)',
  'Bar Platz 1',
  'Bar Platz 2',
  'To-Go / Abholung'
];

export const RestaurantModule: React.FC<RestaurantModuleProps> = ({
  company
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'menu' | 'kitchen' | 'history'>('tables');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('odoo_gastro_menu');
    return saved ? JSON.parse(saved) : DEFAULT_MENU;
  });
  const [orders, setOrders] = useState<TableOrder[]>(() => {
    const saved = localStorage.getItem('odoo_gastro_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Selected table order state
  const [selectedTable, setSelectedTable] = useState<string>(TABLES[0]);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  
  // New Dish Modal state
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState<boolean>(false);
  const [newDish, setNewDish] = useState<Partial<MenuItem>>({
    name: '',
    category: 'mains',
    price: 12.50,
    taxRate: 7,
    ingredients: '',
    allergens: [],
    emoji: '🍽️',
    prepTimeMinutes: 15,
    isAvailable: true
  });

  // Bill payment modal state
  const [billOrder, setBillOrder] = useState<TableOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'nfc'>('cash');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [showReceiptPrint, setShowReceiptPrint] = useState<boolean>(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('odoo_gastro_menu', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('odoo_gastro_orders', JSON.stringify(orders));
  }, [orders]);

  // Current active order for selected table
  const activeOrder = orders.find(o => o.tableNumber === selectedTable && o.status !== 'paid');

  const handleAddItemToTable = (item: MenuItem) => {
    sounds.playClick();
    const existingOrderIndex = orders.findIndex(o => o.tableNumber === selectedTable && o.status !== 'paid');
    
    if (existingOrderIndex >= 0) {
      // Update existing order
      const order = { ...orders[existingOrderIndex] };
      const itemIndex = order.items.findIndex(i => i.menuItemId === item.id);
      
      if (itemIndex >= 0) {
        order.items[itemIndex].qty += 1;
      } else {
        order.items.push({
          menuItemId: item.id,
          name: item.name,
          qty: 1,
          price: item.price,
          taxRate: item.taxRate
        });
      }

      // Recalculate totals
      const subtotal = order.items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
      const taxTotal = order.items.reduce((acc, curr) => {
        const itemGross = curr.price * curr.qty;
        const taxRate = curr.taxRate;
        const tax = itemGross - (itemGross / (1 + taxRate / 100));
        return acc + tax;
      }, 0);

      order.subtotal = subtotal - taxTotal;
      order.taxTotal = taxTotal;
      order.total = subtotal;

      const updated = [...orders];
      updated[existingOrderIndex] = order;
      setOrders(updated);
    } else {
      // Create new order
      const itemGross = item.price;
      const taxRate = item.taxRate;
      const tax = itemGross - (itemGross / (1 + taxRate / 100));
      
      const newOrder: TableOrder = {
        id: 'ord-' + Date.now(),
        tableNumber: selectedTable,
        serverName: 'Kellner 1 (Service)',
        status: 'ordered',
        items: [{
          menuItemId: item.id,
          name: item.name,
          qty: 1,
          price: item.price,
          taxRate: item.taxRate
        }],
        subtotal: itemGross - tax,
        taxTotal: tax,
        total: itemGross,
        createdAt: new Date().toISOString()
      };

      setOrders(prev => [newOrder, ...prev]);
    }
  };

  const handleUpdateItemQty = (menuItemId: string, delta: number) => {
    sounds.playClick();
    if (!activeOrder) return;

    const orderIndex = orders.findIndex(o => o.id === activeOrder.id);
    if (orderIndex < 0) return;

    const order = { ...orders[orderIndex] };
    const itemIndex = order.items.findIndex(i => i.menuItemId === menuItemId);
    if (itemIndex < 0) return;

    order.items[itemIndex].qty += delta;

    if (order.items[itemIndex].qty <= 0) {
      order.items.splice(itemIndex, 1);
    }

    if (order.items.length === 0) {
      // Remove empty order
      setOrders(orders.filter(o => o.id !== order.id));
      return;
    }

    // Recalculate
    const gross = order.items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    const tax = order.items.reduce((acc, curr) => {
      const itemGross = curr.price * curr.qty;
      return acc + (itemGross - (itemGross / (1 + curr.taxRate / 100)));
    }, 0);

    order.subtotal = gross - tax;
    order.taxTotal = tax;
    order.total = gross;

    const updated = [...orders];
    updated[orderIndex] = order;
    setOrders(updated);
  };

  const handleSendToKitchen = () => {
    if (!activeOrder) return;
    sounds.playSuccess();
    
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrder.id) {
        return { ...o, status: 'preparing' };
      }
      return o;
    }));
  };

  const handleKitchenStatusChange = (orderId: string, newStatus: TableOrder['status']) => {
    sounds.playNotification();
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: newStatus };
      }
      return o;
    }));
  };

  const handleOpenBilling = (order: TableOrder) => {
    sounds.playClick();
    setBillOrder(order);
    setCashGiven(order.total.toFixed(2));
    setShowReceiptPrint(false);
  };

  const handleFinalizePayment = async () => {
    if (!billOrder) return;
    sounds.playSuccess();

    const finalizedOrder: TableOrder = {
      ...billOrder,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentMethod
    };

    setOrders(prev => prev.map(o => o.id === billOrder.id ? finalizedOrder : o));

    // Also record in Dexie pos_orders table for unified ERP accounting
    try {
      await db.pos_orders.add({
        receipt_number: `GASTRO-${billOrder.tableNumber}-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString(),
        items: billOrder.items.map(i => ({
          product_id: 9999,
          product_name: i.name,
          sku: 'GASTRO',
          qty: i.qty,
          price: i.price,
          tax_rate: i.taxRate,
          subtotal: i.price * i.qty
        })),
        subtotal: billOrder.subtotal,
        tax_total: billOrder.taxTotal,
        total: billOrder.total,
        payment_method: paymentMethod,
        customer_name: `${billOrder.tableNumber} Gast`
      });
    } catch (e) {
      console.warn('Gastro POS auto-sync notice:', e);
    }

    setShowReceiptPrint(true);
  };

  const handleAddNewDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDish.name || !newDish.price) return;
    sounds.playSuccess();

    const created: MenuItem = {
      id: 'm-' + Date.now(),
      name: newDish.name,
      category: (newDish.category as any) || 'mains',
      price: Number(newDish.price),
      taxRate: Number(newDish.taxRate || 7),
      ingredients: newDish.ingredients || '',
      allergens: typeof newDish.allergens === 'string' ? (newDish.allergens as string).split(',').map(s => s.trim()) : (newDish.allergens || []),
      emoji: newDish.emoji || '🍽️',
      prepTimeMinutes: Number(newDish.prepTimeMinutes || 10),
      isAvailable: true
    };

    setMenuItems(prev => [created, ...prev]);
    setIsAddDishModalOpen(false);
    setNewDish({
      name: '',
      category: 'mains',
      price: 12.50,
      taxRate: 7,
      ingredients: '',
      allergens: [],
      emoji: '🍽️',
      prepTimeMinutes: 15,
      isAvailable: true
    });
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                          (item.ingredients && item.ingredients.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesCat = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const changeDue = Math.max(0, (parseFloat(cashGiven) || 0) - (billOrder?.total || 0));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-gradient-to-r from-amber-800 via-orange-900 to-slate-900 rounded-2xl text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-amber-200 mb-2">
            <ChefHat className="w-3.5 h-3.5" />
            <span>Odoo Gastronomie & Speisekarte Suite</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <span>Restaurant, Speisekarte & Tischbestellungen</span>
          </h2>
          <p className="text-xs text-amber-100/80 mt-1 max-w-xl leading-relaxed">
            Verwalten Sie Ihre digitale Speisekarte, nehmen Sie blitzschnell Bestellungen für Tische auf, steuern Sie die Küchenzubereitung und drucken Sie GoBD-konforme Bewirtungsbelege.
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 bg-black/25 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-xs">
          <div>
            <div className="text-[10px] text-amber-300 font-bold uppercase">Offene Tische</div>
            <div className="text-lg font-extrabold text-white">
              {orders.filter(o => o.status !== 'paid').length}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <div className="text-[10px] text-emerald-300 font-bold uppercase">In Küche</div>
            <div className="text-lg font-extrabold text-emerald-400">
              {orders.filter(o => o.status === 'preparing').length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          {[
            { id: 'tables', label: 'Tische & Bestellannahme', icon: Utensils, count: orders.filter(o => o.status !== 'paid').length },
            { id: 'kitchen', label: 'Küchen- & Bar-Monitor (KDS)', icon: ChefHat, count: orders.filter(o => o.status === 'preparing' || o.status === 'ordered').length },
            { id: 'menu', label: 'Speisekarte & Gerichte', icon: Pizza, count: menuItems.length },
            { id: 'history', label: 'Belegarchiv & Abrechnungen', icon: Receipt, count: orders.filter(o => o.status === 'paid').length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as any); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  isActive 
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'menu' && (
          <button
            onClick={() => { sounds.playClick(); setIsAddDishModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Gericht anlegen</span>
          </button>
        )}
      </div>

      {/* TAB 1: Tische & Bestellannahme */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Tables grid & Menu selector */}
          <div className="lg:col-span-7 space-y-4">
            {/* Table selector pills */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tisch / Sitzplatz auswählen:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {TABLES.map(table => {
                  const tableOrder = orders.find(o => o.tableNumber === table && o.status !== 'paid');
                  const isSelected = selectedTable === table;
                  
                  return (
                    <button
                      key={table}
                      onClick={() => { sounds.playClick(); setSelectedTable(table); }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
                        isSelected 
                          ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20' 
                          : tableOrder 
                            ? 'border-orange-300 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/20 text-slate-800 dark:text-slate-200' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{table}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        {tableOrder ? (
                          <>
                            <span className="px-1.5 py-0.2 rounded-full font-extrabold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                              {tableOrder.status === 'preparing' ? 'Küche' : 'Offen'}
                            </span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                              {tableOrder.total.toFixed(2)} €
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">Frei</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menu items to add to selected table */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1">
                  {[
                    { id: 'all', label: 'Alle' },
                    { id: 'starters', label: 'Vorspeisen' },
                    { id: 'pizza', label: 'Pizza' },
                    { id: 'mains', label: 'Hauptgerichte' },
                    { id: 'burgers', label: 'Burger' },
                    { id: 'desserts', label: 'Desserts' },
                    { id: 'drinks', label: 'Getränke' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { sounds.playClick(); setMenuCategoryFilter(cat.id); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                        menuCategoryFilter === cat.id 
                          ? 'bg-amber-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Speisekarte filtern..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddItemToTable(item)}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-left transition flex items-start justify-between gap-2 group"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{item.emoji || '🍽️'}</span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {item.name}
                        </h4>
                      </div>
                      {item.ingredients && (
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {item.ingredients}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-[9px] text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        <span>~{item.prepTimeMinutes} Min.</span>
                        <span>• MwSt. {item.taxRate}%</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                        {item.price.toFixed(2)} €
                      </span>
                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                        + Buchen
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Current Table Order Receipt & Actions */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[500px]">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                      Aktuelle Tischbestellung
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <span>{selectedTable}</span>
                    </h3>
                  </div>

                  {activeOrder && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeOrder.status === 'preparing' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : activeOrder.status === 'ready'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {activeOrder.status === 'preparing' ? '🍳 In Zubereitung' : activeOrder.status === 'ready' ? '✅ Servierbereit' : '📝 Offene Aufnahme'}
                    </span>
                  )}
                </div>

                {/* Items List */}
                {activeOrder && activeOrder.items.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 my-3 max-h-[300px] overflow-y-auto pr-1">
                    {activeOrder.items.map((item) => (
                      <div key={item.menuItemId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.qty} × {item.price.toFixed(2)} € (MwSt. {item.taxRate}%)
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {(item.qty * item.price).toFixed(2)} €
                          </span>
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateItemQty(item.menuItemId, -1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-bold text-xs">{item.qty}</span>
                            <button
                              onClick={() => handleUpdateItemQty(item.menuItemId, 1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-2 text-slate-400">
                    <Utensils className="w-8 h-8 mx-auto opacity-40 text-amber-500" />
                    <p className="text-xs">Noch keine Speisen für {selectedTable} gebucht.</p>
                    <p className="text-[11px] text-slate-500">Klicken Sie links auf Gerichte der Speisekarte, um sie hinzuzufügen.</p>
                  </div>
                )}
              </div>

              {/* Totals & Action Buttons */}
              {activeOrder && activeOrder.items.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Netto-Betrag</span>
                      <span className="font-mono">{activeOrder.subtotal.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Gesamt-MwSt. (7% / 19%)</span>
                      <span className="font-mono">{activeOrder.taxTotal.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-base text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Rechnungsbetrag</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">
                        {activeOrder.total.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSendToKitchen}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition"
                    >
                      <ChefHat className="w-4 h-4 text-amber-500" />
                      <span>An Küche senden</span>
                    </button>

                    <button
                      onClick={() => handleOpenBilling(activeOrder)}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Tisch abrechnen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Küchen- & Bar-Monitor (KDS) */}
      {activeTab === 'kitchen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600" />
              <span>Live Küchen- & Zubereitungs-Monitor</span>
            </h3>
            <span className="text-xs text-slate-400">
              Echtzeit-Aktualisierung für Köche und Bar-Personal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.filter(o => o.status !== 'paid').map((order) => {
              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 ${
                    order.status === 'preparing'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-sm'
                      : order.status === 'ready'
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2 mb-2">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Utensils className="w-4 h-4 text-amber-600" />
                        <span>{order.tableNumber}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {order.items.map((i, idx) => (
                        <div key={idx} className="flex items-center justify-between font-medium">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">
                              {i.qty}×
                            </span>
                            <span>{i.name}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Status:</span>
                    <div className="flex items-center gap-1">
                      {order.status !== 'preparing' && (
                        <button
                          onClick={() => handleKitchenStatusChange(order.id, 'preparing')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition"
                        >
                          Kochen
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleKitchenStatusChange(order.id, 'ready')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Fertig / Servieren</span>
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Servierbereit ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {orders.filter(o => o.status !== 'paid').length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <ChefHat className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Keine offenen Küchenbestellungen</h4>
                <p className="text-xs text-slate-500">Alle Tische sind versorgt und serviert.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Speisekarte & Gerichte Verwaltung */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenuItems.map(item => (
              <div
                key={item.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.emoji || '🍽️'}</span>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {item.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-sm text-amber-600 dark:text-amber-400">
                      {item.price.toFixed(2)} €
                    </span>
                  </div>

                  {item.ingredients && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {item.ingredients}
                    </p>
                  )}

                  {item.allergens && item.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.allergens.map((alg, i) => (
                        <span key={i} className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-300">
                          {alg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">
                    MwSt: {item.taxRate}% • ~{item.prepTimeMinutes} Min.
                  </span>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setMenuItems(prev => prev.filter(m => m.id !== item.id));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Belegarchiv & Abgerechnete Tische */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              Abgerechnete Gastro-Belege
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              Gesamt: {orders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + curr.total, 0).toFixed(2)} €
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.filter(o => o.status === 'paid').map(order => (
              <div key={order.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{order.tableNumber}</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Bezahlt ({order.paymentMethod?.toUpperCase() || 'BAR'})
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {order.items.map(i => `${i.qty}× ${i.name}`).join(', ')}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    {order.paidAt ? new Date(order.paidAt).toLocaleString() : ''}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {order.total.toFixed(2)} €
                  </div>
                  <button
                    onClick={() => {
                      setBillOrder(order);
                      setShowReceiptPrint(true);
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 justify-end"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Bon nachdrucken</span>
                  </button>
                </div>
              </div>
            ))}

            {orders.filter(o => o.status === 'paid').length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs">
                Noch keine abgerechneten Tische in diesem Archiv.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Neues Gericht hinzufügen */}
      {isAddDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-600" />
                <span>Neues Gericht in Speisekarte eintragen</span>
              </h3>
              <button
                onClick={() => setIsAddDishModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewDish} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Name des Gerichts *</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Risotto ai Funghi Porcini"
                  value={newDish.name}
                  onChange={e => setNewDish({ ...newDish, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={newDish.category}
                    onChange={e => setNewDish({ ...newDish, category: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="starters">Vorspeisen</option>
                    <option value="pizza">Pizza</option>
                    <option value="mains">Hauptgerichte</option>
                    <option value="burgers">Burger & Grill</option>
                    <option value="desserts">Desserts</option>
                    <option value="drinks">Getränke</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Preis (€ Brutto) *</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={newDish.price}
                    onChange={e => setNewDish({ ...newDish, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">MwSt.-Satz</label>
                  <select
                    value={newDish.taxRate}
                    onChange={e => setNewDish({ ...newDish, taxRate: parseInt(e.target.value) })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  >
                    <option value="7">7% (Speisen / Takeaway)</option>
                    <option value="19">19% (Getränke / Vor-Ort)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Emoji / Icon</label>
                  <input
                    type="text"
                    value={newDish.emoji}
                    onChange={e => setNewDish({ ...newDish, emoji: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Zutaten / Beschreibung</label>
                <textarea
                  rows={2}
                  placeholder="Frische Steinpilze, Carnaroli-Reis, Weißwein, Butter, Parmesan"
                  value={newDish.ingredients}
                  onChange={e => setNewDish({ ...newDish, ingredients: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDishModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 font-bold rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-xs"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tisch Abrechnen & Gastronomie-Bewirtungsbeleg Drucken */}
      {billOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none text-slate-900 dark:text-slate-100">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                <h3 className="font-bold text-sm">
                  Tischabrechnung: {billOrder.tableNumber}
                </h3>
              </div>
              <button
                onClick={() => setBillOrder(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {!showReceiptPrint ? (
                <>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white">Bestellte Positionen:</div>
                    {billOrder.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{i.qty}× {i.name}</span>
                        <span className="font-mono">{(i.qty * i.price).toFixed(2)} €</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-extrabold text-sm text-slate-900 dark:text-white">
                      <span>Endbetrag:</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">{billOrder.total.toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Zahlungsart wählen:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cash', label: 'Barzahlung', icon: DollarSign },
                        { id: 'card', label: 'Kartenzahlung', icon: CreditCard },
                        { id: 'nfc', label: 'NFC / Apple Pay', icon: Sparkles }
                      ].map(m => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.id}
                            onClick={() => { sounds.playClick(); setPaymentMethod(m.id as any); }}
                            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 font-bold transition ${
                              paymentMethod === m.id 
                                ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' 
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cash Change Calculator */}
                  {paymentMethod === 'cash' && (
                    <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-slate-700 dark:text-slate-300">Gegeben Bar:</label>
                        <input
                          type="number"
                          step="0.50"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          className="w-28 p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-sm"
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-amber-200 dark:border-amber-800">
                        <span>Rückgeld:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {changeDue.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleFinalizePayment}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Zahlung buchen & Bewirtungsbeleg erzeugen</span>
                  </button>
                </>
              ) : (
                /* Thermal Gastro Receipt View */
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50/40 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 space-y-2">
                    <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
                      <div className="font-bold text-xs">{company.name}</div>
                      <div>{company.street} • {company.zip_city}</div>
                      <div>Steuernummer: {company.tax_id}</div>
                      <div className="font-bold mt-1">*** BEWIRTUNGSBELEG ***</div>
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span>{billOrder.tableNumber}</span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>

                    <div className="py-2 border-y border-dashed border-slate-300 dark:border-slate-700 space-y-1">
                      {billOrder.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{i.qty}× {i.name}</span>
                          <span>{(i.qty * i.price).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-0.5 pt-1 text-[10px]">
                      <div className="flex justify-between font-bold text-xs">
                        <span>GESAMT:</span>
                        <span>{billOrder.total.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Inkl. 7% MwSt:</span>
                        <span>{(billOrder.total * 0.0654).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Zahlungsart:</span>
                        <span>{paymentMethod.toUpperCase()}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 text-[9px] text-slate-400 text-center">
                      Vielen Dank für Ihren Besuch! • TSE Signatur: LOCAL-POS-OK
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Thermobon drucken</span>
                    </button>
                    <button
                      onClick={() => setBillOrder(null)}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition"
                    >
                      Fertig
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
