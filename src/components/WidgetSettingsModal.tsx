import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Check, 
  Settings, 
  Clock, 
  Zap, 
  Palette, 
  Layers, 
  Sparkles, 
  Type, 
  Globe, 
  Maximize2,
  FileText,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Receipt,
  Users,
  CreditCard,
  ShoppingCart,
  Boxes,
  BookOpen,
  Lock,
  Unlock,
  Sliders
} from 'lucide-react';
import { DesktopWidget, DesktopWidgetType, ActiveModule, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';

interface WidgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetType: DesktopWidgetType;
  initialWidget?: DesktopWidget;
  onSave: (options: Partial<DesktopWidget>) => void;
  currency?: string;
  company?: CompanyProfile;
}

export const TIMEZONE_OPTIONS = [
  { city: 'Lokal (Systemzeit)', tz: 'local', region: 'Lokal' },
  { city: 'Rom / Mailand (Italien - MESZ/MEZ)', tz: 'Europe/Rome', region: 'Europa' },
  { city: 'Berlin / Frankfurt (Deutschland)', tz: 'Europe/Berlin', region: 'Europa' },
  { city: 'Wien (Österreich)', tz: 'Europe/Vienna', region: 'Europa' },
  { city: 'Zürich / Bern (Schweiz)', tz: 'Europe/Zurich', region: 'Europa' },
  { city: 'London / Dublin (UK - GMT/BST)', tz: 'Europe/London', region: 'Europa' },
  { city: 'Paris (Frankreich)', tz: 'Europe/Paris', region: 'Europa' },
  { city: 'Madrid / Barcelona (Spanien)', tz: 'Europe/Madrid', region: 'Europa' },
  { city: 'Athen / Istanbul (EEST/TRT)', tz: 'Europe/Athens', region: 'Europa' },
  { city: 'Dubai / Abu Dhabi (VAE - GST)', tz: 'Asia/Dubai', region: 'Nahost & Asien' },
  { city: 'Riad / Doha (Saudi-Arabien/Katar)', tz: 'Asia/Riyadh', region: 'Nahost & Asien' },
  { city: 'Bangkok / Jakarta (Thailand/Indonesien)', tz: 'Asia/Bangkok', region: 'Nahost & Asien' },
  { city: 'Singapur / Hongkong / Peking', tz: 'Asia/Singapore', region: 'Nahost & Asien' },
  { city: 'Tokio / Seoul (Japan/Korea)', tz: 'Asia/Tokyo', region: 'Nahost & Asien' },
  { city: 'Sydney / Melbourne (Australien)', tz: 'Australia/Sydney', region: 'Australien / Ozeanien' },
  { city: 'Auckland (Neuseeland)', tz: 'Pacific/Auckland', region: 'Australien / Ozeanien' },
  { city: 'New York / Miami (USA Ostküste - EDT/EST)', tz: 'America/New_York', region: 'Nordamerika' },
  { city: 'Chicago / Dallas (USA Zentral - CDT/CST)', tz: 'America/Chicago', region: 'Nordamerika' },
  { city: 'Los Angeles / San Francisco (USA Westküste - PDT/PST)', tz: 'America/Los_Angeles', region: 'Nordamerika' },
  { city: 'São Paulo / Rio (Brasilien - BRT)', tz: 'America/Sao_Paulo', region: 'Südamerika' },
  { city: 'UTC / GMT (Koordinierte Weltzeit)', tz: 'UTC', region: 'Standard' }
];

export const AVAILABLE_ACTION_MODULES: { id: ActiveModule; labelKey: string; defaultLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'invoices', labelKey: 'widgets.quick_invoices', defaultLabel: 'Rechnungen', icon: Receipt },
  { id: 'contacts', labelKey: 'widgets.quick_contacts', defaultLabel: 'Kontakte', icon: Users },
  { id: 'pos', labelKey: 'widgets.quick_pos', defaultLabel: 'POS Kasse', icon: CreditCard },
  { id: 'calendar', labelKey: 'widgets.quick_calendar', defaultLabel: 'Kalender', icon: Calendar },
  { id: 'stock', labelKey: 'widgets.quick_stock', defaultLabel: 'Lagerbestand', icon: Boxes },
  { id: 'purchases', labelKey: 'widgets.quick_purchases', defaultLabel: 'Einkauf', icon: ShoppingCart },
  { id: 'accounting', labelKey: 'widgets.quick_accounting', defaultLabel: 'Finanzen', icon: TrendingUp },
  { id: 'docs', labelKey: 'widgets.quick_docs', defaultLabel: 'Handbuch', icon: BookOpen }
];

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
  isOpen,
  onClose,
  widgetType,
  initialWidget,
  onSave,
  currency = 'EUR',
  company
}) => {
  const currentLang = useLanguage();

  // Settings State
  const [backgroundStyle, setBackgroundStyle] = useState<'solid' | 'transparent' | 'glass' | 'dark'>(
    initialWidget?.backgroundStyle || 'solid'
  );
  const [fontStyle, setFontStyle] = useState<'sans' | 'mono' | 'serif' | 'display'>(
    initialWidget?.fontStyle || 'sans'
  );
  const [textColor, setTextColor] = useState<'default' | 'white' | 'emerald' | 'indigo' | 'amber' | 'sky' | 'rose'>(
    initialWidget?.textColor || 'default'
  );
  const [layerLevel, setLayerLevel] = useState<'normal' | 'background'>(
    initialWidget?.layerLevel || 'normal'
  );
  const [isLocked, setIsLocked] = useState<boolean>(
    initialWidget?.isLocked || false
  );

  // Clock specific state
  const [clockType, setClockType] = useState<'digital' | 'analog'>(
    initialWidget?.clockType || 'digital'
  );
  const [clockTimezone, setClockTimezone] = useState<string>(
    initialWidget?.clockTimezone || 'local'
  );
  const [clockFormat, setClockFormat] = useState<'24h' | '12h'>(
    initialWidget?.clockFormat || '24h'
  );

  // Quick actions state (4 modules)
  const [quickActionModules, setQuickActionModules] = useState<ActiveModule[]>(
    initialWidget?.quickActionModules || ['invoices', 'contacts', 'pos', 'calendar']
  );

  // Sticky Note Color
  const [noteColor, setNoteColor] = useState<string>(
    initialWidget?.color || 'yellow'
  );

  // Live timer for preview
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleActionModule = (modId: ActiveModule) => {
    if (quickActionModules.includes(modId)) {
      if (quickActionModules.length > 2) {
        setQuickActionModules(quickActionModules.filter(m => m !== modId));
      }
    } else {
      if (quickActionModules.length < 4) {
        setQuickActionModules([...quickActionModules, modId]);
      } else {
        // Replace last item
        setQuickActionModules([...quickActionModules.slice(0, 3), modId]);
      }
    }
  };

  const handleSave = () => {
    sounds.playSuccess();
    const cityOpt = TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone);
    onSave({
      backgroundStyle,
      fontStyle,
      textColor,
      layerLevel,
      isLocked,
      clockType,
      clockTimezone,
      clockCityLabel: cityOpt ? (cityOpt.tz === 'local' ? 'Lokal' : cityOpt.city.split('(')[0].trim()) : 'Lokal',
      clockFormat,
      quickActionModules,
      color: noteColor
    });
    onClose();
  };

  // Helper for timezone time string
  const getTimeInZone = () => {
    try {
      if (clockTimezone === 'local') {
        return now.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: clockFormat === '12h'
        });
      }
      return now.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', {
        timeZone: clockTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: clockFormat === '12h'
      });
    } catch {
      return now.toLocaleTimeString();
    }
  };

  // Analog Clock angles calculation
  const getAnalogAngles = () => {
    let dateToUse = now;
    if (clockTimezone !== 'local') {
      try {
        const str = now.toLocaleString('en-US', { timeZone: clockTimezone });
        dateToUse = new Date(str);
      } catch {}
    }
    const seconds = dateToUse.getSeconds();
    const minutes = dateToUse.getMinutes();
    const hours = dateToUse.getHours() % 12;

    const secAngle = seconds * 6; // 360 / 60
    const minAngle = minutes * 6 + seconds * 0.1;
    const hourAngle = hours * 30 + minutes * 0.5;

    return { secAngle, minAngle, hourAngle };
  };

  const { secAngle, minAngle, hourAngle } = getAnalogAngles();

  // Font styling class mapping
  const fontClass = 
    fontStyle === 'mono' ? 'font-mono' :
    fontStyle === 'serif' ? 'font-serif' :
    fontStyle === 'display' ? 'font-extrabold tracking-tight' : 'font-sans';

  // Text color mapping
  const textColorClass = 
    textColor === 'white' ? 'text-white drop-shadow-md' :
    textColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
    textColor === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
    textColor === 'amber' ? 'text-amber-600 dark:text-amber-400' :
    textColor === 'sky' ? 'text-sky-600 dark:text-sky-400' :
    textColor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100';

  // Background style classes
  const bgBoxClass = 
    backgroundStyle === 'transparent' ? 'bg-transparent border-transparent shadow-none' :
    backgroundStyle === 'glass' ? 'bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl' :
    backgroundStyle === 'dark' ? 'bg-slate-950 border-slate-800 text-white shadow-xl' :
    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md';

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] pointer-events-auto flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none"
      onClick={() => {
        sounds.playClick();
        onClose();
      }}
    >
      <div 
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-slate-100 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {t('widgets.settings_title', currentLang, 'Widget-Konfiguration & Design')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('widgets.settings_desc', currentLang, 'Aussehen, Städte/Zeitzone, Schriftarten und Verhalten anpassen')}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. INTERACTIVE LIVE PREVIEW BOX */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('widgets.live_preview', currentLang, 'Live-Vorschau')}
            </label>
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[160px] relative overflow-hidden">
              {/* Preview Canvas Tile */}
              <div className={`p-4 rounded-3xl ${backgroundStyle === 'transparent' ? 'bg-transparent border-0 shadow-none ring-0' : 'border'} transition-all duration-300 ${bgBoxClass} ${fontClass} w-full max-w-[280px]`}>
                
                {/* CLOCK PREVIEW */}
                {widgetType === 'system_clock' && (
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    {clockType === 'digital' ? (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">
                          {TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone)?.city || t('widgets.local_time', currentLang, 'Lokal')}
                        </div>
                        <div className={`text-2xl font-bold tracking-tight ${textColorClass}`}>
                          {getTimeInZone()}
                        </div>
                        <div className="text-[10px] opacity-70 mt-0.5">
                          {formatSystemDate(now.toISOString())}
                        </div>
                      </div>
                    ) : (
                      /* Analog Round Clock SVG */
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                          {TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone)?.city || t('widgets.local_time', currentLang, 'Lokal')}
                        </div>
                        <div className="relative w-24 h-24 rounded-full border-2 border-slate-400/40 dark:border-slate-600/40 flex items-center justify-center shadow-inner">
                          {/* 12, 3, 6, 9 marks */}
                          <div className="absolute top-1 text-[8px] font-bold opacity-70">12</div>
                          <div className="absolute right-1 text-[8px] font-bold opacity-70">3</div>
                          <div className="absolute bottom-1 text-[8px] font-bold opacity-70">6</div>
                          <div className="absolute left-1 text-[8px] font-bold opacity-70">9</div>
                          
                          {/* Center Pin */}
                          <div className="absolute w-2 h-2 rounded-full bg-indigo-600 z-30" />

                          {/* Hour Hand */}
                          <div 
                            className="absolute w-1 h-6 bg-slate-800 dark:bg-slate-200 rounded-full origin-bottom bottom-1/2 z-10 transition-transform duration-200"
                            style={{ transform: `rotate(${hourAngle}deg)` }}
                          />
                          {/* Minute Hand */}
                          <div 
                            className="absolute w-0.5 h-8 bg-slate-700 dark:bg-slate-300 rounded-full origin-bottom bottom-1/2 z-20 transition-transform duration-200"
                            style={{ transform: `rotate(${minAngle}deg)` }}
                          />
                          {/* Second Hand */}
                          <div 
                            className="absolute w-[1px] h-9 bg-rose-500 rounded-full origin-bottom bottom-1/2 z-25 transition-transform duration-100"
                            style={{ transform: `rotate(${secAngle}deg)` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* QUICK ACTIONS PREVIEW */}
                {widgetType === 'quick_actions' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-xs font-bold">{t('widgets.quick_actions_title', currentLang, 'Schnellstarter')}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {quickActionModules.map((modId) => {
                        const info = AVAILABLE_ACTION_MODULES.find(m => m.id === modId);
                        const ModIcon = info?.icon || Receipt;
                        const label = info ? t(info.labelKey, currentLang, info.defaultLabel) : modId;
                        return (
                          <div key={modId} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex flex-col items-center gap-0.5">
                            <ModIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[8px] font-bold truncate max-w-full">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STICKY NOTE PREVIEW */}
                {widgetType === 'notes' && (
                  <div className="space-y-1 text-center italic text-xs">
                    <div className="text-[10px] font-bold not-italic text-slate-400">{t('widgets.sticky_note', currentLang, 'Haftnotiz')}</div>
                    <p className={textColorClass}>"{t('widgets.notes_custom_preview', currentLang, 'Eigene Notiz ohne Ablenkung...')}"</p>
                  </div>
                )}

                {/* REVENUE KPI PREVIEW */}
                {widgetType === 'revenue_kpi' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="w-3 h-3" /> {t('widgets.daily_revenue_short', currentLang, 'Tagesumsatz')}
                      </span>
                    </div>
                    <div className={`text-lg font-black ${textColorClass}`}>
                      0,00 {currency}
                    </div>
                  </div>
                )}

                {/* CALENDAR AGENDA PREVIEW */}
                {widgetType === 'calendar_agenda' && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-[8px] uppercase">{now.toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { month: 'short' })}</span>
                      <span className="text-sm font-black leading-none">{now.getDate()}</span>
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${textColorClass}`}>{now.toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' })}</span>
                      <span className="text-[10px] text-slate-400">{formatSystemDate(now.toISOString())}</span>
                    </div>
                  </div>
                )}

                {/* STOCK ALERT PREVIEW */}
                {widgetType === 'stock_alert' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-bold block ${textColorClass}`}>{t('widgets.all_stock_ok', currentLang, 'Lagerbestand OK')}</span>
                      <span className="text-[10px] text-slate-400">{t('widgets.min_stock_check', currentLang, 'Mindestbestand-Prüfung')}</span>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-emerald-500" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. SPECIFIC SETTINGS FOR CLOCK */}
          {widgetType === 'system_clock' && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-extrabold flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-500" />
                <span>{t('widgets.clock_settings_title', currentLang, 'Uhr-Einstellungen')}</span>
              </h3>

              {/* Digital vs Analog */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">{t('widgets.clock_type_label', currentLang, 'Uhren-Typ:')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setClockType('digital');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${clockType === 'digital' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                  >
                    <span>{t('widgets.clock_digital', currentLang, 'Digital-Uhr')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setClockType('analog');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${clockType === 'analog' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                  >
                    <span>{t('widgets.clock_analog', currentLang, 'Runde Analoguhr')}</span>
                  </button>
                </div>
              </div>

              {/* Timezone / City Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{t('widgets.clock_timezone_label', currentLang, 'Stadt & Zeitzone:')}</span>
                </label>
                <select
                  value={clockTimezone}
                  onChange={(e) => setClockTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200"
                >
                  {TIMEZONE_OPTIONS.map(opt => {
                    let livePreview = '';
                    try {
                      if (opt.tz === 'local') {
                        livePreview = now.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: clockFormat === '12h' });
                      } else {
                        livePreview = now.toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-US', { timeZone: opt.tz, hour: '2-digit', minute: '2-digit', hour12: clockFormat === '12h' });
                      }
                    } catch {}

                    return (
                      <option key={opt.tz} value={opt.tz}>
                        {opt.city} · [{livePreview}]
                      </option>
                    );
                  })}
                </select>
                {clockTimezone !== 'local' && (
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">
                      {TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone)?.city || clockTimezone}
                    </span>
                    <span className="font-mono font-bold">
                      {(() => {
                        try {
                          const localNow = new Date();
                          const tzStr = localNow.toLocaleString('en-US', { timeZone: clockTimezone });
                          const tzDate = new Date(tzStr);
                          const diffHours = Math.round((tzDate.getTime() - localNow.getTime()) / (1000 * 60 * 60));
                          if (diffHours === 0) return '±0h zur lokalen Systemzeit';
                          return diffHours > 0 ? `+${diffHours}h vor lokaler Systemzeit` : `${diffHours}h hinter lokaler Systemzeit`;
                        } catch {
                          return '';
                        }
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* 24h vs 12h Format */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">{t('widgets.clock_format_label', currentLang, 'Zeitformat:')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClockFormat('24h')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${clockFormat === '24h' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                  >
                    {t('widgets.clock_24h', currentLang, '24-Stunden (14:30)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockFormat('12h')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${clockFormat === '12h' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                  >
                    {t('widgets.clock_12h', currentLang, '12-Stunden ENG (02:30 PM)')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. SPECIFIC SETTINGS FOR QUICK ACTIONS */}
          {widgetType === 'quick_actions' && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{t('widgets.quick_actions_apps_title', currentLang, 'Schnellstarter-Apps wählen (bis zu 4):')}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_ACTION_MODULES.map(mod => {
                  const isSelected = quickActionModules.includes(mod.id);
                  const ModIcon = mod.icon;
                  const label = t(mod.labelKey, currentLang, mod.defaultLabel);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleToggleActionModule(mod.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <ModIcon className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs">{label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. GENERAL APPEARANCE (Background, Typography, Layer) */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-500" />
              <span>{t('widgets.appearance_title', currentLang, 'Hintergrund & Optik')}</span>
            </h3>

            {/* Background Style Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">{t('widgets.bg_mode_label', currentLang, 'Hintergrund-Modus:')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('solid')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${backgroundStyle === 'solid' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  <span className="text-[11px]">{t('widgets.bg_solid', currentLang, 'Klassisch')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('transparent')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${backgroundStyle === 'transparent' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  <span className="text-[11px]">{t('widgets.bg_transparent', currentLang, 'Ohne Hintergrund')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('glass')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${backgroundStyle === 'glass' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  <span className="text-[11px]">{t('widgets.bg_glass', currentLang, 'Glas / Acryl')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('dark')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${backgroundStyle === 'dark' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  <span className="text-[11px]">{t('widgets.bg_dark', currentLang, 'Dunkel')}</span>
                </button>
              </div>
            </div>

            {/* Typography Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                <span>{t('widgets.font_style_label', currentLang, 'Schriftart / Typografie:')}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFontStyle('sans')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-sans transition cursor-pointer ${fontStyle === 'sans' ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  {t('widgets.font_sans', currentLang, 'Modern')}
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('mono')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-mono transition cursor-pointer ${fontStyle === 'mono' ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  {t('widgets.font_mono', currentLang, 'Digital')}
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('serif')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-serif transition cursor-pointer ${fontStyle === 'serif' ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  {t('widgets.font_serif', currentLang, 'Klassisch')}
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('display')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-extrabold transition cursor-pointer ${fontStyle === 'display' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'}`}
                >
                  {t('widgets.font_display', currentLang, 'Display')}
                </button>
              </div>
            </div>

            {/* Text Color Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">{t('widgets.text_color_label', currentLang, 'Text- & Akzentfarbe:')}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'default', labelKey: 'widgets.color_default', defaultLabel: 'Standard', color: 'bg-slate-700' },
                  { key: 'white', labelKey: 'widgets.color_white', defaultLabel: 'Weiß (Glow)', color: 'bg-white border-slate-300' },
                  { key: 'emerald', labelKey: 'widgets.color_emerald', defaultLabel: 'Smaragd', color: 'bg-emerald-500' },
                  { key: 'indigo', labelKey: 'widgets.color_indigo', defaultLabel: 'Indigo', color: 'bg-indigo-500' },
                  { key: 'amber', labelKey: 'widgets.color_amber', defaultLabel: 'Bernstein', color: 'bg-amber-500' },
                  { key: 'sky', labelKey: 'widgets.color_sky', defaultLabel: 'Himmelblau', color: 'bg-sky-500' },
                  { key: 'rose', labelKey: 'widgets.color_rose', defaultLabel: 'Rose', color: 'bg-rose-500' }
                ].map(col => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setTextColor(col.key as any)}
                    className={`w-7 h-7 rounded-full ${col.color} border transition flex items-center justify-center cursor-pointer ${textColor === col.key ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={t(col.labelKey, currentLang, col.defaultLabel)}
                  >
                    {textColor === col.key && <Check className="w-3.5 h-3.5 text-black/80 dark:text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Placement Layer Selection (Hintergrund vs Vordergrund) */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>{t('widgets.placement_layer_label', currentLang, 'Desktop-Ebene & Fenster-Verhalten:')}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('widgets.placement_layer_sub', currentLang, 'Bestimme, ob das Widget hinter geöffneten Programmen auf dem Desktop liegt oder immer im Vordergrund schwebt.')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayerLevel('background')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${layerLevel === 'background' ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500 shadow-xs' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      {t('widgets.layer_bg_title', currentLang, 'Hinter Fenstern (Desktop-Hintergrund)')}
                    </span>
                    {layerLevel === 'background' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {t('widgets.layer_bg_desc', currentLang, 'Widget liegt fest auf dem Hintergrundbild; geöffnete Apps legen sich darüber.')}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayerLevel('normal')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${layerLevel === 'normal' ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500 shadow-xs' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      {t('widgets.layer_normal_title', currentLang, 'Immer im Vordergrund (Über Apps)')}
                    </span>
                    {layerLevel === 'normal' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {t('widgets.layer_normal_desc', currentLang, 'Widget schwebt über allen Fenstern und bleibt stets im Vordergrund sichtbar.')}
                  </div>
                </button>
              </div>
            </div>

            {/* Lock Position Toggle */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('widgets.lock_position', currentLang, 'Position fixieren (Sperren):')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`w-full py-2.5 px-3.5 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${isLocked ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 font-bold' : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              >
                <div className="flex items-center gap-2">
                  {isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-slate-400" />}
                  <span>{isLocked ? t('widgets.lock_position', currentLang, 'Position fixiert (Nicht verschiebbar)') : t('widgets.unlock_position', currentLang, 'Frei verschiebbar')}</span>
                </div>
                {isLocked && <Check className="w-4 h-4 text-amber-600" />}
              </button>
            </div>

          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            {t('common.cancel', currentLang, 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-xs font-extrabold text-white flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{initialWidget ? t('widgets.btn_save_settings', currentLang, 'Einstellungen speichern') : t('widgets.btn_configure_and_pin', currentLang, 'Konfigurieren & Anheften')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
