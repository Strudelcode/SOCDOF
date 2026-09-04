import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Printer, 
  CheckCircle2, 
  X, 
  Barcode, 
  Receipt, 
  UserCheck, 
  RotateCcw 
} from 'lucide-react';
import { Product, Contact, POSOrder, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { createPOSCheckout } from '../lib/db';
import { t } from '../lib/i18n';

interface POSModuleProps {
  products: Product[];
  contacts: Contact[];
  companyProfile: CompanyProfile;
  onRefreshData: () => void;
}

interface CartItem {
  product: Product;
  qty: number;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  contacts,
  companyProfile,
  onRefreshData
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'nfc'>('cash');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<POSOrder | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchQuery = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  const addToCart = (product: Product) => {
    sounds.playClick();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    sounds.playClick();
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: number) => {
    sounds.playClick();
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    sounds.playClick();
    setCart([]);
  };

  // Barcode quick scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const match = products.find(p => p.barcode === barcodeInput.trim() || p.sku.toLowerCase() === barcodeInput.trim().toLowerCase());
    if (match) {
      sounds.playBarcodeBeep();
      addToCart(match);
      setBarcodeInput('');
    } else {
      sounds.playError();
      alert(t('pos.not_found_alert', undefined, 'No item with barcode/SKU "{barcode}" found.').replace('{barcode}', barcodeInput));
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.product.sale_price * item.qty), 0);
  const taxTotal = subtotal * ((companyProfile.default_tax_rate || 19) / 100);
  const total = subtotal + taxTotal;

  const cashAmount = parseFloat(cashGiven) || 0;
  const cashChange = Math.max(0, cashAmount - total);

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    sounds.playClick();
    setCashGiven(Math.ceil(total).toString());
    setIsPaymentOpen(true);
  };

  const handleCompleteSale = async () => {
    if (paymentMethod === 'cash' && cashAmount < total) {
      sounds.playError();
      alert(t('pos.insufficient_cash', undefined, 'The cash amount tendered is less than the total due!'));
      return;
    }

    const receiptNumber = `POS/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const customer = contacts.find(c => c.id === selectedCustomerId);

    const orderData: Omit<POSOrder, 'id'> = {
      receipt_number: receiptNumber,
      date: new Date().toISOString(),
      items: cart.map(item => ({
        product_id: item.product.id!,
        product_name: item.product.name,
        sku: item.product.sku,
        qty: item.qty,
        price: item.product.sale_price,
        tax_rate: companyProfile.default_tax_rate || 19,
        subtotal: item.product.sale_price * item.qty
      })),
      subtotal,
      tax_total: taxTotal,
      total,
      payment_method: paymentMethod,
      cash_tendered: paymentMethod === 'cash' ? cashAmount : undefined,
      cash_change: paymentMethod === 'cash' ? cashChange : undefined,
      customer_name: customer ? customer.name : t('pos.walk_in_customer', undefined, 'Walk-in Customer')
    };

    try {
      const orderId = await createPOSCheckout(orderData);
      if (paymentMethod === 'cash') {
        sounds.playCashDrawer();
        setTimeout(() => sounds.playCoinClink(), 250);
        setTimeout(() => sounds.playPaymentSuccess(), 550);
      } else if (paymentMethod === 'nfc') {
        sounds.playNfcBeep();
        setTimeout(() => sounds.playPaymentSuccess(), 400);
      } else {
        sounds.playPaymentSuccess();
      }
      setCompletedOrder({ ...orderData, id: orderId });
      setCart([]);
      onRefreshData();
    } catch (err) {
      sounds.playError();
      alert('Error finalizing POS checkout: ' + String(err));
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-900 text-slate-100">
      {/* Left: Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
        {/* Top Controls: Search, Barcode & Category Pills */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="pos-search-input"
                placeholder={t('pos.search_placeholder', undefined, 'Search product by name, SKU or barcode...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Barcode scanner simulator */}
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  id="pos-barcode-input"
                  placeholder={t('pos.barcode_placeholder', undefined, 'Scan barcode...')}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                id="btn-pos-scan"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shadow-sm"
              >
                {t('pos.scan_btn', undefined, 'Scan')}
              </button>
            </form>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat 
                    ? 'bg-[#714B67] text-white shadow-sm' 
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {cat === 'all' ? t('pos.all_categories', undefined, 'All Categories') : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map(prod => (
            <button
              key={prod.id}
              id={`pos-product-${prod.id}`}
              onClick={() => addToCart(prod)}
              className="flex flex-col text-left p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-purple-500/60 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md group relative"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{prod.image_emoji || '📦'}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  prod.qty_available <= (prod.min_qty || 5) 
                    ? 'bg-rose-900/60 text-rose-300 border border-rose-700/40' 
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {prod.qty_available} {prod.unit || 'pcs'}
                </span>
              </div>
              <div className="font-semibold text-white text-xs sm:text-sm line-clamp-1 group-hover:text-purple-300">
                {prod.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {prod.sku}
              </div>
              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="text-emerald-400 font-bold text-sm">
                  {prod.sale_price.toFixed(2)} {companyProfile.currency || '€'}
                </span>
                <span className="w-6 h-6 rounded-lg bg-slate-700 group-hover:bg-purple-600 flex items-center justify-center text-white text-xs transition-colors">
                  +
                </span>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('contacts.empty_list', undefined, 'No products found.')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Register */}
      <div className="w-full md:w-96 flex flex-col bg-slate-950 border-t md:border-t-0 border-slate-800">
        {/* Customer Selector & Cart Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              {t('pos.cart_empty', undefined, 'Cart & Receipt')}
            </h2>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                {t('pos.btn_clear', undefined, 'Clear')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCustomerId || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">👤 {t('pos.walk_in_customer', undefined, 'Walk-in Customer (Default)')}</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.map(item => (
            <div 
              key={item.product.id}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-xs text-white truncate">
                  {item.product.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {item.product.sale_price.toFixed(2)} {companyProfile.currency} / {item.product.unit || 'pcs'}
                </div>
              </div>

              {/* Quantity counter */}
              <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => updateQty(item.product.id!, -1)}
                  className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:bg-slate-700"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-6 text-center text-white">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(item.product.id!, 1)}
                  className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:bg-slate-700"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="text-right w-16">
                <div className="text-xs font-bold text-emerald-400">
                  {(item.product.sale_price * item.qty).toFixed(2)} {companyProfile.currency}
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-xs">{t('pos.ready_title', undefined, 'POS is ready.')}</p>
              <p className="text-[11px] text-slate-600">{t('pos.ready_subtitle', undefined, 'Click on items or scan barcode')}</p>
            </div>
          )}
        </div>

        {/* Totals & Checkout Button */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('pos.subtotal', undefined, 'Net Subtotal:')}</span>
              <span>{subtotal.toFixed(2)} {companyProfile.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('pos.tax', undefined, 'VAT')} ({companyProfile.default_tax_rate || 19}%):</span>
              <span>{taxTotal.toFixed(2)} {companyProfile.currency}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
              <span>{t('pos.total', undefined, 'Total Due:')}</span>
              <span className="text-emerald-400">{total.toFixed(2)} {companyProfile.currency}</span>
            </div>
          </div>

          <button
            type="button"
            id="btn-pos-checkout"
            disabled={cart.length === 0}
            onClick={handleOpenPayment}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              cart.length > 0 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 active:scale-[0.99]' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t('pos.btn_checkout', undefined, 'Pay')} ({total.toFixed(2)} {companyProfile.currency})
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                {t('pos.checkout_dialog_title', undefined, 'Complete Checkout & Payment')}
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-2 bg-slate-800/80 rounded-xl border border-slate-700">
              <div className="text-xs text-slate-400">{t('pos.amount_to_pay', undefined, 'Amount to Pay')}</div>
              <div className="text-3xl font-extrabold text-emerald-400">
                {total.toFixed(2)} {companyProfile.currency}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('cash');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition-all ${
                  paymentMethod === 'cash' 
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Banknote className="w-5 h-5" />
                {t('pos.cash_payment', undefined, 'Cash')}
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('card');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition-all ${
                  paymentMethod === 'card' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                {t('pos.card_payment', undefined, 'Card')}
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setPaymentMethod('nfc');
                }}
                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border text-xs font-semibold transition-all ${
                  paymentMethod === 'nfc' 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                {t('pos.nfc_payment', undefined, 'Apple/Google Pay')}
              </button>
            </div>

            {/* Cash specific calculations */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t('pos.cash_tendered', undefined, 'Cash Received:')}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.10"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-600 text-white font-mono text-sm text-right px-2 py-1 rounded"
                    />
                    <span className="text-slate-400">{companyProfile.currency}</span>
                  </div>
                </div>

                {/* Quick denomination pills */}
                <div className="flex items-center gap-1.5">
                  {[10, 20, 50, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCashGiven(val.toString())}
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded font-mono"
                    >
                      {val} {companyProfile.currency}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-slate-700">
                  <span className="text-slate-300">{t('pos.change', undefined, 'Change:')}</span>
                  <span className="text-emerald-400 font-mono text-base">
                    {cashChange.toFixed(2)} {companyProfile.currency}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                {t('action.cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                id="btn-confirm-pos-sale"
                onClick={() => {
                  setIsPaymentOpen(false);
                  handleCompleteSale();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('pos.btn_complete_print', undefined, 'Complete Checkout & Print Receipt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-base uppercase tracking-wider">{companyProfile.name}</div>
              <div className="text-[11px] text-slate-600">{companyProfile.street}</div>
              <div className="text-[11px] text-slate-600">{companyProfile.zip} {companyProfile.city}</div>
              {companyProfile.vat_id && (
                <div className="text-[10px] text-slate-500 mt-1">USt-IdNr: {companyProfile.vat_id}</div>
              )}
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <span>{t('pos.receipt_beleg', undefined, 'Receipt:')} {completedOrder.receipt_number}</span>
              <span>{new Date(completedOrder.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-[11px] text-slate-600">
              {t('pos.receipt_customer', undefined, 'Customer:')} {completedOrder.customer_name}
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
              {completedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.qty}x {item.product_name}</span>
                  <span>{item.subtotal.toFixed(2)} {companyProfile.currency}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right">
              <div className="flex justify-between text-slate-600">
                <span>{t('pos.receipt_subtotal', undefined, 'Net:')}</span>
                <span>{completedOrder.subtotal.toFixed(2)} {companyProfile.currency}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t('pos.receipt_vat', undefined, 'VAT')} ({completedOrder.items[0]?.tax_rate || 19}%):</span>
                <span>{completedOrder.tax_total.toFixed(2)} {companyProfile.currency}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-900 pt-1">
                <span>{t('pos.receipt_total', undefined, 'TOTAL:')}</span>
                <span>{completedOrder.total.toFixed(2)} {companyProfile.currency}</span>
              </div>
              {completedOrder.payment_method === 'cash' && (
                <div className="flex justify-between text-slate-600 text-[11px] pt-1">
                  <span>{t('pos.receipt_tendered', undefined, 'Tendered:')} {completedOrder.cash_tendered?.toFixed(2)} {companyProfile.currency}</span>
                  <span>{t('pos.receipt_change', undefined, 'Change:')} {completedOrder.cash_change?.toFixed(2)} {companyProfile.currency}</span>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
              {t('pos.receipt_thank_you', undefined, 'Thank you for your purchase!')}
              <br />
              TSE Signature: OK-LOC-2026-X
            </div>

            <div className="flex items-center gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  window.print();
                }}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-sans text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" />
                {t('pos.receipt_print', undefined, 'Print')}
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCompletedOrder(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-sans text-xs font-semibold"
              >
                {t('pos.receipt_close', undefined, 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
