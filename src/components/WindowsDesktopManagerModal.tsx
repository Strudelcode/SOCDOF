import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Download, 
  ShieldCheck, 
  X, 
  Terminal, 
  FolderDown, 
  ExternalLink,
  Laptop,
  Lock,
  Sparkles,
  FolderPlus,
  MousePointerClick
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { SocdofLogo } from './SocdofLogo';
import { APP_VERSION } from '../lib/version';
import { 
  downloadWindowsInstallerCmd,
  downloadWindowsInstallerBat,
  downloadPowerShellSetupWizard
} from '../lib/windowsExeDownloader';

interface WindowsDesktopManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsDesktopManagerModal: React.FC<WindowsDesktopManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'installer' | 'pwa'>('installer');

  useEffect(() => {
    // Check if running in standalone Windows app mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isOpen) return null;

  const handleInstallPwa = async () => {
    sounds.playClick();
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        sounds.playSuccess();
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } else {
      alert(
        'Windows App Installation:\n\n' +
        '1. Klicken Sie in der Browser-Adressleiste auf das Symbol "App installieren" (oder im Menü auf "Apps > Als App installieren").\n' +
        '2. Die SOCDOF App wird direkt in Ihrem Windows-Startmenü und auf Ihrem Windows-Desktop als native Anwendung abgelegt!'
      );
    }
  };

  const handleDownloadCmd = () => {
    sounds.playSuccess();
    downloadWindowsInstallerCmd();
  };

  const handleDownloadBat = () => {
    sounds.playSuccess();
    downloadWindowsInstallerBat();
  };

  const handleDownloadPowerShell = () => {
    sounds.playSuccess();
    downloadPowerShellSetupWizard();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none text-slate-900 dark:text-slate-100">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 text-white flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SocdofLogo size="lg" className="shadow-lg flex-shrink-0" />
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold mb-1 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Lokaler Windows PC-Installer</span>
              </div>
              <h3 className="text-lg font-bold">SOCDOF Windows Desktop Setup</h3>
              <p className="text-xs text-slate-300">Strudel's Organization, Commerce &amp; Documentation Offline Flow</p>
            </div>
          </div>

          <button
            onClick={() => { sounds.playClick(); onClose(); }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Nur die 2 relevanten Tabs) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-3 gap-2 overflow-x-auto">
          {[
            { id: 'installer', label: 'Setup-Assistent (.cmd / .bat)', icon: Laptop },
            { id: 'pwa', label: 'PWA-Verknüpfung (Browser App)', icon: Monitor }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as any); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-sm' 
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* TAB 1: INSTALLER */}
          {activeTab === 'installer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Interaktive Ordnerauswahl direkt beim Start</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Beim Ausführen der heruntergeladenen Datei öffnet sich direkt ein <strong>grafisches Windows-Ordnerauswahl-Fenster</strong>. Sie wählen einfach Ihren Wunschordner (z. B. <code>C:\SOCDOF</code> oder <code>D:\Programme\SOCDOF</code>). Alle Ordner und Desktop-Verknüpfungen werden automatisch angelegt.
                </p>
              </div>

              {/* Step-by-Step Visual Workflow */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <MousePointerClick className="w-4 h-4 text-indigo-500" />
                  <span>Ablauf auf Ihrem Windows-PC:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Setup herunterladen</p>
                    <p className="text-slate-500 text-[10px]">Laden Sie unten die <code>.cmd</code> oder <code>.bat</code> Datei herunter.</p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Ordner am PC wählen</p>
                    <p className="text-slate-500 text-[10px]">Es öffnet sich ein Windows-Dialog zur freien Pfadauswahl.</p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Fertig &amp; Starten</p>
                    <p className="text-slate-500 text-[10px]">Erstellt Unterordner (\Data, \Backups, \Exports, \Config) und Desktop-Icon.</p>
                  </div>
                </div>
              </div>

              {/* Primary Direct .EXE Download Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold">v{APP_VERSION}</span>
                    <span className="font-bold text-xs">Windows Desktop Installer (.EXE)</span>
                  </div>
                  <p className="text-[11px] text-white/90">
                    Vollständiger NSIS Windows-Installer für maximale Performance und Offline-Betrieb.
                  </p>
                </div>
                <a
                  href={`https://github.com/Strudelcode/SOCDOF/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white text-indigo-700 hover:bg-slate-100 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>.EXE Releases</span>
                </a>
              </div>

              {/* Action Buttons for Script Downloads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleDownloadCmd}
                  className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold transition shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-between group active:scale-98 text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs">Setup-Skript (.cmd)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      Interaktive Ordnerauswahl ohne Installation
                    </p>
                  </div>
                  <FolderPlus className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition text-indigo-500" />
                </button>

                <button
                  onClick={handleDownloadBat}
                  className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold transition shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-between group active:scale-98 text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs">Setup-Datei (.bat)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      Klassische Windows Batch-Datei
                    </p>
                  </div>
                  <FolderDown className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition text-emerald-500" />
                </button>
              </div>

              {/* PowerShell GUI Option */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                  <Terminal className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>Reines PowerShell Setup-Skript bevorzugt?</span>
                </div>
                <button
                  onClick={handleDownloadPowerShell}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-[10px] font-bold transition shrink-0"
                >
                  <Download className="w-3 h-3 text-sky-400" />
                  <span>PowerShell (.ps1)</span>
                </button>
              </div>

              {/* GitHub Releases Link */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Vorkompilierter Electron / NSIS .exe Installer auf GitHub:</span>
                </div>
                <a
                  href="https://github.com/Strudelcode/SOCDOF/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-bold hover:bg-black transition shrink-0"
                >
                  <span>GitHub Releases</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: PWA / BROWSER NATIVE APP */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Als Windows-App verknüpfen (PWA)</span>
                      {isInstalled && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-extrabold">
                          Installiert
                        </span>
                      )}
                    </h5>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Erscheint in der Windows 11 Taskleiste und im Startmenü als eigenständiges Anwendungsfenster (über Microsoft Edge oder Google Chrome).
                    </p>
                  </div>

                  <button
                    onClick={handleInstallPwa}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md transition whitespace-nowrap active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalled ? 'Erneut verknüpfen' : 'Jetzt verknüpfen'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% DSGVO- &amp; GoBD-konform lokal auf diesem PC</span>
          </div>

          <button
            onClick={() => { sounds.playClick(); onClose(); }}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition text-xs"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
};
