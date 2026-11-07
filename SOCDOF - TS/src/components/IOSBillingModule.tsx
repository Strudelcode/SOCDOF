import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Check, 
  X, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Receipt, 
  Printer, 
  RotateCcw, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  Tag, 
  SlidersHorizontal, 
  Edit3, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Utensils, 
  Coffee, 
  Pizza, 
  Flame, 
  Calendar, 
  ArrowRight,
  Settings,
  Share2,
  QrCode,
  FolderPlus,
  Image as ImageIcon,
  Upload,
  Camera,
  Eye,
  FileText,
  Filter,
  Save,
  Clock,
  Wine,
  Beer,
  LayoutGrid,
  List
} from 'lucide-react';
import { 
  IOSDishItem, 
  IOSSubcategoryOption, 
  IOSBillingCartItem, 
  IOSBillingReceipt,
  CompanyProfile 
} from '../types';
import { sounds } from '../lib/sound';

interface IOSBillingModuleProps {
  companyProfile: CompanyProfile;
}

// Curated high-res food photo presets for instant 1-click selection
const FOOD_PHOTO_PRESETS = [
  { name: 'Schnitzel', url: 'https://images.unsplash.com/photo-1599921841143-8190e5a557aa?w=600&auto=format&fit=crop&q=80', emoji: '🥩' },
  { name: 'Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', emoji: '🍔' },
  { name: 'Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', emoji: '🍕' },
  { name: 'Salat', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80', emoji: '🥗' },
  { name: 'Pasta', url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80', emoji: '🍝' },
  { name: 'Pommes / Sides', url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', emoji: '🍟' },
  { name: 'Steak', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', emoji: '🥩' },
  { name: 'Limonade / Drink', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80', emoji: '🍋' },
  { name: 'Kaffee / Espresso', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80', emoji: '☕' },
  { name: 'Bier / Fassbier', url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&auto=format&fit=crop&q=80', emoji: '🍺' },
  { name: 'Cocktail / Wein', url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80', emoji: '🍸' },
  { name: 'Dessert / Kuchen', url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&auto=format&fit=crop&q=80', emoji: '🍰' },
];

// Optional demo dishes if user requests to load sample data
const DEMO_PRESET_DISHES: IOSDishItem[] = [
  {
    id: 'dish-1',
    name: 'Wiener Schnitzel vom Kalb',
    category: 'Hauptgerichte',
    price: 18.50,
    taxRate: 7,
    description: 'Goldgelb souffliert paniertes Kalbsschnitzel mit Zitrone',
    emoji: '🥩',
    imageUrl: 'https://images.unsplash.com/photo-1599921841143-8190e5a557aa?w=600&auto=format&fit=crop&q=80',
    isEnabled: true,
    subcategories: [
      { id: 'opt-1', groupName: 'Beilage', name: 'Kartoffelsalat (hausgemacht)', extraPrice: 0.0, isDefault: true },
      { id: 'opt-2', groupName: 'Beilage', name: 'Knusprige Pommes Frites', extraPrice: 1.50 },
      { id: 'opt-3', groupName: 'Beilage', name: 'Bratkartoffeln mit Speck', extraPrice: 2.00 },
      { id: 'opt-4', groupName: 'Dip & Sauce', name: 'Preiselbeeren', extraPrice: 1.20 },
      { id: 'opt-5', groupName: 'Dip & Sauce', name: 'Knoblauch-Kräuter-Dip', extraPrice: 0.90 }
    ],
    inventoryQty: 35,
    sku: 'DISH-SCHNITZEL',
    createdAt: new Date().toISOString()
  },
  {
    id: 'dish-2',
    name: 'Black Angus Gourmet Burger',
    category: 'Hauptgerichte',
    price: 15.90,
    taxRate: 7,
    description: '200g Saftiges Angus Patty im Brioche Bun mit Cheddar & Röstzwiebeln',
    emoji: '🍔',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    isEnabled: true,
    subcategories: [
      { id: 'opt-6', groupName: 'Beilage', name: 'Portion Kartoffelsalat', extraPrice: 0.0 },
      { id: 'opt-7', groupName: 'Beilage', name: 'Süßkartoffel-Pommes', extraPrice: 2.50 },
      { id: 'opt-8', groupName: 'Extras', name: 'Extra Cheddar Cheese', extraPrice: 1.50 },
      { id: 'opt-9', groupName: 'Extras', name: 'Knuspriger Bacon', extraPrice: 1.80 }
    ],
    inventoryQty: 25,
    sku: 'DISH-BURGER',
    createdAt: new Date().toISOString()
  },
  {
    id: 'dish-3',
    name: 'Mediterraner Salatteller',
    category: 'Vorspeisen',
    price: 9.80,
    taxRate: 7,
    description: 'Knackige Blattsalate, Kirschtomaten, Gurken & geröstete Kerne',
    emoji: '🥗',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80',
    isEnabled: true,
    subcategories: [
      { id: 'opt-10', groupName: 'Dressing', name: 'Balsamico-Vinaigrette', extraPrice: 0.0, isDefault: true },
      { id: 'opt-11', groupName: 'Dressing', name: 'Joghurt-Kräuter-Dressing', extraPrice: 0.0 },
      { id: 'opt-12', groupName: 'Topping', name: 'Gebratene Hähnchenbruststreifen', extraPrice: 4.50 },
      { id: 'opt-13', groupName: 'Beilage', name: 'Beilage Kartoffelsalat', extraPrice: 2.50 }
    ],
    inventoryQty: 40,
    sku: 'DISH-SALAD',
    createdAt: new Date().toISOString()
  },
  {
    id: 'dish-4',
    name: 'Hausgemachte Minz-Limonade (0.4l)',
    category: 'Getränke',
    price: 4.50,
    taxRate: 19,
    description: 'Frisch gepresste Zitrone, Minze, Bio-Ingwer & Soda',
    emoji: '🍋',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    isEnabled: true,
    subcategories: [
      { id: 'opt-14', groupName: 'Geschmack', name: 'Klassisch Zitrone', extraPrice: 0.0, isDefault: true },
      { id: 'opt-15', groupName: 'Geschmack', name: 'Himbeer-Minze', extraPrice: 0.50 }
    ],
    inventoryQty: 50,
    sku: 'DRINK-LIMO',
    createdAt: new Date().toISOString()
  },
  {
    id: 'dish-5',
    name: 'Espresso Barista Arabica',
    category: 'Getränke',
    price: 2.70,
    taxRate: 19,
    description: 'Frisch gemahlener Siebträger-Espresso aus fairem Direkthandel',
    emoji: '☕',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
    isEnabled: true,
    subcategories: [],
    inventoryQty: 100,
    sku: 'DRINK-ESPRESSO',
    createdAt: new Date().toISOString()
  }
];

export const IOSBillingModule: React.FC<IOSBillingModuleProps> = ({
  companyProfile
}) => {
  // Navigation Tabs: iOS style Segmented Control
  const [activeTab, setActiveTab] = useState<'checkout' | 'inventory' | 'receipts' | 'stats' | 'settings'>('checkout');

  // View style for Kasse (Photo Grid vs Compact List)
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Custom Categories list
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ios_billing_categories');
      return saved ? JSON.parse(saved) : ['Hauptgerichte', 'Vorspeisen', 'Beilagen & Snacks', 'Getränke', 'Desserts'];
    } catch {
      return ['Hauptgerichte', 'Vorspeisen', 'Beilagen & Snacks', 'Getränke', 'Desserts'];
    }
  });

  // Dishes state (Initial state starts completely clean and empty as requested!)
  const [dishes, setDishes] = useState<IOSDishItem[]>(() => {
    try {
      const saved = localStorage.getItem('ios_billing_dishes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Receipts / Sales state
  const [receipts, setReceipts] = useState<IOSBillingReceipt[]>(() => {
    try {
      const saved = localStorage.getItem('ios_billing_receipts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cart for direct register billing (Single screen POS bar counter)
  const [cart, setCart] = useState<IOSBillingCartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Subcategory Selection Modal (When tapping a dish with options like potato salad)
  const [selectedDishForOptions, setSelectedDishForOptions] = useState<IOSDishItem | null>(null);
  const [chosenSubcategoryOptions, setChosenSubcategoryOptions] = useState<IOSSubcategoryOption[]>([]);
  const [dishOrderNote, setDishOrderNote] = useState<string>('');

  // Add / Edit Dish Form Modal
  const [isDishModalOpen, setIsDishModalOpen] = useState<boolean>(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dishForm, setDishForm] = useState<{
    name: string;
    category: string;
    price: string;
    taxRate: number;
    description: string;
    emoji: string;
    imageUrl: string;
    isEnabled: boolean;
    inventoryQty: string;
    sku: string;
    subcategories: IOSSubcategoryOption[];
  }>({
    name: '',
    category: 'Hauptgerichte',
    price: '',
    taxRate: 7,
    description: '',
    emoji: '🍽️',
    imageUrl: '',
    isEnabled: true,
    inventoryQty: '50',
    sku: '',
    subcategories: []
  });

  // Quick category creation modal / prompt
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // Quick Subcategory option builder inside Dish Form
  const [newSubcategoryGroup, setNewSubcategoryGroup] = useState<string>('Beilage');
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>('Kartoffelsalat');
  const [newSubcategoryPrice, setNewSubcategoryPrice] = useState<string>('0.00');

  // Checkout Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'apple_pay'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [activeReceipt, setActiveReceipt] = useState<IOSBillingReceipt | null>(null);
  const [selectedReceiptForDetails, setSelectedReceiptForDetails] = useState<IOSBillingReceipt | null>(null);

  // Settings State
  const [storeName, setStoreName] = useState<string>(() => {
    return localStorage.getItem('ios_billing_store_name') || companyProfile.name || 'Gastro Kasse & Bar';
  });
  const [receiptFooter, setReceiptFooter] = useState<string>(() => {
    return localStorage.getItem('ios_billing_receipt_footer') || 'Vielen Dank für Ihren Besuch! • TSE / GoBD konform';
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ios_billing_dishes', JSON.stringify(dishes));
    } catch {
      // ignore
    }
  }, [dishes]);

  useEffect(() => {
    try {
      localStorage.setItem('ios_billing_receipts', JSON.stringify(receipts));
    } catch {
      // ignore
    }
  }, [receipts]);

  useEffect(() => {
    try {
      localStorage.setItem('ios_billing_categories', JSON.stringify(customCategories));
    } catch {
      // ignore
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('ios_billing_store_name', storeName);
      localStorage.setItem('ios_billing_receipt_footer', receiptFooter);
    } catch {
      // ignore
    }
  }, [storeName, receiptFooter]);

  // Derived Categories combining standard + user dishes
  const allCategories = useMemo(() => {
    const set = new Set<string>(customCategories);
    dishes.forEach(d => {
      if (d.category) set.add(d.category);
    });
    return ['all', ...Array.from(set)];
  }, [customCategories, dishes]);

  // Filtered dishes for menu / register
  const filteredDishes = useMemo(() => {
    return dishes.filter(dish => {
      const matchesCategory = selectedCategory === 'all' || dish.category === selectedCategory;
      const matchesQuery = 
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dish.sku && dish.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesQuery;
    });
  }, [dishes, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  }, [cart]);

  const cartTaxBreakdown = useMemo(() => {
    let tax7 = 0;
    let tax19 = 0;
    cart.forEach(item => {
      const gross = item.unitPrice * item.qty;
      if (item.taxRate === 7) {
        const tax = gross - (gross / 1.07);
        tax7 += tax;
      } else {
        const tax = gross - (gross / 1.19);
        tax19 += tax;
      }
    });
    return {
      tax7,
      tax19,
      taxTotal: tax7 + tax19,
      netTotal: cartSubtotal - (tax7 + tax19)
    };
  }, [cart, cartSubtotal]);

  // -------------------------------------------------------------
  // HANDLERS: CART & BILLING
  // -------------------------------------------------------------
  const handleTapDish = (dish: IOSDishItem) => {
    if (!dish.isEnabled) {
      sounds.playError();
      return;
    }

    // If dish has subcategories / sides (e.g. Potato salad, sauces), open iOS option sheet
    if (dish.subcategories && dish.subcategories.length > 0) {
      sounds.playClick();
      setSelectedDishForOptions(dish);
      // Preselect default options
      const defaults = dish.subcategories.filter(s => s.isDefault);
      setChosenSubcategoryOptions(defaults);
      setDishOrderNote('');
    } else {
      // Direct add to cart
      sounds.playClick();
      addItemToCartDirect(dish, [], '');
    }
  };

  const addItemToCartDirect = (dish: IOSDishItem, options: IOSSubcategoryOption[], notes: string) => {
    const extraTotal = options.reduce((sum, opt) => sum + opt.extraPrice, 0);
    const unitPrice = dish.price + extraTotal;
    const cartItemId = `${dish.id}-${options.map(o => o.id).sort().join('_')}-${notes}`;

    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        return prev.map(item => item.id === cartItemId ? { ...item, qty: item.qty + 1 } : item);
      }
      return [
        ...prev,
        {
          id: cartItemId,
          dishId: dish.id,
          name: dish.name,
          basePrice: dish.price,
          unitPrice,
          qty: 1,
          taxRate: dish.taxRate,
          emoji: dish.emoji,
          imageUrl: dish.imageUrl,
          selectedOptions: options,
          notes: notes.trim() ? notes.trim() : undefined
        }
      ];
    });
  };

  const handleToggleSubcategoryOption = (option: IOSSubcategoryOption) => {
    sounds.playClick();
    setChosenSubcategoryOptions(prev => {
      const exists = prev.some(o => o.id === option.id);
      if (exists) {
        return prev.filter(o => o.id !== option.id);
      } else {
        // If option belongs to same single-choice group (like Beilage), replace other in that group or append
        const sameGroup = prev.filter(o => o.groupName !== option.groupName);
        return [...sameGroup, option];
      }
    });
  };

  const handleConfirmOptionsSheet = () => {
    if (!selectedDishForOptions) return;
    sounds.playClick();
    addItemToCartDirect(selectedDishForOptions, chosenSubcategoryOptions, dishOrderNote);
    setSelectedDishForOptions(null);
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    sounds.playClick();
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartItemId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as IOSBillingCartItem[];
    });
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    sounds.playClick();
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const handleClearCart = () => {
    sounds.playClick();
    setCart([]);
  };

  // -------------------------------------------------------------
  // HANDLERS: PAY & CHECKOUT
  // -------------------------------------------------------------
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    sounds.playClick();
    setCashTendered(cartSubtotal.toFixed(2));
    setPaymentMethod('cash');
    setIsPaymentOpen(true);
  };

  const handleCompleteCheckout = () => {
    sounds.playKaching();
    const tendered = parseFloat(cashTendered) || cartSubtotal;
    const change = Math.max(0, tendered - cartSubtotal);

    const newReceipt: IOSBillingReceipt = {
      id: 'rec-' + Date.now(),
      receiptNumber: `BON-${new Date().getFullYear()}-${String(receipts.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString(),
      items: [...cart],
      subtotal: cartTaxBreakdown.netTotal,
      tax7Total: cartTaxBreakdown.tax7,
      tax19Total: cartTaxBreakdown.tax19,
      total: cartSubtotal,
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? tendered : undefined,
      cashChange: paymentMethod === 'cash' ? change : undefined,
      tseSignature: `TSE-DE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    };

    setReceipts(prev => [newReceipt, ...prev]);
    setActiveReceipt(newReceipt);
    setCart([]);
    setIsPaymentOpen(false);

    // Update dish inventory count if tracked
    setDishes(prev => prev.map(d => {
      const soldItem = newReceipt.items.find(i => i.dishId === d.id);
      if (soldItem && d.inventoryQty !== undefined) {
        return {
          ...d,
          inventoryQty: Math.max(0, d.inventoryQty - soldItem.qty)
        };
      }
      return d;
    }));
  };

  // -------------------------------------------------------------
  // HANDLERS: DISH MANAGEMENT & TOGGLE
  // -------------------------------------------------------------
  const handleToggleDishEnabled = (dishId: string) => {
    sounds.playClick();
    setDishes(prev => prev.map(d => {
      if (d.id === dishId) {
        return { ...d, isEnabled: !d.isEnabled };
      }
      return d;
    }));
  };

  // In-place quick price update from inventory table
  const handleInlinePriceChange = (dishId: string, newPriceStr: string) => {
    const val = parseFloat(newPriceStr.replace(',', '.')) || 0;
    setDishes(prev => prev.map(d => d.id === dishId ? { ...d, price: val } : d));
  };

  const handleOpenAddDish = () => {
    sounds.playClick();
    setEditingDishId(null);
    setDishForm({
      name: '',
      category: customCategories[0] || 'Hauptgerichte',
      price: '',
      taxRate: 7,
      description: '',
      emoji: '🍽️',
      imageUrl: '',
      isEnabled: true,
      inventoryQty: '50',
      sku: '',
      subcategories: [
        { id: 'opt-demo-1', groupName: 'Beilage', name: 'Kartoffelsalat (hausgemacht)', extraPrice: 0.0, isDefault: true },
        { id: 'opt-demo-2', groupName: 'Beilage', name: 'Knusprige Pommes Frites', extraPrice: 1.50 }
      ]
    });
    setIsDishModalOpen(true);
  };

  const handleOpenEditDish = (dish: IOSDishItem) => {
    sounds.playClick();
    setEditingDishId(dish.id);
    setDishForm({
      name: dish.name,
      category: dish.category,
      price: dish.price.toString(),
      taxRate: dish.taxRate,
      description: dish.description || '',
      emoji: dish.emoji || '🍽️',
      imageUrl: dish.imageUrl || '',
      isEnabled: dish.isEnabled,
      inventoryQty: dish.inventoryQty !== undefined ? dish.inventoryQty.toString() : '50',
      sku: dish.sku || '',
      subcategories: dish.subcategories ? [...dish.subcategories] : []
    });
    setIsDishModalOpen(true);
  };

  const handleSaveDishForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishForm.name.trim()) return;

    const parsedPrice = parseFloat(dishForm.price.replace(',', '.')) || 0;
    const parsedQty = parseInt(dishForm.inventoryQty, 10) || 50;

    if (editingDishId) {
      // Update existing
      setDishes(prev => prev.map(d => {
        if (d.id === editingDishId) {
          return {
            ...d,
            name: dishForm.name.trim(),
            category: dishForm.category.trim() || 'Hauptgerichte',
            price: parsedPrice,
            taxRate: dishForm.taxRate,
            description: dishForm.description.trim(),
            emoji: dishForm.emoji.trim() || '🍽️',
            imageUrl: dishForm.imageUrl.trim() || undefined,
            isEnabled: dishForm.isEnabled,
            inventoryQty: parsedQty,
            sku: dishForm.sku.trim(),
            subcategories: dishForm.subcategories
          };
        }
        return d;
      }));
    } else {
      // Create new
      const newDishItem: IOSDishItem = {
        id: 'dish-' + Date.now(),
        name: dishForm.name.trim(),
        category: dishForm.category.trim() || 'Hauptgerichte',
        price: parsedPrice,
        taxRate: dishForm.taxRate,
        description: dishForm.description.trim(),
        emoji: dishForm.emoji.trim() || '🍽️',
        imageUrl: dishForm.imageUrl.trim() || undefined,
        isEnabled: dishForm.isEnabled,
        inventoryQty: parsedQty,
        sku: dishForm.sku.trim() || `DISH-${Date.now().toString().slice(-4)}`,
        subcategories: dishForm.subcategories,
        createdAt: new Date().toISOString()
      };
      setDishes(prev => [newDishItem, ...prev]);
    }

    sounds.playClick();
    setIsDishModalOpen(false);
  };

  const handleDeleteDish = (dishId: string) => {
    sounds.playClick();
    if (window.confirm('Möchten Sie dieses Gericht wirklich löschen?')) {
      setDishes(prev => prev.filter(d => d.id !== dishId));
      if (editingDishId === dishId) {
        setIsDishModalOpen(false);
      }
    }
  };

  // Image Upload handler for local images
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setDishForm(prev => ({ ...prev, imageUrl: uploadEvent.target!.result as string }));
          sounds.playClick();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSubcategoryOptionToForm = () => {
    if (!newSubcategoryName.trim()) return;
    const priceVal = parseFloat(newSubcategoryPrice.replace(',', '.')) || 0;
    const newOpt: IOSSubcategoryOption = {
      id: 'sub-' + Date.now() + Math.random().toString(36).substring(2, 5),
      groupName: newSubcategoryGroup.trim() || 'Beilage',
      name: newSubcategoryName.trim(),
      extraPrice: priceVal,
      isDefault: dishForm.subcategories.filter(s => s.groupName === newSubcategoryGroup).length === 0
    };

    setDishForm(prev => ({
      ...prev,
      subcategories: [...prev.subcategories, newOpt]
    }));
    setNewSubcategoryName('');
    setNewSubcategoryPrice('0.00');
  };

  const handleRemoveSubcategoryOptionFromForm = (optId: string) => {
    setDishForm(prev => ({
      ...prev,
      subcategories: prev.subcategories.filter(s => s.id !== optId)
    }));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    sounds.playClick();
    if (!customCategories.includes(newCategoryName.trim())) {
      setCustomCategories(prev => [...prev, newCategoryName.trim()]);
    }
    setNewCategoryName('');
    setIsCategoryModalOpen(false);
  };

  // -------------------------------------------------------------
  // HANDLERS: LOAD DEMO OR RESET
  // -------------------------------------------------------------
  const handleLoadDemoMenu = () => {
    sounds.playClick();
    setDishes(DEMO_PRESET_DISHES);
  };

  const handleResetToEmpty = () => {
    sounds.playClick();
    if (window.confirm('Möchten Sie die Karte und alle Speisen auf den sauberen Ausgangszustand (leer) zurücksetzen?')) {
      setDishes([]);
      setCart([]);
    }
  };

  // -------------------------------------------------------------
  // STATISTICS CALCULATIONS
  // -------------------------------------------------------------
  const stats = useMemo(() => {
    const totalSales = receipts.reduce((sum, r) => sum + r.total, 0);
    const count = receipts.length;
    const avgOrder = count > 0 ? totalSales / count : 0;

    const dishCounts: Record<string, { name: string; qty: number; revenue: number; emoji?: string; imageUrl?: string }> = {};
    const subcategoryCounts: Record<string, { name: string; group: string; count: number }> = {};
    const categoryCounts: Record<string, number> = {};
    const paymentBreakdown: Record<string, number> = { cash: 0, card: 0, apple_pay: 0 };

    receipts.forEach(rec => {
      paymentBreakdown[rec.paymentMethod] = (paymentBreakdown[rec.paymentMethod] || 0) + rec.total;
      
      rec.items.forEach(item => {
        if (!dishCounts[item.dishId]) {
          dishCounts[item.dishId] = { name: item.name, qty: 0, revenue: 0, emoji: item.emoji, imageUrl: item.imageUrl };
        }
        dishCounts[item.dishId].qty += item.qty;
        dishCounts[item.dishId].revenue += (item.unitPrice * item.qty);

        // Find dish category
        const origDish = dishes.find(d => d.id === item.dishId);
        const cat = origDish ? origDish.category : 'Andere';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + (item.unitPrice * item.qty);

        // Track subcategories (e.g. Kartoffelsalat count!)
        if (item.selectedOptions) {
          item.selectedOptions.forEach(opt => {
            const key = `${opt.groupName}:${opt.name}`;
            if (!subcategoryCounts[key]) {
              subcategoryCounts[key] = { name: opt.name, group: opt.groupName, count: 0 };
            }
            subcategoryCounts[key].count += item.qty;
          });
        }
      });
    });

    const topDishes = Object.values(dishCounts).sort((a, b) => b.qty - a.qty);
    const topSubcategories = Object.values(subcategoryCounts).sort((a, b) => b.count - a.count);

    return {
      totalSales,
      count,
      avgOrder,
      topDishes,
      topSubcategories,
      categoryCounts,
      paymentBreakdown
    };
  }, [receipts, dishes]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 select-none">
      
      {/* 1. Single-Screen Bar & Gastro POS Header */}
      <div className="px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        
        {/* Brand & Single-Screen Counter Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm ring-2 ring-indigo-500/20">
            <Utensils className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {storeName}
              </h1>
              <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-bold">
                1-Screen Theke & Kasse
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Speisekarte & Fotos • Beilagen • Schnell-Billing • Bon-Journal
            </p>
          </div>
        </div>

        {/* Navigation Tabs (Cupertino Segmented Control) */}
        <div className="flex p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl text-xs font-semibold shadow-inner">
          <button
            onClick={() => { sounds.playClick(); setActiveTab('checkout'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'checkout'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Kasse & Verkauf</span>
            {cart.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('inventory'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'inventory'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Speisekarte & Preise</span>
            <span className="text-[10px] opacity-60">({dishes.length})</span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('receipts'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'receipts'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Bon-Journal</span>
            <span className="text-[10px] opacity-60">({receipts.length})</span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('stats'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'stats'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Statistiken</span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('settings'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Setup</span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            title="Neue Kategorie anlegen"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">+ Kategorie</span>
          </button>
          
          <button
            onClick={handleOpenAddDish}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Neues Gericht</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        
        {/* ========================================================================= */}
        {/* TAB 1: KASSE & VERKAUF (REGISTER CHECKOUT) */}
        {/* ========================================================================= */}
        {activeTab === 'checkout' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
            
            {/* Left: Dish Catalog & Search */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              {/* Category Pills & Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Speisen, Beilagen, Drinks oder SKU suchen..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
                  />
                </div>

                {/* Grid vs Compact toggle */}
                <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl">
                  <button
                    onClick={() => { sounds.playClick(); setViewMode('grid'); }}
                    className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-2xs' : 'text-slate-500'}`}
                    title="Foto-Kacheln"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { sounds.playClick(); setViewMode('compact'); }}
                    className={`p-1.5 rounded-lg transition ${viewMode === 'compact' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-2xs' : 'text-slate-500'}`}
                    title="Kompakt-Liste"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Category Horizontal Filter Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                {allCategories.map(cat => {
                  const count = cat === 'all' 
                    ? dishes.length 
                    : dishes.filter(d => d.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => { sounds.playClick(); setSelectedCategory(cat); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{cat === 'all' ? 'Alle Speisen & Drinks' : cat}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        selectedCategory === cat ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dish Grid or Clean Empty State */}
              {dishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Utensils className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      Ihre Speisekarte ist aktuell noch leer
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Erfassen Sie Ihre Speisen & Drinks mit Fotos, Preisen, USt.-Satz und konfigurierbaren Beilagen (wie Kartoffelsalat oder Pommes).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <button
                      onClick={handleOpenAddDish}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      + Erstes Gericht erfassen
                    </button>
                    <button
                      onClick={handleLoadDemoMenu}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition"
                    >
                      Demo-Gerichte laden
                    </button>
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                /* PHOTO CARDS GRID */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {filteredDishes.map(dish => (
                    <div
                      key={dish.id}
                      onClick={() => handleTapDish(dish)}
                      className={`group relative rounded-2xl border transition-all text-left flex flex-col justify-between overflow-hidden cursor-pointer ${
                        !dish.isEnabled
                          ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-50 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/80 hover:shadow-md active:scale-98'
                      }`}
                    >
                      {/* Photo Banner or Emoji header */}
                      {dish.imageUrl ? (
                        <div className="relative h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-xs font-mono">
                            {dish.price.toFixed(2)} €
                          </div>
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {dish.taxRate}% USt
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800 dark:to-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                          <span className="text-3xl">{dish.emoji || '🍽️'}</span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block">
                              {dish.price.toFixed(2)} €
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">
                              {dish.taxRate}% USt
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Content details */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                              {dish.category}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {dish.name}
                          </h4>
                          {dish.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mt-0.5">
                              {dish.description}
                            </p>
                          )}
                        </div>

                        {/* Subcategory Sides tag / inventory count */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          {dish.subcategories && dish.subcategories.length > 0 ? (
                            <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                              + {dish.subcategories.length} Beilagen/Extras
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">Direkt</span>
                          )}

                          {!dish.isEnabled ? (
                            <span className="text-[9px] font-bold text-rose-500">Deaktiviert</span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-mono">
                              {dish.inventoryQty !== undefined ? `${dish.inventoryQty}x` : '∞'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* COMPACT LIST VIEW */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {filteredDishes.map(dish => (
                    <div
                      key={dish.id}
                      onClick={() => handleTapDish(dish)}
                      className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition ${
                        !dish.isEnabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {dish.imageUrl ? (
                          <img src={dish.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-2xl">{dish.emoji || '🍽️'}</span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {dish.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {dish.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {dish.description || `${dish.subcategories?.length || 0} Beilagen/Optionen`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                            {dish.price.toFixed(2)} €
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {dish.taxRate}% USt
                          </div>
                        </div>
                        <button className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: iOS Register Cart & Direct Billing Summary */}
            <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-fit sticky top-20">
              
              {/* Cart Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Aktueller Kassenbon
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {cart.reduce((s, i) => s + i.qty, 0)} Positionen
                    </span>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Bon leeren</span>
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="p-4 max-h-[340px] overflow-y-auto space-y-2.5">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <ShoppingBag className="w-9 h-9 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-semibold">Keine Speisen im Bon</p>
                    <p className="text-[10px] text-slate-400">Tippen Sie links auf ein Gericht zum direkten Hinzufügen</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-5 h-5 rounded-md object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{item.emoji || '🍽️'}</span>
                          )}
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                            {item.name}
                          </span>
                        </div>

                        {/* Selected Options / Subcategories like Potato Salad */}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.selectedOptions.map(opt => (
                              <span
                                key={opt.id}
                                className="text-[10px] bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-200/50"
                              >
                                {opt.name} {opt.extraPrice > 0 ? `(+${opt.extraPrice.toFixed(2)} €)` : ''}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                            "{item.notes}"
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          {item.unitPrice.toFixed(2)} € × {item.qty} = {(item.unitPrice * item.qty).toFixed(2)} €
                        </div>
                      </div>

                      {/* Qty Stepper */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-xl p-0.5 border border-slate-200 dark:border-slate-600 shadow-2xs">
                        <button
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold text-xs">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer & Checkout Button */}
              {cart.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  
                  {/* Tax & Netto Breakdown */}
                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Nettobetrag:</span>
                      <span className="font-mono">{cartTaxBreakdown.netTotal.toFixed(2)} €</span>
                    </div>
                    {cartTaxBreakdown.tax7 > 0 && (
                      <div className="flex justify-between">
                        <span>7% USt (Speisen):</span>
                        <span className="font-mono">{cartTaxBreakdown.tax7.toFixed(2)} €</span>
                      </div>
                    )}
                    {cartTaxBreakdown.tax19 > 0 && (
                      <div className="flex justify-between">
                        <span>19% USt (Getränke / Alkohol):</span>
                        <span className="font-mono">{cartTaxBreakdown.tax19.toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-900 dark:text-white">
                      <span>Gesamtbetrag (Brutto):</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 text-base">
                        {cartSubtotal.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* Express Pay Action */}
                  <button
                    onClick={handleOpenPayment}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition active:scale-98"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Jetzt abrechnen ({cartSubtotal.toFixed(2)} €)</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SPEISEKARTE, PREISE & INVENTAR (ADMIN EDITOR) */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            
            {/* Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Speisekarten- & Preisverwaltung (Admin)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pflegen Sie Fotos, Preise, USt.-Sätze, Kategorien und Beilagen (wie Kartoffelsalat).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Kategorien verwalten</span>
                </button>
                <button
                  onClick={handleLoadDemoMenu}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  Demo-Karte laden
                </button>
                <button
                  onClick={handleResetToEmpty}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold transition"
                >
                  Alles leeren
                </button>
                <button
                  onClick={handleOpenAddDish}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Neues Gericht</span>
                </button>
              </div>
            </div>

            {/* Category summary pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 mr-1">Kategorien:</span>
              {customCategories.map(cat => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {cat} ({dishes.filter(d => d.category === cat).length})
                </span>
              ))}
            </div>

            {/* Dishes Inventory Table / List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {dishes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <Utensils className="w-10 h-10 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                  <p className="text-xs">Keine Gerichte vorhanden</p>
                  <button
                    onClick={handleOpenAddDish}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    + Erstes Gericht anlegen
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dishes.map(dish => (
                    <div
                      key={dish.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Left info & Photo */}
                      <div className="flex items-center gap-3.5 min-w-[240px]">
                        {dish.imageUrl ? (
                          <img
                            src={dish.imageUrl}
                            alt=""
                            className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-3xl p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl shrink-0">
                            {dish.emoji || '🍽️'}
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {dish.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {dish.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md line-clamp-1 mt-0.5">
                            {dish.description || 'Keine Beschreibung angegeben'}
                          </p>
                          {dish.subcategories && dish.subcategories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {dish.subcategories.map(s => (
                                <span key={s.id} className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/50">
                                  {s.name} ({s.extraPrice > 0 ? `+${s.extraPrice.toFixed(2)} €` : 'inkl.'})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: In-Place Price & USt Edit */}
                      <div className="flex items-center gap-6">
                        <div>
                          <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Preis (€)</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.10"
                              defaultValue={dish.price.toFixed(2)}
                              onBlur={(e) => handleInlinePriceChange(dish.id, e.target.value)}
                              className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono text-slate-900 dark:text-white"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">€</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">MwSt.</label>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {dish.taxRate}%
                          </span>
                        </div>

                        {/* Stock count */}
                        <div className="text-center">
                          <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Bestand</label>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                            {dish.inventoryQty !== undefined ? `${dish.inventoryQty}x` : '∞'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Enable/Disable Switch & Actions */}
                      <div className="flex items-center gap-3">
                        {/* iOS Toggle Switch */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-[11px] font-medium text-slate-500">
                            {dish.isEnabled ? 'Aktiv' : 'Inaktiv'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleDishEnabled(dish.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              dish.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                dish.isEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </label>

                        {/* Edit & Delete */}
                        <button
                          onClick={() => handleOpenEditDish(dish)}
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Gericht, Foto & Beilagen bearbeiten"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDish(dish.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: BON-JOURNAL & RECHNUNGEN */}
        {/* ========================================================================= */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bon-Journal & Kassenbelege ({receipts.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lückenlose Historie aller Belege mit TSE-Signatur, Steuern und Nachdruck-Option.
                </p>
              </div>

              {receipts.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      window.print();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Journal drucken</span>
                  </button>
                </div>
              )}
            </div>

            {receipts.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                <Receipt className="w-10 h-10 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold">Noch keine Kassenbelege vorhanden</p>
                <p className="text-[10px]">Verkaufen Sie Speisen im Reiter "Kasse & Verkauf" um Belege zu generieren.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {receipts.map(rec => (
                  <div
                    key={rec.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-bold text-xs">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                            {rec.receiptNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {rec.paymentMethod === 'cash' ? 'Barzahlung' : rec.paymentMethod === 'card' ? 'Kartenzahlung' : 'Apple Pay / NFC'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {new Date(rec.date).toLocaleString('de-DE')} • {rec.items.length} Positionen
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {rec.total.toFixed(2)} €
                        </div>
                        <div className="text-[10px] text-slate-400">
                          inkl. 7% & 19% USt
                        </div>
                      </div>

                      <button
                        onClick={() => { sounds.playClick(); setSelectedReceiptForDetails(rec); }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Bon ansehen</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: STATISTIKEN & UMSATZ */}
        {/* ========================================================================= */}
        {activeTab === 'stats' && (
          <div className="space-y-5">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Gesamtumsatz Theke & Kasse
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {stats.totalSales.toFixed(2)} €
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>GoBD & TSE erfasst</span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Abgerechnete Kassenbons
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {stats.count}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Direktverkauf & Counter
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Durchschnittlicher Bon
                </span>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                  {stats.avgOrder.toFixed(2)} €
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  pro Bestellung
                </div>
              </div>
            </div>

            {/* Charts & Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Top Selling Dishes */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Meistverkaufte Speisen & Drinks</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Ranking</span>
                </div>

                {stats.topDishes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Noch keine Verkaufsdaten vorhanden</p>
                ) : (
                  <div className="space-y-2.5">
                    {stats.topDishes.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 w-4">{idx + 1}.</span>
                          <span>{item.emoji || '🍽️'}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 rounded font-bold text-[11px]">
                            {item.qty}x
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-bold">
                            {item.revenue.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subcategories / Sides Breakdown (Potato Salad Counter!) */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>Beliebteste Beilagen & Extras (z.B. Kartoffelsalat)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Optionen</span>
                </div>

                {stats.topSubcategories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Noch keine Beilagen-Wahlen registriert</p>
                ) : (
                  <div className="space-y-2.5">
                    {stats.topSubcategories.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                            {item.group}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 rounded font-bold font-mono text-[11px]">
                          {item.count}x gewählt
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SETUP & EINSTELLUNGEN */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Theken- & Kassen-Konfiguration
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lokal laufende Konfiguration für den Einzel-Bildschirm am Tresen.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Name der Kasse / Location</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Bon-Fußzeile / Rechtshinweis</label>
                  <input
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Single-Screen Bar & Gastro Architektur</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Alle Daten (Speisen, Preise, Fotos, Bons und Statistiken) werden direkt lokal auf diesem Computer gespeichert und verarbeitet. Externe Küchen- oder Bar-Monitore über Netzwerk sind nicht erforderlich.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: SUB-CATEGORY / BEILAGEN BOTTOM SHEET (Kartoffelsalat etc.) */}
      {/* ========================================================================= */}
      {selectedDishForOptions && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            
            {/* Header with Photo or Emoji */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                {selectedDishForOptions.imageUrl ? (
                  <img src={selectedDishForOptions.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-3xl">{selectedDishForOptions.emoji || '🍽️'}</span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedDishForOptions.name}
                  </h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                    Grundpreis: {selectedDishForOptions.price.toFixed(2)} €
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDishForOptions(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options Groups */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Wählen Sie die gewünschte Beilage oder Extras:
              </p>

              {/* Grouped by groupName */}
              {Array.from(new Set(selectedDishForOptions.subcategories.map(s => s.groupName))).map(group => (
                <div key={group} className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {group}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedDishForOptions.subcategories
                      .filter(s => s.groupName === group)
                      .map(opt => {
                        const isSelected = chosenSubcategoryOptions.some(o => o.id === opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleSubcategoryOption(opt)}
                            className={`p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                              isSelected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/70 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-bold'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs">{opt.name}</span>
                            <span className="text-[11px] font-mono opacity-80">
                              {opt.extraPrice > 0 ? `+${opt.extraPrice.toFixed(2)} €` : 'inkl.'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}

              {/* Special instructions / kitchen note */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Küchennotiz / Sonderwunsch:
                </label>
                <input
                  type="text"
                  value={dishOrderNote}
                  onChange={(e) => setDishOrderNote(e.target.value)}
                  placeholder="z. B. ohne Zwiebeln, extra knusprig..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            {/* Confirm Bottom Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block">Endpreis Position:</span>
                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                  {(selectedDishForOptions.price + chosenSubcategoryOptions.reduce((s, o) => s + o.extraPrice, 0)).toFixed(2)} €
                </span>
              </div>

              <button
                onClick={handleConfirmOptionsSheet}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 transition active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>In den Bon übernehmen</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT DISH WITH PHOTO UPLOAD & BEILAGEN */}
      {/* ========================================================================= */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-4 h-4 text-indigo-600" />
                <span>{editingDishId ? 'Gericht / Speise bearbeiten' : 'Neues Gericht anlegen'}</span>
              </h3>
              <button
                onClick={() => setIsDishModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveDishForm} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              
              {/* Row 1: Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Name der Speise / des Drinks *
                  </label>
                  <input
                    type="text"
                    required
                    value={dishForm.name}
                    onChange={(e) => setDishForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z. B. Wiener Schnitzel, Angus Burger..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Kategorie *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={dishForm.category}
                      onChange={(e) => setDishForm(prev => ({ ...prev, category: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                    >
                      {customCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 font-bold"
                      title="Neue Kategorie"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Price & Tax Rate & Inventory */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Grundpreis (€) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dishForm.price}
                    onChange={(e) => setDishForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="z. B. 16.50"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    MwSt.-Satz
                  </label>
                  <select
                    value={dishForm.taxRate}
                    onChange={(e) => setDishForm(prev => ({ ...prev, taxRate: parseInt(e.target.value, 10) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    <option value={7}>7% (Speisen / Food)</option>
                    <option value={19}>19% (Getränke / Drinks)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Lagerbestand (Portionen)
                  </label>
                  <input
                    type="number"
                    value={dishForm.inventoryQty}
                    onChange={(e) => setDishForm(prev => ({ ...prev, inventoryQty: e.target.value }))}
                    placeholder="50"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              {/* Row 3: Photo / Image Upload & Presets */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-500" />
                    <span>Foto oder Bild für das Gericht</span>
                  </span>
                  {dishForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setDishForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="text-[11px] text-rose-500 font-semibold hover:underline"
                    >
                      Bild entfernen
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Image Preview Box */}
                  <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {dishForm.imageUrl ? (
                      <img src={dishForm.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-3xl">{dishForm.emoji || '🍽️'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-[200px] space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Foto hochladen</span>
                      </button>

                      <span className="text-[10px] text-slate-400">oder Bild-URL einfügen:</span>
                    </div>

                    <input
                      type="url"
                      value={dishForm.imageUrl}
                      onChange={(e) => setDishForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://... (Foto-Weblink)"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>
                </div>

                {/* Quick Presets Picker */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                    Schnellauswahl aus Gastro-Bildern:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {FOOD_PHOTO_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDishForm(prev => ({ ...prev, imageUrl: preset.url, emoji: preset.emoji }))}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 transition"
                      >
                        <span>{preset.emoji}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 4: Description */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Beschreibung & Zutaten
                </label>
                <textarea
                  rows={2}
                  value={dishForm.description}
                  onChange={(e) => setDishForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="z. B. Knusprig paniert mit Zitrone und frischen Kräutern..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              {/* Row 5: BEILAGEN & SUBKATEGORIEN MANAGER (Kartoffelsalat, Extras) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>Konfigurierbare Beilagen & Optionen ({dishForm.subcategories.length})</span>
                  </span>
                </div>

                {/* Subcategories list */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {dishForm.subcategories.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Keine Beilagen oder Extras definiert.</p>
                  ) : (
                    dishForm.subcategories.map(opt => (
                      <div
                        key={opt.id}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                            {opt.groupName}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{opt.name}</span>
                          <span className="font-mono text-slate-500 font-semibold">
                            {opt.extraPrice > 0 ? `+${opt.extraPrice.toFixed(2)} €` : '(inklusive / 0,00 €)'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSubcategoryOptionFromForm(opt.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Subcategory Option Line */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newSubcategoryGroup}
                      onChange={(e) => setNewSubcategoryGroup(e.target.value)}
                      placeholder="Gruppe (z.B. Beilage)"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newSubcategoryName}
                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                      placeholder="Option (z.B. Kartoffelsalat)"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newSubcategoryPrice}
                      onChange={(e) => setNewSubcategoryPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-center">
                    <button
                      type="button"
                      onClick={handleAddSubcategoryOptionToForm}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center"
                      title="Beilage hinzufügen"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Speise speichern</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD CATEGORY MODAL */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>Neue Kategorie erstellen</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Kategoriename:
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="z. B. Cocktails, Desserts, Tageskarte..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CHECKOUT & PAYMENT MODAL */}
      {/* ========================================================================= */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Zahlungsabschluss (Kasse)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Wählen Sie die Zahlungsart für diesen Kassenbon.
                </p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Total Amount Box */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Zu zahlender Gesamtbetrag:</span>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {cartSubtotal.toFixed(2)} €
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { sounds.playClick(); setPaymentMethod('cash'); }}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span className="text-xs">Barzahlung</span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setPaymentMethod('card'); }}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'card'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span className="text-xs">EC / Kreditkarte</span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setPaymentMethod('apple_pay'); }}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMethod === 'apple_pay'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-xs">Apple / NFC</span>
              </button>
            </div>

            {/* Cash Tendered & Change calculator */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Gegeben (Bar):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-24 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-right"
                    />
                    <span className="font-bold">€</span>
                  </div>
                </div>

                {/* Fast Cash Euro Buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[cartSubtotal, 10, 20, 50, 100].filter(v => v >= cartSubtotal || v === cartSubtotal).slice(0, 4).map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashTendered(val.toFixed(2))}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold font-mono hover:bg-slate-100"
                    >
                      {val === cartSubtotal ? 'Passend' : `${val} €`}
                    </button>
                  ))}
                </div>

                {/* Change return */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                  <span>Rückgeld:</span>
                  <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    {Math.max(0, (parseFloat(cashTendered) || cartSubtotal) - cartSubtotal).toFixed(2)} €
                  </span>
                </div>
              </div>
            )}

            {/* Complete Payment Button */}
            <button
              onClick={handleCompleteCheckout}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Zahlung buchen & Bon drucken</span>
            </button>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RECEIPT DETAILS & PRINT MODAL */}
      {/* ========================================================================= */}
      {(activeReceipt || selectedReceiptForDetails) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Kassenbeleg ({ (activeReceipt || selectedReceiptForDetails)?.receiptNumber })
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveReceipt(null);
                  setSelectedReceiptForDetails(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Thermal Print Receipt Style */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-3">
              <div className="text-center space-y-0.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                <h4 className="font-bold text-xs">{storeName}</h4>
                <p className="text-[10px] text-slate-400">{companyProfile.address || 'Hauptstraße 12 • 80331 München'}</p>
                <p className="text-[10px] text-slate-400">{new Date((activeReceipt || selectedReceiptForDetails)!.date).toLocaleString('de-DE')}</p>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {(activeReceipt || selectedReceiptForDetails)!.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <div>{item.qty}x {item.name}</div>
                      {item.selectedOptions?.map(o => (
                        <div key={o.id} className="text-[9px] text-slate-400 pl-2">
                          + {o.name} {o.extraPrice > 0 ? `(${o.extraPrice.toFixed(2)} €)` : ''}
                        </div>
                      ))}
                    </div>
                    <div className="font-bold">{(item.unitPrice * item.qty).toFixed(2)} €</div>
                  </div>
                ))}
              </div>

              {/* Total & Tax */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1">
                <div className="flex justify-between font-bold text-xs">
                  <span>GESAMTBETRAG:</span>
                  <span>{(activeReceipt || selectedReceiptForDetails)!.total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Zahlart:</span>
                  <span>{(activeReceipt || selectedReceiptForDetails)!.paymentMethod.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>TSE-Signatur:</span>
                  <span>{(activeReceipt || selectedReceiptForDetails)!.tseSignature || 'TSE-DE-OK'}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                {receiptFooter}
              </div>
            </div>

            {/* Print Action */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>Kassenbon drucken</span>
              </button>

              <button
                onClick={() => {
                  setActiveReceipt(null);
                  setSelectedReceiptForDetails(null);
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Schließen
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
