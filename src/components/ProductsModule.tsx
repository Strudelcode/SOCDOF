import React, { useState, useMemo } from 'react';
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
  Info
} from 'lucide-react';
import { Product, Invoice, StockMove } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { extractProductFromUrl } from '../lib/productLinkExtractor';
import { t } from '../lib/i18n';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  
  // Link extraction state in modal
  const [linkInput, setLinkInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState('');

  // Detail / Customer allocation view modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // Categories extraction
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Allgemein')))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || (p.category || 'Allgemein') === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
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
    setEditingProduct({
      name: '',
      sku: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      sale_price: 100,
      cost_price: 50,
      qty_available: 0,
      min_qty: 5,
      unit: 'Stück',
      category: 'Hardware',
      image_emoji: '📦',
      description: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    sounds.playClick();
    setLinkInput(p.web_link || '');
    setExtractSuccessMsg('');
    setEditingProduct({ ...p });
    setIsEditModalOpen(true);
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
        await db.products.update(editingProduct.id, editingProduct);
      } else {
        await db.products.add({
          name: editingProduct.name,
          sku: editingProduct.sku,
          sale_price: Number(editingProduct.sale_price) || 0,
          cost_price: Number(editingProduct.cost_price) || 0,
          qty_available: Number(editingProduct.qty_available) || 0,
          min_qty: Number(editingProduct.min_qty) || 5,
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
    if (!confirm('Dieses Produkt wirklich löschen?')) return;
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                sounds.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'all' ? t('products.all_categories', undefined, 'Alle Kategorien') : cat}
            </button>
          ))}
        </div>

        {/* Live Search & Create Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('products.search_placeholder', undefined, 'Produkt, SKU oder Link suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{t('products.btn_new_product', undefined, 'Neues Produkt')}</span>
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-500" />
            <span>{t('products.catalog_title', undefined, 'Produktkatalog & Bestandsübersicht')} ({filteredProducts.length} {t('invoice.entries', undefined, 'Artikel')})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4 w-12 text-center">{t('products.th_image', undefined, 'Bild')}</th>
                <th className="p-4">{t('products.th_name', undefined, 'Artikel / Bezeichnung')}</th>
                <th className="p-4">{t('products.th_sku', undefined, 'SKU / Code')}</th>
                <th className="p-4">{t('products.th_category', undefined, 'Kategorie')}</th>
                <th className="p-4 text-right">{t('products.th_cost_price', undefined, 'Einkaufspreis (EK)')}</th>
                <th className="p-4 text-right">{t('products.th_sale_price', undefined, 'Verkaufspreis (VK)')}</th>
                <th className="p-4 text-center">{t('products.th_stock', undefined, 'Auf Lager')}</th>
                <th className="p-4 text-center">{t('products.th_allocated', undefined, 'An Kunden vergeben')}</th>
                <th className="p-4 text-right">{t('products.th_actions', undefined, 'Aktionen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    {t('products.empty_list', undefined, 'Keine Produkte gefunden.')}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const qty = p.qty_available || 0;
                  const isLowStock = qty < (p.min_qty ?? 5);
                  const allocation = p.id ? productAllocations.get(p.id) : undefined;
                  const soldQty = allocation?.totalSold || 0;

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
                              title={`Produktlink öffnen: ${p.source_domain || p.web_link}`}
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
                        {p.source_domain && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-mono mt-0.5">
                            <Globe className="w-2.5 h-2.5" />
                            <span>{p.source_domain}</span>
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-mono-num font-medium text-slate-600 dark:text-slate-300">
                        {p.sku}
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
                              {t('products.low_stock', undefined, 'Niedrig')} (&lt; {p.min_qty ?? 5})
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
                            title="Kunden & Auftragszuordnungen einsehen"
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
                          <button
                            onClick={() => {
                              sounds.playClick();
                              onOpenStockTransfer(p.id);
                            }}
                            title="Lagerbestand buchen / Wareneingang erfassen"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold transition"
                          >
                            <ArrowDownToLine className="w-3 h-3" />
                            <span>{t('products.btn_book_stock', undefined, 'Buchen')}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Bearbeiten"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => p.id && handleDeleteProduct(p.id)}
                            title="Löschen"
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

      {/* Customer Allocation Detail Modal */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {t('products.alloc_modal_title', undefined, 'Kunden- & Auftragsvergabe')}
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
                      {t('products.alloc_empty', undefined, 'Noch keine Kundenaufträge für diesen Artikel vorhanden.')}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1 flex justify-between">
                      <span>{t('products.alloc_customer_header', undefined, 'Kunde & Rechnungs-Nr.')}</span>
                      <span>{t('products.alloc_qty_header', undefined, 'Vergebene Menge / Summe')}</span>
                    </div>
                    {alloc.customers.map((c, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {c.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {t('invoice.title', undefined, 'Rechnung')} {c.invoiceNumber} • {c.date}
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
        </div>
      )}

      {/* Create / Edit Product Modal with Web Link & Image Upload */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-500" />
                <span>{editingProduct.id ? t('products.edit_title', undefined, 'Produkt bearbeiten') : t('products.create_title', undefined, 'Neues Produkt erfassen')}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Optional Web Link Import (Amazon, Geizhals, Shop) */}
              <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-sky-500" />
                  <span>{t('products.modal_weblink_label', undefined, 'Optional: Produkt-Weblink eintragen (z. B. Amazon, Lieferanten-Shop)')}</span>
                </label>
                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                  {t('products.modal_weblink_desc', undefined, 'Füge einen Weblink ein, um Titel, Kategorie, Bild und Daten automatisch vorzubelegen. Du kannst alle Werte danach beliebig anpassen.')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://www.amazon.de/dp/... oder Onlineshop-Link"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 rounded-xl focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleExtractFromUrl}
                    disabled={!linkInput.trim() || isExtracting}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1 shrink-0"
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

              {/* Image & Emoji Preview with Upload Option */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {editingProduct.image_url ? (
                    <img
                      src={editingProduct.image_url}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-2xl">{editingProduct.image_emoji || '📦'}</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t('products.modal_image_label', undefined, 'Produktbild / Icon')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 transition flex items-center gap-1">
                      <Upload className="w-3 h-3 text-indigo-500" />
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
                        onClick={() => setEditingProduct({ ...editingProduct, image_url: undefined })}
                        className="text-[11px] text-rose-500 hover:underline"
                      >
                        {t('products.modal_remove_image', undefined, 'Bild entfernen')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('products.modal_name_label', undefined, 'Produktname / Bezeichnung *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. IoT Gateway 5G Ultra"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_category_label', undefined, 'Kategorie')}
                  </label>
                  <input
                    type="text"
                    placeholder="Hardware, Software, etc."
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cost & Sale Price */}
              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Stock Quantity, Min Qty & Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_stock_qty_label', undefined, 'Lagerbestand')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.qty_available ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, qty_available: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_min_qty_label', undefined, 'Mindestbestand')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.min_qty ?? 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, min_qty: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('products.modal_unit_label', undefined, 'Einheit')}
                  </label>
                  <input
                    type="text"
                    placeholder="Stück, Std, Lizenz"
                    value={editingProduct.unit || 'Stück'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('products.modal_desc_label', undefined, 'Beschreibung')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Details zum Produkt..."
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {t('common.cancel', undefined, 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  {editingProduct.id ? t('products.btn_save_changes', undefined, 'Änderungen speichern') : t('products.btn_create', undefined, 'Produkt erstellen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
