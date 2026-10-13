import React, { useState, useEffect } from 'react';
import { X, KeyRound, Check, AlertCircle, RefreshCw, Eye, EyeOff, Trash2, Bot, ShieldCheck } from 'lucide-react';
import { getDiscordBotToken, saveDiscordBotToken } from '../lib/discordFeedback';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

interface DiscordBotTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const DiscordBotTokenModal: React.FC<DiscordBotTokenModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const lang = useLanguage();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    botName?: string;
    error?: string;
  }>({ tested: false, success: false });

  useEffect(() => {
    if (isOpen) {
      setToken(getDiscordBotToken());
      setShowToken(false);
      setTestResult({ tested: false, success: false });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestToken = async () => {
    const clean = token.trim();
    if (!clean) {
      setTestResult({
        tested: true,
        success: false,
        error: lang === 'de' ? 'Bitte geben Sie einen Token ein.' : 'Please enter a token.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ tested: false, success: false });

    try {
      // 1. Try Desktop Electron IPC if available
      const electronApi = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
      if (electronApi?.discordRequest) {
        const res = await electronApi.discordRequest({
          endpoint: '/users/@me',
          method: 'GET',
          botToken: clean
        });
        if (res.ok && res.data?.id) {
          setTestResult({
            tested: true,
            success: true,
            botName: res.data.username
          });
          sounds.playSuccess();
          return;
        } else {
          setTestResult({
            tested: true,
            success: false,
            error: res.error || `HTTP ${res.status || 'Fehler'}`
          });
          return;
        }
      }

      // 2. Direct Discord API
      const resp = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${clean}`,
          'Content-Type': 'application/json'
        }
      });

      if (resp.ok) {
        const data = await resp.json();
        setTestResult({
          tested: true,
          success: true,
          botName: data.username
        });
        sounds.playSuccess();
      } else {
        const errText = await resp.text();
        setTestResult({
          tested: true,
          success: false,
          error: `HTTP ${resp.status}: ${errText}`
        });
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        error: err?.message || 'Verbindungsfehler'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const clean = token.trim();
    saveDiscordBotToken(clean);
    sounds.playSuccess();
    if (onSaved) onSaved();
    onClose();
  };

  const handleClear = () => {
    saveDiscordBotToken('');
    setToken('');
    setTestResult({ tested: false, success: false });
    sounds.playClick();
    if (onSaved) onSaved();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('feedback.bot_token_title', lang, 'Discord Bot-Token konfigurieren')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('feedback.bot_token_desc', lang, 'Ermöglicht das Live-Abrufen von Ticket-Status, Tags und Forums-Nachrichten direkt von Discord.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              {lang === 'de'
                ? 'Der Bot-Token wird lokal auf diesem Gerät gespeichert (localStorage & Desktop-Konfiguration). Er wird ausschließlich für autorisierte REST-Aufrufe an das Discord Forum (#🐛 | REPORT und #💡vorschläge) verwendet.'
                : 'The bot token is stored locally on this device (localStorage & desktop configuration). It is used exclusively for authorized REST requests to the Discord Forum.'}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>{t('feedback.bot_token_input_label', lang, 'Discord Bot Token (VITE_DISCORD_BOT_TOKEN)')}</span>
              {token.trim() && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{lang === 'de' ? 'Gespeichert' : 'Stored'}</span>
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="MTI... (Discord Bot Token)"
                className="w-full pl-3 pr-20 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showToken ? 'Verbergen' : 'Anzeigen'}
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Test connection result */}
          {testResult.tested && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              {testResult.success ? (
                <>
                  <Bot className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">{lang === 'de' ? 'Erfolgreich verbunden:' : 'Successfully connected:'}</span>{' '}
                    <span>{testResult.botName}</span>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-bold">{lang === 'de' ? 'Fehler:' : 'Error:'}</span>{' '}
                    <span>{testResult.error}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestToken}
              disabled={isTesting || !token.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? (lang === 'de' ? 'Prüfe...' : 'Testing...') : (lang === 'de' ? 'Verbindung testen' : 'Test connection')}</span>
            </button>

            {token.trim() && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                title={lang === 'de' ? 'Token entfernen' : 'Remove token'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              {t('common.cancel', lang, 'Abbrechen')}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('common.save', lang, 'Speichern')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
