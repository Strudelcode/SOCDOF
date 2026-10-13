import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  Check,
  Monitor,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Sparkles,
  Lock,
  X,
  FileCode,
  Globe,
  Terminal,
  Info,
  ChevronRight,
  Eye,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';
import { SocdofLogo } from './SocdofLogo';
import { sounds } from '../lib/sound';
import { type LanguageCode, useLanguage, t } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';
import { 
  downloadWindowsInstallerCmd, 
  downloadWindowsInstallerBat, 
  downloadPowerShellSetupWizard,
  OFFICIAL_RELEASES_PAGE_URL 
} from '../lib/windowsExeDownloader';
import {
  recordDesktopDownloaded,
  isDesktopInstalledOrDownloaded,
  getDownloadedDesktopVersion,
  markDesktopAsInstalled
} from '../lib/desktopDownloadStatus';

interface CustomDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: LanguageCode;
  onOpenUpdateSplash?: (version?: string) => void;
}

export const CustomDownloadModal: React.FC<CustomDownloadModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onOpenUpdateSplash
}) => {
  const fallbackLang = useLanguage();
  const activeLang: LanguageCode = currentLang || fallbackLang;
  const [activeTab, setActiveTab] = useState<'installer' | 'portable' | 'pwa'>('installer');
  const [downloadStep, setDownloadStep] = useState<'idle' | 'downloading' | 'completed'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [latestVersion, setLatestVersion] = useState<string>(APP_VERSION);
  const [downloadUrl, setDownloadUrl] = useState<string>(
    `https://github.com/Strudelcode/SOCDOF/releases/download/v${APP_VERSION}/SOCDOF-Installer.exe`
  );

  const [isLocallyDownloaded, setIsLocallyDownloaded] = useState<boolean>(() => isDesktopInstalledOrDownloaded());
  const [downloadedVer, setDownloadedVer] = useState<string | null>(() => getDownloadedDesktopVersion());

  // Check for latest GitHub release
  useEffect(() => {
    let isMounted = true;
    fetch('https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted || !data) return;
        const tag = data.tag_name ? data.tag_name.replace(/^v/, '') : APP_VERSION;
        setLatestVersion(tag || APP_VERSION);
        const exeAsset = data.assets?.find((a: any) =>
          typeof a.name === 'string' && a.name.toLowerCase() === 'socdof-installer.exe'
        ) ?? data.assets?.find((a: any) =>
          typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
        );
        if (exeAsset?.browser_download_url) {
          setDownloadUrl(exeAsset.browser_download_url);
        } else if (data.html_url) {
          setDownloadUrl(data.html_url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestVersion(APP_VERSION);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen) return null;

  const handleToggleDownloadedState = (status: boolean) => {
    if (status) {
      sounds.playSuccess();
      markDesktopAsInstalled(true);
      setIsLocallyDownloaded(true);
      setDownloadedVer(latestVersion);
    } else {
      sounds.playClick();
      markDesktopAsInstalled(false);
      setIsLocallyDownloaded(false);
      setDownloadedVer(null);
    }
  };

  const handleStartDownload = () => {
    sounds.playSuccess();
    setDownloadStep('downloading');
    setDownloadProgress(20);

    // Save download state so the home screen banner knows the user has downloaded it!
    recordDesktopDownloaded(latestVersion);
    setIsLocallyDownloaded(true);
    setDownloadedVer(latestVersion);

    // Open actual direct download or release URL
    window.open(downloadUrl, '_blank');

    // Simulate animated setup companion progress
    const timer1 = setTimeout(() => setDownloadProgress(60), 600);
    const timer2 = setTimeout(() => {
      setDownloadProgress(100);
      setDownloadStep('completed');
      recordDesktopDownloaded(latestVersion);
      setIsLocallyDownloaded(true);
      setDownloadedVer(latestVersion);
      sounds.playSuccess();
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  const handleResetDownload = () => {
    sounds.playClick();
    setDownloadStep('idle');
    setDownloadProgress(0);
  };

  const handleClose = () => {
    sounds.playClick();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all my-auto"
        style={{
          borderColor: 'var(--accent-border, rgba(99, 102, 241, 0.4))',
          boxShadow: '0 25px 70px -15px var(--accent-ambient-glow-dark, rgba(99, 102, 241, 0.35))'
        }}
      >
        {/* Top Accent Gradient Line */}
        <div 
          className="h-1.5 w-full shrink-0"
          style={{
            background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-companion, #f59e0b), var(--accent, #6366f1))'
          }}
        />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <SocdofLogo size="md" className="shadow-lg shadow-indigo-500/20" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                  {t('download.hub_title', activeLang, 'SOCDOF Desktop herunterladen')}
                </h3>
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white shadow-xs"
                  style={{ backgroundColor: 'var(--accent, #6366f1)' }}
                >
                  v{latestVersion}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Windows 10 &amp; 11 (64-Bit)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('download.hub_subtitle', activeLang, '100% Offline-fähige Desktop-Suite mit automatischen Updates')}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <button
            onClick={() => { sounds.playClick(); setActiveTab('installer'); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'installer'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            style={activeTab === 'installer' ? { borderColor: 'var(--accent, #6366f1)', color: 'var(--accent, #6366f1)' } : undefined}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Windows Installer (.exe)</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold ml-1">
              Empfohlen
            </span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('portable'); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'portable'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            style={activeTab === 'portable' ? { borderColor: 'var(--accent, #6366f1)', color: 'var(--accent, #6366f1)' } : undefined}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Portables Setup (.bat / .cmd)</span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setActiveTab('pwa'); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            style={activeTab === 'pwa' ? { borderColor: 'var(--accent, #6366f1)', color: 'var(--accent, #6366f1)' } : undefined}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Browser-App (PWA)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Download & Installation Status Card */}
          {isLocallyDownloaded ? (
            <div className="flex items-center justify-between p-3 px-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                  {t('download.already_downloaded_badge', activeLang, 'Bereits heruntergeladen & auf diesem PC vorhanden')}
                  {downloadedVer && <span className="ml-1 text-[11px] font-mono opacity-80">(v{downloadedVer})</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDownloadedState(false)}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer shrink-0 ml-2"
              >
                {t('download.mark_as_not_downloaded', activeLang, 'Status zurücksetzen')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 px-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {t('download.already_have_app_question', activeLang, 'Haben Sie SOCDOF bereits auf diesen PC heruntergeladen?')}
              </span>
              <button
                type="button"
                onClick={() => handleToggleDownloadedState(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto border border-emerald-300 dark:border-emerald-800"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('download.mark_as_downloaded', activeLang, 'Als installiert markieren')}</span>
              </button>
            </div>
          )}

          {/* TAB 1: WINDOWS INSTALLER */}
          {activeTab === 'installer' && (
            <div className="space-y-5">
              {/* Main Download Card */}
              <div 
                className="p-5 rounded-2xl border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 space-y-4 shadow-sm"
                style={{ borderColor: 'var(--accent-border-subtle, rgba(99, 102, 241, 0.25))' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Offizielles SOCDOF Windows Setup</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Dateiname: <code className="font-mono text-slate-700 dark:text-slate-300">SOCDOF-Installer.exe</code> (öffnet sofort ein Installationsfenster)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartDownload}
                      className="px-5 py-3 rounded-2xl text-white font-extrabold text-xs shadow-lg transition flex items-center gap-2 active:scale-95 hover:opacity-95 cursor-pointer"
                      style={{ 
                        backgroundColor: 'var(--accent, #6366f1)',
                        boxShadow: '0 8px 25px -4px var(--accent-ambient-glow-dark, rgba(99, 102, 241, 0.4))'
                      }}
                    >
                      <Download className="w-4 h-4 animate-bounce" />
                      <span>{t('download.btn_download_exe', activeLang, 'Setup .EXE herunterladen')}</span>
                    </button>

                    <a
                      href={OFFICIAL_RELEASES_PAGE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                      title="Alle Versionen auf GitHub anzeigen"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Animated Download Progress Companion Bar */}
                {downloadStep !== 'idle' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {downloadStep === 'downloading' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                            <span>Download läuft: SOCDOF-Installer.exe</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Download gestartet! Führen Sie das Setup jetzt aus.</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono font-bold text-slate-500">{downloadProgress}%</span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${downloadProgress}%`,
                          background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-companion, #f59e0b))'
                        }}
                      />
                    </div>

                    {downloadStep === 'completed' && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleResetDownload}
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                        >
                          Status zurücksetzen
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step-by-Step Setup Companion Guide */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Schritt-für-Schritt Installations-Begleiter</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] font-black shrink-0">
                        1
                      </span>
                      <span>Datei herunterladen</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      Die Datei <code className="text-indigo-600 dark:text-indigo-400 font-mono">SOCDOF-Setup-{latestVersion}.exe</code> wird in Ihrem gewohnten Windows-Download-Ordner gespeichert.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] font-black shrink-0">
                        2
                      </span>
                      <span>Setup ausführen</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      Starten Sie das Setup mit einem Doppelklick. Der Installer richtet SOCDOF automatisch in Sekundenschnelle ein.
                    </p>
                  </div>

                  {/* Step 3: SmartScreen Note & Visual Helper */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-1.5 sm:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Windows SmartScreen Hinweis (Wichtig bei Neuinstallation)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Windows Defender warnt bei neu kompilierten Open-Source-Programmen oft mit <em>"Der Computer wurde durch Windows geschützt"</em>. Klicken Sie einfach auf:
                    </p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-amber-200 dark:border-amber-900">
                      <span className="font-bold underline text-indigo-600 dark:text-indigo-400">Weitere Informationen</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">Trotzdem ausführen</span>
                    </div>
                  </div>

                  {/* Step 4: Auto start & Offline */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 space-y-1.5 sm:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Fertig! Desktop-Icon &amp; 100% Offline-Betrieb</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      SOCDOF legt automatisch eine Verknüpfung auf Ihrem Desktop und im Startmenü an. Alle Daten verbleiben auf Ihrem eigenen PC (DSGVO- und GoBD-konform).
                    </p>
                  </div>
                </div>
              </div>

              {/* Dedicated Update Window Demonstration Section (Direct Answer to User's Question!) */}
              <div 
                className="p-4 rounded-2xl border bg-slate-900 text-white space-y-3"
                style={{ borderColor: 'var(--accent, #6366f1)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="font-extrabold text-sm text-white">
                        Wie funktionieren Updates in SOCDOF Desktop?
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed max-w-lg">
                      Bei zukünftigen Updates schließt sich SOCDOF und zeigt ein spezielles, dezentes Fenster: <strong>"Updating to Version..."</strong>, während der Installer im Hintergrund arbeitet. Nach wenigen Sekunden startet die neue Version ganz von alleine wieder auf!
                    </p>
                  </div>

                  {onOpenUpdateSplash && (
                    <button
                      onClick={() => {
                        sounds.playPop();
                        onOpenUpdateSplash(latestVersion);
                      }}
                      className="px-3.5 py-2 rounded-xl text-white font-bold text-[11px] shadow-md transition flex items-center gap-1.5 shrink-0 active:scale-95 hover:opacity-95 cursor-pointer"
                      style={{ backgroundColor: 'var(--accent, #6366f1)' }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('updater.preview_test_btn', activeLang, 'Update-Fenster testen')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PORTABLE SETUP (.BAT / .CMD) */}
          {activeTab === 'portable' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      Portables Setup ohne Admin-Rechte
                    </h5>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      Erstellt eine eigenständige SOCDOF-Installation in einem frei wählbaren Ordner (z. B. auf einem USB-Stick oder Netzlaufwerk) inklusive Ordnerstruktur für Daten, Backups und Berichte.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    onClick={() => downloadWindowsInstallerCmd()}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 flex items-center justify-between text-left transition group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Setup_SOCDOF.cmd</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Grafischer Windows-Ordnerauswahldialog</p>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </button>

                  <button
                    onClick={() => downloadPowerShellSetupWizard()}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 flex items-center justify-between text-left transition group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Install_Wizard.ps1</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">PowerShell Setup Wizard Skript</p>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PWA / BROWSER APP */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      Als Browser-Desktop-App verknüpfen (PWA)
                    </h5>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      Installieren Sie SOCDOF direkt über Google Chrome oder Microsoft Edge als eigenständige Desktop-Anwendung ohne separate Installationsdatei.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                  <div className="font-bold text-slate-900 dark:text-slate-200">
                    Anleitung im Browser:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                    <li>In Google Chrome / Edge oben rechts auf das Installationssymbol in der Adressleiste klicken.</li>
                    <li>Oder im Dreipunkt-Menü auf <em>"App installieren"</em> / <em>"Zu Startseite hinzufügen"</em> klicken.</li>
                    <li>SOCDOF öffnet sich ab sofort im rahmenlosen App-Fenster.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% DSGVO- &amp; GoBD-konform lokal auf Ihrem PC</span>
          </div>

          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition text-xs cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
