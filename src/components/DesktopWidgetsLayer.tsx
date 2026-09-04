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
  BookOpen,
  Lock,
  Unlock,
  Globe,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { DesktopWidget, Invoice, Product, ActiveModule } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { WidgetSettingsModal, AVAILABLE_ACTION_MODULES, TIMEZONE_OPTIONS } from './WidgetSettingsModal';

interface DesktopWidgetsLayerProps {
  widgets: DesktopWidget[];
  onUpdateWidget: (id: string, updates: Partial<DesktopWidget>, persist?: boolean) => void;
  onRemoveWidget: (id: string) => void;
  onAddStickyNote: () => void;
  invoices: Invoice[];
  products?: Product[];
  currency: string;
  onOpenModule: (module: ActiveModule) => void;
  activeDesktopId?: string;
  onDraggingWidgetChange?: (isDragging: boolean) => void;
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
    border: 'border-0',
    text: 'text-slate-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]',
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
  activeDesktopId = 'desktop-1',
  onDraggingWidgetChange
}) => {
  const currentLang = useLanguage();
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; widgetId: string } | null>(null);
  const [settingsWidget, setSettingsWidget] = useState<DesktopWidget | null>(null);

  // Dragging widget state & ref for high-performance 60fps tracking
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = React.useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    width: number;
    currentX: number;
    currentY: number;
    rafId: number | null;
  } | null>(null);

  // Global window listeners for drag & drop
  useEffect(() => {
    if (!draggingId) return;

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== draggingId) return;

      const newX = Math.max(10, Math.min(window.innerWidth - drag.width - 10, e.clientX - drag.offsetX));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - drag.offsetY));

      drag.currentX = newX;
      drag.currentY = newY;

      if (drag.rafId) {
        cancelAnimationFrame(drag.rafId);
      }
      drag.rafId = requestAnimationFrame(() => {
        onUpdateWidget(drag.id, { x: newX, y: newY }, false);
      });
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (drag) {
        if (drag.rafId) {
          cancelAnimationFrame(drag.rafId);
          drag.rafId = null;
        }
        // Save final coordinates to storage (persist = true)
        onUpdateWidget(drag.id, { x: drag.currentX, y: drag.currentY }, true);
      }
      dragRef.current = null;
      setDraggingId(null);
      onDraggingWidgetChange?.(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handlePointerUp();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (dragRef.current?.rafId) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [draggingId, onUpdateWidget, onDraggingWidgetChange]);

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

  const handleMouseDownWidget = (w: DesktopWidget, e: React.MouseEvent) => {
    // Only left click initiates drag
    if (e.button !== 0) return;
    // If locked, do not allow drag
    if (w.isLocked) return;

    // Ignore clicks on buttons, inputs, textareas or elements marked with data-no-drag
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('[data-no-drag]')) {
      return;
    }

    e.preventDefault();
    setContextMenu(null);
    setColorPickerOpenId(null);

    const offsetX = e.clientX - w.x;
    const offsetY = e.clientY - w.y;

    dragRef.current = {
      id: w.id,
      offsetX,
      offsetY,
      width: w.width,
      currentX: w.x,
      currentY: w.y,
      rafId: null
    };

    setDraggingId(w.id);
    onDraggingWidgetChange?.(true);

    // Bring forward on click / drag if not explicitly locked in background
    if (w.layerLevel !== 'background') {
      const maxZ = Math.max(20, ...widgets.map(item => item.zIndex || 20));
      if ((w.zIndex || 20) <= maxZ) {
        onUpdateWidget(w.id, { zIndex: maxZ + 1 });
      }
    }
  };

  const handleWidgetContextMenu = (widgetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 270),
      y: Math.min(e.clientY, window.innerHeight - 340),
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
    const isBgTransparent = w.backgroundStyle === 'transparent' || w.color === 'transparent';
    const isBgGlass = w.backgroundStyle === 'glass';
    const isBgDark = w.backgroundStyle === 'dark';

    const bgClass = isBgTransparent
      ? 'bg-transparent border-0 shadow-none ring-0'
      : isBgGlass
      ? 'bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 shadow-2xl hover:border-indigo-400/80'
      : isBgDark
      ? 'bg-slate-950/95 border border-slate-800 text-white shadow-2xl backdrop-blur-md hover:border-indigo-400/80'
      : 'bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 shadow-2xl backdrop-blur-md hover:border-indigo-400/80';

    const fontClass = 
      w.fontStyle === 'mono' ? 'font-mono' :
      w.fontStyle === 'serif' ? 'font-serif' :
      w.fontStyle === 'display' ? 'font-extrabold tracking-tight' : 'font-sans';

    const textColClass =
      w.textColor === 'white' ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]' :
      w.textColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
      w.textColor === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
      w.textColor === 'amber' ? 'text-amber-600 dark:text-amber-400' :
      w.textColor === 'sky' ? 'text-sky-600 dark:text-sky-400' :
      w.textColor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 
      isBgTransparent ? 'text-slate-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]' : '';

    const blurClass = '';

    return { bgClass, fontClass, textColClass, blurClass, isBgTransparent };
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

  // Helper for timezone-aware date string on clock widgets
  const formatClockDate = (w: DesktopWidget) => {
    const tz = w.clockTimezone || 'local';
    try {
      if (tz === 'local') {
        return formatSystemDate(currentTime.toISOString());
      }
      return new Intl.DateTimeFormat(currentLang === 'de' ? 'de-DE' : 'en-US', {
        timeZone: tz,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(currentTime);
    } catch {
      return formatSystemDate(currentTime.toISOString());
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
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${
        draggingId ? 'pointer-events-auto cursor-move' : ''
      }`}
    >
      {visibleWidgets.map(widget => {
        const { bgClass, fontClass, textColClass, blurClass, isBgTransparent } = getWidgetCardStyle(widget);
        const zIndexValue = widget.layerLevel === 'background' ? 1 : (widget.zIndex || 20);
        const isBeingDragged = draggingId === widget.id;
        const cursorClass = widget.isLocked ? 'cursor-default' : (isBeingDragged ? 'cursor-grabbing' : 'cursor-move');
        const dragClass = isBeingDragged 
          ? 'transition-none shadow-2xl scale-[1.01] select-none ring-2 ring-indigo-500/40' 
          : 'transition duration-150';

        // Floating Micro-Actions on Hover
        const renderHoverMicroActions = () => (
          <div 
            className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 pointer-events-auto"
            data-no-drag
          >
            {widget.isLocked && (
              <div 
                className="p-1.5 rounded-xl bg-slate-900/70 text-amber-300 backdrop-blur-md shadow-xs" 
                title={t('widgets.lock_position', currentLang, 'Position fixiert')}
              >
                <Lock className="w-3.5 h-3.5" />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                sounds.playClick();
                setSettingsWidget(widget);
              }}
              className="p-1.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition cursor-pointer shadow-xs hover:scale-105"
              title={t('widgets.context_settings', currentLang, 'Widget-Einstellungen')}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sounds.playDelete();
                onRemoveWidget(widget.id);
              }}
              className="p-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white backdrop-blur-md transition cursor-pointer shadow-xs hover:scale-105"
              title={t('widgets.remove_from_desktop', currentLang, 'Widget entfernen')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );

        // 1. STICKY NOTE WIDGET
        if (widget.type === 'notes') {
          const colorKey = widget.color || 'yellow';
          const colorConf = STICKY_COLORS[colorKey] || STICKY_COLORS.yellow;
          const isNoteTransparent = colorKey === 'transparent' || widget.backgroundStyle === 'transparent';

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
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl ${isNoteTransparent ? 'bg-transparent border-0 shadow-none' : 'border shadow-2xl backdrop-blur-md'} flex flex-col ${dragClass} animate-fade-in group ${cursorClass} ${colorConf.bg} ${isNoteTransparent ? '' : colorConf.border} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              {/* Note Top Grip Handle */}
              {!isNoteTransparent && (
                <div className={`h-9 px-3 flex items-center justify-between rounded-t-3xl ${colorConf.header}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <StickyNote className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="text-[11px] font-black truncate">
                      {widget.title || t('widgets.sticky_note', currentLang, 'Notiz')}
                    </span>
                  </div>
                </div>
              )}

              {/* Note Content Textarea */}
              {!widget.isCollapsed && (
                <div className={`flex-1 ${isNoteTransparent ? 'p-2' : 'p-3'} flex flex-col min-h-0`}>
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
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              onDoubleClick={() => onOpenModule('invoices')}
              className={`absolute pointer-events-auto rounded-3xl p-4 flex flex-col justify-between gap-2.5 animate-fade-in group ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              {/* Header Label */}
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-black uppercase tracking-wider ${textColClass || 'text-slate-700 dark:text-slate-300'}`}>
                  {widget.title || t('widgets.daily_revenue_short', currentLang, 'Tagesumsatz')}
                </span>
              </div>

              {/* Big KPI Metric */}
              <div>
                <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight block ${textColClass || 'text-emerald-600 dark:text-emerald-400'}`}>
                  {todayRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
                  Heute bezahlt • <strong className="text-amber-600 dark:text-amber-400">{openInvoicesCount} offen</strong>
                </span>
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
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              onDoubleClick={() => onOpenModule('calendar')}
              className={`absolute pointer-events-auto rounded-3xl p-4 flex items-center gap-3.5 animate-fade-in group ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center shrink-0 shadow-md">
                <span className="text-[10px] font-black uppercase tracking-wider">{monthName}</span>
                <span className="text-xl font-black leading-none">{dayNum}</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-extrabold block truncate ${textColClass || 'text-slate-800 dark:text-slate-100'}`}>
                  {weekdayName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                  {formatSystemDate(now.toISOString())}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 block mt-1">
                  Kalender öffnen &rarr;
                </span>
              </div>
            </div>
          );
        }

        // 4. PHONE-STYLE WIDGET: SYSTEM CLOCK (Pure Digital OR Round Analog)
        if (widget.type === 'system_clock') {
          const isAnalog = widget.clockType === 'analog';
          const { secAngle, minAngle, hourAngle } = getAnalogAnglesForWidget(widget);
          const hasCustomTz = widget.clockTimezone && widget.clockTimezone !== 'local';
          const cityTitle = widget.clockCityLabel || (hasCustomTz ? widget.clockTimezone : null);

          return (
            <div
              key={widget.id}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                zIndex: zIndexValue
              }}
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl p-4 flex flex-col justify-center animate-fade-in group ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              {isAnalog ? (
                /* Analog Round Clock */
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  {cityTitle && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${textColClass || 'text-slate-600 dark:text-slate-300'}`}>
                      <Globe className="w-3 h-3 text-sky-500" />
                      {cityTitle}
                    </span>
                  )}
                  <div className={`relative w-28 h-28 rounded-full ${isBgTransparent ? 'border-2 border-white/60 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'border-2 border-slate-400/40 dark:border-slate-600/40'} flex items-center justify-center shadow-inner`}>
                    {/* Hour Marks */}
                    <div className="absolute top-1 text-[8px] font-bold opacity-80">12</div>
                    <div className="absolute right-1.5 text-[8px] font-bold opacity-80">3</div>
                    <div className="absolute bottom-1 text-[8px] font-bold opacity-80">6</div>
                    <div className="absolute left-1.5 text-[8px] font-bold opacity-80">9</div>
                    
                    {/* Center Pin */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-sky-500 z-30" />

                    {/* Hour Hand */}
                    <div 
                      className="absolute w-1 h-7 bg-slate-900 dark:bg-slate-100 rounded-full origin-bottom bottom-1/2 z-10 transition-transform duration-200"
                      style={{ transform: `rotate(${hourAngle}deg)` }}
                    />
                    {/* Minute Hand */}
                    <div 
                      className="absolute w-0.5 h-10 bg-slate-800 dark:bg-slate-200 rounded-full origin-bottom bottom-1/2 z-20 transition-transform duration-200"
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
                /* Pure Digital Clock (Clean numbers & date) */
                <div className="flex flex-col justify-center">
                  {cityTitle && (
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">
                      <Globe className="w-3 h-3 text-sky-500" />
                      <span>{cityTitle}</span>
                    </div>
                  )}
                  <div className={`text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none ${textColClass || 'text-slate-900 dark:text-white'}`}>
                    {formatClockTime(widget)}
                  </div>
                  <div className="text-xs font-semibold opacity-75 mt-1">
                    {formatClockDate(widget)}
                  </div>
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
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              onDoubleClick={() => onOpenModule('stock')}
              className={`absolute pointer-events-auto rounded-3xl p-4 flex flex-col justify-between gap-2 animate-fade-in group ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl ${lowStockProducts.length > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'} shadow-xs`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-black uppercase tracking-wider ${textColClass || 'text-slate-700 dark:text-slate-300'}`}>
                  {widget.title || t('widgets.stock_alert_title', currentLang, 'Lagerbestand')}
                </span>
              </div>

              <div>
                {lowStockProducts.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                      {lowStockProducts.length} Artikel unter Mindestbestand
                    </span>
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
              onMouseDown={(e) => handleMouseDownWidget(widget, e)}
              onContextMenu={(e) => handleWidgetContextMenu(widget.id, e)}
              className={`absolute pointer-events-auto rounded-3xl p-3.5 flex flex-col justify-between gap-2 animate-fade-in group ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
            >
              {renderHoverMicroActions()}

              <div className="grid grid-cols-4 gap-1.5" data-no-drag>
                {actionModules.map((modId) => {
                  const modInfo = AVAILABLE_ACTION_MODULES.find(m => m.id === modId);
                  const ModIcon = modInfo?.icon || Zap;
                  const label = modInfo ? t(modInfo.labelKey, currentLang, modInfo.defaultLabel) : modId;

                  return (
                    <button
                      key={modId}
                      onClick={() => onOpenModule(modId)}
                      className="p-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 flex flex-col items-center gap-1 transition cursor-pointer shadow-xs hover:scale-105"
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
          className="fixed pointer-events-auto z-[99999] w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 shadow-2xl backdrop-blur-xl p-1.5 space-y-1 animate-scale-in text-slate-800 dark:text-slate-100 text-xs font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const targetWidget = widgets.find(w => w.id === contextMenu.widgetId);
            if (!targetWidget) return null;
            const isNote = targetWidget.type === 'notes';

            return (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span>{targetWidget.title || (isNote ? 'Haftnotiz' : 'Desktop Widget')}</span>
                  {targetWidget.isLocked && <Lock className="w-3 h-3 text-amber-500" />}
                </div>

                {/* 1. Edit Settings & Live Customizer */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    setSettingsWidget(targetWidget);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 font-bold transition text-left cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('widgets.context_settings', currentLang, 'Design & Einstellungen anpassen')}</span>
                </button>

                {/* 2. Lock / Unlock Position */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    onUpdateWidget(targetWidget.id, { isLocked: !targetWidget.isLocked });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {targetWidget.isLocked ? (
                      <Unlock className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>
                      {targetWidget.isLocked 
                        ? t('widgets.unlock_position', currentLang, 'Position entsperren')
                        : t('widgets.lock_position', currentLang, 'Position fixieren (Sperren)')}
                    </span>
                  </div>
                  {targetWidget.isLocked && <Check className="w-3.5 h-3.5 text-amber-500" />}
                </button>

                {/* 3. Desktop Layer Level Toggle (Clear and explicit) */}
                <button
                  onClick={() => {
                    sounds.playClick();
                    const nextLayer = targetWidget.layerLevel === 'background' ? 'normal' : 'background';
                    onUpdateWidget(targetWidget.id, { layerLevel: nextLayer });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                        {targetWidget.layerLevel === 'background'
                          ? t('widgets.layer_context_behind', currentLang, 'Hinter Fenstern (Desktop-Ebene)')
                          : t('widgets.layer_context_front', currentLang, 'Immer im Vordergrund (Schwebend)')}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {targetWidget.layerLevel === 'background'
                          ? 'Klicken für: Immer im Vordergrund'
                          : 'Klicken für: Hinter Fenstern'}
                      </span>
                    </div>
                  </div>
                  {targetWidget.layerLevel === 'background' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">Desktop</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">Top</span>
                  )}
                </button>

                {/* 4. Virtual Desktop Scope */}
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
                    <span>{t('widgets.on_all_desktops', currentLang, 'Auf allen Desktops')}</span>
                  </div>
                  {targetWidget.desktopId === 'all' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                {/* 5. Delete / Remove */}
                <button
                  onClick={() => {
                    sounds.playDelete();
                    onRemoveWidget(targetWidget.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold transition text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isNote ? t('widgets.remove', currentLang, 'Notiz schließen') : t('widgets.remove_from_desktop', currentLang, 'Vom Desktop entfernen')}</span>
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
          onSave={(updates) => {
            onUpdateWidget(settingsWidget.id, updates);
            setSettingsWidget(null);
          }}
          currency={currency}
        />
      )}
    </div>
  );
};
