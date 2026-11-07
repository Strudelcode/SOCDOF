import React, { useState, useEffect } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Package, 
  Receipt, 
  ShoppingBag, 
  ShoppingCart, 
  Boxes, 
  Settings, 
  Plus, 
  Sliders, 
  Moon, 
  Sun,
  X,
  ArrowRight,
  Database,
  Calculator,
  BookOpen,
  Utensils
} from 'lucide-react';
import { ActiveModule, Contact, Product, Invoice, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t, formatShortcut } from '../lib/i18n';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (module: ActiveModule) => void;
  onQuickAction: (action: 'new_invoice' | 'new_contact' | 'new_product' | 'new_stock_move' | 'new_purchase') => void;
  onOpenStudio: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  contacts: Contact[];
  products: Product[];
  invoices: Invoice[];
  profile?: CompanyProfile;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectModule,
  onQuickAction,
  onOpenStudio,
  onToggleTheme,
  isDark,
  contacts,
  products,
  invoices,
  profile
}) => {
  const currentLang = useLanguage();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const appActions = [
    { label: t('module.dashboard', currentLang, 'Dashboard & Berichte'), module: 'dashboard' as ActiveModule, icon: LayoutDashboard, category: 'Navigation' },
    { label: t('module.invoices', currentLang, 'Verkauf & Rechnungen'), module: 'invoices' as ActiveModule, icon: Receipt, category: 'Navigation' },
    { label: t('module.accounting', currentLang, 'Abrechnung & Finanzen'), module: 'accounting' as ActiveModule, icon: Calculator, category: 'Navigation' },
    { label: t('module.contacts', currentLang, 'CRM & Kontakte'), module: 'contacts' as ActiveModule, icon: Users, category: 'Navigation' },
    { label: t('module.products', currentLang, 'Artikel & Produkte'), module: 'products' as ActiveModule, icon: Package, category: 'Navigation' },
    { label: t('module.pos', currentLang, 'Point of Sale (Kasse)'), module: 'pos' as ActiveModule, icon: ShoppingBag, category: 'Navigation' },
    { label: t('module.restaurant', currentLang, 'Restaurant & Gastro POS'), module: 'restaurant' as ActiveModule, icon: Utensils, category: 'Navigation' },
    { label: t('module.purchases', currentLang, 'Einkauf & Beschaffung'), module: 'purchases' as ActiveModule, icon: ShoppingCart, category: 'Navigation' },
    { label: t('module.stock', currentLang, 'Lagerbuchungen & Bestände'), module: 'stock' as ActiveModule, icon: Boxes, category: 'Navigation' },
    { label: t('module.docs', currentLang, 'Handbuch & Dokumentation'), module: 'docs' as ActiveModule, icon: BookOpen, category: 'Navigation' },
    { label: t('module.appstore', currentLang, 'App Store & Module'), module: 'appstore' as ActiveModule, icon: Boxes, category: 'Navigation' },
    { label: t('module.settings', currentLang, 'Einstellungen & Backups'), module: 'settings' as ActiveModule, icon: Settings, category: 'Navigation' },
  ];

  const quickActions = [
    { label: t('action.new_invoice', currentLang, 'Neue Ausgangsrechnung erstellen'), action: 'new_invoice' as const, icon: Plus, category: 'Aktionen' },
    { label: t('action.new_contact', currentLang, 'Neuen Kunden / Partner anlegen'), action: 'new_contact' as const, icon: Plus, category: 'Aktionen' },
    { label: t('action.new_product', currentLang, 'Neuen Artikel / Produkt erfassen'), action: 'new_product' as const, icon: Plus, category: 'Aktionen' },
    { label: t('action.new_stock_move', currentLang, 'Wareneingang / Lagerbuchung tätigen'), action: 'new_stock_move' as const, icon: Plus, category: 'Aktionen' },
    { label: t('action.new_purchase', currentLang, 'Lieferantenbestellung (Einkauf) anlegen'), action: 'new_purchase' as const, icon: Plus, category: 'Aktionen' },
  ];

  const filteredApps = appActions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));
  const filteredQuick = quickActions.filter(q => q.label.toLowerCase().includes(query.toLowerCase()));
  
  const matchingContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    (c.company && c.company.toLowerCase().includes(query.toLowerCase())) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3);

  const matchingProducts = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.sku.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3);

  const matchingInvoices = invoices.filter(i => 
    i.number.toLowerCase().includes(query.toLowerCase()) || 
    (i.contact_name && i.contact_name.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-up flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              currentLang === 'de' ? 'Befehl, App, Kunde, Artikel oder Rechnungsnummer suchen...' :
              currentLang === 'fr' ? 'Rechercher commande, application, contact, article...' :
              currentLang === 'es' ? 'Buscar comando, app, cliente, artículo o factura...' :
              'Search command, app, customer, product, or invoice number...'
            }
            className="w-full text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Quick Actions */}
          {filteredQuick.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {currentLang === 'de' ? 'Schnellaktionen' : currentLang === 'fr' ? 'Actions rapides' : currentLang === 'es' ? 'Acciones rápidas' : 'Quick Actions'}
              </div>
              <div className="space-y-1 mt-1">
                {filteredQuick.map((qa, idx) => {
                  const Icon = qa.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        sounds.playClick();
                        onQuickAction(qa.action);
                        onClose();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 flex items-center justify-between group transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{qa.label}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Module Navigation */}
          {filteredApps.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {currentLang === 'de' ? 'SOCDOF Module' : currentLang === 'fr' ? 'Modules SOCDOF' : currentLang === 'es' ? 'Módulos SOCDOF' : 'SOCDOF Modules'}
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {filteredApps.map((app, idx) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        sounds.playClick();
                        onSelectModule(app.module);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition text-left"
                    >
                      <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-medium truncate">{app.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Contacts / CRM */}
          {matchingContacts.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {currentLang === 'de' ? `Kontakte & Kunden (${matchingContacts.length})` :
                 currentLang === 'fr' ? `Contacts & Clients (${matchingContacts.length})` :
                 currentLang === 'es' ? `Contactos y clientes (${matchingContacts.length})` :
                 `Contacts & Customers (${matchingContacts.length})`}
              </div>
              <div className="space-y-1 mt-1">
                {matchingContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      sounds.playClick();
                      onSelectModule('contacts');
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left transition"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{contact.name}</span>
                      {contact.company && <span className="text-slate-500 ml-2">({contact.company})</span>}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {contact.city || contact.email || (currentLang === 'de' ? 'Kunde' : 'Contact')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Products */}
          {matchingProducts.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {currentLang === 'de' ? `Artikel & Produkte (${matchingProducts.length})` :
                 currentLang === 'fr' ? `Articles & Produits (${matchingProducts.length})` :
                 currentLang === 'es' ? `Artículos y productos (${matchingProducts.length})` :
                 `Products & Items (${matchingProducts.length})`}
              </div>
              <div className="space-y-1 mt-1">
                {matchingProducts.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      sounds.playClick();
                      onSelectModule('products');
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left transition"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{prod.name}</span>
                      <span className="text-slate-400 font-mono text-[11px] ml-2">SKU: {prod.sku}</span>
                    </div>
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {prod.sale_price.toFixed(2)} €
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Invoices */}
          {matchingInvoices.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {currentLang === 'de' ? `Rechnungen (${matchingInvoices.length})` :
                 currentLang === 'fr' ? `Factures (${matchingInvoices.length})` :
                 currentLang === 'es' ? `Facturas (${matchingInvoices.length})` :
                 `Invoices (${matchingInvoices.length})`}
              </div>
              <div className="space-y-1 mt-1">
                {matchingInvoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => {
                      sounds.playClick();
                      onSelectModule('invoices');
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left transition"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{inv.number}</span>
                      <span className="text-slate-500 ml-2">{inv.contact_name}</span>
                    </div>
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {inv.total.toFixed(2)} €
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Studio & System */}
          <div>
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {currentLang === 'de' ? 'System & Ansicht' :
               currentLang === 'fr' ? 'Système & Affichage' :
               currentLang === 'es' ? 'Sistema y vista' :
               'System & View'}
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenStudio();
                  onClose();
                }}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition"
              >
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">
                  {currentLang === 'de' ? 'SOCDOF Studio öffnen' :
                   currentLang === 'fr' ? 'Ouvrir SOCDOF Studio' :
                   currentLang === 'es' ? 'Abrir SOCDOF Studio' :
                   'Open SOCDOF Studio'}
                </span>
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onToggleTheme();
                  onClose();
                }}
                className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                <span className="font-medium">
                  {isDark ? 
                    (currentLang === 'de' ? 'Light Mode aktivieren' : currentLang === 'fr' ? 'Activer le mode clair' : currentLang === 'es' ? 'Activar modo claro' : 'Enable Light Mode') :
                    (currentLang === 'de' ? 'Dark Mode aktivieren' : currentLang === 'fr' ? 'Activer le mode sombre' : currentLang === 'es' ? 'Activar modo oscuro' : 'Enable Dark Mode')
                  }
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between px-4">
          <span>
            {currentLang === 'de' ? 'Tipp: Drücken Sie ' : currentLang === 'fr' ? 'Astuce : Appuyez sur ' : currentLang === 'es' ? 'Consejo: Presione ' : 'Tip: Press '}
            <kbd className="font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
              {formatShortcut('Ctrl+K', currentLang, profile?.shortcut_modifier_style)}
            </kbd>
          </span>
          <span>SOCDOF Windows ERP Suite</span>
        </div>
      </div>
    </div>
  );
};
