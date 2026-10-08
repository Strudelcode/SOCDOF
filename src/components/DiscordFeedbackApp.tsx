import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bug, 
  Lightbulb, 
  MessageSquare, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  Loader2, 
  Clock, 
  Trash2, 
  Copy, 
  ListOrdered,
  Search,
  CheckCircle2,
  CircleDot,
  Eye,
  EyeOff,
  Boxes,
  RefreshCw,
  Tag,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  User,
  Sparkles,
  HelpCircle,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  sendDiscordReport, 
  getStoredDiscordIdentity, 
  saveStoredDiscordIdentity, 
  getSubmittedDiscordReports, 
  deleteSubmittedDiscordReport, 
  syncDiscordReports, 
  checkDiscordBotStatus, 
  getAppLanguageLabel, 
  getSystemLanguageLabel, 
  SubmittedDiscordReport 
} from '../lib/discordFeedback';
import { APP_VERSION } from '../lib/version';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';
import { AppLocationPickerModal } from './AppLocationPickerModal';
import { DiscordEmbedPreview } from './DiscordEmbedPreview';
import { DynamicReportsIcon } from './DynamicReportsIcon';
import { DiscordThreadInspectorModal } from './DiscordThreadInspectorModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface DiscordFeedbackAppProps {
  initialType?: 'bug' | 'idea' | 'feedback';
  onClose?: () => void;
}

export const DiscordFeedbackApp: React.FC<DiscordFeedbackAppProps> = ({
  initialType = 'bug',
  onClose
}) => {
  const lang = useLanguage();

  // Top View Switcher: 'submit' (Wizard) vs 'history' (My Tickets)
  const [activeView, setActiveView] = useState<'submit' | 'history'>('submit');

  // Wizard Step: 1 = Type selection, 2 = Details & Location, 3 = Discord Contact & Submit
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Selected Report Type: 'bug' | 'idea' | 'feedback'
  const [reportType, setReportType] = useState<'bug' | 'idea' | 'feedback'>(initialType);

  // Identity inputs
  const [discordName, setDiscordName] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');

  // Report fields
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [description, setDescription] = useState('');

  // App Location Picker Modal
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);

  // Thread Inspector Modal
  const [inspectorReport, setInspectorReport] = useState<SubmittedDiscordReport | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // In-App Deletion Modals
  const [reportToDelete, setReportToDelete] = useState<SubmittedDiscordReport | null>(null);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);

  // History / Tickets state
  const [submittedReports, setSubmittedReports] = useState<SubmittedDiscordReport[]>([]);
  const [copiedLinkThreadId, setCopiedLinkThreadId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [hideResolved, setHideResolved] = useState(false);

  // Live 30s Polling State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(null);

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    queued?: boolean;
    threadId?: string;
    threadUrl?: string;
    error?: string;
    message?: string;
  } | null>(null);

  // Bot Status
  const [botStatus, setBotStatus] = useState<{ 
    online: boolean; 
    checking: boolean;
    botName?: string;
    avatarUrl?: string;
  }>({ online: true, checking: false });

  const refreshBotStatus = useCallback(async (force = false) => {
    setBotStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await checkDiscordBotStatus(force);
      setBotStatus({
        online: res.online,
        checking: false,
        botName: res.botName,
        avatarUrl: res.avatarUrl
      });
    } catch {
      setBotStatus({ online: false, checking: false });
    }
  }, []);

  // Load remembered identity & report history on mount
  useEffect(() => {
    const stored = getStoredDiscordIdentity();
    setDiscordName(stored.discordName || '');
    setDiscordUserId(stored.discordUserId || '');
    setSubmittedReports(getSubmittedDiscordReports());
    refreshBotStatus(true);
  }, [refreshBotStatus]);

  // Sync function from Discord API
  const performSync = useCallback(async (showFeedback = false) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    setIsSyncing(true);
    refreshBotStatus(true);
    try {
      const result = await syncDiscordReports();
      setSubmittedReports(result.updatedReports);
      setLastSyncedTime(new Date());
      if (showFeedback && result.changedCount > 0) {
        sounds.playSuccess();
      }
    } catch (err) {
      console.warn('Discord sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshBotStatus]);

  // 30-Second Auto-Poll (runs only while app is open & active)
  useEffect(() => {
    performSync();
    const interval = setInterval(() => {
      performSync();
    }, 30000);

    const handleReportsChanged = (e: any) => {
      if (e.detail?.reports) {
        setSubmittedReports(e.detail.reports);
      }
    };
    const handleReportsSynced = (e: any) => {
      if (e.detail?.reports) {
        setSubmittedReports(e.detail.reports);
        setLastSyncedTime(new Date());
      }
    };

    window.addEventListener('socdof:discord-reports-changed', handleReportsChanged);
    window.addEventListener('socdof:discord-reports-synced', handleReportsSynced);

    return () => {
      clearInterval(interval);
      window.removeEventListener('socdof:discord-reports-changed', handleReportsChanged);
      window.removeEventListener('socdof:discord-reports-synced', handleReportsSynced);
    };
  }, [performSync]);

  const handleManualSync = () => {
    sounds.playClick();
    performSync(true);
  };

  // Validation: Discord user ID must be only digits between 17 and 20 chars
  const handleUserIdChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 20);
    setDiscordUserId(digitsOnly);
    saveStoredDiscordIdentity({ discordName, discordUserId: digitsOnly });
  };

  const handleNameChange = (val: string) => {
    setDiscordName(val);
    saveStoredDiscordIdentity({ discordName: val, discordUserId });
  };

  const isUserIdLengthValid = !discordUserId || (discordUserId.length >= 17 && discordUserId.length <= 20);

  const otherLabel = t('feedback.loc_other', lang, 'Sonstiges (Eigene Eingabe)');

  // Effective location
  const isCustomSelected = location === otherLabel || 
    location.startsWith('Sonstiges') || 
    location.startsWith('Other') || 
    location.startsWith('Autre') || 
    location.startsWith('Otro');

  const effectiveLocation = isCustomSelected
    ? (customLocation.trim() || 'Sonstiges')
    : location;

  const isLocationStepComplete = !!location && (!isCustomSelected || !!customLocation.trim());

  // Step 2 completeness check
  const isStep2Valid = !!(title.trim() && isLocationStepComplete && description.trim());

  // Reset wizard for a new report
  const handleStartNewReport = () => {
    sounds.playClick();
    setTitle('');
    setLocation('');
    setCustomLocation('');
    setDescription('');
    setWizardStep(1);
    setSubmissionResult(null);
    setActiveView('submit');
  };

  // Handle submit to Discord
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sounds.playClick();

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    const cleanLoc = effectiveLocation;

    if (!cleanTitle) {
      setWizardStep(2);
      return;
    }
    if (!cleanLoc) {
      setWizardStep(2);
      return;
    }
    if (!cleanDesc) {
      setWizardStep(2);
      return;
    }

    // Save identity
    saveStoredDiscordIdentity({
      discordName: discordName.trim(),
      discordUserId: discordUserId.trim()
    });

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      const result = await sendDiscordReport({
        type: reportType,
        title: cleanTitle,
        categoryOrLocation: cleanLoc,
        description: cleanDesc,
        discordName: discordName.trim(),
        discordUserId: discordUserId.trim()
      });

      setSubmissionResult(result);

      if (result.success) {
        sounds.playSuccess();
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {}

        setSubmittedReports(getSubmittedDiscordReports());
      } else {
        sounds.playError();
      }
    } catch (err: any) {
      setSubmissionResult({
        success: false,
        error: err?.message || 'Unerwarteter Übertragungsfehler beim Senden an Discord.'
      });
      sounds.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyThreadLink = (threadUrl: string, threadId: string) => {
    sounds.playClick();
    try {
      navigator.clipboard.writeText(threadUrl);
      setCopiedLinkThreadId(threadId);
      setTimeout(() => setCopiedLinkThreadId(null), 2000);
    } catch {}
  };

  const filteredReports = submittedReports.filter(r => {
    const isFinished = r.status === 'resolved' || r.status === 'rejected';
    if (hideResolved && isFinished) return false;
    if (statusFilter === 'open' && isFinished) return false;
    if (statusFilter === 'resolved' && !isFinished) return false;

    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return r.title.toLowerCase().includes(q) ||
           r.categoryOrLocation.toLowerCase().includes(q) ||
           r.description.toLowerCase().includes(q) ||
           (r.appliedTags && r.appliedTags.some(tg => tg.name.toLowerCase().includes(q)));
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl sm:rounded-[32px] overflow-hidden select-text border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
      
      {/* App Header & Navigation */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3.5 rounded-t-3xl sm:rounded-t-[32px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DynamicReportsIcon variant={reportType} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold">
                  {t('feedback.app_title', lang, 'Reports & Feedback')}
                </h1>
                {botStatus.checking ? (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1.5 shadow-2xs">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span>{t('feedback.bot_checking', lang, 'Bot wird geprüft...')}</span>
                  </span>
                ) : botStatus.online ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 shadow-2xs">
                      {botStatus.avatarUrl ? (
                        <img src={botStatus.avatarUrl} alt={botStatus.botName || 'Discord Bot'} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      )}
                      <span>{t('feedback.bot_online', lang, 'Discord-Bot online')}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span 
                      title={t('feedback.bot_offline_tooltip', lang, 'Discord-Bot ist momentan offline (normalerweise max. 10 Min.)')}
                      className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1.5 shadow-2xs border border-rose-300/50 dark:border-rose-800/50"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{t('feedback.bot_offline', lang, 'Discord-Bot offline')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshBotStatus(true)}
                      disabled={botStatus.checking}
                      title={t('feedback.check_status_now', lang, 'Status jetzt erneut prüfen')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${botStatus.checking ? 'animate-spin text-rose-500' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('feedback.app_subtitle', lang, 'Fehlerberichte oder Ideen posten und Tickets direkt im Discord-Forum verfolgen.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
              title={t('feedback.sync_now', lang, 'Synchronisieren')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              <span>{isSyncing ? t('feedback.syncing', lang, 'Synchronisiere...') : t('feedback.sync_now', lang, 'Synchronisieren')}</span>
            </button>

            <a
              href="https://discord.gg/QW85EaXTgB"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] dark:text-indigo-300 text-xs font-semibold transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('feedback.join_server', lang, 'Discord Server beitreten')}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        {/* Top 2 Main Navigation Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 gap-1.5 max-w-md">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setActiveView('submit');
              setSubmissionResult(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeView === 'submit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
            <span className="truncate">{t('feedback.submit_report_tab', lang, 'Report einreichen')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setActiveView('history');
              setSubmittedReports(getSubmittedDiscordReports());
              setSubmissionResult(null);
              performSync();
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeView === 'history'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{t('feedback.tab_history', lang, 'Meine Tickets')} ({submittedReports.length})</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-5">
          
          {/* Active Transmitting Spinner Banner while isSubmitting is true */}
          {isSubmitting && (
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 animate-fade-in shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span>{t('feedback.transmitting_title', lang, 'Wird an Discord gesendet...')}</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {t('feedback.transmitting_desc', lang, 'Bitte warten, Ihr Beitrag wird an Ihren Discord-Server übertragen und dort veröffentlicht...')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submission Result Success/Error Banners */}
          {!isSubmitting && submissionResult && (
            <div className={`p-5 rounded-2xl border animate-fade-in shadow-md ${
              submissionResult.success && !submissionResult.queued
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                : submissionResult.queued
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  {submissionResult.success && !submissionResult.queued ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-5 h-5" />
                    </div>
                  ) : submissionResult.queued ? (
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Clock className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold">
                      {submissionResult.success && !submissionResult.queued
                        ? t('feedback.sent_success_title', lang, 'Erfolgreich an Discord übertragen!')
                        : submissionResult.queued
                        ? t('feedback.queued_title', lang, 'In Offline-Warteschlange gespeichert')
                        : t('feedback.send_error_title', lang, 'Übertragung fehlgeschlagen')}
                    </h3>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {submissionResult.success && !submissionResult.queued
                        ? t('feedback.sent_success_desc', lang, 'Dein Bericht ist jetzt live im Discord-Forum und als Ticket gespeichert.')
                        : submissionResult.queued
                        ? t('feedback.queued_desc', lang, 'Dein Bericht wurde lokal gespeichert und wird automatisch übertragen, sobald du wieder online bist.')
                        : (submissionResult.error || t('feedback.send_error_desc', lang, 'Konnte nicht an Discord gesendet werden.'))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {submissionResult.threadUrl && (
                    <a
                      href={submissionResult.threadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold transition shadow-xs"
                    >
                      <span>{t('feedback.view_ticket', lang, 'Auf Discord ansehen')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleStartNewReport}
                    style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold hover:brightness-110 transition shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'de' ? 'Neuen Report verfassen' : 'New Report'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 1: MY TICKETS (HISTORY) */}
          {activeView === 'history' ? (
            <div className="space-y-4">
              
              {/* Live Sync Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t('feedback.auto_sync_active', lang, 'Auto-Sync 30s aktiv')}
                  </span>
                  {lastSyncedTime && (
                    <span className="text-[11px] text-slate-400">
                      • {t('feedback.last_synced', { time: lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-850 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? t('feedback.syncing', lang, 'Synchronisiere...') : t('feedback.sync_now', lang, 'Synchronisieren')}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder={t('feedback.picker_search_placeholder', lang, 'Tickets durchsuchen...')}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHideResolved(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      hideResolved
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                    title={hideResolved ? t('feedback.show_all', lang, 'Alle anzeigen') : t('feedback.hide_resolved', lang, 'Erledigte ausblenden')}
                  >
                    {hideResolved ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{hideResolved ? t('feedback.hide_resolved', lang, 'Erledigte ausgeblendet') : t('feedback.show_all', lang, 'Alle anzeigen')}</span>
                  </button>

                  {submittedReports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setIsClearHistoryModalOpen(true);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 hover:underline cursor-pointer flex items-center gap-1 px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('feedback.clear_history', lang, 'Verlauf leeren')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t('feedback.filter_all', lang, 'Alle')} ({submittedReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('open')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'open'
                      ? 'bg-orange-600 text-white font-bold'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t('feedback.filter_open', lang, 'Offen')} ({submittedReports.filter(r => r.status !== 'resolved' && r.status !== 'rejected').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('resolved')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'resolved'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t('feedback.filter_resolved', lang, 'Erledigt')} ({submittedReports.filter(r => r.status === 'resolved' || r.status === 'rejected').length})
                </button>
              </div>

              {filteredReports.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3">
                  <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('feedback.empty_tickets', lang, 'Keine Tickets gefunden')}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {t('feedback.empty_tickets_desc', lang, 'Sobald Sie über diese App einen Bug oder eine Idee an Discord senden, wird der Beitrag mit direktem Discord-Link hier gespeichert.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('submit')}
                    style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer mt-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('feedback.submit_report_tab', lang, 'Jetzt ersten Report verfassen')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map(rep => (
                    <div
                      key={rep.id}
                      className={`p-4 rounded-2xl bg-white dark:bg-slate-850 border space-y-3 shadow-xs transition ${
                        rep.isDeleted
                          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20'
                          : rep.status === 'resolved'
                          ? 'border-emerald-200 dark:border-emerald-900/60 opacity-90'
                          : rep.status === 'rejected'
                          ? 'border-rose-200 dark:border-rose-900/60 opacity-90'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {rep.isDeleted && (
                        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="font-bold">
                              {t('feedback.post_not_exists', lang, 'Post existiert nicht mehr (auf Discord gelöscht)')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              deleteSubmittedDiscordReport(rep.id);
                              setSubmittedReports(getSubmittedDiscordReports());
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 hover:bg-amber-50 dark:hover:bg-slate-800 text-amber-900 dark:text-amber-100 text-xs font-bold transition cursor-pointer shadow-2xs border border-amber-300 dark:border-amber-700"
                            title={t('feedback.delete_local', lang, 'Lokal löschen')}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            <span>{t('feedback.delete_local', lang, 'Lokal löschen')}</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {rep.type === 'bug' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center gap-1">
                              <Bug className="w-3 h-3" />
                              <span>BUG</span>
                            </span>
                          ) : rep.type === 'feedback' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              <span>FEEDBACK</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              <span>IDEE</span>
                            </span>
                          )}

                          {/* Live Discord Status Pill */}
                          {rep.status === 'rejected' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>{t('feedback.status_rejected', lang, '❌ Abgelehnt')}</span>
                            </span>
                          ) : rep.status === 'resolved' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{t('feedback.status_resolved', lang, '✅ Behoben / Erledigt')}</span>
                            </span>
                          ) : rep.status === 'in_progress' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>{t('feedback.status_in_progress', lang, '🔨 Problem-Fix in Bearbeitung')}</span>
                            </span>
                          ) : rep.status === 'forwarded' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                              <ChevronRight className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>{t('feedback.status_forwarded', lang, '↗️ Bestätigt & Weitergeleitet')}</span>
                            </span>
                          ) : rep.status === 'reviewing' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>{t('feedback.status_reviewing', lang, '🔍 In Überprüfung')}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                              <span>{t('feedback.status_pending', lang, '⏳ Neue Einreichung')}</span>
                            </span>
                          )}

                          {rep.messageCount !== undefined && rep.messageCount > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setInspectorReport(rep);
                                setIsInspectorOpen(true);
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#5865F2]/15 text-[#5865F2] dark:text-indigo-300 hover:bg-[#5865F2]/25 flex items-center gap-1 transition cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>{t('feedback.discord_replies', { count: rep.messageCount })}</span>
                            </button>
                          )}

                          <span className="text-[11px] text-slate-400">
                            {rep.channelName}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(rep.createdAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {rep.appliedTags && rep.appliedTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-[#5865F2]" />
                            <span>{t('feedback.discord_tags_label', lang, 'Live Discord-Tags:')}</span>
                          </span>
                          {rep.appliedTags.map((tg, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#5865F2]/10 dark:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] dark:text-indigo-300 shadow-2xs"
                            >
                              {tg.emojiName && <span>{tg.emojiName}</span>}
                              <span>#{tg.name}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {rep.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {t('feedback.step2_label', lang, 'Bereich / App')}: <strong className="text-slate-700 dark:text-slate-300">{rep.categoryOrLocation}</strong>
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {rep.description}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setInspectorReport(rep);
                              setIsInspectorOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer shadow-2xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{t('feedback.view_thread_messages', lang, 'Nachrichten & Status')}</span>
                            {rep.messageCount !== undefined && rep.messageCount > 1 && (
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                                {rep.messageCount}
                              </span>
                            )}
                          </button>

                          <a
                            href={rep.threadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                          >
                            <span>{t('feedback.view_ticket', lang, 'Auf Discord')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyThreadLink(rep.threadUrl, rep.threadId)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedLinkThreadId === rep.threadId ? t('feedback.copied', lang, 'Kopiert!') : t('feedback.copy_link', lang, 'Link')}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setReportToDelete(rep);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={t('feedback.delete_item_title', lang, 'Aus lokalem Verlauf entfernen')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: REPORT EINREICHEN (WIZARD FLOW + PERSISTENT LIVE PREVIEW) */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 3-STEP WIZARD FORM */}
              <div className="md:col-span-7 space-y-4">
                
                {/* Wizard Step Progress Pills */}
                <div className="p-3 bg-white dark:bg-slate-850 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setWizardStep(1);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl sm:rounded-2xl text-xs font-bold transition cursor-pointer ${
                        wizardStep === 1
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span className="truncate">{t('feedback.wizard_step1', lang, '1. Art wählen')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setWizardStep(2);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl sm:rounded-2xl text-xs font-bold transition cursor-pointer ${
                        wizardStep === 2
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isStep2Valid ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-700'
                      }`}>
                        {isStep2Valid ? '✓' : '2'}
                      </span>
                      <span className="truncate">{t('feedback.wizard_step2', lang, '2. Details & Ort')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isStep2Valid) {
                          sounds.playClick();
                          setWizardStep(3);
                        }
                      }}
                      disabled={!isStep2Valid}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl sm:rounded-2xl text-xs font-bold transition ${
                        wizardStep === 3
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs'
                          : !isStep2Valid
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-400 dark:bg-slate-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span className="truncate">{t('feedback.wizard_step3', lang, '3. Discord & Senden')}</span>
                    </button>
                  </div>
                </div>

                {/* Bot Offline Alert Banner */}
                {!botStatus.online && (
                  <div className="p-3.5 rounded-2xl sm:rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs shadow-2xs flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="flex-1">
                      {t('feedback.bot_offline_desc', lang, 'Der Discord-Bot ist kurz offline. Du kannst deinen Bericht trotzdem absenden – er wird in der Offline-Warteschlange gespeichert und automatisch synchronisiert!')}
                    </span>
                  </div>
                )}

                {/* STEP 1: REPORT TYPE SELECTION (Bug, Idee, Feedback) */}
                {wizardStep === 1 && (
                  <div className="p-5 sm:p-7 rounded-3xl sm:rounded-[28px] bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 animate-fade-in">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {t('feedback.choose_type_heading', lang, 'Welche Art von Meldung möchten Sie einreichen?')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t('feedback.choose_type_sub', lang, 'Wählen Sie eine Kategorie, um Ihre Einreichung direkt in das passende Discord-Forum zu leiten.')}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {/* OPTION 1: BUG */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setReportType('bug');
                        }}
                        className={`p-4 sm:p-4.5 rounded-2xl sm:rounded-[22px] border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
                          reportType === 'bug'
                            ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 shadow-md ring-2 ring-orange-400/20'
                            : 'border-slate-200 dark:border-slate-700/80 hover:border-orange-300 dark:hover:border-orange-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          reportType === 'bug'
                            ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400'
                        }`}>
                          <Bug className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{t('feedback.type_bug_title', lang, 'Bug / Fehler melden')}</span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-300/40">
                                #🐛 REPORT
                              </span>
                            </h3>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              reportType === 'bug' ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {reportType === 'bug' && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {t('feedback.type_bug_desc', lang, 'Ein Problem, Fehler, Darstellungs- oder Funktionsfehler in der Software melden.')}
                          </p>
                        </div>
                      </button>

                      {/* OPTION 2: IDEA */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setReportType('idea');
                        }}
                        className={`p-4 sm:p-4.5 rounded-2xl sm:rounded-[22px] border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
                          reportType === 'idea'
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-400/20'
                            : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          reportType === 'idea'
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          <Lightbulb className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{t('feedback.type_idea_title', lang, 'Idee & Verbesserung')}</span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300/40">
                                #💡ɪᴅᴇᴀ-ꜱᴜɢɢᴇꜱᴛɪᴏɴꜱ
                              </span>
                            </h3>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              reportType === 'idea' ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {reportType === 'idea' && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {t('feedback.type_idea_desc', lang, 'Einen Vorschlag für neue Funktionen, Arbeitsabläufe oder Optimierungen einbringen.')}
                          </p>
                        </div>
                      </button>

                      {/* OPTION 3: FEEDBACK */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setReportType('feedback');
                        }}
                        className={`p-4 sm:p-4.5 rounded-2xl sm:rounded-[22px] border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
                          reportType === 'feedback'
                            ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/30 shadow-md ring-2 ring-sky-400/20'
                            : 'border-slate-200 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          reportType === 'feedback'
                            ? 'bg-gradient-to-br from-sky-500 to-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                        }`}>
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{t('feedback.type_feedback_title', lang, 'Feedback & Meinung')}</span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300/40">
                                #💡ɪᴅᴇᴀ-ꜱᴜɢɢᴇꜱᴛɪᴏɴꜱ
                              </span>
                            </h3>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              reportType === 'feedback' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {reportType === 'feedback' && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {t('feedback.type_feedback_desc', lang, 'Allgemeines Feedback, Erfahrungen oder Lob an das Entwickler-Team senden.')}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Step 1 Bottom Action: Next */}
                    <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setWizardStep(2);
                        }}
                        style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl sm:rounded-2xl text-white text-xs font-bold hover:brightness-110 shadow-md cursor-pointer transition-all"
                      >
                        <span>{t('feedback.btn_next', lang, 'Weiter')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: DETAILS & LOCATION & DESCRIPTION */}
                {wizardStep === 2 && (
                  <div className="p-5 sm:p-7 rounded-3xl sm:rounded-[28px] bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {reportType === 'bug'
                          ? t('feedback.step1_bug_title', lang, 'Bug-Titel, Ort & Beschreibung')
                          : reportType === 'idea'
                          ? t('feedback.step1_idea_title', lang, 'Ideen-Titel, Kategorie & Beschreibung')
                          : t('feedback.step2_heading', lang, 'Details zu Ihrem Report')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {lang === 'de'
                          ? 'Geben Sie einen aussagekräftigen Titel und genaue Details an. Die Vorschau rechts aktualisiert sich live.'
                          : 'Provide a clear summary title and details. Live preview updates immediately on the right.'}
                      </p>
                    </div>

                    {/* 1. Title */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        <span>
                          {reportType === 'bug'
                            ? t('feedback.bug_title_label', lang, 'Bug-Titel / Kurzbeschreibung')
                            : reportType === 'idea'
                            ? t('feedback.idea_title_label', lang, 'Vorschlag / Titel der Idee')
                            : t('feedback.feedback_title_label', lang, 'Feedback-Betreff / Kurzbeschreibung')}
                        </span>
                        <span className="text-rose-500 font-bold ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder={
                          reportType === 'bug'
                            ? t('feedback.step1_bug_placeholder', lang, 'z. B. Rechnungsdruck schneidet Fußzeile ab')
                            : reportType === 'idea'
                            ? t('feedback.step1_idea_placeholder', lang, 'z. B. Automatischer PDF-Massenexport für Belege')
                            : t('feedback.step1_feedback_placeholder', lang, 'z. B. Toller Kassen-Ablauf, kleiner Wunsch...')
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        required
                        autoFocus
                      />
                    </div>

                    {/* 2. Location / App Picker */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        <span>
                          {reportType === 'bug'
                            ? t('feedback.bug_location_label', lang, 'Ort des Fehlers (App / Modul)')
                            : t('feedback.idea_category_label', lang, 'Kategorie / Betroffener Bereich')}
                        </span>
                        <span className="text-rose-500 font-bold ml-1">*</span>
                      </label>

                      {!location ? (
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setIsAppPickerOpen(true);
                          }}
                          className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                              <Search className="w-4 h-4" />
                            </div>
                            <span>{t('feedback.select_location_btn', lang, 'Wähle einen Ort aus...')}</span>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                            {t('feedback.change_location_btn', lang, 'App auswählen')} &rarr;
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                              <Boxes className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                {location}
                              </span>
                              <span className="text-[10px] text-indigo-700 dark:text-indigo-300">
                                {t('feedback.step2_label', lang, 'Ausgewähltes Modul')}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setIsAppPickerOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold transition cursor-pointer shrink-0 ml-2"
                          >
                            {t('feedback.change_location_btn', lang, 'Ändern...')}
                          </button>
                        </div>
                      )}

                      {isCustomSelected && (
                        <div className="mt-2 animate-fade-in">
                          <input
                            type="text"
                            value={customLocation}
                            onChange={e => setCustomLocation(e.target.value)}
                            placeholder={t('feedback.custom_location_placeholder', lang, 'Geben Sie den genauen Ort / die App ein...')}
                            className="w-full px-3 py-2 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-300 dark:border-indigo-800/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* 3. Description */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        <span>
                          {reportType === 'bug'
                            ? t('feedback.bug_desc_label', lang, 'Genaue Fehlerbeschreibung')
                            : reportType === 'idea'
                            ? t('feedback.idea_desc_label', lang, 'Genaue Beschreibung der Idee & Nutzen')
                            : t('feedback.feedback_desc_label', lang, 'Genaue Feedback-Beschreibung & Anmerkungen')}
                        </span>
                        <span className="text-rose-500 font-bold ml-1">*</span>
                      </label>
                      <textarea
                        rows={4}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder={
                          reportType === 'bug'
                            ? t('feedback.step3_bug_placeholder', lang, '1. Was haben Sie gemacht?\n2. Welcher Fehler trat auf?\n3. Erwartetes Verhalten...')
                            : reportType === 'idea'
                            ? t('feedback.step3_idea_placeholder', lang, 'Beschreiben Sie Ihren Wunsch, wie der Ablauf sein sollte und welchen Nutzen es bringt...')
                            : t('feedback.step3_feedback_placeholder', lang, 'Beschreiben Sie Ihre Erfahrungen, Eindrücke oder was Ihnen positiv oder verbesserungsfähig aufgefallen ist...')
                        }
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-mono"
                        required
                      />
                    </div>

                    {/* Step 2 Bottom Navigation */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setWizardStep(1);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{t('feedback.btn_back', lang, 'Zurück')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isStep2Valid) {
                            sounds.playClick();
                            setWizardStep(3);
                          }
                        }}
                        disabled={!isStep2Valid}
                        style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-bold hover:brightness-110 shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{t('feedback.btn_next', lang, 'Weiter')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: DISCORD CONTACT & SUBMISSION (FETT HERVORGEHOBEN: OPTIONAL & EMPFOHLEN!) */}
                {wizardStep === 3 && (
                  <div className="p-5 sm:p-7 rounded-3xl sm:rounded-[28px] bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 animate-fade-in">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {t('feedback.step3_heading', lang, 'Kontaktinformationen & Absenden')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {lang === 'de'
                          ? 'Fast fertig! Überprüfe deinen Discord-Kontakt und sende den Report an den Server.'
                          : 'Almost done! Review your Discord contact details and transmit the report.'}
                      </p>
                    </div>

                    {/* FETT HERVORGEHOBENE PROMINENTE DISCORD KONTAKT BOX */}
                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-[#5865F2] bg-[#5865F2]/5 dark:bg-[#5865F2]/10 space-y-3.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#5865F2] text-white flex items-center justify-center shrink-0 shadow-sm">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#5865F2] text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>{lang === 'de' ? 'OPTIONAL & EMPFOHLEN' : 'OPTIONAL & RECOMMENDED'}</span>
                          </div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                            {t('feedback.contact_box_bold', lang, 'Optional und empfohlen: Discord-Name / User-ID eingeben, damit wir Sie bei Rückfragen direkt auf dem Server kontaktieren können!')}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            {t('feedback.contact_box_sub', lang, 'Ihre Angaben werden lokal gespeichert. So kann das Entwickler-Team direkt im Ticket auf Discord antworten oder Sie bei Rückfragen pingen.')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
                            {t('feedback.sender_name_label', lang, 'Dein Discord-Name / Tag:')}
                          </label>
                          <input
                            type="text"
                            value={discordName}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder={t('feedback.sender_name_placeholder', lang, 'z. B. Max Mustermann (oder leer lassen)')}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865F2] shadow-2xs"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                              {t('feedback.sender_id_label', lang, 'Discord User-ID (Ziffern):')}
                            </label>
                            {discordUserId && (
                              <span className={`text-[10px] font-bold ${
                                isUserIdLengthValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {discordUserId.length} {lang === 'de' ? 'Stellen' : 'digits'}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={discordUserId}
                            onChange={e => handleUserIdChange(e.target.value)}
                            placeholder={t('feedback.discord_user_id_hint', lang, '17–20 Ziffern für direkten Ping')}
                            className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865F2] shadow-2xs transition ${
                              discordUserId && !isUserIdLengthValid 
                                ? 'border-amber-400 dark:border-amber-600' 
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>
                          {lang === 'de' 
                            ? 'Wird für zukünftige Meldungen automatisch auf diesem Gerät gemerkt.' 
                            : 'Remembered automatically on this device for future submissions.'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Summary Review Card */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{lang === 'de' ? 'Zusammenfassung:' : 'Summary:'}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {reportType.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-slate-900 dark:text-white font-semibold truncate">
                        • {title || '(Kein Titel)'}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 truncate">
                        • {effectiveLocation}
                      </div>
                    </div>

                    {/* Step 3 Bottom Navigation & Final Submit */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setWizardStep(2);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{t('feedback.btn_back', lang, 'Zurück')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting || !isStep2Valid}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition shadow-lg ${
                          isSubmitting
                            ? 'bg-slate-500 text-white cursor-wait opacity-85 shadow-slate-500/20'
                            : !botStatus.online
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/20 cursor-pointer'
                            : reportType === 'bug'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/20 cursor-pointer'
                            : reportType === 'idea'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/20 cursor-pointer'
                            : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20 cursor-pointer'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>{t('feedback.submitting_button', lang, 'Wird an Discord gesendet...')}</span>
                          </>
                        ) : !botStatus.online ? (
                          <>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{t('feedback.btn_submit_queued', lang, 'In Offline-Warteschlange speichern')}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 shrink-0" />
                            <span>
                              {reportType === 'bug'
                                ? t('feedback.submit_bug_btn', lang, 'Bug-Report jetzt an Discord senden')
                                : reportType === 'idea'
                                ? t('feedback.submit_idea_btn', lang, 'Idee & Vorschlag an Discord senden')
                                : t('feedback.submit_feedback_btn', lang, 'Feedback jetzt an Discord senden')}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: PERSISTENT LIVE DISCORD PREVIEW (IMMER DIREKT ÜBERALL DABEI!) */}
              <div className="md:col-span-5 space-y-3 sticky top-0">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('feedback.preview_title', lang, 'Live Discord-Vorschau')}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('feedback.preview_subtitle', lang, 'Exakte Darstellung wie im Server-Forum')}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                    {t('feedback.live_badge', lang, 'Live-Vorschau')}
                  </span>
                </div>

                {/* Persistent Discord Embed Preview Card */}
                <DiscordEmbedPreview
                  type={reportType}
                  title={title}
                  categoryOrLocation={effectiveLocation}
                  description={description}
                  discordName={discordName}
                  discordUserId={discordUserId}
                  botName={botStatus.botName}
                  botAvatarUrl={botStatus.avatarUrl}
                  appVersion={`SOCDOF v${APP_VERSION}`}
                  appLanguage={getAppLanguageLabel(lang)}
                  systemLanguage={getSystemLanguageLabel()}
                />

                <div className="p-3.5 rounded-2xl sm:rounded-3xl bg-slate-100/70 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
                  <CircleDot className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'de'
                      ? 'Die Vorschau reagiert in Echtzeit auf jeden Schritt: Typ, Titel, Ort, Beschreibung und Absender.'
                      : 'The preview reacts in real time to every step: type, title, location, description, and author.'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* App & Location Picker Modal Popup */}
      <AppLocationPickerModal
        isOpen={isAppPickerOpen}
        onClose={() => setIsAppPickerOpen(false)}
        selectedLocation={location}
        onSelect={(displayName, isCustom) => {
          setLocation(displayName);
          if (!isCustom) {
            setCustomLocation('');
          }
        }}
        title={reportType === 'bug' ? t('feedback.picker_title', lang, 'App oder Modul auswählen') : t('feedback.step2_idea_title', lang, 'Kategorie / Bereich wählen')}
        subtitle={reportType === 'bug' ? t('feedback.picker_desc', lang, 'Wählen Sie die betroffene App für diesen Bug-Report:') : t('feedback.step2_idea_title', lang, 'Wählen Sie den passenden Bereich für Ihre Idee:')}
      />

      {/* Discord Thread Messages Inspector Modal */}
      <DiscordThreadInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        report={inspectorReport}
        onRefreshReport={() => performSync(false)}
      />

      {/* Clear History Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isClearHistoryModalOpen}
        onClose={() => setIsClearHistoryModalOpen(false)}
        title={t('feedback.clear_history', lang, 'Verlauf leeren')}
        description={t('feedback.clear_history_confirm', lang, 'Möchten Sie Ihren lokalen Ticket-Verlauf wirklich löschen?')}
        confirmLabel={t('common.delete', lang, 'Löschen')}
        onConfirm={() => {
          try {
            localStorage.removeItem('socdof_discord_submitted_reports_v1');
            setSubmittedReports([]);
            sounds.playSuccess();
          } catch {}
          setIsClearHistoryModalOpen(false);
        }}
      />

      {/* Single Report Delete Modal */}
      {reportToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(reportToDelete)}
          onClose={() => setReportToDelete(null)}
          title={t('feedback.delete_local', lang, 'Lokal löschen')}
          description={lang === 'de' ? `Ticket "${reportToDelete.title}" aus dem lokalen Verlauf entfernen?` : `Remove ticket "${reportToDelete.title}" from local history?`}
          confirmLabel={t('common.delete', lang, 'Löschen')}
          onConfirm={() => {
            deleteSubmittedDiscordReport(reportToDelete.id);
            setSubmittedReports(getSubmittedDiscordReports());
            sounds.playSuccess();
            setReportToDelete(null);
          }}
        />
      )}
    </div>
  );
};
