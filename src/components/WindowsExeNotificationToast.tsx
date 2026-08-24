import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  ShieldCheck, 
  HardDrive, 
  Sparkles, 
  Monitor, 
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { downloadWindowsExecutablePackage } from '../lib/windowsExeDownloader';

interface WindowsExeNotificationToastProps {
  onOpenWindowsManager?: () => void;
}

export const WindowsExeNotificationToast: React.FC<WindowsExeNotificationToastProps> = ({
  onOpenWindowsManager
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Schedule periodic pop-ups with random timing between 55s and 100s
    let timeoutId: NodeJS.Timeout;

    const scheduleNextPopup = (delayMs: number) => {
      timeoutId = setTimeout(() => {
        // Show notification if not currently visible
        setIsVisible(true);
        sounds.playPop();
      }, delayMs);
    };

    // First popup appears between 45-65 seconds after app load
    const initialDelay = 45000 + Math.floor(Math.random() * 20000);
    scheduleNextPopup(initialDelay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleClose = () => {
    sounds.playClick();
    setIsVisible(false);
    setDownloadSuccess(false);

    // Schedule next reminder in 75-120 seconds
    const nextDelay = 75000 + Math.floor(Math.random() * 45000);
    setTimeout(() => {
      setIsVisible(true);
      sounds.playPop();
    }, nextDelay);
  };

  const handleDownload = () => {
    downloadWindowsExecutablePackage();
    setDownloadSuccess(true);
    setTimeout(() => {
      setIsVisible(false);
      setDownloadSuccess(false);
    }, 4000);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-14 right-4 z-[9998] max-w-sm w-full animate-fade-in select-none">
      <div 
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:shadow-indigo-500/10"
        style={{ borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))' }}
      >
        {/* Subtle Top Accent line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600" 
          style={{ background: 'var(--accent, #4f46e5)' }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 pt-1">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
              style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            >
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  SOCDOF Windows Desktop
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  .EXE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                100% Offline • Kein Localhost nötig
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Schließen / Später erinnern"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Text */}
        <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          {downloadSuccess ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold py-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Download gestartet! <strong>Setup_SOCDOF_Windows.cmd</strong> wird gespeichert.</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Windows Setup &amp; Installations-Assistent bereit</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Wählen Sie Ihren Installationspfad (z. B. <code>C:\SOCDOF</code>) und lassen Sie Ordner für Daten, Backups &amp; Exporte automatisch anlegen.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 px-3 py-2 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-98 hover:opacity-95"
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Setup herunterladen (.cmd)</span>
          </button>

          {onOpenWindowsManager && (
            <button
              type="button"
              onClick={() => {
                setIsVisible(false);
                onOpenWindowsManager();
              }}
              className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
              title="Details & Windows Manager"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
