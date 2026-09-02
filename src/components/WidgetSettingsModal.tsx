import React, { useState, useEffect } from 'react';
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
  BookOpen
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
  { city: 'Lokal (System)', tz: 'local' },
  { city: 'Berlin / Frankfurt', tz: 'Europe/Berlin' },
  { city: 'Wien', tz: 'Europe/Vienna' },
  { city: 'Zürich', tz: 'Europe/Zurich' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'Paris', tz: 'Europe/Paris' },
  { city: 'New York (EST)', tz: 'America/New_York' },
  { city: 'Los Angeles (PST)', tz: 'America/Los_Angeles' },
  { city: 'Tokyo (JST)', tz: 'Asia/Tokyo' },
  { city: 'Dubai (GST)', tz: 'Asia/Dubai' },
  { city: 'Sydney (AEST)', tz: 'Australia/Sydney' }
];

export const AVAILABLE_ACTION_MODULES: { id: ActiveModule; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'invoices', label: 'Rechnungen', icon: Receipt },
  { id: 'contacts', label: 'Kontakte', icon: Users },
  { id: 'pos', label: 'POS Kasse', icon: CreditCard },
  { id: 'calendar', label: 'Kalender', icon: Calendar },
  { id: 'stock', label: 'Lagerbestand', icon: Boxes },
  { id: 'purchases', label: 'Einkauf', icon: ShoppingCart },
  { id: 'accounting', label: 'Finanzen', icon: TrendingUp },
  { id: 'docs', label: 'Handbuch', icon: BookOpen }
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
      clockType,
      clockTimezone,
      clockCityLabel: cityOpt ? cityOpt.city.split('/')[0].trim() : 'Lokal',
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

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in select-none">
      <div 
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in text-slate-800 dark:text-slate-100"
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
              Live-Vorschau
            </label>
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[160px] relative overflow-hidden">
              {/* Preview Canvas Tile */}
              <div className={`p-4 rounded-3xl border transition-all duration-300 ${bgBoxClass} ${fontClass} w-full max-w-[280px]`}>
                
                {/* CLOCK PREVIEW */}
                {widgetType === 'system_clock' && (
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    {clockType === 'digital' ? (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">
                          {TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone)?.city || 'Lokal'}
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
                          {TIMEZONE_OPTIONS.find(o => o.tz === clockTimezone)?.city || 'Lokal'}
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
                      <span className="text-xs font-bold">Schnellstarter</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {quickActionModules.map((modId) => {
                        const info = AVAILABLE_ACTION_MODULES.find(m => m.id === modId);
                        const ModIcon = info?.icon || Receipt;
                        return (
                          <div key={modId} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex flex-col items-center gap-0.5">
                            <ModIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[8px] font-bold truncate max-w-full">{info?.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STICKY NOTE PREVIEW */}
                {widgetType === 'notes' && (
                  <div className="space-y-1 text-center italic text-xs">
                    <div className="text-[10px] font-bold not-italic text-slate-400">Haftnotiz</div>
                    <p className={textColorClass}>"Eigene Notiz ohne Ablenkung..."</p>
                  </div>
                )}

                {/* REVENUE KPI PREVIEW */}
                {widgetType === 'revenue_kpi' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="w-3 h-3" /> Tagesumsatz
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
                      <span className={`text-xs font-bold block ${textColorClass}`}>Lagerbestand OK</span>
                      <span className="text-[10px] text-slate-400">Mindestbestand-Prüfung</span>
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
                <span>Uhr-Einstellungen</span>
              </h3>

              {/* Digital vs Analog */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">Uhren-Typ:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setClockType('digital');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${clockType === 'digital' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                  >
                    <span>Digital-Uhr</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setClockType('analog');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${clockType === 'analog' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                  >
                    <span>Runde Analoguhr</span>
                  </button>
                </div>
              </div>

              {/* Timezone / City Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Stadt & Zeitzone:</span>
                </label>
                <select
                  value={clockTimezone}
                  onChange={(e) => setClockTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {TIMEZONE_OPTIONS.map(opt => (
                    <option key={opt.tz} value={opt.tz}>
                      {opt.city} {opt.tz !== 'local' ? `(${opt.tz})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 24h vs 12h Format */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">Zeitformat:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClockFormat('24h')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition ${clockFormat === '24h' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                  >
                    24-Stunden (14:30)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockFormat('12h')}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition ${clockFormat === '12h' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                  >
                    12-Stunden ENG (02:30 PM)
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
                <span>Schnellstarter-Apps wählen (bis zu 4):</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_ACTION_MODULES.map(mod => {
                  const isSelected = quickActionModules.includes(mod.id);
                  const ModIcon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleToggleActionModule(mod.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <ModIcon className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs">{mod.label}</span>
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
              <span>Hintergrund & Optik</span>
            </h3>

            {/* Background Style Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Hintergrund-Modus:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('solid')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${backgroundStyle === 'solid' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="text-[11px]">Klassisch</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('transparent')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${backgroundStyle === 'transparent' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="text-[11px]">Ohne Hintergrund</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('glass')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${backgroundStyle === 'glass' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="text-[11px]">Glas / Acryl</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('dark')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${backgroundStyle === 'dark' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="text-[11px]">Dunkel</span>
                </button>
              </div>
            </div>

            {/* Typography Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                <span>Schriftart / Typografie:</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFontStyle('sans')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-sans transition ${fontStyle === 'sans' ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  Modern
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('mono')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-mono transition ${fontStyle === 'mono' ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('serif')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-serif transition ${fontStyle === 'serif' ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  Klassisch
                </button>
                <button
                  type="button"
                  onClick={() => setFontStyle('display')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-extrabold transition ${fontStyle === 'display' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  Display
                </button>
              </div>
            </div>

            {/* Text Color Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Text- & Akzentfarbe:</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'default', label: 'Standard', color: 'bg-slate-700' },
                  { key: 'white', label: 'Weiß (Glow)', color: 'bg-white border-slate-300' },
                  { key: 'emerald', label: 'Smaragd', color: 'bg-emerald-500' },
                  { key: 'indigo', label: 'Indigo', color: 'bg-indigo-500' },
                  { key: 'amber', label: 'Bernstein', color: 'bg-amber-500' },
                  { key: 'sky', label: 'Himmelblau', color: 'bg-sky-500' },
                  { key: 'rose', label: 'Rose', color: 'bg-rose-500' }
                ].map(col => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setTextColor(col.key as any)}
                    className={`w-7 h-7 rounded-full ${col.color} border transition flex items-center justify-center ${textColor === col.key ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={col.label}
                  >
                    {textColor === col.key && <Check className="w-3.5 h-3.5 text-black/80 dark:text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Placement Layer Selection (Hintergrund vs Vordergrund) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Desktop-Ebene / Platzierung:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayerLevel('normal')}
                  className={`py-2 px-3 rounded-xl border text-xs text-left transition ${layerLevel === 'normal' ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}
                >
                  <div className="font-bold">Standard (Verschiebbar)</div>
                  <div className="text-[10px] opacity-75">Als schwebende Kachel auf dem Desktop</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLayerLevel('background')}
                  className={`py-2 px-3 rounded-xl border text-xs text-left transition ${layerLevel === 'background' ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}
                >
                  <div className="font-bold">Desktop-Hintergrund</div>
                  <div className="text-[10px] opacity-75">Hinter allen Fenstern auf Wallpaper-Ebene</div>
                </button>
              </div>
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
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-xs font-extrabold text-white flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{initialWidget ? 'Einstellungen speichern' : 'Konfigurieren & Anheften'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
