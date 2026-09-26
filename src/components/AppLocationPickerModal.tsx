import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Receipt,
  Users,
  Calculator,
  Package,
  Layers,
  CreditCard,
  Utensils,
  ShoppingCart,
  Hospital,
  Headphones,
  Calendar,
  Monitor,
  FileText,
  Settings,
  BookOpen,
  Bug,
  Boxes,
  Sparkles,
  PlusCircle,
  Check
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

export interface AppPickerItem {
  id: string;
  nameKey: string;
  defaultName: string;
  descKey: string;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: 'core' | 'finance' | 'sales' | 'ops' | 'tools' | 'custom';
}

export const PICKER_APP_ITEMS: AppPickerItem[] = [
  {
    id: 'dashboard',
    nameKey: 'module.dashboard',
    defaultName: 'Dashboard',
    descKey: 'desc.dashboard',
    defaultDesc: 'ERP Dashboard & KPI-Übersicht',
    icon: Boxes,
    color: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    category: 'core'
  },
  {
    id: 'invoices',
    nameKey: 'module.invoices',
    defaultName: 'Rechnungen',
    descKey: 'desc.invoices',
    defaultDesc: 'Fakturierung, Angebote & DIN-A4 Druck',
    icon: Receipt,
    color: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    category: 'finance'
  },
  {
    id: 'support_services',
    nameKey: 'module.support_services',
    defaultName: 'Support & Zeiterfassung',
    descKey: 'desc.support_services',
    defaultDesc: 'Dienstleistungen, Tickets & Abrechnung',
    icon: Headphones,
    color: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    category: 'ops'
  },
  {
    id: 'contacts',
    nameKey: 'module.contacts',
    defaultName: 'Kontakte & CRM',
    descKey: 'desc.contacts',
    defaultDesc: 'Kundenbuch, Lieferanten & Adressen',
    icon: Users,
    color: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    category: 'sales'
  },
  {
    id: 'accounting',
    nameKey: 'module.accounting',
    defaultName: 'Abrechnung & BWA',
    descKey: 'desc.accounting',
    defaultDesc: 'BWA, EÜR, Finanzen & Buchhaltung',
    icon: Calculator,
    color: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    category: 'finance'
  },
  {
    id: 'products',
    nameKey: 'module.products',
    defaultName: 'Artikel & Produkte',
    descKey: 'desc.products',
    defaultDesc: 'Katalog, Barcodes & Preislisten',
    icon: Package,
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    category: 'sales'
  },
  {
    id: 'stock',
    nameKey: 'module.stock',
    defaultName: 'Lager & Bestände',
    descKey: 'desc.stock',
    defaultDesc: 'Warenbewegungen & Inventur',
    icon: Layers,
    color: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    category: 'ops'
  },
  {
    id: 'pos',
    nameKey: 'module.pos',
    defaultName: 'POS Kasse',
    descKey: 'desc.pos',
    defaultDesc: 'Point of Sale, Touch-Kasse & Belege',
    icon: CreditCard,
    color: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    category: 'sales'
  },
  {
    id: 'ios_billing',
    nameKey: 'module.ios_billing',
    defaultName: 'Schnellkasse & Speisen',
    descKey: 'desc.ios_billing',
    defaultDesc: 'Schnellkasse, Speisen & Beilagen',
    icon: Utensils,
    color: 'bg-gradient-to-br from-indigo-600 to-purple-600',
    category: 'sales'
  },
  {
    id: 'restaurant',
    nameKey: 'module.restaurant',
    defaultName: 'Restaurant & Gastro',
    descKey: 'desc.restaurant',
    defaultDesc: 'Speisekarte, Tischplan & Bestellungen',
    icon: Utensils,
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
    category: 'sales'
  },
  {
    id: 'purchases',
    nameKey: 'module.purchases',
    defaultName: 'Einkauf & Bestellungen',
    descKey: 'desc.purchases',
    defaultDesc: 'Lieferantenbestellungen & Einkauf',
    icon: ShoppingCart,
    color: 'bg-gradient-to-br from-orange-500 to-amber-600',
    category: 'ops'
  },
  {
    id: 'therapy_practice',
    nameKey: 'module.therapy_practice',
    defaultName: 'Praxis & Therapie',
    descKey: 'desc.therapy_practice',
    defaultDesc: 'Klienten, Sitzungen & Heilbehandlung',
    icon: Hospital,
    color: 'bg-gradient-to-br from-teal-600 to-indigo-700',
    category: 'ops'
  },
  {
    id: 'calendar',
    nameKey: 'module.calendar',
    defaultName: 'Kalender',
    descKey: 'desc.calendar',
    defaultDesc: 'Google Sync, Fristen & Termine',
    icon: Calendar,
    color: 'bg-gradient-to-br from-blue-500 to-sky-600',
    category: 'tools'
  },
  {
    id: 'calculator',
    nameKey: 'module.calculator',
    defaultName: 'Taschenrechner',
    descKey: 'desc.calculator',
    defaultDesc: 'Standard- & Wissenschaftsrechner',
    icon: Calculator,
    color: 'bg-gradient-to-br from-emerald-500 to-teal-700',
    category: 'tools'
  },
  {
    id: 'desktop_ui',
    nameKey: 'feedback.loc_desktop_ui',
    defaultName: 'Desktop, Fenster & Taskleiste',
    descKey: 'feedback.loc_desktop_ui_desc',
    defaultDesc: 'Fensterverwaltung, Themes & Desktop',
    icon: Monitor,
    color: 'bg-gradient-to-br from-slate-600 to-indigo-600',
    category: 'tools'
  },
  {
    id: 'templates',
    nameKey: 'feedback.loc_templates',
    defaultName: 'Vorlagen & DIN 5008',
    descKey: 'feedback.loc_templates_desc',
    defaultDesc: 'Briefkopf, Vorlagen & Layouts',
    icon: FileText,
    color: 'bg-gradient-to-br from-purple-500 to-pink-600',
    category: 'tools'
  },
  {
    id: 'settings',
    nameKey: 'module.settings',
    defaultName: 'Einstellungen & Backup',
    descKey: 'desc.settings',
    defaultDesc: 'System, Personalisierung & Datensicherung',
    icon: Settings,
    color: 'bg-gradient-to-br from-slate-600 to-slate-800',
    category: 'tools'
  },
  {
    id: 'docs',
    nameKey: 'module.docs',
    defaultName: 'Handbuch & Hilfe',
    descKey: 'desc.docs',
    defaultDesc: 'Dokumentation & Anleitungen',
    icon: BookOpen,
    color: 'bg-gradient-to-br from-sky-500 to-blue-600',
    category: 'tools'
  },
  {
    id: 'appstore',
    nameKey: 'module.appstore',
    defaultName: 'App Store & Module',
    descKey: 'desc.appstore',
    defaultDesc: 'Module aktivieren & verwalten',
    icon: Package,
    color: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    category: 'tools'
  },
  {
    id: 'feedback',
    nameKey: 'module.feedback',
    defaultName: 'Bug-Reports & Meldungen',
    descKey: 'desc.feedback',
    defaultDesc: 'Fehlerberichte & Discord-Tickets',
    icon: Bug,
    color: 'bg-gradient-to-br from-orange-500 to-amber-600',
    category: 'tools'
  },
  {
    id: 'custom_other',
    nameKey: 'feedback.loc_other',
    defaultName: 'Sonstiges (Eigene Eingabe)',
    descKey: 'feedback.loc_other_desc',
    defaultDesc: 'Eigene App oder Funktionsbereich manuell eingeben',
    icon: PlusCircle,
    color: 'bg-gradient-to-br from-slate-500 to-slate-700',
    category: 'custom'
  }
];

interface AppLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (displayName: string, isCustom: boolean) => void;
  selectedLocation?: string;
  title?: string;
  subtitle?: string;
}

export const AppLocationPickerModal: React.FC<AppLocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedLocation = '',
  title,
  subtitle
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const resolvedTitle = title || t('feedback.picker_title', lang, 'App oder Modul auswählen');
  const resolvedSubtitle = subtitle || t('feedback.picker_desc', lang, 'Wählen Sie die betroffene App für diesen Bericht aus:');

  const filteredItems = PICKER_APP_ITEMS.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const localizedName = t(item.nameKey, lang, item.defaultName).toLowerCase();
    const localizedDesc = t(item.descKey, lang, item.defaultDesc).toLowerCase();
    return localizedName.includes(q) || localizedDesc.includes(q) || item.defaultName.toLowerCase().includes(q);
  });

  const handlePick = (item: AppPickerItem) => {
    sounds.playClick();
    const isCustom = item.id === 'custom_other';
    const localizedName = t(item.nameKey, lang, item.defaultName);
    onSelect(localizedName, isCustom);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {resolvedTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {resolvedSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('feedback.picker_search_placeholder', lang, 'App oder Funktion suchen (z. B. Support, Rechnungen, Dashboard)...')}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Apps Grid */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto opacity-40 text-indigo-400" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('lang_modal.no_search_results', lang, 'Keine passende App gefunden')}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('feedback.loc_other_hint', lang, 'Wähle "Sonstiges (Eigene Eingabe)" um eine freie Bezeichnung einzugeben.')}
              </p>
              <button
                type="button"
                onClick={() => handlePick(PICKER_APP_ITEMS[PICKER_APP_ITEMS.length - 1])}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{t('feedback.loc_other', lang, 'Sonstiges (Eigene Eingabe)')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredItems.map(item => {
                const Icon = item.icon;
                const locName = t(item.nameKey, lang, item.defaultName);
                const locDesc = t(item.descKey, lang, item.defaultDesc);
                const isSelected = selectedLocation === locName || (item.id === 'custom_other' && selectedLocation.startsWith('Sonstiges'));

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePick(item)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition cursor-pointer group ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-2xs'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.color} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {locName}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {locDesc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px]">
            {filteredItems.length} {t('desktop.start_all_apps', lang, 'Apps & Module')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            {t('auth.close', lang, 'Schließen')}
          </button>
        </div>
      </div>
    </div>
  );
};
