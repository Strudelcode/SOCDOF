import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  X, 
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Play
} from 'lucide-react';
import { SocdofLogo } from './SocdofLogo';
import { sounds } from '../lib/sound';
import { type LanguageCode, useLanguage, t } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';

interface UpdatingSplashModalProps {
  isOpen: boolean;
  onClose: boolean | (() => void);
  targetVersion?: string;
  currentLang?: LanguageCode;
  isSimulated?: boolean;
}

export const UpdatingSplashModal: React.FC<UpdatingSplashModalProps> = ({
  isOpen,
  onClose,
  targetVersion = APP_VERSION,
  currentLang,
  isSimulated = true
}) => {
  const fallbackLang = useLanguage();
  const activeLang: LanguageCode = currentLang || fallbackLang;
  const [phase, setPhase] = useState<number>(0);
  const [progress, setProgress] = useState<number>(15);

  const phases = [
    {
      title: t('updater.phase_backup', activeLang, 'Sicherheits-Snapshot der Datenbank wird erstellt...'),
      desc: t('updater.phase_backup_desc', activeLang, 'Lokale Rechnungen, Kontakte & Einstellungen werden geschützt'),
      icon: HardDrive
    },
    {
      title: t('updater.phase_unpack', activeLang, 'Neue Version wird im Hintergrund installiert...'),
      desc: t('updater.phase_unpack_desc', activeLang, 'Dateien werden aktualisiert, bestehende Daten bleiben unangetastet'),
      icon: RefreshCw
    },
    {
      title: t('updater.phase_verify', activeLang, 'Integrität & Signaturen werden verifiziert...'),
      desc: t('updater.phase_verify_desc', activeLang, 'Authenticode SHA256 • Yuri / Strudel'),
      icon: ShieldCheck
    },
    {
      title: t('updater.phase_ready', activeLang, 'SOCDOF startet jetzt automatisch neu...'),
      desc: t('updater.phase_ready_desc', activeLang, 'Viel Spaß mit den neuesten Funktionen und Verbesserungen!'),
      icon: CheckCircle2
    }
  ];

  useEffect(() => {
    if (!isOpen) {
      setPhase(0);
      setProgress(15);
      return;
    }

    // Progression simulation for testing and UI display
    let isCancelled = false;
    const timeouts: NodeJS.Timeout[] = [];

    // Phase 0 -> 1 after 1.5s
    timeouts.push(setTimeout(() => {
      if (!isCancelled) {
        setPhase(1);
        setProgress(45);
        sounds.playPop();
      }
    }, 1500));

    // Phase 1 -> 2 after 3.8s
    timeouts.push(setTimeout(() => {
      if (!isCancelled) {
        setPhase(2);
        setProgress(85);
      }
    }, 3800));

    // Phase 2 -> 3 after 5.5s
    timeouts.push(setTimeout(() => {
      if (!isCancelled) {
        setPhase(3);
        setProgress(100);
        sounds.playSuccess();
      }
    }, 5500));

    return () => {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPhaseInfo = phases[Math.min(phase, phases.length - 1)];
  const PhaseIcon = currentPhaseInfo.icon;

  const handleClose = () => {
    sounds.playClick();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleRestartPreview = () => {
    sounds.playPop();
    setPhase(0);
    setProgress(15);
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') {
          handleClose();
        }
      }}
    >
      {/* Floating Modern Updater Splash Window (Discord / Spotify Style) */}
      <div 
        className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border shadow-2xl p-6 sm:p-7 overflow-hidden text-white transition-all duration-300"
        style={{
          borderColor: 'var(--accent, #6366f1)',
          boxShadow: '0 20px 60px -10px var(--accent-ambient-glow-dark, rgba(99, 102, 241, 0.45)), 0 0 35px var(--accent-glow-subtle, rgba(99, 102, 241, 0.25))'
        }}
      >
        {/* Subtle Top Accent Glow Bar */}
        <div 
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-companion, #f59e0b), var(--accent, #6366f1))'
          }}
        />

        {/* Close Button (for preview/testing) */}
        {typeof onClose === 'function' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="relative">
            <SocdofLogo size="md" className="shadow-lg shadow-indigo-500/20" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base tracking-tight text-white">
                SOCDOF Desktop
              </h3>
              <span 
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-xs"
                style={{ backgroundColor: 'var(--accent, #6366f1)' }}
              >
                v{targetVersion}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {t('updater.updating_to_version', activeLang, `Updating to Version v${targetVersion}...`).replace('{v}', targetVersion)}
            </p>
          </div>
        </div>

        {/* Main Status Display */}
        <div className="bg-slate-950/60 rounded-2xl border border-white/5 p-4 mb-5 space-y-3">
          <div className="flex items-start gap-3">
            <div 
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                phase === 3 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white border border-white/10'
              }`}
              style={phase !== 3 ? { backgroundColor: 'var(--accent-light, rgba(99, 102, 241, 0.25))', color: 'var(--accent, #6366f1)' } : undefined}
            >
              <PhaseIcon className={`w-4 h-4 ${phase === 1 ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-100">
                {currentPhaseInfo.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {currentPhaseInfo.desc}
              </p>
            </div>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
              <div 
                className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
                style={{ 
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-companion, #f59e0b))'
                }}
              >
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <span>Phase {phase + 1} von {phases.length}</span>
              </span>
              <span className="font-bold text-white">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Safety & System Notes */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px]">
              {t('updater.data_safe_badge', activeLang, 'Alle Daten & Backups bleiben 100% erhalten')}
            </span>
          </div>

          {isSimulated && (
            <button
              onClick={handleRestartPreview}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
              title="Vorschau erneut abspielen"
            >
              <Play className="w-3 h-3" />
              <span>{t('common.replay', activeLang, 'Erneut abspielen')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
