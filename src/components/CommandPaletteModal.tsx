import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Boxes, 
  Receipt, 
  Users, 
  Package, 
  Layers, 
  CreditCard, 
  ShoppingCart, 
  Settings, 
  Calculator, 
  Calendar, 
  BookOpen, 
  Utensils, 
  Headphones, 
  Plus, 
  Moon, 
  Sun, 
  Volume2, 
  VolumeX, 
  Globe, 
  Sparkles, 
  ArrowRight, 
  Command, 
  CornerDownLeft,
  X
} from 'lucide-react';
import { ActiveModule, Contact, Product, Invoice } from '../types';
import { useLanguage, t, LanguageCode } from '../lib/i18n';
import { sounds } from '../lib/sound';
import { WidgetsIcon } from './WidgetsIcon';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModule: (module: ActiveModule) => void;
  contacts: Contact[];
  products: Product[];
  invoices: Invoice[];
  isDark: boolean;
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenLanguageModal: () => void;
  currency: string;
}

interface PaletteItem {
  id: string;
  category: 'apps' | 'actions' | 'data';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badge?: string;
  shortcutHint?: string;
  onSelect: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onOpenModule,
  contacts,
  products,
  invoices,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleSound,
  onOpenLanguageModal,
  currency
}) => {
  const lang = useLanguage();
  const isGerman = lang === 'de';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // 1. Applications & Modules
    const appModules: Array<{ id: ActiveModule; title: string; subtitle: string; icon: any; color: string }> = [
      { id: 'dashboard', title: t('module.dashboard', lang, 'Dashboard'), subtitle: t('desc.dashboard', lang, 'ERP Dashboard & KPIs'), icon: Boxes, color: 'bg-purple-600' },
      { id: 'invoices', title: t('module.invoices', lang, 'Rechnungen'), subtitle: t('desc.invoices', lang, 'Fakturierung & DIN 5008 PDF'), icon: Receipt, color: 'bg-indigo-600' },
      { id: 'accounting', title: t('module.accounting', lang, 'Abrechnung'), subtitle: t('desc.accounting', lang, 'BWA, EÜR & Finanzen'), icon: Calculator, color: 'bg-emerald-600' },
      { id: 'contacts', title: t('module.contacts', lang, 'Kontakte'), subtitle: t('desc.contacts', lang, 'Kunden & Lieferantenstamm'), icon: Users, color: 'bg-teal-600' },
      { id: 'products', title: t('module.products', lang, 'Produkte'), subtitle: t('desc.products', lang, 'Artikel, Preise & Barcodes'), icon: Package, color: 'bg-blue-600' },
      { id: 'stock', title: t('module.stock', lang, 'Lager'), subtitle: t('desc.stock', lang, 'Bestandsführung & Lagerorte'), icon: Layers, color: 'bg-amber-600' },
      { id: 'purchases', title: t('module.purchases', lang, 'Einkauf'), subtitle: t('desc.purchases', lang, 'Bestellungen & Wareneingang'), icon: ShoppingCart, color: 'bg-orange-600' },
      { id: 'pos', title: t('module.pos', lang, 'POS Kasse'), subtitle: t('desc.pos', lang, 'Kassensystem & Barcode-Scanner'), icon: CreditCard, color: 'bg-violet-600' },
      { id: 'calendar', title: t('module.calendar', lang, 'Kalender'), subtitle: t('desc.calendar', lang, 'Google Sync & Termine'), icon: Calendar, color: 'bg-blue-600' },
      { id: 'widgets', title: t('module.widgets', lang, 'Widgets'), subtitle: t('desc.widgets', lang, 'Desktop-Widgets & Notizen'), icon: WidgetsIcon, color: 'bg-violet-600' },
      { id: 'restaurant', title: t('module.restaurant', lang, 'Restaurant'), subtitle: t('desc.restaurant', lang, 'Tischplan & Gastronomie'), icon: Utensils, color: 'bg-amber-600' },
      { id: 'ios_billing', title: t('module.ios_billing', lang, 'Schnellkasse'), subtitle: t('desc.ios_billing', lang, 'Touch-Billing & Beilagen'), icon: Utensils, color: 'bg-indigo-600' },
      { id: 'support_services', title: t('module.support_services', lang, 'Support & Service'), subtitle: t('desc.support_services', lang, 'Tickets & Zeiterfassung'), icon: Headphones, color: 'bg-cyan-600' },
      { id: 'docs', title: t('module.docs', lang, 'Handbuch & Showcase'), subtitle: t('desc.docs', lang, 'Dokumentation & Releases'), icon: BookOpen, color: 'bg-sky-600' },
      { id: 'settings', title: t('module.settings', lang, 'Einstellungen'), subtitle: t('desc.settings', lang, 'Systemkonfiguration & Backup'), icon: Settings, color: 'bg-slate-700' },
      { id: 'appstore', title: t('module.appstore', lang, 'App Store'), subtitle: t('desc.appstore', lang, 'Module installieren'), icon: Package, color: 'bg-fuchsia-600' }
    ];

    appModules.forEach(mod => {
      items.push({
        id: `app_${mod.id}`,
        category: 'apps',
        categoryLabel: isGerman ? 'Module & Anwendungen' : 'Modules & Apps',
        title: mod.title,
        subtitle: mod.subtitle,
        icon: mod.icon,
        iconColor: mod.color,
        onSelect: () => {
          onOpenModule(mod.id);
          onClose();
        }
      });
    });

    // 2. Fast System Actions
    items.push({
      id: 'action_theme',
      category: 'actions',
      categoryLabel: isGerman ? 'Schnellaktionen' : 'Quick Actions',
      title: isDark 
        ? (isGerman ? 'Zu hellem Modus wechseln' : 'Switch to Light Mode')
        : (isGerman ? 'Zu dunklem Modus wechseln' : 'Switch to Dark Mode'),
      subtitle: isGerman ? 'Farbschema anpassen' : 'Toggle application theme',
      icon: isDark ? Sun : Moon,
      iconColor: 'bg-amber-500',
      shortcutHint: 'Theme',
      onSelect: () => {
        onToggleTheme();
        onClose();
      }
    });

    items.push({
      id: 'action_sound',
      category: 'actions',
      categoryLabel: isGerman ? 'Schnellaktionen' : 'Quick Actions',
      title: isMuted 
        ? (isGerman ? 'Systemtöne aktivieren' : 'Enable Sound Effects')
        : (isGerman ? 'Systemtöne stummschalten' : 'Mute Sound Effects'),
      subtitle: isGerman ? 'Audio-Feedback ein/ausschalten' : 'Toggle audio feedback',
      icon: isMuted ? Volume2 : VolumeX,
      iconColor: 'bg-indigo-500',
      onSelect: () => {
        onToggleSound();
        onClose();
      }
    });

    items.push({
      id: 'action_language',
      category: 'actions',
      categoryLabel: isGerman ? 'Schnellaktionen' : 'Quick Actions',
      title: isGerman ? 'Sprache / Language ändern' : 'Change Language / Sprache',
      subtitle: 'DE · EN · FR · ES',
      icon: Globe,
      iconColor: 'bg-teal-500',
      onSelect: () => {
        onClose();
        setTimeout(onOpenLanguageModal, 150);
      }
    });

    items.push({
      id: 'action_docs_showcase',
      category: 'actions',
      categoryLabel: isGerman ? 'Schnellaktionen' : 'Quick Actions',
      title: isGerman ? 'Handbuch, Showcase & Release-Notizen' : 'User Manual, Showcase & Release Notes',
      subtitle: isGerman ? 'Dokumentation & Tastenkürzel' : 'Documentation & Keyboard Shortcuts',
      icon: BookOpen,
      iconColor: 'bg-sky-500',
      shortcutHint: 'F1',
      onSelect: () => {
        onOpenModule('docs');
        onClose();
      }
    });

    // 3. Data Entities (Contacts, Invoices, Products)
    if (query.trim().length >= 2) {
      // Invoices
      invoices.slice(0, 5).forEach(inv => {
        items.push({
          id: `data_inv_${inv.id}`,
          category: 'data',
          categoryLabel: isGerman ? 'Belege & Rechnungen' : 'Invoices & Vouchers',
          title: `${inv.number} – ${inv.partner_name || (isGerman ? 'Kunde' : 'Customer')}`,
          subtitle: `${(inv.amount_total || 0).toFixed(2)} ${currency} · ${inv.state === 'posted' ? (isGerman ? 'Gebucht' : 'Posted') : (isGerman ? 'Entwurf' : 'Draft')}`,
          icon: Receipt,
          iconColor: 'bg-indigo-600',
          badge: inv.state === 'posted' ? (isGerman ? 'Gebucht' : 'Posted') : (isGerman ? 'Entwurf' : 'Draft'),
          onSelect: () => {
            onOpenModule('invoices');
            onClose();
          }
        });
      });

      // Contacts
      contacts.slice(0, 5).forEach(c => {
        items.push({
          id: `data_contact_${c.id}`,
          category: 'data',
          categoryLabel: isGerman ? 'Kontakte & Kunden' : 'Contacts & Customers',
          title: c.name,
          subtitle: c.email || c.city || (c.is_company ? (isGerman ? 'Unternehmen' : 'Company') : (isGerman ? 'Person' : 'Individual')),
          icon: Users,
          iconColor: 'bg-teal-600',
          badge: c.is_company ? (isGerman ? 'Firma' : 'Company') : undefined,
          onSelect: () => {
            onOpenModule('contacts');
            onClose();
          }
        });
      });

      // Products
      products.slice(0, 5).forEach(p => {
        items.push({
          id: `data_prod_${p.id}`,
          category: 'data',
          categoryLabel: isGerman ? 'Produkte & Artikel' : 'Products & Catalog',
          title: p.name,
          subtitle: `${(p.list_price || 0).toFixed(2)} ${currency} · ${p.default_code || (isGerman ? 'Artikel' : 'Item')}`,
          icon: Package,
          iconColor: 'bg-blue-600',
          onSelect: () => {
            onOpenModule('products');
            onClose();
          }
        });
      });
    }

    return items;
  }, [lang, isGerman, isDark, isMuted, query, contacts, products, invoices, currency, onOpenModule, onClose, onToggleTheme, onToggleSound, onOpenLanguageModal]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems.filter(item => item.category === 'apps' || item.category === 'actions');
    }
    const q = query.toLowerCase();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.categoryLabel.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Handle keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sounds.playClick();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sounds.playClick();
      setSelectedIndex(prev => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        sounds.playSuccess();
        filteredItems[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      sounds.playPop();
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-scale-in flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-indigo-500 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={isGerman ? 'Befehl eingeben, Module, Kontakte oder Rechnungen suchen...' : 'Type a command, search modules, contacts, or invoices...'}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono bg-slate-200/60 dark:bg-slate-800/80 px-2 py-0.5 rounded">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin max-h-[55vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">
                {isGerman ? `Keine Ergebnisse für "${query}" gefunden.` : `No results found for "${query}".`}
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    sounds.playSuccess();
                    item.onSelect();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs ${item.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            isSelected 
                              ? 'bg-white/20 text-white' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className={`text-[11px] truncate ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.shortcutHint && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isSelected 
                          ? 'border-white/30 text-white/90 bg-white/10' 
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                      }`}>
                        {item.shortcutHint}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white/80" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">↑↓</kbd>
              <span>{isGerman ? 'Navigieren' : 'Navigate'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">Enter</kbd>
              <span>{isGerman ? 'Auswählen' : 'Select'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">Esc</kbd>
              <span>{isGerman ? 'Schließen' : 'Close'}</span>
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            SOCDOF Spotlight
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
