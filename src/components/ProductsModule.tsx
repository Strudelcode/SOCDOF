import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  PackagePlus, 
  Search, 
  Boxes, 
  AlertTriangle, 
  ArrowDownToLine, 
  ArrowUpRight, 
  Tag, 
  Edit2, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  TrendingUp,
  Layers,
  Link,
  Globe,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Users,
  Receipt,
  Eye,
  Info,
  ShoppingCart,
  EyeOff,
  Copy,
  QrCode,
  Smile,
  ChevronDown,
  Barcode
} from 'lucide-react';
import { Product, Invoice, StockMove } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { extractProductFromUrl, extractAmazonAsin } from '../lib/productLinkExtractor';
import { t, useLanguage } from '../lib/i18n';
import { SmartReorderModal } from './SmartReorderModal';
import { ProductLabelModal } from './ProductLabelModal';

const EMOJI_CATEGORIES = [
  { id: 'standard', label: 'Standard', icon: '📦' },
  { id: 'tech', label: 'IT & Tech', icon: '💻' },
  { id: 'tools', label: 'Tools', icon: '🛠️' },
  { id: 'food', label: 'Gastro', icon: '☕' },
  { id: 'fashion', label: 'Mode', icon: '👕' },
  { id: 'office', label: 'Büro', icon: '📚' },
  { id: 'mobility', label: 'Mobilität', icon: '🚗' },
  { id: 'misc', label: 'Diverses', icon: '⭐' }
];

const EMOJI_SETS: Record<string, string[]> = {
  standard: ['📦', '🏷️', '🎁', '📋', '🗃️', '🛒', '🏢', '🚚', '🏭', '✉️', '📦', '🧰'],
  tech: ['💻', '📱', '🖥️', '🖨️', '🎧', '🔌', '💾', '⌨️', '🖱️', '📷', '📡', '🔋', '🎮', '⌚', '💡'],
  tools: ['🛠️', '⚙️', '🔧', '🔨', '🪛', '🔩', '🎛️', '🪜', '🔒', '⚡', '🌡️', '📏'],
  food: ['☕', '🍕', '🍔', '🥐', '🥪', '🍎', '🍇', '🥩', '🧀', '🍺', '🍷', '🥤', '🍰', '🍫'],
  fashion: ['👕', '👖', '👗', '👟', '👞', '👓', '🎒', '👜', '🧢', '💍', '💎', '🧴'],
  office: ['📚', '📁', '📎', '✒️', '📝', '✂️', '📏', '🗂️', '📌', '📇', '🗞️', '🎨'],
  mobility: ['🚗', '🚲', '🛵', '🛴', '🚜', '🏎️', '🚀', '🚢', '🚂', '🚁', '🚚', '🛞'],
  misc: ['⭐', '🏷️', '💼', '🛡️', '🩺', '🌿', '🌸', '🏆', '🎯', '🔑', '🎵', '☀️']
};

const PRODUCT_TEMPLATES = [
  { id: 'hardware', labelKey: 'products.template_hardware', defaultLabel: 'Hardware & Elektronik', category: 'Hardware', unit: 'Stück', emoji: '💻' },
  { id: 'service', labelKey: 'products.template_service', defaultLabel: 'Dienstleistung & Service', category: 'Dienstleistung', unit: 'Std', emoji: '⚡', costPrice: 0 },
  { id: 'software', labelKey: 'products.template_software', defaultLabel: 'Software & Lizenz', category: 'Software', unit: 'Lizenz', emoji: '💾' },
  { id: 'spare', labelKey: 'products.template_spare', defaultLabel: 'Ersatzteil / Komponente', category: 'Ersatzteile', unit: 'Stück', emoji: '⚙️' },
  { id: 'office', labelKey: 'products.template_office', defaultLabel: 'Büromaterial & Verbrauch', category: 'Bürobedarf', unit: 'Stück', emoji: '📁' },
  { id: 'gastro', labelKey: 'products.template_gastro', defaultLabel: 'Gastronomie & Speisen', category: 'Gastronomie', unit: 'Port.', emoji: '☕' },
  { id: 'fashion', labelKey: 'products.template_fashion', defaultLabel: 'Bekleidung & Mode', category: 'Bekleidung', unit: 'Stück', emoji: '👕' },
  { id: 'retail', labelKey: 'products.template_retail', defaultLabel: 'Handelsware (Standard)', category: 'Handelsware', unit: 'Stück', emoji: '📦' }
];

interface ProductsModuleProps {
  products: Product[];
  invoices?: Invoice[];
  stockMoves?: StockMove[];
  onRefresh: () => void;
  onOpenStockTransfer: (productId?: number) => void;
  currency: string;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({
  products,
  invoices = [],
  stockMoves = [],
  onRefresh,
  onOpenStockTransfer,
  currency = '€'
}) => {
  const currentLang = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Icon & Emoji Picker and Quick Template states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedEmojiTab, setSelectedEmojiTab] = useState<string>('standard');
  
  // Link extraction state in modal
  const [linkInput, setLinkInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState('');

  // Detail / Customer allocation view modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // QR Code & Barcode Label Modal
  const [selectedLabelProduct, setSelectedLabelProduct] = useState<Product | null>(null);

  // Duplicate Product
  const handleDuplicateProduct = async (p: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      sounds.playClick();
      const newSku = `${p.sku}-COPY`;
      const duplicated: Product = {
        ...p,
        id: undefined,
        name: `${p.name} (Kopie)`,
        sku: newSku,
        qty_available: 0
      };
      await db.products.add(duplicated);
      sounds.playSuccess();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  // Categories extraction
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Allgemein')))];

  // Low stock counter
  const lowStockCount = useMemo(() => {
    return products.filter(p => (p.qty_available || 0) <= (p.min_qty ?? 5) && !p.exclude_from_reorder).length;
  }, [products]);

  const filteredProducts = products.filter((p) => {
    let matchesCat = true;
    if (selectedCategory === '__low_stock__') {
      matchesCat = (p.qty_available || 0) <= (p.min_qty ?? 5);
    } else if (selectedCategory === '__excluded__') {
      matchesCat = Boolean(p.exclude_from_reorder);
    } else if (selectedCategory !== 'all') {
      matchesCat = (p.category || 'Allgemein') === selectedCategory;
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.asin && p.asin.toLowerCase().includes(q)) ||
      (p.source_domain && p.source_domain.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Calculate allocation / delivered count for each product from invoices
  const productAllocations = useMemo(() => {
    const map = new Map<number, { totalSold: number; customers: { customerName: string; invoiceNumber: string; date: string; qty: number; total: number }[] }>();
    
    invoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      inv.items.forEach(item => {
        if (!item.product_id) return;
        const current = map.get(item.product_id) || { totalSold: 0, customers: [] };
        current.totalSold += (item.quantity || 0);
        current.customers.push({
          customerName: inv.contact_name || 'Kunde',
          invoiceNumber: inv.number,
          date: inv.date,
          qty: item.quantity || 0,
          total: item.total || 0
        });
        map.set(item.product_id, current);
      });
    });

    return map;
  }, [invoices]);

  const handleOpenCreate = () => {
    sounds.playClick();
    setLinkInput('');
    setExtractSuccessMsg('');
    setIsEmojiPickerOpen(false);
    setSelectedEmojiTab('standard');
    setEditingProduct({
      name: '',
      sku: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      sale_price: 100,
      cost_price: 50,
      qty_available: 0,
      min_qty: 5,
      target_stock: 15,
      unit: 'Stück',
      category: 'Hardware',
      image_emoji: '📦',
      description: '',
      exclude_from_reorder: false
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    sounds.playClick();
    setLinkInput(p.web_link || '');
    setExtractSuccessMsg('');
    setIsEmojiPickerOpen(false);
    setSelectedEmojiTab('standard');
    setEditingProduct({ ...p });
    setIsEditModalOpen(true);
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = PRODUCT_TEMPLATES.find(t => t.id === templateId);
    if (!tpl || !editingProduct) return;
    sounds.playSuccess();
    setEditingProduct({
      ...editingProduct,
      category: tpl.category,
      unit: tpl.unit,
      image_emoji: tpl.emoji,
      cost_price: tpl.costPrice !== undefined ? tpl.costPrice : editingProduct.cost_price,
    });
  };

  // Handle URL Paste / Extraction (e.g. Amazon, Onlineshop, Geizhals)
  const handleExtractFromUrl = () => {
    if (!linkInput.trim()) return;
    setIsExtracting(true);
    sounds.playClick();

    setTimeout(() => {
      const extracted = extractProductFromUrl(linkInput.trim());
      setIsExtracting(false);

      if (extracted) {
        setEditingProduct(prev => ({
          ...prev,
          name: extracted.name || prev?.name || '',
          sku: prev?.sku?.startsWith('PRD-') || !prev?.sku ? extracted.sku || prev?.sku : prev.sku,
          category: extracted.category || prev?.category || 'Hardware',
          web_link: linkInput.trim(),
          source_domain: extracted.source_domain,
          image_url: extracted.image_url || prev?.image_url,
          asin: extracted.asin || prev?.asin || extractAmazonAsin(linkInput.trim()) || undefined,
          description: extracted.description || prev?.description || (extracted.source_domain ? `Importiert von ${extracted.source_domain}` : '')
        }));
        setExtractSuccessMsg(`Produktdaten erfolgreich von ${extracted.source_domain} übernommen!`);
        sounds.playSuccess();
      } else {
        setExtractSuccessMsg('Link erkannt. Du kannst die Felder nun beliebig anpassen.');
      }
    }, 400);
  };

  // Handle Local Image Upload (Stored directly offline as Base64 data URI)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Das Bild ist zu groß (maximal 2 MB erlaubt).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setEditingProduct(prev => ({
          ...prev,
          image_url: base64
        }));
        sounds.playSuccess();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.sku) {
      sounds.playError();
      return;
    }

    try {
      if (editingProduct.id) {
        await db.products.update(editingProduct.id, {
          ...editingProduct,
          name: editingProduct.name.trim(),
          sku: editingProduct.sku.trim(),
          sale_price: Number(editingProduct.sale_price) || 0,
          cost_price: Number(editingProduct.cost_price) || 0,
          qty_available: Number(editingProduct.qty_available) || 0,
          min_qty: Number(editingProduct.min_qty) !== undefined ? Number(editingProduct.min_qty) : 5,
          target_stock: Number(editingProduct.target_stock) || undefined,
          asin: editingProduct.asin?.trim() || (editingProduct.web_link ? extractAmazonAsin(editingProduct.web_link) || undefined : undefined),
          exclude_from_reorder: Boolean(editingProduct.exclude_from_reorder),
          unit: editingProduct.unit || 'Stück',
          category: editingProduct.category || 'Allgemein',
          image_emoji: editingProduct.image_emoji || '📦',
          image_url: editingProduct.image_url || undefined,
          web_link: editingProduct.web_link || undefined,
          source_domain: editingProduct.source_domain || undefined,
          description: editingProduct.description || ''
        });
      } else {
        await db.products.add({
          name: editingProduct.name.trim(),
          sku: editingProduct.sku.trim(),
          sale_price: Number(editingProduct.sale_price) || 0,
          cost_price: Number(editingProduct.cost_price) || 0,
          qty_available: Number(editingProduct.qty_available) || 0,
          min_qty: Number(editingProduct.min_qty) !== undefined ? Number(editingProduct.min_qty) : 5,
          target_stock: Number(editingProduct.target_stock) || 15,
          asin: editingProduct.asin?.trim() || (editingProduct.web_link ? extractAmazonAsin(editingProduct.web_link) || undefined : undefined),
          exclude_from_reorder: Boolean(editingProduct.exclude_from_reorder),
          unit: editingProduct.unit || 'Stück',
          category: editingProduct.category || 'Allgemein',
          image_emoji: editingProduct.image_emoji || '📦',
          image_url: editingProduct.image_url || undefined,
          web_link: editingProduct.web_link || undefined,
          source_domain: editingProduct.source_domain || undefined,
          description: editingProduct.description || '',
          createdAt: new Date().toISOString()
        });
      }

      sounds.playSuccess();
      setIsEditModalOpen(false);
      setEditingProduct(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm(t('products.delete_confirm', currentLang, 'Dieses Produkt wirklich löschen?'))) return;
    try {
      await db.products.delete(id);
      sounds.playSuccess();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Selection: Dropdown on compact screens, Pills on large screens */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compact Dropdown (mobile, tablet & smaller desktop windows) */}
          <div className="flex lg:hidden items-center gap-1.5">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  sounds.playClick();
                  setSelectedCategory(e.target.value);
                }}
                aria-label={t('products.category_select_label', currentLang, 'Kategorie')}
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-7 py-2 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs appearance-none"
              >
                <option value="all">{t('products.all_categories', currentLang, 'Alle Kategorien')}</option>
                {categories.filter(c => c !== 'all' && c !== '__low_stock__').map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__low_stock__">⚠️ {t('products.low_stock_pill', currentLang, 'Knappe Bestände')} ({lowStockCount})</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {lowStockCount > 0 && selectedCategory !== '__low_stock__' && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory('__low_stock__');
                }}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900 transition flex items-center gap-1 cursor-pointer"
                title={t('products.low_stock_pill', currentLang, 'Knappe Bestände filtern')}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11px] font-bold">{lowStockCount}</span>
              </button>
            )}
          </div>

          {/* Expanded Pills (wide desktop windows) */}
          <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat === 'all' ? t('products.all_categories', currentLang, 'Alle Kategorien') : cat}
              </button>
            ))}

            {/* Low Stock Quick Filter Pill */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedCategory(selectedCategory === '__low_stock__' ? 'all' : '__low_stock__');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
                selectedCategory === '__low_stock__'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{t('products.low_stock_pill', currentLang, 'Knappe Bestände')} ({lowStockCount})</span>
            </button>
          </div>
        </div>

        {/* Live Search, Smart Reorder & Create Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1 justify-end min-w-0">
          <div className="relative flex-1 min-w-[130px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('products.search_placeholder', currentLang, 'Produkt, SKU oder Link suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
            />
          </div>

          {/* Smart Reorder Button - Compact & Balanced */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsReorderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
            title={t('products.smart_reorder_tooltip', currentLang, 'Nachbestell-Assistent für knappe Lagerbestände & Amazon-Warenkorb')}
          >
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            <span>{t('products.btn_reorder_short', currentLang, 'Nachbestellen')}</span>
            {lowStockCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shrink-0">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5 shrink-0" />
            <span>{t('products.btn_new_product', currentLang, 'Neues Produkt')}</span>
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-500" />
            <span>{t('products.catalog_title', currentLang, 'Produktkatalog & Bestandsübersicht')} ({filteredProducts.length} {t('invoice.entries', currentLang, 'Artikel')})</span>
          </h2>
          {lowStockCount > 0 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lowStockCount} {t('products.low_stock_warning_link', currentLang, 'Artikel nachbestellen')} &rarr;</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4 w-12 text-center">{t('products.th_image', currentLang, 'Bild')}</th>
                <th className="p-4">{t('products.th_name', currentLang, 'Artikel / Bezeichnung')}</th>
                <th className="p-4">{t('products.th_sku', currentLang, 'SKU / ASIN')}</th>
                <th className="p-4">{t('products.th_category', currentLang, 'Kategorie')}</th>
                <th className="p-4 text-right">{t('products.th_cost_price', currentLang, 'Einkaufspreis (EK)')}</th>
                <th className="p-4 text-right">{t('products.th_sale_price', currentLang, 'Verkaufspreis (VK)')}</th>
                <th className="p-4 text-right">{t('products.th_margin', currentLang, 'Marge / Gewinn')}</th>
                <th className="p-4 text-center">{t('products.th_stock', currentLang, 'Auf Lager')}</th>
                <th className="p-4 text-center">{t('products.th_allocated', currentLang, 'An Kunden vergeben')}</th>
                <th className="p-4 text-right">{t('products.th_actions', currentLang, 'Aktionen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    {t('products.empty_list', currentLang, 'Keine Produkte gefunden.')}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const qty = p.qty_available || 0;
                  const isLowStock = qty <= (p.min_qty ?? 5);
                  const allocation = p.id ? productAllocations.get(p.id) : undefined;
                  const soldQty = allocation?.totalSold || 0;
                  const asin = p.asin || (p.web_link ? extractAmazonAsin(p.web_link) : null);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      {/* Product Thumbnail / Icon */}
                      <td className="p-4 text-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 mx-auto">
                          {p.image_url ? (
                            <img 
                              src={p.image_url} 
                              alt={p.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-0.5" 
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-lg">{p.image_emoji || '📦'}</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {p.name}
                          </span>
                          {p.web_link && (
                            <a
                              href={p.web_link}
                              target="_blank"
                              rel="noreferrer"
                              title={`${t('products.open_link_tooltip', currentLang, 'Produktlink öffnen')}: ${p.source_domain || p.web_link}`}
                              className="p-1 text-slate-400 hover:text-sky-500 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {p.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                            {p.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.source_domain && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                              <Globe className="w-2.5 h-2.5" />
                              <span>{p.source_domain}</span>
                            </span>
                          )}
                          {p.exclude_from_reorder && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-semibold">
                              <EyeOff className="w-2.5 h-2.5" />
                              <span>{t('reorder.badge_excluded', undefined, 'Nicht nachbestellen')}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-mono-num text-slate-600 dark:text-slate-300">
                        <div className="font-medium">{p.sku}</div>
                        {asin && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            ASIN: {asin}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.category || 'Allgemein'}
                        </span>
                      </td>

                      <td className="p-4 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {formatCurrency(p.cost_price || 0)}
                      </td>

                      <td className="p-4 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                        {formatCurrency(p.sale_price || 0)}
                      </td>

                      {/* Profit Margin */}
                      <td className="p-4 text-right">
                        {p.sale_price !== undefined && p.cost_price !== undefined ? (
                          <div>
                            <div className={`font-mono font-bold text-xs ${((p.sale_price || 0) - (p.cost_price || 0)) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                              {formatCurrency((p.sale_price || 0) - (p.cost_price || 0))}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.sale_price > 0 
                                ? `${(((p.sale_price - p.cost_price) / p.sale_price) * 100).toFixed(1)}%` 
                                : '0.0%'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Stock on Hand */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`inline-flex items-center gap-1 font-mono-num font-bold px-2.5 py-1 rounded-lg text-xs ${
                            isLowStock
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-900'
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {isLowStock && <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />}
                            <span>{qty} {p.unit || 'Stk.'}</span>
                          </span>
                          {isLowStock && (
                            <span className="text-[10px] text-rose-500 font-semibold mt-0.5">
                              {t('products.low_stock', undefined, 'Niedrig')} (&le; {p.min_qty ?? 5})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Allocations */}
                      <td className="p-4 text-center">
                        {soldQty > 0 ? (
                          <button
                            onClick={() => setSelectedProductDetail(p)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-semibold transition"
                            title={t('products.btn_view_allocations', currentLang, 'Kunden & Auftragszuordnungen einsehen')}
                          >
                            <Users className="w-3 h-3" />
                            <span>{soldQty} {p.unit || 'Stk.'}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isLowStock && (
                            <button
                              onClick={() => {
                                sounds.playClick();
                                setIsReorderModalOpen(true);
                              }}
                              title={t('products.btn_reorder_row_tooltip', currentLang, '1-Klick Nachbestellung im Bestellvorschlag öffnen')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-2xs"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span>{t('products.btn_reorder_short', currentLang, 'Nachbestellen')}</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              sounds.playClick();
                              onOpenStockTransfer(p.id);
                            }}
                            title={t('products.btn_book_stock_tooltip', currentLang, 'Lagerbestand buchen / Wareneingang erfassen')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold transition"
                          >
                            <ArrowDownToLine className="w-3 h-3" />
                            <span>{t('products.btn_book_stock', currentLang, 'Buchen')}</span>
                          </button>

                          {/* Print QR / Barcode Label */}
                          <button
                            onClick={() => {
                              sounds.playClick();
                              setSelectedLabelProduct(p);
                            }}
                            title={t('products.btn_qr_label', currentLang, 'Barcode / QR-Etikett drucken')}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                          </button>

                          {/* Duplicate Product */}
                          <button
                            onClick={(e) => handleDuplicateProduct(p, e)}
                            title={t('products.btn_duplicate_tooltip', currentLang, 'Artikel als neuen Katalogeintrag duplizieren')}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-500" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(p)}
                            title={t('action.edit', currentLang, 'Bearbeiten')}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => p.id && handleDeleteProduct(p.id)}
                            title={t('action.delete', currentLang, 'Löschen')}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smart Reorder & Amazon Cart Generator Modal */}
      <SmartReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        products={products}
        onRefreshProducts={onRefresh}
        currency={currency}
      />

      {/* Product Barcode & QR Label Printing Modal */}
      {selectedLabelProduct && (
        <ProductLabelModal
          isOpen={!!selectedLabelProduct}
          onClose={() => setSelectedLabelProduct(null)}
          product={selectedLabelProduct}
          currency={currency}
        />
      )}

      {/* Customer Allocation Detail Modal */}
      {selectedProductDetail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {t('products.alloc_modal_title', currentLang, 'Kunden- & Auftragsvergabe')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedProductDetail.name} ({selectedProductDetail.sku})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {(() => {
                const alloc = selectedProductDetail.id ? productAllocations.get(selectedProductDetail.id) : undefined;
                if (!alloc || alloc.customers.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      {t('products.alloc_empty', currentLang, 'Noch keine Kundenaufträge für diesen Artikel vorhanden.')}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1 flex justify-between">
                      <span>{t('products.alloc_customer_header', currentLang, 'Kunde & Rechnungs-Nr.')}</span>
                      <span>{t('products.alloc_qty_header', currentLang, 'Vergebene Menge / Summe')}</span>
                    </div>
                    {alloc.customers.map((c, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {c.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {t('invoice.title', currentLang, 'Rechnung')} {c.invoiceNumber} • {c.date}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 font-mono-num">
                            {c.qty} {selectedProductDetail.unit || 'Stk.'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-num">
                            {formatCurrency(c.total)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProductDetail(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl transition"
              >
                {t('common.close', undefined, 'Schließen')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit Product Modal with Web Link & Image Upload */}
      {isEditModalOpen && editingProduct && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0 shadow-2xs">
                  <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {editingProduct.id ? t('products.edit_title', currentLang, 'Produkt bearbeiten') : t('products.create_title', currentLang, 'Neues Produkt erfassen')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingProduct.id ? (editingProduct.name || editingProduct.sku) : t('products.create_subtitle', currentLang, 'Stammdaten, Preise, Barcodes und Lagerbestände')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form wrapping scrollable content and sticky footer */}
            <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                
                {/* Quick Template Selector (Auswahlmenü für Schnellvorlagen) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t('products.template_picker_label', currentLang, 'Schnell-Vorlage')}:</span>
                  </div>
                  <select
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                    defaultValue=""
                    className="text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs font-medium"
                    title={t('products.template_picker_label', currentLang, 'Schnell-Vorlage')}
                  >
                    <option value="" disabled>{t('products.template_choose', currentLang, 'Vorlage wählen...')}</option>
                    {PRODUCT_TEMPLATES.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.emoji} {t(tpl.labelKey, currentLang, tpl.defaultLabel)}</option>
                    ))}
                  </select>
                </div>

                {/* Optional Web Link Import (Amazon, Geizhals, Shop) */}
                <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-sky-500" />
                    <span>{t('products.modal_weblink_label', undefined, 'Optional: Produkt-Weblink eintragen (z. B. Amazon, Lieferanten-Shop)')}</span>
                  </label>
                  <p className="text-[11px] text-sky-700 dark:text-sky-300">
                    {t('products.modal_weblink_desc', undefined, 'Füge einen Weblink ein, um Titel, Kategorie, ASIN, Bild und Daten automatisch vorzubelegen.')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder={t('products.modal_weblink_placeholder', undefined, 'https://www.amazon.de/dp/... oder Onlineshop-Link')}
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800/80 rounded-xl focus:outline-none focus:border-sky-500 font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={handleExtractFromUrl}
                      disabled={!linkInput.trim() || isExtracting}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isExtracting ? t('common.loading', undefined, 'Analysiere...') : t('products.btn_import_link', undefined, 'Daten übernehmen')}</span>
                    </button>
                  </div>
                  {extractSuccessMsg && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{extractSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Image & Emoji Preview with Selection Menu & Upload */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-4">
                    {/* Interactive Icon Box with Dropdown Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setIsEmojiPickerOpen(!isEmojiPickerOpen);
                        }}
                        title={t('products.icon_picker_title', undefined, 'Produkt-Icon / Emoji auswählen')}
                        className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 flex items-center justify-center overflow-hidden shrink-0 shadow-xs cursor-pointer group transition active:scale-95"
                      >
                        {editingProduct.image_url ? (
                          <img
                            src={editingProduct.image_url}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-2xl group-hover:scale-110 transition-transform">{editingProduct.image_emoji || '📦'}</span>
                        )}
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900 group-hover:bg-indigo-700">
                          <Smile className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{t('products.modal_image_label', undefined, 'Produktbild / Icon')}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Emoji Selection Menu Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setIsEmojiPickerOpen(!isEmojiPickerOpen);
                          }}
                          className={`px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isEmojiPickerOpen 
                              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40' 
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500'
                          }`}
                        >
                          <Smile className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{t('products.icon_picker_btn', undefined, 'Icon / Emoji wählen')}</span>
                          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isEmojiPickerOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* File Upload */}
                        <label className="cursor-pointer px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 transition flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{t('products.modal_upload_image', undefined, 'Eigenes Bild hochladen')}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileUpload} 
                            className="hidden" 
                          />
                        </label>

                        {editingProduct.image_url && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setEditingProduct({ ...editingProduct, image_url: undefined });
                            }}
                            className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                          >
                            {t('products.modal_remove_image', undefined, 'Bild entfernen')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Popover Emoji Dropdown */}
                  {isEmojiPickerOpen && (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 shadow-lg animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Smile className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{t('products.icon_picker_title', undefined, 'Produkt-Icon / Emoji auswählen')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEmojiPickerOpen(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Category tabs */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {EMOJI_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setSelectedEmojiTab(cat.id);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                              selectedEmojiTab === cat.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Emoji Grid */}
                      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 max-h-36 overflow-y-auto">
                        {(EMOJI_SETS[selectedEmojiTab] || EMOJI_SETS.standard).map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            type="button"
                            onClick={() => {
                              sounds.playPop();
                              setEditingProduct({
                                ...editingProduct,
                                image_emoji: emoji,
                                image_url: undefined
                              });
                              setIsEmojiPickerOpen(false);
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:scale-115 active:scale-90 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer ${
                              editingProduct.image_emoji === emoji && !editingProduct.image_url
                                ? 'bg-indigo-100 dark:bg-indigo-900/60 ring-2 ring-indigo-500'
                                : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Custom Emoji Input Field */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {t('products.icon_custom_placeholder', undefined, 'Eigenes Emoji:')}
                        </span>
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="z. B. 📦, 💻, 🍕"
                          value={editingProduct.image_emoji || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setEditingProduct({ ...editingProduct, image_emoji: val || '📦', image_url: undefined });
                          }}
                          className="w-24 px-2 py-1 text-center text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100"
                        />
                        <span className="text-[10px] text-slate-400">
                          (Tastatur: Win + .)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_name_label', undefined, 'Produktname / Bezeichnung *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('products.modal_name_placeholder', undefined, 'z. B. IoT Gateway 5G Ultra')}
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs font-medium"
                  />
                </div>

                {/* SKU, Category & Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_sku_label', undefined, 'Artikelnummer (SKU) *')}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="PRD-001"
                      value={editingProduct.sku || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_category_label', undefined, 'Kategorie')}
                    </label>
                    <input
                      type="text"
                      list="product-categories-datalist"
                      placeholder="Hardware, Software..."
                      value={editingProduct.category || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                    <datalist id="product-categories-datalist">
                      {categories.filter(c => c !== 'all' && c !== '__low_stock__').map(c => (
                        <option key={c} value={c} />
                      ))}
                      <option value="Hardware" />
                      <option value="Dienstleistung" />
                      <option value="Software" />
                      <option value="Ersatzteile" />
                      <option value="Bürobedarf" />
                      <option value="Gastronomie" />
                      <option value="Bekleidung" />
                      <option value="Handelsware" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_unit_label', undefined, 'Einheit')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('products.modal_unit_placeholder', undefined, 'Stück, Std, Lizenz, kg')}
                      value={editingProduct.unit || 'Stück'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Cost & Sale Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_cost_price_label', undefined, 'Einkaufspreis (EK)')} in {currency}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50.00"
                      value={editingProduct.cost_price ?? ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_sale_price_label', undefined, 'Verkaufspreis (VK)')} in {currency} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="120.00"
                      value={editingProduct.sale_price ?? ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Stock Quantities */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('products.modal_stock_qty_label', undefined, 'Lagerbestand')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.qty_available ?? 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, qty_available: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" title="Schwellenwert für Knappe Bestände">
                      {t('products.modal_min_qty_label', undefined, 'Mindestbestand')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.min_qty ?? 5}
                      onChange={(e) => setEditingProduct({ ...editingProduct, min_qty: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" title="Zielbestand beim Auffüllen">
                      {t('products.modal_target_stock_label', undefined, 'Zielbestand')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="15"
                      value={editingProduct.target_stock ?? 15}
                      onChange={(e) => setEditingProduct({ ...editingProduct, target_stock: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Barcode / EAN, ASIN & Reorder Exclusion */}
                <div className="p-3.5 bg-amber-50/60 dark:bg-slate-800/60 border border-amber-200/80 dark:border-slate-700/80 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{t('products.modal_barcode_label', undefined, 'Barcode / EAN / GTIN')}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="z. B. 4012345678901"
                        value={editingProduct.barcode || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value.trim() })}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-amber-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('products.modal_asin_label', undefined, 'Amazon ASIN (10 Zeichen)')}</span>
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="z. B. B08N5WRWNW"
                        value={editingProduct.asin || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, asin: e.target.value.toUpperCase().trim() })}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase focus:border-amber-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      id="exclude_from_reorder_cb"
                      checked={Boolean(editingProduct.exclude_from_reorder)}
                      onChange={(e) => setEditingProduct({ ...editingProduct, exclude_from_reorder: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      editingProduct.exclude_from_reorder
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent group-hover:border-amber-500'
                    }`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t('products.modal_exclude_reorder_label', undefined, 'Von automatischen Nachbestellungen / Amazon-Warenkorb ausschließen')}
                    </span>
                  </label>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_desc_label', undefined, 'Beschreibung & interne Notizen')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('products.modal_desc_placeholder', undefined, 'Technische Details, Lieferantenhinweise, Notizen...')}
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs resize-none"
                  />
                </div>

              </div>

              {/* Sticky Modal Action Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {t('common.cancel', currentLang, 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingProduct.id ? t('products.btn_save_changes', currentLang, 'Änderungen speichern') : t('products.btn_create', currentLang, 'Produkt erstellen')}</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
