import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bug, 
  Lightbulb, 
  AtSign, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  ChevronDown, 
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
  Layers,
  RefreshCw,
  Tag,
  XCircle,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  sendDiscordReport, 
  getStoredDiscordIdentity, 
  saveStoredDiscordIdentity, 
  getSubmittedDiscordReports, 
  deleteSubmittedDiscordReport, 
  syncDiscordReports,
  SubmittedDiscordReport
} from '../lib/discordFeedback';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';
import { AppLocationPickerModal } from './AppLocationPickerModal';
import { DiscordEmbedPreview } from './DiscordEmbedPreview';
import { DiscordThreadInspectorModal } from './DiscordThreadInspectorModal';

export const DiscordFeedbackApp: React.FC = () => {
  const lang = useLanguage();
  const [activeTab, setActiveTab] = useState<'bug' | 'idea' | 'history'>('bug');

  // Identity inputs
  const [discordName, setDiscordName] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');

  // Bug inputs - Default is empty string so "Wähle einen Ort aus..." is shown as requested
  const [bugTitle, setBugTitle] = useState('');
  const [bugLocation, setBugLocation] = useState('');
  const [customBugLocation, setCustomBugLocation] = useState('');
  const [bugDescription, setBugDescription] = useState('');

  // Idea inputs - Default is empty string
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('');
  const [customIdeaCategory, setCustomIdeaCategory] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');

  // App Location Picker Modal
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'bug' | 'idea'>('bug');

  // Thread Inspector Modal
  const [inspectorReport, setInspectorReport] = useState<SubmittedDiscordReport | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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
    threadId?: string;
    threadUrl?: string;
    error?: string;
  } | null>(null);

  // Load remembered identity & report history on mount
  useEffect(() => {
    const stored = getStoredDiscordIdentity();
    setDiscordName(stored.discordName || 'Strudelgame');
    setDiscordUserId(stored.discordUserId || '');
    setSubmittedReports(getSubmittedDiscordReports());
  }, []);

  // Sync function from Discord API
  const performSync = useCallback(async (showFeedback = false) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    setIsSyncing(true);
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
  }, []);

  // 30-Second Auto-Poll (runs only while app is open & active)
  useEffect(() => {
    // Initial sync
    performSync();

    // Every 30 seconds
    const interval = setInterval(() => {
      performSync();
    }, 30000);

    // Event listeners for real-time synchronization across views
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
  };

  const isUserIdLengthValid = !discordUserId || (discordUserId.length >= 17 && discordUserId.length <= 20);

  const otherLabel = t('feedback.loc_other', lang, 'Sonstiges (Eigene Eingabe)');

  // Effective location / category
  const effectiveBugLocation = bugLocation === otherLabel || bugLocation.startsWith('Sonstiges') || bugLocation.startsWith('Other') || bugLocation.startsWith('Autre') || bugLocation.startsWith('Otro')
    ? (customBugLocation.trim() || 'Sonstiges')
    : bugLocation;

  const effectiveIdeaCategory = ideaCategory === otherLabel || ideaCategory.startsWith('Sonstiges') || ideaCategory.startsWith('Other') || ideaCategory.startsWith('Autre') || ideaCategory.startsWith('Otro')
    ? (customIdeaCategory.trim() || 'Sonstiges')
    : ideaCategory;

  const isBugStep2Complete = !!bugLocation && (
    (!bugLocation.includes('Sonstiges') && !bugLocation.includes('Other') && !bugLocation.includes('Autre') && !bugLocation.includes('Otro')) ||
    !!customBugLocation.trim()
  );

  const isIdeaStep2Complete = !!ideaCategory && (
    (!ideaCategory.includes('Sonstiges') && !ideaCategory.includes('Other') && !ideaCategory.includes('Autre') && !ideaCategory.includes('Otro')) ||
    !!customIdeaCategory.trim()
  );

  // Check if all 3 required fields are entered before preview and submit
  const isBugFormComplete = !!(bugTitle.trim() && isBugStep2Complete && bugDescription.trim());
  const isIdeaFormComplete = !!(ideaTitle.trim() && isIdeaStep2Complete && ideaDescription.trim());

  // Handle submit to Discord
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();

    const isBug = activeTab === 'bug';
    const title = (isBug ? bugTitle : ideaTitle).trim();
    const description = (isBug ? bugDescription : ideaDescription).trim();
    const locationOrCat = isBug ? bugLocation : ideaCategory;
    const categoryOrLocation = isBug ? effectiveBugLocation : effectiveIdeaCategory;

    // Step 1: Title
    if (!title) {
      alert(t('feedback.alert_step1', lang, 'Schritt 1: Bitte geben Sie einen Titel / Stichwort an.'));
      return;
    }

    // Step 2: Location
    if (!locationOrCat) {
      alert(t('feedback.alert_step2', lang, 'Schritt 2: Bitte wählen Sie einen Ort / eine App aus.'));
      return;
    }

    if (
      (locationOrCat.includes('Sonstiges') || locationOrCat.includes('Other') || locationOrCat.includes('Autre') || locationOrCat.includes('Otro')) &&
      !(isBug ? customBugLocation.trim() : customIdeaCategory.trim())
    ) {
      alert(t('feedback.alert_step2_custom', lang, 'Schritt 2: Bitte geben Sie den genauen Ort / die App ein.'));
      return;
    }

    // Step 3: Description
    if (!description) {
      alert(t('feedback.alert_step3', lang, 'Schritt 3: Bitte geben Sie eine Beschreibung ein.'));
      return;
    }

    // Validate Discord User ID if provided
    if (discordUserId.trim()) {
      if (discordUserId.length < 17 || discordUserId.length > 20) {
        alert(t('feedback.alert_discord_id', lang, 'Die Discord User-ID muss aus genau 17 bis 20 Ziffern bestehen. Lassen Sie das Feld leer, wenn Sie keine User-ID angeben möchten.'));
        return;
      }
    }

    // Save identity for next time
    saveStoredDiscordIdentity({
      discordName: discordName.trim() || 'Strudelgame',
      discordUserId: discordUserId.trim()
    });

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      const res = await sendDiscordReport({
        type: activeTab === 'bug' ? 'bug' : 'idea',
        title,
        categoryOrLocation,
        description,
        discordName: discordName.trim() || 'Strudelgame',
        discordUserId: discordUserId.trim() || undefined
      });

      setSubmissionResult(res);

      if (res.success) {
        sounds.playSuccess();
        setSubmittedReports(getSubmittedDiscordReports());
        performSync();

        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch {}

        // Reset inputs after successful send
        if (isBug) {
          setBugTitle('');
          setBugLocation('');
          setBugDescription('');
          setCustomBugLocation('');
        } else {
          setIdeaTitle('');
          setIdeaCategory('');
          setIdeaDescription('');
          setCustomIdeaCategory('');
        }
      } else {
        sounds.playError();
      }
    } catch (err: any) {
      sounds.playError();
      setSubmissionResult({
        success: false,
        error: err?.message || String(err)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    sounds.playClick();
    deleteSubmittedDiscordReport(id);
    setSubmittedReports(getSubmittedDiscordReports());
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
           (r.appliedTags && r.appliedTags.some(t => t.name.toLowerCase().includes(q)));
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden select-text">
      
      {/* App Header & Navigation */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold">
                  {t('feedback.app_title', lang, 'Bug-Reports & Community-Meldungen')}
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {t('feedback.bot_online', lang, 'Discord Bot Online')}
                </span>
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
              title={t('feedback.sync_now', lang, 'Jetzt von Discord abrufen')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              <span>{isSyncing ? t('feedback.syncing', lang, 'Prüfe Discord...') : t('feedback.sync_now', lang, 'Jetzt synchronisieren')}</span>
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

        {/* 3 Tabs */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 gap-1 max-w-xl">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setActiveTab('bug');
              setSubmissionResult(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'bug'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="truncate">{t('feedback.tab_bug', lang, 'Bug melden (#🐛)')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setActiveTab('idea');
              setSubmissionResult(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'idea'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">{t('feedback.tab_idea', lang, 'Idee & Feedback (#💡)')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setActiveTab('history');
              setSubmittedReports(getSubmittedDiscordReports());
              setSubmissionResult(null);
              performSync();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{t('feedback.tab_history', lang, 'Meine Tickets')} ({submittedReports.length})</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          
          {/* Success / Error Banners */}
          {submissionResult && (
            <div className={`p-4 rounded-2xl border animate-fade-in ${
              submissionResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {submissionResult.success ? (
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {submissionResult.success 
                        ? t('feedback.success_title', lang, 'Erfolgreich an Discord übertragen!')
                        : (lang === 'de' ? 'Übertragung fehlgeschlagen' : 'Submission failed')}
                    </div>
                    <div className="text-[11px] opacity-90 mt-0.5">
                      {submissionResult.success 
                        ? t('feedback.success_desc', lang, 'Ihr Beitrag wurde im Discord-Forum gepostet und als Ticket gespeichert.')
                        : submissionResult.error}
                    </div>
                  </div>
                </div>

                {submissionResult.threadUrl && (
                  <a
                    href={submissionResult.threadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5865F2] text-white text-xs font-bold hover:bg-[#4752C4] transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    <span>{t('feedback.view_ticket', lang, 'Auf Discord ansehen')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HISTORY / TICKETS */}
          {activeTab === 'history' ? (
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-[11px] font-bold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? t('feedback.syncing', lang, 'Prüfe Discord...') : t('feedback.sync_now', lang, 'Jetzt aktualisieren')}</span>
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
                        if (confirm(t('feedback.clear_history_confirm', lang, 'Möchten Sie den lokalen Verlauf wirklich leeren?'))) {
                          localStorage.removeItem('socdof_discord_submitted_reports_v1');
                          setSubmittedReports([]);
                          sounds.playClick();
                        }
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
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map(rep => (
                    <div
                      key={rep.id}
                      className={`p-4 rounded-2xl bg-white dark:bg-slate-850 border space-y-3 shadow-xs transition ${
                        rep.status === 'resolved'
                          ? 'border-emerald-200 dark:border-emerald-900/60 opacity-90'
                          : rep.status === 'rejected'
                          ? 'border-rose-200 dark:border-rose-900/60 opacity-90'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {rep.type === 'bug' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center gap-1">
                              <Bug className="w-3 h-3" />
                              <span>BUG</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              <span>IDEE</span>
                            </span>
                          )}

                          {/* Live Discord Status Pill matching forum tags */}
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

                          {/* Discord message count reply button */}
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

                          {/* Locked / Archived tag */}
                          {(rep.isArchived || rep.isLocked) && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              🔒 {t('feedback.discord_archived', lang, 'Archiviert / Geschlossen')}
                            </span>
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

                      {/* Discord Live Applied Forum Tags */}
                      {rep.appliedTags && rep.appliedTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-[#5865F2]" />
                            <span>{t('feedback.discord_tags_label', lang, 'Live Discord-Tags:')}</span>
                          </span>
                          {rep.appliedTags.map((tag, idx) => {
                            const customEmojiUrl = tag.emojiId
                              ? `https://cdn.discordapp.com/emojis/${tag.emojiId}.webp?size=32&quality=lossless`
                              : null;

                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#5865F2]/10 dark:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] dark:text-indigo-300 shadow-2xs"
                              >
                                {customEmojiUrl ? (
                                  <img src={customEmojiUrl} alt="" className="w-3.5 h-3.5 object-contain inline-block" />
                                ) : tag.emojiName ? (
                                  <span>{tag.emojiName}</span>
                                ) : null}
                                <span>#{tag.name}</span>
                              </span>
                            );
                          })}
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
                          {/* Thread Inspector / Messages Viewer button */}
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
                            <span>{t('feedback.view_thread_messages', lang, 'Nachrichten & Status ansehen')}</span>
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

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(rep.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title={t('feedback.delete_item_title', lang, 'Aus lokalem Verlauf entfernen')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* TAB 1 & 2: REPORT CREATION FORM */
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Instruction Checklist Box */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">i</span>
                  <span>{activeTab === 'bug' ? t('feedback.guide_title_bug', lang, 'Anleitung für Bug-Meldung:') : t('feedback.guide_title_idea', lang, 'Anleitung für Feedback & Vorschläge:')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                    (activeTab === 'bug' ? !!bugTitle.trim() : !!ideaTitle.trim())
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {(activeTab === 'bug' ? !!bugTitle.trim() : !!ideaTitle.trim()) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CircleDot className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{t('feedback.step1_label', lang, '1. Titel / Stichwort')}</span>
                  </div>

                  <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                    (activeTab === 'bug' ? isBugStep2Complete : isIdeaStep2Complete)
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {(activeTab === 'bug' ? isBugStep2Complete : isIdeaStep2Complete) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CircleDot className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{t('feedback.step2_label', lang, '2. Ort / App wählen')}</span>
                  </div>

                  <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                    (activeTab === 'bug' ? !!bugDescription.trim() : !!ideaDescription.trim())
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {(activeTab === 'bug' ? !!bugDescription.trim() : !!ideaDescription.trim()) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CircleDot className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{activeTab === 'bug' ? t('feedback.step3_bug_label', lang, '3. Fehlerbeschreibung') : t('feedback.step3_idea_label', lang, '3. Ideenbeschreibung')}</span>
                  </div>
                </div>
              </div>

              {/* Discord Identity Card */}
              <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-slate-850 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  <AtSign className="w-4 h-4" />
                  <span>{t('feedback.identity_title', lang, 'Discord-Identität für Erwähnung / Ping:')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.discord_name', lang, 'Discord-Name:')}
                    </label>
                    <input
                      type="text"
                      value={discordName}
                      onChange={e => setDiscordName(e.target.value)}
                      placeholder="z. B. Strudelgame"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {t('feedback.discord_user_id', lang, 'Discord User-ID (Optional):')}
                      </label>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {discordUserId ? `${discordUserId.length}/20` : t('feedback.discord_user_id_hint', lang, '17–20 Ziffern für echten Ping')}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={20}
                      value={discordUserId}
                      onChange={e => handleUserIdChange(e.target.value)}
                      placeholder="z. B. 1498764033518735441"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 shadow-2xs font-mono transition ${
                        !isUserIdLengthValid
                          ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10.5px]">
                  <p className="text-slate-500 dark:text-slate-400 leading-snug">
                    💡 <strong>{t('status.version_label', lang, 'Tipp')}:</strong> {t('feedback.discord_id_tip', lang, 'Eine Discord-ID besteht immer aus 17 bis 20 Ziffern. Wenn du sie eingibst, wirst du in Discord direkt benachrichtigt (<@ID>).')}
                  </p>

                  {discordUserId && (
                    <div className="shrink-0 pl-2">
                      {discordUserId.length >= 17 && discordUserId.length <= 20 ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {t('feedback.valid_user_id', { count: discordUserId.length })}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          {t('feedback.invalid_user_id', { count: discordUserId.length })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields: Bug Mode */}
              {activeTab === 'bug' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step1_bug_title', lang, 'Schritt 1: Bug-Titel / Kurzbeschreibung:')}
                    </label>
                    <input
                      type="text"
                      value={bugTitle}
                      onChange={e => setBugTitle(e.target.value)}
                      placeholder={t('feedback.step1_bug_placeholder', lang, 'z. B. Rechnungsdruck schneidet Fußzeile ab')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step2_bug_title', lang, 'Schritt 2: Ort des Fehlers (App / Modul):')}
                    </label>
                    
                    {!bugLocation ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setPickerTarget('bug');
                          setIsAppPickerOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:bg-orange-500 group-hover:text-white flex items-center justify-center transition-colors">
                            <Search className="w-4 h-4" />
                          </div>
                          <span>{t('feedback.select_location_btn', lang, 'Wähle einen Ort aus...')}</span>
                        </div>
                        <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 group-hover:underline">
                          {t('feedback.change_location_btn', lang, 'App auswählen')} &rarr;
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                              {bugLocation}
                            </span>
                            <span className="text-[10px] text-orange-700 dark:text-orange-300">
                              {t('feedback.step2_label', lang, 'Ausgewähltes Modul')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setPickerTarget('bug');
                            setIsAppPickerOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-xs font-bold transition cursor-pointer shrink-0 ml-2"
                        >
                          {t('feedback.change_location_btn', lang, 'Ort ändern...')}
                        </button>
                      </div>
                    )}

                    {(bugLocation.includes('Sonstiges') || bugLocation.includes('Other') || bugLocation.includes('Autre') || bugLocation.includes('Otro')) && (
                      <div className="mt-2 animate-fade-in">
                        <input
                          type="text"
                          value={customBugLocation}
                          onChange={e => setCustomBugLocation(e.target.value)}
                          placeholder={t('feedback.custom_location_placeholder', lang, 'Geben Sie den genauen Ort / die App ein...')}
                          className="w-full px-3 py-2 bg-orange-50/40 dark:bg-orange-950/20 border border-orange-300 dark:border-orange-800/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step3_bug_title', lang, 'Schritt 3: Genaue Fehlerbeschreibung (Bug Information):')}
                    </label>
                    <textarea
                      rows={4}
                      value={bugDescription}
                      onChange={e => setBugDescription(e.target.value)}
                      placeholder={t('feedback.step3_bug_placeholder', lang, '1. Was haben Sie gemacht?\n2. Welcher Fehler trat auf?\n3. Erwartetes Verhalten...')}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Form Fields: Idea Mode */}
              {activeTab === 'idea' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step1_idea_title', lang, 'Schritt 1: Vorschlag / Titel der Idee:')}
                    </label>
                    <input
                      type="text"
                      value={ideaTitle}
                      onChange={e => setIdeaTitle(e.target.value)}
                      placeholder={t('feedback.step1_idea_placeholder', lang, 'z. B. Automatischer PDF-Massenexport für Steuerberater')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step2_idea_title', lang, 'Schritt 2: Kategorie / Bereich wählen:')}
                    </label>
                    
                    {!ideaCategory ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setPickerTarget('idea');
                          setIsAppPickerOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                            <Search className="w-4 h-4" />
                          </div>
                          <span>{t('feedback.select_category_btn', lang, 'Wähle eine Kategorie aus...')}</span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                          {t('feedback.change_category_btn', lang, 'Kategorie wählen')} &rarr;
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Lightbulb className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                              {ideaCategory}
                            </span>
                            <span className="text-[10px] text-indigo-700 dark:text-indigo-300">
                              {t('feedback.step2_label', lang, 'Ausgewählte Kategorie')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setPickerTarget('idea');
                            setIsAppPickerOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold transition cursor-pointer shrink-0 ml-2"
                        >
                          {t('feedback.change_category_btn', lang, 'Kategorie ändern...')}
                        </button>
                      </div>
                    )}

                    {(ideaCategory.includes('Sonstiges') || ideaCategory.includes('Other') || ideaCategory.includes('Autre') || ideaCategory.includes('Otro')) && (
                      <div className="mt-2 animate-fade-in">
                        <input
                          type="text"
                          value={customIdeaCategory}
                          onChange={e => setCustomIdeaCategory(e.target.value)}
                          placeholder={t('feedback.custom_location_placeholder', lang, 'Geben Sie die genaue Kategorie / den Bereich ein...')}
                          className="w-full px-3 py-2 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-300 dark:border-indigo-800/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('feedback.step3_idea_title', lang, 'Schritt 3: Genaue Beschreibung der Idee & Nutzen:')}
                    </label>
                    <textarea
                      rows={4}
                      value={ideaDescription}
                      onChange={e => setIdeaDescription(e.target.value)}
                      placeholder={t('feedback.step3_idea_placeholder', lang, 'Beschreiben Sie Ihren Wunsch, wie der Ablauf sein sollte und welchen Nutzen es bringt...')}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Discord Live Preview Box - Always Live & Authentic */}
              <div className="space-y-2">
                <DiscordEmbedPreview
                  type={activeTab === 'bug' ? 'bug' : 'idea'}
                  title={activeTab === 'bug' ? bugTitle : ideaTitle}
                  categoryOrLocation={activeTab === 'bug' ? effectiveBugLocation : effectiveIdeaCategory}
                  description={activeTab === 'bug' ? bugDescription : ideaDescription}
                  discordName={discordName}
                  discordUserId={discordUserId}
                />

                {!(activeTab === 'bug' ? isBugFormComplete : isIdeaFormComplete) && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircleDot className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{lang === 'de' ? 'Vorschau aktualisiert sich live bei der Eingabe. Füllen Sie alle 3 Schritte aus, um den Beitrag abzusenden.' : t('feedback.preview_hint_active', lang, 'Live Discord forum embed preview updates automatically while typing.')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || (activeTab === 'bug' ? !isBugFormComplete : !isIdeaFormComplete)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-white shadow-lg transition cursor-pointer ${
                    activeTab === 'bug'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-orange-500/20'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-indigo-500/20'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('feedback.submitting', lang, 'Wird an Discord übertragen...')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{activeTab === 'bug' ? t('feedback.submit_bug_btn', lang, 'Bug-Report jetzt an Discord senden') : t('feedback.submit_idea_btn', lang, 'Idee & Vorschlag an Discord senden')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* App & Location Picker Modal Popup */}
      <AppLocationPickerModal
        isOpen={isAppPickerOpen}
        onClose={() => setIsAppPickerOpen(false)}
        selectedLocation={pickerTarget === 'bug' ? bugLocation : ideaCategory}
        onSelect={(displayName, isCustom) => {
          if (pickerTarget === 'bug') {
            setBugLocation(displayName);
            if (!isCustom) {
              setCustomBugLocation('');
            }
          } else {
            setIdeaCategory(displayName);
            if (!isCustom) {
              setCustomIdeaCategory('');
            }
          }
        }}
        title={pickerTarget === 'bug' ? t('feedback.picker_title', lang, 'App oder Modul auswählen') : t('feedback.step2_idea_title', lang, 'Kategorie / Bereich wählen')}
        subtitle={pickerTarget === 'bug' ? t('feedback.picker_desc', lang, 'Wählen Sie die betroffene App für diesen Bug-Report:') : t('feedback.step2_idea_title', lang, 'Wählen Sie den passenden Bereich für Ihre Idee:')}
      />

      {/* Discord Thread Messages Inspector Modal */}
      <DiscordThreadInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        report={inspectorReport}
        onRefreshReport={() => performSync(false)}
      />
    </div>
  );
};
