import React from 'react';
import { 
  LayoutGrid, 
  StickyNote, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  Layers, 
  AlertTriangle, 
  Zap, 
  ExternalLink 
} from 'lucide-react';
import { DesktopWidget, DesktopWidgetType, ActiveModule } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage } from '../lib/i18n';
import { WidgetsIcon } from './WidgetsIcon';

interface DesktopWidgetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: DesktopWidget[];
  onAddWidget: (type: DesktopWidgetType) => void;
  onRemoveWidget: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onOpenWidgetsApp?: () => void;
}

export const DesktopWidgetsModal: React.FC<DesktopWidgetsModalProps> = ({
  isOpen,
  onClose,
  widgets,
  onAddWidget,
  onRemoveWidget,
  onToggleVisibility,
  onOpenWidgetsApp
}) => {
  const currentLang = useLanguage();

  if (!isOpen) return null;

  const AVAILABLE_WIDGETS = [
    {
      type: 'notes' as DesktopWidgetType,
      title: t('widgets.notes_title', currentLang, 'Freie Haftnotiz (Sticky Note)'),
      desc: t('widgets.notes_desc', currentLang, 'Schnelle Gedanken, Telefonnotizen und To-Dos direkt auf dem Desktop verfassen.'),
      icon: StickyNote,
      color: 'bg-amber-500 text-white',
      border: 'border-amber-200 dark:border-amber-800'
    },
    {
      type: 'revenue_kpi' as DesktopWidgetType,
      title: t('widgets.revenue_title', currentLang, 'Tagesumsatz & Rechnungs-KPI'),
      desc: t('widgets.revenue_desc', currentLang, 'Echtzeit-Statistik über heutige Einnahmen und offene Rechnungen im Blick behalten.'),
      icon: TrendingUp,
      color: 'bg-emerald-500 text-white',
      border: 'border-emerald-200 dark:border-emerald-800'
    },
    {
      type: 'calendar_agenda' as DesktopWidgetType,
      title: t('widgets.calendar_title', currentLang, 'Tageskalender & Agenda'),
      desc: t('widgets.calendar_desc', currentLang, 'Heutiges Datum, Wochentag und anstehende Termine auf dem Desktop anpinnen.'),
      icon: Calendar,
      color: 'bg-indigo-500 text-white',
      border: 'border-indigo-200 dark:border-indigo-800'
    },
    {
      type: 'system_clock' as DesktopWidgetType,
      title: t('widgets.clock_title', currentLang, 'Uhrzeit & Datum'),
      desc: t('widgets.clock_desc', currentLang, 'Große Digitaluhr mit Sekunden, Wochentag und Datum.'),
      icon: Clock,
      color: 'bg-sky-500 text-white',
      border: 'border-sky-200 dark:border-sky-800'
    },
    {
      type: 'stock_alert' as DesktopWidgetType,
      title: t('widgets.stock_alert_title', currentLang, 'Lagerbestand-Warnung'),
      desc: t('widgets.stock_alert_desc', currentLang, 'Warnt sofort bei Artikeln unter Mindestbestand für schnelle Nachbestellungen.'),
      icon: AlertTriangle,
      color: 'bg-amber-600 text-white',
      border: 'border-amber-200 dark:border-amber-800'
    },
    {
      type: 'quick_actions' as DesktopWidgetType,
      title: t('widgets.quick_actions_title', currentLang, 'Schnellstarter / Quick Actions'),
      desc: t('widgets.quick_actions_desc', currentLang, 'Direktknöpfe für neue Rechnung, neuen Kontakt, POS Kasse und Notiz.'),
      icon: Zap,
      color: 'bg-violet-500 text-white',
      border: 'border-violet-200 dark:border-violet-800'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[99995] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-slate-900 dark:text-white"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              <WidgetsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                {t('widgets.modal_title', currentLang, 'Desktop-Widgets & Kacheln')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('widgets.modal_subtitle', currentLang, 'Pinnen Sie nützliche Handy-Kacheln und Notizen direkt auf den Desktop')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenWidgetsApp && (
              <button
                onClick={() => {
                  onClose();
                  onOpenWidgetsApp();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 hover:bg-violet-100 text-xs font-bold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Widgets App öffnen</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Available Widgets Catalog */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            {t('widgets.catalog_title', currentLang, 'Verfügbare Widgets & Notizen')}
          </span>

          <div className="grid grid-cols-1 gap-2.5">
            {AVAILABLE_WIDGETS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.type}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-indigo-400 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playPop();
                      onAddWidget(item.type);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('widgets.btn_add', currentLang, 'Hinzufügen')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Desktop Widgets List */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            {t('widgets.active_title', currentLang, 'Auf dem Desktop aktiv')} ({widgets.length})
          </span>

          {widgets.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
              {t('widgets.empty_active', currentLang, 'Aktuell sind keine Widgets auf dem Desktop platziert.')}
            </p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {widgets.map((w) => (
                <div
                  key={w.id}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize truncate">
                    {w.title || (w.type === 'notes' ? 'Haftnotiz' : w.type)}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggleVisibility(w.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        w.isVisible !== false 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {w.isVisible !== false ? 'Sichtbar' : 'Ausgeblendet'}
                    </button>

                    <button
                      onClick={() => {
                        sounds.playDelete();
                        onRemoveWidget(w.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Widget entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
