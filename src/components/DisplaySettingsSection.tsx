import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Tv, 
  Layers, 
  RotateCw, 
  Sun, 
  Moon, 
  Sparkles, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  CheckCircle2, 
  ExternalLink, 
  Eye, 
  Sliders, 
  Laptop, 
  Maximize2, 
  Move, 
  Zap,
  Info
} from 'lucide-react';
import { CompanyProfile, DisplayMonitorInfo } from '../types';
import { 
  detectConnectedMonitors, 
  addVirtualDisplay, 
  removeVirtualDisplay, 
  triggerDisplayIdentification,
  applyNightLight
} from '../lib/displayManager';
import { t, LanguageCode } from '../lib/i18n';
import { sounds } from '../lib/sound';

interface DisplaySettingsSectionProps {
  company: CompanyProfile;
  onUpdateCompany: (updated: CompanyProfile) => void;
  activeLang: LanguageCode;
}

export const DisplaySettingsSection: React.FC<DisplaySettingsSectionProps> = ({
  company,
  onUpdateCompany,
  activeLang
}) => {
  const [monitors, setMonitors] = useState<DisplayMonitorInfo[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<number>(1);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [savedSuccessToast, setSavedSuccessToast] = useState<string | null>(null);

  // Load monitors on mount
  useEffect(() => {
    let mounted = true;
    detectConnectedMonitors().then((detected) => {
      if (mounted) {
        setMonitors(detected);
        if (detected.length > 0) {
          setSelectedMonitorId(detected[0].id);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setSavedSuccessToast(msg);
    setTimeout(() => {
      setSavedSuccessToast(null);
    }, 3200);
  };

  const activeMonitor = monitors.find(m => m.id === selectedMonitorId) || monitors[0] || {
    id: 1,
    index: 1,
    label: 'Display 1',
    isPrimary: true,
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    scale: company.display_scale || 100,
    orientation: company.display_orientation || 'landscape',
    isVirtual: false
  };

  const handleDetect = async () => {
    sounds.playClick();
    setIsDetecting(true);
    try {
      const detected = await detectConnectedMonitors();
      setMonitors(detected);
      showToast(t('display.screens_detected', activeLang, 'Bildschirme aktualisiert') + ` (${detected.length})`);
    } catch {
      // ignore
    } finally {
      setIsDetecting(false);
    }
  };

  const handleIdentify = () => {
    sounds.playClick();
    triggerDisplayIdentification(monitors, setIsIdentifying);
  };

  const handleAddVirtual = () => {
    sounds.playClick();
    const updated = addVirtualDisplay(monitors);
    setMonitors(updated);
    const added = updated[updated.length - 1];
    if (added) {
      setSelectedMonitorId(added.id);
    }
    showToast(t('display.add_virtual_display', activeLang, 'Virtueller Bildschirm hinzugefügt'));
  };

  const handleRemoveVirtual = (id: number) => {
    sounds.playClick();
    const updated = removeVirtualDisplay(monitors, id);
    setMonitors(updated);
    if (selectedMonitorId === id) {
      setSelectedMonitorId(updated[0]?.id || 1);
    }
    showToast(t('display.remove_virtual_display', activeLang, 'Virtueller Bildschirm entfernt'));
  };

  const handleMakePrimary = (id: number) => {
    sounds.playClick();
    const updatedMonitors = monitors.map(m => ({
      ...m,
      isPrimary: m.id === id
    }));
    setMonitors(updatedMonitors);
    onUpdateCompany({
      ...company,
      multi_monitor_primary_id: id
    });
    showToast(t('display.make_primary', activeLang, 'Hauptbildschirm festgelegt'));
  };

  const handleScaleChange = (scaleVal: number) => {
    sounds.playClick();
    onUpdateCompany({
      ...company,
      display_scale: scaleVal
    });
    showToast(`${t('display.scale_label', activeLang, 'Skalierung')}: ${scaleVal}%`);
  };

  const handleOrientationChange = (orient: CompanyProfile['display_orientation']) => {
    sounds.playClick();
    onUpdateCompany({
      ...company,
      display_orientation: orient
    });
    showToast(t('display.orientation_label', activeLang, 'Ausrichtung aktualisiert'));
  };

  const handleMultiMonitorModeChange = (mode: CompanyProfile['multi_monitor_mode']) => {
    sounds.playClick();
    onUpdateCompany({
      ...company,
      multi_monitor_mode: mode
    });
    showToast(t('display.multiple_displays', activeLang, 'Mehrere Bildschirme konfiguriert'));
  };

  const handleToggleNightLight = () => {
    sounds.playClick();
    const nextVal = !company.night_light_enabled;
    const temp = company.night_light_temperature || 3400;
    onUpdateCompany({
      ...company,
      night_light_enabled: nextVal
    });
    applyNightLight(nextVal, temp);
    showToast(nextVal ? t('display.night_light', activeLang, 'Nachtmodus aktiviert') : t('display.night_light', activeLang, 'Nachtmodus deaktiviert'));
  };

  const handleNightLightTemperature = (temp: number) => {
    onUpdateCompany({
      ...company,
      night_light_temperature: temp
    });
    if (company.night_light_enabled) {
      applyNightLight(true, temp);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Visual Identify Overlay when button is clicked */}
      {isIdentifying && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-start p-8 animate-fade-in">
          <div className="flex items-center gap-6">
            {monitors.map((m) => (
              <div 
                key={m.id}
                className="w-32 h-32 rounded-3xl bg-slate-900/90 border-4 border-indigo-500 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center text-white animate-bounce"
              >
                <span className="text-5xl font-black">{m.index}</span>
                <span className="text-xs font-semibold text-indigo-300 mt-1 truncate max-w-[90%]">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {savedSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white border border-slate-700/80 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-slide-up backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedSuccessToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              {t('display.title', activeLang, 'Bildschirme & Anzeige-Einstellungen')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('display.subtitle', activeLang, 'Multi-Monitor-Verwaltung, Skalierung, Ausrichtung und Nachtmodus im Windows-Stil')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleIdentify}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{t('display.identify', activeLang, 'Identifizieren')}</span>
          </button>

          <button
            type="button"
            onClick={handleDetect}
            disabled={isDetecting}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{t('display.detect', activeLang, 'Erkennen')}</span>
          </button>
        </div>
      </div>

      {/* 1. Interactive Windows 11 Multi-Monitor Canvas */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('display.rearrange_title', activeLang, 'Bildschirme anordnen')}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('display.rearrange_desc', activeLang, 'Wählen Sie einen Bildschirm aus, um dessen Einstellungen zu ändern. Ziehen Sie Bildschirme, um sie neu anzuordnen.')}
          </p>
        </div>

        {/* Display Canvas Area */}
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-6 min-h-[220px]">
          {monitors.map((monitor) => {
            const isSelected = monitor.id === selectedMonitorId;
            return (
              <div
                key={monitor.id}
                onClick={() => {
                  sounds.playClick();
                  setSelectedMonitorId(monitor.id);
                }}
                className={`relative cursor-pointer transition-all duration-200 select-none rounded-2xl p-4 flex flex-col items-center justify-center text-center group ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-300 dark:ring-indigo-900/60 scale-105'
                    : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-800 dark:text-slate-200 shadow-xs'
                }`}
                style={{
                  width: monitor.orientation.includes('portrait') ? '140px' : '190px',
                  height: monitor.orientation.includes('portrait') ? '190px' : '130px'
                }}
              >
                {/* Stand decoration */}
                <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-2 rounded-b-md ${
                  isSelected ? 'bg-indigo-800' : 'bg-slate-300 dark:bg-slate-700'
                }`} />

                <div className="flex items-center gap-1.5 text-2xl font-black mb-1">
                  <span>{monitor.index}</span>
                  {monitor.isPrimary && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      ★
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-bold truncate max-w-full px-2">
                  {monitor.label}
                </div>

                <div className={`text-[10px] mt-1 font-mono ${
                  isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {monitor.width} × {monitor.height}
                </div>

                {monitor.isVirtual && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveVirtual(monitor.id);
                    }}
                    title={t('display.remove_virtual_display', activeLang, 'Virtuellen Bildschirm entfernen')}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition hover:bg-rose-600 shadow-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Virtual Screen Card */}
          <button
            type="button"
            onClick={handleAddVirtual}
            className="w-44 h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition group"
          >
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 transition">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-center px-3">
              {t('display.add_virtual_display', activeLang, 'Weiteren Monitor hinzufügen')}
            </span>
          </button>
        </div>

        {/* Selected Monitor Action Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>
              Ausgewählt: <strong className="text-slate-900 dark:text-white">{activeMonitor.label}</strong> ({activeMonitor.width} × {activeMonitor.height} px)
            </span>
          </div>

          {!activeMonitor.isPrimary && (
            <button
              type="button"
              onClick={() => handleMakePrimary(activeMonitor.id)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('display.make_primary', activeLang, 'Als Hauptanzeige verwenden')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Multiple Displays Behavior (Mehrere Bildschirme & Fensterplatzierung) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Tv className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('display.multiple_displays', activeLang, 'Mehrere Bildschirme')}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('display.rearrange_desc', activeLang, 'Legen Sie fest, wie SOCDOF-Arbeitsfenster auf mehreren Bildschirmen verteilt werden.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('display.multiple_displays', activeLang, 'Modus für mehrere Anzeigen')}
            </label>
            <select
              value={company.multi_monitor_mode || 'extend'}
              onChange={(e) => handleMultiMonitorModeChange(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
            >
              <option value="extend">{t('display.mode_extend', activeLang, 'Diese Anzeigen erweitern')}</option>
              <option value="duplicate">{t('display.mode_duplicate', activeLang, 'Diese Anzeigen duplizieren')}</option>
              <option value="primary_only">{t('display.mode_primary_only', activeLang, 'Nur auf 1 anzeigen')}</option>
              <option value="secondary_only">{t('display.mode_secondary_only', activeLang, 'Nur auf 2 anzeigen')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('display.rearrange_title', activeLang, 'Multi-Monitor Ausrichtung')}
            </label>
            <select
              value={company.multi_monitor_layout || 'horizontal'}
              onChange={(e) => {
                sounds.playClick();
                onUpdateCompany({
                  ...company,
                  multi_monitor_layout: e.target.value as any
                });
                showToast(t('display.rearrange_title', activeLang, 'Bildschirmlayout gespeichert'));
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
            >
              <option value="horizontal">Horizontal (Nebeneinander - Links / Rechts)</option>
              <option value="vertical">Vertikal (Übereinander - Oben / Unten)</option>
            </select>
          </div>
        </div>

        {/* Checkbox: Remember window locations based on monitor connection */}
        <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 transition">
          <input
            type="checkbox"
            checked={company.per_monitor_position_memory !== false}
            onChange={(e) => {
              sounds.playClick();
              onUpdateCompany({
                ...company,
                per_monitor_position_memory: e.target.checked
              });
              showToast(t('display.remember_window_positions', activeLang, 'Fensterpositions-Erinnerung aktualisiert'));
            }}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {t('display.remember_window_positions', activeLang, 'Fensterpositionen anhand der Bildschirmverbindung speichern')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {t('display.remember_window_positions_desc', activeLang, 'Fenster merken sich, auf welchem Monitor und an welcher Position sie zuletzt geöffnet waren.')}
            </span>
          </div>
        </label>
      </div>

      {/* 3. Scale & Layout (Skalierung und Layout) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('display.scale_and_layout', activeLang, 'Skalierung und Layout')}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('display.scale_label', activeLang, 'Passen Sie die Größe von Schriftarten, Schaltflächen und Fenstern an.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('display.scale_label', activeLang, 'Skalierung')}
            </label>
            <select
              value={company.display_scale || 100}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
            >
              <option value={100}>100% (Standard)</option>
              <option value={125}>125% (Empfohlen für High-DPI)</option>
              <option value={150}>150%</option>
              <option value={175}>175%</option>
              <option value={200}>200%</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('display.resolution_label', activeLang, 'Bildschirmauflösung')}
            </label>
            <div className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-mono flex items-center justify-between">
              <span>{activeMonitor.width} × {activeMonitor.height} (Empfohlen)</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Aktiv</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('display.orientation_label', activeLang, 'Bildschirmausrichtung')}
            </label>
            <select
              value={company.display_orientation || 'landscape'}
              onChange={(e) => handleOrientationChange(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
            >
              <option value="landscape">{t('display.orientation_landscape', activeLang, 'Querformat')}</option>
              <option value="portrait">{t('display.orientation_portrait', activeLang, 'Hochformat')}</option>
              <option value="landscape_flipped">{t('display.orientation_landscape_flipped', activeLang, 'Querformat (gedreht)')}</option>
              <option value="portrait_flipped">{t('display.orientation_portrait_flipped', activeLang, 'Hochformat (gedreht)')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Brightness & Color / Windows 11 Night Light (Nachtmodus) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('display.night_light', activeLang, 'Nachtmodus')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('display.night_light_desc', activeLang, 'Verwendet wärmere Farben, um Ihre Augen bei schlechten Lichtverhältnissen zu schonen.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleNightLight}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              company.night_light_enabled
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {company.night_light_enabled ? 'Ein ✓' : 'Aus'}
          </button>
        </div>

        {company.night_light_enabled && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('display.night_light_strength', activeLang, 'Farbtemperatur / Stärke')}
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {company.night_light_temperature || 3400} K
              </span>
            </div>
            <input
              type="range"
              min="1500"
              max="5500"
              step="100"
              value={company.night_light_temperature || 3400}
              onChange={(e) => handleNightLightTemperature(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Warm (1500 K)</span>
              <span>Neutral (5500 K)</span>
            </div>
          </div>
        )}

        {/* HDR Profile Toggle */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {t('display.hdr', activeLang, 'HDR-Farbprofil (High Dynamic Range)')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {t('display.hdr_desc', activeLang, 'Optimierter Kontrast und Farbtiefe für HDR-fähige Displays.')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onUpdateCompany({
                ...company,
                hdr_mode: !company.hdr_mode
              });
              showToast(company.hdr_mode ? 'HDR deaktiviert' : 'HDR aktiviert');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
              company.hdr_mode
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {company.hdr_mode ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
      </div>

      {/* 5. Advanced Graphics & Hardware Acceleration */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {t('display.hardware_accel', activeLang, 'GPU-Hardwarebeschleunigung verwenden')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('display.hardware_accel_desc', activeLang, 'Beschleunigt Fenster-Animationen, Mica-Transparenzeffekte und Canvas-Rendering.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            const nextVal = company.hardware_accel_enabled === false ? true : false;
            onUpdateCompany({
              ...company,
              hardware_accel_enabled: nextVal
            });
            showToast(nextVal ? 'GPU-Beschleunigung aktiviert' : 'GPU-Beschleunigung deaktiviert');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
            company.hardware_accel_enabled !== false
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {company.hardware_accel_enabled !== false ? 'Aktiviert' : 'Deaktiviert'}
        </button>
      </div>
    </div>
  );
};
