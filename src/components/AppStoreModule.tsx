import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Check, 
  Download, 
  Trash2, 
  Sparkles, 
  Boxes, 
  Receipt, 
  Users, 
  Layers, 
  CreditCard, 
  ShoppingCart, 
  Settings, 
  Calculator, 
  BookOpen, 
  Pin, 
  CheckCircle2, 
  Sliders, 
  Filter,
  Utensils,
  ChefHat,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Monitor,
  Eye,
  EyeOff,
  RotateCcw,
  Plus,
  Play,
  Layers2,
  Banknote,
  Smartphone,
  Info,
  X,
  Zap,
  ArrowRight,
  Shield,
  FileCheck
} from 'lucide-react';
import { ActiveModule, StoreApp } from '../types';
import { sounds } from '../lib/sound';

interface AppStoreModuleProps {
  installedModules: ActiveModule[];
  pinnedDesktopModules: ActiveModule[];
  pinnedTaskbarModules: ActiveModule[];
  onToggleInstallModule: (moduleId: ActiveModule) => void;
  onTogglePinDesktop: (moduleId: ActiveModule) => void;
  onTogglePinTaskbar: (moduleId: ActiveModule) => void;
  onLaunchModule: (moduleId: ActiveModule) => void;
}

export const AppStoreModule: React.FC<AppStoreModuleProps> = ({
  installedModules,
  pinnedDesktopModules,
  pinnedTaskbarModules,
  onToggleInstallModule,
  onTogglePinDesktop,
  onTogglePinTaskbar,
  onLaunchModule
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'uninstalled' | 'financial' | 'desktop'>('all');
  const [showSystemApps, setShowSystemApps] = useState<boolean>(true);
  const [selectedAppDetail, setSelectedAppDetail] = useState<StoreApp | null>(null);

  // Unified Payment Config (Kreditkarte & Bargeld zusammen in einem Modus)
  const [paymentConfig, setPaymentConfig] = useState<{
    acceptCash: boolean;
    acceptCard: boolean;
    tseActive: boolean;
    autoPrintReceipt: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('odoo_store_payment_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      acceptCash: true,
      acceptCard: true,
      tseActive: true,
      autoPrintReceipt: false
    };
  });

  const handleUpdatePaymentConfig = (updates: Partial<typeof paymentConfig>) => {
    sounds.playClick();
    setPaymentConfig(prev => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem('odoo_store_payment_config', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const allStoreApps: StoreApp[] = [
    {
      id: 'dashboard',
      title: 'Übersicht & KPIs',
      category: 'core',
      description: 'Zentrale Schaltzentrale mit Umsatzdiagrammen, offenen Rechnungen, KPIs und Schnellaktionen.',
      iconName: 'Boxes',
      author: 'Odoo Core',
      version: '18.0.1',
      isInstalled: installedModules.includes('dashboard'),
      isFinancial: false,
      isSystem: true,
      tags: ['Dashboard', 'KPI', 'Übersicht', 'System']
    },
    {
      id: 'invoices',
      title: 'Rechnungen & DIN 5008',
      category: 'finance',
      description: 'Gesetzeskonforme Fakturierung mit Briefkopf-Wasserzeichen, GoBD-Nummernkreis & PDF-Export.',
      iconName: 'Receipt',
      badge: 'Finanziell aktiv',
      author: 'Odoo Finance',
      version: '18.2.0',
      isInstalled: installedModules.includes('invoices'),
      isFinancial: true,
      isSystem: false,
      tags: ['Rechnungen', 'Faktura', 'Finanzen', 'DIN 5008', 'PDF']
    },
    {
      id: 'accounting',
      title: 'Abrechnungen & BWA',
      category: 'finance',
      description: 'Betriebswirtschaftliche Auswertung, Einnahmen-Überschuss-Rechnung (EÜR), UStVA Voranmeldung & Mahnwesen.',
      iconName: 'Calculator',
      badge: 'Finanziell aktiv',
      author: 'Odoo Finance',
      version: '18.1.0',
      isInstalled: installedModules.includes('accounting'),
      isFinancial: true,
      isSystem: false,
      tags: ['Buchhaltung', 'BWA', 'EÜR', 'USt', 'Finanzen']
    },
    {
      id: 'contacts',
      title: 'Kontakte & CRM',
      category: 'sales',
      description: 'Kunden- & Lieferantenstamm mit Batch-Erstellung, vCard/CSV-Import und Kontakt-Historie.',
      iconName: 'Users',
      author: 'Odoo Sales',
      version: '18.0.4',
      isInstalled: installedModules.includes('contacts'),
      isFinancial: false,
      isSystem: false,
      tags: ['Kunden', 'Lieferanten', 'CRM', 'Adressbuch']
    },
    {
      id: 'pos',
      title: 'POS Touch-Kasse & Scanner',
      category: 'sales',
      description: 'Touchscreen-Kassensystem mit Barcode-Scanner-Anbindung, Wechselgeldrechner & Thermobon-Druck.',
      iconName: 'CreditCard',
      badge: 'Finanziell aktiv',
      author: 'Odoo Retail',
      version: '18.3.1',
      isInstalled: installedModules.includes('pos'),
      isFinancial: true,
      isSystem: false,
      tags: ['POS', 'Kasse', 'Barcode', 'Einzelhandel', 'Finanzen', 'Bargeld & Karte']
    },
    {
      id: 'products',
      title: 'Artikel & Preise',
      category: 'inventory',
      description: 'Produktkatalog mit Preisen, Barcodes, Mindestbeständen und mehrstufiger Kategorisierung.',
      iconName: 'Package',
      author: 'Odoo Inventory',
      version: '18.0.2',
      isInstalled: installedModules.includes('products'),
      isFinancial: false,
      isSystem: false,
      tags: ['Artikel', 'Produkte', 'Preise', 'Katalog']
    },
    {
      id: 'stock',
      title: 'Lager & Bestände',
      category: 'inventory',
      description: 'Doppelte Buchführung für Lagerbestände, Inventurverluste und Wareneingänge.',
      iconName: 'Layers',
      author: 'Odoo Inventory',
      version: '18.1.5',
      isInstalled: installedModules.includes('stock'),
      isFinancial: false,
      isSystem: false,
      tags: ['Lager', 'Bestände', 'Inventur', 'Logistik']
    },
    {
      id: 'purchases',
      title: 'Einkauf & Lieferanten',
      category: 'inventory',
      description: 'Angebotsanfragen (RFQ), Lieferantenbestellungen und Wareneingangs-Verbuchung.',
      iconName: 'ShoppingCart',
      badge: 'Finanziell aktiv',
      author: 'Odoo Logistics',
      version: '18.0.0',
      isInstalled: installedModules.includes('purchases'),
      isFinancial: true,
      isSystem: false,
      tags: ['Einkauf', 'Bestellungen', 'Lieferanten', 'Finanzen']
    },
    {
      id: 'ios_billing',
      title: 'iOS Gastro & Speisen-Kasse',
      category: 'gastro',
      description: 'Cupertino 1-Screen Gastro-Kasse mit Speisekarte, Beilagen-Optionen (Kartoffelsalat etc.), Schnellbon & Umsatz-Journal.',
      iconName: 'Utensils',
      badge: 'Optionales Gastro-Modul',
      author: 'Odoo Hospitality',
      version: '18.5.0',
      isInstalled: installedModules.includes('ios_billing'),
      isFinancial: true,
      isSystem: false,
      tags: ['Gastro', 'Speisekarte', 'Kasse', 'Beilagen', 'Finanzen', 'Bon']
    },
    {
      id: 'restaurant',
      title: 'Restaurant, Tische & KDS',
      category: 'gastro',
      description: 'Gastronomie-Modul mit digitaler Speisekarte, Tischverwaltung, KDS Küchen-Display und TSE Belegen.',
      iconName: 'Utensils',
      badge: 'Optionales Gastro-Modul',
      author: 'Odoo Hospitality',
      version: '18.4.2',
      isInstalled: installedModules.includes('restaurant'),
      isFinancial: true,
      isSystem: false,
      tags: ['Restaurant', 'Tische', 'Speisekarte', 'Küche', 'KDS', 'Gastro']
    },
    {
      id: 'docs',
      title: 'Handbuch & Dokumentation',
      category: 'productivity',
      description: 'Vollständige interaktive Dokumentation mit Suchfunktion und Tastaturkürzeln.',
      iconName: 'BookOpen',
      badge: 'System-Basis',
      author: 'Odoo Docs',
      version: '1.0.0',
      isInstalled: installedModules.includes('docs'),
      isFinancial: false,
      isSystem: true,
      tags: ['Handbuch', 'Hilfe', 'Dokumentation', 'Tastenkürzel']
    },
    {
      id: 'settings',
      title: 'Einstellungen & System',
      category: 'core',
      description: 'Briefkopf-Wasserzeichen, Firmendaten, Backups, Sounds, TSE & Speicherplatz-Monitor.',
      iconName: 'Settings',
      badge: 'System-Basis',
      author: 'Odoo System',
      version: '18.0.0',
      isInstalled: installedModules.includes('settings'),
      isFinancial: false,
      isSystem: true,
      tags: ['Einstellungen', 'Briefkopf', 'Backup', 'System', 'TSE']
    }
  ];

  const getAppIcon = (id: ActiveModule) => {
    switch (id) {
      case 'dashboard': return Boxes;
      case 'invoices': return Receipt;
      case 'ios_billing':
      case 'restaurant': return Utensils;
      case 'accounting': return Calculator;
      case 'contacts': return Users;
      case 'pos': return CreditCard;
      case 'products': return Package;
      case 'stock': return Layers;
      case 'purchases': return ShoppingCart;
      case 'docs': return BookOpen;
      case 'settings': return Settings;
      default: return Package;
    }
  };

  const getAppColor = (id: ActiveModule) => {
    switch (id) {
      case 'dashboard': return 'bg-purple-600';
      case 'invoices': return 'bg-indigo-600';
      case 'ios_billing':
      case 'restaurant': return 'bg-amber-600';
      case 'accounting': return 'bg-emerald-600';
      case 'contacts': return 'bg-teal-600';
      case 'pos': return 'bg-violet-600';
      case 'products': return 'bg-blue-600';
      case 'stock': return 'bg-amber-600';
      case 'purchases': return 'bg-orange-600';
      case 'docs': return 'bg-sky-600';
      case 'settings': return 'bg-slate-700';
      default: return 'bg-indigo-600';
    }
  };

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return allStoreApps.filter(app => {
      // System apps toggle
      if (!showSystemApps && app.isSystem) return false;

      // Category filter
      const matchesCat = selectedCategory === 'all' || app.category === selectedCategory;

      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'installed') {
        matchesStatus = app.isInstalled;
      } else if (statusFilter === 'uninstalled') {
        matchesStatus = !app.isInstalled;
      } else if (statusFilter === 'financial') {
        matchesStatus = Boolean(app.isFinancial && app.isInstalled);
      } else if (statusFilter === 'desktop') {
        matchesStatus = pinnedDesktopModules.includes(app.id);
      }

      // Search query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        app.title.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query) ||
        (app.tags && app.tags.some(t => t.toLowerCase().includes(query)));

      return matchesCat && matchesStatus && matchesSearch;
    });
  }, [allStoreApps, showSystemApps, selectedCategory, statusFilter, searchQuery, pinnedDesktopModules]);

  // Statistics
  const totalAppsCount = allStoreApps.length;
  const installedCount = allStoreApps.filter(a => a.isInstalled).length;
  const uninstalledCount = totalAppsCount - installedCount;
  const financialActiveCount = allStoreApps.filter(a => a.isFinancial && a.isInstalled).length;
  const desktopPinnedCount = pinnedDesktopModules.length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Info */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2 border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SOCDOF App Store & Modulverwaltung</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              ERP-Module anpassen & erweitern
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Aktivieren oder deaktivieren Sie ERP-Module mit einem Klick. Alle Module greifen nahtlos auf die gemeinsame Kunden-, Artikel- und Buchhaltungsdatenbank zu.
            </p>
          </div>

          {/* Clean Metric Counters */}
          <div className="grid grid-cols-2 gap-3 text-center min-w-[200px]">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-slate-300 block font-medium">Verfügbar</span>
              <span className="text-xl font-bold text-white">{totalAppsCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20">
              <span className="text-[11px] text-emerald-300 block font-medium">Aktiv</span>
              <span className="text-xl font-bold text-emerald-400">{installedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Payment & Terminal Configuration Box */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Zahlungsarten & Kassen-Optionen
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              100% kostenlos: Banküberweisungen mit QR-GiroCode und Barzahlung sind immer gebührenfrei nutzbar. Kartenzahlungen / Terminal können Sie bei Bedarf flexibel zuschalten.
            </p>
          </div>

          {/* Unified Payment Method Dual Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Cash Option */}
            <button
              type="button"
              onClick={() => handleUpdatePaymentConfig({ acceptCash: !paymentConfig.acceptCash })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                paymentConfig.acceptCash
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Bar & Kasse</span>
              {paymentConfig.acceptCash && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* Credit Card Option */}
            <button
              type="button"
              onClick={() => handleUpdatePaymentConfig({ acceptCard: !paymentConfig.acceptCard })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                paymentConfig.acceptCard
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Karte / Terminal</span>
              {paymentConfig.acceptCard && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kostenfreie SEPA QR-Rechnungen aktiv</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Automatische Kassenbuchung</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs: Status & Category Controls */}
      <div className="space-y-3">
        {/* 1. Status Filter Segmented Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold overflow-x-auto max-w-full">
            <button
              onClick={() => { sounds.playClick(); setStatusFilter('all'); }}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>Alle Module</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300">
                {totalAppsCount}
              </span>
            </button>

            <button
              onClick={() => { sounds.playClick(); setStatusFilter('installed'); }}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                statusFilter === 'installed'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Aktiviert</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === 'installed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              }`}>
                {installedCount}
              </span>
            </button>

            <button
              onClick={() => { sounds.playClick(); setStatusFilter('uninstalled'); }}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                statusFilter === 'uninstalled'
                  ? 'bg-slate-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>Verfügbar / Deaktiviert</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300">
                {uninstalledCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Module suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
        </div>

        {/* 2. Category Chips Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'all', label: 'Alle Kategorien' },
            { id: 'finance', label: 'Finanzen & Rechnungen', icon: Calculator },
            { id: 'sales', label: 'Verkauf & CRM', icon: Users },
            { id: 'inventory', label: 'Lager & Einkauf', icon: Layers },
            { id: 'gastro', label: 'Gastronomie', icon: Utensils },
            { id: 'productivity', label: 'Dokumentation', icon: BookOpen },
            { id: 'core', label: 'System & Verwaltung', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setSelectedCategory(tab.id); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Apps Grid */}
      {filteredApps.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 mx-auto flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Keine Module für diese Filterung gefunden</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Versuchen Sie andere Suchbegriffe oder setzen Sie den Status- und Kategoriefilter zurück.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setStatusFilter('all');
              setShowSystemApps(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-500 transition"
          >
            Alle Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => {
            const Icon = getAppIcon(app.id);
            const colorClass = getAppColor(app.id);
            const isInstalled = app.isInstalled;
            const isPinnedDesktop = pinnedDesktopModules.includes(app.id);

            return (
              <div
                key={app.id}
                onClick={() => setSelectedAppDetail(app)}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between cursor-pointer group ${
                  isInstalled 
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700' 
                    : 'bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-85 hover:opacity-100'
                }`}
              >
                <div>
                  {/* Card Header: Icon, Title, Status Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${colorClass} text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                          <span>{app.title}</span>
                          {app.isFinancial && isInstalled && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center gap-0.5 border border-amber-300/40">
                              <DollarSign className="w-2.5 h-2.5" />
                              <span>Finanziell aktiv</span>
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400">{app.author} • v{app.version}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                      isInstalled 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {isInstalled ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Aktiv</span>
                        </>
                      ) : (
                        <span>Inaktiv</span>
                      )}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {app.description}
                  </p>

                  {/* Tags */}
                  {app.tags && app.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {app.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md text-[10px] text-slate-500 font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Actions: Launch & Toggle Activate */}
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isInstalled ? 'Modul betriebsbereit' : 'Nicht installiert'}
                  </span>

                  {/* Open & Activate/Deactivate actions */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {app.isSystem ? (
                      <button
                        onClick={() => onLaunchModule(app.id)}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Öffnen</span>
                      </button>
                    ) : isInstalled ? (
                      <>
                        <button
                          onClick={() => onLaunchModule(app.id)}
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Öffnen</span>
                        </button>
                        <button
                          onClick={() => onToggleInstallModule(app.id)}
                          title="Modul deaktivieren"
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Deaktivieren</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onToggleInstallModule(app.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Aktivieren</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* App Detail Modal / Configuration Drawer */}
      {selectedAppDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const Icon = getAppIcon(selectedAppDetail.id);
                  const color = getAppColor(selectedAppDetail.id);
                  return (
                    <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7" />
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedAppDetail.title}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAppDetail.isInstalled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {selectedAppDetail.isInstalled ? 'Aktiviert' : 'Deaktiviert'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedAppDetail.author} • Version {selectedAppDetail.version} • {selectedAppDetail.category.toUpperCase()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { sounds.playClick(); setSelectedAppDetail(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Beschreibung</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedAppDetail.description}
                </p>
              </div>

              {/* Unified Payment & Checkout section for financial/POS apps */}
              {selectedAppDetail.isFinancial && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-500" />
                      <span>Integrierte Zahlungsoptionen (Kreditkarte & Bargeld)</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Einheitlich
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dieses Modul unterstützt gleichberechtigt Kartenzahlung (EC/Kredit) und Bargeldabwicklung mit automatischem Belegdruck.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <div className="text-left">
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">Kartenzahlung</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">Aktiv • ZVT / NFC</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <div className="text-left">
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">Bargeld</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">Aktiv • Kassenlade</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedAppDetail.tags && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Funktions-Schlagwörter</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAppDetail.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* System App Notice */}
              {selectedAppDetail.isSystem && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 block">Geschützte Systemkomponente</span>
                    Dieses Modul ist das Fundament der Odoo-Systemarchitektur und kann nicht deaktiviert werden.
                  </div>
                </div>
              )}

              {/* Compliance & Security */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">Vollständig Offline & GoBD-Zertifiziert</span>
                  Alle Daten verbleiben lokal auf Ihrem Gerät ohne externe Cloud-Abhängigkeiten.
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Status: <strong className={selectedAppDetail.isInstalled ? 'text-emerald-600' : 'text-slate-500'}>
                  {selectedAppDetail.isSystem ? 'System-Basis (Dauerhaft aktiv)' : selectedAppDetail.isInstalled ? 'Aktiviert' : 'Deaktiviert'}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                {!selectedAppDetail.isSystem && (
                  <button
                    onClick={() => {
                      onToggleInstallModule(selectedAppDetail.id);
                      setSelectedAppDetail(prev => prev ? { ...prev, isInstalled: !prev.isInstalled } : null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedAppDetail.isInstalled
                        ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {selectedAppDetail.isInstalled ? <Trash2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    <span>{selectedAppDetail.isInstalled ? 'Deaktivieren' : 'Aktivieren'}</span>
                  </button>
                )}

                {selectedAppDetail.isInstalled && (
                  <button
                    onClick={() => {
                      onLaunchModule(selectedAppDetail.id);
                      setSelectedAppDetail(null);
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>App öffnen</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
