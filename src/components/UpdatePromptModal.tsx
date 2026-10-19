import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, 
  Download, 
  Clock, 
  Ban, 
  CheckCircle2, 
  X, 
  HardDrive, 
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Power,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { UpdateInfo, setVersionSkipped, snoozeUpdateNotification } from '../lib/updateChecker';
import { GITHUB_RELEASES_URL, isElectron, downloadAndInstallDesktopUpdate, quitDesktopApp } from '../lib/platform';
import { sounds } from '../lib/sound';
import { SocdofLogo } from './SocdofLogo';
import { useLanguage, t } from '../lib/i18n';

interface UpdatePromptModalProps {
  updateInfo: UpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onShutdownApp?: () => void;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
  onShutdownApp
}) => {
  const lang = useLanguage();
  const [downloadStep, setDownloadStep] = useState<'prompt' | 'downloading' | 'installing' | 'ready' | 'error'>('prompt');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState(0);
  const [totalMb, setTotalMb] = useState(85.0);
  const [errorMessage, setErrorMessage] = useState('');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isDesktop = isElectron();

  useEffect(() => {
    if (!isOpen) {
      setDownloadStep('prompt');
      setDownloadProgress(0);
      setDownloadedMb(0);
      setErrorMessage('');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const targetUrl = updateInfo.downloadUrl || `${GITHUB_RELEASES_URL}/download/v${updateInfo.latestVersion}/SOCDOF.Setup.${updateInfo.latestVersion}.exe`;

  const handleSkipVersion = () => {
    sounds.playPop();
    setVersionSkipped(updateInfo.latestVersion);
    onClose();
  };

  const handleSnooze = () => {
    sounds.playClick();
    snoozeUpdateNotification(6); // snooze for 6 hours
    onClose();
  };

  const handleStartAutoUpdate = async () => {
    sounds.playClick();
    setDownloadStep('downloading');
    setDownloadProgress(0);
    setDownloadedMb(0);
    setErrorMessage('');

    // If running in Native Desktop App (Electron)
    if (isDesktop && window.electronAPI?.downloadAndInstallUpdate) {
      if (window.electronAPI.onUpdateDownloadProgress) {
        unsubscribeRef.current = window.electronAPI.onUpdateDownloadProgress((data) => {
          if (typeof data.percent === 'number') {
            setDownloadProgress(data.percent);
            if (data.totalBytes && data.downloadedBytes) {
              const mbTotal = parseFloat((data.totalBytes / (1024 * 1024)).toFixed(1));
              const mbDown = parseFloat((data.downloadedBytes / (1024 * 1024)).toFixed(1));
              setTotalMb(mbTotal);
              setDownloadedMb(mbDown);
            } else {
              setDownloadedMb(parseFloat(((data.percent / 100) * 85).toFixed(1)));
            }
          }
          if (data.isFinished || data.percent >= 100) {
            setDownloadStep('installing');
            sounds.playSuccess();
          }
        });
      }

      try {
        const res = await downloadAndInstallDesktopUpdate({
          downloadUrl: targetUrl,
          version: updateInfo.latestVersion
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Automatisches Update fehlgeschlagen.');
          setDownloadStep('error');
        }
      } catch (err: any) {
        console.error('Update error:', err);
        setErrorMessage(err?.message || 'Fehler beim Herunterladen des Updates.');
        setDownloadStep('error');
      }
    } else {
      // Running in Web Preview mode -> Simulate download & trigger browser download
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setDownloadStep('ready');
            sounds.playSuccess();

            // Trigger browser download
            const a = document.createElement('a');
            a.href = targetUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.download = `SOCDOF.Setup.${updateInfo.latestVersion}.exe`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 500);

            return 100;
          }

          const increment = Math.random() * 14 + 8;
          const next = Math.min(100, Math.round(prev + increment));
          setDownloadedMb(parseFloat(((next / 100) * totalMb).toFixed(1)));
          return next;
        });
      }, 250);
    }
  };

  const handleFinishAndCloseApp = () => {
    sounds.playPop();
    onClose();
    if (!quitDesktopApp()) {
      if (onShutdownApp) {
        onShutdownApp();
      }
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={() => downloadStep === 'prompt' && onClose()}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  {t('updates.modal_title', lang, 'Neues SOCDOF-Update verfügbar')}
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                  v{updateInfo.latestVersion}
                </span>
              </div>
              <p className="text-xs text-white/80">
                {t('updates.currently_installed', lang, 'Aktuell installiert')}: v{updateInfo.currentVersion}
              </p>
            </div>
          </div>

          {downloadStep === 'prompt' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/30 flex items-center justify-center text-white/90 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {downloadStep === 'prompt' && (
            <>
              {/* Release Highlights Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {updateInfo.releaseName || `Release v${updateInfo.latestVersion}`}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {updateInfo.publishedAt ? new Date(updateInfo.publishedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US') : 'Neu'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-36 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                  {updateInfo.body ? (
                    <p className="whitespace-pre-line">{updateInfo.body}</p>
                  ) : (
                    <p>
                      {t('updates.ready_to_install', lang, `Version v${updateInfo.latestVersion} steht bereit.`).replace('{version}', `v${updateInfo.latestVersion}`)}
                    </p>
                  )}
                </div>
              </div>

              {/* 1-Minute Download & System Restart Notice */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 flex items-start gap-3">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium">
                  {t('updates.download_time_desc', lang, 'Das Herunterladen dauert ca. 1 Minute. Anschließend wird das System neu gestartet, um das Update zu installieren.')}
                </div>
              </div>

              {/* Offline Security Note */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {t('updates.safe_data_notice', lang, 'Ihre lokalen Rechnungen, Kontakte und Einstellungen bleiben beim Update zu 100% erhalten.')}
                </span>
              </div>

              {/* Action Buttons: Jetzt herunterladen / Später / Überspringen */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleStartAutoUpdate}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('updates.start_download', lang, 'Jetzt herunterladen & neu starten')}</span>
                  <ArrowRight className="w-4 h-4 opacity-80" />
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSnooze}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('updates.snooze', lang, 'Später erinnern')}</span>
                  </button>

                  <button
                    onClick={handleSkipVersion}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{t('updates.skip_version', lang, 'Version überspringen')}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {downloadStep === 'downloading' && (
            <div className="py-4 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                <Download className="w-7 h-7 animate-bounce" />
              </div>

              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {t('updates.downloading_title', lang, 'Update wird im Hintergrund geladen...')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  SOCDOF.Setup.{updateInfo.latestVersion}.exe ({downloadedMb} MB / {totalMb} MB)
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5">
                <div 
                  className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>{isDesktop ? 'Automatischer In-App Download' : 'CDN Download'}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{downloadProgress}%</span>
              </div>
            </div>
          )}

          {downloadStep === 'installing' && (
            <div className="py-6 space-y-4 text-center animate-fade-in">
              <div 
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl relative"
                style={{ backgroundColor: 'var(--accent, #6366f1)' }}
              >
                <SocdofLogo size="md" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {t('updates.installing_title', lang, `Aktualisiere auf Version v${updateInfo.latestVersion}...`).replace('{version}', updateInfo.latestVersion)}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  {t('updates.installing_desc', lang, `SOCDOF startet kurz neu, installiert Version v${updateInfo.latestVersion} im Hintergrund und öffnet die Anwendung anschließend automatisch neu.`).replace('{version}', updateInfo.latestVersion)}
                </p>
                <div className="w-52 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700 mt-3">
                  <div 
                    className="h-full rounded-full animate-pulse"
                    style={{
                      background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-companion, #f59e0b))',
                      width: '80%'
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium pt-1">
                  🔒 {t('updates.safe_data_notice', lang, 'Ihre lokalen Rechnungen, Kontakte und Einstellungen bleiben beim Update zu 100% erhalten.')}
                </p>
              </div>
            </div>
          )}

          {downloadStep === 'ready' && (
            <div className="py-2 space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                  <span className="font-bold text-sm block mb-1">
                    {t('updates.download_complete_title', lang, 'Download abgeschlossen!')}
                  </span>
                  SOCDOF.Setup.{updateInfo.latestVersion}.exe
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleFinishAndCloseApp}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>{t('updates.restart_system_now', lang, 'System jetzt neu starten & Update anwenden')}</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer text-center"
                >
                  {t('updates.continue_working', lang, 'Weiterarbeiten (Später manuell neu starten)')}
                </button>
              </div>
            </div>
          )}

          {downloadStep === 'error' && (
            <div className="py-2 space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed">
                  <span className="font-bold text-sm block mb-1">
                    {t('updates.error_title', lang, 'Update konnte nicht automatisch geladen werden')}
                  </span>
                  {errorMessage || 'Bitte überprüfen Sie Ihre Internetverbindung.'}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleStartAutoUpdate}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('updates.retry', lang, 'Erneut versuchen')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
