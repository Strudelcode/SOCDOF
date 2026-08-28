import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  PackageCheck, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Boxes, 
  Truck, 
  X, 
  Trash2,
  Calendar,
  Building,
  Printer,
  Copy,
  TrendingUp,
  DollarSign,
  Users,
  Check,
  Eye,
  AlertCircle
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderItem, Contact, Product, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db, getNextPONumber, receivePurchaseOrder } from '../lib/db';
import { t, formatSystemDate } from '../lib/i18n';
import { SmartReorderModal } from './SmartReorderModal';

interface PurchasesModuleProps {
  purchases: PurchaseOrder[];
  contacts: Contact[];
  products: Product[];
  companyProfile: CompanyProfile;
  onRefreshData: () => void;
}

export const PurchasesModule: React.FC<PurchasesModuleProps> = ({
  purchases,
  contacts,
  products,
  companyProfile,
  onRefreshData
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isNewPOModalOpen, setIsNewPOModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [printPO, setPrintPO] = useState<PurchaseOrder | null>(null);

  // New PO Form State
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDelivery, setExpectedDelivery] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [notes, setNotes] = useState('');

  const vendors = contacts.filter(c => c.type === 'vendor' || c.type === 'both');

  // KPI Calculations
  const stats = useMemo(() => {
    const totalVolume = purchases.reduce((sum, po) => sum + (po.status !== 'draft' ? po.total : 0), 0);
    const openCount = purchases.filter(po => po.status === 'ordered').length;
    const receivedCount = purchases.filter(po => po.status === 'received').length;
    const draftCount = purchases.filter(po => po.status === 'draft').length;
    return { totalVolume, openCount, receivedCount, draftCount };
  }, [purchases]);

  const filteredPOs = purchases.filter(po => {
    const matchSearch = 
      po.number.toLowerCase().includes(search.toLowerCase()) ||
      po.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      (po.vendor_company && po.vendor_company.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleOpenNewPO = () => {
    sounds.playClick();
    if (vendors.length > 0) {
      setSelectedVendorId(vendors[0].id!);
    } else {
      setSelectedVendorId('');
    }
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDelivery(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    if (products.length > 0) {
      const p = products[0];
      setItems([{
        id: 'poi_' + Date.now(),
        product_id: p.id!,
        product_name: p.name,
        sku: p.sku,
        qty: 10,
        unit_cost: p.cost_price,
        tax_rate: companyProfile.default_tax_rate || 19,
        subtotal: 10 * p.cost_price
      }]);
    } else {
      setItems([]);
    }
    setNotes('');
    setIsNewPOModalOpen(true);
  };

  const handleDuplicatePO = (po: PurchaseOrder) => {
    sounds.playClick();
    setSelectedVendorId(po.vendor_id);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDelivery(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setItems(po.items.map(item => ({
      ...item,
      id: 'poi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    })));
    setNotes(po.notes || '');
    setIsNewPOModalOpen(true);
  };

  const handleDeletePO = async (poId: number) => {
    if (!confirm(t('action.delete_confirm', undefined, 'Do you really want to delete this purchase order?'))) return;
    try {
      await db.purchase_orders.delete(poId);
      sounds.playClick();
      if (selectedPO?.id === poId) setSelectedPO(null);
      onRefreshData();
    } catch (err) {
      sounds.playError();
      alert('Error deleting purchase order: ' + String(err));
    }
  };

  const addItem = () => {
    sounds.playClick();
    if (products.length === 0) return;
    const p = products[0];
    setItems(prev => [
      ...prev,
      {
        id: 'poi_' + Date.now(),
        product_id: p.id!,
        product_name: p.name,
        sku: p.sku,
        qty: 5,
        unit_cost: p.cost_price,
        tax_rate: companyProfile.default_tax_rate || 19,
        subtotal: 5 * p.cost_price
      }
    ]);
  };

  const updateItem = (index: number, updates: Partial<PurchaseOrderItem>) => {
    setItems(prev => {
      const next = [...prev];
      const current = next[index];
      const merged = { ...current, ...updates };

      if (updates.product_id !== undefined) {
        const prod = products.find(p => p.id === updates.product_id);
        if (prod) {
          merged.product_name = prod.name;
          merged.sku = prod.sku;
          merged.unit_cost = prod.cost_price;
        }
      }

      merged.subtotal = (merged.qty || 0) * (merged.unit_cost || 0);
      next[index] = merged;
      return next;
    });
  };

  const removeItem = (index: number) => {
    sounds.playClick();
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const taxTotal = subtotal * ((companyProfile.default_tax_rate || 19) / 100);
  const total = subtotal + taxTotal;

  const handleSavePO = async (status: 'draft' | 'ordered') => {
    if (!selectedVendorId || items.length === 0) {
      sounds.playError();
      alert(t('purchases.select_vendor_error', undefined, 'Please select a supplier and at least one item.'));
      return;
    }

    const vendor = contacts.find(c => c.id === Number(selectedVendorId));
    if (!vendor) return;

    const poNumber = await getNextPONumber();

    const newPO: PurchaseOrder = {
      vendor_id: vendor.id!,
      vendor_name: vendor.name,
      vendor_company: vendor.company,
      number: poNumber,
      order_date: orderDate,
      expected_delivery: expectedDelivery,
      status,
      items,
      subtotal,
      tax_total: taxTotal,
      total,
      notes
    };

    await db.purchase_orders.add(newPO);
    sounds.playSuccess();
    setIsNewPOModalOpen(false);
    onRefreshData();
  };

  const handleReceiveGoods = async (poId: number) => {
    sounds.playClick();
    if (!confirm(t('purchases.receive_confirm', undefined, 'Do you want to book the goods receipt now? Items will be credited immediately to the warehouse inventory.'))) {
      return;
    }

    try {
      await receivePurchaseOrder(poId);
      sounds.playSuccess();
      onRefreshData();
      if (selectedPO && selectedPO.id === poId) {
        const updated = await db.purchase_orders.get(poId);
        if (updated) setSelectedPO(updated);
      }
    } catch (err) {
      sounds.playError();
      alert('Error booking goods receipt: ' + String(err));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-cyan-400" />
            {t('purchases.title', undefined, 'Purchases & Procurement')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('purchases.subtitle', undefined, 'Supplier purchase orders, RFQs & automatic warehouse receipt booking')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsReorderModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
            title="Nachbestell-Assistent für knappe Lagerbestände & Amazon-Warenkorb"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{t('products.btn_smart_reorder', undefined, 'Nachbestellen & Amazon')}</span>
          </button>

          <button
            type="button"
            id="btn-new-purchase-order"
            onClick={handleOpenNewPO}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('purchases.new_po', undefined, 'New Purchase Order')}
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {t('purchases.kpi_volume', undefined, 'Procurement Volume')}
            </div>
            <div className="text-xl font-bold text-white mt-1 font-mono">
              {stats.totalVolume.toFixed(2)} {companyProfile.currency}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {t('purchases.filter_ordered', undefined, 'Open In-Flight Orders')}
            </div>
            <div className="text-xl font-bold text-cyan-400 mt-1">
              {stats.openCount} {t('purchases.orders_unit', undefined, 'orders')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {t('purchases.filter_received', undefined, 'Goods Received')}
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {stats.receivedCount} {t('purchases.orders_unit', undefined, 'completed')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {t('purchases.suppliers_count', undefined, 'Active Suppliers')}
            </div>
            <div className="text-xl font-bold text-purple-400 mt-1">
              {vendors.length} {t('purchases.vendors_unit', undefined, 'vendors')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('purchases.search_placeholder', undefined, 'Search purchase orders (e.g. PO/2026/0001, vendor)...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'draft', 'ordered', 'received'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => {
                sounds.playClick();
                setStatusFilter(st);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === st 
                  ? 'bg-cyan-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'all' && t('purchases.filter_all', undefined, 'All')}
              {st === 'draft' && `${t('purchases.filter_draft', undefined, 'Draft')} (${stats.draftCount})`}
              {st === 'ordered' && `${t('purchases.filter_ordered', undefined, 'Ordered')} (${stats.openCount})`}
              {st === 'received' && `${t('purchases.filter_received', undefined, 'Goods Received')} (${stats.receivedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="px-5 py-3.5">{t('purchases.th_number', undefined, 'Order No.')}</th>
                <th className="px-5 py-3.5">{t('purchases.th_vendor', undefined, 'Vendor / Supplier')}</th>
                <th className="px-5 py-3.5">{t('purchases.th_order_date', undefined, 'Order Date')}</th>
                <th className="px-5 py-3.5">{t('purchases.th_delivery_date', undefined, 'Expected Delivery')}</th>
                <th className="px-5 py-3.5 text-right">{t('purchases.th_total', undefined, 'Total (Gross)')}</th>
                <th className="px-5 py-3.5 text-center">{t('purchases.th_status', undefined, 'Status')}</th>
                <th className="px-5 py-3.5 text-right">{t('purchases.th_actions', undefined, 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredPOs.map((po) => (
                <tr 
                  key={po.id}
                  className="hover:bg-slate-700/40 transition-colors cursor-pointer"
                  onClick={() => {
                    sounds.playClick();
                    setSelectedPO(po);
                  }}
                >
                  <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono">{po.number}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-white">{po.vendor_name}</div>
                    {po.vendor_company && (
                      <div className="text-[11px] text-slate-400">{po.vendor_company}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">{formatSystemDate(po.order_date)}</td>
                  <td className="px-5 py-3.5">{formatSystemDate(po.expected_delivery)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-white font-mono">
                    {po.total.toFixed(2)} {companyProfile.currency}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                      po.status === 'received' 
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/40' 
                        : po.status === 'ordered'
                        ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/40'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {po.status === 'received' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {po.status === 'ordered' && <Truck className="w-3 h-3 text-cyan-400" />}
                      {po.status === 'draft' && <Clock className="w-3 h-3 text-slate-400" />}
                      {po.status === 'draft' && t('purchases.filter_draft', undefined, 'Draft')}
                      {po.status === 'ordered' && t('purchases.filter_ordered', undefined, 'Ordered')}
                      {po.status === 'received' && t('purchases.filter_received', undefined, 'Goods Received')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setPrintPO(po);
                        }}
                        title={t('action.print', undefined, 'Print / PDF')}
                        className="p-1.5 bg-slate-700/70 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicatePO(po)}
                        title={t('purchases.duplicate', undefined, 'Duplicate Order')}
                        className="p-1.5 bg-slate-700/70 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {po.status === 'ordered' && (
                        <button
                          type="button"
                          onClick={() => handleReceiveGoods(po.id!)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium shadow-sm transition-colors flex items-center gap-1"
                        >
                          <PackageCheck className="w-3 h-3" />
                          <span>{t('purchases.btn_receive_goods', undefined, 'Receive')}</span>
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDeletePO(po.id!)}
                          title={t('action.delete', undefined, 'Delete')}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg transition border border-rose-800/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    {t('purchases.empty_list', undefined, 'No purchase orders found for this filter.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Order Modal */}
      {isNewPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                {t('purchases.modal_title', undefined, 'Create New Purchase Order')}
              </h3>
              <button
                type="button"
                onClick={() => setIsNewPOModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vendor & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('purchases.modal_vendor_select', undefined, 'Select Supplier *')}</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">{t('purchases.modal_vendor_select', undefined, 'Select Supplier *')}</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.company ? `${v.company} (${v.name})` : v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('purchases.modal_order_date', undefined, 'Order Date *')}</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('purchases.modal_delivery_date', undefined, 'Expected Delivery')}</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">{t('purchases.modal_items_title', undefined, 'Ordered Line Items')}</span>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('purchases.modal_add_item', undefined, 'Add Item')}
                </button>
              </div>

              <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800 text-slate-400 border-b border-slate-700 text-[11px]">
                    <tr>
                      <th className="p-2.5">{t('product.category', undefined, 'Product')}</th>
                      <th className="p-2.5 w-24">{t('stock.th_qty', undefined, 'Quantity')}</th>
                      <th className="p-2.5 w-28 text-right">{t('product.cost_price', undefined, 'Cost Price')}</th>
                      <th className="p-2.5 w-28 text-right">{t('pos.subtotal', undefined, 'Subtotal')}</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(idx, { product_id: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - {t('product.qty_available', undefined, 'In Stock')}: {p.qty_available}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs text-center"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.10"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-white">
                          {item.subtotal.toFixed(2)} {companyProfile.currency}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes & Totals */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
              <div className="w-full sm:w-1/2">
                <label className="block text-xs text-slate-400 mb-1">{t('purchases.modal_notes', undefined, 'Supplier Notes & Delivery Instructions')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Net 14 days, deliver to dock A..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs resize-none"
                />
              </div>

              <div className="w-full sm:w-64 bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{t('pos.subtotal', undefined, 'Net:')}</span>
                  <span>{subtotal.toFixed(2)} {companyProfile.currency}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{t('pos.tax', undefined, 'VAT')} ({companyProfile.default_tax_rate || 19}%):</span>
                  <span>{taxTotal.toFixed(2)} {companyProfile.currency}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-slate-700">
                  <span>{t('pos.total', undefined, 'Total:')}</span>
                  <span className="text-cyan-400">{total.toFixed(2)} {companyProfile.currency}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewPOModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                {t('action.cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleSavePO('draft')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                {t('purchases.modal_btn_draft', undefined, 'Save as Draft')}
              </button>
              <button
                type="button"
                id="btn-confirm-purchase-order"
                onClick={() => handleSavePO('ordered')}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-950/40"
              >
                {t('purchases.modal_btn_order', undefined, 'Order Directly')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO Details Modal */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  {selectedPO.number}
                </h3>
                <span className="text-xs text-slate-400">{t('purchases.th_vendor', undefined, 'Vendor')}: {selectedPO.vendor_name} ({selectedPO.vendor_company})</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">{t('purchases.modal_items_title', undefined, 'Line Items')}:</div>
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3 space-y-2 max-h-56 overflow-y-auto">
                {selectedPO.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{item.qty}x</span> {item.product_name}
                      <span className="text-slate-500 ml-2 font-mono">({item.sku})</span>
                    </div>
                    <div className="font-mono text-cyan-300">
                      {item.subtotal.toFixed(2)} {companyProfile.currency}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPO.notes && (
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="text-slate-400 block font-semibold mb-0.5">{t('purchases.modal_notes', undefined, 'Notes')}:</span>
                {selectedPO.notes}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-400">
                {t('purchases.th_delivery_date', undefined, 'Expected Delivery')}: <span className="text-white font-medium">{formatSystemDate(selectedPO.expected_delivery)}</span>
              </div>
              <div className="text-base font-bold text-white">
                {t('purchases.th_total', undefined, 'Total')}: <span className="text-cyan-400">{selectedPO.total.toFixed(2)} {companyProfile.currency}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setPrintPO(selectedPO);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('action.print', undefined, 'Print / PDF')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDuplicatePO(selectedPO);
                    setSelectedPO(null);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('purchases.duplicate', undefined, 'Duplicate')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedPO.status === 'ordered' && (
                  <button
                    type="button"
                    onClick={() => handleReceiveGoods(selectedPO.id!)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    {t('purchases.btn_receive_goods', undefined, 'Book Goods Receipt')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  {t('action.close', undefined, 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Purchase Order Print Preview Modal */}
      {printPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:p-6 print:rounded-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <Printer className="w-4 h-4 text-cyan-600" />
                <span>{t('purchases.print_title', undefined, 'Official Purchase Order Sheet (DIN A4)')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('action.print_now', undefined, 'Print Now')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPO(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{companyProfile.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{companyProfile.street}, {companyProfile.zip} {companyProfile.city}</p>
                <p className="text-xs text-slate-500">{companyProfile.email} • {companyProfile.phone}</p>
                {companyProfile.vat_id && (
                  <p className="text-xs text-slate-500 font-mono">USt-IdNr.: {companyProfile.vat_id}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-cyan-50 text-cyan-800 rounded-md border border-cyan-200">
                  {t('purchases.document_label', undefined, 'Purchase Order')}
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-2">{printPO.number}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('purchases.th_order_date', undefined, 'Date')}: {formatSystemDate(printPO.order_date)}
                </div>
              </div>
            </div>

            {/* Vendor Recipient Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {t('purchases.vendor_recipient', undefined, 'Vendor / Supplier:')}
                </div>
                <div className="font-bold text-sm text-slate-900">{printPO.vendor_company || printPO.vendor_name}</div>
                {printPO.vendor_company && <div className="text-slate-600">{printPO.vendor_name}</div>}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {t('purchases.delivery_terms', undefined, 'Expected Delivery:')}
                </div>
                <div className="font-bold text-slate-900">{formatSystemDate(printPO.expected_delivery)}</div>
                <div className="text-slate-500">{t('purchases.delivery_loc', undefined, 'Central Warehouse Ramp 1')}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">Pos.</th>
                    <th className="p-3">{t('product.category', undefined, 'Item Description / SKU')}</th>
                    <th className="p-3 w-20 text-center">{t('stock.th_qty', undefined, 'Qty')}</th>
                    <th className="p-3 w-28 text-right">{t('product.cost_price', undefined, 'Unit Net')}</th>
                    <th className="p-3 w-28 text-right">{t('pos.subtotal', undefined, 'Total Net')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {printPO.items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td className="p-3 text-center text-slate-400 font-mono">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900">{item.qty}</td>
                      <td className="p-3 text-right font-mono">{item.unit_cost.toFixed(2)} {companyProfile.currency}</td>
                      <td className="p-3 text-right font-mono font-bold">{item.subtotal.toFixed(2)} {companyProfile.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Notes */}
            <div className="flex justify-between items-start gap-6 pt-2">
              <div className="flex-1 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">{t('purchases.delivery_notes', undefined, 'Instructions & Notes:')}</div>
                <p>{printPO.notes || t('purchases.standard_terms', undefined, 'Payment terms: Net 14 days after receipt of goods and invoice. Please mention our order number on your delivery note.')}</p>
              </div>

              <div className="w-64 space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span>{t('pos.subtotal', undefined, 'Net Subtotal')}:</span>
                  <span className="font-mono">{printPO.subtotal.toFixed(2)} {companyProfile.currency}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('pos.tax', undefined, 'VAT')} ({companyProfile.default_tax_rate || 19}%):</span>
                  <span className="font-mono">{printPO.tax_total.toFixed(2)} {companyProfile.currency}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                  <span>{t('pos.total', undefined, 'Total Gross')}:</span>
                  <span className="font-mono text-cyan-800">{printPO.total.toFixed(2)} {companyProfile.currency}</span>
                </div>
              </div>
            </div>

            {/* Approval & Signature section */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
              <div>
                <div className="border-b border-slate-300 h-10 mb-1"></div>
                <div>{t('purchases.sign_purchaser', undefined, 'Authorized Purchasing Officer')} ({companyProfile.name})</div>
              </div>
              <div>
                <div className="border-b border-slate-300 h-10 mb-1"></div>
                <div>{t('purchases.sign_vendor', undefined, 'Supplier Order Confirmation / Date')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Reorder & Amazon Cart Modal */}
      <SmartReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        products={products}
        onRefreshProducts={onRefreshData}
        currency={companyProfile.currency}
      />
    </div>
  );
};
