import React, { useState, useEffect, useMemo } from 'react';
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
  Tag, 
  SlidersHorizontal,
  Flame,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  ShoppingBag,
  BellRing,
  ArrowRight,
  Split,
  FileText,
  Percent,
  Banknote,
  Smartphone,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { MenuItem, TableOrder, TableOrderItem, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db, createPOSCheckout } from '../lib/db';
import { t } from '../lib/i18n';

interface RestaurantModuleProps {
  company?: CompanyProfile;
  companyProfile?: CompanyProfile;
  onRefreshData?: () => void;
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
    ingredients: '200g Black Angus Patty, Brioche Bun, Cheddar, Bacon-Jam, Pommes frites',
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

interface TableConfig {
  id: string;
  name: string;
  area: 'indoor' | 'terrace' | 'bar' | 'togo';
  seats: number;
}

const TABLES: TableConfig[] = [
  { id: 'T-1', name: 'Tisch 1 (Fenster)', area: 'indoor', seats: 4 },
  { id: 'T-2', name: 'Tisch 2', area: 'indoor', seats: 4 },
  { id: 'T-3', name: 'Tisch 3 (Ecke)', area: 'indoor', seats: 6 },
  { id: 'T-4', name: 'Tisch 4', area: 'indoor', seats: 2 },
  { id: 'T-5', name: 'Tisch 5 (Lounge)', area: 'indoor', seats: 8 },
  { id: 'T-6', name: 'Tisch 6', area: 'indoor', seats: 4 },
  { id: 'T-7', name: 'Tisch 7 (Terrasse)', area: 'terrace', seats: 4 },
  { id: 'T-8', name: 'Tisch 8 (Terrasse)', area: 'terrace', seats: 4 },
  { id: 'T-9', name: 'Tisch 9 (Terrasse)', area: 'terrace', seats: 6 },
  { id: 'B-1', name: 'Bar Platz 1', area: 'bar', seats: 1 },
  { id: 'B-2', name: 'Bar Platz 2', area: 'bar', seats: 1 },
  { id: 'B-3', name: 'Bar Platz 3', area: 'bar', seats: 1 },
  { id: 'TOGO', name: 'To-Go / Abholung', area: 'togo', seats: 0 }
];

export const RestaurantModule: React.FC<RestaurantModuleProps> = ({
  company,
  companyProfile,
  onRefreshData,
  onNavigateToInvoice
}) => {
  const activeCompany = companyProfile || company || {
    name: 'SOCDOF Gastronomie',
    street: 'Gastrostraße 1',
    zip_city: '10115 Berlin',
    tax_id: 'DE123456789',
    currency: '€',
    default_tax_rate: 19
  } as CompanyProfile;

  const [activeTab, setActiveTab] = useState<'tables' | 'kitchen' | 'menu' | 'history'>('tables');
  const [selectedArea, setSelectedArea] = useState<'all' | 'indoor' | 'terrace' | 'bar' | 'togo'>('all');

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('socdof_gastro_menu');
    return saved ? JSON.parse(saved) : DEFAULT_MENU;
  });

  const [orders, setOrders] = useState<TableOrder[]>(() => {
    const saved = localStorage.getItem('socdof_gastro_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedTable, setSelectedTable] = useState<string>(TABLES[0].name);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');

  // Checkout & Settle Modal State
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billOrder, setBillOrder] = useState<TableOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'nfc'>('cash');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [splitCount, setSplitCount] = useState<number>(1);
  const [isHospitalityReceipt, setIsHospitalityReceipt] = useState<boolean>(false);
  const [hospitalityHost, setHospitalityHost] = useState<string>('');
  const [hospitalityOccasion, setHospitalityOccasion] = useState<string>('');
  const [hospitalityGuests, setHospitalityGuests] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<TableOrder | null>(null);
  const [completedInvoiceId, setCompletedInvoiceId] = useState<number | null>(null);

  // New Dish Modal
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState(false);
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

  // Daily Z-Report Closing Modal
  const [isZReportOpen, setIsZReportOpen] = useState(false);

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem('socdof_gastro_menu', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('socdof_gastro_orders', JSON.stringify(orders));
  }, [orders]);

  // Current active order for selected table
  const activeOrder = useMemo(() => {
    return orders.find(o => o.tableNumber === selectedTable && o.status !== 'paid');
  }, [orders, selectedTable]);

  // Calculations for current active order
  const subtotal7 = activeOrder?.items.filter(i => i.taxRate === 7).reduce((s, i) => s + (i.price * i.qty), 0) || 0;
  const subtotal19 = activeOrder?.items.filter(i => i.taxRate === 19).reduce((s, i) => s + (i.price * i.qty), 0) || 0;
  const tax7 = subtotal7 * 0.07;
  const tax19 = subtotal19 * 0.19;
  const orderNet = subtotal7 + subtotal19;
  const orderTax = tax7 + tax19;
  const orderTotal = orderNet + orderTax;

  // Add dish to current table order
  const handleAddItemToTable = (dish: MenuItem) => {
    sounds.playClick();
    const now = new Date().toISOString();

    if (!activeOrder) {
      const newOrder: TableOrder = {
        id: `ORD-${Date.now()}`,
        tableNumber: selectedTable,
        openedAt: now,
        status: 'ordered',
        items: [{
          id: `item-${Date.now()}`,
          name: dish.name,
          price: dish.price,
          taxRate: dish.taxRate,
          qty: 1,
          category: dish.category,
          emoji: dish.emoji
        }],
        subtotal: dish.price,
        taxTotal: (dish.price * dish.taxRate) / 100,
        total: dish.price + (dish.price * dish.taxRate) / 100
      };
      setOrders(prev => [...prev, newOrder]);
    } else {
      setOrders(prev => prev.map(o => {
        if (o.id === activeOrder.id) {
          const existingItemIndex = o.items.findIndex(i => i.name === dish.name && !i.notes);
          let newItems = [...o.items];
          if (existingItemIndex >= 0) {
            newItems[existingItemIndex] = {
              ...newItems[existingItemIndex],
              qty: newItems[existingItemIndex].qty + 1
            };
          } else {
            newItems.push({
              id: `item-${Date.now()}-${Math.random()}`,
              name: dish.name,
              price: dish.price,
              taxRate: dish.taxRate,
              qty: 1,
              category: dish.category,
              emoji: dish.emoji
            });
          }

          const s7 = newItems.filter(i => i.taxRate === 7).reduce((s, i) => s + (i.price * i.qty), 0);
          const s19 = newItems.filter(i => i.taxRate === 19).reduce((s, i) => s + (i.price * i.qty), 0);
          const t7 = s7 * 0.07;
          const t19 = s19 * 0.19;
          const net = s7 + s19;
          const tax = t7 + t19;

          return {
            ...o,
            items: newItems,
            subtotal: net,
            taxTotal: tax,
            total: net + tax,
            status: o.status === 'preparing' ? 'preparing' : 'ordered'
          };
        }
        return o;
      }));
    }
  };

  const handleUpdateItemQty = (itemId: string, delta: number) => {
    if (!activeOrder) return;
    sounds.playClick();

    setOrders(prev => prev.map(o => {
      if (o.id === activeOrder.id) {
        let updatedItems = o.items.map(item => {
          if (item.id === itemId) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        }).filter(Boolean) as TableOrderItem[];

        if (updatedItems.length === 0) {
          return null as any;
        }

        const s7 = updatedItems.filter(i => i.taxRate === 7).reduce((s, i) => s + (i.price * i.qty), 0);
        const s19 = updatedItems.filter(i => i.taxRate === 19).reduce((s, i) => s + (i.price * i.qty), 0);
        const t7 = s7 * 0.07;
        const t19 = s19 * 0.19;
        const net = s7 + s19;
        const tax = t7 + t19;

        return {
          ...o,
          items: updatedItems,
          subtotal: net,
          taxTotal: tax,
          total: net + tax
        };
      }
      return o;
    }).filter(Boolean));
  };

  const handleUpdateItemNote = (itemId: string, note: string) => {
    if (!activeOrder) return;
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrder.id) {
        return {
          ...o,
          items: o.items.map(i => i.id === itemId ? { ...i, notes: note } : i)
        };
      }
      return o;
    }));
  };

  const handleSendToKitchen = () => {
    if (!activeOrder || activeOrder.items.length === 0) return;
    sounds.playNotification();
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
    setPaymentMethod('cash');
    setCashGiven(order.total.toFixed(2));
    setTipAmount(0);
    setSplitCount(1);
    setIsHospitalityReceipt(false);
    setIsBillingModalOpen(true);
    setCompletedOrder(null);
    setCompletedInvoiceId(null);
  };

  const handleFinalizePayment = async () => {
    if (!billOrder) return;

    const receiptNumber = `GASTRO/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const finalTotalWithTip = billOrder.total + tipAmount;
    const cashNum = parseFloat(cashGiven) || billOrder.total;
    const change = Math.max(0, cashNum - finalTotalWithTip);

    const finalizedOrder: TableOrder = {
      ...billOrder,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentMethod
    };

    // Update local table orders state
    setOrders(prev => prev.map(o => o.id === billOrder.id ? finalizedOrder : o));

    // Create official ERP Invoice & POS Order
    try {
      const result = await createPOSCheckout({
        receipt_number: receiptNumber,
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
        cash_tendered: paymentMethod === 'cash' ? cashNum : undefined,
        cash_change: paymentMethod === 'cash' ? change : undefined,
        customer_name: `${billOrder.tableNumber} Gast`
      }, {
        isGastro: true,
        tableNumber: billOrder.tableNumber,
        notes: isHospitalityReceipt 
          ? `Bewirtungsbeleg: Anlass: ${hospitalityOccasion || 'Geschäftsessen'} • Bewirtete Personen: ${hospitalityGuests || 'Gäste'} • Gastgeber: ${hospitalityHost || activeCompany.name}`
          : `Gastronomie Kassenbeleg • ${billOrder.tableNumber}`
      });

      sounds.playKaching();
      setCompletedInvoiceId(result.invoiceId);
      setCompletedOrder({ ...finalizedOrder, total: finalTotalWithTip });
      onRefreshData?.();
    } catch (e) {
      console.warn('Gastro payment recording notice:', e);
      sounds.playSuccess();
      setCompletedOrder(finalizedOrder);
    }
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

  const filteredTables = useMemo(() => {
    if (selectedArea === 'all') return TABLES;
    return TABLES.filter(t => t.area === selectedArea);
  }, [selectedArea]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                            (item.ingredients && item.ingredients.toLowerCase().includes(menuSearch.toLowerCase()));
      const matchesCat = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [menuItems, menuSearch, menuCategoryFilter]);

  // Today's Gastro Sales Summary for Z-Report
  const todayPaidOrders = useMemo(() => {
    const todayStr = new Date().toDateString();
    return orders.filter(o => o.status === 'paid' && o.paidAt && new Date(o.paidAt).toDateString() === todayStr);
  }, [orders]);

  const zTotalSales = todayPaidOrders.reduce((s, o) => s + o.total, 0);
  const zCashSales = todayPaidOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0);
  const zCardSales = todayPaidOrders.filter(o => o.paymentMethod === 'card' || o.paymentMethod === 'nfc').reduce((s, o) => s + o.total, 0);
  const zTaxTotal = todayPaidOrders.reduce((s, o) => s + o.taxTotal, 0);

  const changeDue = Math.max(0, (parseFloat(cashGiven) || 0) - ((billOrder?.total || 0) + tipAmount));

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Header Command Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Gastronomie, Tischbestellung & Kassenbuchung</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  GoBD & ERP Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lokale Orderbird-kompatible Touch-Kasse, Live-Küchenmonitor und automatische Rechnungserstellung
              </p>
            </div>
          </div>
        </div>

        {/* Live Counters & Command Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Offene Tische</div>
              <div className="text-sm font-bold text-amber-400 font-mono-num">
                {orders.filter(o => o.status !== 'paid').length}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">In Küche</div>
              <div className="text-sm font-bold text-emerald-400 font-mono-num">
                {orders.filter(o => o.status === 'preparing' || o.status === 'ordered').length}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Tagesumsatz</div>
              <div className="text-sm font-bold text-white font-mono-num">
                {zTotalSales.toFixed(2)} {activeCompany.currency || '€'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              setIsZReportOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            title="Tagesabschluss / Z-Bon erstellen"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Z-Bon / Tagesabschluss</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setIsAddDishModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Neues Gericht</span>
          </button>
        </div>
      </div>

      {/* Main View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {[
            { id: 'tables', label: 'Tische & Bestellungen', icon: Utensils, count: orders.filter(o => o.status !== 'paid').length },
            { id: 'kitchen', label: 'Küchen-Monitor (KDS)', icon: ChefHat, count: orders.filter(o => o.status === 'preparing' || o.status === 'ordered').length },
            { id: 'menu', label: 'Speisekarte & Gerichte', icon: Pizza, count: menuItems.length },
            { id: 'history', label: 'Belegarchiv & Abrechnung', icon: Receipt, count: orders.filter(o => o.status === 'paid').length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playClick();
                  setActiveTab(tab.id as any);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                  isActive 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-500' : ''}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TABLES & ORDER TAKING */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left / Center Column: Table Plan & Menu Selector (8 Cols) */}
          <div className="xl:col-span-8 space-y-5">
            {/* Area Filter Tabs */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'Alle Bereiche' },
                  { id: 'indoor', label: 'Innenbereich' },
                  { id: 'terrace', label: 'Terrasse' },
                  { id: 'bar', label: 'Bar & Counter' },
                  { id: 'togo', label: 'To-Go / Abholung' }
                ].map(area => (
                  <button
                    key={area.id}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedArea(area.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedArea === area.id 
                        ? 'bg-amber-600 text-white font-semibold shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Floor Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredTables.map(tbl => {
                const order = orders.find(o => o.tableNumber === tbl.name && o.status !== 'paid');
                const isSelected = selectedTable === tbl.name;
                const isOccupied = !!order;
                const isKitchen = order?.status === 'preparing';

                return (
                  <button
                    key={tbl.id}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedTable(tbl.name);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between h-28 ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/30' 
                        : isOccupied 
                        ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900/60 shadow-xs' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {tbl.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tbl.seats > 0 ? `${tbl.seats} Plätze` : 'Mitnahme'}
                        </div>
                      </div>

                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isKitchen 
                          ? 'bg-amber-500 animate-pulse' 
                          : isOccupied 
                          ? 'bg-indigo-500' 
                          : 'bg-emerald-500'
                      }`} />
                    </div>

                    {isOccupied && order ? (
                      <div className="mt-auto pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                          {order.total.toFixed(2)} {activeCompany.currency || '€'}
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          {order.items.reduce((s, i) => s + i.qty, 0)} Pos.
                        </span>
                      </div>
                    ) : (
                      <div className="mt-auto text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Frei</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Menu Items Quick Pick */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Pizza className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Speisekarte & Positionen für {selectedTable}
                  </h3>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Gericht oder Getränk suchen..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
                    onClick={() => {
                      sounds.playClick();
                      setMenuCategoryFilter(cat.id);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      menuCategoryFilter === cat.id 
                        ? 'bg-amber-500 text-white font-semibold' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Dish Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMenuItems.map(dish => (
                  <button
                    key={dish.id}
                    onClick={() => handleAddItemToTable(dish)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-500/10 border border-slate-200 dark:border-slate-700/60 hover:border-amber-500/60 text-left transition flex items-start justify-between gap-2 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{dish.emoji}</span>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {dish.name}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {dish.ingredients || 'Hausgemacht'}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-mono-num font-bold text-xs text-slate-900 dark:text-white">
                          {dish.price.toFixed(2)} {activeCompany.currency || '€'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-mono">
                          {dish.taxRate}%
                        </span>
                      </div>
                    </div>

                    <span className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-xs">
                      +
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Active Table Order Receipt & Billing Panel (4 Cols) */}
          <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between h-full min-h-[500px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>Bon für {selectedTable}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Status: {activeOrder?.status === 'preparing' ? '🔥 In Zubereitung' : activeOrder ? '📝 Offen' : '⚪ Bereit'}
                  </span>
                </div>

                {activeOrder && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      if (confirm(`Bestellung für ${selectedTable} wirklich stornieren?`)) {
                        setOrders(prev => prev.filter(o => o.id !== activeOrder.id));
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-xs transition"
                    title="Bestellung stornieren"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Item List */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {activeOrder?.items.map(item => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-num">
                          {item.price.toFixed(2)} {activeCompany.currency || '€'} • MwSt. {item.taxRate}%
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => handleUpdateItemQty(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold text-xs font-mono-num text-slate-900 dark:text-white">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => handleUpdateItemQty(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          +
                        </button>
                      </div>

                      <div className="font-mono-num font-bold text-xs text-slate-900 dark:text-white w-14 text-right">
                        {(item.price * item.qty).toFixed(2)} {activeCompany.currency || '€'}
                      </div>
                    </div>

                    {/* Note input per dish */}
                    <input
                      type="text"
                      placeholder="Anmerkung z.B. ohne Zwiebeln..."
                      value={item.notes || ''}
                      onChange={(e) => handleUpdateItemNote(item.id, e.target.value)}
                      className="w-full text-[11px] px-2 py-0.8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                  </div>
                ))}

                {(!activeOrder || activeOrder.items.length === 0) && (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Utensils className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">Noch keine Speisen für {selectedTable} erfasst.</p>
                    <p className="text-[10px] text-slate-500">Klicken Sie links auf Gerichte, um diese hinzuzufügen.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Totals & Cash Action */}
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-mono-num">
                <div className="flex justify-between">
                  <span>Netto 7% / 19%:</span>
                  <span>{orderNet.toFixed(2)} {activeCompany.currency || '€'}</span>
                </div>
                <div className="flex justify-between">
                  <span>MwSt. Gesamt:</span>
                  <span>{orderTax.toFixed(2)} {activeCompany.currency || '€'}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Gesamtbetrag:</span>
                  <span className="text-amber-600 dark:text-amber-400 text-base">{orderTotal.toFixed(2)} {activeCompany.currency || '€'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!activeOrder || activeOrder.items.length === 0}
                  onClick={handleSendToKitchen}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <ChefHat className="w-4 h-4 text-amber-500" />
                  <span>An Küche</span>
                </button>

                <button
                  disabled={!activeOrder || activeOrder.items.length === 0}
                  onClick={() => activeOrder && handleOpenBilling(activeOrder)}
                  className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Abrechnen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KITCHEN DISPLAY MONITOR (KDS) */}
      {activeTab === 'kitchen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-500" />
                <span>Live Küchen- & Zubereitungs-Monitor (KDS)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Echtzeit-Übersicht für Küche und Barpersonal
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.filter(o => o.status === 'preparing' || o.status === 'ordered').map(ord => {
              return (
                <div key={ord.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-300 dark:border-amber-900/60 p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {ord.tableNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>{new Date(ord.openedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse">
                        In Zubereitung
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80 my-3">
                      {ord.items.map((item, idx) => (
                        <div key={idx} className="py-2 flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {item.qty}x
                            </span>
                            <div>
                              <div className="font-semibold text-xs text-slate-900 dark:text-white">
                                {item.name}
                              </div>
                              {item.notes && (
                                <div className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded mt-0.5">
                                  ⚡ {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleKitchenStatusChange(ord.id, 'ordered')}
                      className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => handleKitchenStatusChange(ord.id, 'ready')}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Servierbereit</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {orders.filter(o => o.status === 'preparing' || o.status === 'ordered').length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 space-y-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <ChefHat className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Keine offenen Küchenbons</h4>
                <p className="text-xs">Alle Speisen sind aktuell zubereitet und serviert.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MENU CATALOG MANAGEMENT */}
      {activeTab === 'menu' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Speisekarte & Artikel ({menuItems.length} Gerichte)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preise, MwSt.-Sätze (7% Speisen / 19% Getränke), Allergene und Zutaten
              </p>
            </div>

            <button
              onClick={() => setIsAddDishModalOpen(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gericht hinzufügen</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {menuItems.map(item => (
              <div key={item.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">{item.emoji}</span>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.ingredients}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono-num font-bold text-xs text-slate-900 dark:text-white">
                      {item.price.toFixed(2)} {activeCompany.currency || '€'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MwSt. {item.taxRate}%
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playClick();
                      if (confirm(`Gericht "${item.name}" löschen?`)) {
                        setMenuItems(prev => prev.filter(i => i.id !== item.id));
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RECEIPT ARCHIVE & HISTORIC ORDERS */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Abgerechnete Gastro-Belege
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alle abgerechneten Tische sind automatisch als bezahlte Ausgangsrechnungen im ERP synchronisiert
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.filter(o => o.status === 'paid').map(ord => (
              <div key={ord.id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{ord.tableNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Bezahlt ({ord.paymentMethod?.toUpperCase() || 'BAR'})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {ord.paidAt ? new Date(ord.paidAt).toLocaleString('de-DE') : ord.openedAt} • {ord.items.length} Positionen
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-mono-num font-bold text-xs text-slate-900 dark:text-white">
                    {ord.total.toFixed(2)} {activeCompany.currency || '€'}
                  </div>

                  <button
                    onClick={() => {
                      sounds.playClick();
                      setCompletedOrder(ord);
                      setIsBillingModalOpen(false);
                    }}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white rounded-lg text-slate-700 dark:text-slate-300 transition"
                    title="Beleg ansehen & drucken"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {orders.filter(o => o.status === 'paid').length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Noch keine abgerechneten Tische im Archiv.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BILLING & CASH REGISTER MODAL */}
      {isBillingModalOpen && billOrder && !completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Abrechnung {billOrder.tableNumber}</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {billOrder.items.reduce((s, i) => s + i.qty, 0)} Speisen & Getränke
                </span>
              </div>

              <button onClick={() => setIsBillingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Display */}
            <div className="text-center py-3 bg-slate-800/90 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400">Rechnungsbetrag (Brutto)</div>
              <div className="text-3xl font-extrabold text-amber-400 font-mono-num mt-1">
                {(billOrder.total + tipAmount).toFixed(2)} {activeCompany.currency || '€'}
              </div>
              {splitCount > 1 && (
                <div className="text-xs text-slate-400 mt-1">
                  ({splitCount} Personen: <span className="font-bold text-white font-mono-num">{((billOrder.total + tipAmount) / splitCount).toFixed(2)} € pro Person</span>)
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('cash');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition ${
                  paymentMethod === 'cash' 
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span>Barzahlung</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('card');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition ${
                  paymentMethod === 'card' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>EC- / Kreditkarte</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('nfc');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition ${
                  paymentMethod === 'nfc' 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span>Apple / Google Pay</span>
              </button>
            </div>

            {/* Tip (Trinkgeld) Buttons */}
            <div className="space-y-1.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">Trinkgeld hinzufügen:</span>
                <span className="font-mono text-amber-400 font-bold">{tipAmount.toFixed(2)} €</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 2, 5, 10].map(tipVal => (
                  <button
                    key={tipVal}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setTipAmount(tipVal);
                    }}
                    className={`flex-1 py-1 text-xs rounded-lg font-mono font-medium transition ${
                      tipAmount === tipVal 
                        ? 'bg-amber-600 text-white font-bold' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {tipVal === 0 ? 'Kein Tip' : `+${tipVal} €`}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Given & Change Calculator */}
            {paymentMethod === 'cash' && (
              <div className="space-y-2.5 p-3.5 bg-slate-800/60 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Gegebenes Bargeld:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.50"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-600 text-white font-mono text-sm text-right px-2 py-1 rounded-lg"
                    />
                    <span className="text-slate-400">€</span>
                  </div>
                </div>

                {/* Quick Euro Note Buttons */}
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Exakt', val: (billOrder.total + tipAmount).toFixed(2) },
                    { label: '20 €', val: '20' },
                    { label: '50 €', val: '50' },
                    { label: '100 €', val: '100' }
                  ].map(b => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setCashGiven(b.val);
                      }}
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded font-mono"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-slate-700">
                  <span className="text-slate-300">Rückgeld:</span>
                  <span className="text-emerald-400 font-mono text-base">
                    {changeDue.toFixed(2)} €
                  </span>
                </div>
              </div>
            )}

            {/* GoBD Bewirtungsbeleg Toggle */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHospitalityReceipt}
                  onChange={(e) => setIsHospitalityReceipt(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 bg-slate-900"
                />
                <span>GoBD Bewirtungsbeleg erstellen (§ 4 Abs. 5 EStG)</span>
              </label>

              {isHospitalityReceipt && (
                <div className="space-y-2 pt-2 border-t border-slate-700/60 text-xs">
                  <input
                    type="text"
                    placeholder="Gastgeber / Firma (z.B. Acme GmbH)"
                    value={hospitalityHost}
                    onChange={(e) => setHospitalityHost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Anlass der Bewirtung (z.B. Projektmeeting)"
                    value={hospitalityOccasion}
                    onChange={(e) => setHospitalityOccasion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Bewirtete Personen (Namen der Gäste)"
                    value={hospitalityGuests}
                    onChange={(e) => setHospitalityGuests(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBillingModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleFinalizePayment}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Zahlung verbuchen & Beleg erstellen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED RECEIPT & INVOICE PRINT VIEW */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            {/* Printable Receipt Tape */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-base uppercase tracking-wider">{activeCompany.name}</div>
              <div className="text-[11px] text-slate-600">{activeCompany.street}</div>
              <div className="text-[11px] text-slate-600">{activeCompany.zip_city}</div>
              <div className="text-[10px] text-slate-500 mt-1">USt-IdNr: {activeCompany.tax_id}</div>
              <div className="text-xs font-bold text-amber-700 mt-1">
                KASSENBELEG / GASTRO-RECHNUNG
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <span>{completedOrder.tableNumber}</span>
              <span>{new Date(completedOrder.paidAt || Date.now()).toLocaleString('de-DE')}</span>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
              {completedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.qty}x {item.name}</span>
                  <span>{(item.price * item.qty).toFixed(2)} €</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Netto:</span>
                <span>{completedOrder.subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>MwSt. Gesamt:</span>
                <span>{completedOrder.taxTotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-900 pt-1">
                <span>GESAMT:</span>
                <span>{completedOrder.total.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Zahlart:</span>
                <span className="uppercase">{completedOrder.paymentMethod || 'BAR'}</span>
              </div>
            </div>

            {/* GoBD Bewirtungsbeleg section if enabled */}
            {isHospitalityReceipt && (
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[10px] text-slate-600">
                <div className="font-bold text-slate-800 uppercase">Angaben zum Bewirtungsaufwand:</div>
                <div>Gastgeber: {hospitalityHost || activeCompany.name}</div>
                <div>Anlass: {hospitalityOccasion || 'Geschäftliches Treffen'}</div>
                <div>Teilnehmer: {hospitalityGuests || 'Gäste'}</div>
                <div className="pt-2">Ort, Datum: __________________ Unterschrift: __________________</div>
              </div>
            )}

            <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
              Vielen Dank für Ihren Besuch!
              <br />
              GoBD TSE Signatur: OK-GASTRO-2026-X
            </div>

            {/* Print & ERP Nav Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 font-sans print:hidden">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  window.print();
                }}
                className="w-full sm:flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Thermobon drucken</span>
              </button>

              {onNavigateToInvoice && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setCompletedOrder(null);
                    setIsBillingModalOpen(false);
                    onNavigateToInvoice(completedInvoiceId || undefined);
                  }}
                  className="w-full sm:flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>In Rechnungen anzeigen</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCompletedOrder(null);
                  setIsBillingModalOpen(false);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAILY Z-REPORT / TAGESABSCHLUSS MODAL */}
      {isZReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Gastro Tagesabschluss (Z-Bon)</h3>
                  <span className="text-[11px] text-slate-400">{new Date().toLocaleDateString('de-DE')} • Kasse 1</span>
                </div>
              </div>

              <button onClick={() => setIsZReportOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-mono-num">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Anzahl Belege heute:</span>
                <span className="font-bold">{todayPaidOrders.length}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Bar-Einnahmen:</span>
                <span className="font-bold">{zCashSales.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Kartenzahlungen (EC/Kredit/NFC):</span>
                <span className="font-bold">{zCardSales.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Enthaltene MwSt.:</span>
                <span>{zTaxTotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
                <span className="font-sans">Tagesumsatz Gesamt (Brutto):</span>
                <span>{zTotalSales.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  sounds.playClick();
                  window.print();
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Z-Bon drucken</span>
              </button>
              <button
                onClick={() => setIsZReportOpen(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-semibold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW DISH MODAL */}
      {isAddDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleAddNewDish} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm">Neues Gericht zur Speisekarte</h3>
              <button type="button" onClick={() => setIsAddDishModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Name des Gerichts / Getränks:</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Pizza Prosciutto e Funghi"
                  value={newDish.name}
                  onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Kategorie:</label>
                  <select
                    value={newDish.category}
                    onChange={(e) => setNewDish({ ...newDish, category: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="starters">Vorspeisen</option>
                    <option value="pizza">Pizza</option>
                    <option value="mains">Hauptgerichte</option>
                    <option value="burgers">Burger</option>
                    <option value="desserts">Desserts</option>
                    <option value="drinks">Getränke</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Icon / Emoji:</label>
                  <input
                    type="text"
                    value={newDish.emoji}
                    onChange={(e) => setNewDish({ ...newDish, emoji: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Verkaufspreis (€):</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={newDish.price}
                    onChange={(e) => setNewDish({ ...newDish, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">MwSt.-Satz:</label>
                  <select
                    value={newDish.taxRate}
                    onChange={(e) => setNewDish({ ...newDish, taxRate: parseInt(e.target.value) || 7 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value={7}>7% (Speisen / Food)</option>
                    <option value={19}>19% (Getränke / Bar)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Zutaten & Beschreibung:</label>
                <textarea
                  rows={2}
                  placeholder="San Marzano Tomaten, Fior di Latte Mozzarella..."
                  value={newDish.ingredients}
                  onChange={(e) => setNewDish({ ...newDish, ingredients: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddDishModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Gericht anlegen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
