import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Receipt, 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight, 
  Clock, 
  PlusCircle, 
  CheckCircle2, 
  ChevronRight,
  PackageCheck,
  UserPlus,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  FileText,
  Calendar,
  Building2,
  Package,
  Users,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { Invoice, Product, StockMove, Contact, ActiveModule, PurchaseOrder, POSOrder, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { SocdofLogo } from './SocdofLogo';

interface DashboardProps {
  invoices: Invoice[];
  products: Product[];
  stockMoves: StockMove[];
  contacts: Contact[];
  purchases?: PurchaseOrder[];
  posOrders?: POSOrder[];
  company?: CompanyProfile;
  onNavigate: (module: ActiveModule) => void;
  onOpenNewInvoice: () => void;
  onOpenNewContact: () => void;
  onOpenStockTransfer: (productId?: number) => void;
  currency: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  invoices = [],
  products = [],
  stockMoves = [],
  contacts = [],
  purchases = [],
  posOrders = [],
  company,
  onNavigate,
  onOpenNewInvoice,
  onOpenNewContact,
  onOpenStockTransfer,
  currency = '€'
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year' | 'today' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filter invoices according to period or custom date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.date) return true;
      if (periodFilter === 'all') return true;
      const invDate = new Date(inv.date);
      const now = new Date();

      if (periodFilter === 'today') {
        return invDate.toDateString() === now.toDateString();
      }
      if (periodFilter === 'month') {
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const invQuarter = Math.floor(invDate.getMonth() / 3);
        return invQuarter === currentQuarter && invDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'year') {
        return invDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'custom') {
        if (customStartDate && inv.date < customStartDate) return false;
        if (customEndDate && inv.date > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [invoices, periodFilter, customStartDate, customEndDate]);

  // Financial Calculations (100% computed purely from live operational state)
  const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + (inv.status !== 'cancelled' ? inv.total : 0), 0);
  const totalPaid = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const totalOpen = filteredInvoices.filter(inv => inv.status === 'posted').reduce((sum, inv) => sum + inv.total, 0);
  const totalDraft = filteredInvoices.filter(inv => inv.status === 'draft').reduce((sum, inv) => sum + inv.total, 0);

  // POS sales revenue
  const totalPosRevenue = posOrders.reduce((sum, ord) => sum + ord.total, 0);

  // Total Inventory Valuation (Lagerwert = sum of qty * cost_price)
  const totalInventoryValue = products.reduce((sum, p) => sum + (Math.max(0, p.qty_available || 0) * (p.cost_price || 0)), 0);
  const totalInventoryRetailValue = products.reduce((sum, p) => sum + (Math.max(0, p.qty_available || 0) * (p.sale_price || 0)), 0);

  // Warn-Center: Products with qty < 5 or <= min_qty
  const lowStockProducts = products.filter(p => (p.qty_available || 0) < (p.min_qty ?? 5));

  // Recent 5 Invoices
  const recentInvoices = [...invoices].reverse().slice(0, 5);

  // Recent 5 Stock Moves
  const recentMoves = [...stockMoves].reverse().slice(0, 5);

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const isZeroState = invoices.length === 0 && products.length === 0 && contacts.length === 0;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Controls & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Unternehmensüberblick & Kennzahlen
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Echtzeit-Aggregation aus Fakturierung, Kasse, Lagerbestand und Einkauf
          </p>
        </div>

        {/* Period Filter Chips & Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {[
              { id: 'all', label: 'Gesamt' },
              { id: 'today', label: 'Heute' },
              { id: 'month', label: 'Monat' },
              { id: 'quarter', label: 'Quartal' },
              { id: 'year', label: 'Jahr' },
              { id: 'custom', label: 'Benutzerdefiniert' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playClick();
                  setPeriodFilter(tab.id as any);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                  periodFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                title="Startdatum"
              />
              <span className="text-slate-400 text-xs">bis</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                title="Enddatum"
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Welcome / Metric Highlights with direct inter-app links */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {/* Metric 1: Gesamtumsatz -> Opens Accounting (Abrechnung & BWA) */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('accounting');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-[#714B67] dark:hover:border-purple-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title="Klicken, um Abrechnung & BWA zu öffnen"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">Gesamtumsatz (Abrechnung)</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-[#714B67] dark:text-purple-400 shrink-0 group-hover:scale-110 transition">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(totalInvoiced)}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate">
            <span className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{formatCurrency(totalPaid)} bezahlt</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition shrink-0" />
          </div>
        </div>

        {/* Metric 2: Offene Forderungen -> Opens Invoices */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('invoices');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-amber-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title="Klicken, um offene Rechnungen anzuzeigen"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">Offene Forderungen</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-110 transition">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
              {formatCurrency(totalOpen)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 truncate">
            <span className="truncate">{invoices.filter(i => i.status === 'posted').length} offen</span>
            <div className="flex items-center gap-1">
              {totalDraft > 0 && <span className="text-slate-400 font-mono-num truncate">({formatCurrency(totalDraft)} Entwurf)</span>}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition shrink-0" />
            </div>
          </div>
        </div>

        {/* Metric 3: Aktueller Lagerwert -> Opens Stock/Lager */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('stock');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-emerald-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title="Klicken, um Lagerbuchungen & Bestand anzuzeigen"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">Lagerwert (EK)</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(totalInventoryValue)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 truncate">
            <span className="truncate">VK: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono-num">{formatCurrency(totalInventoryRetailValue)}</span></span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition shrink-0" />
          </div>
        </div>

        {/* Metric 4: Lagerstatus & Produkte -> Opens Products */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('products');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-indigo-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title="Klicken, um Produkte & Preise anzuzeigen"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">Produkte & Katalog</span>
              <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition ${lowStockProducts.length > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {products.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">aktive Artikel</span>
            </div>
          </div>
          <div className="mt-2 text-xs flex items-center justify-between gap-1 truncate">
            {lowStockProducts.length > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="truncate">{lowStockProducts.length} unter Minimum</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Bestände optimal</span>
              </span>
            )}
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition shrink-0" />
          </div>
        </div>
      </div>

      {/* ZERO STATE ONBOARDING (When database is clean with 0 records) */}
      {isZeroState && (
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 dark:from-slate-850 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <div className="flex items-center justify-center mx-auto">
              {company?.letterhead_photo_url ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg shadow-indigo-900/20 border border-indigo-200 dark:border-slate-700">
                  <img src={company.letterhead_photo_url} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <SocdofLogo size="lg" className="shadow-lg" />
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {company?.name ? `Willkommen bei ${company.name}` : 'Willkommen in Ihrem sauberen SOCDOF System'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              Ihre lokale Datenbank ist betriebsbereit und vollständig auf 0 initialisiert. Legen Sie direkt mit Ihren echten Kunden, Artikeln oder Rechnungen los:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
              {/* Step 1: Contact */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenNewContact();
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:shadow-md transition group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">1. Ersten Kontakt anlegen</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kunde oder Lieferant mit Anschrift & Steuernummer erfassen.
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
                  <span>Jetzt anlegen</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* Step 2: Product */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onNavigate('products');
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:shadow-md transition group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <Package className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">2. Artikel & Preise</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Produkte, Dienstleistungen, EK/VK-Preise und Lagerbestände einpflegen.
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <span>Artikelkatalog öffnen</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* Step 3: Invoice */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenNewInvoice();
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:shadow-md transition group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <Receipt className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">3. Erste Rechnung erstellen</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Professionelle Ausgangsrechnung nach DIN 5008 drucken oder versenden.
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <span>Rechnung schreiben</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warn-Center: Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Warn-Center: Niedriger Lagerbestand ({lowStockProducts.length} Artikel unter Mindestbestand)
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  Folgende Artikel sollten nachbestellt oder durch einen Wareneingang aufgestockt werden.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Alle Produkte anzeigen</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[170px]" title={p.name}>
                    {p.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num mt-0.5">
                    SKU: {p.sku}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold font-mono-num bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                      {p.qty_available} {p.unit || 'Stk.'}
                    </span>
                    <div className="text-[10px] text-slate-400">Min: {p.min_qty ?? 5}</div>
                  </div>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onOpenStockTransfer(p.id);
                    }}
                    className="p-1.5 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-medium transition"
                    title="Wareneingang buchen"
                  >
                    <PackageCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Dual Grid: Recent Invoices & Recent Stock Moves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Letzte Rechnungen */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-[#714B67] dark:text-purple-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Letzte Rechnungen</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Forderungen & Zahlungen</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('invoices')}
                className="text-xs font-semibold text-[#714B67] dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <span>Alle Rechnungen</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>Noch keine Rechnungen erfasst.</p>
                <button
                  onClick={onOpenNewInvoice}
                  className="px-3 py-1.5 bg-[#714B67] text-white rounded-xl text-xs font-medium hover:bg-purple-800 transition"
                >
                  Erste Rechnung erstellen
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{inv.number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : inv.status === 'posted'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'posted' ? 'Gebucht' : 'Entwurf'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {inv.contact_name || 'Kunde'} • {inv.date}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono-num font-bold text-xs text-slate-900 dark:text-white">
                        {formatCurrency(inv.total)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {inv.items.length} Positionen
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onOpenNewInvoice}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-[#714B67] hover:text-white dark:hover:bg-purple-900 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Neue Rechnung anlegen</span>
            </button>
          </div>
        </div>

        {/* Card 2: Letzte Lagerbuchungen (Doppik) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Letzte Lagerbewegungen</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Doppeltes Buchungssystem</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('stock')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Buchungsjournal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMoves.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>Noch keine Lagerbuchungen vorhanden.</p>
                <button
                  onClick={() => onOpenStockTransfer()}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition"
                >
                  Ersten Wareneingang buchen
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
                {recentMoves.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[200px]" title={m.product_name}>
                        {m.product_name || `Produkt #${m.product_id}`}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        <span>{m.source_location.replace('Virtual/', '').replace('Physical/', '')}</span>
                        <span>→</span>
                        <span>{m.dest_location.replace('Virtual/', '').replace('Physical/', '')}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block font-mono font-bold text-xs ${
                        m.dest_location === 'Physical/Warehouse' 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {m.dest_location === 'Physical/Warehouse' ? '+' : '-'}{m.qty} Stk.
                      </span>
                      <div className="text-[10px] text-slate-400">
                        {new Date(m.date).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onOpenStockTransfer()}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Wareneingang / Umbuchung durchführen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
