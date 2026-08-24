import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';
import { Product } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';

interface ProductsModuleProps {
  products: Product[];
  onRefresh: () => void;
  onOpenStockTransfer: (productId?: number) => void;
  currency: string;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({
  products,
  onRefresh,
  onOpenStockTransfer,
  currency = '€'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Categories extraction
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Allgemein')))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || (p.category || 'Allgemein') === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleOpenCreate = () => {
    sounds.playClick();
    setEditingProduct({
      name: '',
      sku: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      sale_price: 100,
      cost_price: 50,
      qty_available: 0,
      min_qty: 5,
      unit: 'Stück',
      category: 'Hardware',
      description: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    sounds.playClick();
    setEditingProduct({ ...p });
    setIsEditModalOpen(true);
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
              {cat === 'all' ? 'Alle Kategorien' : cat}
            </button>
          ))}
        </div>

        {/* Live Search & Create Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Produkt oder SKU suchen..."
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
            <span>Neues Produkt</span>
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Produktkatalog & Bestandsübersicht ({filteredProducts.length} Artikel)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4">Artikel / Bezeichnung</th>
                <th className="p-4">SKU / Code</th>
                <th className="p-4">Kategorie</th>
                <th className="p-4 text-right">Einkaufspreis (EK)</th>
                <th className="p-4 text-right">Verkaufspreis (VK)</th>
                <th className="p-4 text-right">Marge</th>
                <th className="p-4 text-center">Lagerbestand</th>
                <th className="p-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Keine Produkte gefunden.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const qty = p.qty_available || 0;
                  const isLowStock = qty < (p.min_qty ?? 5);
                  const marginEur = (p.sale_price || 0) - (p.cost_price || 0);
                  const marginPercent = p.sale_price > 0 ? ((marginEur / p.sale_price) * 100).toFixed(0) : '0';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                            {p.description}
                          </div>
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

                      <td className="p-4 text-right">
                        <span className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                          +{marginPercent}%
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono-num">
                          +{formatCurrency(marginEur)}
                        </div>
                      </td>

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
                              Niedrig (&lt; {p.min_qty ?? 5})
                            </span>
                          )}
                        </div>
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
                            <span>Buchen</span>
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

      {/* Create / Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {editingProduct.id ? 'Produkt bearbeiten' : 'Neues Produkt erfassen'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Produktname / Bezeichnung *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. IoT Gateway 5G Ultra"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Artikelnummer (SKU) *
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
                    Kategorie
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Einkaufspreis (EK) in {currency}
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
                    Verkaufspreis (VK) in {currency} *
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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lagerbestand
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
                    Mindestbestand
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
                    Einheit
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Beschreibung
                </label>
                <textarea
                  rows={2}
                  placeholder="Details zum Produkt..."
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  {editingProduct.id ? 'Änderungen speichern' : 'Produkt erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
