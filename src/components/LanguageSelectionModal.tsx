import React, { useState } from 'react';
import { 
  Globe, 
  Check, 
  ArrowRight, 
  X, 
  Laptop
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { 
  SUPPORTED_LANGUAGES, 
  LanguageCode, 
  t, 
  setLanguage 
} from '../lib/i18n';
import { FlagIcon } from './FlagIcon';

interface LanguageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
}

export const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage
}) => {
  const [selected, setSelected] = useState<LanguageCode>(currentLanguage || 'en');

  if (!isOpen) return null;

  const handleChoose = (code: LanguageCode) => {
    sounds.playClick();
    setSelected(code);
  };

  const handleApply = () => {
    sounds.playSuccess();
    setLanguage(selected);
    onSelectLanguage(selected);
    try {
      localStorage.setItem('socdof_language_initialized', 'true');
    } catch {}
    onClose();
  };

  const handleSkip = () => {
    sounds.playPop();
    // Default is explicitly English
    setLanguage('en');
    onSelectLanguage('en');
    try {
      localStorage.setItem('socdof_language_initialized', 'true');
    } catch {}
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none"
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-window-open relative text-slate-900 dark:text-white"
        style={{ borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))' }}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {/* Subtle Top Accent bar */}
        <div 
          className="h-1.5 w-full bg-indigo-600" 
          style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
        />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between">
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
                  {t('lang_modal.title', selected, 'Choose Your Language')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  SOCDOF
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t('lang_modal.subtitle', selected, 'Select your preferred language for the SOCDOF Desktop Suite.')}
              </p>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={t('action.skip', selected, 'Skip')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standard Clean Language Selection List */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('action.select_language', selected, 'Select Language')}
            </label>

            <div className="space-y-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = selected === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleChoose(lang.code)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between group ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-xs ring-1 ring-indigo-500/40' 
                        : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                    style={isSelected ? { borderColor: 'var(--accent, #4f46e5)', backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))' } : {}}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0 p-0.5">
                        <FlagIcon code={lang.code} size="lg" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-extrabold truncate ${
                            isSelected 
                              ? 'text-slate-900 dark:text-white' 
                              : 'text-slate-800 dark:text-slate-100'
                          }`}>
                            {lang.nativeLabel}
                          </span>
                          {lang.badge && (
                            <span 
                              className="px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                            >
                              {lang.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {lang.label}
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
            </div>
          </div>

          {/* Offline & Storage notice */}
          <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="leading-tight">
              {t('lang_modal.auto_saved', selected, 'Saved automatically to local database')}
            </span>
          </div>
        </div>

        {/* Footer with Skip (Default: English) and Apply/Continue */}
        <div className="p-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Skip Button with Subtitle "(Default: English)" */}
          <button
            type="button"
            onClick={handleSkip}
            className="w-full sm:w-auto px-4 py-2 text-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex flex-col items-center sm:items-start"
          >
            <span className="text-xs font-bold">{t('action.skip', selected, 'Skip')}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              ({t('action.default_english', selected, 'Default: English')})
            </span>
          </button>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 hover:opacity-95 active:scale-98"
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          >
            <span>{t('action.continue', selected, 'Continue')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
