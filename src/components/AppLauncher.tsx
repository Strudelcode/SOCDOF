import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  Boxes, 
  ReceiptText, 
  Settings, 
  LayoutDashboard, 
  ShoppingBag, 
  ShoppingCart, 
  Search, 
  Sparkles, 
  Database, 
  Trash2, 
  RotateCcw, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Calculator,
  BookOpen,
  Utensils
} from 'lucide-react';
import { ActiveModule } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';

interface AppLauncherProps {
  onSelectModule: (module: ActiveModule) => void;
  contactCount: number;
  productCount: number;
  invoiceCount: number;
  stockMoveCount: number;
  lowStockCount: number;
  isCleanMode: boolean;
  onToggleCleanMode: (enableClean: boolean) => void;
  companyName: string;
}

interface AppTile {
  id: ActiveModule;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  badgeColor?: string;
}

export const AppLauncher: React.FC<AppLauncherProps> = ({
  onSelectModule,
  contactCount,
  productCount,
  invoiceCount,
  stockMoveCount,
  lowStockCount,
  isCleanMode,
  onToggleCleanMode,
  companyName
}) => {
  const currentLang = useLanguage();
  const [search, setSearch] = useState('');
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentLang]);

  const apps: AppTile[] = [
    {
      id: 'dashboard',
      name: t('module.dashboard', currentLang, 'Dashboard & Berichte'),
      category: t('cat.analytics', currentLang, 'Analytics & KPIs'),
      description: t('desc.dashboard', currentLang, 'Echtzeit-Umsatz, Lagerwert & interaktive Finanz-Charts'),
      icon: <LayoutDashboard className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
      badge: 'Live',
      badgeColor: 'bg-emerald-500 text-white'
    },
    {
      id: 'contacts',
      name: t('module.contacts', currentLang, 'CRM & Kontakte'),
      category: t('cat.crm', currentLang, 'Kunden & Partner'),
      description: t('desc.contacts', currentLang, 'Kunden, Lieferanten, Adressbuch & Umsatz-Historie'),
      icon: <Users className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-teal-500 to-emerald-700',
      badge: `${contactCount}`,
      badgeColor: 'bg-teal-100 text-teal-800'
    },
    {
      id: 'products',
      name: t('module.products', currentLang, 'Artikel & Produkte'),
      category: t('cat.catalog', currentLang, 'Katalog & Stammdaten'),
      description: t('desc.products', currentLang, 'Stammdaten, Preise, Barcodes & Mindestbestände'),
      icon: <Package className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-amber-500 to-orange-600',
      badge: lowStockCount > 0 ? `${lowStockCount} knapp` : `${productCount}`,
      badgeColor: lowStockCount > 0 ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-orange-100 text-orange-800'
    },
    {
      id: 'invoices',
      name: t('module.invoices', currentLang, 'Verkauf & Faktura'),
      category: t('cat.billing', currentLang, 'Finanzen & Abrechnung'),
      description: t('desc.invoices', currentLang, 'Rechnungen, PDF-Druck nach DIN-5008 & Fake-SMTP Versand'),
      icon: <ReceiptText className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-purple-600 to-indigo-900',
      badge: `${invoiceCount}`,
      badgeColor: 'bg-purple-100 text-purple-900'
    },
    {
      id: 'accounting',
      name: t('module.accounting', currentLang, 'Abrechnung & BWA'),
      category: t('cat.finance', currentLang, 'Finanzen & Steuern'),
      description: t('desc.accounting', currentLang, 'BWA, EÜR, UStVA Voranmeldung & Offene-Posten Mahnwesen'),
      icon: <Calculator className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-emerald-600 to-teal-800',
      badge: t('badge.new', currentLang, 'Neu'),
      badgeColor: 'bg-emerald-100 text-emerald-900 font-bold'
    },
    {
      id: 'pos',
      name: t('module.pos', currentLang, 'Point of Sale (POS)'),
      category: t('cat.pos', currentLang, 'Kasse & Barverkauf'),
      description: t('desc.pos', currentLang, 'Touch-Kassenterminal, Barcode-Scan & Bondruck mit Kassenlade'),
      icon: <ShoppingBag className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-pink-500 to-rose-600',
      badge: t('badge.new', currentLang, 'Neu'),
      badgeColor: 'bg-pink-100 text-pink-800 font-bold'
    },
    {
      id: 'ios_billing',
      name: t('module.ios_billing', currentLang, 'iOS Kasse & Speisen'),
      category: 'iOS POS & Billing',
      description: t('desc.ios_billing', currentLang, 'iOS Kasse mit Beilagen, Speisen-Status, Direkt-Kasse & Statistiken'),
      icon: <Utensils className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
      badge: 'iOS Style',
      badgeColor: 'bg-indigo-100 text-indigo-900 font-bold'
    },
    {
      id: 'restaurant',
      name: t('module.restaurant', currentLang, 'Restaurant & Speisekarte'),
      category: t('cat.gastro', currentLang, 'Gastronomie & KDS'),
      description: t('desc.restaurant', currentLang, 'Digitale Speisekarte, Tischverwaltung, KDS Küchen-Display & GoBD Belege'),
      icon: <Utensils className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-amber-500 to-orange-700',
      badge: 'Gastro',
      badgeColor: 'bg-amber-100 text-amber-900 font-bold'
    },
    {
      id: 'purchases',
      name: t('module.purchases', currentLang, 'Einkauf & Beschaffung'),
      category: t('cat.purchasing', currentLang, 'Lieferantenbestellungen'),
      description: t('desc.purchases', currentLang, 'Preisanfragen, Bestellungen & Wareneingangs-Buchung'),
      icon: <ShoppingCart className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-cyan-600 to-blue-700',
      badge: 'Echtzeit',
      badgeColor: 'bg-cyan-100 text-cyan-800'
    },
    {
      id: 'stock',
      name: t('module.stock', currentLang, 'Lagerbuchung (Doppik)'),
      category: t('cat.inventory', currentLang, 'Logistik & Bestände'),
      description: t('desc.stock', currentLang, 'Doppeltes Buchungssystem: Wareneingang, Auslieferung & Inventur'),
      icon: <Boxes className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-amber-600 to-amber-800',
      badge: `${stockMoveCount} Buchungen`,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'docs',
      name: t('module.docs', currentLang, 'Handbuch & Docs'),
      category: t('cat.help', currentLang, 'Hilfe & Dokumentation'),
      description: t('desc.docs', currentLang, 'Umfassendes Handbuch, Tastatur-Shortcuts und Leitfäden'),
      icon: <BookOpen className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-sky-600 to-blue-800'
    },
    {
      id: 'settings',
      name: t('module.settings', currentLang, 'Einstellungen & Backup'),
      category: t('cat.system', currentLang, 'System & Firmendaten'),
      description: t('desc.settings', currentLang, 'Unternehmensprofil, IBAN/BIC, JSON-Backup & Soundeffekte'),
      icon: <Settings className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-slate-600 to-slate-800'
    }
  ];

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.category.toLowerCase().includes(search.toLowerCase()) ||
    app.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-full flex flex-col justify-between p-6 sm:p-10 bg-slate-900/60 backdrop-blur-md">
      {/* Top Header in Launcher */}
      <div className="max-w-6xl w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-700/50">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/30 text-white font-bold text-lg tracking-wider">
                SOC
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  {companyName || 'SOCDOF Suite'}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600/60 text-indigo-200 border border-indigo-400/30 font-normal">
                    SOCDOF
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Strudel's Organization, Commerce &amp; Documentation Offline Flow
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-xs shadow-inner">
              <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>{timeString}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1"></span>
              <span className="text-emerald-400 font-medium">Real-Time</span>
            </div>

            {/* Quick Data Initializer Toggle */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-1 border border-slate-700 text-xs">
              <button
                type="button"
                id="btn-launcher-demo-data"
                onClick={() => {
                  sounds.playClick();
                  onToggleCleanMode(false);
                }}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  !isCleanMode 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Beispieldaten für Produkte, Kontakte und Buchungen aktivieren"
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                Mit Beispielen
              </button>
              <button
                type="button"
                id="btn-launcher-clean-data"
                onClick={() => {
                  sounds.playClick();
                  onToggleCleanMode(true);
                }}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  isCleanMode 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Alle Daten leeren für komplett eigenen Neustart"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Leere DB (0 Daten)
              </button>
            </div>
          </div>
        </div>

        {/* Live Search Bar for Apps */}
        <div className="mt-8 max-w-xl mx-auto">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="app-launcher-search"
              placeholder={currentLang === 'de' ? 'App oder Modul suchen... (z.B. Kasse, Rechnung, CRM, Lager)' : currentLang === 'fr' ? 'Rechercher une application... (ex. Caisse, Factures, CRM, Stocks)' : currentLang === 'es' ? 'Buscar aplicación... (ej. Caja, Facturación, CRM, Inventario)' : 'Search apps or modules... (e.g. POS, Invoices, CRM, Stock)'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 pl-12 pr-4 py-3.5 rounded-2xl shadow-xl focus:outline-none focus:ring-2 focus:ring-[#875A7B] focus:border-transparent transition-all text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* App Grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredApps.map((app) => (
            <button
              key={app.id}
              id={`launcher-app-${app.id}`}
              onClick={() => {
                sounds.playClick();
                onSelectModule(app.id);
              }}
              className="group relative flex flex-col text-left p-5 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 hover:border-purple-500/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-950/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl ${app.color} flex items-center justify-center shadow-lg transition-transform group-hover:scale-105`}>
                  {app.icon}
                </div>
                {app.badge && (
                  <span className={`text-[11px] px-2.5 py-1 rounded-full ${app.badgeColor || 'bg-slate-700 text-slate-200'} shadow-sm`}>
                    {app.badge}
                  </span>
                )}
              </div>
              
              <div className="text-[11px] font-semibold tracking-wider uppercase text-purple-400/90 mb-1">
                {app.category}
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-200 transition-colors">
                {app.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {app.description}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400 group-hover:text-purple-300">
                <span>{currentLang === 'de' ? 'Öffnen' : currentLang === 'fr' ? 'Ouvrir' : currentLang === 'es' ? 'Abrir' : 'Open'}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info & Sovereignity Badge */}
      <div className="max-w-6xl w-full mx-auto mt-12 pt-6 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{currentLang === 'de' ? '100% Lokale Datenspeicherung (IndexedDB) • Keine Cloud-Übertragung • DSGVO-konform' : currentLang === 'fr' ? 'Stockage 100% local (IndexedDB) • Aucun transfert vers le cloud • Conforme RGPD' : currentLang === 'es' ? 'Almacenamiento 100% local (IndexedDB) • Sin transferencia a la nube • Cumple RGPD' : '100% Local Data Storage (IndexedDB) • Zero Cloud Transmission • GDPR Compliant'}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>{currentLang === 'de' ? 'Drücken Sie jederzeit auf das SOCDOF-Logo oben links, um zum Launcher zurückzukehren' : currentLang === 'fr' ? 'Cliquez sur le logo SOCDOF en haut à gauche pour revenir au lanceur' : currentLang === 'es' ? 'Haz clic en el logotipo de SOCDOF arriba a la izquierda para volver al iniciador' : 'Click the SOCDOF logo in the top-left anytime to return to the launcher'}</span>
        </div>
      </div>
    </div>
  );
};
