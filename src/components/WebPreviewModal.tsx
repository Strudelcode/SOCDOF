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
  CheckCircle2
} from 'lucide-react';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '../lib/platform';
import { useLanguage } from '../lib/i18n';

interface WebPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isExitPrompt?: boolean;
}

export const WebPreviewModal: React.FC<WebPreviewModalProps> = ({
  isOpen,
  onClose,
  isExitPrompt = false
}) => {
  const lang = useLanguage();

  if (!isOpen) return null;

  const isGerman = lang === 'de';

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  {isGerman ? 'SOCDOF Web-Vorschau' : 'SOCDOF Web Preview'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                  Demo
                </span>
              </div>
              <p className="text-xs text-white/80">
                {isGerman 
                  ? 'Interaktive Browser-Demonstration' 
                  : 'Interactive In-Browser Demonstration'}
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
        <div className="p-6 space-y-5">
          {/* Highlight Card */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <span className="font-bold block mb-1">
                {isGerman ? 'Wichtiger Hinweis zur Web-Version:' : 'Important Web Preview Notice:'}
              </span>
              {isGerman ? (
                <>
                  Dies ist ausschließlich eine <strong>interaktive Web-Vorschau</strong>. Alle eingegebenen Testdaten (Rechnungen, Kontakte, Buchungen) werden nur im flüchtigen Browser-Cache gehalten.
                </>
              ) : (
                <>
                  This is strictly an <strong>interactive web preview</strong>. Any test records (invoices, contacts, journal entries) are retained only in temporary browser cache.
                </>
              )}
            </div>
          </div>

          {/* Desktop App Advantages */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isGerman ? 'Vollversion für Windows herunterladen:' : 'Download Full Windows Desktop App:'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isGerman ? '100% Offline & Lokal' : '100% Offline & Local'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isGerman ? 'Dauerhafte Datenspeicherung' : 'Permanent Local Storage'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isGerman ? 'Automatische Backups' : 'Automated Backups'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isGerman ? 'Schnelle Windows .exe' : 'Fast Windows .exe Build'}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 space-y-2.5">
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition group"
            >
              <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              <span>
                {isGerman ? 'Neueste Version herunterladen (Releases)' : 'Download Latest Release (.exe)'}
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            <div className="flex items-center gap-2">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub Repository</span>
              </a>

              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                {isGerman ? (isExitPrompt ? 'Auf Seite bleiben' : 'Vorschau testen') : (isExitPrompt ? 'Stay on Page' : 'Continue Preview')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
