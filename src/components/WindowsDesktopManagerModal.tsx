import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Download, 
  ShieldCheck, 
  HardDrive, 
  CheckCircle2, 
  X, 
  Terminal, 
  FolderDown, 
  ExternalLink,
  Laptop,
  Lock,
  Cpu,
  RefreshCw,
  Sparkles,
  Info,
  FolderTree,
  FolderPlus,
  Folder,
  FolderArchive,
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';
import { SocdofLogo } from './SocdofLogo';
import { 
  downloadWindowsInstallerPackage, 
  downloadPowerShellSetupWizard,
  WindowsInstallerConfig,
  DEFAULT_INSTALL_CONFIG
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
  const [activeTab, setActiveTab] = useState<'installer' | 'folders' | 'pwa' | 'storage'>('installer');
  const [customPath, setCustomPath] = useState<string>('C:\\SOCDOF');
  const [storageInfo, setStorageInfo] = useState<{ usedMb: string; quotaMb: string; percent: number }>({
    usedMb: '0.00',
    quotaMb: '0.00',
    percent: 0
  });

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

    // Get storage estimate
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const used = (estimate.usage || 0) / (1024 * 1024);
        const quota = (estimate.quota || 0) / (1024 * 1024);
        const pct = quota > 0 ? (used / quota) * 100 : 0;
        setStorageInfo({
          usedMb: used.toFixed(2),
          quotaMb: quota.toFixed(0),
          percent: Math.min(100, Math.max(0.1, pct))
        });
      });
    }

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

  const handleDownloadSetup = () => {
    sounds.playSuccess();
    downloadWindowsInstallerPackage({
      ...DEFAULT_INSTALL_CONFIG,
      installPath: customPath || 'C:\\SOCDOF'
    });
  };

  const handleDownloadPowerShell = () => {
    sounds.playSuccess();
    downloadPowerShellSetupWizard(customPath || 'C:\\SOCDOF');
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-3 gap-2 overflow-x-auto">
          {[
            { id: 'installer', label: 'Setup & Installationspfad', icon: Laptop },
            { id: 'folders', label: 'Ordner- & Backup-Struktur', icon: FolderTree },
            { id: 'pwa', label: 'PWA-Verknüpfung', icon: Monitor },
            { id: 'storage', label: 'Lokaler Speicher', icon: HardDrive }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as any); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-xl' 
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
          
          {/* TAB 1: INSTALLER & TARGET DIRECTORY */}
          {activeTab === 'installer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Echter Windows Desktop Setup-Assistent</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Der Installer richtet SOCDOF direkt in Ihrem gewünschten Zielverzeichnis ein und erstellt automatisch alle Ordner für <strong>lokale Belegdaten, automatische Backups und PDF-Exporte</strong>.
                </p>
              </div>

              {/* Path Input Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block font-bold text-slate-900 dark:text-white">
                  Gewünschter Installationspfad auf Ihrem PC:
                </label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="C:\SOCDOF"
                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Schnellauswahl:</span>
                  {[
                    'C:\\SOCDOF',
                    'D:\\SOCDOF',
                    'C:\\Programme\\SOCDOF',
                    '%USERPROFILE%\\SOCDOF'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomPath(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition ${
                        customPath === preset
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons for Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleDownloadSetup}
                  className="p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md flex items-center justify-between group active:scale-98 text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Setup-Assistent (.cmd)</span>
                    </div>
                    <p className="text-[10px] text-indigo-100 font-normal">
                      Erstellt {customPath} &amp; alle Unterordner
                    </p>
                  </div>
                  <FolderPlus className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition" />
                </button>

                <button
                  onClick={handleDownloadPowerShell}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition shadow-md border border-slate-700 flex items-center justify-between group active:scale-98 text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-sky-400" />
                      <span className="text-xs">PowerShell GUI (.ps1)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal">
                      Mit grafischem Windows-Ordnerdialog
                    </p>
                  </div>
                  <FolderDown className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition text-sky-400" />
                </button>
              </div>

              {/* GitHub Releases Link */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Möchten Sie den vorkompilierten Electron / NSIS .exe Installer?</span>
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

          {/* TAB 2: FOLDER STRUCTURE PREVIEW */}
          {activeTab === 'folders' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span className="text-xs text-indigo-400 font-bold flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4" /> Lokale Ordnerstruktur
                  </span>
                  <span>Ziel: {customPath}</span>
                </div>

                <div className="space-y-1.5 pt-2 text-slate-300">
                  <div className="text-indigo-400 font-bold">📁 {customPath}\</div>
                  <div className="pl-4 text-emerald-400">├── 📁 Data\ <span className="text-slate-400 text-[10px]">— Lokale Datenbank &amp; Kontakte/Belege</span></div>
                  <div className="pl-4 text-amber-400">├── 📁 Backups\ <span className="text-slate-400 text-[10px]">— JSON-Sicherungen (automatisch &amp; manuell)</span></div>
                  <div className="pl-4 text-sky-400">├── 📁 Exports\ <span className="text-slate-400 text-[10px]">— DIN 5008 PDF-Rechnungen &amp; BWA</span></div>
                  <div className="pl-4 text-purple-400">├── 📁 Config\ <span className="text-slate-400 text-[10px]">— Firmenprofil &amp; Einstellungen</span></div>
                  <div className="pl-4 text-white">└── 🚀 SOCDOF_Starten.bat <span className="text-slate-400 text-[10px]">— Lokaler Desktop-Launcher</span></div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-slate-600 dark:text-slate-300 space-y-1 text-[11px]">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Automatische Datensicherung in diesen Ordner</span>
                </div>
                <p>
                  Unter <em>Einstellungen &gt; Speicher &amp; Datensicherung</em> können Sie den Pfad <code>{customPath}\Backups</code> hinterlegen, damit Ihre Sicherungen jederzeit auffindbar sind.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PWA / BROWSER NATIVE APP */}
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
                      Erscheint in der Windows 11 Taskleiste und im Startmenü als eigenständiges Anwendungsfenster.
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

          {/* TAB 4: STORAGE INFO */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200">
                      Lokaler Windows PC-Speicher (IndexedDB)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {storageInfo.usedMb} MB belegt
                  </span>
                </div>

                <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(1, storageInfo.percent)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Alle Rechnungsbelege, Kundenkontakte, Artikelpreise und Buchungen werden in Ihrer <strong>lokalen PC-Datenbank</strong> abgelegt.
                </p>
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
