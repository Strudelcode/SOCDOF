import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  ArrowDownToLine, 
  ArrowUpRight, 
  Search, 
  Boxes, 
  Building2, 
  Users, 
  FileSpreadsheet, 
  HelpCircle, 
  Plus, 
  X,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Product, StockMove, StockLocation } from '../types';
import { db, executeStockMove } from '../lib/db';
import { sounds } from '../lib/sound';

interface StockMovesModuleProps {
  stockMoves: StockMove[];
  products: Product[];
  onRefresh: () => void;
  isTransferModalOpen: boolean;
  preselectedProductId?: number;
  onCloseTransferModal: () => void;
  onOpenTransferModal: (productId?: number) => void;
}

export const StockMovesModule: React.FC<StockMovesModuleProps> = ({
  stockMoves,
  products,
  onRefresh,
  isTransferModalOpen,
  preselectedProductId,
  onCloseTransferModal,
  onOpenTransferModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');

  // New transfer form state
  const [transferData, setTransferData] = useState<{
    product_id: number;
    qty: number;
    preset_type: 'incoming' | 'outgoing' | 'inventory_loss' | 'custom';
    source_location: StockLocation;
    dest_location: StockLocation;
    reference: string;
    notes: string;
  }>({
    product_id: preselectedProductId || (products[0]?.id || 1),
    qty: 1,
    preset_type: 'incoming',
    source_location: 'Virtual/Vendors',
    dest_location: 'Physical/Warehouse',
    reference: `WH/IN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
    notes: ''
  });

  // Keep transfer product synced when modal opens with preselectedProductId
  React.useEffect(() => {
    if (preselectedProductId) {
      setTransferData(prev => ({
        ...prev,
        product_id: preselectedProductId,
        preset_type: 'incoming',
        source_location: 'Virtual/Vendors',
        dest_location: 'Physical/Warehouse',
        reference: `WH/IN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`
      }));
    }
  }, [preselectedProductId]);

  const handlePresetChange = (type: 'incoming' | 'outgoing' | 'inventory_loss' | 'custom') => {
    sounds.playClick();
    const year = new Date().getFullYear();
    const rnd = Math.floor(100 + Math.random() * 900);

    if (type === 'incoming') {
      setTransferData(prev => ({
        ...prev,
        preset_type: 'incoming',
        source_location: 'Virtual/Vendors',
        dest_location: 'Physical/Warehouse',
        reference: `WH/IN/${year}/${rnd}`
      }));
    } else if (type === 'outgoing') {
      setTransferData(prev => ({
        ...prev,
        preset_type: 'outgoing',
        source_location: 'Physical/Warehouse',
        dest_location: 'Virtual/Customers',
        reference: `WH/OUT/${year}/${rnd}`
      }));
    } else if (type === 'inventory_loss') {
      setTransferData(prev => ({
        ...prev,
        preset_type: 'inventory_loss',
        source_location: 'Physical/Warehouse',
        dest_location: 'Virtual/Inventory-Loss',
        reference: `INV/ADJ/${year}/${rnd}`
      }));
    } else {
      setTransferData(prev => ({ ...prev, preset_type: 'custom' }));
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.product_id || transferData.qty <= 0) {
      sounds.playError();
      return;
    }

    try {
      await executeStockMove({
        product_id: transferData.product_id,
        qty: transferData.qty,
        source_location: transferData.source_location,
        dest_location: transferData.dest_location,
        reference: transferData.reference || 'Manuelle Buchung',
        date: new Date().toISOString(),
        notes: transferData.notes
      });

      sounds.playSuccess();
      onCloseTransferModal();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const filteredMoves = stockMoves.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (m.product_name && m.product_name.toLowerCase().includes(q)) ||
      (m.product_sku && m.product_sku.toLowerCase().includes(q)) ||
      m.reference.toLowerCase().includes(q) ||
      m.source_location.toLowerCase().includes(q) ||
      m.dest_location.toLowerCase().includes(q);

    const matchesLoc = 
      selectedLocationFilter === 'all' ||
      m.source_location.includes(selectedLocationFilter) ||
      m.dest_location.includes(selectedLocationFilter);

    return matchesSearch && matchesLoc;
  });

  return (
    <div className="space-y-6">
      {/* Concept Explanation Card (Double-Entry Odoo Principle) */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <Boxes className="w-4 h-4" />
              <span>Odoo-Prinzip: Doppelte Lagerbuchführung</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Bestände entstehen nicht aus dem Nichts – jede Bewegung hat Herkunft & Ziel.
            </h3>
            <p className="text-xs text-slate-300">
              Wareneinkauf bewegt Artikel von <span className="font-mono text-indigo-300">Virtual/Vendors</span> nach <span className="font-mono text-emerald-300">Physical/Warehouse</span> (+Bestand).
              Warenverkauf verschiebt von <span className="font-mono text-emerald-300">Physical/Warehouse</span> nach <span className="font-mono text-indigo-300">Virtual/Customers</span> (-Bestand).
            </p>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenTransferModal();
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/30 whitespace-nowrap self-start md:self-auto transition"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Lagerbewegung erfassen</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
          <button
            onClick={() => {
              sounds.playClick();
              setSelectedLocationFilter('all');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedLocationFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Alle Standorte
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setSelectedLocationFilter('Vendors');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedLocationFilter === 'Vendors'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Lieferanten (In)
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setSelectedLocationFilter('Customers');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedLocationFilter === 'Customers'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Kunden (Out)
          </button>
        </div>

        <div className="relative flex-1 sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buchungsjournal filtern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Stock Moves Journal Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Buchungsjournal ({filteredMoves.length} Transaktionen)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4">Datum & Uhrzeit</th>
                <th className="p-4">Referenz / Beleg</th>
                <th className="p-4">Produkt</th>
                <th className="p-4">Von (Quelle)</th>
                <th className="p-4">Nach (Ziel)</th>
                <th className="p-4 text-right">Gebuchte Menge</th>
                <th className="p-4">Notiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMoves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Keine Buchungssätze gefunden.
                  </td>
                </tr>
              ) : (
                [...filteredMoves].reverse().map((move) => {
                  const isIncoming = move.dest_location === 'Physical/Warehouse';
                  return (
                    <tr key={move.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono-num text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(move.date).toLocaleString('de-DE')}
                      </td>

                      <td className="p-4 font-mono-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {move.reference}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {move.product_name || `Produkt #${move.product_id}`}
                        </div>
                        {move.product_sku && (
                          <div className="text-[10px] font-mono-num text-slate-400">
                            {move.product_sku}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {move.source_location}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {move.dest_location}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <span className={`font-mono-num font-bold px-2.5 py-1 rounded-lg text-xs ${
                          isIncoming
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                        }`}>
                          {isIncoming ? `+${move.qty}` : `-${move.qty}`} Stk.
                        </span>
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                        {move.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Lagerbewegung buchen (Double-Entry)
                </h3>
              </div>
              <button
                onClick={onCloseTransferModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="p-5 space-y-4">
              {/* Preset buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Art des Vorgangs
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePresetChange('incoming')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      transferData.preset_type === 'incoming'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs">Wareneingang (+)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Vom Lieferanten</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('outgoing')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      transferData.preset_type === 'outgoing'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs">Warenausgang (-)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">An Kunden</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('inventory_loss')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      transferData.preset_type === 'inventory_loss'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs">Inventurverlust</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Bruch / Schwund</div>
                  </button>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Produkt auswählen *
                </label>
                <select
                  value={transferData.product_id}
                  onChange={(e) => setTransferData({ ...transferData, product_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku} | Aktuell: {p.qty_available} {p.unit || 'Stk.'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Locations Grid */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Herkunft (Quelle)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Bestimmungsort (Ziel)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={transferData.source_location}
                    onChange={(e) => setTransferData({ ...transferData, source_location: e.target.value as StockLocation, preset_type: 'custom' })}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  >
                    <option value="Virtual/Vendors">Virtual/Vendors</option>
                    <option value="Physical/Warehouse">Physical/Warehouse</option>
                    <option value="Virtual/Customers">Virtual/Customers</option>
                    <option value="Virtual/Inventory-Loss">Virtual/Inventory-Loss</option>
                    <option value="Virtual/Scrap">Virtual/Scrap</option>
                  </select>

                  <select
                    value={transferData.dest_location}
                    onChange={(e) => setTransferData({ ...transferData, dest_location: e.target.value as StockLocation, preset_type: 'custom' })}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  >
                    <option value="Physical/Warehouse">Physical/Warehouse</option>
                    <option value="Virtual/Customers">Virtual/Customers</option>
                    <option value="Virtual/Vendors">Virtual/Vendors</option>
                    <option value="Virtual/Inventory-Loss">Virtual/Inventory-Loss</option>
                    <option value="Virtual/Scrap">Virtual/Scrap</option>
                  </select>
                </div>
              </div>

              {/* Quantity & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Menge (Stück) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={transferData.qty}
                    onChange={(e) => setTransferData({ ...transferData, qty: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Referenz / Lieferschein
                  </label>
                  <input
                    type="text"
                    required
                    value={transferData.reference}
                    onChange={(e) => setTransferData({ ...transferData, reference: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Buchungsnotiz
                </label>
                <input
                  type="text"
                  placeholder="z.B. Nachbestellung Charge #4092"
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseTransferModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Lagerbewegung buchen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
