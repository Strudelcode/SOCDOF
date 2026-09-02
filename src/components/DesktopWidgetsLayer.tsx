import React, { useState, useEffect } from 'react';
import { 
  StickyNote, 
  Trash2, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Receipt, 
  ExternalLink,
  Palette,
  X,
  Check,
  AlertTriangle,
  Zap,
  Maximize2,
  Minimize2,
  Smartphone,
  Layers,
  Settings,
  Grid,
  Users,
  CreditCard,
  ShoppingCart,
  Boxes,
  BookOpen
} from 'lucide-react';
import { DesktopWidget, Invoice, Product, ActiveModule } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { WidgetSettingsModal, AVAILABLE_ACTION_MODULES, TIMEZONE_OPTIONS } from './WidgetSettingsModal';

interface DesktopWidgetsLayerProps {
  widgets: DesktopWidget[];
  onUpdateWidget: (id: string, updates: Partial<DesktopWidget>) => void;
  onRemoveWidget: (id: string) => void;
  onAddStickyNote: () => void;
  invoices: Invoice[];
  products?: Product[];
  currency: string;
  onOpenModule: (module: ActiveModule) => void;
  activeDesktopId?: string;
}

const STICKY_COLORS: Record<string, { bg: string; border: string; text: string; header: string; dot: string }> = {
  yellow: {
    bg: 'bg-amber-100 dark:bg-amber-950/85',
    border: 'border-amber-300 dark:border-amber-800/80',
    text: 'text-amber-950 dark:text-amber-100',
    header: 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200',
    dot: 'bg-amber-400'
  },
  blue: {
    bg: 'bg-sky-100 dark:bg-sky-950/85',
    border: 'border-sky-300 dark:border-sky-800/80',
    text: 'text-sky-950 dark:text-sky-100',
    header: 'bg-sky-200/80 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200',
    dot: 'bg-sky-400'
  },
  green: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/85',
    border: 'border-emerald-300 dark:border-emerald-800/80',
    text: 'text-emerald-950 dark:text-emerald-100',
    header: 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200',
    dot: 'bg-emerald-400'
  },
  pink: {
    bg: 'bg-rose-100 dark:bg-rose-950/85',
    border: 'border-rose-300 dark:border-rose-800/80',
    text: 'text-rose-950 dark:text-rose-100',
    header: 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200',
    dot: 'bg-rose-400'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-950/85',
    border: 'border-purple-300 dark:border-purple-800/80',
    text: 'text-purple-950 dark:text-purple-100',
    header: 'bg-purple-200/80 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200',
    dot: 'bg-purple-400'
  },
  dark: {
    bg: 'bg-slate-900/90 dark:bg-slate-900/90',
    border: 'border-slate-700 dark:border-slate-700',
    text: 'text-slate-100 dark:text-slate-100',
    header: 'bg-slate-800 text-slate-300',
    dot: 'bg-slate-700'
  },
  transparent: {
    bg: 'bg-transparent',
    border: 'border-slate-400/30 hover:border-slate-400/60',
    text: 'text-slate-900 dark:text-white drop-shadow-md',
    header: 'bg-black/20 text-white backdrop-blur-sm',
    dot: 'bg-white/40'
  }
};

export const DesktopWidgetsLayer: React.FC<DesktopWidgetsLayerProps> = ({
  widgets,
  onUpdateWidget,
  onRemoveWidget,
  onAddStickyNote,
  invoices,
  products = [],
  currency,
  onOpenModule,
  activeDesktopId = 'desktop-1'
}) => {
  const currentLang = useLanguage();
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; widgetId: string } | null>(null);
  const [settingsWidget, setSettingsWidget] = useState<DesktopWidget | null>(null);

  // Dragging widget state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleMouseDownHeader = (w: DesktopWidget, e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    setContextMenu(null);
    setDraggingId(w.id);
    setDragOffset({
      x: e.clientX - w.x,
      y: e.clientY - w.y
    });

    // Bring forward on click / drag if not explicitly locked in background
    if (w.layerLevel !== 'background') {
      const maxZ = Math.max(20, ...widgets.map(item => item.zIndex || 20));
      if ((w.zIndex || 20) <= maxZ) {
        onUpdateWidget(w.id, { zIndex: maxZ + 1 });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const currentW = widgets.find(w => w.id === draggingId);
    if (!currentW) return;

    const newX = Math.max(10, Math.min(window.innerWidth - currentW.width - 10, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));

    onUpdateWidget(draggingId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (draggingId) {
      setDraggingId(null);
    }
  };

  const handleWidgetContextMenu = (widgetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 280),
      widgetId
    });
  };

  // Filter widgets by active desktop
  const visibleWidgets = widgets.filter(w => {
    if (w.isVisible === false) return false;
    if (!w.desktopId || w.desktopId === 'all') return true;
    return w.desktopId === activeDesktopId;
  });

  // Calculate KPIs
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date?.startsWith(todayStr));
  const todayRevenue = todayInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const openInvoicesCount = invoices.filter(inv => inv.status === 'posted').length;
  const lowStockProducts = products.filter(p => p.min_qty && p.qty_available <= p.min_qty);

  // Helper styles for widgets
  const getWidgetCardStyle = (w: DesktopWidget) => {
    const isBgTransparent = w.backgroundStyle === 'transparent';
    const isBgGlass = w.backgroundStyle === 'glass';
    const isBgDark = w.backgroundStyle === 'dark';

    const bgClass = isBgTransparent
      ? 'bg-transparent border-transparent shadow-none'
      : isBgGlass
      ? 'bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/30 dark:border-slate-700/50 shadow-2xl'
      : isBgDark
      ? 'bg-slate-950/95 border-slate-800 text-white shadow-2xl backdrop-blur-md'
      : 'bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800/90 shadow-2xl backdrop-blur-md';

    const fontClass = 
      w.fontStyle === 'mono' ? 'font-mono' :
      w.fontStyle === 'serif' ? 'font-serif' :
      w.fontStyle === 'display' ? 'font-extrabold tracking-tight' : 'font-sans';

    const textColClass =
      w.textColor === 'white' ? 'text-white drop-shadow-md' :
      w.textColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
      w.textColor === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
      w.textColor === 'amber' ? 'text-amber-600 dark:text-amber-400' :
      w.textColor === 'sky' ? 'text-sky-600 dark:text-sky-400' :
      w.textColor === 'rose' ? 'text-rose-600 dark:text-rose-400' : '';

    return { bgClass, fontClass, textColClass };
  };

  // Helper for timezone time string on clock widgets
  const formatClockTime = (w: DesktopWidget) => {
    const tz = w.clockTimezone || 'local';
    const is12h = w.clockFormat === '12h';
    try {
      if (tz === 'local') {
        return currentTime.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: is12h
        });
      }
      return currentTime.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: is12h
      });
    } catch {
      return currentTime.toLocaleTimeString();
    }
  };

  // Analog angles calculation for analog clocks
  const getAnalogAnglesForWidget = (w: DesktopWidget) => {
    let dateToUse = currentTime;
    const tz = w.clockTimezone || 'local';
    if (tz !== 'local') {
      try {
        const str = currentTime.toLocaleString('en-US', { timeZone: tz });
        dateToUse = new Date(str);
      } catch {}
    }
    const seconds = dateToUse.getSeconds();
    const minutes = dateToUse.getMinutes();
    const hours = dateToUse.getHours() % 12;

    const secAngle = seconds * 6;
    const minAngle = minutes * 6 + seconds * 0.1;
    const hourAngle = hours * 30 + minutes * 0.5;

    return { secAngle, minAngle, hourAngle };
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-[1]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {visibleWidgets.map(widget => {
        const { bgClass, fontClass, textColClass } = getWidgetCardStyle(widget);
        const zIndexValue = widget.layerLevel === 'background' ? 1 : (widget.zIndex || 20);

        // 1. STICKY NOTE WIDGET
        if (widget.type === 'notes') {
          const colorKey = widget.color || 'yellow';
          const colorConf = STICKY_COLORS[colorKey] || STICKY_COLORS.yellow;

          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                height: widget.isCollapsed ? '44px' : `${widget.height}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border shadow-2xl backdrop-blur-md flex flex-col transition duration-150 animate-fade-in group ${colorConf.bg} ${colorConf.border} ${fontClass}`}
            >
              {/* Note Header */}
              <div
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className={`h-11 px-3.5 flex items-center justify-between cursor-move rounded-t-3xl ${colorConf.header}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StickyNote className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="text-xs font-black truncate">
                    {widget.title || t('widgets.sticky_note', currentLang, 'Notiz')}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Settings Gear Button */}
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition opacity-70 group-hover:opacity-100 cursor-pointer"
                    title="Notiz konfigurieren"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  {/* Palette button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerOpenId(colorPickerOpenId === widget.id ? null : widget.id);
                      }}
                      className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition opacity-70 group-hover:opacity-100 cursor-pointer"
                      title="Farbe ändern"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </button>

                    {colorPickerOpenId === widget.id && (
                      <div className="absolute right-0 top-full mt-1.5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex items-center gap-1.5 z-50 animate-scale-in">
                        {Object.entries(STICKY_COLORS).map(([key, item]) => (
                          <button
                            key={key}
                            onClick={() => {
                              sounds.playClick();
                              onUpdateWidget(widget.id, { color: key });
                              setColorPickerOpenId(null);
                            }}
                            className={`w-5 h-5 rounded-full ${item.dot} border transition ${colorKey === key ? 'scale-125 ring-2 ring-indigo-500' : 'opacity-70 hover:opacity-100'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-500 hover:text-white transition opacity-70 group-hover:opacity-100 cursor-pointer"
                    title="Notiz schließen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Note Content Textarea */}
              {!widget.isCollapsed && (
                <div className="flex-1 p-3 flex flex-col min-h-0">
                  <textarea
                    value={widget.content || ''}
                    onChange={(e) => onUpdateWidget(widget.id, { content: e.target.value })}
                    placeholder={t('widgets.note_placeholder', currentLang, 'Notiz schreiben...')}
                    className={`w-full flex-1 bg-transparent resize-none focus:outline-none text-xs leading-relaxed ${colorConf.text}`}
                  />
                </div>
              )}
            </div>
          );
        }

        // 2. PHONE-STYLE WIDGET: REVENUE KPI
        if (widget.type === 'revenue_kpi') {
          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border p-4 flex flex-col justify-between gap-3 animate-fade-in group hover:border-indigo-400 transition ${bgClass} ${fontClass}`}
            >
              <div 
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className="flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-xs">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-extrabold ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {widget.title || t('widgets.daily_revenue', currentLang, 'Tagesumsatz & Kasse')}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                    title="Widget konfigurieren"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenModule('invoices')}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition"
                    title="Rechnungen öffnen"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition"
                    title="Widget entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* KPI Data */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Heute bezahlt</span>
                  <span className={`text-base font-extrabold font-mono ${textColClass || 'text-emerald-600 dark:text-emerald-400'}`}>
                    {todayRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Offen</span>
                  <span className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {openInvoicesCount} Rechnungen
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // 3. PHONE-STYLE WIDGET: CALENDAR AGENDA
        if (widget.type === 'calendar_agenda') {
          const now = new Date();
          const dayNum = now.getDate();
          const monthName = now.toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { month: 'short' });
          const weekdayName = now.toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' });

          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border p-4 flex flex-col justify-between gap-3 animate-fade-in group hover:border-indigo-400 transition ${bgClass} ${fontClass}`}
            >
              <div 
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className="flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-xs">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-extrabold ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {widget.title || t('widgets.calendar_widget', currentLang, 'Tageskalender')}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                    title="Widget konfigurieren"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenModule('calendar')}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition"
                    title="Kalender öffnen"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition"
                    title="Widget entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center shrink-0 shadow-md">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">{monthName}</span>
                  <span className="text-lg font-black leading-none">{dayNum}</span>
                </div>
                <div className="min-w-0">
                  <span className={`text-xs font-bold block truncate ${textColClass || 'text-slate-800 dark:text-slate-200'}`}>
                    {weekdayName}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    {formatSystemDate(now.toISOString())}
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // 4. PHONE-STYLE WIDGET: SYSTEM CLOCK (Digital OR Round Analog Clock)
        if (widget.type === 'system_clock') {
          const isAnalog = widget.clockType === 'analog';
          const { secAngle, minAngle, hourAngle } = getAnalogAnglesForWidget(widget);
          const cityTitle = widget.clockCityLabel || (widget.clockTimezone === 'local' || !widget.clockTimezone ? 'Lokal' : widget.clockTimezone);

          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border p-4 flex flex-col justify-between gap-2 animate-fade-in group hover:border-sky-400 transition ${bgClass} ${fontClass}`}
            >
              <div 
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className="flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 shadow-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-extrabold ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {widget.title || cityTitle}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                    title="Uhr anpassen (Analog/Digital, Zeitzone, etc.)"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Widget entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Clock Body: Analog or Digital */}
              {isAnalog ? (
                <div className="flex items-center justify-center pt-2 pb-1">
                  <div className="relative w-28 h-28 rounded-full border-2 border-slate-400/40 dark:border-slate-600/40 flex items-center justify-center shadow-inner">
                    {/* Hour Marks */}
                    <div className="absolute top-1 text-[8px] font-bold opacity-70">12</div>
                    <div className="absolute right-1.5 text-[8px] font-bold opacity-70">3</div>
                    <div className="absolute bottom-1 text-[8px] font-bold opacity-70">6</div>
                    <div className="absolute left-1.5 text-[8px] font-bold opacity-70">9</div>
                    
                    {/* Center Pin */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-sky-600 z-30" />

                    {/* Hour Hand */}
                    <div 
                      className="absolute w-1 h-7 bg-slate-800 dark:bg-slate-200 rounded-full origin-bottom bottom-1/2 z-10 transition-transform duration-200"
                      style={{ transform: `rotate(${hourAngle}deg)` }}
                    />
                    {/* Minute Hand */}
                    <div 
                      className="absolute w-0.5 h-10 bg-slate-700 dark:bg-slate-300 rounded-full origin-bottom bottom-1/2 z-20 transition-transform duration-200"
                      style={{ transform: `rotate(${minAngle}deg)` }}
                    />
                    {/* Second Hand */}
                    <div 
                      className="absolute w-[1px] h-11 bg-rose-500 rounded-full origin-bottom bottom-1/2 z-25 transition-transform duration-100"
                      style={{ transform: `rotate(${secAngle}deg)` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className={`text-xl font-black font-mono tracking-tight ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {formatClockTime(widget)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {formatSystemDate(currentTime.toISOString())}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // 5. PHONE-STYLE WIDGET: STOCK ALERT
        if (widget.type === 'stock_alert') {
          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border p-4 flex flex-col justify-between gap-3 animate-fade-in group hover:border-amber-400 transition ${bgClass} ${fontClass}`}
            >
              <div 
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className="flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-xl ${lowStockProducts.length > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60'} shadow-xs`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-extrabold ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {widget.title || t('widgets.stock_alert_title', currentLang, 'Lagerbestand')}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                    title="Widget konfigurieren"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenModule('stock')}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition"
                    title="Lager öffnen"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition"
                    title="Widget entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {lowStockProducts.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {lowStockProducts.length} Artikel knapp
                    </span>
                    <button
                      onClick={() => onOpenModule('purchases')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Nachbestellen &rarr;
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs font-bold ${textColClass || 'text-emerald-600 dark:text-emerald-400'}`}>
                    Alle Artikel über Mindestbestand
                  </span>
                )}
              </div>
            </div>
          );
        }

        // 6. PHONE-STYLE WIDGET: QUICK ACTIONS (Customizable 4 App Slots)
        if (widget.type === 'quick_actions') {
          const actionModules = widget.quickActionModules || ['invoices', 'contacts', 'pos', 'calendar'];

          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl border p-4 flex flex-col justify-between gap-3 animate-fade-in group hover:border-violet-400 transition ${bgClass} ${fontClass}`}
            >
              <div 
                onMouseDown={(e) => handleMouseDownHeader(widget, e)}
                className="flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 shadow-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-extrabold ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                    {widget.title || t('widgets.quick_actions_title', currentLang, 'Schnellstarter')}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setSettingsWidget(widget);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 transition cursor-pointer"
                    title="Apps konfigurieren"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      sounds.playDelete();
                      onRemoveWidget(widget.id);
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition opacity-60 group-hover:opacity-100"
                    title="Widget entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dynamic 4 Configured App Actions */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {actionModules.map((modId) => {
                  const modInfo = AVAILABLE_ACTION_MODULES.find(m => m.id === modId);
                  const ModIcon = modInfo?.icon || Zap;
                  const label = modInfo?.label || modId;

                  return (
                    <button
                      key={modId}
                      onClick={() => onOpenModule(modId)}
                      className="p-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex flex-col items-center gap-1 transition cursor-pointer"
                      title={label}
                    >
                      <ModIcon className="w-4 h-4" />
                      <span className="text-[9px] font-bold truncate max-w-full">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        return null;
      })}

      {/* RIGHT CLICK CONTEXT MENU ON WIDGETS */}
      {contextMenu && (
        <div
          data-context-menu
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="fixed pointer-events-auto z-[99999] w-60 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 shadow-2xl backdrop-blur-xl p-1.5 space-y-1 animate-scale-in text-slate-800 dark:text-slate-100 text-xs font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const targetWidget = widgets.find(w => w.id === contextMenu.widgetId);
            if (!targetWidget) return null;
            const isNote = targetWidget.type === 'notes';

            return (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {targetWidget.title || (isNote ? 'Haftnotiz' : 'Widget')}
                </div>

                {/* Edit Settings option */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    setSettingsWidget(targetWidget);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold transition text-left cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Design & Einstellungen anpassen</span>
                </button>

                {/* Resize options for phone widgets */}
                {!isNote && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400">Größe anpassen:</div>
                    <div className="grid grid-cols-3 gap-1 px-1">
                      <button
                        onClick={() => {
                          sounds.playClick();
                          onUpdateWidget(targetWidget.id, { width: 220, height: 140 });
                          setContextMenu(null);
                        }}
                        className="py-1 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold text-center cursor-pointer"
                      >
                        Klein
                      </button>
                      <button
                        onClick={() => {
                          sounds.playClick();
                          onUpdateWidget(targetWidget.id, { width: 290, height: 170 });
                          setContextMenu(null);
                        }}
                        className="py-1 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold text-center cursor-pointer"
                      >
                        Mittel
                      </button>
                      <button
                        onClick={() => {
                          sounds.playClick();
                          onUpdateWidget(targetWidget.id, { width: 340, height: 260 });
                          setContextMenu(null);
                        }}
                        className="py-1 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold text-center cursor-pointer"
                      >
                        Groß
                      </button>
                    </div>
                  </>
                )}

                {/* Desktop Layer Level Toggle */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    const nextLayer = targetWidget.layerLevel === 'background' ? 'normal' : 'background';
                    onUpdateWidget(targetWidget.id, { layerLevel: nextLayer });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Hintergrund-Ebene</span>
                  </div>
                  {targetWidget.layerLevel === 'background' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>

                {/* Virtual Desktop Pinned Scope */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    const nextScope = targetWidget.desktopId === 'all' ? activeDesktopId : 'all';
                    onUpdateWidget(targetWidget.id, { desktopId: nextScope });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Auf allen Desktops</span>
                  </div>
                  {targetWidget.desktopId === 'all' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                {/* Delete / Remove */}
                <button
                  onClick={() => {
                    sounds.playDelete();
                    onRemoveWidget(targetWidget.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold transition text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isNote ? 'Notiz schließen' : 'Vom Desktop entfernen'}</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Widget Settings Modal for Desktop Live Customization */}
      {settingsWidget && (
        <WidgetSettingsModal
          isOpen={true}
          onClose={() => setSettingsWidget(null)}
          widgetType={settingsWidget.type}
          initialWidget={settingsWidget}
          onSave={(updates) => onUpdateWidget(settingsWidget.id, updates)}
          currency={currency}
        />
      )}
    </div>
  );
};
