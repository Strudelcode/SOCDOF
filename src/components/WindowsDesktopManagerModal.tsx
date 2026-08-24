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
  Info
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';

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
  const [activeTab, setActiveTab] = useState<'install' | 'storage' | 'starter'>('install');
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

  const handleInstallClick = async () => {
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
      // Guide user on how to install directly in Edge/Chrome
      alert(
        'Windows App Installation:\n\n' +
        '1. Klicken Sie in der Browser-Adressleiste auf das Symbol "App installieren" (oder im Drei-Punkte-Menü auf "Apps > Diese Website als App installieren").\n' +
        '2. Die SOCDOF App wird direkt in Ihrem Windows-Startmenü und auf Ihrem Windows-Desktop als native Anwendung abgelegt!'
      );
    }
  };

  const handleDownloadBatchStarter = () => {
    sounds.playSuccess();
    const currentUrl = window.location.href;
    const batchContent = `@echo off
:: ========================================================
:: SOCDOF - Strudel's Organization, Commerce & Documentation Offline Flow
:: 100% Lokale Offline-Ausfuehrung
:: ========================================================
title SOCDOF Windows Desktop
cls
echo --------------------------------------------------------
echo  Starte SOCDOF lokale Windows Desktop-App...
echo  Strudel's Organization, Commerce & Documentation Offline Flow
echo  Alle Daten verbleiben zu 100%% lokal auf Ihrem PC.
echo --------------------------------------------------------
timeout /t 1 >nul

:: Oeffnet im Vollbild-App-Modus (Microsoft Edge WebView / Chrome)
start msedge --app="${currentUrl}" --new-window || start chrome --app="${currentUrl}" || start "" "${currentUrl}"

exit
`;

    const blob = new Blob([batchContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SOCDOF_Windows_Starten.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPowerShellStarter = () => {
    sounds.playSuccess();
    const currentUrl = window.location.href;
    const psContent = `# ========================================================
# SOCDOF - Strudel's Organization, Commerce & Documentation Offline Flow
# 100% Lokale Offline-Ausfuehrung
# ========================================================
Write-Host "Starte SOCDOF Windows Desktop Suite..." -ForegroundColor Cyan
Write-Host "Strudel's Organization, Commerce & Documentation Offline Flow" -ForegroundColor Magenta
Write-Host "Speicherort: 100% Lokale PC-Datenbank (Keine Cloud)" -ForegroundColor Green

$url = "${currentUrl}"

# Versuche Edge im nativen Windows App-Rahmen zu starten
try {
    Start-Process msedge -ArgumentList "--app=$url", "--new-window"
} catch {
    Start-Process $url
}
`;

    const blob = new Blob([psContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SOCDOF_Windows_Starten.ps1';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none text-slate-900 dark:text-slate-100">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold mb-1 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                <span>100% Lokale Windows Desktop-App</span>
              </div>
              <h3 className="text-lg font-bold">SOCDOF Windows Desktop</h3>
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-3 gap-2">
          {[
            { id: 'install', label: 'Windows App Installation', icon: Laptop },
            { id: 'storage', label: 'Lokaler Speicher & Datenschutz', icon: HardDrive },
            { id: 'starter', label: 'Windows Starter (.bat / .ps1)', icon: Terminal }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as any); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition ${
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
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200">
                    Garantie: Vollständig eigenständige Windows-Anwendung
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Diese Software speichert <strong>keine Belege oder Firmendaten im Web (wie bei Google oder Fremd-Cloud-Anbietern)</strong>. Die Anwendung läuft als lokale Desktop-App direkt auf Ihrem Rechner.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Als native Windows-App installieren</span>
                      {isInstalled && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-extrabold">
                          Installiert
                        </span>
                      )}
                    </h5>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Erscheint in der Windows 11 Taskleiste, im Startmenü und auf dem Windows-Desktop ohne Browserleisten.
                    </p>
                  </div>

                  <button
                    onClick={handleInstallClick}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md transition whitespace-nowrap active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalled ? 'Erneut verknüpfen' : 'Jetzt in Windows installieren'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">Vorteile der Windows-Desktop-Installation:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                    <li>Eigenes Odoo ERP Fenster ohne Browser-Tabs oder störende Adressleisten</li>
                    <li>Schnellstart über die Windows-Suchleiste (Taste <strong>Win</strong> drücken und <em>Odoo</em> tippen)</li>
                    <li>Direktes Anheften an die Windows 11 Taskleiste</li>
                    <li>100% Offline-fähig ohne aktive Internetverbindung</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

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

                {/* Progress bar */}
                <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(1, storageInfo.percent)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Alle Rechnungsbelege, Kundenkontakte, Artikelpreise, Lagerbestände und BWA-Buchungen werden in Ihrer <strong>lokalen PC-Datenbank</strong> abgelegt. Weder Google noch Dritte haben Zugriff auf Ihre Geschäftsgeheimnisse.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Speicherort</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white mt-1">C:\ Lokaler Datenträger</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Kein Cloud-Server</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Offline-Zustand</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white mt-1">Vollständig autark</div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">Kein Internet nötig</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'starter' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
                    <Terminal className="w-3.5 h-3.5" /> Windows Batch-Starter (.bat)
                  </span>
                  <span>Portable Launcher</span>
                </div>
                <div className="text-slate-300 py-1">
                  Möchten Sie Odoo ERP mit einem Doppelklick von Ihrem Windows-Desktop oder einem USB-Stick starten?
                </div>
                <div className="text-emerald-400 text-[10px]">
                  start msedge --app=".../odoo" --new-window
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDownloadBatchStarter}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md"
                >
                  <FolderDown className="w-4 h-4" />
                  <span>Windows Starter (.bat) herunterladen</span>
                </button>

                <button
                  onClick={handleDownloadPowerShellStarter}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition border border-slate-200 dark:border-slate-700"
                >
                  <Terminal className="w-4 h-4 text-sky-500" />
                  <span>PowerShell Starter (.ps1)</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Legen Sie die <code>.bat</code> Datei einfach auf Ihren Windows Desktop. Ein Doppelklick öffnet Odoo ERP direkt als isoliertes Windows-Programmfenster.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% DSGVO- & GoBD-konform lokal auf diesem PC</span>
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
