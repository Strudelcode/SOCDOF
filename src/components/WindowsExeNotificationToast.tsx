import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  ShieldCheck, 
  Sparkles, 
  Monitor, 
  CheckCircle2,
  ExternalLink,
  Check
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { APP_VERSION } from '../lib/version';

interface WindowsExeNotificationToastProps {
  onOpenWindowsManager?: () => void;
  disabled?: boolean;
}

export const WindowsExeNotificationToast: React.FC<WindowsExeNotificationToastProps> = ({
  onOpenWindowsManager,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string>(APP_VERSION);
  const [downloadUrl, setDownloadUrl] = useState<string>(
    `https://github.com/Strudelcode/SOCDOF/releases`
  );

  useEffect(() => {
    // Dynamic GitHub API Release Check
    let isMounted = true;
    fetch('https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' }
    })
      .then(res => {
        if (!res.ok) throw new Error('GitHub API error');
        return res.json();
      })
      .then(data => {
        if (!isMounted || !data) return;
        const tag = data.tag_name ? data.tag_name.replace(/^v/, '') : APP_VERSION;
        setLatestVersion(tag || APP_VERSION);
        
        const exeAsset = data.assets?.find((a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe'));
        if (exeAsset?.browser_download_url) {
          setDownloadUrl(exeAsset.browser_download_url);
        } else if (data.html_url) {
          setDownloadUrl(data.html_url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestVersion(APP_VERSION);
          setDownloadUrl(`https://github.com/Strudelcode/SOCDOF/releases/tag/v${APP_VERSION}`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // 1. Never show if running inside the native Electron app
    const isElectron = typeof window !== 'undefined' && (
      navigator.userAgent.toLowerCase().includes('electron') ||
      Boolean((window as any).process?.versions?.electron) ||
      Boolean((window as any).isElectron) ||
      Boolean((window as any).electron) ||
      Boolean((window as any).__IS_ELECTRON__) ||
      window.location.protocol === 'file:'
    );

    // 2. Never show if user dismissed it permanently, marked as installed, or closed this session
    const isDismissed = typeof window !== 'undefined' && (
      localStorage.getItem('socdof_dismiss_exe_reminder') === 'true' ||
      localStorage.getItem('socdof_exe_installed') === 'true' ||
      sessionStorage.getItem('socdof_toast_closed') === 'true'
    );

    if (isElectron || isDismissed || disabled) {
      return;
    }

    // Schedule prompt after 40 seconds of use in the browser preview
    const timer = setTimeout(() => {
      const checkAgain = 
        localStorage.getItem('socdof_dismiss_exe_reminder') === 'true' ||
        sessionStorage.getItem('socdof_toast_closed') === 'true';
      if (!checkAgain) {
        setIsVisible(true);
        sounds.playPop();
      }
    }, 40000);

    return () => clearTimeout(timer);
  }, [disabled]);

  const handleClose = () => {
    sounds.playClick();
    setIsVisible(false);
    try {
      sessionStorage.setItem('socdof_toast_closed', 'true');
    } catch {}
  };

  const handleDismissForever = () => {
    sounds.playSuccess();
    try {
      localStorage.setItem('socdof_dismiss_exe_reminder', 'true');
      localStorage.setItem('socdof_exe_installed', 'true');
    } catch {}
    setIsVisible(false);
  };

  const handleDownloadExe = () => {
    sounds.playSuccess();
    setDownloadSuccess(true);
    // Direct link to the latest detected release
    window.open(downloadUrl, '_blank');
    try {
      localStorage.setItem('socdof_dismiss_exe_reminder', 'true');
    } catch {}
    setTimeout(() => {
      setIsVisible(false);
      setDownloadSuccess(false);
    }, 3000);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-14 right-4 z-[9998] max-w-sm w-full animate-fade-in select-none">
      <div 
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:shadow-indigo-500/10"
        style={{ borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))' }}
      >
        {/* Top Accent line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  SOCDOF Windows Desktop
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  .EXE v{latestVersion}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                100% Offline • Windows NSIS Installer
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Text */}
        <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          {downloadSuccess ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold py-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Download &amp; Release geöffnet: <strong>v{latestVersion}</strong></span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Windows Installer &amp; Desktop-App bereit</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Installieren Sie SOCDOF direkt auf Ihrem Windows 10/11 PC für maximale Geschwindigkeit und vollständigen Offline-Betrieb.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadExe}
            className="flex-1 px-3 py-2 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-98 hover:opacity-95"
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Setup .EXE (v{latestVersion})</span>
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

        {/* Dismiss forever option */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={handleDismissForever}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition underline underline-offset-2"
          >
            Nicht mehr anzeigen (Bereits installiert)
          </button>
          <span className="text-slate-400 font-mono">v{latestVersion}</span>
        </div>
      </div>
    </div>
  );
};
