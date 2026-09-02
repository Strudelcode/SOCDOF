import React, { useState, useMemo } from 'react';
import { 
  LayoutGrid, 
  StickyNote, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  X, 
  Palette, 
  AlertTriangle, 
  Zap, 
  Check,
  Trash2,
  Settings,
  Filter,
  ChevronDown,
  Sparkles,
  Layers,
  Globe
} from 'lucide-react';
import { DesktopWidget, DesktopWidgetType, Invoice, Product, CompanyProfile, ActiveModule, VirtualDesktop } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { WidgetSettingsModal } from './WidgetSettingsModal';
import { WidgetsIcon } from './WidgetsIcon';

interface WidgetsModuleProps {
  widgets: DesktopWidget[];
  onAddWidget: (type: DesktopWidgetType, customOptions?: Partial<DesktopWidget>) => void;
  onUpdateWidget: (id: string, updates: Partial<DesktopWidget>) => void;
  onRemoveWidget: (id: string) => void;
  onAddStickyNote: (options?: { color?: string; content?: string; title?: string }) => void;
  invoices: Invoice[];
  products: Product[];
  company: CompanyProfile;
  onOpenModule: (module: ActiveModule) => void;
  virtualDesktops?: VirtualDesktop[];
  activeDesktopId?: string;
}

const STICKY_PALETTE = [
  { key: 'yellow', label: 'Gelb', bg: 'bg-amber-100 dark:bg-amber-950/90', border: 'border-amber-300 dark:border-amber-800', dot: 'bg-amber-400' },
  { key: 'blue', label: 'Blau', bg: 'bg-sky-100 dark:bg-sky-950/90', border: 'border-sky-300 dark:border-sky-800', dot: 'bg-sky-400' },
  { key: 'green', label: 'Grün', bg: 'bg-emerald-100 dark:bg-emerald-950/90', border: 'border-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-400' },
  { key: 'pink', label: 'Rosa', bg: 'bg-rose-100 dark:bg-rose-950/90', border: 'border-rose-300 dark:border-rose-800', dot: 'bg-rose-400' },
  { key: 'purple', label: 'Lila', bg: 'bg-purple-100 dark:bg-purple-950/90', border: 'border-purple-300 dark:border-purple-800', dot: 'bg-purple-400' },
  { key: 'dark', label: 'Dunkel', bg: 'bg-slate-900', border: 'border-slate-700', dot: 'bg-slate-700' },
  { key: 'transparent', label: 'Ohne Hintergrund', bg: 'bg-transparent', border: 'border-slate-400/40', dot: 'bg-white/40' }
];

type CategoryFilter = 'all' | 'phone_widget' | 'sticky_note' | 'finance' | 'time' | 'actions';

export const WidgetsModule: React.FC<WidgetsModuleProps> = ({
  widgets,
  onAddWidget,
  onUpdateWidget,
  onRemoveWidget,
  onAddStickyNote,
  invoices,
  products,
  company,
  onOpenModule,
  virtualDesktops = [],
  activeDesktopId = 'desktop-1'
}) => {
  const currentLang = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [selectedNoteColor, setSelectedNoteColor] = useState('yellow');
  const [settingsModalWidgetType, setSettingsModalWidgetType] = useState<DesktopWidgetType | null>(null);

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date?.startsWith(todayStr));
  const todayRevenue = todayInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const openInvoicesCount = invoices.filter(inv => inv.status === 'posted').length;
  const lowStockProducts = products.filter(p => p.min_qty && p.qty_available <= p.min_qty);

  const WIDGET_CATALOG_ITEMS = [
    {
      type: 'revenue_kpi' as DesktopWidgetType,
      kind: 'phone_widget' as const,
      category: 'finance' as const,
      title: t('widgets.daily_revenue', currentLang, 'Tagesumsatz & Kassen-KPI'),
      desc: t('widgets.revenue_desc', currentLang, 'Echtzeit-Statistik über heutige Einnahmen und offene Rechnungen.'),
      icon: TrendingUp,
      color: 'bg-emerald-600 text-white',
      defaultWidth: 290,
      defaultHeight: 170,
      tags: ['Umsatz', 'Finanzen', 'Kasse', 'KPI', 'Revenue']
    },
    {
      type: 'calendar_agenda' as DesktopWidgetType,
      kind: 'phone_widget' as const,
      category: 'time' as const,
      title: t('widgets.calendar_widget', currentLang, 'Tageskalender & Agenda'),
      desc: t('widgets.calendar_desc', currentLang, 'Kompaktes Kalenderblatt mit Wochentag, aktuellem Datum und Terminen.'),
      icon: Calendar,
      color: 'bg-indigo-600 text-white',
      defaultWidth: 280,
      defaultHeight: 180,
      tags: ['Kalender', 'Datum', 'Termine', 'Agenda', 'Calendar']
    },
    {
      type: 'system_clock' as DesktopWidgetType,
      kind: 'phone_widget' as const,
      category: 'time' as const,
      title: t('widgets.clock_title', currentLang, 'Uhrzeit & Zeitzonen'),
      desc: t('widgets.clock_desc', currentLang, 'Digital- oder runde Analoguhr mit Weltzeit-Städten, Sekunden & ohne Hintergrund.'),
      icon: Clock,
      color: 'bg-sky-600 text-white',
      defaultWidth: 260,
      defaultHeight: 160,
      tags: ['Uhr', 'Zeit', 'Clock', 'Time', 'Weltzeit', 'Analog']
    },
    {
      type: 'stock_alert' as DesktopWidgetType,
      kind: 'phone_widget' as const,
      category: 'actions' as const,
      title: t('widgets.stock_alert_title', currentLang, 'Lagerbestand-Warnung'),
      desc: t('widgets.stock_alert_desc', currentLang, 'Überwacht Artikel unter Mindestbestand für schnelle Nachbestellungen.'),
      icon: AlertTriangle,
      color: 'bg-amber-600 text-white',
      defaultWidth: 290,
      defaultHeight: 170,
      tags: ['Lager', 'Bestand', 'Warnung', 'Stock', 'Inventory']
    },
    {
      type: 'quick_actions' as DesktopWidgetType,
      kind: 'phone_widget' as const,
      category: 'actions' as const,
      title: t('widgets.quick_actions_title', currentLang, 'Schnellstarter (Anpassbar)'),
      desc: t('widgets.quick_actions_desc', currentLang, 'Individuell konfigurierbare Direktlinks auf 4 beliebige Apps.'),
      icon: Zap,
      color: 'bg-violet-600 text-white',
      defaultWidth: 300,
      defaultHeight: 160,
      tags: ['Aktionen', 'Start', 'Rechnung', 'POS', 'Notiz', 'Quick', 'Launcher']
    },
    {
      type: 'notes' as DesktopWidgetType,
      kind: 'sticky_note' as const,
      category: 'sticky_note' as const,
      title: t('widgets.sticky_note', currentLang, 'Haftnotiz (Sticky Note)'),
      desc: t('widgets.notes_desc', currentLang, 'Frei verschiebbarer Notizzettel mit Farbauswahl, Auto-Save und Transparenz.'),
      icon: StickyNote,
      color: 'bg-amber-500 text-white',
      defaultWidth: 260,
      defaultHeight: 210,
      tags: ['Notiz', 'Sticky', 'Gedanken', 'To-Do', 'Notes']
    }
  ];

  const FILTER_OPTIONS: { id: CategoryFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Alle Widgets', count: WIDGET_CATALOG_ITEMS.length },
    { id: 'phone_widget', label: 'Handy-Kacheln', count: WIDGET_CATALOG_ITEMS.filter(i => i.kind === 'phone_widget').length },
    { id: 'sticky_note', label: 'Haftnotizen', count: WIDGET_CATALOG_ITEMS.filter(i => i.kind === 'sticky_note').length },
    { id: 'time', label: 'Zeit & Kalender', count: WIDGET_CATALOG_ITEMS.filter(i => i.category === 'time').length },
    { id: 'finance', label: 'Finanzen & KPI', count: WIDGET_CATALOG_ITEMS.filter(i => i.category === 'finance').length },
    { id: 'actions', label: 'Aktionen & Lager', count: WIDGET_CATALOG_ITEMS.filter(i => i.category === 'actions').length }
  ];

  const filteredCatalog = useMemo(() => {
    return WIDGET_CATALOG_ITEMS.filter(item => {
      // Category filter
      if (selectedCategory === 'phone_widget' && item.kind !== 'phone_widget') return false;
      if (selectedCategory === 'sticky_note' && item.kind !== 'sticky_note') return false;
      if (selectedCategory === 'finance' && item.category !== 'finance') return false;
      if (selectedCategory === 'time' && item.category !== 'time') return false;
      if (selectedCategory === 'actions' && item.category !== 'actions') return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.tags.some(t => t.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, selectedCategory, currentLang]);

  const handleAddWidgetToDesktop = (item: typeof WIDGET_CATALOG_ITEMS[0], customOptions?: Partial<DesktopWidget>) => {
    sounds.playPop();
    if (item.kind === 'sticky_note') {
      onAddStickyNote({
        title: t('widgets.sticky_note', currentLang, 'Notiz'),
        color: selectedNoteColor,
        content: '',
        ...customOptions
      });
    } else {
      onAddWidget(item.type, {
        title: item.title,
        kind: 'phone_widget',
        size: 'medium',
        width: item.defaultWidth,
        height: item.defaultHeight,
        desktopId: activeDesktopId,
        ...customOptions
      });
    }
  };

  const handleSaveModalConfig = (options: Partial<DesktopWidget>) => {
    if (!settingsModalWidgetType) return;
    const targetItem = WIDGET_CATALOG_ITEMS.find(i => i.type === settingsModalWidgetType);
    if (targetItem) {
      handleAddWidgetToDesktop(targetItem, options);
    }
    setSettingsModalWidgetType(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      
      {/* Top Bar: Soft, Rounded, Floating Integrated Search & Filter Header */}
      <div className="px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          
          {/* Integrated Search Input Container */}
          <div className="relative flex-1 flex items-center bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-indigo-500 dark:focus-within:border-indigo-500 rounded-2xl transition duration-200 backdrop-blur-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('widgets.search_placeholder', currentLang, 'Widgets & Notizen durchsuchen...')}
              className="w-full pl-11 pr-10 py-3 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => {
                sounds.playClick();
                setFilterDropdownOpen(!filterDropdownOpen);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition shadow-sm cursor-pointer ${selectedCategory !== 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {FILTER_OPTIONS.find(f => f.id === selectedCategory)?.label || 'Filter'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${filterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Options Popover */}
            {filterDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setFilterDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-scale-in space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Kategorie filtern
                  </div>
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedCategory(opt.id);
                        setFilterDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${selectedCategory === opt.id ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <span>{opt.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] opacity-60 font-mono">({opt.count})</span>
                        {selectedCategory === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto">
          {filteredCatalog.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keine Widgets für diese Filterkriterien gefunden
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCatalog.map((item) => {
                const Icon = item.icon;
                const isSticky = item.kind === 'sticky_note';
                const activeCount = widgets.filter(w => w.type === item.type).length;

                return (
                  <div
                    key={item.type}
                    className="flex flex-col justify-between p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition duration-200 group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl ${item.color} flex items-center justify-center font-bold shadow-sm shrink-0 group-hover:scale-105 transition`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        {/* Settings Button on Widget Card */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setSettingsModalWidgetType(item.type);
                          }}
                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0"
                          title="Widget-Einstellungen anpassen (Hintergrund, Schrift, Städte, etc.)"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Sticky Note Color Selector (if note) */}
                      {isSticky && (
                        <div className="mb-3 flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                          <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="flex items-center gap-1.5 flex-1">
                            {STICKY_PALETTE.map(p => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => setSelectedNoteColor(p.key)}
                                className={`w-5 h-5 rounded-full ${p.dot} border transition ${selectedNoteColor === p.key ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 border-black/30' : 'border-black/10 opacity-70 hover:opacity-100'}`}
                                title={p.label}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mini Live Preview Box */}
                      <div className="mb-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800/70 overflow-hidden">
                        {item.type === 'revenue_kpi' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="w-3 h-3" /> Tagesumsatz
                              </span>
                              <span className="font-mono text-emerald-600 font-extrabold">
                                {todayRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {company.currency}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                              <span>Offene Rechnungen:</span>
                              <span className="font-bold text-amber-600">{openInvoicesCount}</span>
                            </div>
                          </div>
                        )}

                        {item.type === 'calendar_agenda' && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-bold shrink-0">
                              <span className="text-[8px] uppercase">{new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { month: 'short' })}</span>
                              <span className="text-sm font-black leading-none">{new Date().getDate()}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate">{new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' })}</span>
                              <span className="text-[10px] text-slate-500">{formatSystemDate(new Date().toISOString())}</span>
                            </div>
                          </div>
                        )}

                        {item.type === 'system_clock' && (
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-base font-black font-mono tracking-tight text-slate-800 dark:text-slate-100">
                                {new Date().toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{formatSystemDate(new Date().toISOString())}</span>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
                              <Clock className="w-4 h-4" />
                            </div>
                          </div>
                        )}

                        {item.type === 'stock_alert' && (
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 block">
                                {lowStockProducts.length > 0 ? `${lowStockProducts.length} Artikel knapp` : 'Alle Bestände im Soll'}
                              </span>
                              <span className="text-[10px] text-slate-500">Mindestbestand-Prüfung</span>
                            </div>
                            <div className={`w-7 h-7 rounded-xl ${lowStockProducts.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} flex items-center justify-center`}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        )}

                        {item.type === 'quick_actions' && (
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 text-[9px] font-bold">Faktura</div>
                            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 text-[9px] font-bold">Kontakt</div>
                            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 text-[9px] font-bold">Kasse</div>
                            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 text-[9px] font-bold">Kalender</div>
                          </div>
                        )}

                        {item.type === 'notes' && (
                          <div className={`p-2.5 rounded-xl border text-[11px] italic transition ${STICKY_PALETTE.find(p => p.key === selectedNoteColor)?.bg || 'bg-amber-100'} ${STICKY_PALETTE.find(p => p.key === selectedNoteColor)?.border || 'border-amber-300'}`}>
                            "Wichtige Notiz oder To-Do direkt auf dem Desktop..."
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Configure or Quick Pin */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          sounds.playClick();
                          setSettingsModalWidgetType(item.type);
                        }}
                        className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Widget konfigurieren (Hintergrund, Zeitzone, etc.)"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Anpassen</span>
                      </button>

                      <button
                        onClick={() => handleAddWidgetToDesktop(item)}
                        className="flex-1 py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('widgets.btn_pin_to_desktop', currentLang, 'Auf Desktop anheften')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Widget Settings & Customizer Modal */}
      {settingsModalWidgetType && (
        <WidgetSettingsModal
          isOpen={true}
          onClose={() => setSettingsModalWidgetType(null)}
          widgetType={settingsModalWidgetType}
          onSave={handleSaveModalConfig}
          currency={company.currency}
          company={company}
        />
      )}
    </div>
  );
};
