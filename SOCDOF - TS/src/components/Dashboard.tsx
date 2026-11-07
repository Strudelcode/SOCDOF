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
import { useLanguage, t } from '../lib/i18n';

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
  const lang = useLanguage();
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year' | 'today' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // i18n helper bound to the reactive language of this component
  const tt = (key: string, params?: Record<string, string | number>, fallback?: string): string =>
    t(key, Object.assign({ _lang: lang }, params || {}), fallback);

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

  // POS sales revenue (secondary, non-clashing money stream)
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

  // Treat legacy seeded placeholder names as "no company name" (same trio as AuthGate onboarding)
  const legacyPlaceholders = ['Your Company Name', 'Ihr Firmenname', 'SOCDOF'];
  const companyDisplayName = company?.name && !legacyPlaceholders.includes(company.name) ? company.name : '';

  // Quick Launchpad action definitions (accent / companion alternating for anti-clash)
  const launchpadActions: Array<{
    module: ActiveModule;
    icon: React.ReactNode;
    label: string;
    desc: string;
    onClick?: () => void;
    companion?: boolean;
  }> = [
    {
      module: 'invoices',
      icon: <FileText className="w-5 h-5" />,
      label: tt('dashboard.launch_invoices', undefined, 'New invoice'),
      desc: tt('dashboard.launch_invoices_desc', undefined, 'Create an outgoing invoice'),
      onClick: onOpenNewInvoice
    },
    {
      module: 'pos',
      icon: <ShoppingBag className="w-5 h-5" />,
      label: tt('dashboard.launch_pos', undefined, 'POS sale'),
      desc: tt('dashboard.launch_pos_desc', undefined, 'Start cash register checkout'),
      companion: true
    },
    {
      module: 'contacts',
      icon: <UserPlus className="w-5 h-5" />,
      label: tt('dashboard.launch_contact', undefined, 'New contact'),
      desc: tt('dashboard.launch_contact_desc', undefined, 'Add a customer or supplier'),
      onClick: onOpenNewContact
    },
    {
      module: 'stock',
      icon: <ArrowLeftRight className="w-5 h-5" />,
      label: tt('dashboard.launch_stock', undefined, 'Stock booking'),
      desc: tt('dashboard.launch_stock_desc', undefined, 'Goods receipt or transfer'),
      companion: true
    }
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Controls & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {tt('dashboard.title', undefined, 'Company overview & key metrics')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tt('dashboard.subtitle', undefined, 'Real-time aggregation from invoicing, POS, inventory and purchasing')}
          </p>
        </div>

        {/* Period Filter Chips & Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {[
              { id: 'all', label: tt('dashboard.filter.all', undefined, 'All') },
              { id: 'today', label: tt('dashboard.filter.today', undefined, 'Today') },
              { id: 'month', label: tt('dashboard.filter.month', undefined, 'Month') },
              { id: 'quarter', label: tt('dashboard.filter.quarter', undefined, 'Quarter') },
              { id: 'year', label: tt('dashboard.filter.year', undefined, 'Year') },
              { id: 'custom', label: tt('dashboard.filter.custom', undefined, 'Custom') }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playClick();
                  setPeriodFilter(tab.id as any);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                  periodFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-accent dark:text-white shadow-xs font-bold'
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
                title={tt('dashboard.date_start', undefined, 'Start date')}
              />
              <span className="text-slate-400 text-xs">{tt('dashboard.date_to', undefined, 'to')}</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                title={tt('dashboard.date_end', undefined, 'End date')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Welcome / Metric Highlights with direct inter-app links */}
      <div className="window-grid-kpi grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {/* Metric 1: Gesamtumsatz -> Opens Accounting (Abrechnung & BWA) — PRIMARY SERIES (accent) */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('accounting');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title={tt('dashboard.kpi_revenue_hint', undefined, 'Open Accounting & BWA')}
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">{tt('dashboard.kpi_revenue', undefined, 'Total revenue (Invoicing)')}</span>
              <div 
                style={{
                  backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                  color: 'var(--accent, #4f46e5)'
                }}
                className="p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition shadow-2xs"
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(totalInvoiced)}
            </div>
          </div>
          <div 
            style={{ color: 'var(--accent-companion, #059669)' }}
            className="mt-2 flex items-center justify-between gap-1 text-xs font-medium truncate"
          >
            <span className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tt('dashboard.kpi_revenue_paid', { 0: formatCurrency(totalPaid) }, `${formatCurrency(totalPaid)} paid`)}</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
          </div>
        </div>

        {/* Metric 2: Offene Forderungen -> Opens Invoices (semantic amber, anti-clash allowed) */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('invoices');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-amber-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title={tt('dashboard.kpi_receivable_hint', undefined, 'Show open invoices')}
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">{tt('dashboard.kpi_receivable', undefined, 'Open receivables')}</span>
              <div 
                style={{
                  backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                  color: 'var(--accent, #4f46e5)'
                }}
                className="p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition shadow-2xs"
              >
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
              {formatCurrency(totalOpen)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 truncate">
            <span className="truncate">{tt('dashboard.kpi_receivable_open', { 0: String(invoices.filter(i => i.status === 'posted').length) }, `${invoices.filter(i => i.status === 'posted').length} open`)}</span>
            <div className="flex items-center gap-1">
              {totalDraft > 0 && <span className="text-slate-400 font-mono-num truncate">{tt('dashboard.kpi_receivable_draft', { 0: formatCurrency(totalDraft) }, `(${formatCurrency(totalDraft)} draft)`)}</span>}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition shrink-0" />
            </div>
          </div>
        </div>

        {/* Metric 3: POS Umsatz -> Opens POS — SECONDARY SERIES (companion, anti-clash) */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('pos');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title={tt('dashboard.kpi_pos_hint', undefined, 'Open Cash Register (POS)')}
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">{tt('dashboard.kpi_pos', undefined, 'POS revenue (Cash register)')}</span>
              <div 
                style={{
                  backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                  color: 'var(--accent-companion, #0d9488)'
                }}
                className="p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition shadow-2xs"
              >
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(totalPosRevenue)}
            </div>
          </div>
          <div className="mt-2 text-xs flex items-center justify-between gap-1 truncate">
            <span 
              style={{ color: 'var(--accent, #4f46e5)' }}
              className="font-medium flex items-center gap-1.5 truncate"
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tt('dashboard.kpi_pos_orders', { 0: String(posOrders.length) }, `${posOrders.length} POS orders`)}</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
          </div>
        </div>

        {/* Metric 4: Aktueller Lagerwert -> Opens Stock/Lager — SECONDARY SERIES (companion, anti-clash) */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('stock');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title={tt('dashboard.kpi_stock_hint', undefined, 'Show stock bookings & inventory')}
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">{tt('dashboard.kpi_stock', undefined, 'Inventory value (cost)')}</span>
              <div 
                style={{
                  backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                  color: 'var(--accent-companion, #0d9488)'
                }}
                className="p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition shadow-2xs"
              >
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {formatCurrency(totalInventoryValue)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 truncate">
            <span className="truncate">{tt('dashboard.kpi_stock_retail', { 0: formatCurrency(totalInventoryRetailValue) }, `Retail: ${formatCurrency(totalInventoryRetailValue)}`)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
          </div>
        </div>

        {/* Metric 5: Lagerstatus & Produkte -> Opens Products */}
        <div 
          onClick={() => {
            sounds.playClick();
            onNavigate('products');
          }}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:shadow-md cursor-pointer transition flex flex-col justify-between"
          title={tt('dashboard.kpi_catalog_hint', undefined, 'Show products & prices')}
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium gap-2">
              <span className="truncate">{tt('dashboard.kpi_catalog', undefined, 'Products & catalog')}</span>
              <div 
                style={lowStockProducts.length === 0 ? {
                  backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                  color: 'var(--accent-companion, #0d9488)'
                } : undefined}
                className={`p-1.5 sm:p-2 rounded-xl shrink-0 group-hover:scale-110 transition ${lowStockProducts.length > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'shadow-2xs'}`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {products.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{tt('dashboard.kpi_catalog_active', undefined, 'active items')}</span>
            </div>
          </div>
          <div className="mt-2 text-xs flex items-center justify-between gap-1 truncate">
            {lowStockProducts.length > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="truncate">{tt('dashboard.kpi_lowstock', { 0: String(lowStockProducts.length) }, `${lowStockProducts.length} below minimum`)}</span>
              </span>
            ) : (
              <span 
                style={{ color: 'var(--accent-companion, #0d9488)' }}
                className="font-medium flex items-center gap-1 truncate"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tt('dashboard.kpi_stock_ok', undefined, 'Stock levels optimal')}</span>
              </span>
            )}
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition shrink-0" />
          </div>
        </div>
      </div>

      {/* Quick Launchpad: One-tap daily workflow actions */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tt('dashboard.launch_title', undefined, 'Quick launchpad')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{tt('dashboard.launch_subtitle', undefined, 'Jump straight into your daily workflows')}</p>
        </div>
        <div className="window-grid-launchpad grid grid-cols-2 lg:grid-cols-4 gap-3">
        {launchpadActions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              sounds.playClick();
              if (action.onClick) action.onClick();
              else onNavigate(action.module);
            }}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition group flex items-start gap-3 text-left"
          >
            <div 
              style={action.companion ? {
                backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                color: 'var(--accent-companion, #0d9488)'
              } : {
                backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                color: 'var(--accent, #4f46e5)'
              }}
              className="p-2 rounded-xl shrink-0 group-hover:scale-105 transition shadow-2xs"
            >
              {action.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{action.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{action.desc}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 ml-auto self-center shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition" style={action.companion ? { color: 'var(--accent-companion, #0d9488)' } : { color: 'var(--accent, #4f46e5)' }} />
          </button>
        ))}
        </div>
      </div>

      {/* ZERO STATE ONBOARDING (When database is clean with 0 records) */}
      {isZeroState && (
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
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
              {companyDisplayName ? tt('dashboard.welcome_title', { 0: companyDisplayName }, `Welcome to ${companyDisplayName}`) : tt('dashboard.welcome_clean', undefined, 'Welcome to your clean SOCDOF system')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              {tt('dashboard.welcome_text', undefined, 'Your local database is initialized and ready at 0. Start right away with your real customers, items or invoices:')}
            </p>

            <div className="window-grid-kpi grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
              {/* Step 1: Contact */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenNewContact();
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition group text-left"
              >
                <div 
                  style={{
                    backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                    color: 'var(--accent, #4f46e5)'
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition"
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tt('dashboard.welcome_step1', undefined, '1. Create first contact')}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {tt('dashboard.welcome_step1_desc', undefined, 'Record a customer or supplier with address & tax number.')}
                </p>
                <div 
                  style={{ color: 'var(--accent, #4f46e5)' }}
                  className="mt-4 flex items-center gap-1 text-xs font-semibold"
                >
                  <span>{tt('dashboard.welcome_step1_cta', undefined, 'Create now')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* Step 2: Product */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onNavigate('products');
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition group text-left"
              >
                <div 
                  style={{
                    backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                    color: 'var(--accent-companion, #0d9488)'
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition"
                >
                  <Package className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tt('dashboard.welcome_step2', undefined, '2. Items & prices')}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {tt('dashboard.welcome_step2_desc', undefined, 'Add products, services, cost/retail prices and stock levels.')}
                </p>
                <div 
                  style={{ color: 'var(--accent-companion, #0d9488)' }}
                  className="mt-4 flex items-center gap-1 text-xs font-semibold"
                >
                  <span>{tt('dashboard.welcome_step2_cta', undefined, 'Open item catalog')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* Step 3: Invoice */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenNewInvoice();
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition group text-left"
              >
                <div 
                  style={{
                    backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                    color: 'var(--accent, #4f46e5)'
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition"
                >
                  <Receipt className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tt('dashboard.welcome_step3', undefined, '3. Create first invoice')}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {tt('dashboard.welcome_step3_desc', undefined, 'Print or send a professional invoice according to DIN 5008.')}
                </p>
                <div 
                  style={{ color: 'var(--accent, #4f46e5)' }}
                  className="mt-4 flex items-center gap-1 text-xs font-semibold"
                >
                  <span>{tt('dashboard.welcome_step3_cta', undefined, 'Write invoice')}</span>
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
                  {tt('dashboard.warn_title', { 0: String(lowStockProducts.length) }, `Warn-Center: Low stock (${lowStockProducts.length} items below minimum level)`)}
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  {tt('dashboard.warn_text', undefined, 'The following items should be reordered or topped up with a goods receipt.')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{tt('dashboard.warn_all_products', undefined, 'Show all products')}</span>
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
                      {p.qty_available} {p.unit || tt('dashboard.warn_unit', undefined, 'pcs.')}
                    </span>
                    <div className="text-[10px] text-slate-400">{tt('dashboard.warn_min', { 0: String(p.min_qty ?? 5) }, `Min: ${p.min_qty ?? 5}`)}</div>
                  </div>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onOpenStockTransfer(p.id);
                    }}
                    className="p-1.5 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-medium transition"
                    title={tt('dashboard.warn_book', undefined, 'Book goods receipt')}
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
      <div className="window-grid-dual grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Letzte Rechnungen */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div 
                  style={{
                    backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))',
                    color: 'var(--accent, #4f46e5)'
                  }}
                  className="p-2 rounded-xl"
                >
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{tt('dashboard.recent_invoices', undefined, 'Recent invoices')}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{tt('dashboard.recent_invoices_sub', undefined, 'Receivables & payments')}</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('invoices')}
                style={{ color: 'var(--accent, #4f46e5)' }}
                className="text-xs font-semibold hover:underline flex items-center gap-1"
              >
                <span>{tt('dashboard.recent_all', undefined, 'All invoices')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{tt('dashboard.empty_invoices', undefined, 'No invoices recorded yet.')}</p>
                <button
                  onClick={onOpenNewInvoice}
                  className="btn-accent px-3 py-1.5 rounded-xl text-xs font-medium transition"
                >
                  {tt('dashboard.empty_invoices_cta', undefined, 'Create first invoice')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{inv.number}</span>
                        {inv.number.startsWith('GASTRO') ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {tt('dashboard.badge_gastro', undefined, 'Gastro')}
                          </span>
                        ) : inv.number.startsWith('POS') ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            {tt('dashboard.badge_pos', undefined, 'POS')}
                          </span>
                        ) : null}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : inv.status === 'posted'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {inv.status === 'paid' ? tt('dashboard.status_paid', undefined, 'Paid') : inv.status === 'posted' ? tt('dashboard.status_posted', undefined, 'Posted') : tt('dashboard.status_draft', undefined, 'Draft')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {inv.contact_name || tt('dashboard.contact_fallback', undefined, 'Customer')} • {inv.date}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono-num font-bold text-xs text-slate-900 dark:text-white">
                        {formatCurrency(inv.total)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {tt('dashboard.items_count', { 0: String(inv.items.length) }, `${inv.items.length} items`)}
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
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-[var(--accent,#4f46e5)] hover:text-white text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{tt('dashboard.new_invoice_btn', undefined, 'Create new invoice')}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Letzte Lagerbuchungen (Doppik) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div 
                  style={{
                    backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                    color: 'var(--accent-companion, #0d9488)'
                  }}
                  className="p-2 rounded-xl"
                >
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{tt('dashboard.recent_moves', undefined, 'Recent stock moves')}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{tt('dashboard.recent_moves_sub', undefined, 'Double-entry booking system')}</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('stock')}
                style={{ color: 'var(--accent-companion, #0d9488)' }}
                className="text-xs font-semibold hover:underline flex items-center gap-1"
              >
                <span>{tt('dashboard.recent_moves_all', undefined, 'Booking journal')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMoves.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{tt('dashboard.empty_moves', undefined, 'No stock moves yet.')}</p>
                <button
                  onClick={() => onOpenStockTransfer()}
                  className="px-3 py-1.5 text-white rounded-xl text-xs font-medium transition bg-accent-companion hover:opacity-90"
                >
                  {tt('dashboard.empty_moves_cta', undefined, 'Book first goods receipt')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
                {recentMoves.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[200px]" title={m.product_name}>
                        {m.product_name || `#${m.product_id}`}
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
                          ? 'text-accent-companion' 
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {m.dest_location === 'Physical/Warehouse' ? '+' : '-'}{m.qty} {tt('dashboard.unit_pieces', undefined, 'pcs.')}
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
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-[var(--accent-companion,#0d9488)] hover:text-white text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{tt('dashboard.booking_btn', undefined, 'Post goods receipt / transfer')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
