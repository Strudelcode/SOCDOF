import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  Check, 
  ArrowRight, 
  X, 
  Laptop,
  FolderOpen,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Search
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { 
  SUPPORTED_LANGUAGES, 
  LanguageCode, 
  t, 
  setLanguage,
  getLanguage,
  getDesktopLanguageFiles,
  subscribeDesktopLanguageFiles,
  syncDesktopLanguageFiles,
  getCustomLanguagePacks,
  getActiveCustomPackId,
  setActiveCustomPack,
  DesktopLanguageFileInfo
} from '../lib/i18n';
import { FlagIcon } from './FlagIcon';

interface LanguageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
}

interface LanguageOptionItem {
  id: string; // 'en' | 'de' | 'fr' | 'es' or 'desktop_file_<id>'
  code: string;
  name: string;
  subtitle?: string;
  badge?: string;
  isDefault?: boolean;
  isCustom?: boolean;
  filename?: string;
  keyCount?: number;
  flagImage?: string | null;
  emoji?: string | null;
}

export const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => {
    const activeCustom = getActiveCustomPackId();
    return activeCustom || currentLanguage || getLanguage();
  });
  const [desktopFiles, setDesktopFiles] = useState<DesktopLanguageFileInfo[]>(() => getDesktopLanguageFiles());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'dropdown'>('dropdown');
  const [resolvedFolderPath, setResolvedFolderPath] = useState<string>('languages/');
  const [isCustomDropdownOpen, setIsCustomDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to live desktop language files updates
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeDesktopLanguageFiles((files) => {
      setDesktopFiles([...files]);
    });
    return unsub;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const activeCustom = getActiveCustomPackId();
      setSelectedId(activeCustom || currentLanguage || getLanguage());

      // Query dynamic folder path from desktop runtime
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && typeof electronAPI.getLanguagesFolderPath === 'function') {
        electronAPI.getLanguagesFolderPath().then((p: string) => {
          if (p) setResolvedFolderPath(p);
        }).catch(() => {});
      }
    }
  }, [isOpen, currentLanguage]);

  // Combine built-in languages with discovered desktop language files
  const availableLanguages: LanguageOptionItem[] = useMemo(() => {
    const list: LanguageOptionItem[] = [];

    // 1. Built-in master languages
    for (const lang of SUPPORTED_LANGUAGES) {
      list.push({
        id: lang.code,
        code: lang.code,
        name: lang.nativeLabel,
        subtitle: lang.label,
        badge: lang.code === 'en' ? 'Default / Master' : undefined,
        isDefault: lang.code === 'en',
        isCustom: false
      });
    }

    // 2. Custom language packs from desktop folder (excluding templates)
    for (const file of desktopFiles) {
      if (file.filename.toLowerCase().startsWith('template') || file.id.toLowerCase().startsWith('template')) {
        continue;
      }
      const isBuiltIn = ['en', 'de', 'fr', 'es'].includes(file.id.toLowerCase());
      if (isBuiltIn) continue; // already covered as built-in override

      const packId = `desktop_file_${file.id}`;
      list.push({
        id: packId,
        code: file.language_code || file.id,
        name: file.title || file.language_name || file.filename,
        subtitle: `${file.filename} (${file.count.toLocaleString()} keys)`,
        badge: 'Desktop .JSON',
        isCustom: true,
        filename: file.filename,
        keyCount: file.count,
        flagImage: file.flagImage,
        emoji: file.emoji
      });
    }

    // 3. Any additional manually imported custom packs (excluding templates)
    const customPacks = getCustomLanguagePacks();
    for (const cp of customPacks) {
      if (cp.id.toLowerCase().includes('template') || cp.name.toLowerCase().includes('template')) {
        continue;
      }
      if (!list.some(item => item.id === cp.id)) {
        list.push({
          id: cp.id,
          code: cp.code || 'custom',
          name: cp.name,
          subtitle: `Custom pack (${cp.count.toLocaleString()} keys)`,
          badge: 'Custom Pack',
          isCustom: true,
          keyCount: cp.count,
          flagImage: cp.flagImage,
          emoji: cp.emoji
        });
      }
    }

    return list;
  }, [desktopFiles]);

  const filteredLanguages: LanguageOptionItem[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.filename && item.filename.toLowerCase().includes(q)) ||
      (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [availableLanguages, searchQuery]);

  if (!isOpen) return null;

  const handleChoose = (id: string) => {
    sounds.playClick();
    setSelectedId(id);
  };

  const handleApply = () => {
    sounds.playSuccess();
    if (selectedId.startsWith('desktop_file_') || selectedId.startsWith('custom_')) {
      setActiveCustomPack(selectedId);
      // Fallback base language stays active
      onSelectLanguage(getLanguage());
    } else {
      setActiveCustomPack(null);
      const targetLang = selectedId as LanguageCode;
      setLanguage(targetLang);
      onSelectLanguage(targetLang);
    }

    try {
      localStorage.setItem('socdof_language_initialized', 'true');
    } catch {}
    onClose();
  };

  const handleRefresh = async () => {
    sounds.playClick();
    setIsRefreshing(true);
    try {
      await syncDesktopLanguageFiles();
      setDesktopFiles(getDesktopLanguageFiles());
      sounds.playSuccess();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleOpenLanguagesFolder = async () => {
    sounds.playClick();
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.openLanguagesFolder === 'function') {
      try {
        await electronAPI.openLanguagesFolder();
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(resolvedFolderPath);
      sounds.playSuccess();
    } catch {}
  };

  const handleOpenFlagsFolder = async () => {
    sounds.playClick();
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.openFlagsFolder === 'function') {
      try {
        await electronAPI.openFlagsFolder();
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${resolvedFolderPath}/flags`);
      sounds.playSuccess();
    } catch {}
  };

  const activeLangCode = selectedId.startsWith('desktop_file_') 
    ? getLanguage() 
    : (selectedId as LanguageCode);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none"
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-window-open relative text-slate-900 dark:text-white max-h-[90vh]"
        style={{ borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))' }}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {/* Top Accent bar */}
        <div 
          className="h-1.5 w-full bg-indigo-600 shrink-0" 
          style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
        />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div 
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md font-bold text-xl shrink-0"
              style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            >
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('lang_modal.title', activeLangCode, 'Choose Your Language')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  SOCDOF
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t('lang_modal.subtitle', activeLangCode, 'Select your preferred language for the SOCDOF Desktop Suite.')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title={t('action.close', activeLangCode, 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selection Module Controls */}
        <div className="px-5 sm:px-6 pt-4 pb-2 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>{t('action.select_language', activeLangCode, 'Select Language')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                {availableLanguages.length}
              </span>
            </span>

            {/* View Mode Toggle & Refresh */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode(v => v === 'cards' ? 'dropdown' : 'cards')}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                title={t('lang_modal.toggle_view', activeLangCode, 'Toggle view')}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>{viewMode === 'cards' ? t('lang_modal.view_dropdown', activeLangCode, 'Dropdown') : t('lang_modal.view_cards', activeLangCode, 'Cards')}</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition disabled:opacity-50 cursor-pointer"
                title={t('lang_modal.refresh_files', activeLangCode, 'Reload language files')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search bar when over 10 languages */}
          {availableLanguages.length > 10 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('lang_modal.search_placeholder', activeLangCode, 'Sprache suchen (Name oder Code)...')}
                className="w-full pl-8.5 pr-8 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  title="Clear"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Language Selection Body */}
        <div className="px-5 sm:px-6 py-2 overflow-y-auto space-y-2.5 flex-1 min-h-[220px]">
          {viewMode === 'dropdown' ? (
            /* COMPACT DROPDOWN SELECTION MODULE */
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{t('lang_modal.select_from_menu', activeLangCode, 'Sprache aus Auswahlliste wählen:')}</span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {availableLanguages.length} {t('lang_modal.languages_available', activeLangCode, 'verfügbar')}
                </span>
              </div>

              {/* Custom Interactive Dropdown Button & Options */}
              <div className="relative">
                {(() => {
                  const currentItem = availableLanguages.find(l => l.id === selectedId) || availableLanguages[0];
                  return (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsCustomDropdownOpen(!isCustomDropdownOpen)}
                        className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-900 dark:text-white transition flex items-center justify-between gap-3 shadow-xs cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 p-1 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700">
                            <FlagIcon 
                              code={currentItem?.code || 'custom'} 
                              customImage={currentItem?.flagImage} 
                              emoji={currentItem?.emoji} 
                              size="lg" 
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="truncate">{currentItem?.name}</span>
                              <span className="text-xs font-mono uppercase text-slate-400">({currentItem?.code})</span>
                              {currentItem?.badge && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0">
                                  {currentItem.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {currentItem?.subtitle}
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isCustomDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isCustomDropdownOpen && (
                        <div 
                          className="absolute left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-scale-up"
                        >
                          {filteredLanguages.map((item) => {
                            const isSelected = selectedId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  handleChoose(item.id);
                                  setIsCustomDropdownOpen(false);
                                }}
                                className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 font-bold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="shrink-0">
                                    <FlagIcon 
                                      code={item.code} 
                                      customImage={item.flagImage} 
                                      emoji={item.emoji} 
                                      size="md" 
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold flex items-center gap-1.5 truncate">
                                      <span className="truncate">{item.name}</span>
                                      <span className="text-[10px] font-mono opacity-60 uppercase">({item.code})</span>
                                      {item.badge && (
                                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {item.subtitle}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                          {filteredLanguages.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-400">
                              {t('lang_modal.no_search_results', activeLangCode, 'Keine passende Sprache gefunden')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Informative Instructions Banner */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-300/90 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <span>{t('lang_modal.auto_detect_banner_title', activeLangCode, '⚡ Automatische Übernahme von Sprachdateien & Flaggen')}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-400">
                  {t('lang_modal.auto_detect_banner_desc', activeLangCode, 'Sobald eine Sprachdatei (.json) im Ordner languages/ aktualisiert wird, übernimmt SOCDOF diese direkt. Eigene Flaggenbilder können im Unterordner flags/ hinterlegt werden; standardmäßig wird das Länder-Emoji oder die Flagge mit Fragezeichen verwendet.')}
                </p>
              </div>

              {/* Native Select element for accessibility & keyboard navigation */}
              <div className="pt-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  {t('lang_modal.fast_menu_select', activeLangCode, 'Schnellauswahl per Standard-Dropdown:')}
                </label>
                <div className="relative">
                  <select
                    value={selectedId}
                    onChange={(e) => handleChoose(e.target.value)}
                    className="w-full p-2.5 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                  >
                    {filteredLanguages.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.code.toUpperCase()}) {item.badge ? `[${item.badge}]` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            /* EXPANDED CARDS SELECTION MODULE */
            <div className="space-y-2">
              {filteredLanguages.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleChoose(item.id)}
                    className={`w-full px-3.5 h-[68px] min-h-[68px] max-h-[68px] rounded-2xl border text-left transition-all duration-150 flex items-center justify-between group cursor-pointer shrink-0 ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-xs ring-1 ring-indigo-500/40' 
                        : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                    style={isSelected ? { borderColor: 'var(--accent, #4f46e5)', backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))' } : {}}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0 p-0.5">
                        <FlagIcon 
                          code={item.code} 
                          customImage={item.flagImage} 
                          emoji={item.emoji} 
                          size="lg" 
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-extrabold truncate ${
                            isSelected 
                              ? 'text-slate-900 dark:text-white' 
                              : 'text-slate-800 dark:text-slate-100'
                          }`}>
                            {item.name}
                          </span>
                          {item.badge && (
                            <span 
                              className="px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isSelected ? (
                        <div 
                          className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500" />
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredLanguages.length === 0 && (
                <div className="text-center py-6 px-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Globe className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t('lang_modal.no_search_results', activeLangCode, 'Keine passende Sprache gefunden')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    {t('lang_modal.reset_search', activeLangCode, 'Suche zurücksetzen')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Fast Desktop Folder & Flag Folder Access Links */}
          <div className="pt-2">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="truncate">
                  {t('lang_modal.folder_label', activeLangCode, 'Folder:')} <code className="font-mono text-[10px] select-all">{resolvedFolderPath}</code>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenFlagsFolder}
                  className="text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                  title={t('lang_modal.open_flags_folder', activeLangCode, 'Open flags folder')}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>{t('lang_modal.flags_folder', activeLangCode, 'Flags Folder')}</span>
                </button>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleOpenLanguagesFolder}
                  className="text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                  title={t('lang_modal.open_languages_folder', activeLangCode, 'Open languages folder')}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>{t('lang_modal.languages_folder', activeLangCode, 'Languages Folder')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Dismiss and Apply/Continue */}
        <div className="p-5 sm:p-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-bold"
          >
            {t('action.cancel', activeLangCode, 'Cancel')}
          </button>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 hover:opacity-95 active:scale-98"
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          >
            <span>{t('action.continue', activeLangCode, 'Continue')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
