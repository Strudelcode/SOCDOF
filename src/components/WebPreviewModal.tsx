import React from 'react';
import { createPortal } from 'react-dom';
import { 
  Globe, 
  Download, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  HardDrive, 
  Sparkles, 
  Github,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '../lib/platform';
import { useLanguage, t } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';

interface WebPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isExitPrompt?: boolean;
  onConfirmLeave?: () => void;
}

export const WebPreviewModal: React.FC<WebPreviewModalProps> = ({
  isOpen,
  onClose,
  isExitPrompt = false,
  onConfirmLeave
}) => {
  const lang = useLanguage();

  if (!isOpen) return null;

  const handleLeaveWebsite = () => {
    if (onConfirmLeave) {
      onConfirmLeave();
    } else {
      // Clean up beforeunload and redirect to GitHub repo or about:blank
      window.onbeforeunload = null;
      window.location.href = GITHUB_REPO_URL;
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Globe className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  {t('preview.modal_title', lang, 'Web-Vorschau verlassen?')}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                  {t('preview.badge', lang, 'Web-Vorschau Demo')}
                </span>
              </div>
              <p className="text-xs text-white/80">
                {t('preview.modal_subtitle', lang, 'Interaktive Browser-Demonstration')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/30 flex items-center justify-center text-white/90 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Highlight Warning Card: Data not saved permanently */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 border border-amber-300 dark:border-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs leading-relaxed text-amber-950 dark:text-amber-200 space-y-1">
              <span className="font-bold text-sm text-amber-900 dark:text-amber-100 block">
                {t('preview.warning_title', lang, 'Achtung: Daten werden hier nicht gespeichert!')}
              </span>
              <p className="text-amber-800/90 dark:text-amber-200/90">
                {t('preview.warning_desc', lang, 'Dies ist eine interaktive Web-Vorschau. Alle erstellten Testdaten (Rechnungen, Kontakte, Kassenbelege) werden nur im flüchtigen Browser-Cache gehalten und gehen beim Verlassen der Seite verloren.')}
              </p>
            </div>
          </div>

          {/* Desktop App Advantages */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('preview.desktop_prompt', lang, 'Für dauerhafte Speicherung & echten Produktivbetrieb:')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium">{t('preview.feature_offline', lang, '100% Offline & Lokal')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium">{t('preview.feature_storage', lang, 'Dauerhafte Datenspeicherung')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium">{t('preview.feature_backups', lang, 'Automatische Backups')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium">{t('preview.feature_fast', lang, 'Schnelle Windows .exe App')}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 space-y-2.5">
            {/* Primary CTA: Download Latest Windows Release */}
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>{t('preview.download_latest_btn', lang, 'Neueste Windows-Version herunterladen (.exe)')}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/25 font-mono font-bold">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/80">
                    {t('preview.download_latest_sub', lang, '100% offline, dauerhafte lokale Datenbank & automatische Backups')}
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 opacity-70 shrink-0 mr-1 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Secondary Actions: Leave Website vs Stay & Test */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleLeaveWebsite}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 transition"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{t('preview.leave_site_btn', lang, 'Website wirklich verlassen')}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-xs font-semibold text-white dark:text-slate-900 transition shadow-sm"
              >
                <span>{t('preview.stay_btn', lang, 'Hier bleiben & weiter testen')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* GitHub Repo Link Footer */}
            <div className="pt-1 text-center">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-medium transition"
              >
                <Github className="w-3.5 h-3.5" />
                <span>{t('preview.repo_link', lang, 'Auf GitHub ansehen')}</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

