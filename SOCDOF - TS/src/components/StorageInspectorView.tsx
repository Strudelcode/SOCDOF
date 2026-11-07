import React, { useState, useEffect, useMemo } from 'react';
import {
  HardDrive,
  RefreshCw,
  Zap,
  Trash2,
  FileText,
  Package,
  Users,
  Save,
  FolderOpen,
  HelpCircle,
  Coins,
  Layers,
  Calendar,
  Globe,
  Palette,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  StorageInspectorData,
  ModuleStorageItem,
  inspectCompleteStorage,
  pruneOldSnapshots,
  clearTemporaryCaches
} from '../lib/storageInspector';
import { sounds } from '../lib/sound';
import { t, LanguageCode } from '../lib/i18n';

interface StorageInspectorViewProps {
  activeOwnerName?: string;
  onRefreshParentStorage?: () => void;
  lang?: LanguageCode | string;
}

export const StorageInspectorView: React.FC<StorageInspectorViewProps> = ({
  activeOwnerName,
  onRefreshParentStorage,
  lang: rawLang = 'de'
}) => {
  const lang: LanguageCode = (rawLang && ['de', 'en', 'fr', 'es'].includes(rawLang) ? rawLang : 'de') as LanguageCode;
  const [data, setData] = useState<StorageInspectorData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [showLargestItems, setShowLargestItems] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'modules' | 'users' | 'largest'>('modules');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inspectCompleteStorage(activeOwnerName);
      setData(res);
    } catch (err) {
      console.error('Failed to inspect storage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOwnerName]);

  const handlePruneSnapshots = async () => {
    sounds.playClick();
    if (!window.confirm(t('storage.prune_confirm', lang, 'Möchten Sie ältere Snapshots bereinigen und nur die neuesten 5 behalten?'))) {
      return;
    }
    setIsCleaning(true);
    try {
      const res = await pruneOldSnapshots(5);
      sounds.playSuccess();
      setCleanupMessage(
        res.removedCount > 0
          ? `${res.removedCount} ${t('storage.snapshots_pruned', lang, 'ältere Snapshots bereinigt!')} (${res.freedBytes > 1024 ? (res.freedBytes / 1024).toFixed(1) + ' KB' : res.freedBytes + ' B'} ${t('storage.freed', lang, 'freigegeben')})`
          : t('storage.snapshots_already_clean', lang, 'Bereits optimiert (weniger als 5 Snapshots vorhanden).')
      );
      await loadData();
      onRefreshParentStorage?.();
    } catch {
      sounds.playError();
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanupMessage(null), 4000);
    }
  };

  const handleClearCaches = async () => {
    sounds.playClick();
    setIsCleaning(true);
    try {
      const res = await clearTemporaryCaches();
      sounds.playSuccess();
      setCleanupMessage(
        `${t('storage.cache_cleared', lang, 'Temporäre UI-Caches & Statusflags bereinigt!')} (${(res.freedBytes / 1024).toFixed(1)} KB ${t('storage.freed', lang, 'freigegeben')})`
      );
      await loadData();
      onRefreshParentStorage?.();
    } catch {
      sounds.playError();
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanupMessage(null), 4000);
    }
  };

  // Helper to render icon component based on name
  const renderModuleIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'FileText': return <FileText className={className} />;
      case 'Package': return <Package className={className} />;
      case 'Users': return <Users className={className} />;
      case 'Save': return <Save className={className} />;
      case 'FolderOpen': return <FolderOpen className={className} />;
      case 'HelpCircle': return <HelpCircle className={className} />;
      case 'Coins': return <Coins className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Calendar': return <Calendar className={className} />;
      case 'Globe': return <Globe className={className} />;
      case 'Palette': return <Palette className={className} />;
      case 'Zap': return <Zap className={className} />;
      default: return <HardDrive className={className} />;
    }
  };

  const filteredModules = useMemo(() => {
    if (!data) return [];
    if (activeCategoryFilter === 'all') return data.modules;
    if (activeCategoryFilter === 'database') return data.modules.filter(m => m.storageEngine === 'IndexedDB');
    if (activeCategoryFilter === 'snapshots') return data.modules.filter(m => m.category === 'snapshots');
    if (activeCategoryFilter === 'files') return data.modules.filter(m => m.category === 'files');
    if (activeCategoryFilter === 'settings') return data.modules.filter(m => m.category === 'settings' || m.category === 'cache');
    return data.modules;
  }, [data, activeCategoryFilter]);

  if (isLoading && !data) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {t('storage.analyzing', lang, 'Analysiere Speicherplatz, Tabellen und Dateifußabdruck...')}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* 1. Header with KPIs & Actions */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <HardDrive className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold tracking-tight text-white">
                {t('storage.inspector_title', lang, 'Speicher-Inspektor & Daten-Fußabdruck')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{t('storage.status_optimal', lang, 'Lokal & Offline')}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 max-w-xl">
              {t('storage.inspector_desc', lang, 'Vollständige Speicheraufschlüsselung aller ERP-Module, Snapshots, Mediendateien und Datenbanktabellen.')}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearCaches}
              disabled={isCleaning}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title={t('storage.btn_clear_caches_tip', lang, 'Leert temporäre UI-Zustände und Berechnungsflags')}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('storage.btn_clear_caches', lang, 'Caches leeren')}</span>
            </button>

            <button
              type="button"
              onClick={handlePruneSnapshots}
              disabled={isCleaning}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title={t('storage.btn_prune_snapshots_tip', lang, 'Behält nur die neuesten 5 Snapshots und löscht ältere Versionen')}
            >
              <Trash2 className="w-3.5 h-3.5 text-purple-300" />
              <span>{t('storage.btn_prune_snapshots', lang, 'Snapshots aufräumen')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                loadData();
              }}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition cursor-pointer"
              title={t('action.refresh', lang, 'Neu berechnen')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {cleanupMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cleanupMessage}</span>
          </div>
        )}

        {/* High-Level KPI Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-left">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 block">{t('storage.total_app_size', lang, 'Gesamter App-Speicher')}</span>
            <span className="text-sm font-bold text-white font-mono">{data.totalSizeFormatted}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 block">{t('storage.total_records', lang, 'Gesamte Datensätze')}</span>
            <span className="text-sm font-bold text-white font-mono">{data.totalRecords.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 block">{t('storage.browser_quota', lang, 'Verfügbares Browser-Kontingent')}</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {data.systemQuota ? data.systemQuota.quotaFormatted : 'Unbegrenzt (Lokal)'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 block">{t('storage.quota_used_pct', lang, 'Kontingent-Auslastung')}</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">
              {data.systemQuota ? `${data.systemQuota.percentUsed}%` : '< 1%'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual Storage Segmented Bar (macOS / Windows Style) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span>{t('storage.distribution_bar', lang, 'Speicherverteilung nach Modulen')}</span>
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
            {data.totalSizeFormatted} {t('storage.allocated', lang, 'belegt')}
          </span>
        </div>

        {/* Segmented Progress Bar */}
        <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
          {data.modules.map((m) => {
            if (m.percentage < 0.2) return null;
            return (
              <div
                key={m.id}
                style={{
                  width: `${m.percentage}%`,
                  backgroundColor: m.colorHex
                }}
                className="h-full transition-all duration-300 relative group cursor-pointer hover:opacity-90"
                title={`${t(m.nameKey, lang, m.defaultName)}: ${m.sizeFormatted} (${m.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px]">
          {data.modules.slice(0, 8).map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.colorHex }} />
              <span className="truncate max-w-[130px]">{t(m.nameKey, lang, m.defaultName)}</span>
              <span className="font-mono font-medium text-slate-500 dark:text-slate-500">
                {m.sizeFormatted} ({m.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Sub-Tabs: Modules Breakdown vs. User Profile Footprint vs. Largest Consumers */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {/* Main Subtabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('modules');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'modules'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('storage.tab_modules', lang, 'ERP-Module & Tabellen')} ({data.modules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('users');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{t('storage.tab_users', lang, 'Benutzer-Fußabdruck')} ({data.userProfiles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('largest');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'largest'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>{t('storage.tab_largest', lang, 'Größte Speicherfresser')} ({data.largestItems.length})</span>
            </button>
          </div>

          {/* Category Filter when in modules tab */}
          {activeTab === 'modules' && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-slate-400 mr-1">{t('common.filter', lang, 'Filter:')}</span>
              {[
                { id: 'all', label: t('common.all', lang, 'Alle') },
                { id: 'database', label: 'IndexedDB' },
                { id: 'snapshots', label: 'Snapshots' },
                { id: 'files', label: 'Dateien' },
                { id: 'settings', label: 'System' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveCategoryFilter(f.id);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    activeCategoryFilter === f.id
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: MODULES BREAKDOWN */}
        {activeTab === 'modules' && (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">{t('storage.col_module', lang, 'Modul & Beschreibung')}</th>
                    <th className="p-3">{t('storage.col_engine', lang, 'Speicher-Engine')}</th>
                    <th className="p-3 text-right">{t('storage.col_records', lang, 'Einträge')}</th>
                    <th className="p-3 text-right">{t('storage.col_size', lang, 'Speichergröße')}</th>
                    <th className="p-3 text-right">{t('storage.col_pct', lang, 'Anteil')}</th>
                    <th className="p-3 text-right">{t('common.actions', lang, 'Aktion')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                  {filteredModules.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: mod.colorHex }}
                          >
                            {renderModuleIcon(mod.icon, 'w-4 h-4')}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {t(mod.nameKey, lang, mod.defaultName)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                              {mod.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${
                          mod.storageEngine === 'IndexedDB'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}>
                          {mod.storageEngine}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {mod.recordCount > 0 ? mod.recordCount.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {mod.sizeFormatted}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(mod.percentage, 2)}%`, backgroundColor: mod.colorHex }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 w-10 text-right">
                            {mod.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {mod.canClean ? (
                          <button
                            type="button"
                            onClick={mod.id === 'snapshots' ? handlePruneSnapshots : handleClearCaches}
                            className="px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800/60 transition cursor-pointer"
                          >
                            {t('storage.btn_cleanup', lang, 'Bereinigen')}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MULTI-USER STORAGE USAGE */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-indigo-950 dark:text-indigo-200">
                  {t('storage.multi_user_title', lang, 'Benutzerkonten & Speicherzuordnung')}
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('storage.multi_user_desc', lang, 'Zeigt den belegten Speicherplatz für jedes aktive Benutzerprofil, individuelle Arbeitsbereichskonfigurationen und Desktop-Zustände.')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.userProfiles.map((user) => (
                <div
                  key={user.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</span>
                          {user.isCurrent && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-md">
                              {t('storage.active_profile', lang, 'Aktiv')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{user.role}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block">
                        {user.sizeFormatted}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{user.percentage}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    {user.details}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>{t('storage.access_level', lang, 'Berechtigungsstufe')}: <strong className="text-slate-700 dark:text-slate-300">Admin / Owner</strong></span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t('storage.local_encrypted', lang, 'Lokaler Speicher')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LARGEST STORAGE CONSUMERS */}
        {activeTab === 'largest' && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-amber-950 dark:text-amber-200">
                  {t('storage.largest_title', lang, 'Größte Einzelobjekte im Speicher')}
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('storage.largest_desc', lang, 'Übersicht über die speicherintensivsten Einzeldatensätze wie vollständige Daten-Snapshots, hochauflösende Anhänge oder Beleg-Scans.')}
                </p>
              </div>
            </div>

            {data.largestItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                {t('storage.no_large_items', lang, 'Keine speicherintensiven Einzelobjekte gefunden. Ihr ERP-Speicher ist optimal schlank.')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">{t('storage.col_item_title', lang, 'Datensatz / Objekt')}</th>
                      <th className="p-3">{t('storage.col_item_type', lang, 'Typ & Bereich')}</th>
                      <th className="p-3">{t('storage.col_item_date', lang, 'Erstellt / Stand')}</th>
                      <th className="p-3 text-right">{t('storage.col_size', lang, 'Größe')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {data.largestItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                          {item.title}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-500 font-mono">
                          {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {item.sizeFormatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
