import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  X, 
  Package, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  EyeOff, 
  Eye, 
  Layers, 
  Boxes, 
  FileText, 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  Store,
  DollarSign
} from 'lucide-react';
import { Product, PurchaseOrder } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { 
  buildAmazonMultiCartUrl, 
  buildAmazonSearchUrl, 
  extractAmazonAsin 
} from '../lib/productLinkExtractor';
import { t } from '../lib/i18n';

interface SmartReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRefreshProducts: () => void;
  currency: string;
  onNavigateToPurchases?: () => void;
}

export const SmartReorderModal: React.FC<SmartReorderModalProps> = ({
  isOpen,
  onClose,
  products,
  onRefreshProducts,
  currency = '€',
  onNavigateToPurchases
}) => {
  // Amazon regional domain selection
  const [selectedDomain, setSelectedDomain] = useState<string>('amazon.de');
  
  // Custom threshold mode: 'individual' (uses product.min_qty) or fixed number
  const [thresholdMode, setThresholdMode] = useState<'individual' | 'fixed'>('individual');
  const [fixedThreshold, setFixedThreshold] = useState<number>(5);

  // Search & Filter within modal
  const [searchQuery, setSearchQuery] = useState('');
  const [showExcludedOnly, setShowExcludedOnly] = useState(false);

  // Local state for reorder quantities and active inclusions for each product
  const [reorderQuantities, setReorderQuantities] = useState<Record<number, number>>({});
  const [activeInclusions, setActiveInclusions] = useState<Record<number, boolean>>({});
  const [editingAsins, setEditingAsins] = useState<Record<number, string>>({});
  const [isEditingAsinId, setIsEditingAsinId] = useState<number | null>(null);

  // Notification / Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [poCreatedMsg, setPoCreatedMsg] = useState('');

  // 1. Identify low-stock candidates
  const lowStockCandidates = useMemo(() => {
    return products.filter((p) => {
      const stock = p.qty_available || 0;
      if (thresholdMode === 'individual') {
        const min = p.min_qty !== undefined ? p.min_qty : 5;
        return stock <= min;
      } else {
        return stock <= fixedThreshold;
      }
    });
  }, [products, thresholdMode, fixedThreshold]);

  // Sync initial reorder quantities and inclusions when candidate list changes
  React.useEffect(() => {
    setReorderQuantities(prev => {
      const updated = { ...prev };
      lowStockCandidates.forEach(p => {
        if (p.id && updated[p.id] === undefined) {
          const currentStock = p.qty_available || 0;
          const target = p.target_stock || (p.min_qty ? p.min_qty * 2 : 10);
          const diff = Math.max(1, target - currentStock);
          updated[p.id] = diff;
        }
      });
      return updated;
    });

    setActiveInclusions(prev => {
      const updated = { ...prev };
      lowStockCandidates.forEach(p => {
        if (p.id && updated[p.id] === undefined) {
          // If product is permanently marked as excluded, start unchecked
          updated[p.id] = !p.exclude_from_reorder;
        }
      });
      return updated;
    });
  }, [lowStockCandidates]);

  // Filter candidates based on search & excluded toggle
  const filteredCandidates = useMemo(() => {
    return lowStockCandidates.filter(p => {
      const isExcluded = p.exclude_from_reorder || !activeInclusions[p.id || 0];
      if (showExcludedOnly && !isExcluded) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.asin && p.asin.toLowerCase().includes(q)) ||
        (p.source_domain && p.source_domain.toLowerCase().includes(q))
      );
    });
  }, [lowStockCandidates, searchQuery, showExcludedOnly, activeInclusions]);

  // Calculate items ready for Amazon Cart (those included and with valid ASIN)
  const cartItemsWithAsin = useMemo(() => {
    return lowStockCandidates
      .filter(p => p.id && activeInclusions[p.id])
      .map(p => {
        const asin = p.asin || (p.web_link ? extractAmazonAsin(p.web_link) : null);
        const qty = (p.id && reorderQuantities[p.id]) ? reorderQuantities[p.id] : 1;
        return {
          product: p,
          asin: asin ? asin.toUpperCase() : null,
          quantity: qty
        };
      })
      .filter(item => Boolean(item.asin && item.asin.length === 10));
  }, [lowStockCandidates, activeInclusions, reorderQuantities]);

  // Items included but missing ASIN
  const itemsMissingAsin = useMemo(() => {
    return lowStockCandidates
      .filter(p => p.id && activeInclusions[p.id])
      .filter(p => {
        const asin = p.asin || (p.web_link ? extractAmazonAsin(p.web_link) : null);
        return !asin || asin.length !== 10;
      });
  }, [lowStockCandidates, activeInclusions]);

  // Amazon Multi-Item Cart URL
  const amazonCartUrl = useMemo(() => {
    const formatted = cartItemsWithAsin.map(it => ({
      asin: it.asin!,
      quantity: it.quantity
    }));
    return buildAmazonMultiCartUrl(formatted, selectedDomain);
  }, [cartItemsWithAsin, selectedDomain]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalItemsInCart = 0;
    let estimatedTotalCost = 0;
    let excludedCount = 0;

    lowStockCandidates.forEach(p => {
      const isIncluded = p.id ? activeInclusions[p.id] : false;
      if (isIncluded && p.id) {
        const qty = reorderQuantities[p.id] || 1;
        totalItemsInCart += qty;
        estimatedTotalCost += (p.cost_price || p.sale_price || 0) * qty;
      } else {
        excludedCount++;
      }
    });

    return {
      lowStockCount: lowStockCandidates.length,
      totalUnitsToOrder: totalItemsInCart,
      estimatedCost: estimatedTotalCost,
      excludedCount,
      asinReadyCount: cartItemsWithAsin.length,
      missingAsinCount: itemsMissingAsin.length
    };
  }, [lowStockCandidates, activeInclusions, reorderQuantities, cartItemsWithAsin, itemsMissingAsin]);

  if (!isOpen) return null;

  // Toggle exclusion permanently in DB or temporary in modal
  const handleTogglePermanentExclusion = async (p: Product) => {
    if (!p.id) return;
    const newExcluded = !p.exclude_from_reorder;
    sounds.playClick();
    try {
      await db.products.update(p.id, { exclude_from_reorder: newExcluded });
      setActiveInclusions(prev => ({ ...prev, [p.id!]: !newExcluded }));
      onRefreshProducts();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleToggleItemInclusion = (productId: number) => {
    sounds.playClick();
    setActiveInclusions(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const handleQtyChange = (productId: number, delta: number) => {
    sounds.playClick();
    setReorderQuantities(prev => {
      const current = prev[productId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleSetExactQty = (productId: number, val: number) => {
    setReorderQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, val)
    }));
  };

  const handleSaveAsin = async (productId: number) => {
    const raw = editingAsins[productId] || '';
    const extracted = extractAmazonAsin(raw) || raw.trim().toUpperCase();
    sounds.playSuccess();
    try {
      await db.products.update(productId, { asin: extracted });
      setIsEditingAsinId(null);
      onRefreshProducts();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleCopyCartUrl = () => {
    if (!amazonCartUrl) return;
    sounds.playClick();
    navigator.clipboard.writeText(amazonCartUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenAmazonCart = () => {
    if (!amazonCartUrl) return;
    sounds.playClick();
    window.open(amazonCartUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy structured replenishment text list
  const handleCopyReplenishmentList = () => {
    sounds.playClick();
    const included = lowStockCandidates.filter(p => p.id && activeInclusions[p.id]);
    if (included.length === 0) return;

    let text = `📦 SOCDOF REORDER / REPLENISHMENT LIST (${new Date().toLocaleDateString()})\n`;
    text += `=========================================================\n`;
    included.forEach((p, idx) => {
      const qty = p.id ? reorderQuantities[p.id] || 1 : 1;
      const asin = p.asin || (p.web_link ? extractAmazonAsin(p.web_link) : 'N/A');
      const unitCost = p.cost_price ? `${p.cost_price.toFixed(2)} ${currency}` : '-';
      text += `${idx + 1}. ${p.name} | SKU: ${p.sku} | ASIN: ${asin}\n`;
      text += `   Menge / Qty: ${qty} ${p.unit || 'Stk.'} | EK: ${unitCost} | Link: ${p.web_link || 'N/A'}\n\n`;
    });
    text += `=========================================================\n`;
    text += `Gesamtpositionen: ${included.length} | Geschätzte Kosten: ${stats.estimatedCost.toFixed(2)} ${currency}\n`;

    navigator.clipboard.writeText(text);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
  };

  // Create Draft Purchase Order in SOCDOF
  const handleCreateSOCDOFPurchaseOrder = async () => {
    const included = lowStockCandidates.filter(p => p.id && activeInclusions[p.id]);
    if (included.length === 0) {
      sounds.playError();
      return;
    }
    sounds.playSuccess();

    try {
      const orderItems = included.map(p => {
        const qty = p.id ? reorderQuantities[p.id] || 1 : 1;
        const unitCost = p.cost_price || p.sale_price || 0;
        return {
          id: `item_${Date.now()}_${p.id}`,
          product_id: p.id!,
          product_name: p.name,
          sku: p.sku,
          qty,
          unit_cost: unitCost,
          tax_rate: 19,
          subtotal: unitCost * qty
        };
      });

      const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const tax_total = subtotal * 0.19;
      const total = subtotal + tax_total;
      const poNumber = `PO/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
      const expectedDelivery = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

      await db.purchase_orders.add({
        vendor_id: 1,
        vendor_name: `Amazon & Multi-Vendor Hub (${selectedDomain})`,
        number: poNumber,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: expectedDelivery,
        status: 'draft',
        items: orderItems,
        subtotal,
        tax_total,
        total,
        notes: `Automatisch generiert über den SOCDOF Smart Reorder Hub für ${included.length} knappe Artikel.`
      });

      setPoCreatedMsg(t('reorder.po_created_success', undefined, 'Bestellentwurf {number} mit {count} Artikeln im Einkauf angelegt!').replace('{number}', poNumber).replace('{count}', String(included.length)));
      setTimeout(() => setPoCreatedMsg(''), 4000);
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('reorder.modal_title', undefined, 'Smart Reorder Assistant & Amazon Cart Generator')}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Sparkles className="w-3 h-3" />
                  <span>SOCDOF Hub</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('reorder.subtitle', undefined, 'Knappe Bestände automatisch identifizieren, Nachbestellmengen anpassen und 1-Klick Amazon-Warenkorb-Links generieren.')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* KPI Analytics Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>{t('reorder.kpi_low_stock', undefined, 'Knappe Bestände')}</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
                {stats.lowStockCount} <span className="text-xs font-normal text-slate-400">Artikel</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('reorder.kpi_in_cart', undefined, 'Im Warenkorb')}</span>
              </div>
              <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1">
                {stats.totalUnitsToOrder} <span className="text-xs font-normal text-slate-400">Einheiten</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('reorder.kpi_asin_ready', undefined, 'Amazon ASIN bereit')}</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {stats.asinReadyCount} <span className="text-xs font-normal text-slate-400">von {stats.lowStockCount - stats.excludedCount}</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('reorder.kpi_est_cost', undefined, 'Geschätzte EK-Summe')}</span>
              </div>
              <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {stats.estimatedCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </div>
            </div>
          </div>

          {/* Configuration & Controls Bar */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Amazon Marketplace Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-amber-500" />
                  <span>{t('reorder.amazon_domain_label', undefined, 'Amazon Marktplatz')}</span>
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-amber-500 font-semibold"
                >
                  <option value="amazon.de">🇩🇪 Amazon Deutschland (amazon.de)</option>
                  <option value="amazon.com">🇺🇸 Amazon USA / Global (amazon.com)</option>
                  <option value="amazon.co.uk">🇬🇧 Amazon UK (amazon.co.uk)</option>
                  <option value="amazon.fr">🇫🇷 Amazon France (amazon.fr)</option>
                  <option value="amazon.es">🇪🇸 Amazon España (amazon.es)</option>
                  <option value="amazon.it">🇮🇹 Amazon Italia (amazon.it)</option>
                </select>
              </div>

              {/* Threshold Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-500" />
                  <span>{t('reorder.stock_threshold_label', undefined, 'Bestandsschwelle für "Knapp"')}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={thresholdMode}
                    onChange={(e) => setThresholdMode(e.target.value as 'individual' | 'fixed')}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="individual">{t('reorder.threshold_individual', undefined, 'Individueller Mindestbestand (min_qty)')}</option>
                    <option value="fixed">{t('reorder.threshold_fixed', undefined, 'Fester Schwellenwert (z.B. ≤ X Stück)')}</option>
                  </select>
                  {thresholdMode === 'fixed' && (
                    <input
                      type="number"
                      min="1"
                      value={fixedThreshold}
                      onChange={(e) => setFixedThreshold(parseInt(e.target.value) || 1)}
                      className="w-16 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Filter Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('products.search_placeholder', undefined, 'Filtern nach Name, SKU, ASIN...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowExcludedOnly(!showExcludedOnly)}
                className={`p-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 whitespace-nowrap ${
                  showExcludedOnly 
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title={showExcludedOnly ? 'Alle anzeigen' : 'Nur ausgeschlossene anzeigen'}
              >
                {showExcludedOnly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {showExcludedOnly ? t('reorder.show_all', undefined, 'Alle anzeigen') : t('reorder.show_excluded', undefined, 'Ausgeschlossene')} ({stats.excludedCount})
                </span>
              </button>
            </div>
          </div>

          {/* Missing ASIN Notification Banner */}
          {stats.missingAsinCount > 0 && (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {t('reorder.missing_asin_warning', undefined, '{count} Artikel haben noch keine hinterlegte Amazon ASIN. Für diese kannst du direkt per Suche oder Weblink bestellen oder die ASIN eintragen.').replace('{count}', String(stats.missingAsinCount))}
                </span>
              </div>
            </div>
          )}

          {/* Success Message for PO Creation */}
          {poCreatedMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-semibold animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{poCreatedMsg}</span>
              </div>
              {onNavigateToPurchases && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToPurchases();
                  }}
                  className="underline text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold"
                >
                  Zum Einkauf wechseln &rarr;
                </button>
              )}
            </div>
          )}

          {/* Low Stock Replenishment Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-500" />
                <span>{t('reorder.table_title', undefined, 'Vorgeschlagene Nachbestellungen')} ({filteredCandidates.length} {t('invoice.entries', undefined, 'Artikel')})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="p-3.5 w-12 text-center">{t('reorder.th_include', undefined, 'Warenkorb')}</th>
                    <th className="p-3.5">{t('reorder.th_product', undefined, 'Artikel / Bezeichnung')}</th>
                    <th className="p-3.5">{t('reorder.th_asin', undefined, 'Amazon ASIN / Link')}</th>
                    <th className="p-3.5 text-center">{t('reorder.th_stock_status', undefined, 'Bestand / Min / Ziel')}</th>
                    <th className="p-3.5 text-center">{t('reorder.th_reorder_qty', undefined, 'Nachbestellmenge')}</th>
                    <th className="p-3.5 text-right">{t('reorder.th_subtotal', undefined, 'Geschätzte Kosten')}</th>
                    <th className="p-3.5 text-right">{t('products.th_actions', undefined, 'Optionen')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        {t('reorder.no_low_stock', undefined, 'Aktuell keine knappen Artikel gefunden. Alle Bestände sind ausreichend!')}
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((p) => {
                      if (!p.id) return null;
                      const isIncluded = activeInclusions[p.id] ?? !p.exclude_from_reorder;
                      const qty = reorderQuantities[p.id] || 1;
                      const currentStock = p.qty_available || 0;
                      const minStock = p.min_qty ?? 5;
                      const targetStock = p.target_stock || (minStock * 2);
                      const asin = p.asin || (p.web_link ? extractAmazonAsin(p.web_link) : null);
                      const itemCost = (p.cost_price || p.sale_price || 0) * qty;

                      return (
                        <tr 
                          key={p.id} 
                          className={`transition ${
                            isIncluded 
                              ? 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40' 
                              : 'opacity-50 bg-slate-50/30 dark:bg-slate-900/30'
                          }`}
                        >
                          {/* Include in Cart Checkbox */}
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={() => handleToggleItemInclusion(p.id!)}
                              className="w-4 h-4 text-amber-600 rounded-md border-slate-300 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          {/* Product Info */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
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
                                  <span className="text-sm">{p.image_emoji || '📦'}</span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{p.name}</span>
                                  {p.exclude_from_reorder && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                      {t('reorder.badge_excluded', undefined, 'Ausgeschlossen')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {p.sku} {p.category ? `• ${p.category}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* ASIN / Amazon Link */}
                          <td className="p-3.5">
                            {isEditingAsinId === p.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="B08N5WRWNW"
                                  value={editingAsins[p.id] !== undefined ? editingAsins[p.id] : (asin || '')}
                                  onChange={(e) => setEditingAsins({ ...editingAsins, [p.id!]: e.target.value })}
                                  className="w-28 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-indigo-500 rounded-lg font-mono focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveAsin(p.id!)}
                                  className="p-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                  title="Speichern"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setIsEditingAsinId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : asin ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <span>ASIN: {asin}</span>
                                </span>
                                <button
                                  onClick={() => {
                                    setIsEditingAsinId(p.id!);
                                    setEditingAsins({ ...editingAsins, [p.id!]: asin });
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 underline"
                                >
                                  edit
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  <span>Keine ASIN</span>
                                </span>
                                <button
                                  onClick={() => {
                                    setIsEditingAsinId(p.id!);
                                    setEditingAsins({ ...editingAsins, [p.id!]: '' });
                                  }}
                                  className="text-[10px] text-indigo-600 hover:underline font-semibold"
                                >
                                  + ASIN
                                </button>
                                <a
                                  href={buildAmazonSearchUrl(p.name, selectedDomain)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-md transition"
                                  title="Auf Amazon suchen"
                                >
                                  <Search className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {p.web_link && (
                              <div className="mt-0.5">
                                <a
                                  href={p.web_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 truncate max-w-[140px]"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>{p.source_domain || 'Weblink'}</span>
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Stock Status Indicators */}
                          <td className="p-3.5 text-center">
                            <div className="font-mono-num font-bold text-rose-600 dark:text-rose-400">
                              {currentStock} <span className="text-[10px] font-normal text-slate-400">/ Min {minStock}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Ziel: {targetStock} {p.unit || 'Stk.'}
                            </div>
                          </td>

                          {/* Reorder Quantity Input & Stepper */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(p.id!, -1)}
                                className="p-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) => handleSetExactQty(p.id!, parseInt(e.target.value) || 1)}
                                className="w-12 py-1 text-xs text-center font-mono font-bold bg-transparent border-0 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(p.id!, 1)}
                                className="p-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Cost Estimate */}
                          <td className="p-3.5 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                            {itemCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </td>

                          {/* Permanent Exclusion Toggle */}
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleTogglePermanentExclusion(p)}
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                p.exclude_from_reorder
                                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                              }`}
                              title={p.exclude_from_reorder ? t('reorder.include_tooltip', undefined, 'Wieder für Nachbestellungen aktivieren') : t('reorder.exclude_tooltip', undefined, 'Dauerhaft von Nachbestellungen ausschließen')}
                            >
                              {p.exclude_from_reorder ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amazon Cart Generation Action Card */}
          <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('reorder.amazon_cart_headline', undefined, '1-Klick Amazon Warenkorb-URL')}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {cartItemsWithAsin.length} {t('reorder.asin_products', undefined, 'ASIN-Artikel')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                  {t('reorder.amazon_cart_desc', undefined, 'Erzeugt einen offiziellen Multi-Item Warenkorb-Link für Amazon. Beim Öffnen werden alle {count} Artikel mit den eingestellten Stückzahlen direkt in deinen Amazon-Einkaufswagen gelegt.').replace('{count}', String(cartItemsWithAsin.length))}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyCartUrl}
                  disabled={!amazonCartUrl}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? t('reorder.btn_copied', undefined, 'Kopiert!') : t('reorder.btn_copy_cart_url', undefined, 'Warenkorb-Link kopieren')}</span>
                </button>

                <button
                  onClick={handleOpenAmazonCart}
                  disabled={!amazonCartUrl}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 text-slate-950 text-xs font-extrabold rounded-xl shadow-md shadow-amber-500/20 transition whitespace-nowrap"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('reorder.btn_open_amazon_cart', undefined, 'In Amazon öffnen ({count} Artikel)').replace('{count}', String(cartItemsWithAsin.length))}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* URL Display if available */}
            {amazonCartUrl && (
              <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-hidden">
                <span className="truncate flex-1">{amazonCartUrl}</span>
                <span className="shrink-0 text-amber-600 dark:text-amber-400 font-sans font-bold">AWS Remote Cart API</span>
              </div>
            )}
          </div>

          {/* Alternative Multi-Vendor & Internal ERP Workflows */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold">{t('reorder.alt_workflows_title', undefined, 'Lieferanten & ERP-Export')}:</span> {t('reorder.alt_workflows_desc', undefined, 'Bestellliste als Text/CSV kopieren oder direkt eine SOCDOF-Lieferantenbestellung erzeugen.')}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyReplenishmentList}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
              >
                {copiedList ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{copiedList ? t('reorder.btn_copied', undefined, 'Kopiert!') : t('reorder.btn_copy_list', undefined, 'Text-Liste kopieren')}</span>
              </button>

              <button
                onClick={handleCreateSOCDOFPurchaseOrder}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>{t('reorder.btn_create_po', undefined, 'Als Lieferantenbestellung anlegen')}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stats.lowStockCount} {t('reorder.footer_detected', undefined, 'knappe Artikel erkannt')} • {stats.asinReadyCount} {t('reorder.footer_ready', undefined, 'Amazon-kompatibel')}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl transition"
          >
            {t('common.close', undefined, 'Schließen')}
          </button>
        </div>

      </div>
    </div>
  );
};
